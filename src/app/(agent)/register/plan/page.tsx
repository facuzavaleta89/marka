import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionPlan } from "@/types";
import { PlanSelector } from "./PlanSelector";

// Paso 2 del registro de una inmobiliaria: elegir plan. La cuenta ya existe
// (creada en free/active por el registro); acá solo se elige/actualiza el plan.
export default async function RegisterPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Agencia del agente logueado + su plan actual (para preseleccionar la card).
  const { data: agent } = await supabase
    .from("agents")
    .select("agency_id")
    .eq("id", user.id)
    .single();
  if (!agent) redirect("/login");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("agency_id", agent.agency_id)
    .single();

  const currentPlan: SubscriptionPlan = subscription?.plan ?? "free";

  return <PlanSelector currentPlan={currentPlan} />;
}
