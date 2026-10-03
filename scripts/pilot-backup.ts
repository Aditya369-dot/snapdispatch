import "./pilot-env";
import { writeFile } from "node:fs/promises";
import { closePool } from "@/lib/pilot/db";
import { exportBackup } from "@/lib/pilot/backup";

const backup = await exportBackup();
const target = process.argv[2] || "pilot-backup.json";
await writeFile(target, JSON.stringify(backup));
await closePool();
console.log(`Wrote ${target}`);
