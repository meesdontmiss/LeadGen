import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/services/supabase-admin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

describe("API leads bulk queue route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 400 when no lead IDs are selected", async () => {
    const { POST } = await import("../app/api/leads/queue/route");

    const response = await POST(
      new Request("http://localhost/api/leads/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_approve_selected",
          companyIds: [],
        }),
      }),
    );

    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid bulk selection payload.");
  });

  it("accepts non-UUID IDs and returns 500 when Supabase is not configured", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);
    const { POST } = await import("../app/api/leads/queue/route");

    const response = await POST(
      new Request("http://localhost/api/leads/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_approve_selected",
          companyIds: ["company_1"],
        }),
      }),
    );

    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Supabase not configured");
  });

  it("auto-approves only latest draft emails for selected leads", async () => {
    const companyA = "company-a";
    const companyB = "company-b";
    const companyC = "company-c";

    const updateCompaniesIn = vi.fn().mockResolvedValue({ error: null });
    const updateCompanies = vi.fn().mockReturnValue({ in: updateCompaniesIn });

    const emailsOrder = vi.fn().mockResolvedValue({
      error: null,
      data: [
        {
          id: "email-a-latest",
          company_id: companyA,
          status: "draft",
          created_at: "2026-04-12T10:00:00.000Z",
        },
        {
          id: "email-b-latest",
          company_id: companyB,
          status: "approved",
          created_at: "2026-04-12T09:00:00.000Z",
        },
        {
          id: "email-a-older",
          company_id: companyA,
          status: "draft",
          created_at: "2026-04-11T10:00:00.000Z",
        },
      ],
    });
    const emailsInForSelect = vi.fn().mockReturnValue({ order: emailsOrder });
    const emailsEq = vi.fn().mockReturnValue({ in: emailsInForSelect });
    const emailsSelect = vi.fn().mockReturnValue({ eq: emailsEq });

    const updateEmailsIn = vi.fn().mockResolvedValue({ error: null });
    const updateEmails = vi.fn().mockReturnValue({ in: updateEmailsIn });

    const activityInsert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn((table: string) => {
      if (table === "companies") {
        return { update: updateCompanies };
      }
      if (table === "emails") {
        return { select: emailsSelect, update: updateEmails };
      }
      if (table === "activity_logs") {
        return { insert: activityInsert };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    });

    mocks.getSupabaseAdmin.mockReturnValue({ from });
    const { POST } = await import("../app/api/leads/queue/route");

    const response = await POST(
      new Request("http://localhost/api/leads/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_approve_selected",
          companyIds: [companyA, companyB, companyC],
        }),
      }),
    );

    const payload = (await response.json()) as {
      ok?: boolean;
      selectedCount?: number;
      approvedCount?: number;
      skippedCount?: number;
      message?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.selectedCount).toBe(3);
    expect(payload.approvedCount).toBe(1);
    expect(payload.skippedCount).toBe(2);
    expect(payload.message).toContain("Auto-approved 1 of 3");

    expect(updateCompanies).toHaveBeenCalledWith({ lead_status: "draft_ready" });
    expect(updateCompaniesIn).toHaveBeenCalledWith("id", [companyA, companyB, companyC]);

    expect(updateEmails).toHaveBeenCalledWith({ status: "approved" });
    expect(updateEmailsIn).toHaveBeenCalledWith("id", ["email-a-latest"]);

    expect(activityInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        company_id: companyA,
        event_type: "proposal_auto_approved_for_send",
      }),
    ]);
  });
});
