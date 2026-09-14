import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyBase } from "./generateSlug";
import { isReservedSlug } from "./reservedSlugs";

// ─── La dirección del sitio de marca de una agencia ───────────
//
// Este módulo es el único lugar donde vive TODO lo que tiene que ver con
// `agencies.slug`: la forma válida, la normalización, la validación y la
// generación automática del registro. Lo consumen los DOS caminos que producen
// un slug —el alta (register/actions.ts) y la edición desde Preferencias
// (dashboard/preferencias/actions.ts)—, para que no puedan divergir.
//
// ══════════════════════════════════════════════════════════════
// LA RESTRICCIÓN REAL DE LA BASE, MEDIDA (no asumida)
// ══════════════════════════════════════════════════════════════
//
//   information_schema.columns → slug: text, NOT NULL, sin default,
//                                character_maximum_length: null
//   pg_constraint              → agencies_slug_key UNIQUE (slug)
//
// O sea: la base garantiza la UNICIDAD y nada más. No hay ningún CHECK de forma
// y no hay longitud máxima — acepta `"Hola Mundo!!"`, `"  "` o una cadena de
// 10.000 caracteres sin una queja. **Toda la validación de forma vive en el
// código**, y por eso la barrera que cuenta es la server action, nunca el
// formulario.
//
// ⚠ Y LA UNICIDAD ES GLOBAL, NO POR CIUDAD. Es distinto de la matrícula, cuyo
// índice sí es `(city_id, license_number)`. Tiene que ser global porque la
// dirección es global: `marka.com.ar/lopez` es una sola en todo el dominio, no
// una por ciudad. Dos inmobiliarias homónimas de ciudades distintas compiten por
// el mismo valor, y la primera que llega se lo queda.

/**
 * Largo mínimo. Tres caracteres es el piso para no entregar el espacio de
 * nombres de una y dos letras, que es chico, irrepetible y el primero que se
 * agota.
 */
export const AGENCY_SLUG_MIN_LENGTH = 3;

/**
 * Largo máximo. La base no impone ninguno, así que éste es el único.
 * Cuarenta deja holgura sobre los valores reales —el más largo medido es
 * `inmobiliaria-gaio-2`, 19 caracteres— y sigue siendo una dirección que una
 * persona puede dictar por teléfono, que es para lo que existe.
 */
export const AGENCY_SLUG_MAX_LENGTH = 40;

/**
 * Forma válida de una dirección.
 *
 * Es el mismo resultado que produce `slugifyBase`, escrito como patrón:
 * minúsculas, dígitos y guiones; sin guiones al principio ni al final, y sin
 * guiones consecutivos. Coherencia deliberada — lo que genera el registro tiene
 * que ser exactamente lo que acepta la edición, o el alta produciría direcciones
 * que su propio formulario rechazaría.
 */
export const AGENCY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Fallback cuando no queda nada utilizable del nombre (ej.: solo símbolos). */
const FALLBACK_BASE = "agencia";

/**
 * Lleva un texto cualquiera a la forma de una dirección.
 *
 * Reusa `slugifyBase` (normaliza acentos, baja a minúsculas, arma los guiones) y
 * le agrega lo que hace falta para respetar el largo máximo:
 *
 *   1. corta a `AGENCY_SLUG_MAX_LENGTH`;
 *   2. ⚠ vuelve a limpiar los bordes DESPUÉS de cortar. El corte puede dejar un
 *      guión colgando al final (`"inmobiliaria-lopez-y-"`), que es una forma
 *      inválida producida por la propia normalización.
 *
 * Puede devolver cadena vacía: es responsabilidad del llamador decidir qué hacer
 * con eso (el alta cae al fallback, la edición rechaza).
 */
export function normalizeAgencySlug(input: string): string {
  const base = slugifyBase(input);
  if (base.length <= AGENCY_SLUG_MAX_LENGTH) return base;
  return base.slice(0, AGENCY_SLUG_MAX_LENGTH).replace(/^-|-$/g, "");
}

export type SlugValidation = { ok: true } | { ok: false; error: string };

/**
 * ¿Esta dirección se puede usar? Valida FORMA y LISTA NEGRA — todo lo que se
 * puede saber sin consultar la base. La unicidad va aparte (`isAgencySlugTaken`)
 * porque cuesta un viaje.
 *
 * Recibe un slug YA normalizado. Los mensajes son los que ve la persona: dicen
 * qué falló y cómo se arregla (DESIGN §10), sin retar a nadie.
 */
export function validateAgencySlug(slug: string): SlugValidation {
  if (slug.length === 0) {
    return {
      ok: false,
      error:
        "Escribí una dirección. Puede tener letras, números y guiones: por ejemplo, inmobiliaria-lopez.",
    };
  }

  if (slug.length < AGENCY_SLUG_MIN_LENGTH) {
    return {
      ok: false,
      error: `La dirección es muy corta: necesita al menos ${AGENCY_SLUG_MIN_LENGTH} caracteres.`,
    };
  }

  if (slug.length > AGENCY_SLUG_MAX_LENGTH) {
    return {
      ok: false,
      error: `La dirección es muy larga: puede tener hasta ${AGENCY_SLUG_MAX_LENGTH} caracteres.`,
    };
  }

  if (!AGENCY_SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error:
        "La dirección solo puede tener letras minúsculas, números y guiones, y no puede empezar ni terminar con un guión.",
    };
  }

  // ⚠ La lista negra va DESPUÉS de la forma, a propósito: si alguien escribe
  // "Admin!!!", el problema que hay que contarle no es que esté reservada —que
  // también— sino que ese texto ni siquiera es una dirección. El motivo más
  // básico primero, igual que el reparto de `getPublishBlock`.
  if (isReservedSlug(slug)) {
    return {
      ok: false,
      error:
        "Esa dirección está reservada por la plataforma. Probá con otra: por ejemplo, sumale el nombre de tu inmobiliaria.",
    };
  }

  return { ok: true };
}

/**
 * ¿Ya hay otra agencia con esta dirección?
 *
 * `excludeAgencyId` deja fuera a la agencia que está editando, para que volver a
 * guardar su propia dirección no choque consigo misma — el bug clásico de una
 * validación de unicidad al editar, que no existe al crear.
 *
 * ⚠ NO ES UNA GARANTÍA, ES UN PRE-CHEQUEO. Entre este SELECT y el UPDATE hay una
 * ventana en la que otra agencia puede tomar el mismo valor. La garantía es el
 * UNIQUE de la base; el llamador tiene que traducir el 23505 igual (ver
 * `translateAgencySlugWriteError` en preferencias/actions.ts).
 */
export async function isAgencySlugTaken(
  supabase: SupabaseClient,
  slug: string,
  excludeAgencyId?: string
): Promise<boolean> {
  let query = supabase.from("agencies").select("id").eq("slug", slug);
  if (excludeAgencyId) query = query.neq("id", excludeAgencyId);

  const { data } = await query.maybeSingle();
  return Boolean(data);
}

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
//
// ══════════════════════════════════════════════════════════════
// ⚠ LA LISTA NEGRA TAMBIÉN SE APLICA ACÁ, Y NUNCA PUEDE FRENAR UN ALTA
// ══════════════════════════════════════════════════════════════
//
// Una inmobiliaria que se llame "Agencia" o "Contacto Propiedades" produce un
// slug reservado sin haber hecho nada raro. Ese caso NO puede devolver un error:
// el registro tiene que completarse igual, porque la dirección es un detalle del
// alta y no su motivo.
//
// Se resuelve con EL MISMO MECANISMO que ya usaba esta función para las
// colisiones entre agencias: un candidato reservado se trata exactamente igual
// que uno ocupado —se descarta y se prueba el siguiente número—. Así
// "Agencia" no falla: le toca `agencia-2`. No hay una rama nueva ni un camino de
// error nuevo; hay una condición más en el mismo `continue`.
//
// ⚠ Y por eso el FALLBACK de un nombre vacío (`agencia`) está él mismo en la
// lista negra sin que eso sea un problema: entra al bucle como cualquier
// candidato, se descarta en la primera vuelta y sale `agencia-2`. Es deliberado
// —reservar `/agencia` es valioso— y no hace falta ninguna excepción para él.
export async function generateUniqueAgencySlug(
  supabase: SupabaseClient,
  name: string
): Promise<string> {
  // Fallback "agencia" si el nombre queda vacío al limpiar (ej. solo símbolos).
  // ⚠ `normalizeAgencySlug` además CORTA al largo máximo: sin esto, una razón
  // social larga produciría una dirección que el formulario de edición después
  // rechazaría por larga. El alta no puede generar lo que la edición no acepta.
  const normalized = normalizeAgencySlug(name);
  const base =
    normalized.length >= AGENCY_SLUG_MIN_LENGTH ? normalized : FALLBACK_BASE;

  // Probamos base, base-2, base-3, … hasta encontrar uno libre. Límite por las
  // dudas (no debería acercarse nunca con nombres reales).
  for (let n = 1; n <= 100; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;

    // Reservada → se trata como ocupada. Misma vía que la colisión entre
    // agencias: se descarta el candidato y se prueba el siguiente.
    if (isReservedSlug(candidate)) continue;

    // El sufijo puede empujar el candidato por encima del largo máximo cuando la
    // base ya estaba al tope. También se descarta: el `slice` de abajo cubre el
    // caso extremo de que TODOS los números queden largos.
    if (candidate.length > AGENCY_SLUG_MAX_LENGTH) continue;

    const { data } = await supabase
      .from("agencies")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate; // libre
  }

  // Caso extremo (100 colisiones del mismo nombre): caemos a un sufijo aleatorio
  // para no fallar. El reintento ante 23505 del call site cubre el resto.
  // El `slice` de la base garantiza que el resultado entre en el largo máximo
  // incluso si la base venía al tope (7 = longitud de "-" + 6 caracteres).
  const suffix = Math.random().toString(36).slice(2, 8);
  const room = AGENCY_SLUG_MAX_LENGTH - suffix.length - 1;
  const trimmedBase = base.slice(0, room).replace(/^-|-$/g, "") || FALLBACK_BASE;
  return `${trimmedBase}-${suffix}`;
}
