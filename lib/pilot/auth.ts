import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { PilotError } from "@/lib/pilot/errors";

const SESSION_SECONDS = 60 * 60 * 12;

export function sessionSecret(): string {
  const configured = process.env.PILOT_SESSION_SECRET;
  if (configured && configured.length >= 16) return configured;
  const env = process.env.SNAPDISPATCH_ENV;
  if (env === "test" || env === "development") return configured || "dev-only-session-secret";
  throw new PilotError("not_configured", 503, "Set PILOT_SESSION_SECRET. See docs/SETUP.md.");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

type SessionPayload = { sub: string; exp: number };

export function signSession(profileId: string, now = Date.now()): string {
  const payload: SessionPayload = { sub: profileId, exp: Math.floor(now / 1000) + SESSION_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `v1.${body}.${mac}`;
}

export function readSession(token: string | null | undefined): string | null {
  if (!token || !token.startsWith("v1.")) return null;
  const [, body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  const actualBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || payload.exp * 1000 < Date.now()) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  const env = process.env.SNAPDISPATCH_ENV;
  const secure = env === "production" || env === "staging" ? "; Secure" : "";
  return `sd_pilot=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(): string {
  return "sd_pilot=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0";
}

export function tokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  const cookie = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)sd_pilot=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Optional Supabase Auth bearer. Used only when SUPABASE_JWT_SECRET is set.
 * The local v1 session token is checked first. This does not accept a client-supplied role.
 */
export function readSupabaseSubject(token: string | null | undefined): string | null {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || !token || token.split(".").length !== 3 || token.startsWith("v1.")) return null;
  const [header, body, mac] = token.split(".");
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  const actualBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return null;
  try {
    const headerJson = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as { alg?: string };
    if (headerJson.alg !== "HS256") return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    if (!payload.sub || (payload.exp && payload.exp * 1000 < Date.now())) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function profileIdFromRequest(request: Request): string | null {
  const token = tokenFromRequest(request);
  return readSession(token) ?? readSupabaseSubject(token);
}

const UPLOAD_SECONDS = 60 * 10;

export function signUploadToken(documentId: string): string {
  const payload = { documentId, exp: Math.floor(Date.now() / 1000) + UPLOAD_SECONDS, purpose: "put" as const };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", sessionSecret()).update(`upload.${body}`).digest("base64url");
  return `up.${body}.${mac}`;
}

export function readUploadToken(token: string): string | null {
  if (!token.startsWith("up.")) return null;
  const [, body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", sessionSecret()).update(`upload.${body}`).digest("base64url");
  const actualBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      documentId?: string;
      exp?: number;
      purpose?: string;
    };
    if (payload.purpose !== "put" || !payload.documentId || !payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload.documentId;
  } catch {
    return null;
  }
}
