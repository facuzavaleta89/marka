# Fix: la navbar superior se scrollea fuera de vista en mobile

Implementados los DOS cambios complementarios: (1) `100vh` → `dvh` en los wrappers de
pantalla completa, y (2) lock de scroll del documento (`html, body { height:100%; overflow:hidden }`).
El header en flujo normal ya no se descoloca porque el documento no tiene a dónde
scrollear cuando el navegador hace "scroll into view" al enfocar.

---

## Paso 0 — Relevamiento de TODOS los wrappers de pantalla completa

Búsqueda en todo `src/` de `h-screen` / `min-h-screen` / `100vh` (más `h-full`/`min-h-full`
para descartar usos legítimos). Resultado clasificado:

### Wrappers de pantalla completa → SÍ se tocan (cambiados a `dvh`)

| # | Archivo | Línea | Antes | Después | Notas |
|---|---------|-------|-------|---------|-------|
| 1 | `src/app/(public)/page.tsx` | 100 | `flex flex-col h-screen ... overflow-hidden` | `h-dvh` | wrapper principal home (el del bug) |
| 2 | `src/app/(public)/page.tsx` | 56 | `flex flex-col h-screen ... overflow-hidden` | `h-dvh` | estado de carga (skeleton) de la home |
| 3 | `src/app/(public)/page.tsx` | 86 | `h-screen bg-paper flex items-center ...` | `h-dvh` | estado "sin ciudades" |
| 4 | `src/components/map/AgencyMapView.tsx` | 54 | `flex flex-col h-screen ... overflow-hidden` | `h-dvh` | vista white-label `/[slug]` (mismo patrón que la home) |
| 5 | `src/app/(agent)/dashboard/layout.tsx` | 45 | `flex h-screen ... overflow-hidden` | `h-dvh` | shell del dashboard (main interno scrollea) |
| 6 | `src/app/(agent)/admin/layout.tsx` | 53 | `flex h-screen ... overflow-hidden` | `h-dvh` | shell del panel admin (mismo patrón) |
| 7 | `src/components/dashboard/Sidebar.tsx` | 227 | `... bg-black h-screen sticky top-0` | `h-dvh` | sidebar desktop (consistencia con el shell dvh) |

### Casos `min-h-screen` → evaluados uno por uno

| # | Archivo | Línea | Decisión | Justificación |
|---|---------|-------|----------|---------------|
| 8 | `src/components/agency/AgencyUnavailable.tsx` | 10 | `min-h-screen` → `min-h-dvh` | Página de estado simple, no interactiva (sin teclado/zoom). Contenido chico que entra en cualquier viewport real → el lock del body no lo recorta. Se pasa a `dvh` por consistencia. |
| 9 | `src/components/auth/AuthLayout.tsx` | 20 | `min-h-screen` → **`h-dvh overflow-y-auto`** (+ ajuste del form, ver Paso 3) | **CASO QUE DEPENDÍA DEL SCROLL DEL DOCUMENTO.** login/register no tienen contenedor interno con scroll: el form largo (register con el campo condicional "nombre de inmobiliaria" + teclado) hacía scrollear el documento. Con el lock se cortaría → se le da su propio contenedor scrolleable. |
| 10 | `src/components/auth/AuthLayout.tsx` | 23 | `md:h-screen` → `md:h-dvh` | Panel de identidad sticky (solo desktop). En desktop `dvh == vh`; cambio por consistencia. Se preservan `md:sticky md:top-0` y el `md:items-start` del root (DESIGN §14). |

### Usos NO tocados (legítimos, no son wrappers de pantalla completa)

- `layout.tsx` html `h-full` / body `min-h-full`: las reglas de altura/overflow del lock
  se agregan en `globals.css` (ver Paso 3); las clases quedan, no estorban.
- `h-full` de relleno dentro de contenedores ya acotados: `PropertyList.tsx:27`
  (`h-full overflow-y-auto`, scroll interno de la lista mobile), `PropertyModal.tsx`
  (140, 232 — cuerpo del sheet), `FilterPanel.tsx` (183, 401), `Sidebar.tsx:73`
  (`NavContent`), `PropertyCard.tsx` / `ImageUploader.tsx` / `ProfileForm.tsx` (imágenes),
  `SubscriptionContent.tsx:237` (barra de progreso), `slider.tsx` (interno de shadcn),
  `AuthLayout.tsx:29` (imagen a sangre del panel). Todos llenan un padre ya dimensionado.
- `fixed`/`sticky` que ya funcionan y NO se tocan (el diagnóstico confirmó que se reanclan
  bien): bottom sheet del modal `h-[82vh]` (`PropertyModal.tsx:508`), FABs (`page.tsx` 159/170,
  `AgencyMapView.tsx`), marco editorial `fixed inset-0 z-[9999]` (`layout.tsx:55`), sidebar
  mobile `fixed inset-y-0` y hamburguesa `fixed` (`Sidebar.tsx`), barra sticky de acción del
  form (`PropertyForm.tsx`).

---

## Paso 1 — Clase `dvh` en este setup

**Usé `h-dvh` / `min-h-dvh` (utilidad nativa), NO el valor arbitrario `h-[100dvh]`.**

Motivo: el proyecto usa **Tailwind CSS v4** (`"tailwindcss": "^4"`, `@tailwindcss/postcss`,
`@import "tailwindcss"` en `globals.css`). Tailwind v4 trae de fábrica las utilidades de
viewport dinámico (`h-dvh`, `min-h-dvh`, `h-svh`, `h-lvh`, etc.). No hace falta el arbitrario.
Aplicado de forma consistente en todos los wrappers.

---

## Paso 2 — `100vh` → `dvh` en los wrappers

Cambios #1–#7 de la tabla (todos `h-screen` → `h-dvh`) y #10 (`md:h-screen` → `md:h-dvh`).
Cada uno es un wrapper que DEBE ocupar exactamente la pantalla y que ya maneja su scroll
internamente (`overflow-hidden` + hijos con scroll propio, o `main overflow-y-auto` en los
shells). No se tocó ningún `fixed`/`sticky` que ya andaba.

`min-h-screen`: el único que requería `min-h-dvh` "puro" es `AgencyUnavailable` (#8, página
que puede crecer pero con contenido chico). `AuthLayout` (#9) NO quedó como `min-h-*`: pasó a
ser contenedor de scroll fijo (`h-dvh overflow-y-auto`), ver Paso 3.

---

## Paso 3 — Lock de scroll del documento

En `src/app/globals.css`, regla a nivel raíz (fuera de `@layer`, para ganarle a las utilidades
de altura de Tailwind), justo después del bloque `@layer base`:

```css
html,
body {
  height: 100%;
  overflow: hidden;
}
```

La app entera scrollea en contenedores internos, así que el documento nunca necesita scrollear.
Verificación de que NO se rompe el scroll interno de cada pantalla:

- **Home / vista agencia:** wrapper `h-dvh overflow-hidden` → cuerpo `flex-1 overflow-hidden` →
  el mapa llena; la lista mobile (`PropertyList`) es `h-full overflow-y-auto`; el bottom sheet
  del modal es `fixed` con cuerpo `overflow-y-auto`. Todo scroll interno. ✔
- **Dashboard / admin:** shell `h-dvh overflow-hidden` con `main` `relative flex-1 overflow-y-auto`
  → los formularios largos (nueva/editar propiedad) scrollean dentro del `main`. El `relative`
  del `main` (load-bearing, CLAUDE.md) se mantiene → no hay segundo scroll fantasma. ✔
- **login / register (caso especial resuelto):** raíz pasó a `h-dvh overflow-y-auto` (su propio
  contenedor scrolleable). Además cambié el panel del formulario de
  `flex flex-1 items-center justify-center` + hijo `w-full max-w-sm` a
  `flex flex-1 flex-col` + hijo `m-auto w-full max-w-sm`. Por qué: con un contenedor de scroll
  de alto fijo, `justify-center` recorta el TOP del contenido cuando desborda (no se puede
  scrollear hacia arriba). `m-auto` en el hijo centra cuando entra, pero si el form supera el
  viewport el margen colapsa y el bloque fluye desde arriba, scrolleando dentro de la raíz.
  Se preservaron `md:items-start` (root) y `md:sticky md:top-0` (panel) → no se reintroduce el
  bug del wordmark de DESIGN §14. ✔

### Caso de scroll de documento que hubo que resolver

**`AuthLayout` (login/register)** era la única pantalla que dependía del scroll del DOCUMENTO
(no tenía contenedor interno scrolleable). Sin tratamiento, el lock habría cortado el form de
register en pantallas cortas / con teclado. Resuelto dándole su propio contenedor de scroll
(`h-dvh overflow-y-auto`) y el centrado por `m-auto` para que el contenido alto sea alcanzable.
Es el único componente cuya estructura interna (más allá de `vh`→`dvh`) hubo que ajustar.

---

## Archivos tocados (resumen)

1. `src/app/(public)/page.tsx` — 3× `h-screen` → `h-dvh` (líneas 56, 86, 100).
2. `src/components/map/AgencyMapView.tsx` — `h-screen` → `h-dvh` (54).
3. `src/app/(agent)/dashboard/layout.tsx` — `h-screen` → `h-dvh` (45).
4. `src/app/(agent)/admin/layout.tsx` — `h-screen` → `h-dvh` (53).
5. `src/components/dashboard/Sidebar.tsx` — `h-screen` → `h-dvh` (227, sidebar desktop).
6. `src/components/agency/AgencyUnavailable.tsx` — `min-h-screen` → `min-h-dvh` (10).
7. `src/components/auth/AuthLayout.tsx` — root `min-h-screen` → `h-dvh overflow-y-auto`;
   panel `md:h-screen` → `md:h-dvh`; form `items-center justify-center` → `flex-col` + hijo `m-auto`.
8. `src/app/globals.css` — lock `html, body { height:100%; overflow:hidden }`.

NO se tocó: lógica de componentes (foco del input de WhatsApp y zoom de Leaflet intactos),
`position` del header (sigue en flujo normal `relative`), ni los `fixed`/`sticky` que ya andaban.
Ningún parche sobre síntomas (no hay `preventDefault` ni listeners de scroll).

---

## Verificación automática

- `npx tsc --noEmit` → **limpio** (0 errores).
- `npm run lint` → **0 errores** (solo los 2 warnings cosméticos preexistentes de `watch()` en
  `RegisterForm.tsx` y `PropertyForm.tsx`, documentados en CLAUDE.md; no los introdujo este cambio).
- Grep final: **0** ocurrencias de `h-screen`/`min-h-screen` en `src/`.

---

# Pruebas manuales (NO ejecutadas — para probar a mano)

Probar en teléfono real o emulación mobile **con la barra de URL visible** (DevTools mobile no
siempre reproduce el hueco de la barra; mejor un device real o el modo responsive con la barra del
navegador). Idealmente recargar con caché limpia para tomar el `globals.css` nuevo.

### 1. Los dos disparadores originales, en la home (`/`)

- **Zoom del mapa:** tocá los botones **+ / −** del control de zoom (abajo a la izquierda) varias
  veces. **El header (Marka. + CityPicker + Ingresar) NO debe desaparecer** ni moverse.
- **Input de WhatsApp:** abrí una propiedad (tocá un pin) → "Consultar por WhatsApp" → al aparecer
  el campo "Tu nombre" se enfoca y **abre el teclado**. **El header NO debe desaparecer.** Cerrá el
  teclado y el header sigue en su lugar.

### 2. Vista white-label (`/[slug]` de una agencia con `has_white_label = true`)

- Repetí los DOS disparadores (zoom +/− y el flujo de WhatsApp) en `/SLUG-AGENCIA-A`.
  **El header tampoco debe desaparecer** (usa el mismo patrón `h-dvh` que la home).

### 3. Scroll interno sigue vivo (que el lock no rompió nada)

- **Dashboard — form largo:** entrá a `/dashboard/propiedades/nueva` (o `/[id]/editar`) en mobile.
  El formulario debe **scrollear dentro de su área (`main`)** con normalidad, **sin un segundo
  scroll fantasma** del documento por debajo del form, y la barra de acción sticky abajo debe
  quedar bien anclada.
- **Lista mobile de propiedades:** en la home, tocá el FAB "Ver lista" → la lista de cards debe
  **scrollear normal** de arriba a abajo, con la última card visible por encima de los FABs.
- **Cuerpo de un modal/sheet largo:** abrí una propiedad con descripción larga + amenities → el
  **cuerpo del bottom sheet debe scrollear** internamente; el footer con el botón de WhatsApp queda
  fijo abajo.
- **login / register en mobile:** abrí `/register`, tocá "Inmobiliaria" (aparece el campo extra) y
  enfocá los inputs (teclado). **Todo el formulario debe seguir siendo alcanzable scrolleando**
  (no debe quedar contenido cortado arriba ni abajo).

### 4. Desktop no se rompió (pantalla grande)

- Home, dashboard (con su sidebar desktop fijo y `main` scrolleable), panel admin, vista de agencia
  y login/register deben **verse y comportarse igual que antes**. En desktop `dvh == vh`, así que no
  hay cambio visual; verificá que el sidebar del dashboard quede a alto completo y el contenido
  scrollee a su lado.

### 5. Checks automáticos

- `npx tsc --noEmit` → limpio.
- `npm run lint` → 0 errores (2 warnings preexistentes de `watch()`).
