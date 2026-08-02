import { Role, TimeLogStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(Role.TECH, Role.ADMIN);
    const { id } = await ctx.params;
    const body = (await req.json()) as { checked?: boolean };

    const item = await prisma.checklistItem.findUnique({
      where: { id },
      include: { timeLog: true },
    });
    if (!item) throw new AppError("Checklist item not found", 404);
    if (item.timeLog.userId !== user.id && user.role !== Role.ADMIN) {
      throw new AppError("Forbidden", 403);
    }
    if (item.timeLog.status !== TimeLogStatus.OPEN) {
      throw new AppError("Shift already closed", 409, "SHIFT_CLOSED");
    }

    const checked = Boolean(body.checked);
    const updated = await prisma.checklistItem.update({
      where: { id },
      data: {
        checked,
        checkedAt: checked ? new Date() : null,
      },
    });

    const checklist = await prisma.checklistItem.findMany({
      where: { timeLogId: item.timeLogId },
      orderBy: { sortOrder: "asc" },
    });

    return Response.json({ item: updated, checklist });
  } catch (err) {
    return jsonError(err);
  }
}
