"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, H1, Muted } from "@/components/ui";

type MutedClient = {
  id: string;
  name: string;
  phone: string | null;
  lastServiceAt: string | null;
};

type ReviewSms = {
  id: string;
  to: string;
  clientName: string | null;
  status: string;
  error: string | null;
  content: string;
  createdAt: string;
};

type CompleteEvent = {
  id: string;
  jobberJobId: string;
  processedAt: string | null;
  error: string | null;
  reason: string | null;
  createdAt: string;
};

export default function AdminReviewsPage() {
  const [reviewLink, setReviewLink] = useState("");
  const [muted, setMuted] = useState<MutedClient[]>([]);
  const [reviews, setReviews] = useState<ReviewSms[]>([]);
  const [completes, setCompletes] = useState<CompleteEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/reviews");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load review settings");
      return;
    }
    setError(null);
    setReviewLink(data.reviewLink || "");
    setMuted(data.mutedClients || []);
    setReviews(data.recentReviews || []);
    setCompletes(data.recentCompletes || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unmute(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skipReviewSms: false }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not unmute");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Review SMS</H1>
        <Muted>
          After a Jobber job is closed, we text the client a Google review link — unless
          that client is muted.
        </Muted>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      <Card className="space-y-3">
        <h2 className="font-semibold">How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--qc-muted)]">
          <li>
            Jobber fires the <code className="text-[var(--qc-ink)]">JOB_CLOSED</code>{" "}
            webhook when a job is closed (not when it is only created).
          </li>
          <li>
            We load the job + client (name, phone) from Jobber and update our local job
            cache.
          </li>
          <li>
            If the client has a phone and is <strong>not</strong> muted, Quo sends an SMS
            with your review link.
          </li>
          <li>
            Mute a bad client on{" "}
            <Link href="/admin/clients" className="text-[var(--qc-accent)] underline">
              Clients
            </Link>{" "}
            (“Skip review SMS”) so future completed jobs never get the link.
          </li>
        </ol>
        <div className="rounded-xl border border-[var(--qc-line)] bg-[var(--qc-bg)] p-3 text-sm">
          <div className="text-[var(--qc-muted)]">Review link in SMS</div>
          {reviewLink ? (
            <a
              href={reviewLink}
              target="_blank"
              rel="noreferrer"
              className="break-all text-[var(--qc-accent)]"
            >
              {reviewLink}
            </a>
          ) : (
            <span>—</span>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Muted clients ({muted.length})</h2>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        {muted.length === 0 ? (
          <p className="text-sm text-[var(--qc-muted)]">
            Nobody is muted. Toggle “Skip review SMS” on a client to block the auto text.
          </p>
        ) : (
          <div className="space-y-2">
            {muted.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--qc-line)] py-2 last:border-0"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-[var(--qc-muted)]">
                    {c.phone || "No phone"}
                    {c.lastServiceAt
                      ? ` · last service ${new Date(c.lastServiceAt).toLocaleDateString()}`
                      : ""}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyId === c.id}
                  onClick={() => void unmute(c.id)}
                >
                  {busyId === c.id ? "…" : "Allow review SMS"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Recent review texts</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-[var(--qc-muted)]">No review SMS sent yet.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {reviews.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--qc-line)] py-2 last:border-0"
              >
                <div>
                  <div className="font-medium">{m.clientName || m.to}</div>
                  <div className="text-[var(--qc-muted)]">{m.to}</div>
                  <div className="mt-1 text-xs text-[var(--qc-muted)]">
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <Badge tone={m.status === "SENT" ? "ok" : m.status === "FAILED" ? "warn" : undefined}>
                    {m.status}
                  </Badge>
                  {m.error ? (
                    <div className="mt-1 max-w-xs text-xs text-red-700">{m.error}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Recent job-complete webhooks</h2>
        {completes.length === 0 ? (
          <p className="text-sm text-[var(--qc-muted)]">
            No job-closed events yet. Close a job in Jobber to test (creating one is not enough).
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {completes.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap justify-between gap-2 border-b border-[var(--qc-line)] py-2 last:border-0"
              >
                <div>
                  <code className="text-xs">{e.jobberJobId}</code>
                  <div className="text-[var(--qc-muted)]">
                    {new Date(e.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  {e.error ? (
                    <Badge tone="warn">error</Badge>
                  ) : e.reason === "skip_review" ? (
                    <Badge tone="warn">muted</Badge>
                  ) : e.reason === "no_phone" ? (
                    <Badge>no phone</Badge>
                  ) : e.processedAt ? (
                    <Badge tone="ok">processed</Badge>
                  ) : (
                    <Badge>pending</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
