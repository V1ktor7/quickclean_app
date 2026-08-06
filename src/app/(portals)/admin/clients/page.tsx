"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, H1, Input, Label, Muted } from "@/components/ui";

type Client = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  isCommercial: boolean;
  skipReviewSms?: boolean;
  lastServiceAt?: string | null;
  tags: string[];
  jobberWebUri?: string | null;
  hasUpcoming?: boolean;
  upcomingJobs?: Array<{
    id: string;
    title?: string | null;
    status?: string | null;
    scheduledAt?: string | null;
  }>;
  jobs: Array<{
    id: string;
    title?: string | null;
    status?: string | null;
    scheduledAt?: string | null;
    completedAt?: string | null;
  }>;
};

const SELECTION_KEY = "qc_campaign_client_ids";

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [clientType, setClientType] = useState<"all" | "residential" | "commercial">(
    "all",
  );
  const [pastMonths, setPastMonths] = useState("");
  const [servedThisSeason, setServedThisSeason] = useState(false);
  const [upcomingJobs, setUpcomingJobs] = useState<"any" | "has" | "none">("any");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [seasonStart, setSeasonStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (clientType !== "all") params.set("clientType", clientType);
    if (pastMonths) params.set("pastMonths", pastMonths);
    if (servedThisSeason) params.set("servedThisSeason", "true");
    if (upcomingJobs !== "any") params.set("upcomingJobs", upcomingJobs);
    params.set("pageSize", "100");
    const res = await fetch(`/api/clients?${params}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to load clients");
      return;
    }
    setError(null);
    setClients(data.clients || []);
    setTotal(data.total || 0);
    setSeasonStart(data.seasonStart ?? null);
  }, [search, clientType, pastMonths, servedThisSeason, upcomingJobs]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const c of clients) {
      if (c.phone) next[c.id] = on;
    }
    setSelected(next);
  }

  function sendToCampaign() {
    if (!selectedIds.length) return;
    sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selectedIds));
    router.push("/admin/campaigns?fromSelection=1");
  }

  async function toggleSkipReview(clientId: string, skipReviewSms: boolean) {
    setTogglingId(clientId);
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skipReviewSms }),
    });
    setTogglingId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not update review preference");
      return;
    }
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, skipReviewSms } : c)),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Jobber clients</H1>
        <Muted>
          Filter by season service and upcoming jobs, then select clients for an SMS campaign.
          Sync Jobber first so job dates are fresh.
        </Muted>
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Label>Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, email"
            />
          </div>
          <div>
            <Label>Past months (last service)</Label>
            <Input
              type="number"
              min={1}
              value={pastMonths}
              onChange={(e) => setPastMonths(e.target.value)}
              placeholder="6"
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
              {seasonStart ? (
                <span className="text-[var(--qc-muted)]">
                  (since {new Date(seasonStart).toLocaleDateString()})
                </span>
              ) : null}
            </label>
          </div>
          <div>
            <Label>Client type</Label>
            <select
              className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2 text-sm"
              value={clientType}
              onChange={(e) =>
                setClientType(e.target.value as "all" | "residential" | "commercial")
              }
            >
              <option value="all">All</option>
              <option value="residential">Residential only</option>
              <option value="commercial">Commercial only</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => load()} variant="secondary">
            Apply filters
          </Button>
          <Button type="button" variant="secondary" onClick={() => toggleAll(true)}>
            Select all on page
          </Button>
          <Button type="button" variant="secondary" onClick={() => toggleAll(false)}>
            Clear selection
          </Button>
          <Button type="button" disabled={!selectedIds.length} onClick={sendToCampaign}>
            SMS campaign ({selectedIds.length})
          </Button>
          <span className="text-sm text-[var(--qc-muted)]">{total} clients</span>
        </div>
      </Card>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-[var(--qc-muted)]">Loading…</p>
        ) : clients.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--qc-muted)]">
              No clients match these filters. Sync Jobber or widen the filters.
            </p>
          </Card>
        ) : (
          clients.map((c) => (
            <Card key={c.id} className="!py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--qc-accent)]"
                    disabled={!c.phone}
                    checked={Boolean(selected[c.id])}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))
                    }
                    title={c.phone ? "Select for SMS" : "No phone on file"}
                  />
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-sm text-[var(--qc-muted)]">
                      {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.isCommercial ? (
                        <Badge tone="warn">Commercial</Badge>
                      ) : (
                        <Badge>Residential</Badge>
                      )}
                      {c.skipReviewSms ? (
                        <Badge tone="warn">Review SMS off</Badge>
                      ) : null}
                      {c.hasUpcoming ? (
                        <Badge tone="warn">Upcoming job</Badge>
                      ) : (
                        <Badge tone="ok">No upcoming</Badge>
                      )}
                      {c.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--qc-accent)]"
                        checked={Boolean(c.skipReviewSms)}
                        disabled={togglingId === c.id}
                        onChange={(e) => void toggleSkipReview(c.id, e.target.checked)}
                      />
                      Skip review SMS (bad client / do not ask for review)
                    </label>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-[var(--qc-muted)]">Last service</div>
                  <div>
                    {c.lastServiceAt ? new Date(c.lastServiceAt).toLocaleDateString() : "—"}
                  </div>
                  {c.jobberWebUri ? (
                    <a
                      href={c.jobberWebUri}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[var(--qc-accent)]"
                    >
                      Open in Jobber
                    </a>
                  ) : null}
                </div>
              </div>
              {c.jobs?.length ? (
                <div className="mt-3 border-t border-[var(--qc-line)] pt-3 text-sm">
                  {c.jobs.map((j) => (
                    <div key={j.id} className="flex justify-between gap-2 text-[var(--qc-muted)]">
                      <span>{j.title || "Job"}</span>
                      <span>
                        {j.status || "—"}
                        {j.scheduledAt
                          ? ` · ${new Date(j.scheduledAt).toLocaleDateString()}`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
