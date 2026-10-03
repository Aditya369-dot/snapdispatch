import type { PoolClient } from "pg";
import { signUploadToken, verifyPassword } from "@/lib/pilot/auth";
import { withActor, withAdmin, type Queryable } from "@/lib/pilot/db";
import { PilotError } from "@/lib/pilot/errors";
import {
  isUuid,
  serializeDocument,
  serializeLoad,
  type DocumentRow,
  type EventRow,
  type LoadRow,
} from "@/lib/pilot/serialize";
import { objectStore } from "@/lib/pilot/storage";

/**
 * Server workflow for the M1 technical checkpoint.
 *
 * Pre-pilot requirements remain open (docs/requirements.md): load completion,
 * cancellation, the handoff/stage machine, and container empty returns.
 * Progress may carry a reported stage such as "container_return". That string
 * is an assumption for tests. It is not a required step and it is not a status.
 *
 * Driver-pay calculations are disabled. This module does not import the pitch
 * finance helpers and does not execute a pay formula. Review stores a decision only.
 */

const VISIBLE_LOAD = `
  organization_id = (select organization_id from app_current_profile())
  and (
    (select role from app_current_profile()) in ('owner', 'dispatcher')
    or driver_id = (select driver_id from app_current_profile())
  )
`;

const VISIBLE_LOAD_ALIASED = `
  l.organization_id = (select organization_id from app_current_profile())
  and (
    (select role from app_current_profile()) in ('owner', 'dispatcher')
    or l.driver_id = (select driver_id from app_current_profile())
  )
`;

type ProfileRow = {
  id: string;
  organization_id: string;
  role: "owner" | "driver" | "dispatcher";
  driver_id: string | null;
  display_name: string;
  display_timezone: string;
};

async function currentProfile(client: Queryable): Promise<ProfileRow> {
  const result = await client.query<ProfileRow>(
    `select p.id, p.organization_id, p.role, p.driver_id, p.display_name, o.display_timezone
     from app_current_profile() p
     join organizations o on o.id = p.organization_id`,
  );
  const profile = result.rows[0];
  if (!profile?.id) throw new PilotError("unauthenticated");
  return profile;
}

async function eventsFor(client: Queryable, loadIds: string[]): Promise<Map<string, EventRow[]>> {
  const grouped = new Map<string, EventRow[]>();
  if (loadIds.length === 0) return grouped;
  const result = await client.query<EventRow>(
    `select id, load_id, event_type, from_status, to_status, actor_profile_id, occurred_at, note, reported_stage
     from load_events
     where load_id = any($1::uuid[])
       and organization_id = (select organization_id from app_current_profile())
     order by occurred_at asc, id asc`,
    [loadIds],
  );
  for (const row of result.rows) {
    const list = grouped.get(row.load_id) ?? [];
    list.push(row);
    grouped.set(row.load_id, list);
  }
  return grouped;
}

async function documentsFor(client: Queryable, loadIds: string[]): Promise<Map<string, DocumentRow[]>> {
  const grouped = new Map<string, DocumentRow[]>();
  if (loadIds.length === 0) return grouped;
  const result = await client.query<DocumentRow>(
    `select id, load_id, kind, file_name, mime_type, byte_size, amount_cents,
            upload_completed_at, review_status, reviewed_at, review_note, storage_bucket, storage_path
     from documents
     where load_id = any($1::uuid[])
       and organization_id = (select organization_id from app_current_profile())
       and (
         (select role from app_current_profile()) in ('owner', 'dispatcher')
         or driver_id = (select driver_id from app_current_profile())
       )
     order by created_at asc`,
    [loadIds],
  );
  for (const row of result.rows) {
    const list = grouped.get(row.load_id) ?? [];
    list.push(row);
    grouped.set(row.load_id, list);
  }
  return grouped;
}

async function hydrate(client: Queryable, rows: LoadRow[]) {
  const ids = rows.map((row) => row.id);
  const [events, documents] = await Promise.all([eventsFor(client, ids), documentsFor(client, ids)]);
  return rows.map((row) => serializeLoad(row, events.get(row.id) ?? [], documents.get(row.id) ?? []));
}

export async function login(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) throw new PilotError("unauthenticated");
  return withAdmin(async (client) => {
    const result = await client.query<{ profile_id: string; password_hash: string }>(
      `select profile_id, password_hash from pilot_credentials where lower(email) = $1`,
      [normalized],
    );
    const row = result.rows[0];
    if (!row || !verifyPassword(password, row.password_hash)) {
      throw new PilotError("unauthenticated");
    }
    return row.profile_id;
  });
}

export async function getMe(profileId: string) {
  return withActor(profileId, async (client) => {
    const profile = await currentProfile(client);
    return {
      profileId: profile.id,
      organizationId: profile.organization_id,
      role: profile.role,
      driverId: profile.driver_id,
      displayName: profile.display_name,
      displayTimezone: profile.display_timezone,
    };
  });
}

export async function listLoads(profileId: string, businessDay: string | null) {
  if (businessDay && !/^\d{4}-\d{2}-\d{2}$/.test(businessDay)) {
    throw new PilotError("invalid_load", 422, "businessDay must be YYYY-MM-DD in the organization timezone.");
  }
  return withActor(profileId, async (client) => {
    const profile = await currentProfile(client);
    const params: unknown[] = [];
    let dayClause = "";
    if (businessDay) {
      params.push(businessDay, profile.display_timezone);
      dayClause = `
        and l.appointment_start < (($1::date + 1)::timestamp at time zone $2)
        and l.appointment_end > ($1::date::timestamp at time zone $2)
      `;
    }
    const result = await client.query<LoadRow>(
      `select l.* from loads l
       where ${VISIBLE_LOAD_ALIASED}
       ${dayClause}
       order by l.appointment_start asc, l.reference asc`,
      params,
    );
    return { loads: await hydrate(client, result.rows), displayTimezone: profile.display_timezone };
  });
}

export async function getLoad(profileId: string, loadId: string) {
  if (!isUuid(loadId)) throw new PilotError("not_found");
  return withActor(profileId, async (client) => {
    const result = await client.query<LoadRow>(
      `select * from loads where id = $1 and ${VISIBLE_LOAD}`,
      [loadId],
    );
    const row = result.rows[0];
    if (!row) throw new PilotError("not_found");
    const [load] = await hydrate(client, [row]);
    return load;
  });
}

export async function listEvents(profileId: string, loadId: string) {
  const load = await getLoad(profileId, loadId);
  return { events: load.events };
}

type CreateLoadInput = {
  reference?: string;
  containerNumber?: string | null;
  externalReference?: string | null;
  customerId?: string;
  pickupPlaceId?: string;
  destinationPlaceId?: string;
  appointmentStart?: string;
  appointmentEnd?: string;
  lastFreeDay?: string | null;
  emptyReturnDeadline?: string | null;
  cutoff?: string | null;
  customerRateCents?: number | null;
  notes?: string;
};

export async function createLoad(profileId: string, input: CreateLoadInput) {
  for (const id of [input.customerId, input.pickupPlaceId, input.destinationPlaceId]) {
    if (id != null && id !== "" && !isUuid(id)) throw new PilotError("invalid_load");
  }
  if (input.customerRateCents != null && (!Number.isInteger(input.customerRateCents) || input.customerRateCents < 0)) {
    throw new PilotError("invalid_rate");
  }
  return withActor(profileId, async (client) => {
    const result = await client.query<LoadRow>(
      `select * from create_load($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        input.reference ?? null,
        input.containerNumber ?? null,
        input.externalReference ?? null,
        input.customerId ?? null,
        input.pickupPlaceId ?? null,
        input.destinationPlaceId ?? null,
        input.appointmentStart ?? null,
        input.appointmentEnd ?? null,
        input.lastFreeDay ?? null,
        input.emptyReturnDeadline ?? null,
        input.cutoff ?? null,
        input.customerRateCents ?? null,
        input.notes ?? "",
      ],
    );
    const [load] = await hydrate(client, result.rows);
    return load;
  });
}

export async function assignLoad(profileId: string, loadId: string, driverId: string, truckId: string) {
  if (!isUuid(loadId) || !isUuid(driverId) || !isUuid(truckId)) throw new PilotError("not_found");
  return withActor(profileId, async (client) => {
    const result = await client.query<LoadRow>(`select * from assign_load($1,$2,$3)`, [loadId, driverId, truckId]);
    const [load] = await hydrate(client, result.rows);
    return load;
  });
}

export async function acknowledgeLoad(profileId: string, loadId: string) {
  if (!isUuid(loadId)) throw new PilotError("not_found");
  return withActor(profileId, async (client) => {
    const result = await client.query<LoadRow>(`select * from acknowledge_load($1)`, [loadId]);
    const [load] = await hydrate(client, result.rows);
    return load;
  });
}

export async function recordProgress(
  profileId: string,
  loadId: string,
  note: string | undefined,
  reportedStage: string | null | undefined,
  idempotencyKey: string | null,
) {
  if (!isUuid(loadId)) throw new PilotError("not_found");
  return withActor(profileId, async (client) => {
    const result = await client.query<LoadRow>(`select * from record_progress($1,$2,$3,$4)`, [
      loadId,
      note ?? null,
      reportedStage ?? null,
      idempotencyKey,
    ]);
    const [load] = await hydrate(client, result.rows);
    return load;
  });
}

export async function registerDocument(
  profileId: string,
  loadId: string,
  input: {
    kind?: string;
    fileName?: string;
    mimeType?: string;
    byteSize?: number;
    amountCents?: number | null;
  },
  idempotencyKey: string | null,
  origin: string,
) {
  if (!isUuid(loadId)) throw new PilotError("not_found");
  return withActor(profileId, async (client) => {
    const result = await client.query<DocumentRow>(
      `select * from register_document($1,$2,$3,$4,$5,$6,$7)`,
      [
        loadId,
        input.kind ?? null,
        input.fileName ?? null,
        input.mimeType ?? null,
        input.byteSize ?? null,
        input.amountCents === undefined ? null : input.amountCents,
        idempotencyKey,
      ],
    );
    const document = result.rows[0];
    const token = signUploadToken(document.id);
    return {
      document: serializeDocument(document),
      uploadUrl: `${origin}/api/v1/uploads/${token}`,
      uploadHeaders: { "content-type": document.mime_type },
    };
  });
}

export async function storeUpload(tokenDocumentId: string, bytes: Buffer, contentType: string | null) {
  return withAdmin(async (client) => {
    const result = await client.query<DocumentRow>(
      `select id, load_id, kind, file_name, mime_type, byte_size, amount_cents, upload_completed_at,
              review_status, reviewed_at, review_note, storage_bucket, storage_path
       from documents where id = $1`,
      [tokenDocumentId],
    );
    const document = result.rows[0];
    if (!document) throw new PilotError("not_found");
    if (contentType && contentType.split(";")[0].trim() !== document.mime_type) {
      throw new PilotError("invalid_document", 422, "The upload content type does not match the registered file.");
    }
    if (bytes.length !== document.byte_size) {
      throw new PilotError("invalid_document", 422, "The upload size does not match the registered file.");
    }
    await objectStore().put(document.storage_path, bytes, document.mime_type);
    return { stored: true, documentId: document.id };
  });
}

export async function completeDocument(profileId: string, documentId: string) {
  if (!isUuid(documentId)) throw new PilotError("not_found");
  const located = await withActor(profileId, async (client) => {
    const result = await client.query<DocumentRow>(
      `select id, load_id, kind, file_name, mime_type, byte_size, amount_cents, upload_completed_at,
              review_status, reviewed_at, review_note, storage_bucket, storage_path
       from documents
       where id = $1
         and organization_id = (select organization_id from app_current_profile())
         and driver_id = (select driver_id from app_current_profile())`,
      [documentId],
    );
    return result.rows[0] ?? null;
  });
  if (!located) throw new PilotError("not_found");
  const info = await objectStore().stat(located.storage_path);
  if (!info || info.size !== located.byte_size) {
    throw new PilotError("upload_missing");
  }
  return withActor(profileId, async (client) => {
    await client.query("select set_config('app.storage_confirmed', 'on', true)");
    const result = await client.query<DocumentRow>(`select * from complete_document_upload($1)`, [documentId]);
    return serializeDocument(result.rows[0]);
  });
}

export async function readDocumentFile(profileId: string, documentId: string) {
  if (!isUuid(documentId)) throw new PilotError("not_found");
  const document = await withActor(profileId, async (client) => {
    const result = await client.query<DocumentRow>(
      `select id, load_id, kind, file_name, mime_type, byte_size, amount_cents, upload_completed_at,
              review_status, reviewed_at, review_note, storage_bucket, storage_path
       from documents
       where id = $1
         and upload_completed_at is not null
         and organization_id = (select organization_id from app_current_profile())
         and (
           (select role from app_current_profile()) in ('owner', 'dispatcher')
           or driver_id = (select driver_id from app_current_profile())
         )`,
      [documentId],
    );
    return result.rows[0] ?? null;
  });
  if (!document) throw new PilotError("not_found");
  const file = await objectStore().get(document.storage_path);
  if (!file) throw new PilotError("upload_missing");
  return { bytes: file.bytes, mime: document.mime_type, fileName: document.file_name };
}

export async function reviewDocument(profileId: string, documentId: string, decision: string, note: string) {
  if (!isUuid(documentId)) throw new PilotError("not_found");
  return withActor(profileId, async (client) => {
    const before = await client.query<{ amount_cents: number | null }>(
      `select amount_cents from documents
       where id = $1 and organization_id = (select organization_id from app_current_profile())`,
      [documentId],
    );
    const result = await client.query<DocumentRow>(`select * from review_document($1,$2,$3)`, [
      documentId,
      decision,
      note,
    ]);
    const document = result.rows[0];
    if (before.rows[0] && before.rows[0].amount_cents !== document.amount_cents) {
      throw new PilotError("invalid_document");
    }
    return serializeDocument(document);
  });
}

async function directory<T extends Record<string, unknown>>(profileId: string, sql: string): Promise<T[]> {
  return withActor(profileId, async (client) => {
    await currentProfile(client);
    const result = await client.query(sql);
    return result.rows as T[];
  });
}

export async function listTrucks(profileId: string) {
  const rows = await directory<{ id: string; unit: string; operational: string; active: boolean }>(
    profileId,
    `select id, unit, operational, active from trucks
     where organization_id = (select organization_id from app_current_profile())
     order by unit`,
  );
  return {
    trucks: rows.map((row) => ({ id: row.id, unit: row.unit, operational: row.operational, active: row.active })),
  };
}

export async function listDrivers(profileId: string) {
  const rows = await directory<{
    id: string;
    display_name: string;
    availability: string;
    availability_note: string | null;
    active: boolean;
  }>(
    profileId,
    `select id, display_name, availability, availability_note, active from drivers
     where organization_id = (select organization_id from app_current_profile())
     order by display_name`,
  );
  return {
    drivers: rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      availability: row.availability,
      availabilityNote: row.availability_note,
      active: row.active,
    })),
  };
}

export async function listCustomers(profileId: string) {
  const rows = await directory<{ id: string; name: string }>(
    profileId,
    `select id, name from customers
     where organization_id = (select organization_id from app_current_profile())
     order by name`,
  );
  return { customers: rows };
}

export async function listPlaces(profileId: string) {
  const rows = await directory<{ id: string; name: string; address_line: string | null }>(
    profileId,
    `select id, name, address_line from places
     where organization_id = (select organization_id from app_current_profile())
     order by name`,
  );
  return {
    places: rows.map((row) => ({ id: row.id, name: row.name, addressLine: row.address_line })),
  };
}

export async function listMaintenance(profileId: string) {
  const rows = await directory<{
    id: string;
    truck_id: string;
    unit: string;
    title: string;
    due_on: Date | string;
    notes: string;
  }>(
    profileId,
    `select m.id, m.truck_id, t.unit, m.title, m.due_on, m.notes
     from maintenance_reminders m
     join trucks t on t.id = m.truck_id
     where m.organization_id = (select organization_id from app_current_profile())
     order by m.due_on, t.unit`,
  );
  return {
    reminders: rows.map((row) => ({
      id: row.id,
      truckId: row.truck_id,
      unit: row.unit,
      title: row.title,
      dueOn: String(row.due_on).slice(0, 10),
      notes: row.notes,
    })),
  };
}

export async function listMileage(profileId: string) {
  const rows = await directory<{
    id: string;
    truck_id: string;
    unit: string;
    driver_id: string;
    miles: string | number;
    reported_on: Date | string;
  }>(
    profileId,
    `select m.id, m.truck_id, t.unit, m.driver_id, m.miles, m.reported_on
     from mileage_reports m
     join trucks t on t.id = m.truck_id
     where m.organization_id = (select organization_id from app_current_profile())
       and (
         (select role from app_current_profile()) in ('owner', 'dispatcher')
         or m.driver_id = (select driver_id from app_current_profile())
       )
     order by m.reported_on, t.unit`,
  );
  return {
    reports: rows.map((row) => ({
      id: row.id,
      truckId: row.truck_id,
      unit: row.unit,
      driverId: row.driver_id,
      miles: Number(row.miles),
      reportedOn: String(row.reported_on).slice(0, 10),
    })),
  };
}

export async function recordMileage(
  profileId: string,
  input: { truckId?: string; loadId?: string | null; miles?: number; reportedOn?: string; idempotencyKey?: string },
) {
  if (input.truckId && !isUuid(input.truckId)) throw new PilotError("not_found");
  if (input.loadId && !isUuid(input.loadId)) throw new PilotError("not_found");
  return withActor(profileId, async (client) => {
    const result = await client.query<{
      id: string;
      truck_id: string;
      miles: string;
      reported_on: Date | string;
    }>(`select * from record_mileage($1,$2,$3,$4,$5)`, [
      input.truckId ?? null,
      input.loadId ?? null,
      input.miles ?? null,
      input.reportedOn ?? null,
      input.idempotencyKey ?? null,
    ]);
    const row = result.rows[0];
    return {
      id: row.id,
      truckId: row.truck_id,
      miles: Number(row.miles),
      reportedOn: String(row.reported_on).slice(0, 10),
    };
  });
}

export async function listExpenses(profileId: string) {
  return withActor(profileId, async (client) => {
    const result = await client.query<{
      id: string;
      load_id: string | null;
      amount_cents: number;
      corrected_amount_cents: number | null;
      memo: string;
      source: string;
      document_id: string | null;
    }>(
      `select id, load_id, amount_cents, corrected_amount_cents, memo, source, document_id
       from expenses
       where organization_id = (select organization_id from app_current_profile())
         and (
           (select role from app_current_profile()) in ('owner', 'dispatcher')
           or driver_id = (select driver_id from app_current_profile())
           or created_by = (select id from app_current_profile())
         )
       order by created_at`,
    );
    return {
      expenses: result.rows.map((row) => ({
        id: row.id,
        loadId: row.load_id,
        amountCents: row.amount_cents,
        correctedAmountCents: row.corrected_amount_cents,
        memo: row.memo,
        source: row.source,
        documentId: row.document_id,
      })),
    };
  });
}

export async function createTypedExpense(
  profileId: string,
  input: { amountCents?: number; memo?: string; loadId?: string | null; idempotencyKey?: string },
) {
  if (input.loadId && !isUuid(input.loadId)) throw new PilotError("not_found");
  return withActor(profileId, async (client) => {
    const result = await client.query<{
      id: string;
      amount_cents: number;
      corrected_amount_cents: number | null;
      memo: string;
      source: string;
    }>(`select * from create_typed_expense($1,$2,$3,$4)`, [
      input.amountCents ?? null,
      input.memo ?? "",
      input.loadId ?? null,
      input.idempotencyKey ?? null,
    ]);
    const row = result.rows[0];
    return {
      id: row.id,
      amountCents: row.amount_cents,
      correctedAmountCents: row.corrected_amount_cents,
      memo: row.memo,
      source: row.source,
    };
  });
}

export async function correctExpense(
  profileId: string,
  expenseId: string,
  input: { amountCents?: number; note?: string; idempotencyKey?: string },
) {
  if (!isUuid(expenseId)) throw new PilotError("not_found");
  return withActor(profileId, async (client) => {
    const result = await client.query<{
      id: string;
      amount_cents: number;
      corrected_amount_cents: number | null;
    }>(`select * from correct_expense($1,$2,$3,$4)`, [
      expenseId,
      input.amountCents ?? null,
      input.note ?? null,
      input.idempotencyKey ?? null,
    ]);
    const row = result.rows[0];
    return {
      id: row.id,
      amountCents: row.amount_cents,
      correctedAmountCents: row.corrected_amount_cents,
    };
  });
}

export async function listPayExamples(profileId: string) {
  return withActor(profileId, async (client) => {
    const result = await client.query<{
      id: string;
      label: string;
      assumption_note: string;
      example_amount_cents: number | null;
      non_production: boolean;
    }>(
      `select id, label, assumption_note, example_amount_cents, non_production
       from fixture_pay_examples
       where organization_id = (select organization_id from app_current_profile())
       order by label`,
    );
    return {
      payConfigured: false,
      note: "Driver-pay calculations are disabled until the customer confirms Q4. The rows below are fixture assumptions, not a formula.",
      examples: result.rows.map((row) => ({
        id: row.id,
        label: row.label,
        assumptionNote: row.assumption_note,
        exampleAmountCents: row.example_amount_cents,
        nonProduction: row.non_production,
      })),
    };
  });
}

export async function health() {
  const storage = objectStore();
  return {
    ok: true,
    checkpoint: "m1-technical-workflow",
    liveCustomerReady: false,
    driverPay: "disabled",
    storage: storage.kind,
    auth: process.env.SUPABASE_JWT_SECRET ? "local-session-and-supabase-jwt" : "local-session",
    prePilotOpen: ["load-completion", "cancellation", "handoffs", "container-empty-returns"],
  };
}

export async function countTable(client: PoolClient, table: string): Promise<number> {
  const result = await client.query<{ count: string }>(`select count(*)::text as count from ${table}`);
  return Number(result.rows[0].count);
}

