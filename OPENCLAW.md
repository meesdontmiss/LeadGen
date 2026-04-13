# OpenClaw Runtime Notes

## Notification Destination

Set this env var so OpenClaw always knows where to send operator alerts:

```bash
OPENCLAW_ALERT_EMAIL=meesdontmiss@gmail.com
```

This value is surfaced in `/api/openclaw/commands` summary responses.

## Daily Los Angeles Lead Scan

`vercel.json` includes a daily cron job:

- path: `/api/openclaw/discovery/daily`
- schedule: `0 16 * * *` (UTC; once every 24 hours)

Authorization:

- Set `CRON_SECRET` in your deployment env
- The route accepts `Authorization: Bearer <CRON_SECRET>` (Vercel cron default)
- It also accepts `OPENCLAW_WEBHOOK_SECRET` for manual external triggers

Optional tuning:

```bash
OPENCLAW_DAILY_SCAN_MAX_PER_VERTICAL=30
OPENCLAW_DISCOVERY_BBOX=33.70,-118.67,34.35,-118.10
```

The scan discovers real businesses in Los Angeles via OpenStreetMap Overpass, inserts new lead records into Supabase, and sends an operator summary email to `OPENCLAW_ALERT_EMAIL` when configured.

## Current Runtime Behavior

OpenClaw in this project is currently command-driven:

- `summary` returns dashboard metrics and top leads
- `lead` returns details for one lead
- `create_gmail_draft` creates a Gmail draft for a lead
- `daily discovery` performs an automated 24h LA lead scan via cron

The app reads live data from Supabase. It does not yet run continuous discovery scans by itself.

## Lead Scanning Status

Automatic lead scanning is active when Vercel cron and `CRON_SECRET` are configured in deployment.
