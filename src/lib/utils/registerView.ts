import { createClient } from "@/lib/supabase/client";

// ─── Registro de una visita a una propiedad ───────────────────
//
// Suma 1 a `properties.views_count` llamando a la función de la base
// `increment_views(property_id uuid)` (SECURITY DEFINER, devuelve void; `anon` y
// `authenticated` tienen EXECUTE — medido el 14 sep 2026).
//
// ⚠ EL NOMBRE DEL PARÁMETRO ES `property_id`, LITERAL. La otra RPC del proyecto
// (`agency_is_publicly_visible`) usa `target_agency_id`: copiar ese molde
// (`target_property_id`) o escribir `propertyId` compila perfecto y falla en
// CADA apertura, con un error que solo se ve en la consola.
//
// QUIÉN LA LLAMA — siempre DESPUÉS de `markVisited` y solo si devolvió `true`
// (propiedad nueva para este visitante). Tres lugares:
//   · ClusterLayer — click en un pin del mapa;
//   · PropertyList — toque en una tarjeta de la lista de celular;
//   · PropertyViewTracker — primera interacción real en la ficha pública.
// NUNCA en el render del servidor: la ficha la visitan los buscadores.
//
// ⚠ NUNCA LANZA Y NUNCA MUESTRA NADA. Es una métrica para la agencia, no una
// función del visitante: un fallo acá no puede producir un cartel ni bloquear
// nada. Queda en la consola y listo. Por eso no es async ni se espera: el
// llamador sigue de largo, y marcar la propiedad como vista (el tono del pin)
// ya ocurrió antes y no depende de que la base responda.
export function registerView(propertyId: string): void {
  const supabase = createClient();

  void supabase.rpc("increment_views", { property_id: propertyId }).then(
    ({ error }) => {
      if (error) {
        console.error("[registerView] No se pudo registrar la visita:", error.message);
      }
    },
    (reason: unknown) => {
      console.error("[registerView] No se pudo registrar la visita:", reason);
    }
  );
}
