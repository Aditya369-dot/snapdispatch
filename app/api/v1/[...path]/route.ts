import { pilotApi } from "@/lib/pilot/router";

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  return pilotApi(request);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
