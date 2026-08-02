import { AppError, jsonError } from "@/lib/errors";
import { handleJobberWebhookRequest } from "@/lib/jobber/webhooks";

export function createJobberWebhookHandler(expectedTopic?: string) {
  return async function POST(req: Request) {
    try {
      return await handleJobberWebhookRequest(req, expectedTopic);
    } catch (err) {
      if (err instanceof AppError && (err.status === 401 || err.status === 400 || err.status === 503)) {
        return jsonError(err);
      }
      console.error("Jobber webhook error", err);
      // Acknowledge to avoid aggressive Jobber retries after we persisted the failure
      return Response.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "Webhook failed",
        },
        { status: 200 },
      );
    }
  };
}
