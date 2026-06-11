# Implementación — Paso 2: reasignar el agente de una propiedad

> Hecho el 11 jun 2026. Un `admin` de agencia puede asignar/cambiar el `agent_id`
> de una propiedad a otro agente de SU misma agencia, desde el `PropertyForm`,
> en crear Y editar. Solo el admin ve el campo; un agente normal no. Vía service
> role con validación de pertenencia server-side. No se tocaron las policies RLS.

Build: `npx tsc --noEmit` → **0 errores**. `npm run lint` → **5 problemas, todos
preexistentes** (ClusterLayer ×2, StatsCard, RegisterForm, y el `watch("currency")`
de PropertyForm — su línea se corrió de 219 a 232 por las líneas que agregué, pero
es el mismo warning documentado en CLAUDE.md). **Cero problemas nuevos.**

---

## Lo sensible: validación de pertenencia del agente destino

El corazón de este paso es `resolveAssignedAgent` en `propiedades/actions.ts`. Es
la única puerta por la que un `agent_id` pedido desde el cliente se convierte en
una reasignación real:

```ts
async function resolveAssignedAgent(
  supabase,
  callerRole: string | undefined,   // ← del server (fila agents por auth.uid())
  agencyId: string,                  // ← del server (agencia del caller/propiedad)
  assignedAgentId: string | null | undefined  // ← lo único que viene del cliente
): Promise<string | null> {
  if (!assignedAgentId) return null;
  if (callerRole !== "admin") return null;      // (1) un agente normal nunca reasigna
  const { data: target } = await supabase
    .from("agents").select("id")
    .eq("id", assignedAgentId)
    .eq("agency_id", agencyId)                  // (2) destino DENTRO de la agencia
    .maybeSingle();
  return target ? assignedAgentId : null;       // null → el llamador usa su fallback
}
```

Las tres barreras, todas server-side:
1. **`callerRole !== "admin"` → null.** Un agente normal que mande el campo (no
   debería poder, el form no se lo muestra, pero por tampering) es ignorado: su
   `agent_id` no se toca.
2. **`.eq("agency_id", agencyId)` → cross-tenant imposible.** No se valida que el
   agente "exista a secas", sino que exista **dentro de la agencia indicada**. Un
   admin que pida asignar a un agente de OTRA agencia: el destino no matchea →
   `null` → no se reasigna. Reasignar a otra agencia es imposible por construcción.
3. **`agencyId` y `callerRole` vienen del server**, nunca de props del cliente.
   `agencyId` es la agencia del caller (create) o la de la propiedad ya validada
   por `authorizePropertyAccess` (update). El cliente solo aporta el `id` candidato.

Si `resolveAssignedAgent` devuelve `null`, el llamador NO cambia `agent_id`
(update) o usa `user.id` (create). O sea: **el peor caso de un input malicioso es
"no pasa nada", nunca una reasignación no autorizada.**

---

## El otro punto sensible: la RLS WITH CHECK y el client de escritura

La policy `Agent manages own properties` es `FOR ALL USING (agent_id = auth.uid())`
sin `WITH CHECK` explícito → Postgres usa la misma condición como WITH CHECK. Eso
significa que **escribir una fila cuyo `agent_id` ≠ `auth.uid()` con el client
normal FALLA**. Por eso, cuando se asigna a OTRO agente, la escritura usa service
role (que salta RLS). Detalle por action:

- **create**: si `resolvedAgentId !== user.id` → `db = createAdminClient()` (la
  propiedad nace a nombre de otro). El insert de la propiedad y el de sus imágenes
  van con ese `db` (la RLS de `property_images` también exige el `agent_id` dueño).
- **update**: `authorizePropertyAccess` ya da `db` = service role en `mode:"admin"`.
  El caso nuevo a cubrir es **un admin editando SU PROPIA propiedad (mode:"owner")
  y reasignándola a otro**: ahí `db` es el client normal y el nuevo `agent_id`
  rebotaría en el WITH CHECK → se fuerza `writeDb = createAdminClient()`. Regla:
  `mode === "owner" && reassigning → service role`. El update de la propiedad y el
  reemplazo de imágenes usan `writeDb`.

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/app/(agent)/dashboard/propiedades/actions.ts` | `resolveAssignedAgent` (helper nuevo); `assigned_agent_id?` en `CreatePropertyInput`/`UpdatePropertyInput`; create y update aplican la reasignación validada con el client correcto |
| `src/components/properties/PropertyForm.tsx` | Prop `agencyAgents?`; campo `assigned_agent_id` en el schema zod; `<Select>` "Agente asignado" (solo si viene `agencyAgents`); defaults (create=admin, edit=agente actual); ambos payloads mandan `assigned_agent_id` |
| `src/app/(agent)/dashboard/propiedades/nueva/page.tsx` | Lee `role`; si admin, trae agentes de la agencia (`id, full_name`, orden por nombre) y los pasa como `agencyAgents` |
| `src/app/(agent)/dashboard/propiedades/[id]/editar/page.tsx` | Lee `role` una vez (reusado para autorización Y selector); si admin, trae agentes de la agencia y los pasa |

---

## Detalle de cada cambio

### `createPropertyAction`
- El select de `agents` ahora trae `agency_id, role`.
- `resolvedAgentId = resolveAssignedAgent(supabase, agent.role, agent.agency_id, data.assigned_agent_id)`. `propertyAgentId = resolvedAgentId ?? user.id`.
- `usesServiceRole = propertyAgentId !== user.id` → `db = admin client` solo en ese caso. Insert de propiedad e imágenes con `db`, `agent_id: propertyAgentId`.
- Sin reasignación (o caller no admin, o destino inválido): comportamiento idéntico al de antes (a nombre de `user.id`, client normal).

### `updatePropertyAction`
- Lee `mode` de `authorizePropertyAccess`, y el `user`/`role` del server.
- `resolvedAgentId` validado contra `prop.agency_id` (la agencia de la propiedad, ya confirmada como la del caller por el helper).
- `writeDb = (mode === "owner" && reassigning) ? admin client : db`.
- En el payload del update, `agent_id` se incluye **solo si `resolvedAgentId !== null`** (spread condicional); si no, no se toca. Update e imágenes con `writeDb`. Toda la lógica previa (error `23514`/"Límite", `revalidatePath`) intacta.

### `PropertyForm.tsx`
- `agencyAgents?: { id: string; full_name: string }[]`. El campo `<Select>` "Agente asignado" se renderiza **solo si `agencyAgents` viene** (admin); mismo patrón visual que los selects de tipo/operación (shadcn `Select` + `Controller`, clases `FIELD`).
- `assigned_agent_id: z.string().optional()` en el schema.
- Default: en `create`, el propio admin (`agentId`); en `edit`, `initialData.agent_id`. Como el default existe siempre (aunque el campo no se muestre), un agente normal manda su propio id — inofensivo, porque la action lo ignora por el chequeo de rol.
- Ambos payloads (`createPropertyAction`/`updatePropertyAction`) mandan `assigned_agent_id: data.assigned_agent_id`.

### Páginas
- Ambas leen `role` (en `editar` se unificó la lectura del rol que el Paso 1 hacía solo en la rama no-dueño: ahora se lee una vez y sirve para autorizar Y para el selector).
- Si `role === "admin"`, traen `agents` por `agency_id` (campos `id, full_name`, orden por nombre) y los pasan como `agencyAgents`. Si no, no pasan el prop → el campo no aparece.

---

## Verificado del diagnóstico (no implementado, pero relevante)
- **Conteo del plan**: por `agency_id` — reasignar dentro de la agencia no lo mueve. No se tocó nada de eso.
- **Trigger `check_property_limit`**: solo se dispara al reactivar; un update que cambia `agent_id` con el status sin tocar no lo gatilla.
- **Leads viejos**: quedan con el agente anterior (no retroactivo) — correcto, no se tocó. Los nuevos van al nuevo agente porque el `PropertyModal` copia `property.agent_id` al insertar.

## No implementado (fuera de alcance, como se pidió)
Reasignar a otra agencia (imposible por la barrera (2)); reescritura de leads
viejos; límite de propiedades por agente.

---

## Para probar (lo crítico)
1. **Admin, crear**: el form muestra "Agente asignado" (default: él mismo). Si
   elige a otro agente de su equipo, la propiedad nace a nombre de ese agente.
2. **Admin, editar**: el campo aparece con el agente actual; cambiarlo reasigna.
   Probar los dos sub-casos: editar una propiedad AJENA de su agencia (mode admin)
   y reasignar SU PROPIA propiedad a otro (mode owner → fuerza service role).
3. **Agente normal**: el campo NO aparece, ni en crear ni en editar. Su flujo es
   idéntico al de antes.
4. **Seguridad (lo que más conviene testear en vivo)**: que un admin NO pueda
   asignar a un agente de OTRA agencia (la barrera (2) lo deja en null → no
   reasigna), y que un input manipulado de un agente normal sea ignorado (barrera
   (1)). En ambos casos el resultado esperado es "no cambia el agent_id", sin error.

> Nota: no verifiqué contra la base/Auth reales (sin conexión Supabase en este
> entorno). `tsc`/`lint` limpios. Lo que más conviene confirmar en vivo es la
> escritura con service role al reasignar (que NO rebote por la RLS) y que la
> barrera de agencia de `resolveAssignedAgent` efectivamente bloquee un destino
> de otra agencia.
