# Informe — Suscripción garantizada por la base + error de matrícula explicado

**Modo ejecución.** No se ejecutó ningún comando de git. No se ejecutó SQL de escritura: el
cambio de base ya estaba aplicado y el MCP se usó **solo para verificarlo**.

**Baseline: intacto.** tsc 0 · lint 0 errores + el warning único · build verde, 19 rutas (§7).

**Las doce decisiones se implementaron tal como estaban descritas.** Ninguna resultó imposible.
Hay **una afirmación del prompt que no se sostuvo al medir** y **un residuo que el alcance
fijado deja abierto a propósito**: los dos están en §8, sin acomodar.

---

## 1. Archivos modificados y creados

**Creados: ninguno.** Los seis cambios son ediciones.

| Archivo | Por qué |
|---|---|
| `src/lib/utils/getPlanUsage.ts` | Sin fila, el límite pasa de `PLANS.free.propertyLimit` (1) a **0**, que es lo que hace el trigger. Se corrigió el comentario falso |
| `src/app/(agent)/register/actions.ts` | El upsert **se mantiene**; cambió su comentario: ya no es lo que crea la fila, es la red de respaldo |
| `src/app/(agent)/dashboard/suscripcion/actions.ts` | `count: "exact"` en el UPDATE: cero filas afectadas ya no se informa como éxito |
| `src/app/(agent)/register/plan/actions.ts` | Solo comentario: por qué el camino "sin fila" ya no es alcanzable y por qué el mensaje se conserva |
| `src/app/(agent)/register/plan/page.tsx` | Ídem, en la guarda gemela de la página |
| `src/app/(agent)/admin/actions.ts` | `translateApprovalWriteError` + `extractLicenseFromDetail` + la constante del índice, y el comentario del efecto colateral |
| `supabase/migrations/20240101000000_initial_schema.sql` | La función y el trigger nuevos, transcritos de la base, más su entrada en el changelog del encabezado |

**No tocados**, como pedía el alcance: `CLAUDE.md`, `PENDIENTES.md`, y ninguna acción nueva en
el panel de administración.

---

## 2. La función y el trigger, leídos de la base

### El trigger

```sql
select t.tgname, c.relname, pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid …
```
```
trg_ensure_agency_subscription | agencies |
  CREATE TRIGGER trg_ensure_agency_subscription
    AFTER INSERT ON public.agencies
    FOR EACH ROW EXECUTE FUNCTION ensure_agency_subscription()
```

### La función

```sql
select pg_get_functiondef(p.oid), p.prosecdef … where p.proname='ensure_agency_subscription';
```
```sql
CREATE OR REPLACE FUNCTION public.ensure_agency_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Toda agencia nace con su fila de suscripción en el estado de aterrizaje.
  -- Los valores NO se escriben acá: salen de los DEFAULT de subscriptions
  -- (plan='free', status='active', property_limit=1, los tres has_* en false),
  -- así que hay una sola fuente de verdad en la base.
  INSERT INTO subscriptions (agency_id)
  VALUES (NEW.id)
  ON CONFLICT (agency_id) DO NOTHING;
  RETURN NEW;
END;
$function$
```
`prosecdef = true` (SECURITY DEFINER), `provolatile = 'v'` (VOLATILE), resultado `trigger`.

**Esto es lo que transcribí al schema documentado, textual.** No copié nada del prompt.

### Confirmación de los defaults: SÍ son el estado de aterrizaje

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns where table_name='subscriptions' order by ordinal_position;
```
```
id                 | uuid        | NO  | gen_random_uuid()
agency_id          | uuid        | NO  | (sin default)   ← lo único que escribe el trigger
plan               | text        | NO  | 'free'::text
status             | text        | NO  | 'active'::text
property_limit     | integer     | NO  | 1
current_period_end | timestamptz | YES | (null)
created_at         | timestamptz | YES | now()
updated_at         | timestamptz | YES | now()
has_white_label    | boolean     | NO  | false
has_featured       | boolean     | NO  | false
has_metrics        | boolean     | NO  | false
activated_at       | timestamptz | YES | (null)
pending_plan       | text        | YES | (null)
```

Contrastado contra `PLANS.free` (`src/types/index.ts:538-542`):

| | DEFAULT de la columna | `PLANS.free` | ¿Coincide? |
|---|---|---|---|
| `plan` | `'free'` | `id: "free"` | ✅ |
| `status` | `'active'` | (el registro escribía `"active"`) | ✅ |
| `property_limit` | `1` | `propertyLimit: 1` | ✅ |
| `has_featured` | `false` | `featured: false` | ✅ |
| `has_white_label` | `false` | `whiteLabel: false` | ✅ |
| `has_metrics` | `false` | `metrics: false` | ✅ |

**Los siete valores que escribía el upsert de `registerAction` son exactamente los defaults.**
Por eso `INSERT INTO subscriptions (agency_id)` produce la misma fila, y repetirlos en el
cuerpo del trigger sería una segunda fuente de verdad — que es lo que quedó explicado en el
comentario del schema.

### Estado actual verificado

```
agencias: 9 · suscripciones: 9 · sin_suscripcion: 0 · indices_unicos_en_agencies: 3
```

---

## 3. Cómo quedó el helper, y qué encontré en sus consumidores

### El cambio

`src/lib/utils/getPlanUsage.ts`:

```ts
// Cupo de una agencia SIN fila de suscripción. Réplica exacta del
// `IF max_allowed IS NULL THEN max_allowed := 0` de check_property_limit():
// no es "el plan más chico", es "no hay plan".
const NO_SUBSCRIPTION_LIMIT = 0;
```
```ts
  const limit = subscription?.property_limit ?? NO_SUBSCRIPTION_LIMIT;
```

**Solo cambió el límite**, como pedía la decisión 3. Los tres booleanos y el estado quedaron
donde estaban:

```ts
    status: subscription?.status ?? "active",
    …
    hasFeatured: subscription?.has_featured ?? PLANS.free.featured,
    hasWhiteLabel: subscription?.has_white_label ?? PLANS.free.whiteLabel,
    hasMetrics: subscription?.has_metrics ?? PLANS.free.metrics,
```

### El comentario falso, corregido

Decía *"Sin fila de suscripción se reporta 'active' a propósito: **ese caso ya lo bloquea el
límite 0**"* — falso, porque el límite que ese archivo calculaba era 1. Ahora:

```ts
    // Sin fila de suscripción se reporta 'active' a propósito: el bloqueo lo da
    // el límite 0 de arriba, y declararla inactiva cambiaría el motivo que se le
    // muestra al agente ('subscription_inactive' en vez de 'plan_limit') sin que
    // su situación lo justifique — no la dieron de baja, le falta una fila.
    //
    // ⚠ Este comentario decía "ese caso ya lo bloquea el límite 0" cuando el
    // límite que este archivo calculaba era 1. Era falso, y era justamente el
    // comentario que hacía parecer cubierto el caso que nadie cubría.
```

### Los consumidores, revisados uno por uno

Buscados con `grep -rn "\.limit\b|planUsage\.limit|limit}" src/`. Son **cuatro**, más los
derivados.

| # | Consumidor | Qué hace con el límite | Con 0 |
|---|---|---|---|
| 1 | `PlanBadge.tsx:14` | **divide**: `(used / limit) * 100` | **Ya estaba guardado**: `limit > 0 ? … : 0` |
| 2 | `SubscriptionContent.tsx:191` | **divide**: `usagePercent` | **Ya estaba guardado**: idéntica expresión |
| 3 | `PlanBadge.tsx:22` | texto `{used}/{limit}` | `0/0`. Correcto |
| 4 | `dashboard/page.tsx:100-102` | texto `{used} de {limit} usadas` | `0 de 0 usadas`. Correcto |
| 5 | `SubscriptionContent.tsx:295` | texto `{used} de {limit} propiedades usadas` | `0 de 0`. Correcto |
| 6 | `dashboard/page.tsx:147` | `planUsage.available` | `Math.max(0, 0-0)` = **0**. Correcto |
| 7 | `getPublishBlock` → `canCreate` | `used < limit` | `0 < 0` = **false** → bloquea. **Es el arreglo** |

**Las dos divisiones que existen ya estaban protegidas contra el cero**, las dos con la misma
expresión `limit > 0 ? … : 0`. **No hubo que tocar ningún consumidor.**

Lo interesante es *por qué* ya estaban protegidas: el comentario de `PlanBadge.tsx:12-13` dice
*"En el modelo de 4 planes todos tienen un límite finito → todos muestran el contador"*, o sea
que la guarda quedó de la época en que existía un plan "Ilimitado" con límite 0 o nulo. **Una
guarda escrita para otro motivo terminó cubriendo este.** No es mérito del diseño actual, y
conviene saberlo: si alguien la "limpia" por parecer muerta, reintroduce la división por cero.

`over` y `available` salen de `Math.max(0, …)` en el propio helper, así que ningún consumidor
resta suelto — eso ya estaba resuelto y no cambió.

---

## 4. Cómo detecto el choque de matrícula

`src/app/(agent)/admin/actions.ts`. Sigue el molde de `translatePropertyWriteError`
(`propiedades/actions.ts`), incluido su tipo estructural mínimo y su regla de que los motivos
específicos van antes del cajón de sastre.

```ts
// Nombre del índice único parcial de matrícula, tal como lo devuelve Postgres
// dentro del mensaje del error. Es el ÚNICO de los tres índices únicos de
// `agencies` que puede chocar al aprobar.
const LICENSE_UNIQUE_INDEX = "idx_agencies_license_unique_approved";

// Tipo estructural mínimo, mismo criterio que translatePropertyWriteError
// (propiedades/actions.ts): se pide lo que se lee y nada más, en vez de atar
// esta función al tipo del SDK.
type DbLikeError = { code?: string; message: string; details?: string | null };

// Saca la matrícula del DETAIL del error. Postgres lo arma así:
//   Key (city_id, license_number)=(fbcd374e-…, 1234) already exists.
// —o sea: el nombre del índice viaja en `message` y los VALORES en `details`—.
// Se toma el segundo valor del paréntesis, que es la matrícula.
//
// ⚠ DEVUELVE null ANTE CUALQUIER FORMA INESPERADA, Y ESO ES DELIBERADO: el
// formato del DETAIL no es un contrato, es texto de Postgres que puede cambiar
// entre versiones. El mensaje de abajo funciona igual sin la matrícula, así que
// un fallo al parsear NUNCA puede tirar abajo el manejo del error — sería
// cambiar un mensaje pobre por una excepción.
function extractLicenseFromDetail(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const match = detail.match(/\)=\(([^)]*)\)/);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.length < 2) return null;
  const license = parts[1];
  return license === "" ? null : license;
}
```

Y la traducción:

```ts
function translateApprovalWriteError(
  dbError: DbLikeError,
  status: ApprovalStatus
): string {
  const isLicenseConflict =
    status === "approved" &&
    dbError.code === "23505" &&
    dbError.message.includes(LICENSE_UNIQUE_INDEX);

  if (isLicenseConflict) {
    const license = extractLicenseFromDetail(dbError.details);
    const which = license ? `la matrícula ${license}` : "esa matrícula";

    // NO dice "intentá de nuevo": el conflicto es de datos, no transitorio, y
    // reintentar da siempre el mismo resultado. Y explica LA REGLA (aprobada +
    // misma ciudad), que es lo que le permite al dueño encontrar la otra agencia.
    return `No se pudo aprobar: ya hay otra inmobiliaria aprobada en la misma ciudad con ${which}. Revisá cuál de las dos corresponde antes de aprobar esta.`;
  }

  return "No se pudo actualizar la agencia. Intentá de nuevo.";
}
```

Y su llamador, en `writeApproval`:

```ts
  if (updateError) {
    return {
      error: translateApprovalWriteError(updateError, status),
    };
  }
```

### Las tres condiciones, y por qué son tres

1. **`status === "approved"`** — el gate de alcance (§6).
2. **`code === "23505"`** — el código, que es lo estable entre versiones.
3. **`message.includes(LICENSE_UNIQUE_INDEX)`** — porque **el código solo no alcanza**.
   Verificado contra la base: sobre `agencies` hay **tres** índices únicos
   (`indices_unicos_en_agencies: 3`) — `agencies_pkey`, `agencies_slug_key` y el de matrícula —
   y los tres levantan 23505. Sin el nombre, un choque de slug se reportaría como choque de
   matrícula.

### Qué pasa si la extracción falla

**Nada se rompe: el mensaje sale sin la matrícula.** Los cuatro caminos de fallo devuelven
`null`, y el llamador ya lo contempla con `const which = license ? … : "esa matrícula"`:

| Caso | Resultado |
|---|---|
| `details` es `null` o `undefined` | `null` → *"…con **esa matrícula**."* |
| No hay `)=(…)` en el texto | `null` → ídem |
| El paréntesis trae menos de dos valores | `null` → ídem |
| La matrícula viene vacía | `null` → ídem |

**No hay ninguna ruta en la que un `details` con forma inesperada produzca una excepción**: no
se indexa sin verificar, no se hace `JSON.parse`, no se asume longitud. Es exactamente lo que
pedía la decisión 8 — la extracción es una mejora, no una dependencia.

---

## 5. El mensaje exacto que ve el dueño

**Con la matrícula extraída** (el caso normal, con el DETAIL real capturado a mano:
`Key (city_id, license_number)=(fbcd374e-…, 1234) already exists.`):

> **No se pudo aprobar: ya hay otra inmobiliaria aprobada en la misma ciudad con la matrícula 1234. Revisá cuál de las dos corresponde antes de aprobar esta.**

**Si la extracción falla:**

> **No se pudo aprobar: ya hay otra inmobiliaria aprobada en la misma ciudad con esa matrícula. Revisá cuál de las dos corresponde antes de aprobar esta.**

**Cualquier otro error del UPDATE** (incluido un 23505 de slug, y todo rechazo o reapertura):

> No se pudo actualizar la agencia. Intentá de nuevo.

### Contra lo que pedían las decisiones 8 y 9

| Requisito | Cómo se cumple |
|---|---|
| Incluye la matrícula que chocó | `la matrícula 1234`, sacada del `details` |
| Explica **la regla**, no solo el hecho | *"otra inmobiliaria **aprobada** en **la misma ciudad**"* — que son literalmente las dos condiciones del índice: `WHERE approval_status = 'approved'` y la columna `city_id` de la clave |
| Le permite encontrar la otra agencia | Con la matrícula y el criterio "aprobada + misma ciudad", el filtro del panel alcanza |
| **NO** dice "intentá de nuevo" | Dice *"Revisá cuál de las dos corresponde antes de aprobar esta"* — una acción que sí resuelve |

**Dónde se ve:** `AgenciesTable` ya renderiza el `{ error }` de la action en su banner. No hubo
que tocar la interfaz.

---

## 6. Cómo me aseguré de que no se muestre a un rechazo ni a una reapertura

**Con un gate explícito, no confiando en que el error no pueda ocurrir.**

`translateApprovalWriteError` recibe el `status` que se está por escribir, y la **primera**
condición del `isLicenseConflict` es `status === "approved"`. `writeApproval` es compartida por
las tres actions, y cada una le pasa su estado:

- `approveAgencyAction:320-326` → `writeApproval(id, **"approved"**, "approved", …)` → **puede** mostrar el mensaje nuevo
- `rejectAgencyAction:346-352` → `writeApproval(id, **"rejected"**, "rejected", …)` → nunca
- `reopenAgencyAction:368` → `writeApproval(id, **"pending"**, null, …)` → nunca

**Por qué el gate y no solo el código de error.** Es cierto que rechazar y reabrir **sacan la
fila del predicado** del índice (`WHERE approval_status = 'approved'`), así que en teoría no
pueden chocar y el `code === "23505"` nunca sería verdadero para ellas. Pero eso depende de una
propiedad del índice que podría cambiar. El gate por `status` hace que la imposibilidad sea
**estructural en el código**: aunque un día ese error apareciera por otra causa en un rechazo,
el mensaje no puede salir. Mostrarle *"esa matrícula ya está en uso"* a alguien que está
rechazando una agencia sería inventar un conflicto que no existe.

### El efecto colateral, documentado en el código (decisión 12)

En el comentario de `translateApprovalWriteError`, **no** en `CLAUDE.md` ni en `PENDIENTES.md`:

```
// ⚠ EFECTO COLATERAL QUE CONVIENE TENER PRESENTE: rechazar o reabrir una agencia
// APROBADA libera su matrícula, porque saca la fila del predicado parcial. Si en
// el medio se aprueba otra con la misma matrícula, volver a aprobar la original
// va a fallar por acá — y el mensaje va a ser correcto, pero el conflicto va a
// parecer nuevo. Es inherente al índice parcial, no un defecto de esta función.
```

---

## 7. Los tres comandos de calidad

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
✓ Compiled successfully in 8.4s
  Running TypeScript ...
  Finished TypeScript in 8.6s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/19) ...
  Generating static pages using 3 workers (4/19) 
  Generating static pages using 3 workers (9/19) 
  Generating static pages using 3 workers (14/19) 
✓ Generating static pages using 3 workers (19/19) in 1413ms
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

### Comparación

| | Baseline | Ahora | ¿Coincide? |
|---|---|---|---|
| `tsc --noEmit` | 0 errores, exit 0 | 0 errores, exit 0 | ✅ |
| `lint` errores | 0 | 0 | ✅ |
| `lint` warnings | 1 · `react-hooks/incompatible-library` · `PropertyForm.tsx` | 1 · el mismo · `808:30` | ✅ |
| `next build` | verde, exit 0 | verde, exit 0 | ✅ |
| Rutas | 19 | 19, las mismas | ✅ |

---

## 8. Lo que no cerró como lo describe el prompt

### (1) Una afirmación del prompt no se sostuvo al medir — y **a favor** del código

El prompt advierte, sobre alinear el límite a 0:

> *"verificá qué consumidores leen el límite: si alguno divide por él o lo muestra como texto,
> un 0 puede producir una división por cero o un texto raro."*

**Los revisé uno por uno (§3) y ninguno se rompe.** Hay exactamente **dos** consumidores que
dividen, y **los dos ya estaban guardados** con la misma expresión `limit > 0 ? … : 0`
(`PlanBadge.tsx:14` y `SubscriptionContent.tsx:191`). Los cinco restantes son texto y muestran
`0 de 0`, que es correcto.

**Pero el matiz importa más que el resultado:** esas guardas **no se escribieron para esto**.
El comentario de `PlanBadge.tsx:12-13` las explica como resto de un modelo anterior con un plan
"Ilimitado". Es una guarda vestigial que cubre este caso por casualidad. **Si alguien la borra
por parecer muerta, reintroduce la división por cero**, y ahora sí sería alcanzable. Lo dejo
dicho porque no es evidente al leer el código.

### (2) Un residuo que el alcance fijado deja abierto, y prefiero decirlo

Con el límite en 0 y sin fila, `getPublishBlock` devuelve `plan_limit`, y `NewPropertyButton`
muestra: *"Alcanzaste el límite de tu plan Gratis. Pasá a Inicial para publicar más."*

**Eso sigue siendo impreciso**: la agencia no alcanzó ningún límite, le falta una fila, y
"pasar a Inicial" no la destrabaría. **Lo que sí se arregló, y era el bug real, es que ahora
bloquea** en vez de dejarla llenar el formulario entero para rechazarla al final. La interfaz y
la base ahora dicen lo mismo; lo que queda desalineado es el matiz del texto.

**No lo arreglé, y por dos razones del propio pedido.** La decisión 5 dice que no hay que
construir para un estado que el trigger vuelve improducible, y un cuarto motivo en
`PublishBlockReason` obliga a tocar el `switch` exhaustivo de `NewPropertyButton` — que
`CLAUDE.md` marca como sensible— para un caso que solo se alcanza si alguien borra una fila a
mano. **Queda anotado como decisión consciente, no como olvido.**

### (3) Todo lo demás del prompt se verificó y es exacto

- **El trigger existe y es como lo describe**: `AFTER INSERT ON agencies`, cuerpo sin valores
  salvo la clave. Transcrito de la base, no del prompt (§2).
- **Los defaults son los del estado de aterrizaje**, los siete (§2).
- **El upsert de `registerAction` ya usaba `ignoreDuplicates`**, así que con el trigger no
  escribe nada. Se mantuvo, se cambió su comentario.
- **El UPDATE de upgrade afectaba cero filas sin devolver error.** Resuelto con
  `update(values, { count: "exact" })`, que el SDK soporta
  (`postgrest-js/dist/index.d.cts:3385-3393`). Elegí el count sobre "leer la fila antes" porque
  el chequeo previo y la escritura son dos viajes distintos y preguntar "¿existe?" antes deja
  una ventana entre la pregunta y la respuesta; el count mide lo que la escritura hizo.
- **La guarda de reentrada** se dejó como estaba, con comentario en los dos lugares
  (`actions.ts` y `page.tsx`), explicando que `subscription != null` ya no es alcanzable.
- **Sobre `agencies` hay tres índices únicos**: medido, `indices_unicos_en_agencies: 3`.
- **El DETAIL trae los valores y el message el nombre del índice**: la extracción está escrita
  contra el texto real que trae el prompt, y falla hacia `null` ante cualquier otra forma.
