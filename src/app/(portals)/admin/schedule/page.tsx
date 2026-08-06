"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, H1, Label, Muted } from "@/components/ui";
import {
  AvailabilityGrid,
  type SlotStatus,
} from "@/components/availability-grid";
import { formatDayLabel, formatHourBlock, parseDayKey } from "@/lib/schedule/window";

type Track = "TECH" | "SALES";

type Submission = {
  id: string;
  status: string;
  submittedAt: string | null;
  user: { id: string; name: string; email: string };
  slots: Array<{ day: string; hour: number; status: SlotStatus }>;
};

type Entry = {
  id: string;
  userId: string;
  day: string;
  hour: number;
  note: string | null;
  user: { id: string; name: string; email: string };
};

export default function AdminSchedulePage() {
  const [track, setTrack] = useState<Track>("TECH");
  const [days, setDays] = useState<string[]>([]);
  const [hours, setHours] = useState<number[]>([]);
  const [windowStart, setWindowStart] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState<"DRAFT" | "POSTED" | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewUserId, setViewUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [availRes, schedRes] = await Promise.all([
      fetch(`/api/availability?track=${track}`),
      fetch(`/api/schedule?track=${track}`),
    ]);
    const avail = await availRes.json();
    const sched = await schedRes.json();
    if (!availRes.ok) {
      setError(avail.error || "Failed to load availability");
      return;
    }
    if (!schedRes.ok) {
      setError(sched.error || "Failed to load schedule");
      return;
    }
    setDays(avail.days || []);
    setHours(avail.hours || []);
    setWindowStart(avail.windowStart || "");
    const subs: Submission[] = (avail.submissions || []).map(
      (s: {
        id: string;
        status: string;
        submittedAt: string | null;
        user: { id: string; name: string; email: string };
        slots: Array<{ day: string | Date; hour: number; status: SlotStatus }>;
      }) => ({
        ...s,
        slots: s.slots.map((sl) => ({
          day: typeof sl.day === "string" ? sl.day.slice(0, 10) : new Date(sl.day).toISOString().slice(0, 10),
          hour: sl.hour,
          status: sl.status,
        })),
      }),
    );
    setSubmissions(subs);
    setScheduleStatus(sched.schedule?.status ?? null);
    setEntries(
      (sched.schedule?.entries || []).map(
        (e: {
          id: string;
          userId: string;
          day: string | Date;
          hour: number;
          note: string | null;
          user: { id: string; name: string; email: string };
        }) => ({
          id: e.id,
          userId: e.userId,
          day: typeof e.day === "string" ? e.day.slice(0, 10) : new Date(e.day).toISOString().slice(0, 10),
          hour: e.hour,
          note: e.note,
          user: e.user,
        }),
      ),
    );
    if (!selectedUserId && subs[0]) setSelectedUserId(subs[0].user.id);
  }, [track, selectedUserId]);

  useEffect(() => {
    void load();
  }, [track]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitted = useMemo(
    () => submissions.filter((s) => s.status === "SUBMITTED"),
    [submissions],
  );

  const viewSlots = useMemo(() => {
    const sub = submissions.find((s) => s.user.id === viewUserId);
    if (!sub) return {};
    const map: Record<string, SlotStatus> = {};
    for (const s of sub.slots) map[`${s.day}:${s.hour}`] = s.status;
    return map;
  }, [submissions, viewUserId]);

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of submissions) map.set(s.user.id, s.user.name);
    for (const e of entries) map.set(e.userId, e.user.name);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [submissions, entries]);

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, track, ...extra }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Action failed");
      return;
    }
    if (action === "auto") {
      setOk(
        `Draft built from ${data.stats?.submissions ?? 0} confirmations → ${data.stats?.entries ?? 0} blocks.`,
      );
    } else if (action === "post") {
      setOk("Schedule posted — workers can see it under My schedule.");
    } else if (action === "reopen") {
      setOk("Schedule reopened for editing.");
    } else {
      setOk("Updated.");
    }
    await load();
  }

  async function toggleEntry(day: string, hour: number) {
    if (!selectedUserId) {
      setError("Pick a person to assign first");
      return;
    }
    if (scheduleStatus === "POSTED") {
      setError("Reopen the schedule before editing");
      return;
    }
    const exists = entries.some(
      (e) => e.userId === selectedUserId && e.day === day && e.hour === hour,
    );
    await run(exists ? "removeEntry" : "setEntry", {
      userId: selectedUserId,
      day,
      hour,
    });
  }

  const board = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = `${e.day}:${e.hour}`;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  return (
    <div className="space-y-6">
      <div>
        <H1>Workforce schedule</H1>
        <Muted>
          Tech and Sales are separate tracks. Workers confirm availability; you auto-build or hand
          assign, then post.
        </Muted>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={track === "TECH" ? "primary" : "secondary"}
          onClick={() => setTrack("TECH")}
        >
          Tech track
        </Button>
        <Button
          type="button"
          variant={track === "SALES" ? "primary" : "secondary"}
          onClick={() => setTrack("SALES")}
        >
          Sales track
        </Button>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}
      {ok ? <Alert tone="ok">{ok}</Alert> : null}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Confirmed availability</h2>
            <p className="text-sm text-[var(--qc-muted)]">
              Window: {windowStart ? formatDayLabel(new Date(windowStart)) : "—"} ·{" "}
              {submitted.length} confirmed / {submissions.length} started
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        {submitted.length === 0 ? (
          <p className="text-sm text-[var(--qc-muted)]">
            Nobody has confirmed yet for this {track.toLowerCase()} window.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {submitted.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setViewUserId(s.user.id === viewUserId ? null : s.user.id)}
                className="inline-flex"
              >
                <Badge tone={viewUserId === s.user.id ? "ok" : "warn"}>
                  {s.user.name}
                  {s.submittedAt
                    ? ` · ${new Date(s.submittedAt).toLocaleDateString()}`
                    : ""}
                </Badge>
              </button>
            ))}
          </div>
        )}
        {viewUserId ? (
          <div className="rounded-xl border border-[var(--qc-line)] p-3">
            <div className="mb-2 font-medium">
              Availability — {submitted.find((s) => s.user.id === viewUserId)?.user.name}
            </div>
            <AvailabilityGrid days={days} hours={hours} value={viewSlots} readOnly />
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Schedule builder</h2>
            <div className="text-sm text-[var(--qc-muted)]">
              Status:{" "}
              {scheduleStatus ? (
                <Badge tone={scheduleStatus === "POSTED" ? "ok" : "warn"}>{scheduleStatus}</Badge>
              ) : (
                "none"
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void run("auto")}
            >
              Auto-create from availability
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || scheduleStatus === "POSTED"}
              onClick={() => void run("clear")}
            >
              Clear draft
            </Button>
            {scheduleStatus === "POSTED" ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void run("reopen")}>
                Reopen
              </Button>
            ) : (
              <Button type="button" disabled={busy || !entries.length} onClick={() => void run("post")}>
                Post schedule
              </Button>
            )}
          </div>
        </div>

        <div>
          <Label>Assign as (click cells to toggle)</Label>
          <select
            className="mt-1 w-full max-w-sm rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2 text-sm"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">Select person…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-1 text-left text-[var(--qc-muted)]">Time</th>
                {days.map((d) => (
                  <th key={d} className="p-1 text-[var(--qc-muted)]">
                    {formatDayLabel(parseDayKey(d))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour}>
                  <td className="p-1 whitespace-nowrap text-[var(--qc-muted)]">
                    {formatHourBlock(hour)}
                  </td>
                  {days.map((day) => {
                    const cell = board.get(`${day}:${hour}`) || [];
                    return (
                      <td key={day} className="p-0.5 align-top">
                        <button
                          type="button"
                          onClick={() => void toggleEntry(day, hour)}
                          className="min-h-[3rem] w-full min-w-[4.5rem] rounded-md border border-[var(--qc-line)] bg-white px-1 py-1 text-left hover:bg-[var(--qc-bg)]"
                        >
                          {cell.length === 0 ? (
                            <span className="text-[var(--qc-muted)]">—</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {cell.map((e) => (
                                <span
                                  key={e.id}
                                  className="rounded bg-emerald-100 px-1 py-0.5 font-semibold text-emerald-800"
                                >
                                  {e.user.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
