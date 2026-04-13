export function normalizeWebsiteUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isHttpUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getFaviconUrl({
  website,
  domain,
  size = 128,
}: {
  website?: string | null;
  domain?: string | null;
  size?: number;
}) {
  const normalizedWebsite = normalizeWebsiteUrl(website);
  const target =
    normalizedWebsite ||
    normalizeWebsiteUrl(domain ? `https://${domain}` : null);

  if (!target) {
    return null;
  }

  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(target)}&sz=${size}`;
}
