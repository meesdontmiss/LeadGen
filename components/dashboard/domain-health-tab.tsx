"use client";

import { CheckCircle2, AlertTriangle, XCircle, Send } from "lucide-react";
import type { DomainHealth } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatPercent, formatTimestamp } from "@/lib/utils";

export function DomainHealthTab({ domains }: { domains: DomainHealth[] }) {
  if (domains.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-sm">
        <Send className="mx-auto mb-4 h-12 w-12 text-stone-400" />
        <h3 className="text-lg font-semibold text-stone-950">No domains configured</h3>
        <p className="mt-2 text-sm text-stone-600">
          Add your sending domain and configure SPF, DKIM, and DMARC records before starting campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {domains.map((domain) => (
        <div
          key={domain.domain}
          className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        >
          {/* Domain Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-stone-950">{domain.domain}</h3>
              <p className="mt-1 text-sm text-stone-600">
                Last warm-up: {formatTimestamp(domain.lastWarmupAt)}
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

          {/* Authentication Records */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <AuthRecord label="SPF" status={domain.spf} />
            <AuthRecord label="DKIM" status={domain.dkim} />
            <AuthRecord label="DMARC" status={domain.dmarc} />
          </div>

          {/* Metrics */}
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Inbox Placement"
              value={formatPercent(domain.inboxPlacement)}
              status={
                domain.inboxPlacement >= 90
                  ? "good"
                  : domain.inboxPlacement >= 75
                  ? "warning"
                  : "bad"
              }
            />
            <MetricCard
              label="Complaint Rate"
              value={formatPercent(domain.complaintRate)}
              status={
                domain.complaintRate <= 0.1
                  ? "good"
                  : domain.complaintRate <= 0.5
                  ? "warning"
                  : "bad"
              }
            />
            <MetricCard
              label="Daily Volume"
              value={`${domain.dailyVolume} / ${domain.maxDailyVolume}`}
              status={
                domain.dailyVolume <= domain.maxDailyVolume * 0.8
                  ? "good"
                  : "warning"
              }
            />
          </div>

          {/* Notes */}
          {domain.notes.length > 0 && (
            <div className="mt-6 rounded-xl bg-stone-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-stone-950">Notes</h4>
              <ul className="space-y-2">
                {domain.notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                    {domain.status === "healthy" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : domain.status === "attention" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 text-red-600" />
                    )}
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AuthRecord({ label, status }: { label: string; status: boolean }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {status ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">Pass</span>
          </>
        ) : (
          <>
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="text-sm font-semibold text-red-700">Fail</span>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "good" | "warning" | "bad";
}) {
  const statusColors = {
    good: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    bad: "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${statusColors[status].split(" ")[1]}`}>
        {value}
      </p>
      <Badge variant={status === "good" ? "positive" : status === "warning" ? "warning" : "critical"}>
        {status === "good" ? "Healthy" : status === "warning" ? "Warning" : "Attention"}
      </Badge>
    </div>
  );
}
