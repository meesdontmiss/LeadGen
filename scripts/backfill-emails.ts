import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

const PAGE_LIMIT = 8;
const REQUEST_TIMEOUT_MS = 4000;
const FALLBACK_PATHS = [
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
];
const CRAWL_PATH_PATTERN =
  /\/(contact|about|team|support|book|appointment|career|careers|jobs?|employment|join-us)\b/i;

function loadDotEnv(path: string) {
  const raw = fs.readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
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

function extractEmails(raw: string) {
  const matches =
    raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) ?? [];
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
  if (
    /^(hello|hi|contact|info|team|office|bookings|support|careers|jobs|hiring)@/i.test(
      email,
    )
  ) {
    score += 20;
  }
  if (/^(no-?reply|donotreply|noreply)@/i.test(email)) {
    score -= 15;
  }
  return score;
}

function pickBestEmail(emails: string[], domain: string | null) {
  if (emails.length === 0) return null;
  return [...emails].sort(
    (left, right) => scoreEmail(right, domain) - scoreEmail(left, domain),
  )[0]!;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "OpenClawLeadEngine/1.0 (email-backfill)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return null;

    return {
      html: await response.text(),
      finalUrl: response.url || url,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractCandidateLinks(html: string, baseUrl: string) {
  const baseOrigin = new URL(baseUrl).origin;
  const links: string[] = [];
  const mailtoEmails = new Set<string>();
  const regex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null = regex.exec(html);

  while (match) {
    const href = match[1];
    try {
      if (/^mailto:/i.test(href)) {
        const candidate = decodeURIComponent(
          href.replace(/^mailto:/i, "").split("?")[0] ?? "",
        );
        const normalized = normalizeEmail(candidate);
        if (normalized) mailtoEmails.add(normalized);
        match = regex.exec(html);
        continue;
      }

      const absolute = new URL(href, baseUrl).toString();
      if (/^https?:/i.test(absolute) && new URL(absolute).origin === baseOrigin) {
        links.push(absolute);
      }
    } catch {
      // ignore invalid URL
    }

    match = regex.exec(html);
  }

  return {
    links,
    mailtoEmails: [...mailtoEmails],
  };
}

async function discoverBestEmail({
  website,
  domain,
}: {
  website: string;
  domain: string | null;
}) {
  const queue: string[] = [website];
  const visited = new Set<string>();
  const emails = new Set<string>();

  for (const path of FALLBACK_PATHS) {
    try {
      queue.push(new URL(path, website).toString());
    } catch {
      // ignore invalid URL
    }
  }

  while (queue.length > 0 && visited.size < PAGE_LIMIT) {
    const nextUrl = queue.shift();
    if (!nextUrl || visited.has(nextUrl)) continue;
    visited.add(nextUrl);

    const result = await fetchHtml(nextUrl);
    if (!result) continue;

    const { html, finalUrl } = result;
    for (const email of extractEmails(html)) {
      emails.add(email);
    }

    const { links, mailtoEmails } = extractCandidateLinks(html, finalUrl);
    for (const email of mailtoEmails) {
      emails.add(email);
    }

    const crawlLinks = links.filter(
      (link) => CRAWL_PATH_PATTERN.test(link) || /[?&](job|career|contact)/i.test(link),
    );
    for (const link of crawlLinks) {
      if (!visited.has(link) && !queue.includes(link)) queue.push(link);
    }
  }

  return {
    bestEmail: pickBestEmail([...emails], domain),
    discoveredEmails: [...emails],
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

loadDotEnv(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const rawLimit = process.argv[2];
const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 300;
const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 300;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log(`[backfill-emails] Starting (limit=${limit})...`);

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
  console.error("Failed loading companies:", companiesResult.error.message);
  process.exit(1);
}
if (contactsResult.error) {
  console.error("Failed loading contacts:", contactsResult.error.message);
  process.exit(1);
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

const stats = {
  scanned: 0,
  updated: 0,
  skippedHasEmail: 0,
  skippedNoWebsite: 0,
  skippedNoPrimaryContact: 0,
  noEmailFound: 0,
  failures: 0,
  details: [] as Array<{ company: string; email: string }>,
};

for (const company of companiesResult.data ?? []) {
  const companyId = String(company.id);
  const companyName = typeof company.name === "string" ? company.name : companyId;
  const contact = primaryContactByCompany.get(companyId);
  const website = normalizeWebsiteUrl(
    typeof company.website_url === "string" ? company.website_url : null,
  );
  const domain =
    typeof company.domain === "string" && company.domain.trim().length > 0
      ? company.domain.trim().toLowerCase()
      : website
        ? new URL(website).hostname.replace(/^www\./i, "").toLowerCase()
        : null;

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
    const enrichment = await discoverBestEmail({ website, domain });
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

    const [{ error: contactError }, { error: companyError }] = await Promise.all([
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

    if (contactError || companyError) {
      throw new Error(contactError?.message ?? companyError?.message ?? "Update failed");
    }

    stats.updated += 1;
    stats.details.push({ company: companyName, email: enrichment.bestEmail });
    console.log(`[backfill-emails] ${companyName} -> ${enrichment.bestEmail}`);
  } catch (error) {
    stats.failures += 1;
    console.error(
      `[backfill-emails] ${companyName} failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

console.log("[backfill-emails] Completed.");
console.log(JSON.stringify(stats, null, 2));
