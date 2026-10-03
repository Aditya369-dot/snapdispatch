import "./pilot-env";
import { readFile } from "node:fs/promises";
import { closePool } from "@/lib/pilot/db";
import { restoreBackup, type PilotBackup } from "@/lib/pilot/backup";

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) {
    console.error("Usage: npm run pilot:restore -- <backup.json>");
    process.exitCode = 1;
    return;
  }
  try {
    const backup = JSON.parse(await readFile(source, "utf8")) as PilotBackup;
    await restoreBackup(backup);
    console.log(`Restored ${source}`);
  } finally {
    await closePool();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
