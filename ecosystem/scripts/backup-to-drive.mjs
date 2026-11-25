#!/usr/bin/env node
// Encrypted Supabase database backups to Google Drive.
//
//   node scripts/backup-to-drive.mjs backup          dump, encrypt, upload, verify, prune
//   node scripts/backup-to-drive.mjs verify-latest   download the newest backup and prove it restores
//   node scripts/backup-to-drive.mjs list            list backups in the Drive folder
//   node scripts/backup-to-drive.mjs download [id]   download (newest or by Drive id) and decrypt to a .dump
//   node scripts/backup-to-drive.mjs decrypt <in> <out>
//   node scripts/backup-to-drive.mjs auth            one-time Google sign-in that prints a refresh token
//
// Every step fails loudly: a run either ends with a backup that was uploaded,
// checksum-verified against Drive and validated with pg_restore, or exits
// non-zero so the scheduler reports it. Old backups are pruned (moved to the
// Drive trash) only after the new one has been verified.
//
// See docs/backups.md for setup and restore instructions.
import { spawn } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSign,
  randomBytes,
  scryptSync,
} from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repoRoot = path.resolve(root, "..");

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const APP_PROPERTY = "d12backup";
const DEFAULT_FOLDER_NAME = "District 12 database backups";
const DUMP_SCHEMAS = ["public", "auth"];

// ---------------------------------------------------------------- env

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = (match[2] ?? "").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function env(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

function requireEnv(name) {
  const value = env(name);
  if (!value) throw new Error(`${name} is not set (see docs/backups.md)`);
  return value;
}

function intEnv(name, fallback) {
  const value = Number(env(name, String(fallback)));
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function log(message) {
  console.log(`[backup ${new Date().toISOString()}] ${message}`);
}

// ---------------------------------------------------------------- helpers

export async function withRetry(label, task, { attempts = 5, baseMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (error?.retryable === false || attempt === attempts) break;
      const wait = baseMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
      log(`${label} failed (attempt ${attempt}/${attempts}): ${error.message}. Retrying in ${wait} ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

function httpError(label, status, body) {
  const error = new Error(`${label}: HTTP ${status} ${String(body).slice(0, 400)}`);
  // 4xx other than rate limits and timeouts will not fix themselves.
  error.retryable = status >= 500 || status === 429 || status === 408;
  error.status = status;
  return error;
}

function run(command, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", capture ? "pipe" : "inherit", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      if (error.code !== "ENOENT") return reject(error);
      const missing = new Error(`${command} was not found. Install the PostgreSQL client or set PG_BIN.`);
      missing.retryable = false;
      reject(missing);
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${path.basename(command)} exited with ${code}: ${stderr.trim().slice(-800)}`));
    });
  });
}

function pgTool(name) {
  const bin = env("PG_BIN");
  return bin ? path.join(bin, name) : name;
}

async function hashFile(file) {
  const md5 = createHash("md5");
  const sha256 = createHash("sha256");
  await pipeline(
    fs.createReadStream(file),
    new Transform({
      transform(chunk, _encoding, done) {
        md5.update(chunk);
        sha256.update(chunk);
        done();
      },
    }),
  );
  return { md5: md5.digest("hex"), sha256: sha256.digest("hex") };
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

// ---------------------------------------------------------------- encryption
//
// File layout: "D12BK1" | salt (16) | iv (12) | AES-256-GCM ciphertext | tag (16)
// The key is derived from BACKUP_ENCRYPTION_KEY with scrypt and a per-file salt.

const MAGIC = Buffer.from("D12BK1");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function encryptionPassphrase() {
  const passphrase = requireEnv("BACKUP_ENCRYPTION_KEY");
  if (passphrase.length < 32) throw new Error("BACKUP_ENCRYPTION_KEY must be at least 32 characters");
  return passphrase;
}

export async function encryptFile(input, output, passphrase) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const out = fs.createWriteStream(output);
  out.write(Buffer.concat([MAGIC, salt, iv]));
  await pipeline(fs.createReadStream(input), cipher, out, { end: false });
  await new Promise((resolve, reject) => out.end(cipher.getAuthTag(), (error) => (error ? reject(error) : resolve())));
}

export async function decryptFile(input, output, passphrase) {
  const { size } = await fs.promises.stat(input);
  if (size < HEADER_BYTES + TAG_BYTES) throw new Error(`${input} is too small to be a backup`);
  const handle = await fs.promises.open(input, "r");
  const header = Buffer.alloc(HEADER_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await handle.read(header, 0, HEADER_BYTES, 0);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error(`${input} is not a District 12 backup`);
  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = header.subarray(MAGIC.length + SALT_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  const bodyEnd = size - TAG_BYTES - 1;
  try {
    await pipeline(
      bodyEnd < HEADER_BYTES ? Readable.from([]) : fs.createReadStream(input, { start: HEADER_BYTES, end: bodyEnd }),
      decipher,
      fs.createWriteStream(output),
    );
  } catch (error) {
    await fs.promises.rm(output, { force: true });
    if (/auth|unable to authenticate/i.test(error.message)) {
      throw new Error("Decryption failed: wrong BACKUP_ENCRYPTION_KEY or the file is corrupted");
    }
    throw error;
  }
}

// ---------------------------------------------------------------- retention

/**
 * Grandfather-father-son retention: the newest backup of each of the last
 * `daily` days, `weekly` ISO weeks and `monthly` months is kept, plus the
 * newest backup overall. Returns the ids to keep.
 */
export function selectKeep(files, { daily = 14, weekly = 8, monthly = 12 } = {}) {
  const keep = new Set();
  // Never delete something that cannot be dated.
  const dated = files.filter((file) => {
    if (Number.isNaN(new Date(file.createdTime).getTime())) {
      keep.add(file.id);
      return false;
    }
    return true;
  });
  const sorted = dated.sort((a, b) => String(b.createdTime).localeCompare(String(a.createdTime)));
  if (sorted[0]) keep.add(sorted[0].id);

  const bucket = (limit, keyOf) => {
    const seen = new Set();
    for (const file of sorted) {
      if (seen.size >= limit) break;
      const key = keyOf(new Date(file.createdTime));
      if (seen.has(key)) continue;
      seen.add(key);
      keep.add(file.id);
    }
  };

  bucket(daily, (date) => date.toISOString().slice(0, 10));
  bucket(weekly, isoWeek);
  bucket(monthly, (date) => date.toISOString().slice(0, 7));
  return keep;
}

function isoWeek(date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- Google auth

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function tokenRequest(body) {
  return withRetry("Google token", async () => {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    const text = await response.text();
    if (!response.ok) {
      const error = httpError("Google token", response.status, text);
      if (/invalid_grant/.test(text)) {
        error.message +=
          "\nThe refresh token was revoked or expired. If the OAuth consent screen is in 'Testing', tokens expire" +
          " after 7 days: publish it to 'In production', then run `node scripts/backup-to-drive.mjs auth` again.";
      }
      throw error;
    }
    return JSON.parse(text);
  });
}

let cachedToken = null;

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  let token;
  const serviceAccount = env("GDRIVE_SERVICE_ACCOUNT_JSON");
  if (serviceAccount) {
    const key = JSON.parse(serviceAccount);
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
      JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
    )}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key);
    token = await tokenRequest({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(signature)}`,
    });
  } else {
    token = await tokenRequest({
      grant_type: "refresh_token",
      client_id: requireEnv("GDRIVE_CLIENT_ID"),
      client_secret: requireEnv("GDRIVE_CLIENT_SECRET"),
      refresh_token: requireEnv("GDRIVE_REFRESH_TOKEN"),
    });
  }
  cachedToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function drive(label, url, init = {}, { parse = "json" } = {}) {
  return withRetry(label, async () => {
    const response = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${await accessToken()}`, ...(init.headers ?? {}) },
    });
    if (response.status === 401) cachedToken = null;
    if (!response.ok) throw httpError(label, response.status, await response.text());
    if (parse === "json") return response.status === 204 ? null : response.json();
    return response;
  });
}

// ---------------------------------------------------------------- Drive operations

async function resolveFolder() {
  const configured = env("GDRIVE_FOLDER_ID");
  if (configured) return configured;

  // drive.file only sees what this app created, so the app owns its folder.
  const name = env("GDRIVE_FOLDER_NAME", DEFAULT_FOLDER_NAME);
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
  const found = await drive(
    "find folder",
    `${DRIVE}/files?${new URLSearchParams({ q, fields: "files(id,name)", spaces: "drive", pageSize: "10" })}`,
  );
  if (found.files?.length) return found.files[0].id;

  const created = await drive("create folder", `${DRIVE}/files?fields=id`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
  });
  log(`Created Drive folder "${name}" (${created.id}). Set GDRIVE_FOLDER_ID=${created.id} to pin it.`);
  return created.id;
}

async function listBackups(folderId) {
  const files = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false and appProperties has { key='${APP_PROPERTY}' and value='1' }`,
      fields: "nextPageToken,files(id,name,size,md5Checksum,createdTime,appProperties)",
      orderBy: "createdTime desc",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await drive("list backups", `${DRIVE}/files?${params}`);
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return files;
}

async function uploadResumable(file, metadata) {
  const { size } = await fs.promises.stat(file);
  const session = await drive(
    "start upload",
    `${UPLOAD}/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,md5Checksum,createdTime`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": "application/octet-stream",
        "x-upload-content-length": String(size),
      },
      body: JSON.stringify(metadata),
    },
    { parse: "raw" },
  );
  const location = session.headers.get("location");
  if (!location) throw new Error("Drive did not return an upload session URL");

  let offset = 0;
  return withRetry(
    "upload",
    async (attempt) => {
      if (attempt > 1) offset = await uploadedBytes(location, size);
      if (offset >= size) {
        const done = await fetch(location, {
          method: "PUT",
          headers: { authorization: `Bearer ${await accessToken()}`, "content-range": `bytes */${size}` },
        });
        if (done.ok) return done.json();
        throw httpError("finish upload", done.status, await done.text());
      }
      const response = await fetch(location, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${await accessToken()}`,
          "content-length": String(size - offset),
          "content-range": `bytes ${offset}-${size - 1}/${size}`,
        },
        body: Readable.toWeb(fs.createReadStream(file, { start: offset })),
        duplex: "half",
      });
      if (response.ok) return response.json();
      const error = httpError("upload", response.status, await response.text());
      if (response.status === 404 || response.status === 410) {
        error.message += " (upload session expired; rerun the backup)";
        error.retryable = false;
      }
      throw error;
    },
    { attempts: 6, baseMs: 2000 },
  );
}

async function uploadedBytes(location, size) {
  const response = await fetch(location, {
    method: "PUT",
    headers: { authorization: `Bearer ${await accessToken()}`, "content-range": `bytes */${size}` },
  });
  if (response.ok) return size;
  if (response.status !== 308) throw httpError("upload status", response.status, await response.text());
  const range = response.headers.get("range");
  return range ? Number(range.split("-")[1]) + 1 : 0;
}

async function downloadFile(id, output) {
  const response = await drive(
    "download",
    `${DRIVE}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
    {},
    { parse: "raw" },
  );
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(output));
}

async function trashFile(id) {
  await drive("trash", `${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

// ---------------------------------------------------------------- pg

async function dumpDatabase(output) {
  const dbUrl = requireEnv("SUPABASE_DB_URL");
  const args = ["--format=custom", "--compress=9", "--no-owner", "--file", output];
  for (const schema of DUMP_SCHEMAS) args.push("--schema", schema);
  args.push(dbUrl);
  await run(pgTool("pg_dump"), args);
}

/** Proves the archive is readable by pg_restore and actually holds the app's data. */
async function validateDump(file) {
  const listing = await run(pgTool("pg_restore"), ["--list", file], { capture: true });
  const tables = listing.split("\n").filter((line) => / TABLE DATA public d12_/.test(line)).length;
  if (tables === 0) throw new Error("The dump contains no public.d12_* table data");
  if (!/ TABLE DATA public d12_iam_users /.test(listing)) throw new Error("The dump is missing d12_iam_users");
  return tables;
}

// ---------------------------------------------------------------- commands

async function withTempDir(task) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "d12-backup-"));
  try {
    return await task(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

function summary(lines) {
  const file = env("GITHUB_STEP_SUMMARY");
  if (file) fs.appendFileSync(file, `${lines.join("\n")}\n`);
}

async function backup() {
  const passphrase = encryptionPassphrase();
  const folderId = await resolveFolder();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace(/-\d{3}Z$/, "Z");

  const uploaded = await withTempDir(async (dir) => {
    const dump = path.join(dir, "db.dump");
    const encrypted = path.join(dir, "db.dump.enc");

    log(`Dumping schemas ${DUMP_SCHEMAS.join(", ")}`);
    await withRetry("pg_dump", () => dumpDatabase(dump), { attempts: 3, baseMs: 5000 });
    const tables = await validateDump(dump);
    log(`Dump OK: ${formatBytes((await fs.promises.stat(dump)).size)}, ${tables} d12 tables with data`);

    await encryptFile(dump, encrypted, passphrase);
    const { size } = await fs.promises.stat(encrypted);
    const { md5, sha256 } = await hashFile(encrypted);

    const name = `d12-db-${stamp}.dump.enc`;
    log(`Uploading ${name} (${formatBytes(size)})`);
    const file = await uploadResumable(encrypted, {
      name,
      parents: [folderId],
      mimeType: "application/octet-stream",
      description: `District 12 encrypted pg_dump (${DUMP_SCHEMAS.join(", ")}). sha256 ${sha256}`,
      appProperties: { [APP_PROPERTY]: "1", sha256, format: "pg_dump-custom+aes256gcm-v1", tables: String(tables) },
    });

    if (file.md5Checksum !== md5 || Number(file.size) !== size) {
      await trashFile(file.id).catch(() => {});
      throw new Error(`Drive copy does not match the local file (md5 ${file.md5Checksum} vs ${md5}); it was trashed`);
    }
    log(`Verified on Drive: ${file.id} md5 ${md5}`);
    return { ...file, tables };
  });

  const pruned = await prune(folderId);
  summary([
    "### Database backup",
    `- File: \`${uploaded.name}\` (${formatBytes(uploaded.size)})`,
    `- Tables with data: ${uploaded.tables}`,
    `- Drive id: \`${uploaded.id}\` (checksum verified)`,
    `- Old backups moved to trash: ${pruned}`,
  ]);
  return uploaded;
}

async function prune(folderId) {
  const files = await listBackups(folderId);
  const keep = selectKeep(files, {
    daily: intEnv("BACKUP_KEEP_DAILY", 14),
    weekly: intEnv("BACKUP_KEEP_WEEKLY", 8),
    monthly: intEnv("BACKUP_KEEP_MONTHLY", 12),
  });
  const stale = files.filter((file) => !keep.has(file.id));
  for (const file of stale) {
    await trashFile(file.id);
    log(`Moved ${file.name} to the Drive trash`);
  }
  log(`Retention: keeping ${keep.size} of ${files.length} backups`);
  return stale.length;
}

async function fetchAndDecrypt(file, output, passphrase, dir) {
  const encrypted = path.join(dir, "download.enc");
  await downloadFile(file.id, encrypted);
  const { sha256 } = await hashFile(encrypted);
  const expected = file.appProperties?.sha256;
  if (expected && expected !== sha256) throw new Error(`${file.name} is corrupted on Drive (sha256 mismatch)`);
  await decryptFile(encrypted, output, passphrase);
}

async function verifyLatest() {
  const passphrase = encryptionPassphrase();
  const folderId = await resolveFolder();
  const [latest] = await listBackups(folderId);
  if (!latest) throw new Error("No backups found in the Drive folder");

  const maxAgeHours = intEnv("BACKUP_MAX_AGE_HOURS", 36);
  const ageHours = (Date.now() - new Date(latest.createdTime).getTime()) / 3_600_000;
  if (ageHours > maxAgeHours) {
    throw new Error(`Newest backup ${latest.name} is ${ageHours.toFixed(1)} h old (limit ${maxAgeHours} h)`);
  }

  await withTempDir(async (dir) => {
    const dump = path.join(dir, "restore-check.dump");
    await fetchAndDecrypt(latest, dump, passphrase, dir);
    const tables = await validateDump(dump);
    log(`Restore check passed for ${latest.name}: decrypted and readable, ${tables} d12 tables with data`);
    summary([`- Restore check: \`${latest.name}\` downloaded, decrypted and read by pg_restore (${tables} tables)`]);
  });
}

async function list() {
  const files = await listBackups(await resolveFolder());
  if (!files.length) return log("No backups yet");
  for (const file of files) {
    console.log(`${file.createdTime}  ${formatBytes(file.size).padStart(9)}  ${file.id}  ${file.name}`);
  }
}

async function download(id) {
  const passphrase = encryptionPassphrase();
  const files = await listBackups(await resolveFolder());
  const file = id ? files.find((entry) => entry.id === id) : files[0];
  if (!file) throw new Error(id ? `No backup with id ${id}` : "No backups found");
  const output = path.resolve(file.name.replace(/\.enc$/, ""));
  await withTempDir((dir) => fetchAndDecrypt(file, output, passphrase, dir));
  log(`Decrypted ${file.name} to ${output}. Restore it with pg_restore (see docs/backups.md).`);
}

async function auth() {
  const clientId = requireEnv("GDRIVE_CLIENT_ID");
  const clientSecret = requireEnv("GDRIVE_CLIENT_SECRET");
  const state = randomBytes(16).toString("hex");

  let port = 0;
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname !== "/callback") return response.writeHead(404).end();
      const error = url.searchParams.get("error");
      const received = url.searchParams.get("code");
      const ok = !error && received && url.searchParams.get("state") === state;
      response.writeHead(ok ? 200 : 400, { "content-type": "text/plain" });
      response.end(ok ? "District 12 backups are authorised. You can close this tab." : "Authorisation failed.");
      server.close();
      if (ok) resolve({ code: received, redirect: `http://127.0.0.1:${port}/callback` });
      else reject(new Error(error || "state mismatch"));
    });
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      consent.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `http://127.0.0.1:${port}/callback`,
        response_type: "code",
        scope: SCOPE,
        access_type: "offline",
        prompt: "consent",
        state,
      }).toString();
      console.log(`\nOpen this URL, sign in with the Google account that should own the backups:\n\n${consent}\n`);
    });
  });

  const token = await tokenRequest({
    grant_type: "authorization_code",
    code: code.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: code.redirect,
  });
  if (!token.refresh_token) throw new Error("Google returned no refresh token; revoke the app's access and retry");
  console.log("\nAdd this as the GDRIVE_REFRESH_TOKEN secret (keep it private):\n");
  console.log(token.refresh_token);
}

// ---------------------------------------------------------------- main

const commands = {
  backup,
  "verify-latest": verifyLatest,
  list,
  download: (id) => download(id),
  decrypt: async (input, output) => {
    if (!input || !output) throw new Error("Usage: decrypt <input.enc> <output.dump>");
    await decryptFile(input, output, encryptionPassphrase());
    log(`Decrypted to ${output}`);
  },
  auth,
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  for (const dir of [root, repoRoot]) {
    loadEnvFile(path.join(dir, ".env.local"));
    loadEnvFile(path.join(dir, ".env"));
  }
  const [command = "", ...rest] = process.argv.slice(2);
  const handler = commands[command];
  if (!handler) {
    console.log(`Usage: node scripts/backup-to-drive.mjs <${Object.keys(commands).join("|")}>`);
    process.exit(command ? 1 : 0);
  }
  handler(...rest).catch((error) => {
    console.error(`[backup] FAILED: ${error.message}`);
    process.exit(1);
  });
}
