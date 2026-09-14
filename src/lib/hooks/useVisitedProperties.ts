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

  // Marca la propiedad como vista y DEVUELVE si era nueva para este visitante
  // (`true`) o si ya estaba registrada (`false`). Esa señal es la que decide si
  // se suma una visita en la base (ver `registerView`): una vez por propiedad
  // por visitante, y como la lista es persistente, quien vio una casa hace
  // meses y vuelve no suma.
  //
  // ⚠ LA SEÑAL SALE DE UNA LECTURA SÍNCRONA DE localStorage, NUNCA DEL
  // ACTUALIZADOR DE ESTADO. Antes la comparación vivía dentro de
  // `setVisited((prev) => …)` y no salía de ahí; y aunque se la sacara, el
  // actualizador no corre necesariamente en el momento de la llamada y en
  // desarrollo corre DOS veces (StrictMode): una variable asignada adentro
  // podría leerse vacía o dar "nueva" dos veces. Es el mismo molde que
  // `toggleFavorite` en useFavorites: localStorage es la fuente de verdad —
  // leemos, escribimos y recién después actualizamos el estado.
  //
  // El ESTADO (lo que pinta los pines) se actualiza aparte, con el actualizador
  // sobre lo que ya había en memoria, y no con `setVisited(next)` como hace
  // favoritos. Motivo: si localStorage falla, `next` sería solo esta propiedad
  // y borraría de la pantalla las marcadas antes en la misma visita. Así el tono
  // "visitado" no depende de que el almacenamiento responda.
  //
  // ⚠ SIN localStorage (bloqueado, modo privado con cuota llena, etc.) la
  // lectura da siempre `[]` y la escritura falla en silencio: CADA APERTURA VA A
  // PARECER NUEVA Y VA A CONTAR COMO VISITA. Es una consecuencia conocida y no
  // resuelta a propósito.
  //
  // Los llamadores que la usaban ignorando el resultado siguen andando igual.
  const markVisited = useCallback((propertyId: string): boolean => {
    const current = readVisited();
    const isNew = !current.includes(propertyId);
    if (isNew) writeVisited([...current, propertyId]);

    setVisited((prev) =>
      prev.includes(propertyId) ? prev : [...prev, propertyId]
    );

    return isNew;
  }, []);

  return { visited, isVisited, markVisited };
}
