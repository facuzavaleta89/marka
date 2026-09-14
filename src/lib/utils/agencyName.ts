// ─── La razón social de la agencia ────────────────────────────
//
// Reglas de forma del nombre de una inmobiliaria, compartidas por el formulario
// de Preferencias y por la server action que escribe la columna. Mismo molde que
// `licenseNumber.ts`: el cliente valida para dar feedback, el servidor valida de
// nuevo porque es la única barrera real.
//
// ══════════════════════════════════════════════════════════════
// LO QUE LA BASE IMPONE, MEDIDO (y es muy poco)
// ══════════════════════════════════════════════════════════════
//
//   information_schema.columns → name: text, NOT NULL,
//                                character_maximum_length: null
//   pg_constraint sobre agencies → agencies_pkey, agencies_slug_key (UNIQUE slug),
//     agencies_city_id_fkey, agencies_approval_status_check,
//     agencies_tenant_type_check
//
// O sea: `NOT NULL` y NADA MÁS. Sin largo máximo, sin CHECK de forma, y —el dato
// que más importa— **SIN UNICIDAD**. El único UNIQUE de la tabla es el del
// `slug`, no el del nombre.
//
// ⚠ POR ESO ACÁ NO SE VERIFICA QUE EL NOMBRE NO ESTÉ REPETIDO, y no es un olvido:
// dos inmobiliarias PUEDEN llamarse igual en la base. Inventar la restricción en
// el código sería peor que no tenerla — rechazaría altas legítimas (dos "López"
// de ciudades distintas) con un error que ninguna regla respalda, y encima no
// sería una garantía: sin índice único, dos pedidos simultáneos entrarían igual.
// Quien decida que el nombre debe ser único, que lo decida en la base primero.
//
// Lo que sí hace falta es un largo: la columna no tiene techo, así que sin esto
// entra una cadena de 10.000 caracteres que después rompe el sidebar, el panel y
// el encabezado del sitio de marca.

/**
 * Largo mínimo. Dos caracteres: hay razones sociales muy cortas y no hay motivo
 * para prohibirlas, pero un solo carácter no es un nombre comercial.
 */
export const AGENCY_NAME_MIN_LENGTH = 2;

/**
 * Largo máximo. La base no impone ninguno, así que éste es el único.
 *
 * Ochenta deja holgura sobre los valores reales —el más largo medido es
 * "Inmobiliaria Gaio 2", 19 caracteres— y cubre una razón social completa del
 * tipo "Inmobiliaria López y Asociados Sociedad de Responsabilidad Limitada"
 * (65). Por encima de eso no es un nombre: es un párrafo, y rompe el sidebar,
 * la columna del panel y el encabezado del sitio de marca, que lo truncan.
 */
export const AGENCY_NAME_MAX_LENGTH = 80;

/**
 * Normaliza lo que se escribió: recorta los bordes y colapsa los espacios
 * internos repetidos.
 *
 * ⚠ El colapso de espacios NO es cosmético: "Inmobiliaria  López" y
 * "Inmobiliaria López" son el mismo nombre para cualquier persona y dos valores
 * distintos para una comparación de strings. Y de esa comparación depende que se
 * detecte si el nombre cambió —que es lo que dispara la vuelta a revisión y el
 * rastro de `previous_name`—, así que sin normalizar, agregar un espacio de más
 * mandaría la cuenta entera a revisión sin que nada haya cambiado de verdad.
 */
export function normalizeAgencyName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export type AgencyNameValidation = { ok: true } | { ok: false; error: string };

/**
 * ¿Este nombre se puede usar? Valida solo la FORMA — es todo lo que se puede
 * saber sin consultar nada, y también todo lo que hay que saber (ver arriba:
 * la base no exige unicidad).
 *
 * Recibe un nombre YA normalizado. Los mensajes son los que ve la persona.
 */
export function validateAgencyName(name: string): AgencyNameValidation {
  if (name.length === 0) {
    return { ok: false, error: "El nombre de la inmobiliaria es requerido" };
  }

  if (name.length < AGENCY_NAME_MIN_LENGTH) {
    return {
      ok: false,
      error: `El nombre es muy corto: necesita al menos ${AGENCY_NAME_MIN_LENGTH} caracteres.`,
    };
  }

  if (name.length > AGENCY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `El nombre es muy largo: puede tener hasta ${AGENCY_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  return { ok: true };
}
