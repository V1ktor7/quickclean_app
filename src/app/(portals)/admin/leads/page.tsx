import { prisma } from "@/lib/db";
import { Badge, Card, H1, Muted } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const leads = await prisma.lead.findMany({
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <H1>Incoming leads</H1>
        <Muted>Leads captured from the Sales portal.</Muted>
      </div>
      <Card>
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
                  <div className="mt-1 text-xs text-[var(--qc-muted)]">
                    by {lead.createdBy.name} · {new Date(lead.createdAt).toLocaleString()}
                  </div>
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
