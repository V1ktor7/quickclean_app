import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";

const leadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  pushToJobber: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await requireRole(Role.ADMIN, Role.SALES);
    const leads = await prisma.lead.findMany({
      where: user.role === Role.SALES ? { createdById: user.id } : undefined,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({ leads });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(Role.SALES, Role.ADMIN);
    const parsed = leadSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const pushToJobber = Boolean(parsed.data.pushToJobber);
    let jobberId: string | null = null;
    let status: "NEW" | "PUSHED" = "NEW";

    if (pushToJobber) {
      // Soft push flag for Admin/Jobber follow-up; full clientCreate can be wired when scopes allow
      try {
        const { getValidAccessToken } = await import("@/lib/jobber/oauth");
        await getValidAccessToken();
        status = "PUSHED";
        jobberId = `pending-${Date.now()}`;
      } catch {
        status = "NEW";
      }
    }

    const lead = await prisma.lead.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
        source: parsed.data.source || "sales-portal",
        pushToJobber,
        status,
        jobberId,
        createdById: user.id,
      },
    });

    return Response.json({ lead }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
