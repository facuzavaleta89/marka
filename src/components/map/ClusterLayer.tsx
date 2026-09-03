"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import {
  createPropertyIcon,
  createPropertyMarker,
  propertyPinPrice,
  setMarkerPrice,
  setMarkerState,
} from "./PropertyMarker";
import { useMapFilters } from "@/store/mapFiltersStore";
import { useVisitedProperties } from "@/lib/hooks/useVisitedProperties";
import { useFavorites } from "@/lib/hooks/useFavorites";
import type { OperationType, Property } from "@/types";

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
  const { filters, selectedPropertyId, setSelectedProperty } = useMapFilters();
  const { isVisited, markVisited } = useVisitedProperties();
  const { favorites, isFavorite } = useFavorites();

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
  const isFavoriteRef = useRef(isFavorite);
  // Operaciones filtradas: deciden QUÉ precio muestra cada pin. Va en una ref
  // por el mismo motivo que las de arriba — se aplica como estado live, sin
  // recrear markers.
  const filteredOpsRef = useRef<OperationType[]>(filters.operation_types);
  // Clave estable del filtro de operación para las deps del efecto de precio.
  const operationsKey = filters.operation_types.join(",");

  // Mantener las refs "latest" sin escribirlas en render (eso es inseguro bajo
  // render concurrente). useLayoutEffect corre sincrónico tras el commit y ANTES
  // de los efectos pasivos de markers (los de abajo), así que cuando esos efectos
  // leen isVisitedRef/isFavoriteRef ya tienen el valor fresco. Va declarado antes
  // que ellos para garantizar ese orden.
  useLayoutEffect(() => {
    isVisitedRef.current = isVisited;
    isFavoriteRef.current = isFavorite;
    filteredOpsRef.current = filters.operation_types;
  });

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
      const favorite = isFavoriteRef.current(property.id);

      const marker = createPropertyMarker(
        property,
        { selected, visited, favorite },
        filteredOpsRef.current,
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
            createPropertyIcon(
              property,
              {
                selected,
                visited: isVisitedRef.current(id),
                favorite: isFavoriteRef.current(id),
              },
              filteredOpsRef.current
            )
          );
        }
        return;
      }
      setMarkerState(marker, { selected });
    });
  }, [selectedPropertyId]);

  // Actualizar el indicador de favorito en vivo cuando cambian los favoritos
  // (ej: el visitante marca/desmarca el corazón en el modal). Mismo patrón que
  // selección: toggle de clase sobre el elemento vivo, o rebuild del ícono si
  // el marker está clusterizado. No recrea todos los markers.
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const favorite = isFavoriteRef.current(id);
      if (!marker.getElement()) {
        const property = propertiesRef.current.find((p) => p.id === id);
        if (property) {
          marker.setIcon(
            createPropertyIcon(
              property,
              {
                selected: id === selectedIdRef.current,
                visited: isVisitedRef.current(id),
                favorite,
              },
              filteredOpsRef.current
            )
          );
        }
        return;
      }
      setMarkerState(marker, { favorite });
    });
  }, [favorites]);

  // Refrescar el PRECIO de los pines cuando cambia el filtro de operación.
  //
  // ⚠ ESTE EFECTO CUBRE UN AGUJERO REAL DEL DIFF DE ARRIBA, no es una
  // optimización. El efecto de propiedades decide si recrear los markers
  // comparando una firma que es solo la lista de ids: si no cambió, corta y no
  // toca nada. Eso era seguro mientras una propiedad tenía UNA sola operación,
  // porque cambiar el filtro de operación siempre cambiaba el conjunto de ids.
  // Con el modelo nuevo, una propiedad en venta Y en alquiler aparece en los dos
  // resultados: la firma NO cambia, el diff corta, y el pin se queda mostrando
  // el precio de la operación anterior. No rompe nada y no da síntoma — solo
  // muestra un número equivocado.
  //
  // Se resuelve con el mismo patrón que la selección y los favoritos (tocar lo
  // que cambió en vez de recrear markers), y no ensanchando la firma del diff:
  // el precio no es parte de la identidad del conjunto renderizado, y meterlo
  // ahí obligaría a recrear TODOS los markers en cada cambio de filtro para
  // actualizar un texto.
  useEffect(() => {
    const operations = filteredOpsRef.current;
    markersRef.current.forEach((marker, id) => {
      const property = propertiesRef.current.find((p) => p.id === id);
      if (!property) return;
      // Marker clusterizado (sin elemento en el DOM): se rehace el ícono base,
      // así sale con el precio correcto cuando el cluster se expande.
      if (!marker.getElement()) {
        marker.setIcon(
          createPropertyIcon(
            property,
            {
              selected: id === selectedIdRef.current,
              visited: isVisitedRef.current(id),
              favorite: isFavoriteRef.current(id),
            },
            operations
          )
        );
        return;
      }
      setMarkerPrice(marker, propertyPinPrice(property, operations));
    });
  }, [operationsKey]);

  return null;
}
