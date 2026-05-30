import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionContent } from "@/components/dashboard/SubscriptionContent";
import type { PlanUsage } from "@/types";

export default async function SuscripcionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("agency_id")
    .eq("id", user.id)
    .single();
  if (!agent) redirect("/login");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, property_limit, status, current_period_end")
    .eq("agency_id", agent.agency_id)
    .single();

  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", user.id)
    .in("status", ["active", "paused"]);

  const used = count ?? 0;
  const limit = subscription?.property_limit ?? 5;
  const plan = (subscription?.plan ?? "free") as PlanUsage["plan"];

  const planUsage: PlanUsage = {
    plan,
    used,
    limit,
    canCreate: used < limit,
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">Suscripción</h1>
      <SubscriptionContent
        planUsage={planUsage}
        currentPeriodEnd={subscription?.current_period_end ?? null}
      />
    </div>
  );
}
