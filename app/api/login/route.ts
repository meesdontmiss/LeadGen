import { z } from "zod";
import { NextResponse } from "next/server";
import {
  verifyPassword,
  createSession,
  getSessionCookieName,
  getSessionMaxAge,
  validateSession,
} from "@/lib/auth";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const isValid = await verifyPassword(body.password);

    if (!isValid) {
      return Response.json(
        { error: "Invalid password" },
        { status: 401 },
      );
    }

    const sessionToken = await createSession();

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

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieName())?.value;
  const authenticated = sessionToken ? await validateSession(sessionToken) : false;
  
  return Response.json({
    authenticated,
    message: authenticated ? "Already authenticated" : "Send POST with password to authenticate",
  });
}
