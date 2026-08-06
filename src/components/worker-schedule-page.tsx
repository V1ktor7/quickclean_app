"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AvailabilityGrid,
  type SlotStatus,
} from "@/components/availability-grid";
import { Alert, Badge, Button, Card, H1, Muted } from "@/components/ui";
import { formatDayLabel, formatHourBlock, parseDayKey } from "@/lib/schedule/window";

type Track = "TECH" | "SALES";

type Slot = {
  day: string;
  hour: number;
  status: SlotStatus;
};

type ScheduleEntry = {
  id: string;
  day: string;
  hour: number;
  note: string | null;
};

export function WorkerSchedulePage({
  track,
  title,
}: {
  track: Track;
  title: string;
}) {
  const [tab, setTab] = useState<"availability" | "schedule">("availability");
  const [days, setDays] = useState<string[]>([]);
  const [hours, setHours] = useState<number[]>([]);
  const [windowStart, setWindowStart] = useState("");
  const [slots, setSlots] = useState<Record<string, SlotStatus>>({});
  const [submitStatus, setSubmitStatus] = useState<"DRAFT" | "SUBMITTED">("DRAFT");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [postedEntries, setPostedEntries] = useState<ScheduleEntry[]>([]);
  const [schedulePosted, setSchedulePosted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadAvailability = useCallback(async () => {
    const res = await fetch(`/api/availability?track=${track}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load availability");
      return;
    }
    setDays(data.days || []);
    setHours(data.hours || []);
    setWindowStart(data.windowStart || "");
    const map: Record<string, SlotStatus> = {};
    for (const s of data.submission?.slots || []) {
      const day = typeof s.day === "string" ? s.day.slice(0, 10) : dayKeySafe(s.day);
      map[`${day}:${s.hour}`] = s.status;
    }
    setSlots(map);
    setSubmitStatus(data.submission?.status || "DRAFT");
    setSubmittedAt(data.submission?.submittedAt || null);
    setDirty(false);
  }, [track]);

  const loadSchedule = useCallback(async () => {
    const res = await fetch(`/api/schedule?track=${track}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load schedule");
      return;
    }
    setSchedulePosted(Boolean(data.schedule));
    setPostedEntries(
      (data.schedule?.entries || []).map(
        (e: { id: string; day: string; hour: number; note: string | null }) => ({
          id: e.id,
          day: typeof e.day === "string" ? e.day.slice(0, 10) : dayKeySafe(e.day),
          hour: e.hour,
          note: e.note,
        }),
      ),
    );
  }, [track]);

  useEffect(() => {
    void loadAvailability();
    void loadSchedule();
  }, [loadAvailability, loadSchedule]);

  function dayKeySafe(d: string | Date) {
    return new Date(d).toISOString().slice(0, 10);
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    setOk(null);
    const payload: Slot[] = Object.entries(slots).map(([k, status]) => {
      const [day, hour] = k.split(":");
      return { day: day!, hour: Number(hour), status };
    });
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track, slots: payload }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setOk("Availability saved (not confirmed yet).");
    setDirty(false);
    setSubmitStatus("DRAFT");
    await loadAvailability();
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    setOk(null);
    if (dirty) {
      const payload: Slot[] = Object.entries(slots).map(([k, status]) => {
        const [day, hour] = k.split(":");
        return { day: day!, hour: Number(hour), status };
      });
      const saveRes = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track, slots: payload }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json();
        setBusy(false);
        setError(data.error || "Save failed");
        return;
      }
    }
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Confirm failed");
      return;
    }
    setOk("Availability confirmed — admin can see it with your name on the schedule board.");
    setSubmitStatus("SUBMITTED");
    setSubmittedAt(data.submission?.submittedAt || new Date().toISOString());
    setDirty(false);
  }

  const groupedSchedule = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const e of postedEntries) {
      const list = map.get(e.day) ?? [];
      list.push(e);
      map.set(e.day, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [postedEntries]);

  return (
    <div className="space-y-6">
      <div>
        <H1>{title}</H1>
        <Muted>
          Mark the next two weeks (8am–6pm, 1-hour blocks), confirm for admin, then view your posted
          schedule here.
        </Muted>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "availability" ? "primary" : "secondary"}
          onClick={() => setTab("availability")}
        >
          Availability
        </Button>
        <Button
          type="button"
          variant={tab === "schedule" ? "primary" : "secondary"}
          onClick={() => setTab("schedule")}
        >
          My schedule
        </Button>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}
      {ok ? <Alert tone="ok">{ok}</Alert> : null}

      {tab === "availability" ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">Two-week availability</div>
              <div className="text-sm text-[var(--qc-muted)]">
                Window start:{" "}
                {windowStart ? formatDayLabel(new Date(windowStart)) : "—"}
              </div>
            </div>
            <Badge tone={submitStatus === "SUBMITTED" ? "ok" : "warn"}>
              {submitStatus === "SUBMITTED" ? "Confirmed" : "Draft"}
            </Badge>
          </div>
          {submittedAt ? (
            <p className="text-xs text-[var(--qc-muted)]">
              Last confirmed {new Date(submittedAt).toLocaleString()}
            </p>
          ) : null}
          <AvailabilityGrid
            days={days}
            hours={hours}
            value={slots}
            onChange={(day, hour, status) => {
              setSlots((prev) => ({ ...prev, [`${day}:${hour}`]: status }));
              setDirty(true);
              setOk(null);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy || !dirty} onClick={() => void saveDraft()}>
              Save draft
            </Button>
            <Button type="button" disabled={busy} onClick={() => void confirm()}>
              {busy ? "…" : "Confirm for admin"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Posted schedule</h2>
            <Button type="button" variant="secondary" onClick={() => void loadSchedule()}>
              Refresh
            </Button>
          </div>
          {!schedulePosted ? (
            <p className="text-sm text-[var(--qc-muted)]">
              No schedule posted yet for this window. Confirm availability and wait for admin to
              publish.
            </p>
          ) : postedEntries.length === 0 ? (
            <p className="text-sm text-[var(--qc-muted)]">
              Schedule is posted, but you have no assigned blocks this window.
            </p>
          ) : (
            <div className="space-y-3">
              {groupedSchedule.map(([day, entries]) => (
                <div key={day} className="rounded-xl border border-[var(--qc-line)] p-3">
                  <div className="font-medium">{formatDayLabel(parseDayKey(day))}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entries
                      .sort((a, b) => a.hour - b.hour)
                      .map((e) => (
                        <Badge key={e.id} tone="ok">
                          {formatHourBlock(e.hour)}
                          {e.note ? ` · ${e.note}` : ""}
                        </Badge>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
