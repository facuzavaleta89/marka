"use client";

import { useState } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { ClusterLayer } from "./ClusterLayer";
import { useProperties } from "@/lib/hooks/useProperties";
import type { MapBounds } from "@/types";

// ─── Tracker de bounds (componente interno) ───────────────────

function BoundsTracker({
  onBoundsChange,
}: {
  onBoundsChange: (b: MapBounds) => void;
}) {
  useMapEvents({
    moveend(e) {
      const b = (e.target as L.Map).getBounds();
      onBoundsChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      });
    },
  });
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundsTracker onBoundsChange={setBounds} />
      <ClusterLayer properties={properties} />
    </MapContainer>
  );
}
