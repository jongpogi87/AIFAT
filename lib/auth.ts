export interface AdminUserSession {
  userId: number;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR";
  exp: number;
}

// Ephemeral in-memory key generated per process if SESSION_SECRET is not set in environment
let ephemeralSecret: string | null = null;

function getSecretKey(): string {
  if (typeof process !== "undefined" && process.env?.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    try {
      // Dynamically load or generate per-workspace development secret in gitignored .env.local
      const fs = require("node:fs");
      const path = require("node:path");
      const envLocalPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envLocalPath)) {
        const content = fs.readFileSync(envLocalPath, "utf8");
        const match = content.match(/^SESSION_SECRET=(.+)$/m);
        if (match && match[1]) {
          process.env.SESSION_SECRET = match[1].trim();
          return process.env.SESSION_SECRET;
        }
      }
      const crypto = require("node:crypto");
      const generated = crypto.randomBytes(32).toString("hex");
      fs.appendFileSync(
        envLocalPath,
        `\n# Generated local development session secret (gitignored)\nSESSION_SECRET=${generated}\n`,
        "utf8"
      );
      process.env.SESSION_SECRET = generated;
      return generated;
    } catch {}
  }
  if (!ephemeralSecret) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    ephemeralSecret = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return ephemeralSecret;
}

export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return Array.from(new Uint8Array(derived))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(password: string, expectedHash: string, salt: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  if (computedHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHash.length; i++) {
    diff |= computedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}

export async function createSessionToken(session: Omit<AdminUserSession, "exp">, expiresInSeconds = 86400): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload: AdminUserSession = { ...session, exp };
  const payloadStr = base64UrlEncode(JSON.stringify(payload));

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecretKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payloadStr));
  const sigStr = base64UrlEncode(String.fromCharCode(...new Uint8Array(sigBuffer)));

  return `${payloadStr}.${sigStr}`;
}

export async function verifySessionToken(token: string): Promise<AdminUserSession | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadStr, sigStr] = parts;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(getSecretKey()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = Uint8Array.from(base64UrlDecode(sigStr), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payloadStr));
    if (!valid) return null;

    const payload: AdminUserSession = JSON.parse(base64UrlDecode(payloadStr));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getAdminSessionFromRequest(request: Request): Promise<AdminUserSession | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/aifat_admin_session=([^;]+)/);
  if (!match) return null;
  return verifySessionToken(match[1]);
}
