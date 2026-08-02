import { Role } from "@prisma/client";
import { jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { syncAllJobber } from "@/lib/jobber/sync";

export async function POST() {
  try {
    await requireRole(Role.ADMIN);
    const result = await syncAllJobber();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Jobber sync failed");
  }
}
