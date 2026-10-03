/**
 * UTC storage plus an organization IANA zone.
 * Business-day bounds are computed in that zone. Nothing here appends a fixed -07:00 offset.
 * The pitch demo clock is not used.
 */

const PARTS: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

function zoneParts(timeZone: string, utcMs: number): Record<string, string> {
  const format = new Intl.DateTimeFormat("en-US", { ...PARTS, timeZone });
  return Object.fromEntries(format.formatToParts(new Date(utcMs)).map((part) => [part.type, part.value]));
}

/** Milliseconds to add to a UTC instant to get the local wall clock expressed as UTC. */
export function zoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = zoneParts(timeZone, utcMs);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

/** `2026-10-06T08:00` in `timeZone` → UTC ISO string ending in Z. */
export function zonedLocalToUtc(local: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!match) {
    throw new Error("invalid_local_datetime");
  }
  const [, year, month, day, hour, minute, second] = match;
  const wall = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0));
  const first = wall - zoneOffsetMs(timeZone, wall);
  const utc = wall - zoneOffsetMs(timeZone, first);
  return new Date(utc).toISOString();
}

export function formatInZone(isoUtc: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoUtc));
}

export function todayInZone(timeZone: string, now = new Date()): string {
  const parts = zoneParts(timeZone, now.getTime());
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toUtcIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}
