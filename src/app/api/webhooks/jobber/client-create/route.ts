import { createJobberWebhookHandler } from "@/lib/jobber/webhook-route";

/** New client in Jobber → sync into Ops Hub. */
export const POST = createJobberWebhookHandler("CLIENT_CREATE");
