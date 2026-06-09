# Separación "plan que rige" vs "plan pedido" en subscriptions

> Cambio de modelo coordinado: `plan` = el plan que RIGE hoy (límites/has_* efectivos), `pending_plan` = el plan pago pedido esperando activación (null si no hay), `status` = 'pending' mientras hay un `pending_plan`. Ahora pedir un upgrade NO pisa `plan` (ese era el bug). Verificado: tras el cambio, `plan` SIEMPRE es el que rige en todos los lugares que lo leen.

## Archivos tocados (9)

### 1. `src/types/index.ts`
- `Subscription`: agregado `pending_plan: SubscriptionPlan | null` después de `plan`, con comentario (plan pago pedido esperando activación; `plan` sigue siendo el que rige).

### 2. `src/app/(agent)/dashboard/suscripcion/actions.ts` (pedir upgrade)
- `requestPlanUpgradeAction` ahora setea **`pending_plan = <pedido>`** y `status: "pending"`. **Ya no toca `plan`** (antes lo pisaba — bug corregido). Seguridad y validación (plan pago, `agency_id` del `auth.uid()`, admin client acotado) quedan igual.

### 3. `src/app/(agent)/register/plan/actions.ts` (registro paso 2)
- Plan pago elegido → `plan: "free"` (rige free), `pending_plan: <elegido>`, `status: "pending"`.
- Free elegido → `plan: "free"`, `pending_plan: null`, `status: "active"`.
- `property_limit`/`has_*` siempre de free (rige free hasta activación). Antes guardaba el plan pago en `plan`; corregido para que vaya a `pending_plan`.

### 4. `src/app/(agent)/admin/actions.ts` (activar)
- Lee **`pending_plan`** (no `plan`). Si es `null` → error "Esa agencia no tiene un plan pendiente que activar".
- Al activar: **`plan = pending_plan`** (lo pedido pasa a regir), `property_limit`/`has_*` con los valores reales de `PLANS[pending_plan]`, `status: "active"`, `activated_at = now()`, y **`pending_plan: null`** (se limpia).

### 5. `src/app/(agent)/admin/page.tsx` + `AgenciesTable.tsx` (panel admin)
- **page**: el `select` ahora trae `pending_plan`; se mapea a `AgencyRow.pending_plan`.
- **AgenciesTable**:
  - `AgencyRow` suma `pending_plan: SubscriptionPlan | null`.
  - Nueva columna **"Pidió"**: muestra `PLANS[pending_plan].name` en terracota, o "—". La columna "Plan" sigue mostrando el que **rige**; "Límite" el efectivo del que rige.
  - El botón **Activar** aparece cuando `pending_plan != null` (antes: `status === 'pending'`). El badge "Pendiente" sigue por `status`.
  - El `AlertDialog` ahora referencia el `pending_plan` ("¿Activar plan {pedido}?" · "El plan pedido pasará a regir…").
  - Cards mobile: línea "Pidió {plan}" cuando hay pendiente.

### 6. `src/lib/utils/getPlanUsage.ts`
- **Confirmado correcto**: ya leía y devolvía `plan` (el que rige) y los `property_limit`/`has_*` efectivos. No lee `pending_plan`, así que no lo confunde con el efectivo. Solo se agregó un comentario aclaratorio (devuelve el que rige; el badge del sidebar / dashboard / bloqueo de "Nueva propiedad" usan esto → free sigue siendo límite 1 aunque haya upgrade pendiente).

### 7. `src/components/dashboard/SubscriptionContent.tsx`
- Nuevo prop **`pendingPlan: SubscriptionPlan | null`** (además de `status`). `hasPendingRequest = status === 'pending' && pendingPlan !== null`.
- La card del **plan actual** es la de `plan` (el que rige) — siempre "Plan actual".
- La card cuyo `info.id === pendingPlan` muestra badge + botón **"Pendiente"** (deshabilitado) + "Pendiente de activación · escribinos para cancelar".
- Si `hasPendingRequest`, las demás cards de upgrade quedan **deshabilitadas**.
- Se mantiene DESIGN §12 (barra de uso, cards `flex-wrap`, recomendado, AlertDialog de confirmación del pedido).

### 8. `src/app/(agent)/dashboard/suscripcion/page.tsx`
- El `select` trae `pending_plan` (además de `status`, `current_period_end`); pasa `pendingPlan` a `SubscriptionContent`.

### 9. `src/app/(agent)/register/plan/page.tsx`
- Preselección del `PlanSelector`: prefiere `pending_plan` si existe, si no `plan`, si no `free`. (Coherencia al revisitar el paso 2 con un pedido ya hecho.)

## Revisión de usos de `.plan` (subscriptions)
Recorridos todos los `.from("subscriptions")` y lecturas de `.plan`:
- `getPlanUsage` → `plan` (rige) ✓
- `admin/actions` → ahora `pending_plan` para activar ✓
- `admin/page`/`AgenciesTable` → `plan` (rige) + `pending_plan` (pedido) ✓
- `register/plan/page` → `pending_plan ?? plan` para preseleccionar ✓
- `suscripcion/page`/`SubscriptionContent` → `plan` (rige) + `pendingPlan` ✓
- `register/actions` (alta inicial) → `plan: 'free'`/`active`, sin `pending_plan` (default null) ✓ — sin cambios, ya correcto.
- Escrituras de upgrade/registro/activación → ajustadas (puntos 2/3/4).
**Ningún lugar lee `plan` esperando el pedido.** `plan` es siempre el que rige.

## Verificación
- **`npx tsc --noEmit`**: limpio, sin errores.
- **`npm run lint`**: sin errores ni warnings **nuevos**. Quedan los 5 preexistentes conocidos (warnings `watch` de RHF en `RegisterForm.tsx`/`PropertyForm.tsx`; errores en `StatsCard.tsx:26` y `ClusterLayer.tsx:60,62`, archivos no tocados).

## Fuera de alcance (respetado)
- No se implementó cancelar el pedido (el cliente escribe para cancelar).
- La activación es el único lugar que cambia el plan que rige y limpia `pending_plan`.

## Nota
El alta inicial (`register/actions.ts`) no setea `pending_plan` explícitamente: depende del **default de la columna en la base** (se asume `null`). Si la columna no tuviera default null, habría que setearlo explícito; no se puede verificar el default leyendo el repo.
