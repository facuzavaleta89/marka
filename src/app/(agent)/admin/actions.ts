"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { PLANS, type SubscriptionPlan } from "@/types";

// Activa un plan pago que quedó en status 'pending'. v1: solo activar (no hay
// desactivar/downgrade). La corre el dueño de la plataforma desde /admin.
//
// SEGURIDAD: la verificación de identidad acá es OBLIGATORIA y es la defensa
// real — la UI no alcanza. Sin ADMIN_USER_ID definida, se deniega (nunca
// "si no hay env, permitir").
export async function activatePlanAction(
  agencyId: string
): Promise<{ error: string } | undefined> {
  if (typeof agencyId !== "string" || agencyId.trim() === "") {
    return { error: "Agencia inválida" };
  }

  const adminUserId = process.env.ADMIN_USER_ID;
  // Fail-closed: si la env no está, nadie es admin.
  if (!adminUserId) {
    return { error: "Acción no autorizada" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.id !== adminUserId) {
    return { error: "Acción no autorizada" };
  }

  // Lee el plan PEDIDO (pending_plan), que es lo que hay que activar.
  // Con admin client: la policy de SELECT de subscriptions es por agencia propia,
  // así que el dueño necesita service role para leer otra agencia.
  const admin = createAdminClient();
  const { data: sub, error: readError } = await admin
    .from("subscriptions")
    .select("pending_plan")
    .eq("agency_id", agencyId)
    .single();

  if (readError || !sub) {
    return { error: "No se encontró la suscripción de esa agencia" };
  }

  const pendingPlan = sub.pending_plan as SubscriptionPlan | null;

  // Sin pending_plan no hay nada que activar.
  if (!pendingPlan) {
    return { error: "Esa agencia no tiene un plan pendiente que activar" };
  }

  const planInfo = PLANS[pendingPlan];
  if (!planInfo || pendingPlan === "free") {
    return { error: "Plan pendiente inválido" };
  }

  // Activación: el plan pedido pasa a REGIR (plan = pending_plan) y recibe sus
  // límites/entitlements reales. Se limpia pending_plan y status vuelve a 'active'.
  // activated_at sella la fecha de esta activación. current_period_end NO se toca (V2).
  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      plan: pendingPlan,
      pending_plan: null,
      status: "active",
      property_limit: planInfo.propertyLimit,
      has_featured: planInfo.featured,
      has_white_label: planInfo.whiteLabel,
      has_metrics: planInfo.metrics,
      activated_at: new Date().toISOString(),
    })
    .eq("agency_id", agencyId);

  if (updateError) {
    return { error: "No se pudo activar el plan. Intentá de nuevo." };
  }

  // Sin redirect: el client refresca la lista (router.refresh()).
}
