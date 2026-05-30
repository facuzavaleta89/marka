import { create } from "zustand";
import { DEFAULT_FILTERS } from "@/types";
import type { MapFilters } from "@/types";

interface MapFiltersState {
  filters: MapFilters;
  selectedPropertyId: string | null;
  setFilter: <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => void;
  resetFilters: () => void;
  setSelectedProperty: (id: string | null) => void;
}

export const useMapFilters = create<MapFiltersState>()((set) => ({
  filters: DEFAULT_FILTERS,
  selectedPropertyId: null,

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  setSelectedProperty: (id) => set({ selectedPropertyId: id }),
}));

// Cuenta cuántos grupos de filtros están activos (para los badges de la UI)
export const selectActiveFiltersCount = (state: MapFiltersState): number => {
  const f = state.filters;
  return [
    f.operation_type !== null,
    f.property_types.length > 0,
    f.price_min != null || f.price_max != null,
    f.area_min != null || f.area_max != null,
    f.bedrooms_min != null,
    f.amenities.length > 0,
    f.only_featured,
  ].filter(Boolean).length;
};
