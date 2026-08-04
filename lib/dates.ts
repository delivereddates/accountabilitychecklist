import { addDays, startOfWeek } from "date-fns";
import { fromISODate, toISODate } from "./utils";

export type WindowMode = "rolling" | "calendar";

/** Inclusive list of YYYY-MM-DD days from..to (from <= to). */
export function eachDayISO(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const from = fromISODate(fromISO);
  const to = fromISODate(toISO);
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push(toISODate(d));
  }
  return out;
}

/** 7-day window ending at (or containing) the anchor date. */
export function weekDays(anchorISO: string, mode: WindowMode): string[] {
  const anchor = fromISODate(anchorISO);
  const start =
    mode === "rolling"
      ? addDays(anchor, -6)
      : startOfWeek(anchor, { weekStartsOn: 1 }); // Monday
  return eachDayISO(toISODate(start), toISODate(addDays(start, 6)));
}

/** Rolling-30 or calendar-month day list, plus first day-of-week offset. */
export function monthDays(
  anchorISO: string,
  mode: WindowMode,
): { days: string[]; leadOffset: number } {
  const anchor = fromISODate(anchorISO);
  if (mode === "rolling") {
    const start = addDays(anchor, -29);
    // Align the first cell to the week's Monday (Mon = index 0).
    const leadOffset = (start.getDay() + 6) % 7;
    return { days: eachDayISO(toISODate(start), toISODate(anchor)), leadOffset };
  }
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const leadOffset = (first.getDay() + 6) % 7; // shift Sun(0)..Sat(6) to Mon-first
  return {
    days: eachDayISO(toISODate(first), toISODate(last)),
    leadOffset,
  };
}

/** Rolling-365 or calendar-year (Jan 1 – Dec 31) day list for the heatmap. */
export function yearDays(anchorISO: string, mode: WindowMode): string[] {
  const anchor = fromISODate(anchorISO);
  if (mode === "rolling") {
    const start = addDays(anchor, -364);
    return eachDayISO(toISODate(start), toISODate(anchor));
  }
  const y = anchor.getFullYear();
  return eachDayISO(toISODate(new Date(y, 0, 1)), toISODate(new Date(y, 11, 31)));
}
