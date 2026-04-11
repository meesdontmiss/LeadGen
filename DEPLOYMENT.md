# Production Deployment Guide

This guide covers everything needed to deploy the Luxury Local Lead Engine to production.

## ✅ What's Been Implemented

### Critical Production Features
- ✅ **Authentication system** - Session-based auth with password protection
- ✅ **API error handling** - All routes now have proper try/catch blocks
- ✅ **API security** - Session validation on all protected routes
- ✅ **Rate limiting** - Per-IP rate limiting with configurable limits
- ✅ **Request logging** - All API requests logged with IP and timestamp
- ✅ **Gmail OAuth token refresh** - Automatic token refresh every 45 minutes
- ✅ **Database pagination** - All queries limited to prevent memory issues
- ✅ **Error boundaries** - React error boundary catches rendering errors
- ✅ **Empty states** - User-friendly messages for empty data
- ✅ **Compliance system** - Physical address and opt-out enforcement
- ✅ **Unsubscribe endpoint** - Public endpoint for opt-out requests
- ✅ **Queue for approval** - Lead workflow button functional
- ✅ **Test suite** - Vitest tests for scoring and compliance logic

## 🚀 Deployment Steps

### 1. Database Setup

Your Supabase project is already configured at: `https://rqefeydxfxfpuodswevkep.supabase.co`

**Run the migration:**
```bash
# Option 1: Using Supabase CLI
npx supabase db push

# Option 2: Manually via Dashboard
# Go to Supabase Dashboard > SQL Editor
# Copy and run supabase/schema.sql
```

**Seed the database:**
```bash
npm run seed:supabase
```

### 2. Environment Variables

Your `.env.local` is already configured. For production deployment, add these to your hosting platform:

**Required Variables:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://rqefeydxfxfpuodswevkep.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
GMAIL_REFRESH_TOKEN=<your-refresh-token>

OPENCLAW_WEBHOOK_SECRET=<your-webhook-secret>

# IMPORTANT: Set these for production
OPERATOR_PASSWORD=<your-secure-password>
PHYSICAL_ADDRESS=Your Company LLC, 123 Main St, City, STATE 12345
SENDING_DOMAIN=yourdomain.com
```

**⚠️ CRITICAL: Change the default operator password before deploying!**

### 3. Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Or connect via GitHub for automatic deployments:
# 1. Push to GitHub
# 2. Connect repo at vercel.com
# 3. Add environment variables in Vercel dashboard
# 4. Every push to main deploys automatically
```

### 4. Alternative: Deploy to Any Node Host

```bash
# Build the app
npm run build

# Start in production mode
npm start

# The app runs on port 3000 by default
# Use a reverse proxy (nginx, Caddy) for HTTPS
```

### 5. Post-Deployment Checklist

- [ ] Database migrated and seeded
- [ ] All environment variables set
- [ ] **Operator password changed from default**
- [ ] PHYSICAL_ADDRESS set to real address (CAN-SPAM requirement)
- [ ] SENDING_DOMAIN configured
- [ ] Test login flow
- [ ] Test Gmail draft creation
- [ ] Test rate limiting (hit endpoint multiple times)
- [ ] Verify error boundaries work
- [ ] Check logs are appearing
- [ ] Test unsubscribe endpoint

## 🔒 Security Features

### Authentication
- Session-based auth with HTTP-only cookies
- 7-day session expiry
- All API routes protected except `/api/login`, `/api/logout`, `/api/unsubscribe`
- Default password: `openclaw-operator-2026` (**CHANGE THIS!**)

### Rate Limiting
- Auth endpoints: 10 requests/minute
- Read endpoints: 100 requests/minute  
- Gmail endpoints: 20 requests/minute
- Webhook endpoints: 50 requests/minute

### Compliance
- Physical address required in all emails
- Opt-out mechanism in every email
- Suppression list for unsubscribes
- Unsubscribe endpoint at `/api/unsubscribe`

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests once
npm run test:run

# Tests cover:
# - Scoring engine (outreach score calculation)
# - Qualification logic
# - Offer type recommendations
# - Compliance footer generation
```

## 📊 Monitoring

The app includes basic logging:
- All API requests logged with timestamp, method, path, and IP
- Errors logged with context
- Gmail OAuth refresh events logged

**For production monitoring, consider adding:**
- Sentry for error tracking
- LogRocket for session replay
- Vercel Analytics for performance
- Uptime monitoring (UptimeRobot, Pingdom)

## 🔧 Maintenance

### Updating the Database Schema
```bash
# Edit supabase/schema.sql
# Run migration
npx supabase db push
```

### Rotating Gmail Refresh Token
If the token expires or is revoked:
1. Go to Google OAuth Playground
2. Re-authenticate with your Gmail account
3. Generate a new refresh token
4. Update `GMAIL_REFRESH_TOKEN` in env vars
5. Redeploy

### Changing Operator Password
1. Update `OPERATOR_PASSWORD` in env vars
2. Redeploy
3. Sessions will be invalidated

## 🚨 Troubleshooting

### "Supabase client not configured"
- Check `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Verify URL is valid and accessible

### "Gmail authentication failed"
- Check all 4 Gmail env vars are set
- Verify refresh token is valid
- Check Google API has Gmail API enabled

### "Rate limit exceeded"
- Wait for the window to reset (1 minute)
- Check `retryAfter` in response for seconds to wait

### Login not working
- Check cookies are enabled in browser
- Verify `OPERATOR_PASSWORD` is set (or use default)
- Check HTTPS is working (cookies require secure in prod)

## 📞 Support

For issues or questions:
1. Check the logs: `vercel logs <deployment-url>`
2. Review error messages in browser console
3. Check Supabase logs for database errors
4. Verify all env vars are set correctly

## 🎯 Next Steps (Optional Enhancements)

These are not required for launch but would improve the system:
- [ ] Discovery scraper automation
- [ ] Playwright audit worker
- [ ] Automated follow-up scheduling
- [ ] Reply detection and sync
- [ ] Multi-user support with roles
- [ ] Real-time updates with Supabase Realtime
- [ ] Email template customization
- [ ] A/B testing for subject lines
- [ ] Analytics dashboard improvements
- [ ] Export reports (CSV, PDF)

---

**You're ready to launch! 🚀**

All critical production features are implemented. Follow the deployment steps above, change the default password, and you're good to go.
