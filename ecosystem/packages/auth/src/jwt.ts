export interface JwtPayload {
  iat: number;
  exp: number;
  [key: string]: unknown;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalised.length % 4)) % 4;
  const binary = atob(normalised + "=".repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is required to sign District 12 sessions");
  }
  return globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const headerPart = toBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const bodyPart = toBase64Url(
    encoder.encode(JSON.stringify({ ...payload, iat: nowSeconds, exp: nowSeconds + ttlSeconds })),
  );
  const key = await importHmacKey(secret);
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${headerPart}.${bodyPart}`),
  );
  return `${headerPart}.${bodyPart}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyJwt<T extends JwtPayload = JwtPayload>(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, bodyPart, signaturePart] = parts;

  try {
    const header = JSON.parse(decoder.decode(fromBase64Url(headerPart))) as { alg?: string };
    if (header.alg !== "HS256") return null;

    const key = await importHmacKey(secret);
    const valid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signaturePart),
      encoder.encode(`${headerPart}.${bodyPart}`),
    );
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(fromBase64Url(bodyPart))) as T;
    if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}
