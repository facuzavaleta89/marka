import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import type { PlanUsage } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("full_name, avatar_url, agency_id, agency:agencies(name)")
    .eq("id", user.id)
    .single();

  if (!agent) redirect("/login");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, property_limit")
    .eq("agency_id", agent.agency_id)
    .single();

  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", user.id)
    .in("status", ["active", "paused"]);

  const usedCount = count ?? 0;
  const limit = subscription?.property_limit ?? 5;

  const planUsage: PlanUsage = {
    plan: (subscription?.plan ?? "free") as PlanUsage["plan"],
    used: usedCount,
    limit,
    canCreate: usedCount < limit,
  };

  // Supabase devuelve agency como array cuando se usa join; normalizamos
  const agencyRaw = agent.agency;
  const agencyName = Array.isArray(agencyRaw)
    ? agencyRaw[0]?.name ?? null
    : (agencyRaw as { name: string } | null)?.name ?? null;

  return (
    <div className="flex h-screen bg-mist overflow-hidden">
      <Sidebar
        agent={{
          full_name: agent.full_name,
          avatar_url: agent.avatar_url,
          agency: agencyName ? { name: agencyName } : null,
        }}
        planUsage={planUsage}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
