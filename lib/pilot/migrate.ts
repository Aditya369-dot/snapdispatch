import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "@/lib/pilot/db";

export const MIGRATION_VERSION = "0001_m1_workflow";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const existing = await client.query("select 1 from schema_migrations where version = $1", [MIGRATION_VERSION]);
    if (existing.rowCount) return;
    const sql = await readFile(path.join(process.cwd(), "db/migrations", `${MIGRATION_VERSION}.sql`), "utf8");
    await client.query(sql);
    await client.query("insert into schema_migrations (version) values ($1) on conflict do nothing", [MIGRATION_VERSION]);
  } finally {
    client.release();
  }
}
