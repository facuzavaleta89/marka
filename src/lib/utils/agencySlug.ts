import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyBase } from "./generateSlug";

// Genera un slug LIMPIO y único para una agencia (sin sufijo aleatorio): de cara
// a white-label, que usa el slug en la URL pública de la agencia. Resuelve
// colisiones con sufijo numérico incremental (-2, -3, …), chequeando contra
// agencies.slug.
//
// Necesita acceso a la base, por eso recibe un client (el admin/service role del
// registro). IMPORTANTE: el pre-chequeo NO es atómico — entre el SELECT y el
// INSERT otro registro podría tomar el mismo slug. El UNIQUE de agencies.slug es
// la garantía final; el call site debe reintentar ante una violación 23505 (ver
// register/actions.ts). Esta función solo reduce la probabilidad de llegar ahí.
export async function generateUniqueAgencySlug(
  supabase: SupabaseClient,
  name: string
): Promise<string> {
  // Fallback "agencia" si el nombre queda vacío al limpiar (ej. solo símbolos).
  const base = slugifyBase(name) || "agencia";

  // Probamos base, base-2, base-3, … hasta encontrar uno libre. Límite por las
  // dudas (no debería acercarse nunca con nombres reales).
  for (let n = 1; n <= 100; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const { data } = await supabase
      .from("agencies")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate; // libre
  }

  // Caso extremo (100 colisiones del mismo nombre): caemos a un sufijo aleatorio
  // para no fallar. El reintento ante 23505 del call site cubre el resto.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
