import { Role } from "@prisma/client";
import { jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { getConnectionStatus } from "@/lib/jobber/oauth";

export async function GET() {
  try {
    await requireRole(Role.ADMIN);
    const status = await getConnectionStatus();
    return Response.json(status);
  } catch (err) {
    return jsonError(err);
  }
}
