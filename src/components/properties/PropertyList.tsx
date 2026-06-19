"use client";

import { SearchX, Building2 } from "lucide-react";
import { useProperties } from "@/lib/hooks/useProperties";
import {
  useMapFilters,
  selectActiveFiltersCount,
} from "@/store/mapFiltersStore";
import { PropertyCard } from "./PropertyCard";
import type { City } from "@/types";

// Padding inferior: deja pasar la última card por debajo de los FABs + safe-area.
const BOTTOM_PAD = {
  paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
} as const;

// Contenedor común de la vista (mobile-only, scroll vertical propio)
function Shell({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div
      className={`md:hidden h-full overflow-y-auto bg-paper px-4 pt-4 ${
        center ? "flex items-center justify-center" : ""
      }`}
      style={BOTTOM_PAD}
    >
      {children}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg border border-stone bg-paper">
      <div className="h-[180px] w-full bg-stone/30" />
      <div className="space-y-2.5 p-4">
        <div className="h-2.5 w-24 rounded-sm bg-stone/30" />
        <div className="h-4 w-3/4 rounded bg-stone/30" />
        <div className="h-5 w-28 rounded bg-stone/30" />
        <div className="h-3 w-1/2 rounded-sm bg-stone/30" />
        <div className="flex gap-3 pt-0.5">
          <div className="h-3 w-10 rounded-sm bg-stone/30" />
          <div className="h-3 w-10 rounded-sm bg-stone/30" />
          <div className="h-3 w-12 rounded-sm bg-stone/30" />
        </div>
      </div>
    </div>
  );
}

interface PropertyListProps {
  city: City;
  // Vista white-label: filtra la lista a una sola agencia (igual que el mapa).
  agencyId?: string | null;
}

export function PropertyList({ city, agencyId }: PropertyListProps) {
  // Mismos datos y filtros que el mapa, pero sin bounds (toda la ciudad).
  const { properties, isLoading } = useProperties(city.id, null, agencyId);
  const setSelectedProperty = useMapFilters((s) => s.setSelectedProperty);
  const resetFilters = useMapFilters((s) => s.resetFilters);
  const activeCount = useMapFilters(selectActiveFiltersCount);

  // ── Cargando: skeleton de cards ──
  if (isLoading) {
    return (
      <Shell>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </Shell>
    );
  }

  // ── Vacío: estado constructivo (DESIGN §10) ──
  if (properties.length === 0) {
    const filtered = activeCount > 0;
    const Icon = filtered ? SearchX : Building2;
    return (
      <Shell center>
        <div className="-mt-10 text-center">
          <Icon size={36} strokeWidth={1.5} className="mx-auto mb-4 text-stone" />
          <p className="mb-1.5 font-serif text-xl font-semibold text-black">
            {filtered
              ? "No hay propiedades con estos filtros"
              : "Todavía no hay propiedades"}
          </p>
          <p className="mb-5 font-sans text-sm text-graphite">
            {filtered
              ? "Probá ampliar la búsqueda o limpiar los filtros."
              : `Pronto vas a ver propiedades en ${city.name}.`}
          </p>
          {filtered && (
            <button
              onClick={resetFilters}
              className="inline-flex h-10 items-center rounded-md bg-terracota px-5 font-sans text-sm font-medium text-paper transition-colors hover:bg-terracota-hover"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </Shell>
    );
  }

  // ── Lista ──
  return (
    <Shell>
      <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
        {properties.length}{" "}
        {properties.length === 1 ? "propiedad" : "propiedades"}
      </p>
      <div className="space-y-3">
        {properties.map((p) => (
          <PropertyCard
            key={p.id}
            property={p}
            onSelect={() => setSelectedProperty(p.id)}
          />
        ))}
      </div>
    </Shell>
  );
}
