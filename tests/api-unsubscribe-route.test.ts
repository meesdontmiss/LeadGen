import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/services/supabase-admin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

describe("API unsubscribe route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 400 when neither email nor companyId is provided", async () => {
    const { POST } = await import("../app/api/unsubscribe/route");

    const response = await POST(
      new Request("http://localhost/api/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "stop emails" }),
      }),
    );

    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Either email or companyId is required");
  });

  it("returns 500 when Supabase is not configured", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);
    const { POST } = await import("../app/api/unsubscribe/route");

    const response = await POST(
      new Request("http://localhost/api/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "owner@example.com" }),
      }),
    );

    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Supabase not configured");
  });

  it("adds email to suppression list and marks contact as do_not_contact", async () => {
    const insertSuppression = vi.fn().mockResolvedValue({ error: null });
    const updateContactsEq = vi.fn().mockResolvedValue({ error: null });
    const updateContacts = vi.fn().mockReturnValue({ eq: updateContactsEq });

    const from = vi.fn((table: string) => {
      if (table === "suppression_list") {
        return { insert: insertSuppression };
      }

      if (table === "contacts") {
        return { update: updateContacts };
      }

      throw new Error(`Unexpected table access in test: ${table}`);
    });

    mocks.getSupabaseAdmin.mockReturnValue({ from });

    const { POST } = await import("../app/api/unsubscribe/route");

    const response = await POST(
      new Request("http://localhost/api/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "owner@example.com",
          reason: "No longer interested",
        }),
      }),
    );

    const payload = (await response.json()) as { ok?: boolean; message?: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe("Successfully unsubscribed");

    expect(from).toHaveBeenCalledWith("suppression_list");
    expect(insertSuppression).toHaveBeenCalledWith({
      company_id: null,
      email: "owner@example.com",
      reason: "opt_out",
      source: "unsubscribe_endpoint",
      notes: "No longer interested",
    });

    expect(from).toHaveBeenCalledWith("contacts");
    expect(updateContacts).toHaveBeenCalledWith({ do_not_contact: true });
    expect(updateContactsEq).toHaveBeenCalledWith("email", "owner@example.com");
  });
});
