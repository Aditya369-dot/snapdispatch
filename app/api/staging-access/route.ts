import { stagingUnlockResponse } from "@/lib/pilot/staging-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return stagingUnlockResponse(request);
}
