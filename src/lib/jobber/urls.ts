export function getAppBaseUrl() {
  return (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export type JobberEndpoint = {
  id: string;
  label: string;
  purpose: string;
  path: string;
  jobberTopic: string | null;
  whereToPaste: string;
};

/** Canonical endpoints to configure in Jobber Developer Center. */
export function getJobberEndpoints(): JobberEndpoint[] {
  return [
    {
      id: "oauth-callback",
      label: "OAuth callback URL",
      purpose: "Completes Connect Jobber login after an Admin authorizes the app.",
      path: "/api/jobber/oauth/callback",
      jobberTopic: null,
      whereToPaste: "Jobber Developer Center → App → OAuth Callback URL",
    },
    {
      id: "job-complete",
      label: "Job closed / completed webhook",
      purpose: "When a job is marked complete (Jobber JOB_COMPLETE / job closed), send the client a Google review SMS via Quo — unless the client has review SMS muted — and update local job cache.",
      path: "/api/webhooks/jobber/job-complete",
      jobberTopic: "JOB_CLOSED (alias JOB_COMPLETE)",
      whereToPaste: "Jobber Developer Center → Webhooks → topic JOB_CLOSED",
    },
    {
      id: "client-create",
      label: "New client webhook",
      purpose: "When a client is created in Jobber, pull them into the Ops Hub client list immediately.",
      path: "/api/webhooks/jobber/client-create",
      jobberTopic: "CLIENT_CREATE",
      whereToPaste: "Jobber Developer Center → Webhooks → topic CLIENT_CREATE",
    },
    {
      id: "quote-approval",
      label: "Quote approved webhook",
      purpose: "When a quote is approved, log the event for Admin follow-up / pipeline visibility.",
      path: "/api/webhooks/jobber/quote-approval",
      jobberTopic: "QUOTE_APPROVAL",
      whereToPaste: "Jobber Developer Center → Webhooks → topic QUOTE_APPROVAL",
    },
    {
      id: "app-disconnect",
      label: "App disconnect webhook",
      purpose: "When Jobber disconnects the app, wipe stored OAuth tokens so sync stops cleanly.",
      path: "/api/webhooks/jobber/app-disconnect",
      jobberTopic: "APP_DISCONNECT",
      whereToPaste: "Jobber Developer Center → Webhooks → topic APP_DISCONNECT",
    },
    {
      id: "unified",
      label: "Unified webhook (optional)",
      purpose: "Single endpoint that accepts any of the topics above. Use if you prefer one URL for all events.",
      path: "/api/webhooks/jobber",
      jobberTopic: "ANY (routed by payload topic)",
      whereToPaste: "Optional alternative to the topic-specific URLs",
    },
  ];
}

export function absoluteUrl(path: string) {
  return `${getAppBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
