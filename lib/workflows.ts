import type { LeadStatus, OfferType } from "@/lib/types";

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: "Lead/New",
  qualified: "Lead/Qualified",
  draft_ready: "Lead/DraftReady",
  sent: "Lead/Sent",
  replied: "Lead/Replied",
  interested: "Lead/Interested",
  booked: "Lead/Booked",
  won: "Lead/Won",
  lost: "Lead/Lost",
  do_not_contact: "Lead/DoNotContact",
};

export const offerLabels: Record<OfferType, string> = {
  free_prototype_site: "Free prototype site",
  free_video_photo_concept: "Free video / photo concept",
  free_teardown_brief: "Free teardown brief",
};

export const followUpSchedule = [
  { label: "Initial touch", dayOffset: 0 },
  { label: "Follow-up 1", dayOffset: 4 },
  { label: "Follow-up 2", dayOffset: 10 },
  { label: "Close-loop", dayOffset: 21 },
];

export const gmailLabels = [
  "Lead/New",
  "Lead/Qualified",
  "Lead/DraftReady",
  "Lead/Sent",
  "Lead/Replied",
  "Lead/Interested",
  "Lead/Booked",
  "Lead/Won",
  "Lead/Lost",
  "Lead/DoNotContact",
];

export const sendGuardrails = [
  "SPF, DKIM, and DMARC must all pass before first-touch sends.",
  "Every outbound email includes a physical address and a one-line opt-out.",
  "No deceptive subject lines; subject variants are reviewed against the actual offer.",
  "Sends are rate-limited per domain and halted immediately on bounce, reply, or complaint risk.",
  "Human approval remains the default for all first-touch emails.",
];

export const stopConditions = [
  "Reply received",
  "Bounce detected",
  "Opt-out requested",
  "Do-not-contact flag",
  "Complaint risk flag",
];

export const mvpModules = [
  "Scraper",
  "Audit worker",
  "Scoring engine",
  "Outreach generator",
  "Gmail draft creation",
  "Simple dashboard",
];

export const phaseTwoModules = [
  "Reply sync",
  "Follow-up automation",
  "Prototype teaser generation",
  "Richer contact enrichment",
];

export const phaseThreeModules = [
  "OpenClaw command execution",
  "Multi-user roles",
  "Multiple sending domains",
  "Auto-book consultation workflows",
];
