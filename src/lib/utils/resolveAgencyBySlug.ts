import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, ApprovalStatus, City } from "@/types";

// Resolución de una agencia por su slug para la URL pública white-label
// (`marka.com.ar/[slug]`). Devuelve TRES estados deliberadamente distintos:
//
//   - not_found : no existe ninguna agencia con ese slug → la ruta hace 404 real.
//   - disabled  : la agencia existe pero NO está disponible al público, por
//                 cualquiera de TRES motivos independientes: la agencia todavía
//                 no está aprobada, su suscripción no tiene has_white_label
//                 (nunca lo tuvo, o bajó de plan), o la agencia no está
//                 públicamente visible (dejó de pagar) → "sitio no disponible".
//   - active    : aprobada, con white-label habilitado y al día → mapa filtrado
//                 a la agencia.
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
//
// ⚠ Y ESE SERVICE ROLE ES JUSTAMENTE POR QUÉ EL GATE DE PAGO HAY QUE ESCRIBIRLO
// ACÁ. Las policies de lectura pública de properties y property_images ya llaman
// a agency_is_publicly_visible(), así que el mapa y las fotos se apagan solos
// cuando una agencia deja de pagar. Pero el service role OMITE las policies: esta
// función no está cubierta por ninguna, y sin el chequeo explícito de abajo el
// sitio de marca quedaría en pie por su cuenta.

// Fila tal como la devuelve el embed de PostgREST. La relación agency→subscription
// es 1-a-1 (subscriptions.agency_id es UNIQUE) y agency→city es to-one (FK), pero
// el embed puede materializarse como objeto o como array de uno: lo normalizamos.
type AgencyRow = {
  id: string;
  name: string;
  city_id: string;
  logo_url: string | null;
  approval_status: ApprovalStatus;
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

// ¿La agencia está al día para mostrarse al público? (aprobada + suscripción
// activa + plan pago).
//
// SE PREGUNTA A LA BASE, NO SE REESCRIBE LA REGLA ACÁ. La condición vive en la
// función agency_is_publicly_visible() y las tres policies de lectura/escritura
// pública (properties, property_images, leads) la invocan. Repetir las mismas
// comparaciones en TypeScript sería tener la regla escrita dos veces: el día que
// cambie (por ejemplo, si un 'past_due' pasara a tener período de gracia), el
// mapa y el sitio de marca dirían cosas distintas y nadie se enteraría hasta que
// un cliente lo reportara. Se paga un viaje extra a la base a cambio de que la
// regla tenga UN solo lugar donde vive.
//
// FALLA CERRADA: si la llamada falla, se responde `false`. Ante la duda es mejor
// que un sitio que debería estar arriba quede abajo (se ve como una suscripción
// vencida, y el dueño de la agencia reclama) que al revés.
async function isAgencyPubliclyVisible(
  supabase: ReturnType<typeof createAdminClient>,
  agencyId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("agency_is_publicly_visible", {
    target_agency_id: agencyId,
  });

  if (error) return false;
  return data === true;
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
      "id, name, city_id, logo_url, approval_status, subscription:subscriptions(has_white_label), city:cities(*)"
    )
    .eq("slug", slug)
    .maybeSingle();

  // Sin fila (o error de lectura) → la agencia no existe para el público.
  if (error || !data) return { status: "not_found" };

  const row = data as unknown as AgencyRow;
  const subscription = firstOf(row.subscription);
  const city = firstOf(row.city);

  // TRES gates independientes, los tres con el mismo desenlace ('disabled'):
  //
  // 1. Gate de LEGITIMIDAD: la agencia tiene que estar aprobada. Se evalúa acá
  //    porque este helper es el único control de la vista pública de marca: sin
  //    esto, una agencia sin aprobar (o rechazada) que tuviera plan pago
  //    tendría su sitio público andando, mostrándose como inmobiliaria
  //    legítima. La aprobación es un eje independiente del plan, así que se
  //    chequea aparte, no dentro de la condición del flag.
  // 2. Gate de ENTITLEMENT: el booleano has_white_label es la fuente de verdad
  //    de "este plan incluye sitio de marca", nunca el nombre del plan. Sin
  //    ciudad tampoco hay mapa que centrar.
  // 3. Gate de PAGO: la agencia tiene que estar públicamente visible según la
  //    MISMA regla que usan las policies del mapa.
  //
  // ⚠ POR QUÉ EL GATE 3 NO ES REDUNDANTE CON EL 2, que es la trampa de todo
  // esto: has_white_label se escribe UNA vez, cuando el dueño activa el plan
  // desde /admin, y NADIE LO VUELVE A APAGAR NUNCA. No hay flujo que lo ponga en
  // false al vencer o cancelar una suscripción; el estado de la suscripción
  // (subscriptions.status) es un eje aparte. Sin el gate 3, una agencia que
  // dejara de pagar conservaría el flag y su sitio de marca seguiría en pie
  // —pero MOSTRANDO UN MAPA VACÍO, porque las policies ya le ocultan las
  // propiedades—. Un sitio que existe y no muestra nada parece un producto roto;
  // apagado parece una suscripción vencida, que es la verdad.
  //
  // Los gates 1 y 2 van primero por ser gratis (los datos ya están en `row`); el
  // 3 cuesta un viaje a la base, así que solo se paga cuando los otros dos pasan.
  // El 1 queda además cubierto por dentro del 3 (la función también exige la
  // aprobación): se lo conserva explícito para poder cortar antes del viaje.
  //
  // Se colapsan en 'disabled' a propósito: al visitante anónimo no se le cuenta
  // POR QUÉ no está disponible (no es asunto suyo si la agencia no pagó o no
  // está aprobada), y no hace falta un estado nuevo.
  if (row.approval_status !== "approved") {
    return { status: "disabled" };
  }
  if (subscription?.has_white_label !== true || !city) {
    return { status: "disabled" };
  }
  if (!(await isAgencyPubliclyVisible(supabase, row.id))) {
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
