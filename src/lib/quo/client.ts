import { SMSKind, SMSStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, fetchWithTimeout, TimeoutError } from "@/lib/errors";

const QUO_URL = "https://api.quo.com/v1/messages";

export type SendSmsInput = {
  to: string | string[];
  content: string;
  kind: SMSKind;
  campaignId?: string;
  clientName?: string | null;
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

  const records = await Promise.all(
    recipients.map((to) =>
      prisma.sMSMessage.create({
        data: {
          to,
          content: input.content,
          kind: input.kind,
          campaignId: input.campaignId,
          clientName: input.clientName ?? null,
          status: SMSStatus.PENDING,
        },
      }),
    ),
  );

  // Quo accepts max 10 recipients per request — chunk
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

export async function sendReviewSms(opts: {
  to: string;
  clientName?: string | null;
}) {
  const link = process.env.REVIEW_LINK_URL ?? "https://g.page/r/quickclean/review";
  const template =
    process.env.REVIEW_SMS_TEMPLATE ??
    "Thanks for choosing QuickClean! Leave a review: {{link}}";
  const content = template.replace(/\{\{link\}\}/g, link);

  const result = await sendQuoMessage({
    to: opts.to,
    content,
    kind: SMSKind.REVIEW,
    clientName: opts.clientName,
  });

  return result.messages[0]!;
}
