import { requireAgentSession } from "@/lib/utils/resolveAgentSession";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionContent } from "@/components/dashboard/SubscriptionContent";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";

export default async function SuscripcionPage() {
  const supabase = await createClient();

  const { agent } = await requireAgentSession();

  const [planUsage, { data: subscription }] = await Promise.all([
    getPlanUsage(supabase, agent.agency_id),
    supabase
      .from("subscriptions")
      .select("status, pending_plan, current_period_end")
      .eq("agency_id", agent.agency_id)
      .single(),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">Suscripción</h1>
      <SubscriptionContent
        planUsage={planUsage}
        status={subscription?.status ?? "active"}
        pendingPlan={subscription?.pending_plan ?? null}
        currentPeriodEnd={subscription?.current_period_end ?? null}
      />
    </div>
  );
}
