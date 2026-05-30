import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanUsage } from "@/types";

// Calcula el uso del plan de una agencia.
// IMPORTANTE: cuenta por agency_id (no por agent_id) para coincidir con el
// trigger check_property_limit, que valida el límite a nivel de agencia.
// Las propiedades 'sold'/'rented' no ocupan cupo.
export async function getPlanUsage(
  supabase: SupabaseClient,
  agencyId: string
): Promise<PlanUsage> {
  const [{ data: subscription }, { count }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, property_limit")
      .eq("agency_id", agencyId)
      .single(),

    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .in("status", ["active", "paused"]),
  ]);

  const used = count ?? 0;
  const limit = subscription?.property_limit ?? 5;

  return {
    plan: (subscription?.plan ?? "free") as PlanUsage["plan"],
    used,
    limit,
    canCreate: used < limit,
  };
}
