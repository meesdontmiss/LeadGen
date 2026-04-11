import { followUpSchedule, stopConditions } from "@/lib/workflows";
import { getDashboardData } from "@/lib/services/dashboard-repository";

export async function GET() {
  try {
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
  } catch (error) {
    console.error("[API /campaigns] Failed to fetch campaigns:", error);
    const message = error instanceof Error ? error.message : "Failed to load campaigns.";
    return Response.json({ error: message }, { status: 500 });
  }
}
