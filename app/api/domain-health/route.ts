import { sendGuardrails } from "@/lib/workflows";
import { getDashboardData } from "@/lib/services/dashboard-repository";

export async function GET() {
  try {
    const data = await getDashboardData();

    return Response.json({
      generatedAt: new Date().toISOString(),
      integrations: data.integrations,
      domains: data.domains,
      workers: data.workers,
      sendGuardrails,
    });
  } catch (error) {
    console.error("[API /domain-health] Failed to fetch domain health:", error);
    const message = error instanceof Error ? error.message : "Failed to load domain health.";
    return Response.json({ error: message }, { status: 500 });
  }
}
