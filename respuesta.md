# Informe — Documentación de la quinta tanda del grupo de blindaje

**Modo ejecución, solo documentación.** Se modificaron **dos archivos, los dos `.md`**:
`CLAUDE.md` y `PENDIENTES.md`. No se tocó `src/`, ni `scripts/`, ni el archivo de migración.
No se ejecutó ningún comando de git. No se ejecutó SQL de escritura.

**Todo se documentó leyendo el código y midiendo la base.** Lo que sigue está verificado con el
MCP o citado del archivo, no tomado del prompt.

**Baseline: intacto.** tsc 0 · lint 0 errores + el warning único · build verde, 19 rutas (§6).

## Lo primero, porque cambia un número del prompt

**La base tiene 10 agencias, no 9, y una de ellas es un alta de prueba del 7 sep que verifica
el trigger de punta a punta.** Su fila de suscripción tiene `created_at` **idéntico al
microsegundo** al de la agencia. Eso es evidencia dura de que la fila la creó el trigger dentro
de la misma sentencia, no el upsert de la aplicación. Detalle en §4.

---

## 1. CLAUDE.md — qué agregué, modifiqué y corregí

### Agregado

| Dónde | Qué |
|---|---|
| `### Suscripciones y límites` → **`#### Toda agencia nace con su suscripción — el trigger, no el código`** (nuevo) | El trigger con su cuerpo textual, **por qué no escribe valores salvo la clave** (los `DEFAULT` ya son el estado de aterrizaje; repetirlos sería una segunda fuente de verdad que divergiría en silencio), la tabla de defaults contrastada contra `PLANS.free`, y **que el upsert del registro NO es lo que crea la fila** sino una red de respaldo que no se eliminó a propósito |
| `### Suscripciones y límites` → **`#### Sin fila de suscripción el límite es 0`** (nuevo) | Los dos números lado a lado —`check_property_limit()` y `getPlanUsage`— y por qué tienen que coincidir. Incluye el bug que la divergencia producía y la aclaración de que **solo cambió el límite**: `status` y los tres `has_*` siguen cayendo a los de `PLANS.free` |
| `### Aprobación de agencias` (cuatro bullets nuevos) | El mensaje literal del choque de matrícula; **las tres condiciones de la detección** y por qué el código solo no alcanza (tres índices únicos, medido); el gate a la aprobación; y **el efecto colateral de que rechazar/reabrir libera la matrícula** |
| **`### ⚠ Un UPDATE acotado sobre una fila que no existe NO devuelve error`** (sección nueva, en Convenciones de Dominio) | La trampa, el caso que ya mordió, la solución con `count: "exact"` y **por qué es mejor que leer la fila antes**: leer y escribir son dos viajes distintos, el count mide lo que la escritura hizo |
| **`### ⚠ La guarda contra el cero de las barras de uso es VESTIGIAL`** (sección nueva) | Los **dos** lugares citados con línea, que la guarda quedó del modelo con plan "Ilimitado", y que **hoy es lo único que evita la división por cero** |
| `## Base de Datos — Referencia Rápida` | Párrafo **"Trigger de `agencies`"** y `ensure_agency_subscription()` en la lista de funciones |
| `## Método de Diagnóstico` | Ver §5 |
| `**Estado:**` (encabezado) | Una frase: grupo de blindaje cerrado, con sus dos resultados |

### Modificado / corregido por estar diciendo algo falso

Ver §3. La corrección de fondo está en `### Suscripciones y límites`, donde el bullet de `free`
afirmaba que `PLANS.free` era el fallback de `getPlanUsage` **sin distinguir el límite del
resto** — y eso dejó de ser cierto para el límite.

También actualicé la fecha del **baseline medido** (6 → 7 sep 2026).

### Lo que NO toqué

Las cuatro tandas anteriores (policies de Storage, límites del bucket, borrado de archivos,
herramienta de auditoría). **Las revisé buscando contradicciones y no encontré ninguna**: el
grupo de esta tanda toca suscripciones y aprobación, que no se cruzan con Storage. Sus cifras
siguen vigentes — el bucket sigue en **9 objetos** (medido).

---

## 2. PENDIENTES.md — qué cerré, abrí y ajusté

### Cerrados (2 ítems + el grupo entero)

**`El registro no deshace el upsert de subscriptions`** → cerrado **"RESUELTO POR LA BASE, y no
como decía este ítem"**. El diagnóstico era correcto pero **las dos salidas que proponía se
descartaron las dos**, y quedó registrado por qué:
- **NO reintentar en el código** — solo cubre fallos transitorios; no cierra el agujero ni
  cubre el SQL a mano.
- **NO una acción de reparación en `/admin`** — reactiva, y con el trigger el estado deja de
  ser producible: sería una décima acción de fila permanente para algo que no puede ocurrir.
- **La barrera en la base es la única que cubre todos los caminos y no depende de que ningún
  código se acuerde.**

Incluye además los dos síntomas que el ítem original no mencionaba (el límite 1 vs 0 y el
éxito falso del pedido de upgrade) y la verificación por timestamps.

**`Matrículas duplicadas entre agencias pendientes`** → cerrado, con las tres condiciones de la
detección, la extracción de la matrícula del `details` **y la aclaración de que si esa
extracción falla el mensaje funciona igual**, el gate a la aprobación, y el efecto colateral.

**El grupo entero** → cerrado en `## Cerrados recientemente`, con las cinco tandas resumidas
una por una, lo que quedó abierto a propósito, y una nota de método.

> ⚠ **No existía un encabezado propio para el grupo de cinco tandas.** Lo que hay es
> `### Limpieza de Storage — grupo CERRADO (6 sep 2026)`, que cubre las tandas 3 y 4, y los dos
> ítems de esta tanda vivían sueltos en "Deuda técnica". Cerré el grupo donde el archivo
> registra los cierres, y lo digo explícitamente en el ítem para que nadie lo busque arriba.

### Abiertos (3, todos verificados antes de escribirlos)

1. **El residuo consciente del mensaje con límite 0** — el bloqueo funciona, el texto dice
   "alcanzaste el límite de tu plan" cuando falta una fila. Verificado leyendo
   `NewPropertyButton` → `PlanLimitMessage`. Anotado con la razón de no arreglarlo: exige un
   cuarto motivo en `PublishBlockReason` y tocar el `switch` exhaustivo que ya se rompió una vez.
2. **No verificado en pantalla** — el bloqueo con límite 0 se comprobó por lectura de código y
   revisando los consumidores, **no en el navegador**, porque fabricar el caso exige dejar una
   transacción abierta mientras se navega. Anotado como *no verificado, riesgo bajo*, con el
   porqué del riesgo bajo.
3. **Limpieza de datos previa al lanzamiento** — 8 de 10 agencias sin matrícula, **1 sola fila
   dentro del predicado del índice**. Anotado explícitamente **como limpieza de datos, no como
   deuda técnica**, junto a los 2 usuarios de Auth huérfanos.

### Ajustados

**Ninguno, y lo verifiqué en vez de asumirlo.** Repasé el archivo buscando cifras que esta
tanda dejara viejas:

| Afirmación existente | Medido hoy | ¿Sigue vigente? |
|---|---|---|
| *"Quedan **2** usuarios de Auth huérfanos"* | `auth_users` 12, `agents` 10 → **2** | ✅ sin cambios |
| *"Con **9 archivos** … el momento más barato para mover `ImageUploader`"* | 9 objetos en el bucket | ✅ sin cambios |
| Cifras del grupo de Storage (24 → 9 objetos, 707 kB, cero huérfanos) | idem | ✅ sin cambios |

No inventé trabajo donde no lo había.

---

## 3. Afirmaciones falsas encontradas

**Dos**, las dos en `CLAUDE.md`. Menos que en las tandas anteriores, y por un motivo que vale
la pena decir: **la afirmación falsa más cara de este grupo estaba en un comentario del código,
no en un `.md`**, y ya se corrigió en la tanda de implementación.

### (1) El fallback de `PLANS.free` en `getPlanUsage` — falso desde esta tanda

> *"Los valores de `PLANS.free` (`propertyLimit: 1` + los tres flags en `false`) … son … los
> que `getPlanUsage` usa de fallback si falta la fila."*

**Falso para el límite.** Medido en `src/lib/utils/getPlanUsage.ts`: el límite cae a
`NO_SUBSCRIPTION_LIMIT = 0`. Sigue siendo cierto para los tres `has_*` y para el `status`.
Corregido distinguiendo los dos casos, con un ⚠ que remite a la subsección nueva.

### (2) `### Suscripciones y límites` no decía de dónde sale la fila

No era una afirmación falsa sino una **omisión que se volvió engañosa**: la sección describía
`subscriptions` sin mencionar que ahora su existencia está garantizada por la base, y el único
lugar que hablaba de crearla era el bullet del registro con service role. Quien leyera solo eso
concluiría que la fila la crea la aplicación. Resuelto con el bloque destacado al inicio de la
sección y la subsección del trigger.

### La que ya estaba corregida en el código, y que motiva la nota de método

`getPlanUsage` decía *"ese caso ya lo bloquea el límite 0"* mientras el límite que ese mismo
archivo calculaba era **1**. Se corrigió en la tanda de implementación; acá quedó **elevada a
regla de método** (§5), porque el patrón es el que más se repitió en todo el grupo.

---

## 4. Los números medidos

Todo con el MCP el 7 sep 2026.

| Métrica | Valor |
|---|---|
| Agencias | **10** |
| Filas en `subscriptions` | **10** |
| **Agencias sin fila de suscripción** | **0** |
| Agencias con `license_number` | **2** |
| Agencias con `license_number` en `NULL` | **8** |
| Agencias aprobadas | 9 |
| **Filas dentro del predicado del índice** (`approved` + matrícula no nula) | **1** |
| **Índices únicos sobre `agencies`** | **3** |

Los tres índices, leídos de `pg_index`:
```
agencies_pkey                        | UNIQUE (id)
agencies_slug_key                    | UNIQUE (slug)
idx_agencies_license_unique_approved | UNIQUE (city_id, license_number)
                                       WHERE approval_status='approved' AND license_number IS NOT NULL
```
**Los tres levantan `23505`.** Es exactamente por eso que la detección exige además el nombre
del índice.

### El trigger, verificado de punta a punta con datos reales

Apareció un alta de prueba posterior a la implementación, y es la mejor evidencia posible:

```
name          | approval_status | license | agency.created_at            | subscription.created_at
--------------+-----------------+---------+------------------------------+------------------------------
Inmoprueba 1  | pending         | 1235    | 2026-09-07 02:32:41.767784+00 | 2026-09-07 02:32:41.767784+00
Inmob. Gaio   | approved        | 1234    | 2026-08-28 21:42:14.714789+00 | 2026-08-28 21:42:15.133732+00
```

**En el alta nueva los dos timestamps son idénticos al microsegundo** → la fila la creó el
trigger **dentro de la misma sentencia**. En la agencia vieja hay **~419 ms** de diferencia →
esa la creó el upsert de la aplicación, en un viaje aparte. La fila resultante:
`plan='free'`, `status='active'`, `property_limit=1`, los tres `has_*` en `false` — el estado
de aterrizaje exacto.

### Los defaults contrastados contra el catálogo (punto a del pedido)

| | `DEFAULT` de la columna | `PLANS.free` (`src/types/index.ts`) | ¿Coincide? |
|---|---|---|---|
| `plan` | `'free'` | `id: "free"` | ✅ |
| `status` | `'active'` | (el registro escribía `"active"`) | ✅ |
| `property_limit` | `1` | `propertyLimit: 1` | ✅ |
| `has_featured` | `false` | `featured: false` | ✅ |
| `has_white_label` | `false` | `whiteLabel: false` | ✅ |
| `has_metrics` | `false` | `metrics: false` | ✅ |

**Coinciden los seis.** Son los mismos valores que escribía el upsert del registro, que es lo
que hace que el trigger pueda no escribirlos.

### Los dos números del límite (punto b del pedido) — leídos y confirmados

| | Qué dice ante la ausencia de fila |
|---|---|
| `check_property_limit()` (base) | `IF max_allowed IS NULL THEN max_allowed := 0;` |
| `getPlanUsage` (`lib/utils/`) | `const limit = subscription?.property_limit ?? NO_SUBSCRIPTION_LIMIT;` con `NO_SUBSCRIPTION_LIMIT = 0` |

**Coinciden.**

### Las dos guardas vestigiales (punto d del pedido) — citadas

```
src/components/dashboard/PlanBadge.tsx:14
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

src/components/dashboard/SubscriptionContent.tsx:191
  const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
```

Y el comentario que revela que son vestigiales, `PlanBadge.tsx:12-13`:
> *"En el modelo de 4 planes todos tienen un límite finito → todos muestran el contador +
> micro-barra de proporción (used/limit). **Ya no hay 'Ilimitado'**."*

---

## 5. La sección de método: **existía**, y le agregué la línea

`## Método de Diagnóstico` (`CLAUDE.md`) ya existía, con un párrafo sobre inspeccionar el DOM
real antes de teorizar sobre el build. **No creé nada nuevo: agregué un párrafo ahí**, como
pedía la instrucción.

Lo que dice, en resumen: **los comentarios que afirman que un caso ESTÁ CUBIERTO son los más
peligrosos, porque desactivan la sospecha.** Con el ejemplo que lo cerró —*"ese caso ya lo
bloquea el límite 0"* en un archivo cuyo límite era 1— y los otros tres del mismo grupo (dos
cláusulas `ON DELETE` que la base no tenía, y un *"el único código que borra logos y avatares"*
que había dejado de ser único). La regla: **un comentario que afirma una propiedad de la base o
de otro archivo hay que medirlo antes de creerle**, sobre todo si es la razón por la que algo
no se está revisando.

---

## 6. Los tres comandos de calidad

### `npx tsc --noEmit`
```
(sin salida)
```
**EXIT = 0**

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
```
**EXIT = 0**

### `npx next build`
```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 7.9s
  Running TypeScript ...
  Finished TypeScript in ~8s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (19/19) in 1154ms
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
```
**EXIT = 0**

*(Confirmado con una segunda corrida posterior a la última edición de `.md`: mismos resultados,
mismas 19 rutas.)*

### Comparación contra el baseline

| | Baseline | Ahora | ¿Coincide? |
|---|---|---|---|
| `tsc --noEmit` | 0 errores, exit 0 | 0 errores, exit 0 | ✅ |
| `lint` errores | 0 | 0 | ✅ |
| `lint` warnings | 1 · `react-hooks/incompatible-library` · `PropertyForm.tsx` | 1 · el mismo · `808:30` | ✅ |
| `next build` | verde, exit 0 | verde, exit 0 | ✅ |
| Rutas | 19 | 19, las mismas | ✅ |

---

## 7. Lo que el prompt afirma y no coincide con lo medido

**Los hechos centrales de las dos partes son correctos**, y los verifiqué uno por uno: el
trigger existe y dispara AFTER INSERT sobre `agencies`; su cuerpo no escribe valores salvo la
clave; los defaults son los del estado de aterrizaje y coinciden con `PLANS.free`;
`getPlanUsage` reporta 0 y coincide con `check_property_limit()`; el mensaje de matrícula nombra
la matrícula y explica la regla; las tres condiciones de la detección están en el código; y las
dos guardas vestigiales existen donde el prompt dice.

**Tres cosas donde lo medido dice algo distinto o más:**

### (1) El encabezado del "grupo de blindaje de cinco tandas" NO existe en PENDIENTES.md

El prompt dice *"Buscá el encabezado de ese grupo y dejalo cerrado"*. **Lo busqué y no está.**
Lo que hay es `### Limpieza de Storage — grupo CERRADO (6 sep 2026)`, que cubre las tandas 3 y
4, y los dos ítems de esta tanda estaban **sueltos en "Deuda técnica"**, sin agrupar. El grupo
de cinco tandas es una lectura del prompt, no una estructura del archivo.

**Qué hice:** cerré el grupo en `## Cerrados recientemente`, que es donde el archivo registra
los cierres, con las cinco tandas enumeradas — y **dejé escrito en el propio ítem que el grupo
no tenía encabezado propio**, para que nadie lo busque arriba y crea que se perdió.

### (2) La base tiene 10 agencias, no las 9 de la medición anterior

Apareció un alta de prueba **posterior a la implementación** ("Inmoprueba 1", 7 sep 02:32).
Lejos de ser un problema, es **la verificación end-to-end del trigger que faltaba** (§4): sus
timestamps prueban que la fila la creó el trigger y no la aplicación. Lo usé como evidencia en
el ítem cerrado de PENDIENTES.

Consecuencia menor: **8 de 10 sin matrícula**, no 8 de 9. El ítem nuevo de limpieza de datos
lleva los números medidos hoy.

### (3) *"varios comentarios y notas que afirmaban cosas que la base desmentía"* — en esta tanda fueron **dos**, y ninguno era del código

El prompt advierte sobre el patrón y dice que ya pasó cuatro veces. **Es cierto como historia
del grupo**, pero conviene la precisión: **las dos afirmaciones falsas que encontré en esta
pasada estaban en `CLAUDE.md`, no en el código** (§3). La del código —el *"ya lo bloquea el
límite 0"*— ya había sido corregida en la tanda de implementación. Lo digo porque la advertencia
podría hacer buscar en el lugar equivocado: **el código quedó limpio; lo que faltaba alinear era
la documentación.**
