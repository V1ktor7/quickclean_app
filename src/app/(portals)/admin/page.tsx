import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { Card, H1, Muted, Badge } from "@/components/ui";
import { SyncButton } from "./sync-button";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const [clients, jobs, upsells, campaigns, openShifts, leads] = await Promise.all([
    prisma.jobberClient.count(),
    prisma.jobberJob.count(),
    prisma.upsellLog.count(),
    prisma.sMSCampaign.count(),
    prisma.timeLog.count({ where: { status: "OPEN" } }),
    prisma.lead.count({ where: { status: "NEW" } }),
  ]);

  const recentUpsells = await prisma.upsellLog.findMany({
    include: { tech: { select: { name: true } }, rule: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <H1>Admin dashboard</H1>
          <Muted>CRM sync, commissions, review automation, and team access.</Muted>
        </div>
        <Suspense fallback={<div className="text-sm text-[var(--qc-muted)]">Loading…</div>}>
          <SyncButton />
        </Suspense>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Synced clients", clients],
          ["Synced jobs", jobs],
          ["Open tech shifts", openShifts],
          ["Upsells logged", upsells],
          ["SMS campaigns", campaigns],
          ["New leads", leads],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <div className="text-xs font-semibold tracking-wide text-[var(--qc-muted)] uppercase">
              {label}
            </div>
            <div className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
              {value}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold">
          Latest upsell pings
        </h2>
        <div className="space-y-2">
          {recentUpsells.length === 0 ? (
            <p className="text-sm text-[var(--qc-muted)]">No upsells yet.</p>
          ) : (
            recentUpsells.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--qc-bg)] px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {u.tech.name}: {u.description}
                  </div>
                  <div className="text-[var(--qc-muted)]">
                    {u.rule?.title ? `${u.rule.title} · ` : ""}
                    {new Date(u.createdAt).toLocaleString()}
                  </div>
                </div>
                {typeof u.amount === "number" ? (
                  <Badge tone="ok">${u.amount.toFixed(2)}</Badge>
                ) : (
                  <Badge>Logged</Badge>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
