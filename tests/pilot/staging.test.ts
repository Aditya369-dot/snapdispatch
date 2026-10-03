import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, test } from "node:test";
import { fixturePassword, WELL_KNOWN_FIXTURE_PASSWORD } from "@/lib/pilot/fixture-password";
import { PilotError } from "@/lib/pilot/errors";
import { pilotApi } from "@/lib/pilot/router";
import {
  STAGING_ACCESS_COOKIE,
  STAGING_ACCESS_HEADER,
  isStagingGatedPath,
  requestGrantsStagingAccess,
  safeAppPath,
  stagingAccessCookie,
  stagingAccessRequired,
  stagingGateResponse,
  stagingUnlockResponse,
} from "@/lib/pilot/staging-access";

const CODE = "staging-access-code-value";

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("staging access and fixture password", { concurrency: 1 }, () => {
  const previous = {
    SNAPDISPATCH_ENV: process.env.SNAPDISPATCH_ENV,
    PILOT_FIXTURE_PASSWORD: process.env.PILOT_FIXTURE_PASSWORD,
    PILOT_SESSION_SECRET: process.env.PILOT_SESSION_SECRET,
    STAGING_ACCESS_CODE: process.env.STAGING_ACCESS_CODE,
  };

  afterEach(() => {
    restoreEnv(previous);
  });

  test("development and test keep the local fixture password default", () => {
    process.env.SNAPDISPATCH_ENV = "development";
    delete process.env.PILOT_FIXTURE_PASSWORD;
    assert.equal(fixturePassword(), WELL_KNOWN_FIXTURE_PASSWORD);
    process.env.SNAPDISPATCH_ENV = "test";
    process.env.PILOT_FIXTURE_PASSWORD = "synthetic-dev-password";
    assert.equal(fixturePassword(), WELL_KNOWN_FIXTURE_PASSWORD);
  });

  test("staging fixture password rules", () => {
    process.env.SNAPDISPATCH_ENV = "staging";
    process.env.PILOT_SESSION_SECRET = "test-session-secret-value";
    for (const password of ["", "   ", "short-password", "123456789012345", WELL_KNOWN_FIXTURE_PASSWORD]) {
      process.env.PILOT_FIXTURE_PASSWORD = password;
      assert.throws(
        () => fixturePassword(),
        (error) => error instanceof PilotError && error.code === "staging_refused",
      );
    }
    process.env.PILOT_FIXTURE_PASSWORD = "1234567890123456";
    assert.equal(fixturePassword(), "1234567890123456");
  });

  test("the gate stays off unless staging has a code, and the pitch is not gated", () => {
    process.env.PILOT_SESSION_SECRET = "test-session-secret-value";
    process.env.SNAPDISPATCH_ENV = "development";
    process.env.STAGING_ACCESS_CODE = CODE;
    assert.equal(stagingAccessRequired(), false);
    process.env.SNAPDISPATCH_ENV = "test";
    assert.equal(stagingAccessRequired(), false);
    process.env.SNAPDISPATCH_ENV = "staging";
    delete process.env.STAGING_ACCESS_CODE;
    assert.equal(stagingAccessRequired(), false);
    process.env.STAGING_ACCESS_CODE = "   ";
    assert.equal(stagingAccessRequired(), false);

    assert.equal(isStagingGatedPath("/"), false);
    assert.equal(isStagingGatedPath("/dispatch"), false);
    assert.equal(isStagingGatedPath("/loads"), false);
    assert.equal(isStagingGatedPath("/drivers/1"), false);
    assert.equal(isStagingGatedPath("/staging-access"), false);
    assert.equal(isStagingGatedPath("/api/staging-access"), false);
    assert.equal(isStagingGatedPath("/application"), false);
    assert.equal(isStagingGatedPath("/app"), true);
    assert.equal(isStagingGatedPath("/app/login"), true);
    assert.equal(isStagingGatedPath("/api/v1/health"), true);
    assert.equal(safeAppPath("https://evil.example/app"), "/app");
    assert.equal(safeAppPath("//evil.example"), "/app");
    assert.equal(safeAppPath("/app/loads/new?x=1"), "/app/loads/new?x=1");
  });

  test("staging gate accepts the cookie, header, or basic password and blocks the rest", async () => {
    process.env.SNAPDISPATCH_ENV = "staging";
    process.env.PILOT_SESSION_SECRET = "test-session-secret-value";
    process.env.STAGING_ACCESS_CODE = CODE;
    assert.equal(stagingAccessRequired(), true);
    assert.match(stagingAccessCookie(), /Secure/);

    const locked = stagingGateResponse(new Request("http://pilot.local/app/login"));
    assert.equal(locked?.status, 307);
    assert.equal(locked?.headers.get("location"), "http://pilot.local/staging-access?next=%2Fapp%2Flogin");

    const apiLocked = stagingGateResponse(new Request("http://pilot.local/api/v1/health"));
    assert.equal(apiLocked?.status, 401);
    const apiBody = (await apiLocked?.json()) as { error?: { code?: string } };
    assert.equal(apiBody.error?.code, "staging_locked");

    const pitch = stagingGateResponse(new Request("http://pilot.local/"));
    assert.equal(pitch, null);
    const dispatch = stagingGateResponse(new Request("http://pilot.local/dispatch"));
    assert.equal(dispatch, null);

    const headerRequest = new Request("http://pilot.local/api/v1/health", {
      headers: { [STAGING_ACCESS_HEADER]: CODE },
    });
    assert.equal(requestGrantsStagingAccess(headerRequest), true);
    assert.equal(stagingGateResponse(headerRequest), null);

    const basic = Buffer.from(`staging:${CODE}`).toString("base64");
    const basicRequest = new Request("http://pilot.local/app", {
      headers: { authorization: `Basic ${basic}` },
    });
    assert.equal(stagingGateResponse(basicRequest), null);

    const cookie = stagingAccessCookie().split(";")[0].slice(`${STAGING_ACCESS_COOKIE}=`.length);
    const cookieRequest = new Request("http://pilot.local/app/roster", {
      headers: { cookie: `${STAGING_ACCESS_COOKIE}=${cookie}` },
    });
    assert.equal(stagingGateResponse(cookieRequest), null);

    const wrong = new Request("http://pilot.local/api/v1/loads", {
      headers: { [STAGING_ACCESS_HEADER]: "not-the-code" },
    });
    assert.equal(stagingGateResponse(wrong)?.status, 401);

    const health = await pilotApi(headerRequest);
    assert.equal(health.status, 200);
    const blockedApi = await pilotApi(new Request("http://pilot.local/api/v1/session", { method: "POST" }));
    assert.equal(blockedApi.status, 401);
    const blockedBody = (await blockedApi.json()) as { error?: { code?: string } };
    assert.equal(blockedBody.error?.code, "staging_locked");
  });

  test("unlock sets the staging cookie and refuses a bad code or an open redirect", async () => {
    process.env.SNAPDISPATCH_ENV = "staging";
    process.env.PILOT_SESSION_SECRET = "test-session-secret-value";
    process.env.STAGING_ACCESS_CODE = CODE;

    const denied = await stagingUnlockResponse(
      new Request("http://pilot.local/api/staging-access", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: "nope", next: "/app/login" }),
      }),
    );
    assert.equal(denied.status, 303);
    assert.equal(denied.headers.get("set-cookie"), null);
    assert.match(denied.headers.get("location") ?? "", /error=denied/);

    const opened = await stagingUnlockResponse(
      new Request("http://pilot.local/api/staging-access", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: CODE, next: "https://evil.example/steal" }),
      }),
    );
    assert.equal(opened.status, 303);
    assert.equal(opened.headers.get("location"), "http://pilot.local/app");
    assert.match(opened.headers.get("set-cookie") ?? "", new RegExp(`^${STAGING_ACCESS_COOKIE}=`));
    assert.match(opened.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.match(opened.headers.get("set-cookie") ?? "", /Secure/);

    delete process.env.PILOT_SESSION_SECRET;
    const broken = await stagingUnlockResponse(
      new Request("http://pilot.local/api/staging-access", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: CODE, next: "/app" }),
      }),
    );
    assert.match(broken.headers.get("location") ?? "", /error=config/);
    assert.equal(broken.headers.get("set-cookie"), null);
  });

  test("hosted setup does not publish the well-known fixture password", async () => {
    const setup = await readFile(path.join(process.cwd(), "docs/SETUP.md"), "utf8");
    const hosted = setup.split("## Optional local Postgres")[0];
    assert.ok(hosted.length > 500);
    assert.equal(hosted.includes(WELL_KNOWN_FIXTURE_PASSWORD), false);
    assert.match(setup, new RegExp(WELL_KNOWN_FIXTURE_PASSWORD));
    const login = await readFile(path.join(process.cwd(), "app/app/login/page.tsx"), "utf8");
    assert.equal(login.includes(WELL_KNOWN_FIXTURE_PASSWORD), false);
    const pitch = await readFile(path.join(process.cwd(), "app/page.tsx"), "utf8");
    assert.equal(pitch.includes("staging-access"), false);
  });
});
