"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { ClusterLayer } from "./ClusterLayer";
import { useProperties } from "@/lib/hooks/useProperties";
import type { MapBounds } from "@/types";

// ─── Configuración de tiles ───────────────────────────────────
// CARTO Positron: baja saturación, cálido y limpio → deja que los pines
// terracota sean los protagonistas. Gratuito y sin API key.
// Preparado para migrar a MapTiler: si se define NEXT_PUBLIC_MAPTILER_KEY,
// el cambio es automático (una sola fuente de verdad acá).
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

const TILE_CONFIG = MAPTILER_KEY
  ? {
      // Estilo claro de MapTiler (cuando se agregue la key)
      url: `https://api.maptiler.com/maps/dataviz-light/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`,
      attribution:
        '© <a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abc",
      maxZoom: 20,
    }
  : {
      // OpenStreetMap estándar (fallback por defecto, sin key): se siente más
      // vivo y da mejor contraste con los pines terracota que los estilos lavados.
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abc",
      maxZoom: 19,
    };

// ─── Tracker de bounds (componente interno) ───────────────────
// Debounce de 400ms: solo refetcheamos cuando el usuario deja de mover el mapa,
// para no disparar una query por cada frame de paneo/zoom.
const BOUNDS_DEBOUNCE_MS = 400;

function BoundsTracker({
  onBoundsChange,
}: {
  onBoundsChange: (b: MapBounds) => void;
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMapEvents({
    moveend(e) {
      const map = e.target as L.Map;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const b = map.getBounds();
        onBoundsChange({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      }, BOUNDS_DEBOUNCE_MS);
    },
  });

  // Limpiar el timer pendiente al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return null;
}

// ─── Componente principal ─────────────────────────────────────

interface MapViewProps {
  cityId: string;
  center: [number, number];
  zoom: number;
}

export function MapView({ cityId, center, zoom }: MapViewProps) {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const { properties } = useProperties(cityId, bounds);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        attribution={TILE_CONFIG.attribution}
        url={TILE_CONFIG.url}
        subdomains={TILE_CONFIG.subdomains}
        maxZoom={TILE_CONFIG.maxZoom}
      />
      <BoundsTracker onBoundsChange={setBounds} />
      <ClusterLayer properties={properties} />
    </MapContainer>
  );
}
