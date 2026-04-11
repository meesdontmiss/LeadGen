import "server-only";

import { calculateOutreachScore, qualifiesForOutreach } from "@/lib/scoring";
import { env, hasRuntimeGmailEnv, hasSupabaseServerEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import type {
  ActivityItem,
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

const DEFAULT_DISCOVERY_PRESET: DashboardData["discoveryPreset"] = {
  neighborhoods: [
    "Beverly Hills",
    "West Hollywood",
    "Brentwood",
    "Pacific Palisades",
    "Newport Coast",
  ],
  verticals: [
    "Med spa",
    "Cosmetic dentistry",
    "Interior design",
    "Landscape design",
    "Concierge recovery",
  ],
  keywords: [
    "luxury med spa",
    "cosmetic dentist",
    "interior designer",
    "landscape architect",
    "concierge recovery",
  ],
  domainFilters: [".com", ".co", ".studio"],
  minimumPremiumFit: 65,
};

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
    discoveryPreset: DEFAULT_DISCOVERY_PRESET,
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
        fullName: String(row.full_name ?? "Unknown contact"),
        title: String(row.title ?? "Unknown title"),
        email: String(row.email ?? ""),
        confidence: Number(row.confidence ?? 0),
        source: String(row.source ?? "unknown"),
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
        capturedAt: String(row.captured_at ?? new Date().toISOString()),
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
        hook: String(row.hook ?? ""),
        screenshotNotes: {
          desktop: String(row.screenshot_desktop_path ?? "Desktop capture pending"),
          mobile: String(row.screenshot_mobile_path ?? "Mobile capture pending"),
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
        rationale: String(row.rationale ?? ""),
        teaserHeadline: String(row.summary ?? "Offer summary"),
        teaserSummary: String(row.rationale ?? ""),
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
        assignedTo: String(row.assigned_to ?? "Unassigned"),
        sendDomain: String(row.send_domain ?? "Not set"),
        lastTouchAt: String(row.last_touch_at ?? row.started_at ?? new Date().toISOString()),
        nextTouchAt: String(row.next_touch_at ?? row.started_at ?? new Date().toISOString()),
        pipelineValue: Number((row.metadata as { pipelineValue?: number } | null)?.pipelineValue ?? 0),
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
        subject: String(row.subject ?? ""),
        status: toEmailStatus(String(row.status ?? "draft")),
        direction: row.direction === "inbound" ? "inbound" : "outbound",
        subjectVariants: asArray<string>(row.subject_variants),
        plainText: String(row.body_text ?? ""),
        html: String(row.body_html ?? ""),
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
          name: String(row.name ?? "Unnamed company"),
          vertical: String(row.vertical ?? "Unknown vertical"),
          neighborhood: String(row.neighborhood ?? "Unknown neighborhood"),
          city: String(row.city ?? "Unknown city"),
          state: String(row.state ?? "CA"),
          domain: String(row.domain ?? ""),
          website: String(row.website_url ?? ""),
          phone: String(row.phone ?? ""),
          ownerName: String(row.owner_name ?? ""),
          premiumFit: Number(row.premium_fit ?? 0),
          contactability: Number(row.contactability ?? 0),
          status: toLeadStatus(String(row.lead_status ?? "new")),
          source: String(row.source ?? "unknown"),
          discoveredAt: String(row.created_at ?? new Date().toISOString()),
          notes: String(row.notes ?? ""),
        };

        return {
          company,
          contact,
          audit,
          offer,
          campaign,
          latestEmail,
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
      lastWarmupAt: String(row.last_warmup_at ?? new Date().toISOString()),
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
      lastRunAt: String(row.last_run_at ?? new Date().toISOString()),
      nextAction: String(row.next_action ?? ""),
    }));

    const liveActivity: ActivityItem[] = activity.map((row) => ({
      id: String(row.id),
      at: String(row.created_at ?? new Date().toISOString()),
      tone: mapTone(String(row.event_type ?? "")),
      title: String(row.event_summary ?? "Activity"),
      detail: JSON.stringify(row.payload ?? {}),
    }));

    return {
      discoveryPreset: DEFAULT_DISCOVERY_PRESET,
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
    const { error: campaignError } = await existing.supabase
      .from("campaigns")
      .update({
        status: "sent",
        last_touch_at: sentAt,
      })
      .eq("id", existing.campaignId);

    if (campaignError) {
      throw new Error(`Failed to update campaign after send: ${campaignError.message}`);
    }
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

  const { error: campaignError } = await supabase
    .from("campaigns")
    .update({
      last_touch_at: sentAt,
    })
    .eq("id", lead.campaign.id);

  if (campaignError) {
    throw new Error(`Failed to update campaign after reply: ${campaignError.message}`);
  }

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
