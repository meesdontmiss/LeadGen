import { getDashboardData } from "@/lib/services/dashboard-repository";
import { isAuthenticated } from "@/lib/auth";
import { LoginOverlay } from "@/components/login-overlay";
import { OperatorDashboard } from "@/components/operator-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return <LoginOverlay />;
  }

  const data = await getDashboardData();

  return <OperatorDashboard data={data} />;
}
