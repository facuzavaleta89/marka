"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import {
  createPropertyIcon,
  createPropertyMarker,
  setMarkerState,
} from "./PropertyMarker";
import { useMapFilters } from "@/store/mapFiltersStore";
import { useVisitedProperties } from "@/lib/hooks/useVisitedProperties";
import type { Property } from "@/types";

// ─── Ícono de los grupos de clusters ──────────────────────────
// El estilo (.marka-cluster) vive en globals.css e incluye DM Sans y el
// anillo exterior translúcido. Acá solo se calcula tamaño y etiqueta.

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count >= 100 ? 64 : count >= 10 ? 52 : 40;
  const fontSize = size >= 64 ? 15 : size >= 52 ? 14 : 13;
  const label = count >= 1000 ? `${Math.floor(count / 1000)}k+` : String(count);

  return new L.DivIcon({
    className: "",
    html: `<div class="marka-cluster" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">${label}</div>`,
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
  const { isVisited, markVisited } = useVisitedProperties();

  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  // Última lista de propiedades, para que el efecto de selección la consulte.
  const propertiesRef = useRef<Property[]>(properties);
  // Firma del set de ids actualmente renderizado, para evitar recrear markers
  // cuando el refetch devuelve las mismas propiedades (mismo array, otra identidad).
  const renderedIdsRef = useRef<string>("");
  // Selección e ids visitados accesibles desde el closure de creación sin
  // forzar recreación de markers cuando cambian (se aplican como estado live).
  const selectedIdRef = useRef<string | null>(selectedPropertyId);
  const isVisitedRef = useRef(isVisited);
  isVisitedRef.current = isVisited;

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

    properties.forEach((property) => {
      const selected = property.id === selectedIdRef.current;
      const visited = isVisitedRef.current(property.id);

      const marker = createPropertyMarker(
        property,
        { selected, visited },
        () => {
          setSelectedProperty(property.id);
          markVisited(property.id);
          // Aplicar el tono "visitado" al instante sobre el elemento vivo
          setMarkerState(marker, { visited: true });
        }
      );

      markersRef.current.set(property.id, marker);
      group.addLayer(marker);
    });
  }, [properties]); // eslint-disable-line react-hooks/exhaustive-deps
  // Excluimos selectedPropertyId/visited intencionalmente — se aplican como
  // estado live en el efecto de abajo y en el onClick, sin recrear markers.

  // Actualizar solo el marker afectado cuando cambia la selección.
  // Se togglea la clase sobre el elemento vivo → la transición CSS anima.
  useEffect(() => {
    selectedIdRef.current = selectedPropertyId;
    markersRef.current.forEach((marker, id) => {
      const selected = id === selectedPropertyId;
      // Para markers clusterizados (sin elemento) actualizamos el ícono base,
      // así reflejan la selección cuando el cluster se expande.
      if (!marker.getElement()) {
        const property = propertiesRef.current.find((p) => p.id === id);
        if (property) {
          marker.setIcon(
            createPropertyIcon(property, {
              selected,
              visited: isVisitedRef.current(id),
            })
          );
        }
        return;
      }
      setMarkerState(marker, { selected });
    });
  }, [selectedPropertyId]);

  return null;
}
