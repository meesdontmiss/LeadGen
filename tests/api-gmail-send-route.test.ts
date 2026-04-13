import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sanitizeFooterForOutbound: vi.fn((footer: string[]) => footer),
  getLeadRecord: vi.fn(),
  markEmailAsSent: vi.fn(),
  createReplyRecord: vi.fn(),
  sendGmailMessage: vi.fn(),
  getReplyHeaders: vi.fn(),
}));

vi.mock("@/lib/compliance", () => ({
  sanitizeFooterForOutbound: mocks.sanitizeFooterForOutbound,
}));

vi.mock("@/lib/services/dashboard-repository", () => ({
  getLeadRecord: mocks.getLeadRecord,
  markEmailAsSent: mocks.markEmailAsSent,
  createReplyRecord: mocks.createReplyRecord,
}));

vi.mock("@/lib/services/gmail", () => ({
  sendGmailMessage: mocks.sendGmailMessage,
  getReplyHeaders: mocks.getReplyHeaders,
}));

describe("API gmail send route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 404 when lead does not exist", async () => {
    mocks.getLeadRecord.mockResolvedValue(null);

    const { POST } = await import("../app/api/gmail/send/route");

    const response = await POST(
      new Request("http://localhost/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send_draft",
          companyId: "company-404",
        }),
      }),
    );

    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Lead not found.");
    expect(mocks.sendGmailMessage).not.toHaveBeenCalled();
  });

  it("blocks send_draft when proposal has not been approved", async () => {
    mocks.getLeadRecord.mockResolvedValue({
      company: {
        id: "company-1",
        name: "OpenClaw Studio",
        status: "new",
      },
      contact: {
        email: "owner@openclaw.dev",
      },
      latestEmail: {
        id: "email-1",
        subject: "Draft subject",
        subjectVariants: ["Draft subject"],
        plainText: "Draft body",
        complianceFooter: ["Reply opt out to unsubscribe."],
        gmailThreadId: "thread-1",
        status: "draft",
      },
    });

    const { POST } = await import("../app/api/gmail/send/route");

    const response = await POST(
      new Request("http://localhost/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send_draft",
          companyId: "company-1",
        }),
      }),
    );

    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("pending approval");
    expect(mocks.sendGmailMessage).not.toHaveBeenCalled();
    expect(mocks.markEmailAsSent).not.toHaveBeenCalled();
  });

  it("sends approved draft and persists sent metadata", async () => {
    mocks.sanitizeFooterForOutbound.mockReturnValue([
      "OpenClaw LLC, Los Angeles, CA",
      "Reply opt out to unsubscribe.",
    ]);
    mocks.getLeadRecord.mockResolvedValue({
      company: {
        id: "company-1",
        name: "OpenClaw Studio",
        status: "draft_ready",
        vertical: "Med Spa",
      },
      contact: {
        id: "contact-1",
        email: "owner@openclaw.dev",
        fullName: "Owner Name",
      },
      latestEmail: {
        id: "email-1",
        subject: "Approved subject",
        subjectVariants: ["Approved subject alt"],
        plainText: "Approved body",
        complianceFooter: ["Raw footer line"],
        gmailThreadId: "thread-1",
        status: "approved",
      },
      campaign: {
        id: "campaign-1",
      },
    });
    mocks.sendGmailMessage.mockResolvedValue({
      threadId: "thread-1",
      messageId: "message-123",
    });

    const { POST } = await import("../app/api/gmail/send/route");

    const response = await POST(
      new Request("http://localhost/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send_draft",
          companyId: "company-1",
        }),
      }),
    );

    const payload = (await response.json()) as { ok?: boolean; action?: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.action).toBe("send_draft");

    expect(mocks.sendGmailMessage).toHaveBeenCalledWith({
      to: "owner@openclaw.dev",
      subject: "Approved subject",
      body: "Approved body\n\nOpenClaw LLC, Los Angeles, CA\nReply opt out to unsubscribe.",
      threadId: "thread-1",
    });

    expect(mocks.markEmailAsSent).toHaveBeenCalledWith({
      emailId: "email-1",
      subject: "Approved subject",
      bodyText: "Approved body\n\nOpenClaw LLC, Los Angeles, CA\nReply opt out to unsubscribe.",
      threadId: "thread-1",
      messageId: "message-123",
    });
  });
});
