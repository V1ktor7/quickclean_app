import { prisma } from "@/lib/db";
import { Badge, Card, H1, Muted } from "@/components/ui";
import { estimateQuoteCommission } from "@/lib/sales/commission";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const [leads, quotes, rates] = await Promise.all([
    prisma.lead.findMany({
      include: {
        createdBy: { select: { name: true, email: true } },
        quotes: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.salesQuote.findMany({
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.salesCommissionRate.findMany(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <H1>Leads & quotes</H1>
        <Muted>
          Every saved sales quote shows the salesman tag, full calculator breakdown, and estimated
          commission from your per-service rates.
        </Muted>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">Quotes ({quotes.length})</h2>
        {quotes.length === 0 ? (
          <p className="text-sm text-[var(--qc-muted)]">
            No quotes yet. Sales → New quote to create one.
          </p>
        ) : (
          <div className="space-y-3">
            {quotes.map((q) => {
              let breakdown: { window?: { rows?: Array<{ label: string; value: string }>; summary?: string } } =
                {};
              try {
                breakdown = JSON.parse(q.calculatorJson || "{}") as typeof breakdown;
              } catch {
                /* ignore */
              }
              const comm = estimateQuoteCommission(q, rates);
              return (
                <div
                  key={q.id}
                  className="space-y-2 rounded-xl border border-[var(--qc-line)] bg-[var(--qc-bg)] px-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{q.name}</div>
                      <div className="text-[var(--qc-muted)]">
                        {[q.phone, q.email, q.address].filter(Boolean).join(" · ") ||
                          "No contact details"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="ok">{q.createdBy.name}</Badge>
                      {q.lead?.status ? <Badge>{q.lead.status}</Badge> : null}
                      {q.isCustomEstimate ? <Badge tone="warn">On-site</Badge> : null}
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg bg-white/70 px-3 py-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--qc-muted)]">
                        Calculator
                      </div>
                      <div className="mt-1 text-[var(--qc-muted)]">
                        {q.panes} panes · {q.floors >= 6 ? "6+" : q.floors} floors ·{" "}
                        {q.method === 1.5 ? "manual" : "pole"} ·{" "}
                        {q.sides === 1.8 ? "inside+out" : "exterior"}
                        {q.discountType !== "none"
                          ? ` · ${q.discountType}${q.discountAmount ? ` −$${q.discountAmount}` : ""}`
                          : ""}
                      </div>
                      {breakdown.window?.summary ? (
                        <div className="mt-1">{breakdown.window.summary}</div>
                      ) : null}
                      <div className="mt-2 space-y-0.5">
                        {(breakdown.window?.rows || []).map((r) => (
                          <div key={r.label} className="flex justify-between gap-2 text-xs">
                            <span className="text-[var(--qc-muted)]">{r.label}</span>
                            <span>{r.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/70 px-3 py-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--qc-muted)]">
                        Amounts
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-[var(--qc-muted)]">Windows</span>
                          <span>
                            {q.isCustomEstimate ? "Custom" : `$${q.windowAmount.toFixed(0)}`}
                          </span>
                        </div>
                        {q.gutterAmount > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-[var(--qc-muted)]">Gutters</span>
                            <span>${q.gutterAmount.toFixed(0)}</span>
                          </div>
                        ) : null}
                        {q.spiderAmount > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-[var(--qc-muted)]">Spider</span>
                            <span>${q.spiderAmount.toFixed(0)}</span>
                          </div>
                        ) : null}
                        {q.servicePlanAmount > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-[var(--qc-muted)]">Service plan</span>
                            <span>${q.servicePlanAmount.toFixed(0)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>${q.totalAmount.toFixed(0)}</span>
                        </div>
                      </div>
                      <div className="mt-2 border-t border-[var(--qc-line)] pt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--qc-muted)]">
                          Est. commission ({q.createdBy.name})
                        </div>
                        {comm.lines.length === 0 ? (
                          <div className="text-xs text-[var(--qc-muted)]">
                            Set rates under Commissions
                          </div>
                        ) : (
                          comm.lines.map((l) => (
                            <div key={l.key + l.label} className="flex justify-between text-xs">
                              <span className="text-[var(--qc-muted)]">
                                {l.label} @ {l.percent}%
                              </span>
                              <span>${l.commission.toFixed(2)}</span>
                            </div>
                          ))
                        )}
                        <div className="mt-1 flex justify-between text-sm font-semibold">
                          <span>Commission total</span>
                          <span>${comm.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {q.notes ? <div className="text-[var(--qc-muted)]">Notes: {q.notes}</div> : null}
                  <div className="text-xs text-[var(--qc-muted)]">
                    {new Date(q.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Simple leads (no calculator)</h2>
        {leads.filter((l) => l.quotes.length === 0).length === 0 ? (
          <p className="text-sm text-[var(--qc-muted)]">No plain leads without a quote.</p>
        ) : (
          leads
            .filter((l) => l.quotes.length === 0)
            .map((lead) => (
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
                  <div className="mt-1 text-xs text-[var(--qc-muted)]">
                    {new Date(lead.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone="ok">{lead.createdBy.name}</Badge>
                  <Badge tone={lead.status === "PUSHED" ? "ok" : "neutral"}>{lead.status}</Badge>
                </div>
              </div>
            ))
        )}
      </Card>
    </div>
  );
}
