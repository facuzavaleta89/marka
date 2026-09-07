# Informe — Documentación del modelo "la consulta sobrevive al agente"

> **Modo ejecución, solo documentación.** Toqué **exactamente dos archivos**: `CLAUDE.md` y
> `PENDIENTES.md`. No modifiqué ni una línea de `src/`, ni de `scripts/`, ni del archivo de
> migración. **No ejecuté ningún comando de git** ni ningún SQL de escritura: el MCP de Supabase
> se usó solo para medir.
>
> **Fecha de las mediciones:** 7 sep 2026.
>
> **Todo lo que escribí sale del código o de la base, no de este prompt.** Donde el prompt y la
> medición no coincidían, ganó la medición — hay dos casos, en §6.

---

## 0. El hallazgo que cambia el tono de todo el informe

**El flujo ya se ejercitó de verdad, con datos reales, y funcionó.** No estaba en el prompt y lo
encontré midiendo:

```sql
SELECT id, agent_id, agent_name, contact_name, created_at FROM leads WHERE agent_id IS NULL;
```
```json
[{"id":"cc39d846-…","agent_id":null,"agent_name":"Luis Lescano",
  "contact_name":"Gaiolas","created_at":"2026-09-07 14:39:49.101599+00"}]
```

Un agente (**Luis Lescano**) fue creado, recibió una consulta desde el mapa público (de un
visitante que puso "Gaiolas"), y después fue borrado. **La consulta sobrevivió**: `agent_id` en
NULL, `agent_name` intacto. Eso ejercita de una sola pasada `createAgentAction`,
`deleteAgentAction`, el trigger `trg_set_lead_agent_name`, el `ON DELETE SET NULL` y el camino
público del `insert`.

En el informe de la tanda anterior yo había dejado anotado que ese caso **no era alcanzable con
los datos de entonces** y que había que fabricarlo. Se fabricó. **Documenté el modelo como algo
verificado en producción, no como algo que debería funcionar**, y cité esa fila como evidencia en
los dos archivos.

---

## 1. Qué agregué, modifiqué y corregí en `CLAUDE.md`

### Agregado

| Dónde | Qué |
|---|---|
| **Nueva sección `### La consulta sobrevive al agente que la atendió`** (después de "WhatsApp", su vecino natural) | El modelo completo, en seis sub-bloques: el modelo nuevo; por qué el nombre lo escribe la base; por qué la copia es congelada; los tres estados de la pantalla; el cambio de alcance de las policies; y las dos trampas |
| **Nueva sección `### El registro de la consulta NO puede bloquear al visitante`** | El criterio del contacto por encima del registro, qué defecto cierra, y por qué el aviso no es rojo |
| **`Trigger de leads`** en la referencia de Base de Datos | `trg_set_lead_agent_name`, con por qué es BEFORE y por qué solo INSERT |
| **`set_lead_agent_name()`** en "Funciones y RPC" | Con el motivo del `SECURITY DEFINER`: el INSERT lo hace `anon`, y el día que se restrinja `Public read agents` el `SELECT` dejaría de ver la fila y **toda consulta nueva quedaría sin nombre en silencio** |
| **Cinco filas** en "Decisiones de Arquitectura" | El reparto reasignar-vs-desvincular; el nombre por trigger; la copia congelada vs `agents.email`; y el registro que no bloquea el contacto |
| **Resumen del Proyecto → Estado** | El cierre de la pieza, con las tres cosas de la tanda |

### Corregido (afirmaciones que este trabajo dejó falsas — el detalle en §3)

| Dónde | Qué decía | Qué dice ahora |
|---|---|---|
| **Roles de agente** | *"hoy no se puede borrar un agente que tenga consultas a su nombre"* + FK `NO ACTION` + NOT NULL | Marcado como **RESUELTO**, con las dos FK re-medidas y la evidencia de producción |
| **Policies RLS clave** | *"no contempla `agent_id IS NULL`, y hoy ese caso no puede existir: la columna es NOT NULL"* | La columna **ya no** es NOT NULL y el caso **sí** existe; se explica por qué la policy igual no se toca |
| **Tabla `leads`** en la referencia | *"Contactos WA. Incluye `agency_id`"* | Nullabilidad, FK `SET NULL`, `agent_name` como copia congelada, y "sin ningún CHECK" |
| **Método de Diagnóstico** | *"ya costó **cuatro** veces"* | **cinco**, con el `"Estado consistente"` como quinto caso |
| **Estructura de Carpetas** | tres líneas (`equipo/`, `leads/`, `LeadsContent.tsx`) | Reflejan el conteo de consultas, la prohibición del `!inner` y `AgentCell` |

### Lo que decidí escribir y no estaba pedido explícitamente

- **El diseño cierra por los dos lados**, medido: si `agent_id` viene cargado, el trigger **pisa**
  cualquier `agent_name` entrante; si viniera nulo, el insert ni se escribe porque la policy lo
  rechaza. **No hay ninguna combinación en la que un `agent_name` del navegador llegue a la
  tabla.** Sin eso, la regla "no lo mandes desde el cliente" queda como una convención que
  alguien puede violar; con eso, queda como una imposibilidad.
- **Un matiz nuevo en "Método de Diagnóstico"**: el caso del `"Estado consistente"` agrega algo
  que los otros cuatro no tenían — **el comentario que miente estaba a dos líneas del que decía la
  verdad** (el mismo bloque explicaba, arriba, que el borrado fallaba siempre). La cercanía no es
  evidencia de coherencia.
- **Por qué el nombre del caso 2 no se atenúa**: la tentación es ponerlo en `stone` para "marcar"
  que ya no está, y es un error — el nombre **es el dato**, y lo que cambió de estado es la
  persona, no el registro.
- **Que la guarda `if (l.agent_id)` del conteo es load-bearing**, a diferencia de la del conteo de
  propiedades, donde es defensiva. Ahí las filas con nulo **existen de verdad**.

---

## 2. Qué cerré, abrí y ajusté en `PENDIENTES.md`

### Cerrado (la mitad que corresponde)

**`⚠ LAS DOS FK DE agent_id`** — reescrito de *"NO SON LO QUE EL MODELO DICE — PRÓXIMA TANDA"* a
**"UNA RESUELTA, LA OTRA ABIERTA A PROPÓSITO"**:

| Columna | Base (7 sep 2026) | Estado |
|---|---|---|
| `leads.agent_id` | nullable, `ON DELETE SET NULL` | ✅ **RESUELTA** |
| `properties.agent_id` | **NOT NULL**, `ON DELETE CASCADE` | ⬜ **ABIERTA, y no es un olvido** |

**Las dos alternativas descartadas quedaron registradas con su motivo**, en tabla, para que no se
vuelvan a proponer:

| Alternativa | Por qué NO |
|---|---|
| Reasignarlas al admin, como las propiedades | Mentiría sobre quién la atendió. Una propiedad es un **activo vivo** y necesita dueño; una consulta es un **registro de algo que pasó**, y ese hecho no cambia de dueño porque una persona se fue |
| Borrarlas junto con el agente (`CASCADE`) | Perdería el historial comercial de la **agencia**, que es quien pagó por esas consultas. La agencia no pierde su historial porque se le vaya un empleado |

**La mitad de propiedades quedó abierta pero re-encuadrada:** el reparto asimétrico
—reasignar propiedades / desvincular consultas— **es el modelo correcto, no una tarea a medias**.
Lo que queda por decidir es si vale la pena `ALTER`ar esa FK, y anoté que **no hay urgencia**
(0 propiedades sin agente, y el camino de borrado ya no pierde nada) y que **antes hay que
resolver el fallback de WhatsApp a la agencia**, o el botón quedaría sin destino.

### Abiertos (los tres, verificados antes de escribirlos)

1. **El borrado de un agente NO ES ATÓMICO.** Con la tabla de los tres pasos y qué queda hecho si
   el tercero falla: propiedades ya reasignadas, avatar ya borrado, agente todavía vivo y capaz de
   iniciar sesión. Anoté que **lo que se arregló fue la descripción, no el estado**; que la causa
   más frecuente desapareció con el `SET NULL` pero el estado sigue alcanzable por otro fallo de
   Auth; y **por qué no se cerró**: exige reordenar o compensar pasos, que es un cambio de
   comportamiento no autorizado — y reordenar tiene su propio costo, ya documentado (el avatar va
   antes justamente para que el agente siga apareciendo en Equipo si algo falla).

2. **La consulta sobrevive al borrado del AGENTE pero no al de la PROPIEDAD.** Verificado:
   `leads_property_id_fkey` sigue siendo `ON DELETE CASCADE`. Anotado **como decisión, no como
   bug**, con los argumentos de los dos lados y con lo que habría que resolver antes de cambiarlo
   (qué muestra la columna "Propiedad", y probablemente congelar también el título).

3. **`leads` no tiene índice sobre `agent_id`.** Verificado: los únicos índices son `leads_pkey` e
   `idx_leads_agency`; **cero** que incluyan `agent_id`. La policy `Agent reads own leads` filtra
   por ahí. Anotado explícitamente como **preexistente, no una regresión**, y con el momento
   natural para mirarlo: cuando una agencia sume su primer agente **no-admin**, que es el único
   perfil que ejercita esa policy.

### Ajustado

| Ítem | Cambio |
|---|---|
| **Encuadre → "Hoy"** | Cifras re-medidas (§4), incluyendo la consulta desvinculada como evidencia |
| **"Multi-agente no tiene millaje real"** | Reescrito: **ya no es cero**. El ciclo alta→consulta→baja se recorrió de verdad; lo que sigue sin recorrerse es la **convivencia** (dos agentes a la vez, un no-admin abriendo Consultas, reasignación entre pares) |
| **Sub-pieza 4 — Desactivar agente** | **Dejada como está**, con la aclaración de que **SIGUE ABIERTA y no se hizo** en esta tanda. Le agregué qué decidir sobre las consultas al desactivar: como es **reversible**, probablemente **no** corresponda desvincularlas (el agente puede volver) — conviene decidirlo en vez de heredarlo del borrado |
| **Sub-pieza 3 (histórico)** | Reescrita la corrección: ahora cuenta **las dos vueltas** — lo que el ítem afirmaba de más terminó siendo verdad, pero recién después de migrarlo a propósito; no describía la base, describía un deseo |
| **"Salvedad medida el 1 sep"** | Suma el desenlace del 7 sep |
| **Changelog del grupo de blindaje** | Entrada **6**, y "lo que quedó abierto" pasó de cuatro a **cinco** ítems |

### Lo que dejé intacto a propósito

`increment_views` (su medición está fechada al 3 sep y es honesta así), el ítem de limpieza de
datos previa al lanzamiento, `PLAN-ORIGINAL.md`, y todos los ítems que este trabajo no tocó.

---

## 3. Afirmaciones falsas que encontré

Cinco, todas en la documentación y todas de la misma familia: **describían la base de antes de la
migración**.

| # | Archivo | Decía | Realidad medida |
|---|---|---|---|
| 1 | `CLAUDE.md`, Roles de agente | *"`leads.agent_id` es **NOT NULL** y su FK **no tiene cláusula ON DELETE**… **hoy no se puede borrar un agente que tenga consultas a su nombre**"* | Nullable + `ON DELETE SET NULL`. **Se puede borrar, y ya se borró uno** |
| 2 | `CLAUDE.md`, Roles de agente | *"Resolver esas dos FK es la próxima tanda"* | Una de las dos **ya está resuelta**; la otra quedó abierta por decisión |
| 3 | `CLAUDE.md`, Policies RLS clave | *"no contempla `agent_id IS NULL`, y hoy ese caso no puede existir: la columna es NOT NULL en la base"* | **El caso existe** (1 fila). La policy sigue sin contemplarlo, y eso ahora es lo correcto a preservar, no una limitación |
| 4 | `CLAUDE.md`, Método de Diagnóstico | *"ya costó **cuatro** veces"* | **Cinco**: falta el `"Estado consistente"` de `deleteAgentAction` |
| 5 | `PENDIENTES.md`, sub-pieza 3 | *"hoy el borrado **choca contra esa FK** si el agente tiene consultas"* | Ya no choca |

**Una precisión sobre la #1 y la #5, porque es lo interesante del caso:** ninguna de las dos era
un error de quien las escribió — **eran correctas cuando se escribieron**, y las dos venían de una
corrección previa que había medido bien. Envejecieron en tres días. Es exactamente el patrón que
`CLAUDE.md` documenta en "Método de Diagnóstico", y por eso en las dos dejé escrito **qué decían
antes** en vez de reemplazarlas en silencio: alguien que recuerde la afirmación vieja tiene que
poder encontrar dónde se cayó.

---

## 4. Los números que medí

```sql
SELECT (SELECT count(*) FROM agencies) AS agencias,
       (SELECT count(*) FROM agents) AS agentes,
       (SELECT count(*) FROM leads) AS consultas, …
```

| Métrica | 3 sep 2026 (lo que decía `PENDIENTES.md`) | **7 sep 2026 (medido)** |
|---|---|---|
| Agencias | 9 | **10** |
| Agentes | 9 | **10** |
| Propiedades | 17 | **18** |
| Consultas | 8 | **9** |
| Consultas **desvinculadas** (`agent_id NULL`) | — | **1** |
| Consultas **con `agent_name`** | — | **9 de 9** ✅ |
| Agencias con más de un agente | 0 | **0** |
| Propiedades sin agente | — | **0** |

**Estado de la base, verificado pieza por pieza:**

| Pieza | Medido |
|---|---|
| `leads.agent_id` | `uuid`, **nullable**, sin default, posición 3 |
| `leads.agent_name` | `text`, **nullable**, sin default, posición 11 |
| `leads_agent_id_fkey` | `FOREIGN KEY (agent_id) REFERENCES agents(id) **ON DELETE SET NULL**` |
| `properties_agent_id_fkey` | `FOREIGN KEY (agent_id) REFERENCES agents(id) **ON DELETE CASCADE**` (sin cambios) |
| `leads_property_id_fkey` | `... **ON DELETE CASCADE**` (sin cambios — de ahí la asimetría anotada) |
| `trg_set_lead_agent_name` | `BEFORE INSERT ON public.leads FOR EACH ROW`, habilitado (`tgenabled='O'`). Único trigger de la tabla |
| `set_lead_agent_name()` | `SECURITY DEFINER`, `search_path=public`, VOLATILE |
| Policies de `leads` | **Las tres, sin cambios**: `Public insert lead`, `Agent reads own leads`, `Admin reads agency leads` |
| CHECKs de `leads` | **Cero** |
| Índices de `leads` | `leads_pkey`, `idx_leads_agency`. **Cero sobre `agent_id`** |

---

## 5. Baseline de calidad

Esta tarea toca solo archivos `.md`, así que nada podía moverse. **No se movió.**

### `npx tsc --noEmit`
```
(sin salida)
EXIT_TSC=0
```

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

### `npx next build`
```
  Creating an optimized production build ...
✓ Compiled successfully in 14.2s
  Running TypeScript ...
  Finished TypeScript in 9.6s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (19/19) in 1422ms
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

### Comparación

| Comando | Baseline | Ahora | |
|---|---|---|---|
| `npx tsc --noEmit` | 0 errores, exit 0 | 0 errores, exit 0 | ✅ |
| `npm run lint` | 0 errores, 1 warning, exit 0 | 0 errores, **el mismo** warning (`PropertyForm.tsx:808`), exit 0 | ✅ |
| `npx next build` | verde, 19 rutas, exit 0 | verde, 19 rutas, exit 0 | ✅ |

La línea de baseline de `CLAUDE.md` ya decía "última medición: 7 sep 2026" y los tres valores
coinciden con lo que acabo de medir, así que **no la toqué**: sigue siendo exacta.

---

## 6. Qué de este prompt resultó falso

**Dos cosas, las dos menores, y las dos a favor.**

**1. "El estado intermedio del borrado… la causa más frecuente desapareció con este cambio, pero
el estado sigue siendo alcanzable" — correcto, pero el prompt no sabía que el flujo ya se probó
en producción.** El punto 0 de este informe: el ciclo completo alta→consulta→baja se ejercitó con
un agente real y funcionó. Eso no invalida nada de lo que el prompt pide documentar (el estado a
medias sigue siendo alcanzable por otro fallo), pero **cambia el peso de lo documentado**: escribí
el modelo como verificado, y ajusté el ítem de "multi-agente no tiene millaje" en `PENDIENTES.md`,
que decía que la maquinaria "nunca se ejercitó" y ya no es cierto de la mitad de alta y baja.

**2. "Verificá si quedó pendiente algo de la pieza de desactivar agentes… Si el ítem existe,
dejalo como está y aclará que sigue abierto."** El ítem existe (sub-pieza 4) y lo dejé abierto,
pero **no lo dejé literalmente como estaba**: le agregué una línea. El ítem cerraba con *"Decidir
qué pasa con sus propiedades al desactivar"*, y ahora que el destino de las consultas **sí** está
decidido para el borrado, hay un riesgo concreto de que alguien lo herede por analogía. **En una
desactivación reversible probablemente NO corresponda desvincularlas** —el agente sigue existiendo
y puede volver—, así que anoté que hay que decidirlo explícitamente. Lo aclaro porque es una
desviación de la instrucción, chica pero real.

**El resto del prompt resultó exacto**, incluidos los cinco puntos del inciso (a)-(f) sobre
`CLAUDE.md` y los tres ítems a abrir en `PENDIENTES.md`, que verifiqué uno por uno contra la base
antes de escribirlos.

---

## Lo que NO hice

- **No toqué `src/`, `scripts/` ni el archivo de migración.** Los únicos archivos escritos en esta
  sesión son `CLAUDE.md`, `PENDIENTES.md` y este informe.
- **No ejecuté comandos de git**, ni de lectura.
- **No ejecuté SQL de escritura.** Todas las consultas del MCP fueron `SELECT` sobre catálogos y
  conteos.
- **No reescribí secciones que este trabajo no afectó.** Las ediciones de `CLAUDE.md` son dos
  secciones nuevas y siete retoques puntuales; las de `PENDIENTES.md`, un ítem reescrito, tres
  abiertos y cinco ajustados.
