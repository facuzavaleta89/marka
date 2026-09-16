// Traduce los rechazos de la base que protegen el FORMATO de un dato: los CHECK
// de teléfono y de URL de archivos, y la protección del contador de visitas.
//
// ⚠ SE DISTINGUE POR EL NOMBRE DE LA CONSTRAINT, NUNCA SOLO POR EL CÓDIGO. Todo
// CHECK levanta 23514, igual que los triggers de publicación de `properties`
// (aprobación, suscripción, cupo). Un matcher que mirara solo el código le
// diría "alcanzaste el límite de tu plan" a quien mandó un teléfono mal
// formado. PostgreSQL incluye el nombre de la constraint en el mensaje
// (`new row for relation "agents" violates check constraint
// "agents_phone_wa_format"`), así que se busca ese nombre.
//
// Devuelve null si el error no es de estos: el llamador sigue con su
// traducción de siempre.

type DbLikeError = { code?: string; message: string };

const PHONE_CONSTRAINTS = ["agents_phone_wa_format", "agencies_phone_wa_format"];

const URL_CONSTRAINTS = [
  "property_images_url_storage",
  "agents_avatar_url_storage",
  "agencies_logo_url_storage",
];

// Texto exacto que levanta protect_views_count() (ver el archivo de schema).
const VIEWS_COUNT_MESSAGE = "El contador de visitas no se puede escribir directamente";

export const PHONE_FORMAT_ERROR = "El teléfono no tiene un formato válido.";
export const IMAGE_URL_ERROR = "La imagen no es válida.";
export const VIEWS_COUNT_ERROR = "El contador de visitas no se puede modificar.";

export function translateFormatCheckError(dbError: DbLikeError): string | null {
  if (dbError.code === "23514") {
    if (PHONE_CONSTRAINTS.some((name) => dbError.message.includes(name))) {
      return PHONE_FORMAT_ERROR;
    }
    if (URL_CONSTRAINTS.some((name) => dbError.message.includes(name))) {
      return IMAGE_URL_ERROR;
    }
  }
  // 42501 también es el código de "permission denied" y de una violación de
  // RLS: por eso se exige además el texto del trigger.
  if (dbError.code === "42501" && dbError.message.includes(VIEWS_COUNT_MESSAGE)) {
    return VIEWS_COUNT_ERROR;
  }
  return null;
}
