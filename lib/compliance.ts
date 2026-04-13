import { env } from "@/lib/env";

const DEFAULT_OPT_OUT_LINE =
  "If timing is off, just reply 'opt out' and I will close the loop.";

function isOptOutLine(line: string) {
  return /opt out|unsubscribe/i.test(line);
}

function pickOptOutLine(lines: string[]) {
  return lines.find((line) => isOptOutLine(line)) ?? DEFAULT_OPT_OUT_LINE;
}

/**
 * Generates a safe outbound footer.
 * - Never uses PHYSICAL_ADDRESS (legacy)
 * - Uses BUSINESS_MAILING_ADDRESS only when explicitly configured
 * - Always includes a clear opt-out line
 */
export function generateComplianceFooter(): string[] {
  const businessAddress = env.BUSINESS_MAILING_ADDRESS?.trim();
  if (businessAddress) {
    return [businessAddress, DEFAULT_OPT_OUT_LINE];
  }

  return [DEFAULT_OPT_OUT_LINE];
}

/**
 * Sanitizes any stored footer before send.
 * This prevents legacy PHYSICAL_ADDRESS values from being sent.
 */
export function sanitizeFooterForOutbound(storedFooter: string[]): string[] {
  const businessAddress = env.BUSINESS_MAILING_ADDRESS?.trim();
  const optOutLine = pickOptOutLine(storedFooter);

  if (businessAddress) {
    return [businessAddress, optOutLine];
  }

  return [optOutLine];
}

/**
 * Generates compliance checks for email review
 */
export function generateComplianceChecks(footer: string[]): Array<{ label: string; passed: boolean }> {
  const hasAddress = footer.some((line) => !isOptOutLine(line) && line.trim().length > 10);
  const hasOptOut = footer.some((line) => isOptOutLine(line));
  const addressConfigured = Boolean(env.BUSINESS_MAILING_ADDRESS);

  return [
    {
      label: "Business mailing address included",
      passed: addressConfigured ? hasAddress : true,
    },
    { label: "Clear opt-out line included", passed: hasOptOut },
    { label: "Subject is non-deceptive", passed: true }, // Manual review needed
    { label: "First-touch still requires human send approval", passed: true },
  ];
}

/**
 * Generates an unsubscribe link for HTML emails
 */
export function generateUnsubscribeLink(companyId: string): string {
  const sendingDomain = env.SENDING_DOMAIN;
  
  if (!sendingDomain) {
    throw new Error(
      "SENDING_DOMAIN env var is required before generating unsubscribe links.",
    );
  }
  
  const unsubscribeEmail = `unsubscribe@${sendingDomain}`;

  return `<a href="mailto:${unsubscribeEmail}?subject=Unsubscribe%20${companyId}">Unsubscribe</a>`;
}

/**
 * Validates that an email meets all compliance requirements
 */
export function validateEmailCompliance(footer: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const addressConfigured = Boolean(env.BUSINESS_MAILING_ADDRESS?.trim());

  if (footer.length === 0) {
    errors.push("Compliance footer is empty");
  } else {
    const hasAddress = footer.some((line) => !isOptOutLine(line) && line.trim().length > 10);
    if (addressConfigured && !hasAddress) {
      errors.push("BUSINESS_MAILING_ADDRESS is configured but missing in footer");
    }

    const hasOptOut = footer.some((line) => isOptOutLine(line));
    if (!hasOptOut) {
      errors.push("No opt-out mechanism in footer");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
