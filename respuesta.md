# Tanda: unificación de formas

> **Modo ejecución.** Se modificaron 14 archivos de `src/`. No se ejecutó ningún comando de git. No se tocó la base. `CLAUDE.md` y `PENDIENTES.md` no se tocaron.
>
> **Cómo se midió:** los píxeles de cada clase de radio salen del **CSS compilado del build**, antes y después. Las pantallas públicas (inicio de sesión, registro, home, filtros, detalle de propiedad, ficha pública) se midieron **en el navegador** con Chrome headless. Los diálogos, los menús y los desplegables exigen sesión: se reprodujeron con **las clases reales del componente** sobre la misma hoja de estilos. Servidor y Chrome apagados al terminar.

---

## 1. Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/app/globals.css` | Los radios del tema pasan a valores fijos en píxeles: 4 / 6 / 8. `--radius-xl` queda en 14 px, documentado como la excepción de las hojas |
| `src/components/ui/button.tsx` | Deja de ser recto y de ir en mayúsculas: 6 px, minúsculas, 14 px de texto. Escala de altos 44 / 36 / 28 y área de toque en el tamaño chico |
| `src/components/ui/alert-dialog.tsx` | Caja del diálogo y del ícono a 8 px; el título deja las mayúsculas |
| `src/components/ui/dialog.tsx` | Ídem (sin uso hoy, misma familia) |
| `src/components/ui/dropdown-menu.tsx` | Menú y submenú a 8 px; los cuatro tipos de ítem a 6 px |
| `src/components/ui/select.tsx` | Desplegable a 8 px; ítem a 6 px. El disparador subrayado no se tocó |
| `src/components/ui/checkbox.tsx` | Radio a 4 px (marca chica). **El color del borde no se tocó** |
| `src/components/map/FilterPanel.tsx` | Los cuatro grupos de botones a 36 px; "Limpiar filtros" a 44 |
| `src/components/properties/PropertyList.tsx` | "Limpiar filtros" del estado vacío: 40 → 44 px |
| `src/components/properties/LocationPicker.tsx` | "Centrar" sobre el mapa: 32 → 28 px + área de toque de 44 |
| `src/components/map/PropertyModal.tsx` | "Ver ficha completa" a 28 px + área de toque de 44 · **título "Precio"** |
| `src/app/(public)/propiedades/[slug]/page.tsx` | **Título "Precio"** |
| `src/app/(agent)/admin/AgenciesTable.tsx` · `src/components/dashboard/PropertiesTable.tsx` · `src/components/dashboard/TeamContent.tsx` | Los botones de solo ícono de las tablas: 30 → 36 px |

---

## 2. Los radios, leídos del CSS compilado

| Clase | Antes | Después | Qué viste |
|---|---|---|---|
| `.rounded-none` | `border-radius:0` | `border-radius:0` | sin cambio |
| `.rounded-sm` | `calc(var(--radius) * .6)` = **6 px** | `.25rem` = **4 px** | chips, etiquetas de estado, **casillas** |
| `.rounded-md` | `calc(var(--radius) * .8)` = **8 px** | `.375rem` = **6 px** | botones, campos, selectores, ítems de menú |
| `.rounded-lg` | `var(--radius)` = **10 px** | `.5rem` = **8 px** | tarjetas, secciones, paneles, diálogos, menús, avisos |
| `.rounded-t-xl` | `calc(var(--radius) * 1.4)` = **14 px** | `.875rem` = **14 px** | **excepción**: las dos hojas que suben desde abajo |
| `.rounded-full` | círculo | círculo | sin cambio |
| `.rounded` (sin sufijo) | `.25rem` = **4 px** | `.25rem` = **4 px** | literal de Tailwind, no pasa por los tokens: 4 esqueletos |

**La variable base:** `--radius` pasó de `0.625rem` (10 px) a `0.5rem` (8 px), alineada con el radio de contenedor.

⚠ **Elementos que usaban el valor base directamente: ninguno.** Verificado por búsqueda: `var(--radius)` solo aparecía dentro de las definiciones de los tokens, que ahora son valores fijos. Los seis `border-radius` literales de `globals.css` **no dependían del tema y no se tocaron**: el pin del mapa (8 px, línea 231), tres círculos del pin (50 %), el control de zoom de Leaflet (8 px) y su caja de atribución (6 px).

**Antes de esta tanda, ningún elemento cumplía el número de la tabla de DESIGN §4 aunque usara la clase correcta. Ahora los tres valores coinciden.**

---

## 3. El componente de botón

**Antes** (`ui/button.tsx`, base):

```
"group/button inline-flex shrink-0 items-center justify-center rounded-none border border-transparent bg-clip-padding text-xs font-semibold tracking-widest whitespace-nowrap uppercase transition-all …"
default: "h-10 gap-1.5 px-6 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4"
```

**Después:**

```
"group/button relative inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all …"
default: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3"
```

Cambió: **recto → 6 px**, **MAYÚSCULAS con espaciado ancho → minúsculas**, **12 px → 14 px**, **negrita → medio**, **40 px → 44 px de alto** (el mínimo táctil de DESIGN §6) y **24 → 16 px de relleno**. El `relative` es para anclar el área de toque del tamaño chico.

**Medido en pantalla:** "Ingresar" (inicio de sesión) y "Crear cuenta" (registro) miden ahora **44 px de alto, radio 6 px, texto de 14 px, `text-transform: none`, espaciado normal, relleno 16 px**. Antes: 40 px, radio 0, 12 px, mayúsculas, relleno 24.

### Dónde se va a notar

| Pantalla | Qué cambia |
|---|---|
| **`/login`** | "Ingresar": de rectángulo en MAYÚSCULAS a botón redondeado en minúsculas, más alto |
| **`/register`** | "Crear cuenta": ídem |
| **`/register/plan`** | "Continuar": ídem |
| **8 diálogos de confirmación** (5 en `/admin`, 1 en Propiedades, 1 en Suscripción, 1 en Equipo) | La caja del diálogo pasa a 8 px, **el título deja las mayúsculas** y sus dos botones (confirmar y cancelar) cambian igual que los de arriba |
| **2 menús `⋯`** (Propiedades y `/admin`) | La caja del menú a 8 px y sus 12 ítems a 6 px |
| **4 desplegables de ciudad / tipo / estado / agente** (registro y formulario de propiedades) | La caja a 8 px y sus ítems a 6 px |
| **8 casillas** (filtros del mapa, filtros de admin, formulario de propiedades) | De cuadrado perfecto a 4 px |
| **Todo lo que tenga radio** (247 elementos en 43 archivos) | 2 px menos: tarjetas y secciones 10 → 8, botones y campos 8 → 6, chips 6 → 4 |

---

## 4. La escala de altos

| Tamaño | Alto | Relleno | Texto | Para qué |
|---|---|---|---|---|
| **L** | **44** | 16 | 14 px | Acción principal de una pantalla o de un formulario, CTAs, FABs, WhatsApp |
| **M** | **36** | 12 | 14 px | Contexto denso: filas de tabla, encabezado, filtros |
| **S** | **28** | 10 | 12 px | Sobre una imagen o un mapa. ⚠ Bajo el mínimo táctil: lleva área de toque extendida |
| Íconos | 44 / 36 / 28 | — | — | Botones de solo ícono, en la misma escala |

En `ui/button.tsx`: `default` = L, `sm` = M, `xs` = S, `lg` = L con más ancho (`px-8`).

**Qué se movió** (medido donde la pantalla es pública):

| Botón | Antes | Después |
|---|---|---|
| `Button` por defecto (inicio de sesión, registro, plan, diálogos) | 40 | **44 (L)** |
| `Button` `icon` | 40 | **44** |
| Filtros del mapa · operación (Venta/Alquiler/Temporal) | 36 (`py-2`) | **36 (M)**, ahora por alto explícito |
| Filtros del mapa · tipo de propiedad | **34** | **36 (M)** |
| Filtros del mapa · moneda USD/ARS | **32** | **36 (M)** |
| Filtros del mapa · dormitorios | 36 | **36 (M)** |
| Filtros del mapa · "Limpiar filtros" | ~42 (`py-2.5`) | **44 (L)** |
| Lista de propiedades · "Limpiar filtros" del estado vacío | **40** | **44 (L)** |
| Mapa de ubicación · "Centrar" | **32** | **28 (S)** + área de toque |
| Detalle · "Ver ficha completa" | 28 (`py-1.5`) | **28 (S)** + área de toque |
| Tablas · menú `⋯` y eliminar agente (×4) | **30** (`p-1.5`) | **36 (M)** |

**Medido después, en pantalla:** FABs 44 · WhatsApp del detalle 44 · "Compartir" y "Ver todas las propiedades" de la ficha 44 · los cuatro grupos de filtros 36 · "Limpiar filtros" 44 · "Ver ficha completa" 28.

---

## 5. El área de toque de los tamaños chicos

El recurso ya estaba en el proyecto: **`ui/checkbox.tsx`** extiende el área con un pseudo-elemento (`after:absolute after:-inset-x-3 after:-inset-y-2`) sin cambiar el dibujo. Se siguió ese molde en los tres lugares con tamaño S:

- `ui/button.tsx`, tamaño `xs` e `icon-xs`: `after:absolute after:-inset-x-2 after:-inset-y-2`.
- `PropertyModal`, "Ver ficha completa".
- `LocationPicker`, "Centrar".

**Medido sobre el detalle de propiedad abierto en un teléfono (390 px):**

```
"Ver ficha completa": alto dibujado 28 px · ancho 146,6
  área de toque ::after → top -8px, bottom -8px
  alto efectivo 44 px · ancho efectivo 162,6 px
```

Y en "Centrar" queda además escrito en el código que **no es la única forma de hacer lo mismo**: arrastrar el pin también recentra.

---

## 6. La lista de exclusiones, una por una

| Exclusión | Estado | Evidencia |
|---|---|---|
| Botones de solo ícono circulares sobre fotos y mapa | **Intactos** | Los 19 `rounded-full` siguen en sus 10 archivos. Medido: "Cerrar" y "Compartir" del detalle siguen círculos de 36 px |
| Avatares, interruptor, puntos del carrusel, barras de progreso, franjas | **Intactos** | Mismos `rounded-full`; `PreferencesContent` (interruptor), `Sidebar` y `ProfileForm` (avatares), `PlanBadge` y `SubscriptionContent` (progreso) sin cambios |
| **Esquinas superiores de las hojas** | **Intactas, y nombrado como excepción** | `--radius-xl: 0.875rem; /* 14px — solo las hojas */` con el motivo escrito en `globals.css`. Medido: hoja de filtros y hoja del detalle, **14 px arriba y 0 abajo** |
| Campos subrayados de inicio de sesión y registro | **Intactos** | El disparador de `Select` y el `Textarea` conservan `rounded-none`; `Input` no tiene clase de radio. Medido en `/login` y `/register`: **radio 0, alto 40, relleno izquierdo 0** |
| Pines del mapa y cromo de Leaflet | **Intactos** | Literales de `globals.css`: pin 8 px, círculos 50 %, zoom 8 px, atribución 6 px. No dependen del tema |
| Esqueletos de carga | **Intactos** | Siguen con `rounded-sm` y `rounded` sueltos; el único efecto es el −2 px general del token |
| **Etiquetas de formulario (punto 7)** | **NO SE TOCARON** | `ui/label.tsx` conserva `text-xs font-semibold tracking-wide uppercase`. **Siguen en MAYÚSCULAS a 12 px** (14 donde el formulario las pisa), incluidos los 25 usos. Queda como decisión aparte |
| Tanda anterior: color del borde de las casillas | **Intacto** | `border border-graphite/80` sigue en `ui/checkbox.tsx` |
| Tanda anterior: opciones de operación | **Estructura intacta** | Siguen `border-terracota bg-white` / `border-stone bg-transparent` con el mismo `p-4`. ⚠ Su radio pasó de 8 a 6 px **por la regla general del tema**, no por un cambio en ese archivo |
| Tanda anterior: relleno del panel en celular | **Intacto** | `pt-14 md:pt-0` en los dos layouts |
| Tanda anterior: filtros de administración | **Intacto** | `space-y-4` y la estructura de dos columnas siguen igual |

---

## 7. El título del bloque de precios

**De dónde salió el tratamiento:** de los títulos de sección que ya existen en cada pantalla, no de uno nuevo.
- **Detalle de propiedad:** "Requisitos para alquilar" (`PropertyModal.tsx`) → `<p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">`.
- **Ficha pública:** "Comodidades" (`propiedades/[slug]/page.tsx:304`) → mismo juego de clases, en `<h2>`.

**Detalle de propiedad** (`src/components/map/PropertyModal.tsx`):

```tsx
        {/* ⚠ UN SOLO título para todo el bloque, no uno por operación: cada
            línea ya dice a qué operación corresponde. Sin él, una propiedad sin
            precio cargado mostraba solo "A convenir", sin nada que dijera de qué
            se estaba hablando. Mismo tratamiento que los otros títulos de sección
            de esta pantalla ("Requisitos para alquilar"). */}
        <div className="space-y-1.5">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
            Precio
          </p>
          <div className="space-y-2.5">
          {operations.map((o) => (
            <div key={o.operation}>
              {operations.length > 1 && (
                <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  {OPERATION_TYPE_LABELS[o.operation]}
                </p>
              )}
              <p className="font-serif text-3xl font-bold text-terracota">
                {formatPrice(o.price, o.currency)}
              </p>
            </div>
          ))}
          </div>
        </div>
```

**Ficha pública** (`src/app/(public)/propiedades/[slug]/page.tsx`):

```tsx
        <div className="mt-4">
          {/* ⚠ UN SOLO título para todo el bloque: cada línea ya dice su
              operación. Sin él, una propiedad sin precio mostraba solo "A
              convenir". Mismo tratamiento que los otros títulos de sección de
              esta página ("Comodidades", "Requisitos para alquilar"). */}
          <h2 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
            Precio
          </h2>
          <div className="mt-2 space-y-3">
          {operations.map((o) => (
            <div key={o.operation}>
              {operations.length > 1 && (
                <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  {OPERATION_TYPE_LABELS[o.operation]}
                </p>
              )}
              <p className="font-serif text-[40px] font-bold leading-none text-terracota">
                {formatPrice(o.price, o.currency)}
              </p>
            </div>
          ))}
          </div>
        </div>
```

**Medido:** en las dos pantallas el título sale en **11 px, mayúsculas, color `graphite` (rgb 78,74,70)**, con 6 px hasta el precio en el detalle y 16 px de separación del bloque anterior en la ficha. La etiqueta por operación (solo cuando hay más de una) se conservó.

---

## 8. ⚠ Qué mirar para evaluar el cambio de aspecto

De mayor a menor impacto visible:

1. **`/login` y `/register`.** El botón principal: antes rectángulo gris oscuro con "INGRESAR" en mayúsculas apretadas a 12 px; ahora redondeado, "Ingresar" en minúsculas a 14 px y 4 px más alto. **Es el cambio más grande de la tanda y lo primero que ve una inmobiliaria.**
2. **`/register/plan`.** Mismo botón en "Continuar", debajo de las tres tarjetas de plan.
3. **Un diálogo de confirmación.** En Propiedades, el menú `⋯` de cualquier fila → "Eliminar". Mirar tres cosas juntas: la **caja ya no es recta**, el **título dejó las mayúsculas** y los **dos botones** cambiaron de forma y de texto.
4. **El menú `⋯` de una fila** (Propiedades o `/admin`): caja redondeada y cada ítem con su propio redondeo al pasar el mouse. ⚠ Los ítems **siguen en mayúsculas**: es deliberado, el prompt solo pedía la forma.
5. **El panel de filtros del mapa** (home, escritorio): los cuatro grupos de botones ahora miden todos 36 px —antes 36, 34 y 32— y "Limpiar filtros" 44. Es el lugar donde más se nota la escala de altos.
6. **Las casillas** (filtros del mapa, y en el formulario de propiedades): cuadrados con 4 px de esquina en vez de esquina viva.
7. **El detalle de una propiedad** (tocar un pin): el título **"Precio"** arriba del número, y "Ver ficha completa" sobre la foto.
8. **La ficha pública de una propiedad sin precio** (`/propiedades/...`): ahí se ve para qué sirve el título, porque abajo dice solo "A convenir".
9. **Las tarjetas y secciones del panel**: 2 px menos de esquina. Es el cambio más sutil; conviene mirarlo comparando una tarjeta con el borde de la pantalla, no de memoria.
10. **Lo que NO tiene que haber cambiado:** los botones circulares sobre la foto del detalle, las esquinas superiores de las hojas al abrirlas desde abajo en el celular, y los campos de inicio de sesión y registro, que siguen siendo una línea sin caja.

---

## 9. Inconsistencias nuevas (sin arreglar)

Se suman a las 46 + 6 abiertas de las tandas anteriores.

1. **Los ítems de menú siguen en MAYÚSCULAS a 12 px con espaciado ancho** (`ui/dropdown-menu.tsx`), ahora que los botones dejaron ese tratamiento. Dentro del mismo panel conviven dos voces: un botón "Eliminar agente" en minúsculas y un ítem de menú "ELIMINAR". El prompt pedía solo la forma de los ítems.
2. **El tamaño `lg` del botón quedó con la misma altura que el `default`** (44): se diferencian solo por el relleno (32 contra 16). Es un tamaño redundante en la escala; hoy no lo usa nadie.
3. **`icon-lg` quedó igual que `icon`** (44 px) por el mismo motivo; tampoco tiene usos.
4. **`Badge` y `Card` del preset siguen rectos** (`rounded-none`) y sin ningún consumidor. Si alguien los usa, entran fuera de la regla sin que nada avise.
5. **El área de toque extendida de "Ver ficha completa" llega a 162,6 px de ancho** sobre la foto del detalle, y los puntos del carrusel están centrados en esa misma franja inferior. Hoy no se tocan (medido en 390 px), pero en una pantalla más angosta podrían quedar a pocos píxeles.
6. **`ui/button.tsx` ganó `relative` en su base.** Es lo que ancla el área de toque del tamaño chico, pero cambia el bloque contenedor de cualquier hijo posicionado en absoluto dentro de un botón. No encontré ninguno hoy (por lectura), así que queda anotado como algo a vigilar.

---

## 10. Baseline de calidad

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

**0 errores, 1 warning (el conocido, `react-hooks/incompatible-library`), exit 0.** Misma llamada `watch("amenities")`, misma línea que en la tanda anterior (814).

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 11.4s
  Running TypeScript ...
  Finished TypeScript in 9.6s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/20) ...
  Generating static pages using 3 workers (5/20) 
  Generating static pages using 3 workers (10/20) 
  Generating static pages using 3 workers (15/20) 
✓ Generating static pages using 3 workers (20/20) in 1264ms
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

## 11. Lo que resultó falso o imposible

**Ninguna decisión resultó imposible.** Las ocho se implementaron como estaban descritas.

**Precisiones sobre lo que afirma el prompt:**

1. **"Hoy las tres variables derivan de una sola y dan dos píxeles más que la tabla documentada" — exacto**, y verificado en el CSS compilado antes y después: 6/8/10 → 4/6/8.
2. **"Verificá si hay elementos que usan el valor base directamente y quedarían descolgados" — no hay ninguno.** `var(--radius)` solo se usaba dentro de las definiciones de los tokens. Sí encontré **seis `border-radius` literales** en `globals.css` (pin del mapa, sus tres círculos, el control de zoom y la caja de atribución de Leaflet): **no dependen del tema y son justamente parte de las exclusiones**, así que quedaron intactos. El único que quedaría "descolgado" en teoría es el pin, a 8 px literales, que hoy coincide con el radio de contenedor.
3. **"Su alto por defecto queda por debajo del mínimo táctil" — cierto:** el `Button` medía 40 px y DESIGN §6 pide 44. Corregido y medido.
4. **Una consecuencia que conviene tener presente:** el radio de **las opciones de operación** (tanda anterior) pasó de 8 a 6 px. No toqué ese archivo para eso: es la regla general del tema aplicándose a una clase `rounded-md` que ya estaba. Su estructura, su relleno y sus colores siguen exactamente como los dejó la tanda anterior.
5. **Sobre el punto 7 (etiquetas):** quedaron **sin tocar** y siguen en mayúsculas. Vale anotar que ahora son, junto con los ítems de menú, lo último que conserva el tratamiento en mayúsculas del preset dentro de los formularios.
