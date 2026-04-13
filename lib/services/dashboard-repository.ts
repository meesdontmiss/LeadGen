import "server-only";

import { randomUUID } from "node:crypto";

import { calculateOutreachScore, qualifiesForOutreach } from "@/lib/scoring";
import { env, hasRuntimeGmailEnv, hasSupabaseServerEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import type {
  ActivityItem,
  BookingStatus,
  BookingType,
  Campaign,
  Company,
  Contact,
  DashboardData,
  DomainHealth,
  EmailDraft,
  LeadRecord,
  Offer,
  SiteAudit,
  WorkerStatus,
} from "@/lib/types";

const FOLLOW_UP_DELAY_DAYS = [4, 6, 11, 14];

type CampaignFollowUpTouch = Campaign["followUpTouches"][number];
type CampaignBooking = Campaign["bookings"][number];

function buildSummary(leads: LeadRecord[], domains: DomainHealth[]) {
  return {
    discoveredThisWeek: leads.filter((lead) => {
      const discoveredAt = new Date(lead.company.discoveredAt).getTime();
      return discoveredAt >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }).length,
    qualifiedThisWeek: leads.filter((lead) => lead.qualifies).length,
    draftsReady: leads.filter(
      (lead) =>
        lead.latestEmail.status === "draft" ||
        lead.company.status === "draft_ready",
    ).length,
    sentToday: leads.filter((lead) => {
      const lastTouch = new Date(lead.campaign.lastTouchAt);
      const now = new Date();
      return (
        lastTouch.getUTCFullYear() === now.getUTCFullYear() &&
        lastTouch.getUTCMonth() === now.getUTCMonth() &&
        lastTouch.getUTCDate() === now.getUTCDate() &&
        lead.campaign.status === "sent"
      );
    }).length,
    positiveReplyRate:
      leads.length === 0
        ? 0
        : (leads.filter((lead) =>
            ["interested", "booked", "won"].includes(lead.campaign.status),
          ).length /
            leads.length) *
          100,
    complaintRate:
      domains.length === 0
        ? 0
        : domains.reduce((sum, item) => sum + item.complaintRate, 0) /
          domains.length,
    pipelineValue: leads.reduce(
      (sum, lead) => sum + lead.campaign.pipelineValue,
      0,
    ),
  };
}

function emptyDashboardData(notes: string[]): DashboardData {
  return {
    discoveryPreset: {
      neighborhoods: [],
      verticals: [],
      keywords: [],
      domainFilters: [],
      minimumPremiumFit: 0,
    },
    leads: [],
    domains: [],
    workers: [],
    summary: buildSummary([], []),
    activity: [],
    integrations: {
      dataSource: "empty",
      supabaseConfigured: hasSupabaseServerEnv(),
      supabaseProjectRef: env.SUPABASE_PROJECT_REF,
      gmailConfigured: hasRuntimeGmailEnv(),
      gmailMode: hasRuntimeGmailEnv() ? "runtime_oauth" : "unconfigured",
      notes,
    },
  };
}

function asArray<T>(value: unknown, fallback: T[] = []) {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBookingType(value: unknown): BookingType | null {
  return value === "call" || value === "gig" ? value : null;
}

function asBookingStatus(value: unknown): BookingStatus | null {
  return value === "scheduled" || value === "completed" || value === "canceled"
    ? value
    : null;
}

function parseFollowUpTouches(value: unknown): CampaignFollowUpTouch[] {
  return asArray<unknown>(value)
    .map((touch) => {
      const row = asRecord(touch);
      const id = typeof row.id === "string" ? row.id : null;
      const sentAt = typeof row.sentAt === "string" ? row.sentAt : null;
      const note = typeof row.note === "string" ? row.note : "";
      const messageId = typeof row.messageId === "string" ? row.messageId : null;

      if (!id || !sentAt) return null;

      return {
        id,
        sentAt,
        note,
        messageId,
      } satisfies CampaignFollowUpTouch;
    })
    .filter((touch): touch is CampaignFollowUpTouch => Boolean(touch))
    .sort((left, right) => left.sentAt.localeCompare(right.sentAt));
}

function parseBookings(value: unknown): CampaignBooking[] {
  return asArray<unknown>(value)
    .map((booking) => {
      const row = asRecord(booking);
      const type = asBookingType(row.type);
      const status = asBookingStatus(row.status);
      const id = typeof row.id === "string" ? row.id : null;
      const title = typeof row.title === "string" ? row.title : "";
      const scheduledAt = typeof row.scheduledAt === "string" ? row.scheduledAt : null;
      const notes = typeof row.notes === "string" ? row.notes : "";
      const createdAt = typeof row.createdAt === "string" ? row.createdAt : null;
      const updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : null;

      if (!id || !type || !status || !scheduledAt || !createdAt || !updatedAt) {
        return null;
      }

      return {
        id,
        type,
        status,
        title,
        scheduledAt,
        notes,
        createdAt,
        updatedAt,
      } satisfies CampaignBooking;
    })
    .filter((booking): booking is CampaignBooking => Boolean(booking))
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
}

function parseCampaignMetadata(value: unknown) {
  const metadata = asRecord(value);

  return {
    pipelineValue:
      typeof metadata.pipelineValue === "number" ? metadata.pipelineValue : 0,
    followUpTouches: parseFollowUpTouches(metadata.followUpTouches),
    bookings: parseBookings(metadata.bookings),
  };
}

function toCampaignMetadata({
  pipelineValue,
  followUpTouches,
  bookings,
  existing,
}: {
  pipelineValue: number;
  followUpTouches: CampaignFollowUpTouch[];
  bookings: CampaignBooking[];
  existing: Record<string, unknown>;
}) {
  return {
    ...existing,
    pipelineValue,
    followUpTouches,
    bookings,
  };
}

function computeNextTouchAt(sentTouches: number, sentAtIso: string) {
  const delayIndex = Math.min(
    Math.max(0, sentTouches - 1),
    FOLLOW_UP_DELAY_DAYS.length - 1,
  );
  const delayDays = FOLLOW_UP_DELAY_DAYS[delayIndex];
  const sentAt = new Date(sentAtIso);
  sentAt.setUTCDate(sentAt.getUTCDate() + delayDays);
  return sentAt.toISOString();
}

function toEmailStatus(value: string | null | undefined): EmailDraft["status"] {
  switch (value) {
    case "approved":
    case "sent":
    case "replied":
    case "bounced":
    case "suppressed":
      return value;
    default:
      return "draft";
  }
}

function toLeadStatus(value: string | null | undefined): Company["status"] {
  switch (value) {
    case "qualified":
    case "draft_ready":
    case "sent":
    case "replied":
    case "interested":
    case "booked":
    case "won":
    case "lost":
    case "do_not_contact":
      return value;
    default:
      return "new";
  }
}

function mapTone(value: string): ActivityItem["tone"] {
  if (/reply|book|won|sent/i.test(value)) return "positive";
  if (/warning|bounce|complaint|blocked|error/i.test(value)) return "warning";
  return "neutral";
}

function isLegacyProposalCopy(email: EmailDraft) {
  const text = `${email.subject} ${email.subjectVariants.join(" ")} ${email.plainText}`.toLowerCase();
  return (
    text.includes("quick growth idea") ||
    text.includes("i can share a concise teardown") ||
    text.includes("if useful, i can send the short brief this week")
  );
}

function outcomeLabel(vertical: string) {
  const lowered = vertical.toLowerCase();
  if (lowered.includes("interior")) return "project consultations";
  if (lowered.includes("hair") || lowered.includes("spa")) return "appointments";
  return "qualified consultations";
}

function offerLabel(type: Offer["type"]) {
  switch (type) {
    case "free_prototype_site":
      return "conversion prototype page";
    case "free_video_photo_concept":
      return "video/photo concept";
    case "free_teardown_brief":
    default:
      return "conversion teardown brief";
  }
}

function buildPainPointsForLead(lead: {
  company: Company;
  audit: SiteAudit;
}) {
  const points: Array<{ weight: number; text: string }> = [];
  const hasWebsite = Boolean(lead.company.website);

  if (!hasWebsite) {
    points.push({
      weight: 120,
      text: "There is no clear website conversion path in your public presence, which usually leaks intent before prospects book.",
    });
  } else {
    points.push({
      weight: 100 - lead.audit.scores.ctaQuality,
      text: "The path from first visit to inquiry likely needs a stronger single CTA and fewer decision branches.",
    });
    points.push({
      weight: 100 - lead.audit.scores.mobileQuality,
      text: "Mobile users are likely encountering friction, and that is where most local discovery traffic begins.",
    });
    points.push({
      weight: 100 - lead.audit.scores.trustSignals,
      text: "Trust signals are likely not prominent enough early in the page flow to support conversion confidence.",
    });
    points.push({
      weight: 100 - lead.audit.scores.seoBasics,
      text: "Local-intent visibility signals likely need tightening to attract better-fit inbound demand.",
    });
  }

  points.push({
    weight: lead.audit.scores.presentationGap,
    text: "Premium positioning is not yet translating into a consistently high-converting experience.",
  });

  points.sort((left, right) => right.weight - left.weight);
  return points.slice(0, 3).map((point) => point.text);
}

function upgradeLegacyDraftCopy(lead: {
  company: Company;
  audit: SiteAudit;
  offer: Offer;
  latestEmail: EmailDraft;
}) {
  const location = lead.company.neighborhood
    ? `${lead.company.neighborhood}, ${lead.company.city}`
    : lead.company.city;
  const outcome = outcomeLabel(lead.company.vertical);
  const painPoints = buildPainPointsForLead(lead);
  const offer = offerLabel(lead.offer.type);
  const websiteReference = lead.company.website
    ? `your site (${lead.company.website})`
    : "your current web presence";

  const subjectVariants = [
    `${lead.company.name}: 3 specific conversion fixes this week`,
    `Idea for ${lead.company.name}: more ${outcome} from ${location}`,
  ];

  const plainText = [
    `Hi ${lead.company.name} team,`,
    "",
    `I took a first-pass look at ${websiteReference} for your ${lead.company.vertical.toLowerCase()} business in ${location}, and there is a clear opportunity to turn more local attention into ${outcome}.`,
    "",
    "From a practical conversion perspective, the biggest pain points are:",
    ...painPoints.map((point, index) => `${index + 1}) ${point}`),
    "",
    `What I would execute for ${lead.company.name}:`,
    `1) Clarify positioning and value above the fold so high-intent visitors know exactly why to choose your team.`,
    `2) Simplify the inquiry path so visitors move directly into booking without friction.`,
    `3) Build a tailored ${offer} that directly addresses your current conversion gaps.`,
    "",
    `If useful, I can send a tailored no-cost ${offer} for ${lead.company.name} and walk through it on a quick 15-minute call this week.`,
    "Would Tuesday or Wednesday afternoon be better?",
  ].join("\n");

  return {
    ...lead.latestEmail,
    subject: subjectVariants[0],
    subjectVariants,
    plainText,
  } satisfies EmailDraft;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return emptyDashboardData([
      "Supabase runtime env is missing. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable live dashboard reads.",
      hasRuntimeGmailEnv()
        ? "Runtime Gmail OAuth env is configured."
        : "Runtime Gmail OAuth env is missing, so Gmail read/send actions are unavailable from the app.",
    ]);
  }

  try {
    const [
      companiesResult,
      contactsResult,
      auditsResult,
      offersResult,
      campaignsResult,
      emailsResult,
      domainsResult,
      workersResult,
      activityResult,
    ] = await Promise.all([
      supabase.from("companies").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(1000),
      supabase.from("contacts").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("site_audits").select("*").order("captured_at", { ascending: false }).limit(5000),
      supabase.from("offers").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("emails").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("domain_health").select("*").order("domain"),
      supabase.from("worker_status").select("*").order("worker_key"),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(8),
    ]);

    const results = [
      companiesResult,
      contactsResult,
      auditsResult,
      offersResult,
      campaignsResult,
      emailsResult,
      domainsResult,
      workersResult,
      activityResult,
    ];

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }

    const companies = (companiesResult.data ?? []) as Record<string, unknown>[];
    const contacts = (contactsResult.data ?? []) as Record<string, unknown>[];
    const audits = (auditsResult.data ?? []) as Record<string, unknown>[];
    const offers = (offersResult.data ?? []) as Record<string, unknown>[];
    const campaigns = (campaignsResult.data ?? []) as Record<string, unknown>[];
    const emails = (emailsResult.data ?? []) as Record<string, unknown>[];
    const domains = (domainsResult.data ?? []) as Record<string, unknown>[];
    const workers = (workersResult.data ?? []) as Record<string, unknown>[];
    const activity = (activityResult.data ?? []) as Record<string, unknown>[];

    const primaryContacts = new Map<string, Contact>();
    for (const row of contacts) {
      const companyId = String(row.company_id ?? "");
      if (!companyId || primaryContacts.has(companyId)) continue;
      primaryContacts.set(companyId, {
        id: String(row.id),
        companyId,
        fullName: toStringOrEmpty(row.full_name),
        title: toStringOrEmpty(row.title),
        email: toStringOrEmpty(row.email),
        confidence: Number(row.confidence ?? 0),
        source: toStringOrEmpty(row.source),
        primary: Boolean(row.is_primary ?? true),
      });
    }

    const latestAudits = new Map<string, SiteAudit>();
    for (const row of audits) {
      const companyId = String(row.company_id ?? "");
      if (!companyId || latestAudits.has(companyId)) continue;
      const premiumFit = Number(row.premium_fit ?? 0);
      const presentationGap = Number(row.presentation_gap ?? 0);
      const contactability = Number(
        companies.find((company) => String(company.id) === companyId)?.contactability ?? 0,
      );
      latestAudits.set(companyId, {
        id: String(row.id),
        companyId,
        capturedAt: toStringOrEmpty(row.captured_at),
        scores: {
          premiumFit,
          presentationGap,
          visualQuality: Number(row.visual_quality ?? 0),
          ctaQuality: Number(row.cta_quality ?? 0),
          trustSignals: Number(row.trust_signals ?? 0),
          mobileQuality: Number(row.mobile_quality ?? 0),
          seoBasics: Number(row.seo_basics ?? 0),
          contactability,
          outreachScore: calculateOutreachScore({
            premiumFit,
            presentationGap,
            contactability,
          }),
        },
        navFindings: asArray<string>(row.nav_summary),
        ctaFindings: asArray<string>(row.cta_summary),
        formFindings: asArray<string>(row.form_summary),
        strengths: asArray<string>(row.strengths),
        weaknesses: asArray<string>(row.weaknesses),
        hook: toStringOrEmpty(row.hook),
        screenshotNotes: {
          desktop: toStringOrEmpty(row.screenshot_desktop_path),
          mobile: toStringOrEmpty(row.screenshot_mobile_path),
        },
        recommendedOfferType:
          row.recommended_offer_type === "free_prototype_site" ||
          row.recommended_offer_type === "free_video_photo_concept" ||
          row.recommended_offer_type === "free_teardown_brief"
            ? row.recommended_offer_type
            : "free_teardown_brief",
      });
    }

    const offersByCompany = new Map<string, Offer>();
    for (const row of offers) {
      const companyId = String(row.company_id ?? "");
      if (!companyId || offersByCompany.has(companyId)) continue;
      offersByCompany.set(companyId, {
        id: String(row.id),
        companyId,
        type:
          row.offer_type === "free_prototype_site" ||
          row.offer_type === "free_video_photo_concept" ||
          row.offer_type === "free_teardown_brief"
            ? row.offer_type
            : "free_teardown_brief",
        rationale: toStringOrEmpty(row.rationale),
        teaserHeadline: toStringOrEmpty(row.summary),
        teaserSummary: toStringOrEmpty(row.rationale),
        homepageBrief: asArray<string>(row.homepage_brief),
        teaserJson:
          typeof row.teaser_page_json === "object" && row.teaser_page_json !== null
            ? (row.teaser_page_json as Record<string, unknown>)
            : {},
      });
    }

    const campaignsByCompany = new Map<string, Campaign>();
    for (const row of campaigns) {
      const companyId = String(row.company_id ?? "");
      if (!companyId || campaignsByCompany.has(companyId)) continue;
      const metadata = parseCampaignMetadata(row.metadata);
      campaignsByCompany.set(companyId, {
        id: String(row.id),
        companyId,
        status: toLeadStatus(String(row.status ?? "new")),
        offerType:
          row.offer_type === "free_prototype_site" ||
          row.offer_type === "free_video_photo_concept" ||
          row.offer_type === "free_teardown_brief"
            ? row.offer_type
            : "free_teardown_brief",
        assignedTo: toStringOrEmpty(row.assigned_to),
        sendDomain: toStringOrEmpty(row.send_domain),
        lastTouchAt: toStringOrEmpty(row.last_touch_at ?? row.started_at),
        nextTouchAt: toStringOrEmpty(row.next_touch_at ?? row.started_at),
        pipelineValue: Number(metadata.pipelineValue),
        followUpTouches: metadata.followUpTouches,
        bookings: metadata.bookings,
      });
    }

    const latestEmails = new Map<string, EmailDraft>();
    for (const row of emails) {
      const companyId = String(row.company_id ?? "");
      if (!companyId || latestEmails.has(companyId)) continue;
      const metadata =
        typeof row.metadata === "object" && row.metadata !== null
          ? (row.metadata as {
              complianceChecks?: EmailDraft["complianceChecks"];
            })
          : {};

      latestEmails.set(companyId, {
        id: String(row.id),
        companyId,
        contactId: String(row.contact_id ?? ""),
        subject: toStringOrEmpty(row.subject),
        status: toEmailStatus(String(row.status ?? "draft")),
        direction: row.direction === "inbound" ? "inbound" : "outbound",
        subjectVariants: asArray<string>(row.subject_variants),
        plainText: toStringOrEmpty(row.body_text),
        html: toStringOrEmpty(row.body_html),
        complianceFooter: asArray<string>(row.compliance_footer),
        gmailThreadId: typeof row.gmail_thread_id === "string" ? row.gmail_thread_id : null,
        gmailDraftId: typeof row.gmail_draft_id === "string" ? row.gmail_draft_id : null,
        sentAt: typeof row.sent_at === "string" ? row.sent_at : null,
        replyDetectedAt:
          typeof row.reply_detected_at === "string" ? row.reply_detected_at : null,
        complianceChecks: Array.isArray(metadata.complianceChecks)
          ? metadata.complianceChecks
          : [],
      });
    }

    const leads: LeadRecord[] = companies
      .map((row) => {
        const companyId = String(row.id);
        const contact = primaryContacts.get(companyId);
        const audit = latestAudits.get(companyId);
        const offer = offersByCompany.get(companyId);
        const campaign = campaignsByCompany.get(companyId);
        const latestEmail = latestEmails.get(companyId);

        if (!contact || !audit || !offer || !campaign || !latestEmail) {
          return null;
        }

        const company: Company = {
          id: companyId,
          name: toStringOrEmpty(row.name),
          vertical: toStringOrEmpty(row.vertical),
          neighborhood: toStringOrEmpty(row.neighborhood),
          city: toStringOrEmpty(row.city),
          state: toStringOrEmpty(row.state),
          domain: toStringOrEmpty(row.domain),
          website: toStringOrEmpty(row.website_url),
          phone: toStringOrEmpty(row.phone),
          ownerName: toStringOrEmpty(row.owner_name),
          premiumFit: Number(row.premium_fit ?? 0),
          contactability: Number(row.contactability ?? 0),
          status: toLeadStatus(String(row.lead_status ?? "new")),
          source: toStringOrEmpty(row.source),
          discoveredAt: toStringOrEmpty(row.created_at),
          notes: toStringOrEmpty(row.notes),
        };

        return {
          company,
          contact,
          audit,
          offer,
          campaign,
          latestEmail: isLegacyProposalCopy(latestEmail)
            ? upgradeLegacyDraftCopy({
                company,
                audit,
                offer,
                latestEmail,
              })
            : latestEmail,
          qualifies: qualifiesForOutreach({
            premiumFit: company.premiumFit,
            presentationGap: audit.scores.presentationGap,
            contactability: company.contactability,
          }),
        } satisfies LeadRecord;
      })
      .filter((lead): lead is LeadRecord => Boolean(lead))
      .sort(
        (left, right) =>
          right.audit.scores.outreachScore - left.audit.scores.outreachScore,
      );

    const liveDomains: DomainHealth[] = domains.map((row) => ({
      domain: String(row.domain ?? ""),
      status:
        row.status === "healthy" || row.status === "warming" || row.status === "attention"
          ? row.status
          : "attention",
      spf: Boolean(row.spf),
      dkim: Boolean(row.dkim),
      dmarc: Boolean(row.dmarc),
      inboxPlacement: Number(row.inbox_placement ?? 0),
      complaintRate: Number(row.complaint_rate ?? 0),
      dailyVolume: Number(row.daily_volume ?? 0),
      maxDailyVolume: Number(row.max_daily_volume ?? 0),
      lastWarmupAt: toStringOrEmpty(row.last_warmup_at ?? row.updated_at ?? row.created_at),
      notes: asArray<string>(row.notes),
    }));

    const liveWorkers: WorkerStatus[] = workers.map((row) => ({
      key:
        row.worker_key === "discovery" ||
        row.worker_key === "audit" ||
        row.worker_key === "outreach" ||
        row.worker_key === "prototype" ||
        row.worker_key === "gmail"
          ? row.worker_key
          : "discovery",
      label: String(row.label ?? "Worker"),
      state:
        row.state === "healthy" || row.state === "busy" || row.state === "attention"
          ? row.state
          : "attention",
      queueDepth: Number(row.queue_depth ?? 0),
      throughputPerHour: Number(row.throughput_per_hour ?? 0),
      lastRunAt: toStringOrEmpty(row.last_run_at ?? row.updated_at ?? row.created_at),
      nextAction: toStringOrEmpty(row.next_action),
    }));

    const liveActivity: ActivityItem[] = activity.map((row) => ({
      id: String(row.id),
      at: toStringOrEmpty(row.created_at),
      tone: mapTone(String(row.event_type ?? "")),
      title: toStringOrEmpty(row.event_summary),
      detail: JSON.stringify(row.payload ?? {}),
    }));

    return {
      discoveryPreset: {
        neighborhoods: [],
        verticals: [],
        keywords: [],
        domainFilters: [],
        minimumPremiumFit: 0,
      },
      leads,
      domains: liveDomains,
      workers: liveWorkers,
      summary: buildSummary(leads, liveDomains),
      activity: liveActivity,
      integrations: {
        dataSource: "supabase",
        supabaseConfigured: true,
        supabaseProjectRef: env.SUPABASE_PROJECT_REF,
        gmailConfigured: hasRuntimeGmailEnv(),
        gmailMode: hasRuntimeGmailEnv() ? "runtime_oauth" : "unconfigured",
        notes: [
          "Dashboard is reading lead records from Supabase.",
          hasRuntimeGmailEnv()
            ? "Runtime Gmail OAuth env is configured for thread reads and sends."
            : "Runtime Gmail OAuth env is not configured, so Gmail read/send actions are unavailable.",
        ],
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Supabase read failure.";

    return emptyDashboardData([
      "Supabase env is present, but live reads failed.",
      message,
      hasRuntimeGmailEnv()
        ? "Runtime Gmail OAuth env is configured."
        : "Runtime Gmail OAuth env is missing.",
    ]);
  }
}

export async function getLeadRecord(companyId: string) {
  const data = await getDashboardData();
  return data.leads.find((lead) => lead.company.id === companyId) ?? null;
}

async function getCampaignRecordById(campaignId: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error("Supabase client not configured. Cannot update campaigns.");
  }

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, company_id, metadata")
    .eq("id", campaignId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to load campaign: ${error?.message ?? "Missing campaign."}`);
  }

  return {
    supabase,
    id: String(data.id),
    companyId: String(data.company_id ?? ""),
    metadata: asRecord(data.metadata),
  };
}

async function getCampaignRecordByCompany(companyId: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error("Supabase client not configured. Cannot update campaigns.");
  }

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, company_id, metadata")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Failed to load campaign for company: ${error?.message ?? "Campaign missing."}`,
    );
  }

  return {
    supabase,
    id: String(data.id),
    companyId: String(data.company_id ?? ""),
    metadata: asRecord(data.metadata),
  };
}

async function getEmailRecordForUpdate(emailId: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error("Supabase client not configured. Cannot update email records.");
  }

  const { data, error } = await supabase
    .from("emails")
    .select("company_id, contact_id, campaign_id, metadata")
    .eq("id", emailId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to load email record: ${error?.message ?? "Missing email."}`);
  }

  return {
    supabase,
    companyId: String(data.company_id ?? ""),
    contactId: data.contact_id ? String(data.contact_id) : null,
    campaignId: data.campaign_id ? String(data.campaign_id) : null,
    metadata:
      typeof data.metadata === "object" && data.metadata !== null
        ? (data.metadata as Record<string, unknown>)
        : {},
  };
}

async function insertActivityLog({
  companyId,
  campaignId,
  actor,
  eventType,
  eventSummary,
  payload,
}: {
  companyId: string;
  campaignId?: string | null;
  actor: string;
  eventType: string;
  eventSummary: string;
  payload?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return;
  }

  await supabase.from("activity_logs").insert({
    company_id: companyId,
    campaign_id: campaignId ?? null,
    actor,
    event_type: eventType,
    event_summary: eventSummary,
    payload: payload ?? {},
  });
}

async function applyCampaignOutboundTouch({
  supabase,
  campaignId,
  metadata,
  sentAt,
  note,
  messageId,
}: {
  supabase: ReturnType<typeof getSupabaseAdmin> extends infer T
    ? NonNullable<T>
    : never;
  campaignId: string;
  metadata: Record<string, unknown>;
  sentAt: string;
  note: string;
  messageId: string | null;
}) {
  const parsed = parseCampaignMetadata(metadata);
  const nextTouches = [
    ...parsed.followUpTouches,
    {
      id: randomUUID(),
      sentAt,
      note,
      messageId,
    } satisfies CampaignFollowUpTouch,
  ];

  const nextTouchAt = computeNextTouchAt(nextTouches.length, sentAt);
  const metadataPayload = toCampaignMetadata({
    pipelineValue: parsed.pipelineValue,
    followUpTouches: nextTouches,
    bookings: parsed.bookings,
    existing: metadata,
  });

  const { error } = await supabase
    .from("campaigns")
    .update({
      status: "sent",
      last_touch_at: sentAt,
      next_touch_at: nextTouchAt,
      metadata: metadataPayload,
    })
    .eq("id", campaignId);

  if (error) {
    throw new Error(`Failed to update campaign after send: ${error.message}`);
  }

  return { nextTouchAt };
}

export async function persistGmailDraftMetadata({
  emailId,
  draftId,
  messageId,
  threadId,
}: {
  emailId: string;
  draftId: string | null;
  messageId: string | null;
  threadId: string | null;
}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error("Supabase client not configured. Cannot persist draft metadata.");
  }

  try {
    const existing = await getEmailRecordForUpdate(emailId);
    const { error } = await supabase
      .from("emails")
      .update({
        gmail_draft_id: draftId,
        gmail_thread_id: threadId,
        metadata: {
          ...existing.metadata,
          gmailMessageId: messageId,
        },
        status: "approved",
      })
      .eq("id", emailId);

    if (error) {
      console.error("[Supabase] Failed to persist Gmail draft metadata:", error);
      throw new Error(`Failed to update email record: ${error.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error("[persistGmailDraftMetadata] Error:", error);
    if (error instanceof Error && error.message.includes("Supabase client not configured")) {
      throw error;
    }
    throw new Error(
      `Failed to persist Gmail draft metadata: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function markEmailAsSent({
  emailId,
  subject,
  bodyText,
  threadId,
  messageId,
}: {
  emailId: string;
  subject: string;
  bodyText: string;
  threadId: string | null;
  messageId: string | null;
}) {
  const existing = await getEmailRecordForUpdate(emailId);
  const sentAt = new Date().toISOString();

  const { error } = await existing.supabase
    .from("emails")
    .update({
      subject,
      body_text: bodyText,
      gmail_thread_id: threadId,
      gmail_draft_id: null,
      sent_at: sentAt,
      status: "sent",
      metadata: {
        ...existing.metadata,
        gmailMessageId: messageId,
      },
    })
    .eq("id", emailId);

  if (error) {
    throw new Error(`Failed to mark email as sent: ${error.message}`);
  }

  if (existing.campaignId) {
    const campaign = await getCampaignRecordById(existing.campaignId);
    await applyCampaignOutboundTouch({
      supabase: campaign.supabase,
      campaignId: campaign.id,
      metadata: campaign.metadata,
      sentAt,
      note: `Initial outbound send: ${subject}`,
      messageId,
    });
  }

  const { error: companyError } = await existing.supabase
    .from("companies")
    .update({
      lead_status: "sent",
    })
    .eq("id", existing.companyId);

  if (companyError) {
    throw new Error(`Failed to update company after send: ${companyError.message}`);
  }

  await insertActivityLog({
    companyId: existing.companyId,
    campaignId: existing.campaignId,
    actor: "operator",
    eventType: "gmail_sent",
    eventSummary: `Sent email: ${subject}`,
    payload: {
      emailId,
      gmailMessageId: messageId,
      gmailThreadId: threadId,
    },
  });

  return { sentAt };
}

export async function createReplyRecord({
  lead,
  subject,
  bodyText,
  threadId,
  messageId,
}: {
  lead: LeadRecord;
  subject: string;
  bodyText: string;
  threadId: string | null;
  messageId: string | null;
}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error("Supabase client not configured. Cannot persist replies.");
  }

  const sentAt = new Date().toISOString();
  const metadata = {
    complianceChecks: lead.latestEmail.complianceChecks,
    gmailMessageId: messageId,
  };

  const { error } = await supabase.from("emails").insert({
    company_id: lead.company.id,
    contact_id: lead.contact.id,
    campaign_id: lead.campaign.id,
    gmail_thread_id: threadId,
    subject,
    subject_variants: [subject],
    body_text: bodyText,
    body_html: "",
    direction: "outbound",
    status: "sent",
    sent_at: sentAt,
    compliance_footer: lead.latestEmail.complianceFooter,
    metadata,
  });

  if (error) {
    throw new Error(`Failed to persist sent reply: ${error.message}`);
  }

  const campaign = await getCampaignRecordById(lead.campaign.id);
  await applyCampaignOutboundTouch({
    supabase: campaign.supabase,
    campaignId: campaign.id,
    metadata: campaign.metadata,
    sentAt,
    note: `Threaded follow-up: ${subject}`,
    messageId,
  });

  await insertActivityLog({
    companyId: lead.company.id,
    campaignId: lead.campaign.id,
    actor: "operator",
    eventType: "gmail_reply_sent",
    eventSummary: `Sent threaded reply: ${subject}`,
    payload: {
      gmailMessageId: messageId,
      gmailThreadId: threadId,
    },
  });

  return { sentAt };
}

export async function scheduleCampaignBooking({
  companyId,
  type,
  scheduledAt,
  title,
  notes,
}: {
  companyId: string;
  type: BookingType;
  scheduledAt: string;
  title: string;
  notes: string;
}) {
  const campaign = await getCampaignRecordByCompany(companyId);
  const parsed = parseCampaignMetadata(campaign.metadata);
  const now = new Date().toISOString();
  const booking: CampaignBooking = {
    id: randomUUID(),
    type,
    status: "scheduled",
    title,
    scheduledAt,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  const nextBookings = [booking, ...parsed.bookings].sort((left, right) =>
    left.scheduledAt.localeCompare(right.scheduledAt),
  );
  const metadataPayload = toCampaignMetadata({
    pipelineValue: parsed.pipelineValue,
    followUpTouches: parsed.followUpTouches,
    bookings: nextBookings,
    existing: campaign.metadata,
  });

  const { error: campaignError } = await campaign.supabase
    .from("campaigns")
    .update({
      status: "booked",
      metadata: metadataPayload,
    })
    .eq("id", campaign.id);

  if (campaignError) {
    throw new Error(`Failed to persist booking: ${campaignError.message}`);
  }

  const { error: companyError } = await campaign.supabase
    .from("companies")
    .update({
      lead_status: "booked",
    })
    .eq("id", companyId);

  if (companyError) {
    throw new Error(`Failed to update company status for booking: ${companyError.message}`);
  }

  await insertActivityLog({
    companyId,
    campaignId: campaign.id,
    actor: "operator",
    eventType: "booking_scheduled",
    eventSummary: `Scheduled ${type}: ${title}`,
    payload: {
      bookingId: booking.id,
      type,
      scheduledAt,
    },
  });

  return booking;
}

export async function updateCampaignBookingStatus({
  companyId,
  bookingId,
  status,
}: {
  companyId: string;
  bookingId: string;
  status: BookingStatus;
}) {
  const campaign = await getCampaignRecordByCompany(companyId);
  const parsed = parseCampaignMetadata(campaign.metadata);
  const nextBookings = parsed.bookings.map((booking) =>
    booking.id === bookingId
      ? { ...booking, status, updatedAt: new Date().toISOString() }
      : booking,
  );

  if (!nextBookings.some((booking) => booking.id === bookingId)) {
    throw new Error("Booking not found for this campaign.");
  }

  const metadataPayload = toCampaignMetadata({
    pipelineValue: parsed.pipelineValue,
    followUpTouches: parsed.followUpTouches,
    bookings: nextBookings,
    existing: campaign.metadata,
  });

  const { error } = await campaign.supabase
    .from("campaigns")
    .update({
      metadata: metadataPayload,
    })
    .eq("id", campaign.id);

  if (error) {
    throw new Error(`Failed to update booking: ${error.message}`);
  }

  await insertActivityLog({
    companyId,
    campaignId: campaign.id,
    actor: "operator",
    eventType: "booking_status_updated",
    eventSummary: `Booking ${bookingId} marked ${status}`,
    payload: { bookingId, status },
  });

  return { bookingId, status };
}
