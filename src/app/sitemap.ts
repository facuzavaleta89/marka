import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL, propertyUrl } from "@/lib/utils/siteUrl";

// ─── Mapa del sitio ───────────────────────────────────────────
//
// Convención de archivo de Next.js: `sitemap.ts` en la raíz de `app/`, con una
// función por defecto que devuelve `MetadataRoute.Sitemap`. Se sirve en
// `/sitemap.xml`.
//
// ══════════════════════════════════════════════════════════════
// ⚠ POR QUÉ `force-dynamic`: SIN ESTO EL MAPA SE CONGELA AL CONSTRUIR
// ══════════════════════════════════════════════════════════════
//
// La documentación de la convención lo dice explícitamente:
//
//   "sitemap.js is a special Route Handler that is cached by default unless it
//    uses a Request-time API or dynamic config option."
//
// O sea que, por omisión, esta consulta correría UNA vez —durante `next build`—
// y el archivo serviría para siempre la lista de propiedades de ese día: las
// nuevas invisibles para los buscadores, y las dadas de baja todavía ofrecidas.
// El listado de propiedades cambia todos los días; el del sitio no puede quedar
// pegado al último despliegue.
//
// `dynamic = 'force-dynamic'` es la "dynamic config option" que la cita
// menciona. La documentación de Route Segment Config la define para "a Page,
// Layout, or Route Handler" —y el sitemap es un Route Handler especial— así:
//
//   "'force-dynamic': Force dynamic rendering, which will result in routes being
//    rendered for each user at request time."
//
// Se elige sobre `revalidate = 0` porque dice exactamente lo que queremos ("en
// cada request") en vez de expresarlo como una frecuencia de revalidación cero.
export const dynamic = "force-dynamic";

// Cuánto se lista como máximo. El tope de Google por archivo es 50.000 URLs;
// con este número no hace falta partir el mapa en varios (`generateSitemaps`),
// y a la vez es un techo explícito para que una consulta sin filtro no crezca
// sin control. PostgREST además corta en 1000 filas por defecto, así que el
// `.limit()` explícito es lo que vuelve visible el límite real.
const MAX_URLS = 10000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rutasFijas: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  const supabase = createAdminClient();

  // ══════════════════════════════════════════════════════════════
  // ⚠ EL MISMO CRITERIO QUE LA PÁGINA, Y POR LA MISMA VÍA
  // ══════════════════════════════════════════════════════════════
  //
  // Si acá se listara una propiedad que la página no muestra, un buscador
  // indexaría el cartel de "ya no está publicada" — peor que no listarla, porque
  // el resultado existe, se puede clickear y no sirve para nada.
  //
  // El criterio de `resolvePropertyBySlug` es: `status = 'active'` Y la agencia
  // públicamente visible. Se replica con:
  //   · `.eq("status", "active")` — el gate 1, idéntico;
  //   · `agency_is_publicly_visible(agency_id)` — el gate 2, LA MISMA FUNCIÓN de
  //     la base que invoca la página, que las tres policies públicas y que el
  //     sitio de marca. Acá se pregunta una vez por AGENCIA y no una por
  //     propiedad, que es lo que evita un RPC por fila.
  //
  // ⚠ NO se reescriben en TypeScript las tres condiciones de esa función. Es la
  // misma disciplina que en la página: la regla de cobro tiene UN solo lugar
  // donde vive, y el día que cambie, el mapa del sitio cambia con ella sin que
  // nadie se acuerde de venir hasta acá.
  const { data: propiedades, error } = await supabase
    .from("properties")
    .select("slug, agency_id, updated_at")
    .eq("status", "active")
    .limit(MAX_URLS);

  // FALLA CERRADA, igual que el resolvedor: si la lectura falla, se sirve el
  // mapa con las rutas fijas en vez de un archivo vacío o un error 500. Un
  // sitemap incompleto es un contratiempo; uno que rompe hace que el buscador
  // marque el sitio como defectuoso.
  if (error || !propiedades) return rutasFijas;

  // Una consulta de visibilidad por AGENCIA distinta, no por propiedad: con 17
  // propiedades de 3 agencias son 3 llamadas en vez de 17.
  const agencyIds = [...new Set(propiedades.map((p) => p.agency_id))];
  const visibles = new Map<string, boolean>();
  await Promise.all(
    agencyIds.map(async (id) => {
      const { data, error: rpcError } = await supabase.rpc(
        "agency_is_publicly_visible",
        { target_agency_id: id }
      );
      // Falla cerrada también acá: ante la duda, la agencia no se lista.
      visibles.set(id, !rpcError && data === true);
    })
  );

  return [
    ...rutasFijas,
    ...propiedades
      .filter((p) => visibles.get(p.agency_id) === true)
      .map((p) => ({
        url: propertyUrl(p.slug),
        // `updated_at` es la última vez que la propiedad cambió de verdad. Es
        // el dato que un buscador usa para decidir si vale la pena volver.
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ];
}
