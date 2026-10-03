import { PilotError } from "@/lib/pilot/errors";

/** Local development and test fallback. Staging must not use this value. */
export const WELL_KNOWN_FIXTURE_PASSWORD = "synthetic-dev-password";

export const MIN_STAGING_FIXTURE_PASSWORD_LENGTH = 16;

/**
 * Password hashed into synthetic `pilot_credentials` by `pilot:reset`.
 * Development and test may omit it and use the local default.
 * Staging refuses an empty value, a short value, and the well-known default.
 */
export function fixturePassword(): string {
  const password = (process.env.PILOT_FIXTURE_PASSWORD ?? "").trim();
  if (process.env.SNAPDISPATCH_ENV === "staging") {
    if (!password) {
      throw new PilotError(
        "staging_refused",
        403,
        "Staging requires PILOT_FIXTURE_PASSWORD. An empty password is refused.",
      );
    }
    if (password === WELL_KNOWN_FIXTURE_PASSWORD) {
      throw new PilotError(
        "staging_refused",
        403,
        "Staging refuses the well-known fixture password. Set a unique PILOT_FIXTURE_PASSWORD of at least 16 characters.",
      );
    }
    if (password.length < MIN_STAGING_FIXTURE_PASSWORD_LENGTH) {
      throw new PilotError(
        "staging_refused",
        403,
        "Staging requires PILOT_FIXTURE_PASSWORD of at least 16 characters.",
      );
    }
    return password;
  }
  return password || WELL_KNOWN_FIXTURE_PASSWORD;
}
