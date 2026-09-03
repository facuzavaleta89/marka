// Operaciones y precios de una propiedad: qué operaciones ofrece y CUÁL precio
// se muestra cuando hay lugar para uno solo.
//
// Fuente única de la regla de prioridad. No repetir estas comparaciones en los
// componentes: el pin del mapa y la card de la lista tienen que elegir el mismo
// precio para la misma propiedad y el mismo filtro, o el visitante ve dos
// números distintos para lo mismo.
import type { Currency, OperationType, Property } from "@/types";

// Subconjunto de Property que hace falta para decidir. Es un Pick y no Property
// entera para que lo puedan usar tipos acotados como PropertyCardData.
export type PropertyOperationFields = Pick<
  Property,
  | "for_sale"
  | "sale_price"
  | "sale_currency"
  | "for_rent"
  | "rent_price"
  | "rent_currency"
  | "for_temp_rent"
  | "temp_rent_price"
  | "temp_rent_currency"
>;

// Una operación activa con su precio. `price`/`currency` en null = "a convenir"
// (ver NO_PRICE_LABEL en formatPrice.ts): la operación se ofrece, el precio no
// se publica.
export interface OperationPrice {
  operation: OperationType;
  price: number | null;
  currency: Currency | null;
}

// Nombres de las columnas por operación. Lo consume también el hook del mapa
// para armar los filtros, así que el mapeo operación → columna vive en un solo
// lugar y no escrito a mano en cada query.
export const OPERATION_COLUMNS: Record<
  OperationType,
  { flag: string; price: string; currency: string }
> = {
  venta: { flag: "for_sale", price: "sale_price", currency: "sale_currency" },
  alquiler: { flag: "for_rent", price: "rent_price", currency: "rent_currency" },
  alquiler_temporal: {
    flag: "for_temp_rent",
    price: "temp_rent_price",
    currency: "temp_rent_currency",
  },
};

// Orden de prioridad cuando hay que elegir UNA operación sin que el filtro lo
// decida: venta → alquiler → alquiler temporal.
const OPERATION_PRIORITY: OperationType[] = [
  "venta",
  "alquiler",
  "alquiler_temporal",
];

/**
 * Todas las operaciones activas de la propiedad, en orden de prioridad.
 * La base garantiza al menos una (CHECK properties_at_least_one_operation),
 * pero acá no se asume: una lista vacía es un caso posible del tipo.
 */
export function getActiveOperations(
  property: PropertyOperationFields
): OperationPrice[] {
  const all: (OperationPrice & { active: boolean })[] = [
    {
      operation: "venta",
      active: property.for_sale,
      price: property.sale_price,
      currency: property.sale_currency,
    },
    {
      operation: "alquiler",
      active: property.for_rent,
      price: property.rent_price,
      currency: property.rent_currency,
    },
    {
      operation: "alquiler_temporal",
      active: property.for_temp_rent,
      price: property.temp_rent_price,
      currency: property.temp_rent_currency,
    },
  ];
  return all
    .filter((o) => o.active)
    .map(({ operation, price, currency }) => ({ operation, price, currency }));
}

/**
 * Qué precio mostrar cuando entra UNO SOLO (el pin del mapa, la card de la
 * lista). Regla, en este orden:
 *
 *  1. Si el visitante marcó EXACTAMENTE UNA operación y la propiedad la tiene
 *     activa, se muestra el precio de ESA operación. Es lo que pidió ver.
 *  2. En cualquier otro caso (ninguna marcada, o varias marcadas), gana la
 *     prioridad venta → alquiler → alquiler temporal entre las que la propiedad
 *     tenga activas.
 *
 * Si la operación elegida no tiene precio cargado, devuelve price/currency en
 * null y quien renderiza lo muestra como "A convenir" (formatPrice ya lo hace).
 * Devuelve null solo si la propiedad no tiene ninguna operación activa.
 */
export function getDisplayOperationPrice(
  property: PropertyOperationFields,
  filteredOperations: OperationType[] = []
): OperationPrice | null {
  const active = getActiveOperations(property);
  if (active.length === 0) return null;

  if (filteredOperations.length === 1) {
    const match = active.find((o) => o.operation === filteredOperations[0]);
    if (match) return match;
  }

  // getActiveOperations ya viene en orden de prioridad.
  return (
    OPERATION_PRIORITY.map((op) =>
      active.find((a) => a.operation === op)
    ).find((o): o is OperationPrice => o !== undefined) ?? null
  );
}
