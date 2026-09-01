# Informe — Sincronización de schema y documentación

> Tarea de documentación en modo ejecución. Se tocaron **solo archivos `.md` y el `.sql` del
> schema**. Cero cambios en código fuente, cero comandos de git, cero SQL de escritura (el MCP
> es de solo lectura y todo lo de abajo se **midió**, no se asumió).

---

## 1. Lo relevado

### a. Estado real de la base (medido por MCP, 1 sep 2026)

**Función de visibilidad pública — existe y es como se describía:**

```sql
CREATE FUNCTION public.agency_is_publicly_visible(target_agency_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM agencies a JOIN subscriptions s ON s.agency_id = a.id
     WHERE a.id = target_agency_id AND a.approval_status = 'approved'
       AND s.status = 'active' AND s.plan <> 'free'); $$
```

`prosecdef = true` (SECURITY DEFINER) confirmado.

**Las tres policies que la usan** (medidas en `pg_policies`):

| Tabla | Policy | Condición real |
|---|---|---|
| `properties` | `Public read active properties` (SELECT) | `status = 'active' AND agency_is_publicly_visible(agency_id)` |
| `property_images` | `Public read property images` (SELECT) | `EXISTS (… p.status='active' AND agency_is_publicly_visible(p.agency_id))` |
| `leads` | `Public insert lead` (INSERT, WITH CHECK) | lo de antes (property+agent+agency) **+** `agency_is_publicly_visible(p.agency_id)` |

`agency_reviews` sigue con **RLS habilitada y cero policies** (no aparece en `pg_policies`).

**Triggers de `properties` — son TRES + el de `updated_at`,** y el orden alfabético es el que
manda:

| # | Trigger | Cuándo | Función |
|---|---|---|---|
| 1 | `trg_check_agency_approved` | BEFORE INSERT | `check_agency_approved()` — `approval_status <> 'approved'` o sin fila |
| 2 | `trg_check_agency_subscription` | BEFORE INSERT | `check_agency_subscription()` — `status IN ('canceled','past_due')` |
| 3 | `trg_check_property_limit` | BEFORE INSERT **OR UPDATE** | `check_property_limit()` — cupo; sin fila de suscripción → límite 0 |
| — | `trg_properties_updated_at` | BEFORE UPDATE | `update_updated_at()` |

Los tres gates lanzan `ERRCODE = check_violation` (**23514**), así que el orden decide el mensaje.
Confirmado también que `check_agency_subscription()` usa **lista negra** (`canceled`/`past_due`),
no `<> 'active'`.

**CHECK de `agency_reviews.decision` — seis valores, ya aplicado:**

```
CHECK (decision = ANY (ARRAY['approved','rejected','plan_canceled',
       'subscription_canceled','subscription_restored','plan_changed']))
```

Y los seis **ya se usaron de verdad** (`approved` 2, `rejected` 1, `plan_canceled` 2,
`subscription_canceled` 3, `subscription_restored` 3, `plan_changed` 3 = 14 filas).

**Datos de la base (para calibrar la documentación):** 9 agencias (todas `approved`),
13 propiedades, 9 agentes, 7 consultas, 6 suscripciones pagas activas, **0 bajas vigentes**,
**1 sola fila con `current_period_end` cargado**.

### b. Archivos de los cuatro trabajos

Relevados por fecha de modificación (no por git, que no se tocó):

| Trabajo | Archivos |
|---|---|
| **1 · Visibilidad pública** (31 ago) | `lib/utils/resolveAgencyBySlug.ts` (gate 3 + `isAgencyPubliclyVisible` por RPC) + los cambios de base (función y 3 policies) |
| **2 · Panel de ida y vuelta** (31 ago) | `(agent)/admin/actions.ts`, `(agent)/admin/AgenciesTable.tsx`, `(agent)/admin/page.tsx` |
| **3 · Tres correcciones** (31 ago) | `lib/utils/getPublishBlock.ts`, `lib/utils/getPlanUsage.ts`, `lib/utils/labels.ts`, `components/dashboard/NewPropertyButton.tsx`, `components/dashboard/SubscriptionContent.tsx`, `(agent)/dashboard/suscripcion/actions.ts`, `(agent)/dashboard/propiedades/actions.ts` |
| **4 · Cambio de plan** (1 sep, sin commitear) | `(agent)/admin/actions.ts`, `(agent)/admin/AgenciesTable.tsx`, `(agent)/admin/page.tsx`, `(agent)/register/plan/PlanSelector.tsx`, `src/types/index.ts` |

### c. Baseline (paso 1)

| Comando | Salida | Exit |
|---|---|---|
| `npx tsc --noEmit` | sin salida | **0** |
| `npm run lint` | `✖ 1 problem (0 errors, 1 warning)` — `PropertyForm.tsx:269`, `react-hooks/incompatible-library` | **0** |
| `npx next build` | `✓ Compiled successfully` — **19 rutas** | **0** |

### d. `supabase/pending/`

Había dos archivos, y **los dos ya estaban aplicados en la base**:

| Archivo | ¿Aplicado? | Cómo se confirmó |
|---|---|---|
| `2026-08-31-bloqueo-publicacion-por-suscripcion.sql` | **Sí** | `check_agency_subscription()` existe en `pg_proc` con el cuerpo exacto del archivo, y `trg_check_agency_subscription` existe en `pg_trigger` como `BEFORE INSERT` |
| `2026-08-31-historial-cambio-de-plan.sql` | **Sí** | `pg_get_constraintdef` de `agency_reviews_decision_check` devuelve los **seis** valores, incluido `plan_changed` |

Los dos decían de sí mismos "⚠ ESTE ARCHIVO TODAVÍA NO ESTÁ APLICADO": **esa afirmación era
falsa**. Nadie los borró después de correrlos.

---

## 2. Qué se agregó al schema y qué se borró de `supabase/pending/`

Archivo: `supabase/migrations/20240101000000_initial_schema.sql` (616 → 942 líneas).

**Agregado (todo medido contra la base, con comentarios de porqué en español):**

1. **`agency_is_publicly_visible()`** con el cuerpo exacto de la base, y el porqué de las tres
   cosas que se piden: por qué **policy y no filtro por consulta** (dos caminos públicos leen
   propiedades con la anon key —el hook del mapa y el modal por id—, y el que se olvide filtra
   mal en silencio; el plan de ejecución se midió antes de decidir), por qué **SECURITY
   DEFINER** (el visitante es anónimo y la RLS de `subscriptions` le oculta la fila: sin eso la
   función daría `false` para todos y el mapa quedaría vacío para todo el mundo) y por qué
   `STABLE`.
2. **Las tres policies reescritas** con la llamada a la función, cada una con su nota: la de
   `properties` explica que ese segundo término **es lo que hace cobrable el producto**; la de
   `property_images` que espeja la condición para que las fotos no queden legibles; la de
   `leads` que es coherencia, no defensa en profundidad.
3. **`check_agency_subscription()` + `trg_check_agency_subscription`**, con los tres porqués
   pedidos: **trigger y no policy** (`createPropertyAction` usa service role cuando un admin
   publica a nombre de otro agente, y el service role saltea las policies: ese camino existe y
   se usa); **el nombre no es cosmético** (Postgres dispara en orden alfabético, los tres gates
   comparten SQLSTATE 23514, y ese orden decide qué mensaje ve el agente — decirle "alcanzaste
   el límite de tu plan" a alguien dado de baja es falso); y **lista negra, no `<> 'active'`**
   (un `'pending'` es una agencia al día: bloquearla sería cortarle el alta por haber querido
   pagar más). Más el efecto lateral conocido: es solo INSERT, así que reactivar una propiedad
   pausada no pasa por acá.
4. **CHECK de `agency_reviews.decision` con los seis valores**, con el reparto explicado
   (dos del eje de legitimidad, cuatro del comercial) y por qué **la eliminación no se
   registra** (la FK cascadea: la fila se borraría con lo registrado).
5. **Encabezado "Estado actual"** actualizado con las tres migraciones y con la discrepancia
   de FK marcada.

**Borrado de `supabase/pending/`:** los **dos** archivos, cada uno después de confirmar contra
la base que su contenido ya estaba aplicado (tabla del punto 1.d). La carpeta quedó **vacía**,
que es el estado sano; la convención quedó escrita en `CLAUDE.md` y en `PENDIENTES.md`.

**El schema sigue siendo ejecutable en una base limpia**: la función se define en la sección de
funciones (línea 600), muy antes de las policies que la invocan (772, 793, 842), y
`check_agency_subscription()` referencia `subscriptions`, que se crea antes que `properties`.

---

## 3. Documentación modificada

| Archivo | Qué cambió |
|---|---|
| `CLAUDE.md` | **Sección nueva "Visibilidad pública de las propiedades — LA REGLA DE COBRO"** (la regla, dónde vive, las tres policies, por qué policy y no filtro, por qué SECURITY DEFINER, y por qué el gate de pago del white-label no es redundante con `has_white_label`). **Sección nueva "Panel de plataforma (`/admin`)"** con la tabla de las seis acciones comerciales, qué conserva y qué apaga la baja, las reglas del cambio de plan, la tabla del **vencimiento por acción**, el circuito de eliminación con su orden, y el porqué de los paneles inline. **"Bloqueo de publicación" reescrito de dos a TRES triggers**, con el orden alfabético como pieza load-bearing y el bug del ternario. Actualizados: estado del proyecto, hoja de ruta, baseline, bullets de suscripción, aviso de baja en Suscripción, tabla de tablas (`subscriptions`, `agency_reviews`), policies clave, triggers/RPC, árbol de carpetas, gates del white-label, convención de `supabase/pending/`, y **10 filas nuevas** en "Decisiones de arquitectura". |
| `DESIGN.md` | §12 "Bloqueo de alta al alcanzar el límite" → **"Bloqueo de alta — TRES motivos, tres mensajes distintos"**, con el mensaje de cada motivo y la nota del `switch` exhaustivo. **Sección nueva "Aviso de suscripción que no rige"** (tono `warning` y no `error`, qué dice y en qué orden, sin fecha ni upgrades). **Sección nueva "Panel de plataforma (`/admin`) — acciones por fila"**: reparto botones/menú por naturaleza, fuente única de condiciones, dos badges distintos por ser dos ejes, y la restricción técnica de los paneles inline. |
| `PENDIENTES.md` | **BLOQUE A-bis cerrado** (era el bloqueante para cobrar). **"Panel admin de ida y vuelta" reescrito entero como CERRADO**, con las cinco piezas y sus reglas. Deuda técnica: `current_period_end` resuelto, y **cuatro ítems nuevos** (sin efecto automático de la fecha, `past_due` sin escritor, reactivación de pausada que saltea el gate, dashboard que no avisa la baja) + **la discrepancia de las dos FK como próxima tanda**, con su consecuencia viva. Bug `available` negativo marcado resuelto con la evidencia. Decisión de producto nueva: **el downgrade autoservicio no existe y debe seguir así**. **B3** (venta y alquiler a la vez, con la pregunta del precio del pin) y **C3** (el botón de ingresar como puerta de captación). **Bloque nuevo "Pulido estético"**. Cuatro entradas nuevas en "Cerrados recientemente". Fechas y conteos remedidos. |
| `respuesta.md` | Este informe (sobrescrito entero). |

---

## 4. Diferencias entre el contexto que me diste y lo medido

Casi todo coincidió. Las diferencias:

1. **Los dos archivos de `supabase/pending/` YA estaban aplicados**, no solo el del cambio de
   plan. El de bloqueo por suscripción se corrió el 31 de agosto y quedó ahí con su cartel de
   "todavía no está aplicado" puesto. Los dos se borraron.
2. **El panel tiene seis acciones comerciales, no cinco** (activar, cancelar solicitud, cambiar
   de plan, dar de baja, reactivar, eliminar) más las tres del eje de aprobación: **nueve
   acciones por fila** en total. Dijiste "cuatro acciones nuevas" para el trabajo 2 y eso es
   exacto (contando baja y reactivación como una); el total del panel es el de arriba.
3. **La baja apaga los tres `has_*` pero eso NO alcanza para apagar el sitio de marca**, y por
   eso el gate de pago existe: `has_white_label` no lo apaga *ningún* otro camino (un
   `past_due` no lo toca, y no hay proceso automático). Tu descripción decía "nadie lo apaga
   nunca"; con la baja nueva, hay exactamente un camino que sí lo apaga. El razonamiento de
   fondo sigue en pie y lo dejé documentado con esa precisión.
4. **El cambio de plan sí se probó en la práctica**: hay **3 filas `plan_changed`** en el
   historial. Lo que no se pudo probar es **solo el bloqueo por exceso de propiedades**, tal
   como decías.
5. **`plan_canceled` no es solo del trabajo 2**: ya tenía 2 filas, o sea que la cancelación de
   solicitudes también se ejercitó.
6. **Los conteos de la base cambiaron** respecto de lo que decía `PENDIENTES.md`: son **9
   agencias y 13 propiedades** (decía 11 y 12). Bajaron dos agencias, coherente con que la
   eliminación ya existe. Lo actualicé.
7. **La afirmación "el schema miente sobre dos FK" es correcta, y es peor de lo que decías en
   un punto**: además de las cláusulas `ON DELETE`, **las dos columnas son `NOT NULL`** en la
   base (el schema las declaraba nullable). Eso hace que el caso "agente desvinculado"
   (`agent_id IS NULL`) que varias notas dan por futuro **no pueda existir hoy**.
8. **`check_property_limit()` tampoco frena la reactivación de una pausada**, por un motivo
   distinto del que anotaste: sí corre en UPDATE, pero solo cuando la propiedad **entra** a
   ocupar cupo, y `paused` ya lo ocupa. O sea que en esa transición no hay **ningún** gate.

---

## 5. Afirmaciones falsas encontradas en la documentación

| Dónde | Qué decía | Qué hice |
|---|---|---|
| `initial_schema.sql`, `properties.agent_id` | "NULLABLE y ON DELETE SET NULL" | **Corregido a lo medido** (`NOT NULL … ON DELETE CASCADE`) con una nota que explica la discrepancia con el modelo escrito, la consecuencia (la reasignación previa del Modelo B es lo único que evita perder propiedades) y que resolverla es la próxima tanda |
| `initial_schema.sql`, `leads.agent_id` | "NULL si la propiedad quedó sin agente", `ON DELETE SET NULL` | **Corregido** (`NOT NULL REFERENCES agents(id)`, sin ON DELETE) con la consecuencia viva: **hoy no se puede borrar un agente con consultas a su nombre** |
| `initial_schema.sql`, nota de fidelidad de `Public insert lead` | "ese caso aún no puede ocurrir (ninguna propiedad tiene `agent_id` NULL)" — verdadero por accidente | Reescrita: no puede ocurrir **porque la columna es NOT NULL**, y primero hay que resolver la discrepancia de FK |
| `CLAUDE.md`, gestión de equipo | "`deleteUser` … pone los leads viejos en `agent_id NULL` (historial …); el orden importa por la FK `ON DELETE SET NULL`" | **Marcado como falso y corregido en el lugar**, con lo medido y el efecto real |
| `CLAUDE.md`, suscripciones | "Cancelar el pedido aún no está (el cliente escribe)" | Actualizado: lo cancela el dueño desde el panel; y agregado el agujero cerrado de `requestPlanUpgradeAction` |
| `CLAUDE.md`, suscripciones | "Bajar de plan no es expresable en el modelo actual" | Matizado: **se puede desde el panel**; lo que no es expresable es la **solicitud** del cliente, y eso es deliberado |
| `CLAUDE.md`, "dos triggers" y "Vistas RPC" | Dos gates de publicación; RPC solo `increment_views` | Reescritos a tres gates (con orden) y a "Funciones y RPC" incluyendo `agency_is_publicly_visible` |
| `CLAUDE.md`, white-label | `disabled` = "su suscripción NO tiene `has_white_label`" (un solo gate) | Corregido a los **tres** gates reales (legitimidad, entitlement, pago) |
| `CLAUDE.md` / `PENDIENTES.md`, hoja de ruta | "el mapa público **hoy NO filtra** por agencia habilitada, bloqueante para cobrar" | Marcado como resuelto en los dos archivos |
| `PENDIENTES.md`, deuda | "`current_period_end` es código muerto de facto, nadie la escribe" | Marcado resuelto (ya tiene productor) y reemplazado por el pendiente real: **nadie la vigila** |
| `PENDIENTES.md`, bugs | "Cálculo `available` negativo" | Marcado resuelto con la evidencia (`Math.max` en `getPlanUsage`, único consumidor) |
| `supabase/pending/*.sql` (los dos) | "⚠ ESTE ARCHIVO TODAVÍA NO ESTÁ APLICADO" | Los dos **estaban** aplicados → contenido trasladado al schema y archivos borrados |

---

## 6. Los tres comandos, después de los cambios

Idénticos al paso 1 (era lo esperable: no se tocó código).

```
$ npx tsc --noEmit
(sin salida)
exit=0

$ npm run lint
> marka@0.1.0 lint
> eslint

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  269:20  warning  Compilation Skipped: Use of incompatible library
  … react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
exit=0

$ npx next build
▲ Next.js 16.2.6 (Turbopack)
✓ Compiled successfully in 17.8s
✓ Generating static pages (19/19)

Route (app)
┌ ○ /                                    ├ ƒ /dashboard/preferencias
├ ○ /_not-found                          ├ ƒ /dashboard/propiedades
├ ƒ /[slug]                              ├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /admin                               ├ ƒ /dashboard/propiedades/nueva
├ ƒ /api/geocode                         ├ ƒ /dashboard/suscripcion
├ ○ /apple-icon.png                      ├ ƒ /login
├ ƒ /dashboard                           ├ ƒ /logout
├ ƒ /dashboard/equipo                    ├ ƒ /register
├ ƒ /dashboard/leads                     └ ƒ /register/plan
├ ƒ /dashboard/perfil
                                         (19 rutas)
exit=0
```

**Baseline intacto: 0 errores de TS, 0 errores de lint, el único warning conocido en la misma
línea, build verde con las mismas 19 rutas.**

---

## 7. Lo que dejé sin tocar, y por qué

- **Todo el código fuente.** El modo era documentación. Encontré cosas anotables (la asimetría
  de la reactivación, el dashboard sin aviso de baja, las dos FK) y **las escribí en
  `PENDIENTES.md` en vez de arreglarlas**.
- **Las dos FK de `agent_id` en la BASE.** El schema documentado ahora dice lo que la base
  tiene, pero **no corrí ni propuse correr ningún `ALTER`**: decidir si el modelo correcto es
  el escrito o el real es una decisión de diseño entrelazada con "desactivar agente" y con el
  fallback de WhatsApp, y vos mismo la marcaste como la próxima tanda. Queda anotada con la
  consecuencia viva.
- **`PLAN-ORIGINAL.md`.** Sigue globalmente desactualizado (lo dice su propio ítem de deuda) y
  no estaba en el alcance; tocarlo a medias lo dejaría peor.
- **La carpeta `supabase/pending/` como tal**: borré los dos archivos pero **dejé el directorio**
  (vacío), porque es una convención de trabajo viva y ahora está documentada en los dos lugares.
- **El texto de los mensajes de los triggers.** Están enganchados por *string match* con
  `translatePropertyWriteError`; cambiarlos es un cambio de código, no de documentación.
- **`respuesta.md` anterior**: sobrescrito entero, como pediste.
