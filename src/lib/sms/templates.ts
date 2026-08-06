import { SMSKind, type SMSTemplate } from "@prisma/client";
import { prisma } from "@/lib/db";

export type TemplateLink = {
  key: string;
  label?: string;
  url: string;
};

export type TemplateVars = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  reviewLink?: string | null;
  jobTitle?: string | null;
  /** Extra custom keys (from template links, etc.) */
  [key: string]: string | null | undefined;
};

export const TEMPLATE_VARIABLE_HELP = [
  { key: "name", desc: "Full client name" },
  { key: "firstName", desc: "First name (falls back to first word of name)" },
  { key: "lastName", desc: "Last name" },
  { key: "phone", desc: "Client phone" },
  { key: "email", desc: "Client email" },
  { key: "company", desc: "QuickClean" },
  { key: "reviewLink", desc: "Google review URL (same as {{link}})" },
  { key: "link", desc: "Alias for reviewLink" },
  { key: "jobTitle", desc: "Job title (review SMS)" },
  { key: "imageUrl", desc: "Template image URL as text (Quo API cannot send MMS)" },
  {
    key: "<linkKey>",
    desc: "Any key from saved template links, e.g. {{booking}}",
  },
] as const;

export function defaultReviewLink() {
  return (
    process.env.REVIEW_LINK_URL ?? "https://g.page/r/CQzw419aCqLaEAE/review"
  );
}

export function parseTemplateLinks(raw: string | null | undefined): TemplateLink[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const links: TemplateLink[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const key = typeof o.key === "string" ? o.key.trim() : "";
      const url = typeof o.url === "string" ? o.url.trim() : "";
      if (!key || !url) continue;
      links.push({
        key: key.replace(/[^a-zA-Z0-9_]/g, ""),
        label: typeof o.label === "string" ? o.label : undefined,
        url,
      });
    }
    return links;
  } catch {
    return [];
  }
}

export function resolveFirstName(vars: TemplateVars): string {
  if (vars.firstName?.trim()) return vars.firstName.trim();
  const name = vars.name?.trim() || "";
  if (!name) return "there";
  return name.split(/\s+/)[0] || "there";
}

export function buildVarMap(
  template: Pick<SMSTemplate, "linksJson" | "imageUrl" | "body">,
  vars: TemplateVars,
): Record<string, string> {
  const reviewLink = vars.reviewLink || defaultReviewLink();
  const links = parseTemplateLinks(template.linksJson);
  const map: Record<string, string> = {
    name: vars.name?.trim() || "",
    firstName: resolveFirstName(vars),
    lastName: vars.lastName?.trim() || "",
    phone: vars.phone?.trim() || "",
    email: vars.email?.trim() || "",
    company: vars.company?.trim() || "QuickClean",
    reviewLink,
    link: reviewLink,
    jobTitle: vars.jobTitle?.trim() || "",
    imageUrl: template.imageUrl?.trim() || vars.imageUrl?.trim() || "",
  };

  for (const l of links) {
    map[l.key] = l.url;
  }

  for (const [k, v] of Object.entries(vars)) {
    if (v != null && map[k] === undefined) map[k] = String(v);
  }

  return map;
}

export function renderTemplateBody(
  body: string,
  template: Pick<SMSTemplate, "linksJson" | "imageUrl">,
  vars: TemplateVars,
): string {
  const map = buildVarMap({ ...template, body }, vars);
  let out = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return map[key] ?? "";
  });

  // Append image URL if set on template but not referenced in body
  const imageUrl = template.imageUrl?.trim();
  if (imageUrl && !body.includes("{{imageUrl}}") && !out.includes(imageUrl)) {
    out = `${out.trim()}\n\nPhoto: ${imageUrl}`;
  }

  return out.trim().slice(0, 1600);
}

export async function getActiveTemplate(kind: SMSKind) {
  return prisma.sMSTemplate.findFirst({
    where: { kind, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function setActiveTemplate(id: string) {
  const tpl = await prisma.sMSTemplate.findUnique({ where: { id } });
  if (!tpl) return null;
  await prisma.$transaction([
    prisma.sMSTemplate.updateMany({
      where: { kind: tpl.kind, isActive: true },
      data: { isActive: false },
    }),
    prisma.sMSTemplate.update({
      where: { id },
      data: { isActive: true },
    }),
  ]);
  return prisma.sMSTemplate.findUnique({ where: { id } });
}

export function serializeLinks(links: TemplateLink[]): string {
  return JSON.stringify(
    links.map((l) => ({
      key: l.key.replace(/[^a-zA-Z0-9_]/g, ""),
      label: l.label || l.key,
      url: l.url,
    })),
  );
}
