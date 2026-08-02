"use client";

import { useEffect, useState } from "react";
import { Badge, Card, H1, Muted } from "@/components/ui";

type Log = {
  id: string;
  description: string;
  amount?: number | null;
  createdAt: string;
  tech: { name: string; email: string };
  rule?: { title: string } | null;
};

export default function AdminCommissionsPage() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/upsells");
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    };
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, []);

  const total = logs.reduce((sum, l) => sum + (l.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <H1>Commission tracking</H1>
        <Muted>Upsells logged by techs. Auto-refreshes every 15s.</Muted>
      </div>

      <Card>
        <div className="text-xs font-semibold tracking-wide text-[var(--qc-muted)] uppercase">
          Tracked upsell value (loaded)
        </div>
        <div className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
          ${total.toFixed(2)}
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
    </div>
  );
}
