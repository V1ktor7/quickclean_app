import { type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--qc-line)] bg-white p-5 shadow-[var(--qc-shadow)] ${className}`}>
      {children}
    </div>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">
      {children}
    </h1>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-sm text-[var(--qc-muted)]">{children}</p>;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary: "bg-[var(--qc-accent)] text-white hover:bg-[var(--qc-deep)] disabled:bg-[var(--qc-line)] disabled:text-[var(--qc-muted)]",
    secondary: "border border-[var(--qc-line)] bg-white hover:bg-[var(--qc-bg)]",
    danger: "bg-[var(--qc-danger)] text-white hover:opacity-90",
    ghost: "text-[var(--qc-muted)] hover:bg-[var(--qc-bg)]",
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--qc-accent)]"
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--qc-accent)]"
      {...props}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold tracking-wide text-[var(--qc-muted)] uppercase">{children}</label>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const colors = {
    neutral: "bg-[var(--qc-bg)] text-[var(--qc-muted)]",
    ok: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-800",
    bad: "bg-red-50 text-red-700",
  }[tone];
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${colors}`}>
      {children}
    </span>
  );
}

export function Alert({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "bad" | "ok" }) {
  const colors = {
    warn: "border-[#EAD0BF] bg-[#FBEEE6] text-[#7A3E1E]",
    bad: "border-red-200 bg-red-50 text-red-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${colors}`}>{children}</div>;
}
