import "server-only";

import { cookies } from "next/headers";
import { env } from "@/lib/env";

const SESSION_COOKIE_NAME = "lead-engine-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Simple hash-based session management
// For production, consider a proper session store or NextAuth
function hashPassword(password: string): string {
  // Simple SHA-256 hash for demo purposes
  // In production, use bcrypt or argon2
  const crypto = require("node:crypto");
  return crypto.createHash("sha256").update(password).digest("hex");
}

// The operator password is stored as a hash in env
// For MVP, we use a simple hardcoded password that can be set via env
function getOperatorPasswordHash(): string {
  const defaultPassword = "openclaw-operator-2026";
  const password = process.env.OPERATOR_PASSWORD || defaultPassword;
  return hashPassword(password);
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = hashPassword(password);
  const validHash = getOperatorPasswordHash();
  return hash === validHash;
}

export async function createSession(): Promise<string> {
  const crypto = require("node:crypto");
  const sessionToken = crypto.randomBytes(32).toString("hex");
  
  // Store session token with expiry (in-memory for MVP)
  // In production, use Redis or database
  sessions.set(sessionToken, {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  });

  return sessionToken;
}

// Simple in-memory session store
// In production, replace with Redis or database-backed sessions
const sessions = new Map<string, { createdAt: number; expiresAt: number }>();

export async function validateSession(token: string): Promise<boolean> {
  const session = sessions.get(token);
  
  if (!session) {
    return false;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
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
