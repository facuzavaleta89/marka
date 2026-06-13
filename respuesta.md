# Implementación — Resolución de los 3 errores de lint preexistentes

> Hecho el 12 jun 2026. Los 3 errores de lint (ClusterLayer ×2, StatsCard ×1) se
> resolvieron según su naturaleza: 2 arreglados de verdad, 1 silenciado con
> comentario. Los 2 warnings de react-hook-form quedan como están (conocidos).

Resultado: **`npm run lint` → `✖ 2 problems (0 errors, 2 warnings)`** (antes eran 3
errores + 2 warnings). **`npx tsc --noEmit` → 0 errores.**

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/components/map/ClusterLayer.tsx` | Las dos escrituras de refs en render se movieron a un `useLayoutEffect` |
| `src/components/dashboard/StatsCard.tsx` | `eslint-disable-next-line` comentado sobre el `setN(target)` benigno |

---

## 1. ClusterLayer.tsx — ARREGLADO (react-hooks/refs)

**Antes** (líneas 60/62): las refs se escribían **en render**, inseguro bajo render
concurrente:
```ts
const isVisitedRef = useRef(isVisited);
isVisitedRef.current = isVisited;       // ← en render
const isFavoriteRef = useRef(isFavorite);
isFavoriteRef.current = isFavorite;     // ← en render
```

**Ahora**: las asignaciones viven en un `useLayoutEffect` sin array de deps (corre
en cada commit), declarado **antes** de los efectos que crean/actualizan markers:
```ts
const isVisitedRef = useRef(isVisited);
const isFavoriteRef = useRef(isFavorite);

// Mantener las refs "latest" sin escribirlas en render (eso es inseguro bajo
// render concurrente). useLayoutEffect corre sincrónico tras el commit y ANTES
// de los efectos pasivos de markers (los de abajo), así que cuando esos efectos
// leen isVisitedRef/isFavoriteRef ya tienen el valor fresco. Va declarado antes
// que ellos para garantizar ese orden.
useLayoutEffect(() => {
  isVisitedRef.current = isVisited;
  isFavoriteRef.current = isFavorite;
});
```
- Se agregó `useLayoutEffect` al import de `react`.
- **Por qué `useLayoutEffect` y no `useEffect`**: corre sincrónico tras el commit y
  **antes de los efectos pasivos** (los de markers, líneas 84/126/153 originales),
  así que las refs están frescas cuando esos efectos las leen. Declararlo primero
  refuerza el orden.
- **No se tocó la lógica de markers ni los otros efectos** — solo se movió *dónde*
  se actualizan las dos refs. El comportamiento "latest ref" (los efectos de
  markers leen siempre la versión fresca de `isVisited`/`isFavorite` sin recrear
  markers) se preserva: el patrón de exclusión de deps (línea 120) sigue igual.
- `selectedIdRef` no se tocó: ya se actualizaba dentro de efectos (no en render),
  no estaba flaggeado.

## 2. StatsCard.tsx — SILENCIADO con comentario (react-hooks/set-state-in-effect)

El `setN(target)` sincrónico es la rama benigna del count-up (salto al valor final
sin animar, en `prefers-reduced-motion` o `target ≤ 0`). Se silenció con comentario
explicativo, sin refactorizar la animación:
```ts
if (reduce || target <= 0) {
  // Count-up: salto directo al valor final sin animar (reduced-motion o
  // target 0). Es seguro: sin loop (las deps no incluyen n) y un solo render
  // extra, imperceptible. Animar con rAF requiere setState en efecto igual.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setN(target);
  return;
}
```
- **Por qué es seguro**: sin loop (las deps del efecto son `[target, durationMs]`,
  no incluyen `n`), un solo render extra imperceptible, y la animación rAF
  inherentemente necesita setState dentro del efecto.
- No se refactorizó: el disable comentado es la respuesta proporcionada (un
  refactor agregaría complejidad para evitar un render benigno).

## 3. Warnings de react-hook-form — SIN TOCAR

Los 2 warnings (`RegisterForm.tsx:105`, `PropertyForm.tsx:232`,
`react-hooks/incompatible-library`) quedan como están: son inherentes a RHF +
React Compiler (el `watch()` no es memoizable), no accionables, y ya documentados
en CLAUDE.md como warnings cosméticos conocidos. Son warnings, no errores → no
bloquean el build.

---

## Verificación
- `npm run lint` → **2 problems (0 errors, 2 warnings)** — los 3 errores
  desaparecieron; quedan solo los 2 warnings conocidos y aceptados.
- `npx tsc --noEmit` → **0 errores**.

> Nota: no verifiqué el mapa corriendo (sin entorno gráfico en esta sesión). El
> cambio de ClusterLayer es de equivalencia de comportamiento (mismas refs, mismo
> contenido, solo cambia el momento de la escritura: de render a layout-effect, que
> corre antes de los efectos de markers). Conviene confirmar en la app que los
> markers sigan reflejando visitado/favorito en vivo —marcar un favorito en el
> modal debería actualizar el pin sin recrear markers—, que es justo lo que el
> patrón "latest ref" garantiza y que este cambio preserva.
