"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { PLANS, PLAN_ORDER, type SubscriptionPlan } from "@/types";

// Guarda el plan elegido en el paso 2 del registro (/register/plan).
// La agencia se deriva SIEMPRE del agente logueado (auth.uid()); nunca se
// confía en un agency_id que venga del cliente.
export async function selectPlanAction(
  plan: SubscriptionPlan
): Promise<{ error: string } | undefined> {
  // Defensa: validar que el plan es uno conocido (no confiar en el cliente).
  if (!PLAN_ORDER.includes(plan)) {
    return { error: "Plan inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // La agencia objetivo es la del usuario logueado, leída server-side.
  const { data: agent } = await supabase
    .from("agents")
    .select("agency_id")
    .eq("id", user.id)
    .single();
  if (!agent) redirect("/login");

  // La RLS de subscriptions no tiene policy de UPDATE para usuarios (la escritura
  // es service role). Usamos admin client, pero acotando el UPDATE a la agencia
  // del auth.uid() — el agency_id viene del agente logueado, no del cliente.
  // - free → 'active' al instante.
  // - plan pago → 'pending' (activación manual fuera de este flujo).
  // property_limit y has_* SIEMPRE de free: la agencia opera con cupo de free
  // hasta que la activación manual los actualice a los reales del plan.
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({
      plan,
      status: plan === "free" ? "active" : "pending",
      property_limit: PLANS.free.propertyLimit,
      has_featured: PLANS.free.featured,
      has_white_label: PLANS.free.whiteLabel,
      has_metrics: PLANS.free.metrics,
    })
    .eq("agency_id", agent.agency_id);

  if (error) return { error: "No se pudo guardar el plan. Intentá de nuevo." };

  redirect("/dashboard");
}
