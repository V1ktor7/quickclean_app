/**
 * Vercel build wrapper — fails with a clear message if DATABASE_URL is missing.
 * Railway/Neon Postgres URL must be set in Vercel → Settings → Environment Variables.
 */
import { spawnSync } from "node:child_process";

const db = process.env.DATABASE_URL?.trim();
const onRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID,
);

if (!db || db.includes("USER:PASSWORD@HOST")) {
  // Accidental GitHub→Railway web service: Postgres-only setup, app lives on Vercel.
  if (onRailway && !process.env.VERCEL) {
    console.log(`
┌──────────────────────────────────────────────────────────────┐
│  Skipping app build on Railway                               │
│                                                              │
│  This repo deploys the Next.js app on Vercel.                │
│  Railway should only run Postgres (no web service needed).   │
│  You can delete/disconnect any Railway service that builds   │
│  this repo — it is not required.                             │
└──────────────────────────────────────────────────────────────┘
`);
    process.exit(0);
  }

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
