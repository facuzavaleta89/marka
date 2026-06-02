"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SlidersHorizontal, MapIcon, List } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCityStore } from "@/store/cityStore";
import { useMapFilters, selectActiveFiltersCount } from "@/store/mapFiltersStore";
import { CityPicker } from "@/components/map/CityPicker";
import { Wordmark } from "@/components/brand/Wordmark";
import { FilterPanel } from "@/components/map/FilterPanel";
import { PropertyModal } from "@/components/map/PropertyModal";
import { PropertyList } from "@/components/properties/PropertyList";

const MapView = dynamic(
  () => import("@/components/map/MapView").then((m) => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-mist animate-pulse" />,
  }
);

export default function PublicPage() {
  const city = useCityStore((s) => s.city);
  const isLoading = useCityStore((s) => s.isLoading);
  const initCity = useCityStore((s) => s.initCity);
  const activeFilters = useMapFilters(selectActiveFiltersCount);
  const selectedPropertyId = useMapFilters((s) => s.selectedPropertyId);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [showMap, setShowMap] = useState(true);
  // Sesión del agente: si está logueado, el CTA del header pasa a "Ir al panel".
  // Por defecto false → mostramos "Ingresar" sin layout shift mientras resuelve.
  const [isAuthed, setIsAuthed] = useState(false);

  // Inicializa la ciudad activa una sola vez para toda la app
  useEffect(() => {
    initCity();
  }, [initCity]);

  // Detecta sesión client-side (sin volver dinámica la home ni fetchear el perfil).
  // IIFE async dentro del efecto (CLAUDE.md: no bajar la regla de ESLint).
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthed(!!user);
    })();
  }, []);

  // ── Estado de carga: skeleton del layout (header + panel + mapa) ──
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-paper overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 md:px-6 bg-paper border-b border-stone shrink-0">
          <Link href="/" aria-label="Ir al mapa">
            <div className="h-5 w-24 rounded-sm bg-stone/30 animate-pulse" />
          </Link>
          <div className="h-7 w-32 rounded-md bg-stone/30 animate-pulse" />
          <div className="h-5 w-16 rounded-sm bg-stone/30 animate-pulse" />
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* FilterPanel skeleton (desktop) */}
          <aside className="hidden md:flex flex-col gap-6 w-80 shrink-0 border-r border-stone bg-paper p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2.5">
                <div className="h-2.5 w-24 rounded-sm bg-stone/30 animate-pulse" />
                <div className="h-9 w-full rounded-md bg-stone/30 animate-pulse" />
              </div>
            ))}
          </aside>

          {/* Mapa skeleton */}
          <div className="flex-1 bg-mist animate-pulse" />
        </div>
      </div>
    );
  }

  if (!city) {
    return (
      <div className="h-screen bg-paper flex items-center justify-center px-4">
        <div className="text-center">
          <p className="font-serif text-2xl font-semibold text-black mb-2">
            Sin ciudades disponibles
          </p>
          <p className="font-sans text-sm text-graphite">
            Configurá al menos una ciudad activa en el panel de administración.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-paper overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="relative h-14 flex items-center justify-between px-4 md:px-6 bg-paper border-b border-stone shrink-0 z-50">
        <Link href="/" aria-label="Ir al mapa">
          <Wordmark size="md" variant="dark" />
        </Link>

        <CityPicker />

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
          {/* MapView */}
          <div className={showMap ? "h-full" : "hidden md:block h-full"}>
            <MapView
              cityId={city.id}
              center={[city.center_lat, city.center_lng]}
              zoom={city.default_zoom}
            />
          </div>

          {/* Vista de lista (mobile, cuando showMap es false).
              Mismos datos/filtros que el mapa (useProperties), cards-first. */}
          {!showMap && <PropertyList city={city} />}
        </div>
      </div>

      {/* ── PropertyModal a nivel de página (no dentro del mapa) ── */}
      <PropertyModal />

      {/* ── FilterPanel mobile: bottom sheet ───────────────────── */}
      <FilterPanel
        mobile
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
      />

      {/* ── FABs mobile (par coherente) ──────────────────────────
          Se ocultan cuando el PropertyModal está abierto para no competir
          con el botón de WhatsApp del bottom sheet. Respetan el safe-area. */}
      {!selectedPropertyId && (
        <>
          {/* Filtros — secundario: paper + borde stone + texto graphite */}
          <button
            onClick={() => setFilterPanelOpen(true)}
            className="md:hidden fixed left-4 z-[610] flex items-center gap-2 h-11 px-4 font-sans text-sm font-medium text-graphite bg-paper border border-stone rounded-md shadow-lg hover:bg-mist transition-colors"
            style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
            aria-label="Abrir filtros"
          >
            <SlidersHorizontal size={16} />
            Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </button>

          {/* Ver lista / Ver mapa — primario: terracota + texto paper */}
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
