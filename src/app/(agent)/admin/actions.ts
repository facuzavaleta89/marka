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

  // Lee el plan que la agencia eligió (el que quedó pending).
  // Con admin client: la policy de SELECT de subscriptions es por agencia propia,
  // así que el dueño necesita service role para leer otra agencia.
  const admin = createAdminClient();
  const { data: sub, error: readError } = await admin
    .from("subscriptions")
    .select("plan")
    .eq("agency_id", agencyId)
    .single();

  if (readError || !sub) {
    return { error: "No se encontró la suscripción de esa agencia" };
  }

  const plan = sub.plan as SubscriptionPlan;

  // Un 'free' no debería estar pending; si llega acá, no "activamos free".
  if (plan === "free") {
    return { error: "Esa agencia está en plan free, no hay nada que activar" };
  }

  const planInfo = PLANS[plan];
  if (!planInfo) {
    return { error: "Plan desconocido" };
  }

  // Activación: el plan pasa a 'active' y recibe sus límites/entitlements reales
  // (hasta ahora operaba con los de free). current_period_end NO se toca (V2).
  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      property_limit: planInfo.propertyLimit,
      has_featured: planInfo.featured,
      has_white_label: planInfo.whiteLabel,
      has_metrics: planInfo.metrics,
    })
    .eq("agency_id", agencyId);

  if (updateError) {
    return { error: "No se pudo activar el plan. Intentá de nuevo." };
  }

  // Sin redirect: el client refresca la lista (router.refresh()).
}
