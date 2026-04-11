import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "lead-engine-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function getOperatorPasswordHash(): string {
  const password = process.env.OPERATOR_PASSWORD;
  if (!password) {
    throw new Error("OPERATOR_PASSWORD environment variable is not set");
  }
  return hashPassword(password);
}

function getSessionSecret(): string {
  return process.env.OPERATOR_SESSION_SECRET || process.env.OPERATOR_PASSWORD || "";
}

function signSessionPayload(payload: string): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("OPERATOR_PASSWORD or OPERATOR_SESSION_SECRET must be set");
  }

  return createHmac("sha256", secret).update(payload).digest("hex");
}

function encodeSessionPayload(payload: { exp: number; nonce: string }): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeSessionPayload(payload: string): { exp: number; nonce: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
      nonce?: unknown;
    };

    if (typeof parsed.exp !== "number" || typeof parsed.nonce !== "string") {
      return null;
    }

    return { exp: parsed.exp, nonce: parsed.nonce };
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = hashPassword(password);
  const validHash = getOperatorPasswordHash();
  return hash === validHash;
}

export async function createSession(): Promise<string> {
  const payload = encodeSessionPayload({
    exp: Date.now() + SESSION_MAX_AGE * 1000,
    nonce: randomBytes(16).toString("hex"),
  });
  const signature = signSessionPayload(payload);

  return `${payload}.${signature}`;
}

export async function validateSession(token: string): Promise<boolean> {
  const [payload, signature, ...rest] = token.split(".");

  if (!payload || !signature || rest.length > 0) {
    return false;
  }

  const expectedSignature = signSessionPayload(payload);
  const providedSignature = Buffer.from(signature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedSignature.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignature, expectedSignatureBuffer)
  ) {
    return false;
  }

  const session = decodeSessionPayload(payload);

  if (!session) {
    return false;
  }

  if (Date.now() > session.exp) {
    return false;
  }

  return true;
}

export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

export async function isAuthenticated(): Promise<boolean> {
  const sessionToken = await getSessionCookie();
  
  if (!sessionToken) {
    return false;
  }

  return validateSession(sessionToken);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getSessionMaxAge(): number {
  return SESSION_MAX_AGE;
}
