// Lectura de un número entero positivo escrito a mano en un campo de texto.
// Lo usan los cuatro rangos del panel de filtros (precio desde/hasta y
// superficie desde/hasta), que son campos `type="text"` con `inputMode="numeric"`
// —o sea que el navegador NO filtra nada en escritorio ni al pegar—.
//
// ══════════════════════════════════════════════════════════════
// LAS REGLAS, Y POR QUÉ CADA UNA
// ══════════════════════════════════════════════════════════════
//
// ⚠ ESTO REEMPLAZA A `parseFloat`, QUE ACEPTABA BASURA EN SILENCIO. Medido:
//
//   | se escribía | parseFloat daba | ahora |
//   |-------------|-----------------|-------|
//   | "1.500"     | 1.5  ← el peor  | 1500  |
//   | "12abc"     | 12              | null  |
//   | "-5"        | -5              | null  |
//   | "1e3"       | 1000            | null  |
//   | "abc"       | NaN → null      | null  |
//
// El caso que más duele es `"1.500"`: el punto es el separador de MILES en
// Argentina, así que quien escribe "desde $1.500" terminaba filtrando "desde
// 1,5". No es un borde: es cómo se escribe un precio acá.
//
//   1. Se ignoran los ESPACIOS (incluido el fino de agrupación) y los PUNTOS,
//      que son las dos formas de separar miles ("1.500" y "1 500" → 1500).
//   2. Lo que queda tiene que ser SOLO DÍGITOS. Cualquier otro carácter
//      —letras, signos, comas, una `e` de notación científica— devuelve null:
//      un rango de precio o de superficie no admite decimales ni negativos, y
//      adivinar qué quiso decir la persona es peor que no filtrar.
//   3. Tiene que ser MAYOR QUE 0. Un "desde 0" no filtra nada y ocupa un lugar
//      en el contador de filtros activos, que es peor que estar vacío.
//   4. Vacío → null, que es "sin filtro".
//
// ⚠ NO se acepta la COMA como separador decimal, a propósito: no hay ningún
// caso en que medio metro cuadrado o medio peso cambien el resultado de una
// búsqueda, y admitirla obligaría a decidir qué hacer con "1,500" —que en
// Argentina es uno coma cinco y en otras convenciones es mil quinientos—.
//
// Vive en lib/utils/ y no dentro del panel porque es una función pura, sin
// dependencias, reutilizable por cualquier campo numérico futuro (mismo
// precedente que coords.ts).
export function parsePositiveIntegerInput(raw: string): number | null {
  const cleaned = raw.replace(/[\s.  ]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  // Number.isSafeInteger cubre el caso de un número de veinte dígitos, que pasa
  // la prueba de "solo dígitos" y no se puede representar sin perder precisión.
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}
