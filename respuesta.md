# Implementación — selección de plan como paso 2 del registro

> Se separó la selección de plan del form de registro a una pantalla nueva `/register/plan`. No se tocó el dashboard ni `SubscriptionContent`. No se implementó activación de planes (sigue siendo manual, fuera de este flujo).

## Flujo resultante

1. **Registro** crea siempre la cuenta en `free`/`active` (usuario + agencia + agente + suscripción), como antes del selector.
2. **Particular** (`individual`) → redirige directo a `/dashboard`.
3. **Inmobiliaria** (`agency`) → redirige a `/register/plan` para elegir plan.
4. En `/register/plan`: elige plan → `free` queda `active`, plan pago queda `pending` (con límites de free hasta activación manual). O bien "Por ahora sigo en free" → `/dashboard` sin cambiar nada.

## Archivos tocados (2)

### `src/app/(agent)/register/RegisterForm.tsx`
Revertido todo lo del selector de plan agregado en la tarea anterior:
- Quitado el import `PLANS, PLAN_ORDER`.
- Quitado `plan: z.enum(...)` del schema.
- Quitado `plan: "free"` de `defaultValues`.
- Quitado `plan: data.plan` del payload de `onSubmit`.
- Quitado el bloque del selector de plan (cards) del JSX.
- Intacto todo lo demás: toggle `tenantType`, "Nombre de la inmobiliaria" condicional, ciudad, email, password, phone, etc.

### `src/app/(agent)/register/actions.ts`
- `RegisterData` ya no tiene `plan`; quitado el import `type SubscriptionPlan`.
- Quitada la lógica `effectivePlan` / `status pending`. El upsert de `subscriptions` vuelve a fijar siempre `plan: "free"`, `status: "active"`, `property_limit`/`has_*` de `PLANS.free` (con `onConflict: "agency_id", ignoreDuplicates: true`).
- El `redirect` final ahora depende del tipo de cuenta:
  ```ts
  redirect(data.tenantType === "individual" ? "/dashboard" : "/register/plan");
  ```

## Archivos creados (3)

### `src/app/(agent)/register/plan/page.tsx` (Server Component)
- Verifica sesión con `@/lib/supabase/server` (`auth.getUser()`); sin sesión → `redirect("/login")`.
- Lee el `agency_id` del agente logueado; si no hay agente → `redirect("/login")`.
- Lee `subscriptions.plan` de esa agencia para preseleccionar la card (default `"free"`).
- Renderiza `<PlanSelector currentPlan={...} />`.

### `src/app/(agent)/register/plan/PlanSelector.tsx` (Client Component)
- Reusa el **estilo del selector** que estaba en `RegisterForm` (recuperado antes de borrarlo): cards seleccionables, activo `border-terracota bg-terracota text-paper`, inactivo `border-stone … hover:bg-mist`, transición 120ms.
- Muestra los 4 planes de `PLAN_ORDER` con: nombre (`PLANS[x].name`, Noto Serif), precio (`priceLabel`), y la lista de features de cada plan (límite + destacados/white-label/métricas según corresponda, con `Check` de lucide). Helper `planFeatures` local (NO se importó/extrajo el `PlanCard` del dashboard).
- Estado local de selección (preseleccionado con `currentPlan`), `loading` y `serverError`.
- Botón **"Continuar"** (terracota) → llama a `selectPlanAction(selected)`.
- Link **"Por ahora sigo en free"** → `/dashboard` sin cambiar nada (la cuenta ya quedó en free/active).
- Envuelto en `AuthLayout` (mismo patrón visual editorial que login/register), con claim/subclaim propios (voz DESIGN §10).

### `src/app/(agent)/register/plan/actions.ts` (Server Action)
`selectPlanAction(plan: SubscriptionPlan)`:
- Defensa de input: valida que `plan` esté en `PLAN_ORDER` (no confía en el cliente).
- Sesión con `@/lib/supabase/server`; sin sesión → `redirect("/login")`.
- Deriva `agency_id` del **agente logueado** (`auth.uid()`), nunca de un id del cliente.
- **RLS de `subscriptions`**: como no hay policy de UPDATE para usuarios (la escritura es service role), usa `@/lib/supabase/admin`, pero **acotando el `UPDATE` a `agency_id = agent.agency_id`** (el id viene del agente logueado, validado server-side).
- Actualiza: `plan` elegido, `status: plan === "free" ? "active" : "pending"`, y `property_limit`/`has_*` **siempre** de `PLANS.free` (cupo de free hasta activación manual).
- En éxito → `redirect("/dashboard")`; en error → `{ error }` que el client muestra.

## Verificación

- **`npx tsc --noEmit`**: limpio, sin errores.
- **`npm run lint`**: sin errores ni warnings **nuevos** por estos cambios. Los archivos nuevos (`PlanSelector`, `plan/actions.ts`, `plan/page.tsx`) no generan nada. Lo que queda es preexistente y conocido:
  - **Warnings** (cosméticos RHF + React Compiler, documentados en CLAUDE.md): `RegisterForm.tsx:105` (`watch("tenantType")`) y `PropertyForm.tsx:219` (`watch("currency")`).
  - **Errores preexistentes en archivos NO tocados**: `StatsCard.tsx:26` y `ClusterLayer.tsx:60,62`. Sin relación con esta tarea.

## Fuera de alcance (respetado)
- No se tocó `SubscriptionContent.tsx` ni nada del dashboard.
- No se implementó activación de planes pagos: quedan en `pending` esperando el proceso manual externo.

### Nota de seguridad (RLS)
La server action nunca recibe ni usa un `agency_id` del cliente: lo deriva del `auth.uid()` y acota el `UPDATE` a esa agencia. El admin client (service role) se usa solo porque no existe policy de UPDATE de `subscriptions` para usuarios; la validación de pertenencia es explícita en el servidor.
