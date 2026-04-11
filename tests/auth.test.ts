import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("Auth session tokens", () => {
  const originalPassword = process.env.OPERATOR_PASSWORD;
  const originalSessionSecret = process.env.OPERATOR_SESSION_SECRET;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T12:00:00.000Z"));
    process.env.OPERATOR_PASSWORD = "openclaw-test-password";
    delete process.env.OPERATOR_SESSION_SECRET;
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalPassword === undefined) {
      delete process.env.OPERATOR_PASSWORD;
    } else {
      process.env.OPERATOR_PASSWORD = originalPassword;
    }

    if (originalSessionSecret === undefined) {
      delete process.env.OPERATOR_SESSION_SECRET;
    } else {
      process.env.OPERATOR_SESSION_SECRET = originalSessionSecret;
    }
  });

  it("creates a session token that validates across requests", async () => {
    const { createSession, validateSession } = await import("../lib/auth");

    const token = await createSession();

    expect(token).toContain(".");
    await expect(validateSession(token)).resolves.toBe(true);
  });

  it("rejects tampered session payloads", async () => {
    const { createSession, validateSession } = await import("../lib/auth");

    const token = await createSession();
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        exp: Date.now() + 60_000,
        nonce: "tampered",
      }),
    ).toString("base64url");

    await expect(validateSession(`${tamperedPayload}.${signature}`)).resolves.toBe(false);
  });

  it("rejects expired sessions", async () => {
    const { createSession, validateSession } = await import("../lib/auth");

    const token = await createSession();

    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

    await expect(validateSession(token)).resolves.toBe(false);
  });
});
