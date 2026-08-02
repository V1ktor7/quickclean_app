import { NextRequest, NextResponse } from "next/server";
import { jobberGraphQL } from "@/lib/jobber/client";
import {
  exchangeAuthorizationCode,
  saveConnection,
} from "@/lib/jobber/oauth";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const fail = (msg: string) =>
    NextResponse.redirect(
      new URL(`/admin?jobber=error&message=${encodeURIComponent(msg)}`, url.origin),
    );

  if (error) return fail(error);
  if (!code || !state) return fail("Missing OAuth code or state");

  const expectedState = req.cookies.get("jobber_oauth_state")?.value;
  const codeVerifier = req.cookies.get("jobber_oauth_verifier")?.value;
  if (!expectedState || state !== expectedState || !codeVerifier) {
    return fail("Invalid OAuth state. Try Connect Jobber again.");
  }

  try {
    const tokens = await exchangeAuthorizationCode({ code, codeVerifier });
    await saveConnection(tokens);

    // Enrich with account metadata (uses stored token)
    try {
      const account = await jobberGraphQL<{ account: { id: string; name: string } }>(
        `query { account { id name } }`,
      );
      await saveConnection(tokens, {
        accountId: account.account.id,
        accountName: account.account.name,
      });
    } catch {
      /* optional */
    }

    const res = NextResponse.redirect(new URL("/admin?jobber=connected", url.origin));
    res.cookies.delete("jobber_oauth_state");
    res.cookies.delete("jobber_oauth_verifier");
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth exchange failed";
    return fail(message);
  }
}
