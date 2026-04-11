import { z } from "zod";
import { NextResponse } from "next/server";
import { verifyPassword, createSession, getSessionCookieName, getSessionMaxAge } from "@/lib/auth";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());

    console.log("[API /login] Attempting login with password:", body.password);
    const isValid = await verifyPassword(body.password);
    console.log("[API /login] Password valid:", isValid);

    if (!isValid) {
      return Response.json(
        { error: "Invalid password" },
        { status: 401 },
      );
    }

    const sessionToken = await createSession();
    console.log("[API /login] Session created:", sessionToken.substring(0, 10) + "...");

    const response = NextResponse.json({
      ok: true,
      message: "Login successful",
    });

    response.cookies.set(getSessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: getSessionMaxAge(),
      path: "/",
    });

    console.log("[API /login] Cookie set successfully");
    return response;
  } catch (error) {
    console.error("[API /login] Login failed:", error);
    const message = error instanceof Error ? error.message : "Login failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  // Check if already authenticated
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const hasSession = !!cookieStore.get("lead-engine-session")?.value;
  
  return Response.json({
    authenticated: hasSession,
    message: hasSession ? "Already authenticated" : "Send POST with password to authenticate",
  });
}
