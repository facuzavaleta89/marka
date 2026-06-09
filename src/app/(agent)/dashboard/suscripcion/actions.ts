"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { PLAN_ORDER, type SubscriptionPlan } from "@/types";

// Pide un upgrade de plan desde el dashboard. Deja la suscripción de la agencia
// con pending_plan = <pedido> y status = 'pending'. NO toca `plan` (el que rige)
// ni property_limit/has_*/activated_at: el cliente sigue operando con lo que
// tiene hasta que el admin active. (Antes pisaba `plan`, ese era el bug.)
//
// Mismo patrón de seguridad que register/plan/actions.ts: el agency_id se deriva
// del auth.uid() server-side, nunca del cliente, y el UPDATE se acota a esa
// agencia con admin client (no hay policy de UPDATE de subscriptions para users).
export async function requestPlanUpgradeAction(
  plan: SubscriptionPlan
): Promise<{ error: string } | undefined> {
  // Validación: plan conocido y pago. No tiene sentido "pedir" free desde acá.
  if (!PLAN_ORDER.includes(plan) || plan === "free") {
    return { error: "Plan inválido" };
  }

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

  // Solo pending_plan + status. `plan` (el que rige), property_limit, has_* y
  // activated_at quedan como están.
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({
      pending_plan: plan,
      status: "pending",
    })
    .eq("agency_id", agent.agency_id);

  if (error) {
    return { error: "No se pudo registrar el pedido. Intentá de nuevo." };
  }

  // Sin redirect: el client refresca la vista (router.refresh()).
}
