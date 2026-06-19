"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SlidersHorizontal, MapIcon, List } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMapFilters, selectActiveFiltersCount } from "@/store/mapFiltersStore";
import { Wordmark } from "@/components/brand/Wordmark";
import { FilterPanel } from "@/components/map/FilterPanel";
import { PropertyModal } from "@/components/map/PropertyModal";
import { PropertyList } from "@/components/properties/PropertyList";
import type { City } from "@/types";

const MapView = dynamic(
  () => import("@/components/map/MapView").then((m) => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-mist animate-pulse" />,
  }
);

interface AgencyMapViewProps {
  // Ciudad de la agencia, resuelta en el server (no por cityStore): la vista
  // white-label es de UNA agencia en SU ciudad, no navegable a otras ciudades.
  city: City;
  agencyId: string;
}

// Vista del marketplace filtrada a una sola agencia (base de white-label). Misma
// estructura y diseño que la home, sin CityPicker (la ciudad es fija) y con el
// agencyId enhebrado al mapa y a la lista mobile. SIN personalización todavía
// (logo/nombre): el mapa se ve con el diseño estándar.
export function AgencyMapView({ city, agencyId }: AgencyMapViewProps) {
  const activeFilters = useMapFilters(selectActiveFiltersCount);
  const selectedPropertyId = useMapFilters((s) => s.selectedPropertyId);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [showMap, setShowMap] = useState(true);
  // Sesión del agente: si está logueado, el CTA del header pasa a "Ir al panel".
  const [isAuthed, setIsAuthed] = useState(false);

  // Detecta sesión client-side (igual que la home). IIFE async dentro del efecto.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthed(!!user);
    })();
  }, []);

  return (
    <div className="flex flex-col h-dvh bg-paper overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="relative h-14 flex items-center justify-between px-4 md:px-6 bg-paper border-b border-stone shrink-0 z-50">
        <Link href="/" aria-label="Ir al mapa">
          <Wordmark size="md" variant="dark" />
        </Link>

        <Link
          href={isAuthed ? "/dashboard" : "/login"}
          className="font-sans text-sm font-medium text-graphite hover:text-black transition-colors"
        >
          {isAuthed ? "Ir al panel" : "Ingresar"}
        </Link>
      </header>

      {/* ── Cuerpo ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* FilterPanel desktop — siempre visible */}
        <aside className="relative hidden md:flex flex-col w-80 shrink-0 border-r border-stone bg-paper overflow-y-auto z-10">
          <FilterPanel />
        </aside>

        {/* Área principal — z-0 crea un stacking context que contiene los panes de Leaflet */}
        <div className="flex-1 relative overflow-hidden z-0">
          {/* MapView filtrado a la agencia */}
          <div className={showMap ? "h-full" : "hidden md:block h-full"}>
            <MapView
              cityId={city.id}
              center={[city.center_lat, city.center_lng]}
              zoom={city.default_zoom}
              agencyId={agencyId}
            />
          </div>

          {/* Vista de lista (mobile). Mismos datos/filtros + agencyId que el mapa. */}
          {!showMap && <PropertyList city={city} agencyId={agencyId} />}
        </div>
      </div>

      {/* ── PropertyModal a nivel de página ───────────────────── */}
      <PropertyModal />

      {/* ── FilterPanel mobile: bottom sheet ───────────────────── */}
      <FilterPanel
        mobile
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
      />

      {/* ── FABs mobile (par coherente) ────────────────────────── */}
      {!selectedPropertyId && (
        <>
          {/* Filtros — secundario */}
          <button
            onClick={() => setFilterPanelOpen(true)}
            className="md:hidden fixed left-4 z-[610] flex items-center gap-2 h-11 px-4 font-sans text-sm font-medium text-graphite bg-paper border border-stone rounded-md shadow-lg hover:bg-mist transition-colors"
            style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
            aria-label="Abrir filtros"
          >
            <SlidersHorizontal size={16} />
            Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </button>

          {/* Ver lista / Ver mapa — primario */}
          <button
            onClick={() => setShowMap((v) => !v)}
            className="md:hidden fixed right-4 z-[610] flex items-center gap-2 h-11 px-5 font-sans text-sm font-medium text-paper bg-terracota hover:bg-terracota-hover rounded-md shadow-lg transition-colors"
            style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
            aria-label={showMap ? "Ver lista" : "Ver mapa"}
          >
            {showMap ? (
              <>
                <List size={16} />
                Ver lista
              </>
            ) : (
              <>
                <MapIcon size={16} />
                Ver mapa
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
