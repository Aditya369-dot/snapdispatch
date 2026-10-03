import "./pilot-env";
import { closePool } from "@/lib/pilot/db";
import { migrate } from "@/lib/pilot/migrate";
import { resetSyntheticData } from "@/lib/pilot/seed";

await migrate();
await resetSyntheticData();
await closePool();
console.log("Synthetic fixtures reset. Pitch demo data was not touched.");
