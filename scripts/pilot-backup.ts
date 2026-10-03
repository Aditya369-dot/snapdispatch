import "./pilot-env";
import { writeFile } from "node:fs/promises";
import { closePool } from "@/lib/pilot/db";
import { exportBackup } from "@/lib/pilot/backup";

async function main(): Promise<void> {
  try {
    const backup = await exportBackup();
    const target = process.argv[2] || "pilot-backup.json";
    await writeFile(target, JSON.stringify(backup));
    console.log(`Wrote ${target}`);
  } finally {
    await closePool();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
