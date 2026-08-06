import { SMSKind, SMSStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, fetchWithTimeout, TimeoutError } from "@/lib/errors";
import {
  defaultReviewLink,
  getActiveTemplate,
  renderTemplateBody,
  type TemplateVars,
} from "@/lib/sms/templates";

const QUO_URL = "https://api.quo.com/v1/messages";

export type SendSmsInput = {
  to: string | string[];
  content: string;
  kind: SMSKind;
  campaignId?: string;
  templateId?: string;
  clientId?: string;
  jobberJobId?: string;
  clientName?: string | null;
  /** If set, update this row instead of creating new ones */
  existingMessageId?: string;
};

function normalizeE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed.startsWith("+") ? trimmed : `+${digits}`;
}

export async function sendQuoMessage(input: SendSmsInput) {
  const apiKey = process.env.QUO_API_KEY;
  const from = process.env.QUO_FROM_NUMBER;
  if (!apiKey || !from) {
    throw new AppError(
      "Quo is not configured (missing QUO_API_KEY or QUO_FROM_NUMBER)",
      503,
      "QUO_UNCONFIGURED",
    );
  }

  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).map(
    normalizeE164,
  );

  let records;
  if (input.existingMessageId) {
    const existing = await prisma.sMSMessage.update({
      where: { id: input.existingMessageId },
      data: {
        to: recipients[0]!,
        content: input.content,
        status: SMSStatus.PENDING,
        error: null,
        kind: input.kind,
        campaignId: input.campaignId,
        templateId: input.templateId,
        clientId: input.clientId,
        jobberJobId: input.jobberJobId,
        clientName: input.clientName ?? null,
      },
    });
    records = [existing];
  } else {
    records = await Promise.all(
      recipients.map((to) =>
        prisma.sMSMessage.create({
          data: {
            to,
            content: input.content,
            kind: input.kind,
            campaignId: input.campaignId,
            templateId: input.templateId,
            clientId: input.clientId,
            jobberJobId: input.jobberJobId,
            clientName: input.clientName ?? null,
            status: SMSStatus.PENDING,
          },
        }),
      ),
    );
  }

  const chunks: string[][] = [];
  for (let i = 0; i < recipients.length; i += 10) {
    chunks.push(recipients.slice(i, i + 10));
  }

  let lastProviderId: string | undefined;
  const errors: string[] = [];

  for (const chunk of chunks) {
    try {
      const res = await fetchWithTimeout(
        QUO_URL,
        {
          method: "POST",
          headers: {
            Authorization: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: input.content,
            from,
            to: chunk,
          }),
        },
        15000,
      );

      const bodyText = await res.text();
      let body: { id?: string; data?: { id?: string }; message?: string } = {};
      try {
        body = JSON.parse(bodyText) as typeof body;
      } catch {
        /* non-json */
      }

      if (!res.ok && res.status !== 202) {
        const errMsg = body.message || `Quo error ${res.status}: ${bodyText.slice(0, 200)}`;
        errors.push(errMsg);
        await prisma.sMSMessage.updateMany({
          where: {
            id: { in: records.filter((r) => chunk.includes(r.to)).map((r) => r.id) },
          },
          data: { status: SMSStatus.FAILED, error: errMsg },
        });
        continue;
      }

      lastProviderId = body.id ?? body.data?.id ?? `quo-${Date.now()}`;
      await prisma.sMSMessage.updateMany({
        where: {
          id: { in: records.filter((r) => chunk.includes(r.to)).map((r) => r.id) },
        },
        data: {
          status: SMSStatus.SENT,
          providerId: lastProviderId,
          error: null,
        },
      });
    } catch (err) {
      const errMsg =
        err instanceof TimeoutError
          ? "Quo request timed out"
          : err instanceof Error
            ? err.message
            : "Quo send failed";
      errors.push(errMsg);
      await prisma.sMSMessage.updateMany({
        where: {
          id: { in: records.filter((r) => chunk.includes(r.to)).map((r) => r.id) },
        },
        data: { status: SMSStatus.FAILED, error: errMsg },
      });
    }
  }

  const updated = await prisma.sMSMessage.findMany({
    where: { id: { in: records.map((r) => r.id) } },
  });

  return {
    messages: updated,
    providerId: lastProviderId,
    errors,
  };
}

/** Queue a review SMS for admin approve/deny (does not send yet). */
export async function queueReviewSms(opts: {
  to: string;
  clientName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  clientId?: string | null;
  jobberJobId?: string | null;
  jobTitle?: string | null;
}) {
  const template = await getActiveTemplate(SMSKind.REVIEW);
  const body =
    template?.body ??
    process.env.REVIEW_SMS_TEMPLATE ??
    "Hi {{firstName}}! Thanks for choosing QuickClean. We'd love a quick review: {{reviewLink}}";

  const vars: TemplateVars = {
    name: opts.clientName,
    firstName: opts.firstName,
    lastName: opts.lastName,
    phone: opts.to,
    email: opts.email,
    reviewLink: defaultReviewLink(),
    jobTitle: opts.jobTitle,
  };

  const content = renderTemplateBody(
    body,
    {
      linksJson: template?.linksJson ?? "[]",
      imageUrl: template?.imageUrl ?? null,
    },
    vars,
  );

  return prisma.sMSMessage.create({
    data: {
      to: normalizeE164(opts.to),
      content,
      kind: SMSKind.REVIEW,
      status: SMSStatus.AWAITING_APPROVAL,
      clientName: opts.clientName ?? null,
      clientId: opts.clientId ?? null,
      jobberJobId: opts.jobberJobId ?? null,
      templateId: template?.id ?? null,
    },
  });
}

export async function approveReviewSms(opts: {
  messageId: string;
  contentOverride?: string;
}) {
  const msg = await prisma.sMSMessage.findUnique({ where: { id: opts.messageId } });
  if (!msg) throw new AppError("Message not found", 404);
  if (msg.kind !== SMSKind.REVIEW) {
    throw new AppError("Not a review SMS", 400);
  }
  if (msg.status !== SMSStatus.AWAITING_APPROVAL) {
    throw new AppError("Message is not awaiting approval", 400);
  }

  const content = (opts.contentOverride ?? msg.content).trim().slice(0, 1600);
  if (!content) throw new AppError("Message body is empty", 400);

  const result = await sendQuoMessage({
    to: msg.to,
    content,
    kind: SMSKind.REVIEW,
    existingMessageId: msg.id,
    templateId: msg.templateId ?? undefined,
    clientId: msg.clientId ?? undefined,
    jobberJobId: msg.jobberJobId ?? undefined,
    clientName: msg.clientName,
  });

  return result.messages[0]!;
}

export async function denyReviewSms(messageId: string) {
  const msg = await prisma.sMSMessage.findUnique({ where: { id: messageId } });
  if (!msg) throw new AppError("Message not found", 404);
  if (msg.status !== SMSStatus.AWAITING_APPROVAL) {
    throw new AppError("Message is not awaiting approval", 400);
  }
  return prisma.sMSMessage.update({
    where: { id: messageId },
    data: { status: SMSStatus.DENIED, error: "Denied by admin" },
  });
}
