import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// In-memory fallback for when Supabase is unavailable
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Clean up expired in-memory entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

function checkMemoryRateLimit({
  key,
  maxRequests,
  windowMs,
}: {
  key: string;
  maxRequests: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export async function checkRateLimit({
  key,
  maxRequests,
  windowMs,
}: {
  key: string;
  maxRequests: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return checkMemoryRateLimit({ key, maxRequests, windowMs });
  }

  const now = new Date();
  const resetAt = new Date(Date.now() + windowMs);

  try {
    // Clean up expired entries periodically (1% chance per request)
    if (Math.random() < 0.01) {
      await supabase.from("rate_limits").delete().lt("reset_at", now.toISOString());
    }

    // Try to get existing entry
    const { data, error } = await supabase
      .from("rate_limits")
      .select("count, reset_at")
      .eq("key", key)
      .single();

    if (error || !data) {
      // No entry exists — create one
      await supabase.from("rate_limits").upsert(
        { key, count: 1, reset_at: resetAt.toISOString() },
        { onConflict: "key" },
      );
      return { allowed: true, remaining: maxRequests - 1, resetAt: resetAt.getTime() };
    }

    const existingResetAt = new Date(data.reset_at).getTime();

    // Window expired — reset
    if (existingResetAt <= Date.now()) {
      await supabase
        .from("rate_limits")
        .update({ count: 1, reset_at: resetAt.toISOString() })
        .eq("key", key);
      return { allowed: true, remaining: maxRequests - 1, resetAt: resetAt.getTime() };
    }

    const currentCount = data.count;

    // Over limit
    if (currentCount >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: existingResetAt };
    }

    // Increment count
    await supabase
      .from("rate_limits")
      .update({ count: currentCount + 1 })
      .eq("key", key);

    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetAt: existingResetAt,
    };
  } catch {
    // Fallback to in-memory if Supabase query fails
    return checkMemoryRateLimit({ key, maxRequests, windowMs });
  }
}

// Predefined rate limits for different endpoint types
export const RATE_LIMITS = {
  // Authentication endpoints: 10 requests per minute
  AUTH: { maxRequests: 10, windowMs: 60 * 1000 },
  
  // Read endpoints: 100 requests per minute
  READ: { maxRequests: 100, windowMs: 60 * 1000 },
  
  // Write endpoints: 30 requests per minute
  WRITE: { maxRequests: 30, windowMs: 60 * 1000 },
  
  // Gmail endpoints: 20 requests per minute (API quota protection)
  GMAIL: { maxRequests: 20, windowMs: 60 * 1000 },
  
  // Webhook endpoints: 50 requests per minute
  WEBHOOK: { maxRequests: 50, windowMs: 60 * 1000 },
};

export function getRateLimitConfig(pathname: string) {
  if (pathname.includes("/login") || pathname.includes("/logout")) {
    return RATE_LIMITS.AUTH;
  }
  if (pathname.includes("/gmail")) {
    return RATE_LIMITS.GMAIL;
  }
  if (pathname.includes("/openclaw")) {
    return RATE_LIMITS.WEBHOOK;
  }
  if (pathname.includes("/leads") || pathname.includes("/campaigns") || pathname.includes("/domain-health")) {
    return RATE_LIMITS.READ;
  }
  // Default to write limit for POST/PUT/DELETE
  return RATE_LIMITS.WRITE;
}
