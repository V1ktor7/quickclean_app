import { createJobberWebhookHandler } from "@/lib/jobber/webhook-route";

/** Job closed/completed → review SMS + local job update. */
export const POST = createJobberWebhookHandler("JOB_COMPLETE");
