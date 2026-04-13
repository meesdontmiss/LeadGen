import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { checkRateLimit, getRateLimitConfig } from "@/lib/rate-limit";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/api/login",
  "/api/logout",
  "/api/health",
  "/api/unsubscribe",
  "/api/openclaw/discovery/daily",
  "/",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === "/") {
      return pathname === route;
    }

    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Extract session token from cookie
  const sessionToken = request.cookies.get("lead-engine-session")?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in." },
      { status: 401 },
    );
  }

  // Validate session
  const isValid = await validateSession(sessionToken);

  if (!isValid) {
    const response = NextResponse.json(
      { error: "Session expired. Please log in again." },
      { status: 401 },
    );
    response.cookies.delete("lead-engine-session");
    return response;
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const rateLimitKey = `${ip}:${pathname}`;
  const rateLimitConfig = getRateLimitConfig(pathname);
  const rateLimitResult = checkRateLimit({
    key: rateLimitKey,
    ...rateLimitConfig,
  });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimitConfig.maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": Math.ceil(rateLimitResult.resetAt / 1000).toString(),
        },
      },
    );
  }

  // Request logging
  console.log(
    `[${new Date().toISOString()}] ${request.method} ${pathname} from ${ip}`,
  );

  const response = NextResponse.next();

  // Add rate limit headers
  response.headers.set("X-RateLimit-Limit", rateLimitConfig.maxRequests.toString());
  response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
  response.headers.set("X-RateLimit-Reset", Math.ceil(rateLimitResult.resetAt / 1000).toString());

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
