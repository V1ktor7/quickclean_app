import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";

const createSchema = z.object({
  ruleId: z.string().optional().nullable(),
  description: z.string().min(1),
  amount: z.number().optional().nullable(),
  jobberJobId: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");

    if (kind === "rules") {
      const rules = await prisma.upsellRule.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      });
      return Response.json({ rules });
    }

    if (user.role === Role.ADMIN) {
      const logs = await prisma.upsellLog.findMany({
        include: {
          tech: { select: { id: true, name: true, email: true } },
          rule: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return Response.json({ logs });
    }

    await requireRole(Role.TECH, Role.ADMIN);
    const logs = await prisma.upsellLog.findMany({
      where: { techId: user.id },
      include: { rule: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return Response.json({ logs });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(Role.TECH, Role.ADMIN);
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const log = await prisma.upsellLog.create({
      data: {
        techId: user.id,
        ruleId: parsed.data.ruleId || null,
        description: parsed.data.description,
        amount: parsed.data.amount ?? null,
        jobberJobId: parsed.data.jobberJobId || null,
      },
      include: {
        rule: true,
        tech: { select: { name: true } },
      },
    });

    return Response.json({ log }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
