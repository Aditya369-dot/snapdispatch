import "./pilot-env";
import { readFile } from "node:fs/promises";
import { closePool } from "@/lib/pilot/db";
import { restoreBackup, type PilotBackup } from "@/lib/pilot/backup";

const source = process.argv[2];
if (!source) {
  console.error("Usage: npm run pilot:restore -- <backup.json>");
  process.exit(1);
}
const backup = JSON.parse(await readFile(source, "utf8")) as PilotBackup;
await restoreBackup(backup);
await closePool();
console.log(`Restored ${source}`);
