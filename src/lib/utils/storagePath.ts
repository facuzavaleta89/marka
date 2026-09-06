// Traducción de URL pública de Supabase Storage → path dentro del bucket.
//
// Sin dependencias y framework-agnóstico: lo importan tanto el servidor (la
// server action que borra una propiedad) como el cliente (el uploader de
// imágenes), así que no puede tocar Supabase, React ni variables de entorno.
// Mismo precedente que coords.ts.
//
// Por qué hace falta convertir: `property_images.url` guarda la URL PÚBLICA
// COMPLETA (la que devuelve getPublicUrl), no un path relativo. La API de
// Storage, en cambio, borra por path. Sin esta traducción no hay forma de
// borrar el archivo de una fila.

// Bucket único del proyecto: las fotos de propiedades, los avatares y los logos
// conviven ahí separados por prefijo de path. Ver CLAUDE.md → "Imágenes y
// Storage".
export const PROPERTY_IMAGES_BUCKET = "property-images";

// Devuelve el path dentro del bucket, o null si la URL no pertenece al bucket.
//
// ⚠ EL null NO ES UNA FORMALIDAD, ES LA CORRECCIÓN DE UN DEFECTO REAL. Esta
// función vivía dentro de ImageUploader y ante una URL sin el marcador devolvía
// LA URL ENTERA. Pasada a storage.remove(), una URL completa es un path que no
// existe: la operación no borra nada y TAMPOCO devuelve error (borrar algo
// inexistente no falla). O sea que el defecto no se manifestaba como una falla
// sino como un éxito mentiroso — exactamente la forma en que se acumulan
// archivos huérfanos sin que nadie se entere.
//
// Los llamadores tienen que descartar los nulos en vez de mandarlos a borrar.
export function extractStoragePath(url: string): string | null {
  const marker = `/${PROPERTY_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;

  const path = url.slice(index + marker.length);
  return path === "" ? null : path;
}
