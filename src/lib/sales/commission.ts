import type { SalesQuote } from "@prisma/client";
import type { SalesServiceKey } from "@/lib/sales/services";

type RateRow = { userId: string; serviceKey: string; percent: number };

export function rateMapForUser(userId: string, rates: RateRow[]) {
  const map: Partial<Record<SalesServiceKey, number>> = {};
  for (const r of rates) {
    if (r.userId !== userId) continue;
    map[r.serviceKey as SalesServiceKey] = r.percent;
  }
  return map;
}

/** Estimate salesman commission dollars for a quote. */
export function estimateQuoteCommission(
  quote: Pick<
    SalesQuote,
    | "createdById"
    | "windowAmount"
    | "gutterAmount"
    | "spiderAmount"
    | "servicePlanAmount"
    | "discountType"
    | "isCustomEstimate"
  >,
  rates: RateRow[],
) {
  const map = rateMapForUser(quote.createdById, rates);
  const lines: Array<{ key: SalesServiceKey; label: string; amount: number; percent: number; commission: number }> =
    [];

  const push = (
    key: SalesServiceKey,
    label: string,
    amount: number,
  ) => {
    if (amount <= 0) return;
    const percent = map[key] ?? 0;
    lines.push({
      key,
      label,
      amount,
      percent,
      commission: (amount * percent) / 100,
    });
  };

  // Bi-annual / service-plan window quotes earn on SERVICE_PLAN rate; one-offs on WINDOW.
  if (!quote.isCustomEstimate && quote.windowAmount > 0) {
    if (quote.discountType === "plan") {
      push("SERVICE_PLAN", "Service plan (bi-annual windows)", quote.windowAmount);
    } else {
      push("WINDOW", "Window cleaning", quote.windowAmount);
    }
  }
  push("GUTTER", "Gutter cleaning", quote.gutterAmount);
  push("SPIDER", "Spider treatment", quote.spiderAmount);
  if (quote.discountType !== "plan") {
    push("SERVICE_PLAN", "Service plan", quote.servicePlanAmount);
  } else if (quote.servicePlanAmount > 0) {
    push("SERVICE_PLAN", "Service plan (extra)", quote.servicePlanAmount);
  }

  const total = lines.reduce((s, l) => s + l.commission, 0);
  return { lines, total };
}
