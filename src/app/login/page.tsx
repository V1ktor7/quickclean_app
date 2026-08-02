import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            QuickClean<span className="text-[var(--qc-accent)]">.</span>
          </div>
          <p className="mt-2 text-sm text-[var(--qc-muted)]">Ops Hub — sign in to continue</p>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-[var(--qc-muted)]">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
