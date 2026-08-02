"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, H1, Muted } from "@/components/ui";

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  sortOrder: number;
};

type TimeLog = {
  id: string;
  punchedInAt: string;
  punchedOutAt?: string | null;
  status: string;
  checklist?: ChecklistItem[];
};

export default function TechTimePage() {
  const [open, setOpen] = useState<TimeLog | null>(null);
  const [recent, setRecent] = useState<TimeLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/time-logs");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load time logs");
      setLoading(false);
      return;
    }
    setOpen(data.open);
    setRecent(data.recent || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checklist = open?.checklist ?? [];
  const complete = useMemo(
    () => checklist.length > 0 && checklist.every((i) => i.checked),
    [checklist],
  );
  const checkedCount = checklist.filter((i) => i.checked).length;

  async function punch(action: "punch-in" | "punch-out") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/time-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Action failed");
      return;
    }
    await load();
  }

  async function toggleItem(item: ChecklistItem) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/checklists/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !item.checked }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not update checklist");
      return;
    }
    setOpen((prev) => (prev ? { ...prev, checklist: data.checklist } : prev));
  }

  if (loading) {
    return <p className="text-sm text-[var(--qc-muted)]">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Field time clock</H1>
        <Muted>Punch out stays locked until the equipment manifest is 100% complete.</Muted>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--qc-muted)] uppercase">
              Status
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={open ? "ok" : "neutral"}>{open ? "On the clock" : "Clocked out"}</Badge>
              {open ? (
                <span className="text-sm text-[var(--qc-muted)]">
                  Since {new Date(open.punchedInAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => punch("punch-in")}
              disabled={busy || Boolean(open)}
              variant="secondary"
            >
              Punch in
            </Button>
            <Button onClick={() => punch("punch-out")} disabled={busy || !open || !complete}>
              Punch out
            </Button>
          </div>
        </div>
        {open && !complete ? (
          <div className="mt-4">
            <Alert>
              Punch out is disabled until every equipment item is checked ({checkedCount}/
              {checklist.length}).
            </Alert>
          </div>
        ) : null}
      </Card>

      {open ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Equipment manifest
            </h2>
            <Badge tone={complete ? "ok" : "warn"}>
              {checkedCount}/{checklist.length}
            </Badge>
          </div>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--qc-line)] px-3 py-3 hover:bg-[var(--qc-bg)]">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    disabled={busy}
                    onChange={() => toggleItem(item)}
                    className="size-5 accent-[var(--qc-accent)]"
                  />
                  <span className={item.checked ? "text-[var(--qc-muted)] line-through" : ""}>
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold">
          Recent shifts
        </h2>
        <div className="space-y-2">
          {recent.length === 0 ? (
            <p className="text-sm text-[var(--qc-muted)]">No shifts yet.</p>
          ) : (
            recent.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--qc-bg)] px-3 py-2 text-sm"
              >
                <span>{new Date(log.punchedInAt).toLocaleString()}</span>
                <Badge tone={log.status === "OPEN" ? "ok" : "neutral"}>{log.status}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
