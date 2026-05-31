"use client";

import { useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { Crosshair } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { TILE_CONFIG } from "@/lib/map/tiles";

interface LocationPickerProps {
  value: { lat: number; lng: number };
  onChange: (coords: { lat: number; lng: number }) => void;
  cityCenter: { lat: number; lng: number };
  /** Se llama la primera vez que el agente arrastra el pin */
  onMoved?: () => void;
  /** true = el contenedor del mapa muestra borde de error (pin sin colocar) */
  error?: boolean;
}

// Pin SVG terracota con ancla en la punta inferior.
// El SVG vive dentro de un .marka-loc-pin__inner para poder darle sombra y
// animarlo (pulse) sin tocar el transform de posicionamiento de Leaflet.
const PIN_HTML = `<span class="marka-loc-pin__inner"><svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#A0522D"/>
  <circle cx="14" cy="14" r="5.5" fill="white"/>
</svg></span>`;

export default function LocationPicker({
  value,
  onChange,
  cityCenter,
  onMoved,
  error,
}: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>([
    value.lat,
    value.lng,
  ]);
  // Indica si el agente ya arrastró el pin al menos una vez
  const [hasBeenMoved, setHasBeenMoved] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const pinIcon = useMemo(
    () =>
      new L.DivIcon({
        className: "marka-loc-pin",
        html: PIN_HTML,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      }),
    []
  );

  // Micro-feedback: un pulse sutil al soltar el pin confirma la acción.
  const pulsePin = (marker: L.Marker | null) => {
    const inner = marker?.getElement()?.querySelector(".marka-loc-pin__inner");
    if (!inner) return;
    inner.classList.remove("marka-loc-pin__inner--pulse");
    // Reflow forzado para reiniciar la animación si ya estaba aplicada
    void (inner as HTMLElement).offsetWidth;
    inner.classList.add("marka-loc-pin__inner--pulse");
  };

  const commit = (lat: number, lng: number) => {
    const rounded = {
      lat: parseFloat(lat.toFixed(7)),
      lng: parseFloat(lng.toFixed(7)),
    };
    setPosition([rounded.lat, rounded.lng]);
    onChange(rounded);
    // Avisar al padre solo la primera vez que se coloca el pin
    if (!hasBeenMoved) {
      setHasBeenMoved(true);
      onMoved?.();
    }
  };

  const handleDragEnd = (e: L.DragEndEvent) => {
    const marker = e.target as L.Marker;
    const { lat, lng } = marker.getLatLng();
    commit(lat, lng);
    pulsePin(marker);
  };

  // Devuelve el pin al centro de la ciudad de la agencia y recentra el mapa.
  const resetToCity = () => {
    setPosition([cityCenter.lat, cityCenter.lng]);
    onChange({ lat: cityCenter.lat, lng: cityCenter.lng });
    mapRef.current?.setView([cityCenter.lat, cityCenter.lng], 15);
    pulsePin(markerRef.current);
  };

  return (
    <div className="space-y-2">
      <p className="font-sans text-xs text-graphite">
        Arrastrá el pin hasta la ubicación exacta del inmueble
      </p>

      <div
        className={`relative rounded-md overflow-hidden border shadow-sm ${
          error ? "border-error" : "border-stone"
        }`}
        style={{ height: 280 }}
      >
        <MapContainer
          center={[cityCenter.lat, cityCenter.lng]}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
          ref={mapRef}
        >
          <TileLayer
            attribution={TILE_CONFIG.attribution}
            url={TILE_CONFIG.url}
            subdomains={TILE_CONFIG.subdomains}
            maxZoom={TILE_CONFIG.maxZoom}
          />
          <Marker
            ref={markerRef}
            position={position}
            icon={pinIcon}
            draggable
            eventHandlers={{ dragend: handleDragEnd }}
          />
        </MapContainer>

        {/* Botón centrar en la ciudad — overlay sobre el mapa */}
        <button
          type="button"
          onClick={resetToCity}
          className="absolute top-3 right-3 z-[500] inline-flex items-center gap-1.5 h-8 px-2.5 font-sans text-xs font-medium text-graphite bg-paper border border-stone rounded-md shadow-sm hover:bg-mist hover:text-black transition-colors"
          aria-label="Centrar el pin en la ciudad"
        >
          <Crosshair size={14} />
          Centrar
        </button>
      </div>

      <p className="font-sans text-xs text-graphite tabular-nums">
        Lat:{" "}
        <span className="text-black">{position[0].toFixed(6)}</span>
        {"  "}Lng:{" "}
        <span className="text-black">{position[1].toFixed(6)}</span>
      </p>
    </div>
  );
}
