"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMapFilters } from "@/store/mapFiltersStore";
import { OPERATION_COLUMNS } from "@/lib/utils/propertyOperations";
import type { MapBounds, Property } from "@/types";

// agencyId opcional: cuando viene (vista white-label /[slug]), restringe el mapa
// a las propiedades de esa agencia, ADICIONAL al filtro de city_id + status active.
// Sin agencyId (home) el comportamiento no cambia.
export function useProperties(
  cityId: string,
  bounds: MapBounds | null,
  agencyId?: string | null
) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMapFilters((state) => state.filters);

  useEffect(() => {
    if (!cityId) return;

    let cancelled = false;

    (async () => {
      // setState dentro del flujo async (no en el cuerpo del efecto)
      setIsLoading(true);
      const supabase = createClient();

      // Solo los campos que necesitan el mapa y el modal (no traer description
      // larga ni columnas innecesarias para cada pin). LEFT join en imágenes
      // para no ocultar propiedades sin foto.
      // Nota: debe ser un único string literal (no concatenado) para que
      // Supabase infiera correctamente el tipo de retorno.
      //
      // ⚠ LISTA EXPLÍCITA, NO "*": las NUEVE columnas de operación/precio
      // (for_*/[op]_price/[op]_currency) tienen que estar todas. El resultado se
      // castea por unknown a Property[] (abajo), así que una que falte llega
      // como undefined y el pin imprime "NaN" sin que el compilador diga nada.
      let query = supabase
        .from("properties")
        .select(
          `id, title, slug, description, status, property_type, for_sale, sale_price, sale_currency, for_rent, rent_price, rent_currency, for_temp_rent, temp_rent_price, temp_rent_currency, is_featured, lat, lng, address, neighborhood, city, bedrooms, bathrooms, parking_spots, area_covered_m2, amenities, year_built, agent_id, agency_id, city_id, images:property_images(url, is_cover, sort_order), agent:agents(full_name, phone_wa, avatar_url)`
        )
        .eq("city_id", cityId)
        .eq("status", "active");

      // Vista por agencia (white-label): filtro adicional al de ciudad/estado.
      if (agencyId) {
        query = query.eq("agency_id", agencyId);
      }

      // Filtros opcionales — solo se aplican si tienen valor

      // Operación: selección MÚLTIPLE. Una propiedad matchea si tiene activa
      // CUALQUIERA de las marcadas (OR entre los flags), y el .or() se combina
      // con AND contra el resto de los filtros.
      if (filters.operation_types.length > 0) {
        const anyOperation = filters.operation_types
          .map((op) => `${OPERATION_COLUMNS[op].flag}.eq.true`)
          .join(",");
        query = query.or(anyOperation);
      }
      if (filters.property_types.length > 0) {
        query = query.in("property_type", filters.property_types);
      }
      // Rango de precio: SOLO con exactamente una operación marcada. Con cero o
      // con varias no se aplica, porque no hay una sola columna de precio contra
      // la cual comparar y un rango de venta no significa nada sobre un alquiler.
      // La UI deshabilita el rango y limpia los valores en ese caso; esta guarda
      // es la que garantiza que un valor que igual quede en el store no se
      // aplique contra la columna equivocada.
      //
      // Las propiedades sin precio ("a convenir") quedan FUERA de este filtro, y
      // es deliberado: la columna es NULL, y tanto el .eq de moneda como el gte/
      // lte comparan contra NULL y no matchean. No hay que compensarlo.
      if (
        filters.operation_types.length === 1 &&
        (filters.price_min != null || filters.price_max != null)
      ) {
        const cols = OPERATION_COLUMNS[filters.operation_types[0]];
        // El filtro de precio solo tiene sentido dentro de la misma moneda
        query = query.eq(cols.currency, filters.currency);
        if (filters.price_min != null) {
          query = query.gte(cols.price, filters.price_min);
        }
        if (filters.price_max != null) {
          query = query.lte(cols.price, filters.price_max);
        }
      }
      if (filters.area_min != null) {
        query = query.gte("area_covered_m2", filters.area_min);
      }
      if (filters.area_max != null) {
        query = query.lte("area_covered_m2", filters.area_max);
      }
      if (filters.bedrooms_min != null) {
        query = query.gte("bedrooms", filters.bedrooms_min);
      }
      if (filters.neighborhood) {
        query = query.ilike("neighborhood", `%${filters.neighborhood}%`);
      }
      if (filters.amenities.length > 0) {
        // JSONB containment (@>): la propiedad debe tener TODOS los amenities
        // seleccionados. Hay que pasar un STRING JSON: si se pasa un array JS,
        // postgrest-js lo serializa como literal de array Postgres ("cs.{a,b}"),
        // que no matchea contra una columna JSONB. Con JSON.stringify se genera
        // "cs.[\"a\",\"b\"]" → amenities @> '["a","b"]'.
        query = query.contains("amenities", JSON.stringify(filters.amenities));
      }
      if (filters.only_featured) {
        query = query.eq("is_featured", true);
      }

      // Filtro de bounds por rango simple (no PostGIS desde el cliente)
      if (bounds) {
        query = query
          .gte("lat", bounds.south)
          .lte("lat", bounds.north)
          .gte("lng", bounds.west)
          .lte("lng", bounds.east);
      }

      const { data, error: queryError } = await query;

      if (cancelled) return;

      if (queryError) {
        setError("No se pudieron cargar las propiedades. Revisá tu conexión y recargá la página.");
        setIsLoading(false);
        return;
      }

      // Filtrar a solo la imagen portada por propiedad.
      // El select es acotado (no trae todas las columnas de Property), por eso
      // el puente por unknown: el mapa/modal solo usan los campos seleccionados.
      const normalized = (data ?? []).map((p) => ({
        ...p,
        images: (
          (p.images ?? []) as { url: string; is_cover: boolean; sort_order: number }[]
        ).filter((img) => img.is_cover),
      })) as unknown as Property[];

      setProperties(normalized);
      setError(null);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [cityId, bounds, filters, agencyId]);

  return { properties, isLoading, error };
}
