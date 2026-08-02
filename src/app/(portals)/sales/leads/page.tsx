"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, H1, Input, Label, Muted, Textarea } from "@/components/ui";

type Lead = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status: string;
  pushToJobber: boolean;
  createdAt: string;
};

export default function SalesLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    pushToJobber: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/leads");
    const data = await res.json();
    if (res.ok) setLeads(data.leads || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Failed to save lead");
      return;
    }
    setOk("Lead saved and visible to Admin.");
    setForm({ name: "", phone: "", email: "", address: "", notes: "", pushToJobber: true });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Lead intake</H1>
        <Muted>Capture leads quickly — they flow to Admin (and Jobber when connected).</Muted>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.pushToJobber}
              onChange={(e) => setForm((f) => ({ ...f, pushToJobber: e.target.checked }))}
              className="size-4 accent-[var(--qc-accent)]"
            />
            Push to Jobber when API token is configured
          </label>
          {error ? (
            <div className="md:col-span-2">
              <Alert tone="bad">{error}</Alert>
            </div>
          ) : null}
          {ok ? (
            <div className="md:col-span-2">
              <Alert tone="ok">{ok}</Alert>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save lead"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold">
          Recent leads
        </h2>
        <div className="space-y-2">
          {leads.length === 0 ? (
            <p className="text-sm text-[var(--qc-muted)]">No leads yet.</p>
          ) : (
            leads.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[var(--qc-bg)] px-3 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold">{lead.name}</div>
                  <div className="text-[var(--qc-muted)]">
                    {[lead.phone, lead.email, lead.address].filter(Boolean).join(" · ")}
                  </div>
                  {lead.notes ? <div className="mt-1">{lead.notes}</div> : null}
                </div>
                <Badge tone={lead.status === "PUSHED" ? "ok" : "neutral"}>{lead.status}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
