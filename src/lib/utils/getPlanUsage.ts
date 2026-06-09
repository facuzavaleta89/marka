import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanUsage, SubscriptionPlan } from "@/types";
import { PLANS } from "@/types";

// Fila de suscripción que consultamos (subset de columnas).
type SubscriptionRow = {
  plan: SubscriptionPlan;
  property_limit: number;
  has_featured: boolean;
  has_white_label: boolean;
  has_metrics: boolean;
};

// Calcula el uso del plan de una agencia.
// IMPORTANTE: cuenta por agency_id (no por agent_id) para coincidir con el
// trigger check_property_limit, que valida el límite a nivel de agencia.
// Las propiedades 'sold'/'rented' no ocupan cupo.
// Los entitlements (featured/white-label/métricas) se leen de los booleanos de
// la suscripción —fuente de verdad—, no del nombre del plan.
// Devuelve el plan que RIGE (`plan`), nunca el pedido (`pending_plan`): el badge
// del sidebar, el dashboard y el bloqueo de "Nueva propiedad" usan esto, así que
// debe reflejar lo efectivo (free → límite 1) aunque haya un upgrade pendiente.
export async function getPlanUsage(
  supabase: SupabaseClient,
  agencyId: string
): Promise<PlanUsage> {
  const [{ data: sub }, { count }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, property_limit, has_featured, has_white_label, has_metrics")
      .eq("agency_id", agencyId)
      .single(),

    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .in("status", ["active", "paused"]),
  ]);

  const subscription = sub as SubscriptionRow | null;
  const used = count ?? 0;

  // Sin suscripción → default al plan free (límite y entitlements de PLANS.free).
  return {
    plan: subscription?.plan ?? "free",
    used,
    limit: subscription?.property_limit ?? PLANS.free.propertyLimit,
    canCreate: used < (subscription?.property_limit ?? PLANS.free.propertyLimit),
    hasFeatured: subscription?.has_featured ?? PLANS.free.featured,
    hasWhiteLabel: subscription?.has_white_label ?? PLANS.free.whiteLabel,
    hasMetrics: subscription?.has_metrics ?? PLANS.free.metrics,
  };
}
