"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Card, H1, Input, Label, Muted, Textarea } from "@/components/ui";

type Campaign = {
  id: string;
  name: string;
  messageBody: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
};

type Recipient = {
  id: string;
  name: string;
  phone: string | null;
  isCommercial: boolean;
  lastServiceAt: string | null;
};

const SELECTION_KEY = "qc_campaign_client_ids";

export default function AdminCampaignsPage() {
  const params = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [pastMonths, setPastMonths] = useState("");
  const [commercialOnly, setCommercialOnly] = useState(false);
  const [servedThisSeason, setServedThisSeason] = useState(true);
  const [upcomingJobs, setUpcomingJobs] = useState<"any" | "has" | "none">("none");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [seasonStart, setSeasonStart] = useState<string | null>(null);
  const [fromSelection, setFromSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    if (res.ok) setCampaigns(data.campaigns || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (params.get("fromSelection") !== "1") return;
    try {
      const raw = sessionStorage.getItem(SELECTION_KEY);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      if (!Array.isArray(ids) || !ids.length) return;
      setFromSelection(true);
      setBusy(true);
      void fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Selection preview",
          messageBody: "Preview",
          clientIds: ids,
          previewOnly: true,
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          setBusy(false);
          if (!res.ok) {
            setError(data.error || "Could not load selection");
            return;
          }
          const list = (data.recipients || []) as Recipient[];
          setRecipients(list);
          const next: Record<string, boolean> = {};
          for (const r of list) next[r.id] = true;
          setSelected(next);
          sessionStorage.removeItem(SELECTION_KEY);
        })
        .catch(() => {
          setBusy(false);
          setError("Could not load selection");
        });
    } catch {
      /* ignore */
    }
  }, [params]);

  function filterPayload() {
    return {
      pastMonths: pastMonths ? Number(pastMonths) : null,
      commercialOnly,
      servedThisSeason,
      upcomingJobs,
    };
  }

  async function preview() {
    setBusy(true);
    setError(null);
    setOk(null);
    setFromSelection(false);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || "Preview",
        messageBody: messageBody || "Preview",
        filter: filterPayload(),
        previewOnly: true,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Preview failed");
      return;
    }
    const list = (data.recipients || []) as Recipient[];
    setRecipients(list);
    setSeasonStart(data.seasonStart ?? null);
    const next: Record<string, boolean> = {};
    for (const r of list) next[r.id] = true;
    setSelected(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedIds.length) {
      setError("Select at least one recipient (run Preview first).");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        messageBody,
        filter: filterPayload(),
        clientIds: selectedIds,
        send: true,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Send failed");
      return;
    }
    setOk(
      `Campaign complete — sent ${data.campaign.sentCount}, failed ${data.campaign.failedCount}`,
    );
    setName("");
    setMessageBody("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>SMS marketing</H1>
        <Muted>
          Target clients served this season with no upcoming jobs (or flip the filters), preview,
          then select who gets the Quo broadcast.
        </Muted>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Campaign name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea
              required
              rows={4}
              maxLength={1600}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Spring window cleaning special — reply YES to book."
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Past N months (last service)</Label>
              <Input
                type="number"
                min={1}
                value={pastMonths}
                onChange={(e) => setPastMonths(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <Label>Upcoming jobs</Label>
              <select
                className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2 text-sm"
                value={upcomingJobs}
                onChange={(e) => setUpcomingJobs(e.target.value as "any" | "has" | "none")}
              >
                <option value="any">Any</option>
                <option value="none">No upcoming jobs</option>
                <option value="has">Has upcoming jobs</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={servedThisSeason}
                  onChange={(e) => setServedThisSeason(e.target.checked)}
                  className="size-4 accent-[var(--qc-accent)]"
                />
                Served this season
              </label>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={commercialOnly}
                  onChange={(e) => setCommercialOnly(e.target.checked)}
                  className="size-4 accent-[var(--qc-accent)]"
                />
                Commercial only
              </label>
            </div>
          </div>
          {seasonStart || fromSelection ? (
            <p className="text-xs text-[var(--qc-muted)]">
              {seasonStart
                ? `Season start: ${new Date(seasonStart).toLocaleDateString()}`
                : null}
              {fromSelection ? " · Loaded from Clients selection" : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={preview}>
              {busy ? "Loading…" : "Preview & select"}
            </Button>
            <span className="text-sm text-[var(--qc-muted)]">
              {recipients.length
                ? `${selectedIds.length} / ${recipients.length} selected`
                : "Run preview to load recipients"}
            </span>
          </div>
          {recipients.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-[var(--qc-line)] p-3">
              <div className="mb-2 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    for (const r of recipients) next[r.id] = true;
                    setSelected(next);
                  }}
                >
                  Select all
                </Button>
                <Button type="button" variant="secondary" onClick={() => setSelected({})}>
                  Clear
                </Button>
              </div>
              {recipients.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--qc-accent)]"
                    checked={Boolean(selected[r.id])}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))
                    }
                  />
                  <span className="font-medium">{r.name}</span>
                  <span className="text-[var(--qc-muted)]">{r.phone}</span>
                </label>
              ))}
            </div>
          ) : null}
          {error ? <Alert tone="bad">{error}</Alert> : null}
          {ok ? <Alert tone="ok">{ok}</Alert> : null}
          <Button type="submit" disabled={busy || !selectedIds.length}>
            {busy ? "Sending…" : `Send to ${selectedIds.length || 0} clients`}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold">
          Campaign history
        </h2>
        <div className="space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-sm text-[var(--qc-muted)]">No campaigns yet.</p>
          ) : (
            campaigns.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[var(--qc-bg)] px-3 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-[var(--qc-muted)]">{c.messageBody}</div>
                  <div className="mt-1 text-[var(--qc-muted)]">
                    {new Date(c.createdAt).toLocaleString()} · {c.sentCount}/{c.totalCount} sent
                    {c.failedCount ? ` · ${c.failedCount} failed` : ""}
                  </div>
                </div>
                <Badge
                  tone={
                    c.status === "COMPLETED" ? "ok" : c.status === "FAILED" ? "bad" : "neutral"
                  }
                >
                  {c.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
