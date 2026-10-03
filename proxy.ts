import { stagingGateResponse } from "@/lib/pilot/staging-access";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const blocked = stagingGateResponse(request);
  if (blocked) return blocked;
  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/:path*", "/api/v1", "/api/v1/:path*"],
};
