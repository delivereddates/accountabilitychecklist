/**
 * Timezone helpers. Server-side we only need "what hour/minute and what
 * YYYY-MM-DD is it at `now` in the user's IANA timezone" — Intl can answer
 * both without pulling in a tz database.
 */

/** True when `tz` is a valid IANA timezone name. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Local wall-clock {hour, minute} of `now` in `tz`.
 * hourCycle "h23" is important: hour12:false renders midnight as "24" on
 * some ICU builds, which would break the minute math.
 */
export function localHourMinute(now: Date, tz: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return { hour, minute };
}

/** Local YYYY-MM-DD of `now` in `tz` (en-CA formats dates as ISO). */
export function localDateISO(now: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
