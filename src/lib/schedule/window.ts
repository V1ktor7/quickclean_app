import type { WorkforceTrack } from "@prisma/client";

/** Hour block starts: 8am … 5pm (ends 6pm) */
export const WORK_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

export const WINDOW_DAYS = 14;

export function trackFromRole(role: string): WorkforceTrack | null {
  if (role === "TECH") return "TECH";
  if (role === "SALES") return "SALES";
  return null;
}

/** Monday of the week containing `now`, at UTC noon */
export function currentWindowStart(now = new Date()): Date {
  const d = new Date(now);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0));
  const day = utc.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc;
}

export function addDays(day: Date, n: number): Date {
  const d = new Date(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export function windowDays(windowStart: Date): Date[] {
  return Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i));
}

export function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
}

export function formatHourBlock(hour: number): string {
  const end = hour + 1;
  const fmt = (h: number) => {
    const ampm = h >= 12 ? "pm" : "am";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${ampm}`;
  };
  return `${fmt(hour)}–${fmt(end)}`;
}

export function formatDayLabel(day: Date): string {
  return day.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
