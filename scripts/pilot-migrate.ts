import "./pilot-env";
import { closePool } from "@/lib/pilot/db";
import { migrate } from "@/lib/pilot/migrate";

await migrate();
await closePool();
console.log("Pilot migration applied.");
