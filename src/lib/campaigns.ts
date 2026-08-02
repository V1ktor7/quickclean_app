import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ClientFilter = {
  pastMonths?: number | null;
  commercialOnly?: boolean;
  search?: string;
};

export function parseFilter(raw: unknown): ClientFilter {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    pastMonths:
      typeof o.pastMonths === "number"
        ? o.pastMonths
        : o.pastMonths
          ? Number(o.pastMonths)
          : null,
    commercialOnly: Boolean(o.commercialOnly),
    search: typeof o.search === "string" ? o.search : undefined,
  };
}

export function buildClientWhere(
  filter: ClientFilter,
  opts?: { requirePhone?: boolean },
): Prisma.JobberClientWhereInput {
  const where: Prisma.JobberClientWhereInput = {
    isArchived: false,
  };

  if (opts?.requirePhone !== false) {
    where.phone = { not: null };
  }

  if (filter.commercialOnly) {
    where.isCommercial = true;
  }

  if (filter.pastMonths && filter.pastMonths > 0) {
    const since = new Date();
    since.setMonth(since.getMonth() - filter.pastMonths);
    where.lastServiceAt = { gte: since };
  }

  if (filter.search?.trim()) {
    where.OR = [
      { name: { contains: filter.search.trim() } },
      { email: { contains: filter.search.trim() } },
      { phone: { contains: filter.search.trim() } },
    ];
  }

  return where;
}

export async function previewCampaignRecipients(filter: ClientFilter) {
  const where = buildClientWhere(filter);
  const clients = await prisma.jobberClient.findMany({
    where,
    select: { id: true, name: true, phone: true, isCommercial: true, lastServiceAt: true },
    orderBy: { name: "asc" },
  });
  return clients.filter((c) => Boolean(c.phone));
}
