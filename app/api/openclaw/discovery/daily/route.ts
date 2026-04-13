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

function isTruthy(value: string | null) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function shouldForceRun(request: Request) {
  const url = new URL(request.url);
  return (
    isTruthy(url.searchParams.get("force")) ||
    isTruthy(request.headers.get("x-openclaw-force"))
  );
}

async function handleScan(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const force = shouldForceRun(request);
    const result = await runLosAngelesDailyDiscoveryScan({ force });
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
