// Matrícula profesional del colegio de corredores inmobiliarios.
//
// SE GUARDA COMO TEXTO, NUNCA COMO NÚMERO. Dos motivos: los ceros a la izquierda
// son parte de la matrícula (el 0042 y el 42 no son la misma), y aunque en
// Santiago del Estero la matrícula es solo numérica, otras provincias usan
// letras. Por eso el formato acepta alfanumérico y guiones.
//
// Fuente única de verdad del formato: la usan el formulario de alta (client) y
// las server actions. La normalización va SIEMPRE antes de guardar y antes de
// validar, así "  1234 " y "1234" son la misma matrícula.

export const LICENSE_NUMBER_MAX = 20;

// Alfanumérico + guiones, ya normalizado (mayúsculas, sin espacios).
export const LICENSE_NUMBER_PATTERN = /^[A-Z0-9-]{1,20}$/;

export const LICENSE_NUMBER_ERROR =
  "Solo letras, números y guiones (hasta 20 caracteres)";

// Quita todos los espacios (incluidos los del medio: "12 345" → "12345") y pasa
// a mayúsculas. No valida: eso lo hace el schema con LICENSE_NUMBER_PATTERN.
export function normalizeLicenseNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}
