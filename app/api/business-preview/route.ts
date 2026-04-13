import { z } from "zod";

import {
  getFaviconUrl,
  normalizeWebsiteUrl,
} from "@/lib/business-preview";

const querySchema = z.object({
  website: z.string().trim().min(1),
  domain: z.string().trim().optional(),
});

function extractMetaContent(html: string, matcher: RegExp) {
  const match = html.match(matcher);
  return match?.[1]?.trim() ?? null;
}

function toAbsoluteUrl(value: string | null, baseUrl: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      website: searchParams.get("website"),
      domain: searchParams.get("domain") ?? undefined,
    });

    const normalizedWebsite = normalizeWebsiteUrl(query.website);

    if (!normalizedWebsite) {
      return Response.json({ error: "Invalid website URL." }, { status: 400 });
    }

    const response = await fetch(normalizedWebsite, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LeadEnginePreviewBot/1.0; +https://openclaw.local)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      next: { revalidate: 60 * 60 * 6 },
    });

    if (!response.ok) {
      throw new Error(`Website request failed with ${response.status}.`);
    }

    const html = await response.text();
    const finalUrl = response.url || normalizedWebsite;
    const imageUrl = toAbsoluteUrl(
      extractMetaContent(
        html,
        /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      ),
      finalUrl,
    );
    const iconUrl = toAbsoluteUrl(
      extractMetaContent(
        html,
        /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
      ),
      finalUrl,
    ) || getFaviconUrl({ website: finalUrl, domain: query.domain, size: 128 });
    const title =
      extractMetaContent(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      extractMetaContent(html, /<title>([^<]+)<\/title>/i);

    return Response.json({
      ok: true,
      website: finalUrl,
      title,
      imageUrl,
      iconUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load business preview.";

    return Response.json({ error: message }, { status: 500 });
  }
}
