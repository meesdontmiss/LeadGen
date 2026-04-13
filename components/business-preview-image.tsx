"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";

import { cn } from "@/lib/utils";
import { getFaviconUrl, normalizeWebsiteUrl } from "@/lib/business-preview";

type PreviewState = {
  loading: boolean;
  imageUrl: string | null;
  iconUrl: string | null;
  title: string | null;
};

export function BusinessPreviewImage({
  name,
  website,
  domain,
  className,
}: {
  name: string;
  website: string;
  domain: string;
  className?: string;
}) {
  const normalizedWebsite = useMemo(() => normalizeWebsiteUrl(website), [website]);
  const fallbackIconUrl = useMemo(
    () => getFaviconUrl({ website, domain, size: 128 }),
    [domain, website],
  );
  const [state, setState] = useState<PreviewState>({
    loading: Boolean(normalizedWebsite),
    imageUrl: null,
    iconUrl: fallbackIconUrl,
    title: null,
  });

  useEffect(() => {
    if (!normalizedWebsite) {
      setState({
        loading: false,
        imageUrl: null,
        iconUrl: fallbackIconUrl,
        title: null,
      });
      return;
    }

    const controller = new AbortController();

    async function loadPreview() {
      setState((current) => ({
        ...current,
        loading: true,
      }));

      try {
        const response = await fetch(
          `/api/business-preview?website=${encodeURIComponent(normalizedWebsite || "")}&domain=${encodeURIComponent(domain)}`,
          {
            signal: controller.signal,
            cache: "force-cache",
          },
        );
        const payload = (await response.json()) as {
          imageUrl?: string | null;
          iconUrl?: string | null;
          title?: string | null;
        };

        if (!response.ok) {
          throw new Error("Failed to load business preview.");
        }

        setState({
          loading: false,
          imageUrl: payload.imageUrl ?? null,
          iconUrl: payload.iconUrl ?? fallbackIconUrl,
          title: payload.title ?? null,
        });
      } catch {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            imageUrl: null,
            iconUrl: fallbackIconUrl,
            title: null,
          });
        }
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [domain, fallbackIconUrl, normalizedWebsite]);

  return (
    <div className={cn("overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-white/70", className)}>
      {state.imageUrl ? (
        <img
          src={state.imageUrl}
          alt={`${name} website preview`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-[220px] flex-col justify-between bg-[linear-gradient(135deg,#231913,#6e4a2f_55%,#ecd3b6)] p-5 text-white">
          <div className="flex items-center gap-3">
            {state.iconUrl ? (
              <img
                src={state.iconUrl}
                alt=""
                className="h-10 w-10 rounded-xl bg-white p-1.5"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <Globe className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-white/75">
                {state.title || domain || "Business website"}
              </p>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-white/15 bg-black/15 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Website Preview
            </p>
            <p className="mt-2 text-sm leading-6 text-white/90">
              {state.loading
                ? "Loading live site metadata..."
                : "No Open Graph image was published for this business site. The direct website link is still available below."}
            </p>
          </div>
        </div>
      )}

      {normalizedWebsite ? (
        <div className="flex items-center justify-between gap-3 border-t border-[color:var(--line)] px-4 py-3 text-sm">
          <span className="truncate text-stone-600">{domain || normalizedWebsite}</span>
          <a
            href={normalizedWebsite}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-stone-950 hover:underline"
          >
            Visit site
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
