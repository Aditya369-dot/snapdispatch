import { getPool, withAdmin } from "@/lib/pilot/db";
import { PilotError } from "@/lib/pilot/errors";
import { assertResetAllowed } from "@/lib/pilot/seed";
import { objectStore } from "@/lib/pilot/storage";

const TABLES = [
  "organizations",
  "drivers",
  "trucks",
  "customers",
  "places",
  "profiles",
  "pilot_credentials",
  "loads",
  "load_events",
  "documents",
  "expenses",
  "expense_corrections",
  "mileage_reports",
  "maintenance_reminders",
  "fixture_pay_examples",
] as const;

export type PilotBackup = {
  format: "snapdispatch-pilot-backup-v1";
  createdAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  files: { path: string; mime: string; base64: string }[];
};

function jsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function exportBackup(): Promise<PilotBackup> {
  assertResetAllowed();
  const client = await getPool().connect();
  try {
    const tables: PilotBackup["tables"] = {};
    for (const table of TABLES) {
      const result = await client.query(`select * from ${table}`);
      tables[table] = result.rows.map((row) =>
        Object.fromEntries(Object.entries(row).map(([key, value]) => [key, jsonValue(value)])),
      );
    }
    const files: PilotBackup["files"] = [];
    for (const document of tables.documents ?? []) {
      const storagePath = String(document.storage_path ?? "");
      if (!storagePath || !document.upload_completed_at) continue;
      const file = await objectStore().get(storagePath);
      if (!file) continue;
      files.push({ path: storagePath, mime: file.mime, base64: file.bytes.toString("base64") });
    }
    return { format: "snapdispatch-pilot-backup-v1", createdAt: new Date().toISOString(), tables, files };
  } finally {
    client.release();
  }
}

export async function restoreBackup(backup: PilotBackup): Promise<void> {
  assertResetAllowed();
  if (backup.format !== "snapdispatch-pilot-backup-v1") {
    throw new PilotError("staging_refused", 403, "Unrecognized backup format.");
  }
  const orgs = backup.tables.organizations ?? [];
  if (orgs.some((org) => org.synthetic_only !== true || !String(org.name).startsWith("Synthetic"))) {
    throw new PilotError("staging_refused", 403, "Backup restore refuses any organization that is not synthetic.");
  }
  await withAdmin(async (client) => {
    await client.query("select set_config('app.allow_reset', 'yes', true)");
    await client.query("select assert_can_reset_synthetic()");
    await client.query(`
      truncate table
        expense_corrections, expenses, mileage_reports, maintenance_reminders, fixture_pay_examples,
        documents, load_events, loads, pilot_credentials, profiles, drivers, trucks, customers, places, organizations
      restart identity cascade
    `);
    for (const table of TABLES) {
      const rows = backup.tables[table] ?? [];
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]);
      for (const row of rows) {
        const values = columns.map((column) => row[column] ?? null);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        await client.query(
          `insert into ${table} (${columns.join(", ")}) values (${placeholders})`,
          values,
        );
      }
    }
  });
  const store = objectStore();
  for (const file of backup.files) {
    await store.put(file.path, Buffer.from(file.base64, "base64"), file.mime);
  }
}
