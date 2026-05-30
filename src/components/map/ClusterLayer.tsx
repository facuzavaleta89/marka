"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { createPropertyIcon, createPropertyMarker } from "./PropertyMarker";
import { useMapFilters } from "@/store/mapFiltersStore";
import type { Property } from "@/types";

// ─── Ícono personalizado para los grupos de clusters ──────────

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count >= 100 ? 64 : count >= 10 ? 52 : 40;
  const label = count >= 1000 ? `${Math.floor(count / 1000)}k+` : String(count);

  return new L.DivIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      background:#4E4A46;color:#FBF9F6;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      font-size:13px;font-weight:600;
      box-shadow:0 2px 8px rgba(0,0,0,0.2);
      cursor:pointer;">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── Componente ───────────────────────────────────────────────

interface ClusterLayerProps {
  properties: Property[];
}

export function ClusterLayer({ properties }: ClusterLayerProps) {
  const map = useMap();
  const { selectedPropertyId, setSelectedProperty } = useMapFilters();

  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  // Última lista de propiedades, para que el efecto de selección la consulte.
  const propertiesRef = useRef<Property[]>(properties);
  // Firma del set de ids actualmente renderizado, para evitar recrear markers
  // cuando el refetch devuelve las mismas propiedades (mismo array, otra identidad).
  const renderedIdsRef = useRef<string>("");

  // Inicializar el cluster group una sola vez
  useEffect(() => {
    const group = L.markerClusterGroup({
      iconCreateFunction: createClusterIcon,
      maxClusterRadius: 60,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animate: true,
    });
    clusterRef.current = group;
    map.addLayer(group);

    return () => {
      map.removeLayer(group);
      clusterRef.current = null;
    };
  }, [map]);

  // Recrear los markers solo cuando cambió el conjunto de propiedades.
  // Diff por id: si el refetch devuelve los mismos ids, no tocamos el mapa.
  useEffect(() => {
    // Mantener la referencia actualizada para el efecto de selección
    propertiesRef.current = properties;

    const group = clusterRef.current;
    if (!group) return;

    const signature = properties
      .map((p) => p.id)
      .sort()
      .join(",");
    if (signature === renderedIdsRef.current) return; // mismas propiedades → no recrear
    renderedIdsRef.current = signature;

    group.clearLayers();
    markersRef.current.clear();

    const currentSelected = selectedPropertyId;

    properties.forEach((property) => {
      const isSelected = property.id === currentSelected;
      const marker = createPropertyMarker(property, isSelected, () => {
        setSelectedProperty(property.id);
      });
      markersRef.current.set(property.id, marker);
      group.addLayer(marker);
    });
  }, [properties]); // eslint-disable-line react-hooks/exhaustive-deps
  // Excluimos selectedPropertyId intencionalmente — se actualiza en el efecto de abajo

  // Actualizar solo los íconos afectados cuando cambia la selección
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const property = propertiesRef.current.find((p) => p.id === id);
      if (!property) return;
      marker.setIcon(createPropertyIcon(property, id === selectedPropertyId));
    });
  }, [selectedPropertyId]);

  return null;
}
