import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Compliance Utilities", () => {
  const originalPhysicalAddress = process.env.PHYSICAL_ADDRESS;
  const originalBusinessMailingAddress = process.env.BUSINESS_MAILING_ADDRESS;
  const originalSendingDomain = process.env.SENDING_DOMAIN;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalPhysicalAddress === undefined) {
      delete process.env.PHYSICAL_ADDRESS;
    } else {
      process.env.PHYSICAL_ADDRESS = originalPhysicalAddress;
    }

    if (originalBusinessMailingAddress === undefined) {
      delete process.env.BUSINESS_MAILING_ADDRESS;
    } else {
      process.env.BUSINESS_MAILING_ADDRESS = originalBusinessMailingAddress;
    }

    if (originalSendingDomain === undefined) {
      delete process.env.SENDING_DOMAIN;
    } else {
      process.env.SENDING_DOMAIN = originalSendingDomain;
    }
  });

  it("generates opt-out-only footer when no business mailing address is configured", async () => {
    delete process.env.BUSINESS_MAILING_ADDRESS;
    const { generateComplianceFooter } = await import("../lib/compliance");
    const footer = generateComplianceFooter();
    expect(footer.length).toBe(1);
    expect(footer[0]).toMatch(/opt out|unsubscribe/i);
  });

  it("generates footer with BUSINESS_MAILING_ADDRESS and opt-out line", async () => {
    process.env.BUSINESS_MAILING_ADDRESS =
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069";
    const { generateComplianceFooter } = await import("../lib/compliance");
    const footer = generateComplianceFooter();

    expect(footer[0]).toContain("Studio North LLC");
    expect(
      footer.some((line) => /opt out|unsubscribe/i.test(line)),
    ).toBe(true);
  });

  it("requires SENDING_DOMAIN for unsubscribe links", async () => {
    delete process.env.SENDING_DOMAIN;
    const { generateUnsubscribeLink } = await import("../lib/compliance");
    expect(() => generateUnsubscribeLink("abc")).toThrow(/SENDING_DOMAIN/);
  });

  it("validates footer lines correctly", async () => {
    process.env.BUSINESS_MAILING_ADDRESS =
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069";
    const { generateComplianceChecks, sanitizeFooterForOutbound, validateEmailCompliance } = await import(
      "../lib/compliance"
    );
    const rawFooter = [
      "1239 N kenmore Ave, Los Angeles, CA 90029",
      "If timing is off, just reply opt out and I will close the loop.",
    ];
    const footer = sanitizeFooterForOutbound(rawFooter);

    const checks = generateComplianceChecks(footer);
    const validation = validateEmailCompliance(footer);

    expect(checks.every((check) => check.passed)).toBe(true);
    expect(validation.valid).toBe(true);
    expect(footer.join("\n")).not.toContain("1239 N kenmore Ave");
  });
});
