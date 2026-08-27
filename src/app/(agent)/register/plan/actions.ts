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
  // Defensa: el plan tiene que ser uno conocido Y ofrecible. 'free' ya no es
  // una opción de esta pantalla: no es un producto sino el estado de aterrizaje
  // en el que la agencia YA está (elegirlo sería un no-op que además pisaría
  // límites). No confiar en el cliente.
  if (!PLAN_ORDER.includes(plan) || plan === "free") {
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

  // GUARDA DE REENTRADA (misma condición que page.tsx, repetida acá porque una
  // server action se puede invocar sin pasar por la página). Este paso solo
  // aplica a un alta virgen: rige free, sin plan pedido, activa. Si la agencia
  // ya tiene un plan pago activo o un pedido pendiente, esta escritura la
  // degradaría a free (perdiendo entitlements y dejándola sobre el límite), así
  // que se rechaza sin escribir nada y se la deriva a /dashboard/suscripcion,
  // que es la pantalla correcta para cambiar de plan.
  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("plan, pending_plan, status")
    .eq("agency_id", agent.agency_id)
    .single();

  const isPristineLanding =
    subscription != null &&
    subscription.plan === "free" &&
    subscription.pending_plan === null &&
    subscription.status === "active";

  if (!isPristineLanding) {
    return {
      error:
        "Tu cuenta ya tiene un plan definido. Cambialo desde Suscripción, en tu panel.",
    };
  }

  // La RLS de subscriptions no tiene policy de UPDATE para usuarios (la escritura
  // es service role). Usamos admin client, pero acotando el UPDATE a la agencia
  // del auth.uid() — el agency_id viene del agente logueado, no del cliente.
  // El plan que RIGE sigue siendo 'free' (estado de aterrizaje); lo elegido va a
  // pending_plan con status 'pending' hasta la activación manual del admin.
  // property_limit y has_* SIEMPRE de free: la agencia opera con cupo de free
  // hasta que la activación copie pending_plan a plan con los valores reales.
  const { error } = await admin
    .from("subscriptions")
    .update({
      plan: "free",
      pending_plan: plan,
      status: "pending",
      property_limit: PLANS.free.propertyLimit,
      has_featured: PLANS.free.featured,
      has_white_label: PLANS.free.whiteLabel,
      has_metrics: PLANS.free.metrics,
    })
    .eq("agency_id", agent.agency_id);

  if (error) return { error: "No se pudo guardar el plan. Intentá de nuevo." };

  redirect("/dashboard");
}
