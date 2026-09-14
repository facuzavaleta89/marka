import { notFound } from "next/navigation";
import { resolveAgencyBySlug } from "@/lib/utils/resolveAgencyBySlug";
import { resolveAgentSessionIfPresent } from "@/lib/utils/resolveAgentSession";
import { AgencyMapView } from "@/components/map/AgencyMapView";
import { AgencyUnavailable } from "@/components/agency/AgencyUnavailable";
import { AgencyUnavailableForAdmin } from "@/components/agency/AgencyUnavailableForAdmin";

// ¿Quien está mirando es el ADMINISTRADOR de esta agencia?
//
// ══════════════════════════════════════════════════════════════
// ⚠ EL VISITANTE ANÓNIMO NO PUEDE PAGAR ESTO, Y NO LO PAGA
// ══════════════════════════════════════════════════════════════
//
// Esta página es pública y hasta ahora no consultaba la sesión. Preguntar
// "¿quién mira?" de frente serían DOS viajes (el `getUser()` de Auth y el select
// de `agents`) en cada visita, y el 99 % del tráfico los pagaría para enterarse
// de que no hay nadie.
//
// `resolveAgentSessionIfPresent` corta antes: si no hay cookie de sesión en el
// request, devuelve `no_session` SIN consultar nada (ver su encabezado). Para un
// visitante anónimo el costo es recorrer las cookies que ya están en memoria:
// cero red, cero base. Solo se paga el trabajo real cuando hay indicios de que
// hay alguien.
//
// ⚠ Y SE LLAMA SOLO EN LA RAMA `disabled`. La rama `active` —la que ven los
// clientes que pagan, y la única con tráfico de verdad— no toca la sesión: sigue
// exactamente como estaba. Mover esta llamada arriba del `if` le agregaría
// trabajo a la pantalla que menos lo necesita.
//
// La comparación es contra el `agency_id` DEL SERVIDOR, nunca contra nada que
// venga del cliente, y exige `role === "admin"`: un agente común no gestiona la
// suscripción, así que ve el cartel genérico como cualquiera.
async function isViewedByItsAdmin(agencyId: string): Promise<boolean> {
  const session = await resolveAgentSessionIfPresent();
  return (
    session.status === "ok" &&
    session.agent.role === "admin" &&
    session.agent.agency_id === agencyId
  );
}

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
  //
  // ⚠ ACÁ NO SE RECONOCE A NADIE, A PROPÓSITO — incluido el caso nuevo de la
  // dirección vieja liberada (una agencia cambió su dirección y su admin todavía
  // tiene la anterior en un marcador). No se puede saber que esa dirección fue
  // suya: al cambiarla NO se guarda historial ni se redirige, que es la decisión
  // que se tomó al implementarla. Sin ese historial, cualquier mensaje sería una
  // conjetura. Y el admin ya fue advertido en el momento de cambiarla, con las
  // dos direcciones a la vista. Ver el informe para el criterio completo.
  if (result.status === "not_found") {
    notFound();
  }

  // La agencia existe pero su sitio no está disponible. Al visitante le
  // corresponde el cartel neutro; a SU administrador, el motivo y qué hacer.
  if (result.status === "disabled") {
    if (await isViewedByItsAdmin(result.agency.id)) {
      return (
        <AgencyUnavailableForAdmin
          agencyName={result.agency.name}
          reason={result.reason}
        />
      );
    }
    return <AgencyUnavailable />;
  }

  // Activa → mapa filtrado a las propiedades de esta agencia, con su marca
  // (logo/nombre) en el header. Si no hay logo, el header cae al nombre en texto.
  return (
    <AgencyMapView
      city={result.city}
      agencyId={result.agency.id}
      agencyName={result.agency.name}
      agencyLogoUrl={result.agency.logo_url}
    />
  );
}
