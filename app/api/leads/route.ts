import { getDashboardData } from "@/lib/services/dashboard-repository";

export async function GET() {
  const data = await getDashboardData();

  return Response.json({
    generatedAt: new Date().toISOString(),
    discoveryPreset: data.discoveryPreset,
    integrations: data.integrations,
    summary: data.summary,
    leads: data.leads,
  });
}
