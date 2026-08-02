import crypto from "crypto";
import { prisma } from "@/lib/db";
import { AppError, fetchWithTimeout } from "@/lib/errors";

const AUTHORIZE_URL = "https://api.getjobber.com/api/oauth/authorize";
const TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
const CONNECTION_ID = "default";

export function getJobberClientId() {
  return process.env.JOBBER_CLIENT_ID ?? "";
}

export function getJobberClientSecret() {
  return process.env.JOBBER_CLIENT_SECRET ?? "";
}

export function getJobberRedirectUri() {
  if (process.env.JOBBER_REDIRECT_URI) return process.env.JOBBER_REDIRECT_URI;
  const base =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/jobber/oauth/callback`;
}

export function jobberOAuthConfigured() {
  return Boolean(getJobberClientId() && getJobberClientSecret());
}

function base64Url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createPkcePair() {
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(
    crypto.createHash("sha256").update(codeVerifier).digest(),
  );
  const state = base64Url(crypto.randomBytes(16));
  return { codeVerifier, codeChallenge, state };
}

export function buildAuthorizeUrl(opts: {
  state: string;
  codeChallenge: string;
}) {
  const clientId = getJobberClientId();
  if (!clientId) {
    throw new AppError("Missing JOBBER_CLIENT_ID", 503, "JOBBER_UNCONFIGURED");
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getJobberRedirectUri(),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number;
};

async function exchangeToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetchWithTimeout(
    TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
    15000,
  );
  const text = await res.text();
  let json: TokenResponse & { error?: string; error_description?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new AppError(`Jobber token error: ${text.slice(0, 200)}`, 502);
  }
  if (!res.ok || !json.access_token) {
    throw new AppError(
      json.error_description || json.error || `Jobber token HTTP ${res.status}`,
      502,
      "JOBBER_TOKEN_ERROR",
    );
  }
  return json;
}

export async function exchangeAuthorizationCode(opts: {
  code: string;
  codeVerifier: string;
}) {
  const body = new URLSearchParams({
    client_id: getJobberClientId(),
    client_secret: getJobberClientSecret(),
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: getJobberRedirectUri(),
    code_verifier: opts.codeVerifier,
  });
  return exchangeToken(body);
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: getJobberClientId(),
    client_secret: getJobberClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return exchangeToken(body);
}

export async function saveConnection(tokens: TokenResponse, meta?: {
  accountId?: string | null;
  accountName?: string | null;
}) {
  const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);
  return prisma.jobberConnection.upsert({
    where: { id: CONNECTION_ID },
    create: {
      id: CONNECTION_ID,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      accountId: meta?.accountId ?? null,
      accountName: meta?.accountName ?? null,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      accountId: meta?.accountId ?? undefined,
      accountName: meta?.accountName ?? undefined,
    },
  });
}

export async function getConnectionStatus() {
  const conn = await prisma.jobberConnection.findUnique({
    where: { id: CONNECTION_ID },
  });
  if (!conn) {
    return {
      connected: false,
      configured: jobberOAuthConfigured(),
      redirectUri: getJobberRedirectUri(),
    };
  }
  return {
    connected: true,
    configured: jobberOAuthConfigured(),
    redirectUri: getJobberRedirectUri(),
    accountId: conn.accountId,
    accountName: conn.accountName,
    expiresAt: conn.expiresAt.toISOString(),
  };
}

/** Returns a usable Jobber access token (OAuth connection or env fallback). */
export async function getValidAccessToken(): Promise<string> {
  const envToken = process.env.JOBBER_ACCESS_TOKEN?.trim();
  const conn = await prisma.jobberConnection.findUnique({
    where: { id: CONNECTION_ID },
  });

  if (conn) {
    if (conn.expiresAt.getTime() > Date.now() + 30_000) {
      return conn.accessToken;
    }
    if (jobberOAuthConfigured() && conn.refreshToken) {
      const tokens = await refreshAccessToken(conn.refreshToken);
      await saveConnection(tokens, {
        accountId: conn.accountId,
        accountName: conn.accountName,
      });
      return tokens.access_token;
    }
  }

  if (envToken) return envToken;

  throw new AppError(
    "Jobber is not connected. Admin must Connect Jobber (OAuth) or set JOBBER_ACCESS_TOKEN.",
    503,
    "JOBBER_UNCONFIGURED",
  );
}

export async function clearConnection() {
  await prisma.jobberConnection.deleteMany({ where: { id: CONNECTION_ID } });
}
