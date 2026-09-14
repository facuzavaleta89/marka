// ─── Direcciones reservadas del sitio de marca ────────────────
//
// La URL pública de una agencia es `marka.com.ar/[slug]`, o sea una ruta
// DINÁMICA DE PRIMER NIVEL. Comparte el espacio de nombres con todo lo que vive
// en la raíz del sitio: las rutas reales de la aplicación, los archivos que el
// framework sirve en la raíz, y cualquier ruta de primer nivel que se agregue
// más adelante.
//
// ══════════════════════════════════════════════════════════════
// ⚠ QUÉ PASA SI UNA AGENCIA TOMA UNA DIRECCIÓN RESERVADA
// ══════════════════════════════════════════════════════════════
//
// NO es un agujero de seguridad: una ruta estática SIEMPRE le gana a la
// dinámica, así que la agencia no se apropia de `/admin` ni de nada.
// Es PEOR de explicar: su propio sitio queda INALCANZABLE Y EN SILENCIO.
// Verificado por HTTP contra el build:
//
//   /inmobiliaria-demo  -> 200  (la dinámica resuelve)
//   /admin              -> 307  (gana la ruta real: redirect al login)
//   /propiedades        -> 404  (gana el segmento estático, que no tiene page)
//
// O sea que una agencia con el slug `admin` pagaría su plan por una dirección
// que devuelve el login del dueño de la plataforma, sin un solo error y sin
// ninguna pantalla donde enterarse.
//
// ══════════════════════════════════════════════════════════════
// ⚠⚠ AGREGAR UNA RUTA DE PRIMER NIVEL AL PROYECTO OBLIGA A AGREGARLA ACÁ
// ══════════════════════════════════════════════════════════════
//
// Y hay que hacerlo ANTES de publicar la ruta. El orden importa: si una agencia
// ya tomó esa dirección, la ruta nueva nace ganándole y le apaga el sitio a un
// cliente que paga, sin aviso y sin forma de detectarlo salvo que él lo reporte.
// Bloquear de más es gratis (la agencia elige otra dirección en el momento);
// bloquear de menos es irreversible en la práctica, porque para cuando se
// descubre la agencia ya repartió su dirección.
//
// Por el mismo motivo el GRUPO 3 es generoso: reserva palabras que el producto
// todavía no usa. Ver la justificación de cada bloque abajo.

// ─── GRUPO 1 · Rutas de primer nivel que EXISTEN HOY ──────────
//
// Relevadas del árbol de `src/app/` (los route groups `(agent)` y `(public)` no
// producen segmento de URL, así que no entran):
//
//   src/app/(agent)/admin        → /admin
//   src/app/(agent)/dashboard    → /dashboard
//   src/app/(agent)/login        → /login
//   src/app/(agent)/logout       → /logout
//   src/app/(agent)/register     → /register
//   src/app/(public)/propiedades → /propiedades/[slug]
//   src/app/api/geocode          → /api/geocode
//
// `propiedades` y `api` se reservan aunque hoy no tengan página propia en su
// primer nivel (los dos dan 404): el segmento estático existe y le gana igual a
// la dinámica, así que el sitio de la agencia quedaría muerto lo mismo.
const APP_ROUTES = [
  "admin",
  "api",
  "dashboard",
  "login",
  "logout",
  "propiedades",
  "register",
] as const;

// ─── GRUPO 2 · Archivos servidos en la raíz ───────────────────
//
// Dos orígenes, los dos sirven en la raíz del dominio:
//
//   · Convención de Next (`src/app/`): robots.ts → /robots.txt,
//     sitemap.ts → /sitemap.xml, favicon.ico, apple-icon.png.
//   · Estáticos de `public/`: manifest.json, icon-192.png, icon-512.png,
//     markers/, file.svg, globe.svg, next.svg, vercel.svg, window.svg.
//
// ⚠ SE GUARDAN LOS NOMBRES CON EXTENSIÓN **Y** SIN ELLA, A PROPÓSITO. Hoy la
// forma válida de un slug no admite puntos (ver SLUG_PATTERN en agencySlug.ts),
// así que `robots.txt` no es un candidato posible y las entradas con extensión
// parecen de más. Se dejan igual porque son gratis y porque esta lista NO puede
// depender de una regla que vive en otro archivo: el día que la forma admita un
// punto, esto sigue estando bien. Las que SÍ son alcanzables hoy son las de la
// izquierda —`robots`, `sitemap`, `favicon`, `manifest`, `markers`, `icon`,
// `apple-icon`—, y por eso están.
const ROOT_FILES = [
  "apple-icon",
  "apple-icon.png",
  "favicon",
  "favicon.ico",
  "icon",
  "icon-192.png",
  "icon-512.png",
  "manifest",
  "manifest.json",
  "markers",
  "robots",
  "robots.txt",
  "sitemap",
  "sitemap.xml",
  // Prefijos internos del framework. Inalcanzables por la forma (llevan guión
  // bajo), pero el costo de nombrarlos es cero y el de olvidarlos no.
  "_next",
  "_vercel",
  // Los SVG de ejemplo que vienen con el andamio de Next y siguen en public/.
  "file.svg",
  "globe.svg",
  "next.svg",
  "vercel.svg",
  "window.svg",
] as const;

// ─── GRUPO 3 · Reservadas para el futuro ──────────────────────
//
// Palabras que el producto todavía no usa y conviene no entregar. El criterio
// de cada bloque está en su comentario.
const FUTURE_ROUTES = [
  // (a) LA MARCA PROPIA Y LA SUPLANTACIÓN. Es el bloque más importante de los
  // tres grupos: `marka.com.ar/marka` o `/soporte` leídos por un visitante son
  // indistinguibles de una página de la plataforma. Una agencia no puede quedar
  // en posición de hablar en nombre de Marka.
  "marka",
  "marka-oficial",
  "oficial",
  "soporte",
  "seguridad",
  "verificado",
  "administrador",
  "administracion",
  "root",
  "superadmin",
  "sistema",
  "system",
  "staff",
  "moderacion",

  // (b) PANTALLAS INSTITUCIONALES Y DE VENTA. `precios` está nombrada
  // textualmente en CLAUDE.md como la ruta futura que competiría con `[slug]`, y
  // DESIGN §11 habla de "la pantalla de venta —deliberadamente fuera de
  // alcance—", que es exactamente ésta. El resto es el conjunto estándar de un
  // sitio comercial: si el producto crece, alguna de estas se agrega seguro.
  "precios",
  "planes",
  "plan",
  "contacto",
  "ayuda",
  "faq",
  "preguntas",
  "nosotros",
  "about",
  "empresa",
  "prensa",
  "blog",
  "novedades",
  "terminos",
  "condiciones",
  "privacidad",
  "legales",
  "cookies",

  // (c) VOCABULARIO DEL DOMINIO. Son las palabras con las que se nombraría una
  // pantalla pública futura de navegación o filtrado, y además las que una
  // agencia elegiría por ser genéricas —justo las que no conviene que sean de
  // una sola—. ⚠ `ciudad` y `ciudades` son load-bearing: PENDIENTES.md decide
  // que la URL de ciudad, si alguna vez se hace, va como `/ciudad/[slug]`, o sea
  // que ese primer nivel YA está comprometido. `propiedad` acompaña a
  // `propiedades`, que ya existe.
  "ciudad",
  "ciudades",
  "propiedad",
  "agencia",
  "agencias",
  "inmobiliaria",
  "inmobiliarias",
  "mapa",
  "buscar",
  "busqueda",
  "favoritos",
  "destacadas",
  "venta",
  "ventas",
  "alquiler",
  "alquileres",

  // (d) CUENTA Y SESIÓN. Varias son hoy sub-rutas de /dashboard; se reservan por
  // si alguna se promueve al primer nivel, y porque son los nombres canónicos de
  // un flujo de autenticación (que hoy vive en /login y /register, pero que al
  // sumar recuperación de contraseña o invitaciones va a necesitar más rutas).
  "cuenta",
  "perfil",
  "preferencias",
  "configuracion",
  "ajustes",
  "suscripcion",
  "suscripciones",
  "panel",
  "equipo",
  "leads",
  "consultas",
  "auth",
  "signin",
  "signup",
  "signout",
  "salir",
  "ingresar",
  "registro",
  "recuperar",
  "password",
  "verificar",
  "confirmar",
  "invitacion",

  // (e) COBRO. No existe todavía ningún flujo de pago en la app (el plan lo
  // activa el dueño a mano), pero el día que exista va a vivir en la raíz, y
  // mientras tanto son palabras que en una URL leen como "acá se paga".
  "pagos",
  "pago",
  "pagar",
  "checkout",
  "facturacion",
  "facturas",
  "cobros",

  // (f) CONVENCIONES DE INFRAESTRUCTURA WEB. Nombres que suelen resolverse a
  // otra cosa (un subdominio, un CDN, una carpeta de assets) y que en la raíz
  // producen direcciones confusas o directamente rotas según cómo se configure
  // el hosting.
  "www",
  "mail",
  "email",
  "static",
  "assets",
  "public",
  "cdn",
  "img",
  "images",
  "imagenes",
  "css",
  "js",
  "fonts",
  "media",
  "files",
  "archivos",
  "download",
  "descargas",
  "health",
  "status",
  "ping",
  "test",
  "debug",

  // (g) VALORES QUE SE FILTRAN DE UN BUG. Un `null` o un `undefined` en una URL
  // no es una dirección: es el síntoma de una serialización rota. Reservarlos
  // evita que una agencia quede con una dirección que parece un error del
  // sistema, y que un error del sistema parezca una agencia.
  "null",
  "undefined",
  "true",
  "false",
  "nan",
  "none",
] as const;

// Conjunto único para la consulta. Se arma una sola vez, al cargar el módulo.
const RESERVED_SLUGS: ReadonlySet<string> = new Set<string>([
  ...APP_ROUTES,
  ...ROOT_FILES,
  ...FUTURE_ROUTES,
]);

/**
 * ¿Esta dirección está reservada y no se le puede dar a una agencia?
 *
 * La comparación es EXACTA contra el slug ya normalizado (minúsculas), no por
 * prefijo: reservar `admin` no debe bloquear `administracion-lopez`, que es un
 * nombre de inmobiliaria perfectamente legítimo y no colisiona con nada.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

/** Cuántas direcciones hay reservadas. Solo para diagnóstico y pruebas. */
export const RESERVED_SLUGS_COUNT = RESERVED_SLUGS.size;
