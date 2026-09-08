import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Property, PropertyImage } from "@/types";

// Resolución de una propiedad por su slug para la URL pública
// (`marka.com.ar/propiedades/[slug]`). Mismo rol —y misma forma— que
// `resolveAgencyBySlug` para el sitio de marca: TODA la lógica de decidir si una
// propiedad se puede mostrar vive acá, no en la página.
//
// Devuelve TRES estados deliberadamente distintos:
//
//   - not_found   : no existe ninguna propiedad con ese slug → la ruta hace 404 real.
//   - unavailable : existe pero no se puede mostrar (no está activa, o su agencia
//                   no está al día) → página propia "no disponible".
//   - available   : se puede mostrar → la página completa.
//
// ⚠ NO COLAPSAR `unavailable` EN `not_found`. Un 404 le diría a quien recibió el
// enlace por WhatsApp que el enlace estaba roto —y no lo está: la propiedad
// existió y puede volver—. Es exactamente el mismo criterio por el que
// `resolveAgencyBySlug` no colapsa su `disabled`.
//
// ══════════════════════════════════════════════════════════════
// POR QUÉ SERVICE ROLE Y NO EL CLIENT DE SERVIDOR CON SESIÓN
// ══════════════════════════════════════════════════════════════
//
// Dos motivos, los dos medidos contra la base, y los dos hacen imposible la
// alternativa (no la vuelven "menos linda"):
//
// 1. LOS TRES ESTADOS SERÍAN INDISTINGUIBLES. La policy `Public read active
//    properties` es una sola condición —`status = 'active' AND
//    agency_is_publicly_visible(agency_id)`—, así que una propiedad pausada,
//    una de agencia que no paga y un slug inexistente devuelven LOS TRES la
//    lista vacía. Verificado contra la API con la anon key. Con eso, la página
//    solo podría hacer 404, que es justo lo que el estado `unavailable` existe
//    para evitar.
//
// 2. EL RESULTADO DEPENDERÍA DE QUIÉN MIRE. Sobre `properties` hay TRES policies
//    de SELECT, las tres PERMISSIVE, y las permissive se combinan con OR:
//      · Public read active properties      → status activo + agencia al día
//      · Agency members read agency properties → agency_id de mi agencia
//      · Agent manages own properties (ALL) → agent_id = auth.uid()
//    O sea que un agente logueado de esa agencia entraría por la segunda y
//    vería PUBLICADA una propiedad que para el resto del mundo no lo está. La
//    página le mentiría sobre su propio estado justo a quien la administra — y
//    es el caso más probable de todos: el agente que acaba de pausar una
//    propiedad y abre su enlace para ver cómo quedó.
//
// Con service role el resultado es idéntico para todos: visitante anónimo,
// buscador y el propio agente. Que es lo que una página pública debe hacer.
//
// ⚠ Y EL PRECIO DE ESE SERVICE ROLE ES QUE LA REGLA DE COBRO HAY QUE INVOCARLA A
// MANO: saltea las policies, así que ninguna de las tres la aplica acá. Sin la
// llamada de `isAgencyPubliclyVisible` esta página quedaría en pie mostrando las
// propiedades de agencias que dejaron de pagar. Es el mismo riesgo, con la misma
// mitigación, que documenta `resolveAgencyBySlug`.

// Columnas de la agencia y del agente que la página necesita. Se nombran una por
// una y NO se piden con `*`:
//   · `agencies` tiene la policy `Public read agencies` con `qual: true` — pero
//     acá ni siquiera eso importa, porque el service role no pasa por policies:
//     lo único que acota qué se lee es esta lista. Ahí viven `phone_wa`,
//     `license_number` y `approval_status`.
//   · de `agents` se pide lo mínimo para contactar y para decir quién atiende.
//     `avatar_url` NO se pide: la página no muestra la foto del agente, igual
//     que el modal.
const PUBLIC_PROPERTY_SELECT =
  "*, images:property_images(id, property_id, url, is_cover, sort_order, created_at), agent:agents(full_name, phone_wa), agency:agencies(name, logo_url)";

export interface PublicPropertyAgent {
  full_name: string;
  phone_wa: string;
}

export interface PublicPropertyAgency {
  name: string;
  logo_url: string | null;
}

// ⚠ SE REEMPLAZAN LAS TRES RELACIONES DE `Property` CON EL SUBCONJUNTO REAL, en
// vez de heredarlas. `Property` las declara como `Agent` y `Agency` COMPLETOS
// (doce columnas la agencia), pero el select de arriba trae dos de cada una. Sin
// este `Omit`, leer `property.agency.license_number` compilaría sin una queja y
// daría `undefined` en runtime — el mismo defecto que el cast local del modal
// existe para evitar. Acá además se aprovecha para volverlas NO opcionales
// (`| null` en vez de `?`), porque la resolución garantiza que el embed vino.
export type PublicProperty = Omit<Property, "images" | "agent" | "agency"> & {
  /** Ya ordenadas por `sort_order`: la portada primero. */
  images: PropertyImage[];
  agent: PublicPropertyAgent | null;
  agency: PublicPropertyAgency | null;
};

export type PropertyResolution =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "available"; property: PublicProperty };

// Fila tal como la devuelve el embed. PostgREST puede materializar una relación
// to-one como objeto o como array de uno: se normaliza igual que en
// `resolveAgencyBySlug`.
type PropertyRow = Omit<Property, "images" | "agent" | "agency"> & {
  images: PropertyImage[] | null;
  agent: PublicPropertyAgent | PublicPropertyAgent[] | null;
  agency: PublicPropertyAgency | PublicPropertyAgency[] | null;
};

function firstOf<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

// ¿La agencia está al día para mostrarse al público? (aprobada + suscripción
// activa + plan pago).
//
// ⚠ SE PREGUNTA A LA BASE POR RPC, NO SE REESCRIBE LA REGLA ACÁ. La condición
// vive en `agency_is_publicly_visible()` y la invocan las tres policies públicas
// (properties, property_images, leads) más `resolveAgencyBySlug`. Replicar las
// comparaciones en TypeScript dejaría LA REGLA DE COBRO ESCRITA EN TRES LUGARES:
// el día que cambie —por ejemplo, si un `past_due` pasara a tener período de
// gracia— el mapa, el sitio de marca y esta página dirían cosas distintas, y
// nadie se enteraría hasta que un cliente lo reportara. Se paga un viaje extra a
// la base a cambio de que la regla tenga UN solo lugar donde vive.
//
// FALLA CERRADA: si la llamada falla, se responde `false`.
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

// Envuelto en `cache()` de React (mismo patrón que `resolveAgentSession`): la
// ruta lo llama DOS veces por request —una en `generateMetadata` y otra en el
// componente de la página— y sin esto serían dos consultas y dos RPC. `cache()`
// desduplica por argumento dentro del mismo render, así que se paga una sola vez.
// Por eso tampoco recibe el client por parámetro: lo crea adentro, o un client
// distinto por llamador rompería la deduplicación.
export const resolvePropertyBySlug = cache(
  async (slug: string): Promise<PropertyResolution> => {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("properties")
      .select(PUBLIC_PROPERTY_SELECT)
      .eq("slug", slug)
      .maybeSingle();

    // ⚠ ACÁ SE SEPARA DE `resolveAgencyBySlug` A PROPÓSITO, y la diferencia es
    // load-bearing. Aquel hace `if (error || !data) return not_found`: mete el
    // error de lectura en la misma rama que "no existe". Acá NO se puede, porque
    // los dos desenlaces son distintos y la regla es FALLA CERRADA:
    //   · error de lectura → `unavailable`. No sabemos si existe ni si está al
    //     día, y ante la duda la propiedad queda oculta: si debería verse, la
    //     agencia reclama; al revés, mostraríamos algo que quizá no se puede
    //     mostrar y no se entera nadie.
    //   · sin fila → `not_found`. Acá sí sabemos: la base respondió y no hay
    //     ninguna propiedad con ese slug.
    if (error) return { status: "unavailable" };
    if (!data) return { status: "not_found" };

    const row = data as unknown as PropertyRow;

    // Gate 1 — la propiedad tiene que estar publicada. Es gratis (el dato ya
    // está en la fila), así que va antes del viaje a la base del gate 2.
    if (row.status !== "active") return { status: "unavailable" };

    // Gate 2 — la agencia tiene que estar al día. Es LA REGLA DE COBRO: sin
    // esto, las propiedades de una agencia que dejó de pagar desaparecerían del
    // mapa (las policies ya lo hacen) pero seguirían accesibles por su enlace
    // propio, y encima ofrecidas a los buscadores.
    if (!(await isAgencyPubliclyVisible(supabase, row.agency_id))) {
      return { status: "unavailable" };
    }

    return {
      status: "available",
      property: {
        ...row,
        // Ordenadas una sola vez, acá: así la página y la vista previa del
        // enlace coinciden en cuál es la portada sin repetir el criterio.
        images: (row.images ?? []).sort((a, b) => a.sort_order - b.sort_order),
        agent: firstOf(row.agent),
        agency: firstOf(row.agency),
      },
    };
  }
);

// La foto de portada: la marcada como tal, y si ninguna lo está, la primera.
// Vive acá y no en la página porque la usan DOS consumidores que tienen que
// elegir la misma imagen: la galería y la vista previa del enlace compartido.
export function getCoverImage(
  images: PropertyImage[]
): PropertyImage | undefined {
  return images.find((i) => i.is_cover) ?? images[0];
}
