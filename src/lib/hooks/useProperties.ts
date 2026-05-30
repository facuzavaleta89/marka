"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMapFilters } from "@/store/mapFiltersStore";
import type { MapBounds, Property } from "@/types";

export function useProperties(cityId: string, bounds: MapBounds | null) {
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
      let query = supabase
        .from("properties")
        .select(
          `id, title, slug, description, status, property_type, operation_type, price, currency, is_featured, lat, lng, address, neighborhood, city, bedrooms, bathrooms, parking_spots, area_covered_m2, amenities, year_built, agent_id, agency_id, city_id, images:property_images(url, is_cover, sort_order), agent:agents(full_name, phone_wa, avatar_url)`
        )
        .eq("city_id", cityId)
        .eq("status", "active");

      // Filtros opcionales — solo se aplican si tienen valor
      if (filters.operation_type) {
        query = query.eq("operation_type", filters.operation_type);
      }
      if (filters.property_types.length > 0) {
        query = query.in("property_type", filters.property_types);
      }
      if (filters.price_min != null || filters.price_max != null) {
        // El filtro de precio solo tiene sentido dentro de la misma moneda
        query = query.eq("currency", filters.currency);
        if (filters.price_min != null) {
          query = query.gte("price", filters.price_min);
        }
        if (filters.price_max != null) {
          query = query.lte("price", filters.price_max);
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
        // JSONB containment: la propiedad debe tener TODOS los amenities seleccionados
        query = query.contains("amenities", filters.amenities);
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
        setError("No se pudieron cargar las propiedades");
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
  }, [cityId, bounds, filters]);

  return { properties, isLoading, error };
}
