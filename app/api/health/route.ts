import { hasSupabaseServerEnv, hasRuntimeGmailEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

export async function GET() {
  const supabaseConfigured = hasSupabaseServerEnv();
  const gmailConfigured = hasRuntimeGmailEnv();
  let supabaseConnected = false;

  if (supabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from("companies").select("id").limit(1);
      supabaseConnected = !error;
    }
  }

  const healthy = supabaseConfigured && supabaseConnected;

  return Response.json({
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      supabase: supabaseConfigured
        ? supabaseConnected
          ? "connected"
          : "misconfigured"
        : "not_configured",
      gmail: gmailConfigured ? "configured" : "not_configured",
    },
  }, { status: healthy ? 200 : 503 });
}
