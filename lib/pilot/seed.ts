import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "@/lib/pilot/auth";
import { withAdmin } from "@/lib/pilot/db";
import { PilotError } from "@/lib/pilot/errors";
import type { FixtureDocument, FixtureLoad, FixtureOrg, StagingExtras } from "@/lib/pilot/fixture-types";
import { SAMPLE_JPEG, SAMPLE_PDF, objectStore } from "@/lib/pilot/storage";
import { buildStagingRoster } from "@/lib/pilot/staging-roster";

const RESET_ENVS = new Set(["development", "test", "staging"]);

const FORBIDDEN_PAY_AMOUNTS = new Set([18500, 9500, 25000, 27]);

export function assertResetAllowed(): void {
  const env = process.env.SNAPDISPATCH_ENV;
  if (!env || !RESET_ENVS.has(env)) {
    throw new PilotError(
      "staging_refused",
      403,
      "Fixture reset runs only when SNAPDISPATCH_ENV is development, test, or staging. It never runs in production.",
    );
  }
}

function customersOf(org: FixtureOrg) {
  const customers = org.customers ?? (org.customer ? [org.customer] : []);
  if (customers.length === 0) throw new PilotError("staging_refused", 403, `${org.name} has no customers.`);
  return customers;
}

function assertSynthetic(org: FixtureOrg): void {
  if (!org.syntheticOnly || !org.name.startsWith("Synthetic")) {
    throw new PilotError("staging_refused", 403, `${org.name} is not a synthetic organization.`);
  }
  if (org.payRules !== null || org.emptyReturnRequired !== null) {
    throw new PilotError("staging_refused", 403, `${org.name} must keep payRules and emptyReturnRequired null.`);
  }
  for (const driver of org.drivers) {
    if (driver.payRule !== null) {
      throw new PilotError("staging_refused", 403, `${driver.displayName} must not carry a pay rule.`);
    }
  }
  for (const amount of [org.loads ?? []].flat().map((load) => load.customerRateCents)) {
    if (amount != null && FORBIDDEN_PAY_AMOUNTS.has(amount)) {
      throw new PilotError("staging_refused", 403, "Fixture amounts must not copy pitch pay figures.");
    }
  }
}

function normalizeOrg(raw: FixtureOrg & { organization?: FixtureOrg }): FixtureOrg {
  if (!raw.organization) return raw;
  return {
    ...raw,
    name: raw.organization.name,
    syntheticOnly: raw.organization.syntheticOnly,
    displayTimezone: raw.organization.displayTimezone,
    payRules: raw.payRules,
    emptyReturnRequired: raw.emptyReturnRequired,
  };
}

async function readOrgFile(fileName: string): Promise<FixtureOrg[]> {
  const raw = JSON.parse(await readFile(path.join(process.cwd(), "docs/fixtures", fileName), "utf8")) as FixtureOrg & {
    organization?: FixtureOrg;
    organizations?: (FixtureOrg & { organization?: FixtureOrg })[];
  };
  if (raw.organizations) return raw.organizations.map((org) => normalizeOrg(org));
  return [normalizeOrg(raw)];
}

type Maps = {
  drivers: Map<string, string>;
  trucks: Map<string, string>;
  customers: Map<string, string>;
  places: Map<string, string>;
  profiles: Map<string, string>;
  loads: Map<string, string>;
  ownerId: string;
};

async function insertOrg(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  org: FixtureOrg,
  passwordHash: string,
): Promise<Maps> {
  assertSynthetic(org);
  const orgRow = await client.query(
    `insert into organizations (name, display_timezone, synthetic_only)
     values ($1, $2, true)
     returning id`,
    [org.name, org.displayTimezone],
  );
  const organizationId = String(orgRow.rows[0].id);
  const maps: Maps = {
    drivers: new Map(),
    trucks: new Map(),
    customers: new Map(),
    places: new Map(),
    profiles: new Map(),
    loads: new Map(),
    ownerId: "",
  };

  for (const driver of org.drivers) {
    const row = await client.query(
      `insert into drivers (organization_id, display_name, email, availability, availability_note)
       values ($1, $2, $3, $4, $5) returning id`,
      [organizationId, driver.displayName, driver.email ?? null, driver.availability, driver.availabilityNote ?? null],
    );
    maps.drivers.set(driver.key, String(row.rows[0].id));
  }
  for (const truck of org.trucks) {
    const row = await client.query(
      `insert into trucks (organization_id, unit, operational) values ($1, $2, $3) returning id`,
      [organizationId, truck.unit, truck.operational],
    );
    maps.trucks.set(truck.key, String(row.rows[0].id));
  }
  for (const customer of customersOf(org)) {
    const row = await client.query(`insert into customers (organization_id, name) values ($1, $2) returning id`, [
      organizationId,
      customer.name,
    ]);
    maps.customers.set(customer.key, String(row.rows[0].id));
  }
  for (const place of org.places) {
    const row = await client.query(
      `insert into places (organization_id, name, address_line) values ($1, $2, $3) returning id`,
      [organizationId, place.name, place.addressLine ?? null],
    );
    maps.places.set(place.key, String(row.rows[0].id));
  }
  for (const user of org.users) {
    const driverId = user.driverKey ? maps.drivers.get(user.driverKey) : null;
    if (user.role === "driver" && !driverId) {
      throw new PilotError("staging_refused", 403, `${user.email} is missing a driver.`);
    }
    const driver = org.drivers.find((item) => item.key === user.driverKey);
    const displayName = user.displayName ?? driver?.displayName ?? user.role;
    const row = await client.query(
      `insert into profiles (organization_id, role, driver_id, display_name)
       values ($1, $2, $3, $4) returning id`,
      [organizationId, user.role, driverId, displayName],
    );
    const profileId = String(row.rows[0].id);
    maps.profiles.set(user.key, profileId);
    if (user.role === "owner" && !maps.ownerId) maps.ownerId = profileId;
    await client.query(`insert into pilot_credentials (profile_id, email, password_hash) values ($1, $2, $3)`, [
      profileId,
      user.email.toLowerCase(),
      passwordHash,
    ]);
  }

  for (const load of org.loads ?? []) {
    maps.loads.set(load.reference, await insertLoad(client, organizationId, load, maps));
  }
  return maps;
}

async function insertLoad(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  organizationId: string,
  load: FixtureLoad,
  maps: Maps,
): Promise<string> {
  const status = load.status ?? "created";
  const driverId = load.driverKey ? (maps.drivers.get(load.driverKey) ?? null) : null;
  const truckId = load.truckKey ? (maps.trucks.get(load.truckKey) ?? null) : null;
  const acknowledgedAt = status === "accepted" || status === "in_progress" ? "2026-09-01T12:10:00Z" : null;
  const row = await client.query(
    `insert into loads (
       organization_id, reference, container_number, external_reference, customer_id,
       pickup_place_id, destination_place_id, appointment_start, appointment_end,
       last_free_day, empty_return_deadline, cutoff, status, driver_id, truck_id,
       customer_rate_cents, notes, acknowledged_at, created_at
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
     ) returning id`,
    [
      organizationId,
      load.reference,
      load.containerNumber ?? null,
      load.externalReference ?? null,
      maps.customers.get(load.customerKey),
      maps.places.get(load.pickupKey),
      maps.places.get(load.destinationKey),
      load.appointmentStart,
      load.appointmentEnd,
      load.lastFreeDay ?? null,
      load.emptyReturnDeadline ?? null,
      load.cutoff ?? null,
      status,
      status === "created" ? null : driverId,
      status === "created" ? null : truckId,
      load.customerRateCents ?? null,
      load.notes ?? "",
      acknowledgedAt,
      "2026-09-01T12:00:00Z",
    ],
  );
  const loadId = String(row.rows[0].id);
  const driverProfile = load.driverKey ? maps.profiles.get(load.driverKey) : null;
  await client.query(
    `insert into load_events (organization_id, load_id, actor_profile_id, event_type, from_status, to_status, occurred_at)
     values ($1, $2, $3, 'created', null, 'created', $4)`,
    [organizationId, loadId, maps.ownerId, "2026-09-01T12:00:00Z"],
  );
  if (status !== "created") {
    await client.query(
      `insert into load_events (organization_id, load_id, actor_profile_id, event_type, from_status, to_status, occurred_at)
       values ($1, $2, $3, 'assigned', 'created', 'assigned', $4)`,
      [organizationId, loadId, maps.ownerId, "2026-09-01T12:05:00Z"],
    );
  }
  if (status === "accepted" || status === "in_progress") {
    await client.query(
      `insert into load_events (organization_id, load_id, actor_profile_id, event_type, from_status, to_status, occurred_at)
       values ($1, $2, $3, 'acknowledged', 'assigned', 'accepted', $4)`,
      [organizationId, loadId, driverProfile, "2026-09-01T12:10:00Z"],
    );
  }
  if (status === "in_progress") {
    await client.query(
      `insert into load_events (
         organization_id, load_id, actor_profile_id, event_type, from_status, to_status, occurred_at, note, reported_stage
       ) values ($1, $2, $3, 'progress', 'accepted', 'in_progress', $4, $5, $6)`,
      [
        organizationId,
        loadId,
        driverProfile,
        "2026-09-01T12:15:00Z",
        load.progressNote ?? "Synthetic progress.",
        load.reportedStage ?? null,
      ],
    );
  }
  return loadId;
}

function sampleBytes(mime: string): Buffer {
  return mime === "application/pdf" ? SAMPLE_PDF : SAMPLE_JPEG;
}

async function insertExtras(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  organizationId: string,
  maps: Maps,
  extras: StagingExtras,
): Promise<{ path: string; mime: string; bytes: Buffer }[]> {
  const files: { path: string; mime: string; bytes: Buffer }[] = [];
  for (const example of extras.payExamples) {
    if (FORBIDDEN_PAY_AMOUNTS.has(example.exampleAmountCents)) {
      throw new PilotError("staging_refused");
    }
    await client.query(
      `insert into fixture_pay_examples (organization_id, label, assumption_note, example_amount_cents, non_production)
       values ($1, $2, $3, $4, true)`,
      [organizationId, example.label, example.assumptionNote, example.exampleAmountCents],
    );
  }
  for (const reminder of extras.maintenance) {
    await client.query(
      `insert into maintenance_reminders (organization_id, truck_id, title, due_on, notes)
       values ($1, $2, $3, $4, $5)`,
      [organizationId, maps.trucks.get(reminder.truckKey), reminder.title, reminder.dueOn, reminder.notes],
    );
  }
  for (const report of extras.mileage) {
    const driverId = maps.drivers.get(report.driverKey);
    await client.query(
      `insert into mileage_reports (organization_id, truck_id, driver_id, miles, reported_on, idempotency_key)
       values ($1, $2, $3, $4, $5, $6)`,
      [organizationId, maps.trucks.get(report.truckKey), driverId, report.miles, report.reportedOn, report.idempotencyKey],
    );
  }
  for (const document of extras.documents) {
    files.push(await insertSeedDocument(client, organizationId, maps, document));
  }
  return files;
}

async function insertSeedDocument(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  organizationId: string,
  maps: Maps,
  document: FixtureDocument,
): Promise<{ path: string; mime: string; bytes: Buffer }> {
  const loadId = maps.loads.get(document.loadReference);
  const load = await client.query(`select driver_id from loads where id = $1`, [loadId]);
  const driverId = String(load.rows[0].driver_id);
  const profile = await client.query(`select id from profiles where driver_id = $1`, [driverId]);
  const profileId = String(profile.rows[0].id);
  const bytes = sampleBytes(document.mimeType);
  const documentId = randomUUID();
  const storagePath = `org/${organizationId}/loads/${loadId}/${documentId}`;
  await client.query(
    `insert into documents (
       id, organization_id, load_id, driver_id, uploaded_by, kind, file_name, mime_type, byte_size,
       storage_bucket, storage_path, amount_cents, upload_completed_at, review_status, reviewed_by, reviewed_at, review_note
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, 'load-files', $10, $11, now(), $12, $13,
       case when $12 = 'pending' then null else now() end, $14
     )`,
    [
      documentId,
      organizationId,
      loadId,
      driverId,
      profileId,
      document.kind,
      document.fileName,
      document.mimeType,
      bytes.length,
      storagePath,
      document.amountCents,
      document.reviewStatus,
      document.reviewStatus === "pending" ? null : maps.ownerId,
      document.reviewNote,
    ],
  );
  if (document.kind === "receipt" && document.amountCents != null) {
    await client.query(
      `insert into expenses (organization_id, load_id, driver_id, document_id, created_by, amount_cents, memo, source)
       values ($1, $2, $3, $4, $5, $6, 'Receipt', 'receipt')`,
      [organizationId, loadId, driverId, documentId, profileId, document.amountCents],
    );
  }
  return { path: storagePath, mime: document.mimeType, bytes };
}

export async function resetSyntheticData(): Promise<void> {
  assertResetAllowed();
  const password = process.env.PILOT_FIXTURE_PASSWORD || "synthetic-dev-password";
  const passwordHash = hashPassword(password);
  const orgs = [
    ...(await readOrgFile("m1-synthetic.json")),
    ...(await readOrgFile("m1-fleet.json")),
    ...(await readOrgFile("m1-isolation.json")),
  ];
  const staging = buildStagingRoster();
  const pendingFiles: { path: string; mime: string; bytes: Buffer }[] = [];

  await withAdmin(async (client) => {
    await client.query("select set_config('app.allow_reset', 'yes', true)");
    await client.query("select assert_can_reset_synthetic()");
    await client.query(`
      truncate table
        expense_corrections,
        expenses,
        mileage_reports,
        maintenance_reminders,
        fixture_pay_examples,
        documents,
        load_events,
        loads,
        pilot_credentials,
        profiles,
        drivers,
        trucks,
        customers,
        places,
        organizations
      restart identity cascade
    `);
    for (const org of orgs) {
      await insertOrg(client, org, passwordHash);
    }
    const maps = await insertOrg(client, staging.organization, passwordHash);
    const orgId = (
      await client.query(`select id from organizations where name = $1`, [staging.organization.name])
    ).rows[0].id;
    pendingFiles.push(...(await insertExtras(client, String(orgId), maps, staging.extras)));
  });

  const store = objectStore();
  if (store.kind === "local") await store.clear();
  for (const file of pendingFiles) {
    await store.put(file.path, file.bytes, file.mime);
  }
}
