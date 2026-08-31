"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { Crosshair } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { TILE_CONFIG } from "@/lib/map/tiles";
import { roundCoords, type Coords } from "@/lib/utils/coords";

// Por qué el agente movió el pin. El padre necesita distinguirlo porque de eso
// depende si la ubicación queda CONFIRMADA o no (ver PropertyForm):
//   - "drag"   → acto deliberado sobre un punto concreto: confirma.
//   - "center" → volver al punto de partida: desconfirma.
// Una sugerencia del buscador no pasa por acá: la aplica el padre, que ya sabe
// que no confirma nada.
export type LocationChangeCause = "drag" | "center";

interface LocationPickerProps {
  /** Posición del pin. ES LA FUENTE DE VERDAD: el componente no guarda copia. */
  value: Coords;
  onChange: (coords: Coords, cause: LocationChangeCause) => void;
  cityCenter: Coords;
  /** true = el contenedor del mapa muestra borde de error (sin confirmar) */
  error?: boolean;
}

// Zoom al que se recentra el mapa cuando la posición llega DESDE AFUERA (una
// sugerencia). Si el agente ya estaba mirando más de cerca, se respeta su zoom.
const SUGGESTION_ZOOM = 16;
const CITY_ZOOM = 15;

// Pin SVG terracota con ancla en la punta inferior.
// El SVG vive dentro de un .marka-loc-pin__inner para poder darle sombra y
// animarlo (pulse) sin tocar el transform de posicionamiento de Leaflet.
const PIN_HTML = `<span class="marka-loc-pin__inner"><svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#A0522D"/>
  <circle cx="14" cy="14" r="5.5" fill="white"/>
</svg></span>`;

// Micro-feedback: un pulse sutil al reubicar el pin confirma que algo pasó.
// Vive fuera del componente porque no depende de nada suyo: así es estable y
// puede usarse dentro de un efecto sin entrar en las dependencias.
function pulsePin(marker: L.Marker | null) {
  const inner = marker?.getElement()?.querySelector(".marka-loc-pin__inner");
  if (!inner) return;
  inner.classList.remove("marka-loc-pin__inner--pulse");
  // Reflow forzado para reiniciar la animación si ya estaba aplicada
  void (inner as HTMLElement).offsetWidth;
  inner.classList.add("marka-loc-pin__inner--pulse");
}

// Clave de comparación de una posición. Sirve para saber si un cambio de `value`
// lo originó este componente o vino de afuera. Funciona por igualdad exacta
// porque TODAS las coordenadas del proyecto pasan por roundCoord (7 decimales),
// tanto las del arrastre como las que devuelve el buscador de direcciones.
const coordsKey = (coords: Coords): string => `${coords.lat},${coords.lng}`;

export default function LocationPicker({
  value,
  onChange,
  cityCenter,
  error,
}: LocationPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Última posición que EMITIÓ este componente. Es lo único que distingue "el
  // pin se movió porque lo arrastré yo" de "me mandaron una posición nueva".
  // Se inicializa con la posición de montaje, así el efecto de abajo no hace
  // nada la primera vez.
  const lastEmittedRef = useRef<string>(coordsKey(value));

  // Centro del mapa al montar. Se captura una sola vez a propósito: `center` es
  // una prop no reactiva de Leaflet, así que queda claro que no se usa después.
  // Va en estado con inicializador perezoso (y no en un ref) porque se lee
  // DURANTE el render para pasárselo al MapContainer, y leer un ref en render no
  // está permitido; sin setter, es una constante por instancia.
  //
  // ⚠ ARREGLO: antes esto era SIEMPRE el centro de la ciudad, también al
  // EDITAR. Como el pin sí arrancaba en la posición guardada, una propiedad
  // alejada del centro abría el mapa mirando el centro de la ciudad y el pin
  // podía quedar fuera del recuadro de 280px. Ahora el mapa abre donde está el
  // pin: en alta eso es el centro de la ciudad (igual que antes) y en edición
  // es la propiedad.
  const [initialCenter] = useState<[number, number]>(() => [
    value.lat,
    value.lng,
  ]);

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

  // Posición que llega DESDE AFUERA (hoy: una sugerencia del buscador de
  // direcciones): recentrar el mapa y pulsar el pin. El pin en sí ya se movió
  // solo, porque este componente es controlado y el Marker sigue a `value`.
  //
  // ⚠ POR QUÉ NO HAY CICLO: este efecto NO llama a onChange. No tiene ningún
  // camino de escritura hacia el padre — solo mueve la cámara de Leaflet y
  // toca una clase CSS. Aunque el guardia de lastEmittedRef fallara, lo peor
  // que puede pasar es un recentrado de más, nunca una realimentación.
  useEffect(() => {
    // La clave se arma desde las primitivas (no desde `value`) para que las
    // dependencias del efecto sean exactamente lat y lng: un objeto nuevo en
    // cada render volvería a disparar esto sin que la posición haya cambiado.
    const key = coordsKey({ lat: value.lat, lng: value.lng });
    if (lastEmittedRef.current === key) return;
    lastEmittedRef.current = key;

    const map = mapRef.current;
    if (map) {
      map.setView(
        [value.lat, value.lng],
        Math.max(map.getZoom(), SUGGESTION_ZOOM)
      );
    }
    pulsePin(markerRef.current);
  }, [value.lat, value.lng]);

  const emit = (coords: Coords, cause: LocationChangeCause) => {
    const rounded = roundCoords(coords);
    lastEmittedRef.current = coordsKey(rounded);
    onChange(rounded, cause);
  };

  const handleDragEnd = (e: L.DragEndEvent) => {
    const marker = e.target as L.Marker;
    const { lat, lng } = marker.getLatLng();
    emit({ lat, lng }, "drag");
    pulsePin(marker);
  };

  // Devuelve el pin al centro de la ciudad de la agencia y recentra el mapa.
  // Es volver al punto de partida, así que el padre lo toma como DESCONFIRMAR.
  const resetToCity = () => {
    emit(cityCenter, "center");
    mapRef.current?.setView([cityCenter.lat, cityCenter.lng], CITY_ZOOM);
    pulsePin(markerRef.current);
  };

  return (
    <div className="space-y-2">
      <p className="font-sans text-xs text-graphite">
        Arrastrá el pin hasta la ubicación exacta del inmueble, o buscá la
        dirección más arriba y ajustalo desde ahí.
      </p>

      <div
        className={`relative rounded-md overflow-hidden border shadow-sm ${
          error ? "border-error" : "border-stone"
        }`}
        style={{ height: 280 }}
      >
        <MapContainer
          center={initialCenter}
          zoom={CITY_ZOOM}
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
            position={[value.lat, value.lng]}
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
        Lat: <span className="text-black">{value.lat.toFixed(6)}</span>
        {"  "}Lng: <span className="text-black">{value.lng.toFixed(6)}</span>
      </p>
    </div>
  );
}
