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
El pin es una cápsula con punta inferior (ancla al punto geográfico exacto), fondo sólido, en DM Sans con `tabular-nums`. La implementación es CSS sobre un `DivIcon` de Leaflet (clases `.marka-pin`, no SVG fijo), lo que permite ancho variable según el precio y transiciones reales.

> **Nota:** el esquema de color se invirtió respecto al diseño original (antes el pin normal era blanco). Se cambió para mejorar el contraste sobre el mapa OSM: el pin normal ahora es terracota y "salta" sobre el fondo del mapa. La jerarquía de estados se reordenó para no perder la señal de selección.

**Estado normal:**
```
┌──────────────┐
│  USD 250k    │  ← fondo: terracota (#A0522D), texto: paper
└──────┬───────┘  ← punta terracota, shadow-md suave
       ▼
```

**Estado hover:**
```
┌──────────────┐
│  USD 250k    │  ← fondo: terracota-hover (#8B4526), oscurecimiento sutil
└──────┬───────┘
       ▼
```
Transición real 120ms ease-out. El pin activo y los visitados NO se oscurecen en hover (la selección queda siempre inequívoca).

**Estado activo (propiedad seleccionada):**
```
┌──────────────┐
│  USD 250k    │  ← fondo: black (#111111), texto: paper, escala 1.08
└──────┬───────┘
       ▼
```
El negro distingue claramente el pin seleccionado del resto (que son terracota).

**Estado visitado (ya abrió el modal):**
```
┌──────────────┐
│  USD 250k    │  ← fondo: stone (#C8C0B7), texto y borde: graphite
└──────┬───────┘
       ▼
```
Atenuado pero claramente un pin (no parece sin estilo). Persiste en localStorage (`useVisitedProperties`). Da sensación de progreso, patrón de Idealista. Se eligió `stone` sobre `mist` porque mist es casi tan claro como paper y se funde con el mapa.

**Propiedad destacada (`is_featured: true`):**
- Mantiene el fondo terracota normal
- Badge `★` en la esquina superior **izquierda** del pin
- Anillo `paper` de 2px que la diferencia

**Propiedad favorita (`useFavorites`):**
- Indicador agregado: corazón pequeño en la esquina superior **derecha** del pin (capa encima, no cambia el fondo)
- Color del corazón con contraste según el fondo: `paper` sobre terracota/negro, `terracota` sobre el stone del visitado
- Se actualiza en vivo: marcar/desmarcar el favorito desde el modal o una card lo refleja al instante en el pin (sin recrear markers)

**Coexistencia de estados:** una propiedad puede ser favorita Y visitada Y/O destacada a la vez. El color de fondo lo determina el estado (normal/visitado/activo); los badges (★ izquierda, ♥ derecha) son capas encima que conviven sin encimarse.

| Combinación | Fondo | Badges |
|---|---|---|
| normal | terracota | — |
| visitado | stone | — |
| favorito | terracota | ♥ paper |
| visitado + favorito | stone | ♥ terracota |
| destacado + favorito | terracota | ★ izq + ♥ der |
| activo + favorito | black | ♥ paper |

**Formato de precio en el pin:**
- USD < 1.000.000 → `USD 250k`
- USD ≥ 1.000.000 → `USD 1.2M`
- ARS → `ARS 15M` (siempre en millones para que quepa)
- Usar `formatPriceCompact` de `@/lib/utils/formatPrice`

**Tipografía:** DM Sans 12px Medium con `tabular-nums`, inyectada en el `DivIcon` vía la variable `--font-dm-sans`.

### Tiles del mapa

- Tiles de **OpenStreetMap estándar** (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`). Se probaron tiles tonales (CARTO Positron/Voyager) pero se descartaron: lavaban el mapa y reducían el contraste con los pines. OSM da más vida y mejor contraste con los pines terracota.
- La configuración de tiles vive en `src/lib/map/tiles.ts` (fuente única, compartida por el mapa principal y el `LocationPicker`), con una rama opcional para `NEXT_PUBLIC_MAPTILER_KEY` (migración futura de una línea).
- Controles de zoom estilados según la paleta (`paper`/`stone`, bordes finos), no el estilo de fábrica de Leaflet.

### ClusterLayer

- Fondo: `graphite` (`#4E4A46`)
- Texto: `paper` (`#FBF9F6`), DM Sans 13px SemiBold (inyectada vía `--font-dm-sans`)
- Forma: circular con anillo exterior translúcido sutil (comunica "muchos")
- Tamaños: `40px` (2–9), `52px` (10–99), `64px` (100+)
- Diff por ids: no recrea markers si el conjunto no cambió

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
│  [LOGO]  Inmobiliaria Demo      │  ← quién publica. Nombre: Noto Serif 14px semibold, black
│          Atiende Juan Pérez     │  ← DM Sans 12px, graphite. SIN foto del agente
│  [Input: tu nombre]             │  ← aparece solo si el usuario hace click en el botón
│  [● Consultar por WhatsApp]     │  ← fondo whatsapp-green, full-width
└─────────────────────────────────┘
```

**Bloque "quién publica" (zona inferior):**

Identifica a la inmobiliaria y a la persona que va a atender la consulta. Sin él, el visitante ve fotos, precio y un botón verde, y con eso tiene que decidir si le escribe a un número desconocido.

- **Va abajo, junto al CTA, nunca arriba:** arriba competiría con el precio, que es lo primero que el ojo tiene que encontrar (§1).
- **Es UNA fila compacta (~33px), no una tarjeta.** El bottom sheet de mobile tiene alto fijo (`h-[82vh]`) y esta zona no se comprime, así que cada píxel del bloque se lo resta al área que scrollea. No engordarlo.
- **Logo:** `h-8 w-auto max-w-[96px] object-contain` — altura fija, ancho según la relación de aspecto, tolera cualquier proporción. Mismo tratamiento que el header de `AgencyMapView`, una talla más chico. Va con `alt=""`: el nombre está a 10px, en el mismo bloque, y repetirlo en el alt se lo haría decir dos veces a un lector de pantalla.
- **⚠ Sin logo, el NOMBRE OCUPA EL LUGAR DEL LOGO** (el texto se corre solo a la izquierda). Sin hueco, sin caja vacía, sin cartel de "sin logo" — a diferencia de la preview de `AgencyLogoForm`, que sí lo dice porque ahí estás por subir un archivo. **Es el caso NORMAL: nueve de cada diez agencias no tienen logo**, así que un diseño que solo se vea bien con logo se va a ver mal casi siempre.
- **El nombre de la agencia NO es un enlace.** Solo algunos planes tienen sitio propio y ese sitio se deshabilita por varios motivos, así que a veces llevaría a "no disponible": un nombre que a veces lleva a algún lado y a veces no es una inconsistencia visible.
- **SIN foto del agente**, aunque la consulta ya traiga su avatar. Solo el nombre.
- **Se muestra en LAS DOS vistas públicas**, también en el sitio de marca de la agencia. Ahí el encabezado ya es esa agencia, pero quien abre un enlace compartido cae directo en el modal y puede no ver el encabezado — y la propiedad se ve igual sin importar por dónde se entró.
- **⚠ Es HERMANO del condicional que elige el botón, no hijo de una de sus ramas.** Hay dos ramas (el agente tiene teléfono / no lo cargó) y el bloque va en las dos: la agencia cuyo agente no dejó número es justamente de la que el visitante más necesita saber quién es.

**Comportamiento del CTA de WhatsApp:**
1. Botón visible desde el inicio con texto "Consultar por WhatsApp"
2. Al hacer click → el input de nombre aparece con animación (no estaba visible antes)
3. Usuario escribe nombre → botón cambia a "Enviar mensaje"
4. Al confirmar → se abre WhatsApp en nueva pestaña y se registra el lead

**Tratamiento visual (refinado en el repaso editorial):**
- Fondo del drawer/sheet en `paper`, nunca blanco puro. Los inputs internos sí van en white (legibilidad).
- Fotos full-bleed con ratio consistente, gradiente inferior sutil para legibilidad, y crossfade entre fotos (no corte seco), 180–200ms.
- Flechas de navegación finas (`paper`/85 + backdrop-blur, chevron graphite), se ocultan en los extremos. Dot indicators finos y discretos.
- Botones flotantes en `paper`/85 con backdrop-blur e ícono graphite — no círculos `bg-black/50`. Son **tres**: cerrar arriba a la izquierda, y **compartir + favorito apareados arriba a la derecha** (`gap-2`). El corazón favorito en terracota relleno (coherente con el mapa); el de compartir vira a `success` con un ✓ mientras confirma que copió.
  > ⚠ **El de compartir va SOBRE LA FOTO, no en la zona inferior, y es una restricción de espacio, no un gusto.** Esa zona es `shrink-0` dentro de un sheet de alto fijo (`h-[82vh]`), así que todo lo que se le agrega se lo resta al área que scrollea — que después del bloque "quién publica" quedó en ~177 px en un teléfono chico. Otra fila de 44 px la dejaría en menos de dos párrafos. Los botones flotantes son `absolute` sobre el carrusel: no cuestan un solo píxel de alto.
- Chips de amenities con ícono lucide 16px graphite a la izquierda (mapeo amenity→ícono: pileta→Waves, gym→Dumbbell, seguridad_24h→ShieldCheck, etc.).
- Estado de carga: skeleton que imita el layout (no "Cargando..." en texto).
- Apertura del modal: 220ms ease-out (DESIGN §8).

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

### Los dos carteles: `ErrorBanner` y `Notice`

Viven juntos en `src/components/feedback/` y **no son intercambiables**. Elegir mal el componente es elegir mal el mensaje.

| | `ErrorBanner` | `Notice` |
|---|---|---|
| Qué comunica | **algo que la persona intentó, falló** | un **estado de la cuenta que dura** |
| ¿Se cierra? | **Sí**, con una ✕ a la derecha | **No**: se va cuando el estado cambia |
| Cuándo aparece | después de una acción | ya está cuando entrás a la pantalla |
| Render | Client Component (`"use client"`) | **Server Component** |
| Tratamiento | `bg-terracota-subtle`, borde `terracota/20`, `rounded-md`, `px-4 py-3`; texto `text-error` | tres tonos (§2): `info` sobre `mist` · `warning` terracota suave · `error` |

```
┌──────────────────────────────────────────────────────┐
│  No se pudo eliminar la propiedad. Intentá de nuevo. ✕│   ErrorBanner
└──────────────────────────────────────────────────────┘
```

- **⚠ EL MARGEN VIENE DE AFUERA, y es una restricción medida, no un gusto de API.** De las cuatro pantallas que lo usan, **dos** lo tienen suelto dentro de un fragmento y necesitan `mb-4` (`PropertiesTable`, `AgenciesTable`), y **dos** viven en un contenedor con `space-y-6` que ya separa a sus hijos (`SubscriptionContent`, `TeamContent`). Un margen fijo adentro del componente **rompe dos pantallas en una dirección o las otras dos en la contraria**: o quedan pegadas o con el doble de aire. Cada llamador pasa el suyo por `className`.
- **Se renderiza `null` si no hay mensaje**, así que el llamador no escribe su propio `{error && (…)}` — que era la línea que se olvidaba al agregar la quinta pantalla.
- **Historia:** estaba escrito a mano en las cuatro, y las copias **ya habían divergido** (dos con `mb-4` y dos sin). Mismo patrón que el proyecto ya se cobró con `AgenciesTable` y `AgentCell`.

⚠ **Los errores de FORMULARIO son otra familia y no usan esto:** un `<p className="font-sans text-sm text-error">` pelado, debajo del campo o del botón, sin caja y sin cierre (`ProfileForm`, `AgencyLogoForm`, `AgencyPhoneForm`, `AgencyIdentityForm`, el alta de `TeamContent`). Van con su campo, no como cartel de pantalla.

### Aviso de que la agencia no se está viendo en el mapa

En la pantalla principal del panel, en el hueco de ancho completo entre el título y las tarjetas. **Es lo primero que ve la inmobiliaria al entrar**, y por eso está ahí y no en otro lado.

**⚠ EL TÍTULO DICE LA CONSECUENCIA, NUNCA EL ESTADO ADMINISTRATIVO.** Quien lo lee es un corredor: le importa que sus propiedades no se están viendo, no que una columna diga `canceled`. El motivo va en el cuerpo.

| Motivo | Componente | Tono | Título |
|---|---|---|---|
| Sin aprobar / rechazada | `AgencyApprovalNotice` | `info` / `error` | "Tu cuenta está en revisión" / "Tu solicitud no fue aprobada" |
| Suscripción de baja o vencida | `AgencyVisibilityNotice` | **`warning`** | "Tus propiedades no se están mostrando en el mapa" |
| Plan todavía sin activar | `AgencyVisibilityNotice` | **`info`** | "Tus propiedades todavía no se ven en el mapa" |

- **⚠ `warning` y no `error` para la suscripción**, por el precedente de `/dashboard/suscripcion`: puede ser una baja acordada, una prueba que terminó o un pago pendiente. **El sistema no sabe cuál, así que no acusa a nadie.** Y dice explícitamente **que no se perdió nada** — el miedo real frente a "no se ven tus propiedades" es haber perdido el trabajo de cargarlas.
- **⚠ `info` y no `warning` para el plan sin activar, y esto no es negociable.** Es el **estado normal de una cuenta recién creada** (el plan lo activa a mano el dueño de la plataforma): no falló nada y nadie hizo nada mal. Un tono de alarma frenaría justo a la agencia que queremos que cargue su cartera. El cuerpo **invita a seguir** antes que cualquier otra cosa.
- **⚠ UN SOLO CARTEL, SIEMPRE.** No son condiciones independientes: es un único motivo resuelto en el servidor, y la pantalla elige cuál de los dos componentes lo cuenta. Una agencia sin aprobar **y** dada de baja ve **uno**: el de aprobación, que es la primera condición.
- **No se repite en la disposición compartida** (quedaría dentro del contenedor que scrollea y se iría de pantalla, y repetido en las siete pantallas se vuelve ruido) **ni en `/dashboard/suscripcion`**, que ya tiene su propio aviso más largo y con el correo de contacto.

### Página pública de la propiedad (`/propiedades/[slug]`)

La misma propiedad que el modal, pero como **página propia con dirección propia**: indexable por buscadores y compartible por WhatsApp. No es "el modal en grande" — es una lectura larga en una columna, sin nada fijo y sin nada recortado.

**⚠ Todo lo que se ve está en el HTML, renderizado en el servidor.** Es la restricción que gobierna cada decisión de abajo: si algo se arma en el navegador, un buscador ve un hueco. Solo dos piezas bajan como isla de cliente, y solo porque necesitan estado: el flujo de contacto y el botón de compartir.

```
┌──────────────────────────────────────────────┐
│  Marka.                    ← Volver al mapa  │  header sticky, 56px, borde stone
├──────────────────────────────────────────────┤
│  [ foto ][ foto ][ foto ] →                  │  galería scroll-snap, aspect-[4/3], máx 420px
│  8 fotos · deslizá para ver todas            │  DM Sans 12px graphite
│                                              │
│  CASA · VENTA · ALQUILER          ★ Destacada│  DM Sans 11px uppercase tracking-wider
│  Casa 3 ambientes en el centro               │  Noto Serif 30/36px bold  ← <h1>
│  USD 250.000                                 │  Noto Serif 40px bold terracota
│  ARS 450.000            (etiqueta por op.)   │
│  📍 Mitre 291, Centro — Santiago del Estero  │  DM Sans 15px graphite
│  🛏 3 ambientes  🚿 2 baños  📐 120 m²        │  DM Sans 14px
│  ────────────────────────────────────────    │  divider stone
│  Descripción COMPLETA, sin "ver más"         │  DM Sans 15px, whitespace-pre-line
│  ────────────────────────────────────────    │
│  COMODIDADES  ·  chips con ícono             │
│  REQUISITOS PARA ALQUILAR · chips sin ícono  │  solo si hay alquiler y hay requisitos
│ ┌──────────────────────────────────────────┐ │
│ │ [LOGO] Inmobiliaria Demo                 │ │  bloque de acción sobre `mist`
│ │        Atiende Juan Pérez                │ │
│ │ [● Consultar por WhatsApp            ]   │ │
│ │ [⤴ Compartir                         ]   │ │
│ └──────────────────────────────────────────┘ │
│  DÓNDE QUEDA                                 │
│  [ mapa estático 200px + pin + atribución ]  │
│  [ Ver todas las propiedades en el mapa ]    │  botón secundario
└──────────────────────────────────────────────┘
```

- **Columna `max-w-2xl` centrada** sobre `paper`. Una sola columna en todos los tamaños: el contenido es una ficha, no un tablero.
- **El precio es lo primero que el ojo encuentra después de las fotos**, y acá tiene toda la columna para lograrlo: **40 px** contra los 32 del modal, donde compite con un CTA a 200 px. El kicker y el título lo preceden en el orden de lectura pero no en peso visual (11 px uppercase y serif 30 px contra 40 px bold terracota).
- **Galería sin JavaScript:** `scroll-snap` horizontal, una foto por pantalla, `aspect-[4/3]` para reservar el espacio antes de que carguen (sin salto de layout). ⚠ **No es el carrusel del modal**: aquel guarda la foto activa en un `useState` y apila el resto con `opacity-0`, así que para un buscador **existe una sola foto**. Acá están las N en el documento, con su `alt`. El precio de no tener estado es que no hay flechas ni puntitos; a cambio hay gesto táctil nativo y el conteo en texto ("8 fotos · deslizá para ver todas"), que además lo lee un lector de pantalla.
- **⚠ La descripción va COMPLETA, sin `line-clamp` y sin "Ver más".** En el modal se recorta; acá el texto entero tiene que estar en el documento, porque es justamente lo que un buscador lee. `whitespace-pre-line` respeta los saltos que escribió el agente.
- **Quién publica + contacto + compartir van juntos en un bloque sobre `mist`.** Es lo único que rompe el ritmo de la columna, a propósito: en una página larga la zona de acción tiene que encontrarse de un vistazo. (En el modal no hacía falta: estaba siempre a la vista, fija abajo.) Mismo tratamiento del logo que el modal —altura fija, `object-contain`, y sin logo el nombre ocupa su lugar—, una talla más grande (`h-10`).
- **El botón de compartir es secundario** (borde `stone`), nunca terracota: el CTA de la página es el verde de WhatsApp, y dos botones compitiendo confunden cuál es el paso final. Al copiar vira a `success` con un ✓ durante 2 s.
- **Estado "no disponible"** (`PropertyUnavailable`): la propiedad existe pero no se puede mostrar. Clon de `AgencyUnavailable` —mismo esqueleto centrado, wordmark, `h1` serif 3xl, párrafo `graphite`, botón terracota "Ir al mapa"—, con otro texto. ⚠ **Nunca un 404**: quien llega casi siempre recibió el enlace de alguien, y un error de página inexistente le diría que el enlace estaba roto.

### Mapa estático de la ficha

El mapa del pie **no es Leaflet**. Es una grilla de 4×2 tiles de OpenStreetMap en `<img>`, corrida con CSS para que el punto quede centrado, con el pin terracota encima y la atribución abajo a la derecha. Cero JavaScript, cero librería, y está en el HTML.

- Recuadro de **200 px** de alto, `rounded-md`, borde `stone`, ancho completo de la columna. Zoom 15 (escala de barrio, ~850 m de ancho visible).
- El pin es el mismo dibujo del `LocationPicker` (28×36, terracota con centro `paper`), anclado por la **punta** con `-translate-y-full`.
- Las tiles van con `loading="lazy"`: el mapa vive al pie, y así el primer pintado no arrastra ocho pedidos de red.
- ⚠ **No se reusó el `LocationPicker`** (el otro mapa chico del proyecto): se monta con `ssr: false`, o sea que un buscador ve un recuadro vacío y la página arrastra Leaflet entero para algo con lo que el 99 % de las visitas no va a interactuar.
- Usa `TILE_CONFIG`, la fuente única de config de tiles: el día que el proyecto migre a MapTiler, este mapa migra con el grande.

### FilterPanel

- Background: `paper`
- Border derecho: `stone` (1px)
- Separadores internos entre secciones: `stone` (1px)
- Título de cada sección: DM Sans 11px SemiBold uppercase, `graphite`, `tracking-wider`
- Valores seleccionados: DM Sans 14px, `black`
- Aire vertical entre secciones: `space-y-6 md:space-y-8`
- Checkboxes (amenities, "Solo destacadas"): componente `Checkbox` de shadcn estilizado (terracota al marcar), no checkboxes nativos
- Precio y superficie: inputs de rango con separador `–` (Desde – Hasta), commit on-blur (sin botones "Aplicar"). El filtro se aplica al perder foco o con Enter
- Se evaluó un slider de precio pero se descartó: sin un máximo de dominio fijo (el precio varía 1000× entre USD/ARS y entre alquiler/venta), los inputs numéricos son más precisos

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
- Stats cards: número en Noto Serif 36px Bold con `tabular-nums`, label en DM Sans 13px, `graphite`
- Layout y scroll: el dashboard usa `flex h-dvh overflow-hidden` en el wrapper (⚠ `h-dvh`, NO `h-screen`: ver la regla de viewport mobile en CLAUDE.md; este texto decía `h-screen` y el código dice `h-dvh` desde hace tiempo), con el `Sidebar` y el `main` (`flex-1 overflow-y-auto`) como hijos. El `main` es el contenedor scrolleable y **debe** llevar `relative` (load-bearing, no decorativo): así es el containing block de los descendientes `position: absolute` de los formularios (inputs ocultos internos de Radix/shadcn, p. ej. el `Checkbox`). Sin `relative`, esos absolutos se anclan al viewport (ICB) y en páginas altas (nueva/editar propiedad) aterrizan muy abajo, generando un segundo scroll fantasma en el documento por debajo del form. No quitar el `relative` del `main`.

**StatsCard (refinado):**
- Números con `tabular-nums` y count-up sutil al montar (ease-out ~600ms, respeta `prefers-reduced-motion`)
- Jerarquía entre las 4 cards: la métrica más relevante (propiedades disponibles del plan) lleva acento terracota (borde + fondo terracota-subtle + número e ícono terracota); las demás neutras
- Ícono superior derecho en `graphite`/55 (más presencia que el `stone` original sin competir con el número)

**Sidebar (refinado):**
- Wordmark de Marka arriba (variant light)
- Avatar del agente (`avatar_url` o placeholder con su inicial sobre `bg-white/10`)
- Hover de items con fondo sutil (`hover:bg-white/5`)
- El footer del sidebar tiene dos salidas apareadas: "Ver el mapa" (→ `/`, ícono `Map`) encima de "Cerrar sesión", ambas con ícono 18px y tratamiento `stone`→`paper` en hover. "Ver el mapa" no es navegación interna del dashboard (no va en `NAV_ITEMS`, donde la lógica de item activo usa `pathname.startsWith(href)` y `href="/"` haría match en cualquier ruta): es una salida al sitio público, igual que el logout. Abre en la misma pestaña.

**PropertiesTable (refinado):**
- Thumbnails 64×48 (ratio 4:3), `rounded-md`
- StatusBadge "Activa" en verde sutil (`bg-success/10 text-success`), no terracota — para no competir con los CTAs
- Skeleton de tabla mientras carga (`loading.tsx` en la ruta)

**PlanBadge (refinado):**
- Todos los planes muestran micro-barra de uso: `PLAN INICIAL · 8/20 · [▰▰▱▱▱]` con fill terracota proporcional (los 4 planes tienen límite finito)

**SubscriptionContent (refinado):**
- Confirmación del pedido de upgrade con el `AlertDialog` de shadcn (no overlay casero). ⚠ Corregido: acá decía que había un modal "Próximamente" con el `Dialog` de shadcn — eso ya no existe. El CTA registra el pedido de verdad (`pending_plan`), y `components/ui/dialog.tsx` hoy no lo importa nadie
- Cards de los 4 planes en `flex flex-wrap justify-center` con ancho fijo (~300px) que respiran y se centran: la card del plan actual + las de upgrade (planes superiores). La primera de upgrade lleva badge "Recomendado ★" (fondo terracota-subtle + borde 2px terracota + shadow-lg). Con 4 cards wrapean 3+1; con 2 quedan centradas. `items-stretch` iguala alturas por fila

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

### Encabezado público (home del mapa) — tres slots en 56 px

El único chrome que existe en la home: el mapa ocupa todo lo que queda (`h-dvh` + lock de scroll), así que **no hay ningún lugar "abajo" donde poner nada** y estos 56 px son todo el presupuesto. Tres slots en `justify-between`, con `gap-3`:

```
≥ sm (640px)
┌──────────────────────────────────────────────────────────────────────┐
│ Marka.      Santiago del Estero ⌄   [Sumá tu inmobiliaria]  Iniciar s.│  h-14
└──────────────────────────────────────────────────────────────────────┘
  shrink-0    min-w-0 + truncate       shrink-0 (componente compartido)

< sm — el llamado se cae, el ingreso queda
┌────────────────────────────────────────────┐
│ Marka.    Santiago del Estero ⌄  Iniciar s.│  h-14
└────────────────────────────────────────────┘
```

**Los dos enlaces de la derecha, y su jerarquía.** El principal lleva al registro y el secundario al ingreso, para quien ya es cliente:

| | Tratamiento | Por qué |
|---|---|---|
| **"Sumá tu inmobiliaria"** → `/register` | Botón **secundario** de §6: `h-9`, `border-stone`, texto `black`, hover `bg-mist` + `border-graphite` | Ver el ⚠ de color, abajo |
| **"Iniciar sesión"** → `/login` | **Ghost** de §6: texto `graphite` → `black` en hover | Es una vuelta, no un llamado |

La jerarquía entre los dos **no la da el color: la da la caja**. Uno tiene borde y padding, el otro es texto pelado. Alcanza y sobra para que se lea cuál es cuál.

> ⚠ **EL LLAMADO NO ES TERRACOTA, Y ES DELIBERADO.** En esta pantalla el terracota ya está tomado por el FAB "Ver lista / Ver mapa" (§16), que es la acción principal **del visitante** — y el visitante es el 99 % del tráfico. Dos elementos terracota compitiendo confunden cuál es el paso siguiente. Es el mismo criterio, con las mismas palabras, que §11 ya aplica a los dos botones del `LocationPicker` (*"el terracota está reservado para el CTA de publicar"*). El llamado a sumar una inmobiliaria es una **puerta lateral**, no el paso siguiente de quien está mirando el mapa.

**⚠ Las guardas de ancho son funcionales, no prolijidad.** El slot del medio es el **único que cede**: la marca y el bloque de la derecha van con `shrink-0`, y el `CityPicker` con `min-w-0` afuera y `truncate` adentro. Sin eso el nombre de la ciudad empuja al resto fuera del encabezado, y lo que sobra **lo recorta en silencio** el `overflow-hidden` del contenedor raíz: no aparece barra de scroll ni error. Es el mismo tratamiento que el encabezado del sitio de marca (`AgencyMapView`) ya tenía y a éste le faltaba entero.

**⚠ Por debajo de `sm` (640 px) el que NO se muestra es el LLAMADO** (`hidden sm:inline-flex` sobre el enlace a `/register`). **El ingreso se ve siempre, en todos los tamaños.** Los cuatro elementos no entran en un teléfono, así que hay que sacar uno, y **el criterio es de producto, no de layout**: el ingreso es la función que un cliente usa **todos los días**, y el celular es el dispositivo donde más se navega, así que esconderlo ahí le agrega un paso a quien ya paga para ganar una conversión eventual de quien todavía no.

Anchos medidos contra las fuentes que sirve el build (DM Sans 500 a 14 px, Noto Serif 700 a 24 px), en un teléfono de 375 px con `px-4` → **343 px útiles**:

| | Ancho |
|---|---|
| Marca "Marka." | 85,1 px |
| Selector con "Santiago del Estero" (texto 126,7 + gap 6 + chevron 16) | 148,7 px |
| Puerta al panel en `< sm` — `máx("Iniciar sesión" 86,1 · "Ir al panel" 63,4)` | 86,1 px |
| Dos `gap-3` | 24 px |
| **Queda para el selector** | **147,8 px** contra 148,7 que necesita |

O sea que a 375 px **falta menos de un píxel** y el nombre se corta por un pelo; **desde 376 px entra completo**, que cubre todos los teléfonos actuales (390, 393, 412, 430…). Con el reparto anterior —cuando el que quedaba en pantalla chica era el llamado— ese umbral estaba en **451 px**, o sea que ningún teléfono mostraba el nombre entero.

> ⚠ **Consecuencia asumida, y hay que tenerla presente: en un teléfono la captación no se ve en NINGÚN lado.** No es que se mueva a otro lugar: no está. La alternativa evaluada y **no implementada** es ponerla al pie de la lista de propiedades, que es la única superficie pública del celular que scrollea (el mapa es `h-dvh` con el scroll del documento bloqueado, así que no hay ningún "abajo" donde colgar nada). Queda anotado para el cierre del grupo, no resuelto acá.

**⚠ El bloque de la derecha no cambia de ancho al resolverse la sesión.** El texto depende de si hay sesión, y eso se sabe después del primer pintado. Los **dos** estados se renderizan siempre, apilados en la misma celda de una grilla de 1×1: el ancho es el del más ancho de los dos, estable desde el primer pintado, y cambiar de estado solo alterna cuál se ve. Se usa `invisible` (`visibility: hidden`) y **no** `hidden` (`display: none`), porque el que no se ve tiene que seguir ocupando su celda para que la grilla mida el máximo — y de paso `visibility: hidden` lo saca del orden de tabulación y del árbol de accesibilidad. Sin esto, un agente logueado vería el encabezado **moverse en cada carga**: medido, **195,2 px en `sm`+** (de 258,6 a 63,4) y **22,7 px por debajo** (de 86,1 a 63,4). El mecanismo tiene que sobrevivir a cualquier cambio en qué enlace se oculta por tamaño: lo que se apaga por breakpoint es un **enlace de adentro** de una rama, nunca una rama entera — sacar una rama del documento devolvería el ancho a depender de la sesión.

**⚠ El estado de carga usa el encabezado REAL**, con un solo placeholder: el del selector de ciudad, que es lo único que efectivamente está esperando al `cityStore`. Ni la marca ni la puerta al panel dependen de la ciudad. Antes los tres slots eran bloques grises con anchos escritos a mano y el de la derecha medía 64 px, dimensionado para la palabra "Ingresar": **un ancho fijo que imita a otro componente es una copia que hay que mantener sincronizada, y no se mantuvo.**

**Dónde NO va este llamado, y por qué:**

- **Sitio de marca de una agencia (`/[slug]`)** — el encabezado conserva "Ingresar" tal cual. El motivo es **comercial y firme**: ese sitio es literalmente lo que la agencia compra con su plan (`has_white_label`), y el marketplace es **por ciudad**, así que invitar ahí a sumar inmobiliarias sería usar el espacio que paga un cliente para captar a su competencia directa, de su misma ciudad. Le daría un argumento fácil para no renovar.
- **Página pública de la propiedad (`/propiedades/[slug]`)** — no lleva ninguna entrada al área privada. Quien llega desde un buscador está buscando una casa, no una plataforma para publicar; y esa página existe para **renderizarse entera en el servidor**, así que un llamado que dependa de la sesión obligaría a estrenar una isla de cliente contra su razón de ser.

Las dos exclusiones se expresan como la variante `agency` (o la ausencia) del componente compartido, no copiando el encabezado.

### CityPicker (selector de ciudad)

El visitante puede estar en una ciudad pero querer ver otra. El selector es discreto, vive en el header.

- Ubicación: header, a la izquierda del logo o junto a él
- Trigger: nombre de la ciudad activa en DM Sans 14px Medium + ícono `chevron-down` 16px, color `black`
- ⚠ **Es el slot elástico del encabezado y el único que cede** (`min-w-0` afuera, `truncate` en el nombre, `shrink-0` en el chevron). El nombre va envuelto en su propio `<span>` y no suelto: un nodo de texto dentro de un flex es un item anónimo, al que no se le pueden aplicar clases, así que nada impedía que un nombre largo **se partiera en dos líneas dentro de un encabezado de alto fijo**. Un nombre que no entra se corta con puntos suspensivos — mismo tratamiento que el nombre de la agencia en el encabezado del sitio de marca. No es hipotético: la única ciudad activa es "Santiago del Estero", diecinueve caracteres, o sea el caso máximo y no uno benigno
- Al abrir: dropdown con lista de ciudades activas, búsqueda si hay más de 8
- Ciudad seleccionada en el dropdown: fondo `terracota-subtle`, texto `terracota`
- Las ciudades se ordenan alfabéticamente; la ciudad detectada por geolocalización aparece primera con un label sutil "Cerca tuyo" en DM Sans 11px `graphite`

**Estado de geolocalización:**
- Mientras se resuelve el permiso del navegador: no bloquear nada, mostrar la ciudad default
- Si el usuario concede ubicación y hay una ciudad cercana: cambiar suavemente, sin recargar
- Nunca mostrar un modal intrusivo pidiendo ubicación al entrar — la app funciona sin ella

### LocationPicker (pin manual en el formulario) + sugerencia desde la dirección

El componente más delicado del dashboard. El agente coloca la ubicación exacta arrastrando un pin. **No hay geocoding automático** — nada busca solo, ni al tipear, ni al montar, ni al guardar. Lo que sí hay es un **atajo opcional**: un botón que, a pedido explícito, propone un punto de partida. **La coordenada que se guarda es siempre la que el agente confirmó**; el pin manual sigue siendo la fuente de verdad. (El porqué de cada pieza —incluida la política de uso del servicio que prohíbe el autocompletado— está en `CLAUDE.md` → "Ubicación de la propiedad".)

```
┌─────────────────────────────────────────┐
│  [🔍 Buscar esta dirección en el mapa]   │  ← botón SECUNDARIO (borde stone), h-40px
│  Movimos el pin a esta dirección…        │  ← resultado, DM Sans 12px graphite / error
├─────────────────────────────────────────┤
│  Arrastrá el pin hasta la ubicación      │  ← instructivo DM Sans 12px graphite
│  exacta del inmueble, o buscá la          │
│  dirección más arriba y ajustalo desde ahí│
├─────────────────────────────────────────┤
│                          [◎ Centrar]     │  ← overlay top-right, paper + borde stone
│        [Mini-mapa Leaflet]                │  altura 280px, rounded-md
│              📍 (pin terracota)           │  pin draggable
│                                           │
├─────────────────────────────────────────┤
│  Lat: -27.7951   Lng: -64.2615           │  ← DM Sans 12px graphite, solo lectura
├─────────────────────────────────────────┤
│  [✓ Confirmar esta ubicación]            │  ← secundario; pasa a "✓ Ubicación
│                                           │     confirmada" en `success` al confirmar
└─────────────────────────────────────────┘
```

- El mini-mapa **abre centrado donde está el pin**: en el alta eso es el centro de la ciudad de la agencia; en la edición, la propiedad. (Antes abría siempre en el centro de la ciudad, y al editar una propiedad alejada el pin podía quedar fuera del recuadro de 280 px.)
- El pin es terracota, arrastrable, con sombra propia (`drop-shadow` sobre `.marka-loc-pin__inner`) y un **pulse de 450 ms** al reubicarse — micro-feedback de que algo pasó
- Las coordenadas se muestran abajo en modo solo-lectura, como confirmación visual
- El instructivo es permanente, no un tooltip que se oculta — es la pieza que evita errores de ubicación
- **Ambos botones son secundarios (borde `stone`, fondo transparente), nunca terracota**: el terracota está reservado para el CTA de publicar, y dos botones terracota compitiendo confunden cuál es el paso final

**Voz de los mensajes de la búsqueda** (`GEOCODE_STATUS_MESSAGES` en `lib/utils/labels.ts`, uno por desenlace): ninguno de los cuatro es culpa de la persona, así que ninguno la reta ni le pide "reintentar". Los tres que no encuentran nada terminan diciendo lo mismo —*el camino manual sigue ahí*—, porque esa es la información que necesita para seguir trabajando: la búsqueda es un atajo, y que falte un atajo no bloquea nada. El mensaje se esconde solo en cuanto el agente corrige la dirección (sin efectos y sin disparar ninguna búsqueda).

### Estados de validación del formulario de propiedad

Cuando el agente intenta guardar sin **confirmar** la ubicación:
- El borde del mini-mapa pasa a `error`
- Mensaje bajo el componente, en DM Sans 12px `error`: "Confirmá la ubicación antes de guardar: arrastrá el pin hasta el punto exacto, o buscá la dirección y confirmá la sugerencia."

La regla que habilita guardar es **"la ubicación actual está confirmada"**, no "el pin se movió alguna vez": arrastrar confirma, "Centrar" desconfirma, una sugerencia desconfirma. Al editar, la ubicación nace confirmada (ya era real), pero se desconfirma si la coordenada cambia. El detalle y el bug que cierra están en `CLAUDE.md`.

---

## 12. Componentes de Suscripción y Plan

### PlanBadge (indicador de plan)

Visible en el sidebar del dashboard y en la cabecera del listado de propiedades.

| Plan | Background | Texto | Contenido |
|---|---|---|---|
| Todos | `mist` | `graphite` | "Plan {Nombre} · {usadas}/{límite}" + micro-barra |

- DM Sans 12px Medium, `rounded-sm`, padding `4px 10px`
- Todos los planes tienen límite finito (free=1, inicial=20, profesional=60, premium=200): el badge muestra siempre el contador `usadas/límite` en SemiBold + micro-barra de proporción con fill terracota. Ya no existe "Ilimitado"

### Bloqueo de alta — TRES motivos, tres mensajes distintos

El botón "Nueva propiedad" se deshabilita por **tres** motivos, y cada uno tiene su propio mensaje. **Confundirlos es mentirle a la persona y mandarla a resolver algo que no la destraba** (el criterio vive en `getPublishBlock`; ver `CLAUDE.md` → "Bloqueo de publicación").

- Botón deshabilitado: fondo `stone`, texto `graphite`, cursor `not-allowed`
- Debajo del botón, el mensaje del motivo (DM Sans 12px `graphite`, link en `terracota`):
  > **Agencia no aprobada** — no se menciona ningún plan, porque el bloqueo no se resuelve con plata: "Vas a poder publicar cuando aprobemos tu inmobiliaria. Mientras tanto podés completar tus datos." (o, si fue rechazada, cómo corregir y reenviar).
  > **Suscripción dada de baja o vencida** — tampoco se invita a pagar MÁS: lo que la destraba es reactivar lo que ya tenía. "Tu suscripción está dada de baja, así que no podés publicar." + link "Ver mi suscripción" (a `/dashboard/suscripcion`, donde el aviso explica el estado completo), **nunca** a la lista de planes.
  > **Cupo del plan lleno** — acá sí se invita al upgrade. Si hay plan superior: "Alcanzaste el límite de tu plan {Actual}. Pasá a {Siguiente} para publicar más." + link "Ver planes". Si es premium (tope): "Alcanzaste el máximo de propiedades. Escribinos si necesitás más." + link "Escribinos" (mailto).

- **Nunca** ocultar el botón — mostrarlo deshabilitado comunica que existe la posibilidad de crecer
- ⚠ **El despacho por motivo es un `switch` exhaustivo con guarda `never`, no un ternario.** Cuando era un ternario binario, el motivo de suscripción cayó en el `else` y una agencia dada de baja leía *"alcanzaste el límite de tu plan Gratis, pasá a Inicial"*. Un motivo nuevo sin mensaje ahora **no compila**.

### Aviso de suscripción que no rige (`/dashboard/suscripcion`)

Cuando la suscripción está `canceled` o `past_due`, la pantalla abre con un `Notice` en tono **`warning`, no `error`**: puede ser una baja acordada, una prueba que terminó o un pago pendiente — el sistema no sabe cuál, así que **no acusa a nadie**. Dice tres cosas, en ese orden: qué pasa (las propiedades no se ven, el sitio propio está apagado, no se puede publicar), **qué NO se perdió** ("tus datos están intactos"), y cómo se resuelve (un mailto). Mientras el aviso está, **no se muestra la fecha de vencimiento** ("plan activo hasta el X" de un plan dado de baja es una contradicción) y **no se ofrece ningún upgrade**.

### Vista de suscripción (`/dashboard/suscripcion`)

Barra de uso del plan actual + cards de planes en `flex flex-wrap justify-center` (ancho fijo ~300px, no un grid rígido): la card del plan actual seguida de las cards de upgrade (planes superiores). Apiladas/centradas en mobile.

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Plan {Actual}   │  │  Plan {Siguiente} │  │  Plan {…}         │
│  Plan actual     │  │  Recomendado ★    │  │                   │  ← badge terracota en el 1er upgrade
│  {precio}        │  │  {precio}         │  │  {precio}         │
│  + features…     │  │  + features…      │  │  + features…      │
│  [Plan actual]   │  │  [Pasar a {plan}] │  │  [Pasar a {plan}] │  ← CTA terracota
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

- Las cards mantienen el mismo ancho siempre; con 4 wrapean 3+1, con 2 se centran. `items-stretch` iguala alturas por fila
- Título de cada plan: Noto Serif H2/H3 · Precio: Noto Serif Bold (placeholder editable desde `PLANS` en types)
- Card del plan actual: borde `terracota`, badge "Plan actual" en `terracota-subtle`
- Primer upgrade: badge "Recomendado ★" en `terracota`, fondo `terracota-subtle`, borde 2px, shadow-lg
- Lista de features derivada de `PLANS`: límite + destacados/white-label/métricas según el plan. DM Sans 14px, ícono `check` 16px en `success`
- El CTA "Pasar a {plan}" abre un `AlertDialog` de confirmación y registra el pedido (`pending_plan` + `status: 'pending'`), sin tocar el plan que rige. La activación la hace el dueño desde `/admin`. La card del plan pedido pasa a "Pendiente" y los demás upgrades quedan deshabilitados mientras haya un pedido abierto
- Con la suscripción `canceled`/`past_due` **no se renderiza ninguna card de upgrade** ni la fecha de vencimiento: ver "Aviso de suscripción que no rige"

### Panel de plataforma (`/admin`) — acciones por fila

La fila de una agencia puede tener hasta **nueve** acciones aplicables (tres del eje de aprobación, seis del comercial). Nueve botones apilados son ~250px de alto de fila: ilegible, y contra §1 ("jerarquía antes que decoración").

- **El corte no es por cantidad sino por NATURALEZA.** Quedan como botones las acciones que **hacen avanzar el flujo** —aprobar, rechazar, activar plan: la bandeja de entrada diaria del dueño—; se van al menú `⋯` las de **deshacer** y las **destructivas**, que son excepcionales y conviene que cuesten un click más. Precedente: `PropertiesTable` usa el mismo menú para lo mismo. Peor caso visible: 3 botones + el disparador del menú
- **Variantes de `RowButton`** (§6): `primary` terracota para la acción principal, `secondary` borde `stone`, `destructive` borde y texto en `error`
- **Las condiciones de qué acción aplica viven en UN solo lugar** (`availableActions`), reusado por la tabla desktop y por las cards mobile. Antes estaban escritas dos veces y se desincronizaron: la copia de mobile solo miraba el eje de aprobación, así que una agencia aprobada con plan activo —justo el caso de "dar de baja"— **no mostraba ningún botón en el celular**
- **Dos badges con tratamiento visual DISTINTO a propósito** (aprobación y suscripción): son dos ejes independientes y no deben leerse como lo mismo. Los filtros también van en dos grupos separados
- ⚠ **Los formularios van en PANELES INLINE, no en `AlertDialog`, y es una restricción técnica**: el botón de acción del diálogo **cierra al hacer click**, así que un error de validación (fecha pasada, nombre que no coincide, plan al que no entran las propiedades) no tendría dónde mostrarse. Los cuatro que piden escribir o elegir algo —rechazo, activación, cambio de plan y eliminación— son paneles inline sobre `paper` con borde `stone` y `rounded-lg`; los sí/no puros (dar de baja, reactivar) sí van en `AlertDialog`
- **El panel de cambio de plan ES la confirmación**: no se apila un diálogo encima. Arriba del botón final —que nombra el plan destino— se listan las consecuencias concretas (límite nuevo, funciones que gana y que pierde), para que nadie lo toque sin saber qué cambia
- **La confirmación por nombre al eliminar ignora mayúsculas y espacios de los bordes.** Exigir la coincidencia exacta chocaba con el propio cartel, que muestra el nombre en **mayúsculas** por el `uppercase` del `Label` del preset: escribir literalmente lo que la pantalla mostraba no funcionaba

---

## 13. PWA — Consideraciones Visuales

La app es instalable como PWA. Esto implica algunos detalles de diseño:

- **Theme color** (barra del navegador / status bar): `paper` (`#FBF9F6`)
- **Íconos de la PWA**: usar el logo sobre fondo `paper`, en `192px` y `512px`
- **Splash screen**: fondo `paper`, logo centrado, sin texto de carga
- **Safe areas en mobile**: respetar `env(safe-area-inset-*)` para que el header y el FAB no queden bajo el notch o la barra de gestos
- El FAB "Ver en mapa" debe respetar `padding-bottom: env(safe-area-inset-bottom)`

---

## 14. Identidad de Marca

### Wordmark

La marca es "Marka" tratada como wordmark **tipográfico** (no logo gráfico), en Noto Serif 700, con un **punto final en terracota** — "Marka." — al estilo de los mastheads editoriales (Vox., Quartz.). El punto es el único acento, alineado a "calidez contenida" y "un acento usado con avaricia".

- Componente reutilizable: `src/components/brand/Wordmark.tsx`
- Props: `size` (`sm` 20px / `md` 24px / `lg` 36px) y `variant` (`dark` = texto black sobre fondos claros / `light` = texto paper sobre fondos oscuros como el sidebar)
- El punto es siempre terracota en ambas variantes
- `tracking-[-0.01em]`, `leading-none`, `select-none`, accesible con `aria-label="Marka"`
- Se usa en: header público, login, register, sidebar del dashboard
- En el header público y en login/register (AuthLayout), el wordmark se envuelve en un `Link` a `/` (volver al mapa). El componente sigue siendo presentacional puro: el comportamiento de link se agrega desde afuera, nunca dentro de `Wordmark.tsx`, para que cada uso decida su destino (el sidebar del dashboard, por ejemplo, no lo envuelve — un agente trabajando no espera que el logo lo saque al sitio público).

### Íconos e identidad

- Favicon multi-resolución y íconos PWA (192/512) con la inicial "M" en Noto Serif, terracota sobre fondo paper
- Markers SVG en `public/markers/` como fuente de verdad del diseño de los pines (la implementación viva es CSS sobre DivIcon)

### Pantallas de autenticación (split-screen)

Login y register usan un layout split-screen editorial (`src/components/auth/AuthLayout.tsx`):
- Panel de identidad: gradiente cálido oscuro (`#3b2a22` → `#1c1512` → black) con glow terracota radial, wordmark arriba, claim en Noto Serif abajo con un hairline terracota
- Panel de formulario: sobre `paper`, con aire
- **Altura del panel de identidad (load-bearing, no decorativo):** en `md+` el panel de identidad es `md:sticky md:top-0 md:h-dvh` (`AuthLayout.tsx:23`) y el contenedor raíz del split lleva `md:items-start` (`AuthLayout.tsx:20`). Esto es funcional: sin el `md:items-start`, el contenedor `flex md:flex-row` usa `align-items: stretch` por default y el panel de identidad **hereda el alto del formulario**; cuando el form supera el viewport, el panel se estira y su `justify-between` interno separa/junta el wordmark y el claim en sincronía con el form (efecto "respiran"). Con `md:items-start` el panel deja de estirarse, `md:h-dvh` le fija un alto propio de una pantalla (no un mínimo elástico como `min-h-screen`), y `md:sticky md:top-0` lo deja quieto mientras el form scrollea de su lado. No volver a `min-h-screen`/`h-screen` ni quitar el `items-start`: reintroduce el bug del wordmark que se mueve. En mobile el panel es una franja `h-44` y nada de esto aplica (el fix es solo `md:`).
  > ⚠ **Trampa:** el caso que originalmente disparaba el bug era el campo condicional "nombre de inmobiliaria" del toggle Inmobiliaria/Particular del registro. **Ese toggle ya no existe** (la app es solo-agencias y el campo es siempre visible), pero estas clases **siguen siendo necesarias**: la causa de raíz es el `stretch` por default, no el campo condicional. Cualquier formulario más alto que el viewport reproduce el bug. No "limpiar" estas clases porque el ejemplo que las motivaba desapareció.
- En mobile: el panel colapsa a una franja superior corta (~176px); el formulario ocupa el ancho completo, accesible sin scroll
- Asset-ready: el fondo de gradiente está marcado para reemplazar por una fotografía editorial con una línea, cuando haya una foto propia
- Claims (constantes editables): login "De vuelta al mapa de tu ciudad", register "Sumá tu inmobiliaria al mapa de tu ciudad"
- Salida al mapa: el panel del formulario tiene un link "← Volver al mapa" (→ `/`, ícono `ArrowLeft` 16px) como primer elemento dentro del contenedor del form, alineado al mismo eje izquierdo que inputs y heading. Es navegación secundaria (no botón): DM Sans 14px `graphite`, hover a `terracota` (texto e ícono viran juntos vía `currentColor`). Convive con el wordmark clickeable del panel de identidad — el wordmark queda como salida secundaria intuitiva, este link como la explícita y descubrible. Se agregó porque el wordmark como única salida no era descubrible para quien no sabe que el logo es un link.

---

## 15. Marco de App y Estructura

- Marco fino editorial (1px `stone`) alrededor de toda la ventana de la app — da el aire de margen de página sin sensación de caja. Se eligió `stone` sobre `graphite` para que no se sienta como un borde duro.
- Implementación: un overlay único (`fixed inset-0 z-[9999] border border-stone pointer-events-none mix-blend-multiply`) en el layout raíz (`src/app/layout.tsx`), no afecta el layout ni genera scroll. El `mix-blend-multiply` es funcional, no decorativo: la hairline `stone` se multiplica contra el fondo, así que sobre `paper` queda como hilo cálido sutil pero sobre fondos oscuros (sidebar negro, gradiente del login) tiende a negro y se desvanece, en vez de "saltar" como una línea blanquecina. No quitar el blend mode (reintroduce el contorno claro sobre oscuro). Caso límite a tener presente: si un ancestro introduce `isolation: isolate` o un blend mode propio, el blend del marco quedaría confinado a ese grupo y volvería a verse claro sobre oscuro.
- Divisor header/cuerpo: línea fina `stone` que separa navegación de contenido.
- El objetivo es dar estructura y un poco de contraste a la app sin perder la limpieza (evitar el "todo demasiado blanco y plano").

---

## 16. PropertyCard y Lista Mobile

### PropertyCard (`src/components/properties/PropertyCard.tsx`)

Card editorial reutilizable. Recibe `PropertyCardData` (un `Pick` de `Property`, desacoplada del store) y un callback `onSelect` — para poder reusarse a futuro en un panel de resultados desktop sincronizado con el mapa.

- Portada full-width 180px, ratio consistente. Placeholder `ImageOff` en stone si no hay foto
- Badge "Destacada" en terracota arriba-derecha si `is_featured`
- Corazón de favorito arriba-izquierda (no choca con "Destacada"), `bg-paper`/85 backdrop-blur, conectado a `useFavorites` (sincroniza con mapa y modal en vivo). Tocar el corazón NO abre el modal
- Kicker tipo·operación → título Noto Serif 17px → precio Noto Serif 20px bold terracota → ubicación con MapPin → métricas con íconos 13px
- Border stone, bg paper, rounded-lg
- Hover desktop: elevación magnética sutil (`-translate-y-0.5` + shadow-sm + border-graphite, 120ms)

### Lista mobile (`src/components/properties/PropertyList.tsx`)

- Es el punto de entrada en mobile (cards-first). Usa el mismo `useProperties` que el mapa pero con `bounds = null` (toda la ciudad, no solo el viewport), respetando los filtros activos
- El toggle FAB "Ver lista / Ver mapa" alterna entre lista y mapa en mobile
- Estados: cargando → skeleton de cards; vacío con filtros → "No hay propiedades con estos filtros" + "Limpiar filtros"; vacío sin filtros → "Todavía no hay propiedades"
- Scroll con padding inferior que respeta el safe-area (la última card no queda tapada por los FABs)

### FABs mobile

- Par coherente: primario "Ver lista/mapa" en terracota + texto paper; secundario "Filtros" en paper + borde stone + texto graphite
- DM Sans, rounded-md, shadow-lg, respetan `env(safe-area-inset-bottom)`
- Se ocultan cuando el PropertyModal está abierto

---

## 17. Referencias de Mercado

Portales con los que este diseño compite y de los que toma referencia:

- **Idealista** (ES) — jerarquía tipográfica, filtros laterales, pins de precio, estado "visitado" de los pines
- **Immowelt** (DE) — limpieza editorial, uso del espacio blanco
- **Sotheby's International Realty** — paleta neutra cálida, tipografía serif en displays, fotografía a sangre
- **Zonaprop / Mercado Libre Inmuebles** (AR) — referencia local de UX, no de diseño
