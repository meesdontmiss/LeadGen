"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, MailPlus, Send, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LeadRecord } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

export function OutreachReview({
  lead,
  followUpSchedule,
}: {
  lead: LeadRecord;
  followUpSchedule: Array<{ label: string; dayOffset: number }>;
}) {
  const [draftState, setDraftState] = useState<{
    pending: boolean;
    message: string | null;
    error: boolean;
  }>({
    pending: false,
    message: null,
    error: false,
  });

  const [queueState, setQueueState] = useState<{
    pending: boolean;
    message: string | null;
    error: boolean;
  }>({
    pending: false,
    message: null,
    error: false,
  });

  useEffect(() => {
    setDraftState({
      pending: false,
      message: null,
      error: false,
    });
    setQueueState({
      pending: false,
      message: null,
      error: false,
    });
  }, [lead.company.id]);

  async function handleCreateDraft() {
    setDraftState({
      pending: true,
      message: null,
      error: false,
    });

    try {
      const response = await fetch("/api/gmail/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: lead.company.id,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        draft?: { draftId?: string | null };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create Gmail draft.");
      }

      setDraftState({
        pending: false,
        message: payload.draft?.draftId
          ? `Draft created: ${payload.draft.draftId}`
          : "Draft created in Gmail.",
        error: false,
      });
    } catch (error) {
      setDraftState({
        pending: false,
        message:
          error instanceof Error ? error.message : "Failed to create Gmail draft.",
        error: true,
      });
    }
  }

  async function handleQueueForApproval() {
    setQueueState({
      pending: true,
      message: null,
      error: false,
    });

    try {
      // For now, this updates the lead status to 'draft_ready'
      // In the future, this will trigger a workflow notification
      const response = await fetch(`/api/leads/${lead.company.id}/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "queue_for_approval",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Failed to queue for approval.");
      }

      setQueueState({
        pending: false,
        message: "Lead queued for approval successfully.",
        error: false,
      });
    } catch (error) {
      setQueueState({
        pending: false,
        message:
          error instanceof Error ? error.message : "Failed to queue for approval.",
        error: true,
      });
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/72 p-6 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            Outreach Review
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            Draft, footer, and follow-up state
          </h2>
        </div>
        <Badge variant={lead.latestEmail.status === "draft" ? "warning" : "positive"}>
          {lead.latestEmail.status}
        </Badge>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Subject variants
          </p>
          <div className="mt-3 space-y-2">
            {lead.latestEmail.subjectVariants.map((subject) => (
              <div
                key={subject}
                className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-stone-800"
              >
                {subject}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-stone-950 p-4 text-stone-100">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-300">
            <MailPlus className="h-4 w-4" />
            Plain-text draft
          </div>
          <pre className="mt-4 whitespace-pre-wrap text-sm leading-6">
            {lead.latestEmail.plainText}
          </pre>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            <ShieldCheck className="h-4 w-4" />
            Compliance checks
          </div>
          <div className="mt-3 space-y-2">
            {lead.latestEmail.complianceChecks.map((check) => (
              <div
                key={check.label}
                className="flex items-center justify-between gap-4 rounded-[1.1rem] border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm"
              >
                <span className="text-stone-700">{check.label}</span>
                <Badge variant={check.passed ? "positive" : "critical"}>
                  {check.passed ? "Pass" : "Hold"}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Footer lines
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
            {lead.latestEmail.complianceFooter.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            <Send className="h-4 w-4" />
            Follow-up schedule
          </div>
          <div className="mt-3 space-y-3">
            {followUpSchedule.map((step) => (
              <div
                key={step.label}
                className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-stone-900">{step.label}</p>
                  <p className="text-stone-600">Day {step.dayOffset}</p>
                </div>
                <Badge variant={step.dayOffset === 0 ? "muted" : "neutral"}>
                  {step.dayOffset === 0 ? "Now" : `+${step.dayOffset}d`}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/70 px-4 py-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold text-stone-950">Next campaign touch</p>
              <p className="mt-1 text-stone-600">
                {formatTimestamp(lead.campaign.nextTouchAt)}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            className="flex-1 min-w-[180px]"
            onClick={handleCreateDraft}
            disabled={draftState.pending}
          >
            {draftState.pending ? "Creating draft..." : "Create Gmail draft"}
          </Button>
          <Button
            variant="secondary"
            className="flex-1 min-w-[180px]"
            onClick={handleQueueForApproval}
            disabled={queueState.pending}
          >
            {queueState.pending ? (
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 animate-spin" />
                Queuing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Queue for approval
              </span>
            )}
          </Button>
        </div>

        {draftState.message ? (
          <div
            className={`rounded-[1rem] px-4 py-3 text-sm ${
              draftState.error
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {draftState.message}
          </div>
        ) : null}

        {queueState.message ? (
          <div
            className={`rounded-[1rem] px-4 py-3 text-sm ${
              queueState.error
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {queueState.message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
