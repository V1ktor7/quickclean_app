import { CampaignStatus, Role, SMSKind } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import {
  parseFilter,
  previewCampaignRecipients,
  recipientsByIds,
  resolveSeasonStart,
} from "@/lib/campaigns";
import { sendQuoMessage } from "@/lib/quo/client";
import {
  getActiveTemplate,
  renderTemplateBody,
  serializeLinks,
  setActiveTemplate,
  TEMPLATE_VARIABLE_HELP,
} from "@/lib/sms/templates";

const createSchema = z.object({
  name: z.string().min(1),
  messageBody: z.string().min(1).max(1600),
  templateId: z.string().optional().nullable(),
  saveAsTemplate: z
    .object({
      name: z.string().min(1).max(120),
      setActive: z.boolean().optional(),
      imageUrl: z.string().url().max(500).nullable().optional(),
      links: z
        .array(
          z.object({
            key: z.string().min(1),
            label: z.string().optional(),
            url: z.string().url(),
          }),
        )
        .optional(),
    })
    .optional(),
  filter: z
    .object({
      pastMonths: z.number().nullable().optional(),
      commercialOnly: z.boolean().optional(),
      residentialOnly: z.boolean().optional(),
      clientType: z.enum(["all", "residential", "commercial"]).optional(),
      search: z.string().optional(),
      servedThisSeason: z.boolean().optional(),
      seasonStart: z.string().nullable().optional(),
      upcomingJobs: z.enum(["any", "has", "none"]).optional(),
    })
    .optional(),
  clientIds: z.array(z.string().min(1)).max(2000).optional(),
  previewOnly: z.boolean().optional(),
  send: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireRole(Role.ADMIN);
    const [campaigns, templates, activeTemplate] = await Promise.all([
      prisma.sMSCampaign.findMany({
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.sMSTemplate.findMany({
        where: { kind: SMSKind.MARKETING },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      }),
      getActiveTemplate(SMSKind.MARKETING),
    ]);
    return Response.json({
      campaigns,
      templates,
      activeTemplate,
      variables: TEMPLATE_VARIABLE_HELP,
    });
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
    const recipients =
      parsed.data.clientIds && parsed.data.clientIds.length > 0
        ? await recipientsByIds(parsed.data.clientIds)
        : await previewCampaignRecipients(filter);

    if (parsed.data.previewOnly) {
      return Response.json({
        count: recipients.length,
        recipients,
        seasonStart: resolveSeasonStart(filter).toISOString(),
        sample: recipients.slice(0, 10),
      });
    }

    if (!recipients.length) {
      throw new AppError("No recipients match this filter / selection", 400);
    }

    let templateId = parsed.data.templateId ?? null;
    let templateMeta = templateId
      ? await prisma.sMSTemplate.findUnique({ where: { id: templateId } })
      : await getActiveTemplate(SMSKind.MARKETING);

    if (parsed.data.saveAsTemplate) {
      const created = await prisma.sMSTemplate.create({
        data: {
          name: parsed.data.saveAsTemplate.name,
          kind: SMSKind.MARKETING,
          body: parsed.data.messageBody,
          linksJson: serializeLinks(parsed.data.saveAsTemplate.links ?? []),
          imageUrl: parsed.data.saveAsTemplate.imageUrl ?? null,
          isActive: false,
        },
      });
      if (parsed.data.saveAsTemplate.setActive) {
        await setActiveTemplate(created.id);
      }
      templateId = created.id;
      templateMeta = created;
    }

    const campaign = await prisma.sMSCampaign.create({
      data: {
        name: parsed.data.name,
        messageBody: parsed.data.messageBody,
        templateId,
        filterJson: JSON.stringify({
          ...filter,
          clientIds: parsed.data.clientIds ?? null,
        }),
        createdById: user.id,
        status: parsed.data.send ? CampaignStatus.SENDING : CampaignStatus.DRAFT,
        totalCount: recipients.length,
      },
    });

    if (!parsed.data.send) {
      return Response.json({ campaign, count: recipients.length }, { status: 201 });
    }

    const renderMeta = {
      linksJson: templateMeta?.linksJson ?? "[]",
      imageUrl: templateMeta?.imageUrl ?? null,
    };

    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      if (!r.phone) continue;
      try {
        const content = renderTemplateBody(parsed.data.messageBody, renderMeta, {
          name: r.name,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          phone: r.phone,
        });
        const result = await sendQuoMessage({
          to: r.phone,
          content,
          kind: SMSKind.MARKETING,
          campaignId: campaign.id,
          templateId: templateId ?? undefined,
          clientId: r.id,
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
