import "server-only";

import { randomUUID } from "node:crypto";

import { generateComplianceChecks, generateComplianceFooter } from "@/lib/compliance";
import { env, hasRuntimeGmailEnv } from "@/lib/env";
import { recommendOfferType } from "@/lib/scoring";
import { sendGmailMessage } from "@/lib/services/gmail";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type DiscoveryPreset = {
  key: string;
  label: string;
  overpassTag: { key: string; value: string };
  premiumBase: number;
  pipelineValue: number;
};

type CandidateLead = {
  sourceRef: string;
  name: string;
  normalizedName: string;
  vertical: string;
  neighborhood: string | null;
  city: string;
  state: string;
  domain: string | null;
  website: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  lat: number | null;
  lon: number | null;
  premiumFit: number;
  contactability: number;
  presentationGap: number;
  visualQuality: number;
  ctaQuality: number;
  trustSignals: number;
  mobileQuality: number;
  seoBasics: number;
  pipelineValue: number;
  note: string;
};

type ScanStats = {
  fetched: number;
  inserted: number;
  skippedExisting: number;
  failed: number;
  alertsSent: boolean;
  insertedCompanies: Array<{
    id: string;
    name: string;
    vertical: string;
    website: string | null;
  }>;
  errors: string[];
};

const DEFAULT_BBOX = "33.70,-118.67,34.35,-118.10";
const DEFAULT_CITY = "Los Angeles";
const DEFAULT_STATE = "CA";

const DISCOVERY_PRESETS: DiscoveryPreset[] = [
  {
    key: "med_spa",
    label: "Med Spa",
    overpassTag: { key: "beauty", value: "spa" },
    premiumBase: 80,
    pipelineValue: 9000,
  },
  {
    key: "plastic_surgery",
    label: "Plastic Surgery Clinic",
    overpassTag: { key: "healthcare", value: "clinic" },
    premiumBase: 78,
    pipelineValue: 12000,
  },
  {
    key: "luxury_hair",
    label: "Hair Salon",
    overpassTag: { key: "shop", value: "hairdresser" },
    premiumBase: 70,
    pipelineValue: 6000,
  },
  {
    key: "dentistry",
    label: "Dental Practice",
    overpassTag: { key: "amenity", value: "dentist" },
    premiumBase: 74,
    pipelineValue: 8000,
  },
  {
    key: "interior_design",
    label: "Interior Design",
    overpassTag: { key: "shop", value: "interior_decoration" },
    premiumBase: 76,
    pipelineValue: 9500,
  },
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? digits : null;
}

function normalizeWebsiteUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function extractDomain(website: string | null) {
  if (!website) return null;
  try {
    const parsed = new URL(website);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function chooseEmail(tags: Record<string, string>) {
  return (
    tags["contact:email"] ||
    tags.email ||
    null
  );
}

function chooseWebsite(tags: Record<string, string>) {
  return (
    tags.website ||
    tags["contact:website"] ||
    tags.url ||
    null
  );
}

function choosePhone(tags: Record<string, string>) {
  return (
    tags.phone ||
    tags["contact:phone"] ||
    null
  );
}

function buildInitialDraft({
  companyName,
  vertical,
  neighborhood,
}: {
  companyName: string;
  vertical: string;
  neighborhood: string | null;
}) {
  const locationLine = neighborhood
    ? `in ${neighborhood}, Los Angeles`
    : "in Los Angeles";
  const subjectVariants = [
    `${companyName}: quick growth idea`,
    `A better lead-conversion flow for ${companyName}`,
  ];
  const plainText = [
    `Hi ${companyName} team,`,
    "",
    `I reviewed your ${vertical.toLowerCase()} presence ${locationLine} and found a few opportunities to convert more qualified local leads.`,
    "",
    "I can share a concise teardown and a practical action plan you can execute immediately.",
    "",
    "If useful, I can send the short brief this week.",
  ].join("\n");

  return { subjectVariants, plainText };
}

async function fetchOverpassElements({
  bbox,
  tagKey,
  tagValue,
  limit,
}: {
  bbox: string;
  tagKey: string;
  tagValue: string;
  limit: number;
}) {
  const query = `
[out:json][timeout:25];
(
  node["${tagKey}"="${tagValue}"](${bbox});
  way["${tagKey}"="${tagValue}"](${bbox});
  relation["${tagKey}"="${tagValue}"](${bbox});
);
out tags center ${limit};
`.trim();

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "User-Agent": "OpenClawLeadEngine/1.0 (lead discovery worker)",
    },
    body: query,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed (${response.status}).`);
  }

  const payload = (await response.json()) as { elements?: OverpassElement[] };
  return payload.elements ?? [];
}

function toCandidates({
  elements,
  preset,
}: {
  elements: OverpassElement[];
  preset: DiscoveryPreset;
}) {
  const candidates: CandidateLead[] = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;

    const website = normalizeWebsiteUrl(chooseWebsite(tags));
    const domain = extractDomain(website);
    const phone = choosePhone(tags);
    const phoneNormalized = normalizePhone(phone);
    const email = chooseEmail(tags);
    const neighborhood = tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? null;

    const hasWebsite = Boolean(website);
    const hasPhone = Boolean(phoneNormalized);
    const hasEmail = Boolean(email);

    const contactability = clampScore(
      35 + (hasWebsite ? 25 : 0) + (hasPhone ? 25 : 0) + (hasEmail ? 15 : 0),
    );
    const presentationGap = clampScore(hasWebsite ? 58 : 78);
    const visualQuality = clampScore(hasWebsite ? 52 : 30);
    const ctaQuality = clampScore(hasWebsite ? 48 : 28);
    const trustSignals = clampScore(hasWebsite ? 50 : 32);
    const mobileQuality = clampScore(hasWebsite ? 46 : 25);
    const seoBasics = clampScore(hasWebsite ? 44 : 20);
    const premiumFit = clampScore(
      preset.premiumBase + (hasWebsite ? 6 : 0) + (hasPhone ? 4 : 0),
    );

    const lat = element.center?.lat ?? element.lat ?? null;
    const lon = element.center?.lon ?? element.lon ?? null;

    candidates.push({
      sourceRef: `osm:${element.type}:${element.id}`,
      name,
      normalizedName: normalizeName(name),
      vertical: preset.label,
      neighborhood,
      city: DEFAULT_CITY,
      state: DEFAULT_STATE,
      domain,
      website,
      phone,
      phoneNormalized,
      email,
      lat,
      lon,
      premiumFit,
      contactability,
      presentationGap,
      visualQuality,
      ctaQuality,
      trustSignals,
      mobileQuality,
      seoBasics,
      pipelineValue: preset.pipelineValue,
      note: "Discovered by OpenClaw daily Los Angeles scan.",
    });
  }

  return candidates;
}

export async function runLosAngelesDailyDiscoveryScan() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase server env is missing. Discovery scan cannot run.");
  }

  const maxPerVertical = env.OPENCLAW_DAILY_SCAN_MAX_PER_VERTICAL ?? 30;
  const bbox = env.OPENCLAW_DISCOVERY_BBOX ?? DEFAULT_BBOX;
  const footer = generateComplianceFooter();
  const complianceChecks = generateComplianceChecks(footer);

  const stats: ScanStats = {
    fetched: 0,
    inserted: 0,
    skippedExisting: 0,
    failed: 0,
    alertsSent: false,
    insertedCompanies: [],
    errors: [],
  };

  const [existingResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id, normalized_name, city, state, domain, phone_normalized")
      .limit(10000),
  ]);

  if (existingResult.error) {
    throw new Error(`Failed loading existing companies: ${existingResult.error.message}`);
  }

  const existingRows = (existingResult.data ?? []) as Array<{
    id: string;
    normalized_name: string;
    city: string;
    state: string;
    domain: string | null;
    phone_normalized: string | null;
  }>;

  const existingByDomain = new Set(
    existingRows.map((row) => row.domain?.toLowerCase()).filter(Boolean) as string[],
  );
  const existingByPhone = new Set(
    existingRows.map((row) => row.phone_normalized).filter(Boolean) as string[],
  );
  const existingByNameCity = new Set(
    existingRows.map((row) => `${row.normalized_name}|${row.city}|${row.state}`.toLowerCase()),
  );

  const rawCandidates: CandidateLead[] = [];

  for (const preset of DISCOVERY_PRESETS) {
    try {
      const elements = await fetchOverpassElements({
        bbox,
        tagKey: preset.overpassTag.key,
        tagValue: preset.overpassTag.value,
        limit: maxPerVertical,
      });
      const candidates = toCandidates({ elements, preset });
      rawCandidates.push(...candidates);
      stats.fetched += candidates.length;
    } catch (error) {
      stats.errors.push(
        `[${preset.key}] ${error instanceof Error ? error.message : "Scan failure"}`,
      );
    }
  }

  const deduped = new Map<string, CandidateLead>();
  for (const candidate of rawCandidates) {
    const key =
      candidate.domain ??
      candidate.phoneNormalized ??
      `${candidate.normalizedName}|${candidate.city}|${candidate.state}`;
    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  for (const candidate of deduped.values()) {
    const nameCityKey = `${candidate.normalizedName}|${candidate.city}|${candidate.state}`.toLowerCase();

    if (
      (candidate.domain && existingByDomain.has(candidate.domain.toLowerCase())) ||
      (candidate.phoneNormalized && existingByPhone.has(candidate.phoneNormalized)) ||
      existingByNameCity.has(nameCityKey)
    ) {
      stats.skippedExisting += 1;
      continue;
    }

    const offerType = recommendOfferType({
      presentationGap: candidate.presentationGap,
      visualQuality: candidate.visualQuality,
      ctaQuality: candidate.ctaQuality,
      contactability: candidate.contactability,
    });
    const qualifies =
      candidate.premiumFit >= 65 &&
      candidate.presentationGap >= 50 &&
      candidate.contactability >= 50;
    const leadStatus = qualifies ? "qualified" : "new";
    const draft = buildInitialDraft({
      companyName: candidate.name,
      vertical: candidate.vertical,
      neighborhood: candidate.neighborhood,
    });

    try {
      const companyInsert = await supabase
        .from("companies")
        .insert({
          name: candidate.name,
          normalized_name: candidate.normalizedName,
          domain: candidate.domain,
          website_url: candidate.website,
          phone: candidate.phone,
          phone_normalized: candidate.phoneNormalized,
          vertical: candidate.vertical,
          neighborhood: candidate.neighborhood,
          city: candidate.city,
          state: candidate.state,
          owner_name: null,
          premium_fit: candidate.premiumFit,
          contactability: candidate.contactability,
          lead_status: leadStatus,
          source: "openclaw_daily_scan",
          notes: `${candidate.note} source_ref=${candidate.sourceRef}`,
          enrichment: {
            sourceRef: candidate.sourceRef,
            location: { lat: candidate.lat, lon: candidate.lon },
          },
        })
        .select("id")
        .single();

      if (companyInsert.error || !companyInsert.data) {
        throw new Error(companyInsert.error?.message ?? "Company insert failed.");
      }

      const companyId = String(companyInsert.data.id);

      const contactInsert = await supabase
        .from("contacts")
        .insert({
          company_id: companyId,
          full_name: candidate.name,
          title: "Business Owner",
          email: candidate.email,
          phone: candidate.phone,
          source: "openclaw_daily_scan",
          confidence: candidate.email ? 82 : 56,
          is_primary: true,
        })
        .select("id")
        .single();

      if (contactInsert.error || !contactInsert.data) {
        throw new Error(contactInsert.error?.message ?? "Contact insert failed.");
      }

      const campaignInsert = await supabase
        .from("campaigns")
        .insert({
          company_id: companyId,
          name: `${candidate.city} ${candidate.vertical} outbound`,
          status: leadStatus,
          assigned_to: "openclaw",
          offer_type: offerType,
          send_domain: env.SENDING_DOMAIN ?? null,
          metadata: {
            pipelineValue: candidate.pipelineValue,
            followUpTouches: [],
            bookings: [],
          },
        })
        .select("id")
        .single();

      if (campaignInsert.error || !campaignInsert.data) {
        throw new Error(campaignInsert.error?.message ?? "Campaign insert failed.");
      }

      const campaignId = String(campaignInsert.data.id);

      const auditInsert = await supabase.from("site_audits").insert({
        company_id: companyId,
        premium_fit: candidate.premiumFit,
        presentation_gap: candidate.presentationGap,
        visual_quality: candidate.visualQuality,
        cta_quality: candidate.ctaQuality,
        trust_signals: candidate.trustSignals,
        mobile_quality: candidate.mobileQuality,
        seo_basics: candidate.seoBasics,
        nav_summary: [
          "Initial daily scan snapshot captured by OpenClaw.",
        ],
        cta_summary: [
          "CTA quality estimated from available public business metadata.",
        ],
        form_summary: [
          "Form/contact experience pending deep crawl audit.",
        ],
        weaknesses: [
          "Requires full site audit for presentation and conversion details.",
        ],
        strengths: [
          candidate.website ? "Public website detected." : "Local listing present.",
        ],
        hook: `Potential ${candidate.vertical.toLowerCase()} growth opportunity in ${candidate.city}.`,
        recommended_offer_type: offerType,
        audit_payload: {
          sourceRef: candidate.sourceRef,
          estimated: true,
        },
      });

      if (auditInsert.error) {
        throw new Error(auditInsert.error.message ?? "Audit insert failed.");
      }

      const offerInsert = await supabase.from("offers").insert({
        company_id: companyId,
        offer_type: offerType,
        summary: `Performance teardown for ${candidate.name}`,
        rationale:
          "Generated from daily LA discovery scan; prioritize conversion and local demand capture.",
        homepage_brief: [
          "Clarify premium positioning in hero section.",
          "Tighten CTA path for call/gig booking.",
          "Add trust elements and social proof above fold.",
        ],
        teaser_page_json: {
          source: "openclaw_daily_scan",
          sourceRef: candidate.sourceRef,
        },
        created_by: "openclaw",
      });

      if (offerInsert.error) {
        throw new Error(offerInsert.error.message ?? "Offer insert failed.");
      }

      const emailInsert = await supabase.from("emails").insert({
        company_id: companyId,
        contact_id: String(contactInsert.data.id),
        campaign_id: campaignId,
        subject: draft.subjectVariants[0],
        subject_variants: draft.subjectVariants,
        body_text: draft.plainText,
        body_html: "",
        direction: "outbound",
        status: "draft",
        compliance_footer: footer,
        metadata: {
          complianceChecks,
          discoveredBy: "openclaw_daily_scan",
        },
      });

      if (emailInsert.error) {
        throw new Error(emailInsert.error.message ?? "Email draft insert failed.");
      }

      existingByNameCity.add(nameCityKey);
      if (candidate.domain) existingByDomain.add(candidate.domain.toLowerCase());
      if (candidate.phoneNormalized) existingByPhone.add(candidate.phoneNormalized);

      stats.inserted += 1;
      stats.insertedCompanies.push({
        id: companyId,
        name: candidate.name,
        vertical: candidate.vertical,
        website: candidate.website,
      });
    } catch (error) {
      stats.failed += 1;
      stats.errors.push(
        `[${candidate.name}] ${error instanceof Error ? error.message : "Insert failure"}`,
      );
    }
  }

  if (env.OPENCLAW_ALERT_EMAIL && hasRuntimeGmailEnv()) {
    try {
      const topNames = stats.insertedCompanies
        .slice(0, 10)
        .map((company) => `- ${company.name} (${company.vertical})`)
        .join("\n");
      const body = [
        "OpenClaw daily Los Angeles discovery scan completed.",
        "",
        `Fetched candidates: ${stats.fetched}`,
        `Inserted new leads: ${stats.inserted}`,
        `Skipped existing: ${stats.skippedExisting}`,
        `Failed inserts: ${stats.failed}`,
        "",
        topNames ? "New leads:" : "No new leads inserted this run.",
        topNames,
      ]
        .filter(Boolean)
        .join("\n");

      await sendGmailMessage({
        to: env.OPENCLAW_ALERT_EMAIL,
        subject: "OpenClaw Daily Lead Scan Summary",
        body,
      });

      stats.alertsSent = true;
    } catch (error) {
      stats.errors.push(
        `[alert] ${error instanceof Error ? error.message : "Failed to send alert email"}`,
      );
    }
  }

  return {
    runId: randomUUID(),
    city: DEFAULT_CITY,
    state: DEFAULT_STATE,
    bbox,
    maxPerVertical,
    ...stats,
  };
}
