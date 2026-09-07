import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanUsage, SubscriptionPlan, SubscriptionStatus } from "@/types";
import { PLANS } from "@/types";

// Cupo de una agencia SIN fila de suscripción. Réplica exacta del
// `IF max_allowed IS NULL THEN max_allowed := 0` de check_property_limit():
// no es "el plan más chico", es "no hay plan".
const NO_SUBSCRIPTION_LIMIT = 0;

// Fila de suscripción que consultamos (subset de columnas).
type SubscriptionRow = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
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
      .select("plan, status, property_limit, has_featured, has_white_label, has_metrics")
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
  // Límite efectivo. Se resuelve una sola vez para derivar available/over de
  // forma consistente.
  //
  // ⚠ SIN FILA EL LÍMITE ES 0, NO EL DE FREE, PORQUE ESO ES LO QUE HACE LA BASE.
  // `check_property_limit()` hace `SELECT property_limit INTO max_allowed` y
  // después `IF max_allowed IS NULL THEN max_allowed := 0`. Este helper es el
  // ESPEJO de ese trigger, así que tiene que decir lo mismo.
  //
  // Antes caía a PLANS.free.propertyLimit (= 1) y la divergencia era un bug
  // medido: la interfaz habilitaba el botón "Nueva propiedad", la ruta
  // /dashboard/propiedades/nueva dejaba pasar, el agente llenaba el formulario
  // entero, y el rechazo llegaba recién al guardar —del trigger, con "máximo:
  // 0"— traducido a "alcanzaste el límite de tu plan", que era falso: no había
  // alcanzado ningún límite, le faltaba una fila.
  //
  // Desde el trigger `trg_ensure_agency_subscription` (AFTER INSERT ON agencies)
  // el caso no se produce por ningún camino de alta. Esto queda igual: el espejo
  // no puede prometer lo que la base va a rechazar si alguna vez alguien borra
  // una fila a mano.
  const limit = subscription?.property_limit ?? NO_SUBSCRIPTION_LIMIT;

  // available/over saneados en un único lugar: ningún consumidor vuelve a restar
  // limit - used suelto (eso era el footgun que dejaba pasar negativos).
  const available = Math.max(0, limit - used); // cupos libres, nunca negativo
  const over = Math.max(0, used - limit);      // excedente sobre el límite, 0 si dentro

  // Sin suscripción: el LÍMITE es 0 (arriba, espejo del trigger) y el resto cae
  // a los valores de free, que son los mismos que los DEFAULT de la tabla.
  return {
    plan: subscription?.plan ?? "free",
    // Sin fila de suscripción se reporta 'active' a propósito: el bloqueo lo da
    // el límite 0 de arriba, y declararla inactiva cambiaría el motivo que se le
    // muestra al agente ('subscription_inactive' en vez de 'plan_limit') sin que
    // su situación lo justifique — no la dieron de baja, le falta una fila.
    //
    // ⚠ Este comentario decía "ese caso ya lo bloquea el límite 0" cuando el
    // límite que este archivo calculaba era 1. Era falso, y era justamente el
    // comentario que hacía parecer cubierto el caso que nadie cubría.
    status: subscription?.status ?? "active",
    used,
    limit,
    available,
    over,
    canCreate: used < limit,
    hasFeatured: subscription?.has_featured ?? PLANS.free.featured,
    hasWhiteLabel: subscription?.has_white_label ?? PLANS.free.whiteLabel,
    hasMetrics: subscription?.has_metrics ?? PLANS.free.metrics,
  };
}
