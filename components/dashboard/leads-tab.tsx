"use client";

import { useState } from "react";
import { Search, Filter, ExternalLink, Mail, Phone, MapPin } from "lucide-react";
import type { LeadRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";

export function LeadsTab({ leads }: { leads: LeadRecord[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
                      className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950"
                      title="View details"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      title="Send email"
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
    </div>
  );
}
