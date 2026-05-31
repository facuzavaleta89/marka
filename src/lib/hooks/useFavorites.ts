"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoredFavorite } from "@/types";

const FAVORITES_KEY = "marka_favorites";
// Evento interno para sincronizar todas las instancias del hook en la misma
// pestaña (el corazón del modal y los pines del mapa son instancias distintas).
const FAVORITES_EVENT = "marka:favorites-changed";

function readFavorites(): StoredFavorite[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeFavorites(favorites: StoredFavorite[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // localStorage no disponible en modo privado con cuota llena
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<StoredFavorite[]>(() =>
    readFavorites()
  );

  // Mantener en sync todas las instancias: al togglear en una (ej. el modal),
  // el resto (ej. ClusterLayer) re-lee y se actualiza. 'storage' cubre otras
  // pestañas; el CustomEvent cubre la pestaña actual.
  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    window.addEventListener(FAVORITES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isFavorite = useCallback(
    (propertyId: string) => favorites.some((f) => f.property_id === propertyId),
    [favorites]
  );

  const toggleFavorite = useCallback((propertyId: string) => {
    // localStorage es la fuente de verdad: leemos, escribimos y avisamos.
    const current = readFavorites();
    const exists = current.some((f) => f.property_id === propertyId);
    const next = exists
      ? current.filter((f) => f.property_id !== propertyId)
      : [...current, { property_id: propertyId, saved_at: new Date().toISOString() }];
    writeFavorites(next);
    setFavorites(next);
    // Notificar a las demás instancias del hook (misma pestaña)
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  }, []);

  return { favorites, isFavorite, toggleFavorite };
}
