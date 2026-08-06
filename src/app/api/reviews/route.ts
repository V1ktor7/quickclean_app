import { Role, SMSKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  try {
    await requireRole(Role.ADMIN);

    const reviewLink =
      process.env.REVIEW_LINK_URL ?? "https://g.page/r/CQzw419aCqLaEAE/review";

    const [mutedClients, recentReviews, recentCompletes] = await Promise.all([
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
      prisma.sMSMessage.findMany({
        where: { kind: SMSKind.REVIEW },
        orderBy: { createdAt: "desc" },
        take: 30,
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
      reviewLink,
      mutedClients,
      recentReviews,
      recentCompletes: recentCompletes.map((e) => {
        let reason: string | null = null;
        try {
          const p = JSON.parse(e.payload || "{}") as { reason?: string; skipped?: boolean };
          if (p.reason) reason = p.reason;
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
