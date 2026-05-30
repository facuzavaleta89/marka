"use client";

import L from "leaflet";
import { formatPriceCompact } from "@/lib/utils/formatPrice";
import type { Property } from "@/types";

// ─── Colores del sistema de diseño (inline porque Tailwind no aplica en DivIcon HTML) ───

const C = {
  white: "#FFFFFF",
  paper: "#FBF9F6",
  stone: "#C8C0B7",
  black: "#111111",
  terracota: "#A0522D",
  graphite: "#4E4A46",
} as const;

// ─── Generador de HTML para el pin ───────────────────────────

function pinHtml(
  priceText: string,
  isSelected: boolean,
  isFeatured: boolean
): string {
  const bg = isSelected ? C.terracota : C.white;
  const color = isSelected ? C.paper : C.black;
  const borderColor = isSelected ? C.terracota : isFeatured ? C.terracota : C.stone;
  const borderWidth = isSelected ? "2" : isFeatured ? "2" : "1.5";

  const starBadge = isFeatured
    ? `<span style="position:absolute;top:-7px;right:-7px;width:16px;height:16px;
        background:${isSelected ? C.paper : C.terracota};
        color:${isSelected ? C.terracota : C.white};
        border-radius:50%;font-size:9px;display:flex;align-items:center;
        justify-content:center;line-height:1;font-weight:700;">★</span>`
    : "";

  return `<div style="position:relative;display:inline-flex;align-items:center;
    padding:4px 10px;background:${bg};
    border:${borderWidth}px solid ${borderColor};border-radius:8px;
    box-shadow:0 2px 6px rgba(0,0,0,0.14);white-space:nowrap;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
    font-size:12px;font-weight:500;color:${color};
    cursor:pointer;user-select:none;transition:border-color 0.1s;">
    ${priceText}${starBadge}
  </div>`;
}

// ─── Tamaño y ancla del ícono ─────────────────────────────────

const ICON_W = 88;
const ICON_H = 28;

// ─── Funciones exportadas ─────────────────────────────────────

export function createPropertyIcon(
  property: Property,
  isSelected: boolean
): L.DivIcon {
  const priceText = formatPriceCompact(property.price, property.currency);
  return new L.DivIcon({
    className: "",
    html: pinHtml(priceText, isSelected, property.is_featured),
    iconSize: [ICON_W, ICON_H],
    iconAnchor: [ICON_W / 2, ICON_H / 2],
  });
}

/** Crea un L.Marker listo para añadir a un cluster group. */
export function createPropertyMarker(
  property: Property,
  isSelected: boolean,
  onClick: () => void
): L.Marker {
  const marker = L.marker([property.lat, property.lng], {
    icon: createPropertyIcon(property, isSelected),
  });

  marker.on("click", onClick);

  // Hover visual (borde terracota) — solo cuando no está seleccionado
  marker.on("mouseover", () => {
    if (!isSelected) {
      const priceText = formatPriceCompact(property.price, property.currency);
      marker.setIcon(
        new L.DivIcon({
          className: "",
          html: pinHtml(priceText, false, property.is_featured).replace(
            `border:1.5px solid ${C.stone}`,
            `border:1.5px solid ${C.terracota}`
          ),
          iconSize: [ICON_W, ICON_H],
          iconAnchor: [ICON_W / 2, ICON_H / 2],
        })
      );
    }
  });

  marker.on("mouseout", () => {
    if (!isSelected) {
      marker.setIcon(createPropertyIcon(property, false));
    }
  });

  return marker;
}

// Re-exportar como componente para consistencia de imports (no renderiza nada en el árbol React)
export function PropertyMarker({ property }: { property: Property }) {
  void property; // usado solo como tipo de referencia
  return null;
}
