import "./pilot-env";
import { closePool } from "@/lib/pilot/db";
import { migrate } from "@/lib/pilot/migrate";

async function main(): Promise<void> {
  try {
    await migrate();
    console.log("Pilot migration applied.");
  } finally {
    await closePool();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
