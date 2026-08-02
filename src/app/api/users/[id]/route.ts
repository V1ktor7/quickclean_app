import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["SALES", "TECH", "ADMIN"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole(Role.ADMIN);
    const { id } = await ctx.params;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    if (id === admin.id && parsed.data.active === false) {
      throw new AppError("Cannot deactivate your own account", 400);
    }

    const data: {
      name?: string;
      role?: Role;
      active?: boolean;
      passwordHash?: string;
    } = {};

    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.role) data.role = parsed.data.role as Role;
    if (typeof parsed.data.active === "boolean") data.active = parsed.data.active;
    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        updatedAt: true,
      },
    });

    return Response.json({ user });
  } catch (err) {
    return jsonError(err);
  }
}
