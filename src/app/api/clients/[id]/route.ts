import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";

const updateSchema = z.object({
  skipReviewSms: z.boolean().optional(),
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
    if (typeof parsed.data.skipReviewSms !== "boolean") {
      throw new AppError("Nothing to update", 400);
    }

    const client = await prisma.jobberClient.update({
      where: { id },
      data: { skipReviewSms: parsed.data.skipReviewSms },
      select: {
        id: true,
        name: true,
        phone: true,
        skipReviewSms: true,
        updatedAt: true,
      },
    });

    return Response.json({ client });
  } catch (err) {
    return jsonError(err);
  }
}
