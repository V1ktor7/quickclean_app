import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Jobber job statuses that mean work is still open / scheduled (not done). */
export const UPCOMING_JOB_STATUSES = [
  "upcoming",
  "today",
  "active",
  "late",
  "unscheduled",
  "action_required",
  "on_hold",
  "requires_invoicing",
  "scheduled",
];

export type UpcomingJobsFilter = "any" | "has" | "none";

export type ClientFilter = {
  pastMonths?: number | null;
  commercialOnly?: boolean;
  search?: string;
  /** Clients with a completed job / lastServiceAt since season start */
  servedThisSeason?: boolean;
  /** Season start ISO date; default = March 1 of current window-cleaning season */
  seasonStart?: string | null;
  /** Filter by whether they have upcoming (not completed) jobs */
  upcomingJobs?: UpcomingJobsFilter;
};

export function defaultSeasonStart(now = new Date()): Date {
  // Season runs Mar 1 → Feb 28/29. Before March, use previous year's March 1.
  const year = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 2, 1, 0, 0, 0, 0);
}

export function resolveSeasonStart(filter: ClientFilter): Date {
  if (filter.seasonStart) {
    const d = new Date(filter.seasonStart);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return defaultSeasonStart();
}

export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export function parseFilter(raw: unknown): ClientFilter {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const upcomingRaw = o.upcomingJobs;
  const upcomingJobs: UpcomingJobsFilter | undefined =
    upcomingRaw === "has" || upcomingRaw === "none" || upcomingRaw === "any"
      ? upcomingRaw
      : undefined;

  return {
    pastMonths:
      typeof o.pastMonths === "number"
        ? o.pastMonths
        : o.pastMonths
          ? Number(o.pastMonths)
          : null,
    commercialOnly: Boolean(o.commercialOnly),
    search: typeof o.search === "string" ? o.search : undefined,
    servedThisSeason: Boolean(o.servedThisSeason),
    seasonStart: typeof o.seasonStart === "string" ? o.seasonStart : null,
    upcomingJobs,
  };
}

function upcomingJobsSome(now: Date = new Date()): Prisma.JobberJobWhereInput {
  const today = startOfToday(now);
  return {
    completedAt: null,
    OR: [
      { scheduledAt: { gte: today } },
      {
        status: {
          in: [
            ...UPCOMING_JOB_STATUSES,
            ...UPCOMING_JOB_STATUSES.map(
              (s) => s.charAt(0).toUpperCase() + s.slice(1),
            ),
            ...UPCOMING_JOB_STATUSES.map((s) => s.toUpperCase()),
          ],
        },
      },
    ],
  };
}

export function buildClientWhere(
  filter: ClientFilter,
  opts?: { requirePhone?: boolean },
): Prisma.JobberClientWhereInput {
  const where: Prisma.JobberClientWhereInput = {
    isArchived: false,
  };
  const and: Prisma.JobberClientWhereInput[] = [];

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

  if (filter.servedThisSeason) {
    const seasonStart = resolveSeasonStart(filter);
    and.push({
      OR: [
        { lastServiceAt: { gte: seasonStart } },
        { jobs: { some: { completedAt: { gte: seasonStart } } } },
      ],
    });
  }

  if (filter.upcomingJobs === "has") {
    and.push({ jobs: { some: upcomingJobsSome() } });
  } else if (filter.upcomingJobs === "none") {
    and.push({ jobs: { none: upcomingJobsSome() } });
  }

  if (filter.search?.trim()) {
    const q = filter.search.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    });
  }

  if (and.length) {
    where.AND = and;
  }

  return where;
}

export async function previewCampaignRecipients(filter: ClientFilter) {
  const where = buildClientWhere(filter);
  const clients = await prisma.jobberClient.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      isCommercial: true,
      lastServiceAt: true,
    },
    orderBy: { name: "asc" },
    take: 2000,
  });
  return clients.filter((c) => Boolean(c.phone));
}

export async function recipientsByIds(clientIds: string[]) {
  if (!clientIds.length) return [];
  const clients = await prisma.jobberClient.findMany({
    where: {
      id: { in: clientIds },
      isArchived: false,
      phone: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      isCommercial: true,
      lastServiceAt: true,
    },
    orderBy: { name: "asc" },
  });
  return clients.filter((c) => Boolean(c.phone));
}
