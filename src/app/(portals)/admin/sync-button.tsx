"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";

type Status = {
  connected: boolean;
  configured: boolean;
  redirectUri?: string;
  accountName?: string | null;
};

export function SyncButton() {
  const params = useSearchParams();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    void fetch("/api/jobber/status")
      .then((r) => r.json())
      .then((data: Status) => setStatus(data))
      .catch(() => setStatus(null));

    const jobber = params.get("jobber");
    if (jobber === "connected") setMsg("Jobber connected successfully.");
    if (jobber === "error") {
      setMsg(params.get("message") || "Jobber connection failed.");
    }
  }, [params]);

  async function sync() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/jobber/sync", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Sync failed");
      return;
    }
    setMsg(`Synced ${data.clients} clients, ${data.jobs} jobs`);
    window.location.href = "/admin";
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <a href="/api/jobber/oauth/start">
          <Button type="button" variant="secondary" disabled={busy || status?.configured === false}>
            {status?.connected ? "Reconnect Jobber" : "Connect Jobber"}
          </Button>
        </a>
        <Button type="button" onClick={sync} disabled={busy || !status?.connected}>
          {busy ? "Syncing…" : "Sync Jobber now"}
        </Button>
      </div>
      {status?.connected ? (
        <span className="text-xs text-[var(--qc-muted)]">
          Connected{status.accountName ? `: ${status.accountName}` : ""}
        </span>
      ) : status?.configured ? (
        <span className="max-w-xs text-right text-xs text-[var(--qc-muted)]">
          Set OAuth callback in Jobber to: {status.redirectUri}
        </span>
      ) : (
        <span className="text-xs text-[var(--qc-muted)]">
          Add JOBBER_CLIENT_ID / JOBBER_CLIENT_SECRET to env
        </span>
      )}
      {msg ? <span className="max-w-sm text-right text-xs text-[var(--qc-muted)]">{msg}</span> : null}
    </div>
  );
}
