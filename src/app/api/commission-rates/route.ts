import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { isSalesServiceKey, SALES_SERVICES } from "@/lib/sales/services";

const putSchema = z.object({
  rates: z.array(
    z.object({
      userId: z.string().min(1),
      serviceKey: z.string().min(1),
      percent: z.number().min(0).max(100),
    }),
  ),
});

export async function GET() {
  try {
    await requireRole(Role.ADMIN);
    const [salespeople, rates] = await Promise.all([
      prisma.user.findMany({
        where: { role: Role.SALES, active: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.salesCommissionRate.findMany(),
    ]);
    return Response.json({ salespeople, rates, services: SALES_SERVICES });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(req: Request) {
  try {
    await requireRole(Role.ADMIN);
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    for (const row of parsed.data.rates) {
      if (!isSalesServiceKey(row.serviceKey)) {
        throw new AppError(`Unknown service: ${row.serviceKey}`, 400);
      }
      await prisma.salesCommissionRate.upsert({
        where: {
          userId_serviceKey: {
            userId: row.userId,
            serviceKey: row.serviceKey,
          },
        },
        create: {
          userId: row.userId,
          serviceKey: row.serviceKey,
          percent: row.percent,
        },
        update: { percent: row.percent },
      });
    }

    const rates = await prisma.salesCommissionRate.findMany();
    return Response.json({ rates });
  } catch (err) {
    return jsonError(err);
  }
}
