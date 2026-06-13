// Limpieza pura de un texto a slug base (SIN sufijo): normaliza acentos, pasa a
// minúsculas y arma los guiones. No garantiza unicidad por sí sola.
// Compartida por generateSlug (propiedades — le agrega sufijo aleatorio) y por el
// slug de agencia (que resuelve unicidad contra la base, ver generateUniqueAgencySlug).
export function slugifyBase(text: string): string {
  return text
    .normalize("NFD")                    // descompone caracteres acentuados
    .replace(/[̀-ͯ]/g, "")    // elimina diacríticos (tildes)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")      // solo letras, números, espacios y guiones
    .trim()
    .replace(/[\s_]+/g, "-")            // espacios y guiones bajos → guión
    .replace(/-+/g, "-")               // colapsa guiones múltiples
    .replace(/^-|-$/g, "");            // elimina guiones al inicio y final
}

// Slug con sufijo aleatorio. Lo usan las PROPIEDADES: sus títulos colisionan
// seguido, así que el sufijo aleatorio (unicidad probabilística) es necesario.
// NO usar para agencias (queremos slug limpio para la URL white-label).
export function generateSlug(title: string): string {
  const suffix = Math.random().toString(36).slice(2, 8); // 6 chars [a-z0-9]
  return `${slugifyBase(title)}-${suffix}`;
}
