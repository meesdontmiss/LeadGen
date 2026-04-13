import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Compliance Utilities", () => {
  const originalPhysicalAddress = process.env.PHYSICAL_ADDRESS;
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

    if (originalSendingDomain === undefined) {
      delete process.env.SENDING_DOMAIN;
    } else {
      process.env.SENDING_DOMAIN = originalSendingDomain;
    }
  });

  it("requires PHYSICAL_ADDRESS before generating footer", async () => {
    delete process.env.PHYSICAL_ADDRESS;
    const { generateComplianceFooter } = await import("../lib/compliance");
    expect(() => generateComplianceFooter()).toThrow(/PHYSICAL_ADDRESS/);
  });

  it("generates footer with address and opt-out line", async () => {
    process.env.PHYSICAL_ADDRESS =
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
    process.env.PHYSICAL_ADDRESS =
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069";
    const { generateComplianceChecks, validateEmailCompliance } = await import(
      "../lib/compliance"
    );
    const footer = [
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069",
      "If timing is off, just reply opt out and I will close the loop.",
    ];

    const checks = generateComplianceChecks(footer);
    const validation = validateEmailCompliance(footer);

    expect(checks.every((check) => check.passed)).toBe(true);
    expect(validation.valid).toBe(true);
  });
});
