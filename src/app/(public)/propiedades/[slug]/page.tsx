import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Bed, Bath, Square, ArrowLeft, Map as MapIcon } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { PropertyContact } from "@/components/properties/PropertyContact";
import { PropertyUnavailable } from "@/components/properties/PropertyUnavailable";
import { ShareButton } from "@/components/properties/ShareButton";
import { StaticMap } from "@/components/properties/StaticMap";
import {
  resolvePropertyBySlug,
  getCoverImage,
  type PublicProperty,
} from "@/lib/utils/resolvePropertyBySlug";
import { propertyUrl } from "@/lib/utils/siteUrl";
import { formatPrice } from "@/lib/utils/formatPrice";
import { getActiveOperations } from "@/lib/utils/propertyOperations";
import { AMENITY_ICONS, AMENITY_FALLBACK_ICON } from "@/lib/utils/amenityIcons";
import {
  PROPERTY_TYPE_LABELS,
  OPERATION_TYPE_LABELS,
  AMENITY_LABELS,
  RENT_REQUIREMENT_LABELS,
} from "@/lib/utils/labels";

// ─── Página pública de una propiedad ──────────────────────────
//
// Server Component. Es la razón de ser de toda la tanda: si esto se armara en el
// navegador, un buscador vería una página vacía y no habría nada que indexar.
// Lo único que baja como isla de cliente es lo que necesita estado: el flujo de
// contacto y el botón de compartir. Las fotos, la descripción completa, los
// precios y el mapa están en el HTML.
//
// ⚠ LA RUTA LLEVA PREFIJO `/propiedades/` Y NO PUEDE NO LLEVARLO. En el primer
// nivel ya vive `src/app/(public)/[slug]/page.tsx` (el sitio de marca de una
// agencia), y dos rutas dinámicas hermanas en el mismo nivel son ambiguas: el
// framework no las admite. No es una preferencia de estilo.
//
// Toda la lógica de decidir si la propiedad se puede mostrar vive en
// `resolvePropertyBySlug`, no acá. Esta página solo bifurca según el estado.

// El resolvedor está envuelto en `cache()` de React, así que estas DOS llamadas
// —la de la metadata y la del render— comparten una sola consulta y un solo RPC
// por request.
export async function generateMetadata({
  params,
}: {
  // En Next.js 16 `params` es una Promise y hay que esperarla. Verificado en la
  // documentación oficial de generateMetadata.
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await resolvePropertyBySlug(slug);

  // ⚠ LOS DOS ESTADOS QUE NO SE MUESTRAN VAN CON `noindex`, y no es redundante
  // con el mapa del sitio. Aquel decide qué se OFRECE a un buscador; esto decide
  // qué pasa cuando el buscador llega igual — por un enlace compartido, o porque
  // la propiedad se dio de baja después de haber sido indexada. Sin esto,
  // Google conservaría en su índice la página de "ya no está publicada".
  if (result.status !== "available") {
    return {
      title: "Propiedad no disponible",
      robots: { index: false, follow: true },
    };
  }

  const { property } = result;
  const url = propertyUrl(slug);
  const cover = getCoverImage(property.images);
  const description = buildDescription(property);

  return {
    title: property.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "Marka",
      title: property.title,
      description,
      // La foto de portada de la propiedad, no una imagen genérica. Es una URL
      // absoluta del bucket público de Storage, así que `metadataBase` no
      // interviene (la documentación dice que un campo con URL absoluta lo
      // ignora). Sin fotos se cae al ícono de la app, que sí es relativa y por
      // eso `metadataBase` TIENE que estar seteada en la disposición raíz.
      images: cover ? [{ url: cover.url, alt: property.title }] : ["/icon-512.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: property.title,
      description,
    },
  };
}

// Descripción corta para la vista previa del enlace y para el resultado de
// búsqueda: tipo, operaciones, precio y ubicación, que es lo que decide si
// alguien abre. Se arma con los mismos helpers que la pantalla, no a mano.
function buildDescription(property: PublicProperty): string {
  const operations = getActiveOperations(property);
  const partes: string[] = [
    `${PROPERTY_TYPE_LABELS[property.property_type]} en ${operations
      .map((o) => OPERATION_TYPE_LABELS[o.operation].toLowerCase())
      .join(" y ")}`,
  ];

  // El precio de la primera operación por prioridad (venta → alquiler →
  // temporal). Si no tiene, `formatPrice` devuelve "A convenir", que también es
  // información útil acá.
  const first = operations[0];
  if (first) partes.push(formatPrice(first.price, first.currency));

  const ubicacion = [property.neighborhood, property.city]
    .filter(Boolean)
    .join(", ");
  if (ubicacion) partes.push(ubicacion);

  const metricas: string[] = [];
  if (property.bedrooms > 0) metricas.push(`${property.bedrooms} amb`);
  if (property.bathrooms > 0) metricas.push(`${property.bathrooms} baños`);
  if (property.area_covered_m2) metricas.push(`${property.area_covered_m2} m²`);
  if (metricas.length > 0) partes.push(metricas.join(", "));

  return partes.join(" · ");
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await resolvePropertyBySlug(slug);

  // Slug inexistente → 404 real. La propiedad nunca existió.
  if (result.status === "not_found") {
    notFound();
  }

  // Existe pero no se puede mostrar (pausada/vendida/alquilada, o su agencia no
  // está al día) → estado propio, NUNCA un 404: quien recibió el enlace pensaría
  // que estaba roto.
  if (result.status === "unavailable") {
    return <PropertyUnavailable />;
  }

  const { property } = result;
  const url = propertyUrl(slug);
  const operations = getActiveOperations(property);
  const agent = property.agent;
  const agency = property.agency;
  const agentName = agent?.full_name?.trim() ?? "";

  const ubicacion = [property.address, property.neighborhood]
    .filter(Boolean)
    .join(", ");

  const hasRequirements =
    (property.for_rent || property.for_temp_rent) &&
    (property.rent_requirements.length > 0 ||
      property.rent_requirements_other.length > 0);

  return (
    // ⚠ `h-dvh overflow-y-auto` Y NO `min-h-dvh`: ESTA PANTALLA TIENE QUE TRAER
    // SU PROPIO CONTENEDOR SCROLLEABLE.
    //
    // El proyecto bloquea el scroll del DOCUMENTO a nivel raíz
    // (`globals.css`: `html, body { height: 100%; overflow: hidden }`), y no es
    // un descuido: sin scroll de documento, el "scroll into view" del navegador
    // al enfocar un input no tiene a dónde desplazar, y por eso el header del
    // mapa dejó de descolocarse en celulares. La contrapartida está documentada
    // en CLAUDE.md — "toda pantalla nueva necesita su propio contenedor
    // scrolleable interno" — y esta página nació sin él: el contenido estaba en
    // el documento pero era INALCANZABLE de la mitad para abajo (ni el bloque de
    // contacto, ni el mapa, ni el pie).
    //
    // `min-h-dvh` era justamente el error: deja crecer el elemento más allá del
    // viewport y delega el scroll al documento… que no scrollea. `h-dvh` lo fija
    // a una pantalla y `overflow-y-auto` le da su propio scroll adentro.
    //
    // Es EXACTAMENTE el precedente de `AuthLayout` (`flex h-dvh flex-col
    // overflow-y-auto`), la otra pantalla que dependía del scroll del documento
    // y a la que hubo que darle uno propio.
    //
    // El `sticky top-0` del header sigue funcionando: se ancla al tope de ESTE
    // contenedor, que ahora es el que scrollea.
    <div className="h-dvh overflow-y-auto bg-paper">
      {/* Header mínimo, misma altura y tratamiento que el del mapa público. */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-stone bg-paper px-4 md:px-6">
        <Link href="/" aria-label="Ir al mapa">
          <Wordmark size="md" variant="dark" />
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 font-sans text-sm font-medium text-graphite transition-colors hover:text-black"
        >
          <ArrowLeft size={16} />
          Volver al mapa
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        {/* ── 1. Fotos ─────────────────────────────────────────── */}
        <PropertyGallery images={property.images} title={property.title} />

        {/* ── 2. Tipo + todas las operaciones activas ───────────── */}
        <p className="mt-6 font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
          {PROPERTY_TYPE_LABELS[property.property_type]}
          {operations.map((o) => (
            <span key={o.operation}>
              {" · "}
              {OPERATION_TYPE_LABELS[o.operation]}
            </span>
          ))}
          {property.is_featured && (
            <span className="ml-2 text-terracota">★ Destacada</span>
          )}
        </p>

        {/* ── 3. Título ─────────────────────────────────────────── */}
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-black md:text-4xl">
          {property.title}
        </h1>

        {/* ── 4. Precios por operación ───────────────────────────
            Es lo primero que el ojo tiene que encontrar después de las fotos, y
            acá tiene toda la columna para lograrlo: 40px contra los 32 del
            modal, donde compite con un botón a 200px. La etiqueta de la
            operación solo aparece cuando hay más de una. */}
        <div className="mt-4 space-y-3">
          {operations.map((o) => (
            <div key={o.operation}>
              {operations.length > 1 && (
                <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  {OPERATION_TYPE_LABELS[o.operation]}
                </p>
              )}
              <p className="font-serif text-[40px] font-bold leading-none text-terracota">
                {formatPrice(o.price, o.currency)}
              </p>
            </div>
          ))}
        </div>

        {/* ── 5. Ubicación ──────────────────────────────────────── */}
        <div className="mt-6 flex items-start gap-1.5 text-graphite">
          <MapPin size={16} className="mt-0.5 shrink-0" />
          <p className="font-sans text-[15px]">
            {ubicacion}
            {property.city ? ` — ${property.city}` : ""}
          </p>
        </div>

        {/* ── 6. Métricas ───────────────────────────────────────── */}
        {(property.bedrooms > 0 ||
          property.bathrooms > 0 ||
          property.area_covered_m2) && (
          <div className="mt-3 flex flex-wrap items-center gap-5 text-graphite">
            {property.bedrooms > 0 && (
              <span className="flex items-center gap-1.5 font-sans text-sm">
                <Bed size={16} /> {property.bedrooms} ambientes
              </span>
            )}
            {property.bathrooms > 0 && (
              <span className="flex items-center gap-1.5 font-sans text-sm">
                <Bath size={16} /> {property.bathrooms} baños
              </span>
            )}
            {property.area_covered_m2 && (
              <span className="flex items-center gap-1.5 font-sans text-sm">
                <Square size={16} /> {property.area_covered_m2} m² cubiertos
              </span>
            )}
          </div>
        )}

        {/* ── 7. Descripción COMPLETA ────────────────────────────
            ⚠ SIN "ver más" Y SIN RECORTE. En el modal se recorta con
            `line-clamp-4` y un botón que vive en un `useState`; acá el texto
            entero tiene que estar en el documento, porque es justamente lo que
            un buscador lee. `whitespace-pre-line` respeta los saltos de línea
            que el agente escribió. */}
        {property.description && (
          <div className="mt-6 border-t border-stone pt-6">
            <p className="whitespace-pre-line font-sans text-[15px] leading-relaxed text-graphite">
              {property.description}
            </p>
          </div>
        )}

        {/* ── 8. Comodidades ────────────────────────────────────── */}
        {property.amenities.length > 0 && (
          <div className="mt-6 border-t border-stone pt-6">
            <h2 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
              Comodidades
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {property.amenities.map((a) => {
                const Icon = AMENITY_ICONS[a] ?? AMENITY_FALLBACK_ICON;
                return (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-mist py-1 pl-1.5 pr-2 font-sans text-[11px] font-semibold uppercase tracking-wide text-graphite"
                  >
                    <Icon size={16} className="shrink-0 text-graphite" />
                    {AMENITY_LABELS[a]}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 9. Requisitos para alquilar ───────────────────────── */}
        {hasRequirements && (
          <div className="mt-6 border-t border-stone pt-6">
            <h2 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
              Requisitos para alquilar
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {property.rent_requirements.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center rounded-sm bg-mist px-2 py-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-graphite"
                >
                  {RENT_REQUIREMENT_LABELS[r]}
                </span>
              ))}
              {property.rent_requirements_other.map((r, i) => (
                <span
                  key={`other-${i}`}
                  className="inline-flex items-center rounded-sm bg-mist px-2 py-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-graphite"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── 10 y 11. Quién publica + contacto ──────────────────
            Van juntos en un bloque sobre `mist`, que es lo que los separa del
            resto de la columna sin necesidad de una caja con borde: acá es la
            zona de acción, y en una página larga tiene que encontrarse de un
            vistazo (en el modal esto no hacía falta: estaba siempre a la vista,
            fijo abajo). */}
        <section className="mt-8 rounded-lg bg-mist p-5">
          {agency && (
            <div className="flex items-center gap-3">
              {agency.logo_url && (
                // alt vacío: el nombre está al lado, en el mismo bloque. Mismo
                // criterio que el bloque "quién publica" del modal.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agency.logo_url}
                  alt=""
                  className="h-10 w-auto max-w-[120px] shrink-0 object-contain"
                />
              )}
              <div className="min-w-0">
                <p className="truncate font-serif text-base font-semibold leading-tight text-black">
                  {agency.name}
                </p>
                {agentName && (
                  <p className="truncate font-sans text-xs leading-tight text-graphite">
                    Atiende {agentName}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4">
            <PropertyContact
              propertyId={property.id}
              agentId={property.agent_id}
              agencyId={property.agency_id}
              propertyTitle={property.title}
              propertyAddress={property.address}
              agentPhone={agent?.phone_wa ?? ""}
            />
          </div>

          <div className="mt-3">
            <ShareButton
              url={url}
              title={property.title}
              text={buildDescription(property)}
              variant="button"
              className="w-full [&>button]:w-full [&>button]:justify-center"
            />
          </div>
        </section>

        {/* ── 12. Ubicación en el mapa ──────────────────────────── */}
        <div className="mt-8">
          <h2 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
            Dónde queda
          </h2>
          <div className="mt-3">
            <StaticMap
              lat={property.lat}
              lng={property.lng}
              label={`Mapa de la ubicación de ${property.title} en ${ubicacion}`}
            />
          </div>
        </div>

        {/* ── 13. Vuelta al mapa general ────────────────────────── */}
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-stone px-4 font-sans text-sm font-medium text-black transition-colors hover:bg-mist"
          >
            <MapIcon size={16} />
            Ver todas las propiedades en el mapa
          </Link>
        </div>
      </main>
    </div>
  );
}
