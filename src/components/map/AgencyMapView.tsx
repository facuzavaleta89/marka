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
  // Marca de la agencia para el header (white-label B2a).
  agencyName: string;
  agencyLogoUrl: string | null;
}

// Vista del marketplace filtrada a una sola agencia (white-label). Misma estructura
// y diseño que la home, sin CityPicker (la ciudad es fija) y con el agencyId
// enhebrado al mapa y a la lista mobile. El header lleva la MARCA DE LA AGENCIA
// (logo o nombre), no el Wordmark de Marka; éste queda como "powered by" discreto.
export function AgencyMapView({
  city,
  agencyId,
  agencyName,
  agencyLogoUrl,
}: AgencyMapViewProps) {
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
      {/* ── Header (marca de la AGENCIA, no de Marka) ──────────────
          Izquierda: logo si hay, si no el nombre en texto serif.
          Centro: el nombre en texto, SOLO cuando hay logo (no duplicar).
          Derecha: CTA al panel/login. */}
      <header className="relative h-14 flex items-center justify-between gap-3 px-4 md:px-6 bg-paper border-b border-stone shrink-0 z-50">
        {/* Izquierda — marca de la agencia */}
        <div className="flex items-center min-w-0">
          {agencyLogoUrl ? (
            // Altura fija + ancho automático: tolera cualquier proporción de logo
            // sin alterar la altura del header. max-w acota los logos muy anchos.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agencyLogoUrl}
              alt={agencyName}
              className="h-9 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <span className="font-serif text-xl font-semibold text-black truncate">
              {agencyName}
            </span>
          )}
        </div>

        {/* Centro — nombre en texto, solo si la izquierda muestra el logo.
            Visible en todos los tamaños: en mobile va chico (text-base) para
            convivir con el logo y el CTA sin apretarse; crece a text-lg en sm+.
            min-w-0 + truncate: un nombre largo se corta con elipsis en vez de
            empujar al CTA. */}
        {agencyLogoUrl && (
          <span className="min-w-0 font-serif text-base sm:text-lg font-semibold text-black truncate">
            {agencyName}
          </span>
        )}

        {/* Derecha — CTA */}
        <Link
          href={isAuthed ? "/dashboard" : "/login"}
          className="shrink-0 font-sans text-sm font-medium text-graphite hover:text-black transition-colors"
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

      {/* ── "Powered by Marka." ────────────────────────────────
          Atribución discreta al pie, centrada: libre de los FABs (left-4 /
          right-4) y de los controles de Leaflet (zoom top-left, atribución
          bottom-right). pointer-events-none para no robar clicks al mapa. */}
      <div
        className="pointer-events-none fixed left-1/2 z-[600] flex -translate-x-1/2 items-center gap-1 rounded-sm bg-paper/80 px-2 py-0.5 backdrop-blur-sm"
        style={{ bottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <span className="font-sans text-xs text-graphite">Powered by</span>
        <Wordmark size="xs" variant="dark" />
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
