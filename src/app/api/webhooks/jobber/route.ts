import { createJobberWebhookHandler } from "@/lib/jobber/webhook-route";

/** Unified webhook — routes by payload topic. */
export const POST = createJobberWebhookHandler();
