// Simple in-memory rate limiter
// For production, use Redis or Upstash

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function checkRateLimit({
  key,
  maxRequests,
  windowMs,
}: {
  key: string;
  maxRequests: number;
  windowMs: number;
}): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    // Create new window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
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
