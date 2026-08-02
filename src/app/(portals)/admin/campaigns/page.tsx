"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [pastMonths, setPastMonths] = useState("6");
  const [commercialOnly, setCommercialOnly] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    if (res.ok) setCampaigns(data.campaigns || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function filterPayload() {
    return {
      pastMonths: pastMonths ? Number(pastMonths) : null,
      commercialOnly,
    };
  }

  async function preview() {
    setBusy(true);
    setError(null);
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
    setPreviewCount(data.count);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
        <Muted>Filter synced clients and broadcast via Quo. Requires QUO_API_KEY and QUO_FROM_NUMBER.</Muted>
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
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Past N months (last service)</Label>
              <Input
                type="number"
                min={1}
                value={pastMonths}
                onChange={(e) => setPastMonths(e.target.value)}
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
            <div className="flex items-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={preview}>
                Preview count
              </Button>
              {previewCount !== null ? (
                <span className="pb-2 text-sm text-[var(--qc-muted)]">{previewCount} recipients</span>
              ) : null}
            </div>
          </div>
          {error ? <Alert tone="bad">{error}</Alert> : null}
          {ok ? <Alert tone="ok">{ok}</Alert> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send campaign"}
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
