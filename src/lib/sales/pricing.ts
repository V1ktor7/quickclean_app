export type WindowQuoteInput = {
  panes: number;
  floors: number;
  panesAbove: number;
  method: number;
  sides: number;
  discountType: "none" | "plan" | "special";
  discountAmount: number;
};

export type WindowQuoteResult = {
  isCustomEstimate: boolean;
  base: number;
  floorFactor: number;
  gross: number;
  visits: number;
  perVisitDisc: number;
  perVisit: number;
  perVisitRounded: number;
  annual: number;
  windowAmount: number;
  summary: string;
  rows: Array<{ label: string; value: string }>;
};

function round5(x: number) {
  return Math.round(x / 5) * 5;
}

export function computeWindowQuote(input: WindowQuoteInput): WindowQuoteResult {
  const N = Math.min(Math.max(input.panes || 0, 0), 300);
  const floors = input.floors || 3;
  const above = Math.min(Math.max(input.panesAbove || 0, 0), N || 0);
  const method = input.method || 1;
  const sides = input.sides || 1;
  const disc = input.discountType || "none";
  const discAmt = Math.max(input.discountAmount || 0, 0);

  if (N > 170) {
    return {
      isCustomEstimate: true,
      base: 0,
      floorFactor: floors >= 4 ? 1 + 0.67 * (above / Math.max(N, 1)) : 1,
      gross: 0,
      visits: disc === "plan" ? 2 : 1,
      perVisitDisc: 0,
      perVisit: 0,
      perVisitRounded: 0,
      annual: 0,
      windowAmount: 0,
      summary: `${N} panes · on-site estimate`,
      rows: [
        { label: "Panes", value: String(N) },
        { label: "Pricing", value: "Book a walk-through" },
      ],
    };
  }

  const base = Math.max(162 * Math.log(Math.max(N, 1)) - 317, 175);
  const floorFactor = floors >= 4 ? 1 + 0.67 * (above / Math.max(N, 1)) : 1;
  const gross = base * floorFactor * method * sides;
  const visits = disc === "plan" ? 2 : 1;
  const perVisitDisc = disc === "none" ? 0 : discAmt;
  const perVisit = Math.max(gross - perVisitDisc, 0);
  const perVisitRounded = round5(perVisit);
  const annual = perVisitRounded * visits;
  const windowAmount = visits === 2 ? annual : perVisitRounded;

  const afterF = base * floorFactor;
  const afterM = afterF * method;
  const afterS = afterM * sides;
  const rows: Array<{ label: string; value: string }> = [
    { label: `Base price (${N} panes)`, value: `$${Math.round(base)}` },
  ];
  if (floorFactor !== 1) {
    rows.push({
      label: `Extra floors (${floors === 6 ? "6+" : floors})`,
      value: `+$${Math.round(afterF - base)}`,
    });
  }
  if (method !== 1) {
    rows.push({
      label: "Manual method",
      value: `+$${Math.round(afterM - afterF)}`,
    });
  }
  if (sides !== 1) {
    rows.push({
      label: "Inside + outside",
      value: `+$${Math.round(afterS - afterM)}`,
    });
  }
  if (visits === 2) {
    if (perVisitDisc > 0) {
      rows.push({
        label: `Bi-annual discount (−$${perVisitDisc} / visit)`,
        value: `−$${perVisitDisc}`,
      });
    }
    rows.push({ label: "Price per visit", value: `$${perVisitRounded}` });
    rows.push({ label: "Total — 2 visits / year", value: `$${annual}` });
  } else {
    if (perVisitDisc > 0) {
      rows.push({ label: "Special discount", value: `−$${perVisitDisc}` });
    }
    rows.push({ label: "Window total", value: `$${perVisitRounded}` });
  }

  const parts = [`${N} panes`];
  parts.push(floors >= 4 ? (floors === 6 ? "6+ floors" : `${floors} floors`) : "1–3 floors");
  if (method !== 1) parts.push("manual");
  parts.push(sides !== 1 ? "inside + out" : "exterior");
  if (visits === 2) parts.push("bi-annual");

  return {
    isCustomEstimate: false,
    base,
    floorFactor,
    gross,
    visits,
    perVisitDisc,
    perVisit,
    perVisitRounded,
    annual,
    windowAmount,
    summary: parts.join(" · "),
    rows,
  };
}

export function estimateAbovePanes(panes: number, floors: number) {
  const share = floors === 4 ? 0.25 : floors === 5 ? 0.4 : floors === 6 ? 0.55 : 0;
  return Math.round(panes * share);
}
