import { notFound } from "next/navigation";
import { resolveAgencyBySlug } from "@/lib/utils/resolveAgencyBySlug";
import { AgencyMapView } from "@/components/map/AgencyMapView";
import { AgencyUnavailable } from "@/components/agency/AgencyUnavailable";

// Ruta pública white-label: marka.com.ar/[slug]. El root /[slug] es EXCLUSIVO de
// agencias (no hay ruta /[ciudad]). Resuelve el slug en el server y, según el
// estado, hace 404, muestra "sitio no disponible", o el mapa filtrado a la agencia.
//
// params es Promise en Next.js 16 → await.
export default async function AgencyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await resolveAgencyBySlug(slug);

  // Slug inexistente → 404 real.
  if (result.status === "not_found") {
    notFound();
  }

  // Agencia existe pero sin white-label → estado "sitio no disponible".
  if (result.status === "disabled") {
    return <AgencyUnavailable />;
  }

  // Activa → mapa estándar filtrado a las propiedades de esta agencia en su ciudad.
  return <AgencyMapView city={result.city} agencyId={result.agency.id} />;
}
