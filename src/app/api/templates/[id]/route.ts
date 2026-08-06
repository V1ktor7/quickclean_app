import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import {
  serializeLinks,
  setActiveTemplate,
  type TemplateLink,
} from "@/lib/sms/templates";

const linkSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().max(80).optional(),
  url: z.string().url().max(500),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(1600).optional(),
  links: z.array(linkSchema).max(10).optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  setActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(Role.ADMIN);
    const { id } = await ctx.params;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const existing = await prisma.sMSTemplate.findUnique({ where: { id } });
    if (!existing) throw new AppError("Template not found", 404);

    const data: {
      name?: string;
      body?: string;
      linksJson?: string;
      imageUrl?: string | null;
    } = {};
    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.body) data.body = parsed.data.body;
    if (parsed.data.links) data.linksJson = serializeLinks(parsed.data.links as TemplateLink[]);
    if (parsed.data.imageUrl !== undefined) data.imageUrl = parsed.data.imageUrl;

    await prisma.sMSTemplate.update({ where: { id }, data });

    if (parsed.data.setActive) {
      await setActiveTemplate(id);
    }

    const template = await prisma.sMSTemplate.findUnique({ where: { id } });
    return Response.json({ template });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(Role.ADMIN);
    const { id } = await ctx.params;
    const existing = await prisma.sMSTemplate.findUnique({ where: { id } });
    if (!existing) throw new AppError("Template not found", 404);
    if (existing.isActive) {
      throw new AppError("Set another template as active before deleting this one", 400);
    }
    await prisma.sMSTemplate.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
