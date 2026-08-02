import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { absoluteUrl, getJobberEndpoints } from "@/lib/jobber/urls";
import { getJobberRedirectUri, getConnectionStatus } from "@/lib/jobber/oauth";

export async function GET() {
  try {
    await requireRole(Role.ADMIN);

    const [status, recent] = await Promise.all([
      getConnectionStatus(),
      prisma.webhookEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const endpoints = getJobberEndpoints().map((e) => ({
      ...e,
      url: absoluteUrl(e.path),
    }));

    return Response.json({
      baseUrl: absoluteUrl(""),
      oauthCallbackUrl: getJobberRedirectUri(),
      endpoints,
      connection: status,
      recentEvents: recent,
    });
  } catch (err) {
    return jsonError(err);
  }
}
