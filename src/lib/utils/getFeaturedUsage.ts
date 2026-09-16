import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeaturedUsage } from "@/types";

// Uso del cupo de propiedades destacadas de UNA agencia. Solo server.
//
// ⚠ EL CONTEO TIENE QUE SER EL MISMO QUE EL DE LA BASE. El trigger
// trg_featured_quota (enforce_featured_quota) cuenta
//   `WHERE agency_id = ... AND is_featured`
// sin mirar status ni agente: TODAS las destacadas de la agencia. Contar distinto
// acá haría que la interfaz ofreciera encender una destacada que la base rechaza,
// o al revés. (Vendidas y alquiladas nunca están destacadas: la base les apaga la
// estrella, así que no hace falta excluirlas.)
//
// ⚠ Con el client de SESIÓN, las lecturas pasan por la RLS: un agente de la
// agencia lee todas sus propiedades (policy "Agency members read agency
// properties") y su suscripción ("Agency members read own subscription"), así
// que el número coincide. Con service role también.
//
// Sin fila de suscripción el cupo es 0, igual que el `coalesce(v_limit, 0)` del
// trigger.
export async function getFeaturedUsage(
  supabase: SupabaseClient,
  agencyId: string
): Promise<FeaturedUsage> {
  const [{ data: sub }, { count }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("featured_limit")
      .eq("agency_id", agencyId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("is_featured", true),
  ]);

  const limit = (sub as { featured_limit: number } | null)?.featured_limit ?? 0;
  const used = count ?? 0;
  return { limit, used, available: Math.max(0, limit - used) };
}
