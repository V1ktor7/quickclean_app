import { Role, TimeLogStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError, AppError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  try {
    const user = await requireRole(Role.TECH, Role.ADMIN);
    const open = await prisma.timeLog.findFirst({
      where: { userId: user.id, status: TimeLogStatus.OPEN },
      include: { checklist: { orderBy: { sortOrder: "asc" } } },
      orderBy: { punchedInAt: "desc" },
    });
    const recent = await prisma.timeLog.findMany({
      where: { userId: user.id },
      orderBy: { punchedInAt: "desc" },
      take: 10,
    });
    return Response.json({ open, recent });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(Role.TECH, Role.ADMIN);
    const body = (await req.json().catch(() => ({}))) as { action?: string };

    if (body.action === "punch-in") {
      const existing = await prisma.timeLog.findFirst({
        where: { userId: user.id, status: TimeLogStatus.OPEN },
      });
      if (existing) {
        throw new AppError("Already punched in", 409, "ALREADY_OPEN");
      }

      const templates = await prisma.checklistTemplate.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      });

      const log = await prisma.timeLog.create({
        data: {
          userId: user.id,
          status: TimeLogStatus.OPEN,
          checklist: {
            create: templates.map((t) => ({
              label: t.label,
              sortOrder: t.sortOrder,
            })),
          },
        },
        include: { checklist: { orderBy: { sortOrder: "asc" } } },
      });

      return Response.json({ log }, { status: 201 });
    }

    if (body.action === "punch-out") {
      const open = await prisma.timeLog.findFirst({
        where: { userId: user.id, status: TimeLogStatus.OPEN },
        include: { checklist: true },
      });
      if (!open) {
        throw new AppError("No open time log", 404, "NO_OPEN_LOG");
      }

      const incomplete = open.checklist.filter((i) => !i.checked);
      if (incomplete.length > 0) {
        throw new AppError(
          `Equipment manifest incomplete (${incomplete.length} remaining)`,
          409,
          "CHECKLIST_INCOMPLETE",
        );
      }

      const log = await prisma.timeLog.update({
        where: { id: open.id },
        data: {
          status: TimeLogStatus.CLOSED,
          punchedOutAt: new Date(),
        },
        include: { checklist: { orderBy: { sortOrder: "asc" } } },
      });

      return Response.json({ log });
    }

    throw new AppError("Invalid action", 400, "BAD_ACTION");
  } catch (err) {
    return jsonError(err);
  }
}
