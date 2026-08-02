"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type NavItem = { href: string; label: string };

export function PortalShell({
  brand,
  roleLabel,
  userName,
  nav,
  children,
}: {
  brand: string;
  roleLabel: string;
  userName: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--qc-bg)] text-[var(--qc-ink)]">
      <header className="border-b border-[var(--qc-line)] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">
              {brand}
              <span className="text-[var(--qc-accent)]">.</span>
            </Link>
            <span className="rounded-md bg-[var(--qc-mint)] px-2 py-0.5 text-xs font-semibold text-[var(--qc-deep)]">
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--qc-muted)]">{userName}</span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-[var(--qc-line)] px-3 py-1.5 font-medium hover:bg-[var(--qc-bg)]"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${
                  active
                    ? "bg-[var(--qc-accent)] text-white"
                    : "text-[var(--qc-muted)] hover:bg-[var(--qc-bg)] hover:text-[var(--qc-ink)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
