import { AlertCircle, Bot, Flag, Layers3, ShieldBan } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { WorkerStatus } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

export function SystemStatusPanel({
  workers,
  gmailLabels,
  stopConditions,
  mvpModules,
  phaseTwoModules,
  phaseThreeModules,
}: {
  workers: WorkerStatus[];
  gmailLabels: string[];
  stopConditions: string[];
  mvpModules: string[];
  phaseTwoModules: string[];
  phaseThreeModules: string[];
}) {
  if (workers.length === 0) {
    return (
      <section className="rounded-[2rem] border border-white/60 bg-white/72 p-8 text-center shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
          <AlertCircle className="h-8 w-8 text-stone-400" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
          System Status
        </p>
        <h2 className="mt-2 text-xl font-semibold text-stone-950">
          No workers running yet
        </h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-stone-600">
          Background workers will appear here once the discovery, audit, and outreach processes are activated.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/72 p-6 shadow-[0_20px_60px_rgba(38,25,16,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            System Status
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            Worker health, labels, and roadmap
          </h2>
        </div>
        <Badge variant="muted">OpenClaw orchestrator</Badge>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            <Bot className="h-4 w-4" />
            Worker queue
          </div>
          <div className="mt-3 space-y-3">
            {workers.map((worker) => (
              <div
                key={worker.key}
                className="rounded-[1.25rem] border border-[color:var(--line)] bg-white/70 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-stone-950">{worker.label}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      {worker.nextAction}
                    </p>
                  </div>
                  <Badge
                    variant={
                      worker.state === "healthy"
                        ? "positive"
                        : worker.state === "busy"
                          ? "warning"
                          : "critical"
                    }
                  >
                    {worker.state}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                  <span>{worker.queueDepth} queued</span>
                  <span>·</span>
                  <span>{worker.throughputPerHour}/hr</span>
                  <span>·</span>
                  <span>{formatTimestamp(worker.lastRunAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              <Flag className="h-4 w-4" />
              Gmail labels
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {gmailLabels.map((label) => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              <ShieldBan className="h-4 w-4" />
              Stop conditions
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
              {stopConditions.map((condition) => (
                <li
                  key={condition}
                  className="rounded-[1rem] border border-[color:var(--line)] bg-white/70 px-4 py-3"
                >
                  {condition}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            <Layers3 className="h-4 w-4" />
            Delivery roadmap
          </div>
          <RoadmapBlock title="Initial MVP" items={mvpModules} />
          <RoadmapBlock title="Phase 2" items={phaseTwoModules} />
          <RoadmapBlock title="Phase 3" items={phaseThreeModules} />
        </div>
      </div>
    </section>
  );
}

function RoadmapBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4 rounded-[1.25rem] border border-[color:var(--line)] bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
