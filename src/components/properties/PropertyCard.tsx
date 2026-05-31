"use client";

import { Heart, MapPin, Bed, Bath, Square, ImageOff } from "lucide-react";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { formatPrice } from "@/lib/utils/formatPrice";
import {
  PROPERTY_TYPE_LABELS,
  OPERATION_TYPE_LABELS,
} from "@/lib/utils/labels";
import { cn } from "@/lib/utils";
import type { Property } from "@/types";

// Subconjunto que la card necesita. Tipado explícito (no `Property` completo)
// para que sea reutilizable desde cualquier fuente que provea estos campos
// — ej: a futuro, un panel de resultados desktop sincronizado con el mapa.
export type PropertyCardData = Pick<
  Property,
  | "id"
  | "title"
  | "property_type"
  | "operation_type"
  | "price"
  | "currency"
  | "is_featured"
  | "neighborhood"
  | "city"
  | "bedrooms"
  | "bathrooms"
  | "area_covered_m2"
  | "images"
>;

interface PropertyCardProps {
  property: PropertyCardData;
  /** Qué hace el click en la card (ej: abrir el PropertyModal de esa propiedad) */
  onSelect: () => void;
  className?: string;
}

export function PropertyCard({
  property,
  onSelect,
  className,
}: PropertyCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(property.id);

  const cover =
    property.images?.find((i) => i.is_cover) ?? property.images?.[0];
  const location = [property.neighborhood, property.city]
    .filter(Boolean)
    .join(", ");

  const hasMetrics =
    property.bedrooms > 0 ||
    property.bathrooms > 0 ||
    property.area_covered_m2 != null;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-lg border border-stone bg-paper",
        // Elevación magnética sutil en desktop (DESIGN §8: 120ms ease-out)
        "transition duration-[120ms] ease-out",
        "md:hover:-translate-y-0.5 md:hover:border-graphite md:hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40",
        className
      )}
    >
      {/* ── Imagen de portada (180px) ── */}
      <div className="relative h-[180px] w-full bg-mist">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={property.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff size={28} className="text-stone" />
          </div>
        )}

        {/* Favorito — esquina superior izquierda (no choca con "Destacada") */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(property.id);
          }}
          className="absolute top-2.5 left-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-paper/85 backdrop-blur-sm shadow-sm transition-colors hover:bg-paper"
          aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
        >
          <Heart
            size={16}
            className={cn(fav ? "text-terracota" : "text-graphite")}
            fill={fav ? "currentColor" : "none"}
          />
        </button>

        {/* Badge "Destacada" — esquina superior derecha */}
        {property.is_featured && (
          <span className="absolute top-2.5 right-2.5 rounded-sm bg-terracota px-2 py-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-paper">
            Destacada
          </span>
        )}
      </div>

      {/* ── Cuerpo ── */}
      <div className="p-4">
        {/* Kicker: tipo · operación */}
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
          {PROPERTY_TYPE_LABELS[property.property_type]}
          {" · "}
          {OPERATION_TYPE_LABELS[property.operation_type]}
        </p>

        {/* Título */}
        <h3 className="mt-1 line-clamp-2 font-serif text-[17px] font-semibold leading-snug text-black">
          {property.title}
        </h3>

        {/* Precio */}
        <p className="mt-1.5 font-serif text-xl font-bold text-terracota">
          {formatPrice(property.price, property.currency)}
        </p>

        {/* Ubicación */}
        {location && (
          <div className="mt-2 flex items-center gap-1.5 text-graphite">
            <MapPin size={13} className="shrink-0" />
            <p className="truncate font-sans text-[13px]">{location}</p>
          </div>
        )}

        {/* Métricas */}
        {hasMetrics && (
          <div className="mt-2 flex items-center gap-4 text-graphite">
            {property.bedrooms > 0 && (
              <span className="flex items-center gap-1.5 font-sans text-xs">
                <Bed size={13} /> {property.bedrooms}
              </span>
            )}
            {property.bathrooms > 0 && (
              <span className="flex items-center gap-1.5 font-sans text-xs">
                <Bath size={13} /> {property.bathrooms}
              </span>
            )}
            {property.area_covered_m2 != null && (
              <span className="flex items-center gap-1.5 font-sans text-xs">
                <Square size={13} /> {property.area_covered_m2} m²
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
