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
