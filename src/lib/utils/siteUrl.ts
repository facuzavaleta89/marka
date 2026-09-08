// Dirección pública del sitio. Fuente única: la lee la disposición raíz
// (metadataBase), la página de la propiedad (enlace a compartir y canónica), el
// mapa del sitio y el archivo de instrucciones para buscadores.
//
// ⚠ NO SE USA LA VARIABLE AUTOMÁTICA DEL PROVEEDOR DE DESPLIEGUE. En Vercel
// existe `VERCEL_URL`, y es la trampa obvia: apunta al DESPLIEGUE CONCRETO, no
// al dominio, y cambia en cada publicación y en cada vista previa. Usarla acá
// haría que los enlaces compartidos y las direcciones del mapa del sitio
// apuntaran a direcciones efímeras que dejan de existir con el próximo deploy —
// y un buscador ya las habría indexado.
//
// ⚠ SIN LA VARIABLE, ESTO CORTA EN VEZ DE INVENTAR UN VALOR. La tentación es
// caer a `http://localhost:3000` para que "ande igual": sería el peor de los
// dos mundos, porque el sitio construiría bien y publicaría direcciones de
// localhost en la vista previa de los enlaces y en el mapa del sitio, sin que
// nada avise. Un fallo al construir se ve; una dirección equivocada indexada por
// Google, no. Mismo criterio fail-closed que `ADMIN_USER_ID` en /admin.
const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

if (!RAW_SITE_URL) {
  throw new Error(
    "Falta NEXT_PUBLIC_SITE_URL. Es la dirección pública del sitio (por ejemplo " +
      "https://marka.com.ar, sin barra al final) y la necesitan la metadata, el " +
      "mapa del sitio y el botón de compartir. Agregala a .env.local y al entorno " +
      "de despliegue."
  );
}

/** Sin barra al final, siempre: las rutas se concatenan con la suya. */
export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

/** Dirección absoluta a partir de una ruta del sitio. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Dirección pública de una propiedad. Un solo lugar arma esta ruta. */
export function propertyUrl(slug: string): string {
  return absoluteUrl(`/propiedades/${slug}`);
}
