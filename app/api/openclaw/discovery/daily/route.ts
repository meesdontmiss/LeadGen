import { env } from "@/lib/env";
import { runLosAngelesDailyDiscoveryScan } from "@/lib/services/discovery-worker";

function isAuthorized(request: Request) {
  const provided =
    request.headers.get("x-openclaw-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const validSecrets = [env.OPENCLAW_WEBHOOK_SECRET, env.CRON_SECRET].filter(
    (value): value is string => Boolean(value),
  );

  return Boolean(provided && validSecrets.some((secret) => secret === provided));
}

async function handleScan(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runLosAngelesDailyDiscoveryScan();
    return Response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Daily discovery scan failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleScan(request);
}

export async function POST(request: Request) {
  return handleScan(request);
}
