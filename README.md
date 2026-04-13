# Luxury Local Lead Engine

Operator-first MVP for discovering premium local service businesses, auditing weak web presentation, generating tailored outreach, and managing Gmail-safe outbound flow.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase schema scaffold in [supabase/schema.sql](./supabase/schema.sql)

## What is implemented

- Lead queue with search and stage filters
- Company detail view with audit scoring, weaknesses, and offer logic
- Outreach review panel with subject variants, draft preview, compliance footer, and follow-up schedule
- Campaign pipeline and activity log
- Domain health and send guardrail surface
- Worker status and queue surface
- Live Supabase read path when runtime env is configured
- Gmail draft creation route using Google OAuth runtime env
- Gmail send/reply/follow-up routes with campaign touch tracking
- Call and gig scheduling routes backed by campaign metadata
- OpenClaw command endpoint with secret-based auth
- JSON API routes:
  - `/api/bookings`
  - `/api/leads`
  - `/api/campaigns`
  - `/api/domain-health`
  - `/api/gmail/drafts`
  - `/api/gmail/send`
  - `/api/gmail/thread`
  - `/api/openclaw/commands`

## Local run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Live setup

1. Set runtime env in `.env.local`
2. Run the schema against a Supabase project
3. Insert real companies, contacts, audits, campaigns, and emails in Supabase

## Required env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GMAIL_REFRESH_TOKEN`
- `OPENCLAW_WEBHOOK_SECRET`

## Notes

- Discovery ingestion, Playwright audits, and follow-up workers are still separate backend workstreams.
- First-touch sends are intentionally modeled as human-approval-first.
- The Gmail connector available to the agent is separate from the app runtime. The app uses Google OAuth env, not the connector tools.
