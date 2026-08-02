import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { buildClientWhere, parseFilter } from "@/lib/campaigns";

export async function GET(req: Request) {
  try {
    await requireRole(Role.ADMIN);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));
    const filter = parseFilter({
      pastMonths: url.searchParams.get("pastMonths"),
      commercialOnly: url.searchParams.get("commercialOnly") === "true",
      search: url.searchParams.get("search") ?? undefined,
    });

    const where = buildClientWhere(filter, {
      requirePhone: url.searchParams.get("requirePhone") === "true",
    });

    const [total, clients, jobs] = await Promise.all([
      prisma.jobberClient.count({ where }),
      prisma.jobberClient.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          jobs: {
            orderBy: { completedAt: "desc" },
            take: 3,
          },
        },
      }),
      prisma.jobberJob.count(),
    ]);

    return Response.json({
      clients: clients.map((c) => ({
        ...c,
        tags: JSON.parse(c.tags || "[]") as string[],
      })),
      page,
      pageSize,
      total,
      jobCount: jobs,
    });
  } catch (err) {
    return jsonError(err);
  }
}
