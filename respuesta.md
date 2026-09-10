# Inversión: en pantallas chicas queda el ingreso, no el llamado

> **Modo ejecución, alcance mínimo.** **No se ejecutó ningún comando de git** y **no se ejecutó
> SQL**. No se tocaron `CLAUDE.md` ni `PENDIENTES.md`.
> **Fecha:** 8 sep 2026.

---

## 1. Archivos modificados

**Dos.**

| Archivo | Qué cambió |
|---|---|
| `src/components/auth/PublicHeaderAuth.tsx` | En la variante `marketplace`: el `hidden sm:inline-flex` **pasó del enlace de ingreso al enlace de captación**. Los comentarios que justificaban el reparto viejo se reescribieron con el criterio nuevo. |
| `DESIGN.md` | §11 "Encabezado público": el diagrama ahora muestra los dos tamaños, el párrafo del punto de corte dice que el que se cae es el llamado, con los anchos **medidos**; se anotó la consecuencia de que la captación no se ve en celular y la alternativa evaluada; y se corrigió una cifra estimada del bloque del salto de layout. |

**No se tocó nada más.** En particular, y según el punto 5: `AgencyMapView.tsx` (variante del sitio
de marca), `propiedades/[slug]/page.tsx`, las guardas de ancho del encabezado, el estado de carga
(`PublicHeader` en `(public)/page.tsx`) y `CityPicker.tsx` quedaron **exactamente como estaban**.

El cambio funcional es de **dos palabras de clases**:

```diff
- <Link href="/register" className="inline-flex h-9 shrink-0 items-center rounded-md border …">
+ <Link href="/register" className="hidden h-9 shrink-0 items-center rounded-md border … sm:inline-flex">

- <Link href="/login" className={cn(GHOST_LINK, "hidden shrink-0 sm:inline-flex")}>
+ <Link href="/login" className={cn(GHOST_LINK, "shrink-0")}>
```

---

## 2. Cómo quedó cada enlace en cada tamaño

| | `< sm` (< 640 px) | `≥ sm` (≥ 640 px) |
|---|---|---|
| **"Sumá tu inmobiliaria"** → `/register` | **oculto** (`display: none`) | botón secundario: `h-9`, `border-stone`, `text-black`, hover `bg-mist` + `border-graphite` |
| **"Iniciar sesión"** → `/login` | **visible**, ghost: texto `graphite` → hover `black` | visible, ghost, a la derecha del botón |
| **"Ir al panel"** → `/dashboard` (con sesión) | visible, ghost | visible, ghost |

Con sesión iniciada el reparto no cambia en ningún tamaño: se ve "Ir al panel" y nada más, porque
a un agente logueado no se le ofrece registrarse.

**La variante `agency` no se tocó:** sigue mostrando "Ingresar" → `/login` en todos los tamaños,
sin punto de corte, con el mismo texto y el mismo destino de siempre.

---

## 3. Punto 2 — el ingreso ya se renderizaba con el tratamiento original: **no cambié nada de eso**

**Coincide, y lo verifiqué contra el marcado original.** Antes de toda esta pieza, el enlace vivía
escrito a mano en `(public)/page.tsx` con esta clase:

```
font-sans text-sm font-medium text-graphite hover:text-black transition-colors
```

Hoy sale de la constante `GHOST_LINK` del componente compartido:

```
font-sans text-sm font-medium text-graphite transition-colors duration-[120ms] ease-out hover:text-black
```

| Declaración | Original | Hoy |
|---|---|---|
| `font-sans` `text-sm` `font-medium` | ✅ | ✅ |
| `text-graphite` → `hover:text-black` | ✅ | ✅ |
| `transition-colors` | ✅ | ✅ + `duration-[120ms] ease-out` |
| borde / fondo / padding / alto | **ninguno** | **ninguno** |

**Las mismas seis declaraciones, sin una caja ni un borde por ningún lado.** Lo único agregado es
la curva y la duración de la transición, que no eran una elección sino la omisión de lo que
DESIGN §8 fija para hover (*"Color/border transition · 120ms · ease-out"*), más el `shrink-0` que
es guarda de ancho, no tratamiento visual.

Confirmado también sobre el HTML que emite el build — es texto pelado:

```html
<a class="font-sans text-sm font-medium text-graphite transition-colors duration-[120ms] ease-out hover:text-black shrink-0" href="/login">Iniciar sesión</a>
```

Ni `border`, ni `rounded`, ni `bg-`, ni `px-`, ni `h-`. **Cuando queda solo en celular, se ve como
se veía antes de la pieza: un enlace de texto.** No hice ningún cambio en su tratamiento.

⚠ **Una diferencia que sí existe y que no es de tratamiento: el texto.** En la variante del
marketplace dice **"Iniciar sesión"** y no "Ingresar" — fue una decisión deliberada de la tanda
anterior (con dos enlaces al lado, "Ingresar" era ambiguo). El punto 2 pedía verificar el
*tratamiento*, y lo hice; menciono el texto porque **pesa en la aritmética del punto 4** y porque
es lo único en lo que el celular no queda idéntico a como estaba antes de la pieza.

---

## 4. Punto 3 — cómo verifiqué que el mecanismo antisalto sigue vivo

**El riesgo concreto era uno solo, y lo nombro:** si el `hidden sm:…` hubiera terminado sobre una
de las **dos ramas** de la grilla en vez de sobre un enlace de adentro, `display: none` la sacaría
del documento y el ancho de la celda volvería a depender de la sesión — que es exactamente el salto
que el mecanismo existe para apagar. Verifiqué que eso **no** pasó, por tres vías.

### (a) Estructura, sobre el HTML que emite `next build`

```html
<div class="grid shrink-0 justify-items-end">
  <div class="col-start-1 row-start-1 flex items-center gap-3" aria-hidden="false">
    <a class="hidden h-9 shrink-0 … sm:inline-flex" href="/register">Sumá tu inmobiliaria</a>
    <a class="font-sans text-sm … shrink-0" href="/login">Iniciar sesión</a>
  </div>
  <div class="col-start-1 row-start-1 flex items-center invisible pointer-events-none" aria-hidden="true">
    <a class="font-sans text-sm … shrink-0" href="/dashboard">Ir al panel</a>
  </div>
</div>
```

### (b) Chequeos automáticos sobre ese HTML

```
ramas en la celda 1/1: 2  (esperado 2)
ramas con 'hidden': 0
  class="col-start-1 row-start-1 flex items-center gap-3"
  class="col-start-1 row-start-1 flex items-center invisible pointer-events-none"
dónde vive el hidden sm: → <a … sm:inline-flex" href="/register"
```

**Las dos ramas siguen siendo hermanas en la misma celda `1/1`, ninguna lleva `hidden`, y el
`hidden sm:inline-flex` está sobre el `<a href="/register">` — un nieto, no una rama.** La rama con
sesión sigue apagada con `invisible`, o sea que **sigue ocupando su celda**, que es la condición de
la que depende todo.

### (c) Que el ancho no dependa de la sesión, en los dos tamaños

La celda mide `máx(rama anónima, rama con sesión)`. Con los anchos medidos (Parte 5):

| Tamaño | Rama anónima | Rama con sesión | Celda = máx | ¿Depende de la sesión? |
|---|---|---|---|---|
| `< sm` | 86,1 px (el CTA va `display:none`) | 63,4 px | **86,1 px** | **no** |
| `≥ sm` | 258,6 px (CTA + gap + ingreso) | 63,4 px | **258,6 px** | **no** |

En los dos tamaños la rama anónima es la más ancha, así que **la celda mide lo mismo antes y
después de que resuelva `getUser()`**. Sin el mecanismo, el encabezado se movería **195,2 px en
`sm`+ y 22,7 px por debajo**.

⚠ **Un efecto lateral favorable que la inversión trajo sola:** en celular el salto potencial pasó
de 96,9 px (cuando la rama anónima era el botón de 160,5) a 22,7 px. El mecanismo ahora tapa un
agujero más chico del que tapaba, no uno más grande.

---

## 5. Punto 4 — la aritmética, ahora **medida** y no estimada

⚠ **En la tanda anterior estos números eran estimaciones por conteo de caracteres y lo dejé
señalado. Esta vez están medidos.** Cargué con `fontkit` los `.woff2` que sirve el build
(`.next/static/media`), y como son **fuentes variables** y `fontkit` no puede instanciar estos
subconjuntos, apliqué la variación de peso a mano: normalización del eje `wght` → tabla `avar` →
deltas de `HVAR`, más el kerning del layout base. Control de sanidad: el mismo texto a peso 400 da
84,3 px y a 500 da 86,1 px, o sea que la variación efectivamente se está aplicando.

**Anchos de texto medidos** (DM Sans 500 a 14 px; Noto Serif 700 a 24 px con `tracking-[-0.01em]`):

| Texto | Ancho |
|---|---|
| "Marka." (marca) | **85,1 px** |
| "Santiago del Estero" | **126,7 px** |
| "Iniciar sesión" | **86,1 px** |
| "Ir al panel" | **63,4 px** |
| "Sumá tu inmobiliaria" | **134,5 px** |
| "Ingresar" (variante `agency`) | 53,2 px |

**Slots armados:**

| Slot | Ancho | Composición |
|---|---|---|
| Marca | **85,1 px** | — |
| Selector de ciudad | **148,7 px** | texto 126,7 + `gap-1.5` 6 + chevron 16 |
| Puerta `< sm` | **86,1 px** | `máx(86,1 · 63,4)` |
| Botón CTA | 160,5 px | texto 134,5 + `px-3` 24 + borde 2 |
| Puerta `≥ sm` | 258,6 px | `máx(160,5 + 12 + 86,1 · 63,4)` |

### El caso que pedía el punto 4: 375 px, ciudad más larga que existe

```
--- 375 px ---
  util 343,0 - (marca 85,1 + puerta 86,1 + gaps 24 = 195,2) = 147,8 para el selector,
  que necesita 148,7
  => TRUNCA, faltan 0,9 px
```

**Los tres elementos entran y son funcionales. El nombre de la ciudad queda 0,9 px corto** — o sea
que a exactamente 375 px `truncate` se activa y el nombre pierde su último carácter contra los
puntos suspensivos. **Lo reporto tal cual en vez de redondear a "entra".**

### Barrido de viewports

| Viewport | Dispone el selector | Necesita | Resultado |
|---|---|---|---|
| 320 px | 92,8 | 148,7 | trunca (−55,9) |
| 360 px | 132,8 | 148,7 | trunca (−15,9) |
| **375 px** | **147,8** | **148,7** | **trunca (−0,9)** |
| 390 px (iPhone 12–15) | 162,8 | 148,7 | ✅ completo (+14,1) |
| 393 px (Pixel) | 165,8 | 148,7 | ✅ completo (+17,1) |
| 412 / 414 px | 184,8 / 186,8 | 148,7 | ✅ completo |
| 430 px (iPhone Pro Max) | 202,8 | 148,7 | ✅ completo (+54,1) |
| 640 px (`sm`, ya con CTA) | 240,3 | 148,7 | ✅ completo (+91,6) |

**Umbral: desde 376 px el nombre entra completo.**

### La comparación que justifica el cambio

| Reparto | Umbral para "Santiago del Estero" completo | A 375 px |
|---|---|---|
| **Antes** (en chica quedaba el CTA) | **451 px** | faltaban **75,2 px** |
| **Ahora** (en chica queda el ingreso) | **376 px** | faltan **0,9 px** |

**Ningún teléfono mostraba el nombre entero con el reparto anterior. Con el nuevo lo muestran
todos salvo los de 375 px y menos**, y ahí por menos de un píxel. La inversión, que se pedía por
un motivo de producto, **también mejora el encabezado en 75 px**.

⚠ **Si esos 0,9 px molestan, hay una salida que NO implementé por estar fuera de alcance:** volver
el texto del ingreso a **"Ingresar"** (53,2 px en vez de 86,1) dejaría la puerta en 63,4 px y el
selector con **170,5 px contra 148,7**, o sea **21,8 px de sobra** y umbral por debajo de 320. Se
paga con la ambigüedad que "Iniciar sesión" vino a resolver. Es una decisión de producto, no de
layout, y la dejo planteada sin tomarla.

---

## 6. Punto 6 — anotado, no implementado

**En un teléfono la captación no se ve en ningún lado.** No se movió a otro lugar: no está. Un
visitante de inmobiliaria que mire el mapa desde el celular —que va a ser el caso más frecuente
cuando arranque la publicidad de octubre— no tiene ninguna línea de la interfaz que le hable, que
es exactamente la situación que C3 vino a resolver. **La pieza resuelve el problema en escritorio y
lo deja abierto en celular.**

**La alternativa evaluada y no implementada: el pie de la lista de propiedades.** Es la **única
superficie pública del celular que scrollea** — el mapa es `h-dvh` con el scroll del documento
bloqueado a nivel raíz (`globals.css`), así que no existe ningún "abajo" donde colgar nada, y los
dos FABs ya están tomados. La lista mobile (`PropertyList`), en cambio, tiene scroll propio y un
final natural: quien llegó hasta ahí ya recorrió la oferta de su ciudad, que es justo el momento en
que una inmobiliaria entiende para qué sirve la plataforma.

Queda anotado acá y en DESIGN.md §11 para el cierre del grupo. **No lo implementé.**

---

## 7. Baseline

Se borraron `.next` y `tsconfig.tsbuildinfo` antes de medir. **No apareció el ruido de herramienta:
ningún error en `.next/**`.**

### `npx tsc --noEmit`

```
=== npx tsc --noEmit ===
EXIT_TSC=0
```

Salida vacía, **exit code 0, 0 errores.** ✅

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

EXIT_LINT=0
```

**0 errores, 1 warning** — el único conocido, mismo archivo y misma línea. **Exit code 0.** ✅

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 9.0s
  Running TypeScript ...
  Finished TypeScript in 10.5s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (20/20) in 1328ms
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

EXIT_BUILD=0
```

**Verde, exit code 0, 22 rutas.** ✅ `/` sigue `○ (Static)`, `/sitemap.xml` sigue `ƒ`,
`/robots.txt` sigue `○`. **Nada se movió.**

---

## 8. Qué de este prompt resultó falso

**Nada resultó falso.** Las tres afirmaciones técnicas del enunciado se verificaron contra el
código antes de tocarlo:

- *"la variante del marketplace muestra hoy dos enlaces… el llamado con tratamiento de botón y el
  ingreso con tratamiento de texto"* — cierto, tal cual.
- *"hoy se oculta el ingreso por debajo del punto de corte intermedio"* — cierto: era
  `hidden sm:inline-flex` sobre el enlace a `/login`, con `sm` = 640 px.
- *"los dos estados de sesión se renderizan apilados en la misma celda de una grilla y uno se apaga
  con visibilidad"* — cierto, y sigue así.

### Dos precisiones, ninguna contradice el prompt

1. **El punto 2 resultó no requerir ningún cambio, como el propio prompt anticipaba** (*"Si el
   ingreso ya se renderiza con ese tratamiento, decilo y no cambies nada de eso"*). Ya era
   `GHOST_LINK`: texto pelado sin caja ni borde. No toqué su tratamiento.
2. **El punto 4 se cumple por poco, no con holgura, y prefiero decirlo:** a exactamente 375 px
   faltan **0,9 px** y el nombre de la ciudad se corta por un carácter. Desde 376 px entra
   completo. Con el reparto anterior faltaban 75,2 px, así que la situación mejoró 75 px — pero
   "entran los tres" a 375 px es cierto en el sentido de que los tres se ven y funcionan, no en el
   de que el nombre se lea entero.

### Lo que este cambio empeora, dicho sin adornos

**La captación desapareció del celular por completo** (Parte 6). Es la contracara directa de la
decisión de producto que el prompt tomó, y es coherente con ella —no molestar todos los días a
quien ya paga— pero significa que el objetivo original de C3 queda a medio cumplir hasta que se
resuelva la superficie del pie de lista.

---

## Estado final

Dos archivos modificados, baseline intacto en los tres frentes, 22 rutas con el mismo nombre y el
mismo tipo. **No se ejecutó ningún comando de git**, según lo indicado: el trabajo queda en el
árbol para que lo revises.
