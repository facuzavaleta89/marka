# Tanda: hojas desde abajo en pantallas chicas — informe

> **Modo ejecución.** Se modificaron 4 archivos de `src/`. No se ejecutó ningún comando de git. No se tocó la base: la única consulta fue un `SELECT` de solo lectura para conseguir un sitio de marca activo contra el cual probar. **`CLAUDE.md` NO se modificó**; el motivo está en el punto 6: el número resultó correcto después del arreglo.
>
> **Cómo se midió:** build de producción servido con `next start`, Chrome headless manejado por el protocolo de DevTools, viewport emulado de 375×667 táctil (`deviceScaleFactor` 2). Mismo script antes y después, así que las dos columnas son comparables. Los scripts están en el scratchpad de la sesión, fuera del repo. El servidor y los Chrome quedaron apagados.
>
> ⚠ **Límite:** los eventos táctiles del protocolo son sintéticos. Son los mismos eventos de puntero que genera un dedo, pero no hay barras del navegador ni gestos del sistema. Por eso el punto 9 detalla la prueba en un teléfono real.

---

## 1. Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/components/map/FilterPanel.tsx` | Contenedor interno de `h-full` a `flex-1 min-h-0` (desborde). Arrastre para cerrar desde la franja y el encabezado. Cierre con Escape |
| `src/components/map/PropertyModal.tsx` | Las dos raíces con `h-full` —`ModalContent` y `ModalSkeleton`— pasan a `flex-1 min-h-0` (mismo desborde). **El gesto no se tocó** |
| `src/app/(public)/page.tsx` | Los botones flotantes se ocultan también con la hoja de filtros abierta |
| `src/components/map/AgencyMapView.tsx` | Lo mismo, en el sitio de marca, que duplica esos botones |

⚠ **`ModalSkeleton` no estaba nombrado en el prompt** y tiene exactamente el mismo `h-full` dentro de la misma hoja (`PropertyModal.tsx:127`). Si se corregía solo `ModalContent`, el esqueleto de carga seguía desbordando 20 px y **el contenido saltaba 20 px al terminar de cargar**. Es el defecto que el propio comentario de `ModalSkeleton` dice querer evitar. Lo incluí por eso.

---

## 2. ⚠ Mediciones antes y después — 375×667, con el scroll al fondo

La hoja mide 566,94 px (85vh) y su franja 20 px, **igual antes y después: la altura no se tocó.**

### Cero filtros activos

| | Antes | Después |
|---|---|---|
| Contenedor interno (alto) | 566,94 | **546,94** |
| **Desborde por debajo de la pantalla** | **20 px** (terminaba en y = 687) | **0 px** (termina en y = 667) |
| Cuerpo scrolleable | caja 509,94, de los cuales 489,94 visibles | **489,94, todo visible** |
| Relleno inferior del cuerpo (20 px) | fuera de pantalla | visible |
| Fila "Solo propiedades destacadas" | y 646,56 → 666,56 (pegada al borde) | **y 626,56 → 646,56** (20 px de aire) |
| Título "Destacadas" | y 618,06 → 634,56 | y 598,06 → 614,56 |
| Botones flotantes | **presentes**, y 599 → 643 | **no están en el DOM** |
| **Qué quedaba debajo de ellos** | **título "Destacadas"**. `elementFromPoint` en x = 27 → `FAB_FILTROS` y en x = 322 → `FAB_LISTA`, a y = 606/621/635 | **nada**: en esos mismos puntos responden "Destacadas" y "Solo propiedades destacadas" |

⚠ **El acople que advertía el prompt, confirmado:** después del arreglo del desborde, la fila "Solo destacadas" ocupa y 626,56 → 646,56. Los botones ocupaban y 599 → 643, así que **16,44 de sus 20 px habrían quedado debajo del botón**. En la medición "después", los puntos (27, 635) y (322, 635) —antes `FAB_FILTROS` y `FAB_LISTA`— caen sobre esa fila. Arreglar solo el desborde la metía debajo de los botones; ocultarlos es lo que la deja libre.

### Con filtros activos (dos: "Pileta" y "Solo destacadas")

| | Antes | Después |
|---|---|---|
| Contenedor interno (alto) | 566,94 | **546,94** |
| **Desborde por debajo de la pantalla** | **20 px** | **0 px** |
| Pie "Limpiar filtros" | y 612 → 687 (20 px afuera) | **y 592 → 667** |
| Botón "Limpiar filtros (2)" | y 629 → 671, **4 px fuera de pantalla** | **y 609 → 651, 0 px afuera** |
| Cuerpo scrolleable | 434,94 | **414,94** (el pie subió 20 px) |
| Botones flotantes | **presentes**, y 599 → 643 (el de filtros dice "Filtros (2)", 16 → 137,13) | **no están en el DOM** |
| **Qué quedaba debajo de ellos** | **la franja superior del botón "Limpiar filtros (2)"** (y 629 → 643, a los costados) | **nada**: en los 9 puntos donde estaban los botones responde "Limpiar filtros (2)" |

### Control de regresión: panel lateral de escritorio (1280×800)

| | Antes | Después |
|---|---|---|
| Contenedor interno | 744 | **744** |
| Cuerpo scrolleable | 744 (contenido 954) | **744 (contenido 954)** |

Idéntico: en escritorio el contenedor no tiene hermano arriba, así que `h-full` y `flex-1 min-h-0` miden lo mismo.

---

## 3. Cómo se ocultan los botones flotantes

**Se siguió el mecanismo que ya existía.** Los botones ya se ocultaban con la hoja del detalle de propiedad mediante un render condicional (`{!selectedPropertyId && (…)}`). Se agregó la segunda condición a esa misma expresión, **en las dos pantallas**:

```tsx
// src/app/(public)/page.tsx:170
      {!selectedPropertyId && !filterPanelOpen && (
```

```tsx
// src/components/map/AgencyMapView.tsx:143
      {!selectedPropertyId && !filterPanelOpen && (
```

`filterPanelOpen` es el estado que ya controlaba la hoja en cada pantalla (`page.tsx:59`, `AgencyMapView.tsx:44`). No hubo que subir estado ni pasar nada nuevo.

**Verificado en las dos pantallas:**
- **Home:** los botones están con la hoja cerrada, desaparecen al abrirla y vuelven al cerrarla (tanto con la ✕ como arrastrando).
- **Sitio de marca `/inmobiliaria-demo`:** con la hoja cerrada `{filtros: true, lista: true}`, abierta `{false, false}` y cerrada por arrastre `{true, true}`. Ahí el desborde también dio 0 (el contenido termina en y = 667).

**No se tocó:** el orden de capas (los botones siguen en `z-[610]`) ni ninguna altura.

---

## 4. El gesto

### El código

Constantes, `src/components/map/FilterPanel.tsx:47-53`:

```tsx
// Arrastre para cerrar la hoja (mobile). Por debajo de DRAG_SLOP_PX de
// movimiento el gesto es un TOQUE y no mueve nada: es lo que deja funcionar la
// ✕, que vive en la misma zona que se arrastra. DRAG_CLOSE_PX es el mismo
// umbral que usa la hoja del detalle de propiedad (PropertyModal), para que las
// dos franjas, que son idénticas a la vista, respondan igual al tacto.
const DRAG_SLOP_PX = 8;
const DRAG_CLOSE_PX = 120;
```

Escape y arrastre, `FilterPanel.tsx:182-308`:

```tsx
  // ── Cierre de la hoja (solo mobile) ────────────────────────────
  //
  // Escape: solo la instancia mobile y solo con la hoja abierta. La instancia
  // de escritorio está montada siempre, y escuchar la tecla ahí cerraría algo
  // que no existe.
  useEffect(() => {
    if (!mobile || !isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobile, isOpen, onClose]);

  // Arrastre hacia abajo para cerrar.
  //
  // ⚠ SE ESCUCHA SOLO EN LA ZONA QUE NO SCROLLEA: la franja y el encabezado.
  // NUNCA en la hoja entera. Arrastrar para cerrar y scrollear el contenido son
  // dos gestos verticales; si el arrastre se escuchara en el cuerpo, un intento
  // de volver al principio de la lista cerraría el panel. La hoja del detalle de
  // propiedad (PropertyModal) escucha la hoja entera sin mirar el scroll: de ahí
  // se tomó el mecanismo (desplazamiento en vivo + umbral), NO el alcance. La
  // garantía es estructural: los manejadores se montan en la franja y en el
  // encabezado, y el cuerpo scrolleable no es descendiente de ninguno de los dos.
  //
  // ⚠ LA HOJA SE MUEVE CON LA PROPIEDAD CSS `translate`, NO CON `transform`.
  // Tailwind v4 escribe `translate-y-0` / `translate-y-full` como `translate`
  // (medido: `transform` da `none` con la hoja abierta y cerrada). Escribir
  // `transform` en línea SUMARÍA un segundo desplazamiento en vez de reemplazar
  // el de la clase. El estilo en línea de abajo pisa la misma propiedad.
  //
  // El desplazamiento se escribe directo en el DOM y no en un estado de React:
  // un setState por `pointermove` re-renderizaría el panel entero —todos los
  // filtros— en cada píxel del gesto.
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    dy: number;
    dragging: boolean;
  } | null>(null);
  // Un arrastre que empezó sobre la ✕ no tiene que terminar en un click sobre
  // ella. Se limpia en cada `pointerdown`, así que nunca se come el click de un
  // toque posterior.
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

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      dy: 0,
      dragging: false,
    };
    // Capturar de entrada, salvo que el gesto empiece sobre un botón: capturar
    // redirige el `pointerup` a esta zona, el click dejaría de caer en la ✕ y el
    // botón no cerraría con un toque. Sobre un botón se captura recién cuando el
    // movimiento pasa a ser arrastre.
    if (!(e.target as Element).closest("button")) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
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

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (!drag.dragging) return; // fue un toque: el click sigue su curso
    suppressClickRef.current = true;
    setSheetOffset(null);
    // `pointercancel` (el sistema se llevó el gesto) vuelve la hoja a su lugar
    // sin cerrarla.
    if (e.type === "pointerup" && drag.dy > DRAG_CLOSE_PX) onClose?.();
  };

  const handleDragClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // `touch-none` en las dos zonas: sin eso el navegador puede reclamar el gesto
  // táctil para sí (desplazamiento, recarga al tirar hacia abajo) y cancelarlo
  // con `pointercancel` a mitad de camino. Esas zonas no scrollean, así que no
  // se pierde nada.
  const dragZoneProps = {
    onPointerDown: handleDragStart,
    onPointerMove: handleDragMove,
    onPointerUp: handleDragEnd,
    onPointerCancel: handleDragEnd,
    onClickCapture: handleDragClickCapture,
  };
```

Montaje, solo en las dos zonas fijas (`FilterPanel.tsx:372-376` y `:612-617`):

```tsx
      {mobile && (
        <div
          {...dragZoneProps}
          className="flex items-center justify-between px-5 py-4 border-b border-stone shrink-0 touch-none"
        >
```

```tsx
        <div
          {...dragZoneProps}
          className="flex justify-center pt-3 pb-1 shrink-0 touch-none"
        >
          <div className="w-10 h-1 bg-stone rounded-full" />
        </div>
```

### Cómo se distingue un toque de un arrastre

- **Umbral de 8 px.** Mientras el dedo se mueve menos de `DRAG_SLOP_PX`, el gesto sigue siendo un toque: la hoja no se mueve y al soltar `handleDragEnd` sale por `if (!drag.dragging) return;` **sin tocar nada**, así que el click llega a la ✕.
- **Captura de puntero diferida sobre la ✕.** Si el gesto empieza sobre un botón, el puntero **no se captura** hasta pasar a arrastre. Capturar de entrada redirigiría el `pointerup` a la zona y el click dejaría de caer en la ✕. Fuera de un botón se captura de entrada, así un arrastre que sale de la zona de 77 px sigue llegando a los manejadores.
- **Un arrastre no termina en click.** Si hubo arrastre, `suppressClickRef` se enciende y `onClickCapture` anula el click siguiente sobre la zona. Se apaga en cada `pointerdown`, así que nunca se come el click de un toque posterior.

### Cómo se garantiza que no se dispare desde el cuerpo

**Por estructura, no por una condición.** Los manejadores están solo en la franja y en el encabezado, y el cuerpo scrolleable es **hermano** del encabezado, no descendiente: un `pointerdown` en el cuerpo nunca llega a ellos. **No se copió el alcance del precedente**: `PropertyModal` escucha la hoja entera (`onTouchStart`/`Move`/`End` en el contenedor).

### El desplazamiento

- **Antes de escribir se midió:** con la hoja cerrada `translate: "0px 100%"` y `transform: "none"`; abierta, `translate: "0px"` y `transform: "none"`. La transición cubre `transform, translate, scale, rotate`. O sea: **Tailwind v4 mueve la hoja con `translate`**.
- El gesto escribe **`style.translate`**, la misma propiedad que la clase, así que la **reemplaza** en vez de sumarse. Medido a mitad de arrastre: `translate: "0px 30px"` con la hoja corrida exactamente 30 px (arriba de 100,06 a 130,06) y `transform` en `none`.
- Al soltar se limpia el estilo en línea y la transición de la clase anima la vuelta o la salida. Medido después de todas las pruebas: sin estilo en línea residual.

### Las 13 pruebas del gesto (después)

| # | Prueba | Antes | Después |
|---|---|---|---|
| 1 | Arrastrar 60 px desde la franja | no se mueve | se mueve 30 px a mitad de camino y **vuelve** (no cierra) |
| 2 | Arrastrar 200 px desde la franja | no se mueve | **cierra**; los botones vuelven |
| 3 | Arrastrar 200 px desde el encabezado | no se mueve | **cierra** |
| 4 | **Arrastrar 200 px desde el cuerpo** (con scroll en 200) | scrollea a 0, la hoja quieta | **scrollea a 0, la hoja quieta** (arriba en 100,06, sin estilo en línea) |
| 5 | Toque en la ✕ | cierra | **cierra** |
| 6 | Toque en la ✕ con 4 px de temblor | cierra | **cierra** |
| 7 | Arrastre de 60 px que empieza sobre la ✕ | no cierra | **no cierra** (ni por gesto ni por click) |
| 8 | Arrastre de 200 px que empieza sobre la ✕ | no cierra | **cierra por gesto** |
| 9 | Escape | **no cierra** | **cierra** |
| 10 | Mouse: arrastre de 200 px desde la franja | no cierra | **cierra** |
| 11 | Mouse: click en la ✕ | cierra | **cierra** |
| 12 | Tocar el velo | cierra | **cierra** |
| 13 | Estilo en línea residual | — | **ninguno** |

**La hoja del detalle de propiedad ya no tiene Escape, y no se implementó** porque está fuera de alcance. Una búsqueda de `"Escape"` en `src/` solo encuentra `FilterPanel.tsx:184` y `:190`. **Su gesto sigue funcionando**: verificado que un arrastre de 200 px desde su franja la cierra después del cambio.

---

## 5. Área scrolleable después del arreglo (375×667)

| Hoja | Antes | Después |
|---|---|---|
| **Filtros, cero filtros** | caja 509,94, visibles 489,94 (**20 px fuera de pantalla**) | **489,94**, todo visible |
| **Filtros, con filtros** (el pie ocupa 75 px) | 434,94 (el **pie** tenía 20 px afuera) | **414,94**, todo visible |
| **Detalle de propiedad** | 197,44 (la zona inferior terminaba en 687: **4 px del botón de WhatsApp afuera**) | **177,44**, con el botón en y 607 → 651, 0 px afuera |

⚠ **El área scrolleable NO creció: bajó 20 px en las tres filas, y es lo correcto.** Antes esos 20 px "sobraban" porque el fondo del contenido estaba fuera de pantalla, así que eran área inalcanzable, no área útil. Lo que se ve y se puede tocar es lo mismo o más. En el detalle de propiedad, el cambio real es que **el botón de contacto entra entero**.

**Escritorio, sin cambios:** panel de filtros 744 px. El panel lateral del detalle mide 744 de contenido en 744 de alto (cuerpo 354,5 + zona inferior 129,5), sin desborde.

---

## 6. El número de `CLAUDE.md`: NO se modificó, porque después del arreglo es correcto

La advertencia (`CLAUDE.md:1596`) dice:

> `| **Hoy** | 546,9 − 20 (handle) − 220 (carrusel) − 129,5 = **≈ 177 px** |`

| | Área que scrollea en la hoja del detalle |
|---|---|
| Medido **antes** de esta tanda | **197,44 px**, con 4 px del botón de contacto fuera de pantalla |
| Medido **después** de esta tanda | **177,44 px**, con el botón entero |
| Lo que dice `CLAUDE.md` | **≈ 177 px** |

**El número era incorrecto respecto del código de antes y es correcto respecto del código de ahora.** La cuenta de la advertencia (restarle al alto de la hoja los 20 px de la franja) describe exactamente cómo reparte el alto el contenedor cuando no desborda, que es lo que esta tanda arregló. La fila siguiente (*"Con un botón de ancho completo más ≈ 123 px"*) también cierra: 177,44 − 54 = 123,44.

El prompt autorizaba corregir **solo ese número con lo medido después**. Lo medido coincide con lo escrito, así que reescribirlo habría sido un cambio sin efecto sobre un archivo que la tanda no debía tocar. **`CLAUDE.md` quedó sin cambios.** Ver el punto 10.

---

## 7. Inconsistencias nuevas (sin arreglar, fuera de alcance)

El diagnóstico anterior listó 23; estas no estaban.

1. **`src/components/map/PropertyModal.tsx:747-755` y `:783-788` — `ModalContent` se monta DOS veces** cada vez que se abre una propiedad: una en el panel lateral de escritorio (`hidden md:flex`) y otra en la hoja de celular (`md:hidden`). Son dos árboles completos, con estado separado (campo de nombre, error de consulta, compartir, favorito) y el doble de DOM y de trabajo, de los cuales siempre uno está oculto. Mismo patrón de doble montaje que el panel de filtros, que produce los IDs duplicados.
2. **`PropertyModal.tsx:747` — el panel lateral usa `top-14` fijo**, acoplado por un número repetido al `h-14` de los dos encabezados (`page.tsx:41`, `AgencyMapView.tsx:53`). Si un encabezado cambia de alto, el panel queda montado encima o deja un hueco, sin ningún error.
3. **Efecto colateral de esta tanda: al cerrar la hoja de filtros no hay a dónde devolver el foco.** El botón que la abrió **se desmonta** mientras está abierta (la decisión 1), así que al cerrar con Escape o con la ✕ el foco queda en un elemento de la hoja, que ahora está fuera de pantalla. Por lectura, no medido. Agrava la inconsistencia 7 del informe anterior (la hoja sin manejo de foco), y **pasa igual con la hoja del detalle**, que ya desmontaba los botones.
4. **Los botones flotantes desaparecen de golpe** mientras la hoja sube en 220 ms, y reaparecen de golpe mientras baja. Es la consecuencia visual de ocultarlos con un render condicional, el mecanismo que ya usaba la hoja del detalle: las dos hojas quedan coherentes, pero ninguna anima esa salida.
5. **Las dos hojas mueven la misma superficie con propiedades CSS distintas:** la de filtros escribe `translate` (`FilterPanel.tsx:238`) y la del detalle escribe `transform` (`PropertyModal.tsx`, el `style` del contenedor de la hoja). Las dos funcionan hoy, pero la del detalle **suma** su desplazamiento al de la clase en vez de reemplazarlo.
6. **Asimetría deliberada que conviene saber:** la franja ahora arrastra en las dos hojas, pero **la del detalle también cierra arrastrando desde el cuerpo**, y la de filtros no. Tocar las dos igual al principio del gesto no garantiza el mismo resultado al seguir bajando.
7. **`DESIGN.md:908` (§16, FABs mobile) dice *"Se ocultan cuando el PropertyModal está abierto"***, y desde esta tanda también se ocultan con la hoja de filtros abierta. El prompt no pedía tocar `DESIGN.md`, así que queda desactualizado.
8. **El usuario de solo lectura del MCP no puede ejecutar `agency_is_publicly_visible`** (`ERROR: 42501: permission denied for function agency_is_publicly_visible`). `CLAUDE.md` indica medir la base por MCP, pero la regla de cobro —la función central del modelo— no se puede evaluar desde ahí; hay que reconstruir sus condiciones a mano en cada consulta.

---

## 8. Baseline de calidad

Antes de correr borré `.next/` y `tsconfig.tsbuildinfo` para no mezclar artefactos de `next start` con los tipos generados. Son artefactos regenerados e ignorados por git.

### `npx tsc --noEmit`

```
TSC_EXIT=0
```

Sin salida: **0 errores, exit 0.**

### `npm run lint`

```
> marka@0.1.0 lint
> eslint


/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  808:30  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:808:30
  806 |   });
  807 |
> 808 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
      |                              ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  809 |   const lat = watch("lat");
  810 |   const lng = watch("lng");
  811 |   const address = watch("address") ?? "";  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)

LINT_EXIT=0
```

**0 errores, 1 warning (el conocido), exit 0.**

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 10.0s
  Running TypeScript ...
  Finished TypeScript in 9.7s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/20) ...
  Generating static pages using 3 workers (5/20) 
  Generating static pages using 3 workers (10/20) 
  Generating static pages using 3 workers (15/20) 
✓ Generating static pages using 3 workers (20/20) in 1442ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /[slug]
├ ƒ /admin
├ ƒ /api/geocode
├ ○ /apple-icon.png
├ ƒ /dashboard
├ ƒ /dashboard/equipo
├ ƒ /dashboard/leads
├ ƒ /dashboard/perfil
├ ƒ /dashboard/preferencias
├ ƒ /dashboard/propiedades
├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /dashboard/propiedades/nueva
├ ƒ /dashboard/suscripcion
├ ƒ /login
├ ƒ /logout
├ ƒ /propiedades/[slug]
├ ƒ /register
├ ƒ /register/plan
├ ○ /robots.txt
└ ƒ /sitemap.xml


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

BUILD_EXIT=0
```

**Verde, exit 0, 22 rutas**, con los mismos nombres y tipos (`○`/`ƒ`) que antes. **Sin cambios en el baseline.**

---

## 9. Cómo probarlo en un teléfono, paso a paso

### Poner la app en el teléfono

- **Opción A, red local.** En la PC, con el teléfono en la misma Wi-Fi: `npm run build` y después `npx next start -H 0.0.0.0 -p 3000`. En el teléfono, abrir `http://<IP-de-la-PC>:3000`. La IP sale de `ip addr` o `hostname -I`.
- **Opción B, vista previa de Vercel.** Subiendo la rama, que es un paso de git a hacer a mano.

### Hoja de filtros, sin filtros

1. Abrir `/`. Abajo tienen que verse los dos botones, "Filtros" y "Ver lista".
2. Tocar **Filtros**. **Los dos botones tienen que desaparecer** mientras la hoja sube.
3. Scrollear el contenido hasta el final. **"Solo propiedades destacadas" tiene que verse entera, con aire debajo**, y nada encima.
4. Tocar el checkbox "Solo propiedades destacadas" y destildarlo: tiene que responder.

### Hoja de filtros, con filtros activos (forzar el caso)

5. Con la hoja abierta, **marcar "Pileta" y "Solo propiedades destacadas"**. Abajo aparece el pie **"Limpiar filtros (2)"**.
6. Scrollear al final. **El botón "Limpiar filtros (2)" tiene que verse entero**, con su borde inferior sobre el borde de la pantalla, y ser tocable en todo su ancho, costados incluidos.
7. **No tocarlo todavía**: cerrar la hoja con la ✕. Los botones tienen que volver, con el de la izquierda diciendo **"Filtros (2)"**.

### El gesto

8. Abrir la hoja. **Apoyar el dedo en la franja gris y bajarlo un poco** (1 cm) y soltar: la hoja tiene que acompañar el dedo y **volver a su lugar**.
9. Repetir **bajando bastante** (3–4 cm): **tiene que cerrarse**.
10. Repetir desde el **título "Filtros"** del encabezado: igual.
11. **Tocar la ✕** normalmente: tiene que cerrar. Probar también tocándola con poco cuidado, apenas moviendo el dedo.
12. **La prueba importante:** abrir la hoja, **scrollear el contenido hacia abajo**, y después **arrastrar el contenido hacia abajo para volver arriba**, empezando en el medio de la lista. **La hoja NO tiene que moverse ni cerrarse**: solo el contenido scrollea. Insistir hasta llegar al principio y seguir tirando.
13. Arrastrar hacia abajo empezando **sobre la ✕** y bajar bastante: tiene que cerrarse por gesto, **sin** dispararse además un segundo cierre raro.
14. **Tocar el velo oscuro** por encima de la hoja: tiene que cerrar.

### Sitio de marca

15. Abrir `/inmobiliaria-demo` y repetir los pasos 2, 3, 5, 6 y 9. **Los botones tienen que ocultarse igual.**

### Escape

16. En el teléfono no hay tecla Escape salvo con un teclado bluetooth. Alternativa: en la PC, abrir DevTools, activar el modo dispositivo con un teléfono de 375 px, abrir la hoja y apretar Escape. **Tiene que cerrar.** En el detalle de una propiedad, Escape **no** cierra (fuera de alcance).

### Hoja del detalle de propiedad

17. Tocar **Ver lista**, tocar una propiedad. Sin scrollear, **el botón verde "Consultar por WhatsApp" tiene que verse entero** sobre el borde inferior.
18. Arrastrar hacia abajo desde su franja: tiene que seguir cerrando, como antes.

---

## 10. Lo que resultó falso o imposible

**Ninguna decisión resultó imposible.** Las cuatro se implementaron como estaban descritas.

**Lo que resultó falso o impreciso en el prompt:**

1. **"La última fila del contenido queda fuera de la pantalla" — impreciso.** Medido antes: sin filtros, lo que estaba fuera de pantalla era **el relleno inferior del cuerpo** (20 px vacíos); la última fila, "Solo propiedades destacadas", se veía entera pero **pegada al borde** (a 0,44 px). Con filtros, lo que salía era **el pie**: 4 px del botón "Limpiar filtros" y todo su relleno inferior. El defecto era real y del tamaño que decía el prompt (20 px); lo que caía afuera no era una fila de contenido.
2. **"El número de CLAUDE.md es incorrecto" — cierto respecto del código de antes, falso respecto del de ahora.** El área medida antes era 197,44 px con el CTA recortado; la documentada, ≈ 177 px; la medida después, 177,44 px. **La advertencia describía el estado sin desborde, que recién esta tanda produjo.** No se editó.
3. **"Es la misma línea" (el desborde en las dos hojas) — incompleto.** En la hoja del detalle son **dos** raíces con la misma causa: `ModalContent` y **`ModalSkeleton`**. Se corrigieron las dos (ver el punto 1).

**Confirmado tal cual:** el acople entre desborde y botones (la fila habría quedado 16,44 px debajo del botón); el precedente de ocultar los botones (`!selectedPropertyId`); la duplicación de esos botones en dos pantallas; la franja idéntica que arrastra en la otra hoja; que esa hoja escucha el gesto en el contenedor entero; que Tailwind mueve la hoja con `translate` y no con `transform`; y que la hoja del detalle no se cierra con Escape.
