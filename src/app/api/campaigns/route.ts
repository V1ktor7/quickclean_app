import { CampaignStatus, Role, SMSKind } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { parseFilter, previewCampaignRecipients } from "@/lib/campaigns";
import { sendQuoMessage } from "@/lib/quo/client";

const createSchema = z.object({
  name: z.string().min(1),
  messageBody: z.string().min(1).max(1600),
  filter: z
    .object({
      pastMonths: z.number().nullable().optional(),
      commercialOnly: z.boolean().optional(),
      search: z.string().optional(),
    })
    .optional(),
  previewOnly: z.boolean().optional(),
  send: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireRole(Role.ADMIN);
    const campaigns = await prisma.sMSCampaign.findMany({
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return Response.json({ campaigns });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(Role.ADMIN);
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const filter = parseFilter(parsed.data.filter ?? {});
    const recipients = await previewCampaignRecipients(filter);

    if (parsed.data.previewOnly) {
      return Response.json({
        count: recipients.length,
        sample: recipients.slice(0, 10),
      });
    }

    const campaign = await prisma.sMSCampaign.create({
      data: {
        name: parsed.data.name,
        messageBody: parsed.data.messageBody,
        filterJson: JSON.stringify(filter),
        createdById: user.id,
        status: parsed.data.send ? CampaignStatus.SENDING : CampaignStatus.DRAFT,
        totalCount: recipients.length,
      },
    });

    if (!parsed.data.send) {
      return Response.json({ campaign, count: recipients.length }, { status: 201 });
    }

    let sent = 0;
    let failed = 0;

    // Send one-by-one for accurate per-recipient tracking (Quo also supports batches)
    for (const r of recipients) {
      if (!r.phone) continue;
      try {
        const result = await sendQuoMessage({
          to: r.phone,
          content: parsed.data.messageBody,
          kind: SMSKind.MARKETING,
          campaignId: campaign.id,
          clientName: r.name,
        });
        if (result.messages[0]?.status === "SENT") sent += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }

    const updated = await prisma.sMSCampaign.update({
      where: { id: campaign.id },
      data: {
        sentCount: sent,
        failedCount: failed,
        status: failed && !sent ? CampaignStatus.FAILED : CampaignStatus.COMPLETED,
      },
    });

    return Response.json({ campaign: updated }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Campaign failed");
  }
}
