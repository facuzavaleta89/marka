import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { City } from "@/types";

const CITY_KEY = "marka_city";

interface CityState {
  city: City | null;
  cities: City[];
  isLoading: boolean;
  // Garantiza que initCity() resuelva la ciudad una sola vez,
  // aunque varios componentes (página + CityPicker) lo invoquen.
  initialized: boolean;
  setCity: (city: City) => void;
  initCity: () => Promise<void>;
}

export const useCityStore = create<CityState>()((set, get) => ({
  city: null,
  cities: [],
  isLoading: true,
  initialized: false,

  setCity: (city) => {
    set({ city });
    try {
      localStorage.setItem(CITY_KEY, JSON.stringify(city));
    } catch {
      // localStorage no disponible (modo privado con cuota llena, etc.)
    }
  },

  initCity: async () => {
    // Una sola inicialización compartida por toda la app
    if (get().initialized) return;
    set({ initialized: true, isLoading: true });

    const supabase = createClient();
    const { data } = await supabase
      .from("cities")
      .select("*")
      .eq("is_active", true)
      .order("name");

    const active: City[] = (data as City[]) ?? [];
    set({ cities: active });

    // 1. Ciudad guardada en localStorage
    try {
      const raw = localStorage.getItem(CITY_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as City;
        const found = active.find((c) => c.id === stored.id);
        if (found) {
          set({ city: found, isLoading: false });
          return;
        }
      }
    } catch {
      // localStorage no accesible o JSON inválido
    }

    if (active.length === 0) {
      set({ city: null, isLoading: false });
      return;
    }

    // 2. Geolocalización del navegador (silenciosa, opcional)
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          // Distancia euclidiana simple entre coordenadas
          const nearest = active.reduce((best, c) => {
            const d =
              Math.pow(c.center_lat - coords.latitude, 2) +
              Math.pow(c.center_lng - coords.longitude, 2);
            const bestD =
              Math.pow(best.center_lat - coords.latitude, 2) +
              Math.pow(best.center_lng - coords.longitude, 2);
            return d < bestD ? c : best;
          });
          set({ city: nearest, isLoading: false });
        },
        () => {
          // 3. Permiso rechazado o error → ciudad por defecto (primera activa)
          set({ city: active[0] ?? null, isLoading: false });
        },
        { timeout: 5000, maximumAge: 60_000 }
      );
    } else {
      // 3. Sin geolocalización → ciudad por defecto
      set({ city: active[0] ?? null, isLoading: false });
    }
  },
}));
