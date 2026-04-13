"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BriefcaseBusiness,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  PhoneCall,
  Send,
} from "lucide-react";

import type { LeadRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";

type FollowUpView = "upcoming" | "overdue" | "completed";
type BookingType = "call" | "gig";
type BookingStatus = "scheduled" | "completed" | "canceled";

type LeadActionState = {
  pending: boolean;
  error: string | null;
  success: string | null;
};

function emptyActionState(): LeadActionState {
  return {
    pending: false,
    error: null,
    success: null,
  };
}

function isInitialProposal(lead: LeadRecord) {
  return lead.latestEmail.status === "draft" || lead.latestEmail.status === "approved";
}

function toDateTimeLocalValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function FollowUpsTab({ leads }: { leads: LeadRecord[] }) {
  const router = useRouter();
  const [view, setView] = useState<FollowUpView>("upcoming");
  const [activeBookingLeadId, setActiveBookingLeadId] = useState<string | null>(
    null,
  );
  const [bookingType, setBookingType] = useState<BookingType>("call");
  const [bookingTitle, setBookingTitle] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingScheduledAt, setBookingScheduledAt] = useState(
    toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [bookingPending, setBookingPending] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [leadActionState, setLeadActionState] = useState<
    Record<string, LeadActionState>
  >({});

  const now = new Date();
  const upcoming = leads
    .filter((lead) => {
      const nextTouch = new Date(lead.campaign.nextTouchAt);
      return nextTouch > now && !["won", "lost"].includes(lead.campaign.status);
    })
    .sort(
      (left, right) =>
        new Date(left.campaign.nextTouchAt).getTime() -
        new Date(right.campaign.nextTouchAt).getTime(),
    );

  const overdue = leads
    .filter((lead) => {
      const nextTouch = new Date(lead.campaign.nextTouchAt);
      return nextTouch <= now && !["won", "lost"].includes(lead.campaign.status);
    })
    .sort(
      (left, right) =>
        new Date(left.campaign.nextTouchAt).getTime() -
        new Date(right.campaign.nextTouchAt).getTime(),
    );

  const completed = leads.filter((lead) =>
    ["won", "lost", "booked"].includes(lead.campaign.status),
  );

  const activeLeads =
    view === "upcoming" ? upcoming : view === "overdue" ? overdue : completed;

  function setLeadAction(companyId: string, state: Partial<LeadActionState>) {
    setLeadActionState((current) => ({
      ...current,
      [companyId]: {
        ...emptyActionState(),
        ...(current[companyId] ?? {}),
        ...state,
      },
    }));
  }

  async function handleSendNow(lead: LeadRecord) {
    setLeadAction(lead.company.id, {
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
          action: isInitialProposal(lead) ? "send_draft" : "follow_up",
          companyId: lead.company.id,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send follow-up.");
      }

      setLeadAction(lead.company.id, {
        pending: false,
        error: null,
        success: "Follow-up sent successfully.",
      });
      router.refresh();
    } catch (error) {
      setLeadAction(lead.company.id, {
        pending: false,
        error: error instanceof Error ? error.message : "Failed to send follow-up.",
        success: null,
      });
    }
  }

  function openBookingForm(lead: LeadRecord, type: BookingType) {
    setActiveBookingLeadId(lead.company.id);
    setBookingType(type);
    setBookingTitle(
      type === "call"
        ? `${lead.company.name} consultation call`
        : `${lead.company.name} gig kickoff`,
    );
    setBookingNotes("");
    setBookingError(null);
    setBookingSuccess(null);
    setBookingScheduledAt(toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
  }

  async function handleCreateBooking(lead: LeadRecord) {
    if (!bookingScheduledAt) {
      setBookingError("Please choose a booking date and time.");
      return;
    }

    setBookingPending(true);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: lead.company.id,
          type: bookingType,
          title: bookingTitle.trim() || `${lead.company.name} ${bookingType}`,
          notes: bookingNotes.trim(),
          scheduledAt: new Date(bookingScheduledAt).toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to schedule booking.");
      }

      setBookingPending(false);
      setBookingSuccess("Booking saved.");
      setActiveBookingLeadId(null);
      router.refresh();
    } catch (error) {
      setBookingPending(false);
      setBookingError(
        error instanceof Error ? error.message : "Failed to schedule booking.",
      );
    }
  }

  async function handleBookingStatus(
    lead: LeadRecord,
    bookingId: string,
    status: BookingStatus,
  ) {
    setLeadAction(lead.company.id, {
      pending: true,
      error: null,
      success: null,
    });

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: lead.company.id,
          status,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update booking.");
      }

      setLeadAction(lead.company.id, {
        pending: false,
        error: null,
        success: `Booking marked ${status}.`,
      });
      router.refresh();
    } catch (error) {
      setLeadAction(lead.company.id, {
        pending: false,
        error: error instanceof Error ? error.message : "Failed to update booking.",
        success: null,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[
          { key: "upcoming", label: "Upcoming", count: upcoming.length, color: "blue" },
          { key: "overdue", label: "Overdue", count: overdue.length, color: "red" },
          { key: "completed", label: "Completed", count: completed.length, color: "emerald" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key as FollowUpView)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              view === item.key
                ? item.color === "blue"
                  ? "bg-blue-500 text-white shadow-md"
                  : item.color === "red"
                    ? "bg-red-500 text-white shadow-md"
                    : "bg-emerald-500 text-white shadow-md"
                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {item.key === "upcoming" && <Calendar className="h-4 w-4" />}
            {item.key === "overdue" && <AlertCircle className="h-4 w-4" />}
            {item.key === "completed" && <CheckCircle2 className="h-4 w-4" />}
            {item.label}
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                view === item.key ? "bg-white/20" : "bg-stone-100"
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeLeads.map((lead) => {
          const nextTouch = new Date(lead.campaign.nextTouchAt);
          const daysUntil = Math.ceil(
            (nextTouch.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          const isOverdue = daysUntil < 0;
          const leadState = leadActionState[lead.company.id] ?? emptyActionState();
          const bookings = lead.campaign.bookings;
          const bookingFormOpen = activeBookingLeadId === lead.company.id;
          const sendDisabled = leadState.pending;

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
                    {isOverdue ? <Badge variant="critical">Overdue</Badge> : null}
                    {!isOverdue && daysUntil <= 2 ? (
                      <Badge variant="warning">Soon</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-stone-600">
                    {lead.contact.fullName} | {lead.company.vertical}
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
                  <p className="text-sm font-semibold text-stone-950">
                    {lead.campaign.status.replace("_", " ")}
                  </p>
                  {view !== "completed" ? (
                    <button
                      onClick={() => void handleSendNow(lead)}
                      disabled={sendDisabled}
                      className="flex items-center gap-1.5 rounded-lg bg-stone-950 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {leadState.pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Send now
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-stone-100 bg-stone-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Follow-up history
                </p>
                {lead.campaign.followUpTouches.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-600">
                    No outbound touches recorded yet.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm text-stone-700">
                    {lead.campaign.followUpTouches.map((touch) => (
                      <li key={touch.id} className="flex items-center justify-between gap-3">
                        <span>{touch.note || "Outbound follow-up sent"}</span>
                        <span className="text-xs text-stone-500">
                          {formatTimestamp(touch.sentAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-stone-100 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Calls & gigs
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openBookingForm(lead, "call")}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      Schedule call
                    </button>
                    <button
                      onClick={() => openBookingForm(lead, "gig")}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      <BriefcaseBusiness className="h-3.5 w-3.5" />
                      Schedule gig
                    </button>
                  </div>
                </div>

                {bookings.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-600">
                    No calls or gigs scheduled yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {bookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-stone-900">
                              {booking.title}
                            </p>
                            <p className="text-xs text-stone-600">
                              {booking.type} | {formatTimestamp(booking.scheduledAt)}
                            </p>
                            {booking.notes ? (
                              <p className="mt-1 text-xs text-stone-600">{booking.notes}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                booking.status === "completed"
                                  ? "positive"
                                  : booking.status === "canceled"
                                    ? "critical"
                                    : "warning"
                              }
                            >
                              {booking.status}
                            </Badge>
                            {booking.status === "scheduled" ? (
                              <>
                                <button
                                  onClick={() =>
                                    void handleBookingStatus(
                                      lead,
                                      booking.id,
                                      "completed",
                                    )
                                  }
                                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() =>
                                    void handleBookingStatus(
                                      lead,
                                      booking.id,
                                      "canceled",
                                    )
                                  }
                                  className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {bookingFormOpen ? (
                  <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <p className="text-sm font-semibold text-stone-900">
                      Schedule {bookingType}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input
                        value={bookingTitle}
                        onChange={(event) => setBookingTitle(event.target.value)}
                        placeholder="Booking title"
                        className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
                      />
                      <input
                        type="datetime-local"
                        value={bookingScheduledAt}
                        onChange={(event) => setBookingScheduledAt(event.target.value)}
                        className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
                      />
                    </div>
                    <textarea
                      value={bookingNotes}
                      onChange={(event) => setBookingNotes(event.target.value)}
                      rows={3}
                      placeholder="Optional notes"
                      className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
                    />
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => void handleCreateBooking(lead)}
                        disabled={bookingPending}
                        className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {bookingPending ? "Saving..." : "Save booking"}
                      </button>
                      <button
                        onClick={() => setActiveBookingLeadId(null)}
                        className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}

                {bookingError ? (
                  <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {bookingError}
                  </div>
                ) : null}

                {bookingSuccess ? (
                  <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {bookingSuccess}
                  </div>
                ) : null}
              </div>

              {leadState.error ? (
                <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {leadState.error}
                </div>
              ) : null}

              {leadState.success ? (
                <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {leadState.success}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {activeLeads.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-stone-400" />
          <h3 className="text-lg font-semibold text-stone-950">
            No {view} follow-ups
          </h3>
          <p className="mt-2 text-sm text-stone-600">
            {view === "upcoming"
              ? "New follow-ups will appear as campaigns advance."
              : view === "overdue"
                ? "No overdue follow-ups right now."
                : "Completed campaigns will appear here."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
