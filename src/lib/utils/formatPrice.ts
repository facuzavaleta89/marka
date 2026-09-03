import type { Currency } from "@/types";

// Texto para una operación activa SIN precio cargado.
//
// ⚠ Dice "A convenir" y no "Consultar": el modal tiene dos botones que dicen
// "Consultar por WhatsApp" a centímetros del precio, y las dos frases juntas se
// leerían como la misma cosa.
//
// Un precio nulo NO es un dato faltante: es una elección de la agencia (ver el
// comentario de las columnas de precio en types/index.ts). Por eso las dos
// funciones de acá lo tratan como un valor normal y no como un borde de error.
export const NO_PRICE_LABEL = "A convenir";

export function formatPrice(
  price: number | null,
  currency: Currency | null
): string {
  if (price == null || currency == null) return NO_PRICE_LABEL;
  const formatted = price.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${currency} ${formatted}`;
}

// Versión compacta para pines del mapa (USD 250k / USD 1.2M / ARS 15M)
export function formatPriceCompact(
  price: number | null,
  currency: Currency | null
): string {
  if (price == null || currency == null) return NO_PRICE_LABEL;
  if (currency === "ARS") {
    return `ARS ${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (price >= 1_000_000) {
    return `USD ${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  return `USD ${Math.round(price / 1000)}k`;
}
