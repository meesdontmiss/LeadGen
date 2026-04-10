import { followUpSchedule, stopConditions } from "@/lib/workflows";
import { getDashboardData } from "@/lib/services/dashboard-repository";

export async function GET() {
  const data = await getDashboardData();

  return Response.json({
    generatedAt: new Date().toISOString(),
    integrations: data.integrations,
    campaigns: data.leads.map((lead) => ({
      company: lead.company.name,
      status: lead.campaign.status,
      sendDomain: lead.campaign.sendDomain,
      lastTouchAt: lead.campaign.lastTouchAt,
      nextTouchAt: lead.campaign.nextTouchAt,
      pipelineValue: lead.campaign.pipelineValue,
    })),
    followUpSchedule,
    stopConditions,
  });
}
