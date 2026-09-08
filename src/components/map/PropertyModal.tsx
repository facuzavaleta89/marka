"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X, MapPin, Bed, Bath, Square, Heart, ImageOff,
  ChevronLeft, ChevronRight, MessageCircle, Send, ArrowUpRight,
} from "lucide-react";
import { useMapFilters } from "@/store/mapFiltersStore";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { createClient } from "@/lib/supabase/client";
import { generateWaUrl } from "@/lib/utils/waMessage";
import { formatPrice } from "@/lib/utils/formatPrice";
import { getActiveOperations } from "@/lib/utils/propertyOperations";
import { registerLead, LEAD_ERROR_MESSAGE } from "@/lib/utils/registerLead";
import { AMENITY_ICONS, AMENITY_FALLBACK_ICON } from "@/lib/utils/amenityIcons";
import { propertyUrl } from "@/lib/utils/siteUrl";
import { ShareButton } from "@/components/properties/ShareButton";
import {
  PROPERTY_TYPE_LABELS,
  OPERATION_TYPE_LABELS,
  AMENITY_LABELS,
  RENT_REQUIREMENT_LABELS,
} from "@/lib/utils/labels";
import { cn } from "@/lib/utils";
import type { Property, PropertyImage } from "@/types";

// La tabla de íconos de amenities SE MUDÓ a @/lib/utils/amenityIcons: la página
// pública de la propiedad muestra los mismos chips, y son dieciséis entradas
// exhaustivas por tipo que no se pueden duplicar sin que se desincronicen.

// ─── Carrusel de imágenes ─────────────────────────────────────

function ImageCarousel({
  images,
  heightClass,
}: {
  images: PropertyImage[];
  heightClass: string;
}) {
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-mist shrink-0",
          heightClass
        )}
      >
        <ImageOff size={32} className="text-stone" />
      </div>
    );
  }

  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-mist", heightClass)}>
      {/* Fotos a sangre, apiladas con crossfade (sin corte seco) */}
      {images.map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.id}
          src={img.url}
          alt={`Foto ${i + 1}`}
          draggable={false}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ease-out",
            i === idx ? "opacity-100" : "opacity-0"
          )}
        />
      ))}

      {/* Gradiente inferior sutil para legibilidad de dots/contador */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />

      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-paper/85 backdrop-blur-sm text-graphite shadow-sm transition-colors hover:bg-paper hover:text-black disabled:opacity-0 disabled:pointer-events-none"
            aria-label="Foto anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))}
            disabled={idx === images.length - 1}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-paper/85 backdrop-blur-sm text-graphite shadow-sm transition-colors hover:bg-paper hover:text-black disabled:opacity-0 disabled:pointer-events-none"
            aria-label="Siguiente foto"
          >
            <ChevronRight size={18} />
          </button>

          {/* Dots finos sobre el gradiente */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={cn(
                  "h-1 rounded-full transition-all duration-200",
                  i === idx
                    ? "w-5 bg-paper"
                    : "w-1.5 bg-paper/50 hover:bg-paper/80"
                )}
              />
            ))}
          </div>

          {/* Contador discreto, sin caja */}
          <span className="absolute bottom-2.5 right-3 font-sans text-[11px] tabular-nums text-paper/90">
            {idx + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Skeleton de carga (imita el layout final del modal) ──────

function ModalSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Foto */}
      <div className="h-[220px] md:h-[260px] bg-stone/30 shrink-0" />
      {/* Cuerpo */}
      <div className="flex-1 px-5 py-4 space-y-4">
        <div className="h-2.5 w-24 rounded-sm bg-stone/30" />
        <div className="h-6 w-3/4 rounded bg-stone/30" />
        <div className="h-8 w-40 rounded bg-stone/30" />
        <div className="h-px bg-stone/40" />
        <div className="h-3 w-2/3 rounded-sm bg-stone/30" />
        <div className="flex gap-4">
          <div className="h-3 w-12 rounded-sm bg-stone/30" />
          <div className="h-3 w-12 rounded-sm bg-stone/30" />
          <div className="h-3 w-16 rounded-sm bg-stone/30" />
        </div>
        <div className="space-y-2 pt-1">
          <div className="h-3 w-full rounded-sm bg-stone/30" />
          <div className="h-3 w-full rounded-sm bg-stone/30" />
          <div className="h-3 w-4/5 rounded-sm bg-stone/30" />
        </div>
      </div>
      {/* Footer — imita el layout real (DESIGN §5: "skeleton que imita el
          layout"), o sea el bloque de quién publica ENCIMA del botón. Modelaba
          solo el botón, y desde que abajo hay dos cosas eso dejaba el skeleton
          ~42px más bajo que el contenido: al resolver la carga, el cuerpo se
          encogía de golpe y todo saltaba. */}
      <div className="px-5 py-4 border-t border-stone shrink-0 space-y-2.5">
        {/* Quién publica: logo + las dos líneas de texto */}
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-16 shrink-0 rounded-sm bg-stone/30" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded-sm bg-stone/30" />
            <div className="h-2.5 w-24 rounded-sm bg-stone/30" />
          </div>
        </div>
        {/* Botón de contacto */}
        <div className="h-11 w-full rounded-md bg-stone/30" />
      </div>
    </div>
  );
}

// ─── Contenido del modal ──────────────────────────────────────

function ModalContent({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const [expanded, setExpanded] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [userName, setUserName] = useState("");
  const [sending, setSending] = useState(false);
  // El registro de la consulta puede fallar sin que eso impida contactar. Ver
  // handleSendWA: el mensaje avisa, no bloquea.
  const [leadError, setLeadError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fav = isFavorite(property.id);
  const images = (property.images ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  // Operaciones activas en orden de prioridad (venta → alquiler → temporal).
  // Alimentan el kicker y el bloque de precios.
  const operations = getActiveOperations(property);

  const agent = property.agent as
    | { full_name: string; phone_wa: string }
    | undefined;
  const agentPhone = agent?.phone_wa ?? "";
  const hasPhone = agentPhone.trim() !== "";

  // Quién publica. Mismo molde de cast que el agente de arriba, y por el mismo
  // motivo: el embed trae DOS columnas (name, logo_url) pero `Property.agency`
  // está declarado como `Agency` COMPLETO. Como el resultado de la consulta se
  // castea por `unknown`, tipar esto como `Agency` haría que el compilador
  // creyera que están las doce columnas: leer `agency.phone_wa` compilaría sin
  // una queja y daría `undefined` en runtime. El cast al subconjunto REAL es lo
  // único que mantiene el tipo alineado con lo que el select pide.
  const agency = property.agency as
    | { name: string; logo_url: string | null }
    | undefined;
  const agentName = agent?.full_name?.trim() ?? "";

  useEffect(() => {
    if (showNameInput) inputRef.current?.focus();
  }, [showNameInput]);

  const handleSendWA = async () => {
    if (!userName.trim() || sending) return;

    const url = generateWaUrl({
      agentPhone,
      userName: userName.trim(),
      propertyTitle: property.title,
      propertyAddress: property.address,
    });
    // Sin número configurado no registramos lead ni abrimos un link roto
    if (!url) return;

    setSending(true);
    setLeadError(false);

    // Registrar la consulta. El insert SE MUDÓ a @/lib/utils/registerLead cuando
    // apareció la segunda pantalla que contacta por WhatsApp (la página pública
    // de la propiedad): ahí viven, escritas, las cuatro decisiones que lleva
    // encima —y la más frágil de las cuatro es una OMISIÓN (`agent_name` NO se
    // manda: lo escribe el trigger de la base), que copiada a mano se pierde sin
    // que nada falle—. Las tres decisiones que le tocan al llamador se respetan
    // acá abajo, una por una.
    const registered = await registerLead({
      propertyId: property.id,
      agentId: property.agent_id,
      agencyId: property.agency_id,
      contactName: userName,
    });

    // Decisión 1: incondicional y fuera de toda rama de error. La operación
    // principal ACÁ es el contacto, no el registro: el lead es para la agencia,
    // no para el visitante, y no puede ser la razón por la que alguien no llegue
    // a escribirle a una inmobiliaria.
    window.open(url, "_blank", "noopener,noreferrer");

    setSending(false);
    setLeadError(!registered);
    // Decisión 3: con error el flujo NO se cierra — el aviso se muestra donde el
    // visitante está mirando. Sin error, vuelve al estado inicial como siempre.
    if (registered) {
      setShowNameInput(false);
      setUserName("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Imágenes + controles flotantes */}
      <div className="relative">
        <ImageCarousel
          images={images}
          heightClass="h-[220px] md:h-[260px]"
        />
        <button
          onClick={onClose}
          className="absolute top-3 left-3 flex items-center justify-center w-9 h-9 rounded-full bg-paper/85 backdrop-blur-sm text-graphite shadow-sm transition-colors hover:bg-paper hover:text-black"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
        {/* Favorito y compartir, apareados a la derecha.
            ⚠ EL DE COMPARTIR VA ACÁ, SOBRE LA FOTO, Y NO EN LA ZONA INFERIOR.
            Esa zona es `shrink-0` dentro de un contenedor de alto FIJO en
            celular (`h-[82vh]`), así que todo lo que se le agrega se lo resta al
            área que scrollea — que después del bloque "quién publica" quedó en
            unos 177px en un teléfono chico. Otra fila de 44px la dejaría en
            menos de dos párrafos. Acá, en cambio, los botones son `absolute`
            sobre el carrusel: no cuestan un solo píxel de alto.
            `relative` en el contenedor: el fallback manual del ShareButton se
            ancla debajo del botón, y necesita este bloque como referencia. */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <ShareButton
            url={propertyUrl(property.slug)}
            title={property.title}
            text={`${property.title} — ${property.address}`}
            variant="icon"
          />
          <button
            onClick={() => toggleFavorite(property.id)}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-paper/85 backdrop-blur-sm shadow-sm transition-colors hover:bg-paper"
            aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
          >
            <Heart
              size={18}
              className={cn(fav ? "text-terracota" : "text-graphite")}
              fill={fav ? "currentColor" : "none"}
            />
          </button>
        </div>

        {/* ── Puerta a la ficha completa ───────────────────────────
            El modal es un resumen; la página es la ficha entera, y hasta ahora
            no había NINGUNA forma de llegar a ella desde la app: solo escribiendo
            la dirección a mano.

            ⚠ NO ES EL TÍTULO CONVERTIDO EN ENLACE. El modal vive sobre el mapa,
            donde el visitante está explorando: un título clickeable se toca por
            accidente y lo saca del mapa sin que lo haya pedido. Un botón con
            texto explícito no tiene esa ambigüedad.

            ⚠ Y NO VA EN LA ZONA INFERIOR, aunque sea el lugar "natural" de un
            CTA. Esa zona es `shrink-0` dentro de un sheet de alto FIJO
            (`h-[82vh]`), así que cada píxel que se le agrega se lo resta al área
            que scrollea — que en un teléfono chico ya está en ~177px. Un botón
            de 44px más su separación de 10px la dejaría en ~123px: menos de dos
            párrafos, para una ficha que tiene descripción, comodidades y
            requisitos. La cuenta está en el informe.

            Acá, sobre la foto, cuesta CERO alto (es `absolute`) y se ve sin
            scrollear, que es lo que necesita una puerta. La esquina inferior
            izquierda estaba libre: los dots del carrusel van centrados y el
            contador abajo a la derecha. Se apoya en el gradiente que el carrusel
            ya dibuja para legibilidad, y usa el mismo tratamiento
            `paper/85 + backdrop-blur` que los otros tres botones flotantes. */}
        <Link
          href={`/propiedades/${property.slug}`}
          className="absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 rounded-md bg-paper/85 px-2.5 py-1.5 font-sans text-xs font-medium text-graphite shadow-sm backdrop-blur-sm transition-colors hover:bg-paper hover:text-black"
        >
          Ver ficha completa
          <ArrowUpRight size={14} />
        </Link>
      </div>

      {/* Cuerpo scrolleable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Tipo + TODAS las operaciones activas ("Casa · Venta · Alquiler") */}
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
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

        {/* Título */}
        <h2 className="font-serif text-2xl font-semibold text-black leading-snug">
          {property.title}
        </h2>

        {/* Precios — el modal es el ÚNICO lugar que muestra las operaciones con
            sus precios completos (el pin y la card muestran uno solo). El par
            operación-precio es una unidad repetible: una línea por operación
            activa. La etiqueta solo aparece cuando hay más de una — con una
            sola, el bloque queda idéntico al de antes de que una propiedad
            pudiera tener varias. El precio sigue siendo el elemento dominante
            (DESIGN §5: Noto Serif 32px bold terracota). */}
        <div className="space-y-2.5">
          {operations.map((o) => (
            <div key={o.operation}>
              {operations.length > 1 && (
                <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  {OPERATION_TYPE_LABELS[o.operation]}
                </p>
              )}
              <p className="font-serif text-3xl font-bold text-terracota">
                {formatPrice(o.price, o.currency)}
              </p>
            </div>
          ))}
        </div>

        {/* Ubicación */}
        <div className="flex items-start gap-1.5 text-graphite">
          <MapPin size={15} className="mt-0.5 shrink-0" />
          <p className="font-sans text-sm">
            {property.address}
            {property.neighborhood ? `, ${property.neighborhood}` : ""}
          </p>
        </div>

        {/* Métricas */}
        <div className="flex items-center gap-4 text-graphite">
          {property.bedrooms > 0 && (
            <span className="flex items-center gap-1.5 font-sans text-sm">
              <Bed size={15} /> {property.bedrooms}
            </span>
          )}
          {property.bathrooms > 0 && (
            <span className="flex items-center gap-1.5 font-sans text-sm">
              <Bath size={15} /> {property.bathrooms}
            </span>
          )}
          {property.area_covered_m2 && (
            <span className="flex items-center gap-1.5 font-sans text-sm">
              <Square size={15} /> {property.area_covered_m2} m²
            </span>
          )}
        </div>

        {/* Descripción */}
        {property.description && (
          <div>
            <p
              className={cn(
                "font-sans text-[15px] text-graphite leading-relaxed",
                !expanded && "line-clamp-4"
              )}
            >
              {property.description}
            </p>
            {property.description.length > 200 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="font-sans text-sm text-terracota hover:underline mt-1"
              >
                {expanded ? "Ver menos" : "Ver más"}
              </button>
            )}
          </div>
        )}

        {/* Amenities — chips con ícono */}
        {property.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {property.amenities.map((a) => {
              const Icon = AMENITY_ICONS[a] ?? AMENITY_FALLBACK_ICON;
              return (
                <span
                  key={a}
                  className="inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-wide text-graphite bg-mist rounded-sm pl-1.5 pr-2 py-1"
                >
                  <Icon size={16} className="text-graphite shrink-0" />
                  {AMENITY_LABELS[a]}
                </span>
              );
            })}
          </div>
        )}

        {/* Requisitos para alquilar.
            Solo si la propiedad se ofrece en alquiler Y cargó algún requisito:
            una propiedad solo en venta no tiene por qué mostrar la sección, y
            una en alquiler sin requisitos cargados tampoco (un encabezado sobre
            nada no informa). Lleva encabezado propio porque, a diferencia de los
            amenities, no se entiende qué son sin decirlo. */}
        {(property.for_rent || property.for_temp_rent) &&
          (property.rent_requirements.length > 0 ||
            property.rent_requirements_other.length > 0) && (
            <div className="space-y-2 pt-1">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
                Requisitos para alquilar
              </p>

              {/* UNA sola grilla de chips: primero los de la lista cerrada,
                  después los libres, con el mismo tratamiento.
                  Los libres se mostraban como texto corrido con una hairline al
                  costado, cuando eran UN texto que podía ser una frase entera.
                  Ahora que son ítems cortos y contables (hasta 5), esa
                  diferencia visual dejó de tener sentido: distinguir dos cosas
                  que el visitante lee igual solo agrega ruido.
                  SIN ícono, a diferencia de los amenities: allá cada ícono es
                  distinto y por eso informa, acá sería el mismo repetido en cada
                  chip, o sea decoración (DESIGN §1). */}
              <div className="flex flex-wrap gap-1.5">
                {property.rent_requirements.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center font-sans text-[11px] font-semibold uppercase tracking-wide text-graphite bg-mist rounded-sm px-2 py-1"
                  >
                    {RENT_REQUIREMENT_LABELS[r]}
                  </span>
                ))}
                {property.rent_requirements_other.map((r, i) => (
                  <span
                    key={`other-${i}`}
                    className="inline-flex items-center font-sans text-[11px] font-semibold uppercase tracking-wide text-graphite bg-mist rounded-sm px-2 py-1"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Flujo WhatsApp — fijo en la parte inferior */}
      <div className="px-5 py-4 border-t border-stone shrink-0 space-y-2.5">
        {/* ── Quién publica ────────────────────────────────────────
            La inmobiliaria y la persona que va a atender la consulta. Antes el
            visitante veía fotos, precio y un botón verde, y con eso tenía que
            decidir si le escribía a un número desconocido.

            ⚠ VA ACÁ, HERMANO DEL TERNARIO DE ABAJO, NO ADENTRO DE UNA DE SUS
            RAMAS. El ternario elige entre "se puede contactar" y "el agente no
            cargó su número", y el bloque tiene que verse en LAS DOS: la agencia
            cuyo agente no dejó teléfono es justamente de la que el visitante más
            necesita saber quién es, porque va a tener que buscarla por otro lado.

            Va abajo y no arriba a propósito: arriba competiría con el precio,
            que es lo primero que el ojo tiene que encontrar (DESIGN §1).

            El nombre de la agencia NO es un enlace. Solo algunos planes tienen
            sitio propio y ese sitio se puede deshabilitar por varios motivos, así
            que el enlace llevaría a veces a una página de "no disponible": un
            nombre que a veces lleva a algún lado y a veces no es una
            inconsistencia que el visitante ve.

            SIN foto del agente, aunque la consulta traiga su avatar: decisión de
            producto, no un olvido. */}
        {agency && (
          <div className="flex items-center gap-2.5">
            {/* El logo solo existe si la agencia lo subió, y NUEVE DE CADA DIEZ no
                lo hicieron: el caso sin logo es el normal, no el borde. Cuando
                falta, el bloque de texto se corre solo a la izquierda y el nombre
                ocupa el lugar que habría tenido el logo — sin hueco, sin caja
                vacía y sin ningún cartel que anuncie la ausencia (eso es una
                carencia administrativa de la agencia, no algo que al visitante le
                sirva saber).

                Dimensiones tomadas del header del sitio de marca
                (AgencyMapView): altura fija + ancho automático + object-contain,
                que tolera cualquier proporción de logo sin deformarlo ni alterar
                el alto de la fila. Acá va h-8 y no h-9 porque este bloque le
                resta altura al área que scrollea (el sheet de celular tiene alto
                fijo), y max-w acota los logos muy anchos para que le dejen lugar
                al texto. */}
            {agency.logo_url && (
              // alt vacío A PROPÓSITO: el nombre de la agencia está en el mismo
              // bloque, a 10px de acá. Ponerle el nombre al alt —como sí hace
              // AgencyMapView, donde el nombre vive lejos, en el centro del
              // header— haría que un lector de pantalla lo dijera dos veces
              // seguidas. La imagen acá es decorativa: el dato es el texto.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agency.logo_url}
                alt=""
                className="h-8 w-auto max-w-[96px] shrink-0 object-contain"
              />
            )}

            {/* min-w-0 + truncate: un nombre largo se corta con elipsis en vez de
                empujar el logo fuera de la fila. */}
            <div className="min-w-0">
              <p className="font-serif text-sm font-semibold text-black leading-tight truncate">
                {agency.name}
              </p>
              {agentName && (
                <p className="font-sans text-xs text-graphite leading-tight truncate">
                  Atiende {agentName}
                </p>
              )}
            </div>
          </div>
        )}

        {!hasPhone ? (
          // El agente no configuró su número → no se puede contactar por WA
          <div className="text-center">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 h-11 font-sans text-sm font-medium text-graphite bg-stone rounded-md cursor-not-allowed"
            >
              <MessageCircle size={18} />
              Consultar por WhatsApp
            </button>
            <p className="font-sans text-xs text-graphite mt-2">
              Este agente no tiene número de WhatsApp configurado.
            </p>
          </div>
        ) : (
          <>
            {/* Input de nombre (aparece con animación) */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-200 ease-out",
                showNameInput ? "max-h-14 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <input
                ref={inputRef}
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendWA()}
                placeholder="Tu nombre"
                className="w-full h-10 px-3 font-sans text-sm text-black placeholder:text-stone bg-white border border-stone rounded-md outline-none focus:border-graphite focus:ring-2 focus:ring-terracota/20"
              />
            </div>

            {!showNameInput ? (
              <button
                onClick={() => setShowNameInput(true)}
                className="w-full flex items-center justify-center gap-2 h-11 font-sans text-sm font-medium text-white bg-whatsapp hover:bg-whatsapp-hover rounded-md transition-colors"
              >
                <MessageCircle size={18} />
                Consultar por WhatsApp
              </button>
            ) : (
              <button
                onClick={handleSendWA}
                disabled={!userName.trim() || sending}
                className="w-full flex items-center justify-center gap-2 h-11 font-sans text-sm font-medium text-white bg-whatsapp hover:bg-whatsapp-hover rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                {sending ? "Enviando..." : "Enviar mensaje"}
              </button>
            )}

            {/* El contacto salió (WhatsApp ya se abrió), pero la consulta no
                quedó registrada. Se avisa para que un problema sistemático no
                pase inadvertido, sin dramatizar: al visitante no le falta nada,
                ya tiene abierto el chat. Mismo tratamiento discreto que el
                storageError de ImageUploader (texto xs, sin caja ni ícono).
                DESIGN §10: dice qué pasó y qué hacer, sin retar a nadie. */}
            {leadError && (
              <p className="font-sans text-xs text-graphite" role="status">
                {LEAD_ERROR_MESSAGE}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────

export function PropertyModal() {
  const { selectedPropertyId, setSelectedProperty } = useMapFilters();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const isOpen = selectedPropertyId !== null;

  // Swipe down to close (mobile)
  const touchStartY = useRef<number>(0);
  const [dragY, setDragY] = useState(0);

  const close = () => setSelectedProperty(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // setState dentro del flujo async (no en el cuerpo del efecto)
      if (!selectedPropertyId) {
        setProperty(null);
        setDragY(0);
        return;
      }

      setLoading(true);
      const supabase = createClient();

      const { data } = await supabase
        .from("properties")
        // ⚠ DEL EMBED DE `agencies` SE NOMBRAN SOLO LAS DOS COLUMNAS QUE SE
        // USAN, y no es prolijidad: la policy `Public read agencies` tiene
        // `qual: true`, o sea que cualquiera con la anon key —la que va en el
        // bundle de JavaScript— puede leer esa tabla entera, y Postgres no
        // permite restringir columnas dentro de una policy. Lo único que acota
        // qué se expone es esta lista. Ahí viven `phone_wa`, `license_number` y
        // `approval_status`: un `agency:agencies(*)` los publicaría a cualquier
        // visitante anónimo.
        //
        // Se embebe acá, en la consulta que el modal YA hace, y no en una
        // consulta aparte: la segunda necesitaría el agency_id que sale de ésta,
        // así que sería secuencial y el bloque aparecería recién después de que
        // el resto del modal ya está pintado — además de estrenar un camino de
        // red que puede fallar por su cuenta.
        //
        // La consulta del mapa (useProperties) NO se toca: es la query caliente
        // y este dato solo se usa al abrir un modal.
        .select(
          "*, images:property_images(id, property_id, url, is_cover, sort_order, created_at), agent:agents(full_name, phone_wa, avatar_url), agency:agencies(name, logo_url)"
        )
        .eq("id", selectedPropertyId)
        .eq("status", "active")
        .single();

      if (cancelled) return;
      if (data) setProperty(data as unknown as Property);
      setLoading(false);

      // Fire-and-forget: incrementar views_count
      // Nota: requiere una política RLS de UPDATE pública o una función RPC con SECURITY DEFINER.
      // Pendiente de implementar en el schema.
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPropertyId]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = Math.max(0, e.touches[0].clientY - touchStartY.current);
    setDragY(diff);
  };
  const handleTouchEnd = () => {
    if (dragY > 120) close();
    else setDragY(0);
  };

  return (
    <>
      {/* ── Desktop: right drawer ── */}
      <div
        className={cn(
          "hidden md:flex flex-col fixed right-0 top-14 bottom-0 w-[420px] bg-paper z-[600] shadow-xl",
          "transition-transform duration-[220ms] ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {loading ? (
          <ModalSkeleton />
        ) : property ? (
          <ModalContent property={property} onClose={close} />
        ) : null}
      </div>

      {/* ── Mobile: bottom sheet ── */}
      <>
        {isOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-[600]"
            onClick={close}
            aria-hidden="true"
          />
        )}
        <div
          className={cn(
            "md:hidden fixed bottom-0 inset-x-0 z-[610] bg-paper rounded-t-xl shadow-xl",
            "h-[82vh] flex flex-col",
            "transition-transform duration-[220ms] ease-out",
            isOpen ? "translate-y-0" : "translate-y-full"
          )}
          style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Handle de arrastre */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-stone rounded-full" />
          </div>

          {loading ? (
            <ModalSkeleton />
          ) : property ? (
            <ModalContent property={property} onClose={close} />
          ) : null}
        </div>
      </>
    </>
  );
}
