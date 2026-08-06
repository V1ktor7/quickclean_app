import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC = [
  "/login",
  "/api/auth",
  "/api/webhooks/jobber",
  "/api/jobber/oauth/callback",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Auth.js uses `__Secure-authjs.session-token` on HTTPS; getToken must match.
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: req.nextUrl.protocol === "https:",
  });

  if (!token || token.active === false) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = token.role as string;

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/clients") ||
    pathname.startsWith("/api/campaigns") ||
    pathname.startsWith("/api/jobber") ||
    pathname.startsWith("/api/commission-rates") ||
    pathname.startsWith("/api/templates") ||
    pathname.startsWith("/api/reviews")
  ) {
    if (role !== "ADMIN") {
      return deny(req, role);
    }
  }

  if (
    pathname.startsWith("/api/availability") ||
    pathname.startsWith("/api/schedule")
  ) {
    if (role !== "TECH" && role !== "SALES" && role !== "ADMIN") {
      return deny(req, role);
    }
  }

  if (
    pathname.startsWith("/sales") ||
    pathname.startsWith("/sales-tools") ||
    pathname.startsWith("/api/quotes") ||
    pathname.startsWith("/api/leads")
  ) {
    if (role !== "SALES" && role !== "ADMIN") {
      return deny(req, role);
    }
  }

  if (pathname.startsWith("/tech") || pathname.startsWith("/api/time-logs") || pathname.startsWith("/api/upsells") || pathname.startsWith("/api/checklists")) {
    if (role !== "TECH" && role !== "ADMIN") {
      return deny(req, role);
    }
  }

  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = home(role);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

function home(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "SALES") return "/sales";
  if (role === "TECH") return "/tech";
  return "/login";
}

function deny(req: NextRequest, role: string) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = req.nextUrl.clone();
  url.pathname = home(role);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
