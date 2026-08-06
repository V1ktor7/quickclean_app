"use client";

import { FormEvent, useMemo, useState } from "react";
import { Alert, Button, Card, H1, Input, Label, Muted, Textarea } from "@/components/ui";
import { computeWindowQuote, estimateAbovePanes } from "@/lib/sales/pricing";

export default function SalesQuotePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [panes, setPanes] = useState(45);
  const [floors, setFloors] = useState(3);
  const [panesAbove, setPanesAbove] = useState(0);
  const [aboveTouched, setAboveTouched] = useState(false);
  const [method, setMethod] = useState(1);
  const [sides, setSides] = useState(1);
  const [discountType, setDiscountType] = useState<"none" | "plan" | "special">("none");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [gutterAmount, setGutterAmount] = useState(0);
  const [spiderAmount, setSpiderAmount] = useState(0);
  const [servicePlanAmount, setServicePlanAmount] = useState(0);
  const [pushToJobber, setPushToJobber] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const effectiveAbove = aboveTouched ? panesAbove : estimateAbovePanes(panes, floors);

  const window = useMemo(
    () =>
      computeWindowQuote({
        panes,
        floors,
        panesAbove: effectiveAbove,
        method,
        sides,
        discountType,
        discountAmount,
      }),
    [panes, floors, effectiveAbove, method, sides, discountType, discountAmount],
  );

  const total =
    (window.isCustomEstimate ? 0 : window.windowAmount) +
    gutterAmount +
    spiderAmount +
    servicePlanAmount;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        email,
        address,
        notes,
        panes,
        floors,
        panesAbove: effectiveAbove,
        method,
        sides,
        discountType,
        discountAmount,
        gutterAmount,
        spiderAmount,
        servicePlanAmount,
        pushToJobber,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save quote");
      return;
    }
    setOk(`Quote saved for ${name}. Admin can see it under Leads with your name tag.`);
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setGutterAmount(0);
    setSpiderAmount(0);
    setServicePlanAmount(0);
    setPushToJobber(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>New quote</H1>
        <Muted>
          Capture the client, build the Pane window quote, add gutter / spider / plan lines, then
          save — Admin sees everything with your name on it.
        </Muted>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}
      {ok ? <Alert tone="ok">{ok}</Alert> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="space-y-3">
          <h2 className="font-semibold">Client</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Window cleaning (Pane)</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Panes</Label>
              <Input
                type="number"
                min={1}
                max={300}
                value={panes}
                onChange={(e) => {
                  setPanes(Number(e.target.value) || 1);
                  setAboveTouched(false);
                }}
              />
            </div>
            <div>
              <Label>Floors</Label>
              <select
                className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2 text-sm"
                value={floors}
                onChange={(e) => {
                  setFloors(Number(e.target.value));
                  setAboveTouched(false);
                }}
              >
                <option value={3}>1–3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6+</option>
              </select>
            </div>
            {floors >= 4 ? (
              <div>
                <Label>Panes above 3rd floor</Label>
                <Input
                  type="number"
                  min={0}
                  max={panes}
                  value={effectiveAbove}
                  onChange={(e) => {
                    setPanesAbove(Number(e.target.value) || 0);
                    setAboveTouched(true);
                  }}
                />
              </div>
            ) : null}
            <div>
              <Label>Method</Label>
              <select
                className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2 text-sm"
                value={method}
                onChange={(e) => setMethod(Number(e.target.value))}
              >
                <option value={1}>Pole</option>
                <option value={1.5}>Manual</option>
              </select>
            </div>
            <div>
              <Label>Sides</Label>
              <select
                className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2 text-sm"
                value={sides}
                onChange={(e) => setSides(Number(e.target.value))}
              >
                <option value={1}>Exterior</option>
                <option value={1.8}>Inside + out</option>
              </select>
            </div>
            <div>
              <Label>Discount</Label>
              <select
                className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2 text-sm"
                value={discountType}
                onChange={(e) => {
                  const v = e.target.value as "none" | "plan" | "special";
                  setDiscountType(v);
                  setDiscountAmount(v === "none" ? 0 : v === "plan" ? 50 : 75);
                }}
              >
                <option value="none">None</option>
                <option value="plan">Bi-annual (service plan)</option>
                <option value="special">Special</option>
              </select>
            </div>
            {discountType !== "none" ? (
              <div>
                <Label>{discountType === "plan" ? "Off each visit ($)" : "Amount off ($)"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                />
              </div>
            ) : null}
          </div>
          <div className="rounded-xl bg-[var(--qc-bg)] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--qc-muted)]">
              Window quote
            </div>
            <div className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold">
              {window.isCustomEstimate ? "On-site estimate" : `$${window.windowAmount}`}
            </div>
            <div className="text-sm text-[var(--qc-muted)]">{window.summary}</div>
            <div className="mt-3 space-y-1 text-sm">
              {window.rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-2">
                  <span className="text-[var(--qc-muted)]">{r.label}</span>
                  <span>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Add-on services ($)</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Gutter cleaning</Label>
              <Input
                type="number"
                min={0}
                step={5}
                value={gutterAmount}
                onChange={(e) => setGutterAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Spider treatment</Label>
              <Input
                type="number"
                min={0}
                step={5}
                value={spiderAmount}
                onChange={(e) => setSpiderAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Service plan (extra)</Label>
              <Input
                type="number"
                min={0}
                step={5}
                value={servicePlanAmount}
                onChange={(e) => setServicePlanAmount(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--qc-muted)]">
            Bi-annual window quotes already count as a service plan for commission. Use the extra
            field only for a separate plan fee.
          </p>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--qc-muted)]">
              Quote total
            </div>
            <div className="font-[family-name:var(--font-display)] text-3xl font-bold">
              {window.isCustomEstimate && total === 0 ? "Custom" : `$${total.toFixed(0)}`}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--qc-accent)]"
              checked={pushToJobber}
              onChange={(e) => setPushToJobber(e.target.checked)}
            />
            Flag for Jobber follow-up
          </label>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Save quote & lead"}
          </Button>
        </Card>
      </form>
    </div>
  );
}
