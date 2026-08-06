export const SALES_SERVICES = [
  { key: "WINDOW", label: "Window cleaning" },
  { key: "GUTTER", label: "Gutter cleaning" },
  { key: "SPIDER", label: "Spider treatment" },
  { key: "SERVICE_PLAN", label: "Service plan" },
] as const;

export type SalesServiceKey = (typeof SALES_SERVICES)[number]["key"];

export function isSalesServiceKey(v: string): v is SalesServiceKey {
  return SALES_SERVICES.some((s) => s.key === v);
}
