/**
 * Vercel build wrapper — fails with a clear message if DATABASE_URL is missing.
 * Railway/Neon Postgres URL must be set in Vercel → Settings → Environment Variables.
 */
import { spawnSync } from "node:child_process";

const db = process.env.DATABASE_URL?.trim();
if (!db || db.includes("USER:PASSWORD@HOST")) {
  console.error(`
┌──────────────────────────────────────────────────────────────┐
│  Missing DATABASE_URL                                        │
│                                                              │
│  1. Railway → your Postgres service → Variables              │
│     Copy DATABASE_URL (or DATABASE_PUBLIC_URL)               │
│  2. Vercel → Project → Settings → Environment Variables      │
│     Add DATABASE_URL for Production + Preview + Development  │
│  3. Also set AUTH_SECRET and AUTH_URL                        │
│  4. Redeploy                                                 │
└──────────────────────────────────────────────────────────────┘
`);
  process.exit(1);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["next", "build"]);
