# QuickClean Ops Hub

Central operations hub connecting Jobber CRM, Quo SMS, and field/sales teams.

## Roles

| Role  | Home     | Capabilities |
|-------|----------|--------------|
| Admin | `/admin` | Users, Jobber sync, SMS campaigns, commissions, leads |
| Sales | `/sales` | Pane quote tool, lead intake |
| Tech  | `/tech`  | Punch in/out, equipment checklist gate, upsell logging |

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Auth.js (credentials) with RBAC
- Prisma + Neon Postgres (required for Vercel; SQLite is not supported on serverless)
- Jobber GraphQL + `JOB_COMPLETE` webhooks
- Quo SMS (`POST https://api.quo.com/v1/messages`)

## Setup

```bash
npm install
cp .env.example .env
# set DATABASE_URL to a Neon Postgres connection string
# set AUTH_SECRET, Quo, Jobber, review link
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Default admin (from seed / env):

- Email: `admin@quickclean.local`
- Password: `changeme123`

## Deploy on Vercel

The previous build error (`Environment variable not found: DATABASE_URL`) happens because Vercel has no database URL, and SQLite cannot run on Vercel Functions.

1. Create a free [Neon](https://neon.tech) Postgres DB (or **Vercel Dashboard → Storage → Neon**)
2. In the Vercel project → **Settings → Environment Variables**, add at least:

| Name | Example |
|------|---------|
| `DATABASE_URL` | `postgresql://…?sslmode=require` (Neon) |
| `AUTH_SECRET` | random 32+ byte secret |
| `AUTH_URL` | `https://your-app.vercel.app` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | initial admin |
| `JOBBER_CLIENT_ID` / `JOBBER_CLIENT_SECRET` | Jobber app |
| `JOBBER_REDIRECT_URI` | `https://your-app.vercel.app/api/jobber/oauth/callback` |
| `QUO_API_KEY` / `QUO_FROM_NUMBER` | Quo SMS |
| `REVIEW_LINK_URL` | your Google review link |

3. Redeploy
4. After first deploy, seed the admin user once:

```bash
# with DATABASE_URL pointing at Neon
npm run db:seed
```

5. In Jobber Developer Center, set OAuth callback + webhooks to your Vercel URLs (see **Admin → Integrations**).

## Environment

See [`.env.example`](.env.example). Important keys:

- `QUO_API_KEY` / `QUO_FROM_NUMBER` — SMS send + review automation
- `JOBBER_CLIENT_ID` / `JOBBER_CLIENT_SECRET` — OAuth app + webhook HMAC
- `JOBBER_REDIRECT_URI` — must match Jobber Developer Center callback (default `http://localhost:3000/api/jobber/oauth/callback`)
- `REVIEW_LINK_URL` / `REVIEW_SMS_TEMPLATE` — text sent on job complete

### Connect Jobber

1. Open **Admin → Integrations** for copy-paste URLs (or use the values below)
2. In Jobber Developer Center, set OAuth Callback URL
3. Create webhooks for each topic (or use the unified URL)
4. Sign in as Admin → **Connect Jobber** → **Sync Jobber now**

#### OAuth callback

```
{AUTH_URL}/api/jobber/oauth/callback
```

Example local: `http://localhost:3000/api/jobber/oauth/callback`

#### Webhook URLs

| Jobber topic | URL | What it does |
|--------------|-----|----------------|
| `JOB_COMPLETE` | `{AUTH_URL}/api/webhooks/jobber/job-complete` | Review SMS via Quo + update job cache |
| `CLIENT_CREATE` | `{AUTH_URL}/api/webhooks/jobber/client-create` | Sync new client into Ops Hub |
| `QUOTE_APPROVAL` | `{AUTH_URL}/api/webhooks/jobber/quote-approval` | Log approved quotes for Admin |
| `APP_DISCONNECT` | `{AUTH_URL}/api/webhooks/jobber/app-disconnect` | Clear stored OAuth tokens |
| Any (optional) | `{AUTH_URL}/api/webhooks/jobber` | Unified router by payload topic |

Jobber signs each delivery with `X-Jobber-Hmac-SHA256` using your app client secret.

> Localhost cannot receive Jobber webhooks. Use a public HTTPS tunnel and set `AUTH_URL` / `JOBBER_REDIRECT_URI` to that origin.

**Never commit secrets.** Rotate any key that was pasted into chat or a ticket.

### Production database (Neon)

1. Create a Neon Postgres database
2. Set `DATABASE_URL` on Vercel (and locally in `.env`)
3. Deploy — `prisma migrate deploy` runs during `npm run build`
4. Run `npm run db:seed` once against Neon to create the admin user

## Key behaviors

- **Punch-out blocker:** Tech cannot punch out until every equipment checklist item is checked (UI + API `409`)
- **Upsells:** Tech logs → Admin commission feed (`/admin/commissions`)
- **Review engine:** `POST /api/webhooks/jobber` on `JOB_COMPLETE` → Quo review SMS (idempotent via `WebhookEvent`)
- **SMS broadcast:** Filter clients (past N months, commercial) → chunked Quo sends (max 10 recipients/request)
- **Sales tool:** Pane calculator at `/sales-tools/pane/` (embedded in Sales portal)

## API map

| Route | Roles | Purpose |
|-------|-------|---------|
| `/api/time-logs` | Tech | Punch in/out |
| `/api/checklists/[id]` | Tech | Toggle manifest item |
| `/api/upsells` | Tech / Admin | Rules + logs |
| `/api/leads` | Sales / Admin | Lead intake |
| `/api/users` | Admin | User CRUD |
| `/api/clients` | Admin | Synced CRM list |
| `/api/jobber/sync` | Admin | Pull clients/jobs |
| `/api/campaigns` | Admin | SMS preview/send |
| `/api/webhooks/jobber` | Public (HMAC) | Jobber events |

## Jobber webhook

Point Jobber Developer Center webhook URL to:

`https://<your-domain>/api/webhooks/jobber`

Subscribe to `JOB_COMPLETE`. Signature header: `X-Jobber-Hmac-SHA256` (verified with `JOBBER_CLIENT_SECRET`).
