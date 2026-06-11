# CLAUDE.md — App Mapa Inmobiliario (Marka)

> Este archivo provee contexto persistente a Claude Code sobre la arquitectura, convenciones y reglas del proyecto. Leerlo antes de cualquier tarea de código.

---

## Resumen del Proyecto

Marketplace inmobiliario por ciudad llamado **Marka**. Una sola web pública donde el visitante ve en un mapa interactivo las propiedades de **todas las agencias de su ciudad**, filtra, y contacta al agente por WhatsApp. Las agencias pagan una suscripción para publicar.

**Modelo de negocio:** SaaS B2B. 4 planes: free (particular, 1 propiedad), inicial (agencia, 20), profesional (agencia, 60, + white-label), premium (agencia, 200, + white-label + destacados + métricas). El visitante no paga ni se registra.

**Dos tipos de usuario:**
- **Visitante (cliente)**: sin registro. Navega el mapa, filtra, ve detalles, contacta por WhatsApp, guarda favoritos localmente.
- **Agente (cliente de pago)**: login. CRUD de propiedades, perfil, preferencias, suscripción, métricas de sus propiedades y leads.

**Arquitectura:** marketplace multi-tenant. Un solo mapa por ciudad muestra todas las agencias juntas, pero los datos están separados por `agency_id` y `city_id`, lo que permite a futuro activar vistas white-label (`agencia.dominio.com` con solo sus propiedades) sin reescribir nada.

**Distribución:** web responsive + PWA instalable. No hay app nativa ni stores.

**Estado:** MVP completo y revisado (seguridad, performance, cleanup) + plan visual editorial completo. Build verde, 0 errores de TypeScript/ESLint. Listo para deploy.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) + React + TypeScript |
| Estilos | Tailwind CSS + shadcn/ui (preset Sera) |
| Mapa | react-leaflet + OpenStreetMap + leaflet.markercluster |
| Estado global | Zustand (filtros del mapa + ciudad activa) |
| Formularios | react-hook-form + zod |
| DB + Auth + Storage | Supabase (PostgreSQL + PostGIS) |
| PWA | manifest + service worker |
| Deploy | Vercel |
| Node.js | 20+ (requerido por Next.js 16) |

---

## Modelos de Negocio y Multi-Tenancy — Reglas Críticas

### Marketplace por ciudad
- El visitante ve propiedades de **todas las agencias de UNA ciudad** en el mismo mapa.
- Toda query pública de propiedades **filtra por `city_id`**. Nunca mostrar propiedades de otra ciudad.
- La ciudad activa se gestiona con `cityStore` (Zustand): localStorage → geolocalización → primera ciudad activa.

### Multi-tenant
- Toda propiedad pertenece a una `agency_id` (NOT NULL) y a una `city_id` (NOT NULL).
- `city_id` está **denormalizado en `properties`** para filtrar el mapa sin JOIN.
- Al crear una propiedad, copiar `city_id` y `agency_id` del agente autenticado — nunca del cliente.

### Roles de agente (Fase 3 — parcial)
- `agents.role` (`admin`/`agent`) **ya está migrado** en la base. Backfill aplicado: el admin de cada agencia es el agente más antiguo.
- **`role` YA gatea la sección "Equipo"** (crear/listar agentes): la página `/dashboard/equipo` y la action `createAgentAction` validan `role === 'admin'` server-side, y el ítem del sidebar se muestra solo a admins (`isAgencyAdmin`). La pantalla **Consultas** (`/dashboard/leads`) también diferencia por rol: usa la policy `Admin reads agency leads` (un admin ve los leads de toda su agencia; un agente, solo los suyos) — la query filtra por `agency_id` y la RLS recorta sola. El admin además **gestiona** (edita/elimina/cambia estado de) las propiedades de toda su agencia, no solo las suyas (ver "Gestión de propiedades por el admin" abajo). Falta aún (Paso 2): reasignar el `agent_id` de una propiedad a otro agente.
- **Dos "admin" distintos, no mezclar:** `isAppAdmin` (dueño de la plataforma, por `ADMIN_USER_ID`, gatea `/admin`) vs `isAgencyAdmin` (`agent.role === 'admin'`, admin de su agencia, gatea "Equipo"). El layout del dashboard calcula ambos y los pasa al Sidebar.
- **Gestión de propiedades por el admin (`propiedades/actions.ts`):** un admin de agencia edita/elimina/cambia estado de las propiedades de TODA su agencia; un agente normal, solo las suyas. La autorización vive en el helper **`authorizePropertyAccess(id)`** (reemplazó a `verifyOwnership`): lee la propiedad por id, y devuelve `mode: "owner"` si `agent_id === auth.uid()` (escribe con client normal, la RLS lo permite) o `mode: "admin"` si el user es `role === 'admin'` y su `agency_id` coincide con el de la propiedad (escribe con **service role**, porque la RLS `agent_id = auth.uid()` bloquearía al admin sobre algo ajeno). Cualquier otro caso → "Propiedad no encontrada" (mismo mensaje que "no existe", no revela propiedades ajenas). **El helper decide qué client usar (`db`), no cada action** — imposible que una action olvide el client correcto. `role`/`agency_id` del caller SIEMPRE del server; la igualdad de `agency_id` es la única barrera en `mode: "admin"`. Las policies RLS NO se tocaron (opción service role, no policy nueva). El listado (`propiedades/page.tsx`) filtra por `agency_id` si admin (con columna "Agente") o por `agent_id` si no. `[id]/editar` permite abrir propiedades de la agencia si el user es admin. **Falta (Paso 2):** reasignar `agent_id` desde el form (crear/editar). `createPropertyAction` aún no toca `agent_id` (el admin crea a su nombre).
- Modelo previsto a futuro: `admin` además gestiona la suscripción y ve los leads de toda la agencia; `agent` hace CRUD de lo suyo.
- **El registro es de dos pasos.** Paso 1 (`/register`): crea agencia nueva + agente `admin` + suscripción `free`/`active`, siempre. Ya no existe el hardcodeo a una agencia demo. Paso 2 (`/register/plan`, solo inmobiliarias): elige plan. El particular salta el paso 2 y va directo al dashboard.
- **Selección de plan (`/register/plan`):** modelo `plan` (lo que RIGE) vs `pending_plan` (lo PEDIDO). Si la inmobiliaria elige un plan pago: `plan` queda en `free`, `pending_plan` = el elegido, `status: 'pending'`, y `property_limit`/`has_*` de free hasta la activación manual. Si elige free: `plan: free`, `pending_plan: null`, `status: active`. **Nunca se pisa `plan` al pedir un upgrade** — lo pedido vive en `pending_plan`. La server action deriva el `agency_id` del `auth.uid()`, nunca del cliente, y usa admin client acotando el UPDATE a esa agencia (no hay policy de UPDATE de subscriptions para usuarios).
- **Pedir upgrade desde el dashboard** (`/dashboard/suscripcion`): mismo modelo. "Pasar a {plan}" pide confirmación y setea `pending_plan` + `status: 'pending'` SIN tocar `plan` ni los límites (el cliente sigue operando con lo que rige hasta la activación). El botón pasa a "Pendiente". Cancelar el pedido aún no está (el cliente escribe; ver PENDIENTES.md).
- **Activación (panel `/admin`)**: el admin de la plataforma lee `pending_plan`, lo copia a `plan`, sube `property_limit`/`has_*` a los reales, `status: 'active'`, sella `activated_at`, y limpia `pending_plan`. El gating en runtime (badge, dashboard, bloqueo de "Nueva propiedad") usa siempre el plan que RIGE vía `getPlanUsage`, nunca el pedido.
- Las altas siguientes a una agencia existente (por invitación) caerán en `agent` — pieza futura.
- `tenant_type` (en `agencies`) **ya está migrado** (`agency`/`individual`, default `agency`) y **ya se usa en el registro**: el alta elige inmobiliaria o particular. `phone_wa` de agencia **sigue sin migrar** — no asumir que existe.

### Suscripciones y límites
- Cada agencia tiene una fila en `subscriptions` con `plan` (`free`/`inicial`/`profesional`/`premium`), `property_limit` y los entitlements `has_featured`/`has_white_label`/`has_metrics`.
- El límite se valida **en la DB** (trigger `check_property_limit`). El frontend lo anticipa pero la DB es la fuente de verdad.
- El conteo de propiedades usa **siempre `agency_id`**, nunca `agent_id`. Usar el helper `getPlanUsage` de `@/lib/utils/getPlanUsage`.
- `is_featured` solo puede ser `true` si la suscripción tiene `has_featured` (hoy: premium). Las server actions lo fuerzan a `false` silenciosamente si la agencia no lo tiene. **El gating se hace por el booleano `has_featured` (vía `planUsage.hasFeatured`), NUNCA comparando el nombre del plan (`=== "premium"`).**
- La creación de `agencies`, el insert de `agents` y la escritura de `subscriptions` en el registro se hacen **con service role** (`admin.ts`), nunca con el client normal.

---

## Estructura de Carpetas

```
/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx                 ← Mapa principal + lista mobile
│   │   │   ├── [ciudad]/page.tsx        ← Marketplace de una ciudad
│   │   │   └── propiedades/[slug]/      ← Página SEO por propiedad
│   │   ├── (agent)/
│   │   │   ├── login/                    ← Split-screen editorial (AuthLayout)
│   │   │   ├── register/                  ← page.tsx (Server: trae ciudades) + RegisterForm.tsx (client). Paso 2: plan/ (page Server + PlanSelector client + actions: elige plan, pago→pending)
│   │   │   └── dashboard/
│   │   │       ├── page.tsx             ← Métricas (StatsCard) y últimos leads
│   │   │       ├── propiedades/         ← Listado CRUD (admin ve toda la agencia + col. Agente; agente solo lo suyo) + nueva + [id]/editar + loading.tsx. actions.ts con authorizePropertyAccess (owner/admin)
│   │   │       ├── equipo/              ← Gestión de agentes (solo admin de agencia): page (Server, gatea role) + actions (createAgentAction, service role)
│   │   │       ├── leads/               ← Consultas (ambos roles; RLS recorta: agente ve los suyos, admin los de la agencia). page (Server) + LeadsContent (client)
│   │   │       ├── perfil/
│   │   │       ├── preferencias/
│   │   │       └── suscripcion/
│   │   ├── admin/                        ← Panel de plataforma (solo dueño, gateado por ADMIN_USER_ID en admin/layout.tsx): 6 métricas de negocio (StatsCard) + tabla de TODAS las agencias + filtros aditivos + activar planes. layout (Server, gating + sidebar) + page (Server) + AgenciesTable (client) + actions. USA el sidebar del dashboard ("Panel admin" activo)
│   │   └── api/og/[slug]/
│   │
│   ├── components/
│   │   ├── brand/
│   │   │   └── Wordmark.tsx             ← "Marka." con punto terracota (Lote 0)
│   │   ├── auth/
│   │   │   └── AuthLayout.tsx           ← Shell split-screen de login/register
│   │   ├── map/
│   │   │   ├── MapView.tsx              ← Raíz del mapa (client, ssr:false)
│   │   │   ├── PropertyMarker.tsx       ← Pin terracota + estados (CSS sobre DivIcon)
│   │   │   ├── PropertyModal.tsx        ← Drawer/sheet + flujo WA + carrusel
│   │   │   ├── FilterPanel.tsx          ← Filtros (checkboxes shadcn, commit on-blur)
│   │   │   ├── CityPicker.tsx           ← Selector de ciudad (lee cityStore)
│   │   │   └── ClusterLayer.tsx         ← Clustering, diff por id, estados live
│   │   ├── properties/
│   │   │   ├── PropertyCard.tsx         ← Card editorial reutilizable
│   │   │   ├── PropertyList.tsx         ← Lista mobile (cards-first)
│   │   │   ├── PropertyForm.tsx         ← CRUD form + barra de acción sticky
│   │   │   ├── LocationPicker.tsx       ← Pin manual (NO geocoding), tiles compartidos
│   │   │   ├── ImageUploader.tsx        ← Drag&drop, progreso por imagen, máx 10
│   │   │   └── WhatsAppButton.tsx
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx              ← Wordmark + avatar + nav
│   │   │   ├── StatsCard.tsx            ← tabular-nums, count-up, acento en métrica clave
│   │   │   ├── PropertiesTable.tsx      ← Tabla desktop + cards mobile + skeleton
│   │   │   ├── PlanBadge.tsx            ← Plan + micro-barra de uso
│   │   │   ├── ProfileForm.tsx
│   │   │   └── SubscriptionContent.tsx  ← Cards de planes (4 planes, flex-wrap) + Dialog shadcn
│   │   └── ui/                          ← shadcn/ui components
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                ← Browser client
│   │   │   ├── server.ts                ← SSR client
│   │   │   ├── admin.ts                 ← Service role (registro: agencies + agents + subscriptions). NUNCA en cliente
│   │   │   └── middleware.ts            ← Helper de cookies para proxy.ts
│   │   ├── map/
│   │   │   └── tiles.ts                 ← Config de tiles compartida (mapa + LocationPicker)
│   │   ├── hooks/
│   │   │   ├── useProperties.ts         ← Fetch reactivo con debounce + diff + SELECT acotado
│   │   │   ├── useMapFilters.ts         ← Lee mapFiltersStore
│   │   │   ├── useFavorites.ts          ← Favoritos en localStorage (sync entre instancias)
│   │   │   ├── useVisitedProperties.ts  ← Pines visitados en localStorage
│   │   │   └── useWhatsApp.ts
│   │   └── utils/
│   │       ├── formatPrice.ts           ← formatPrice + formatPriceCompact (pines)
│   │       ├── generateSlug.ts          ← Slug con sufijo aleatorio
│   │       ├── waMessage.ts             ← generateWaUrl(): string | null
│   │       ├── getPlanUsage.ts          ← Helper server: cuenta por agency_id
│   │       ├── authErrors.ts            ← translateAuthError: mapea errores de Supabase Auth a español (registro + alta de agente)
│   │       └── labels.ts                ← Etiquetas UI compartidas
│   │
│   ├── store/
│   │   ├── mapFiltersStore.ts           ← Filtros + selectActiveFiltersCount
│   │   └── cityStore.ts                 ← Ciudad activa, initCity(), setCity(), nearbyCityId
│   │
│   ├── types/
│   │   ├── index.ts                     ← Todos los tipos del proyecto
│   │   └── supabase.ts                  ← Generado por Supabase CLI (no editar)
│   │
│   └── proxy.ts                         ← Convención Next.js 16: auth guard
│
├── public/
│   ├── markers/                         ← SVG fuente de verdad de los pines
│   ├── icon-192.png / icon-512.png      ← PWA icons ("M" terracota)
│   └── manifest.json
│
├── supabase/
│   ├── migrations/20240101000000_initial_schema.sql
│   └── seed.sql
│
├── CLAUDE.md
└── DESIGN.md
```

> **Alias `@/*`**: resuelve a `src/*`. Configurado por Next.js con `--src-dir`.

---

## Reglas de Código — Seguir SIEMPRE

### TypeScript
- Estricto en todo. Usar los tipos de `src/types/index.ts`. **Nunca `any`**
- Para extender tipos: `Pick<>`, `Omit<>`, `Partial<>` — nunca redefinir campos inline
- Interfaces en PascalCase, variables y funciones en camelCase, archivos y carpetas en kebab-case

### Next.js 16
- `src/proxy.ts` exporta `proxy()`, no `middleware()`. `src/lib/supabase/middleware.ts` es un utilitario distinto (helper de cookies)
- `params` y `searchParams` son Promises — siempre `await`
- Server Components por defecto; `"use client"` solo cuando sea necesario
- El mapa siempre con `dynamic(..., { ssr: false })` — Leaflet usa `window`
- Al pasar íconos de Server a Client Component, pasarlos como **elemento** (`<Icon size={20}/>`), no como referencia, para no romper la serialización

### Supabase — cuál client usar

| Contexto | Client |
|---|---|
| Server Components, Server Actions | `@/lib/supabase/server` |
| Client Components | `@/lib/supabase/client` |
| Crear `agencies`, insert `agents`, upsert `subscriptions` en registro | `@/lib/supabase/admin` (service role) |

- No hacer queries directas en componentes → hooks en `src/lib/hooks/`
- Respetar RLS siempre. Admin client solo en server

### ESLint
- El patrón `setIsLoading(true)` al inicio de efectos: usar IIFE async dentro del efecto. No bajar la regla globalmente.
- Hay dos warnings cosméticos no bloqueantes, ambos inherentes a react-hook-form + React Compiler (no se memoiza bien): en `PropertyForm.tsx` (cast `zodResolver`) y en `RegisterForm.tsx` (el `watch("tenantType")` del toggle Inmobiliaria/Particular). Son warnings, no errores; no bloquean el build.

### Estilos
- Tailwind, sin CSS-in-JS ni módulos CSS. shadcn/ui para componentes base
- Seguir `DESIGN.md`

### Comentarios
- Lógica de negocio en español, código en inglés

---

## Convenciones de Dominio

### Ciudad activa — cityStore
- `src/store/cityStore.ts`. `initCity()` se llama **una sola vez** desde la raíz, no en componentes hijos.
- `CityPicker` y todo componente que necesite la ciudad leen del store. `useCity.ts` fue eliminado.
- `nearbyCityId` (campo del store) marca la ciudad detectada por geolocalización para el label "Cerca tuyo".

### Plan usage — getPlanUsage
- Siempre `src/lib/utils/getPlanUsage.ts`. Cuenta por `agency_id`. Solo en server.

### Etiquetas UI — labels.ts
- Nunca definir mapas de etiquetas inline. Usar `PROPERTY_TYPE_LABELS`, `OPERATION_TYPE_LABELS`, `PROPERTY_STATUS_LABELS`, `AMENITY_LABELS`, `CURRENCY_LABELS`.

### Tiles del mapa — tiles.ts
- `src/lib/map/tiles.ts` es la fuente única de config de tiles (OSM estándar), consumida por `MapView` y `LocationPicker`. Rama opcional para `NEXT_PUBLIC_MAPTILER_KEY`.

### Favoritos y visitados
- `useFavorites` y `useVisitedProperties` en localStorage. Se reflejan en vivo en el mapa, el modal y las cards (sync entre instancias vía CustomEvent + storage). Sin login.

### WhatsApp
- `phone_wa` en formato `"5491112345678"`. `generateWaUrl()` retorna `string | null` — verificar antes de usar; si null, deshabilitar botón con mensaje.
- Registrar lead (con `agency_id`) antes de abrir WhatsApp.

### Ubicación — pin manual
- `LocationPicker`, sin geocoding. Si el agente no movió el pin, el form bloquea el submit.

### Imágenes
- Bucket `property-images`, path `{agent_id}/{property_id}/{filename}`. Avatares: `avatars/{agent_id}/avatar.{ext}`.
- Primera imagen `sort_order = 0`, `is_cover = true`. Si falla el insert: avisar, no hacer rollback.

### Precios
- `formatPrice(price, currency)` → `$250.000`. `formatPriceCompact` → `USD 250k` (pines).

### Mapa — performance
- Debounce 400ms en `moveend`. `ClusterLayer` diff por ids. `useProperties` con SELECT acotado, no `*`. La lista mobile usa `bounds = null` (toda la ciudad).

---

## Base de Datos — Referencia Rápida

Schema en `supabase/migrations/20240101000000_initial_schema.sql`.

| Tabla | Descripción |
|---|---|
| `cities` | Mercados. Centro del mapa y zoom por ciudad |
| `agencies` | Inmobiliarias. `city_id` NOT NULL. `tenant_type` (`agency`/`individual`) ya migrado. `brand_color` para white-label futuro |
| `subscriptions` | `plan` (el que RIGE) + `pending_plan` (pedido, esperando activación) + `status`, `property_limit`, entitlements `has_*`, y `activated_at` (desde cuándo rige el pago). Por agencia |
| `agents` | `id` = `auth.users.id`. `agency_id` NOT NULL. `role` (`admin`/`agent`) gatea la sección Equipo. `email` denormalizado de auth.users (copia de lectura) |
| `properties` | `agency_id` y `city_id` NOT NULL; `location` GEOGRAPHY generada |
| `property_images` | `is_cover` + `sort_order` |
| `leads` | Contactos WA. Incluye `agency_id`. Se listan en `/dashboard/leads` (Consultas), diferenciado por rol vía RLS |

**Policies RLS clave:** lectura pública de cities/agencies/properties activas; agentes ven y gestionan lo suyo (`Agent manages own properties` = `agent_id = auth.uid()`) + leen propiedades de su agencia (para el conteo); el admin gestiona las propiedades de su agencia vía **service role + validación** (`authorizePropertyAccess`), NO por policy nueva — las policies de `properties` no se tocaron; `Agent reads own leads` (un agent ve los suyos) + `Admin reads agency leads` (un admin ve los de toda su agencia — Fase 3, ya aplicada); `Public insert lead` valida que property+agent+agency coincidan (todavía no contempla `agent_id IS NULL`, eso llega con agente desvinculado); escritura de subscriptions solo service role.

**Query principal:**
```sql
SELECT ... FROM properties
WHERE city_id = $1 AND status = 'active'
  AND lat BETWEEN $south AND $north AND lng BETWEEN $west AND $east;
```

**Amenities** JSONB: filtrar con `.contains("amenities", JSON.stringify([...]))` (genera `@>`).

**Vistas RPC:** `increment_views(property_id)` — incrementa `views_count` (SECURITY DEFINER).

---

## Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # Requerido: registro de agentes + suscripciones
ADMIN_USER_ID=                 # Requerido para /admin: auth.uid() (UUID) del dueño de la plataforma. Server-side (sin NEXT_PUBLIC_). Fail-closed: si falta, /admin deniega a todos
NEXT_PUBLIC_MAPTILER_KEY=      # Opcional
```

---

## Comandos Útiles

```bash
npm run dev
npx tsc --noEmit
npm run lint          # debe dar 0 errors
npx next build
supabase gen types typescript --local > src/types/supabase.ts
npx shadcn@latest add [componente]
```

---

## Decisiones de Arquitectura — No Cambiar sin Justificación

| Decisión | Razón |
|---|---|
| Marketplace por ciudad | La concentración de oferta es el valor; efecto de red |
| Multi-tenant (`agency_id`/`city_id`) | Permite white-label futuro sin reescribir |
| cityStore (Zustand) | Una sola instancia compartida; evita desincronización del selector con el mapa |
| getPlanUsage por agency_id | Coincide con el trigger; correcto en agencias multi-agente |
| Admin client para registro | La sesión no está disponible en server justo tras signUp |
| is_featured gateado por `has_featured` en server action | El trigger solo valida cantidad, no features; el gating lee el booleano de la suscripción, no el nombre del plan |
| Debounce 400ms + diff por ids | Evita ráfaga de queries y recreación de markers al panear |
| Tiles OSM (no CARTO/tonal) | Mejor contraste con los pines terracota; CARTO lavaba el mapa |
| Pin terracota (no blanco) | Contraste sobre el mapa; activo en negro para distinguir selección |
| Suscripción fija, no comisión | El cierre ocurre en WhatsApp fuera de la app |
| PWA, no app nativa | El visitante usa la app pocas semanas |
| Pin manual sin geocoding | Los mapas no son precisos en muchas ciudades |
| Leaflet en lugar de Mapbox | Tiles OSM gratuitos sin límite |
| `amenities` como JSONB | Flexible, sin migraciones al agregar amenities |
| `proxy.ts` (no middleware.ts) | Convención Next.js 16 |

---

## Método de Diagnóstico

Cuando el usuario reporta un síntoma visual, **inspeccionar el estado real del DOM y las clases aplicadas antes de teorizar sobre el pipeline de build**. La causa más simple (un elemento en otro estado, una clase pisada) es más probable que una corrupción de caché. No verificar en entornos aislados (headless, build paralelo) cuando el síntoma aparece en la app corriendo — la evidencia está en el DOM real.

## Diseño

@DESIGN.md

## Pendientes

Para deuda técnica, piezas futuras y decisiones de producto abiertas, ver `PENDIENTES.md` (no se listan acá para mantener este archivo enfocado en lo que el proyecto ES, no en lo que falta).
