# Diagnóstico — Admin de agencia edita/elimina/reasigna propiedades de toda la agencia

> Estado real a 11 jun 2026, leído de archivos. Nada modificado.
> Objetivo: que un `admin` de agencia pueda editar, eliminar y **reasignar el
> agent_id** de las propiedades de TODA su agencia (hoy cada agente solo toca lo
> suyo). Foco en seguridad de escritura. Estado antes de diseñar.

---

## 1. Server actions de propiedades — `propiedades/actions.ts`

**Todas operan con el CLIENT NORMAL** (`createClient` de server.ts, respeta RLS). **No hay admin client en ninguna.** El gating de "solo lo mío" se hace en DOS capas: (a) el helper `verifyOwnership` en la action, y (b) la RLS `Agent manages own properties` (§2).

### `verifyOwnership(id)` — la pieza central (líneas 44-66)
```ts
async function verifyOwnership(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado", supabase };

  const { data: owned } = await supabase
    .from("properties")
    .select("id")
    .eq("id", id)
    .eq("agent_id", user.id)        // ← clave: solo si la propiedad es del agente
    .maybeSingle();

  if (!owned) return { ok: false, error: "Propiedad no encontrada", supabase };
  return { ok: true, supabase };
}
```
Es lo que garantiza hoy que **un agente solo toque lo suyo**: filtra por `agent_id = user.id`. Si la propiedad es de otro agente (aunque sea de la misma agencia), devuelve "Propiedad no encontrada". **Para que el admin gestione lo ajeno, este helper hay que reemplazarlo/ampliarlo** (a "es dueño O es admin de la agencia de esa propiedad").

### Acciones de cambio de estado (pause/activate/markSold/markRented)
Todas idénticas en forma: `verifyOwnership(id)` → si ok, `supabase.from("properties").update({ status }).eq("id", id)` → `revalidatePath`. `activatePropertyAction` además captura el error `23514`/"Límite" del trigger (reactivar puede toparse con el límite del plan).

### `deletePropertyAction(id)` (129-142)
`verifyOwnership` → `.delete().eq("id", id)`. Comentario: `ON DELETE CASCADE` borra `property_images` y `leads`; las imágenes del Storage NO se borran solas.

### `createPropertyAction(data)` (146-245)
- `getUser()` → sin user, "No autenticado".
- Deriva del **servidor** (nunca del cliente): `agency_id` desde la fila `agents` del user; `city_id`/`city`/`province` desde agency→city.
- `is_featured` se gatea por `getPlanUsage(...).hasFeatured` (no por nombre de plan).
- Insert con `agent_id: user.id`, `agency_id` derivado, `status: "active"`. Captura `23514`/"Límite".
- Imágenes: insert aparte; si falla, NO rollback (avisa "se guardó pero faltan imágenes").

### `updatePropertyAction(id, data)` (249-331)
- **`verifyOwnership(id)`** primero (mismo gating por `agent_id`).
- Re-lee `agency_id` de la propiedad para recalcular `hasFeatured`.
- `update({...campos...}).eq("id", id)`. **NO toca `agent_id` ni `agency_id`** hoy (no están en el payload). Captura `23514`/"Límite".
- Imágenes: delete + re-insert (reemplazo total).

**Resumen seguridad actual:** doble barrera (verifyOwnership por `agent_id` + RLS por `agent_id`). Ninguna action escribe `agent_id` tras la creación → **reasignar no existe hoy en ninguna forma**.

---

## 2. Policies RLS de `properties` (del schema)

Tres policies. La de escritura es **una sola `FOR ALL`**, no hay UPDATE/DELETE separadas:

```sql
-- SELECT público: solo activas
CREATE POLICY "Public read active properties"
  ON properties FOR SELECT USING (status = 'active');

-- ESCRITURA (y lectura del dueño): UNA sola, FOR ALL
CREATE POLICY "Agent manages own properties"
  ON properties FOR ALL USING (agent_id = auth.uid());

-- SELECT de toda la agencia (para getPlanUsage en agencias multi-agente)
CREATE POLICY "Agency members read agency properties"
  ON properties FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM agents WHERE id = auth.uid()));
```

**Condición exacta de escritura: `agent_id = auth.uid()`** en un `FOR ALL`. Detalle crítico de Postgres para el rediseño:

- Un `FOR ALL ... USING (cond)` **sin `WITH CHECK` explícito** usa la misma `USING` como `WITH CHECK` para INSERT/UPDATE. O sea: al hacer UPDATE, **la fila resultante también debe cumplir `agent_id = auth.uid()`**.
- **Implicancia directa para "reasignar":** cambiar `agent_id` a OTRO agente vía client normal **fallaría el WITH CHECK** (el nuevo `agent_id` ≠ `auth.uid()`), aunque agregáramos una policy de lectura para admin. Reasignar **no es viable con el client normal bajo estas policies** sin una policy nueva que tenga un `WITH CHECK` más amplio (por agencia), o directamente service role (§9, opción B).

`property_images` tiene su propia `FOR ALL` análoga: `EXISTS(... p.agent_id = auth.uid())` — también atada al agente dueño, no a la agencia.

---

## 3. ¿Crear y editar comparten formulario?

**Sí, el mismo componente `PropertyForm`** para ambos. Distingue por el prop **`mode: "create" | "edit"`** (no por presencia de id). Props (líneas 84-91):
```ts
interface PropertyFormProps {
  mode: "create" | "edit";
  initialData?: Property;   // presente solo en edit
  agentId: string;
  agencyId: string;
  cityId: string;
  cityCenter: { lat: number; lng: number };
}
```
- `nueva/page.tsx` → `<PropertyForm mode="create" agentId agencyId cityId cityCenter />`.
- `[id]/editar/page.tsx` → `<PropertyForm mode="edit" initialData={property} ... />`.
- En `onSubmit` (líneas 231-309): `if (mode === "create") createPropertyAction(...) else updatePropertyAction(initialData!.id, ...)`.

**Implicancia:** un campo nuevo "agente asignado" puesto sin condición **aparecería en create Y edit**. Para esta feature conviene gatearlo: solo en `mode === "edit"` **y** solo si el usuario es admin de agencia (pasar un prop tipo `canReassign` / `agencyAgents` desde la página, que ya resuelve el rol server-side).

---

## 4. Formulario de edición — campos y cómo cargar el selector de agente

### Campos actuales (del zod `schema`, líneas 51-78)
title, description, property_type, operation_type, **status** (solo en edit, enum active/paused/sold/rented), price, currency, price_negotiable, area_total_m2, area_covered_m2, bedrooms, bathrooms, parking_spots, floor_number, address, neighborhood, lat, lng, amenities, year_built, is_featured. **No hay campo de agente.**

### Valores iniciales
En edit, `defaultValues` se arma desde `initialData` (la propiedad), que la página `[id]/editar/page.tsx` trae con `.select("*, images:...").eq("id", id).eq("agent_id", user.id).single()` — **hoy filtra por `agent_id = user.id`**, así que un admin no podría abrir la edición de una propiedad ajena (la query devuelve null → redirect). Esto también hay que ampliarlo para admin.

### Selector "agente asignado" — ¿hay query reusable?
**Sí.** La página de Equipo (`equipo/page.tsx`) ya lista los agentes de una agencia:
```ts
supabase.from("agents")
  .select("id, full_name, email, phone_wa, role, created_at")
  .eq("agency_id", agent.agency_id)
  .order("created_at", { ascending: true });
```
Esa query (acotada a `id, full_name`) es exactamente lo que alimentaría un `<Select>` de agente asignado. La lectura de `agents` es pública por RLS, así que no hay problema de permisos para listarlos. El patrón: la página `[id]/editar` (cuando el user es admin) trae los agentes de la agencia y se los pasa a `PropertyForm` como prop para poblar el selector. El form ya usa `<Select>` de shadcn para otros campos (tipo/operación), así que el componente está disponible.

---

## 5. Implicancias de cambiar `agent_id`

### Leads
El lead se inserta en `PropertyModal.tsx` (flujo público de WhatsApp) copiando **`agent_id: property.agent_id`** de la propiedad en ese momento. Por lo tanto:
- **Leads NUEVOS tras reasignar → van al nuevo agente automáticamente** (la propiedad ya tiene el nuevo `agent_id`, y el modal lo copia).
- **Leads VIEJOS quedan con el agente anterior** (su `agent_id` se grabó al crearse; no es retroactivo, no hay trigger ni cascada que los reescriba). Confirmado: la reasignación NO reescribe leads históricos.
- Efecto colateral en la pantalla de Consultas: un lead viejo seguiría "perteneciendo" al agente anterior (lo ve él por `Agent reads own leads`); el admin los ve todos igual por `Admin reads agency leads`.

### Conteo del plan (`getPlanUsage`)
**Cuenta por `agency_id`, no por agente** (confirmado: `getPlanUsage.ts` consulta `properties ... .eq("agency_id", ...)`). Reasignar dentro de la MISMA agencia **no cambia el conteo** → no afecta el límite. Correcto.

### Trigger `check_property_limit` ante un UPDATE que solo cambia `agent_id`
**No se dispara la validación de límite.** El trigger es `BEFORE INSERT OR UPDATE`, pero la rama que lanza el error solo aplica si (líneas 261-263):
```sql
(TG_OP = 'INSERT' AND NEW.status IN ('active','paused'))
OR (TG_OP = 'UPDATE' AND NEW.status IN ('active','paused')
    AND OLD.status NOT IN ('active','paused'))   -- solo al REACTIVAR
```
Un UPDATE que cambia `agent_id` con el `status` sin tocar (sigue 'active') tiene `OLD.status = 'active'` → la condición `OLD.status NOT IN ('active','paused')` es **falsa** → **el chequeo se saltea**. Reasignar el agente **no puede toparse con el límite**. Seguro.

> Nota: el trigger cuenta por `NEW.agency_id`. Como la reasignación es dentro de la misma agencia, `agency_id` no cambia; aunque el chequeo corriera, sería consistente. Reasignar a otra AGENCIA está fuera de alcance (y rompería el modelo multi-tenant) — el selector debe ofrecer solo agentes de la misma agencia.

---

## 6. Listado de propiedades — `propiedades/page.tsx`

- **Filtra por `agent_id = user.id`** (líneas 24-30): solo las del agente. **La página NO lee `role`** — el select de `agents` trae solo `agency_id`. Para que el admin vea las de toda la agencia hay que: (a) leer `role`, (b) si admin, filtrar por `agency_id` en vez de `agent_id`.
- Arma: header con `PlanBadge` + `NewPropertyButton`, y `<PropertiesTable properties={...} />`.
- **`PropertiesTable` → `ActionMenu` por fila expone:** Editar (link a `/[id]/editar`), Pausar/Activar (según status), Marcar vendida (si venta), Marcar alquilada (si alquiler), Eliminar (con AlertDialog de confirmación). Todas llaman a las actions de §1, que hoy rebotan en `verifyOwnership` si la propiedad no es del user.
- Si el admin va a ver propiedades ajenas, la tabla **podría querer una columna "Agente"** (de quién es cada propiedad) — hoy no existe; `PropertyRow` no trae el agente. Sería un agregado.

---

## 7. Patrón existente de "action service-role que valida role === 'admin'"

**Sí, `createAgentAction`** (`equipo/actions.ts`) es el molde exacto a reusar para la opción B:
```ts
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { error: "No autenticado" };

// Autorización: admin de SU agencia. agency_id sale de acá, jamás del cliente.
const { data: caller } = await supabase
  .from("agents").select("agency_id, role").eq("id", user.id).single();
if (!caller) return { error: "No autenticado" };
if (caller.role !== "admin") return { error: "No autorizado" };
const agencyId = caller.agency_id;

// Recién entonces, service role para la operación que salta RLS:
const admin = createAdminClient();
// ... admin.from(...).insert/update(...)
```
Claves del patrón a replicar: (1) rol leído del server, (2) `agency_id` derivado del caller, (3) service role solo para la escritura, (4) **validar que el target pertenece a la misma agencia** antes de escribir. Para reasignar habría que sumar: validar que el `agent_id` destino sea un agente de `agencyId` (un `select id from agents where id = nuevoAgente and agency_id = agencyId`), y que la propiedad a editar también sea de `agencyId`.

---

## 8. Todos los puntos de escritura de `properties` en `src/`

**Único archivo que escribe `properties`: `propiedades/actions.ts`.** Verificado con grep de insert/update/delete:

| Función | Operación | Gating |
|---|---|---|
| `pausePropertyAction` | UPDATE status='paused' | verifyOwnership |
| `activatePropertyAction` | UPDATE status='active' | verifyOwnership |
| `markAsSoldAction` | UPDATE status='sold' | verifyOwnership |
| `markAsRentedAction` | UPDATE status='rented' | verifyOwnership |
| `deletePropertyAction` | DELETE | verifyOwnership |
| `createPropertyAction` | INSERT | getUser + agency derivada |
| `updatePropertyAction` | UPDATE (campos) | verifyOwnership |
| (create/update) | INSERT/DELETE `property_images` | ídem |

El resto de menciones a `properties` en el grep son **lecturas**: `admin/page.tsx` (count), `dashboard/page.tsx` (counts/recientes), `[id]/editar/page.tsx` (trae la prop), `propiedades/page.tsx` (listado), `PropertyModal.tsx:445` (SELECT para el modal — el insert ahí es a `leads`, no a properties), `useProperties.ts` (mapa), `getPlanUsage.ts` (conteo).

- **`is_featured`**: NO se togglea desde la tabla ni desde el modal. Se setea **solo** vía `createPropertyAction`/`updatePropertyAction` (campo del form, gateado por `hasFeatured`). No hay otro punto.
- **`increment_views`**: el modal lo menciona como pendiente (RPC SECURITY DEFINER), no está implementado; no escribe `properties` hoy.

**Conclusión:** la superficie de escritura de `properties` es UNA sola (`propiedades/actions.ts`). Cualquier cambio de permisos se concentra ahí — no hay escrituras dispersas que auditar.

---

## Resumen para la decisión A vs B

| Tema | Estado |
|---|---|
| Gating actual | `verifyOwnership` (`agent_id = user.id`) + RLS `agent_id = auth.uid()`. Doble barrera |
| RLS de escritura | UNA `FOR ALL USING (agent_id = auth.uid())`. Sin WITH CHECK explícito → **el UPDATE valida el nuevo `agent_id` contra auth.uid()** |
| **Reasignar con client normal** | **Inviable bajo la RLS actual**: el WITH CHECK implícito rechaza un `agent_id` ≠ auth.uid(). Requiere policy nueva con WITH CHECK por agencia (opción A) **o** service role (opción B) |
| Form crear/editar | Mismo `PropertyForm`, `mode` prop. Campo nuevo aparecería en ambos → gatear a edit + admin |
| Editar prop ajena | Bloqueado hoy: `[id]/editar` y `verifyOwnership` filtran por `agent_id = user.id` → ampliar a "admin de la agencia" |
| Selector de agente | Reusar la query de Equipo (`agents` por `agency_id`), acotada a `id, full_name` |
| Leads al reasignar | Nuevos → nuevo agente (auto). Viejos → quedan con el anterior (no retroactivo) |
| Límite del plan | Por `agency_id`; reasignar no lo afecta. Trigger NO se dispara en UPDATE que solo cambia `agent_id` |
| Listado para admin | Hoy por `agent_id`, sin leer `role`. Ampliar a `agency_id` si admin; quizá columna "Agente" |
| Patrón service-role + role | `createAgentAction` es el molde (rol del server, agency_id derivado, validar target en la agencia) |
| Superficie de escritura | UNA sola: `propiedades/actions.ts`. Sin escrituras dispersas |

**Apunte de diseño (opción A vs B):**
- **Opción A (policy nueva + client normal):** agregar una policy `FOR ALL` para admin de agencia con `USING (agency_id IN (agencias donde soy admin))` **y `WITH CHECK` explícito** que permita el nuevo `agent_id` (validando que pertenezca a la agencia). Sin el WITH CHECK explícito, la reasignación falla. Las actions seguirían con client normal pero `verifyOwnership` debe pasar a "dueño O admin de la agencia". Toca RLS (más delicado de testear) pero mantiene el principio "la DB es la barrera".
- **Opción B (service role + validación en la action):** replicar `createAgentAction`: validar `role === 'admin'` y `agency_id` server-side, validar que la propiedad y el `agent_id` destino sean de esa agencia, y escribir con `createAdminClient()` (salta RLS). No toca policies. Es el patrón ya usado en el proyecto para escrituras administrativas (registro, equipo, activación de planes).

> Verificado contra los archivos del repo y el schema. **No** verifiqué nada contra la base/Auth en vivo (sin conexión Supabase en este entorno). El comportamiento del WITH CHECK implícito de un `FOR ALL` sin WITH CHECK es el estándar documentado de Postgres RLS — conviene confirmarlo en un test real antes de elegir A.
