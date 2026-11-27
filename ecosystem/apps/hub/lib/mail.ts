import nodemailer from "nodemailer";
import { createServiceClient, hasServiceRoleEnv } from "@d12/db";
import { TENANTS, hubAppUrl, type TenantId } from "@d12/contracts";

export interface MailSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
}

export interface MailResult {
  sent: boolean;
  detail: string;
}

export interface MailSettingsView {
  host: string;
  port: number;
  username: string;
  from: string;
  passwordSet: boolean;
}

const NOT_CONFIGURED = "Mail is not set up. The group administrator can add SMTP on Settings, then send a new temporary password.";

interface MemorySettings {
  settings: MailSettings;
}

const memory = globalThis as typeof globalThis & { __d12MailSettings?: MemorySettings };

function blankSettings(): MailSettings {
  return { host: "", port: 587, username: "", password: "", from: "" };
}

function memorySettings(): MailSettings {
  return (memory.__d12MailSettings ??= { settings: blankSettings() }).settings;
}

function view(settings: MailSettings): MailSettingsView {
  return {
    host: settings.host,
    port: settings.port,
    username: settings.username,
    from: settings.from,
    passwordSet: settings.password.length > 0,
  };
}

export async function readMailSettings(): Promise<MailSettings> {
  if (!hasServiceRoleEnv()) return { ...memorySettings() };
  const { data, error } = await createServiceClient()
    .from("d12_mail_settings")
    .select("host, port, username, password, from_address")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    from_address?: string;
  } | null;
  return {
    host: row?.host ?? "",
    port: row?.port ?? 587,
    username: row?.username ?? "",
    password: row?.password ?? "",
    from: row?.from_address ?? "",
  };
}

export async function readMailSettingsView(): Promise<MailSettingsView> {
  return view(await readMailSettings());
}

export async function saveMailSettings(input: MailSettings): Promise<MailSettingsView> {
  const current = await readMailSettings();
  const next: MailSettings = {
    host: input.host.trim(),
    port: input.port,
    username: input.username.trim(),
    password: input.password.length > 0 ? input.password : current.password,
    from: input.from.trim(),
  };
  if (!hasServiceRoleEnv()) {
    Object.assign(memorySettings(), next);
    return view(next);
  }
  const { error } = await createServiceClient().from("d12_mail_settings").upsert({
    id: "default",
    host: next.host,
    port: next.port,
    username: next.username,
    password: next.password,
    from_address: next.from,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return view(next);
}

function ready(settings: MailSettings): boolean {
  return Boolean(settings.host && settings.port && settings.from && settings.username && settings.password);
}

async function deliver(
  settings: MailSettings,
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.username, pass: settings.password },
  });
  await transport.sendMail({
    from: { name: "District 12 Group", address: settings.from },
    to,
    subject,
    text,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Email templates
//
// Built for Gmail, Outlook (desktop + web) and Apple Mail: table layout,
// inline styles, 600px max width. The <style> block only adds progressive
// enhancement (mobile padding, dark mode for clients that support it). Every
// interpolated value goes through escapeHtml.
// ---------------------------------------------------------------------------

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono','Courier New',monospace";

const C = {
  page: "#F4F1EF",
  card: "#FFFFFF",
  border: "#E7E1DD",
  soft: "#FAF7F5",
  ink: "#1B1515",
  body: "#4A4241",
  muted: "#7B716E",
  brand: "#A40000",
  brandSoft: "#FBEFEF",
  code: "#1B1515",
  codeText: "#FFFFFF",
};

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function layout(input: {
  preheader: string;
  title: string;
  eyebrow: string;
  heading: string;
  body: string;
  footerNote: string;
}): string {
  const hub = hubAppUrl();
  const year = new Date().getFullYear();
  // Padding after the preheader keeps clients from pulling body text into the inbox preview.
  const preheaderPad = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
  .d12-select { -webkit-user-select:all; user-select:all; }
  @media only screen and (max-width:620px) {
    .d12-outer { padding:16px 10px !important; }
    .d12-pad { padding-left:22px !important; padding-right:22px !important; }
    .d12-h1 { font-size:24px !important; line-height:31px !important; }
    .d12-btn-wrap, .d12-btn { width:100% !important; }
    .d12-code { font-size:20px !important; letter-spacing:1px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .d12-page { background:#121010 !important; }
    .d12-card { background:#1D1918 !important; border-color:#342D2B !important; }
    .d12-soft { background:#262120 !important; border-color:#3A3230 !important; }
    .d12-rule { border-color:#342D2B !important; }
    .d12-ink { color:#F6F1EF !important; }
    .d12-body { color:#D7CFCC !important; }
    .d12-muted { color:#A69B97 !important; }
    .d12-brand { color:#FF7A6E !important; }
    .d12-chip { background:#3A1A18 !important; color:#FFB4AC !important; }
    .d12-note { background:#2A1C1B !important; }
    .d12-code-cell { background:#0B0909 !important; border-color:#4A3E3B !important; }
  }
  [data-ogsc] .d12-ink { color:#F6F1EF !important; }
  [data-ogsc] .d12-body { color:#D7CFCC !important; }
  [data-ogsc] .d12-muted { color:#A69B97 !important; }
  [data-ogsc] .d12-brand { color:#FF7A6E !important; }
  [data-ogsb] .d12-page { background:#121010 !important; }
  [data-ogsb] .d12-card { background:#1D1918 !important; }
  [data-ogsb] .d12-soft { background:#262120 !important; }
</style>
</head>
<body class="d12-page" style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}${preheaderPad}</div>
<table role="presentation" class="d12-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
  <tr>
    <td align="center" class="d12-outer" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
        <tr>
          <td class="d12-card" style="background:${C.card};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="6" style="height:6px;line-height:6px;font-size:6px;background:${C.brand};border-radius:16px 16px 0 0;">&nbsp;</td></tr>
              <tr>
                <td class="d12-pad" style="padding:26px 40px 22px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="middle" style="padding-right:12px;">
                        <a href="${escapeHtml(hub)}" style="text-decoration:none;"><img src="${escapeHtml(hub)}/brand/district12-mark-256.png" width="44" height="44" alt="District 12" style="display:block;width:44px;height:44px;border-radius:10px;border:0;"></a>
                      </td>
                      <td valign="middle" style="font-family:${FONT};">
                        <div class="d12-ink" style="font-size:18px;line-height:22px;font-weight:800;letter-spacing:-0.2px;color:${C.ink};">District 12</div>
                        <div class="d12-muted" style="font-size:11px;line-height:16px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${C.muted};">Group of Companies</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td class="d12-pad" style="padding:0 40px;"><div class="d12-rule" style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</div></td></tr>
              <tr>
                <td class="d12-pad" style="padding:32px 40px 36px;font-family:${FONT};">
                  <p class="d12-brand" style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.brand};">${escapeHtml(input.eyebrow)}</p>
                  <h1 class="d12-ink d12-h1" style="margin:0 0 18px;font-family:${FONT};font-size:28px;line-height:35px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">${escapeHtml(input.heading)}</h1>
                  ${input.body}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="d12-pad" align="center" style="padding:24px 40px 8px;font-family:${FONT};font-size:12px;line-height:19px;color:${C.muted};">
            <p class="d12-muted" style="margin:0 0 8px;color:${C.muted};">${escapeHtml(input.footerNote)}</p>
            <p class="d12-muted" style="margin:0;color:${C.muted};">&copy; ${year} District 12 Group of Companies &middot; <a class="d12-muted" href="${escapeHtml(hub)}" style="color:${C.muted};text-decoration:underline;">District 12 hub</a></p>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** A body paragraph. `html` must already be escaped. */
function paragraph(html: string, options: { muted?: boolean; size?: number; last?: boolean } = {}): string {
  const size = options.size ?? 16;
  const color = options.muted ? C.muted : C.body;
  const cls = options.muted ? "d12-muted" : "d12-body";
  return `<p class="${cls}" style="margin:0 0 ${options.last ? 0 : 20}px;font-family:${FONT};font-size:${size}px;line-height:${Math.round(size * 1.6)}px;color:${color};">${html}</p>`;
}

/** Small uppercase label used above values and sections. */
function label(text: string, marginBottom = 6): string {
  return `<p class="d12-muted" style="margin:0 0 ${marginBottom}px;font-family:${FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${C.muted};">${escapeHtml(text)}</p>`;
}

/** A label/value row inside a details panel. `value` is plain text and is escaped here. */
function row(name: string, value: string, options: { first?: boolean } = {}): string {
  const rule = options.first ? "" : `border-top:1px solid ${C.border};`;
  return `<tr>
    <td class="d12-rule" style="padding:14px 20px;${rule}">
      ${label(name, 3)}
      <p class="d12-ink" style="margin:0;font-family:${FONT};font-size:16px;line-height:24px;font-weight:600;color:${C.ink};word-break:break-all;">${escapeHtml(value)}</p>
    </td>
  </tr>`;
}

function panel(rows: string): string {
  return `<table role="presentation" class="d12-soft" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;background:${C.soft};border:1px solid ${C.border};border-radius:12px;border-collapse:separate;">${rows}</table>`;
}

/** A secret (temporary password, sign-in code) in a high-contrast monospace block that selects in one tap. */
function codeBlock(
  value: string,
  options: { label?: string; hint?: string; first?: boolean; size?: number; spacing?: number } = {},
): string {
  const rule = options.first ? "" : `border-top:1px solid ${C.border};`;
  const size = options.size ?? 22;
  const hint = options.hint ?? "Tap or double-click the password to select it, then copy. It is case-sensitive.";
  return `<tr>
    <td class="d12-rule" style="padding:14px 20px 18px;${rule}">
      ${label(options.label ?? "Temporary password", 8)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="d12-code-cell" align="center" bgcolor="${C.code}" style="background:${C.code};border:1px solid ${C.code};border-radius:10px;padding:16px 14px;">
            <span class="d12-code d12-select" style="font-family:${MONO};font-size:${size}px;line-height:${size + 6}px;font-weight:700;letter-spacing:${options.spacing ?? 2}px;color:${C.codeText};word-break:break-all;-webkit-user-select:all;user-select:all;">${escapeHtml(value)}</span>
          </td>
        </tr>
      </table>
      <p class="d12-muted" style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};">${escapeHtml(hint)}</p>
    </td>
  </tr>`;
}

function button(href: string, text: string): string {
  return `<table role="presentation" class="d12-btn-wrap" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
    <tr>
      <td class="d12-btn" align="center" bgcolor="${C.brand}" style="background:${C.brand};border-radius:10px;mso-padding-alt:15px 32px;">
        <a href="${escapeHtml(href)}" target="_blank" style="display:block;padding:15px 32px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escapeHtml(text)}&nbsp;&rarr;</a>
      </td>
    </tr>
  </table>`;
}

function note(title: string, text: string): string {
  return `<table role="presentation" class="d12-note" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:${C.brandSoft};border-left:4px solid ${C.brand};border-radius:0 10px 10px 0;">
    <tr>
      <td style="padding:16px 20px;font-family:${FONT};">
        <p class="d12-ink" style="margin:0 0 4px;font-size:15px;line-height:22px;font-weight:700;color:${C.ink};">${escapeHtml(title)}</p>
        <p class="d12-body" style="margin:0;font-size:14px;line-height:22px;color:${C.body};">${escapeHtml(text)}</p>
      </td>
    </tr>
  </table>`;
}

function chips(names: string[]): string {
  if (names.length === 0) return "";
  const items = names
    .map((name) => `<span class="d12-chip" style="display:inline-block;margin:0 6px 8px 0;padding:6px 12px;border-radius:999px;background:${C.brandSoft};font-family:${FONT};font-size:13px;line-height:18px;font-weight:600;color:${C.brand};white-space:nowrap;">${escapeHtml(name)}</span>`)
    .join("");
  return `${label("Your companies", 10)}<div style="margin:0 0 20px;">${items}</div>`;
}

function fallbackLink(href: string): string {
  return `<div class="d12-rule" style="border-top:1px solid ${C.border};padding-top:20px;">
    ${paragraph(`Button not working? Copy this link into your browser:<br><a class="d12-brand" href="${escapeHtml(href)}" style="color:${C.brand};text-decoration:underline;word-break:break-all;">${escapeHtml(href)}</a>`, { muted: true, size: 13, last: true })}
  </div>`;
}

const TEXT_RULE = "------------------------------------------------------------";

export function renderTestEmail(input: { host: string; port: number; from: string; sentAt?: Date }): RenderedEmail {
  const hub = hubAppUrl();
  const settingsUrl = `${hub}/settings`;
  const server = `${input.host}:${input.port}`;
  const sentAt = (input.sentAt ?? new Date()).toUTCString();
  const subject = "District 12 mail test";
  const text = [
    "DISTRICT 12 GROUP OF COMPANIES",
    TEXT_RULE,
    "",
    "Mail settings are working",
    "",
    "District 12 sent this message with the SMTP settings saved by the group administrator.",
    "New sign-ins created in HR will receive their temporary password in this same format.",
    "",
    `SMTP server: ${server}`,
    `From address: ${input.from}`,
    `Sent: ${sentAt}`,
    "",
    `Mail settings: ${settingsUrl}`,
    "",
    TEXT_RULE,
    "You received this because someone tested the mail settings in the District 12 hub.",
    `District 12 hub: ${hub}`,
  ].join("\n");
  const html = layout({
    preheader: "Your District 12 mail settings are working. New sign-ins will get their temporary password like this.",
    title: subject,
    eyebrow: "SMTP check passed",
    heading: "Mail settings are working",
    body: [
      paragraph("District 12 sent this message with the SMTP settings saved by the group administrator. New sign-ins created in HR will receive their temporary password in this same format."),
      panel([
        row("SMTP server", server, { first: true }),
        row("From address", input.from),
        row("Sent", sentAt),
      ].join("")),
      button(settingsUrl, "Open mail settings"),
      fallbackLink(settingsUrl),
    ].join(""),
    footerNote: "You received this because someone tested the mail settings in the District 12 hub. No action is needed.",
  });
  return { subject, text, html };
}

export function renderCredentialEmail(input: {
  name: string;
  email: string;
  password: string;
  tenants: TenantId[];
}): RenderedEmail {
  const hub = hubAppUrl();
  const loginUrl = `${hub}/login`;
  const companyNames = input.tenants.map((id) => TENANTS[id]?.shortName ?? id);
  const subject = "Your District 12 sign-in";
  const text = [
    "DISTRICT 12 GROUP OF COMPANIES",
    TEXT_RULE,
    "",
    `Welcome to District 12, ${input.name}`,
    "",
    "HR has created a District 12 sign-in for you. Use these details to sign in for the first time.",
    "",
    `  Email:              ${input.email}`,
    `  Temporary password: ${input.password}`,
    "",
    `Sign in: ${loginUrl}`,
    "",
    "CHOOSE YOUR OWN PASSWORD",
    "This temporary password works for one sign-in. You will be asked to choose a new password before the hub or any company opens.",
    ...(companyNames.length > 0 ? ["", `Your companies: ${companyNames.join(", ")}`] : []),
    "",
    TEXT_RULE,
    "If you did not expect this email, contact District 12 HR and do not use the password.",
    `District 12 hub: ${hub}`,
  ].join("\n");
  const html = layout({
    preheader: "Your District 12 sign-in is ready. Your temporary password is inside.",
    title: subject,
    eyebrow: "Your sign-in is ready",
    heading: `Welcome to District 12, ${input.name}`,
    body: [
      paragraph("HR has created a District 12 sign-in for you. Use these details to sign in for the first time."),
      panel(row("Email", input.email, { first: true }) + codeBlock(input.password)),
      button(loginUrl, "Sign in to District 12"),
      note(
        "Choose your own password",
        "This temporary password works for one sign-in. You will be asked to choose a new password before the hub or any company opens.",
      ),
      chips(companyNames),
      fallbackLink(loginUrl),
    ].join(""),
    footerNote: "If you did not expect this email, contact District 12 HR and do not use the password.",
  });
  return { subject, text, html };
}

export function renderTwoFactorEmail(input: { name: string; code: string; minutes: number }): RenderedEmail {
  const hub = hubAppUrl();
  const subject = `${input.code} is your District 12 sign-in code`;
  const text = [
    "DISTRICT 12 GROUP OF COMPANIES",
    TEXT_RULE,
    "",
    `Hello ${input.name},`,
    "",
    "Use this code to finish signing in to District 12:",
    "",
    `    ${input.code}`,
    "",
    `The code expires in ${input.minutes} minutes and works once.`,
    "",
    "DIDN'T TRY TO SIGN IN?",
    "Someone has your password. Do not share this code. Change your password and tell District 12 HR.",
    "",
    TEXT_RULE,
    "District 12 never asks for this code by phone, chat or email.",
    `District 12 hub: ${hub}`,
  ].join("\n");
  const html = layout({
    preheader: `Your District 12 sign-in code is ${input.code}. It expires in ${input.minutes} minutes.`,
    title: subject,
    eyebrow: "Two-step sign-in",
    heading: "Your sign-in code",
    body: [
      paragraph(`Hello ${escapeHtml(input.name)}, use this code to finish signing in to District 12.`),
      panel(codeBlock(input.code, {
        label: "Sign-in code",
        hint: `Expires in ${input.minutes} minutes and works once. Enter it on the sign-in page.`,
        first: true,
        size: 32,
        spacing: 8,
      })),
      note(
        "Didn't try to sign in?",
        "Someone has your password. Do not share this code. Change your password and tell District 12 HR.",
      ),
    ].join(""),
    footerNote: "District 12 never asks for this code by phone, chat or email.",
  });
  return { subject, text, html };
}

export async function sendTwoFactorCode(input: {
  name: string;
  email: string;
  code: string;
  minutes: number;
}): Promise<MailResult> {
  const settings = await readMailSettings();
  if (!ready(settings)) return { sent: false, detail: NOT_CONFIGURED };
  const email = renderTwoFactorEmail(input);
  try {
    await deliver(settings, input.email, email.subject, email.text, email.html);
    return { sent: true, detail: `Sign-in code emailed to ${input.email}.` };
  } catch (error) {
    console.error("[d12] two-factor email failed", error);
    return { sent: false, detail: "The sign-in code could not be sent. Check the SMTP settings." };
  }
}

export async function sendTestEmail(to: string): Promise<MailResult> {
  const settings = await readMailSettings();
  if (!ready(settings)) return { sent: false, detail: NOT_CONFIGURED };
  const email = renderTestEmail({ host: settings.host, port: settings.port, from: settings.from });
  try {
    await deliver(settings, to, email.subject, email.text, email.html);
    return { sent: true, detail: `Test email sent to ${to}.` };
  } catch (error) {
    console.error("[d12] test email failed", error);
    return { sent: false, detail: "The test email could not be sent. Check the SMTP host, port, username and password." };
  }
}

export async function sendCredentialEmail(input: {
  name: string;
  email: string;
  password: string;
  tenants: TenantId[];
}): Promise<MailResult> {
  const settings = await readMailSettings();
  if (!ready(settings)) return { sent: false, detail: NOT_CONFIGURED };
  const email = renderCredentialEmail(input);
  try {
    await deliver(settings, input.email, email.subject, email.text, email.html);
    return { sent: true, detail: `Credentials emailed to ${input.email}.` };
  } catch (error) {
    console.error("[d12] credential email failed", error);
    return { sent: false, detail: "The account was saved, but the credentials email could not be sent. Send a new temporary password from HR." };
  }
}
