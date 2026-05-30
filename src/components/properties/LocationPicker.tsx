"use client";

import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
  value: { lat: number; lng: number };
  onChange: (coords: { lat: number; lng: number }) => void;
  cityCenter: { lat: number; lng: number };
}

// Pin SVG terracota con ancla en la punta inferior
const PIN_HTML = `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#A0522D"/>
  <circle cx="14" cy="14" r="5.5" fill="white"/>
</svg>`;

// Componente interno que captura eventos del mapa
function DragHandler({
  onChange,
}: {
  onChange: (coords: { lat: number; lng: number }) => void;
}) {
  useMapEvents({});
  return null;
}

export default function LocationPicker({
  value,
  onChange,
  cityCenter,
}: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>([
    value.lat,
    value.lng,
  ]);

  const pinIcon = useMemo(
    () =>
      new L.DivIcon({
        className: "",
        html: PIN_HTML,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      }),
    []
  );

  const handleDragEnd = (e: L.DragEndEvent) => {
    const { lat, lng } = (e.target as L.Marker).getLatLng();
    const rounded = { lat: parseFloat(lat.toFixed(7)), lng: parseFloat(lng.toFixed(7)) };
    setPosition([rounded.lat, rounded.lng]);
    onChange(rounded);
  };

  return (
    <div className="space-y-2">
      <p className="font-sans text-xs text-graphite">
        Arrastrá el pin hasta la ubicación exacta del inmueble
      </p>

      <div className="rounded-md overflow-hidden border border-stone shadow-sm" style={{ height: 280 }}>
        <MapContainer
          center={[cityCenter.lat, cityCenter.lng]}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DragHandler onChange={onChange} />
          <Marker
            position={position}
            icon={pinIcon}
            draggable
            eventHandlers={{ dragend: handleDragEnd }}
          />
        </MapContainer>
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
