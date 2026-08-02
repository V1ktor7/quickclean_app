import { createJobberWebhookHandler } from "@/lib/jobber/webhook-route";

/** App disconnected in Jobber → clear OAuth tokens. */
export const POST = createJobberWebhookHandler("APP_DISCONNECT");
