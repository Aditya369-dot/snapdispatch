import "./pilot-env";
import { closePool } from "@/lib/pilot/db";
import { migrate } from "@/lib/pilot/migrate";
import { resetSyntheticData } from "@/lib/pilot/seed";

async function main(): Promise<void> {
  try {
    await migrate();
    await resetSyntheticData();
    console.log(
      "Synthetic fixtures reset. Password hashes were written to pilot_credentials. Supabase Auth users were not created. Pitch demo data was not touched.",
    );
  } finally {
    await closePool();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
