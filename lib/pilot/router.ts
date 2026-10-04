import { clearSessionCookie, profileIdFromRequest, readUploadToken, sessionCookie, signSession } from "@/lib/pilot/auth";
import { requestGrantsStagingAccess, stagingLockedResponse } from "@/lib/pilot/staging-access";
import { PilotError, errorBody, toPilotError } from "@/lib/pilot/errors";
import { withAdmin } from "@/lib/pilot/db";
import {
  acknowledgeLoad,
  assignLoad,
  completeDocument,
  correctExpense,
  createLoad,
  createTypedExpense,
  getLoad,
  getMe,
  health,
  listCustomers,
  listDrivers,
  listEvents,
  listExpenses,
  listLoads,
  listMaintenance,
  listMileage,
  listPayExamples,
  listPlaces,
  listTrucks,
  login,
  readDocumentFile,
  recordMileage,
  recordProgress,
  registerDocument,
  reviewDocument,
  storeUpload,
} from "@/lib/pilot/workflow";

function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("bad");
    return value as Record<string, unknown>;
  } catch {
    throw new PilotError("invalid_load", 422, "Request body must be a JSON object.");
  }
}

function idempotencyKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key");
  return value && value.trim() ? value.trim() : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value == null) return value as null | undefined;
  return typeof value === "string" ? value : undefined;
}

async function requireProfile(request: Request): Promise<string> {
  const profileId = profileIdFromRequest(request);
  if (!profileId) throw new PilotError("unauthenticated");
  return profileId;
}

/**
 * Optional fallback. Staging does not require Supabase Auth users.
 * Password sessions against pilot_credentials are the login path.
 * This runs only after local login fails, and only when the anon key is set.
 * The Auth user id must already equal profiles.id. Setting Supabase env vars
 * does not create users.
 */
async function supabaseProfileId(email: string, password: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { user?: { id?: string } };
  const userId = body.user?.id;
  if (!userId) return null;
  return withAdmin(async (client) => {
    const found = await client.query("select id from profiles where id = $1", [userId]);
    return found.rows[0] ? userId : null;
  });
}

export async function pilotApi(request: Request): Promise<Response> {
  try {
    if (!requestGrantsStagingAccess(request)) return stagingLockedResponse();
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const method = request.method.toUpperCase();

    if (method === "GET" && path === "/api/v1/health") {
      return json(await health());
    }

    if (method === "POST" && path === "/api/v1/session") {
      const body = await readJson(request);
      const email = asString(body.email) ?? "";
      const password = asString(body.password) ?? "";
      let profileId: string | null = null;
      try {
        profileId = await login(email, password);
      } catch (error) {
        if (!(error instanceof PilotError) || error.code !== "unauthenticated") throw error;
        profileId = await supabaseProfileId(email, password);
      }
      if (!profileId) throw new PilotError("unauthenticated");
      const token = signSession(profileId);
      const me = await getMe(profileId);
      return json({ token, ...me }, 200, { "set-cookie": sessionCookie(token, request) });
    }

    if (method === "DELETE" && path === "/api/v1/session") {
      return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
    }

    if (method === "PUT" && path.startsWith("/api/v1/uploads/")) {
      const token = decodeURIComponent(path.slice("/api/v1/uploads/".length));
      const documentId = readUploadToken(token);
      if (!documentId) throw new PilotError("unauthenticated");
      const bytes = Buffer.from(await request.arrayBuffer());
      return json(await storeUpload(documentId, bytes, request.headers.get("content-type")));
    }

    const profileId = await requireProfile(request);

    if (method === "GET" && path === "/api/v1/me") return json(await getMe(profileId));
    if (method === "GET" && path === "/api/v1/loads") {
      return json(await listLoads(profileId, url.searchParams.get("businessDay")));
    }
    if (method === "POST" && path === "/api/v1/loads") {
      const body = await readJson(request);
      return json(
        await createLoad(profileId, {
          reference: asString(body.reference),
          containerNumber: asNullableString(body.containerNumber),
          externalReference: asNullableString(body.externalReference),
          customerId: asString(body.customerId),
          pickupPlaceId: asString(body.pickupPlaceId),
          destinationPlaceId: asString(body.destinationPlaceId),
          appointmentStart: asString(body.appointmentStart),
          appointmentEnd: asString(body.appointmentEnd),
          lastFreeDay: asNullableString(body.lastFreeDay),
          emptyReturnDeadline: asNullableString(body.emptyReturnDeadline),
          cutoff: asNullableString(body.cutoff),
          customerRateCents: body.customerRateCents == null ? null : asNumber(body.customerRateCents),
          notes: asString(body.notes),
        }),
        201,
      );
    }

    const loadAction = /^\/api\/v1\/loads\/([^/]+)(?:\/([^/]+))?$/.exec(path);
    if (loadAction) {
      const [, loadId, action] = loadAction;
      if (method === "GET" && !action) return json(await getLoad(profileId, loadId));
      if (method === "GET" && action === "events") return json(await listEvents(profileId, loadId));
      if (method === "POST" && action === "assign") {
        const body = await readJson(request);
        return json(await assignLoad(profileId, loadId, asString(body.driverId) ?? "", asString(body.truckId) ?? ""));
      }
      if (method === "POST" && action === "acknowledge") return json(await acknowledgeLoad(profileId, loadId));
      if (method === "POST" && action === "progress") {
        const body = await readJson(request);
        return json(
          await recordProgress(profileId, loadId, asString(body.note), asNullableString(body.reportedStage) ?? null, idempotencyKey(request)),
        );
      }
      if (method === "POST" && action === "documents") {
        const body = await readJson(request);
        return json(
          await registerDocument(
            profileId,
            loadId,
            {
              kind: asString(body.kind),
              fileName: asString(body.fileName),
              mimeType: asString(body.mimeType),
              byteSize: asNumber(body.byteSize),
              amountCents: body.amountCents == null ? undefined : asNumber(body.amountCents),
            },
            idempotencyKey(request),
            url.origin,
          ),
          201,
        );
      }
    }

    const documentAction = /^\/api\/v1\/documents\/([^/]+)\/(complete|file|review)$/.exec(path);
    if (documentAction) {
      const [, documentId, action] = documentAction;
      if (method === "POST" && action === "complete") return json(await completeDocument(profileId, documentId));
      if (method === "GET" && action === "file") {
        const file = await readDocumentFile(profileId, documentId);
        return new Response(new Uint8Array(file.bytes), {
          status: 200,
          headers: {
            "content-type": file.mime,
            "content-disposition": `attachment; filename="${file.fileName.replaceAll('"', "")}"`,
            "cache-control": "private, no-store",
          },
        });
      }
      if (method === "POST" && action === "review") {
        const body = await readJson(request);
        return json(await reviewDocument(profileId, documentId, asString(body.decision) ?? "", asString(body.note) ?? ""));
      }
    }

    if (method === "GET" && path === "/api/v1/trucks") return json(await listTrucks(profileId));
    if (method === "GET" && path === "/api/v1/drivers") return json(await listDrivers(profileId));
    if (method === "GET" && path === "/api/v1/customers") return json(await listCustomers(profileId));
    if (method === "GET" && path === "/api/v1/places") return json(await listPlaces(profileId));
    if (method === "GET" && path === "/api/v1/maintenance") return json(await listMaintenance(profileId));
    if (method === "GET" && path === "/api/v1/mileage") return json(await listMileage(profileId));
    if (method === "POST" && path === "/api/v1/mileage") {
      const body = await readJson(request);
      return json(
        await recordMileage(profileId, {
          truckId: asString(body.truckId),
          loadId: asNullableString(body.loadId),
          miles: asNumber(body.miles),
          reportedOn: asString(body.reportedOn),
          idempotencyKey: asString(body.idempotencyKey) ?? idempotencyKey(request) ?? undefined,
        }),
      );
    }
    if (method === "GET" && path === "/api/v1/expenses") return json(await listExpenses(profileId));
    if (method === "POST" && path === "/api/v1/expenses") {
      const body = await readJson(request);
      return json(
        await createTypedExpense(profileId, {
          amountCents: asNumber(body.amountCents),
          memo: asString(body.memo),
          loadId: asNullableString(body.loadId),
          idempotencyKey: asString(body.idempotencyKey) ?? idempotencyKey(request) ?? undefined,
        }),
      );
    }
    const correction = /^\/api\/v1\/expenses\/([^/]+)\/corrections$/.exec(path);
    if (method === "POST" && correction) {
      const body = await readJson(request);
      return json(
        await correctExpense(profileId, correction[1], {
          amountCents: asNumber(body.amountCents),
          note: asString(body.note),
          idempotencyKey: asString(body.idempotencyKey) ?? idempotencyKey(request) ?? undefined,
        }),
      );
    }
    if (method === "GET" && path === "/api/v1/pay-examples") return json(await listPayExamples(profileId));

    throw new PilotError("not_found");
  } catch (error) {
    const pilot = toPilotError(error);
    return json(errorBody(pilot), pilot.status);
  }
}
