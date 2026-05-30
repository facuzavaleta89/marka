export function generateSlug(title: string): string {
  const base = title
    .normalize("NFD")                    // descompone caracteres acentuados
    .replace(/[̀-ͯ]/g, "")    // elimina diacríticos (tildes)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")      // solo letras, números, espacios y guiones
    .trim()
    .replace(/[\s_]+/g, "-")            // espacios y guiones bajos → guión
    .replace(/-+/g, "-")               // colapsa guiones múltiples
    .replace(/^-|-$/g, "");            // elimina guiones al inicio y final

  const suffix = Math.random().toString(36).slice(2, 8); // 6 chars [a-z0-9]
  return `${base}-${suffix}`;
}
