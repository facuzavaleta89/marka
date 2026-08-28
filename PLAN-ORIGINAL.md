# Plan Completo — App de Mapa Inmobiliario
> Stack: Next.js 16 · React · Supabase · Vercel · react-leaflet
> Modelo: Marketplace multi-tenant por ciudad · SaaS B2B con suscripciones

> ## ⚠️ DOCUMENTO HISTÓRICO — leer con cuidado
> Este es el **plan original** del proyecto. Sus decisiones de arquitectura y su
> justificación siguen siendo válidas y valiosas (es el "por qué" del proyecto),
> pero **su estado, su modelo de planes y su roadmap están desactualizados**.
>
> - **La hoja de ruta viva es `PENDIENTES.md`.** No planificar desde este archivo.
> - **El estado real del código es `CLAUDE.md`.** No describir el sistema desde acá.
> - Concretamente: el modelo de 2 planes (free/pro) que aparece más abajo fue
>   reemplazado por 4 valores de plan de los que **solo tres se venden**
>   (inicial 20 / profesional 60 / premium 200), donde `free` (límite 1) no es un
>   producto sino el estado de aterrizaje de toda alta. **Ya no existen cuentas de
>   particular**: la app es solo para inmobiliarias. Y toda la "Fase 3" listada
>   más abajo está hecha.

---

## 0. Modelo de Negocio

Marketplace inmobiliario por ciudad, vendido como SaaS a inmobiliarias.

- Una sola web pública por ciudad: el visitante ve en un mapa las propiedades de **todas las agencias de esa ciudad**, las filtra y contacta al agente por WhatsApp.
- Las agencias pagan una **suscripción** para publicar. *(Desactualizado: el modelo vigente son 3 planes de venta — inicial 20 / profesional 60 / premium 200 propiedades — más `free` como estado de aterrizaje, no como producto. Ver `CLAUDE.md`.)*
- **Multi-tenant por debajo**: los datos se separan por `agency_id` y `city_id`. Esto permite, a futuro, activar vistas white-label (cada agencia con su marca y dominio) sin reescribir nada.
- **Multi-ciudad en el diseño, single-city en el lanzamiento**: la base de datos soporta varias ciudades desde el día uno, pero se lanza enfocado en una sola para validar el modelo.

**Por qué marketplace y no white-label aislado:** la concentración de oferta es el valor para el visitante (ver toda la ciudad en un mapa), y el efecto de red atrae más agencias. Un sitio aislado por agencia tiene poco tráfico y poco valor al lanzar.

**Por qué suscripción y no comisión:** el cierre de la operación ocurre por WhatsApp, fuera de la app. No se puede medir la comisión de forma confiable. La suscripción fija es predecible.

**Distribución:** web responsive + PWA instalable. No hay app nativa ni stores — el visitante usa la app pocas semanas y descargar de una store mataría la conversión.

---

## 1. Stack Final Recomendado

| Capa | Tecnología | Por qué |
|---|---|---|
| Framework | Next.js 16 (App Router) + React | Server Components, SEO, Turbopack por defecto |
| Mapa | **react-leaflet** + OpenStreetMap | 100% gratis, enorme ecosistema, tiles sin costo |
| Clustering | `leaflet.markercluster` | Agrupa pines cuando hay muchos inmuebles |
| Estilos | Tailwind CSS + shadcn/ui | Rápido, profesional, sin costo |
| DB + Auth | **Supabase** | Auth para agentes, Storage para fotos, PostGIS para geo |
| PWA | manifest + service worker | Instalable, sin stores |
| Deploy | Vercel | CI/CD automático desde GitHub |
| Formularios | react-hook-form + zod | Validación robusta |
| Estado del mapa | Zustand (liviano) | Compartir filtros sin prop-drilling |

> **¿Por qué react-leaflet y no Mapbox?**
> Leaflet usa tiles de OpenStreetMap (gratis y sin límite), tiene soporte de clustering, dibujo de polígonos y popups. Mapbox requiere tarjeta y tiene límite de requests en el free tier. Para una app comercial, Leaflet es la elección correcta.

---

## 2. Estructura del Proyecto

```
/
├── src/
│   ├── app/
│   │   ├── (public)/                       # Rutas sin auth
│   │   │   ├── page.tsx                    ← Mapa principal (homepage)
│   │   │   ├── [ciudad]/page.tsx           ← Marketplace de una ciudad específica
│   │   │   ├── propiedades/
│   │   │   │   └── [slug]/page.tsx         ← Página SEO de cada inmueble
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (agent)/                        # Rutas protegidas (agentes)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx                ← Resumen: métricas, últimos leads
│   │   │   │   ├── propiedades/
│   │   │   │   │   ├── page.tsx            ← Listado CRUD
│   │   │   │   │   ├── nueva/page.tsx      ← Formulario crear
│   │   │   │   │   └── [id]/editar/page.tsx
│   │   │   │   ├── perfil/page.tsx         ← Datos del agente + foto + WhatsApp
│   │   │   │   ├── preferencias/page.tsx   ← Config de cuenta y notificaciones
│   │   │   │   └── suscripcion/page.tsx    ← Plan actual, límite, upgrade
│   │   │   └── layout.tsx                  ← Sidebar del dashboard
│   │   │
│   │   ├── api/
│   │   │   └── og/[slug]/route.ts          ← Open Graph dinámico por propiedad
│   │   │
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── map/
│   │   │   ├── MapView.tsx                 ← Componente principal del mapa
│   │   │   ├── PropertyMarker.tsx          ← Pin personalizado con precio
│   │   │   ├── PropertyModal.tsx           ← Modal/drawer al hacer click
│   │   │   ├── FilterPanel.tsx             ← Sidebar de filtros
│   │   │   ├── CityPicker.tsx              ← Selector de ciudad
│   │   │   └── ClusterLayer.tsx
│   │   │
│   │   ├── properties/
│   │   │   ├── PropertyCard.tsx            ← Tarjeta en listado
│   │   │   ├── PropertyForm.tsx            ← CRUD form
│   │   │   ├── LocationPicker.tsx          ← Pin manual en mini-mapa (NO geocoding)
│   │   │   ├── ImageUploader.tsx           ← Upload a Supabase Storage
│   │   │   └── WhatsAppButton.tsx          ← Botón con mensaje prellenado
│   │   │
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   ├── PropertiesTable.tsx
│   │   │   └── PlanBadge.tsx               ← Plan y límite restante
│   │   │
│   │   └── ui/                             ← shadcn/ui components
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   ← Supabase browser client
│   │   │   ├── server.ts                   ← Supabase server client (SSR)
│   │   │   ├── admin.ts                    ← Service role (solo server, para subscriptions)
│   │   │   └── middleware.ts               ← Helper de cookies para proxy.ts (≠ Next.js convention)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useProperties.ts            ← Fetch + filtrado de propiedades
│   │   │   ├── useMapFilters.ts            ← Estado global de filtros (Zustand)
│   │   │   ├── useCity.ts                  ← Ciudad activa + geolocalización
│   │   │   ├── useFavorites.ts             ← Favoritos en localStorage (sin login)
│   │   │   └── useWhatsApp.ts              ← Generar URL de WA con mensaje
│   │   │
│   │   └── utils/
│   │       ├── formatPrice.ts
│   │       ├── generateSlug.ts
│   │       └── waMessage.ts                ← Template del mensaje de WA
│   │
│   ├── store/
│   │   └── mapFiltersStore.ts              ← Zustand store
│   │
│   ├── types/
│   │   ├── index.ts                        ← City, Agency, Subscription, Property, etc.
│   │   └── supabase.ts                     ← Tipos auto-generados por Supabase CLI
│   │
│   └── proxy.ts                            ← Convención Next.js 16: auth guard de rutas
│
├── public/
│   ├── markers/                            ← Íconos SVG para el mapa
│   └── manifest.json                       ← PWA manifest
│
└── supabase/
    ├── migrations/                         ← SQL ordenado por fecha
    └── seed.sql                            ← Datos de prueba
```

> **Nota sobre `@/*`**: el alias apunta a `src/*`. Configurado automáticamente con `--src-dir`.
>
> **Nota sobre `proxy.ts`**: en Next.js 16, `middleware.ts` fue renombrado a `proxy.ts` y la función exportada también se llama `proxy`. El archivo `src/lib/supabase/middleware.ts` es un archivo utilitario distinto — no es la convención de Next.js.

---

## 3. Modelo de Base de Datos (Supabase)

> El schema completo y ejecutable está en `03-schema.sql`. Acá va el resumen de las tablas y sus relaciones.

```
cities ──┬──< agencies ──< agents ──< properties ──< property_images
         │         │                       │
         │         └──< subscriptions       └──< leads
         │
         └──────────────< properties (city_id denormalizado)
```

**Tablas:**

| Tabla | Rol | Notas |
|---|---|---|
| `cities` | Mercados | Centro del mapa (`center_lat`/`center_lng`) y `default_zoom` por ciudad |
| `agencies` | Inmobiliarias | Pertenecen a una ciudad (`city_id` NOT NULL); `brand_color` para futuro white-label |
| `subscriptions` | Plan por agencia | `plan` (free/pro), `status`, `property_limit`; una por agencia |
| `agents` | Agentes | `id` = `auth.users.id`; pertenecen a una agencia (`agency_id` NOT NULL) |
| `properties` | Inmuebles | `agency_id` y `city_id` NOT NULL; `city_id` denormalizado para filtrar sin JOIN; `location` GEOGRAPHY generada desde lat/lng |
| `property_images` | Fotos | Vinculadas a una propiedad; portada = `sort_order 0` + `is_cover` |
| `leads` | Consultas WA | Incluye `agency_id` para queries del dashboard |

**Reglas de datos clave:**

- Toda query pública de propiedades filtra por `city_id`. Nunca se mezclan ciudades.
- El límite de propiedades del plan se valida **en la base de datos** con el trigger `check_property_limit`: si una agencia free intenta crear la 6ta propiedad activa, la DB lanza excepción. El frontend lo anticipa y bloquea el botón, pero la DB es la fuente de verdad.
- Las propiedades `sold`/`rented` no ocupan cupo del plan.
- La escritura de `subscriptions` la hace solo el backend con service role, nunca el cliente.

**Decisiones de diseño del schema:**

- **`amenities` como JSONB**: en Argentina los amenities varían mucho (pileta, quincho, SUM, parrilla, laundry, vista al río…). Con JSONB no hay que migrar la DB al agregar uno nuevo. Se filtra con `amenities @> '["pileta"]'`.
- **`city_id` denormalizado en `properties`**: evita un JOIN en la query más frecuente de toda la app (cargar el mapa de una ciudad). Al crear/editar, se copia el `city_id` de la agencia.
- **PostGIS**: la columna `location` se genera automáticamente desde lat/lng. Habilita búsqueda por viewport y por polígono dibujado.

---

## 4. Campos de Filtro del Mapa

El panel lateral del mapa expone estos filtros (la ciudad NO es un filtro, se elige aparte con el `CityPicker`):

| Filtro | Tipo de control | Campo DB |
|---|---|---|
| Tipo de operación | Toggle (Venta / Alquiler) | `operation_type` |
| Tipo de propiedad | Checkboxes múltiples | `property_type` |
| Precio | Slider rango (min/max) | `price` |
| Moneda | Toggle USD / ARS | `currency` |
| M² cubiertos | Slider rango | `area_covered_m2` |
| Dormitorios | Selector (1, 2, 3, 4+) | `bedrooms` |
| Barrio/Zona | Dropdown searchable | `neighborhood` |
| Amenities | Checkboxes múltiples | `amenities` (JSONB contains) |
| Solo destacados | Checkbox | `is_featured` |

> **Mejora sugerida**: botón "Dibujar zona" para que el usuario trace un polígono y filtre por área geográfica usando PostGIS `ST_Within`.

---

## 5. Ciudad Activa y Geolocalización

La ciudad determina qué propiedades se muestran y dónde se centra el mapa. El hook `useCity` la resuelve en este orden:

1. **Selección guardada** del usuario (la última que eligió).
2. **Geolocalización del navegador** (Geolocation API, con permiso): si hay una ciudad cercana habilitada, se usa.
3. **Ciudad por defecto** (centro-norte de Argentina) como fallback.

**Reglas:**
- La geolocalización es opcional. Si el usuario la rechaza, se cae al default sin bloquear nada.
- Nunca mostrar un modal intrusivo pidiendo ubicación al entrar.
- El mapa se centra en `center_lat`/`center_lng`/`default_zoom` de la ciudad activa.
- El `CityPicker` (header) permite cambiar de ciudad en cualquier momento.

---

## 6. Ubicación de Propiedades — Pin Manual

El agente escribe la dirección en texto, pero la posición exacta en el mapa se coloca **manualmente** arrastrando un pin (`LocationPicker`). **No se usa geocoding automático.**

**Por qué:** el geocoding (dirección → coordenadas) consume APIs pagas rápido, y en muchas ciudades los mapas no son precisos, lo que genera ubicaciones erróneas. El pin manual es gratis, preciso, y con un instructivo claro no genera problemas.

El `LocationPicker` arranca centrado en la ciudad de la agencia y muestra un instructivo permanente: "Arrastrá el pin hasta la ubicación exacta del inmueble".

---

## 7. Flujo del Mensaje de WhatsApp

```typescript
// src/lib/utils/waMessage.ts
export function generateWaUrl(params: {
  agentPhone: string;   // "5491112345678"
  userName: string;     // capturado en el modal
  propertyTitle: string;
  propertyAddress: string;
}): string {
  const msg = `Hola, mi nombre es ${params.userName} y me gustaría saber más información sobre ${params.propertyTitle} ubicado en ${params.propertyAddress}.`;
  const encoded = encodeURIComponent(msg);
  return `https://wa.me/${params.agentPhone}?text=${encoded}`;
}
```

**Flujo en el modal:**
1. Usuario hace click en pin del mapa → se abre `PropertyModal` (drawer en desktop, bottom sheet en mobile)
2. Modal muestra fotos, precio, datos clave, descripción
3. Usuario ve botón "Consultar por WhatsApp"
4. Al hacer click → aparece un mini-formulario inline pidiendo solo el **nombre** (1 campo)
5. Al completar nombre → se genera URL de WA y abre en nueva pestaña
6. Simultáneamente se registra el lead en la tabla `leads` (incluyendo `agency_id`)

---

## 8. Roadmap

### MVP — COMPLETO ✓
- [x] Selector de ciudad + geolocalización (cityStore)
- [x] Mapa con pines terracota y clustering (filtrado por ciudad)
- [x] Estados de pin: normal / hover / activo / visitado / destacado / favorito
- [x] CRUD completo de propiedades para agentes
- [x] Panel de filtros en el mapa (checkboxes shadcn, commit on-blur)
- [x] Modal de propiedad con carrusel, flujo WhatsApp y registro de lead
- [x] Lista mobile (cards-first) con PropertyCard
- [x] Auth para agentes (Supabase Auth) con split-screen editorial
- [x] Upload de imágenes (Supabase Storage)
- [x] Suscripciones con límite de plan validado en DB
- [x] Identidad de marca (wordmark "Marka.", favicon, íconos PWA)
- [x] PWA instalable
- [x] Plan visual editorial completo (7 lotes)
- [x] **Deploy a Vercel** ✓ (app en producción)

### Fase 1 — Bugs y quick wins (próximo)
- [ ] **BUG: scroll en blanco** en la página de agregar/editar propiedad (casi el doble de pantalla; probable padding de la barra sticky del Lote 7). Chequear si pasa en otras páginas
- [ ] **BUG: contorno blanco** que rodea la app (vestigio del marco stone 1px; se ve blanquecino sobre fondos oscuros como el sidebar negro y el login). Adaptar al fondo o quitarlo en zonas oscuras
- [ ] **Atajos de navegación**: header público muestra el nombre del agente logueado como link a su dashboard (donde dice "Ingresar"); atajo del dashboard al mapa; wordmark en login/register como link al mapa
- [ ] **Botón "Nueva propiedad"** en el dashboard home (atajo sin entrar a la sección Propiedades)
- [ ] **Pantalla de carga**: splash con el wordmark "Marka." (no barra de progreso — sería decorativa sin progreso real medible)

### Fase 2 — Validación en producción
- [ ] Probar la **PWA instalable** en un teléfono real (ahora posible con HTTPS)
- [ ] Probar el **flujo de WhatsApp** desde un celular real y confirmar registro de leads en vivo
- [ ] Verificar el **service worker** (carga offline mínima)

### Fase 3 — Features profundas — ✅ COMPLETADA (con desvíos; ver notas por ítem)
- [x] **Creación de agencias + roles**: registro de agencia nueva (creador = admin) o unirse por invitación. Roles admin (gestiona suscripción, invita/elimina agentes, ve leads de toda la agencia) y agent (CRUD propio). Límite de plan por agencia
- [x] ~~**Toggle inmobiliaria/particular**~~ — **REVERTIDO (ago 2026).** Se implementó y después se eliminó: la app pasó a ser **solo-agencias** por pedido del rubro (las inmobiliarias que pagan no quieren competir contra particulares gratis ni contra corredores no matriculados). La columna `agencies.tenant_type` sobrevive como legacy. Ver `PENDIENTES.md`.
- [x] **Agente desvinculado**: la propiedad pertenece a la agencia; al eliminar un agente sus propiedades no se borran (se reasignan al admin) y el WhatsApp del lead cae al `phone_wa` de la agencia
- [x] **Selección de plan post-registro** — HECHA, con límites finales distintos a los de esta línea (inicial 20 / profesional 60 / premium 200) y **sin card de free**: el paso 2 ofrece solo los tres planes pagos y el plan pedido queda "pendiente de activación" en `pending_plan`.
- [x] **Activación manual + panel de admin**: el admin de la app activa los planes pagos al recibir la transferencia
- [x] **White-label** (planes Profesional+) — hecha en lo esencial (sub-piezas A, B1, B2a); B2b y C en pausa.: URL `marka.com.ar/[slug-agencia]` con el mapa filtrado a esa agencia. Personalización en Preferencias (color curado, nombre en navbar, logo), "apagada" con botón "Mejorar plan" si el plan no la incluye

### V2 — Escalado y monetización
- [ ] **Cobro automatizado** — integración con MercadoPago/Stripe (reemplaza la activación manual)
- [ ] **Modo oscuro** — esfuerzo grande: requiere rediseñar toda la paleta y revisar el contraste de cada componente. Definir tokens oscuros equivalentes a paper/stone/terracota
- [ ] **Vista "Mis favoritos"** — panel o filtro que liste todos los favoritos guardados juntos
- [ ] **Página SEO por propiedad** (`/propiedades/[slug]`) + Open Graph dinámico
- [ ] **Subdominio white-label** (`agencia.marka.com.ar`) si una agencia grande lo pide
- [ ] **Dashboard analytics** — gráficos de consultas y propiedades más vistas (plan premium)
- [ ] **Nuevas ciudades** — expansión del marketplace
- [ ] **"Propiedades similares"** + **dibujar zona en el mapa** (PostGIS `ST_Within`)
- [ ] **Notificaciones por email** — aviso al agente ante nuevo lead (Resend)
- [ ] **Tour virtual embed** — campo YouTube/Matterport por propiedad

---

## 9. Cómo Usar Claude Pro para Construir Esto

### Projects (lo más importante)
Creá un **Project en Claude.ai** para esta app. Subí al contexto del proyecto:
- Las instrucciones del proyecto (`01-instrucciones-proyecto.md`)
- Este archivo de plan
- El schema SQL (`03-schema.sql`)
- Los types de TypeScript (`04-types.ts`)
- El `CLAUDE.md` y el `DESIGN.md`

Así en cada conversación Claude ya conoce toda la arquitectura sin que lo repitas.

### Flujo de desarrollo recomendado

```
Semana 1 — Base
│
├─ Día 1-2: Schema SQL + Supabase setup
│   └─ Prompt: "Teniendo en cuenta el schema del proyecto, generame las
│              migraciones SQL en orden y el seed con 1 ciudad, 1 agencia,
│              su suscripción y 10 propiedades de prueba"
│
├─ Día 3-4: Auth + Dashboard del agente
│   └─ Prompt: "Generame el layout del dashboard con sidebar, el
│              proxy.ts de auth de Supabase para Next.js 16 App Router,
│              y el formulario de CRUD de propiedades usando react-hook-form y zod"
│
└─ Día 5: CRUD completo + Storage + límite de plan
    └─ Prompt: "Generame el ImageUploader que suba fotos a Supabase Storage,
               y el PlanBadge que muestre el uso del plan y bloquee el alta al límite"

Semana 2 — Mapa
│
├─ Día 1-2: Ciudad + mapa base + markers
│   └─ Prompt: "Generame el useCity con geolocalización y fallback, el CityPicker,
│              y el MapView con react-leaflet, markers con precio visible,
│              clustering y carga solo del viewport actual filtrando por city_id"
│
├─ Día 3: Modal + WhatsApp
│   └─ Prompt: "Generame el PropertyModal (drawer en desktop, bottom sheet en mobile)
│              con carrusel de fotos, datos del inmueble y el mini-formulario de
│              nombre para WhatsApp. Debe registrar el lead en Supabase con agency_id."
│
└─ Día 4-5: Panel de filtros + LocationPicker
    └─ Prompt: "Generame el FilterPanel con todos los filtros (estado en Zustand,
               query dinámica sin n+1) y el LocationPicker con pin manual arrastrable."

Semana 3 — Pulido y deploy
├─ Mobile responsiveness (cards-first) + PWA (manifest + service worker)
├─ SEO pages por propiedad
├─ Variables de entorno para Vercel
└─ Deploy + dominio
```

### Tips de prompting para este proyecto

**Para generar código con contexto:**
> "Usando el schema y los types del proyecto, generame el hook `useProperties` que: (1) fetchee propiedades de Supabase filtrando por `city_id` y aplicando los filtros del Zustand store, (2) solo traiga las del viewport actual del mapa (pasar bounds como parámetro), (3) tenga loading/error state, (4) sea un Server Action o Client Component según corresponda en Next.js 16"

**Para debuggear:**
> Pegá el error completo + el archivo relevante y pedí: "Este es el error que me da. Acá está el archivo completo. Identificá la causa raíz y dame el archivo corregido."

**Para reviews:**
> "Revisá este componente con foco en: (1) performance del mapa con 500+ markers, (2) accesibilidad básica, (3) si hay algún problema con SSR/CSR en Next.js 16"

---

## 10. Variables de Entorno

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Solo en server, nunca en cliente

# No se necesita API key para OpenStreetMap (tiles gratuitos)
# Opcional: Maptiler para tiles más bonitos (free tier = 100k requests/mes)
NEXT_PUBLIC_MAPTILER_KEY=
```

---

## 11. Manual de Usuario

### Para el Visitante (sin registro)
1. **Elegir ciudad** — la app detecta tu ubicación o usa una por defecto; podés cambiarla con el selector
2. **Explorar el mapa** — navegá haciendo zoom y drag como Google Maps
3. **Filtrar propiedades** — usá el panel lateral para acotar por precio, tipo, zona, etc.
4. **Ver detalle** — hacé click en cualquier pin para ver fotos, precio y descripción
5. **Contactar al agente** — en el modal, escribí tu nombre y hacé click en "Consultar por WhatsApp". Se abre WA con el mensaje listo para enviar.
6. **Guardar favoritos** — (V1.1) hacé click en el corazón para guardar en tu navegador, sin registro

### Para el Agente Inmobiliario
1. **Registrarse** — completar datos incluyendo número de WhatsApp; quedás asociado a tu agencia
2. **Cargar propiedad** — Dashboard → Propiedades → Nueva Propiedad
   - Completar los datos del formulario
   - Subir hasta 10 fotos (la primera será la portada)
   - Colocar la ubicación arrastrando el pin en el mini-mapa
3. **Gestionar propiedades** — editar, pausar o marcar como vendida desde el listado
4. **Ver consultas** — en el Dashboard ver los leads recibidos con nombre y fecha
5. **Perfil** — actualizar foto, datos de contacto y número de WhatsApp
6. **Preferencias** — configuración de cuenta y notificaciones
7. **Suscripción** — ver el plan actual, cuántas propiedades usaste del límite, y pasar a Pro

---

## 12. Decisiones de Arquitectura Importantes

### ¿Por qué marketplace y no white-label aislado?
La concentración de oferta en un solo mapa por ciudad es el valor para el visitante, y el efecto de red atrae más agencias. Un sitio aislado por agencia tiene poco tráfico. La arquitectura multi-tenant permite activar white-label a futuro sin reescribir.

### ¿Por qué suscripción y no comisión por venta?
El cierre ocurre por WhatsApp, fuera de la app. No se puede medir la comisión. La suscripción fija es predecible y no depende de rastrear operaciones.

### ¿Por qué multi-ciudad en el diseño pero single-city al lanzar?
Diseñar la DB para multi-ciudad al inicio es barato; migrarla después es carísimo. Se valida el modelo en una ciudad y la arquitectura ya está lista para expandir.

### ¿Por qué PWA y no app nativa?
El visitante usa la app pocas semanas (mientras busca propiedad). El costo de descargar de una store mata la conversión. La PWA da experiencia de app sin stores ni doble base de código.

### ¿Por qué sin registro para el visitante?
Reduce fricción al mínimo. Los favoritos locales (localStorage) alcanzan para el caso de uso; no justifican obligar a registrarse.

### ¿Por qué `src/`?
Preferencia del equipo. Separa el código de la aplicación de los archivos de configuración raíz. El alias `@/*` resuelve a `src/*` automáticamente con `--src-dir`.

### ¿Por qué `amenities` como JSONB?
Los amenities varían mucho. Con JSONB no hay que migrar la DB cada vez que se agrega uno nuevo. Supabase filtra con `amenities @> '["pileta"]'`.

### ¿Por qué no hacer geocoding automático?
Consume APIs pagas y en muchas ciudades los mapas no son precisos. El agente mueve un pin manual en un mini-mapa: más preciso y gratis.

### ¿SSR o CSR para el mapa?
Leaflet requiere el browser (usa `window`). El mapa es Client Component cargado con `dynamic(() => import('@/components/map/MapView'), { ssr: false })`. Los datos se pueden pre-fetchear en Server Components.

### `proxy.ts` reemplaza `middleware.ts` (Next.js 16)
En Next.js 16 la convención cambió de `middleware.ts` a `proxy.ts` y la función de `middleware` a `proxy`. El archivo vive en `src/proxy.ts`. El `src/lib/supabase/middleware.ts` es un utilitario distinto — el helper de cookies de Supabase.

### Async params en páginas con segmentos dinámicos (Next.js 16)
`params` y `searchParams` son Promises. Todas las páginas con rutas dinámicas deben awaitearlo:
```typescript
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
}
```
Afecta a: `[ciudad]`, `propiedades/[slug]`, `dashboard/propiedades/[id]/editar`, `api/og/[slug]`.

### Límite de plan validado en la base de datos
El trigger `check_property_limit` impide superar el `property_limit` de la suscripción a nivel de DB. El frontend lo anticipa (bloquea el botón), pero la DB es la fuente de verdad y no se puede engañar.

### PostGIS para búsqueda geográfica
Habilitado por defecto en Supabase. La query principal del marketplace combina ciudad y viewport:
```sql
SELECT * FROM properties
WHERE city_id = $1 AND status = 'active'
  AND ST_Within(location, ST_MakeEnvelope($west, $south, $east, $north, 4326));
```
La búsqueda "en esta zona" (dibujar polígono) usa `ST_Within(location, ST_GeomFromGeoJSON($polygon))`. Es un diferenciador fuerte frente a competidores que filtran solo por texto.
