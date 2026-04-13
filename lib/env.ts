import { z } from "zod";

const optionalString = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().min(1).optional(),
  );

const optionalUrl = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().url().optional(),
  );

const optionalInteger = () =>
  z.preprocess(
    (value) => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      if (trimmed.length === 0) return undefined;
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : value;
    },
    z.number().int().min(1).max(500).optional(),
  );

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString(),
  SUPABASE_SERVICE_ROLE_KEY: optionalString(),
  SUPABASE_PROJECT_REF: optionalString(),
  GOOGLE_CLIENT_ID: optionalString(),
  GOOGLE_CLIENT_SECRET: optionalString(),
  GOOGLE_REDIRECT_URI: optionalUrl(),
  GMAIL_REFRESH_TOKEN: optionalString(),
  GMAIL_SENDER_NAME: optionalString(),
  CRON_SECRET: optionalString(),
  OPENCLAW_WEBHOOK_SECRET: optionalString(),
  OPENCLAW_ALERT_EMAIL: optionalString(),
  OPENCLAW_DISCOVERY_BBOX: optionalString(),
  OPENCLAW_DAILY_SCAN_MAX_PER_VERTICAL: optionalInteger(),
  SENDING_DOMAIN: optionalString(),
  BUSINESS_MAILING_ADDRESS: optionalString(),
  PHYSICAL_ADDRESS: optionalString(),
});

const parsedEnv = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
  GMAIL_SENDER_NAME: process.env.GMAIL_SENDER_NAME,
  CRON_SECRET: process.env.CRON_SECRET,
  OPENCLAW_WEBHOOK_SECRET: process.env.OPENCLAW_WEBHOOK_SECRET,
  OPENCLAW_ALERT_EMAIL: process.env.OPENCLAW_ALERT_EMAIL,
  OPENCLAW_DISCOVERY_BBOX: process.env.OPENCLAW_DISCOVERY_BBOX,
  OPENCLAW_DAILY_SCAN_MAX_PER_VERTICAL:
    process.env.OPENCLAW_DAILY_SCAN_MAX_PER_VERTICAL,
  SENDING_DOMAIN: process.env.SENDING_DOMAIN,
  BUSINESS_MAILING_ADDRESS: process.env.BUSINESS_MAILING_ADDRESS,
  PHYSICAL_ADDRESS: process.env.PHYSICAL_ADDRESS,
});

export const env = parsedEnv;

export function hasSupabaseServerEnv() {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function hasSupabaseBrowserEnv() {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function hasRuntimeGmailEnv() {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REDIRECT_URI &&
      env.GMAIL_REFRESH_TOKEN,
  );
}
