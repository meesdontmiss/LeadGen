"use client";

import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ActivityItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  const getIcon = (tone: ActivityItem["tone"]) => {
    switch (tone) {
      case "positive":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      default:
        return <Activity className="h-4 w-4 text-stone-500" />;
    }
  };

  const getBgColor = (tone: ActivityItem["tone"]) => {
    switch (tone) {
      case "positive":
        return "bg-emerald-50 border-emerald-100";
      case "warning":
        return "bg-amber-50 border-amber-100";
      default:
        return "bg-stone-50 border-stone-100";
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-stone-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-stone-950">Activity Feed</h3>
          </div>
          <Badge variant="muted">{activity.length} events</Badge>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Recent actions across your lead engine
        </p>
      </div>

      {/* Activity List */}
      <div className="divide-y divide-stone-100">
        {activity.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="mx-auto mb-4 h-12 w-12 text-stone-400" />
            <h4 className="text-base font-semibold text-stone-950">No activity yet</h4>
            <p className="mt-2 text-sm text-stone-600">
              Activity will appear here as you send emails and receive replies.
            </p>
          </div>
        ) : (
          activity.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-4 p-5 transition-colors hover:bg-stone-50/50 ${getBgColor(
                item.tone
              )}`.trim()}
            >
              {/* Icon */}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                  item.tone === "positive"
                    ? "border-emerald-200 bg-emerald-100"
                    : item.tone === "warning"
                    ? "border-amber-200 bg-amber-100"
                    : "border-stone-200 bg-stone-100"
                }`}
              >
                {getIcon(item.tone)}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-stone-950">{item.title}</p>
                    <p className="mt-1 text-sm text-stone-600">{item.detail}</p>
                  </div>
                  <Badge
                    variant={
                      item.tone === "positive"
                        ? "positive"
                        : item.tone === "warning"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {item.tone}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {formatTimestamp(item.at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
