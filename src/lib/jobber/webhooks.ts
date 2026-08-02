import crypto from "crypto";
import { prisma } from "@/lib/db";
import { jobberGraphQL } from "@/lib/jobber/client";
import { sendReviewSms } from "@/lib/quo/client";
import { AppError } from "@/lib/errors";

export function verifyJobberSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.JOBBER_CLIENT_SECRET;
  if (!secret) {
    throw new AppError(
      "Jobber webhook secret not configured",
      503,
      "JOBBER_SECRET_MISSING",
    );
  }
  if (!signatureHeader) return false;

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const a = Buffer.from(digest);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type JobCompleteData = {
  job: {
    id: string;
    title?: string | null;
    jobStatus?: string | null;
    completedAt?: string | null;
    client?: {
      id: string;
      name?: string | null;
      phones?: { nodes: Array<{ number?: string | null }> } | null;
    } | null;
  } | null;
};

const JOB_QUERY = `
  query GetJob($id: EncodedId!) {
    job(id: $id) {
      id
      title
      jobStatus
      completedAt
      client {
        id
        name
        phones { nodes { number } }
      }
    }
  }
`;

export async function processJobComplete(itemId: string, accountId?: string) {
  const existing = await prisma.webhookEvent.findUnique({
    where: { topic_itemId: { topic: "JOB_COMPLETE", itemId } },
  });
  if (existing?.processedAt) {
    return { skipped: true as const, reason: "already_processed" };
  }

  const event = await prisma.webhookEvent.upsert({
    where: { topic_itemId: { topic: "JOB_COMPLETE", itemId } },
    create: {
      topic: "JOB_COMPLETE",
      itemId,
      accountId: accountId ?? null,
      payload: JSON.stringify({ itemId, accountId }),
    },
    update: {
      accountId: accountId ?? null,
      error: null,
    },
  });

  try {
    const data = await jobberGraphQL<JobCompleteData>(JOB_QUERY, { id: itemId });
    const job = data.job;
    if (!job) {
      throw new AppError("Job not found in Jobber", 404, "JOB_NOT_FOUND");
    }

    const phone = job.client?.phones?.nodes?.[0]?.number;
    if (!phone) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processedAt: new Date(),
          error: "No client phone on job",
          payload: JSON.stringify(job),
        },
      });
      return { skipped: true as const, reason: "no_phone" };
    }

    const localClient = await prisma.jobberClient.findUnique({
      where: { jobberId: job.client!.id },
    });
    if (localClient) {
      await prisma.jobberClient.update({
        where: { id: localClient.id },
        data: {
          lastServiceAt: job.completedAt ? new Date(job.completedAt) : new Date(),
          phone: phone,
        },
      });
    }

    await prisma.jobberJob.upsert({
      where: { jobberId: job.id },
      create: {
        jobberId: job.id,
        clientId: localClient?.id ?? null,
        title: job.title ?? null,
        status: job.jobStatus ?? "completed",
        completedAt: job.completedAt ? new Date(job.completedAt) : new Date(),
        rawJson: JSON.stringify(job),
      },
      update: {
        clientId: localClient?.id ?? null,
        title: job.title ?? null,
        status: job.jobStatus ?? "completed",
        completedAt: job.completedAt ? new Date(job.completedAt) : new Date(),
        rawJson: JSON.stringify(job),
      },
    });

    const sms = await sendReviewSms({
      to: phone,
      clientName: job.client?.name ?? null,
    });

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        processedAt: new Date(),
        payload: JSON.stringify({ job, smsId: sms.id }),
        error: sms.status === "FAILED" ? sms.error : null,
      },
    });

    return { skipped: false as const, smsId: sms.id, status: sms.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { error: message },
    });
    throw err;
  }
}
