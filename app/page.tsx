import { LeadEngineApp } from "@/components/lead-engine-app";
import { getDashboardData } from "@/lib/services/dashboard-repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();

  return <LeadEngineApp data={data} />;
}
