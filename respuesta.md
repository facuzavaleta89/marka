# Tanda: los cuatro defectos de forma que rompen algo

> **Modo ejecución.** Se modificaron 6 archivos de `src/`. No se ejecutó ningún comando de git. No se tocó la base. `CLAUDE.md` y `PENDIENTES.md` no se tocaron.
>
> **Cómo se midió:** build de producción servido con `next start` y Chrome headless por el protocolo de DevTools.
> - **Casilla del filtro del mapa:** medida sobre la pantalla real (`/`).
> - **Pantallas con sesión** (panel, formulario de propiedades, admin): no inicié sesión. Se reprodujeron con **las clases reales, antes y después**, sobre la misma hoja de estilos, con el fondo real de cada pantalla.
> - **Contraste:** el color computado del borde se compone sobre el fondo en un canvas y se lee el píxel resultante. Así se resuelven los colores con transparencia (`graphite/80`).
> - **Limpieza:** servidor y Chrome apagados. Scripts en el scratchpad de la sesión, fuera del repo.

---

## 1. Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/components/ui/checkbox.tsx` | Borde por defecto de `border-input` (≈ 1:1) a **`border-graphite/80`**. Solo el color del borde |
| `src/components/map/FilterPanel.tsx` | `CHECKBOX_TERRACOTA` sin `border-stone`: el borde lo pone el componente |
| `src/app/(agent)/admin/AgenciesTable.tsx` | `CHECKBOX_TERRACOTA` sin `border-stone` + la barra de filtros reestructurada (título en su columna, opciones en su contenedor, 16 px entre grupos) |
| `src/components/properties/PropertyForm.tsx` | `OperationField`: el contenedor existe siempre con el mismo relleno; cambia solo el tratamiento según el estado |
| `src/app/(agent)/dashboard/layout.tsx` | `<main>` con `pt-14 md:pt-0` |
| `src/app/(agent)/admin/layout.tsx` | Ídem |

---

## 2. Las casillas

### Los fondos reales, y un dato del prompt que no se sostiene

**No son dos fondos distintos: el del panel y el del formulario de propiedades son el mismo, `mist` (#EAE4DC).** El formulario se monta dentro del layout del panel (`main` sin fondo propio, dentro de `bg-mist`, `dashboard/layout.tsx:33`), y sus secciones no tienen tarjeta.

Los fondos donde viven casillas son **tres**:

| Fondo | Dónde |
|---|---|
| **`mist`** #EAE4DC | filtros de admin; requisitos, comodidades y destacada del formulario de propiedades; opciones de operación sin marcar |
| **`paper`** #FBF9F6 | filtro del mapa (panel lateral y hoja) |
| **blanco** | casilla de la opción de operación marcada (dentro de su tarjeta) |

`mist` es el más oscuro, así que es el caso límite.

### El color elegido: `graphite/80`

Se calcularon los candidatos de la paleta contra los tres fondos antes de editar. `graphite/70` ya pasaba el 3:1, pero con poco margen en `mist` (3,46); se eligió **`graphite/80`**, que queda holgado en los tres.

**Contraste medido del borde de la casilla sin marcar:**

| Casilla | Fondo | Antes | Después |
|---|---|---|---|
| Formulario de propiedades (operaciones, requisitos, comodidades, destacada) | **`mist`** | **1,00:1** (`border-input`) | **4,31:1** |
| Casilla de la opción de operación marcada | **blanco** | — | **5,07:1** |
| Filtros de admin (`CHECKBOX_TERRACOTA`) | **`mist`** | **1,42:1** (`border-stone`) | **4,31:1** |
| Filtro del mapa (`CHECKBOX_TERRACOTA`) — **medido en la pantalla real** | **`paper`** | **1,71:1** (`border-stone`) | **4,90:1** |

**Las ocho casillas quedan por encima del 3:1** que pide WCAG 1.4.11 para el borde de un control. Color compuesto medido: `rgb(109,105,100)` sobre `mist`, `rgb(112,109,105)` sobre `paper` y `rgb(113,110,107)` sobre blanco.

**Las cuatro que pasaban un color propio no quedaron peor:** pasaron de 1,42–1,71 a 4,31–4,90. Su `border-stone` quedó redundante —y habría pisado el borde nuevo— y **se sacó** de las dos constantes (`FilterPanel.tsx`, `AgenciesTable.tsx`). Búsqueda posterior: ningún override de color de borde sin marcar queda en `src/`.

**Lo que NO se sacó, porque no quedó redundante:** las clases del estado **marcado** en terracota (`data-[state=checked]:bg-terracota …`). El componente de fábrica marca en `bg-primary` (casi negro), así que sin ellas las casillas marcadas cambiarían de color.

El cambio en el componente, `src/components/ui/checkbox.tsx`:

```tsx
        "peer relative flex size-4.5 shrink-0 items-center justify-center rounded-none border border-graphite/80 bg-transparent …
```

Solo cambió `border-input` → `border-graphite/80`. `rounded-none` y `size-4.5` no se tocaron.

---

## 3. Las tres opciones de operación

### El JSX

`src/components/properties/PropertyForm.tsx`, `OperationField`:

```tsx
    <Controller
      name={flagName}
      control={control}
      render={({ field: flagField }) => (
        // ⚠ EL CONTENEDOR EXISTE SIEMPRE, marcada o no, con el MISMO relleno.
        // Antes solo la marcada tenía tarjeta (borde, fondo y `p-4`) y la sin
        // marcar no tenía nada: al marcarla la casilla saltaba 16px a la derecha,
        // y las opciones sin marcar se leían como texto suelto, no como opciones
        // del mismo conjunto. Ahora cambia solo el tratamiento:
        //   · marcada    → borde terracota + fondo blanco (estado activo, DESIGN §2);
        //   · sin marcar → borde stone sobre el fondo de la sección.
        // El relleno y el radio no cambian con el estado: la casilla no se mueve.
        <div
          className={cn(
            "rounded-md border p-4 transition-colors",
            flagField.value
              ? "border-terracota bg-white"
              : "border-stone bg-transparent"
          )}
        >
          <div className="flex items-center gap-2">
            <Checkbox
              id={flagName}
              checked={flagField.value}
              onCheckedChange={(v) => flagField.onChange(v === true)}
              className="data-[state=checked]:bg-terracota data-[state=checked]:border-terracota"
            />
            <Label
              htmlFor={flagName}
              className="font-sans text-sm text-black cursor-pointer"
            >
              {label}
            </Label>
          </div>
```

**Tratamiento según DESIGN.md:**
- **Marcada:** borde terracota y fondo blanco. DESIGN §2 reserva el terracota para "estados activos" y §6 lo usa para lo seleccionado. No se mezcla con `graphite` en el mismo elemento, porque la casilla marcada también es terracota.
- **Sin marcar:** borde `stone` sobre el fondo de la sección, el borde de reposo de DESIGN §6. La casilla adentro (`graphite/80`, 4,31:1) es la que marca que se puede tocar.

**Sin cambios de radio ni de tamaños:** `rounded-md` sigue igual y `p-4` es el relleno que la marcada ya tenía. Lo único que cambió es que ahora lo tienen las tres.

### La casilla no se mueve — medido

Posición de la casilla respecto del contenedor de la sección (704 px de ancho, fondo `mist`):

| | Opción 1 | Opción 2 | Opción 3 |
|---|---|---|---|
| **Antes** — Venta marcada | x **17** (tarjeta, relleno 16) | x **1** (sin tarjeta) | x **1** |
| **Después** — Venta marcada | x **17** · y 18 dentro de la tarjeta | x **17** · y 18 | x **17** · y 18 |
| **Después** — Alquiler marcada | x **17** · y 18 | x **17** · y 18 | x **17** · y 18 |

**Antes, marcar una opción corría la casilla 16 px; ahora está en x = 17 y a 18 px del borde superior en los dos estados**, y en las tres opciones.

Aspecto de cada contenedor, después:

| Estado | Borde | Fondo | Relleno | Radio | Alto |
|---|---|---|---|---|---|
| Marcada | `rgb(160,82,45)` terracota | blanco | 16 px | 8 px | 132 (incluye precio y moneda) |
| Sin marcar | `rgb(200,192,183)` stone | transparente (`mist`) | 16 px | 8 px | **54** (antes 22, sin contenedor) |

**Las tres se leen como un conjunto de opciones antes de tocarlas:** cada una en su caja, con la casilla visible a la misma altura.

---

## 4. El botón de menú

### Dónde se resolvió

**En la disposición compartida, no en las páginas.** Las diez páginas del panel cuelgan de **dos** layouts, y los dos montan el mismo `Sidebar`:

| Layout | Páginas |
|---|---|
| `src/app/(agent)/dashboard/layout.tsx` | `/dashboard`, `/dashboard/propiedades`, `…/nueva`, `…/[id]/editar`, `/dashboard/leads`, `/dashboard/equipo`, `/dashboard/perfil`, `/dashboard/preferencias`, `/dashboard/suscripcion` (9) |
| `src/app/(agent)/admin/layout.tsx` | `/admin` (1) |

El cambio, idéntico en los dos:

```tsx
      <main className="relative flex-1 overflow-y-auto pt-14 md:pt-0">{children}</main>
```

**Por qué ahí:**
- **El botón es fijo** (`top-4 left-4`, 36 px de alto: termina en y = 52).
- **Las páginas tienen dos rellenos distintos:** 7 con `p-8` y 3 con `p-6 md:p-8`.
- **Sumar 56 px arriba del `<main>`**, solo debajo de `md`, deja el título de las diez por debajo del botón **sin tocar ninguna página**.
- **Nada cambia en escritorio** (`md:pt-0`); el botón además está oculto ahí.

⚠ **Son dos líneas, no una**, porque el panel tiene dos layouts separados (el de admin tiene su propio control de acceso). No son diez copias: son los dos únicos contenedores. El comentario de cada una apunta a la otra.

### Medido (reproducción con las clases reales)

| | Celular 390, página `p-8` | Celular 390, página `p-6 md:p-8` | Escritorio 1280 |
|---|---|---|---|
| **Antes** | título en y 27–76 → **superposición de 20 × 25 px** con el botón (y 16–52) | título en y 19–68 → **superposición de 28 × 33 px** | botón oculto; título en y 27 |
| **Después** | título en y 83–132 → **superposición vertical 0; 31 px de aire** debajo del botón | título en y 75–124 → **superposición vertical 0; 23 px de aire** | **igual que antes**: título en y 27 |

La "superposición x" que queda (20 y 28 px) es solo la franja horizontal compartida: con 31 y 23 px de separación vertical, el botón y el título no se tocan.

---

## 5. Los filtros de administración

### Medidas antes y después

Reproducción con las clases reales, fondo `mist`, las 8 casillas marcadas (su estado inicial). **Escritorio:** 960 px, el ancho real del contenido del admin en una pantalla de 1280. **Celular:** 326 px, el ancho real en 390.

#### Escritorio (960 px)

| | Antes | Después |
|---|---|---|
| Separación entre grupos | **8 px** | **16 px** |
| Primera opción de "Aprobación" | x 96,7 | x **116** |
| Primera opción de "Suscripción" | x **98,4** (no coincide) | x **116** (coincide) |
| Título | ancho 76,7 / 78,4, alto 16,5, corrido 1,8 px | **ancho fijo 96, alto 20** (mismo alto que una opción) |
| Líneas por grupo | 1 y 1 | 1 y 1 |
| Alto total | 48 | 56 |

#### Celular (326 px)

| | Antes | Después |
|---|---|---|
| **Separación entre grupos** | **8 px** | **16 px** |
| **Separación entre líneas de un grupo** | **8 px** (igual a la de grupos: se mezclaban) | **8 px** (la mitad de la de grupos) |
| Aprobación | `APROBACIÓN` · Pendiente · Aprobada / **Rechazada en x = 0, debajo del título** | `APROBACIÓN` en su línea / Pendiente · Aprobada · Rechazada **desde x = 0**, todas juntas |
| Suscripción | `SUSCRIPCIÓN` · Plan pendiente / **Pagas activas (x = 0)** · Free / **Dadas de baja (x = 0)** · Otras | `SUSCRIPCIÓN` en su línea / Plan pendiente · Pagas activas / Free · Dadas de baja · Otras — **las dos líneas desde x = 0** |
| Primera opción de cada línea | 96,7 · 0 · 98,4 · 0 · 0 (mezcla) | **0 · 0 · 0** (alineadas entre sí) |
| Alto total | 132 | 140 |

**Las dos condiciones mínimas se cumplen en los dos anchos:**
1. **Entre grupos hay 16 px, el doble que entre líneas de un grupo (8 px).**
2. **Las opciones que bajan de línea se alinean entre sí**: en celular, todas las líneas de opciones arrancan en x = 0 debajo de su título, que ocupa su propia línea; en escritorio, las dos filas de opciones arrancan en la misma x (116).

### El JSX

`src/app/(agent)/admin/AgenciesTable.tsx`, la barra de filtros (se muestra el primer grupo; el segundo tiene la misma estructura con `PLAN_FILTERS`):

```tsx
      <div className="mb-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-5">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite leading-5 sm:w-24 sm:shrink-0">
            Aprobación
          </span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {APPROVAL_FILTERS.map(({ key, label }) => (
            <label … className="flex items-center gap-2 cursor-pointer">
              <Checkbox … className={CHECKBOX_TERRACOTA} />
              <span className="font-sans text-sm text-black">{label}</span>
            </label>
          ))}
          </div>
        </div>
```

Los títulos son `<span>`, no el componente `Label`: su tipografía (11 px, mayúsculas) no cambió. Solo se les agregó `leading-5` (alto de línea igual al de una opción) y el ancho fijo desde `sm`.

---

## 6. Confirmación: nada del aspecto general

| Lista de lo que no había que tocar | ¿Se tocó? | Evidencia |
|---|---|---|
| Radios del tema | **No** | `globals.css` no se modificó |
| Radio de cualquier elemento | **No** | La casilla sigue `rounded-none`; la tarjeta de operación sigue `rounded-md` (medido 8 px antes y después) |
| Componente de botón | **No** | `ui/button.tsx` no se modificó |
| Diálogos de confirmación | **No** | `ui/alert-dialog.tsx` no se modificó |
| Menús | **No** | `ui/dropdown-menu.tsx` no se modificó |
| Escala de altos de botón | **No** | Ningún botón se modificó |
| Etiquetas y sus mayúsculas | **No** | `ui/label.tsx` no se modificó; ningún `<Label>` cambió de clase |
| Base, policy de agentes, `CLAUDE.md`, `PENDIENTES.md` | **No** | — |

El tamaño de la casilla (`size-4.5`, 18 px medido) no cambió. El único cambio "de tamaño" es que las opciones de operación **sin marcar** ahora tienen el mismo `p-4` que ya tenía la marcada: es la condición para que la casilla no salte, y es la decisión 2.

---

## 7. Inconsistencias nuevas (sin arreglar)

Se suman a las 46 abiertas del relevamiento anterior.

1. **La tarjeta de operación ahora se ve tocable entera, pero solo responden la casilla y el texto.** Tocar el relleno de la tarjeta no marca nada (`PropertyForm.tsx`, `OperationField`: el `Label` no ocupa el ancho del contenedor). Hacerlo requiere tocar la etiqueta o envolver la fila, y las etiquetas estaban fuera de alcance.
2. **Al enfocar una casilla con el teclado, su borde se ACLARA.** El componente mantiene `focus-visible:border-ring` (`ui/checkbox.tsx`), y `--ring` es un gris más claro que el `graphite/80` nuevo. El anillo de foco sigue estando, pero el borde pierde contraste justo en el foco.
3. **El color del estado marcado sigue sobrescrito en seis lugares**: `CHECKBOX_TERRACOTA` en `FilterPanel.tsx` y en `AgenciesTable.tsx`, y el mismo texto inline 4 veces en `PropertyForm.tsx`. El componente marca en `bg-primary` (casi negro), así que **una casilla nueva sin override se marcaría en negro**.
4. **En celular, el contenido del panel pasa por debajo del botón de menú al hacer scroll.** `pt-14` deja libre la posición inicial del título, pero el botón sigue siendo fijo y queda encima de lo que se desplaza (`Sidebar.tsx:187`). Una barra superior en el flujo lo resolvería de raíz.
5. **Indentación irregular en la barra de filtros de admin:** las etiquetas quedaron con la sangría anterior dentro del contenedor nuevo (`AgenciesTable.tsx`, bloque de filtros). Es cosmético y lo introdujo esta tanda.
6. **El warning de lint cambió de línea otra vez: ahora `PropertyForm.tsx:814`** (antes 804, y `CLAUDE.md` dice 808), por las 10 líneas de comentario agregadas en `OperationField`. Es el mismo warning; se suma a la inconsistencia de documentación ya anotada.

---

## 8. Baseline de calidad

Borré `.next/` y `tsconfig.tsbuildinfo` antes de correr.

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
  814:30  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:814:30
  812 |   });
  813 |
> 814 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
      |                              ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  815 |   const lat = watch("lat");
  816 |   const lng = watch("lng");
  817 |   const address = watch("address") ?? "";  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)

LINT_EXIT=0
```

**0 errores, 1 warning (`react-hooks/incompatible-library` en `PropertyForm.tsx`), exit 0.** Mismo warning sobre la misma llamada `watch("amenities")`; solo cambió el número de línea (ver inconsistencia #6).

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 11.8s
  Running TypeScript ...
  Finished TypeScript in 9.0s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/20) ...
  Generating static pages using 3 workers (5/20) 
  Generating static pages using 3 workers (10/20) 
  Generating static pages using 3 workers (15/20) 
✓ Generating static pages using 3 workers (20/20) in 3.0s
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

**Verde, exit 0, 22 rutas**, mismos nombres y tipos. **Sin cambios en el baseline.**

---

## 9. Lo que resultó falso o imposible

**Ninguna decisión resultó imposible**, y **nada de lo que había que arreglar obligó a tocar la lista de exclusiones**.

**Lo que resultó falso o impreciso en el prompt:**

1. **"Los fondos son dos y distintos: el del panel y el del formulario de propiedades" — son el mismo.** Los dos son `mist` (#EAE4DC): el formulario vive dentro del layout del panel y no tiene fondo propio. Los fondos **distintos** son tres: `mist` (panel y formulario), `paper` (filtro del mapa) y blanco (dentro de la tarjeta de operación marcada). El color elegido se midió contra los tres (4,31 / 4,90 / 5,07).
2. **"Las otras cuatro casillas usan otro borde, que se ve" — se ve poco.** `stone` medía **1,42:1** sobre `mist` (filtros de admin) y 1,71:1 sobre `paper` (filtro del mapa): perceptible, pero lejos del 3:1. El prompt sí dice que tampoco llegaba al mínimo, y eso es correcto.
3. **Decisión 3, "de una sola vez para todas" — son dos líneas, no una**, porque el panel tiene dos layouts separados (`dashboard` y `admin`). No son diez ajustes página por página: son los dos únicos contenedores de las diez páginas, y cada uno documenta al otro.
4. **Decisión 1, "si el arreglo las vuelve redundantes, sacales el override" — se sacó solo la parte redundante.** El `border-stone` quedó redundante y se quitó. Las clases del estado marcado en terracota **no** quedaron redundantes, porque el componente marca en casi negro, y se mantuvieron (inconsistencia #3).

**Limitación de la evidencia:** salvo el filtro del mapa, medido en la pantalla real, las mediciones de casillas, tarjetas, botón de menú y filtros de admin son **reproducciones con las clases reales**. Esas pantallas exigen sesión y no inicié ninguna.
