# Informe — La consulta sobrevive al agente que la atendió

> **Modo ejecución.** Escribí y modifiqué archivos del proyecto. **No ejecuté ningún comando de
> git** ni ningún SQL de escritura: el MCP de Supabase se usó solo para **verificar** el estado
> real de la base, que el dueño ya había migrado a mano.
>
> **Fecha de las mediciones:** 7 sep 2026.
>
> **Resultado:** las seis decisiones se implementaron tal como estaban descritas. Ninguna resultó
> imposible y ninguna hubo que rediseñarla. Baseline de calidad **sin cambios**: 0 errores de
> TypeScript, 0 errores de lint con el mismo warning único, build verde con las mismas 19 rutas.

---

## 1. Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/types/index.ts` | `Lead.agent_id` pasa a `string \| null` y se agrega `agent_name: string \| null`, documentada como **copia congelada** y contrastada explícitamente contra `Agent.email`, que es copia de lectura |
| `src/app/(agent)/dashboard/leads/page.tsx` | El select trae `agent_name`, se mapea a la fila, y el embed del agente lleva la advertencia de que **no puede llevar `!inner`** |
| `src/components/dashboard/LeadsContent.tsx` | `LeadRow` gana `agent_name`; nuevo helper `AgentCell` con los tres casos, consumido por la tabla de escritorio y por las tarjetas de celular |
| `src/app/(agent)/dashboard/equipo/actions.ts` | Reescrito el bloque que afirmaba que el borrado falla siempre; corregido el comentario que decía "Estado consistente"; nuevo mensaje de error que dice qué pasó y qué quedó a nombre del admin; agregado al encabezado el reparto propiedades-vs-consultas |
| `src/app/(agent)/dashboard/equipo/page.tsx` | Cuenta las consultas por agente con el mismo patrón que ya usaba para las propiedades, y las pasa como `lead_count` |
| `src/components/dashboard/TeamContent.tsx` | `TeamMember` gana `lead_count`; el aviso de borrado suma la frase de las consultas |
| `src/components/map/PropertyModal.tsx` | El insert de la consulta captura su error y lo muestra **sin bloquear** la apertura de WhatsApp |
| `supabase/migrations/20240101000000_initial_schema.sql` | Tabla `leads` (columna, FK y la columna nueva), función + trigger nuevos, nota de fidelidad de la policy reescrita, comentario de `Agent reads own leads`, y el bloque de discrepancias del encabezado |

**No toqué** `CLAUDE.md` ni `PENDIENTES.md` (se actualizan al cierre del grupo), ninguna policy,
la FK de `properties` hacia `agents`, la reasignación de propiedades al admin, ni los conteos que
autorizan eliminar una agencia.

---

## 2. Lo que leí de la base

Todo medido con el MCP en solo lectura, contra el proyecto real. **Los cinco puntos que el prompt
pedía verificar dieron correctos.**

### La columna del agente ahora admite nulos

```sql
SELECT column_name, ordinal_position, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema='public' AND table_name='leads';
```

| # | columna | tipo | nullable | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NO | `gen_random_uuid()` |
| 2 | `property_id` | `uuid` | NO | — |
| 3 | **`agent_id`** | `uuid` | **YES** ✅ | — |
| 4 | `agency_id` | `uuid` | **NO** | — |
| 5 | `contact_name` | `text` | NO | — |
| 6 | `contact_phone` | `text` | YES | — |
| 7 | `contact_email` | `text` | YES | — |
| 8 | `message` | `text` | YES | — |
| 9 | `source` | `text` | NO | `'whatsapp'::text` |
| 10 | `created_at` | `timestamptz` | YES | `now()` |
| 11 | **`agent_name`** | **`text`** | **YES** ✅ | — |

`agency_id` sigue **NOT NULL**, que es lo que hace que una consulta desvinculada de su agente siga
perteneciendo a su agencia. De eso depende todo el resto (la pantalla, la policy del admin y los
conteos de eliminación).

### La clave foránea pasó a `ON DELETE SET NULL`

```sql
SELECT con.conname, pg_get_constraintdef(con.oid), <confdeltype traducido>
FROM pg_constraint con ... WHERE c.relname='leads';
```

| constraint | definición | ON DELETE |
|---|---|---|
| `leads_pkey` | `PRIMARY KEY (id)` | — |
| **`leads_agent_id_fkey`** | **`FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL`** ✅ | **SET NULL** |
| `leads_agency_id_fkey` | `FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE` | CASCADE |
| `leads_property_id_fkey` | `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE` | CASCADE |

Sigue sin haber **ni un solo CHECK** sobre `leads` — que es, junto con el camino anónimo, la razón
por la que el nombre no puede venir del cliente.

### El trigger existe y es `BEFORE INSERT`

```
CREATE TRIGGER trg_set_lead_agent_name BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION set_lead_agent_name()
```
`tgenabled = 'O'` (habilitado). Es el **único** trigger sobre `leads`; los otros seis del esquema
`public` están sobre `agencies`, `properties` y `subscriptions`, sin cambios.

### La función

`SECURITY DEFINER`, `provolatile = 'v'` (VOLATILE, correcto para un trigger), `proconfig =
{search_path=public}`. Cuerpo tal como está en la base:

```sql
CREATE OR REPLACE FUNCTION public.set_lead_agent_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- El nombre se resuelve ACÁ y no en el payload del cliente. El camino que crea
  -- consultas es público y anónimo, leads no tiene ningún CHECK, y la policy de
  -- inserción no puede validar una columna de texto: si el nombre viajara desde
  -- el navegador, un visitante podría escribir cualquier cosa en la columna
  -- "Agente" del panel de una agencia.
  IF NEW.agent_id IS NOT NULL THEN
    SELECT full_name INTO NEW.agent_name
    FROM agents WHERE id = NEW.agent_id;
  END IF;
  RETURN NEW;
END;
$function$
```

Lo transcribí **verbatim** al schema documentado, no reescrito.

> **Detalle que verifiqué porque importa para la seguridad:** cuando `agent_id` no es nulo, el
> `SELECT ... INTO NEW.agent_name` **pisa** cualquier valor que el cliente hubiera mandado. Y
> cuando es nulo, el insert ni siquiera llega a escribirse: lo rechaza la policy (ver §6). O sea
> que **no hay ninguna combinación en la que un `agent_name` enviado desde el navegador termine
> en la tabla.** El diseño cierra por los dos lados.

### Las consultas existentes tienen el nombre cargado

```sql
SELECT count(*) AS total_leads,
       count(agent_id) AS con_agente_vinculado,
       count(*) FILTER (WHERE agent_id IS NULL) AS desvinculadas,
       count(agent_name) AS con_nombre_cargado,
       count(*) FILTER (WHERE agent_name IS NULL) AS sin_nombre,
       count(*) FILTER (WHERE agent_name IS NOT NULL
              AND agent_name = (SELECT full_name FROM agents a WHERE a.id = leads.agent_id))
              AS nombre_coincide_con_agente
FROM leads;
```
```json
[{"total_leads": 8, "con_agente_vinculado": 8, "desvinculadas": 0,
  "con_nombre_cargado": 8, "sin_nombre": 0, "nombre_coincide_con_agente": 8}]
```

**8 de 8 con el nombre cargado, y las 8 coinciden con el `full_name` del agente vivo.** El
backfill quedó completo y correcto. Todavía no hay ninguna consulta desvinculada (`desvinculadas:
0`), lo cual es esperable: nadie borró un agente todavía.

### Índices — sin cambios

```
leads_pkey        CREATE UNIQUE INDEX ... USING btree (id)
idx_leads_agency  CREATE INDEX ... USING btree (agency_id, created_at DESC)
```
Los mismos dos de antes. Sigue sin haber índice sobre `agent_id`; es preexistente y no lo toqué.

---

## 3. Cómo quedó la pantalla, en los tres casos

La lógica vive en **un solo lugar** (`LeadsContent.tsx`), consumido por los dos layouts. Lo hice
así por el precedente que documenta `CLAUDE.md` sobre `AgenciesTable`: esta misma clase de
condición estaba escrita dos veces ahí y **las dos copias se desincronizaron**, dejando una
pantalla de celular que no mostraba botones que sí correspondían.

`AgentCell` devuelve **siempre un solo elemento**, para que funcione igual dentro del `<td>` de la
tabla (flujo inline) y dentro del `<p className="flex items-center gap-2">` de la tarjeta (donde
se convierte en un único flex item, sin romper la alineación con el ícono).

```tsx
function AgentCell({
  agent,
  agentName,
}: {
  agent: LeadRow["agent"];
  agentName: string | null;
}) {
  // 1) El agente sigue en la agencia → su nombre ACTUAL (el de la fila viva, no
  // la copia congelada: si se corrigió el nombre, lo que vale es el de hoy).
  if (agent) {
    return (
      <span className="font-sans text-sm text-graphite">{agent.full_name}</span>
    );
  }

  // 2) El agente se fue, pero la base guardó cómo se llamaba cuando atendió esta
  // consulta. Se muestra el nombre + un badge que lo distingue de un agente
  // activo: son dos situaciones distintas y no pueden leerse igual. El badge usa
  // el tratamiento de "estado cerrado" de DESIGN §6 (fondo stone, texto
  // graphite), el mismo de las propiedades vendidas/alquiladas.
  if (agentName) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-sans text-sm text-graphite">{agentName}</span>
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm bg-stone px-2 py-0.5 text-graphite whitespace-nowrap">
          Ya no está
        </span>
      </span>
    );
  }

  // 3) Último recurso: consultas anteriores a la migración que quedaron sin la
  // copia del nombre. Hoy no hay ninguna, pero el caso es representable.
  return (
    <span className="font-sans text-sm italic text-stone">
      Sin agente asignado
    </span>
  );
}
```

Y los dos puntos de uso, que quedaron de una línea cada uno:

```tsx
                {/* Agente (solo admin) */}
                {isAgencyAdmin && (
                  <td className="px-5 py-3 whitespace-nowrap">
                    <AgentCell agent={l.agent} agentName={l.agent_name} />
                  </td>
                )}
```

```tsx
            {isAgencyAdmin && (
              <p className="mt-2 pt-2 border-t border-stone flex items-center gap-2 font-sans text-sm text-graphite">
                <User size={14} className="shrink-0" />
                <AgentCell agent={l.agent} agentName={l.agent_name} />
              </p>
            )}
```

### Cómo se ve cada caso, y por qué

| Caso | Qué muestra | Tratamiento |
|---|---|---|
| **Agente vinculado** | `Ana Gómez` | `text-sm text-graphite` — sin cambios respecto de hoy |
| **Desvinculado con nombre** | `Ana Gómez` **[YA NO ESTÁ]** | El nombre igual que un agente activo + badge `bg-stone text-graphite`, `text-[11px] font-semibold uppercase tracking-wide rounded-sm` |
| **Sin nombre** | *Sin agente asignado* | `italic text-stone` — la leyenda de hoy, intacta |

**Por qué ese badge y no otra cosa.** DESIGN §6 tiene una tabla de badges y el par `stone` /
`graphite` está asignado ahí literalmente a **"Estado vendido — propiedades `sold`/`rented`"**, o
sea que en este sistema **es el tratamiento de "estado cerrado"**. Es exactamente la semántica que
hace falta: una persona que ya no está. Un badge `mist`/`graphite` (el neutro de "Venta",
"Alquiler") se leería como un atributo activo, y `terracota` está reservado para acentos y CTAs.

**Y por qué el nombre no se atenúa.** La tentación era poner el nombre en `stone` para "marcar"
que ya no está. Sería un error: el nombre **es el dato**, y es la única información que se
conserva de quién atendió esa consulta. Atenuarlo lo haría más difícil de leer justo cuando es
más valioso. Lo que cambia de estado es la persona, no el registro, así que el estado va en el
badge. Las dos situaciones quedan igual de legibles pero inconfundibles entre sí, que es lo que
pedía la decisión 2.

**Nota sobre el caso 1:** cuando el agente sigue vinculado se muestra `agent.full_name` (la fila
viva), **no** `agent_name`. Si alguien se corrigió una falta de ortografía en el nombre, lo que
vale para un agente presente es cómo se llama hoy. La copia congelada solo entra en juego cuando
ya no hay a quién preguntarle.

---

## 4. El texto exacto del aviso antes de borrar un agente

El diálogo ya avisaba de las propiedades. Le sumé una segunda frase para las consultas, en un
párrafo aparte **porque son dos efectos distintos sobre dos cosas distintas** —las propiedades se
reasignan, las consultas se desvinculan— y meterlos en la misma oración los haría parecer lo
mismo.

**Título:** `¿Eliminar a {nombre del agente}?`

**Cuerpo, con propiedades y con consultas** (el caso completo):

> Sus **3 propiedades** pasan a tu nombre y vas a poder reasignarlas. La cuenta del agente se
> elimina y no podrá ingresar.
>
> Sus **5 consultas** no se borran: quedan en el historial de la agencia con su nombre, para que
> sepas quién las atendió.

**Sin propiedades pero con consultas:**

> La cuenta del agente se elimina y no podrá ingresar. No tiene propiedades a su nombre.
>
> Sus **5 consultas** no se borran: quedan en el historial de la agencia con su nombre, para que
> sepas quién las atendió.

**Sin consultas:** el segundo párrafo no se renderiza (no tiene sentido avisar de un efecto que no
va a ocurrir; mismo criterio que ya tenía el bloque de propiedades).

Los números van en `<strong className="text-black">`, igual que el de propiedades, y singular /
plural resuelto (`consulta` / `consultas`).

**La frase arranca por "no se borran" a propósito.** El admin está mirando un diálogo rojo de
eliminación: lo primero que necesita saber de sus consultas es que **no** las va a perder. Recién
después viene dónde quedan y por qué le sirve.

El JSX:

```tsx
              {toDelete && toDelete.lead_count > 0 && (
                <span className="block mt-2">
                  Sus{" "}
                  <strong className="text-black">
                    {toDelete.lead_count}{" "}
                    {toDelete.lead_count === 1 ? "consulta" : "consultas"}
                  </strong>{" "}
                  no se borran: quedan en el historial de la agencia con su
                  nombre, para que sepas quién las atendió.
                </span>
              )}
```

**Cómo se cuenta**, siguiendo el patrón exacto que ya usaba para las propiedades (una lectura por
agencia + un conteo en memoria, no N queries), en `equipo/page.tsx`:

```ts
      supabase
        .from("leads")
        .select("agent_id")
        .eq("agency_id", agent.agency_id),
```
```ts
  const leadsByAgent = new Map<string, number>();
  for (const l of agencyLeads ?? []) {
    if (l.agent_id) {
      leadsByAgent.set(l.agent_id, (leadsByAgent.get(l.agent_id) ?? 0) + 1);
    }
  }
```

⚠ **La guarda `if (l.agent_id)` es load-bearing ahora, no una formalidad copiada.** En el conteo
de propiedades era defensiva (esa columna es NOT NULL); acá **las filas con `agent_id` nulo
existen de verdad** y no deben contarse para nadie: son consultas de agentes que ya se fueron y no
pertenecen a ningún miembro vivo del equipo.

**Sobre la RLS:** la lectura de `leads` desde esta página funciona porque `/dashboard/equipo` es
solo-admin (`if (agent.role !== "admin") redirect("/dashboard")`, línea 13), así que el caller
siempre pasa la policy `Admin reads agency leads`. Un agente común nunca llega a ejecutar esa
query.

---

## 5. Que el registro de la consulta no falle en silencio, sin bloquear al visitante

El defecto era un `await` pelado, sin capturar el resultado: un rechazo de la policy, una caída de
red o una agencia que dejó de ser visible entre el render y el click producían **exactamente la
misma pantalla que el éxito**.

**Busqué cómo se había resuelto la misma familia de defecto** en `ImageUploader.handleRemove`
(`CLAUDE.md` lo menciona textualmente: *"era un `await` pelado sin `const { error } ="*). La forma
allá es: capturar el error → guardarlo en estado → mostrarlo en un `<p className="font-sans
text-xs text-error">` → **y seguir adelante con la operación principal igual** (la imagen se quita
de la grilla aunque el archivo no se haya podido borrar). Seguí ese molde.

**La distinción que gobierna el diseño acá: la operación principal es el CONTACTO, no el
registro.** El lead es para la agencia, no para el visitante. Por eso el `window.open` va después
del insert pero **incondicionalmente**, fuera de cualquier rama de error.

```ts
    const { error: leadInsertError } = await supabase.from("leads").insert({
      property_id: property.id,
      agent_id: property.agent_id,
      agency_id: property.agency_id,
      contact_name: userName.trim(),
      source: "whatsapp",
    });

    window.open(url, "_blank", "noopener,noreferrer");

    setSending(false);
    setLeadError(!!leadInsertError);
    // Con error, el flujo NO se cierra: el aviso se muestra donde el visitante
    // está mirando. Sin error, vuelve al estado inicial como siempre.
    if (!leadInsertError) {
      setShowNameInput(false);
      setUserName("");
    }
```

Y el aviso, en el pie del modal, junto al botón:

```tsx
            {leadError && (
              <p className="font-sans text-xs text-graphite" role="status">
                Se abrió WhatsApp, pero no pudimos avisarle a la inmobiliaria de
                tu consulta. Escribile igual por el chat: te va a responder.
              </p>
            )}
```

**Tres decisiones concretas, con su razón:**

1. **El WhatsApp se abre antes de mirar el error.** No hay ninguna rama donde el visitante se
   quede sin poder contactar. Es la restricción que pedía el prompt y es la correcta: nadie debería
   perder un contacto porque una tabla interna no aceptó una fila.
2. **El flujo NO se cierra cuando hay error** (`showNameInput` y `userName` se conservan). Si se
   reseteara, el aviso quedaría flotando al lado de un botón "Consultar por WhatsApp" en estado
   inicial, sin contexto de a qué se refiere. Dejándolo abierto, el mensaje aparece exactamente
   donde el visitante acaba de hacer click. Un reintento limpia el estado (`setLeadError(false)` al
   arrancar `handleSendWA`).
3. **El aviso va en `graphite`, no en `error`** — y es la única desviación del molde de
   `ImageUploader`. Allá el rojo es correcto porque quien lo lee es el agente y **algo suyo quedó
   mal**. Acá quien lo lee es un visitante al que **no le falta nada**: ya tiene el chat abierto y
   su consulta va a llegar igual, por WhatsApp. Pintarle un texto rojo de error le comunicaría un
   problema que no es suyo y lo empujaría a no escribir. DESIGN §10 pide mensajes que digan qué
   pasó y qué hacer, sin dramatizar; el mensaje cierra con la acción concreta ("escribile igual").
   `role="status"` en vez de `role="alert"` por lo mismo: es información, no una alarma.

**Cómo un problema sistemático deja de pasar inadvertido:** si la policy empieza a rechazar
inserts —una agencia que dejó de estar al día, una propiedad que se pausó— **todos** los visitantes
que intenten contactar van a ver esa línea. Antes no la veía nadie y la agencia tampoco: las
consultas simplemente no aparecían, sin ninguna señal en ningún lado.

**Lo que NO hice:** no agregué `console.error`. Medí que **no hay ni una sola llamada a `console`
en todo `src/`** (`grep -rn "console\." src/` → cero resultados), así que introducirla sería
estrenar una convención en un archivo que no es el lugar para discutirla. El molde del repo para
este problema es el mensaje visible, y eso es lo que apliqué.

---

## 6. Qué encontré al verificar la policy de inserción y los conteos

### La policy de inserción: **el prompt tiene razón y no la toqué**

Las tres policies de `leads` siguen **exactamente iguales**, verificadas contra `pg_policies`
después de la migración:

| policy | cmd | expresión |
|---|---|---|
| `Public insert lead` | INSERT | `EXISTS (SELECT 1 FROM properties p WHERE p.id = leads.property_id AND p.status = 'active' AND p.agent_id = leads.agent_id AND p.agency_id = leads.agency_id AND agency_is_publicly_visible(p.agency_id))` |
| `Agent reads own leads` | SELECT | `(agent_id = auth.uid())` |
| `Admin reads agency leads` | SELECT | `(agency_id IN (SELECT agents.agency_id FROM agents WHERE agents.id = auth.uid() AND agents.role = 'admin'))` |

**El comentario que había en el schema decía esto** (lo cito porque es lo que había que revisar):

> *"Si algún día se implementa 'agente desvinculado', primero hay que resolver esa discrepancia y
> después actualizar esta policy para aceptar `(p.agent_id IS NULL AND leads.agent_id IS NULL)` y
> rutear el contacto al phone_wa de la agencia. Recién entonces, no antes."*

**Confirmo que esa instrucción NO corresponde seguirla, por dos motivos, los dos medidos:**

**(a) Apunta a otro caso.** Habla de una **propiedad** sin agente (`properties.agent_id IS NULL`).
Eso sigue sin poder existir: `properties.agent_id` es NOT NULL con `ON DELETE CASCADE`, y
`deleteAgentAction` reasigna las propiedades al admin antes de borrar. Lo que esta tanda produce
es una **consulta** sin agente, y esas **no nacen así**: se desvinculan después, cuando el agente
se borra, sin pasar por esta policy (que solo corre en INSERT).

**(b) Aflojarla abriría la única barrera de escritura pública de la tabla.** Lo medí en el motor,
no lo razoné:

```sql
SELECT (NULL::uuid = '7074968a-…'::uuid)                          AS null_eq_uid,
       ((NULL::uuid = '7074968a-…'::uuid) IS TRUE)                AS policy_would_pass,
       EXISTS (SELECT 1 FROM properties p WHERE p.agent_id = NULL::uuid)
                                                                  AS exists_con_null;
```
```json
[{"null_eq_uid": null, "policy_would_pass": false, "exists_con_null": false}]
```

O sea: **con `agent_id` nulo, el `EXISTS` da `false` y el INSERT se rechaza.** Ese es justamente
el comportamiento que queremos — el camino es anónimo, y sin esa barrera cualquiera podría
fabricar consultas sin agente contra cualquier propiedad, con el `agent_name` que se le antojara.
**La nullabilidad de la columna no abre nada mientras la policy quede como está.**

Reescribí esa nota en el schema para que diga lo que la base tiene ahora **conservando y
reforzando la advertencia**, encabezada por `⚠⚠ ESTA POLICY NO SE TOCA, Y MENOS AHORA. NO
AFLOJARLA PARA ACEPTAR NULOS.`, con los dos motivos y con la aclaración de que la instrucción
vieja se evaluó y se descartó (para que nadie la vuelva a proponer creyendo que quedó pendiente).

También le agregué una nota a `Agent reads own leads`, porque **su alcance efectivo cambió sin que
su texto cambie**: una consulta desvinculada ya no la matchea (`NULL = auth.uid()` da `NULL`, no
`TRUE`), así que pasa a verla solo el admin de la agencia. Es lo correcto —el agente al que
pertenecía ya no existe— pero es exactamente el tipo de cosa que alguien "arreglaría" agregando un
`OR agent_id IS NULL`, lo cual le mostraría a **cualquier** agente las consultas de todos los que
se fueron. Queda advertido en el archivo.

### Los conteos de eliminación de agencia: **no los afecta, y lo confirmo**

Los dos, releídos después del cambio y **sin tocar**:

`src/app/(agent)/admin/actions.ts` (la barrera real, dentro de `deleteAgencyAction`):
```ts
      admin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", input.agencyId),
```

`src/app/(agent)/admin/page.tsx` (solo decide si el botón aparece):
```ts
    admin.from("leads").select("agency_id"),
```

**Los dos filtran por `agency_id`, no por `agent_id`.** Y `leads.agency_id` sigue siendo **NOT
NULL** con su FK `ON DELETE CASCADE` sobre `agencies` (medido en §2), así que **una consulta
desvinculada de su agente sigue perteneciendo a su agencia y sigue contando**. La protección se
mantiene intacta: una agencia con consultas huérfanas sigue sin poder eliminarse.

Esto no es una casualidad afortunada, es el diseño previo pagando: la decisión de denormalizar
`agency_id` en la consulta (`types/index.ts`: *"incluido para queries del dashboard por
agencia"*) es lo que permite que la consulta sobreviva a su agente sin perder a quién pertenece.

---

## 7. Baseline de calidad

### `npx tsc --noEmit`

```
(sin salida)
EXIT_TSC=0
```
**0 errores.** ✅ Igual al baseline.

### `npm run lint`

```
> marka@0.1.0 lint
> eslint


/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  808:30  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:808:30
  806 |   });
  807 |
> 808 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
      |                              ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  809 |   const lat = watch("lat");
  810 |   const lng = watch("lng");
  811 |   const address = watch("address") ?? "";  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)

EXIT_LINT=0
```
**0 errores, 1 warning** — el mismo `react-hooks/incompatible-library` en `PropertyForm.tsx:808`,
en la misma línea y por la misma causa. ✅ Igual al baseline, ningún warning nuevo.

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 7.8s
  Running TypeScript ...
  Finished TypeScript in 8.2s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (19/19) in 1549ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /[slug]
├ ƒ /admin
├ ƒ /api/geocode
├ ○ /apple-icon.png
├ ƒ /dashboard
├ ƒ /dashboard/equipo
├ ƒ /dashboard/leads
├ ƒ /dashboard/perfil
├ ƒ /dashboard/preferencias
├ ƒ /dashboard/propiedades
├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /dashboard/propiedades/nueva
├ ƒ /dashboard/suscripcion
├ ƒ /login
├ ƒ /logout
├ ƒ /register
└ ƒ /register/plan


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

EXIT_BUILD=0
```
**Verde, 19 rutas.** ✅ Igual al baseline, ninguna ruta nueva.

### Comparación

| Comando | Baseline | Ahora | |
|---|---|---|---|
| `npx tsc --noEmit` | 0 errores, exit 0 | 0 errores, exit 0 | ✅ |
| `npm run lint` | 0 errores, 1 warning, exit 0 | 0 errores, **el mismo** 1 warning, exit 0 | ✅ |
| `npx next build` | verde, 19 rutas, exit 0 | verde, 19 rutas, exit 0 | ✅ |

**Cambio esperado: ninguno. Cambio observado: ninguno.**

> ⚠ **Una advertencia sobre esto que conviene leer:** el compilador **no verificó** el cambio más
> importante de tipos. `Lead.agent_id` pasó de `string` a `string | null` y `Lead` **no lo importa
> nadie** en todo el proyecto (el único consumidor de la forma de una consulta es `LeadRow`, que se
> declara aparte y no deriva de `Lead`). O sea que el `tsc` en verde **no es evidencia** de que ese
> tipo esté bien: lo hice a mano y a mano habría que revisarlo. El prompt ya lo anticipaba y lo
> confirmo medido.

---

## 8. Qué resultó falso, o imposible

**Nada resultó imposible.** Las seis decisiones se implementaron tal como estaban descritas, sin
improvisar alternativas.

**Nada de lo que el prompt afirma resultó falso.** Verifiqué los cinco puntos del cambio de base
(columna nullable, FK `SET NULL`, columna de texto nueva, trigger `BEFORE INSERT`, backfill
completo) y los cinco dieron correctos. La advertencia sobre el comentario del schema que pide
aflojar la policy también resultó exacta: apunta a otro caso y seguirlo abriría la única barrera
de escritura pública de la tabla (§6).

Cuatro cosas que decidí yo y que conviene que alguien confirme, porque el prompt las dejaba
abiertas o son consecuencias que no estaban enunciadas:

1. **La lógica de los tres casos vive en un helper (`AgentCell`), no duplicada en los dos
   layouts.** El prompt decía "no hay que crear estructura nueva: hay que cambiar qué se muestra
   ahí", y estrictamente esto es un componente nuevo. Lo hice igual porque el condicional pasó de
   dos ramas a tres, y duplicar tres ramas es exactamente cómo se produjo el bug de `AgenciesTable`
   que `CLAUDE.md` documenta. El JSX de cada layout quedó más corto que antes, no más largo.

2. **El aviso del visitante va en `graphite` y no en `error`.** Es la única desviación consciente
   del molde de `ImageUploader`, y la razón está en §5: allá quien lee es el agente y algo suyo
   quedó mal; acá quien lee es un visitante al que no le falta nada.

3. **Un efecto de alcance que ninguna decisión enunciaba y que ya está en producción:** una
   consulta desvinculada **deja de ser visible para los agentes comunes**, porque `agent_id =
   auth.uid()` no matchea un nulo. Pasa a verla solo el admin de la agencia. Encaja con "queda en
   el historial de la agencia", pero es un cambio real de quién ve qué, así que lo dejé anotado en
   el schema y en `deleteAgentAction` en vez de darlo por sobreentendido.

4. **El estado intermedio del borrado sigue existiendo: lo documenté con precisión, no lo
   eliminé.** El prompt pedía corregir el comentario que lo llamaba "consistente" y el mensaje, y
   eso hice. Pero **el estado a medias no desapareció**: si el `deleteUser` falla por cualquier
   otra causa, las propiedades ya están a nombre del admin y el avatar ya se borró, sobre un agente
   que sigue pudiendo iniciar sesión. Con el `SET NULL` la causa frecuente se fue, así que hoy es
   mucho menos probable — pero **no es imposible**, y quien lea el código tiene que saberlo. El
   comentario ahora enumera los tres hechos y aclara que reintentar es seguro (los dos pasos son
   idempotentes) aunque pueda no arreglar nada. **Cerrarlo de verdad requeriría reordenar los pasos
   o compensarlos, que es un cambio de comportamiento que estas seis decisiones no autorizan.**

**El texto exacto del mensaje nuevo de ese fallo**, para que quede a la vista:

> No se pudo eliminar la cuenta del agente, así que sigue activa y puede ingresar. Sus propiedades
> ya pasaron a tu nombre y su foto de perfil ya se borró. Podés reintentar; si vuelve a fallar,
> escribinos.

Dice qué falló, qué quedó activo, qué quedó a nombre del admin, y no promete que reintentar
alcance.

---

## Verificación pendiente, a mano

El caso central **no se puede ejercitar con los datos actuales**, y conviene saberlo antes de dar
esto por probado: las 8 consultas pertenecen a un único agente que además es el **admin** de su
agencia, y `deleteAgentAction` prohíbe el auto-borrado. Para ver el flujo completo hay que
fabricarlo: crear un agente común, generarle una consulta desde el mapa público (que ejercita de
paso el trigger y el nuevo manejo de error del modal), y recién ahí borrarlo desde `/dashboard/equipo`.
Eso verifica, en un solo movimiento, el aviso previo con el conteo, el `SET NULL`, la copia
congelada del nombre y el badge "Ya no está" en la pantalla de Consultas.
