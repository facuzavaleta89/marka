"use client";

import { useCallback, useState } from "react";

// Patrón Idealista: las propiedades que el visitante ya abrió pierden
// protagonismo en el mapa (tono atenuado), para dar sensación de progreso.
// Vive solo en el dispositivo (localStorage), sin login — igual que favoritos.
const VISITED_KEY = "marka_visited";

function readVisited(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeVisited(ids: string[]): void {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify(ids));
  } catch {
    // localStorage no disponible (modo privado / cuota llena)
  }
}

export function useVisitedProperties() {
  const [visited, setVisited] = useState<string[]>(() => readVisited());

  const isVisited = useCallback(
    (propertyId: string) => visited.includes(propertyId),
    [visited]
  );

  const markVisited = useCallback((propertyId: string) => {
    setVisited((prev) => {
      if (prev.includes(propertyId)) return prev;
      const next = [...prev, propertyId];
      writeVisited(next);
      return next;
    });
  }, []);

  return { visited, isVisited, markVisited };
}
