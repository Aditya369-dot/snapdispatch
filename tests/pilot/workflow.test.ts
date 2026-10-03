import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { exportBackup, restoreBackup } from "@/lib/pilot/backup";
import { closePool, getPool, withAdmin } from "@/lib/pilot/db";
import { PilotError } from "@/lib/pilot/errors";
import { migrate } from "@/lib/pilot/migrate";
import { pilotApi } from "@/lib/pilot/router";
import { assertResetAllowed, resetSyntheticData } from "@/lib/pilot/seed";
import { objectStore, resetObjectStoreForTests } from "@/lib/pilot/storage";

process.env.SNAPDISPATCH_ENV = "test";
process.env.DATABASE_URL ??= "postgres://snapdispatch:snapdispatch@127.0.0.1:5432/snapdispatch_test";
process.env.PILOT_SESSION_SECRET = "test-session-secret-value";
process.env.PILOT_STORAGE_DIR = "/tmp/snapdispatch-pilot-storage";
process.env.PILOT_FIXTURE_PASSWORD = "synthetic-dev-password";
resetObjectStoreForTests();

const PASSWORD = "synthetic-dev-password";

type Body = {
  error?: { code?: string };
  token?: string;
  loads?: Body[];
  trucks?: { id?: string; unit?: string; operational?: string }[];
  drivers?: { id?: string; displayName?: string; availability?: string }[];
  customers?: { id?: string; name?: string }[];
  places?: { id?: string; name?: string }[];
  id?: string;
  reference?: string;
  status?: string;
  appointmentStart?: string;
  driverId?: string;
  role?: string;
  events?: { type?: string; occurredAt?: string; note?: string; reportedStage?: string | null }[];
  documents?: { id?: string; kind?: string; amountCents?: number | null; reviewStatus?: string; uploadCompletedAt?: string | null }[];
  document?: { id?: string; amountCents?: number | null };
  uploadUrl?: string;
  uploadHeaders?: Record<string, string>;
  amountCents?: number | null;
  correctedAmountCents?: number | null;
  expenses?: { id?: string; amountCents?: number }[];
  examples?: { nonProduction?: boolean; exampleAmountCents?: number | null }[];
  payConfigured?: boolean;
  reminders?: unknown[];
  reports?: unknown[];
  driverPay?: unknown;
  earnings?: unknown;
  ledgerId?: unknown;
};

async function call(
  method: string,
  pathname: string,
  options?: { token?: string; body?: unknown; raw?: Buffer; headers?: Record<string, string> },
) {
  const headers = new Headers(options?.headers);
  if (options?.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options?.body !== undefined) headers.set("content-type", "application/json");
  const response = await pilotApi(
    new Request(`http://pilot.local${pathname}`, {
      method,
      headers,
      body:
        options?.raw !== undefined
          ? new Uint8Array(options.raw)
          : options?.body !== undefined
            ? JSON.stringify(options.body)
            : undefined,
    }),
  );
  const text = await response.text();
  let json: Body | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Body;
    } catch {
      json = null;
    }
  }
  return { status: response.status, json, text };
}

async function login(email: string): Promise<string> {
  const result = await call("POST", "/api/v1/session", { body: { email, password: PASSWORD } });
  assert.equal(result.status, 200, result.text);
  assert.ok(result.json?.token);
  return result.json.token;
}

async function sql<T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

function findUnit(trucks: Body["trucks"], unit: string) {
  const truck = trucks?.find((item) => item.unit === unit);
  assert.ok(truck?.id, unit);
  return truck.id;
}

function findDriver(drivers: Body["drivers"], name: string) {
  const driver = drivers?.find((item) => item.displayName === name);
  assert.ok(driver?.id, name);
  return driver.id;
}

describe("M1 technical workflow", { concurrency: 1 }, () => {
  before(async () => {
    await migrate();
    await resetSyntheticData();
  });

  after(async () => {
    await closePool();
  });

  test("refuses fixture reset in production", () => {
    const previous = process.env.SNAPDISPATCH_ENV;
    process.env.SNAPDISPATCH_ENV = "production";
    assert.throws(
      () => assertResetAllowed(),
      (error) => error instanceof PilotError && error.code === "staging_refused",
    );
    process.env.SNAPDISPATCH_ENV = previous;
  });

  test("pitch role switcher remains, and pilot code does not run pay formulas", async () => {
    const frame = await readFile(path.join(process.cwd(), "components/app-frame.tsx"), "utf8");
    assert.match(frame, /setView\("owner"\)/);
    assert.match(frame, /setView\("driver"/);
    assert.match(frame, /data-tour="demo-switcher"/);
    assert.match(frame, /pathname\.startsWith\("\/app"\)/);

    async function walk(dir: string): Promise<string[]> {
      const entries = await readdir(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...(await walk(full)));
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
      }
      return files;
    }
    const roots = ["lib/pilot", "app/app", "app/api", "components/pilot"].map((item) => path.join(process.cwd(), item));
    const files = (await Promise.all(roots.map((root) => walk(root)))).flat();
    for (const file of files) {
      const source = await readFile(file, "utf8");
      assert.equal(source.includes("lib/finance"), false, file);
      assert.equal(source.includes("FLAT_PAY"), false, file);
      assert.equal(source.includes("DEMO_NOW"), false, file);
    }
  });

  test("anonymous calls return 401 and no load or file bodies", async () => {
    const loads = await call("GET", "/api/v1/loads");
    assert.equal(loads.status, 401);
    assert.equal(loads.json?.error?.code, "unauthenticated");
    assert.equal(loads.text.includes("SYN-"), false);

    const created = await call("POST", "/api/v1/loads", { body: { reference: "NOPE" } });
    assert.equal(created.status, 401);

    const file = await call("GET", "/api/v1/documents/00000000-0000-4000-8000-000000000001/file");
    assert.equal(file.status, 401);
    assert.equal(file.text.includes("%PDF"), false);
  });

  test("owner creates a load in UTC and business day follows the IANA zone", async () => {
    const owner = await login("owner.m1@synthetic.example");
    const customers = await call("GET", "/api/v1/customers", { token: owner });
    const places = await call("GET", "/api/v1/places", { token: owner });
    const customerId = customers.json?.customers?.[0]?.id;
    const pickup = places.json?.places?.[0]?.id;
    const drop = places.json?.places?.[1]?.id;
    assert.ok(customerId && pickup && drop);

    const created = await call("POST", "/api/v1/loads", {
      token: owner,
      body: {
        reference: "SYN-CREATED-001",
        customerId,
        pickupPlaceId: pickup,
        destinationPlaceId: drop,
        appointmentStart: "2026-01-15T07:00:00Z",
        appointmentEnd: "2026-01-15T07:30:00Z",
        customerRateCents: null,
        notes: "",
      },
    });
    assert.equal(created.status, 201, created.text);
    assert.equal(created.json?.status, "created");
    assert.equal(created.json?.events?.[0]?.type, "created");
    assert.match(created.json?.events?.[0]?.occurredAt ?? "", /Z$/);
    const occurred = Date.parse(created.json?.events?.[0]?.occurredAt ?? "");
    assert.ok(Math.abs(Date.now() - occurred) < 5 * 60 * 1000);
    assert.equal(created.text.includes("driverPay"), false);
    assert.equal(created.text.includes("earnings"), false);
    assert.equal(created.text.includes("ledger"), false);

    const on14 = await call("GET", "/api/v1/loads?businessDay=2026-01-14", { token: owner });
    const on15 = await call("GET", "/api/v1/loads?businessDay=2026-01-15", { token: owner });
    assert.ok(on14.json?.loads?.some((load) => load.reference === "SYN-CREATED-001"));
    assert.equal(on15.json?.loads?.some((load) => load.reference === "SYN-CREATED-001"), false);
  });

  test("assign, acknowledge, progress, upload, and review do not post pay", async () => {
    const owner = await login("owner.m1@synthetic.example");
    const driver = await login("driver.one@synthetic.example");
    const other = await login("driver.two@synthetic.example");
    const drivers = await call("GET", "/api/v1/drivers", { token: owner });
    const trucks = await call("GET", "/api/v1/trucks", { token: owner });
    const driverOne = findDriver(drivers.json?.drivers, "Synthetic Driver One");
    const driverTwo = findDriver(drivers.json?.drivers, "Synthetic Driver Two");
    const driverOff = findDriver(drivers.json?.drivers, "Synthetic Driver Off");
    const truckOk = findUnit(trucks.json?.trucks, "SYN-01");
    const truckDown = findUnit(trucks.json?.trucks, "SYN-02");
    const listed = await call("GET", "/api/v1/loads", { token: owner });
    const loadId = listed.json?.loads?.find((load) => load.reference === "SYN-LOAD-001")?.id;
    const overlapId = listed.json?.loads?.find((load) => load.reference === "SYN-LOAD-002")?.id;
    assert.ok(loadId && overlapId);

    const down = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: owner,
      body: { driverId: driverOne, truckId: truckDown },
    });
    assert.equal(down.json?.error?.code, "truck_out_of_service");
    const off = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: owner,
      body: { driverId: driverOff, truckId: truckOk },
    });
    assert.equal(off.json?.error?.code, "driver_unavailable");

    const assigned = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: owner,
      body: { driverId: driverOne, truckId: truckOk },
    });
    assert.equal(assigned.status, 200, assigned.text);
    assert.equal(assigned.json?.status, "assigned");
    assert.equal(assigned.text.includes("earnings"), false);

    const reassigned = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: owner,
      body: { driverId: driverTwo, truckId: truckOk },
    });
    assert.equal(reassigned.status, 200, reassigned.text);
    assert.equal(reassigned.json?.driverId, driverTwo);
    const back = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: owner,
      body: { driverId: driverOne, truckId: truckOk },
    });
    assert.equal(back.status, 200);

    const hidden = await call("GET", `/api/v1/loads/${loadId}`, { token: other });
    assert.equal(hidden.status, 404);
    const visible = await call("GET", `/api/v1/loads/${loadId}`, { token: driver });
    assert.equal(visible.status, 200);
    assert.equal(visible.json?.status, "assigned");

    const driverAssign = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: driver,
      body: { driverId: driverOne, truckId: truckOk },
    });
    assert.equal(driverAssign.status, 403);
    assert.equal(driverAssign.json?.error?.code, "forbidden");

    const overlap = await call("POST", `/api/v1/loads/${overlapId}/assign`, {
      token: owner,
      body: { driverId: driverOne, truckId: truckOk },
    });
    assert.equal(overlap.json?.error?.code, "appointment_overlap");

    const ack = await call("POST", `/api/v1/loads/${loadId}/acknowledge`, { token: driver });
    assert.equal(ack.status, 200);
    assert.equal(ack.json?.status, "accepted");
    const ackAgain = await call("POST", `/api/v1/loads/${loadId}/acknowledge`, { token: driver });
    assert.equal(ackAgain.status, 200);
    const ackEvents = ackAgain.json?.events?.filter((event) => event.type === "acknowledged") ?? [];
    assert.equal(ackEvents.length, 1);

    const ownerProgress = await call("POST", `/api/v1/loads/${loadId}/progress`, {
      token: owner,
      body: { note: "Owner cannot post this.", reportedStage: null },
    });
    assert.equal(ownerProgress.status, 403);
    const otherProgress = await call("POST", `/api/v1/loads/${loadId}/progress`, {
      token: other,
      body: { note: "Not my load.", reportedStage: null },
    });
    assert.equal(otherProgress.status, 404);

    const afterAckAssign = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: owner,
      body: { driverId: driverTwo, truckId: truckOk },
    });
    assert.equal(afterAckAssign.json?.error?.code, "load_not_assignable");

    const progress = await call("POST", `/api/v1/loads/${loadId}/progress`, {
      token: driver,
      body: { note: "At the pickup door.", reportedStage: null },
    });
    assert.equal(progress.status, 200, progress.text);
    assert.equal(progress.json?.status, "in_progress");
    const returned = await call("POST", `/api/v1/loads/${loadId}/progress`, {
      token: driver,
      headers: { "idempotency-key": "container-return-1" },
      body: { note: "Assumption only: container is back.", reportedStage: "container_return" },
    });
    assert.equal(returned.status, 200, returned.text);
    assert.equal(returned.json?.status, "in_progress");
    assert.ok(returned.json?.events?.some((event) => event.reportedStage === "container_return"));
    const returnedAgain = await call("POST", `/api/v1/loads/${loadId}/progress`, {
      token: driver,
      headers: { "idempotency-key": "container-return-1" },
      body: { note: "Assumption only: container is back.", reportedStage: "container_return" },
    });
    const containerEvents = returnedAgain.json?.events?.filter((event) => event.reportedStage === "container_return") ?? [];
    assert.equal(containerEvents.length, 1);

    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00]);
    const registered = await call("POST", `/api/v1/loads/${loadId}/documents`, {
      token: driver,
      headers: { "idempotency-key": "receipt-1" },
      body: {
        kind: "receipt",
        fileName: "synthetic-receipt.jpg",
        mimeType: "image/jpeg",
        byteSize: bytes.length,
        amountCents: 1234,
      },
    });
    assert.equal(registered.status, 201, registered.text);
    const documentId = registered.json?.document?.id;
    assert.ok(documentId);
    const duplicate = await call("POST", `/api/v1/loads/${loadId}/documents`, {
      token: driver,
      headers: { "idempotency-key": "receipt-1" },
      body: {
        kind: "receipt",
        fileName: "synthetic-receipt.jpg",
        mimeType: "image/jpeg",
        byteSize: bytes.length,
        amountCents: 1234,
      },
    });
    assert.equal(duplicate.json?.document?.id, documentId);

    const early = await call("POST", `/api/v1/documents/${documentId}/complete`, { token: driver });
    assert.equal(early.status, 409);
    assert.equal(early.json?.error?.code, "upload_missing");
    const earlyReview = await call("POST", `/api/v1/documents/${documentId}/review`, {
      token: owner,
      body: { decision: "approved", note: "" },
    });
    assert.equal(earlyReview.json?.error?.code, "not_ready");

    const uploadPath = new URL(registered.json?.uploadUrl ?? "").pathname;
    const wrong = await call("PUT", uploadPath, { raw: Buffer.from("nope"), headers: { "content-type": "image/jpeg" } });
    assert.equal(wrong.status, 422);
    const stored = await call("PUT", uploadPath, { raw: bytes, headers: { "content-type": "image/jpeg" } });
    assert.equal(stored.status, 200, stored.text);
    const completed = await call("POST", `/api/v1/documents/${documentId}/complete`, { token: driver });
    assert.equal(completed.status, 200, completed.text);
    assert.equal(completed.json?.amountCents, 1234);
    const completedAgain = await call("POST", `/api/v1/documents/${documentId}/complete`, { token: driver });
    assert.equal(completedAgain.status, 200);

    const podBytes = Buffer.from("%PDF-1.1\ntrailer\n%%EOF\n", "utf8");
    const pod = await call("POST", `/api/v1/loads/${loadId}/documents`, {
      token: driver,
      body: { kind: "pod", fileName: "synthetic-pod.pdf", mimeType: "application/pdf", byteSize: podBytes.length },
    });
    assert.equal(pod.status, 201, pod.text);
    const podId = pod.json?.document?.id;
    assert.ok(podId);
    const podPath = new URL(pod.json?.uploadUrl ?? "").pathname;
    assert.equal((await call("PUT", podPath, { raw: podBytes, headers: { "content-type": "application/pdf" } })).status, 200);
    assert.equal((await call("POST", `/api/v1/documents/${podId}/complete`, { token: driver })).status, 200);

    const anonymousFile = await call("GET", `/api/v1/documents/${documentId}/file`);
    assert.equal(anonymousFile.status, 401);
    const otherFile = await call("GET", `/api/v1/documents/${documentId}/file`, { token: other });
    assert.equal(otherFile.status, 404);
    const ownerFile = await call("GET", `/api/v1/documents/${documentId}/file`, { token: owner });
    assert.equal(ownerFile.status, 200);
    assert.equal(ownerFile.text.includes("storage_path"), false);

    const driverReview = await call("POST", `/api/v1/documents/${podId}/review`, {
      token: driver,
      body: { decision: "approved", note: "" },
    });
    assert.equal(driverReview.status, 403);
    const expensesBefore = await sql<{ count: string }>("select count(*)::text as count from expenses");
    const examplesBefore = await sql<{ count: string }>("select count(*)::text as count from fixture_pay_examples");
    const approved = await call("POST", `/api/v1/documents/${podId}/review`, {
      token: owner,
      body: { decision: "approved", note: "" },
    });
    assert.equal(approved.status, 200, approved.text);
    const rejected = await call("POST", `/api/v1/documents/${documentId}/review`, {
      token: owner,
      body: { decision: "rejected", note: "Fixture rejection. Must not create a ledger row." },
    });
    assert.equal(rejected.status, 200, rejected.text);
    assert.equal(rejected.json?.amountCents, 1234);
    const expensesAfter = await sql<{ count: string }>("select count(*)::text as count from expenses");
    const examplesAfter = await sql<{ count: string }>("select count(*)::text as count from fixture_pay_examples");
    assert.equal(expensesAfter[0].count, expensesBefore[0].count);
    assert.equal(examplesAfter[0].count, examplesBefore[0].count);

    const classes = await sql<{ pay_rules: string | null; ledger_entries: string | null }>(
      "select to_regclass('public.pay_rules')::text as pay_rules, to_regclass('public.ledger_entries')::text as ledger_entries",
    );
    assert.equal(classes[0].pay_rules, null);
    assert.equal(classes[0].ledger_entries, null);
    const statusCheck = await sql<{ def: string }>(
      "select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'loads_status_workflow'",
    );
    assert.equal(statusCheck[0].def.includes("empty_returned"), false);
    assert.equal(statusCheck[0].def.includes("complete"), false);
    assert.equal(statusCheck[0].def.includes("cancelled"), false);

    const seen = await call("GET", `/api/v1/loads/${loadId}`, { token: driver });
    const receipt = seen.json?.documents?.find((document) => document.kind === "receipt");
    const proof = seen.json?.documents?.find((document) => document.kind === "pod");
    assert.equal(receipt?.reviewStatus, "rejected");
    assert.equal(receipt?.amountCents, 1234);
    assert.equal(proof?.reviewStatus, "approved");

    const freshOwner = await login("owner.m1@synthetic.example");
    const still = await call("GET", `/api/v1/loads/${loadId}`, { token: freshOwner });
    assert.equal(still.json?.status, "in_progress");
    assert.ok(still.json?.events?.some((event) => event.note === "At the pickup door."));
  });

  test("concurrent overlapping assigns conflict, and repeated money writes do not duplicate", async () => {
    const owner = await login("owner.m1@synthetic.example");
    const driver = await login("driver.one@synthetic.example");
    const customers = await call("GET", "/api/v1/customers", { token: owner });
    const places = await call("GET", "/api/v1/places", { token: owner });
    const drivers = await call("GET", "/api/v1/drivers", { token: owner });
    const trucks = await call("GET", "/api/v1/trucks", { token: owner });
    const customerId = customers.json?.customers?.[0]?.id;
    const pickup = places.json?.places?.[0]?.id;
    const drop = places.json?.places?.[1]?.id;
    const driverOne = findDriver(drivers.json?.drivers, "Synthetic Driver One");
    const truckOk = findUnit(trucks.json?.trucks, "SYN-01");
    assert.ok(customerId && pickup && drop);

    async function makeLoad(reference: string, start: string, end: string) {
      const created = await call("POST", "/api/v1/loads", {
        token: owner,
        body: {
          reference,
          customerId,
          pickupPlaceId: pickup,
          destinationPlaceId: drop,
          appointmentStart: start,
          appointmentEnd: end,
        },
      });
      assert.equal(created.status, 201, created.text);
      return created.json?.id ?? "";
    }

    const left = await makeLoad("SYN-RACE-A", "2026-02-02T15:00:00Z", "2026-02-02T18:00:00Z");
    const right = await makeLoad("SYN-RACE-B", "2026-02-02T16:00:00Z", "2026-02-02T19:00:00Z");
    const raced = await Promise.all([
      call("POST", `/api/v1/loads/${left}/assign`, { token: owner, body: { driverId: driverOne, truckId: truckOk } }),
      call("POST", `/api/v1/loads/${right}/assign`, { token: owner, body: { driverId: driverOne, truckId: truckOk } }),
    ]);
    const codes = raced.map((result) => result.status === 200 ? "ok" : result.json?.error?.code).sort();
    assert.deepEqual(codes, ["appointment_overlap", "ok"]);

    const expense = await call("POST", "/api/v1/expenses", {
      token: driver,
      headers: { "idempotency-key": "expense-once" },
      body: { amountCents: 800, memo: "Typed toll", idempotencyKey: "expense-once" },
    });
    assert.equal(expense.status, 200, expense.text);
    const expenseAgain = await call("POST", "/api/v1/expenses", {
      token: driver,
      headers: { "idempotency-key": "expense-once" },
      body: { amountCents: 800, memo: "Typed toll", idempotencyKey: "expense-once" },
    });
    assert.equal(expenseAgain.json?.id, expense.json?.id);
    const rows = await sql<{ count: string }>(
      "select count(*)::text as count from expenses where idempotency_key = 'expense-once'",
    );
    assert.equal(rows[0].count, "1");

    const corrected = await call("POST", `/api/v1/expenses/${expense.json?.id}/corrections`, {
      token: owner,
      body: { amountCents: 700, note: "Typed correction only.", idempotencyKey: "correct-once" },
    });
    assert.equal(corrected.status, 200, corrected.text);
    assert.equal(corrected.json?.amountCents, 800);
    assert.equal(corrected.json?.correctedAmountCents, 700);
    const correctedAgain = await call("POST", `/api/v1/expenses/${expense.json?.id}/corrections`, {
      token: owner,
      body: { amountCents: 700, note: "Typed correction only.", idempotencyKey: "correct-once" },
    });
    assert.equal(correctedAgain.status, 200);
    const corrections = await sql<{ count: string }>(
      "select count(*)::text as count from expense_corrections where idempotency_key = 'correct-once'",
    );
    assert.equal(corrections[0].count, "1");
    const driverCorrect = await call("POST", `/api/v1/expenses/${expense.json?.id}/corrections`, {
      token: driver,
      body: { amountCents: 100, note: "Drivers cannot correct.", idempotencyKey: "driver-correct" },
    });
    assert.equal(driverCorrect.status, 403);

    const miles = await call("POST", "/api/v1/mileage", {
      token: driver,
      body: { truckId: truckOk, miles: 42.5, reportedOn: "2026-02-02", idempotencyKey: "miles-once" },
    });
    assert.equal(miles.status, 200, miles.text);
    const milesAgain = await call("POST", "/api/v1/mileage", {
      token: driver,
      body: { truckId: truckOk, miles: 42.5, reportedOn: "2026-02-02", idempotencyKey: "miles-once" },
    });
    assert.equal(milesAgain.json?.id, miles.json?.id);
  });

  test("fleet roster runs the workflow without a pay formula", async () => {
    const owner = await login("fleet.owner@synthetic.example");
    const driver = await login("fleet.driver.01@synthetic.example");
    const trucks = await call("GET", "/api/v1/trucks", { token: owner });
    const drivers = await call("GET", "/api/v1/drivers", { token: owner });
    assert.ok((trucks.json?.trucks?.length ?? 0) >= 10);
    for (let index = 1; index <= 12; index += 1) {
      const unit = `SYN-F${String(index).padStart(2, "0")}`;
      assert.ok(trucks.json?.trucks?.some((truck) => truck.unit === unit), unit);
    }
    const loadId = (await call("GET", "/api/v1/loads", { token: owner })).json?.loads?.find(
      (load) => load.reference === "SYN-FLEET-001",
    )?.id;
    assert.ok(loadId);
    const down = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: owner,
      body: {
        driverId: findDriver(drivers.json?.drivers, "Synthetic Fleet Driver 01"),
        truckId: findUnit(trucks.json?.trucks, "SYN-F12"),
      },
    });
    assert.equal(down.json?.error?.code, "truck_out_of_service");
    const off = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: owner,
      body: {
        driverId: findDriver(drivers.json?.drivers, "Synthetic Fleet Driver Off"),
        truckId: findUnit(trucks.json?.trucks, "SYN-F01"),
      },
    });
    assert.equal(off.json?.error?.code, "driver_unavailable");
    const assigned = await call("POST", `/api/v1/loads/${loadId}/assign`, {
      token: owner,
      body: {
        driverId: findDriver(drivers.json?.drivers, "Synthetic Fleet Driver 01"),
        truckId: findUnit(trucks.json?.trucks, "SYN-F01"),
      },
    });
    assert.equal(assigned.status, 200, assigned.text);
    assert.equal((await call("POST", `/api/v1/loads/${loadId}/acknowledge`, { token: driver })).status, 200);
    assert.equal(
      (
        await call("POST", `/api/v1/loads/${loadId}/progress`, {
          token: driver,
          body: { note: "At the fleet pickup door.", reportedStage: null },
        })
      ).status,
      200,
    );
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const receipt = await call("POST", `/api/v1/loads/${loadId}/documents`, {
      token: driver,
      body: { kind: "receipt", fileName: "fleet.jpg", mimeType: "image/jpeg", byteSize: bytes.length, amountCents: 2400 },
    });
    const receiptId = receipt.json?.document?.id;
    assert.ok(receiptId);
    await call("PUT", new URL(receipt.json?.uploadUrl ?? "").pathname, {
      raw: bytes,
      headers: { "content-type": "image/jpeg" },
    });
    await call("POST", `/api/v1/documents/${receiptId}/complete`, { token: driver });
    const reviewed = await call("POST", `/api/v1/documents/${receiptId}/review`, {
      token: owner,
      body: { decision: "rejected", note: "Fixture rejection on the fleet load. Must not create a ledger row or execute a pay formula." },
    });
    assert.equal(reviewed.status, 200, reviewed.text);
    assert.equal(reviewed.json?.amountCents, 2400);
  });

  test("a second organization cannot be read or written", async () => {
    const alpha = await login("alpha.owner@synthetic.example");
    const alphaDriver = await login("alpha.driver@synthetic.example");
    const bravo = await login("bravo.owner@synthetic.example");
    const bravoDriver = await login("bravo.driver@synthetic.example");
    const alphaLoads = await call("GET", "/api/v1/loads", { token: alpha });
    assert.deepEqual(
      alphaLoads.json?.loads?.map((load) => load.reference),
      ["SYN-ISO-A-001"],
    );
    const bravoRow = await sql<{ id: string; driver_id: string | null }>(
      "select id, driver_id from loads where reference = 'SYN-ISO-B-001'",
    );
    const hidden = await call("GET", `/api/v1/loads/${bravoRow[0].id}`, { token: alpha });
    assert.equal(hidden.status, 404);
    const bravoDriverId = (
      await sql<{ id: string }>("select id from drivers where display_name = 'Synthetic Isolation Bravo Driver'")
    )[0].id;
    const bravoTruckId = (await sql<{ id: string }>("select id from trucks where unit = 'SYN-B-01'"))[0].id;
    const alphaLoadId = alphaLoads.json?.loads?.[0]?.id ?? "";
    const crossed = await call("POST", `/api/v1/loads/${alphaLoadId}/assign`, {
      token: alpha,
      body: { driverId: bravoDriverId, truckId: bravoTruckId },
    });
    assert.equal(crossed.json?.error?.code, "not_found");
    const bravoAfter = await sql<{ driver_id: string | null }>("select driver_id from loads where reference = 'SYN-ISO-B-001'");
    assert.equal(bravoAfter[0].driver_id, null);
    const alphaAfter = await sql<{ driver_id: string | null }>("select driver_id from loads where reference = 'SYN-ISO-A-001'");
    assert.equal(alphaAfter[0].driver_id, null);

    const alphaId = alphaLoadId;
    assert.equal((await call("GET", `/api/v1/loads/${alphaId}`, { token: bravoDriver })).status, 404);
    assert.equal((await call("GET", `/api/v1/loads/${bravoRow[0].id}`, { token: alphaDriver })).status, 404);
    const alphaTrucks = await call("GET", "/api/v1/trucks", { token: alpha });
    const bravoTrucks = await call("GET", "/api/v1/trucks", { token: bravo });
    assert.deepEqual(alphaTrucks.json?.trucks?.map((truck) => truck.unit), ["SYN-A-01"]);
    assert.deepEqual(bravoTrucks.json?.trucks?.map((truck) => truck.unit), ["SYN-B-01"]);
  });

  test("staging roster has the synthetic carrier shape and dispatcher cannot review", async () => {
    const owner = await login("owner.staging@synthetic.example");
    const dispatcher = await login("dispatcher.staging@synthetic.example");
    const driver = await login("driver.staging.01@synthetic.example");
    const me = await call("GET", "/api/v1/me", { token: dispatcher });
    assert.equal(me.json?.role, "dispatcher");
    const trucks = await call("GET", "/api/v1/trucks", { token: owner });
    const drivers = await call("GET", "/api/v1/drivers", { token: owner });
    const customers = await call("GET", "/api/v1/customers", { token: owner });
    const loads = await call("GET", "/api/v1/loads", { token: owner });
    const maintenance = await call("GET", "/api/v1/maintenance", { token: owner });
    const mileage = await call("GET", "/api/v1/mileage", { token: owner });
    const examples = await call("GET", "/api/v1/pay-examples", { token: owner });
    assert.equal(trucks.json?.trucks?.length, 10);
    assert.equal(drivers.json?.drivers?.length, 12);
    assert.equal(customers.json?.customers?.length, 5);
    assert.equal(loads.json?.loads?.length, 100);
    const days = new Set((loads.json?.loads ?? []).map((load) => String(load.appointmentStart).slice(0, 10)));
    assert.equal(days.size, 30);
    assert.equal(maintenance.json?.reminders?.length, 10);
    assert.equal(mileage.json?.reports?.length, 12);
    assert.equal(examples.json?.payConfigured, false);
    assert.ok((examples.json?.examples?.length ?? 0) >= 3);
    assert.ok(examples.json?.examples?.every((example) => example.nonProduction === true));

    const open = loads.json?.loads?.find((load) => load.reference === "SYN-ROSTER-001");
    assert.equal(open?.status, "created");
    const created = await call("POST", "/api/v1/loads", {
      token: dispatcher,
      body: {
        reference: "SYN-ROSTER-DISPATCH",
        customerId: customers.json?.customers?.[0]?.id,
        pickupPlaceId: (await call("GET", "/api/v1/places", { token: dispatcher })).json?.places?.[0]?.id,
        destinationPlaceId: (await call("GET", "/api/v1/places", { token: dispatcher })).json?.places?.[1]?.id,
        appointmentStart: "2026-11-01T15:00:00Z",
        appointmentEnd: "2026-11-01T17:00:00Z",
      },
    });
    assert.equal(created.status, 201, created.text);
    const assigned = await call("POST", `/api/v1/loads/${created.json?.id}/assign`, {
      token: dispatcher,
      body: {
        driverId: findDriver(drivers.json?.drivers, "Synthetic Roster Driver 01"),
        truckId: findUnit(trucks.json?.trucks, "SYN-S01"),
      },
    });
    assert.equal(assigned.status, 200, assigned.text);
    assert.equal((await call("POST", `/api/v1/loads/${created.json?.id}/acknowledge`, { token: driver })).status, 200);
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const receipt = await call("POST", `/api/v1/loads/${created.json?.id}/documents`, {
      token: driver,
      body: { kind: "receipt", fileName: "disp.jpg", mimeType: "image/jpeg", byteSize: bytes.length, amountCents: 2222 },
    });
    await call("PUT", new URL(receipt.json?.uploadUrl ?? "").pathname, { raw: bytes, headers: { "content-type": "image/jpeg" } });
    await call("POST", `/api/v1/documents/${receipt.json?.document?.id}/complete`, { token: driver });
    const denied = await call("POST", `/api/v1/documents/${receipt.json?.document?.id}/review`, {
      token: dispatcher,
      body: { decision: "approved", note: "" },
    });
    assert.equal(denied.status, 403);
    const approved = await call("POST", `/api/v1/documents/${receipt.json?.document?.id}/review`, {
      token: owner,
      body: { decision: "approved", note: "" },
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.json?.amountCents, 2222);

    const forbidden = await sql<{ count: string }>(
      `select count(*)::text as count
       from (
         select customer_rate_cents as amount from loads
         union all select amount_cents from documents
         union all select amount_cents from expenses
         union all select corrected_amount_cents from expenses
         union all select example_amount_cents from fixture_pay_examples
         union all select amount_cents from expense_corrections
       ) amounts
       where amount in (18500, 9500, 25000, 27)`,
    );
    assert.equal(forbidden[0].count, "0");
  });

  test("backup restore puts synthetic rows and private files back", async () => {
    const beforeBackup = await exportBackup();
    const sample = beforeBackup.files[0];
    assert.ok(sample);
    await withAdmin(async (client) => {
      await client.query("select set_config('app.allow_reset', 'yes', true)");
      await client.query("select assert_can_reset_synthetic()");
      await client.query(`
        truncate table
          expense_corrections, expenses, mileage_reports, maintenance_reminders, fixture_pay_examples,
          documents, load_events, loads, pilot_credentials, profiles, drivers, trucks, customers, places, organizations
        restart identity cascade
      `);
    });
    await objectStore().clear();
    const empty = await sql<{ count: string }>("select count(*)::text as count from organizations");
    assert.equal(empty[0].count, "0");
    await restoreBackup(beforeBackup);
    const restored = await sql<{ count: string }>("select count(*)::text as count from loads where reference = 'SYN-ROSTER-001'");
    assert.equal(restored[0].count, "1");
    const file = await objectStore().get(sample.path);
    assert.ok(file);
    assert.equal(file.bytes.toString("base64"), sample.base64);
    const owner = await login("owner.staging@synthetic.example");
    const loads = await call("GET", "/api/v1/loads", { token: owner });
    assert.ok((loads.json?.loads?.length ?? 0) >= 100);
  });
});
