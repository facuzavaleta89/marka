"use client";

import { useEffect, useRef } from "react";
import { useVisitedProperties } from "@/lib/hooks/useVisitedProperties";
import { registerView } from "@/lib/utils/registerView";

// ─── Conteo de visita en la ficha pública ─────────────────────
//
// Isla de cliente que no renderiza nada. Cuenta la visita con la PRIMERA
// INTERACCIÓN REAL de la persona, NUNCA al montar.
//
// ⚠ POR QUÉ NO AL MONTAR: Googlebot SÍ ejecuta JavaScript, y su renderizador
// arranca sin nada en localStorage, así que para él cada pasada sería una
// propiedad "nueva". Y el mapa del sitio le ofrece todas las fichas, así que
// pasa seguido. Un robot renderiza pero no interactúa; una persona que abre la
// ficha toca, scrollea o usa el teclado enseguida.
//
// ⚠ LOS EVENTOS, Y POR QUÉ ESOS:
//   · pointerdown — cualquier toque o click, con mouse, dedo o lápiz. En
//     pantalla táctil también dispara al empezar a deslizar para scrollear.
//   · touchstart  — lo mismo para navegadores táctiles sin Pointer Events.
//   · wheel       — la rueda o el trackpad del escritorio: es la intención de
//     scrollear, y dispara aunque la página no tenga nada más para bajar.
//   · keydown     — teclado (flechas, espacio, tabulador, re pág).
// ⚠ NO se escucha `scroll` a propósito: no es una interacción sino su efecto, y
// dispara también cuando la página se desplaza SOLA (restauración al volver
// atrás, un ancla, el navegador llevando un elemento enfocado a la vista). El
// scroll de una persona ya lo cubren wheel, el toque y el teclado.
// Tampoco `mousemove`: pasar el mouse por encima no es decidir mirar.
//
// Se escucha en `window` en fase de CAPTURA: llega antes que cualquier
// `stopPropagation` de los componentes de la página. Y `passive`: nunca se
// llama a preventDefault, así que no frena el scroll.
//
// ⚠ UNA SOLA VEZ POR APERTURA, EN TRES CAPAS:
//   1. `firedRef`: el primer evento lo pone en true y todo lo que llegue
//      después (el touchstart que acompaña a un pointerdown, otro click) sale
//      sin hacer nada. La ref sobrevive al desmontaje/montaje doble que
//      StrictMode hace en desarrollo, así que el efecto repetido no rearma nada.
//   2. `stop()`: el mismo manejador saca las cuatro escuchas, y el cleanup del
//      efecto también — en desarrollo el primer montaje se desarma solo.
//   3. `markVisited`: si la propiedad ya estaba vista (por este camino o por el
//      pin o la lista del mapa), devuelve false y no se cuenta.
// El montaje lleva `key={property.id}` en la página: si la navegación pasa a
// otra ficha reutilizando el componente, la key fuerza una instancia nueva con
// su `firedRef` en false.
const INTERACTION_EVENTS = ["pointerdown", "touchstart", "wheel", "keydown"] as const;
const LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, passive: true };

export function PropertyViewTracker({ propertyId }: { propertyId: string }) {
  const { markVisited } = useVisitedProperties();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;

    function stop() {
      for (const type of INTERACTION_EVENTS) {
        window.removeEventListener(type, onFirstInteraction, LISTENER_OPTIONS);
      }
    }

    function onFirstInteraction() {
      if (firedRef.current) return;
      firedRef.current = true;
      stop();
      // Marcar primero (no depende de la base) y contar solo si era nueva.
      if (markVisited(propertyId)) registerView(propertyId);
    }

    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, onFirstInteraction, LISTENER_OPTIONS);
    }
    return stop;
  }, [propertyId, markVisited]);

  return null;
}
