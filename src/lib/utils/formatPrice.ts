import type { Currency } from "@/types";

export function formatPrice(price: number, currency: Currency): string {
  const formatted = price.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${currency} ${formatted}`;
}

// Versión compacta para pines del mapa (USD 250k / USD 1.2M / ARS 15M)
export function formatPriceCompact(price: number, currency: Currency): string {
  if (currency === "ARS") {
    return `ARS ${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (price >= 1_000_000) {
    return `USD ${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  return `USD ${Math.round(price / 1000)}k`;
}
