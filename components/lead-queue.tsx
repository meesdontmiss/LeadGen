"use client";

import { Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { LeadRecord, LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { leadStatusLabels, offerLabels } from "@/lib/workflows";

type LeadQueueProps = {
  leads: LeadRecord[];
  selectedLeadId: string;
  search: string;
  stageFilter: LeadStatus | "all";
  onSearchChange: (value: string) => void;
  onStageFilterChange: (value: LeadStatus | "all") => void;
  onSelectLead: (companyId: string) => void;
};

const stageFilters: Array<LeadStatus | "all"> = [
  "all",
  "new",
  "qualified",
  "draft_ready",
  "sent",
  "interested",
  "booked",
];

function scoreVariant(score: number) {
  if (score >= 78) return "positive" as const;
  if (score >= 68) return "warning" as const;
  return "critical" as const;
}

export function LeadQueue({
  leads,
  selectedLeadId,
  search,
  stageFilter,
  onSearchChange,
  onStageFilterChange,
  onSelectLead,
}: LeadQueueProps) {
  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            Lead Queue
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            Premium-fit opportunities
          </h2>
        </div>
        <Badge variant="muted">{leads.length} active</Badge>
      </div>

      <div className="mt-5 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search business, neighborhood, or owner"
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {stageFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onStageFilterChange(filter)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors",
                stageFilter === filter
                  ? "bg-stone-950 text-stone-50"
                  : "bg-stone-200/70 text-stone-700 hover:bg-stone-300/70",
              )}
            >
              {filter === "all" ? "All" : leadStatusLabels[filter].replace("Lead/", "")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {leads.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[color:var(--line)] px-4 py-8 text-center text-sm text-stone-600">
            No leads match the current filters.
          </div>
        ) : null}

        {leads.map((lead) => (
          <button
            key={lead.company.id}
            type="button"
            onClick={() => onSelectLead(lead.company.id)}
            className={cn(
              "w-full rounded-[1.5rem] border px-4 py-4 text-left transition-all",
              selectedLeadId === lead.company.id
                ? "border-stone-950 bg-stone-950 text-stone-50 shadow-[0_18px_40px_rgba(23,19,18,0.18)]"
                : "border-[color:var(--line)] bg-white/55 hover:border-stone-400 hover:bg-white/80",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold">{lead.company.name}</p>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    selectedLeadId === lead.company.id
                      ? "text-stone-200"
                      : "text-stone-600",
                  )}
                >
                  {lead.company.vertical} · {lead.company.neighborhood}
                </p>
              </div>
              <Badge variant={scoreVariant(lead.audit.scores.outreachScore)}>
                {lead.audit.scores.outreachScore}
              </Badge>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em]">
              <span
                className={cn(
                  selectedLeadId === lead.company.id
                    ? "text-stone-300"
                    : "text-stone-500",
                )}
              >
                {leadStatusLabels[lead.company.status]}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-medium",
                  selectedLeadId === lead.company.id
                    ? "text-stone-200"
                    : "text-stone-600",
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {offerLabels[lead.offer.type]}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
