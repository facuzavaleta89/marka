"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, MapPin, Bed, Bath, Square, Heart, ImageOff,
  ChevronLeft, ChevronRight, MessageCircle, Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMapFilters } from "@/store/mapFiltersStore";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { generateWaUrl } from "@/lib/utils/waMessage";
import { formatPrice } from "@/lib/utils/formatPrice";
import { cn } from "@/lib/utils";
import type { Property, PropertyImage, Amenity } from "@/types";

// ─── Constantes ───────────────────────────────────────────────

const AMENITY_LABELS: Partial<Record<Amenity, string>> = {
  pileta: "Pileta", quincho: "Quincho", parrilla: "Parrilla",
  gym: "Gym", sum: "SUM", seguridad_24h: "Seguridad 24h",
  portero: "Portero", laundry: "Laundry", solarium: "Solarium",
  jardin: "Jardín", terraza: "Terraza", cochera_cubierta: "Cochera cubierta",
  vista_al_rio: "Vista al río", vista_al_mar: "Vista al mar",
  apto_credito: "Apto crédito", apto_profesional: "Apto profesional",
};

const OPERATION_LABEL: Record<string, string> = {
  venta: "Venta", alquiler: "Alquiler", alquiler_temporal: "Alquiler temporal",
};

const TYPE_LABEL: Record<string, string> = {
  casa: "Casa", departamento: "Departamento", terreno: "Terreno",
  local: "Local", oficina: "Oficina", campo: "Campo", cochera: "Cochera",
};

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
    <div className={cn("relative shrink-0 overflow-hidden bg-black", heightClass)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[idx]?.url}
        alt={`Foto ${idx + 1}`}
        className="w-full h-full object-cover"
      />

      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white disabled:opacity-30"
            aria-label="Foto anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))}
            disabled={idx === images.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white disabled:opacity-30"
            aria-label="Siguiente foto"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  i === idx ? "bg-white" : "bg-white/50"
                )}
              />
            ))}
          </div>
        </>
      )}

      <span className="absolute top-3 right-3 font-sans text-xs text-white bg-black/60 rounded px-2 py-0.5">
        {idx + 1} / {images.length}
      </span>
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
  const inputRef = useRef<HTMLInputElement>(null);
  const fav = isFavorite(property.id);
  const images = (property.images ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  useEffect(() => {
    if (showNameInput) inputRef.current?.focus();
  }, [showNameInput]);

  const handleSendWA = async () => {
    if (!userName.trim() || sending) return;
    setSending(true);

    const supabase = createClient();
    const agent = property.agent as { full_name: string; phone_wa: string } | undefined;

    // Registrar lead (la política RLS permite INSERT público)
    await supabase.from("leads").insert({
      property_id: property.id,
      agent_id: property.agent_id,
      agency_id: property.agency_id,
      contact_name: userName.trim(),
      source: "whatsapp",
    });

    const url = generateWaUrl({
      agentPhone: agent?.phone_wa ?? "",
      userName: userName.trim(),
      propertyTitle: property.title,
      propertyAddress: property.address,
    });
    window.open(url, "_blank", "noopener,noreferrer");

    setSending(false);
    setShowNameInput(false);
    setUserName("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Imágenes */}
      <div className="relative">
        <ImageCarousel
          images={images}
          heightClass="h-[220px] md:h-[260px]"
        />
        <button
          onClick={onClose}
          className="absolute top-3 left-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
        <button
          onClick={() => toggleFavorite(property.id)}
          className={cn(
            "absolute top-3 right-3 p-1.5 rounded-full transition-colors",
            fav
              ? "bg-error text-white"
              : "bg-black/50 text-white hover:bg-black/70"
          )}
          aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
        >
          <Heart size={18} fill={fav ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Cuerpo scrolleable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Tipo + operación */}
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
          {TYPE_LABEL[property.property_type] ?? property.property_type}
          {" · "}
          {OPERATION_LABEL[property.operation_type] ?? property.operation_type}
          {property.is_featured && (
            <span className="ml-2 text-terracota">★ Destacada</span>
          )}
        </p>

        {/* Título */}
        <h2 className="font-serif text-2xl font-semibold text-black leading-snug">
          {property.title}
        </h2>

        {/* Precio */}
        <p className="font-serif text-3xl font-bold text-terracota">
          {formatPrice(property.price, property.currency)}
          {property.price_negotiable && (
            <span className="font-sans text-sm font-normal text-graphite ml-2">
              · Negociable
            </span>
          )}
        </p>

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

        {/* Amenities */}
        {property.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {property.amenities.map((a) => (
              <span
                key={a}
                className="font-sans text-[11px] font-semibold uppercase tracking-wide text-graphite bg-mist rounded-sm px-2 py-0.5"
              >
                {AMENITY_LABELS[a as Amenity] ?? a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Flujo WhatsApp — fijo en la parte inferior */}
      <div className="px-5 py-4 border-t border-stone shrink-0 space-y-2.5">
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
    if (!selectedPropertyId) {
      setProperty(null);
      setDragY(0);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    supabase
      .from("properties")
      .select(
        "*, images:property_images(id, property_id, url, is_cover, sort_order, created_at), agent:agents(full_name, phone_wa, avatar_url)"
      )
      .eq("id", selectedPropertyId)
      .eq("status", "active")
      .single()
      .then(({ data }) => {
        if (data) setProperty(data as unknown as Property);
        setLoading(false);
      });

    // Fire-and-forget: incrementar views_count
    // Nota: requiere una política RLS de UPDATE pública o una función RPC con SECURITY DEFINER.
    // Pendiente de implementar en el schema.
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
          "hidden md:flex flex-col fixed right-0 top-14 bottom-0 w-[420px] bg-white z-[600] shadow-xl",
          "transition-transform duration-220 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-sans text-sm text-graphite">Cargando...</p>
          </div>
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
            "md:hidden fixed bottom-0 inset-x-0 z-[610] bg-white rounded-t-xl shadow-xl",
            "h-[82vh] flex flex-col",
            "transition-transform duration-220 ease-out",
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
            <div className="flex-1 flex items-center justify-center">
              <p className="font-sans text-sm text-graphite">Cargando...</p>
            </div>
          ) : property ? (
            <ModalContent property={property} onClose={close} />
          ) : null}
        </div>
      </>
    </>
  );
}
