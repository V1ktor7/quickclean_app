import type { AvailabilitySlot, SlotAvailability } from "@prisma/client";
import { WORK_HOURS, dayKey, windowDays } from "@/lib/schedule/window";

export type OptimizedEntry = {
  userId: string;
  day: Date;
  hour: number;
};

type SlotLike = Pick<AvailabilitySlot, "userId" | "day" | "hour" | "status">;

/**
 * Build a draft schedule from submitted availability.
 * Strategy:
 * 1) Seed every AVAILABLE slot as a candidate assignment.
 * 2) For each day/hour with no AVAILABLE person, try UNKNOWN as soft fill,
 *    preferring people with the fewest assigned hours so far (load balance).
 * UNAVAILABLE is never assigned.
 */
export function optimizeScheduleFromAvailability(
  windowStart: Date,
  slots: SlotLike[],
): OptimizedEntry[] {
  const days = windowDays(windowStart);
  const byCell = new Map<string, SlotLike[]>();

  for (const s of slots) {
    const key = `${dayKey(s.day)}:${s.hour}`;
    const list = byCell.get(key) ?? [];
    list.push(s);
    byCell.set(key, list);
  }

  const load = new Map<string, number>();
  const bump = (userId: string) => load.set(userId, (load.get(userId) ?? 0) + 1);
  const entries: OptimizedEntry[] = [];
  const seen = new Set<string>();

  const push = (userId: string, day: Date, hour: number) => {
    const id = `${userId}:${dayKey(day)}:${hour}`;
    if (seen.has(id)) return;
    seen.add(id);
    entries.push({ userId, day, hour });
    bump(userId);
  };

  // Pass 1 — honor every AVAILABLE mark
  for (const day of days) {
    for (const hour of WORK_HOURS) {
      const cell = byCell.get(`${dayKey(day)}:${hour}`) ?? [];
      for (const s of cell) {
        if (s.status === "AVAILABLE") push(s.userId, day, hour);
      }
    }
  }

  // Pass 2 — soft-fill empty hours with UNKNOWN, least-loaded first
  for (const day of days) {
    for (const hour of WORK_HOURS) {
      const cell = byCell.get(`${dayKey(day)}:${hour}`) ?? [];
      const hasAvailable = cell.some((s) => s.status === "AVAILABLE");
      if (hasAvailable) continue;
      const unknowns = cell
        .filter((s) => s.status === ("UNKNOWN" as SlotAvailability))
        .sort((a, b) => (load.get(a.userId) ?? 0) - (load.get(b.userId) ?? 0));
      if (unknowns[0]) push(unknowns[0].userId, day, hour);
    }
  }

  return entries;
}
