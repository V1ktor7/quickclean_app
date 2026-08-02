import { createJobberWebhookHandler } from "@/lib/jobber/webhook-route";

/** Quote approved → pipeline event for Admin. */
export const POST = createJobberWebhookHandler("QUOTE_APPROVAL");
