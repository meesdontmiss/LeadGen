import { ArrowUpRight, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ActivityItem, LeadRecord } from "@/lib/types";
import { formatCurrency, formatTimestamp } from "@/lib/utils";
import { leadStatusLabels } from "@/lib/workflows";

const pipelineOrder = [
  "new",
  "qualified",
  "draft_ready",
  "sent",
  "interested",
  "booked",
  "won",
] as const;

export function PipelineOverview({
  leads,
  activity,
}: {
  leads: LeadRecord[];
  activity: ActivityItem[];
}) {
  const total = leads.length;

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/72 p-6 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            Campaign Pipeline
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            Stage distribution and next touches
          </h2>
        </div>
        <Badge variant="muted">{total} active accounts</Badge>
      </div>

      <div className="mt-6 space-y-3">
        {pipelineOrder.map((status) => {
          const count = leads.filter((lead) => lead.campaign.status === status).length;
          const width = total === 0 ? 0 : (count / total) * 100;

          return (
            <div key={status} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-stone-700">{leadStatusLabels[status]}</span>
                <span className="font-semibold text-stone-950">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-stone-900/8">
                <div
                  className="h-full rounded-full bg-stone-900"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            <Clock3 className="h-4 w-4" />
            Upcoming touches
          </div>
          <div className="mt-3 space-y-3">
            {leads
              .slice()
              .sort(
                (left, right) =>
                  new Date(left.campaign.nextTouchAt).getTime() -
                  new Date(right.campaign.nextTouchAt).getTime(),
              )
              .map((lead) => (
                <div
                  key={lead.company.id}
                  className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/70 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-stone-950">{lead.company.name}</p>
                      <p className="mt-1 text-sm text-stone-600">
                        {lead.contact.fullName} · {lead.contact.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-stone-950">
                        {formatCurrency(lead.campaign.pipelineValue)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
                        {lead.campaign.sendDomain}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-stone-600">
                      {formatTimestamp(lead.campaign.nextTouchAt)}
                    </span>
                    <Badge>{leadStatusLabels[lead.campaign.status]}</Badge>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            <ArrowUpRight className="h-4 w-4" />
            Activity log
          </div>
          <div className="mt-3 space-y-3">
            {activity.map((item) => (
              <div
                key={item.id}
                className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/70 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-stone-950">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      {item.detail}
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.tone === "positive"
                        ? "positive"
                        : item.tone === "warning"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {item.tone}
                  </Badge>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-stone-500">
                  {formatTimestamp(item.at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
