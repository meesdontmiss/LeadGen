"use client";

import { useState } from "react";
import { Clock, Calendar, AlertCircle, CheckCircle2, Send, ArrowRight } from "lucide-react";
import type { LeadRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";

export function FollowUpsTab({ leads }: { leads: LeadRecord[] }) {
  const [view, setView] = useState<"upcoming" | "overdue" | "completed">("upcoming");

  const now = new Date();

  const upcoming = leads.filter((l) => {
    const nextTouch = new Date(l.campaign.nextTouchAt);
    return nextTouch > now && !["won", "lost"].includes(l.campaign.status);
  }).sort((a, b) => new Date(a.campaign.nextTouchAt).getTime() - new Date(b.campaign.nextTouchAt).getTime());

  const overdue = leads.filter((l) => {
    const nextTouch = new Date(l.campaign.nextTouchAt);
    return nextTouch <= now && !["won", "lost"].includes(l.campaign.status);
  }).sort((a, b) => new Date(a.campaign.nextTouchAt).getTime() - new Date(b.campaign.nextTouchAt).getTime());

  const completed = leads.filter((l) =>
    ["won", "lost", "booked"].includes(l.campaign.status)
  );

  const activeLeads = view === "upcoming" ? upcoming : view === "overdue" ? overdue : completed;

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2">
        {[
          { key: "upcoming", label: "Upcoming", count: upcoming.length, color: "blue" },
          { key: "overdue", label: "Overdue", count: overdue.length, color: "red" },
          { key: "completed", label: "Completed", count: completed.length, color: "emerald" },
        ].map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key as any)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              view === v.key
                ? v.color === "blue"
                  ? "bg-blue-500 text-white shadow-md"
                  : v.color === "red"
                  ? "bg-red-500 text-white shadow-md"
                  : "bg-emerald-500 text-white shadow-md"
                : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
            }`}
          >
            {v.key === "upcoming" && <Calendar className="h-4 w-4" />}
            {v.key === "overdue" && <AlertCircle className="h-4 w-4" />}
            {v.key === "completed" && <CheckCircle2 className="h-4 w-4" />}
            {v.label}
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                view === v.key ? "bg-white/20" : "bg-stone-100"
              }`}
            >
              {v.count}
            </span>
          </button>
        ))}
      </div>

      {/* Follow-up Cards */}
      <div className="space-y-3">
        {activeLeads.map((lead, index) => {
          const nextTouch = new Date(lead.campaign.nextTouchAt);
          const daysUntil = Math.ceil((nextTouch.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isOverdue = daysUntil < 0;

          return (
            <div
              key={lead.company.id}
              className={`rounded-xl border p-5 transition-all hover:shadow-lg ${
                isOverdue
                  ? "border-red-200 bg-red-50/30"
                  : daysUntil <= 2
                  ? "border-amber-200 bg-amber-50/30"
                  : "border-stone-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-semibold text-stone-950">
                      {lead.company.name}
                    </h4>
                    {isOverdue && (
                      <Badge variant="critical">Overdue</Badge>
                    )}
                    {daysUntil <= 2 && !isOverdue && (
                      <Badge variant="warning">Soon</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-stone-600">
                    {lead.contact.fullName} · {lead.company.vertical}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-stone-700">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">
                        {formatTimestamp(lead.campaign.nextTouchAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-stone-600">
                      <Clock className="h-4 w-4" />
                      <span>
                        {isOverdue
                          ? `${Math.abs(daysUntil)} days overdue`
                          : daysUntil === 0
                          ? "Today"
                          : daysUntil === 1
                          ? "Tomorrow"
                          : `In ${daysUntil} days`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                      Campaign
                    </p>
                    <p className="text-sm font-semibold text-stone-950">
                      {lead.campaign.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                  </div>
                  {!isOverdue && (
                    <button className="flex items-center gap-1.5 rounded-lg bg-stone-950 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-stone-800">
                      <Send className="h-3.5 w-3.5" />
                      Send Now
                    </button>
                  )}
                </div>
              </div>

              {/* Follow-up Schedule */}
              <div className="mt-4 rounded-lg bg-stone-50/50 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Follow-up sequence
                </div>
                <div className="mt-2 flex gap-2">
                  {["Initial", "Follow-up 1", "Follow-up 2", "Close-loop"].map(
                    (step, i) => {
                      const isPast = i < 1; // Simplified - would need actual touch history
                      const isCurrent = i === 0;
                      return (
                        <div
                          key={step}
                          className={`flex-1 rounded-md px-3 py-2 text-center text-xs font-medium ${
                            isPast
                              ? "bg-emerald-100 text-emerald-700"
                              : isCurrent
                              ? "bg-blue-100 text-blue-700 ring-2 ring-blue-500"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {step}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeLeads.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-stone-400" />
          <h3 className="text-lg font-semibold text-stone-950">
            No {view} follow-ups
          </h3>
          <p className="mt-2 text-sm text-stone-600">
            {view === "upcoming"
              ? "All follow-ups are scheduled. New ones will appear here as you send emails."
              : view === "overdue"
              ? "Great job! No overdue follow-ups."
              : "Completed campaigns will appear here."}
          </p>
        </div>
      )}
    </div>
  );
}
