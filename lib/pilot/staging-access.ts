import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "@/lib/pilot/auth";

export const STAGING_ACCESS_COOKIE = "sd_staging";
export const STAGING_ACCESS_HEADER = "x-staging-access";

const COOKIE_SECONDS = 60 * 60 * 12;

/** Non-empty code only when the process is explicitly staging. Development and test never gate. */
export function configuredStagingAccessCode(): string | null {
  if (process.env.SNAPDISPATCH_ENV !== "staging") return null;
  const code = process.env.STAGING_ACCESS_CODE?.trim() ?? "";
  return code.length > 0 ? code : null;
}

export function stagingAccessRequired(): boolean {
  return configuredStagingAccessCode() !== null;
}

export function isStagingGatedPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return path === "/app" || path.startsWith("/app/") || path === "/api/v1" || path.startsWith("/api/v1/");
}

/** Only in-app paths. Rejects protocol-relative and absolute URLs. */
export function safeAppPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/app")) return "/app";
  if (value.startsWith("//") || value.includes("\\") || value.includes("://")) return "/app";
  if (value.includes("\n") || value.includes("\r")) return "/app";
  return value;
}

function equalSecret(left: string, right: string): boolean {
  const actual = Buffer.from(left);
  const expected = Buffer.from(right);
  if (actual.length !== expected.length) {
    timingSafeEqual(actual, actual);
    return false;
  }
  return timingSafeEqual(actual, expected);
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(cookie);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function stagingAccessCookieValue(code: string): string {
  return createHmac("sha256", sessionSecret()).update(`sd_staging.${code}`).digest("base64url");
}

export function stagingAccessCookie(): string {
  const code = configuredStagingAccessCode();
  if (!code) throw new Error("STAGING_ACCESS_CODE is not set.");
  const secure = process.env.SNAPDISPATCH_ENV === "staging" || process.env.SNAPDISPATCH_ENV === "production" ? "; Secure" : "";
  return `${STAGING_ACCESS_COOKIE}=${stagingAccessCookieValue(code)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${COOKIE_SECONDS}${secure}`;
}

function basicPassword(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    if (colon < 0) return null;
    return decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

/** True when the gate is off, or the request presents the code via cookie, header, or HTTP Basic password. */
export function requestGrantsStagingAccess(request: Request): boolean {
  const code = configuredStagingAccessCode();
  if (!code) return true;
  const header = request.headers.get(STAGING_ACCESS_HEADER);
  if (header && equalSecret(header.trim(), code)) return true;
  const basic = basicPassword(request);
  if (basic && equalSecret(basic, code)) return true;
  const cookie = readCookie(request, STAGING_ACCESS_COOKIE);
  if (!cookie) return false;
  try {
    return equalSecret(cookie, stagingAccessCookieValue(code));
  } catch {
    return false;
  }
}

export function stagingLockedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: "staging_locked",
        message: "Staging access code required. Unlock /staging-access, or send the x-staging-access header or HTTP Basic password.",
      },
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "www-authenticate": 'Basic realm="SnapDispatch staging", charset="UTF-8"',
      },
    },
  );
}

/** Null means the request may continue. A Response means the gate blocked it. */
export function stagingGateResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (!isStagingGatedPath(url.pathname) || requestGrantsStagingAccess(request)) return null;
  if (url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/")) return stagingLockedResponse();
  const redirect = new URL("/staging-access", request.url);
  redirect.searchParams.set("next", safeAppPath(`${url.pathname}${url.search}`));
  return Response.redirect(redirect, 307);
}

export async function stagingUnlockResponse(request: Request): Promise<Response> {
  const form = await request.formData();
  const submitted = String(form.get("code") ?? "");
  const nextValue = form.get("next");
  const next = safeAppPath(typeof nextValue === "string" ? nextValue : null);
  if (!stagingAccessRequired()) {
    return Response.redirect(new URL(next, request.url), 303);
  }
  const code = configuredStagingAccessCode();
  if (!code || !equalSecret(submitted.trim(), code)) {
    const denied = new URL("/staging-access", request.url);
    denied.searchParams.set("error", "denied");
    denied.searchParams.set("next", next);
    return Response.redirect(denied, 303);
  }
  try {
    const headers = new Headers();
    headers.set("set-cookie", stagingAccessCookie());
    headers.set("location", new URL(next, request.url).toString());
    headers.set("cache-control", "no-store");
    return new Response(null, { status: 303, headers });
  } catch {
    const broken = new URL("/staging-access", request.url);
    broken.searchParams.set("error", "config");
    broken.searchParams.set("next", next);
    return Response.redirect(broken, 303);
  }
}
