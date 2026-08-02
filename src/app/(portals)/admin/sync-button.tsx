"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function SyncButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    window.location.reload();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={sync} disabled={busy}>
        {busy ? "Syncing…" : "Sync Jobber now"}
      </Button>
      {msg ? <span className="text-xs text-[var(--qc-muted)]">{msg}</span> : null}
    </div>
  );
}
