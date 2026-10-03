import { toUtcIso } from "@/lib/pilot/time";

export type LoadRow = {
  id: string;
  organization_id: string;
  reference: string;
  container_number: string | null;
  external_reference: string | null;
  customer_id: string;
  pickup_place_id: string;
  destination_place_id: string;
  appointment_start: Date | string;
  appointment_end: Date | string;
  last_free_day: Date | string | null;
  empty_return_deadline: Date | string | null;
  cutoff: Date | string | null;
  status: string;
  driver_id: string | null;
  truck_id: string | null;
  customer_rate_cents: number | null;
  notes: string;
  acknowledged_at: Date | string | null;
};

export type EventRow = {
  id: string;
  load_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
  actor_profile_id: string;
  occurred_at: Date | string;
  note: string;
  reported_stage: string | null;
};

export type DocumentRow = {
  id: string;
  load_id: string;
  kind: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  amount_cents: number | null;
  upload_completed_at: Date | string | null;
  review_status: string;
  reviewed_at: Date | string | null;
  review_note: string;
  storage_bucket: string;
  storage_path: string;
};

function dateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function serializeEvent(row: EventRow) {
  return {
    id: row.id,
    type: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorProfileId: row.actor_profile_id,
    occurredAt: toUtcIso(row.occurred_at),
    note: row.note,
    reportedStage: row.reported_stage,
  };
}

/** Document metadata for clients. Storage bucket and path are omitted on purpose. */
export function serializeDocument(row: DocumentRow) {
  return {
    id: row.id,
    loadId: row.load_id,
    kind: row.kind,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    amountCents: row.amount_cents,
    uploadCompletedAt: row.upload_completed_at ? toUtcIso(row.upload_completed_at) : null,
    reviewStatus: row.review_status,
    reviewedAt: row.reviewed_at ? toUtcIso(row.reviewed_at) : null,
    reviewNote: row.review_note,
  };
}

export function serializeLoad(row: LoadRow, events: EventRow[] = [], documents: DocumentRow[] = []) {
  return {
    id: row.id,
    reference: row.reference,
    containerNumber: row.container_number,
    externalReference: row.external_reference,
    customerId: row.customer_id,
    pickupPlaceId: row.pickup_place_id,
    destinationPlaceId: row.destination_place_id,
    appointmentStart: toUtcIso(row.appointment_start),
    appointmentEnd: toUtcIso(row.appointment_end),
    lastFreeDay: dateOnly(row.last_free_day),
    emptyReturnDeadline: dateOnly(row.empty_return_deadline),
    cutoff: row.cutoff ? toUtcIso(row.cutoff) : null,
    status: row.status,
    driverId: row.driver_id,
    truckId: row.truck_id,
    customerRateCents: row.customer_rate_cents,
    notes: row.notes,
    acknowledgedAt: row.acknowledged_at ? toUtcIso(row.acknowledged_at) : null,
    events: events.map(serializeEvent),
    documents: documents.map(serializeDocument),
  };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
