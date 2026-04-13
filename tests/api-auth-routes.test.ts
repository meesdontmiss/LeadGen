import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("API auth routes", () => {
  const originalPassword = process.env.OPERATOR_PASSWORD;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    process.env.OPERATOR_PASSWORD = "openclaw-test-password";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.OPERATOR_PASSWORD;
    } else {
      process.env.OPERATOR_PASSWORD = originalPassword;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("POST /api/login returns 401 for invalid password", async () => {
    const { POST } = await import("../app/api/login/route");

    const response = await POST(
      new Request("http://localhost/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: "wrong-password" }),
      }),
    );

    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Invalid password");
  });

  it("POST /api/login sets session cookie when password is valid", async () => {
    const { POST } = await import("../app/api/login/route");

    const response = await POST(
      new Request("http://localhost/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: "openclaw-test-password" }),
      }),
    );

    const payload = (await response.json()) as { ok?: boolean };
    const setCookie = response.headers.get("set-cookie");

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(setCookie).toContain("lead-engine-session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
  });

  it("POST /api/logout clears the session cookie", async () => {
    const { POST } = await import("../app/api/logout/route");

    const response = await POST();
    const payload = (await response.json()) as { ok?: boolean };
    const setCookie = response.headers.get("set-cookie");

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(setCookie).toContain("lead-engine-session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
