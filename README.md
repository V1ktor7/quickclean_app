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
- Prisma + SQLite locally (swap `DATABASE_URL` to Neon Postgres for production)
- Jobber GraphQL + `JOB_COMPLETE` webhooks
- Quo SMS (`POST https://api.quo.com/v1/messages`)

## Setup

```bash
npm install
cp .env.example .env
# edit .env — set AUTH_SECRET, Quo, Jobber, review link
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Default admin (from seed / env):

- Email: `admin@quickclean.local`
- Password: `changeme123`

## Environment

See [`.env.example`](.env.example). Important keys:

- `QUO_API_KEY` / `QUO_FROM_NUMBER` — SMS send + review automation
- `JOBBER_ACCESS_TOKEN` / `JOBBER_CLIENT_SECRET` — CRM sync + webhook HMAC
- `REVIEW_LINK_URL` / `REVIEW_SMS_TEMPLATE` — text sent on job complete

**Never commit secrets.** Rotate any key that was pasted into chat or a ticket.

### Production database (Neon)

1. Create a Neon Postgres database
2. Set `DATABASE_URL` to the Neon connection string
3. Change `provider` in [`prisma/schema.prisma`](prisma/schema.prisma) from `sqlite` to `postgresql`
4. Run `npx prisma migrate deploy && npm run db:seed`

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
