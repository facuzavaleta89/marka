// ¿Esta URL apunta al Storage público del proyecto?
//
// La usan las server actions que guardan URLs de archivos —fotos de propiedad
// (`property_images.url`), avatar (`agents.avatar_url`) y logo
// (`agencies.logo_url`)— para rechazar ANTES de escribir lo que la base
// rechazaría después. Las tres columnas tienen un CHECK con este mismo prefijo
// (`property_images_url_storage`, `agents_avatar_url_storage`,
// `agencies_logo_url_storage`).
//
// ⚠ POR QUÉ VALIDAR ACÁ SI LA BASE YA LO HACE: en la edición de una propiedad
// las imágenes se BORRAN antes de insertar las nuevas. Si la base rechazara el
// insert, la propiedad quedaría sin fotos. Validando primero, no se toca nada.
//
// ⚠⚠ EL PREFIJO TIENE QUE COINCIDIR CON EL ESCRITO EN LOS CHECK DE LA BASE, y
// los CHECK llevan el host del proyecto escrito a mano. Si el proyecto de
// Supabase cambia, hay que cambiar los CHECK (con un ALTER) Y la variable de
// entorno. Si solo cambia uno de los dos, esta validación deja pasar URLs que la
// base rechaza, o rechaza URLs que la base acepta.

import { PROPERTY_IMAGES_BUCKET } from "./storagePath";

function buildPrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${PROPERTY_IMAGES_BUCKET}/`;
}

/**
 * Prefijo público del bucket, por ejemplo
 * `https://<proyecto>.supabase.co/storage/v1/object/public/property-images/`.
 * `null` si falta NEXT_PUBLIC_SUPABASE_URL.
 */
export const STORAGE_PUBLIC_PREFIX: string | null = buildPrefix();

/**
 * true solo si `url` es un string que empieza con el prefijo público del bucket.
 * Falla cerrada: sin prefijo configurado, ninguna URL es válida (un prefijo
 * vacío haría que cualquier string "empiece" con él).
 */
export function isStoragePublicUrl(url: unknown): url is string {
  return (
    typeof url === "string" &&
    STORAGE_PUBLIC_PREFIX !== null &&
    url.startsWith(STORAGE_PUBLIC_PREFIX)
  );
}
