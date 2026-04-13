"use client";

import { useState } from "react";
import { Search, Filter, ExternalLink, Mail, Phone, MapPin, X, Send, Clock, Star } from "lucide-react";
import type { LeadRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp, formatPercent } from "@/lib/utils";

export function LeadsTab({ leads, initialStatusFilter = "all" }: { leads: LeadRecord[]; initialStatusFilter?: string }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftResult, setDraftResult] = useState<{ ok: boolean; message: string } | null>(null);

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      search.length === 0 ||
      [
        lead.company.name,
        lead.company.vertical,
        lead.company.city,
        lead.contact.fullName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || lead.company.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statuses = Array.from(new Set(leads.map((l) => l.company.status)));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      {/* Filters */}
      <div className="border-b border-stone-200 p-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="w-full rounded-lg border border-stone-300 py-2.5 pl-10 pr-4 text-sm focus:border-stone-950 focus:outline-none focus:ring-2 focus:ring-stone-950/10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-stone-300 py-2.5 pl-10 pr-8 text-sm focus:border-stone-950 focus:outline-none focus:ring-2 focus:ring-stone-950/10"
            >
              <option value="all">All Status</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-sm text-stone-600">
          Showing <span className="font-semibold text-stone-950">{filteredLeads.length}</span> of{" "}
          {leads.length} leads
        </p>
      </div>

      {/* Leads Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-600">
                Company
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-600">
                Contact
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-600">
                Score
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-600">
                Premium Fit
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-600">
                Status
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-600">
                Location
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredLeads.map((lead) => (
              <tr
                key={lead.company.id}
                className="transition-colors hover:bg-stone-50/50"
              >
                <td className="px-5 py-4">
                  <div>
                    <p className="font-semibold text-stone-950">{lead.company.name}</p>
                    <p className="text-sm text-stone-600">{lead.company.vertical}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-stone-950">
                      {lead.contact.fullName}
                    </p>
                    <p className="text-xs text-stone-600">{lead.contact.title}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="text-lg font-bold text-stone-950">
                    {lead.audit.scores.outreachScore}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-stone-200">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${lead.company.premiumFit}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-stone-700">
                      {lead.company.premiumFit}%
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <Badge
                    variant={
                      lead.qualifies ? "positive" : lead.company.status === "draft_ready" ? "warning" : "neutral"
                    }
                  >
                    {lead.company.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1 text-sm text-stone-600">
                    <MapPin className="h-3.5 w-3.5" />
                    {lead.company.city}, {lead.company.state}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setSelectedLead(lead); setDraftResult(null); }}
                      className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950"
                      title="View details"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => {
                        setDraftBusy(true);
                        setDraftResult(null);
                        try {
                          const res = await fetch("/api/gmail/drafts", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ companyId: lead.company.id }),
                          });
                          const data = await res.json();
                          setDraftResult({ ok: res.ok, message: res.ok ? "Draft created in Gmail" : data.error || "Failed" });
                        } catch {
                          setDraftResult({ ok: false, message: "Network error" });
                        } finally {
                          setDraftBusy(false);
                        }
                      }}
                      disabled={draftBusy}
                      className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                      title="Create Gmail draft"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Draft result toast */}
      {draftResult && (
        <div className={`mx-5 my-3 rounded-lg px-4 py-2 text-sm font-medium ${draftResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {draftResult.message}
          <button onClick={() => setDraftResult(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}

      {/* Lead Detail Panel */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedLead(null)}>
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedLead(null)} className="absolute right-4 top-4 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-950">
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-2xl font-bold text-stone-950">{selectedLead.company.name}</h2>
            <p className="mt-1 text-sm text-stone-600">{selectedLead.company.vertical} · {selectedLead.company.city}, {selectedLead.company.state}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Contact</p>
                <p className="mt-1 text-sm font-semibold text-stone-950">{selectedLead.contact.fullName}</p>
                <p className="text-xs text-stone-600">{selectedLead.contact.title}</p>
                <a href={`mailto:${selectedLead.contact.email}`} className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <Mail className="h-3 w-3" /> {selectedLead.contact.email}
                </a>
                {selectedLead.company.phone && (
                  <a href={`tel:${selectedLead.company.phone}`} className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Phone className="h-3 w-3" /> {selectedLead.company.phone}
                  </a>
                )}
              </div>

              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Outreach Score</p>
                <p className="mt-1 text-3xl font-bold text-stone-950">{selectedLead.audit.scores.outreachScore}</p>
                <div className="mt-2 space-y-1 text-xs text-stone-600">
                  <p>Premium Fit: {selectedLead.company.premiumFit}%</p>
                  <p>Presentation Gap: {selectedLead.audit.scores.presentationGap}%</p>
                  <p>Contactability: {selectedLead.company.contactability}%</p>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Status</p>
                <Badge variant={selectedLead.qualifies ? "positive" : "neutral"} className="mt-1">
                  {selectedLead.company.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </Badge>
                <p className="mt-2 text-xs text-stone-600">
                  {selectedLead.qualifies ? "Qualifies for outreach" : "Does not meet outreach thresholds"}
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Offer</p>
                <p className="mt-1 text-sm font-semibold text-stone-950">
                  {selectedLead.offer.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className="mt-1 text-xs text-stone-600">{selectedLead.offer.rationale}</p>
              </div>
            </div>

            {selectedLead.company.website && (
              <div className="mt-4 rounded-xl border border-stone-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Website</p>
                <a href={selectedLead.company.website} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-blue-600 hover:underline">
                  {selectedLead.company.website}
                </a>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={async () => {
                  setDraftBusy(true);
                  setDraftResult(null);
                  try {
                    const res = await fetch("/api/gmail/drafts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ companyId: selectedLead.company.id }),
                    });
                    const data = await res.json();
                    setDraftResult({ ok: res.ok, message: res.ok ? "Draft created in Gmail" : data.error || "Failed" });
                  } catch {
                    setDraftResult({ ok: false, message: "Network error" });
                  } finally {
                    setDraftBusy(false);
                  }
                }}
                disabled={draftBusy}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {draftBusy ? "Creating..." : "Create Gmail Draft"}
              </button>
              <button
                onClick={() => setSelectedLead(null)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                Close
              </button>
            </div>

            {draftResult && (
              <div className={`mt-3 rounded-lg px-4 py-2 text-sm font-medium ${draftResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {draftResult.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
