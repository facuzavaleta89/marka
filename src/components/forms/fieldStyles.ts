// ══════════════════════════════════════════════════════════════
// CAMPO CON CAJA — LA ÚNICA DEFINICIÓN
// ══════════════════════════════════════════════════════════════
//
// La app tiene DOS familias de campo, y las dos son deliberadas:
//
//   · SUBRAYADO: el estilo de fábrica de `Input`, `Textarea` y `SelectTrigger`
//     (preset Sera): solo borde inferior, sin relleno, texto alineado con la
//     etiqueta. Es el de inicio de sesión y registro, y NO lleva relleno a
//     propósito (DESIGN §14 alinea el enlace "Volver al mapa" con ese eje).
//   · CAJA: borde en los cuatro lados, fondo blanco y 12px de relleno. Es la del
//     panel: perfil, preferencias, equipo, propiedades y el panel de plataforma.
//
// ⚠ POR QUÉ ESTO EXISTE. La caja no estaba escrita en ningún lado: cada pantalla
// la reinventaba. `PropertyForm` y `AgenciesTable` tenían una constante copiada
// idéntica, y perfil, preferencias y equipo le pasaban solo un color de borde
// (`border-stone`). `cn` combina clases con tailwind-merge, que interpreta ese
// color —de los cuatro lados— como conflicto con `border-transparent` y
// `border-b-input` del subrayado, y LOS ELIMINA: el campo quedaba como una caja
// de cuatro bordes con el relleno cero del subrayado (medido: el texto a 0px del
// borde) y sin anillo de foco (el color del anillo sin su ancho no dibuja nada).
//
// ⚠ POR QUÉ CONSTANTES Y NO UNA VARIANTE DEL COMPONENTE. La misma caja tiene que
// vestir cosas que no son un `<input>`: el CONTENEDOR de un campo con prefijo fijo
// (la dirección del sitio de marca, el teléfono), donde la caja la dibuja un
// `<div>` y el input va adentro sin borde. Una variante de `Input` no llega ahí.
// Y los tres componentes de fábrica (`Input`, `Textarea`, `SelectTrigger`)
// consumen la misma clase, así que alcanza con un solo lugar para los tres.
//
// Quien necesite un campo con caja usa ESTAS constantes. No escribir la caja a
// mano en una pantalla: es exactamente cómo se rompió.

/** Caja completa para `Input`, `Textarea` y `SelectTrigger`. */
export const FIELD_BOX =
  "rounded-md border border-stone border-b-stone bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/20 focus-visible:ring-offset-1 focus-visible:border-graphite focus-visible:border-b-graphite";

/** Estado de error de la caja. Se suma a `FIELD_BOX`, nunca va solo. */
export const FIELD_BOX_ERROR = "border-error border-b-error";

/**
 * Estado de error del SUBRAYADO (inicio de sesión, registro).
 *
 * ⚠ Colorea SOLO el borde inferior. Pasarle `border-error` —el color de los
 * cuatro lados— dispara el mismo conflicto de tailwind-merge que rompía el
 * panel: el subrayado se convertía en una caja roja sin relleno justo cuando
 * había un error, y el texto se corría respecto de la etiqueta.
 *
 * ⚠ `aria-invalid:border-b-error` no es redundante. Los componentes de fábrica
 * traen `aria-invalid:border-b-destructive`, que pesa más que `border-b-error`
 * (lleva un selector de atributo), así que en un campo con `aria-invalid` —el
 * selector de ciudad del registro lo tiene— el subrayado salía con el rojo del
 * preset y no con el `error` del proyecto (medido). Nombrarla acá hace que
 * tailwind-merge descarte la de fábrica.
 */
export const FIELD_UNDERLINE_ERROR =
  "border-b-error focus-visible:border-b-error aria-invalid:border-b-error";

// ─── Campo con prefijo fijo ───────────────────────────────────
//
// La caja la dibuja el CONTENEDOR y el input va adentro sin borde ni fondo. El
// foco se muestra con `focus-within` en el contenedor, con el mismo anillo que
// `FIELD_BOX`: el prefijo y lo escrito se leen como un solo campo.

/** Contenedor de un campo con prefijo, en la familia CAJA. */
export const FIELD_BOX_GROUP =
  "flex items-center rounded-md border border-stone bg-white pl-3 focus-within:ring-2 focus-within:ring-terracota/20 focus-within:ring-offset-1 focus-within:border-graphite";

export const FIELD_BOX_GROUP_ERROR = "border-error";

/** Contenedor de un campo con prefijo, en la familia SUBRAYADO. */
export const FIELD_UNDERLINE_GROUP =
  "flex items-center border-b border-input focus-within:border-ring";

export const FIELD_UNDERLINE_GROUP_ERROR = "border-error focus-within:border-error";

/**
 * El texto fijo. `text-base md:text-sm` es el mismo tamaño que el input que lo
 * acompaña: en celular el input va a 16px (menos que eso hace que iOS agrande
 * la pantalla al enfocar), y un prefijo más chico se leería como otra cosa.
 * `graphite` y no `stone`: es parte del dato, no un texto de ayuda.
 */
export const FIELD_GROUP_PREFIX =
  "shrink-0 font-sans text-base md:text-sm text-graphite select-none whitespace-nowrap";

/** El input dentro de un contenedor de la familia CAJA. */
export const FIELD_BOX_GROUP_INPUT =
  "border-0 bg-transparent pr-3 shadow-none focus-visible:ring-0";

/** El input dentro de un contenedor de la familia SUBRAYADO. */
export const FIELD_UNDERLINE_GROUP_INPUT =
  "border-0 bg-transparent shadow-none focus-visible:ring-0";
