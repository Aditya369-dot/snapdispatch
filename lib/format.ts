const PACIFIC = "America/Los_Angeles";

let activeLocale = "en-US";

export function setActiveLocale(locale: string) {
  activeLocale = locale;
}

export function getActiveLocale() {
  return activeLocale;
}

function loc(locale?: string) {
  return locale ?? activeLocale;
}

export const DEMO_NOW = "2026-10-01T09:40:00-07:00";
export const DEMO_DAY = "2026-10-01";
export const WEEK_START = "2026-09-28";
export const WEEK_END = "2026-10-04";

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function money(value: number, locale?: string) {
  return value.toLocaleString(loc(locale), {
    style: "currency",
    currency: "USD",
  });
}

export function moneyExact(value: number, locale?: string) {
  return roundMoney(value).toLocaleString(loc(locale), {
    style: "currency",
    currency: "USD",
  });
}

export function gallons(value: number, locale?: string) {
  const formatted = value.toLocaleString(loc(locale), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${formatted} gal`;
}

export function iso(day: string, time: string) {
  return `${day}T${time}:00-07:00`;
}

export function toPacificIso(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}-07:00`;
}

export function addMinutes(isoStamp: string, minutes: number) {
  return toPacificIso(new Date(new Date(isoStamp).getTime() + minutes * 60_000));
}

export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00-07:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return dayKey(date.toISOString());
}

export function dayKey(isoStamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoStamp));
}

export function isDemoDay(isoStamp: string) {
  return dayKey(isoStamp) === DEMO_DAY;
}

export function isThisWeek(isoStamp: string) {
  const key = dayKey(isoStamp);
  return key >= WEEK_START && key <= WEEK_END;
}

export function formatDate(isoStamp: string, locale?: string) {
  return new Intl.DateTimeFormat(loc(locale), {
    timeZone: PACIFIC,
    month: "short",
    day: "numeric",
  }).format(new Date(isoStamp));
}

export function formatWeekday(isoStamp: string, locale?: string) {
  return new Intl.DateTimeFormat(loc(locale), {
    timeZone: PACIFIC,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(isoStamp));
}

export function formatTime(isoStamp: string, locale?: string) {
  return new Intl.DateTimeFormat(loc(locale), {
    timeZone: PACIFIC,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoStamp));
}

export function formatDateTime(isoStamp: string) {
  return `${formatWeekday(isoStamp)}, ${formatTime(isoStamp)}`;
}

export function formatDayLabel(day: string) {
  return formatWeekday(`${day}T12:00:00-07:00`);
}

export function formatLongDate(dayOrIso: string, locale?: string) {
  const isoStamp = dayOrIso.includes("T") ? dayOrIso : `${dayOrIso}T12:00:00-07:00`;
  return new Intl.DateTimeFormat(loc(locale), {
    timeZone: PACIFIC,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoStamp));
}

export function daysBetween(fromDay: string, toDay: string) {
  const from = new Date(`${fromDay}T12:00:00-07:00`).getTime();
  const to = new Date(`${toDay}T12:00:00-07:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function miles(value: number, locale?: string) {
  return `${Math.round(value).toLocaleString(loc(locale))} mi`;
}
