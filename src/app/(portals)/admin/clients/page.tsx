"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, H1, Input, Label, Muted } from "@/components/ui";

type Client = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  isCommercial: boolean;
  lastServiceAt?: string | null;
  tags: string[];
  jobberWebUri?: string | null;
  jobs: Array<{ id: string; title?: string | null; status?: string | null }>;
};

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [commercialOnly, setCommercialOnly] = useState(false);
  const [pastMonths, setPastMonths] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (commercialOnly) params.set("commercialOnly", "true");
    if (pastMonths) params.set("pastMonths", pastMonths);
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
  }, [search, commercialOnly, pastMonths]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <H1>Jobber clients</H1>
        <Muted>Synced client cache with job status. Use Sync on the overview to refresh.</Muted>
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Search</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email" />
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
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" onClick={() => load()} variant="secondary">
            Apply filters
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
              No clients in cache yet. Run Sync Jobber from the overview (requires JOBBER_ACCESS_TOKEN).
            </p>
          </Card>
        ) : (
          clients.map((c) => (
            <Card key={c.id} className="!py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-[var(--qc-muted)]">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.isCommercial ? <Badge tone="warn">Commercial</Badge> : <Badge>Residential</Badge>}
                    {c.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
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
                      <span>{j.status || "—"}</span>
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
