"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  Loader2,
  Mail,
  MailOpen,
  MessageSquare,
  RefreshCw,
  Send,
  Star,
} from "lucide-react";

import type { GmailThreadMessage, LeadRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";

type InboxFilter = "all" | "replied" | "sent" | "draft";

type ThreadState = {
  loading: boolean;
  error: string | null;
  threadId: string | null;
  messages: GmailThreadMessage[];
};

type SendState = {
  pending: boolean;
  error: string | null;
  success: string | null;
};

function isProposalPending(status: LeadRecord["latestEmail"]["status"]) {
  return status === "draft" || status === "approved";
}

function emptyThreadState(): ThreadState {
  return {
    loading: false,
    error: null,
    threadId: null,
    messages: [],
  };
}

export function InboxTab({ leads }: { leads: LeadRecord[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0]?.company.id ?? "");
  const [threadState, setThreadState] = useState<ThreadState>(emptyThreadState);
  const [replyBody, setReplyBody] = useState("");
  const [sendState, setSendState] = useState<SendState>({
    pending: false,
    error: null,
    success: null,
  });

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        if (filter === "all") return true;
        if (filter === "replied") {
          return ["replied", "interested", "booked", "won"].includes(lead.campaign.status);
        }
        if (filter === "sent") return lead.campaign.status === "sent";
        if (filter === "draft") return isProposalPending(lead.latestEmail.status);
        return true;
      }),
    [filter, leads],
  );

  const selectedLead =
    filteredLeads.find((lead) => lead.company.id === selectedLeadId) ??
    leads.find((lead) => lead.company.id === selectedLeadId) ??
    filteredLeads[0] ??
    leads[0] ??
    null;

  useEffect(() => {
    if (!selectedLead) {
      return;
    }

    setSelectedLeadId((current) => current || selectedLead.company.id);
  }, [selectedLead]);

  useEffect(() => {
    setReplyBody("");
    setSendState({
      pending: false,
      error: null,
      success: null,
    });
  }, [selectedLeadId]);

  useEffect(() => {
    if (!selectedLead) {
      setThreadState(emptyThreadState());
      return;
    }

    if (isProposalPending(selectedLead.latestEmail.status)) {
      setThreadState(emptyThreadState());
      return;
    }

    let cancelled = false;

    async function loadThread() {
      setThreadState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      try {
        const response = await fetch(
          `/api/gmail/thread?companyId=${encodeURIComponent(selectedLead.company.id)}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as {
          error?: string;
          thread?: { threadId: string | null; messages: GmailThreadMessage[] };
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load Gmail thread.");
        }

        if (!cancelled) {
          setThreadState({
            loading: false,
            error: null,
            threadId: payload.thread?.threadId ?? null,
            messages: payload.thread?.messages ?? [],
          });
        }
      } catch (error) {
        if (!cancelled) {
          setThreadState({
            loading: false,
            error:
              error instanceof Error ? error.message : "Failed to load Gmail thread.",
            threadId: null,
            messages: [],
          });
        }
      }
    }

    void loadThread();

    return () => {
      cancelled = true;
    };
  }, [selectedLead]);

  async function handleRefreshThread() {
    if (!selectedLead || isProposalPending(selectedLead.latestEmail.status)) {
      return;
    }

    setThreadState((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await fetch(
        `/api/gmail/thread?companyId=${encodeURIComponent(selectedLead.company.id)}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        thread?: { threadId: string | null; messages: GmailThreadMessage[] };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to refresh Gmail thread.");
      }

      setThreadState({
        loading: false,
        error: null,
        threadId: payload.thread?.threadId ?? null,
        messages: payload.thread?.messages ?? [],
      });
    } catch (error) {
      setThreadState({
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to refresh Gmail thread.",
        threadId: null,
        messages: [],
      });
    }
  }

  async function handleSendDraft() {
    if (!selectedLead) {
      return;
    }

    setSendState({
      pending: true,
      error: null,
      success: null,
    });

    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send_draft",
          companyId: selectedLead.company.id,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send email.");
      }

      setSendState({
        pending: false,
        error: null,
        success: "Email sent from Gmail.",
      });

      router.refresh();
    } catch (error) {
      setSendState({
        pending: false,
        error: error instanceof Error ? error.message : "Failed to send email.",
        success: null,
      });
    }
  }

  async function handleSendReply() {
    if (!selectedLead) {
      return;
    }

    setSendState({
      pending: true,
      error: null,
      success: null,
    });

    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reply",
          companyId: selectedLead.company.id,
          body: replyBody,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send reply.");
      }

      setReplyBody("");
      setSendState({
        pending: false,
        error: null,
        success: "Reply sent from Gmail.",
      });

      await handleRefreshThread();
      router.refresh();
    } catch (error) {
      setSendState({
        pending: false,
        error: error instanceof Error ? error.message : "Failed to send reply.",
        success: null,
      });
    }
  }

  const draftLeads = filteredLeads.filter((lead) => isProposalPending(lead.latestEmail.status));
  const repliedLeads = filteredLeads.filter((lead) =>
    ["replied", "interested", "booked", "won"].includes(lead.campaign.status),
  );
  const sentLeads = filteredLeads.filter((lead) => lead.campaign.status === "sent");

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="flex gap-2">
          {[
            { key: "all", label: "All", icon: Mail },
            { key: "replied", label: "Replied", icon: MailOpen },
            { key: "sent", label: "Sent", icon: ArrowUpRight },
            { key: "draft", label: "Drafts", icon: Clock },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key as InboxFilter)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                filter === item.key
                  ? "border-stone-950 bg-stone-950 text-white shadow-md"
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h3 className="text-base font-semibold text-stone-950">Lead Conversations</h3>
            <p className="mt-1 text-sm text-stone-600">
              Select a lead to view the live Gmail thread or send the current draft.
            </p>
          </div>

          <div className="max-h-[760px] overflow-y-auto p-3">
            {filteredLeads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-600">
                No leads match this inbox filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLeads.map((lead) => {
                  const isSelected = lead.company.id === selectedLead?.company.id;
                  const isPriority = ["interested", "booked", "won"].includes(
                    lead.campaign.status,
                  );
                  const badgeVariant =
                    lead.latestEmail.status === "draft"
                      ? "warning"
                      : isPriority
                        ? "positive"
                        : lead.campaign.status === "sent"
                          ? "neutral"
                          : "muted";

                  return (
                    <button
                      key={lead.company.id}
                      onClick={() => setSelectedLeadId(lead.company.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all ${
                        isSelected
                          ? "border-stone-950 bg-stone-950 text-white shadow-lg"
                          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">
                              {lead.company.name}
                            </p>
                            {isPriority ? <Star className="h-4 w-4 text-amber-500" /> : null}
                          </div>
                          <p
                            className={`mt-1 truncate text-xs ${
                              isSelected ? "text-stone-300" : "text-stone-500"
                            }`}
                          >
                            {lead.contact.fullName} · {lead.contact.email}
                          </p>
                          <p
                            className={`mt-3 line-clamp-2 text-sm ${
                              isSelected ? "text-stone-100" : "text-stone-700"
                            }`}
                          >
                            {lead.latestEmail.subject || lead.latestEmail.subjectVariants[0] || "No subject"}
                          </p>
                        </div>
                        <Badge variant={badgeVariant}>
                          {lead.latestEmail.status === "draft"
                            ? "Draft"
                            : lead.campaign.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <InboxSummary
          repliedCount={repliedLeads.length}
          sentCount={sentLeads.length}
          draftCount={draftLeads.length}
        />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        {!selectedLead ? (
          <div className="flex min-h-[520px] items-center justify-center px-6 text-sm text-stone-600">
            Select a lead to inspect the inbox.
          </div>
        ) : (
          <div className="flex min-h-[520px] flex-col">
            <div className="border-b border-stone-100 px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-stone-950">
                    {selectedLead.company.name}
                  </h3>
                  <p className="mt-1 text-sm text-stone-600">
                    {selectedLead.contact.fullName} · {selectedLead.contact.email}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!isProposalPending(selectedLead.latestEmail.status) ? (
                    <button
                      onClick={handleRefreshThread}
                      className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      {threadState.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Refresh thread
                    </button>
                  ) : null}
                  <Badge variant={isProposalPending(selectedLead.latestEmail.status) ? "warning" : "neutral"}>
                    {selectedLead.latestEmail.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex-1 px-6 py-5">
              {isProposalPending(selectedLead.latestEmail.status) ? (
                <DraftPanel
                  lead={selectedLead}
                  sendState={sendState}
                  onSend={handleSendDraft}
                />
              ) : (
                <ThreadPanel
                  lead={selectedLead}
                  threadState={threadState}
                  replyBody={replyBody}
                  sendState={sendState}
                  onReplyBodyChange={setReplyBody}
                  onSendReply={handleSendReply}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InboxSummary({
  repliedCount,
  sentCount,
  draftCount,
}: {
  repliedCount: number;
  sentCount: number;
  draftCount: number;
}) {
  const items = [
    { label: "Replies", value: repliedCount, tone: "positive" },
    { label: "Sent", value: sentCount, tone: "neutral" },
    { label: "Drafts", value: draftCount, tone: "warning" },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            {item.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-stone-950">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function DraftPanel({
  lead,
  sendState,
  onSend,
}: {
  lead: LeadRecord;
  sendState: SendState;
  onSend: () => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Ready To Send
        </p>
        <h4 className="mt-2 text-lg font-semibold text-stone-950">
          {lead.latestEmail.subject || lead.latestEmail.subjectVariants[0] || "No subject"}
        </h4>
        <p className="mt-2 text-sm leading-6 text-stone-700 whitespace-pre-wrap">
          {[lead.latestEmail.plainText, "", ...lead.latestEmail.complianceFooter].join("\n")}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void onSend()}
          disabled={sendState.pending}
          className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sendState.pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send from Gmail
        </button>
      </div>

      {sendState.error ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {sendState.error}
        </div>
      ) : null}

      {sendState.success ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {sendState.success}
        </div>
      ) : null}
    </div>
  );
}

function ThreadPanel({
  lead,
  threadState,
  replyBody,
  sendState,
  onReplyBodyChange,
  onSendReply,
}: {
  lead: LeadRecord;
  threadState: ThreadState;
  replyBody: string;
  sendState: SendState;
  onReplyBodyChange: (value: string) => void;
  onSendReply: () => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      {threadState.loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Gmail thread...
        </div>
      ) : null}

      {threadState.error ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {threadState.error}
        </div>
      ) : null}

      {!threadState.loading && !threadState.error && threadState.messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 px-6 py-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-stone-400" />
          <h4 className="mt-4 text-base font-semibold text-stone-950">
            No live Gmail thread found
          </h4>
          <p className="mt-2 text-sm text-stone-600">
            This lead has status <span className="font-medium">{lead.campaign.status}</span>, but
            the app could not find an actual Gmail conversation for {lead.contact.email}.
          </p>
        </div>
      ) : null}

      {threadState.messages.length > 0 ? (
        <div className="space-y-3">
          {threadState.messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl border p-4 ${
                message.direction === "outbound"
                  ? "border-stone-200 bg-stone-950 text-white"
                  : "border-stone-200 bg-stone-50 text-stone-950"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{message.from}</p>
                  <p
                    className={`mt-1 text-xs ${
                      message.direction === "outbound" ? "text-stone-300" : "text-stone-500"
                    }`}
                  >
                    To: {message.to}
                  </p>
                </div>
                <div
                  className={`text-xs ${
                    message.direction === "outbound" ? "text-stone-300" : "text-stone-500"
                  }`}
                >
                  {formatTimestamp(message.sentAt)}
                </div>
              </div>
              <p className="mt-3 text-sm font-medium">{message.subject || "No subject"}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                {message.body || message.snippet}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
          <MessageSquare className="h-4 w-4" />
          Reply in Gmail thread
        </div>

        <textarea
          value={replyBody}
          onChange={(event) => onReplyBodyChange(event.target.value)}
          rows={8}
          placeholder="Write the reply you want to send from Gmail..."
          className="mt-3 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950 focus:ring-2 focus:ring-stone-950/10"
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void onSendReply()}
            disabled={sendState.pending || replyBody.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendState.pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send reply
          </button>
        </div>

        {sendState.error ? (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {sendState.error}
          </div>
        ) : null}

        {sendState.success ? (
          <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {sendState.success}
          </div>
        ) : null}
      </div>
    </div>
  );
}
