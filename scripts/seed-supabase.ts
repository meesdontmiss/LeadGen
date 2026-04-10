import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { dashboardData } from "@/lib/mock-data";

function hashToUuid(value: string) {
  const hex = createHash("md5").update(value).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20, 32)}`;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function seed() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const companyIdMap = new Map<string, string>();
  const contactIdMap = new Map<string, string>();
  const campaignIdMap = new Map<string, string>();
  const emailIdMap = new Map<string, string>();
  const offerIdMap = new Map<string, string>();
  const auditIdMap = new Map<string, string>();

  for (const lead of dashboardData.leads) {
    companyIdMap.set(lead.company.id, hashToUuid(`company:${lead.company.id}`));
    contactIdMap.set(lead.contact.id, hashToUuid(`contact:${lead.contact.id}`));
    campaignIdMap.set(lead.campaign.id, hashToUuid(`campaign:${lead.campaign.id}`));
    emailIdMap.set(lead.latestEmail.id, hashToUuid(`email:${lead.latestEmail.id}`));
    offerIdMap.set(lead.offer.id, hashToUuid(`offer:${lead.offer.id}`));
    auditIdMap.set(lead.audit.id, hashToUuid(`audit:${lead.audit.id}`));
  }

  const deleteTargets = [
    "activity_logs",
    "emails",
    "campaigns",
    "offers",
    "site_audits",
    "contacts",
    "suppression_list",
    "domain_health",
    "worker_status",
    "companies",
  ] as const;

  for (const table of deleteTargets) {
    const { error } = await supabase.from(table).delete().not(
      table === "domain_health"
        ? "domain"
        : table === "worker_status"
          ? "worker_key"
          : table === "activity_logs"
            ? "id"
            : "id",
      "is",
      null,
    );

    if (error) {
      throw error;
    }
  }

  const companies = dashboardData.leads.map((lead) => ({
    id: companyIdMap.get(lead.company.id)!,
    created_at: lead.company.discoveredAt,
    updated_at: lead.company.discoveredAt,
    name: lead.company.name,
    normalized_name: lead.company.name.toLowerCase(),
    domain: lead.company.domain,
    website_url: lead.company.website,
    phone: lead.company.phone,
    phone_normalized: lead.company.phone.replace(/\D/g, ""),
    vertical: lead.company.vertical,
    neighborhood: lead.company.neighborhood,
    city: lead.company.city,
    state: lead.company.state,
    owner_name: lead.company.ownerName,
    premium_fit: lead.company.premiumFit,
    contactability: lead.company.contactability,
    lead_status: lead.company.status,
    source: lead.company.source,
    notes: lead.company.notes,
  }));

  const contacts = dashboardData.leads.map((lead) => ({
    id: contactIdMap.get(lead.contact.id)!,
    created_at: lead.company.discoveredAt,
    updated_at: lead.company.discoveredAt,
    company_id: companyIdMap.get(lead.company.id)!,
    full_name: lead.contact.fullName,
    title: lead.contact.title,
    email: lead.contact.email,
    source: lead.contact.source,
    confidence: lead.contact.confidence,
    is_primary: lead.contact.primary,
  }));

  const audits = dashboardData.leads.map((lead) => ({
    id: auditIdMap.get(lead.audit.id)!,
    created_at: lead.audit.capturedAt,
    company_id: companyIdMap.get(lead.company.id)!,
    captured_at: lead.audit.capturedAt,
    screenshot_desktop_path: lead.audit.screenshotNotes.desktop,
    screenshot_mobile_path: lead.audit.screenshotNotes.mobile,
    nav_summary: lead.audit.navFindings,
    cta_summary: lead.audit.ctaFindings,
    form_summary: lead.audit.formFindings,
    premium_fit: lead.audit.scores.premiumFit,
    presentation_gap: lead.audit.scores.presentationGap,
    visual_quality: lead.audit.scores.visualQuality,
    cta_quality: lead.audit.scores.ctaQuality,
    trust_signals: lead.audit.scores.trustSignals,
    mobile_quality: lead.audit.scores.mobileQuality,
    seo_basics: lead.audit.scores.seoBasics,
    weaknesses: lead.audit.weaknesses,
    strengths: lead.audit.strengths,
    hook: lead.audit.hook,
    recommended_offer_type: lead.audit.recommendedOfferType,
  }));

  const offers = dashboardData.leads.map((lead) => ({
    id: offerIdMap.get(lead.offer.id)!,
    created_at: lead.audit.capturedAt,
    updated_at: lead.audit.capturedAt,
    company_id: companyIdMap.get(lead.company.id)!,
    offer_type: lead.offer.type,
    summary: lead.offer.teaserHeadline,
    rationale: lead.offer.rationale,
    homepage_brief: lead.offer.homepageBrief,
    teaser_page_json: lead.offer.teaserJson,
    created_by: "openclaw",
  }));

  const campaigns = dashboardData.leads.map((lead) => ({
    id: campaignIdMap.get(lead.campaign.id)!,
    created_at: lead.campaign.lastTouchAt,
    updated_at: lead.campaign.lastTouchAt,
    company_id: companyIdMap.get(lead.company.id)!,
    name: `${lead.company.name} outbound`,
    status: lead.campaign.status,
    assigned_to: lead.campaign.assignedTo,
    offer_type: lead.campaign.offerType,
    send_domain: lead.campaign.sendDomain,
    started_at: lead.company.discoveredAt,
    last_touch_at: lead.campaign.lastTouchAt,
    next_touch_at: lead.campaign.nextTouchAt,
    metadata: {
      pipelineValue: lead.campaign.pipelineValue,
    },
  }));

  const emails = dashboardData.leads.map((lead) => ({
    id: emailIdMap.get(lead.latestEmail.id)!,
    created_at: lead.campaign.lastTouchAt,
    updated_at: lead.campaign.lastTouchAt,
    company_id: companyIdMap.get(lead.company.id)!,
    contact_id: contactIdMap.get(lead.contact.id)!,
    campaign_id: campaignIdMap.get(lead.campaign.id)!,
    subject: lead.latestEmail.subjectVariants[0] ?? `${lead.company.name} outreach`,
    subject_variants: lead.latestEmail.subjectVariants,
    body_text: lead.latestEmail.plainText,
    body_html: lead.latestEmail.html,
    direction: "outbound",
    status: lead.latestEmail.status,
    sent_at:
      lead.latestEmail.status === "sent" ||
      lead.latestEmail.status === "replied"
        ? lead.campaign.lastTouchAt
        : null,
    reply_detected_at:
      lead.latestEmail.status === "replied" ? lead.campaign.lastTouchAt : null,
    compliance_footer: lead.latestEmail.complianceFooter,
    metadata: {
      complianceChecks: lead.latestEmail.complianceChecks,
    },
  }));

  const domains = dashboardData.domains.map((domain) => ({
    domain: domain.domain,
    created_at: domain.lastWarmupAt,
    updated_at: domain.lastWarmupAt,
    status: domain.status,
    spf: domain.spf,
    dkim: domain.dkim,
    dmarc: domain.dmarc,
    inbox_placement: domain.inboxPlacement,
    complaint_rate: domain.complaintRate,
    daily_volume: domain.dailyVolume,
    max_daily_volume: domain.maxDailyVolume,
    last_warmup_at: domain.lastWarmupAt,
    notes: domain.notes,
  }));

  const workers = dashboardData.workers.map((worker) => ({
    worker_key: worker.key,
    created_at: worker.lastRunAt,
    updated_at: worker.lastRunAt,
    label: worker.label,
    state: worker.state,
    queue_depth: worker.queueDepth,
    throughput_per_hour: worker.throughputPerHour,
    last_run_at: worker.lastRunAt,
    next_action: worker.nextAction,
  }));

  const activity = dashboardData.activity.map((item, index) => ({
    created_at: item.at,
    company_id:
      dashboardData.leads[index]?.company.id
        ? companyIdMap.get(dashboardData.leads[index].company.id)!
        : null,
    campaign_id:
      dashboardData.leads[index]?.campaign.id
        ? campaignIdMap.get(dashboardData.leads[index].campaign.id)!
        : null,
    actor: "openclaw",
    event_type: item.tone,
    event_summary: item.title,
    payload: {
      detail: item.detail,
    },
  }));

  for (const [table, rows] of [
    ["companies", companies],
    ["contacts", contacts],
    ["site_audits", audits],
    ["offers", offers],
    ["campaigns", campaigns],
    ["emails", emails],
    ["domain_health", domains],
    ["worker_status", workers],
    ["activity_logs", activity],
  ] as const) {
    const { error } = await supabase.from(table).insert(rows);

    if (error) {
      throw error;
    }
  }

  console.log(`Seeded ${dashboardData.leads.length} lead records into Supabase.`);
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
