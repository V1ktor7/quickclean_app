import crypto from "crypto";
import { prisma } from "@/lib/db";
import { jobberGraphQL } from "@/lib/jobber/client";
import { clearConnection } from "@/lib/jobber/oauth";
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

export type WebhookPayload = {
  data?: { webHookEvent?: { topic?: string; itemId?: string; accountId?: string } };
  topic?: string;
  itemId?: string;
  accountId?: string;
};

export function normalizeJobberTopic(topic: string): string {
  // Jobber Developer Center labels this "JOB_CLOSED"; payload/docs also use JOB_COMPLETE.
  if (topic === "JOB_CLOSED") return "JOB_COMPLETE";
  return topic;
}

export function parseWebhookPayload(rawBody: string): {
  topic: string;
  itemId: string;
  accountId?: string;
} {
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    throw new AppError("Invalid JSON", 400, "BAD_JSON");
  }
  const event = payload.data?.webHookEvent ?? payload;
  const rawTopic = event.topic;
  const itemId = event.itemId;
  if (!rawTopic || !itemId) {
    throw new AppError("Missing topic or itemId", 400, "BAD_PAYLOAD");
  }
  return {
    topic: normalizeJobberTopic(rawTopic),
    itemId,
    accountId: event.accountId,
  };
}

async function beginEvent(topic: string, itemId: string, accountId?: string) {
  const existing = await prisma.webhookEvent.findUnique({
    where: { topic_itemId: { topic, itemId } },
  });
  if (existing?.processedAt) {
    return { skipped: true as const, event: existing, reason: "already_processed" };
  }

  const event = await prisma.webhookEvent.upsert({
    where: { topic_itemId: { topic, itemId } },
    create: {
      topic,
      itemId,
      accountId: accountId ?? null,
      payload: JSON.stringify({ itemId, accountId }),
    },
    update: {
      accountId: accountId ?? null,
      error: null,
    },
  });

  return { skipped: false as const, event };
}

async function finishEvent(
  eventId: string,
  data: { payload?: unknown; error?: string | null },
) {
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      processedAt: new Date(),
      payload: data.payload ? JSON.stringify(data.payload) : undefined,
      error: data.error ?? null,
    },
  });
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
      phones?: Array<{ number?: string | null }> | null;
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
        phones { number }
      }
    }
  }
`;

const CLIENT_QUERY = `
  query GetClient($id: EncodedId!) {
    client(id: $id) {
      id
      name
      firstName
      lastName
      isCompany
      isArchived
      jobberWebUri
      emails { address }
      phones { number }
      tags { nodes { label } }
    }
  }
`;

type ClientData = {
  client: {
    id: string;
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    isCompany?: boolean | null;
    isArchived?: boolean | null;
    jobberWebUri?: string | null;
    emails?: Array<{ address?: string | null }> | null;
    phones?: Array<{ number?: string | null }> | null;
    tags?: { nodes: Array<{ label?: string | null }> } | null;
  } | null;
};

function isCommercial(tags: string[], isCompany?: boolean | null) {
  if (isCompany) return true;
  return tags.some((t) => /commercial|biz|business/i.test(t));
}

/** JOB_COMPLETE — review SMS + local job cache */
export async function processJobComplete(itemId: string, accountId?: string) {
  const started = await beginEvent("JOB_COMPLETE", itemId, accountId);
  if (started.skipped) {
    return { topic: "JOB_COMPLETE", skipped: true as const, reason: started.reason };
  }

  try {
    const data = await jobberGraphQL<JobCompleteData>(JOB_QUERY, { id: itemId });
    const job = data.job;
    if (!job) throw new AppError("Job not found in Jobber", 404, "JOB_NOT_FOUND");

    const phone = job.client?.phones?.[0]?.number;
    if (!phone) {
      await finishEvent(started.event.id, {
        payload: { job, skipped: true, reason: "no_phone" },
        error: "No client phone on job",
      });
      return { topic: "JOB_COMPLETE", skipped: true as const, reason: "no_phone" };
    }

    const localClient = job.client?.id
      ? await prisma.jobberClient.findUnique({ where: { jobberId: job.client.id } })
      : null;

    if (localClient) {
      await prisma.jobberClient.update({
        where: { id: localClient.id },
        data: {
          lastServiceAt: job.completedAt ? new Date(job.completedAt) : new Date(),
          phone,
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

    if (localClient?.skipReviewSms) {
      await finishEvent(started.event.id, {
        payload: { job, skipped: true, reason: "skip_review" },
      });
      return {
        topic: "JOB_COMPLETE",
        skipped: true as const,
        reason: "skip_review",
      };
    }

    const sms = await sendReviewSms({
      to: phone,
      clientName: job.client?.name ?? null,
    });

    await finishEvent(started.event.id, {
      payload: { job, smsId: sms.id },
      error: sms.status === "FAILED" ? sms.error : null,
    });

    return {
      topic: "JOB_COMPLETE",
      skipped: false as const,
      smsId: sms.id,
      status: sms.status,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    await prisma.webhookEvent.update({
      where: { id: started.event.id },
      data: { error: message },
    });
    throw err;
  }
}

/** CLIENT_CREATE — upsert into local CRM cache */
export async function processClientCreate(itemId: string, accountId?: string) {
  const started = await beginEvent("CLIENT_CREATE", itemId, accountId);
  if (started.skipped) {
    return { topic: "CLIENT_CREATE", skipped: true as const, reason: started.reason };
  }

  try {
    const data = await jobberGraphQL<ClientData>(CLIENT_QUERY, { id: itemId });
    const c = data.client;
    if (!c) throw new AppError("Client not found in Jobber", 404);

    const tags = (c.tags?.nodes ?? [])
      .map((t) => t.label)
      .filter((x): x is string => Boolean(x));
    const email = c.emails?.[0]?.address ?? null;
    const phone = c.phones?.[0]?.number ?? null;

    await prisma.jobberClient.upsert({
      where: { jobberId: c.id },
      create: {
        jobberId: c.id,
        name: c.name,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        email,
        phone,
        tags: JSON.stringify(tags),
        isCommercial: isCommercial(tags, c.isCompany),
        isArchived: Boolean(c.isArchived),
        jobberWebUri: c.jobberWebUri ?? null,
        rawJson: JSON.stringify(c),
        syncedAt: new Date(),
      },
      update: {
        name: c.name,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        email,
        phone,
        tags: JSON.stringify(tags),
        isCommercial: isCommercial(tags, c.isCompany),
        isArchived: Boolean(c.isArchived),
        jobberWebUri: c.jobberWebUri ?? null,
        rawJson: JSON.stringify(c),
        syncedAt: new Date(),
      },
    });

    await finishEvent(started.event.id, { payload: c });
    return { topic: "CLIENT_CREATE", skipped: false as const, clientId: c.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Client webhook failed";
    await prisma.webhookEvent.update({
      where: { id: started.event.id },
      data: { error: message },
    });
    throw err;
  }
}

/** QUOTE_APPROVAL — record for Admin pipeline visibility */
export async function processQuoteApproval(itemId: string, accountId?: string) {
  const started = await beginEvent("QUOTE_APPROVAL", itemId, accountId);
  if (started.skipped) {
    return { topic: "QUOTE_APPROVAL", skipped: true as const, reason: started.reason };
  }

  try {
    await finishEvent(started.event.id, {
      payload: { itemId, accountId, note: "Quote approved in Jobber" },
    });
    return { topic: "QUOTE_APPROVAL", skipped: false as const, itemId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quote webhook failed";
    await prisma.webhookEvent.update({
      where: { id: started.event.id },
      data: { error: message },
    });
    throw err;
  }
}

/** APP_DISCONNECT — revoke local OAuth tokens */
export async function processAppDisconnect(itemId: string, accountId?: string) {
  const started = await beginEvent("APP_DISCONNECT", itemId, accountId);
  if (started.skipped) {
    return { topic: "APP_DISCONNECT", skipped: true as const, reason: started.reason };
  }

  try {
    await clearConnection();
    await finishEvent(started.event.id, {
      payload: { itemId, accountId, cleared: true },
    });
    return { topic: "APP_DISCONNECT", skipped: false as const, cleared: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Disconnect webhook failed";
    await prisma.webhookEvent.update({
      where: { id: started.event.id },
      data: { error: message },
    });
    throw err;
  }
}

export async function dispatchJobberTopic(
  topic: string,
  itemId: string,
  accountId?: string,
) {
  switch (topic) {
    case "JOB_COMPLETE":
      return processJobComplete(itemId, accountId);
    case "CLIENT_CREATE":
      return processClientCreate(itemId, accountId);
    case "QUOTE_APPROVAL":
      return processQuoteApproval(itemId, accountId);
    case "APP_DISCONNECT":
      return processAppDisconnect(itemId, accountId);
    default:
      return { topic, skipped: true as const, reason: "unsupported_topic" };
  }
}

export async function handleJobberWebhookRequest(
  req: Request,
  expectedTopic?: string,
) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-jobber-hmac-sha256");

  const secret = process.env.JOBBER_CLIENT_SECRET;
  if (secret) {
    const ok = verifyJobberSignature(rawBody, signature);
    if (!ok) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    throw new AppError("Webhook secret required in production", 503);
  }

  const { topic, itemId, accountId } = parseWebhookPayload(rawBody);

  if (expectedTopic) {
    const normalizedExpected = normalizeJobberTopic(expectedTopic);
    if (topic !== normalizedExpected) {
      return Response.json(
        {
          error: `Expected topic ${expectedTopic}, got ${topic}`,
          code: "TOPIC_MISMATCH",
        },
        { status: 400 },
      );
    }
  }

  const result = await dispatchJobberTopic(topic, itemId, accountId);
  return Response.json({ ok: true, ...result });
}
