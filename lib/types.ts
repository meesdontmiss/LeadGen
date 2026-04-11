export type LeadStatus =
  | "new"
  | "qualified"
  | "draft_ready"
  | "sent"
  | "replied"
  | "interested"
  | "booked"
  | "won"
  | "lost"
  | "do_not_contact";

export type OfferType =
  | "free_prototype_site"
  | "free_video_photo_concept"
  | "free_teardown_brief";

export type EmailStatus =
  | "draft"
  | "approved"
  | "sent"
  | "replied"
  | "bounced"
  | "suppressed";

export type DomainHealthStatus = "healthy" | "warming" | "attention";
export type WorkerState = "healthy" | "busy" | "attention";

export interface Company {
  id: string;
  name: string;
  vertical: string;
  neighborhood: string;
  city: string;
  state: string;
  domain: string;
  website: string;
  phone: string;
  ownerName: string;
  premiumFit: number;
  contactability: number;
  status: LeadStatus;
  source: string;
  discoveredAt: string;
  notes: string;
}

export interface Contact {
  id: string;
  companyId: string;
  fullName: string;
  title: string;
  email: string;
  confidence: number;
  source: string;
  primary: boolean;
}

export interface SiteAudit {
  id: string;
  companyId: string;
  capturedAt: string;
  scores: {
    premiumFit: number;
    presentationGap: number;
    visualQuality: number;
    ctaQuality: number;
    trustSignals: number;
    mobileQuality: number;
    seoBasics: number;
    contactability: number;
    outreachScore: number;
  };
  navFindings: string[];
  ctaFindings: string[];
  formFindings: string[];
  strengths: string[];
  weaknesses: string[];
  hook: string;
  screenshotNotes: {
    desktop: string;
    mobile: string;
  };
  recommendedOfferType: OfferType;
}

export interface Offer {
  id: string;
  companyId: string;
  type: OfferType;
  rationale: string;
  teaserHeadline: string;
  teaserSummary: string;
  homepageBrief: string[];
  teaserJson: Record<string, unknown>;
}

export interface EmailDraft {
  id: string;
  companyId: string;
  contactId: string;
  subject: string;
  status: EmailStatus;
  direction: "outbound" | "inbound";
  subjectVariants: string[];
  plainText: string;
  html: string;
  complianceFooter: string[];
  gmailThreadId: string | null;
  gmailDraftId: string | null;
  sentAt: string | null;
  replyDetectedAt: string | null;
  complianceChecks: Array<{
    label: string;
    passed: boolean;
  }>;
}

export interface GmailThreadMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  sentAt: string;
  direction: "inbound" | "outbound";
}

export interface Campaign {
  id: string;
  companyId: string;
  status: LeadStatus;
  offerType: OfferType;
  assignedTo: string;
  sendDomain: string;
  lastTouchAt: string;
  nextTouchAt: string;
  pipelineValue: number;
}

export interface DomainHealth {
  domain: string;
  status: DomainHealthStatus;
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  inboxPlacement: number;
  complaintRate: number;
  dailyVolume: number;
  maxDailyVolume: number;
  lastWarmupAt: string;
  notes: string[];
}

export interface WorkerStatus {
  key: "discovery" | "audit" | "outreach" | "prototype" | "gmail";
  label: string;
  state: WorkerState;
  queueDepth: number;
  throughputPerHour: number;
  lastRunAt: string;
  nextAction: string;
}

export interface DiscoveryPreset {
  neighborhoods: string[];
  verticals: string[];
  keywords: string[];
  domainFilters: string[];
  minimumPremiumFit: number;
}

export interface QueueSummary {
  discoveredThisWeek: number;
  qualifiedThisWeek: number;
  draftsReady: number;
  sentToday: number;
  positiveReplyRate: number;
  complaintRate: number;
  pipelineValue: number;
}

export interface ActivityItem {
  id: string;
  at: string;
  tone: "neutral" | "positive" | "warning";
  title: string;
  detail: string;
}

export interface LeadRecord {
  company: Company;
  contact: Contact;
  audit: SiteAudit;
  offer: Offer;
  campaign: Campaign;
  latestEmail: EmailDraft;
  qualifies: boolean;
}

export interface IntegrationStatus {
  dataSource: "empty" | "supabase";
  supabaseConfigured: boolean;
  supabaseProjectRef?: string;
  gmailConfigured: boolean;
  gmailMode: "unconfigured" | "runtime_oauth";
  notes: string[];
}

export interface DashboardData {
  discoveryPreset: DiscoveryPreset;
  leads: LeadRecord[];
  domains: DomainHealth[];
  workers: WorkerStatus[];
  summary: QueueSummary;
  activity: ActivityItem[];
  integrations: IntegrationStatus;
}
