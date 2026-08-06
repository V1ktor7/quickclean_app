import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import {
  buildClientWhere,
  parseFilter,
  resolveSeasonStart,
  startOfToday,
  UPCOMING_JOB_STATUSES,
} from "@/lib/campaigns";

function isUpcomingJob(job: {
  completedAt: Date | null;
  scheduledAt: Date | null;
  status: string | null;
}): boolean {
  if (job.completedAt) return false;
  const today = startOfToday();
  if (job.scheduledAt && job.scheduledAt >= today) return true;
  const status = (job.status || "").toLowerCase();
  return UPCOMING_JOB_STATUSES.includes(status);
}

export async function GET(req: Request) {
  try {
    await requireRole(Role.ADMIN);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));
    const filter = parseFilter({
      pastMonths: url.searchParams.get("pastMonths"),
      commercialOnly: url.searchParams.get("commercialOnly") === "true",
      residentialOnly: url.searchParams.get("residentialOnly") === "true",
      clientType: url.searchParams.get("clientType") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      servedThisSeason: url.searchParams.get("servedThisSeason") === "true",
      seasonStart: url.searchParams.get("seasonStart") ?? undefined,
      upcomingJobs: url.searchParams.get("upcomingJobs") ?? undefined,
    });

    const where = buildClientWhere(filter, {
      requirePhone: url.searchParams.get("requirePhone") === "true",
    });

    const [total, clients] = await Promise.all([
      prisma.jobberClient.count({ where }),
      prisma.jobberClient.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          jobs: {
            orderBy: [{ scheduledAt: "asc" }, { completedAt: "desc" }],
            take: 8,
          },
        },
      }),
    ]);

    return Response.json({
      clients: clients.map((c) => {
        const upcoming = c.jobs.filter(isUpcomingJob);
        return {
          ...c,
          tags: JSON.parse(c.tags || "[]") as string[],
          upcomingJobs: upcoming,
          hasUpcoming: upcoming.length > 0,
        };
      }),
      page,
      pageSize,
      total,
      seasonStart: resolveSeasonStart(filter).toISOString(),
    });
  } catch (err) {
    return jsonError(err);
  }
}
