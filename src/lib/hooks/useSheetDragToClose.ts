"use client";

import { useRef } from "react";

// ─── Arrastre hacia abajo para cerrar una hoja que sube desde abajo ──────
//
// Lo usan las dos hojas de celular: la de filtros (FilterPanel) y la del
// detalle de propiedad (PropertyModal). Antes cada una tenía su propio gesto y
// se comportaban distinto al tacto aunque se vieran idénticas.
//
// Por debajo de DRAG_SLOP_PX de movimiento el gesto es un TOQUE y no mueve
// nada: es lo que deja funcionar los botones que viven en la misma zona que se
// arrastra (la ✕, compartir, favorito…). Pasado DRAG_CLOSE_PX al soltar, la
// hoja se cierra; si no, vuelve a su lugar. No se mira la velocidad.
const DRAG_SLOP_PX = 8;
const DRAG_CLOSE_PX = 120;

// Elementos sobre los que la captura del puntero se DIFIERE hasta que el
// movimiento pase a ser arrastre (ver handleDragStart). No es solo `button`:
// sobre la foto del detalle hay un enlace ("Ver ficha completa") y puede haber
// un campo de solo lectura (el fallback de compartir).
const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="button"]';

export type SheetDragZoneProps = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
};

// ⚠ LAS ZONAS DE ARRASTRE TIENEN QUE SER LAS QUE NO SCROLLEAN (la franja, el
// encabezado, la foto del detalle), NUNCA la hoja entera. Arrastrar para cerrar
// y scrollear el contenido son dos gestos verticales: si el arrastre se
// escuchara en el cuerpo, volver al principio del texto cerraría la hoja. La
// garantía es estructural, y la pone quien usa el hook: `dragZoneProps` se
// monta solo en esas zonas, y el cuerpo scrolleable no es descendiente de
// ninguna.
//
// ⚠ Y LAS ZONAS LLEVAN `touch-none`: sin eso el navegador puede reclamar el
// gesto táctil para sí (desplazamiento, recarga al tirar hacia abajo) y
// cancelarlo con `pointercancel` a mitad de camino. Esas zonas no scrollean,
// así que no se pierde nada. La clase la pone quien usa el hook.
export function useSheetDragToClose(onClose: () => void): {
  sheetRef: React.RefObject<HTMLDivElement | null>;
  dragZoneProps: SheetDragZoneProps;
} {
  // ⚠ LA HOJA SE MUEVE CON LA PROPIEDAD CSS `translate`, NO CON `transform`.
  // Tailwind v4 escribe `translate-y-0` / `translate-y-full` como `translate`
  // (medido: `transform` da `none` con la hoja abierta y cerrada). Escribir
  // `transform` en línea SUMARÍA un segundo desplazamiento en vez de reemplazar
  // el de la clase —el detalle lo hacía, y al cerrar por gesto saltaba sin
  // animar—. El estilo en línea de abajo pisa la misma propiedad.
  //
  // El desplazamiento se escribe directo en el DOM y no en un estado de React:
  // un setState por `pointermove` re-renderizaría la hoja entera en cada píxel
  // del gesto.
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    dy: number;
    dragging: boolean;
  } | null>(null);
  // Un arrastre que empezó sobre un botón o un enlace no tiene que terminar en
  // un click sobre él. Se limpia en cada `pointerdown`, así que nunca se come
  // el click de un toque posterior.
  const suppressClickRef = useRef(false);

  const setSheetOffset = (dy: number | null) => {
    const el = sheetRef.current;
    if (!el) return;
    if (dy === null) {
      // Al soltar se devuelve el control a la clase: su `transition` anima la
      // vuelta a `translate-y-0` o, si se cerró, la salida a `translate-y-full`
      // desde donde quedó el dedo.
      el.style.translate = "";
      el.style.transition = "";
    } else {
      el.style.translate = `0 ${dy}px`;
      el.style.transition = "none";
    }
  };

  const handleDragStart = (e: React.PointerEvent<HTMLElement>) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      dy: 0,
      dragging: false,
    };
    // Capturar de entrada, salvo que el gesto empiece sobre un elemento
    // interactivo: capturar redirige el `pointerup` a la zona, el click dejaría
    // de caer en el botón o el enlace y un toque no haría nada. Sobre ellos se
    // captura recién cuando el movimiento pasa a ser arrastre.
    if (!(e.target as Element).closest(INTERACTIVE_SELECTOR)) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleDragMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const delta = e.clientY - drag.startY;
    if (!drag.dragging) {
      // Toque vs. arrastre: hasta DRAG_SLOP_PX de movimiento es un toque (el
      // temblor natural de un dedo no mueve la hoja ni anula el click).
      if (Math.abs(delta) < DRAG_SLOP_PX) return;
      drag.dragging = true;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
    // Solo hacia abajo: hacia arriba la hoja ya está en su tope.
    drag.dy = Math.max(0, delta);
    setSheetOffset(drag.dy);
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (!drag.dragging) return; // fue un toque: el click sigue su curso
    suppressClickRef.current = true;
    // ⚠ PRIMERO SE LIMPIA EL ESTILO Y DESPUÉS SE CIERRA. Si el cierre llegara
    // con `transition: none` todavía puesto, el cambio de clase a
    // `translate-y-full` sería instantáneo: la hoja desaparecería de golpe en
    // vez de salir animada desde donde quedó el dedo.
    setSheetOffset(null);
    // `pointercancel` (el sistema se llevó el gesto) vuelve la hoja a su lugar
    // sin cerrarla.
    if (e.type === "pointerup" && drag.dy > DRAG_CLOSE_PX) onClose();
  };

  const handleDragClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    sheetRef,
    dragZoneProps: {
      onPointerDown: handleDragStart,
      onPointerMove: handleDragMove,
      onPointerUp: handleDragEnd,
      onPointerCancel: handleDragEnd,
      onClickCapture: handleDragClickCapture,
    },
  };
}
