export const ERROR_STATUS: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_load: 422,
  invalid_rate: 422,
  invalid_progress: 422,
  invalid_document: 422,
  invalid_expense: 422,
  invalid_correction: 422,
  invalid_mileage: 422,
  duplicate_reference: 409,
  load_not_assignable: 409,
  driver_unavailable: 409,
  truck_out_of_service: 409,
  appointment_overlap: 409,
  not_acknowledged: 409,
  not_ready: 409,
  upload_missing: 409,
  idempotency_conflict: 409,
  staging_refused: 403,
  not_configured: 503,
  invalid_timezone: 422,
};

export const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Sign in required.",
  forbidden: "You cannot do that.",
  not_found: "Not found.",
  invalid_load: "That load is missing a required field, or the appointment ends before it starts.",
  invalid_rate: "The typed rate must be zero or a positive number of cents.",
  invalid_progress: "Progress needs a non-blank note, and a reported stage is at most 80 characters.",
  invalid_document: "That file, kind, or typed amount is not valid.",
  invalid_expense: "A typed expense needs a non-negative amount and an idempotency key.",
  invalid_correction: "A correction needs a non-negative amount and a note.",
  invalid_mileage: "Mileage must be between 0 and 2000, with a date and an idempotency key.",
  duplicate_reference: "That reference is already used in this company.",
  load_not_assignable: "This load cannot be assigned from its current status.",
  driver_unavailable: "That driver is off or inactive.",
  truck_out_of_service: "That truck is out of service.",
  appointment_overlap: "That driver or truck already has a load in this window.",
  not_acknowledged: "That load is not waiting for acknowledgement.",
  not_ready: "That step is not available yet.",
  upload_missing: "The file is not in private storage yet.",
  idempotency_conflict: "That idempotency key was already used for a different request.",
  staging_refused: "Fixture reset is refused unless the target is development, test, or staging and every organization is synthetic.",
  not_configured: "The pilot database is not configured.",
  invalid_timezone: "That timezone is not a known IANA name.",
};

const KNOWN = new Set(Object.keys(ERROR_STATUS));

export class PilotError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = ERROR_STATUS[code] ?? 500, message = ERROR_MESSAGES[code] ?? code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function toPilotError(error: unknown): PilotError {
  if (error instanceof PilotError) return error;
  if (error instanceof Error && KNOWN.has(error.message)) {
    return new PilotError(error.message);
  }
  if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "22P02") {
    return new PilotError("invalid_load");
  }
  return new PilotError("server_error", 500, "The pilot request failed.");
}

export function errorBody(error: PilotError): { error: { code: string; message: string } } {
  return { error: { code: error.code, message: error.message } };
}
