# Implementación — panel de admin de plataforma (/admin) · v1 activar planes

> Panel solo para el dueño, para activar planes pagos en `status: 'pending'`. v1 = solo activar (no desactivar/downgrade, ni gestión de usuarios, ni métricas, ni `current_period_end`).

## Seguridad (lo primero)

- **Identidad por `process.env.ADMIN_USER_ID`** (server-side, SIN `NEXT_PUBLIC_`): un UUID = el `auth.uid()` del dueño.
- **Verificación en dos lugares**: (a) el Server Component `/admin` y (b) la server action `activatePlanAction`. La action es la defensa real (la UI no alcanza).
- **Fail-closed**: si `ADMIN_USER_ID` es `undefined`, se deniega (nunca "si no hay env, permitir"). En la action → `{ error: "Acción no autorizada" }`; en la página → `redirect("/dashboard")`.
- **No se revela que la ruta existe**: un no-admin con sesión es redirigido a `/dashboard` (sin error explícito).

## Archivos creados (3)

### `src/app/(agent)/admin/page.tsx` (Server Component)
- `createClient()` (`@/lib/supabase/server`) → `getUser()`. Sin user → `redirect("/login")`.
- `const adminUserId = process.env.ADMIN_USER_ID;` → si `!adminUserId || user.id !== adminUserId` → `redirect("/dashboard")` (fail-closed + no revela la ruta).
- Lee pendientes con **admin client (service role)** porque la policy de SELECT de `subscriptions` es por agencia propia:
  ```ts
  .from("subscriptions")
  .select("agency_id, plan, status, agencies(name, slug, tenant_type)")
  .eq("status", "pending")
  .order("created_at", { ascending: false })
  ```
- Normaliza el embedding `agencies(...)` (objeto o array según inferencia) a `PendingRow[]` y renderiza `<PendingAgenciesTable rows={...} />`.
- **Layout propio** (NO el sidebar del agente — es panel de plataforma): `min-h-screen bg-mist`, header con `Wordmark` + etiqueta "Admin de plataforma", `h1` `font-serif text-4xl` "Activación de planes", coherente con DESIGN.md. (Confirmado que `/admin` no hereda sidebar: el sidebar vive en `(agent)/dashboard/layout.tsx`, no en `(agent)/layout.tsx`.)

### `src/app/(agent)/admin/PendingAgenciesTable.tsx` (Client Component)
- Visual **modelado sobre `PropertiesTable`** (no importado, copiado): tabla desktop + cards mobile + badge + `useTransition` + banner de error + `AlertDialog`.
- Por fila: nombre de la agencia, plan elegido (`PLANS[plan].name`), precio (`priceLabel`), límite al activar (`propertyLimit`), badge "Pendiente" y botón **"Activar"**.
- **`AlertDialog` de confirmación** antes de activar: "¿Activar plan {X}?" + "para {agencia}".
- Al confirmar → `activatePlanAction(agencyId)`. Estados: `loading` por fila (opacity + disabled), `error` banner. **Tras éxito → `router.refresh()`** (la fila desaparece porque ya no está pending).
- **Estado vacío** constructivo: "No hay planes pendientes de activación."
- Exporta el tipo `PendingRow` (consumido por la página).

### `src/app/(agent)/admin/actions.ts` (Server Action)
`activatePlanAction(agencyId: string)`:
- `"use server"`.
- Valida `agencyId` string no vacío.
- **Identidad admin** (obligatoria): `adminUserId = process.env.ADMIN_USER_ID`; si falta → `{ error }`. `getUser()`; sin user → `redirect("/login")`; `user.id !== adminUserId` → `{ error: "Acción no autorizada" }`.
- Lee el plan elegido: `.from("subscriptions").select("plan").eq("agency_id", agencyId).single()`. Si no existe → error.
- Si el plan es `"free"` → error claro ("no hay nada que activar"), no "activa free".
- Actualiza con admin client: `status: "active"`, `property_limit/has_*` con los valores **reales** de `PLANS[plan]`. **`current_period_end` NO se toca** (V2).
- Devuelve `{ error }` en fallo; en éxito **sin redirect** (el client refresca).

## Archivos tocados (2)

### `src/proxy.ts`
- Agregado `"/admin"` a `PROTECTED_PREFIXES` (primera barrera: exige sesión → redirige a `/login` si no hay). La autorización de identidad NO va acá; va en el server component y la action.

### `CLAUDE.md`
- Sección "Variables de Entorno": agregada `ADMIN_USER_ID` con comentario (server-side, SIN `NEXT_PUBLIC_`, el `auth.uid()`/UUID del dueño, requerida para `/admin`, fail-closed si no está).

## Verificación

- **`npx tsc --noEmit`**: limpio, sin errores.
- **`npm run lint`**: sin errores ni warnings **nuevos**. Los 3 archivos admin no generan nada. Lo que queda es preexistente y conocido:
  - **Warnings** (RHF + React Compiler, documentados en CLAUDE.md): `RegisterForm.tsx:105`, `PropertyForm.tsx:219`.
  - **Errores preexistentes en archivos NO tocados**: `StatsCard.tsx:26`, `ClusterLayer.tsx:60,62`. Sin relación con esta tarea.

## Fuera de alcance (respetado)
- No se implementó desactivar/downgrade, gestión de usuarios, métricas ni manejo de `current_period_end`.
- No se tocó el dashboard del agente ni `SubscriptionContent`.

## Pendiente del lado del operador (no es código del repo)
- **Definir `ADMIN_USER_ID`** en `.env.local` y en Vercel con tu `auth.uid()` real. Sin esa env, `/admin` deniega a todos (fail-closed, por diseño). Esto no se puede setear ni verificar desde el repo.
