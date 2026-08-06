"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, H1, Input, Label, Muted, Textarea } from "@/components/ui";

type TemplateLink = { key: string; label?: string; url: string };

type Template = {
  id: string;
  name: string;
  kind: "REVIEW" | "MARKETING";
  body: string;
  linksJson: string;
  imageUrl: string | null;
  isActive: boolean;
};

type PendingSms = {
  id: string;
  to: string;
  content: string;
  clientName: string | null;
  jobberJobId: string | null;
  createdAt: string;
  template?: { id: string; name: string } | null;
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

type MutedClient = {
  id: string;
  name: string;
  phone: string | null;
  lastServiceAt: string | null;
};

type CompleteEvent = {
  id: string;
  jobberJobId: string;
  error: string | null;
  reason: string | null;
  createdAt: string;
};

function parseLinks(raw: string): TemplateLink[] {
  try {
    const v = JSON.parse(raw || "[]") as TemplateLink[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<"queue" | "templates">("queue");
  const [reviewLink, setReviewLink] = useState("");
  const [pending, setPending] = useState<PendingSms[]>([]);
  const [recent, setRecent] = useState<ReviewSms[]>([]);
  const [muted, setMuted] = useState<MutedClient[]>([]);
  const [completes, setCompletes] = useState<CompleteEvent[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [variables, setVariables] = useState<Array<{ key: string; desc: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editBodies, setEditBodies] = useState<Record<string, string>>({});

  const [tplName, setTplName] = useState("");
  const [tplBody, setTplBody] = useState(
    "Hi {{firstName}}! Thanks for choosing QuickClean. We'd love a quick review: {{reviewLink}}",
  );
  const [tplImage, setTplImage] = useState("");
  const [tplLinks, setTplLinks] = useState<TemplateLink[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/reviews");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load review queue");
      return;
    }
    setReviewLink(data.reviewLink || "");
    setPending(data.pending || []);
    setRecent(data.recentReviews || []);
    setMuted(data.mutedClients || []);
    setCompletes(data.recentCompletes || []);
    const bodies: Record<string, string> = {};
    for (const m of data.pending || []) bodies[m.id] = m.content;
    setEditBodies(bodies);
  }, []);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/templates?kind=REVIEW");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load templates");
      return;
    }
    setTemplates(data.templates || []);
    setVariables(data.variables || []);
  }, []);

  useEffect(() => {
    void loadQueue();
    void loadTemplates();
  }, [loadQueue, loadTemplates]);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.isActive) || null,
    [templates],
  );

  async function decide(id: string, action: "approve" | "deny") {
    setBusyId(id);
    setError(null);
    setOk(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: id,
        action,
        contentOverride: action === "approve" ? editBodies[id] : undefined,
      }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "Action failed");
      return;
    }
    setOk(action === "approve" ? "Review SMS sent." : "Review SMS denied.");
    await loadQueue();
  }

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
    await loadQueue();
  }

  function startEdit(t: Template) {
    setEditingId(t.id);
    setTplName(t.name);
    setTplBody(t.body);
    setTplImage(t.imageUrl || "");
    setTplLinks(parseLinks(t.linksJson));
    setTab("templates");
  }

  function resetForm() {
    setEditingId(null);
    setTplName("");
    setTplBody(
      "Hi {{firstName}}! Thanks for choosing QuickClean. We'd love a quick review: {{reviewLink}}",
    );
    setTplImage("");
    setTplLinks([]);
  }

  async function saveTemplate(setActive: boolean) {
    if (!tplName.trim() || !tplBody.trim()) {
      setError("Name and message body are required");
      return;
    }
    setError(null);
    setOk(null);
    setBusyId("tpl");
    const payload = {
      name: tplName,
      kind: "REVIEW" as const,
      body: tplBody,
      imageUrl: tplImage.trim() || null,
      links: tplLinks.filter((l) => l.key && l.url),
      setActive,
    };
    const res = await fetch(editingId ? `/api/templates/${editingId}` : "/api/templates", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "Could not save template");
      return;
    }
    setOk(setActive ? "Template saved and set as active." : "Template saved.");
    resetForm();
    await loadTemplates();
  }

  async function activate(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setActive: true }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not activate");
      return;
    }
    setOk("Active review template updated.");
    await loadTemplates();
  }

  async function removeTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    setBusyId(id);
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not delete");
      return;
    }
    await loadTemplates();
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Review SMS</H1>
        <Muted>
          When a Jobber job is closed, a draft text is queued here. Approve or deny before it
          sends. Quo cannot send images as MMS via API — add an image URL and it goes in as a
          text link.
        </Muted>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "queue" ? "primary" : "secondary"}
          onClick={() => setTab("queue")}
        >
          Approval queue ({pending.length})
        </Button>
        <Button
          type="button"
          variant={tab === "templates" ? "primary" : "secondary"}
          onClick={() => setTab("templates")}
        >
          Templates
        </Button>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}
      {ok ? <Alert tone="ok">{ok}</Alert> : null}

      {tab === "queue" ? (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Waiting for approval</h2>
                <p className="text-sm text-[var(--qc-muted)]">
                  Active template:{" "}
                  {activeTemplate ? activeTemplate.name : "none (using fallback body)"}
                  {reviewLink ? (
                    <>
                      {" "}
                      · Review link:{" "}
                      <a
                        href={reviewLink}
                        className="text-[var(--qc-accent)]"
                        target="_blank"
                        rel="noreferrer"
                      >
                        open
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => void loadQueue()}>
                Refresh
              </Button>
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-[var(--qc-muted)]">
                No drafts waiting. Close a job in Jobber to queue one.
              </p>
            ) : (
              <div className="space-y-4">
                {pending.map((m) => (
                  <div
                    key={m.id}
                    className="space-y-2 rounded-xl border border-[var(--qc-line)] p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="font-medium">{m.clientName || m.to}</div>
                        <div className="text-sm text-[var(--qc-muted)]">
                          {m.to}
                          {m.template ? ` · template: ${m.template.name}` : ""}
                          {" · "}
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <Badge tone="warn">Awaiting approval</Badge>
                    </div>
                    <Textarea
                      rows={4}
                      value={editBodies[m.id] ?? m.content}
                      onChange={(e) =>
                        setEditBodies((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => void decide(m.id, "approve")}
                      >
                        {busyId === m.id ? "…" : "Approve & send"}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        disabled={busyId === m.id}
                        onClick={() => void decide(m.id, "deny")}
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Recent review texts</h2>
            {recent.length === 0 ? (
              <p className="text-sm text-[var(--qc-muted)]">None yet.</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {recent.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap justify-between gap-2 border-b border-[var(--qc-line)] py-2 last:border-0"
                  >
                    <div>
                      <div className="font-medium">{m.clientName || m.to}</div>
                      <div className="text-[var(--qc-muted)]">{m.to}</div>
                      <div className="mt-1 max-w-md text-xs text-[var(--qc-muted)]">
                        {m.content}
                      </div>
                    </div>
                    <Badge
                      tone={
                        m.status === "SENT"
                          ? "ok"
                          : m.status === "DENIED"
                            ? "warn"
                            : m.status === "FAILED"
                              ? "bad"
                              : undefined
                      }
                    >
                      {m.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Muted clients ({muted.length})</h2>
            <p className="text-sm text-[var(--qc-muted)]">
              Toggle mute on{" "}
              <Link href="/admin/clients" className="text-[var(--qc-accent)] underline">
                Clients
              </Link>{" "}
              so bad clients never enter this queue.
            </p>
            {muted.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--qc-line)] py-2 last:border-0"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-[var(--qc-muted)]">{c.phone || "No phone"}</div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyId === c.id}
                  onClick={() => void unmute(c.id)}
                >
                  Allow review SMS
                </Button>
              </div>
            ))}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Recent job-closed webhooks</h2>
            {completes.length === 0 ? (
              <p className="text-sm text-[var(--qc-muted)]">None yet.</p>
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
                    <Badge
                      tone={
                        e.error
                          ? "warn"
                          : e.reason === "awaiting_approval"
                            ? "ok"
                            : e.reason === "skip_review"
                              ? "warn"
                              : undefined
                      }
                    >
                      {e.error
                        ? "error"
                        : e.reason === "awaiting_approval"
                          ? "queued"
                          : e.reason || "processed"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          <Card className="space-y-3">
            <h2 className="font-semibold">
              {editingId ? "Edit review template" : "New review template"}
            </h2>
            <p className="text-sm text-[var(--qc-muted)]">
              Variables:{" "}
              {variables.map((v) => `{{${v.key}}}`).join(", ")}
            </p>
            <form
              className="space-y-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void saveTemplate(false);
              }}
            >
              <div>
                <Label>Name</Label>
                <Input
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Season review ask"
                />
              </div>
              <div>
                <Label>Message body</Label>
                <Textarea
                  required
                  rows={5}
                  maxLength={1600}
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                />
              </div>
              <div>
                <Label>Image URL (optional — sent as a text link)</Label>
                <Input
                  value={tplImage}
                  onChange={(e) => setTplImage(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Extra links (use {"{{key}}"} in the body)</Label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setTplLinks((prev) => [
                        ...prev,
                        { key: `link${prev.length + 1}`, label: "", url: "" },
                      ])
                    }
                  >
                    Add link
                  </Button>
                </div>
                {tplLinks.map((l, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-3">
                    <Input
                      placeholder="key (booking)"
                      value={l.key}
                      onChange={(e) =>
                        setTplLinks((prev) =>
                          prev.map((x, idx) =>
                            idx === i ? { ...x, key: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder="https://…"
                      value={l.url}
                      onChange={(e) =>
                        setTplLinks((prev) =>
                          prev.map((x, idx) =>
                            idx === i ? { ...x, url: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setTplLinks((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busyId === "tpl"}>
                  {editingId ? "Save changes" : "Save template"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyId === "tpl"}
                  onClick={() => void saveTemplate(true)}
                >
                  Save & use as active
                </Button>
                {editingId ? (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Saved review templates</h2>
            {templates.length === 0 ? (
              <p className="text-sm text-[var(--qc-muted)]">No templates yet.</p>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className="space-y-2 rounded-xl border border-[var(--qc-line)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      {t.name}{" "}
                      {t.isActive ? <Badge tone="ok">Active</Badge> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!t.isActive ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busyId === t.id}
                          onClick={() => void activate(t.id)}
                        >
                          Use this
                        </Button>
                      ) : null}
                      <Button type="button" variant="secondary" onClick={() => startEdit(t)}>
                        Edit
                      </Button>
                      {!t.isActive ? (
                        <Button
                          type="button"
                          variant="danger"
                          disabled={busyId === t.id}
                          onClick={() => void removeTemplate(t.id)}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-[var(--qc-muted)]">
                    {t.body}
                  </pre>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  );
}
