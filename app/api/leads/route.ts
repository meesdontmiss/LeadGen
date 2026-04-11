import { getDashboardData } from "@/lib/services/dashboard-repository";

export async function GET() {
  try {
    const data = await getDashboardData();

    return Response.json({
      generatedAt: new Date().toISOString(),
      discoveryPreset: data.discoveryPreset,
      integrations: data.integrations,
      summary: data.summary,
      leads: data.leads,
    });
  } catch (error) {
    console.error("[API /leads] Failed to fetch dashboard data:", error);
    const message = error instanceof Error ? error.message : "Failed to load leads.";
    return Response.json({ error: message }, { status: 500 });
  }
}
