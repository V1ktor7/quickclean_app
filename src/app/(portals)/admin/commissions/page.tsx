"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, H1, Input, Label, Muted } from "@/components/ui";

type Log = {
  id: string;
  description: string;
  amount?: number | null;
  createdAt: string;
  tech: { name: string; email: string };
  rule?: { title: string } | null;
};

type Salesperson = { id: string; name: string; email: string };
type Service = { key: string; label: string };
type Rate = { userId: string; serviceKey: string; percent: number };

export default function AdminCommissionsPage() {
  const [tab, setTab] = useState<"sales" | "tech">("sales");
  const [logs, setLogs] = useState<Log[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTech = useCallback(async () => {
    const res = await fetch("/api/upsells");
    const data = await res.json();
    if (res.ok) setLogs(data.logs || []);
  }, []);

  const loadSales = useCallback(async () => {
    const res = await fetch("/api/commission-rates");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load commission rates");
      return;
    }
    setSalespeople(data.salespeople || []);
    setServices(data.services || []);
    const map: Record<string, number> = {};
    for (const r of (data.rates || []) as Rate[]) {
      map[`${r.userId}:${r.serviceKey}`] = r.percent;
    }
    setRates(map);
  }, []);

  useEffect(() => {
    void loadSales();
    void loadTech();
    const t = setInterval(() => void loadTech(), 15000);
    return () => clearInterval(t);
  }, [loadSales, loadTech]);

  const totalUpsells = useMemo(
    () => logs.reduce((sum, l) => sum + (l.amount || 0), 0),
    [logs],
  );

  function setRate(userId: string, serviceKey: string, percent: number) {
    setRates((prev) => ({ ...prev, [`${userId}:${serviceKey}`]: percent }));
  }

  async function saveRates() {
    setBusy(true);
    setError(null);
    setOk(null);
    const payload = {
      rates: salespeople.flatMap((sp) =>
        services.map((s) => ({
          userId: sp.id,
          serviceKey: s.key,
          percent: Number(rates[`${sp.id}:${s.key}`] ?? 0),
        })),
      ),
    };
    const res = await fetch("/api/commission-rates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save rates");
      return;
    }
    setOk("Commission rates saved.");
    await loadSales();
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Commissions</H1>
        <Muted>
          Set each salesman’s % per service (windows, gutters, spider, service plan). Tech upsell
          dollars stay on the second tab.
        </Muted>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "sales" ? "primary" : "secondary"}
          onClick={() => setTab("sales")}
        >
          Sales rates
        </Button>
        <Button
          type="button"
          variant={tab === "tech" ? "primary" : "secondary"}
          onClick={() => setTab("tech")}
        >
          Tech upsells
        </Button>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}
      {ok ? <Alert tone="ok">{ok}</Alert> : null}

      {tab === "sales" ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Per salesman · per service (%)</h2>
            <Button type="button" disabled={busy || !salespeople.length} onClick={() => void saveRates()}>
              {busy ? "Saving…" : "Save rates"}
            </Button>
          </div>
          {salespeople.length === 0 ? (
            <p className="text-sm text-[var(--qc-muted)]">
              No active sales users. Create one under Users with role Sales.
            </p>
          ) : (
            <div className="space-y-6 overflow-x-auto">
              {salespeople.map((sp) => (
                <div key={sp.id} className="rounded-xl border border-[var(--qc-line)] p-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone="ok">{sp.name}</Badge>
                    <span className="text-sm text-[var(--qc-muted)]">{sp.email}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {services.map((s) => (
                      <div key={s.key}>
                        <Label>{s.label}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={rates[`${sp.id}:${s.key}`] ?? 0}
                          onChange={(e) =>
                            setRate(sp.id, s.key, Number(e.target.value) || 0)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-[var(--qc-muted)]">
            Example: John at 10% windows, 7% gutters, 5% spider, 10% service plan. Bi-annual window
            quotes use the service-plan rate on the window total.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="text-xs font-semibold tracking-wide text-[var(--qc-muted)] uppercase">
              Tracked upsell value (loaded)
            </div>
            <div className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
              ${totalUpsells.toFixed(2)}
            </div>
          </Card>
          <Card>
            <div className="space-y-2">
              {logs.length === 0 ? (
                <p className="text-sm text-[var(--qc-muted)]">No upsells logged yet.</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--qc-bg)] px-3 py-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold">
                        {log.tech.name} — {log.description}
                      </div>
                      <div className="text-[var(--qc-muted)]">
                        {log.rule?.title ? `${log.rule.title} · ` : ""}
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {typeof log.amount === "number" ? (
                      <Badge tone="ok">${log.amount.toFixed(2)}</Badge>
                    ) : (
                      <Badge>No amount</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
