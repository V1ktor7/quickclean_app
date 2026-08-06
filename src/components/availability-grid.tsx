"use client";

import { formatDayLabel, formatHourBlock, parseDayKey } from "@/lib/schedule/window";

export type SlotStatus = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";

const CYCLE: SlotStatus[] = ["UNKNOWN", "AVAILABLE", "UNAVAILABLE"];

const tones: Record<SlotStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  UNAVAILABLE: "bg-red-100 text-red-800 border-red-200",
  UNKNOWN: "bg-[var(--qc-bg)] text-[var(--qc-muted)] border-[var(--qc-line)]",
};

const labels: Record<SlotStatus, string> = {
  AVAILABLE: "Free",
  UNAVAILABLE: "Off",
  UNKNOWN: "?",
};

export function AvailabilityGrid({
  days,
  hours,
  value,
  onChange,
  readOnly,
}: {
  days: string[];
  hours: number[];
  value: Record<string, SlotStatus>;
  onChange?: (day: string, hour: number, status: SlotStatus) => void;
  readOnly?: boolean;
}) {
  function cellKey(day: string, hour: number) {
    return `${day}:${hour}`;
  }

  function cycle(day: string, hour: number) {
    if (readOnly || !onChange) return;
    const cur = value[cellKey(day, hour)] || "UNKNOWN";
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]!;
    onChange(day, hour, next);
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex flex-wrap gap-3 text-xs">
        <span className="rounded border border-emerald-200 bg-emerald-100 px-2 py-0.5">
          Free = available
        </span>
        <span className="rounded border border-red-200 bg-red-100 px-2 py-0.5">Off = not available</span>
        <span className="rounded border border-[var(--qc-line)] bg-[var(--qc-bg)] px-2 py-0.5">
          ? = don’t know
        </span>
      </div>
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white p-1 text-left font-medium text-[var(--qc-muted)]">
              Time
            </th>
            {days.map((d) => (
              <th key={d} className="p-1 font-medium text-[var(--qc-muted)]">
                {formatDayLabel(parseDayKey(d))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr key={hour}>
              <td className="sticky left-0 bg-white p-1 whitespace-nowrap text-[var(--qc-muted)]">
                {formatHourBlock(hour)}
              </td>
              {days.map((day) => {
                const status = value[cellKey(day, hour)] || "UNKNOWN";
                return (
                  <td key={day} className="p-0.5">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => cycle(day, hour)}
                      className={`w-full min-w-[3.25rem] rounded-md border px-1 py-2 font-semibold ${tones[status]} ${
                        readOnly ? "cursor-default" : "hover:opacity-90"
                      }`}
                    >
                      {labels[status]}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
