# CLAUDE.md — App Mapa Inmobiliario

> Este archivo provee contexto persistente a Claude Code sobre la arquitectura, convenciones y reglas del proyecto. Leerlo antes de cualquier tarea de código.

---

## Resumen del Proyecto

Marketplace inmobiliario por ciudad. Una sola web pública donde el visitante ve en un mapa interactivo las propiedades de **todas las agencias de su ciudad**, filtra, y contacta al agente por WhatsApp. Las agencias pagan una suscripción para publicar.

**Modelo de negocio:** SaaS B2B. Las agencias se suscriben (plan free con límite de propiedades, plan pro ilimitado + destacados + métricas). El visitante no paga ni se registra.

**Dos tipos de usuario:**
- **Visitante (cliente)**: sin registro. Navega el mapa, filtra, ve detalles, contacta por WhatsApp, guarda favoritos localmente.
- **Agente (cliente de pago)**: login. CRUD de propiedades, perfil, preferencias, métricas de sus propiedades y leads.

**Arquitectura:** marketplace multi-tenant. Un solo mapa por ciudad muestra todas las agencias juntas, pero los datos están separados por `agency_id` y `city_id`, lo que permite a futuro activar vistas white-label (`agencia.dominio.com` con solo sus propiedades) sin reescribir nada.

**Distribución:** web responsive + PWA instalable. No hay app nativa ni stores. El visitante entra desde un link; el agente usa el dashboard desde el navegador.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) + React + TypeScript |
| Estilos | Tailwind CSS + shadcn/ui |
| Mapa | react-leaflet + OpenStreetMap + leaflet.markercluster |
| Estado global | Zustand (solo filtros del mapa) |
| Formularios | react-hook-form + zod |
| DB + Auth + Storage | Supabase (PostgreSQL + PostGIS) |
| PWA | next-pwa o configuración manual de manifest + service worker |
| Deploy | Vercel |
| Node.js | 20+ (requerido por Next.js 16) |

---

## Modelos de Negocio y Multi-Tenancy — Reglas Críticas

Estas reglas gobiernan toda la lógica de datos. Leerlas antes de tocar queries, RLS o componentes que muestren propiedades.

### Marketplace por ciudad
- El visitante ve propiedades de **todas las agencias de UNA ciudad** en el mismo mapa.
- Toda query pública de propiedades **filtra por `city_id`**. Nunca mostrar propiedades de otra ciudad.
- La ciudad activa se determina por: (1) selección explícita del usuario, (2) geolocalización del navegador si la concede, (3) ciudad por defecto (centro-norte de Argentina) como fallback.

### Multi-tenant
- Toda propiedad pertenece a una `agency_id` (NOT NULL) y a una `city_id` (NOT NULL).
- `city_id` está **denormalizado en `properties`** para filtrar el mapa sin JOIN. Al crear/editar una propiedad, copiar el `city_id` de la agencia del agente.
- A futuro: una vista white-label filtra por `agency_id` para mostrar solo las propiedades de esa agencia bajo su marca. La base de datos ya lo soporta; no romper esa separación.

### Suscripciones y límites
- Cada agencia tiene una fila en `subscriptions` con `plan` (`free`/`pro`) y `property_limit`.
- El límite de propiedades activas se valida **a nivel de base de datos** (trigger `check_property_limit`), no solo en el frontend.
- Plan free: hasta 5 propiedades activas/pausadas. Plan pro: límite alto (ej. 9999).
- Las propiedades `sold`/`rented` **no** ocupan cupo.
- La escritura de `subscriptions` la hace **solo el backend con service role**, nunca el cliente.
- El frontend debe mostrar el límite y bloquear el botón "Nueva propiedad" cuando se alcanzó, pero confiar en la DB como fuente de verdad.

---

## Estructura de Carpetas

```
/
├── src/
│   ├── app/
│   │   ├── (public)/                    # Rutas sin auth
│   │   │   ├── page.tsx                 ← Mapa principal (homepage)
│   │   │   ├── [ciudad]/page.tsx        ← Marketplace de una ciudad específica
│   │   │   └── propiedades/[slug]/      ← Página SEO por propiedad
│   │   ├── (agent)/                     # Rutas protegidas
│   │   │   ├── login/ register/
│   │   │   └── dashboard/
│   │   │       ├── page.tsx             ← Métricas y últimos leads
│   │   │       ├── propiedades/         ← Listado CRUD + nueva + [id]/editar
│   │   │       ├── perfil/              ← Datos del agente + foto + WhatsApp
│   │   │       ├── preferencias/        ← Config de cuenta y notificaciones
│   │   │       └── suscripcion/         ← Plan actual, límite, upgrade
│   │   └── api/og/[slug]/               ← Open Graph dinámico
│   │
│   ├── components/
│   │   ├── map/
│   │   │   ├── MapView.tsx              ← Raíz del mapa (client, ssr:false)
│   │   │   ├── PropertyMarker.tsx       ← Pin con precio visible
│   │   │   ├── PropertyModal.tsx        ← Modal/drawer + mini-form WA
│   │   │   ├── FilterPanel.tsx          ← Sidebar de filtros
│   │   │   ├── CityPicker.tsx           ← Selector de ciudad
│   │   │   └── ClusterLayer.tsx
│   │   ├── properties/
│   │   │   ├── PropertyCard.tsx
│   │   │   ├── PropertyForm.tsx
│   │   │   ├── LocationPicker.tsx       ← Pin manual en mini-mapa (NO geocoding)
│   │   │   ├── ImageUploader.tsx
│   │   │   └── WhatsAppButton.tsx
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   ├── PropertiesTable.tsx
│   │   │   └── PlanBadge.tsx            ← Muestra plan y límite restante
│   │   └── ui/                          ← shadcn/ui components
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                ← Browser client
│   │   │   ├── server.ts                ← SSR client
│   │   │   ├── admin.ts                 ← Service role (solo server, para subscriptions)
│   │   │   └── middleware.ts            ← Helper de cookies para proxy.ts (≠ convención Next.js)
│   │   ├── hooks/
│   │   │   ├── useProperties.ts         ← Fetch + filtrado (no queries en componentes)
│   │   │   ├── useMapFilters.ts         ← Lee Zustand store
│   │   │   ├── useCity.ts               ← Ciudad activa + geolocalización
│   │   │   ├── useFavorites.ts          ← Favoritos en localStorage (sin login)
│   │   │   └── useWhatsApp.ts
│   │   └── utils/
│   │       ├── formatPrice.ts
│   │       ├── generateSlug.ts
│   │       └── waMessage.ts
│   │
│   ├── store/
│   │   └── mapFiltersStore.ts           ← Zustand store de filtros
│   │
│   ├── types/
│   │   ├── index.ts                     ← Todos los tipos del proyecto
│   │   └── supabase.ts                  ← Generado por Supabase CLI (no editar)
│   │
│   └── proxy.ts                         ← Convención Next.js 16: auth guard de rutas
│
├── public/
│   ├── markers/                         ← Íconos SVG para el mapa
│   └── manifest.json                    ← PWA manifest
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── CLAUDE.md
└── DESIGN.md
```

> **Alias `@/*`**: resuelve a `src/*`. Configurado automáticamente por Next.js con `--src-dir`.

---

## Reglas de Código — Seguir SIEMPRE

### TypeScript
- Estricto en todo. Usar los tipos de `src/types/index.ts`. **Nunca `any`**
- Interfaces en PascalCase, variables y funciones en camelCase
- Archivos y carpetas en kebab-case

### Next.js 16 — Reglas críticas

**Proxy (auth guard de rutas)**
- El archivo de convención de Next.js se llama `src/proxy.ts` y exporta `proxy()`, no `middleware()`
- `src/lib/supabase/middleware.ts` es un archivo utilitario distinto — es el helper de cookies de Supabase

```ts
// src/proxy.ts — correcto en Next.js 16
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Async params — OBLIGATORIO en Next.js 16**
- `params` y `searchParams` son Promises. Siempre awaitear antes de usar
- Afecta a: `[ciudad]`, `propiedades/[slug]`, `dashboard/propiedades/[id]/editar`, `api/og/[slug]`

```ts
// ✅ Correcto (Next.js 16)
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
}
```

**Server Components y Client Components**
- Server Components por defecto
- Agregar `"use client"` solo cuando sea necesario (eventos, hooks, estado del browser)
- El mapa **siempre** se carga así — Leaflet requiere `window`:
  ```ts
  dynamic(() => import("@/components/map/MapView"), { ssr: false })
  ```
- Mutations con Server Actions cuando sea posible

### Supabase
- Server Components y Server Actions → `@/lib/supabase/server`
- Client Components → `@/lib/supabase/client`
- **Service role** (`@/lib/supabase/admin`) → SOLO en server, exclusivo para operaciones sobre `subscriptions`. Nunca importar en el cliente.
- **No** hacer queries directas en componentes → usar hooks en `src/lib/hooks/`
- Respetar RLS siempre

### Estilos
- Tailwind para todo. Sin CSS-in-JS ni módulos CSS
- shadcn/ui para componentes base (Button, Dialog, Input, Select, etc.)
- Seguir el sistema de diseño en `DESIGN.md` (ver sección Diseño al final)

### Comentarios
- Lógica de negocio: **español**
- Código, variables, nombres de función: **inglés**

---

## Convenciones de Dominio

### Ciudad activa y geolocalización
- Al entrar, el hook `useCity` determina la ciudad: selección guardada → geolocalización del navegador (Geolocation API, con permiso) → ciudad por defecto (centro-norte de Argentina).
- La geolocalización es **opcional**: si el usuario la rechaza, caer al default sin bloquear la experiencia.
- El mapa se centra en `center_lat`/`center_lng`/`default_zoom` de la ciudad activa.

### Ubicación de propiedades — pin manual, NO geocoding
- El agente escribe la dirección en texto (`address`).
- La posición en el mapa (`lat`/`lng`) se coloca **manualmente** moviendo un pin en un mini-mapa (`LocationPicker`).
- **No** usar geocoding automático: en muchas ciudades los mapas no son precisos y genera confusión.
- El `LocationPicker` debe incluir un instructivo claro ("Arrastrá el pin hasta la ubicación exacta del inmueble").

### Favoritos del visitante — localStorage, sin login
- Los favoritos viven solo en el dispositivo (`useFavorites` sobre localStorage).
- No requieren registro ni se sincronizan entre dispositivos. Es una decisión de producto deliberada.
- **Excepción a la regla de artifacts:** en este proyecto localStorage SÍ se usa (no es un artifact de Claude.ai, es la app real desplegada).

### WhatsApp
- `phone_wa` se guarda como `"5491112345678"` (sin `+`, sin espacios)
- El mensaje se genera con `generateWaUrl()` en `@/lib/utils/waMessage`
- **Antes** de abrir el link WA → registrar lead con `INSERT INTO leads` (incluir `agency_id`)

### Precios
- Siempre formatear con `formatPrice(price, currency)` de `@/lib/utils/formatPrice`
- USD: `$250.000` — ARS: `$15.000.000` (punto como separador de miles)

### Imágenes
- Bucket de Supabase Storage: `property-images` (público)
- Path: `{agent_id}/{property_id}/{filename}`
- Primera imagen: `sort_order = 0`, `is_cover = true`

### Slugs
- Se generan automáticamente al crear la propiedad
- Usar `generateSlug()` de `@/lib/utils/generateSlug` (limpia tildes y caracteres especiales)

### Mapa — Performance
- Query de propiedades filtra por `city_id` **y** por `bounds` del viewport actual
- Clustering con `leaflet.markercluster` para evitar renderizar 500+ pines individuales
- Cada pin muestra el precio formateado: `USD 250k`

---

## Base de Datos — Referencia Rápida

Schema completo en `supabase/migrations/`. Tablas principales:

| Tabla | Descripción |
|---|---|
| `cities` | Mercados. Centro del mapa y zoom por ciudad |
| `agencies` | Inmobiliarias. Pertenecen a una ciudad |
| `subscriptions` | Plan (free/pro) y límite de propiedades por agencia |
| `agents` | Agentes (id = `auth.users.id`). Pertenecen a una agencia |
| `properties` | Propiedades. `agency_id` y `city_id` NOT NULL; `location` GEOGRAPHY generada |
| `property_images` | Imágenes vinculadas a una propiedad |
| `leads` | Registro de cada contacto vía WhatsApp (incluye `agency_id`) |

**PostGIS** habilitado. Query principal del marketplace (ciudad + viewport):
```sql
SELECT * FROM properties
WHERE city_id = $1
  AND status = 'active'
  AND ST_Within(location, ST_MakeEnvelope($west, $south, $east, $north, 4326));
```

**Amenities** como `JSONB`. Filtrar con:
```sql
WHERE amenities @> '["pileta", "quincho"]'
```

**Límite de propiedades**: validado por el trigger `check_property_limit`. Si una agencia free intenta crear la 6ta propiedad activa, la DB lanza excepción. El frontend debe anticipar esto y mostrar el upgrade.

---

## Flujo del Visitante

```
Visitante abre la app
  → useCity determina ciudad (guardada / geolocalización / default)
  → MapView carga propiedades de esa ciudad + viewport actual
  → Zustand store aplica filtros activos
  → Pines agrupados con clustering
  → Click en pin → PropertyModal (drawer desktop / bottom sheet mobile)
  → Visitante ingresa nombre → se genera URL de WA
  → Se inserta lead en Supabase (con agency_id) → se abre WhatsApp
  → (Opcional) Guarda favoritos en localStorage, sin login
```

## Flujo del Agente

```
Agente hace login
  → Dashboard: métricas, leads recientes, plan actual y límite
  → CRUD propiedades (bloqueado al alcanzar límite del plan free)
  → Al crear propiedad: form + LocationPicker (pin manual) + ImageUploader
  → Perfil: datos, foto, número de WhatsApp
  → Preferencias: configuración de cuenta
  → Suscripción: ver plan, límite usado, upgrade a pro
```

---

## Variables de Entorno Requeridas

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Solo en server, nunca en cliente

# Opcional: tiles más bonitos (100k req/mes gratis)
NEXT_PUBLIC_MAPTILER_KEY=
```

---

## Comandos Útiles

```bash
# Inicializar proyecto (Node.js 20+ requerido)
npx create-next-app@16 base \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Desarrollo
npm run dev

# Verificar tipos TypeScript sin compilar
npx tsc --noEmit

# Migrar middleware.ts a proxy.ts en proyectos existentes
npx @next/codemod@canary middleware-to-proxy .

# Ejecutar migraciones en Supabase
supabase db push

# Generar tipos TS desde el schema de Supabase (apunta a src/)
supabase gen types typescript --local > src/types/supabase.ts

# Agregar componente de shadcn/ui
npx shadcn@latest add [componente]
```

---

## Decisiones de Arquitectura — No Cambiar sin Justificación

| Decisión | Razón |
|---|---|
| Marketplace por ciudad (no white-label aislado) | La concentración de oferta es el valor; el efecto de red atrae más agencias |
| Multi-tenant por debajo (`agency_id`/`city_id`) | Permite activar white-label a futuro sin reescribir |
| Multi-ciudad en el diseño, single-city en el lanzamiento | Barato diseñarlo ahora, carísimo migrarlo después. Se lanza enfocado en una ciudad |
| Suscripción fija, no comisión por venta | El cierre ocurre por WhatsApp fuera de la app; no se puede medir comisión |
| Límite de plan validado en la DB | El frontend no es fuente de verdad; el trigger garantiza el límite |
| PWA, no app nativa | El visitante usa la app pocas semanas; descargar de la store mata la conversión |
| Sin registro para el visitante | Reduce fricción; favoritos locales alcanzan |
| Geocoding manual (pin en mapa) | Los mapas no son precisos en muchas ciudades; el pin manual evita confusión |
| Next.js 16 desde el inicio | Evita migración futura; Turbopack más rápido; async params desde el arranque |
| `proxy.ts` en lugar de `middleware.ts` | Convención de Next.js 16; `middleware.ts` está deprecado |
| Carpeta `src/` | Preferencia del equipo; separa el código de config raíz |
| Leaflet en lugar de Mapbox | Tiles OSM 100% gratuitos, sin límite de requests |
| `amenities` como JSONB | Los amenities varían mucho; evita migraciones al agregar nuevos |
| Mapa siempre CSR (`ssr:false`) | Leaflet usa `window`; no funciona en SSR |
| Zustand solo para filtros del mapa | Estado mínimo global; evita complejidad innecesaria |

---

## Archivos de Referencia Clave

- `src/proxy.ts` — Auth guard de rutas (convención Next.js 16)
- `src/lib/supabase/middleware.ts` — Helper de cookies de Supabase (utilitario, no convención Next.js)
- `src/lib/supabase/admin.ts` — Service role, solo para `subscriptions` (nunca en cliente)
- `src/types/index.ts` — Todos los tipos TypeScript del proyecto
- `src/types/supabase.ts` — Tipos generados por Supabase CLI (no editar manualmente)
- `supabase/migrations/` — Schema SQL con cities, subscriptions, RLS y trigger de límite
- `src/lib/utils/waMessage.ts` — Generador de URL de WhatsApp
- `src/lib/hooks/useCity.ts` — Ciudad activa y geolocalización
- `src/lib/hooks/useFavorites.ts` — Favoritos en localStorage
- `src/store/mapFiltersStore.ts` — Zustand store de filtros del mapa

## Diseño

@DESIGN.md
