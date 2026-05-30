"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { City } from "@/types";

const CITY_KEY = "marka_city";

export function useCity() {
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<City | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("cities")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (cancelled) return;

        const active: City[] = (data as City[]) ?? [];
        setCities(active);

        // 1. Ciudad guardada en localStorage
        try {
          const raw = localStorage.getItem(CITY_KEY);
          if (raw) {
            const stored = JSON.parse(raw) as City;
            const found = active.find((c) => c.id === stored.id);
            if (found) {
              setCity(found);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // localStorage no accesible o JSON inválido
        }

        // 2. Geolocalización del navegador (silenciosa)
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
              if (cancelled) return;
              if (active.length === 0) {
                setCity(null);
                setIsLoading(false);
                return;
              }
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
              setCity(nearest);
              setIsLoading(false);
            },
            () => {
              // Permiso rechazado o error → ciudad por defecto
              if (!cancelled) {
                setCity(active[0] ?? null);
                setIsLoading(false);
              }
            },
            { timeout: 5000, maximumAge: 60_000 }
          );
        } else {
          // 3. Ciudad por defecto: primera activa ordenada por nombre
          setCity(active[0] ?? null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetCity = useCallback((newCity: City) => {
    setCity(newCity);
    try {
      localStorage.setItem(CITY_KEY, JSON.stringify(newCity));
    } catch {
      // localStorage no disponible (modo privado con cuota llena, etc.)
    }
  }, []);

  return { city, cities, setCity: handleSetCity, isLoading };
}
