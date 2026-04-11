import { AlertCircle, CheckCircle2, MailWarning } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DomainHealth } from "@/lib/types";
import { formatPercent, formatTimestamp } from "@/lib/utils";

export function DomainHealthPanel({
  domains,
  sendGuardrails,
}: {
  domains: DomainHealth[];
  sendGuardrails: string[];
}) {
  if (domains.length === 0) {
    return (
      <section className="rounded-[2rem] border border-white/60 bg-white/72 p-8 text-center shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
          <AlertCircle className="h-8 w-8 text-stone-400" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
          Domain Health
        </p>
        <h2 className="mt-2 text-xl font-semibold text-stone-950">
          No domains configured yet
        </h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-stone-600">
          Add your sending domain and configure SPF, DKIM, and DMARC records before starting outbound campaigns.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/72 p-6 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            Domain Health
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            Deliverability gates and warm-up state
          </h2>
        </div>
        <Badge variant="muted">{domains.length} domains</Badge>
      </div>

      <div className="mt-6 space-y-3">
        {domains.map((domain) => (
          <div
            key={domain.domain}
            className="rounded-[1.4rem] border border-[color:var(--line)] bg-white/70 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-stone-950">{domain.domain}</p>
                <p className="mt-1 text-sm text-stone-600">
                  Last warm-up {formatTimestamp(domain.lastWarmupAt)}
                </p>
              </div>
              <Badge
                variant={
                  domain.status === "healthy"
                    ? "positive"
                    : domain.status === "warming"
                      ? "warning"
                      : "critical"
                }
              >
                {domain.status}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <HealthCell label="SPF" value={domain.spf ? "Pass" : "Fail"} />
              <HealthCell label="DKIM" value={domain.dkim ? "Pass" : "Fail"} />
              <HealthCell label="DMARC" value={domain.dmarc ? "Pass" : "Fail"} />
              <HealthCell
                label="Complaint rate"
                value={formatPercent(domain.complaintRate)}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
              <span>Inbox placement {domain.inboxPlacement}%</span>
              <span>·</span>
              <span>
                {domain.dailyVolume}/{domain.maxDailyVolume} daily volume
              </span>
            </div>

            <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-700">
              {domain.notes.map((note) => (
                <li key={note} className="flex items-start gap-2">
                  {domain.status === "attention" ? (
                    <MailWarning className="mt-1 h-4 w-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-600" />
                  )}
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[1.5rem] border border-[color:var(--line)] bg-stone-950 p-4 text-stone-100">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-300">
          Send guardrails
        </p>
        <ul className="mt-3 space-y-3 text-sm leading-6">
          {sendGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HealthCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[color:var(--line)] bg-white/75 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-stone-950">{value}</p>
    </div>
  );
}
