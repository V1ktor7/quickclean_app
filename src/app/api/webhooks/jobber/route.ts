import { processJobComplete, verifyJobberSignature } from "@/lib/jobber/webhooks";
import { AppError, jsonError } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-jobber-hmac-sha256");

    // Allow skip in local/dev when secret unset and NODE_ENV development
    const secret = process.env.JOBBER_CLIENT_SECRET;
    if (secret) {
      const ok = verifyJobberSignature(rawBody, signature);
      if (!ok) {
        return Response.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      throw new AppError("Webhook secret required in production", 503);
    }

    let payload: {
      data?: { webHookEvent?: { topic?: string; itemId?: string; accountId?: string } };
      topic?: string;
      itemId?: string;
      accountId?: string;
    };

    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const event = payload.data?.webHookEvent ?? payload;
    const topic = event.topic;
    const itemId = event.itemId;
    const accountId = event.accountId;

    if (!topic || !itemId) {
      return Response.json({ error: "Missing topic or itemId" }, { status: 400 });
    }

    // Acknowledge quickly for non-complete topics
    if (topic !== "JOB_COMPLETE") {
      return Response.json({ ok: true, ignored: topic });
    }

    // Process review SMS; errors are persisted on WebhookEvent
    const result = await processJobComplete(itemId, accountId);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    // Still return 200 when possible after logging — Jobber retries aggressively.
    // If signature/config fails, return proper error.
    if (err instanceof AppError && (err.status === 401 || err.status === 503)) {
      return jsonError(err);
    }
    console.error("Jobber webhook error", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Webhook failed",
      },
      { status: 200 },
    );
  }
}
