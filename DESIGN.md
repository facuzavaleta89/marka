# DESIGN.md — Sistema de Diseño
> App Mapa Inmobiliario · Estilo editorial, limpio y profesional
> Leer completo antes de crear o modificar cualquier componente visual.

---

## 1. Filosofía de Diseño

El diseño comunica que esta es una herramienta seria para profesionales del real estate. No es una app de consumo masivo con paleta brillante y animaciones llamativas. Es editorial: cada elemento ocupa el espacio justo, la jerarquía visual habla sola, y el silencio (espacio negativo) es parte del diseño.

**Tres principios que gobiernan cada decisión:**

- **Jerarquía antes que decoración.** Si un elemento no comunica algo útil, no está. El precio de una propiedad debe ser lo primero que el ojo encuentra. Todo lo demás es soporte.
- **Calidez contenida.** La paleta es cálida, no fría. Pero la calidez es discreta, no acogedora al punto del kitsch. Evocamos papel, piedra, materiales nobles — no madera barnizada.
- **El mapa es protagonista.** En desktop, el mapa ocupa el 100% del viewport. El UI es una capa sobre el mapa, no al revés. Los componentes flotantes (filtros, modal) respetan eso.

---

## 2. Sistema de Color

### Paleta base

| Token | Hex | Uso principal |
|---|---|---|
| `black` | `#111111` | Texto primario, headings, íconos de alto contraste |
| `graphite` | `#4E4A46` | Texto secundario, labels, subtítulos |
| `stone` | `#C8C0B7` | Bordes, divisores, estados deshabilitados, placeholders |
| `mist` | `#EAE4DC` | Backgrounds alternativos, hover states, inputs |
| `paper` | `#FBF9F6` | Background principal de toda la app |

### Color de acción (único acento)

| Token | Hex | Uso |
|---|---|---|
| `terracota` | `#A0522D` | CTAs primarios, pines activos, badges "Destacado", estados activos |
| `terracota-hover` | `#8B4526` | Hover sobre elementos terracota |
| `terracota-subtle` | `#F5EDE8` | Backgrounds de alertas, chips seleccionados, highlight suave |

### Colors funcionales (no modificar)

| Token | Hex | Uso |
|---|---|---|
| `whatsapp` | `#25D366` | Exclusivo para el botón de WhatsApp — es color de marca, nunca sobreescribir |
| `whatsapp-hover` | `#1EBE57` | Hover del botón WhatsApp |
| `success` | `#2D6A4F` | Confirmaciones, estados "vendido/alquilado" exitosos |
| `error` | `#9B2335` | Errores de validación en formularios |

### CSS Variables (agregar en `globals.css`)

```css
:root {
  /* Paleta base */
  --color-black:     #111111;
  --color-graphite:  #4E4A46;
  --color-stone:     #C8C0B7;
  --color-mist:      #EAE4DC;
  --color-paper:     #FBF9F6;

  /* Acento */
  --color-terracota:        #A0522D;
  --color-terracota-hover:  #8B4526;
  --color-terracota-subtle: #F5EDE8;

  /* Funcionales */
  --color-whatsapp:       #25D366;
  --color-whatsapp-hover: #1EBE57;
  --color-success:        #2D6A4F;
  --color-error:          #9B2335;
}
```

### Extensión en `tailwind.config.ts`

```ts
theme: {
  extend: {
    colors: {
      black:     "#111111",
      graphite:  "#4E4A46",
      stone:     "#C8C0B7",
      mist:      "#EAE4DC",
      paper:     "#FBF9F6",
      terracota: {
        DEFAULT: "#A0522D",
        hover:   "#8B4526",
        subtle:  "#F5EDE8",
      },
      whatsapp: {
        DEFAULT: "#25D366",
        hover:   "#1EBE57",
      },
    },
  },
}
```

### Reglas de uso de color

- **Nunca** combinar terracota con graphite en el mismo elemento — demasiado peso visual.
- **Nunca** usar terracota como color de texto largo (solo para etiquetas cortas, precios destacados, íconos).
- **Siempre** mantener el fondo general en `paper`, no en blanco puro (`#FFFFFF`). El blanco puro rompe la calidez de la paleta.
- El botón de WhatsApp **siempre** en verde `whatsapp`. Nunca en terracota, aunque sea el CTA principal de la pantalla.

---

## 3. Tipografía

### Fuentes

```
Editorial (display): Noto Serif — Google Fonts
Operativa  (UI):     DM Sans   — Google Fonts
```

**Por qué esta combinación:** Noto Serif aporta autoridad y carácter editorial sin ser pesado. DM Sans es geométrico, limpio y altamente legible en tamaños pequeños — supera a Lato en pantallas de alta densidad y tiene más personalidad que Inter.

### Importación en `layout.tsx`

```ts
import { Noto_Serif, DM_Sans } from "next/font/google";

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});
```

### Escala tipográfica

| Rol | Fuente | Peso | Tamaño | Line-height | Tailwind |
|---|---|---|---|---|---|
| Display | Noto Serif | 700 | 48–64px | 1.1 | `font-serif text-5xl font-bold leading-tight` |
| H1 | Noto Serif | 700 | 36px | 1.15 | `font-serif text-4xl font-bold` |
| H2 | Noto Serif | 600 | 28px | 1.2 | `font-serif text-3xl font-semibold` |
| H3 | Noto Serif | 600 | 22px | 1.25 | `font-serif text-2xl font-semibold` |
| Precio destacado | Noto Serif | 700 | 32px | 1.1 | `font-serif text-3xl font-bold` |
| Subtítulo | DM Sans | 500 | 16px | 1.4 | `font-sans text-base font-medium` |
| Cuerpo | DM Sans | 400 | 15px | 1.6 | `font-sans text-[15px]` |
| Label / UI | DM Sans | 500 | 13px | 1.3 | `font-sans text-sm font-medium` |
| Metadata | DM Sans | 400 | 12px | 1.4 | `font-sans text-xs` |
| Badge / Chip | DM Sans | 600 | 11px | 1 | `font-sans text-[11px] font-semibold uppercase tracking-wide` |

### Reglas tipográficas

- **Noto Serif** para todo lo que el usuario necesita leer para tomar una decisión: títulos de propiedades, precios, sección headers, claims del marketing.
- **DM Sans** para todo lo que el usuario usa para operar: filtros, labels, botones, formularios, navegación, metadata.
- **Nunca mezclar** ambas fuentes dentro de un mismo componente pequeño (un badge, un input). La mezcla es solo a nivel de sección/página.
- Tracking (letter-spacing) ajustado: solo en badges y chips en mayúsculas (`tracking-wide` o `tracking-wider`). En texto corrido, `tracking-normal`.

---

## 4. Espaciado y Layout

### Sistema de espaciado

Base: **4px**. Todos los valores de margin/padding son múltiplos de 4.

| Token | Valor | Uso típico |
|---|---|---|
| `space-1` | 4px | Separaciones mínimas internas |
| `space-2` | 8px | Padding interno de badges/chips |
| `space-3` | 12px | Gap entre ícono y label |
| `space-4` | 16px | Padding estándar de cards y panels |
| `space-6` | 24px | Separación entre secciones dentro de un componente |
| `space-8` | 32px | Separación entre bloques de contenido |
| `space-12` | 48px | Separación entre secciones de página |
| `space-16` | 64px | Márgenes de layout grandes |

### Layout desktop (mapa principal)

```
┌─────────────────────────────────────────────────────┐
│  FilterPanel (320px fijo, izquierda)  │  MapView    │
│                                       │  (flex: 1)  │
│                                       │             │
└─────────────────────────────────────────────────────┘
```

- El FilterPanel tiene ancho fijo de `320px`.
- El mapa ocupa el resto del viewport (`flex: 1`, `height: 100vh`).
- El PropertyModal se abre sobre el mapa como overlay centrado.
- El header de la app es mínimo: logo + login. Altura `56px`.

### Layout mobile (cards-first)

En mobile, el mapa no es el punto de entrada. Los visitantes en mobile navegan por una lista de cards. El mapa es accesible pero secundario.

```
┌─────────────────────────┐
│  Header (56px)          │
├─────────────────────────┤
│  Filtros (chips inline, │
│  scroll horizontal)     │
├─────────────────────────┤
│                         │
│  Lista de PropertyCards │
│  (scroll vertical)      │
│                         │
├─────────────────────────┤
│  FAB: "Ver en mapa" ↗   │  ← floating, bottom-right, terracota
└─────────────────────────┘
```

- Breakpoint mobile/desktop: `md` (768px). Bajo ese breakpoint, mostrar cards. Sobre ese, mostrar mapa.
- El FAB "Ver en mapa" está fijo en `bottom-6 right-6`, fondo terracota, ícono de mapa, texto en DM Sans.

### Border radius

| Elemento | Valor |
|---|---|
| Cards, modales, panels | `rounded-lg` (8px) |
| Inputs, selects | `rounded-md` (6px) |
| Badges, chips | `rounded-sm` (4px) |
| Botones | `rounded-md` (6px) |
| Avatares | `rounded-full` |
| Pines del mapa | `rounded-lg` (8px) |

**Regla:** nunca `rounded-full` en cards, botones grandes o contenedores. Reservado para avatares y elementos circulares por naturaleza.

### Sombras

El diseño editorial prefiere bordes sobre sombras. Las sombras se usan solo en elementos flotantes.

| Elemento | Sombra |
|---|---|
| Cards en reposo | `shadow-none` + border `stone` |
| Cards en hover | `shadow-sm` |
| Modales y panels flotantes | `shadow-lg` |
| Pines del mapa | `shadow-md` |
| FAB | `shadow-lg` |

---

## 5. Componentes del Mapa

### PropertyMarker (pin)

El pin muestra el precio directamente — es el único dato que importa en el mapa.

**Estado normal:**
```
┌──────────────┐
│  USD 250k    │  ← DM Sans 12px Medium, color: black
└──────┬───────┘  ← background: white, border: stone, shadow-md
       ▼
```

**Estado hover:**
```
┌──────────────┐
│  USD 250k    │  ← border: terracota
└──────┬───────┘
       ▼
```

**Estado activo (propiedad seleccionada):**
```
┌──────────────┐
│  USD 250k    │  ← background: terracota, texto: white
└──────┬───────┘
       ▼
```

**Propiedad destacada (`is_featured: true`):**
- Borde terracota permanente en estado normal
- Badge `★` en la esquina superior derecha del pin

**Formato de precio en el pin:**
- USD < 1.000.000 → `USD 250k`
- USD ≥ 1.000.000 → `USD 1.2M`
- ARS → `ARS 15M` (siempre en millones para que quepa)

### ClusterLayer

- Fondo: `graphite` (`#4E4A46`)
- Texto: `paper` (`#FBF9F6`), DM Sans 13px SemiBold
- Forma: circular, tamaño crece con la cantidad de propiedades
- Tamaños: `40px` (2–9), `52px` (10–99), `64px` (100+)

### PropertyModal

El modal se abre al hacer click en un pin. En desktop es un drawer desde la derecha (no bloquea el mapa). En mobile es un bottom sheet.

**Layout del modal:**

```
┌─────────────────────────────────┐
│  [Carrusel de fotos — 100%]     │  altura: 260px desktop / 220px mobile
│  ← 1/4 →                       │
├─────────────────────────────────┤
│  Tipo · Operación               │  DM Sans 12px, graphite, uppercase
│  Título de la propiedad         │  Noto Serif H2
│  USD 250.000                    │  Noto Serif 32px bold, terracota
│  ─────────────────────────────  │  divider stone
│  📍 Dirección, Barrio           │  DM Sans 14px, graphite
│  🛏 3  🚿 2  📐 120m²           │  DM Sans 13px, iconos mínimos
│  ─────────────────────────────  │
│  Descripción...                 │  DM Sans 15px, graphite, max 4 líneas
│  ─────────────────────────────  │
│  Amenities (chips)              │
│  ─────────────────────────────  │
│  [Input: tu nombre]             │  ← aparece solo si el usuario hace click en el botón
│  [● Consultar por WhatsApp]     │  ← fondo whatsapp-green, full-width
└─────────────────────────────────┘
```

**Comportamiento del CTA de WhatsApp:**
1. Botón visible desde el inicio con texto "Consultar por WhatsApp"
2. Al hacer click → el input de nombre aparece con animación (no estaba visible antes)
3. Usuario escribe nombre → botón cambia a "Enviar mensaje"
4. Al confirmar → se abre WhatsApp en nueva pestaña y se registra el lead

---

## 6. Componentes Generales

### Botones

| Variante | Background | Texto | Border | Uso |
|---|---|---|---|---|
| Primary | `terracota` | `paper` | — | CTA principal (guardar, publicar) |
| Primary hover | `terracota-hover` | `paper` | — | |
| Secondary | `transparent` | `black` | `stone` | Acciones secundarias |
| Secondary hover | `mist` | `black` | `graphite` | |
| WhatsApp | `whatsapp` | `white` | — | Solo para CTA de WhatsApp |
| Ghost | `transparent` | `graphite` | — | Acciones terciarias, cancelar |
| Destructive | `transparent` | `error` | `error` | Eliminar, desactivar |

Altura estándar: `44px` (cumple accesibilidad táctil). Padding horizontal: `16px`.

### PropertyCard (listado mobile y dashboard)

```
┌──────────────────────────────────────┐
│  [Imagen portada — 100% × 180px]    │
│                           ★ Dest.   │  ← badge terracota, top-right
├──────────────────────────────────────┤
│  Casa · Venta                        │  DM Sans 11px, graphite, uppercase
│  Casa 3 ambientes en Palermo         │  Noto Serif 17px semibold
│  USD 250.000                         │  Noto Serif 20px bold
│  📍 Palermo, CABA                    │  DM Sans 13px, graphite
│  🛏 3  🚿 2  📐 120m²               │  DM Sans 12px
└──────────────────────────────────────┘
```

- Border: `stone`
- Background: `paper`
- Hover: `shadow-sm` + border `graphite`

### Inputs y formularios

- Background: `white` (excepción al uso de `paper` — mejor legibilidad dentro de formularios)
- Border: `stone` en reposo, `graphite` en focus, `error` en error
- Label: DM Sans 13px Medium, `black`
- Placeholder: DM Sans 14px, `stone`
- Focus ring: `terracota` con `ring-2 ring-terracota ring-offset-1`

### Badges y chips

| Tipo | Background | Texto | Uso |
|---|---|---|---|
| Destacado | `terracota` | `paper` | Propiedad con `is_featured: true` |
| Tipo operación | `mist` | `graphite` | "Venta", "Alquiler" |
| Amenity | `mist` | `graphite` | Chips en el modal |
| Amenity activo | `terracota-subtle` | `terracota` | Amenity seleccionado en filtros |
| Estado vendido | `stone` | `graphite` | Propiedades `sold`/`rented` |

Todos en DM Sans 11px SemiBold uppercase, `rounded-sm`, padding `4px 8px`.

### FilterPanel

- Background: `paper`
- Border derecho: `stone` (1px)
- Separadores internos entre secciones: `stone` (1px)
- Título de cada sección: DM Sans 11px SemiBold uppercase, `graphite`, `tracking-wider`
- Valores seleccionados: DM Sans 14px, `black`

---

## 7. Dashboard del Agente

El área privada del agente mantiene la paleta pero con una distribución más funcional.

### Sidebar

- Background: `black` (`#111111`)
- Texto de items: DM Sans 14px, `stone`
- Item activo: `terracota` a la izquierda (borde 3px) + texto `paper`
- Item hover: texto `paper`
- Logo y nombre del agente en la parte superior, `paper`

### Área de contenido (dashboard)

- Background: `mist` (`#EAE4DC`) — más oscuro que `paper` para diferenciar del área pública
- Cards de contenido: background `paper`, border `stone`
- Títulos de página: Noto Serif H1, `black`
- Stats cards: número en Noto Serif 36px Bold, label en DM Sans 13px, `graphite`

---

## 8. Animación y Movimiento

El movimiento es funcional, no decorativo. La regla es: el usuario nunca debe esperar una animación.

| Elemento | Tipo | Duración | Easing |
|---|---|---|---|
| Hover sobre cards y botones | Color/border transition | 120ms | `ease-out` |
| Apertura del PropertyModal | Slide-in desde derecha (desktop) / bottom (mobile) | 220ms | `ease-out` |
| Cierre del PropertyModal | Fade + slide-out | 180ms | `ease-in` |
| Aparición del input de nombre (WA flow) | Height expand + fade-in | 200ms | `ease-out` |
| Clusters del mapa | Escala suave al cambiar zoom | Leaflet default | — |
| Chips de filtros al seleccionar | Background color transition | 100ms | `ease-out` |

**Nunca:** animaciones de entrada en elementos que ya estaban en pantalla antes de la interacción. **Nunca:** loading spinners si la operación tarda menos de 400ms.

---

## 9. Iconografía

- Librería: `lucide-react` (ya disponible en el stack)
- Tamaño estándar: `16px` en UI, `20px` en headers y acciones, `24px` en estados vacíos
- Color: heredado del texto contenedor. Nunca un ícono de un color diferente al texto que acompaña
- Íconos de amenities en el modal: `16px`, color `graphite`
- Ícono de WhatsApp: usar el SVG oficial de WhatsApp (no Lucide — Lucide no tiene WhatsApp)

---

## 10. Voz del UI

El texto de la interfaz es directo, sin exclamaciones ni lenguaje de marketing interno.

| Evitar | Usar |
|---|---|
| "¡Encontrá tu próximo hogar!" | "Propiedades disponibles" |
| "Completá todos los campos" | "Falta el precio" |
| "¡Mensaje enviado con éxito!" | "Mensaje enviado" |
| "Cargando propiedades..." | "Cargando..." |
| "Sin resultados para tu búsqueda" | "No hay propiedades con estos filtros" |

Los mensajes de error son específicos: dicen exactamente qué falló y cómo resolverlo.
Los textos de estado vacío son constructivos: sugieren una acción siguiente.

---

## 11. Componentes del Marketplace

Estos componentes nacen del modelo marketplace multi-ciudad. Mantienen el mismo sistema de color, tipografía y espaciado ya definido.

### CityPicker (selector de ciudad)

El visitante puede estar en una ciudad pero querer ver otra. El selector es discreto, vive en el header.

- Ubicación: header, a la izquierda del logo o junto a él
- Trigger: nombre de la ciudad activa en DM Sans 14px Medium + ícono `chevron-down` 16px, color `black`
- Al abrir: dropdown con lista de ciudades activas, búsqueda si hay más de 8
- Ciudad seleccionada en el dropdown: fondo `terracota-subtle`, texto `terracota`
- Las ciudades se ordenan alfabéticamente; la ciudad detectada por geolocalización aparece primera con un label sutil "Cerca tuyo" en DM Sans 11px `graphite`

**Estado de geolocalización:**
- Mientras se resuelve el permiso del navegador: no bloquear nada, mostrar la ciudad default
- Si el usuario concede ubicación y hay una ciudad cercana: cambiar suavemente, sin recargar
- Nunca mostrar un modal intrusivo pidiendo ubicación al entrar — la app funciona sin ella

### LocationPicker (pin manual en el formulario)

El componente más delicado del dashboard. El agente coloca la ubicación exacta arrastrando un pin. **No hay geocoding automático.**

```
┌─────────────────────────────────────────┐
│  Ubicación en el mapa                     │  ← label DM Sans 13px Medium
│  Arrastrá el pin hasta la ubicación       │  ← instructivo DM Sans 12px graphite
│  exacta del inmueble                      │
├─────────────────────────────────────────┤
│                                           │
│        [Mini-mapa Leaflet]                │  altura 280px, rounded-md
│              📍 (pin terracota)           │  pin draggable, centrado al inicio
│                                           │
├─────────────────────────────────────────┤
│  Lat: -27.7951   Lng: -64.2615           │  ← DM Sans 12px graphite, solo lectura
└─────────────────────────────────────────┘
```

- El mini-mapa se centra al inicio en el `center_lat`/`center_lng` de la ciudad de la agencia
- El pin es terracota, arrastrable, con `shadow-md`
- Las coordenadas se muestran abajo en modo solo-lectura, como confirmación visual
- El instructivo es permanente, no un tooltip que se oculta — es la pieza que evita errores de ubicación

### Estados de validación del formulario de propiedad

Cuando el agente intenta guardar sin completar la ubicación:
- El borde del mini-mapa pasa a `error`
- Mensaje bajo el componente: "Colocá el pin en el mapa" en DM Sans 12px `error`

---

## 12. Componentes de Suscripción y Plan

### PlanBadge (indicador de plan)

Visible en el sidebar del dashboard y en la cabecera del listado de propiedades.

| Plan | Background | Texto | Contenido |
|---|---|---|---|
| Free | `mist` | `graphite` | "Plan Free · 3/5 propiedades" |
| Pro | `terracota` | `paper` | "Plan Pro · Ilimitado" |

- DM Sans 12px Medium, `rounded-sm`, padding `4px 10px`
- En plan free, el contador de uso (`3/5`) usa el mismo color del texto pero en SemiBold

### Bloqueo de alta al alcanzar el límite

Cuando la agencia free llegó a su límite, el botón "Nueva propiedad" cambia de estado:

- Botón deshabilitado: fondo `stone`, texto `graphite`, cursor `not-allowed`
- Debajo del botón, un mensaje constructivo:
  > "Alcanzaste el límite de 5 propiedades del plan Free. Pasá a Pro para publicar sin límite."
  > con un link "Ver planes" en `terracota`

- **Nunca** ocultar el botón — mostrarlo deshabilitado comunica que existe la posibilidad de crecer

### Vista de suscripción (`/dashboard/suscripcion`)

Layout de dos cards lado a lado (apiladas en mobile):

```
┌──────────────────┐  ┌──────────────────┐
│  Plan Free       │  │  Plan Pro         │
│  (actual)        │  │                   │
│                  │  │  Recomendado ★    │  ← badge terracota
│  Hasta 5 props   │  │  Propiedades      │
│                  │  │  ilimitadas       │
│  Gratis          │  │  + Destacados     │
│                  │  │  + Métricas       │
│  [Plan actual]   │  │  [Pasar a Pro]    │  ← CTA terracota
└──────────────────┘  └──────────────────┘
```

- Título de cada plan: Noto Serif H3
- Precio: Noto Serif 28px Bold
- Card del plan actual: borde `terracota`, badge "Plan actual" en `terracota-subtle`
- Lista de features: DM Sans 14px, ícono `check` 16px en `success`

---

## 13. PWA — Consideraciones Visuales

La app es instalable como PWA. Esto implica algunos detalles de diseño:

- **Theme color** (barra del navegador / status bar): `paper` (`#FBF9F6`)
- **Íconos de la PWA**: usar el logo sobre fondo `paper`, en `192px` y `512px`
- **Splash screen**: fondo `paper`, logo centrado, sin texto de carga
- **Safe areas en mobile**: respetar `env(safe-area-inset-*)` para que el header y el FAB no queden bajo el notch o la barra de gestos
- El FAB "Ver en mapa" debe respetar `padding-bottom: env(safe-area-inset-bottom)`

---

## 14. Referencias de Mercado

Portales con los que este diseño compite y de los que toma referencia:

- **Idealista** (ES) — jerarquía tipográfica, filtros laterales, pins de precio
- **Immowelt** (DE) — limpieza editorial, uso del espacio blanco
- **Sotheby's International Realty** — paleta neutra cálida, tipografía serif en displays
- **Zonaprop / Mercado Libre Inmuebles** (AR) — referencia local de UX, no de diseño
