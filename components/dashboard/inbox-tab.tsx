"use client";

import { useState } from "react";
import {
  Mail,
  MailOpen,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Star,
} from "lucide-react";
import type { LeadRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";

export function InboxTab({ leads }: { leads: LeadRecord[] }) {
  const [filter, setFilter] = useState<"all" | "replied" | "sent" | "draft">("all");

  const filteredLeads = leads.filter((lead) => {
    if (filter === "all") return true;
    if (filter === "replied")
      return ["replied", "interested", "booked"].includes(lead.campaign.status);
    if (filter === "sent") return lead.campaign.status === "sent";
    if (filter === "draft") return lead.latestEmail.status === "draft";
    return true;
  });

  const repliedLeads = filteredLeads.filter((l) =>
    ["replied", "interested", "booked", "won"].includes(l.campaign.status)
  );
  const sentLeads = filteredLeads.filter((l) => l.campaign.status === "sent");
  const draftLeads = filteredLeads.filter((l) => l.latestEmail.status === "draft");

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "All", icon: Mail },
          { key: "replied", label: "Replied", icon: MailOpen },
          { key: "sent", label: "Sent", icon: ArrowUpRight },
          { key: "draft", label: "Drafts", icon: Clock },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              filter === f.key
                ? "bg-stone-950 text-white shadow-md"
                : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
            }`}
          >
            <f.icon className="h-4 w-4" />
            {f.label}
          </button>
        ))}
      </div>

      {/* Replies */}
      {repliedLeads.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6">
          <div className="mb-4 flex items-center gap-2">
            <MailOpen className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-stone-950">
              Replies ({repliedLeads.length})
            </h3>
          </div>
          <div className="space-y-3">
            {repliedLeads.map((lead) => (
              <div
                key={lead.company.id}
                className="group rounded-xl border border-emerald-100 bg-white p-5 transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-semibold text-stone-950">
                        {lead.company.name}
                      </h4>
                      {lead.campaign.status === "interested" ||
                      lead.campaign.status === "booked" ? (
                        <Star className="h-4 w-4 text-amber-500" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {lead.contact.fullName} · {lead.contact.email}
                    </p>
                    <p className="mt-2 text-sm text-stone-700">
                      <span className="font-medium">Status:</span>{" "}
                      {lead.campaign.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                  </div>
                  <Badge variant="positive">Replied</Badge>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-stone-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Last touch: {formatTimestamp(lead.campaign.lastTouchAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Next: {formatTimestamp(lead.campaign.nextTouchAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent */}
      {sentLeads.length > 0 && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-6">
          <div className="mb-4 flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-stone-950">
              Awaiting Reply ({sentLeads.length})
            </h3>
          </div>
          <div className="space-y-3">
            {sentLeads.map((lead) => (
              <div
                key={lead.company.id}
                className="rounded-xl border border-purple-100 bg-white p-5 transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-stone-950">
                      {lead.company.name}
                    </h4>
                    <p className="mt-1 text-sm text-stone-600">
                      {lead.contact.fullName} · {lead.contact.email}
                    </p>
                  </div>
                  <Badge variant="neutral">Sent</Badge>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-stone-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Sent: {formatTimestamp(lead.campaign.lastTouchAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drafts */}
      {draftLeads.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-stone-950">
              Drafts Pending ({draftLeads.length})
            </h3>
          </div>
          <div className="space-y-3">
            {draftLeads.map((lead) => (
              <div
                key={lead.company.id}
                className="rounded-xl border border-amber-100 bg-white p-5 transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-stone-950">
                      {lead.company.name}
                    </h4>
                    <p className="mt-1 text-sm text-stone-600">
                      {lead.contact.fullName} · {lead.contact.email}
                    </p>
                    <p className="mt-2 text-sm text-stone-700 line-clamp-2">
                      {lead.latestEmail.subjectVariants[0] || "No subject"}
                    </p>
                  </div>
                  <Badge variant="warning">Draft</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredLeads.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-stone-400" />
          <h3 className="text-lg font-semibold text-stone-950">No emails found</h3>
          <p className="mt-2 text-sm text-stone-600">
            Emails and replies will appear here as you send outreach and receive responses.
          </p>
        </div>
      )}
    </div>
  );
}
