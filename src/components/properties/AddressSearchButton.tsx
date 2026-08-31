"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { GEOCODE_STATUS_MESSAGES } from "@/lib/utils/labels";
import type { Coords } from "@/lib/utils/coords";
import type { GeocodeResponse, GeocodeStatus } from "@/types";

// Atajo para ubicar el pin a partir de la dirección escrita.
//
// ⚠ ES UN ATAJO, NO UN REQUISITO. Todo lo que puede salir mal acá termina en un
// mensaje y nada más: el pin no se toca, el formulario no se bloquea y el
// camino de siempre (arrastrar el pin) sigue disponible. Este componente no
// tiene forma de impedir que se guarde una propiedad.
//
// ⚠ NUNCA BUSCAR MIENTRAS SE ESCRIBE. La política de uso del servicio prohíbe
// el autocompletado: la consulta sale SOLO del onClick de este botón. No
// agregar debounce, ni onBlur, ni un efecto que dispare la búsqueda al montar.
// Lo único que mira la dirección mientras se tipea es `staleResult`, que sirve
// para ESCONDER un mensaje viejo, no para pedir nada.

interface AddressSearchButtonProps {
  /** Dirección tal como está en el formulario ahora mismo. */
  address: string;
  /** Se llama solo cuando hay una ubicación creíble. NO confirma nada. */
  onSuggestion: (coords: Coords) => void;
  disabled?: boolean;
}

// Techo del lado del cliente, por encima del presupuesto del servidor (5 s).
// Si la ruta propia no responde —un despliegue a medias, una red que se cortó
// después de mandar el pedido—, la interfaz igual se recupera sola en vez de
// quedarse en "Buscando..." para siempre.
const CLIENT_TIMEOUT_MS = 8_000;

interface SearchResult {
  /** Dirección que produjo este resultado, para poder detectar si quedó vieja. */
  address: string;
  status: GeocodeStatus;
  label: string | null;
}

export function AddressSearchButton({
  address,
  onSuggestion,
  disabled,
}: AddressSearchButtonProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const trimmedAddress = address.trim();
  const canSearch = trimmedAddress.length > 0 && !isSearching && !disabled;

  // El mensaje se muestra solo mientras siga hablando de la dirección que hay
  // escrita. Si el agente la corrige, el aviso anterior desaparece sin que haya
  // que limpiarlo con un efecto (y sin disparar ninguna búsqueda).
  const visibleResult =
    result && result.address === trimmedAddress ? result : null;

  const handleSearch = async () => {
    if (!canSearch) return;

    setIsSearching(true);

    // Todo el cuerpo está envuelto: cualquier falla de red, de parseo o de
    // tiempo cae en el catch y se cuenta como "el servicio no está disponible".
    // Nunca se propaga un error al formulario.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Solo la dirección. El barrio NO va (es dañino para geocodificar,
        // ver el comentario de `geocodeAddress`) y la ciudad la resuelve el
        // servidor a partir de la agencia del usuario.
        body: JSON.stringify({ address: trimmedAddress }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // 400 o 401: el atajo no está disponible para este pedido. Al agente le
        // sirve la misma salida que ante una caída — colocar el pin a mano.
        setResult({
          address: trimmedAddress,
          status: "unavailable",
          label: null,
        });
        return;
      }

      const data = (await response.json()) as GeocodeResponse;

      if (data.status === "found") {
        onSuggestion({ lat: data.lat, lng: data.lng });
        setResult({
          address: trimmedAddress,
          status: "found",
          label: data.label,
        });
        return;
      }

      setResult({ address: trimmedAddress, status: data.status, label: null });
    } catch {
      setResult({ address: trimmedAddress, status: "unavailable", label: null });
    } finally {
      clearTimeout(timer);
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSearch}
        disabled={!canSearch}
        className="inline-flex items-center gap-1.5 h-10 px-4 font-sans text-sm font-medium text-black bg-transparent border border-stone rounded-md transition-colors duration-[120ms] hover:bg-mist hover:border-graphite disabled:text-graphite disabled:border-stone disabled:bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Search size={16} />
        {isSearching ? "Buscando..." : "Buscar esta dirección en el mapa"}
      </button>

      {visibleResult && (
        <p
          className={
            visibleResult.status === "found"
              ? "font-sans text-xs text-graphite"
              : "font-sans text-xs text-error"
          }
        >
          {GEOCODE_STATUS_MESSAGES[visibleResult.status]}
          {visibleResult.label && (
            <>
              {" "}
              <span className="text-black">{visibleResult.label}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
