# Luxury Local Lead Engine

Operator-first MVP for discovering premium local service businesses, auditing weak web presentation, generating tailored outreach, and managing Gmail-safe outbound flow.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Typed local seed data for the MVP workspace
- Supabase schema scaffold in [supabase/schema.sql](./supabase/schema.sql)

## What is implemented

- Lead queue with search and stage filters
- Company detail view with audit scoring, weaknesses, and offer logic
- Outreach review panel with subject variants, draft preview, compliance footer, and follow-up schedule
- Campaign pipeline and activity log
- Domain health and send guardrail surface
- Worker status / roadmap surface
- Live Supabase read path when runtime env is configured, with seeded fallback otherwise
- Gmail draft creation route using Google OAuth runtime env
- OpenClaw command endpoint with secret-based auth
- Supabase seed script for loading the demo dataset into a real project
- JSON API stubs:
  - `/api/leads`
  - `/api/campaigns`
  - `/api/domain-health`
  - `/api/gmail/drafts`
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
3. Seed the project

```bash
npm run seed:supabase
```

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
