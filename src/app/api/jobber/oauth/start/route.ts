import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { buildAuthorizeUrl, createPkcePair, jobberOAuthConfigured } from "@/lib/jobber/oauth";

export async function GET() {
  try {
    await requireRole(Role.ADMIN);
    if (!jobberOAuthConfigured()) {
      return Response.json(
        { error: "Set JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET in env" },
        { status: 503 },
      );
    }

    const { codeVerifier, codeChallenge, state } = createPkcePair();
    const url = buildAuthorizeUrl({ state, codeChallenge });

    const res = NextResponse.redirect(url);
    res.cookies.set("jobber_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    res.cookies.set("jobber_oauth_verifier", codeVerifier, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
