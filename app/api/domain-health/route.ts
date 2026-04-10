import { sendGuardrails } from "@/lib/workflows";
import { getDashboardData } from "@/lib/services/dashboard-repository";

export async function GET() {
  const data = await getDashboardData();

  return Response.json({
    generatedAt: new Date().toISOString(),
    integrations: data.integrations,
    domains: data.domains,
    workers: data.workers,
    sendGuardrails,
  });
}
