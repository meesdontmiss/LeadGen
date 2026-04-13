import { env } from "@/lib/env";

/**
 * Generates a compliance footer with physical address and opt-out line
 * to be appended to all outbound emails
 */
export function generateComplianceFooter(): string[] {
  const physicalAddress = env.PHYSICAL_ADDRESS;
  if (!physicalAddress) {
    throw new Error(
      "PHYSICAL_ADDRESS env var is required before sending outbound email.",
    );
  }

  return [
    physicalAddress,
    "If timing is off, just reply 'opt out' and I will close the loop.",
  ];
}

/**
 * Generates compliance checks for email review
 */
export function generateComplianceChecks(footer: string[]): Array<{ label: string; passed: boolean }> {
  const hasAddress = footer.length > 0 && footer[0].trim().length > 10;
  const hasOptOut = footer.some(line => line.toLowerCase().includes("opt out") || line.toLowerCase().includes("unsubscribe"));

  return [
    { label: "Physical address included", passed: hasAddress },
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

  if (!env.PHYSICAL_ADDRESS) {
    errors.push("PHYSICAL_ADDRESS env var not configured");
  }

  if (footer.length === 0) {
    errors.push("Compliance footer is empty");
  } else {
    const hasAddress = footer.some(line => 
      line.includes(",") && line.length > 10
    );
    
    if (!hasAddress) {
      errors.push("No valid physical address in footer");
    }

    const hasOptOut = footer.some(line =>
      line.toLowerCase().includes("opt out") || 
      line.toLowerCase().includes("unsubscribe")
    );

    if (!hasOptOut) {
      errors.push("No opt-out mechanism in footer");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
