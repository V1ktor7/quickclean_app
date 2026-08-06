import { Suspense } from "react";
import AdminCampaignsPage from "./campaigns-client";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--qc-muted)]">Loading…</p>}>
      <AdminCampaignsPage />
    </Suspense>
  );
}
