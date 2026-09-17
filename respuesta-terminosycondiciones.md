# Inventario de datos personales — insumo para Política de Privacidad y T&C

> Modo diagnóstico, solo lectura. Medido el 17 sep 2026 contra el código de la rama
> `chore/limpieza-inconsistencias` (con cambios sin commitear) y contra la base por MCP
> (usuario de solo lectura). No hay opiniones legales: solo evidencia.

---

## 1. Datos personales en la base

Tablas de `public` (medido en `information_schema.tables`): `agencies`, `agency_reviews`, `agents`,
`cities`, `leads`, `properties`, `property_images`, `subscriptions` (+ `geography_columns`,
`geometry_columns`, `spatial_ref_sys`, que son de PostGIS). **No existe ninguna tabla de visitantes,
usuarios finales, favoritos ni logs propios.**

### `agents` (4 filas)

| Columna | Tipo | Null | ¿Dato de persona? |
|---|---|---|---|
| id | uuid | NO | identificador = `auth.users.id` |
| agency_id | uuid | NO | — |
| **full_name** | text | NO | **nombre** |
| **phone_wa** | text | NO | **teléfono (WhatsApp)** |
| **avatar_url** | text | YES | **foto de perfil** (URL al bucket público) |
| is_active | boolean | YES (default true) | — |
| created_at | timestamptz | YES | fecha de alta |
| role | text | NO (default 'agent') | — |
| **email** | text | YES | **email** (4/4 filas con valor) |

### `agencies` (3 filas)

| Columna | Tipo | Null | ¿Dato de persona? |
|---|---|---|---|
| id | uuid | NO | — |
| city_id | uuid | NO | — |
| **name** | text | NO | razón social / nombre comercial (puede ser nombre de persona física) |
| slug | text | NO | — |
| logo_url | text | YES | logo |
| website | text | YES | sitio web (0/3 con valor; **ningún formulario lo escribe**, ver abajo) |
| brand_color | text | YES | — |
| created_at | timestamptz | YES | — |
| tenant_type | text | NO | — |
| **phone_wa** | text | NO | **teléfono** |
| **license_number** | text | YES | **matrícula del colegio de corredores** (2/3 con valor) |
| approval_status | text | NO | — |
| **previous_name** | text | YES | nombre anterior |
| name_change_requested_at | timestamptz | YES | — |

**CUIT: no encontrado.** Búsqueda: `grep -rni "cuit"` sobre `src`, `public`, `supabase/seed.sql` → 0 resultados, y ninguna columna se llama así en las 8 tablas.
**Dirección de la agencia: no existe columna.** **`website`:** no la escribe ningún camino — no aparece en el insert de `register/actions.ts:88-104` ni en las actions de preferencias (grep de `website` sin resultados en formularios).

### `subscriptions`

`id uuid NO`, `agency_id uuid NO`, `plan text NO`, `status text NO`, `property_limit int NO`, `current_period_end timestamptz YES`, `created_at timestamptz YES`, `updated_at timestamptz YES`, `has_white_label bool NO`, `has_featured bool NO`, `has_metrics bool NO`, `activated_at timestamptz YES`, `pending_plan text YES`, `featured_limit int NO`.
**Sin datos de persona.** No hay datos de pago (tarjeta, CBU, factura): no existe integración de pagos.

### `leads` (13 filas)

| Columna | Tipo | Null | ¿Dato de persona? |
|---|---|---|---|
| id | uuid | NO | — |
| property_id | uuid | NO | — |
| agent_id | uuid | YES | — |
| agency_id | uuid | NO | — |
| **contact_name** | text | NO | **nombre que escribe el visitante** (13/13) |
| source | text | NO (default 'whatsapp') | — (valores medidos: solo `whatsapp`) |
| created_at | timestamptz | YES | fecha/hora de la consulta |
| **agent_name** | text | YES | nombre del agente (copia congelada) |

⚠ **`contact_phone`, `contact_email` y `message` NO EXISTEN en la tabla.** Query: `select string_agg(column_name, ',') from information_schema.columns where table_schema='public' and table_name='leads' and column_name in ('contact_phone','contact_email','message')` → `null`. Por lo tanto el conteo pedido de filas con `contact_phone`/`contact_email` no nulos **no aplica: las columnas no existen**.

### `agency_reviews` (15 filas)

`id uuid NO`, `agency_id uuid NO`, `decision text NO`, **`note text YES`** (11/15 con valor: texto libre que escribe el dueño sobre una agencia, p. ej. el motivo de rechazo), **`reviewed_by uuid YES`** (FK a `auth.users`, id del dueño), `created_at timestamptz NO`.

### `properties` / `property_images` / `cities`

Datos de inmuebles, no de personas, pero publicados: `address text NO`, `neighborhood`, `city`, `province`, `lat`/`lng` (coordenada exacta), `description text` (texto libre del agente), `agent_id`. `property_images.url` = fotos subidas. `views_count` = contador agregado sin identificador de visitante. `cities`: sin datos personales.

### `auth.users` (Supabase Auth) — columnas medidas

`instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, confirmed_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous`.

- Qué usa la app: **email + contraseña** (`register/actions.ts:55-58` `signUp({ email, password })`; `equipo/actions.ts:55-58` `admin.auth.admin.createUser({ email, password, email_confirm: true })`), `perfil/actions.ts:90` `updateUser({ password })`.
- `phone`: 0/4 filas con valor (la app no lo escribe).
- Claves medidas en `raw_user_meta_data`: `email, email_verified, phone_verified, sub` (las pone Supabase; la app no envía metadata).
- `auth.sessions` (medido) guarda además **`user_agent` e `ip`** por sesión, más `created_at`, `refreshed_at`, etc. Lo escribe Supabase, no la app.
- `auth.audit_log_entries`: 0 filas.

### Storage

Un bucket: `property-images`, `public = true` (medido en `storage.buckets`). Contiene fotos de propiedades, **avatares de agentes** (`avatars/{agent_id}/…`) y logos (`logos/{agency_id}/…`). Al ser público, cualquiera con la URL las lee.

### ⚠ Legibilidad pública (evidencia relevante para "a quién llegan")

Policies medidas (`pg_policies`):

- `agents` → `Public read agents`, SELECT, roles `{public}`, `qual = true`.
- `agencies` → `Public read agencies`, SELECT, roles `{public}`, `qual = true`.

Privilegios de columna del rol `anon` (medido con `has_column_privilege('anon', …, 'SELECT')`): **`agents.email`, `agents.phone_wa`, `agents.full_name`, `agents.role`** → `true`; **`agencies.phone_wa`, `agencies.license_number`, `agencies.approval_status`, `agencies.previous_name`** → `true`.
O sea: **con la anon key (que va en el bundle del navegador) cualquiera puede leer email y teléfono de todos los agentes y matrícula/teléfono de todas las agencias**, aunque ninguna pantalla pública los muestre.

`leads.contact_name` tiene privilegio de columna para `anon`, pero las policies de SELECT de `leads` (`Agent reads own leads`: `agent_id = auth.uid()`; `Admin reads agency leads`: por agencia del admin) requieren sesión, así que la RLS no devuelve filas a un anónimo.

---

## 2. Consultas del visitante

`src/lib/utils/registerLead.ts:77-84`:

```ts
const { error } = await supabase.from("leads").insert({
  property_id: propertyId,
  agent_id: agentId,
  agency_id: agencyId,
  contact_name: contactName.trim(),
  source: "whatsapp",
});
```

Llamadores (grep `registerLead`): **dos**.
- `src/components/map/PropertyModal.tsx:240-245` (modal del mapa)
- `src/components/properties/PropertyContact.tsx:71-76` (página pública de la propiedad)

Origen de cada valor (idéntico en los dos):

| Campo | Origen |
|---|---|
| `contact_name` | **lo escribe el visitante** en un input (`userName`, estado local; `PropertyModal.tsx:243` / `PropertyContact.tsx:75`), recortado con `.trim()` |
| `source` | **fijo** `"whatsapp"` (`registerLead.ts:82`) |
| `property_id`, `agent_id`, `agency_id` | de la propiedad (`property.id`, `property.agent_id`, `property.agency_id`), no del visitante |
| `agent_name` | no viaja; lo escribe el trigger `trg_set_lead_agent_name` |
| `contact_phone`, `contact_email`, `message` | **no se envían y no existen** (ver §1) |

El insert va con el browser client y la anon key (`registerLead.ts:1,75`). `created_at` lo pone la base (default `now()`).

**Texto prearmado del enlace de WhatsApp** — `src/lib/utils/waMessage.ts:16-17`:

```ts
const message = `Hola, mi nombre es ${userName} y me gustaría saber más información sobre ${propertyTitle} ubicado en ${propertyAddress}.`;
return `https://wa.me/${agentPhone}?text=${encodeURIComponent(message)}`;
```

`agentPhone` = `agents.phone_wa` del agente de la propiedad. Se abre con `window.open(url, "_blank", "noopener,noreferrer")` (`PropertyModal.tsx:251`, `PropertyContact.tsx:81`). A partir de ahí la conversación (y el teléfono del visitante) queda en WhatsApp/Meta, fuera de la app.

**Conteo:** `leads` total 13, `contact_name` no nulo 13, `source` distintos = `["whatsapp"]`.

**Visitas:** `src/lib/utils/registerView.ts:29` llama `supabase.rpc("increment_views", { property_id })` — solo incrementa `properties.views_count`; no guarda ningún dato del visitante.

---

## 3. Almacenamiento en el navegador

### localStorage (grep `localStorage` en `src`) — 4 claves

| Clave | Qué guarda | Archivo:línea |
|---|---|---|
| `marka_favorites` | array de ids de propiedades favoritas | `src/lib/hooks/useFavorites.ts:6,13,21` |
| `marka_visited` | array de ids de propiedades ya abiertas | `src/lib/hooks/useVisitedProperties.ts:8,12,21` |
| `marka_city` | objeto `City` completo elegido (id, nombre, provincia, centro de la ciudad, zoom) | `src/store/cityStore.ts:5,31,54` — se escribe solo en `setCity`, llamado desde `src/components/map/CityPicker.tsx:127` |
| `marka_preferences` | `{ email_weekly_summary, dark_mode, timezone }` del agente logueado | `src/components/dashboard/PreferencesContent.tsx:5,71,88` |

`marka_preferences.email_weekly_summary` es solo una preferencia en el navegador: **no hay ningún envío de email asociado** (ver §7).

### sessionStorage

**No encontrado.** `grep -rn "sessionStorage" src` → 0 usos.

### Cookies

- **Cookies de sesión de Supabase Auth**, escritas por `@supabase/ssr`:
  - navegador: `createBrowserClient` (`src/lib/supabase/client.ts`);
  - servidor: `src/lib/supabase/server.ts:11-18` (`cookieStore.set`) y `src/lib/supabase/middleware.ts:13-23` (refresco en `src/proxy.ts`);
  - borrado: `src/app/(agent)/logout/route.ts` (`signOut()`).
  - Nombre: `sb-<project-ref>-auth-token` (+ sufijos `.0`, `.1` si se parte), según el comentario de `src/lib/utils/resolveAgentSession.ts:153-154`.
  - Opciones por defecto de la librería (`node_modules/@supabase/ssr/dist/main/utils/constants.js`): `path: "/"`, `sameSite: "lax"`, **`httpOnly: false`**, **`maxAge: 400 días`**. La app no pasa `cookieOptions` propias.
  - Contenido: el token de sesión (JWT con id y email del usuario, más refresh token). Solo existe para agentes logueados; el visitante anónimo no recibe ninguna.
- **"Cookie de descarte":** **no se escribe ninguna cookie propia.** Lo que existe es una **lectura**: `hasAuthCookie()` en `src/lib/utils/resolveAgentSession.ts:170-176` recorre las cookies del request buscando `sb-…auth-token` para evitar consultas si no hay sesión.
- `grep -rn "document.cookie" src` → 0. Ninguna otra cookie propia encontrada.

### Service worker

**No encontrado.** No hay `sw.js` en `public/` (contenido: `file.svg, globe.svg, icon-192.png, icon-512.png, manifest.json, markers, next.svg, vercel.svg, window.svg`), ni `navigator.serviceWorker`/`workbox` en `src` o `public`, ni plugin PWA en `package.json`/`next.config.ts`. Solo existe `public/manifest.json`. (CLAUDE.md dice "PWA manifest + service worker": el service worker no está en el código.)

---

## 4. Geolocalización

Único uso: `src/store/cityStore.ts:73-93` (grep `geolocation` → 1 archivo).

```ts
navigator.geolocation.getCurrentPosition(
  ({ coords }) => {
    const nearest = active.reduce(/* distancia a center_lat/center_lng de cada ciudad */);
    set({ city: nearest, nearbyCityId: nearest.id, isLoading: false });
  },
  () => { set({ city: active[0] ?? null, isLoading: false }); },
  { timeout: 5000, maximumAge: 60_000 }
);
```

- Solo corre si no hay `marka_city` guardada (`cityStore.ts:52-65`) y hay ciudades activas.
- La posición se usa **solo en memoria** para elegir la ciudad más cercana contra la lista de ciudades **ya descargada** (`cityStore.ts:43-47`, consulta previa).
- **No se envía a ningún servidor** (no hay `fetch`/`rpc`/`insert` con `coords` en ese archivo), **no se guarda en localStorage** (el `set` interno no llama a `setCity`, que es el único que escribe `marka_city`), **no va a la base** ni a logs (`grep console` con `coords|lat` → 0).
- `nearbyCityId` guarda el id de la ciudad, no la coordenada.

---

## 5. Terceros que reciben datos

### Analytics / tracking

**No encontrado.** `package.json` no tiene `@vercel/analytics`, `@vercel/speed-insights`, Sentry, GA, PostHog, etc. `grep -rniE "analytics|sentry|gtag|googletagmanager|pixel|posthog|mixpanel|hotjar|plausible|clarity|speed-insights|@vercel"` sobre `src`, `package.json`, `next.config.ts` → sin coincidencias relevantes (única: un comentario en `admin/actions.ts:152`).

### Nominatim (OpenStreetMap)

- **Desde el servidor**, no desde el navegador. El navegador hace `POST /api/geocode` con `{ address }` (`src/components/properties/AddressSearchButton.tsx:72-78`); la ruta exige sesión de agente y resuelve la ciudad en el servidor (`src/app/api/geocode/route.ts:58-80`).
- Request saliente: `GET https://nominatim.openstreetmap.org/search` (`src/lib/geocoding/nominatim.ts:29,108-127`) con:
  - `q` = `dirección, ciudad, provincia, país` (`nominatim.ts:77-81`) — **la dirección que escribe el agente**, sin barrio;
  - `format=jsonv2`, `limit=1`, `addressdetails=0`, `viewbox` (rectángulo alrededor del centro de la ciudad), `accept-language=es`;
  - header `User-Agent` = `GEOCODING_USER_AGENT` o por defecto `"Marka/1.0 (marketplace inmobiliario; https://marka.com.ar)"` (`nominatim.ts:37-43,122-125`).
- No viaja nombre, email, teléfono ni id de usuario. Llega la IP del servidor (Vercel), no la del agente.
- Caché en memoria del proceso servidor, 24 h, máx. 500 entradas (`src/lib/geocoding/index.ts:248` y constantes).

### Recursos externos cargados en el navegador

- **Tiles de OpenStreetMap:** `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (`src/lib/map/tiles.ts:30`). Los pide el navegador del visitante (mapa principal, `LocationPicker` y `StaticMap` de la ficha pública, `src/components/properties/StaticMap.tsx:66-69`) → OSM recibe la IP del visitante, user-agent y las tiles pedidas (que revelan la zona que se mira).
- **MapTiler:** rama alternativa solo si `NEXT_PUBLIC_MAPTILER_KEY` tiene valor (`tiles.ts:18-26`). En `.env.local` la variable está declarada y vacía.
- **Supabase:** el navegador habla directo con `NEXT_PUBLIC_SUPABASE_URL` (consultas públicas, inserts de leads, Storage para fotos). Host de imágenes en `next.config.ts`: `mrvkurpampyucoonwgmy.supabase.co`.
- **Fuentes:** `next/font/google` (`src/app/layout.tsx:2,7-19`). Next las descarga al construir y las sirve desde el propio dominio: en `.next/static/media` hay `.woff2` locales y `grep -rl "fonts.googleapis\|fonts.gstatic" .next/static` → 0. O sea, el navegador **no** pide a Google Fonts (verificado sobre el build local existente).
- **CDNs:** no encontrados. URLs absolutas en `src` (grep `https?://`): solo OSM, Nominatim, MapTiler, `wa.me`, `marka.com.ar` (textos/defaults) y el namespace SVG.
- **WhatsApp (Meta):** `https://wa.me/<phone_wa>?text=<mensaje con nombre del visitante, título y dirección>` (§2). Se abre en otra pestaña; los datos llegan a WhatsApp.
- **Vercel:** hosting (según CLAUDE.md). Recibe todas las requests (IP, user-agent). No hay configuración de logs en el repo.

### Región del proyecto de Supabase

**No verificada.** El MCP disponible (`execute_sql`, `list_tables`, `get_project_url`) no expone la región; no se encontró forma de leerla por SQL.

---

## 6. Registro

Formulario `src/app/(agent)/register/RegisterForm.tsx` → `registerAction` (`register/actions.ts`):

| Campo (label) | Líneas form | Dónde se guarda |
|---|---|---|
| Nombre de la inmobiliaria | 144-152 | `agencies.name` (`actions.ts:90`) + `agencies.slug` derivado (`:85,91`) |
| Matrícula del colegio de corredores | 161-169 | `agencies.license_number` (`:96`) |
| Nombre completo | 178-184 | `agents.full_name` (`:138`) |
| Ciudad (select) | 189-200 | `agencies.city_id` (`:89`) |
| Email | 214-220 | `auth.users.email` (`signUp`, `:55-57`) y `agents.email` (`:140`) |
| Contraseña | 225-231 | `auth.users.encrypted_password` (`signUp`, `:57`) |
| Confirmar contraseña | 238-246 | no se guarda (validación) |
| WhatsApp | 254-261 | `agents.phone_wa` (`:139`) **y** `agencies.phone_wa` (`:103`) |

Paso 2 (`register/plan/`): elección de plan → `subscriptions.pending_plan`/`status`; no pide datos personales.

Alta de agentes por el admin (`dashboard/equipo/actions.ts:17-22,55-80`): nombre, email, WhatsApp, contraseña temporal → `auth.users` (createUser con `email_confirm: true`) + `agents`.

**Aceptación de términos / privacidad: no existe.**
- `grep -rniE "t[eé]rminos|privacidad|condiciones|/legal|acepto|checkbox"` sobre `src/app/(agent)/register` y `src/components/auth` → única coincidencia: un comentario en `PublicHeaderAuth.tsx:18` ("condiciones de fila"), no relacionada.
- Rutas: `find src/app -iname "*termin*" -o -iname "*privac*" -o -iname "*legal*" -o -iname "*condicion*"` → 0. Carpetas públicas existentes en `src/app/(public)`: `page.tsx`, `[slug]`, `propiedades`.

**`reservedSlugs.ts`** (`src/lib/utils/reservedSlugs.ts:152-156`):

```ts
  "terminos",
  "condiciones",
  "privacidad",
  "legales",
  "cookies",
```

- `terminos`, `condiciones`, `privacidad` → **sí** están.
- **`legal` (singular) → NO está**; está `legales`. Búsqueda: `grep -nE '"(terminos|términos|privacidad|legal|condiciones|politica|cookies|terms|privacy)"'` → solo líneas 152, 153, 154, 156.
- `politica`, `terms`, `privacy` → no aparecen con ese grep.

---

## 7. Emails

Llamadas a Supabase Auth que pueden disparar correo (grep `resetPasswordForEmail|signInWithOtp|inviteUserByEmail|generateLink|updateUser|resend|nodemailer|sendgrid`):

| Llamada | Archivo:línea | Email |
|---|---|---|
| `auth.signUp({ email, password })` | `register/actions.ts:55` | email de confirmación **si** "Confirm email" está activo en Supabase. Comentario en `actions.ts:189-190` sugiere desactivarlo; CLAUDE.md afirma que la autoconfirmación está activa (medido por tiempos en `auth.users`, no por la config) |
| `auth.admin.createUser({ …, email_confirm: true })` | `equipo/actions.ts:55-58` | no envía verificación (comentario `:53`) |
| `auth.updateUser({ password })` | `perfil/actions.ts:90` | cambio de contraseña; no envía email salvo que Supabase tenga habilitada una notificación |

- **Recuperación de contraseña: no existe** (`grep -niE "olvid|recuper|reset"` en `LoginForm.tsx` → 0; `resetPasswordForEmail` → 0).
- **Emails propios de la app: no existen** (sin librería de mail en `package.json`, sin nodemailer/resend/sendgrid).
- **Remitente: no configurado en el código.** Si Supabase envía, usa la configuración SMTP/plantillas del panel de Supabase, no verificable desde el repo ni por MCP.
- La app solo muestra enlaces `mailto:hola@marka.app` (ver §9).

---

## 8. Borrado y retención

### Claves foráneas (medido en `pg_constraint`)

```
agencies.agencies_city_id_fkey              -> cities      ON DELETE RESTRICT
agency_reviews.agency_reviews_agency_id_fkey -> agencies   ON DELETE CASCADE
agency_reviews.agency_reviews_reviewed_by_fkey -> auth.users ON DELETE SET NULL
agents.agents_agency_id_fkey                -> agencies    ON DELETE CASCADE
agents.agents_id_fkey                       -> auth.users  ON DELETE CASCADE
leads.leads_agency_id_fkey                  -> agencies    ON DELETE CASCADE
leads.leads_agent_id_fkey                   -> agents      ON DELETE SET NULL
leads.leads_property_id_fkey                -> properties  ON DELETE CASCADE
properties.properties_agency_id_fkey        -> agencies    ON DELETE CASCADE
properties.properties_agent_id_fkey         -> agents      ON DELETE CASCADE
properties.properties_city_id_fkey          -> cities      ON DELETE RESTRICT
property_images.property_images_property_id_fkey -> properties ON DELETE CASCADE
subscriptions.subscriptions_agency_id_fkey  -> agencies    ON DELETE CASCADE
```

- **Eliminar una agencia** (fila en `agencies`): cascadea a `agents`, `subscriptions`, `leads`, `properties` (→ `property_images`, y los leads de esas propiedades), `agency_reviews`. **No** borra `auth.users` (la FK va de `agents` hacia `auth.users`). El camino de la app, `deleteAgencyAction` (`admin/actions.ts`, delete en `:1044-1047`), solo se permite **sin propiedades y sin consultas** (conteo de `leads` en `:970`), borra antes archivos de Storage (logo + avatares) y usuarios de Auth.
- **Eliminar un agente** (borrar `auth.users` → cascadea a `agents`): cascadea a `properties` de ese agente (la app las **reasigna antes** al admin, `deleteAgentAction`), `leads.agent_id` → `SET NULL` (la consulta queda con `contact_name` y `agent_name`), `agency_reviews.reviewed_by` → `SET NULL`. `auth.sessions` de ese usuario: no verificado por FK (esquema `auth`, no medido).
- **Eliminar una propiedad** (`propiedades/actions.ts:459-463`): cascadea a `property_images` **y a sus `leads`** (comentario `:458` y FK medida). O sea, borrar una propiedad **borra las consultas de visitantes** sobre ella.

### Borrado de una consulta individual o de datos de un visitante

**No existe.** Los únicos `.delete()` de la app (grep `\.delete()` en `src`): `admin/actions.ts:1046` (agencies), `propiedades/actions.ts:461` (properties), `propiedades/actions.ts:933` (property_images). Usos de `from("leads")`: solo `select` (admin/page, dashboard, leads/page, equipo/page, admin/actions) e `insert` (registerLead). Tampoco hay policy DELETE sobre `leads` (medido en `pg_policies`).

### Procesos de borrado de datos viejos

**No existe.** Sin extensión `pg_cron` (extensiones medidas: `plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault, postgis, unaccent`; esquema `cron` inexistente), sin crons en el repo. El único proceso de limpieza es manual: `scripts/storage-orphans.ts` (archivos huérfanos del bucket, no datos personales de filas).

---

## 9. Identidad del titular

| Dato | Aparición |
|---|---|
| Nombre de empresa / razón social del titular | **no encontrado** (las apariciones de "razón social" en `RegisterForm.tsx:41,140`, `register/actions.ts:17,73`, `agencyName.ts:1,43`, `preferencias/actions.ts:156,337,415`, `AgencyIdentityForm.tsx:46,197,198` se refieren a la de las inmobiliarias clientes) |
| CUIT | **no encontrado** (`grep -rni cuit` → 0) |
| Marca | "Marka": `public/manifest.json` (`name`, `short_name`, `description: "Marketplace inmobiliario"`), `src/app/layout.tsx:41-44,56-59` (title, siteName, description) |
| Email de contacto | **`hola@marka.app`**: `src/components/dashboard/SubscriptionContent.tsx:167,312,315`; `src/components/dashboard/NewPropertyButton.tsx:238`; `src/components/agency/AgencyUnavailableForAdmin.tsx:138`; `src/app/(agent)/dashboard/suscripcion/actions.ts:113` (texto de error) |
| Dominio | `marka.com.ar`: default de User-Agent `src/lib/geocoding/nominatim.ts:38`; mensaje de error `src/lib/utils/siteUrl.ts:23`; comentarios (`AgencySlugForm.tsx:24`, `[slug]/page.tsx:42`, etc.). ⚠ Dos dominios distintos en el código: `marka.app` (email) y `marka.com.ar` (sitio) |
| Dirección postal | no encontrada |
| Teléfono del titular | no encontrado (las coincidencias de `+54` son del formato de teléfono de los agentes) |
| Footer | no existe footer con datos del titular (grep de las anteriores no lo encontró) |

Búsqueda: `grep -rniE "cuit|raz[oó]n social|@marka|marka\.com|hola@|contacto@|soporte@|\+54|S\.A\.|S\.R\.L"` sobre `src`, `public`, `supabase/seed.sql`.

---

## 10. Qué ve el dueño de la plataforma (`/admin`)

Consulta principal, `src/app/(agent)/admin/page.tsx:110-112`:

```
id, name, slug, license_number, approval_status, previous_name, name_change_requested_at,
subscription:subscriptions(plan, pending_plan, status, activated_at, current_period_end, property_limit, featured_limit, has_white_label, has_metrics),
city:cities(name)
```

Renderizado en `AgenciesTable.tsx`: nombre de la agencia (`:1048`, `:1160`), matrícula (`:1062-1064`, `:1164`, `:1380-1381`), nombre anterior tachado (`:343`, `:1491`), ciudad (`:1053-1055`, `:1165`), plan y estado.

- **Agentes:** solo un **conteo** (`admin/page.tsx:143`, `select("*", { count: "exact", head: true })`). No se listan nombres, emails ni teléfonos.
- **Consultas:** solo **conteos** (`admin/page.tsx:151-152`, `:164` trae `agency_id` para contar por agencia). No se muestra `contact_name`.
- **Historial:** `agency_reviews` con `agency_id, decision, created_at` (`admin/page.tsx:189-190`); la `note` se escribe desde el panel (`admin/actions.ts:215,276,387-416`) pero esa lectura del panel no la trae.
- Teléfono de la agencia (`agencies.phone_wa`), email/teléfono de agentes: **no se seleccionan ni muestran** en `/admin`.

(Fuera de `/admin`: el admin de una agencia ve en `/dashboard/equipo` `id, full_name, email, phone_wa, role, created_at` de sus agentes — `equipo/page.tsx:25` — y en `/dashboard/leads` `contact_name, created_at, source, agent_name`, nombre del agente y título de la propiedad — `leads/page.tsx:35-37`, `LeadsContent.tsx:131-145`.)

---

## Cosas que no pude verificar

1. **Región del proyecto de Supabase** — el MCP no la expone y no hay forma por SQL.
2. **Configuración de Supabase Auth** (si "Confirm email" está activo, plantillas, remitente SMTP, notificación de cambio de contraseña, duración de sesiones/refresh tokens) — vive en el panel de Supabase, no en el repo ni en el MCP.
3. **Retención de logs de Supabase** (API, Auth, Postgres, IPs) — no medida; depende del plan de Supabase.
4. **Logs y analytics de Vercel** (IPs, user-agents, si hay Web Analytics activado desde el panel sin paquete) — no hay nada en el repo; la configuración del proyecto en Vercel no es accesible.
5. **Si el build de producción desplegado es igual al local** (p. ej. fuentes servidas localmente): verificado solo sobre `.next` local.
6. **Qué hace el navegador del visitante con las tiles de OSM y con WhatsApp** (políticas de OpenStreetMap Foundation / Meta) — fuera del código.
7. **Cascada sobre `auth.sessions`, `auth.identities`, `auth.refresh_tokens` al borrar un usuario** — esquema `auth` no medido por FK.
8. **Valor real de `GEOCODING_USER_AGENT` y `NEXT_PUBLIC_MAPTILER_KEY` en producción** — en `.env.local` solo se vieron los nombres de variables (no leí valores); la de MapTiler figura vacía según el comentario de `StaticMap.tsx:20-21`, no según producción.
9. **Si existe algún service worker registrado en producción** que no esté en el repo — no encontrado en el código.
10. **Region/datos de backups de Supabase y de Storage** — no accesibles.
