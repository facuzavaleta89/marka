"use client";

import { useCallback, useState } from "react";
import type { StoredFavorite } from "@/types";

const FAVORITES_KEY = "marka_favorites";

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

  const isFavorite = useCallback(
    (propertyId: string) => favorites.some((f) => f.property_id === propertyId),
    [favorites]
  );

  const toggleFavorite = useCallback((propertyId: string) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.property_id === propertyId);
      const next = exists
        ? prev.filter((f) => f.property_id !== propertyId)
        : [...prev, { property_id: propertyId, saved_at: new Date().toISOString() }];
      writeFavorites(next);
      return next;
    });
  }, []);

  return { favorites, isFavorite, toggleFavorite };
}
