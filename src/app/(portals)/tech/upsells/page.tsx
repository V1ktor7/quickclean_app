"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, H1, Input, Label, Muted, Textarea } from "@/components/ui";

type Rule = {
  id: string;
  title: string;
  description: string;
  tip?: string | null;
};

type Log = {
  id: string;
  description: string;
  amount?: number | null;
  createdAt: string;
  rule?: { title: string } | null;
};

export default function TechUpsellsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [ruleId, setRuleId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, l] = await Promise.all([
      fetch("/api/upsells?kind=rules").then((x) => x.json()),
      fetch("/api/upsells").then((x) => x.json()),
    ]);
    setRules(r.rules || []);
    setLogs(l.logs || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/upsells", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: ruleId || null,
        description,
        amount: amount ? Number(amount) : null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Failed to log upsell");
      return;
    }
    setOk("Upsell logged — Admin commission feed updated.");
    setDescription("");
    setAmount("");
    setRuleId("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Upsell engine</H1>
        <Muted>Standardized rules and visual cues for in-field sales. Logs ping Admin for commissions.</Muted>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                {rule.title}
              </h2>
              <Badge>Rule</Badge>
            </div>
            <p className="mt-2 text-sm">{rule.description}</p>
            {rule.tip ? (
              <p className="mt-3 rounded-lg bg-[var(--qc-bg)] px-3 py-2 text-sm text-[var(--qc-deep)]">
                Tip: {rule.tip}
              </p>
            ) : null}
            <Button
              className="mt-4"
              variant="secondary"
              type="button"
              onClick={() => {
                setRuleId(rule.id);
                setDescription(rule.title);
              }}
            >
              Use this rule
            </Button>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg font-semibold">
          Log an upsell
        </h2>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did the customer add?"
            />
          </div>
          <div>
            <Label>Amount (optional)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="75"
            />
          </div>
          <div>
            <Label>Linked rule</Label>
            <select
              className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2.5 text-sm"
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
            >
              <option value="">Custom / none</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
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
              {busy ? "Saving…" : "Log upsell"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold">
          Your recent upsells
        </h2>
        <div className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-[var(--qc-muted)]">None yet.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--qc-bg)] px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{log.description}</div>
                  <div className="text-[var(--qc-muted)]">
                    {log.rule?.title ? `${log.rule.title} · ` : ""}
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
                {typeof log.amount === "number" ? (
                  <Badge tone="ok">${log.amount.toFixed(2)}</Badge>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
