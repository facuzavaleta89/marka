"use client";

import L from "leaflet";
import { formatPriceCompact } from "@/lib/utils/formatPrice";
import { getDisplayOperationPrice } from "@/lib/utils/propertyOperations";
import type { OperationType, Property } from "@/types";

// ─── Estados visuales del pin ─────────────────────────────────
// El estilo vive en globals.css (.marka-pin*). Acá solo se compone el HTML
// del DivIcon y se togglean clases sobre el elemento vivo para que las
// transiciones CSS animen (en vez de regenerar el HTML con string replace).

interface PinState {
  selected?: boolean;
  visited?: boolean;
  favorite?: boolean;
}

// Corazón relleno (lucide Heart) para el indicador de favorito. fill heredado
// del color del badge (var(--pin-fav)) vía currentColor.
const HEART_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

// ─── Tamaño y ancla del ícono ─────────────────────────────────
// Contenedor 0×0 anclado en el punto geográfico exacto. El pin (.marka-pin)
// se dimensiona por su contenido y se posiciona/centra vía CSS sobre ese punto,
// con su punta inferior cayendo en el vértice. Es más robusto que imponer un
// tamaño fijo de contenedor (el precio define el ancho real del pin).
const ICON_SIZE: [number, number] = [0, 0];
const ICON_ANCHOR: [number, number] = [0, 0];

// ─── Generador de HTML del pin ────────────────────────────────

function pinHtml(
  priceText: string,
  isFeatured: boolean,
  state: PinState
): string {
  const classes = ["marka-pin"];
  if (isFeatured) classes.push("marka-pin--featured");
  if (state.visited) classes.push("marka-pin--visited");
  if (state.selected) classes.push("marka-pin--active");
  if (state.favorite) classes.push("marka-pin--fav");

  // ★ solo si es destacada; ♥ siempre presente (oculto por CSS salvo .marka-pin--fav)
  // para poder mostrarlo/ocultarlo en vivo sin recrear el marker.
  const star = isFeatured ? `<span class="marka-pin__star">★</span>` : "";
  const fav = `<span class="marka-pin__fav">${HEART_SVG}</span>`;

  return `<div class="${classes.join(" ")}">
    <span class="marka-pin__price">${priceText}</span>${star}${fav}
  </div>`;
}

// ─── Funciones exportadas ─────────────────────────────────────

/**
 * Precio que va en el pin. Una propiedad puede ofrecerse en varias operaciones
 * a la vez y en el pin entra UN solo número, así que cuál se muestra depende de
 * lo que el visitante haya filtrado: si marcó una sola operación se muestra la
 * de ESA operación, si no gana la prioridad venta → alquiler → temporal. La
 * regla vive en getDisplayOperationPrice, no acá.
 *
 * Se exporta porque ClusterLayer la necesita para refrescar el texto de un pin
 * ya renderizado sin recrear el marker.
 */
export function propertyPinPrice(
  property: Property,
  filteredOperations: OperationType[]
): string {
  const chosen = getDisplayOperationPrice(property, filteredOperations);
  // Sin operación activa no debería existir (CHECK en la base); si pasa, "A
  // convenir" es más honesto que un número inventado.
  return formatPriceCompact(chosen?.price ?? null, chosen?.currency ?? null);
}

// ⚠ filteredOperations NO es opcional a propósito: el precio del pin depende
// del filtro, y un default silencioso haría que un call site que se olvide de
// pasarlo muestre el precio de otra operación sin ningún síntoma.
export function createPropertyIcon(
  property: Property,
  state: PinState,
  filteredOperations: OperationType[]
): L.DivIcon {
  return new L.DivIcon({
    className: "marka-pin-root",
    html: pinHtml(
      propertyPinPrice(property, filteredOperations),
      property.is_featured,
      state
    ),
    iconSize: ICON_SIZE,
    iconAnchor: ICON_ANCHOR,
  });
}

/** Crea un L.Marker listo para añadir a un cluster group. */
export function createPropertyMarker(
  property: Property,
  state: PinState,
  filteredOperations: OperationType[],
  onClick: () => void
): L.Marker {
  const marker = L.marker([property.lat, property.lng], {
    icon: createPropertyIcon(property, state, filteredOperations),
  });

  marker.on("click", onClick);

  return marker;
}

/**
 * Actualiza el estado de un marker ya renderizado togglando clases sobre su
 * elemento vivo — esto dispara las transiciones CSS. Si el marker está dentro
 * de un cluster (sin elemento en el DOM), es un no-op: el estado correcto se
 * baja al crear el ícono cuando vuelve a renderizarse.
 */
export function setMarkerState(marker: L.Marker, state: PinState): void {
  const root = marker.getElement();
  if (!root) return;
  const pin = root.querySelector<HTMLElement>(".marka-pin");
  if (!pin) return;
  if (state.selected !== undefined) {
    pin.classList.toggle("marka-pin--active", state.selected);
  }
  if (state.visited !== undefined) {
    pin.classList.toggle("marka-pin--visited", state.visited);
  }
  if (state.favorite !== undefined) {
    pin.classList.toggle("marka-pin--fav", state.favorite);
  }
}

/**
 * Actualiza SOLO el texto del precio de un marker ya renderizado. Mismo criterio
 * que setMarkerState: se toca el elemento vivo en vez de recrear el ícono, así
 * el pin no parpadea ni pierde sus clases de estado. Si el marker está dentro de
 * un cluster (sin elemento en el DOM) es un no-op y el llamador tiene que
 * rehacer el ícono — igual que con el estado.
 */
export function setMarkerPrice(marker: L.Marker, priceText: string): void {
  const root = marker.getElement();
  if (!root) return;
  const price = root.querySelector<HTMLElement>(".marka-pin__price");
  if (!price) return;
  price.textContent = priceText;
}
