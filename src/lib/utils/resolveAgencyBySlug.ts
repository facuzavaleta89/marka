import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, City } from "@/types";

// Resolución de una agencia por su slug para la URL pública white-label
// (`marka.com.ar/[slug]`). Devuelve TRES estados deliberadamente distintos:
//
//   - not_found : no existe ninguna agencia con ese slug → la ruta hace 404 real.
//   - disabled  : la agencia existe pero su suscripción NO tiene has_white_label
//                 (nunca lo tuvo, o bajó de plan) → página de "sitio no disponible".
//   - active    : existe y tiene white-label habilitado → mapa filtrado a la agencia.
//
// No colapsar disabled en not_found: son páginas distintas (un 404 vs un estado).
//
// POR QUÉ SERVICE ROLE (y no el client público de @/lib/supabase/server):
// la visita a la URL white-label es anónima (sin sesión). La policy RLS de
// subscriptions ("Agency members read own subscription") solo deja leer la
// suscripción a los agentes de esa agencia, así que un visitante anónimo NO puede
// leer has_white_label: la query volvería null y TODA agencia parecería 'disabled'.
// Para leer el flag hace falta omitir esa RLS → admin client. La lectura es de
// solo unos pocos campos no sensibles (id, name, city_id, logo_url, el flag, y el
// centro de la ciudad para el mapa); nunca llega al cliente (función server-only).
// No se tocó ninguna policy (decisión de la pieza).

// Fila tal como la devuelve el embed de PostgREST. La relación agency→subscription
// es 1-a-1 (subscriptions.agency_id es UNIQUE) y agency→city es to-one (FK), pero
// el embed puede materializarse como objeto o como array de uno: lo normalizamos.
type AgencyRow = {
  id: string;
  name: string;
  city_id: string;
  logo_url: string | null;
  subscription:
    | { has_white_label: boolean }
    | { has_white_label: boolean }[]
    | null;
  city: City | City[] | null;
};

export type AgencyResolution =
  | { status: "not_found" }
  | { status: "disabled" }
  | {
      status: "active";
      agency: Pick<Agency, "id" | "name" | "city_id" | "logo_url">;
      // City completa: la ruta la usa para centrar el mapa (center_lat/lng/zoom)
      // y la lista mobile la consume entera (city.name, city.id).
      city: City;
    };

// Normaliza un embed que PostgREST puede devolver como objeto o array de uno.
function firstOf<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function resolveAgencyBySlug(
  slug: string
): Promise<AgencyResolution> {
  const supabase = createAdminClient();

  // Una sola query con embeds: agencia + su suscripción (flag) + su ciudad (centro
  // del mapa). Decisión join (1 round trip) vs dos/tres queries: como igual hace
  // falta el service role para leer el flag, embeber agencia+subscription+city en
  // un solo viaje es lo más simple y atómico (evita awaits secuenciales).
  const { data, error } = await supabase
    .from("agencies")
    .select(
      "id, name, city_id, logo_url, subscription:subscriptions(has_white_label), city:cities(*)"
    )
    .eq("slug", slug)
    .maybeSingle();

  // Sin fila (o error de lectura) → la agencia no existe para el público.
  if (error || !data) return { status: "not_found" };

  const row = data as unknown as AgencyRow;
  const subscription = firstOf(row.subscription);
  const city = firstOf(row.city);

  // Gate de plan: el flag es la fuente de verdad (no el nombre del plan). Sin flag,
  // o sin ciudad para centrar el mapa, la URL existe pero no está disponible.
  if (subscription?.has_white_label !== true || !city) {
    return { status: "disabled" };
  }

  return {
    status: "active",
    agency: {
      id: row.id,
      name: row.name,
      city_id: row.city_id,
      logo_url: row.logo_url,
    },
    city,
  };
}
