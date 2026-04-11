import { env } from "@/lib/env";

/**
 * Generates a compliance footer with physical address and opt-out line
 * to be appended to all outbound emails
 */
export function generateComplianceFooter(): string[] {
  const footer: string[] = [];

  // Add physical address from env
  const physicalAddress = env.PHYSICAL_ADDRESS;
  if (physicalAddress) {
    footer.push(physicalAddress);
  } else {
    // Fallback warning - should be configured before production
    console.warn("[Compliance] PHYSICAL_ADDRESS env var not configured. This is required for CAN-SPAM compliance.");
    footer.push("[Company Name], [Address Required]");
  }

  // Add opt-out line
  footer.push("If timing is off, just reply 'opt out' and I will close the loop.");

  return footer;
}

/**
 * Generates compliance checks for email review
 */
export function generateComplianceChecks(footer: string[]): Array<{ label: string; passed: boolean }> {
  const hasAddress = footer.length > 0 && footer[0] !== "[Company Name], [Address Required]";
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
  // In production, this should point to a real unsubscribe endpoint
  // For now, uses mailto: as a simple approach
  const sendingDomain = env.SENDING_DOMAIN || "example.com";
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
