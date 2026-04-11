"use client";

import { useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Mail,
  MailOpen,
  MessageSquare,
  Send,
  Star,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import type { DashboardData, LeadRecord } from "@/lib/types";
import { formatCompactNumber, formatCurrency, formatPercent } from "@/lib/utils";
import { LeadsTab } from "@/components/dashboard/leads-tab";
import { InboxTab } from "@/components/dashboard/inbox-tab";
import { FollowUpsTab } from "@/components/dashboard/follow-ups-tab";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DomainHealthTab } from "@/components/dashboard/domain-health-tab";

type TabKey = "overview" | "leads" | "inbox" | "followups" | "activity" | "domains";

interface TabConfig {
  key: TabKey;
  label: string;
  icon: any;
  badge?: number;
}

export function OperatorDashboard({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Calculate metrics
  const totalLeads = data.leads.length;
  const qualifiedLeads = data.leads.filter((l) => l.qualifies).length;
  const draftsReady = data.leads.filter(
    (l) => l.latestEmail.status === "draft" || l.company.status === "draft_ready"
  ).length;
  const sentCount = data.leads.filter((l) => l.campaign.status === "sent").length;
  const repliedCount = data.leads.filter(
    (l) => l.campaign.status === "replied" || l.campaign.status === "interested"
  ).length;
  const positiveReplies = data.leads.filter((l) =>
    ["interested", "booked", "won"].includes(l.campaign.status)
  ).length;
  const pendingFollowUps = data.leads.filter((l) => {
    const nextTouch = new Date(l.campaign.nextTouchAt);
    return nextTouch <= new Date() && l.campaign.status !== "won" && l.campaign.status !== "lost";
  }).length;

  const tabs: TabConfig[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "leads", label: "Leads", icon: Users, badge: totalLeads },
    { key: "inbox", label: "Inbox", icon: Mail, badge: repliedCount },
    { key: "followups", label: "Follow-ups", icon: Clock, badge: pendingFollowUps },
    { key: "activity", label: "Activity", icon: Activity },
    { key: "domains", label: "Domains", icon: Send },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-[1680px] px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-stone-950">
                Lead Engine Dashboard
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Monitor leads, replies, and follow-ups in real-time
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {data.integrations.dataSource === "supabase" ? "Live Data" : "Setup Needed"}
              </div>
              {data.integrations.gmailConfigured && (
                <div className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                  <Mail className="h-4 w-4" />
                  Gmail Connected
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1680px] px-6 py-8">
        {/* Metrics Cards */}
        <MetricsGrid
          totalLeads={totalLeads}
          qualifiedLeads={qualifiedLeads}
          draftsReady={draftsReady}
          sentCount={sentCount}
          repliedCount={repliedCount}
          positiveReplies={positiveReplies}
          pendingFollowUps={pendingFollowUps}
          pipelineValue={data.summary.pipelineValue}
          positiveReplyRate={data.summary.positiveReplyRate}
        />

        {/* Tab Navigation */}
        <div className="mt-8">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1.5 shadow-sm border border-stone-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-stone-950 text-white shadow-md"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      activeTab === tab.key
                        ? "bg-white/20 text-white"
                        : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "overview" && (
            <OverviewTab
              data={data}
              leads={data.leads}
              positiveReplies={positiveReplies}
              pendingFollowUps={pendingFollowUps}
            />
          )}
          {activeTab === "leads" && <LeadsTab leads={data.leads} />}
          {activeTab === "inbox" && <InboxTab leads={data.leads} />}
          {activeTab === "followups" && <FollowUpsTab leads={data.leads} />}
          {activeTab === "activity" && <ActivityFeed activity={data.activity} />}
          {activeTab === "domains" && <DomainHealthTab domains={data.domains} />}
        </div>
      </div>
    </main>
  );
}

function MetricsGrid({
  totalLeads,
  qualifiedLeads,
  draftsReady,
  sentCount,
  repliedCount,
  positiveReplies,
  pendingFollowUps,
  pipelineValue,
  positiveReplyRate,
}: {
  totalLeads: number;
  qualifiedLeads: number;
  draftsReady: number;
  sentCount: number;
  repliedCount: number;
  positiveReplies: number;
  pendingFollowUps: number;
  pipelineValue: number;
  positiveReplyRate: number;
}) {
  const metrics = [
    {
      label: "Total Leads",
      value: formatCompactNumber(totalLeads),
      icon: Users,
      color: "blue",
      trend: `${formatCompactNumber(qualifiedLeads)} qualified`,
    },
    {
      label: "Drafts Ready",
      value: formatCompactNumber(draftsReady),
      icon: Mail,
      color: "amber",
      trend: "Awaiting review",
    },
    {
      label: "Emails Sent",
      value: formatCompactNumber(sentCount),
      icon: Send,
      color: "purple",
      trend: "Outbound touches",
    },
    {
      label: "Replies",
      value: formatCompactNumber(repliedCount),
      icon: MailOpen,
      color: "emerald",
      trend: `${positiveReplies} positive`,
    },
    {
      label: "Follow-ups",
      value: formatCompactNumber(pendingFollowUps),
      icon: Clock,
      color: "orange",
      trend: "Pending touches",
    },
    {
      label: "Pipeline Value",
      value: formatCurrency(pipelineValue),
      icon: TrendingUp,
      color: "indigo",
      trend: `${formatPercent(positiveReplyRate)} reply rate`,
    },
  ];

  const colorClasses = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-700" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-700" },
    purple: { bg: "bg-purple-50", icon: "text-purple-600", text: "text-purple-700" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-700" },
    orange: { bg: "bg-orange-50", icon: "text-orange-600", text: "text-orange-700" },
    indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", text: "text-indigo-700" },
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => {
        const colors = colorClasses[metric.color as keyof typeof colorClasses];
        return (
          <div
            key={metric.label}
            className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  {metric.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-stone-950">{metric.value}</p>
                <p className="mt-1 text-xs text-stone-600">{metric.trend}</p>
              </div>
              <div className={`rounded-xl ${colors.bg} p-3`}>
                <metric.icon className={`h-5 w-5 ${colors.icon}`} />
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 h-1 w-full ${colors.bg}`} />
          </div>
        );
      })}
    </div>
  );
}

function OverviewTab({
  data,
  leads,
  positiveReplies,
  pendingFollowUps,
}: {
  data: DashboardData;
  leads: LeadRecord[];
  positiveReplies: number;
  pendingFollowUps: number;
}) {
  // Get top leads by outreach score
  const topLeads = leads.slice(0, 5);
  
  // Recent activity
  const recentActivity = data.activity.slice(0, 8);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Top Priority Leads */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-stone-950">Top Priority Leads</h3>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Top {topLeads.length}
          </span>
        </div>
        <div className="space-y-3">
          {topLeads.map((lead) => (
            <div
              key={lead.company.id}
              className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/50 p-4 transition-all hover:bg-white hover:shadow-md"
            >
              <div className="flex-1">
                <p className="font-semibold text-stone-950">{lead.company.name}</p>
                <p className="text-sm text-stone-600">
                  {lead.company.vertical} · {lead.company.city}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-stone-950">
                    {lead.audit.scores.outreachScore}
                  </p>
                  <p className="text-xs text-stone-500">Score</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-stone-950">
                    {lead.company.premiumFit}%
                  </p>
                  <p className="text-xs text-stone-500">Fit</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    lead.qualifies
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {lead.qualifies ? "Ready" : "Hold"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-stone-950">Recent Activity</h3>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Last 24h
          </span>
        </div>
        <div className="space-y-3">
          {recentActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/50 p-4"
            >
              <div
                className={`mt-0.5 h-2 w-2 rounded-full ${
                  item.tone === "positive"
                    ? "bg-emerald-500"
                    : item.tone === "warning"
                    ? "bg-amber-500"
                    : "bg-stone-400"
                }`}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-950">{item.title}</p>
                <p className="mt-1 text-xs text-stone-600">{item.detail}</p>
                <p className="mt-1 text-xs text-stone-500">{new Date(item.at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Breakdown */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-stone-950">Pipeline Breakdown</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { stage: "New", status: "new", color: "blue" },
            { stage: "Draft Ready", status: "draft_ready", color: "amber" },
            { stage: "Sent", status: "sent", color: "purple" },
            { stage: "Replied", status: "replied", color: "emerald" },
          ].map((item) => {
            const count = leads.filter((l) => l.company.status === item.status).length;
            const percentage = leads.length > 0 ? (count / leads.length) * 100 : 0;
            return (
              <div key={item.stage} className="rounded-xl border border-stone-100 bg-stone-50/50 p-5">
                <p className="text-sm font-medium text-stone-600">{item.stage}</p>
                <p className="mt-2 text-3xl font-bold text-stone-950">{count}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={`h-full rounded-full ${
                      item.color === "blue"
                        ? "bg-blue-500"
                        : item.color === "amber"
                        ? "bg-amber-500"
                        : item.color === "purple"
                        ? "bg-purple-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-stone-600">{formatPercent(percentage)} of pipeline</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
