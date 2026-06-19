"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { ClusterLayer } from "./ClusterLayer";
import { useProperties } from "@/lib/hooks/useProperties";
import { TILE_CONFIG } from "@/lib/map/tiles";
import type { MapBounds } from "@/types";

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
  // Vista white-label: filtra el mapa a una sola agencia. Sin prop, el mapa
  // muestra todas las agencias de la ciudad (comportamiento de la home).
  agencyId?: string | null;
}

export function MapView({ cityId, center, zoom, agencyId }: MapViewProps) {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const { properties } = useProperties(cityId, bounds, agencyId);

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
