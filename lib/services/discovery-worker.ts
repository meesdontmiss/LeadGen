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
  owner_name: string | null;
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
  jobListingsDetected: boolean;
  jobListingUrls: string[];
  discoveredEmails: string[];
  note: string;
};

type ScanStats = {
  fetched: number;
  inserted: number;
  skippedExisting: number;
  failed: number;
  websitesEnriched: number;
  jobListingSignals: number;
  emailsDiscovered: number;
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
const DISCOVERY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WEBSITE_ENRICHMENT_LIMIT_PER_RUN = 24;
const WEBSITE_ENRICHMENT_PAGE_LIMIT = 8;
const WEBSITE_REQUEST_TIMEOUT_MS = 4000;
const WEBSITE_FALLBACK_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/team",
  "/support",
  "/book",
  "/appointments",
  "/careers",
  "/jobs",
  "/join-us",
  "/employment",
  "/leadership",
  "/management",
  "/our-team",
];
const CRAWL_PATH_PATTERN =
  /\/(contact|about|team|support|book|appointment|career|careers|jobs?|employment|join-us|leadership|management|our-team)\b/i;

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
  {
    key: "film_tv_production",
    label: "Film & TV Production",
    overpassTag: { key: "office", value: "company" }, // General company, will filter by keywords
    premiumBase: 85,
    pipelineValue: 25000,
  },
];

const TARGET_ROLES = [
  { pattern: /\b(marketing|growth|outreach|sales|partnerships?)\s*(manager|director|vp|head|lead)\b/i, title: "Marketing Lead" },
  { pattern: /\b(creative|content|production|film|media|studio)\s*(director|producer|executive|vp|head)\b/i, title: "Creative Executive" },
  { pattern: /\b(ceo|founder|owner|principal|managing partner)\b/i, title: "Business Owner" },
];

function findContactDetails(html: string, text: string) {
  const found: Array<{ name: string | null; email: string | null; title: string }> = [];
  
  // Try to find names near role keywords
  for (const role of TARGET_ROLES) {
    const match = text.match(role.pattern);
    if (match) {
      // Look for capitalized names in the vicinity (crude but often works for team pages)
      const context = text.slice(Math.max(0, (match.index ?? 0) - 100), (match.index ?? 0) + 100);
      const nameMatch = context.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
      
      found.push({
        name: nameMatch ? nameMatch[1] : null,
        email: null, // Will be filled by general email extractor
        title: role.title,
      });
    }
  }
  return found;
}

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
  const raw =
    tags["contact:email"] ||
    tags.email ||
    null;
  return normalizeEmail(raw);
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

function normalizeEmail(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;

  const [localPart = "", domainPart = ""] = trimmed.split("@");
  if (!localPart || !domainPart) return null;

  const tld = domainPart.split(".").pop() ?? "";
  const blockedTlds = new Set([
    "gif",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "svg",
    "css",
    "js",
    "ico",
    "woff",
    "woff2",
    "ttf",
    "otf",
    "eot",
    "map",
    "pdf",
    "xml",
    "json",
  ]);
  if (blockedTlds.has(tld)) return null;

  const blockedLocals = new Set(["you", "yourname", "name", "example", "test", "sample"]);
  if (blockedLocals.has(localPart)) return null;
  if (/^(image|img|icon|logo|ajax-loader)([-_.].*)?$/i.test(localPart)) return null;
  if (/^(example|yourdomain|domain)\./i.test(domainPart)) return null;

  return trimmed;
}

function stripHtml(raw: string) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmails(raw: string) {
  const matches = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) ?? [];
  const unique = new Set<string>();
  for (const match of matches) {
    const normalized = normalizeEmail(match);
    if (normalized) unique.add(normalized);
  }
  return [...unique];
}

function scoreEmail(email: string, domain: string | null) {
  let score = 0;
  if (domain && email.endsWith(`@${domain}`)) score += 30;
  if (/^(hello|hi|contact|info|team|office|bookings|careers|jobs|hiring)@/i.test(email)) {
    score += 20;
  }
  if (/^(no-?reply|donotreply|noreply)@/i.test(email)) {
    score -= 15;
  }
  return score;
}

function pickBestEmail(emails: string[], domain: string | null) {
  if (emails.length === 0) return null;
  return [...emails].sort((left, right) => scoreEmail(right, domain) - scoreEmail(left, domain))[0] ?? null;
}

function hasJobKeywords(text: string) {
  return /\b(career|careers|jobs?|hiring|open positions|join our team|employment)\b/i.test(text);
}

function extractCandidateLinks(html: string, baseUrl: string) {
  const links: string[] = [];
  const mailtoEmails = new Set<string>();
  const regex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null = regex.exec(html);

  const base = new URL(baseUrl);
  const baseOrigin = base.origin;

  while (match) {
    const href = match[1];
    try {
      if (/^mailto:/i.test(href)) {
        const candidate = decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0] ?? "");
        const normalized = normalizeEmail(candidate);
        if (normalized) {
          mailtoEmails.add(normalized);
        }
        match = regex.exec(html);
        continue;
      }

      const absolute = new URL(href, baseUrl).toString();
      if (/^https?:/i.test(absolute) && new URL(absolute).origin === baseOrigin) {
        links.push(absolute);
      }
    } catch {
      // ignore invalid href
    }
    match = regex.exec(html);
  }
  return {
    links,
    mailtoEmails: [...mailtoEmails],
  };
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBSITE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "OpenClawLeadEngine/1.0 (website enrichment)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return null;

    const html = await response.text();
    return { html, finalUrl: response.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichWebsiteSignals({
  website,
  domain,
}: {
  website: string;
  domain: string | null;
}) {
  const queue: string[] = [website];
  const visited = new Set<string>();
  const emails = new Set<string>();
  const jobListingUrls = new Set<string>();
  const potentialContacts: Array<{ name: string | null; email: string | null; title: string }> = [];

  for (const path of WEBSITE_FALLBACK_PATHS) {
    try {
      queue.push(new URL(path, website).toString());
    } catch {
      // ignore
    }
  }

  while (queue.length > 0 && visited.size < WEBSITE_ENRICHMENT_PAGE_LIMIT) {
    const nextUrl = queue.shift();
    if (!nextUrl || visited.has(nextUrl)) continue;
    visited.add(nextUrl);

    const result = await fetchHtml(nextUrl);
    if (!result) continue;

    const { html, finalUrl } = result;
    const text = stripHtml(html);
    for (const email of extractEmails(`${html}\n${text}`)) {
      emails.add(email);
    }

    // Try to find specific roles
    const contactsOnPage = findContactDetails(html, text);
    potentialContacts.push(...contactsOnPage);

    const looksLikeJobPage =
      hasJobKeywords(text) || /\/(career|careers|jobs?|employment|join-us)\b/i.test(finalUrl);

    if (looksLikeJobPage) {
      jobListingUrls.add(finalUrl);
    }

    const { links, mailtoEmails } = extractCandidateLinks(html, finalUrl);
    for (const email of mailtoEmails) {
      emails.add(email);
    }

    const crawlLinks = links.filter((link) =>
      CRAWL_PATH_PATTERN.test(link) || /[?&](job|career|contact)/i.test(link),
    );

    for (const link of crawlLinks) {
      if (!visited.has(link) && !queue.includes(link)) queue.push(link);
    }
  }

  const discoveredEmails = [...emails];
  // Dedupe potential contacts and pick the best one
  const bestContact = potentialContacts.find(c => c.name) || potentialContacts[0] || null;

  return {
    jobListingsDetected: jobListingUrls.size > 0,
    jobListingUrls: [...jobListingUrls].slice(0, 8),
    discoveredEmails,
    bestEmail: pickBestEmail(discoveredEmails, domain),
    bestContact,
  };
}

type ProposalBlueprint = {
  subjectVariants: string[];
  plainText: string;
  navSummary: string[];
  ctaSummary: string[];
  formSummary: string[];
  weaknesses: string[];
  strengths: string[];
  hook: string;
  offerSummary: string;
  offerRationale: string;
  homepageBrief: string[];
};

function offerLabel(offerType: ReturnType<typeof recommendOfferType>) {
  switch (offerType) {
    case "free_prototype_site":
      return "conversion-focused landing page mockup";
    case "free_video_photo_concept":
      return "visual content strategy";
    case "free_teardown_brief":
    default:
      return "site conversion audit";
  }
}

function offerDescription(offerType: ReturnType<typeof recommendOfferType>, painPoints: string[]) {
  const topPain = painPoints[0] ?? "conversion flow";
  switch (offerType) {
    case "free_prototype_site":
      return `a redesigned landing page mockup that fixes the issues above — specifically addressing how ${topPain.toLowerCase().replace(/\.$/, "")}`;
    case "free_video_photo_concept":
      return `a visual content plan tied to the exact trust and credibility gaps on your current site — built to directly address how ${topPain.toLowerCase().replace(/\.$/, "")}`;
    case "free_teardown_brief":
    default:
      return `a prioritized action plan with the exact fixes for the issues above — starting with how ${topPain.toLowerCase().replace(/\.$/, "")}`;
  }
}

function outcomeLabel(vertical: string) {
  const lowered = vertical.toLowerCase();
  if (lowered.includes("interior")) return "project consultations";
  if (lowered.includes("hair") || lowered.includes("spa")) return "appointments";
  return "qualified consultations";
}

function buildPainPoints(candidate: CandidateLead) {
  const painPoints: Array<{ weight: number; text: string }> = [];

  if (candidate.jobListingsDetected) {
    painPoints.push({
      weight: 82,
      text: "Hiring activity appears visible online; customer and hiring journeys should stay clearly separated so sales intent is not diluted.",
    });
  }

  if (!candidate.website) {
    painPoints.push({
      weight: 120,
      text: "There is no clear website flow in your public listing, which usually leaks intent before prospects ever book.",
    });
  } else {
    painPoints.push({
      weight: 100 - candidate.ctaQuality,
      text: "The path from first visit to booking likely needs a stronger single CTA and cleaner decision path.",
    });
    painPoints.push({
      weight: 100 - candidate.mobileQuality,
      text: "Mobile visitors are likely facing friction, and that is where most local discovery traffic now starts.",
    });
    painPoints.push({
      weight: 100 - candidate.trustSignals,
      text: "Trust elements are probably not doing enough work above the fold (proof, credibility, and results).",
    });
    painPoints.push({
      weight: 100 - candidate.seoBasics,
      text: "Local-intent content and metadata likely need tightening to capture higher-quality search demand.",
    });
  }

  painPoints.push({
    weight: candidate.presentationGap,
    text: "Premium positioning is not yet translating cleanly into a high-converting experience.",
  });

  painPoints.sort((left, right) => right.weight - left.weight);
  return painPoints.slice(0, 3).map((item) => item.text);
}

function buildSolutionSteps(
  candidate: CandidateLead,
) {
  const steps: string[] = [];

  if (candidate.ctaQuality < 60) {
    steps.push(`Restructure ${candidate.name}'s homepage so the main call-to-action is impossible to miss in the first screen.`);
  } else {
    steps.push(`Sharpen ${candidate.name}'s value messaging so visitors immediately understand why you're the right choice.`);
  }

  if (candidate.mobileQuality < 60) {
    steps.push("Fix the mobile booking flow — most of your local traffic starts on a phone and the current path has too much friction.");
  } else {
    steps.push("Simplify the inquiry path so high-intent visitors convert without second-guessing.");
  }

  if (candidate.trustSignals < 60) {
    steps.push("Add visible proof above the fold — reviews, results, credentials — so trust is earned before the scroll.");
  }

  if (candidate.jobListingsDetected) {
    steps.push(
      "Separate the customer journey from recruiting pages so sales intent isn't diluted.",
    );
  }

  return steps.slice(0, 3);
}

const AI_STYLE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bi hope this email finds you well\b/gi, replacement: "" },
  { pattern: /\bjust wanted to reach out\b/gi, replacement: "" },
  { pattern: /\bi wanted to take a moment\b/gi, replacement: "" },
  { pattern: /\bi came across your\b/gi, replacement: "I reviewed your" },
  { pattern: /\bleverage\b/gi, replacement: "use" },
  { pattern: /\bunlock\b/gi, replacement: "capture" },
  { pattern: /\bsynergy\b/gi, replacement: "alignment" },
  { pattern: /\brevolutionize\b/gi, replacement: "improve" },
  { pattern: /\bgame[\s-]?changing\b/gi, replacement: "high-impact" },
  { pattern: /\bseamless\b/gi, replacement: "simple" },
  { pattern: /\bdelve into\b/gi, replacement: "review" },
  { pattern: /\btouching base\b/gi, replacement: "following up" },
  { pattern: /\bpotential customers\b/gi, replacement: "buyers" },
  { pattern: /\bdon't hesitate to\b/gi, replacement: "" },
  { pattern: /\bplease feel free to\b/gi, replacement: "" },
];

function normalizeSalesCopyTone(text: string) {
  let normalized = text;
  for (const rule of AI_STYLE_REPLACEMENTS) {
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }
  return normalized.replace(/\n{3,}/g, "\n\n").trim();
}

function buildInitialProposal(
  candidate: CandidateLead,
  offerType: ReturnType<typeof recommendOfferType>,
): ProposalBlueprint {
  const location = candidate.neighborhood
    ? `${candidate.neighborhood}, ${candidate.city}`
    : candidate.city;
  const offer = offerLabel(offerType);
  const outcome = outcomeLabel(candidate.vertical);
  const painPoints = buildPainPoints(candidate);
  const solutionSteps = buildSolutionSteps(candidate);
  const websiteReference = candidate.website
    ? `your site (${candidate.website})`
    : "your current web presence";
  const greetingTarget = candidate.name.includes(" ") ? candidate.name : `${candidate.name} team`;

  const subjectVariants = [
    `${candidate.name} — free ${offer} for your site`,
    `Spotted 3 fixable issues on ${candidate.name}'s site`,
    `Quick question for ${greetingTarget}`,
  ];

  const freeOfferDesc = offerDescription(offerType, painPoints);

  const plainText = normalizeSalesCopyTone([
    `Hi ${greetingTarget},`,
    "",
    `My name's Toby — I run a small web studio in LA that helps local ${candidate.vertical.toLowerCase()} businesses turn more of their website visitors into booked ${outcome}.`,
    "",
    `I came across ${websiteReference} while researching ${candidate.vertical.toLowerCase()} businesses in ${location} and spent some time reviewing it from a potential customer's perspective. You clearly do quality work, so I wanted to flag a few things that are likely costing you ${outcome}:`,
    "",
    ...painPoints.map((point) => `→ ${point}`),
    "",
    "Here's what I'd prioritize fixing:",
    ...solutionSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    `I went ahead and put together ${freeOfferDesc}. It's completely free — I do these for businesses I think I can genuinely help, and it's the best way to show what I mean rather than just talk about it.`,
    "",
    "Happy to send it over or walk through it on a quick 15-min call — whichever works better for you.",
  ].join("\n"));

  return {
    subjectVariants,
    plainText,
    navSummary: [
      `First-pass conversion review completed for ${websiteReference}.`,
      `Primary market context: ${location}.`,
    ],
    ctaSummary: [
      painPoints[0] ?? "Primary CTA path needs clarification and prioritization.",
      "Recommendation: define one primary conversion objective per page.",
    ],
    formSummary: [
      "Inquiry flow should reduce fields and remove friction for high-intent mobile visitors.",
      "Follow-up handoff should commit to a clear response timeline.",
    ],
    weaknesses: painPoints,
    strengths: [
      candidate.website ? "A public website is available to optimize." : "Public listing visibility is present.",
      candidate.phone ? "Phone contact is present for direct lead capture." : "Contact pathways can be expanded quickly.",
    ],
    hook: `${candidate.name} can likely capture more ${outcome} by tightening conversion flow and proof structure.`,
    offerSummary: `Custom ${offer} for ${candidate.name}`,
    offerRationale: `Focused on ${location} demand capture, conversion-path clarity, and faster movement from first visit to booked conversation.`,
    homepageBrief: solutionSteps,
  };
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

function isMediaCompany(name: string, tags: Record<string, string>) {
  const mediaKeywords = /\b(film|studio|production|media|cinema|entertainment|video|creative|advertising|digital|agency)\b/i;
  const description = tags.description || tags.about || "";
  return mediaKeywords.test(name) || mediaKeywords.test(description) || tags.office === "studio";
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

    // Special filtering for film/tv production if using the generic company preset
    if (preset.key === "film_tv_production" && !isMediaCompany(name, tags)) {
      continue;
    }

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
      owner_name: null,
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
      jobListingsDetected: false,
      jobListingUrls: [],
      discoveredEmails: email ? [email] : [],
      note: `Discovered by OpenClaw daily Los Angeles scan. preset=${preset.key}`,
    });
  }

  return candidates;
}

async function updateDiscoveryWorkerStatus({
  supabase,
  state,
  queueDepth,
  throughputPerHour,
  nextAction,
  lastRunAt,
}: {
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  state: "healthy" | "busy" | "attention";
  queueDepth: number;
  throughputPerHour: number;
  nextAction: string;
  lastRunAt?: string | null;
}) {
  await supabase.from("worker_status").upsert(
    {
      worker_key: "discovery",
      label: "Discovery worker",
      state,
      queue_depth: queueDepth,
      throughput_per_hour: throughputPerHour,
      last_run_at: lastRunAt ?? null,
      next_action: nextAction,
    },
    { onConflict: "worker_key" },
  );
}

export async function runLosAngelesDailyDiscoveryScan({
  force = false,
}: {
  force?: boolean;
} = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase server env is missing. Discovery scan cannot run.");
  }

  const maxPerVertical = env.OPENCLAW_DAILY_SCAN_MAX_PER_VERTICAL ?? 30;
  const bbox = env.OPENCLAW_DISCOVERY_BBOX ?? DEFAULT_BBOX;
  const runStartedAt = new Date();
  const runStartedAtIso = runStartedAt.toISOString();

  const stats: ScanStats = {
    fetched: 0,
    inserted: 0,
    skippedExisting: 0,
    failed: 0,
    websitesEnriched: 0,
    jobListingSignals: 0,
    emailsDiscovered: 0,
    alertsSent: false,
    insertedCompanies: [],
    errors: [],
  };

  const lastRunResult = await supabase
    .from("worker_status")
    .select("last_run_at")
    .eq("worker_key", "discovery")
    .maybeSingle();

  if (lastRunResult.error) {
    throw new Error(`Failed reading discovery worker status: ${lastRunResult.error.message}`);
  }

  const lastRunAt =
    typeof lastRunResult.data?.last_run_at === "string"
      ? new Date(lastRunResult.data.last_run_at)
      : null;
  const nowMs = runStartedAt.getTime();
  const lastRunMs = lastRunAt?.getTime() ?? null;
  const remainingCooldownMs =
    lastRunMs === null ? 0 : Math.max(0, DISCOVERY_COOLDOWN_MS - (nowMs - lastRunMs));

  if (!force && remainingCooldownMs > 0) {
    const nextEligibleAt = new Date(nowMs + remainingCooldownMs).toISOString();
    const cooldownMessage = `Daily discovery scan skipped. Cooldown active for ${Math.ceil(
      remainingCooldownMs / 60000,
    )} more minutes.`;
    stats.errors.push(cooldownMessage);

    await updateDiscoveryWorkerStatus({
      supabase,
      state: "healthy",
      queueDepth: 0,
      throughputPerHour: 0,
      nextAction: `Next discovery run available at ${nextEligibleAt}.`,
      lastRunAt: lastRunAt?.toISOString() ?? null,
    });

    return {
      runId: randomUUID(),
      city: DEFAULT_CITY,
      state: DEFAULT_STATE,
      bbox,
      maxPerVertical,
      skipped: true,
      cooldownEnforced: true,
      force,
      lastRunAt: lastRunAt?.toISOString() ?? null,
      nextEligibleAt,
      ...stats,
    };
  }

  await updateDiscoveryWorkerStatus({
    supabase,
    state: "busy",
    queueDepth: DISCOVERY_PRESETS.length,
    throughputPerHour: 0,
    nextAction: "Running daily Los Angeles discovery scan.",
    lastRunAt: lastRunAt?.toISOString() ?? null,
  });

  try {
    const footer = generateComplianceFooter();
    const complianceChecks = generateComplianceChecks(footer);

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

    let enrichmentRuns = 0;

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

      const enrichedCandidate: CandidateLead = { ...candidate };

      if (enrichedCandidate.website && enrichmentRuns < WEBSITE_ENRICHMENT_LIMIT_PER_RUN) {
        enrichmentRuns += 1;
        try {
          const enrichment = await enrichWebsiteSignals({
            website: enrichedCandidate.website,
            domain: enrichedCandidate.domain,
          });
          stats.websitesEnriched += 1;
          if (enrichment.jobListingsDetected) {
            stats.jobListingSignals += 1;
          }
          if (enrichment.discoveredEmails.length > 0) {
            stats.emailsDiscovered += enrichment.discoveredEmails.length;
          }

          if (enrichment.bestContact) {
            if (enrichment.bestContact.name) {
              enrichedCandidate.owner_name = enrichment.bestContact.name;
            }
            enrichedCandidate.note += ` title=${enrichment.bestContact.title.replace(/\s+/g, "_")}`;
          }

          enrichedCandidate.jobListingsDetected = enrichment.jobListingsDetected;
          enrichedCandidate.jobListingUrls = enrichment.jobListingUrls;
          enrichedCandidate.discoveredEmails = [
            ...new Set([
              ...enrichedCandidate.discoveredEmails,
              ...enrichment.discoveredEmails,
            ]),
          ];
          if (!enrichedCandidate.email && enrichment.bestEmail) {
            enrichedCandidate.email = enrichment.bestEmail;
          }
          if (enrichedCandidate.email && !enrichedCandidate.discoveredEmails.includes(enrichedCandidate.email)) {
            enrichedCandidate.discoveredEmails.push(enrichedCandidate.email);
          }
          enrichedCandidate.contactability = clampScore(
            35 +
              (enrichedCandidate.website ? 25 : 0) +
              (enrichedCandidate.phoneNormalized ? 25 : 0) +
              (enrichedCandidate.email ? 15 : 0),
          );
        } catch (error) {
          stats.errors.push(
            `[enrichment:${enrichedCandidate.name}] ${
              error instanceof Error ? error.message : "Website enrichment failed"
            }`,
          );
        }
      }

      const offerType = recommendOfferType({
        presentationGap: enrichedCandidate.presentationGap,
        visualQuality: enrichedCandidate.visualQuality,
        ctaQuality: enrichedCandidate.ctaQuality,
        contactability: enrichedCandidate.contactability,
      });
      const qualifies =
        enrichedCandidate.premiumFit >= 65 &&
        enrichedCandidate.presentationGap >= 50 &&
        enrichedCandidate.contactability >= 50;
      const leadStatus = qualifies ? "qualified" : "new";
      const proposal = buildInitialProposal(enrichedCandidate, offerType);

      try {
        const companyInsert = await supabase
          .from("companies")
          .insert({
            name: enrichedCandidate.name,
            normalized_name: enrichedCandidate.normalizedName,
            domain: enrichedCandidate.domain,
            website_url: enrichedCandidate.website,
            phone: enrichedCandidate.phone,
            phone_normalized: enrichedCandidate.phoneNormalized,
            vertical: enrichedCandidate.vertical,
            neighborhood: enrichedCandidate.neighborhood,
            city: enrichedCandidate.city,
            state: enrichedCandidate.state,
            owner_name: enrichedCandidate.owner_name,
            premium_fit: enrichedCandidate.premiumFit,
            contactability: enrichedCandidate.contactability,
            lead_status: leadStatus,
            source: "openclaw_daily_scan",
            notes: `${enrichedCandidate.note} source_ref=${enrichedCandidate.sourceRef}${
              enrichedCandidate.jobListingsDetected ? " job_listings=true" : ""
            }`,
            enrichment: {
              sourceRef: enrichedCandidate.sourceRef,
              location: { lat: enrichedCandidate.lat, lon: enrichedCandidate.lon },
              jobListingsDetected: enrichedCandidate.jobListingsDetected,
              jobListingUrls: enrichedCandidate.jobListingUrls,
              discoveredEmails: enrichedCandidate.discoveredEmails,
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
            full_name: enrichmentRuns > 0 && enrichedCandidate.owner_name ? enrichedCandidate.owner_name : enrichedCandidate.name,
            title: enrichedCandidate.note.includes("title=") ? enrichedCandidate.note.split("title=")[1].split(" ")[0].replace(/_/g, " ") : "Business Owner",
            email: enrichedCandidate.email,
            phone: enrichedCandidate.phone,
            source: "openclaw_daily_scan",
            confidence: enrichedCandidate.email ? 82 : 56,
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
            name: `${enrichedCandidate.city} ${enrichedCandidate.vertical} outbound`,
            status: leadStatus,
            assigned_to: "openclaw",
            offer_type: offerType,
            send_domain: env.SENDING_DOMAIN ?? null,
            metadata: {
              pipelineValue: enrichedCandidate.pipelineValue,
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
          premium_fit: enrichedCandidate.premiumFit,
          presentation_gap: enrichedCandidate.presentationGap,
          visual_quality: enrichedCandidate.visualQuality,
          cta_quality: enrichedCandidate.ctaQuality,
          trust_signals: enrichedCandidate.trustSignals,
          mobile_quality: enrichedCandidate.mobileQuality,
          seo_basics: enrichedCandidate.seoBasics,
          nav_summary: proposal.navSummary,
          cta_summary: proposal.ctaSummary,
          form_summary: proposal.formSummary,
          weaknesses: proposal.weaknesses,
          strengths: proposal.strengths,
          hook: proposal.hook,
          recommended_offer_type: offerType,
          audit_payload: {
            sourceRef: enrichedCandidate.sourceRef,
            estimated: true,
            jobListingsDetected: enrichedCandidate.jobListingsDetected,
            jobListingUrls: enrichedCandidate.jobListingUrls,
          },
        });

        if (auditInsert.error) {
          throw new Error(auditInsert.error.message ?? "Audit insert failed.");
        }

        const offerInsert = await supabase.from("offers").insert({
          company_id: companyId,
          offer_type: offerType,
          summary: proposal.offerSummary,
          rationale: proposal.offerRationale,
          homepage_brief: proposal.homepageBrief,
          teaser_page_json: {
            source: "openclaw_daily_scan",
            sourceRef: enrichedCandidate.sourceRef,
            jobListingsDetected: enrichedCandidate.jobListingsDetected,
            discoveredEmails: enrichedCandidate.discoveredEmails,
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
          subject: proposal.subjectVariants[0],
          subject_variants: proposal.subjectVariants,
          body_text: proposal.plainText,
          body_html: "",
          direction: "outbound",
          status: "draft",
          compliance_footer: footer,
          metadata: {
            complianceChecks,
            discoveredBy: "openclaw_daily_scan",
            jobListingsDetected: enrichedCandidate.jobListingsDetected,
            discoveredEmails: enrichedCandidate.discoveredEmails,
          },
        });

        if (emailInsert.error) {
          throw new Error(emailInsert.error.message ?? "Email draft insert failed.");
        }

        existingByNameCity.add(nameCityKey);
        if (enrichedCandidate.domain) existingByDomain.add(enrichedCandidate.domain.toLowerCase());
        if (enrichedCandidate.phoneNormalized) existingByPhone.add(enrichedCandidate.phoneNormalized);

        stats.inserted += 1;
        stats.insertedCompanies.push({
          id: companyId,
          name: enrichedCandidate.name,
          vertical: enrichedCandidate.vertical,
          website: enrichedCandidate.website,
        });
      } catch (error) {
        stats.failed += 1;
        stats.errors.push(
          `[${enrichedCandidate.name}] ${error instanceof Error ? error.message : "Insert failure"}`,
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
          `Websites enriched: ${stats.websitesEnriched}`,
          `Job listing signals found: ${stats.jobListingSignals}`,
          `Emails discovered from websites: ${stats.emailsDiscovered}`,
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

    const runFinishedAt = new Date();
    const runDurationHours = Math.max(
      0.0001,
      (runFinishedAt.getTime() - runStartedAt.getTime()) / (60 * 60 * 1000),
    );
    const throughputPerHour = Math.max(0, Math.round(stats.inserted / runDurationHours));
    const nextEligibleAt = new Date(
      runFinishedAt.getTime() + DISCOVERY_COOLDOWN_MS,
    ).toISOString();

    await updateDiscoveryWorkerStatus({
      supabase,
      state: stats.errors.length > 0 ? "attention" : "healthy",
      queueDepth: 0,
      throughputPerHour,
      lastRunAt: runFinishedAt.toISOString(),
      nextAction:
        stats.errors.length > 0
          ? "Discovery completed with warnings. Review scan errors."
          : `Discovery complete. Next scheduled run after ${nextEligibleAt}.`,
    });

    return {
      runId: randomUUID(),
      city: DEFAULT_CITY,
      state: DEFAULT_STATE,
      bbox,
      maxPerVertical,
      skipped: false,
      cooldownEnforced: true,
      force,
      lastRunAt: runFinishedAt.toISOString(),
      nextEligibleAt,
      ...stats,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unexpected discovery worker failure.";

    await updateDiscoveryWorkerStatus({
      supabase,
      state: "attention",
      queueDepth: 0,
      throughputPerHour: 0,
      lastRunAt: runStartedAtIso,
      nextAction: `Discovery run failed: ${errorMessage}`,
    });

    throw error;
  }
}

type EmailBackfillStats = {
  scanned: number;
  updated: number;
  skippedHasEmail: number;
  skippedNoWebsite: number;
  skippedNoPrimaryContact: number;
  noEmailFound: number;
  failures: number;
  details: Array<{
    companyId: string;
    companyName: string;
    email: string;
  }>;
};

export async function runMissingEmailBackfill({
  limit = 200,
}: {
  limit?: number;
} = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase server env is missing. Email backfill cannot run.");
  }

  const stats: EmailBackfillStats = {
    scanned: 0,
    updated: 0,
    skippedHasEmail: 0,
    skippedNoWebsite: 0,
    skippedNoPrimaryContact: 0,
    noEmailFound: 0,
    failures: 0,
    details: [],
  };

  const [companiesResult, contactsResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id,name,website_url,domain,phone_normalized")
      .order("created_at", { ascending: true })
      .limit(Math.max(1, Math.min(limit, 1000))),
    supabase
      .from("contacts")
      .select("id,company_id,email,is_primary,source,confidence")
      .eq("is_primary", true),
  ]);

  if (companiesResult.error) {
    throw new Error(`Failed loading companies for email backfill: ${companiesResult.error.message}`);
  }

  if (contactsResult.error) {
    throw new Error(`Failed loading contacts for email backfill: ${contactsResult.error.message}`);
  }

  const primaryContactByCompany = new Map<
    string,
    {
      id: string;
      email: string | null;
      source: string | null;
      confidence: number | null;
    }
  >();

  for (const row of contactsResult.data ?? []) {
    const companyId = typeof row.company_id === "string" ? row.company_id : null;
    if (!companyId || primaryContactByCompany.has(companyId)) continue;
    primaryContactByCompany.set(companyId, {
      id: String(row.id),
      email: typeof row.email === "string" ? row.email : null,
      source: typeof row.source === "string" ? row.source : null,
      confidence:
        typeof row.confidence === "number" && Number.isFinite(row.confidence)
          ? row.confidence
          : null,
    });
  }

  for (const company of companiesResult.data ?? []) {
    const companyId = String(company.id);
    const companyName = typeof company.name === "string" ? company.name : companyId;
    const website = normalizeWebsiteUrl(
      typeof company.website_url === "string" ? company.website_url : null,
    );
    const domain =
      typeof company.domain === "string" && company.domain.trim().length > 0
        ? company.domain.trim().toLowerCase()
        : extractDomain(website);
    const contact = primaryContactByCompany.get(companyId);

    if (!contact) {
      stats.skippedNoPrimaryContact += 1;
      continue;
    }

    if (contact.email && contact.email.trim().length > 0) {
      stats.skippedHasEmail += 1;
      continue;
    }

    if (!website) {
      stats.skippedNoWebsite += 1;
      continue;
    }

    stats.scanned += 1;

    try {
      const enrichment = await enrichWebsiteSignals({
        website,
        domain,
      });

      if (!enrichment.bestEmail) {
        stats.noEmailFound += 1;
        continue;
      }

      const nextSource = contact.source
        ? `${contact.source},website_backfill`
        : "website_backfill";
      const nextConfidence = Math.max(70, contact.confidence ?? 0);
      const nextContactability = clampScore(
        35 +
          (website ? 25 : 0) +
          (typeof company.phone_normalized === "string" && company.phone_normalized.length > 0
            ? 25
            : 0) +
          15,
      );

      const [{ error: contactUpdateError }, { error: companyUpdateError }] = await Promise.all([
        supabase
          .from("contacts")
          .update({
            email: enrichment.bestEmail,
            source: nextSource,
            confidence: nextConfidence,
          })
          .eq("id", contact.id),
        supabase
          .from("companies")
          .update({
            contactability: nextContactability,
          })
          .eq("id", companyId),
      ]);

      if (contactUpdateError) {
        throw new Error(`Contact update failed: ${contactUpdateError.message}`);
      }

      if (companyUpdateError) {
        throw new Error(`Company update failed: ${companyUpdateError.message}`);
      }

      stats.updated += 1;
      stats.details.push({
        companyId,
        companyName,
        email: enrichment.bestEmail,
      });
    } catch (error) {
      stats.failures += 1;
      console.error(
        `[Email backfill] ${companyName}: ${error instanceof Error ? error.message : "Unknown failure"}`,
      );
    }
  }

  return stats;
}
