"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, H1, Muted } from "@/components/ui";

type Endpoint = {
  id: string;
  label: string;
  purpose: string;
  path: string;
  url: string;
  jobberTopic: string | null;
  whereToPaste: string;
};

type EventRow = {
  id: string;
  topic: string;
  itemId: string;
  processedAt?: string | null;
  error?: string | null;
  createdAt: string;
};

export default function AdminIntegrationsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [oauthCallbackUrl, setOauthCallbackUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/jobber/endpoints");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load endpoints");
      return;
    }
    setEndpoints(data.endpoints || []);
    setEvents(data.recentEvents || []);
    setOauthCallbackUrl(data.oauthCallbackUrl || "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Jobber integrations</H1>
        <Muted>
          Copy these URLs into the Jobber Developer Center. For local testing, expose the app with a
          public tunnel (ngrok, Cloudflare Tunnel) and set AUTH_URL to that HTTPS origin.
        </Muted>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      <Card>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold">
          Setup checklist
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--qc-muted)]">
          <li>
            Paste the <strong>OAuth callback URL</strong> into Jobber → App → OAuth Callback URL
            {oauthCallbackUrl ? (
              <span className="mt-1 block font-mono text-[var(--qc-ink)]">{oauthCallbackUrl}</span>
            ) : null}
          </li>
          <li>Create a webhook for each topic below (or use the unified URL for all).</li>
          <li>
            Signatures use your <code className="rounded bg-[var(--qc-bg)] px-1">JOBBER_CLIENT_SECRET</code>{" "}
            via the <code className="rounded bg-[var(--qc-bg)] px-1">X-Jobber-Hmac-SHA256</code> header.
          </li>
          <li>Admin → Overview → Connect Jobber, then Sync.</li>
        </ol>
      </Card>

      <div className="space-y-3">
        {endpoints.map((ep) => (
          <Card key={ep.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                    {ep.label}
                  </h3>
                  {ep.jobberTopic ? <Badge>{ep.jobberTopic}</Badge> : <Badge tone="warn">OAuth</Badge>}
                </div>
                <p className="mt-1 text-sm text-[var(--qc-muted)]">{ep.purpose}</p>
                <p className="mt-2 text-xs text-[var(--qc-muted)]">{ep.whereToPaste}</p>
                <code className="mt-3 block break-all rounded-xl bg-[var(--qc-bg)] px-3 py-2 text-sm">
                  {ep.url}
                </code>
              </div>
              <Button type="button" variant="secondary" onClick={() => copy(ep.url, ep.id)}>
                {copied === ep.id ? "Copied" : "Copy URL"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Recent webhook deliveries
          </h2>
          <Button type="button" variant="ghost" onClick={() => load()}>
            Refresh
          </Button>
        </div>
        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-[var(--qc-muted)]">
              No webhook events yet. After Jobber is connected and webhooks are configured, deliveries
              show up here.
            </p>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[var(--qc-bg)] px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-semibold">
                    {ev.topic} · {ev.itemId}
                  </div>
                  <div className="text-[var(--qc-muted)]">
                    {new Date(ev.createdAt).toLocaleString()}
                    {ev.error ? ` · ${ev.error}` : ""}
                  </div>
                </div>
                <Badge tone={ev.error ? "bad" : ev.processedAt ? "ok" : "warn"}>
                  {ev.error ? "error" : ev.processedAt ? "processed" : "pending"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
