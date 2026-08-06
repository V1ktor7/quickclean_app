import { Role, SMSKind } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import {
  serializeLinks,
  setActiveTemplate,
  TEMPLATE_VARIABLE_HELP,
  type TemplateLink,
} from "@/lib/sms/templates";

const linkSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().max(80).optional(),
  url: z.string().url().max(500),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["REVIEW", "MARKETING"]),
  body: z.string().min(1).max(1600),
  links: z.array(linkSchema).max(10).optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  setActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    await requireRole(Role.ADMIN);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const templates = await prisma.sMSTemplate.findMany({
      where:
        kind === "REVIEW" || kind === "MARKETING"
          ? { kind: kind as SMSKind }
          : undefined,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });
    return Response.json({
      templates,
      variables: TEMPLATE_VARIABLE_HELP,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(Role.ADMIN);
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const links = (parsed.data.links ?? []) as TemplateLink[];
    const template = await prisma.sMSTemplate.create({
      data: {
        name: parsed.data.name,
        kind: parsed.data.kind as SMSKind,
        body: parsed.data.body,
        linksJson: serializeLinks(links),
        imageUrl: parsed.data.imageUrl ?? null,
        isActive: false,
      },
    });

    if (parsed.data.setActive) {
      await setActiveTemplate(template.id);
    }

    const fresh = await prisma.sMSTemplate.findUnique({ where: { id: template.id } });
    return Response.json({ template: fresh }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
