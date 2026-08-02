import { Card, H1, Muted } from "@/components/ui";

export default function SalesToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <H1>Sales tools</H1>
        <Muted>Proprietary calculators and quote helpers for the field and phone.</Muted>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--qc-line)] px-4 py-3">
          <div>
            <div className="font-[family-name:var(--font-display)] font-semibold">Pane</div>
            <div className="text-xs text-[var(--qc-muted)]">Window cleaning quote calculator</div>
          </div>
          <a
            href="/sales-tools/pane/"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[var(--qc-accent)] px-3 py-1.5 text-sm font-semibold text-white"
          >
            Open fullscreen
          </a>
        </div>
        <iframe
          title="Pane window cleaning quote"
          src="/sales-tools/pane/"
          className="h-[80vh] w-full border-0 bg-[var(--qc-bg)]"
        />
      </Card>
    </div>
  );
}
