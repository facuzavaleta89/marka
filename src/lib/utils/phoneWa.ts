// Teléfono de WhatsApp de un celular argentino.
//
// ══════════════════════════════════════════════════════════════
// LO QUE SE GUARDA NO CAMBIÓ: EL NÚMERO COMPLETO
// ══════════════════════════════════════════════════════════════
//
// `agents.phone_wa` y `agencies.phone_wa` guardan "549" + característica +
// número, solo dígitos (ej: "5493854000000"). Es lo que consume el enlace de
// contacto (`generateWaUrl` → `https://wa.me/<número>`), y esta pieza no lo toca.
//
// Lo que cambió es cómo se ESCRIBE: el campo muestra el prefijo "+54 9" fijo y
// la persona escribe solo la característica y el número. El prefijo es de
// presentación; se antepone al guardar.
//
// Fuente única del formato: la usan los cuatro formularios que escriben un
// teléfono (perfil, preferencias, alta de agente, registro) y sus server
// actions. Mismo reparto que `licenseNumber.ts`: el cliente valida para dar
// feedback, el servidor valida de nuevo porque es la única barrera real.
//
// Sin selector de país ni teléfonos fijos: la plataforma es para inmobiliarias
// argentinas y el número existe para armar un enlace de WhatsApp.

import { z } from "zod";

/** Lo que el campo muestra fijo, a la izquierda de lo que se escribe. */
export const PHONE_WA_PREFIX_LABEL = "+54 9";

/** Lo que se antepone al guardar: país (54) + marca de celular (9). */
export const PHONE_WA_STORED_PREFIX = "549";

/**
 * Característica + número. En Argentina suman SIEMPRE 10 dígitos, sea cual sea
 * el largo de la característica (11 + 8, 385 + 7, 2944 + 6). Por eso el largo
 * tiene mínimo Y máximo: sin máximo, un número con el prefijo duplicado
 * ("549549…") pasaba la validación anterior sin ningún error.
 */
export const PHONE_WA_NATIONAL_LENGTH = 10;

export const PHONE_WA_PLACEHOLDER = "3854000000";

export const PHONE_WA_HELP =
  "Característica y número, sin el 0 ni el 15. Si pegás el número completo, se acomoda solo.";

export const PHONE_WA_ERROR =
  "Revisá el número: la característica y el número juntos tienen que ser 10 dígitos (ej: 385 4000000).";

// Toda característica argentina empieza con 1, 2 o 3 (11, 2xx, 3xx). Es lo que
// vuelve seguro quitar un 0, un 9 o un 54 del principio: ninguno de los tres
// puede ser el comienzo de una característica.
const NATIONAL_PATTERN = /^[1-3]\d{9}$/;
const STORED_PATTERN = /^549[1-3]\d{9}$/;

/**
 * Mientras se tipea de a un carácter: solo deja dígitos. No quita prefijos:
 * hacerlo tecla por tecla borraría un "5" o un "0" recién escrito antes de que
 * la persona termine de escribir lo que venía. La limpieza completa corre al
 * pegar, al salir del campo y al validar.
 */
export function sanitizePhoneWaTyping(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Deja solo característica + número, a partir de cualquiera de las formas en
 * que la gente escribe o pega un celular argentino:
 *
 *   "+54 9 385 400-0000"   → "3854000000"   (contacto copiado del teléfono)
 *   "5493854000000"        → "3854000000"   (el formato viejo del campo)
 *   "0385 15 400 0000"     → "3854000000"   (como se dicta en Argentina)
 *   "385 4000000"          → "3854000000"   (lo que pide el campo)
 *
 * Del principio quita, en cualquier combinación: signos y espacios, ceros, el
 * 54 y el 9. Y el 15 del celular, que NO va al principio: va DESPUÉS de la
 * característica ("0385 15 4000000"). Por eso se busca en las tres posiciones
 * posibles (característica de 2, 3 o 4 dígitos) y solo cuando sobran
 * exactamente dos dígitos, que es la única forma de saber que está.
 *
 * No valida: devuelve lo que quedó, y el largo lo decide
 * `isValidPhoneWaNational`.
 */
export function normalizePhoneWaNational(value: string): string {
  let digits = value.replace(/\D/g, "");

  let previous: string;
  do {
    previous = digits;
    digits = digits.replace(/^0+/, "");
    if (digits.startsWith("54")) digits = digits.slice(2);
    if (digits.startsWith("9")) digits = digits.slice(1);
  } while (digits !== previous);

  if (digits.length === PHONE_WA_NATIONAL_LENGTH + 2) {
    for (const at of [2, 3, 4]) {
      if (digits.slice(at, at + 2) === "15") {
        return digits.slice(0, at) + digits.slice(at + 2);
      }
    }
  }

  return digits;
}

export function isValidPhoneWaNational(national: string): boolean {
  return NATIONAL_PATTERN.test(national);
}

export function isValidStoredPhoneWa(stored: string): boolean {
  return STORED_PATTERN.test(stored);
}

/**
 * Lo que va en el campo al EDITAR un número ya guardado.
 *
 * ⚠ Si el guardado no tiene el formato esperado —hay números viejos sin el 9
 * de celular— se devuelve TAL CUAL, con `recognized: false`, y el formulario
 * avisa que hay que revisarlo. NUNCA se corrige acá: editar el nombre de un
 * perfil no puede cambiarle el teléfono a alguien sin que lo pida.
 */
export function splitStoredPhoneWa(stored: string): {
  national: string;
  recognized: boolean;
} {
  if (stored === "") return { national: "", recognized: true };
  if (STORED_PATTERN.test(stored)) {
    return { national: stored.slice(PHONE_WA_STORED_PREFIX.length), recognized: true };
  }
  return { national: stored, recognized: false };
}

/**
 * El valor a guardar, o `null` si no es un celular argentino válido.
 *
 * `preserved` es el número que YA está guardado. Si llega exactamente ese
 * valor se devuelve sin tocarlo: es la forma de que guardar un formulario sin
 * tocar el teléfono no lo reescriba. En el servidor, `preserved` sale SIEMPRE
 * de la fila real, nunca del cliente, así que no sirve para colar un valor
 * nuevo sin validar.
 *
 * Desde el 16 sep 2026 un valor guardado SIEMPRE cumple el formato: la base
 * tiene los CHECK `agents_phone_wa_format` y `agencies_phone_wa_format` con el
 * mismo patrón que STORED_PATTERN (`^549[1-3][0-9]{9}$`), y los números viejos
 * sin el 9 se corrigieron antes de agregarlos. O sea que preservar sin validar
 * ya no puede dejar pasar un número mal formado. La rama se conserva porque no
 * cuesta nada y evita reformatear lo que no se tocó.
 *
 * ⚠ SI ALGÚN DÍA SE ACEPTAN LÍNEAS FIJAS (hoy el formato exige el 549 de
 * celular), no alcanza con cambiar este archivo: hay que aflojar esos dos CHECK
 * con un ALTER, o el formulario va a aceptar un número que la base rechaza. Ver
 * supabase/migrations/20240101000000_initial_schema.sql → "BLINDAJE DE COLUMNAS".
 */
export function resolvePhoneWaForSave(
  input: string,
  preserved: string | null = null
): string | null {
  if (preserved !== null && preserved !== "" && input === preserved) {
    return preserved;
  }
  const national = normalizePhoneWaNational(input);
  return isValidPhoneWaNational(national)
    ? PHONE_WA_STORED_PREFIX + national
    : null;
}

/**
 * Campo de zod para los formularios y las actions: recibe lo que la persona
 * escribió y entrega el número COMPLETO listo para guardar.
 */
export function phoneWaField(preserved: string | null = null) {
  return z.string().transform((value, ctx) => {
    const stored = resolvePhoneWaForSave(value, preserved);
    if (stored === null) {
      ctx.addIssue({ code: "custom", message: PHONE_WA_ERROR });
      return z.NEVER;
    }
    return stored;
  });
}
