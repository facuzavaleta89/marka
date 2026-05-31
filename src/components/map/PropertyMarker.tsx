"use client";

import L from "leaflet";
import { formatPriceCompact } from "@/lib/utils/formatPrice";
import type { Property } from "@/types";

// ─── Estados visuales del pin ─────────────────────────────────
// El estilo vive en globals.css (.marka-pin*). Acá solo se compone el HTML
// del DivIcon y se togglean clases sobre el elemento vivo para que las
// transiciones CSS animen (en vez de regenerar el HTML con string replace).

interface PinState {
  selected?: boolean;
  visited?: boolean;
}

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

  const star = isFeatured ? `<span class="marka-pin__star">★</span>` : "";

  return `<div class="${classes.join(" ")}">
    <span class="marka-pin__price">${priceText}</span>${star}
  </div>`;
}

// ─── Funciones exportadas ─────────────────────────────────────

export function createPropertyIcon(
  property: Property,
  state: PinState
): L.DivIcon {
  const priceText = formatPriceCompact(property.price, property.currency);
  return new L.DivIcon({
    className: "marka-pin-root",
    html: pinHtml(priceText, property.is_featured, state),
    iconSize: ICON_SIZE,
    iconAnchor: ICON_ANCHOR,
  });
}

/** Crea un L.Marker listo para añadir a un cluster group. */
export function createPropertyMarker(
  property: Property,
  state: PinState,
  onClick: () => void
): L.Marker {
  const marker = L.marker([property.lat, property.lng], {
    icon: createPropertyIcon(property, state),
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
}
