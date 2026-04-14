"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, Mail, Phone, MapPin, X, Send, Edit3, Eye, ArrowRight, Globe, Check, AlertCircle, Loader2 } from "lucide-react";
import type { LeadRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

type ModalView = "preview" | "edit";

export function LeadsTab({ leads, initialStatusFilter = "all" }: { leads: LeadRecord[]; initialStatusFilter?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [modalView, setModalView] = useState<ModalView>("preview");
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [actionBusy, setActionBusy] = useState<"draft" | "send" | null>(null);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkActionResult, setBulkActionResult] = useState<{ ok: boolean; message: string } | null>(null);

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
  const visibleDraftIds = filteredLeads
    .filter((lead) => lead.latestEmail.status === "draft")
    .map((lead) => lead.company.id);
  const selectedVisibleDraftIds = visibleDraftIds.filter((id) => selectedDraftIds.includes(id));
  const allVisibleDraftsSelected =
    visibleDraftIds.length > 0 &&
    selectedVisibleDraftIds.length === visibleDraftIds.length;

  const openLeadPanel = useCallback((lead: LeadRecord) => {
    setSelectedLead(lead);
    setModalView("preview");
    setEditedSubject(lead.latestEmail.subjectVariants[0] ?? lead.latestEmail.subject);
    setEditedBody(lead.latestEmail.plainText);
    setActionResult(null);
    setActionBusy(null);
  }, []);

  const closePanel = useCallback(() => {
    setSelectedLead(null);
    setActionResult(null);
    setActionBusy(null);
  }, []);

  async function handleCreateDraft() {
    if (!selectedLead) return;
    setActionBusy("draft");
    setActionResult(null);
    try {
      const res = await fetch("/api/gmail/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedLead.company.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionResult({ ok: true, message: "Draft created in Gmail — check your drafts folder to review and send." });
        router.refresh();
      } else {
        setActionResult({ ok: false, message: data.error || "Failed to create draft" });
      }
    } catch {
      setActionResult({ ok: false, message: "Network error" });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSendNow() {
    if (!selectedLead) return;
    setActionBusy("send");
    setActionResult(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_draft", companyId: selectedLead.company.id }),
      });
      const data = (await res.json()) as { error?: string; sentFrom?: string };
      if (res.ok) {
        setActionResult({
          ok: true,
          message: data.sentFrom
            ? `Email sent to ${selectedLead.contact.email} via ${data.sentFrom}`
            : `Email sent to ${selectedLead.contact.email}`,
        });
        router.refresh();
      } else {
        setActionResult({ ok: false, message: data.error || "Failed to send" });
      }
    } catch {
      setActionResult({ ok: false, message: "Network error" });
    } finally {
      setActionBusy(null);
    }
  }

  function toggleDraftSelection(companyId: string, checked: boolean) {
    setSelectedDraftIds((current) => {
      if (checked) {
        if (current.includes(companyId)) return current;
        return [...current, companyId];
      }
      return current.filter((id) => id !== companyId);
    });
  }

  function handleToggleSelectAllDrafts() {
    setBulkActionResult(null);
    setSelectedDraftIds((current) => {
      if (allVisibleDraftsSelected) {
        return current.filter((id) => !visibleDraftIds.includes(id));
      }

      const merged = new Set([...current, ...visibleDraftIds]);
      return [...merged];
    });
  }

  async function handleBulkAutoApprove() {
    if (selectedDraftIds.length === 0) return;

    setBulkBusy(true);
    setBulkActionResult(null);
    try {
      const res = await fetch("/api/leads/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_approve_selected",
          companyIds: selectedDraftIds,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string; approvedCount?: number; selectedCount?: number };

      if (res.ok) {
        setBulkActionResult({
          ok: true,
          message:
            data.message ??
            `Auto-approved ${data.approvedCount ?? 0} of ${data.selectedCount ?? selectedDraftIds.length} selected drafts.`,
        });
        setSelectedDraftIds([]);
        router.refresh();
      } else {
        setBulkActionResult({
          ok: false,
          message: data.error || "Failed to auto-approve selected drafts",
        });
      }
    } catch {
      setBulkActionResult({
        ok: false,
        message: "Network error while auto-approving selected drafts",
      });
    } finally {
      setBulkBusy(false);
    }
  }

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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={handleToggleSelectAllDrafts}
            disabled={visibleDraftIds.length === 0 || bulkBusy}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {allVisibleDraftsSelected ? "Clear Selection" : "Select All Drafts"}
          </button>
          <button
            onClick={() => void handleBulkAutoApprove()}
            disabled={bulkBusy || selectedDraftIds.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Auto-approve Selected Drafts
          </button>
          <span className="text-xs text-stone-600">
            {selectedDraftIds.length} draft{selectedDraftIds.length === 1 ? "" : "s"} selected
          </span>
        </div>
        {bulkActionResult ? (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${bulkActionResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {bulkActionResult.message}
          </div>
        ) : null}
      </div>

      {/* Leads Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-600">
                <input
                  type="checkbox"
                  checked={allVisibleDraftsSelected}
                  onChange={handleToggleSelectAllDrafts}
                  disabled={visibleDraftIds.length === 0 || bulkBusy}
                  aria-label="Select all visible draft leads"
                  className="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                />
              </th>
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
                className="transition-colors hover:bg-stone-50/50 cursor-pointer"
                onClick={() => openLeadPanel(lead)}
              >
                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                  {lead.latestEmail.status === "draft" ? (
                    <input
                      type="checkbox"
                      checked={selectedDraftIds.includes(lead.company.id)}
                      onChange={(e) => toggleDraftSelection(lead.company.id, e.target.checked)}
                      aria-label={`Select draft for ${lead.company.name}`}
                      className="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="text-xs text-stone-400">-</span>
                  )}
                </td>
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
                  <button
                    onClick={(e) => { e.stopPropagation(); openLeadPanel(lead); }}
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-stone-800"
                  >
                    Review Draft
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLeads.length === 0 && (
        <div className="p-12 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-stone-300" />
          <p className="text-sm text-stone-500">No leads match your filters.</p>
        </div>
      )}

      {/* Lead Detail + Email Preview Panel */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8 pb-8" onClick={closePanel}>
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-200 p-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-stone-950 truncate">{selectedLead.company.name}</h2>
                <p className="mt-1 text-sm text-stone-600">
                  {selectedLead.company.vertical} · {selectedLead.company.city}, {selectedLead.company.state}
                  {selectedLead.company.website && (
                    <>
                      {" · "}
                      <a href={selectedLead.company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        <Globe className="h-3 w-3" />Website
                      </a>
                    </>
                  )}
                </p>
              </div>
              <button onClick={closePanel} className="ml-4 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-950 shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Info Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-stone-200 p-4 bg-stone-50/50">
              <div className="text-center">
                <p className="text-xs text-stone-500">Score</p>
                <p className="text-lg font-bold text-stone-950">{selectedLead.audit.scores.outreachScore}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-stone-500">Premium Fit</p>
                <p className="text-lg font-bold text-stone-950">{selectedLead.company.premiumFit}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-stone-500">Contact</p>
                <p className="text-sm font-semibold text-stone-950 truncate">{selectedLead.contact.fullName}</p>
                <p className="text-xs text-stone-500 truncate">{selectedLead.contact.email}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-stone-500">Offer</p>
                <p className="text-sm font-semibold text-stone-950">
                  {selectedLead.offer.type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </p>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 border-b border-stone-200 px-6 py-2">
              <button
                onClick={() => setModalView("preview")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${modalView === "preview" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                <Eye className="h-3.5 w-3.5" /> Email Preview
              </button>
              <button
                onClick={() => setModalView("edit")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${modalView === "edit" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit Draft
              </button>
            </div>

            {/* Email Content */}
            <div className="p-6">
              {/* Subject Line */}
              <div className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Subject Line</label>
                {modalView === "preview" ? (
                  <div className="mt-1">
                    <p className="text-base font-semibold text-stone-950">{editedSubject}</p>
                    {selectedLead.latestEmail.subjectVariants.length > 1 && (
                      <div className="mt-2">
                        <p className="text-xs text-stone-500 mb-1">Other subject options:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedLead.latestEmail.subjectVariants.map((variant, i) => (
                            <button
                              key={i}
                              onClick={() => setEditedSubject(variant)}
                              className={`rounded-lg border px-3 py-1 text-xs transition-colors ${editedSubject === variant ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}
                            >
                              {variant}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                  />
                )}
              </div>

              {/* To */}
              <div className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">To</label>
                <p className="mt-1 text-sm text-stone-700">
                  {selectedLead.contact.fullName} &lt;{selectedLead.contact.email}&gt;
                </p>
              </div>

              {/* Email Body */}
              <div className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Message</label>
                {modalView === "preview" ? (
                  <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50/50 p-5">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-stone-800 leading-relaxed">{editedBody}</pre>
                  </div>
                ) : (
                  <textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={16}
                    className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-sm leading-relaxed text-stone-800 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 font-mono"
                  />
                )}
              </div>

              {/* Compliance Footer Preview */}
              {selectedLead.latestEmail.complianceFooter.length > 0 && (
                <div className="mb-4 rounded-lg bg-stone-50 border border-stone-100 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">Compliance Footer (auto-appended)</p>
                  <p className="text-xs text-stone-500 whitespace-pre-wrap">{selectedLead.latestEmail.complianceFooter.join("\n")}</p>
                </div>
              )}

              {/* Audit Insights */}
              {selectedLead.audit.weaknesses.length > 0 && (
                <details className="mb-4">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-stone-500 hover:text-stone-700">
                    Site Audit Findings ({selectedLead.audit.weaknesses.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {selectedLead.audit.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                        <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {/* Action Result */}
            {actionResult && (
              <div className={`mx-6 mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${actionResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {actionResult.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {actionResult.message}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4 bg-stone-50/50 rounded-b-2xl">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                {selectedLead.contact.email ? (
                  <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" /> Email found</span>
                ) : (
                  <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-amber-500" /> No email on file</span>
                )}
                {selectedLead.company.phone && (
                  <span className="flex items-center gap-1 ml-3">
                    <Phone className="h-3 w-3 text-emerald-500" />
                    <a href={`tel:${selectedLead.company.phone}`} className="hover:underline">{selectedLead.company.phone}</a>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={closePanel}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
                >
                  Close
                </button>
                <button
                  onClick={handleCreateDraft}
                  disabled={!!actionBusy || !selectedLead.contact.email}
                  className="flex items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                  {actionBusy === "draft" ? "Creating..." : "Save to Gmail Drafts"}
                </button>
                <button
                  onClick={handleSendNow}
                  disabled={!!actionBusy || !selectedLead.contact.email}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {actionBusy === "send" ? "Sending..." : "Send Now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
