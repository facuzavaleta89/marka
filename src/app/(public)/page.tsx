"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SlidersHorizontal, MapIcon, List } from "lucide-react";
import { useCityStore } from "@/store/cityStore";
import { useMapFilters, selectActiveFiltersCount } from "@/store/mapFiltersStore";
import { CityPicker } from "@/components/map/CityPicker";
import { Wordmark } from "@/components/brand/Wordmark";
import { PublicHeaderAuth } from "@/components/auth/PublicHeaderAuth";
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

// ─── Encabezado público del marketplace ───────────────────────
//
// UNA sola definición, consumida por el estado de carga y por el render real.
// Antes estaban escritos dos veces en este mismo archivo y solo el real se
// mantenía: el de carga había quedado con anchos fijos a mano.
//
// ⚠ LAS GUARDAS DE ANCHO NO SON DECORATIVAS. Son tres slots en
// `justify-between` dentro de 56 px de alto, y el del medio es el ÚNICO que
// cede: la marca y la puerta al panel van con `shrink-0` (esta última lo trae
// de fábrica), y el `CityPicker` con `min-w-0` + `truncate` adentro. Sin eso,
// el nombre de la ciudad empuja al resto fuera del encabezado y lo que sobra lo
// recorta en silencio el `overflow-hidden` del contenedor raíz — no aparece
// ninguna barra de scroll ni ningún error. Es exactamente el tratamiento que ya
// tenía el encabezado del sitio de marca (`AgencyMapView`) y que a éste le
// faltaba entero.
function PublicHeader({ cityPicker }: { cityPicker: React.ReactNode }) {
  return (
    <header className="relative z-50 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-stone bg-paper px-4 md:px-6">
      <Link href="/" aria-label="Ir al mapa" className="shrink-0">
        <Wordmark size="md" variant="dark" />
      </Link>

      {cityPicker}

      <PublicHeaderAuth variant="marketplace" />
    </header>
  );
}

export default function PublicPage() {
  const city = useCityStore((s) => s.city);
  const isLoading = useCityStore((s) => s.isLoading);
  const initCity = useCityStore((s) => s.initCity);
  const activeFilters = useMapFilters(selectActiveFiltersCount);
  const selectedPropertyId = useMapFilters((s) => s.selectedPropertyId);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [showMap, setShowMap] = useState(true);

  // Inicializa la ciudad activa una sola vez para toda la app
  useEffect(() => {
    initCity();
  }, [initCity]);

  // ── Estado de carga: skeleton del layout (header + panel + mapa) ──
  if (isLoading) {
    return (
      <div className="flex flex-col h-dvh bg-paper overflow-hidden">
        {/* ⚠ EL ENCABEZADO DE CARGA ES EL ENCABEZADO REAL, no una imitación.
            Antes los tres slots eran bloques grises con anchos escritos a mano,
            y el de la derecha medía `w-16` — 64 px, dimensionados a ojo para la
            palabra "Ingresar". Con el texto de captación ese hueco quedaba
            chico y la home SALTABA al terminar de cargar, rompiendo justo lo que
            el comentario de este archivo prometía.
            La raíz del problema era que ese hueco imitaba algo que no depende de
            la ciudad: ni la marca ni la puerta al panel esperan al `cityStore`.
            Renderizando los dos de verdad no queda ningún ancho que mantener
            sincronizado, y de paso la puerta ya es usable mientras carga el
            mapa. El ÚNICO placeholder que queda es el del selector de ciudad,
            que es lo único que efectivamente está cargando. */}
        <PublicHeader
          cityPicker={
            <div className="h-7 w-32 min-w-0 animate-pulse rounded-md bg-stone/30" />
          }
        />

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
      <div className="h-dvh bg-paper flex items-center justify-center px-4">
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
    <div className="flex flex-col h-dvh bg-paper overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <PublicHeader cityPicker={<CityPicker />} />

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
