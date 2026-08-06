import { Role, SMSKind, SMSStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { approveReviewSms, denyReviewSms } from "@/lib/quo/client";
import { defaultReviewLink } from "@/lib/sms/templates";

const actionSchema = z.object({
  messageId: z.string().min(1),
  action: z.enum(["approve", "deny"]),
  contentOverride: z.string().min(1).max(1600).optional(),
});

export async function GET() {
  try {
    await requireRole(Role.ADMIN);

    const [pending, recentReviews, mutedClients, activeTemplate, recentCompletes] =
      await Promise.all([
        prisma.sMSMessage.findMany({
          where: { kind: SMSKind.REVIEW, status: SMSStatus.AWAITING_APPROVAL },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { template: { select: { id: true, name: true } } },
        }),
        prisma.sMSMessage.findMany({
          where: {
            kind: SMSKind.REVIEW,
            status: { in: [SMSStatus.SENT, SMSStatus.FAILED, SMSStatus.DENIED] },
          },
          orderBy: { createdAt: "desc" },
          take: 40,
        }),
        prisma.jobberClient.findMany({
          where: { skipReviewSms: true, isArchived: false },
          select: {
            id: true,
            name: true,
            phone: true,
            lastServiceAt: true,
            updatedAt: true,
          },
          orderBy: { name: "asc" },
          take: 200,
        }),
        prisma.sMSTemplate.findFirst({
          where: { kind: SMSKind.REVIEW, isActive: true },
        }),
        prisma.webhookEvent.findMany({
          where: { topic: "JOB_COMPLETE" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            itemId: true,
            processedAt: true,
            error: true,
            payload: true,
            createdAt: true,
          },
        }),
      ]);

    return Response.json({
      reviewLink: defaultReviewLink(),
      activeTemplate,
      pending,
      recentReviews,
      mutedClients,
      recentCompletes: recentCompletes.map((e) => {
        let reason: string | null = null;
        try {
          const p = JSON.parse(e.payload || "{}") as {
            reason?: string;
            skipped?: boolean;
            awaitingApproval?: boolean;
          };
          if (p.reason) reason = p.reason;
          else if (p.awaitingApproval) reason = "awaiting_approval";
          else if (p.skipped) reason = "skipped";
        } catch {
          /* ignore */
        }
        return {
          id: e.id,
          jobberJobId: e.itemId,
          processedAt: e.processedAt,
          error: e.error,
          reason: e.error ? "error" : reason,
          createdAt: e.createdAt,
        };
      }),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(Role.ADMIN);
    const parsed = actionSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    if (parsed.data.action === "deny") {
      const message = await denyReviewSms(parsed.data.messageId);
      return Response.json({ message });
    }

    const message = await approveReviewSms({
      messageId: parsed.data.messageId,
      contentOverride: parsed.data.contentOverride,
    });
    return Response.json({ message });
  } catch (err) {
    return jsonError(err);
  }
}
