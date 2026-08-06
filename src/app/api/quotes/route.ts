import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { computeWindowQuote } from "@/lib/sales/pricing";
import { SALES_SERVICES } from "@/lib/sales/services";

const quoteSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  panes: z.number().int().min(1).max(300),
  floors: z.number().int().min(1).max(6),
  panesAbove: z.number().int().min(0).max(300),
  method: z.number().positive(),
  sides: z.number().positive(),
  discountType: z.enum(["none", "plan", "special"]),
  discountAmount: z.number().min(0),
  gutterAmount: z.number().min(0).default(0),
  spiderAmount: z.number().min(0).default(0),
  servicePlanAmount: z.number().min(0).default(0),
  pushToJobber: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await requireRole(Role.ADMIN, Role.SALES);
    const quotes = await prisma.salesQuote.findMany({
      where: user.role === Role.SALES ? { createdById: user.id } : undefined,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    });

    const rates =
      user.role === Role.ADMIN
        ? await prisma.salesCommissionRate.findMany()
        : await prisma.salesCommissionRate.findMany({
            where: { userId: user.id },
          });

    return Response.json({ quotes, rates, services: SALES_SERVICES });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(Role.SALES, Role.ADMIN);
    const parsed = quoteSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const d = parsed.data;
    const window = computeWindowQuote({
      panes: d.panes,
      floors: d.floors,
      panesAbove: d.panesAbove,
      method: d.method,
      sides: d.sides,
      discountType: d.discountType,
      discountAmount: d.discountAmount,
    });

    const gutterAmount = d.gutterAmount || 0;
    const spiderAmount = d.spiderAmount || 0;
    const servicePlanAmount = d.servicePlanAmount || 0;

    const totalAmount =
      (window.isCustomEstimate ? 0 : window.windowAmount) +
      gutterAmount +
      spiderAmount +
      servicePlanAmount;

    const pushToJobber = Boolean(d.pushToJobber);
    let status: "NEW" | "PUSHED" = "NEW";
    let jobberId: string | null = null;
    if (pushToJobber) {
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
        name: d.name,
        phone: d.phone || null,
        email: d.email || null,
        address: d.address || null,
        notes: d.notes || null,
        source: "sales-quote",
        pushToJobber,
        status,
        jobberId,
        createdById: user.id,
      },
    });

    const quote = await prisma.salesQuote.create({
      data: {
        leadId: lead.id,
        createdById: user.id,
        name: d.name,
        phone: d.phone || null,
        email: d.email || null,
        address: d.address || null,
        notes: d.notes || null,
        panes: d.panes,
        floors: d.floors,
        panesAbove: d.panesAbove,
        method: d.method,
        sides: d.sides,
        discountType: d.discountType,
        discountAmount: d.discountAmount,
        isCustomEstimate: window.isCustomEstimate,
        windowAmount: window.windowAmount,
        gutterAmount,
        spiderAmount,
        servicePlanAmount,
        totalAmount,
        calculatorJson: JSON.stringify({
          window,
          addOns: { gutterAmount, spiderAmount, servicePlanAmount },
          discountType: d.discountType,
        }),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, status: true } },
      },
    });

    return Response.json({ quote, lead }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
