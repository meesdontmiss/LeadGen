import {
  Globe,
  LayoutTemplate,
  MapPin,
  MessageSquareMore,
  MonitorSmartphone,
  Phone,
  SearchCode,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { DiscoveryPreset, LeadRecord } from "@/lib/types";
import { titleFromSlug } from "@/lib/utils";
import { leadStatusLabels, offerLabels } from "@/lib/workflows";

const scoreMeta = [
  { key: "premiumFit", label: "Premium fit" },
  { key: "presentationGap", label: "Presentation gap" },
  { key: "visualQuality", label: "Visual quality" },
  { key: "ctaQuality", label: "CTA quality" },
  { key: "trustSignals", label: "Trust signals" },
  { key: "mobileQuality", label: "Mobile quality" },
  { key: "seoBasics", label: "SEO basics" },
  { key: "contactability", label: "Contactability" },
] as const;

export function CompanyDetail({
  lead,
  discoveryPreset,
}: {
  lead: LeadRecord;
  discoveryPreset: DiscoveryPreset;
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/60 bg-white/72 p-6 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
              Company Detail
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
              {lead.company.name}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-700">
              {lead.company.notes}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{leadStatusLabels[lead.company.status]}</Badge>
            <Badge variant="warning">{offerLabels[lead.offer.type]}</Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailRow icon={MapPin} label="Market" value={`${lead.company.neighborhood}, ${lead.company.city}`} />
          <DetailRow icon={UserRound} label="Primary contact" value={`${lead.contact.fullName} · ${lead.contact.title}`} />
          <DetailRow icon={Phone} label="Phone" value={lead.company.phone} />
          <DetailRow icon={Globe} label="Website" value={lead.company.domain} href={lead.company.website} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-6 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                Audit Scores
              </p>
              <h3 className="mt-2 text-xl font-semibold text-stone-950">
                First-impression scoring snapshot
              </h3>
            </div>
            <Badge variant="positive">
              Outreach score {lead.audit.scores.outreachScore}
            </Badge>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {scoreMeta.map((item) => (
              <div key={item.key}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm text-stone-700">
                  <span>{item.label}</span>
                  <span className="font-semibold text-stone-950">
                    {lead.audit.scores[item.key]}
                  </span>
                </div>
                <Progress value={lead.audit.scores[item.key]} />
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ListBlock
              title="Audit strengths"
              icon={MonitorSmartphone}
              items={lead.audit.strengths}
            />
            <ListBlock
              title="Gap summary"
              icon={SearchCode}
              items={lead.audit.weaknesses}
            />
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-6 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            Screenshot Readout
          </p>
          <h3 className="mt-2 text-xl font-semibold text-stone-950">
            What the captures are showing
          </h3>

          <div className="mt-6 grid gap-4">
            <ScreenshotNote
              title="Desktop capture"
              caption={lead.audit.screenshotNotes.desktop}
            />
            <ScreenshotNote
              title="Mobile capture"
              caption={lead.audit.screenshotNotes.mobile}
            />
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[color:var(--line)] bg-stone-950 px-5 py-4 text-stone-50">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-300">
              Outreach hook
            </p>
            <p className="mt-3 text-sm leading-6">{lead.audit.hook}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-6 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                Offer Recommendation
              </p>
              <h3 className="mt-2 text-xl font-semibold text-stone-950">
                {lead.offer.teaserHeadline}
              </h3>
            </div>
            <Badge variant="warning">
              {offerLabels[lead.audit.recommendedOfferType]}
            </Badge>
          </div>

          <p className="mt-4 text-sm leading-6 text-stone-700">
            {lead.offer.teaserSummary}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {lead.offer.homepageBrief.map((item) => (
              <div
                key={item}
                className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/65 px-4 py-4 text-sm text-stone-700"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[color:var(--line)] bg-white/70 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              <LayoutTemplate className="h-4 w-4" />
              Teaser page JSON
            </div>
            <pre className="mt-3 overflow-x-auto rounded-[1rem] bg-stone-950 p-4 text-xs leading-6 text-stone-100">
              {JSON.stringify(lead.offer.teaserJson, null, 2)}
            </pre>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-6 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            <MessageSquareMore className="h-4 w-4" />
            Discovery Inputs
          </div>

          <div className="mt-6 space-y-5 text-sm text-stone-700">
            <PresetGroup title="Neighborhoods" items={discoveryPreset.neighborhoods} />
            <PresetGroup title="Verticals" items={discoveryPreset.verticals} />
            <PresetGroup title="Keywords" items={discoveryPreset.keywords} />
            <PresetGroup title="Domain filters" items={discoveryPreset.domainFilters} />
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[color:var(--line)] bg-white/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              Minimum premium fit threshold
            </p>
            <p className="mt-2 text-3xl font-semibold text-stone-950">
              {discoveryPreset.minimumPremiumFit}
            </p>
          </div>

          <div className="mt-6 space-y-3 text-sm text-stone-700">
            <DetailStack title="Nav extraction" items={lead.audit.navFindings} />
            <DetailStack title="CTA extraction" items={lead.audit.ctaFindings} />
            <DetailStack title="Form extraction" items={lead.audit.formFindings} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[color:var(--line)] bg-white/65 px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-sm font-medium text-stone-950 underline-offset-4 hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="mt-2 text-sm font-medium text-stone-950">{value}</p>
      )}
    </div>
  );
}

function ListBlock({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Globe;
  items: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <ul className="mt-3 space-y-3 text-sm leading-6 text-stone-700">
        {items.map((item) => (
          <li key={item} className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/65 px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScreenshotNote({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/70 p-4">
      <div className="rounded-[1.1rem] border border-white/20 bg-[linear-gradient(135deg,#302118,#8c5a35_55%,#f0d3b4)] p-5 text-white shadow-inner">
        <div className="rounded-[0.85rem] border border-white/25 bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.22em]">
          {title}
        </div>
        <div className="mt-4 grid grid-cols-[1.25fr_0.75fr] gap-3">
          <div className="h-28 rounded-[1rem] bg-white/10" />
          <div className="h-28 rounded-[1rem] bg-white/20" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-700">{caption}</p>
    </div>
  );
}

function PresetGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item}>{title === "Domain filters" ? item : titleFromSlug(item)}</Badge>
        ))}
      </div>
    </div>
  );
}

function DetailStack({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-[1rem] border border-[color:var(--line)] bg-white/65 px-3 py-2.5">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
