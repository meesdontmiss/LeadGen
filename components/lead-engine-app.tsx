"use client";

import { startTransition, useDeferredValue, useState } from "react";
import { Bot, MailCheck, MapPinned, Sparkles, TrendingUp } from "lucide-react";

import { CompanyDetail } from "@/components/company-detail";
import { DomainHealthPanel } from "@/components/domain-health-panel";
import { LeadQueue } from "@/components/lead-queue";
import { OutreachReview } from "@/components/outreach-review";
import { PipelineOverview } from "@/components/pipeline-overview";
import { SystemStatusPanel } from "@/components/system-status-panel";
import { Badge } from "@/components/ui/badge";
import type { DashboardData, LeadStatus } from "@/lib/types";
import { formatCompactNumber, formatCurrency, formatPercent } from "@/lib/utils";
import {
  followUpSchedule,
  gmailLabels,
  mvpModules,
  phaseThreeModules,
  phaseTwoModules,
  sendGuardrails,
  stopConditions,
} from "@/lib/workflows";

export function LeadEngineApp({ data }: { data: DashboardData }) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStatus | "all">("all");
  const [selectedLeadId, setSelectedLeadId] = useState(data.leads[0]?.company.id ?? "");
  const deferredSearch = useDeferredValue(search);

  const filteredLeads = data.leads.filter((lead) => {
    const query = deferredSearch.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      [
        lead.company.name,
        lead.company.neighborhood,
        lead.company.vertical,
        lead.company.ownerName,
        lead.contact.fullName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

    const matchesStage =
      stageFilter === "all" || lead.company.status === stageFilter;

    return matchesSearch && matchesStage;
  });

  const selectedLead =
    filteredLeads.find((lead) => lead.company.id === selectedLeadId) ??
    data.leads.find((lead) => lead.company.id === selectedLeadId) ??
    filteredLeads[0] ??
    data.leads[0];

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <section className="rounded-[2.25rem] border border-white/60 bg-white/54 p-6 shadow-[0_24px_90px_rgba(38,25,16,0.12)] backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted">Luxury Local Lead Engine</Badge>
                <Badge variant="positive">Human approval on first touch</Badge>
                <Badge>Gmail API first</Badge>
              </div>

              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-5xl">
                Operator workspace for premium local outreach.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-700">
                Discover affluent local service businesses with weak presentation,
                score the opportunity, generate tailored offers, and keep Gmail
                outreach inside compliance and deliverability guardrails.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[440px]">
              <HeaderStat
                icon={MapPinned}
                label="Markets in rotation"
                value={formatCompactNumber(data.summary.discoveredThisWeek)}
                detail="Businesses discovered this week"
              />
              <HeaderStat
                icon={Sparkles}
                label="Qualified leads"
                value={formatCompactNumber(data.summary.qualifiedThisWeek)}
                detail="Above premium-fit threshold"
              />
              <HeaderStat
                icon={MailCheck}
                label="Drafts ready"
                value={formatCompactNumber(data.summary.draftsReady)}
                detail="Waiting on review or Gmail creation"
              />
              <HeaderStat
                icon={TrendingUp}
                label="Pipeline value"
                value={formatCurrency(data.summary.pipelineValue)}
                detail={`${formatPercent(data.summary.positiveReplyRate)} positive reply rate`}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2">
              <Bot className="h-4 w-4" />
              OpenClaw orchestrator
            </div>
            <span>
              Data source:{" "}
              {data.integrations.dataSource === "supabase"
                ? "Supabase live"
                : "Seeded fallback"}
            </span>
            <span>
              Gmail:{" "}
              {data.integrations.gmailConfigured ? "runtime OAuth ready" : "not configured"}
            </span>
            <span>Neighborhood sweep: {data.discoveryPreset.neighborhoods.join(" · ")}</span>
            <span>Complaint rate: {formatPercent(data.summary.complaintRate)}</span>
            <span>Sent today: {data.summary.sentToday}</span>
          </div>

          <div className="mt-4 grid gap-2">
            {data.integrations.notes.map((note) => (
              <div
                key={note}
                className="rounded-[1rem] bg-white/65 px-4 py-3 text-sm text-stone-700"
              >
                {note}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
          <LeadQueue
            leads={filteredLeads}
            selectedLeadId={selectedLead?.company.id ?? ""}
            search={search}
            stageFilter={stageFilter}
            onSearchChange={setSearch}
            onStageFilterChange={(value) =>
              startTransition(() => setStageFilter(value))
            }
            onSelectLead={(companyId) =>
              startTransition(() => setSelectedLeadId(companyId))
            }
          />

          {selectedLead ? (
            <>
              <CompanyDetail
                lead={selectedLead}
                discoveryPreset={data.discoveryPreset}
              />

              <OutreachReview
                lead={selectedLead}
                followUpSchedule={followUpSchedule}
              />
            </>
          ) : (
            <section className="rounded-[2rem] border border-white/60 bg-white/72 p-8 text-stone-700 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur xl:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                No Leads Yet
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                The live project is connected, but the lead tables are empty.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7">
                Run the Supabase seed path or start writing real discovery results
                into the database. The dashboard will populate automatically once
                lead records exist.
              </p>
            </section>
          )}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <PipelineOverview leads={data.leads} activity={data.activity} />
          <DomainHealthPanel
            domains={data.domains}
            sendGuardrails={sendGuardrails}
          />
        </div>

        <div className="mt-6">
          <SystemStatusPanel
            workers={data.workers}
            gmailLabels={gmailLabels}
            stopConditions={stopConditions}
            mvpModules={mvpModules}
            phaseTwoModules={phaseTwoModules}
            phaseThreeModules={phaseThreeModules}
          />
        </div>
      </div>
    </main>
  );
}

function HeaderStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/70 px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
        {value}
      </p>
      <p className="mt-1 text-sm text-stone-600">{detail}</p>
    </div>
  );
}
