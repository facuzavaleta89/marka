# Implementación — Borrado de agente por el admin (Modelo B: reasignar → borrar)

> Hecho el 12 jun 2026. El admin de agencia puede eliminar a un agente de su
> equipo. Modelo B: las propiedades del agente se **reasignan al admin ANTES de
> borrar**, así nunca quedan huérfanas. La Parte 1 (phone_wa de agencia) ya estaba.

Build: `npx tsc --noEmit` → **0 errores**. `npm run lint` → solo los 5 problemas
preexistentes conocidos (ClusterLayer ×2, StatsCard, PropertyForm, RegisterForm);
**ningún archivo tocado aparece en el lint**.

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/app/(agent)/dashboard/equipo/actions.ts` | `deleteAgentAction` nueva |
| `src/app/(agent)/dashboard/equipo/page.tsx` | Cuenta las propiedades por agente y las pasa a la tabla |
| `src/components/dashboard/TeamContent.tsx` | Botón "Eliminar" por fila + AlertDialog de confirmación con el conteo |

---

## El orden de operaciones (lo crítico) — `deleteAgentAction(agentId)`

**Reasignar ANTES de borrar.** Si se borrara primero, la FK `ON DELETE SET NULL`
dejaría las propiedades huérfanas (justo lo que el Modelo B evita). Secuencia:

1. **Validaciones de seguridad** (todas server-side, en este orden):
   - `getUser()` → sin user, `"No autenticado"`.
   - **Auto-borrado**: `agentId === user.id` → `"No podés eliminarte a vos mismo"`
     (la agencia no puede quedar sin su admin). Va **antes** de leer nada más.
   - **Autorización**: lee la fila `agents` del caller (`agency_id, role`); si
     `role !== "admin"` → `"No autorizado"`. El **`agency_id` sale de acá, nunca
     del cliente**.
   - **Pertenencia del target**: `select id, agency_id from agents where id =
     agentId`; si no existe o `agency_id !== caller.agency_id` →
     `"Agente no encontrado"` (mismo mensaje que "no existe", para no revelar
     agentes de otras agencias).

2. **Reasignación** (service role, porque toca filas de otro agente que la RLS no
   permite con el client normal):
   ```ts
   admin.from("properties")
     .update({ agent_id: user.id })       // ← pasan al admin (el caller)
     .eq("agent_id", agentId)
     .eq("agency_id", caller.agency_id);  // ← defensa en profundidad
   ```
   Si falla → corta acá con `"No se pudieron reasignar… No se eliminó nada."`
   (**no se borra nada**). El conteo del plan no cambia (es por `agency_id`, misma
   agencia) y el trigger de límite no se dispara (solo cambia `agent_id`, no el
   `status`).

3. **Borrado** (recién ahora, con las propiedades ya reasignadas):
   ```ts
   admin.auth.admin.deleteUser(agentId);
   ```
   Cascadea por FK: borra la fila `agents` (CASCADE desde `auth.users`) y pone en
   **NULL los leads VIEJOS** del agente (`leads.agent_id` SET NULL). Esos leads
   quedan como **historial** (no se reasignan a propósito); el admin los ve por
   agencia en Consultas como "Sin agente asignado". Si el borrado falla **después**
   de reasignar, se avisa que las propiedades ya quedaron a nombre del admin
   (estado consistente, reintentable) — no se intenta revertir la reasignación
   (es un estado válido).

4. `revalidatePath("/dashboard/equipo")`.

### Por qué no quedan huérfanas
Entre el paso 2 y el 3, toda propiedad del agente ya tiene `agent_id = admin`.
Cuando el paso 3 borra al agente, no hay ninguna propiedad apuntando a él → el
`SET NULL` no tiene nada que nulificar en `properties`. Solo los leads históricos
caen a NULL, que es lo correcto.

---

## UI — Equipo (`TeamContent.tsx`)

- **Botón "Eliminar" por fila** (ícono `Trash2`, hover a `error` sobre
  `terracota-subtle`), en la columna de acciones (desktop) y junto al badge de rol
  (mobile). **No aparece en la fila del admin logueado** (`m.id !==
  currentUserId`) — no puede auto-borrarse, coherente con la barrera del server.
- **AlertDialog de confirmación** (shadcn, mismo patrón que `PropertiesTable`).
  Aviso según el conteo, en voz directa (DESIGN §10, sin alarmismo):
  - Con propiedades: "Sus **N propiedades** pasan a tu nombre y vas a poder
    reasignarlas. La cuenta del agente se elimina y no podrá ingresar."
    (singular/plural correcto).
  - Sin propiedades: "La cuenta del agente se elimina y no podrá ingresar. No
    tiene propiedades a su nombre."
- **Al confirmar** → `deleteAgentAction` con `useTransition`; en éxito
  `router.refresh()` (el agente desaparece de la lista); en error, banner
  descartable arriba de la tabla. La fila en proceso queda con el botón
  deshabilitado (`pendingId`).

### El conteo de propiedades (página)
`equipo/page.tsx` ahora trae, en paralelo con los agentes, `properties.select
("agent_id").eq("agency_id", …)` y arma un `Map` de `agent_id → cantidad`. Cada
`TeamMember` lleva `property_count`. Una sola query extra (no N+1); RLS de lectura
por agencia ya lo permite. Las propiedades huérfanas (NULL) no se cuentan (no hay
con Modelo B, pero el guard está por las dudas).

---

## Tipos
- `TeamMember` ganó `property_count: number` (para el aviso). Nada más hizo falta.
- **NO se aflojó `Property.agent_id` ni `Lead.agent_id` a nullable**: con Modelo B
  las propiedades nunca quedan en NULL (se reasignan), así que `Property.agent_id`
  sigue siendo `string` sin problema. Los leads viejos sí caen a NULL por la FK,
  pero la pantalla de Consultas ya contempla `agent` null ("Sin agente asignado")
  vía el join opcional `Lead.agent` — el campo `Lead.agent_id` (string) no se usa
  para renderizar ahí, así que no molesta. `tsc` limpio sin tocarlo.

---

## Lo que NO se implementó (fuera de alcance)
- **Desactivar agente** (`is_active`) — es la pieza siguiente; no se tocó.
- **Fallback de WhatsApp a la agencia** — no hace falta con Modelo B (las
  propiedades siempre tienen dueño).
- **Cambio a la policy `Public insert lead`** — tampoco hace falta (no hay
  propiedades huérfanas, así que no hay leads con `agent_id` NULL en propiedades
  activas).

---

## Para probar
1. **Admin elimina un agente con propiedades**: el AlertDialog avisa cuántas
   pasan; al confirmar, esas propiedades quedan a nombre del admin y el agente
   desaparece de la lista. En el listado de Propiedades del admin aparecen ahora
   bajo su nombre.
2. **Agente sin propiedades**: el aviso lo refleja; se borra sin reasignar nada.
3. **El admin no puede borrarse a sí mismo**: su fila no tiene botón; y si forzara
   la action con su propio id → "No podés eliminarte a vos mismo".
4. **Seguridad**: un agente normal que invoque la action → "No autorizado". Un
   admin con el id de un agente de otra agencia → "Agente no encontrado".
5. **Leads del agente borrado**: siguen visibles para el admin en Consultas como
   "Sin agente asignado" (no se borraron, cayeron a NULL).

> Nota: no verifiqué contra la base/Auth reales (sin conexión Supabase en este
> entorno). `tsc`/`lint` pasan. Lo que más conviene confirmar en vivo: que el
> `deleteUser` cascadee como se espera (fila agents borrada, leads a NULL) y que
> la reasignación previa deje 0 propiedades apuntando al agente antes del borrado.
