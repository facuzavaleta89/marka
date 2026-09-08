# Scroll de la página de propiedad + las dos puertas de entrada — informe

Los dos problemas están corregidos y verificados contra el servidor de producción. Baseline
intacto: 0 errores, el mismo warning único, **22 rutas** (ninguna nueva).

**No ejecuté ningún comando de git** y **no ejecuté SQL**.

---

## 1. Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/app/(public)/propiedades/[slug]/page.tsx` | El contenedor raíz pasó de `min-h-dvh` a `h-dvh overflow-y-auto`: la página trae su propio scroll |
| `src/components/properties/PropertyUnavailable.tsx` | Mismo contenedor propio + un hijo con `min-h-full` que conserva el centrado |
| `src/components/map/PropertyModal.tsx` | Botón "Ver ficha completa" sobre la foto, abajo a la izquierda (+ el import de `Link` y del ícono) |
| `src/components/properties/PropertyCard.tsx` | El título es enlace a la ficha; `slug` agregado al tipo de datos; guarda de teclado en el `onKeyDown` del contenedor |

**Cuatro archivos, ninguno nuevo.** No se tocó la resolución de la propiedad, ni el mapa del
sitio, ni robots, ni la metadata, ni el bloqueo de scroll del documento.

---

## 2. Cómo resolví el scroll, y por qué esa forma

**El contenedor, tal como quedó:**

```tsx
    <div className="h-dvh overflow-y-auto bg-paper">
```

Antes era `min-h-dvh bg-paper`.

**Por qué esa forma y no otra.** La causa no era de esta página. `globals.css` bloquea el scroll
del documento a nivel raíz:

```css
/* ─── Lock de scroll del documento ─────────────────────────────
   El documento (html/body) NUNCA scrollea: cada pantalla full-height usa la
   unidad dinámica dvh y maneja su propio scroll en contenedores internos […] */
html,
body {
  height: 100%;
  overflow: hidden;
}
```

**`min-h-dvh` era exactamente el error**: deja crecer el elemento más allá del viewport y delega
el scroll al documento… que no scrollea. El contenido quedaba en el DOM pero **inalcanzable** —
ni el bloque de contacto, ni el mapa, ni el pie. `h-dvh` lo fija a una pantalla y
`overflow-y-auto` le da su propio scroll adentro.

**Seguí el precedente que el prompt señalaba**, `AuthLayout` — la otra pantalla que dependía del
scroll del documento y a la que hubo que darle uno propio:

```tsx
src/components/auth/AuthLayout.tsx:20
    <div className="flex h-dvh flex-col overflow-y-auto bg-paper md:flex-row md:items-start">
```

Mismo par: `h-dvh` + `overflow-y-auto`.

**Tres alternativas que descarté:**

| Alternativa | Por qué no |
|---|---|
| Sacar el `overflow: hidden` del documento | Es lo que el prompt prohíbe, y con razón: existe por un problema medido del mapa en celulares. Arreglarlo desde ahí rompe eso |
| `min-h-dvh` + `overflow-y-auto` | `min-h-dvh` no fija una altura, así que el elemento crece con el contenido y `overflow-y-auto` no tiene de qué desbordar. No scrollearía nada |
| Un `<main>` interno scrolleable, con el header afuera (patrón del dashboard) | Habría que sacar el header del flujo y volverlo hermano. Más cambio para el mismo resultado, y **el header es `sticky top-0`**: con el scroll en la raíz se ancla al tope del contenedor que scrollea y ya se comporta como corresponde |

**El `sticky top-0` del header sigue funcionando**: ahora se ancla al tope de este contenedor,
que es el que scrollea.

**Verificado contra el servidor** (`next start`, build de producción):

```
=== PÁGINA DISPONIBLE: contenedor raíz ===
<div class="h-dvh overflow-y-auto bg-paper"
¿queda algún min-h-dvh sin scroll? -> 0
```

> ⚠ Verifiqué la **clase renderizada**, no el gesto de scroll en un navegador real: no tengo
> navegador en este entorno. Lo que sí está comprobado es que el contenedor es idéntico al del
> precedente que ya funciona en login/register.

---

## 3. La página de "no disponible" tenía el mismo problema (latente)

**Sí, y lo arreglé igual.** Antes:

```tsx
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 text-center">
```

Hoy el contenido entra sin scrollear —wordmark, un `h1`, un párrafo y un botón—, así que **no se
ve el defecto**. Pero depende de que el contenido sea corto, y eso no lo está midiendo nadie:
alcanza con un teléfono chico en horizontal, o con el tamaño de letra del navegador subido, para
que el botón "Ir al mapa" quede fuera de la pantalla **sin ninguna forma de llegar a él**. Y en
esta pantalla ese botón es literalmente la única salida.

Ahora:

```tsx
    <div className="h-dvh overflow-y-auto bg-paper">
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
```

**Son dos clases y cada una hace una cosa distinta:** el de afuera fija una pantalla y scrollea;
el de adentro lleva **`min-h-full`** (no `min-h-dvh`) para seguir **centrando** cuando sobra
lugar y crecer cuando falta. `min-h-dvh` en el hijo volvería a delegar el scroll al documento,
que es de donde venimos.

Verificado:

```
<div class="h-dvh overflow-y-auto bg-paper"><div class="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center"
```

---

## 4. Otras pantallas con el mismo defecto — REPORTADAS, NO ARREGLADAS

Audité las **doce** apariciones de `h-dvh`/`min-h-dvh`/`h-screen` en `src/`. Dos tienen el mismo
defecto latente, y una tercera es una limitación del framework.

### ⚠ Con el defecto (no las toqué: es alcance de otra tanda)

**1. `src/components/agency/AgencyUnavailable.tsx:10` — "sitio no disponible" del sitio de marca**

```tsx
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 text-center">
```

**Es exactamente la misma línea que tenía `PropertyUnavailable` antes del arreglo** — no es
casualidad: clonè aquel de éste en la tanda anterior, y me traje el defecto. Mismo contenido
corto, mismo riesgo, misma corrección de dos clases. **Es la más clara de las tres, y la que yo
mismo propagué.**

**2. `src/app/(public)/page.tsx:86` — estado "Sin ciudades disponibles"**

```tsx
      <div className="h-dvh bg-paper flex items-center justify-center px-4">
```

Tiene `h-dvh` (bien) pero **sin `overflow-y-auto`**: si el contenido se pasara, no habría scroll.
Riesgo bajo (dos párrafos cortos) pero el mismo patrón.

**3. El 404 del framework** — el proyecto **no tiene `not-found.tsx` propio** (verificado: no hay
ningún archivo con ese nombre en `src/app`), así que se usa el de Next, renderizado dentro de
nuestro `<body>` con el scroll bloqueado. No lo controlamos desde el código de la app; la salida
natural sería escribir un `not-found.tsx` propio — y ahí sí con contenedor.

### ✅ Sin el defecto (verificadas, correctas)

| Pantalla | Cómo scrollea |
|---|---|
| `dashboard/layout.tsx:33` + `admin/layout.tsx:47` | `h-dvh overflow-hidden` en el wrapper y `<main className="relative flex-1 overflow-y-auto">` adentro (`:49` y `:62`) |
| `AuthLayout.tsx:20` | `h-dvh overflow-y-auto` — el precedente |
| `(public)/page.tsx:56` y `:100`, `AgencyMapView.tsx:62` | `flex flex-col h-dvh overflow-hidden` + contenedores internos (aside `overflow-y-auto`, lista mobile, sheets) |
| `Sidebar.tsx:227` | `h-dvh sticky top-0` — es una columna fija, no scrollea contenido propio |

---

## 5. El botón del modal: dónde quedó y cuánto agrega

**Quedó SOBRE LA FOTO, abajo a la izquierda. Agrega CERO píxeles de alto.**

```tsx
        <Link
          href={`/propiedades/${property.slug}`}
          className="absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 rounded-md bg-paper/85 px-2.5 py-1.5 font-sans text-xs font-medium text-graphite shadow-sm backdrop-blur-sm transition-colors hover:bg-paper hover:text-black"
        >
          Ver ficha completa
          <ArrowUpRight size={14} />
        </Link>
```

### La medición que me hizo NO ponerlo en la zona inferior

El prompt pedía medirlo y, si no entraba, proponer otro lugar en vez de meterlo igual. **No
entraba.**

Zona inferior hoy (con el input de nombre colapsado):

| Parte | Alto |
|---|---|
| `py-4` × 2 | 32,0 px |
| borde superior | 1,0 px |
| bloque "quién publica" | 32,5 px |
| `space-y-2.5` | 10,0 px |
| input colapsado (`max-h-0`) | 0,0 px |
| `space-y-2.5` | 10,0 px |
| botón de WhatsApp `h-11` | 44,0 px |
| **total actual** | **129,5 px** |

Un botón de ancho completo ahí habría sumado **44 + 10 = 54 px** → zona inferior de 183,5 px.

En un iPhone SE (375×667), el sheet es `h-[82vh]` = 546,9 px:

| | Área que scrollea |
|---|---|
| **Hoy (sin tocar nada)** | 546,9 − 20 (handle) − 220 (carrusel) − 129,5 = **177,4 px** |
| **Con el botón en la zona inferior** | 546,9 − 20 − 220 − 183,5 = **123,4 px** |
| Diferencia | **−54 px, un 30 % menos** |

123 px es **menos de dos párrafos** para una ficha que tiene descripción, comodidades y
requisitos de alquiler. La zona es `shrink-0` dentro de un contenedor de alto **fijo**, así que
cada píxel sale entero del área que scrollea.

### Por qué la esquina inferior izquierda de la foto

- **Cuesta 0 px**: es `absolute` sobre el carrusel, igual que los otros tres botones flotantes.
- **Se ve sin scrollear**, que es lo que necesita una puerta. Un botón al final del cuerpo
  scrolleable también costaba 0 px, pero solo lo encuentra quien ya bajó hasta el final — y
  entonces deja de ser una puerta.
- **La esquina estaba libre**: los dots del carrusel van centrados (`bottom-3 left-1/2`) y el
  contador abajo a la derecha (`bottom-2.5 right-3`).
- Se apoya en el gradiente que el carrusel **ya dibuja** para legibilidad, y usa el mismo
  tratamiento `bg-paper/85 + backdrop-blur` que cerrar, compartir y favorito.
- **Texto explícito, no el título como enlace.** El modal vive sobre el mapa, donde el visitante
  está explorando: un título clickeable se toca por accidente y lo saca del mapa sin que lo haya
  pedido.

Verificado que llegó al bundle del cliente:

```
$ grep -rl "Ver ficha completa" .next/static/chunks/
.next/static/chunks/0tv56gifdx2ye.js
```

---

## 6. El conflicto entre el enlace del título y el click de la tarjeta

### Dónde vive el click hoy — en el CONTENEDOR

```tsx
src/components/properties/PropertyCard.tsx
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={…}
```

O sea que **sin hacer nada, un toque en el título habría disparado las dos cosas**: navegar a la
ficha **y** abrir el modal.

### Cómo lo resolví — dos piezas, porque son dos problemas distintos

**(a) El mouse / el dedo: cortar la propagación.** Es el mismo recurso que ya usaba el botón de
favorito de la foto (`e.stopPropagation()`), no un invento nuevo:

```tsx
        <h3 className="mt-1 font-serif text-[17px] font-semibold leading-snug text-black">
          <Link
            href={`/propiedades/${property.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 line-clamp-2 hover:text-terracota hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40"
          >
            {property.title}
          </Link>
        </h3>
```

El `relative z-10` es lo que hace que el área del enlace gane el click: sin él, el enlace y el
fondo de la tarjeta se pelean el mismo punto y el resultado depende del orden de pintado. El
`line-clamp-2` se movió del `h3` al `<a>` para que el recorte siga aplicando al texto que ahora
es el enlace.

**(b) El teclado: una guarda en el contenedor.** Acá está lo que se pasa por alto:
`stopPropagation` en el `onClick` **no cubre el teclado**. Un Enter con el foco en el enlace lo
activa **y además** burbujea hasta el `onKeyDown` del `<article>`, así que se dispararían las dos
cosas igual.

```tsx
      onKeyDown={(e) => {
        // ⚠ SOLO cuando la tecla se presiona sobre la tarjeta MISMA.
        // […]
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
```

La guarda va en el contenedor y no en cada hijo a propósito: **cubre a todos de una vez,
presentes y futuros**, en vez de pedirle a cada elemento interactivo que se acuerde de frenar
también el `onKeyDown`.

**Efecto lateral: arregla un bug que ya existía.** El botón de favorito tenía exactamente el
mismo problema desde antes —Enter sobre él marcaba el favorito **y** abría el modal— y nadie lo
había notado. La misma línea lo cierra.

**Resultado:** tocar el título → la ficha. Tocar cualquier otra parte de la tarjeta → el modal.
Con mouse y con teclado.

**Un dato de tipos:** `PropertyCardData` no incluía `slug`, así que lo agregué al `Pick`. **No
hubo que tocar ninguna consulta**: `useProperties` ya lo trae en su SELECT acotado
(`id, title, slug, description, …`).

### Dónde se usa la tarjeta

**En un solo lugar**, verificado:

```
$ grep -rn "PropertyCard" src/ --include=*.tsx | grep -v PropertyCard.tsx
src/components/properties/PropertyList.tsx:9   import { PropertyCard } from "./PropertyCard";
src/components/properties/PropertyList.tsx:125 <PropertyCard
```

Y `PropertyList` se usa en **dos sitios, los dos públicos**:

```
src/app/(public)/page.tsx:137            {!showMap && <PropertyList city={city} />}
src/components/map/AgencyMapView.tsx:126 {!showMap && <PropertyList city={city} agencyId={agencyId} />}
```

**El panel del agente NO usa esta tarjeta**: usa `PropertiesTable`
(`dashboard/propiedades/page.tsx:5`), un componente distinto.

**Conclusión: el enlace público tiene sentido en el 100 % de los usos**, así que no hizo falta
condicionarlo por contexto ni agregar una prop para apagarlo. Si mañana la tarjeta se reusara en
el panel, ahí sí habría que revisarlo — pero agregar hoy una prop para un caso que no existe
sería configurar en el aire.

---

## 7. Los tres comandos

> ⚠ **Nota de método, porque afecta la lectura de los números.** La primera corrida de `tsc` me
> dio 33 errores **todos** en `.next/dev/types/validator.ts` y `.next/types/validator.ts` —
> artefactos generados que `tsconfig.json` incluye explícitamente (`".next/types/**/*.ts"`,
> `".next/dev/types/**/*.ts"`) y que habían quedado desincronizados entre sí después de correr
> `next start` y varios builds en esta sesión. **Ni un solo error era de código del proyecto.**
> Borré `.next` y `tsconfig.tsbuildinfo` y corrí los tres de cero. Además volví a correr `tsc`
> **después** del build, con los tipos ya regenerados: sigue en 0.

### `npx tsc --noEmit`

```
(sin salida)
EXIT_TSC=0
```

Y re-verificado con los tipos regenerados por el build:

```
=== tsc DE NUEVO, con los tipos ya regenerados por el build ===
EXIT=0
```

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

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 8.7s
  Running TypeScript ...
  Finished TypeScript in 8.2s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (20/20) in 1463ms
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

### Comparación contra el baseline

| Chequeo | Baseline | Ahora | |
|---|---|---|---|
| `tsc --noEmit` | 0 errores, exit 0 | 0 errores, exit 0 | ✅ sin cambios |
| `npm run lint` | 0 errores, 1 warning en `PropertyForm.tsx:808:30` | 0 errores, 1 warning en `PropertyForm.tsx:808:30` | ✅ **el mismo warning único, misma línea y columna** |
| `next build` | verde, exit 0, 22 rutas | verde, exit 0, **22 rutas** | ✅ **sin cambios** |

**Las 22 rutas son exactamente las mismas**, en el mismo orden y con el mismo tipo (`○`/`ƒ`).
Este trabajo no agregó ninguna: las dos entradas nuevas son un `<Link>` a una ruta que ya
existía.

---

## 8. Lo que resultó falso o distinto

**Nada del prompt resultó falso.** Los dos problemas eran reales y las causas eran las que
señalaba. Cuatro cosas que quiero decir derecho:

**a) El defecto de scroll lo introduje yo la tanda pasada, y lo propagué.** `CLAUDE.md` ya decía
—desde antes de que yo tocara nada— *"Si creás una pantalla nueva, dale su propio contenedor
scrolleable interno — NO dependas del scroll del documento"*. Escribí `min-h-dvh` igual. Y peor:
al clonar `AgencyUnavailable` para hacer `PropertyUnavailable` me traje el mismo defecto latente,
que ahora reporto en §4 como pendiente en el original.

**b) `PropertyCardData` no tenía `slug` y hubo que agregarlo al `Pick`.** Es un cambio de tipo
que el prompt no mencionaba. No requirió tocar ninguna consulta —`useProperties` ya lo traía— y
lo dejé anotado en el propio tipo.

**c) Arreglé un bug de teclado del botón de favorito que no estaba pedido.** La guarda
`e.target !== e.currentTarget` era necesaria para el enlace nuevo, y de paso cierra el mismo
problema que el favorito tenía desde antes (Enter marcaba el favorito **y** abría el modal). Lo
señalo porque es alcance que sumé, aunque sea la misma línea.

**d) Verifiqué las clases renderizadas, no el gesto de scroll en un navegador.** No tengo
navegador en este entorno. Lo que está comprobado es que el contenedor resultante es idéntico al
de `AuthLayout`, que es el precedente que ya funciona en login/register, y que el HTML servido no
conserva ningún `min-h-dvh` sin scroll. **La confirmación visual final la tenés que hacer vos.**

**Una tensión de accesibilidad que dejo anotada sin resolver:** el `<a>` del título queda anidado
dentro de un `role="button"`, que estrictamente no es válido (contenido interactivo dentro de un
rol de botón). El archivo **ya tenía** esa forma —el botón de favorito está en la misma
situación— y arreglarlo de raíz significa repensar si la tarjeta debe seguir siendo un `button`
o pasar a ser un contenedor con un enlace principal. Es una decisión de diseño, no una línea, y
no me pareció que entrara en esta tanda.
