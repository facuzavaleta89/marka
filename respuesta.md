# Guarda de `updated_at` ante el contador de visitas — documentación de schema

> **Modo ejecución, solo documentación de schema.** Se modificó **un solo archivo**:
> `supabase/migrations/20240101000000_initial_schema.sql`. No se tocó `src/`, `CLAUDE.md` ni
> `PENDIENTES.md`. No se ejecutó ningún comando de git ni SQL de escritura: el MCP se usó solo para
> leer (catálogo, datos, advisors y logs).
>
> 14 sep 2026.

---

## ⚠ Lo primero, porque cambia cómo leer el resto

**La guarda nueva todavía no la ejercitó ninguna visita real, y las fechas que motivaron el cambio
ya quedaron movidas.** Lo muestran los logs del proyecto (punto 1.4):

- Entre **16:17:22 y 16:26:05 UTC** hubo **12 llamadas** a `increment_views` desde el navegador,
  **todas con la función vieja**, sin guarda. Movieron el `updated_at` de **7 propiedades**, que hoy
  el mapa del sitio informa como modificadas.
- La guarda actual se aplicó a las **16:32:19**. Desde ahí **no hubo ninguna llamada** desde un
  navegador. Su única prueba fue en el SQL Editor a las 16:32:32, dentro de `BEGIN … ROLLBACK`, y el
  resultado de ese `SELECT` no queda en los logs.

**No pude verificar que la guarda funcione**: probarla exige un UPDATE y el MCP es de solo lectura.
Cómo probarla con una visita real está en el punto 5.3.

---

## 1. Lo que leí de la base

### 1.1. `update_updated_at()`

```sql
SELECT p.proname, p.oid::regprocedure AS signature, p.prosecdef, p.provolatile, p.proconfig,
       p.proowner::regrole AS owner, p.proacl, pg_get_functiondef(p.oid) AS def
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f'
  AND (p.proname IN ('increment_views','update_updated_at')
       OR p.prosrc ILIKE '%set_config%' OR p.prosrc ILIKE '%current_setting%' OR p.prosrc ILIKE '%updated_at%');
```

| | Medido |
|---|---|
| Firma | `update_updated_at()` → `trigger` |
| Lenguaje | `plpgsql` |
| `SECURITY DEFINER` | **no** |
| `search_path` | **no fijado** (`proconfig: null`). El advisor lo sigue marcando |
| Dueño / ACL | `postgres` / `{=X/postgres,postgres=X,anon=X,authenticated=X,service_role=X}` |

`pg_get_functiondef` textual:

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- increment_views() avisa, con una variable de sesión acotada a la
  -- transacción, que lo único que está cambiando es el contador de visitas.
  -- En ese caso updated_at NO se toca.
  -- Motivo: updated_at es el lastModified que el sitemap le informa a los
  -- buscadores. Sin esta guarda, cada visita le diría a Google que la
  -- propiedad se modificó, y con el tiempo eso le enseña que nuestras fechas
  -- no significan nada.
  IF TG_OP = 'UPDATE'
     AND coalesce(current_setting('marka.skip_updated_at', true), '') = 'on' THEN
    NEW.updated_at = OLD.updated_at;
    RETURN NEW;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
```

- `current_setting(..., true)`: el segundo argumento `true` es `missing_ok`. Si la variable nunca se
  definió devuelve `NULL` en vez de lanzar, y el `coalesce` lo lleva a `''`.
- Solo conserva la fecha si la operación es un `UPDATE` **y** la variable vale exactamente `'on'`.
  En cualquier otro caso sella `now()`.

### 1.2. `increment_views(property_id uuid)`

| | Medido |
|---|---|
| Firma | `increment_views(property_id uuid)` → `void` |
| Lenguaje | **`plpgsql`**. En la medición anterior de hoy era **`sql`** |
| `SECURITY DEFINER` | sí |
| `search_path` | **`public`**. Antes era `null`; el advisor ya no la marca |
| Dueño / ACL | `postgres` / `{=X/postgres,postgres=X,anon=X,authenticated=X,service_role=X}`. `anon` y `authenticated` siguen con `EXECUTE` |

```sql
CREATE OR REPLACE FUNCTION public.increment_views(property_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- El tercer parámetro en true acota la variable a esta transacción: no
  -- puede filtrarse a otra operación de la misma conexión.
  PERFORM set_config('marka.skip_updated_at', 'on', true);
  UPDATE properties SET views_count = views_count + 1 WHERE id = property_id;
  PERFORM set_config('marka.skip_updated_at', 'off', true);
END;
$function$
```

`set_config(nombre, valor, is_local)`: el tercer argumento en `true` hace que el valor dure solo
hasta el fin de la transacción.

**Ninguna otra función de `public` usa la variable**: la búsqueda por `skip_updated_at` en `prosrc`
solo devuelve estas dos. Tampoco hay ninguna configuración de rol o de base que la fije:

```sql
SELECT count(*) FROM pg_db_role_setting WHERE setconfig::text ILIKE '%skip_updated_at%';  -- 0
```

### 1.3. El trigger, y si es compartido

```sql
SELECT t.tgname, t.tgrelid::regclass AS tbl, t.tgenabled, p.proname AS func, pg_get_triggerdef(t.oid) AS def
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal ORDER BY p.proname, t.tgrelid::regclass::text, t.tgname;
```

Las filas que usan `update_updated_at`:

```
trg_properties_updated_at     properties     CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION update_updated_at()
trg_subscriptions_updated_at  subscriptions  CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at()
```

**⚠ SÍ, ES COMPARTIDO: la misma función la usa `subscriptions`.** Los dos triggers están habilitados
(`tgenabled = 'O'`) y son **solo `BEFORE UPDATE`**, así que un `INSERT` nunca pasa por la función:
`updated_at` toma el `DEFAULT now()` de la columna. (`storage.objects` tiene un trigger parecido,
pero usa otra función, `storage.update_updated_at_column()`.)

### 1.4. Cronología: logs del proyecto

Búsqueda en todas las fuentes de logs del 14 sep por `increment_views`, `update_updated_at` y
`skip_updated_at` (UTC):

| Hora | Fuente | Qué |
|---|---|---|
| 16:17:22 · 16:18:27 · 16:19:35 · 16:19:41 · 16:21:13 · 16:22:21 · 16:22:25 · 16:23:05 · 16:23:22 · 16:23:36 · 16:25:46 · 16:26:05 | edge_logs | **12×** `POST /rest/v1/rpc/increment_views` → **204**, Firefox 154 |
| 16:27:24 | postgres_logs | `CREATE OR REPLACE FUNCTION update_updated_at()` con **la comparación** `to_jsonb(NEW) - 'views_count' - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - …` (primer intento) |
| 16:27:41 · 16:28:21 · 16:29:10 | postgres_logs | Pruebas `BEGIN; … increment_views(...) …; ROLLBACK;` |
| **16:32:19** | postgres_logs | `CREATE OR REPLACE` de **las dos funciones actuales** (textos idénticos a 1.1 y 1.2) |
| 16:32:32 | postgres_logs | Prueba `BEGIN; … SELECT increment_views(...); … ROLLBACK;` |

Y **no hay ningún `POST` a `increment_views` después de 16:26:05**.

**Las 12 llamadas coinciden una a una con los datos:**

```sql
SELECT sum(views_count) FROM properties;   -- 12
```

| Propiedad | views | `updated_at` (UTC) | POST más cercano |
|---|---|---|---|
| Casa Centenario | 1 | 16:18:27.681 | 16:18:27.574 |
| casa puente | 1 | 16:19:41.114 | 16:19:41.035 |
| Casa gaio | 2 | 16:22:21.997 | 16:22:21.896 |
| Casa Largo | 2 | 16:22:25.518 | 16:22:25.427 |
| casa lugones | 3 | 16:23:36.187 | 16:23:36.097 |
| Casa Autonomia | 2 | 16:25:46.128 | 16:25:46.039 |
| Campo | 1 | 16:26:05.416 | 16:26:05.334 |

Cada `updated_at` es la hora de la **última** visita a esa propiedad, unos 100 ms después de su POST.
Todas son **anteriores a la guarda**.

---

## 2. Qué cambié en el archivo

Archivo: `supabase/migrations/20240101000000_initial_schema.sql` (1660 → 1783 líneas).

### 2.1. Sección reescrita: `:1166-1295`

- **`:1166`** — el encabezado de sección pasa a *"TRIGGER: updated_at automático + CONTADOR DE
  VISITAS"*.
- **`:1167-1229`** — el comentario pedido (2.3).
- **`:1230-1251`** — `update_updated_at()`, **transcripta de `pg_get_functiondef`**.
- **`:1253-1259`** — los dos `CREATE TRIGGER`, sin cambios.
- **`:1261-1275`** — encabezado y comentario de `increment_views()`.
- **`:1276-1289`** — `increment_views()`, **transcripta de `pg_get_functiondef`**. **No existía en el
  archivo.**
- **`:1291-1295`** — `GRANT EXECUTE ON FUNCTION increment_views(uuid) TO anon, authenticated,
  service_role;`, con el ACL medido en el comentario. Es explícito por el mismo criterio que
  `auth_agency_id()`: la app **depende** de que `anon` pueda ejecutarla. En Supabase ese permiso lo
  darían igual los privilegios por defecto del esquema.

### 2.2. Verificación de la transcripción

Comparé con un script los dos bloques del archivo (desde `CREATE OR REPLACE FUNCTION public.<nombre>(`
hasta el `$function$` de cierre) contra el texto de `pg_get_functiondef`:

```
update_updated_at IDENTICAL
increment_views IDENTICAL
```

Son **idénticos byte a byte**, incluidos el prefijo `public.`, la sangría de un espacio de las
cláusulas y `SET search_path TO 'public'`. Lo único agregado es el `;` final que exige el archivo.
Hay **una sola definición** de cada función.

⚠ **El comentario de adentro del cuerpo de `update_updated_at` dice *"una variable de sesión acotada
a la transacción"*.** La frase se contradice sola ("de sesión" y "acotada a la transacción"). Lo
correcto es lo segundo: es un parámetro de configuración con `is_local = true`. **Lo dejé tal cual**
porque es parte del cuerpo medido; en el comentario del archivo, afuera del cuerpo, quedó dicho
correctamente.

### 2.3. El comentario, punto por punto

| Pedido | Qué dice el archivo |
|---|---|
| **Por qué existe la guarda** | `properties.updated_at` es el `lastModified` que `src/app/sitemap.ts` informa a los buscadores. Cada visita lo movía y le decía a Google que la propiedad cambió, lo que le enseña que las fechas no significan nada |
| **Que las funciones están acopladas** | El vínculo es un string literal repetido en los dos cuerpos (`'marka.skip_updated_at'`) y el valor `'on'`, y nada lo verifica. Renombrar, cambiar el valor o sacar el `set_config` de un solo lado apaga la guarda **sin error**. Al revés: otra función que ponga `'on'` y modifique algo más haría que esa modificación real **no selle**. *"Quien toque una de las dos, tiene que leer y tocar la otra."* |
| **Transacción, y por qué importa** | Con `is_local = false` el `'on'` quedaría en la **conexión**, y PostgREST y el pooler (hay `pgbouncer_logs` en el proyecto) la reutilizan entre requests de distintos usuarios. Se filtraría a una edición o un cambio de estado posterior, que **dejaría de sellar sin error**. Local, muere con el COMMIT/ROLLBACK y se revierte si el UPDATE lanza, también dentro de un `EXCEPTION`. El `'off'` posterior cubre el caso de invocarla dentro de una transacción más grande |
| **Trigger compartido** | Rige también sobre `subscriptions`: un UPDATE ahí con la variable en `'on'` conservaría la fecha. **Hoy no ocurre** (solo `increment_views` la pone en `'on'`, y entre su `'on'` y su `'off'` solo toca `properties`), y **ningún código lee `subscriptions.updated_at`**. Dejé escrito que ese párrafo deja de ser cierto si otra función usa la variable |

Agregué además, marcado explícitamente como **HIPÓTESIS NO VERIFICADA**, por qué pudo fallar el
primer intento (punto 6), para que nadie vuelva a la comparación de filas "porque es más limpio".

Y en `increment_views` quedó escrito que **no valida nada**: no mira el estado de la propiedad ni la
agencia, y es invocable sin límite con la anon key. También, que el nombre `property_id` lo usa la
app literal.

### 2.4. Encabezado del archivo: `:89-97`

Nueva entrada en la lista *"Estado actual"*, siguiendo la convención del archivo:

```sql
--   * update_updated_at() con GUARDA para el contador de visitas + la función
--     increment_views(), que hasta ahora NO estaba en este archivo aunque
--     existía en la base: YA MIGRADAS (14 sep 2026, aplicadas a mano; transcriptas
--     con pg_get_functiondef). increment_views() pone la variable
--     `marka.skip_updated_at` en 'on', local a la transacción, alrededor de su
--     UPDATE, y el trigger conserva updated_at en ese caso. Motivo: updated_at es
--     el lastModified del mapa del sitio, y cada visita lo movía. Las dos
--     funciones están ACOPLADAS y el trigger es COMPARTIDO con subscriptions:
--     ver la sección "TRIGGER: updated_at automático + CONTADOR DE VISITAS".
```

`supabase/pending/` sigue sin existir: no hay cambios de schema pendientes de aplicar.

---

## 3. Qué describía el archivo que este cambio vuelve falso

**En el archivo de schema (antes de esta tanda):**

1. **`update_updated_at()` estaba con el cuerpo viejo**, en las líneas 1157-1164 de la versión
   anterior:
   ```sql
   CREATE OR REPLACE FUNCTION update_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = now();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```
   Sellaba **siempre**, lo cual **es falso desde las 16:32**. Reemplazado.
2. **`increment_views()` no estaba en el archivo, ni con la versión vieja ni con la nueva.** Así, el
   encabezado (*"Este archivo es la FUENTE DE VERDAD del schema, y refleja el estado REAL de la base
   de producción"*) era falso por omisión desde antes de hoy: quien recreara la base desde el
   archivo no tenía la función. Agregada.
3. **Comentarios adyacentes:** el título de sección *"TRIGGER: updated_at automático"* no afirmaba
   nada falso, pero ocultaba el acople (renombrado). Las columnas `properties.views_count` y
   `properties.updated_at` (`:551`, `:554`) y `subscriptions.updated_at` (`:260`) **no tienen
   comentarios**, así que no había nada falso ahí. Ninguna otra parte del archivo menciona
   `updated_at`, `views_count` ni visitas.

**Fuera del schema** (no los toqué; los anoto para el cierre):

| Dónde | Qué dice | Estado |
|---|---|---|
| `CLAUDE.md` → Base de Datos → Funciones y RPC | *"`increment_views(property_id)` … ⚠ existe pero NO se la llama desde ningún lado, así que `views_count` es 0 en todas las propiedades"* | **Falso**: se la llama desde la tanda anterior, y la suma da 12. Tampoco menciona la guarda ni el cambio a `plpgsql` |
| `CLAUDE.md` → Triggers de `properties` | *"Hay además dos `trg_*_updated_at` sobre `properties` y `subscriptions`"* | Cierto, pero sin la guarda ni el acople |
| `PENDIENTES.md:344` | El ítem *"`increment_views` existe en la base pero NO se la llama…"* | Obsoleto |
| `src/app/sitemap.ts:109-110` | *"`updated_at` es la última vez que la propiedad cambió de verdad"* | Cierto de nuevo **para lo que se escriba desde las 16:32**. **Falso hoy para 7 filas** (ver 5.1) |

---

## 4. Otros caminos que escriben en `properties` y dependen de que la fecha se selle

**No encontré ninguno afectado.** La guarda solo actúa si la variable vale `'on'` dentro de la
transacción, y **ningún camino fuera de `increment_views` la escribe**: está en 0 funciones además de
las dos, 0 configuraciones de rol o base y 0 archivos de `src/` o `scripts/` (búsqueda por
`set_config` y `skip_updated_at`).

### 4.1. Escrituras a `properties` desde la app

Todas por PostgREST, cada request en su propia transacción, sin tocar la variable:

| Lugar | Operación | ¿Pasa por el trigger? | ¿Sigue sellando? |
|---|---|---|---|
| `propiedades/actions.ts:162` | `update({ status: "paused" })` | sí | **sí** |
| `propiedades/actions.ts:175` | `update({ status: "active" })` | sí | **sí** |
| `propiedades/actions.ts:197` | `update({ status: "sold" })` | sí | **sí** |
| `propiedades/actions.ts:210` | `update({ status: "rented" })` | sí | **sí** |
| `propiedades/actions.ts:635` | `update({ … })` edición completa | sí | **sí** |
| `equipo/actions.ts:150` | `update({ agent_id })` reasignación | sí | **sí** |
| `propiedades/actions.ts:511` | `insert` | **no** (trigger solo UPDATE) | usa `DEFAULT now()` |
| `propiedades/actions.ts:306` | `delete` | no | — |

**En la base**, la única función que hace `UPDATE properties` es `increment_views` (búsqueda en
`prosrc` por `update properties`, `update subscriptions` e `insert into properties|subscriptions`).

**El único lector** de `properties.updated_at` en el código es `src/app/sitemap.ts:78` y `:111`. Los
cambios de estado y las ediciones, que son lo que ese `lastModified` tiene que reflejar, siguen
sellando.

### 4.2. Escrituras a `subscriptions` (por el trigger compartido)

`admin/actions.ts:92, :728, :814, :870, :1238`, `dashboard/suscripcion/actions.ts:93`,
`register/plan/actions.ts:73` (UPDATE) y `register/actions.ts:155` (upsert). Todas en transacciones
propias sin la variable: **siguen sellando**. `ensure_agency_subscription()` hace `INSERT` y no pasa
por el trigger. **Nadie lee `subscriptions.updated_at`**: en el código solo aparece en el tipo
`Subscription` (`src/types/index.ts:302`).

### 4.3. Un matiz, que no es una dependencia

Un **agente logueado puede escribir `views_count` directamente** sobre sus propias propiedades (la
policy `Agent manages own properties` es `ALL` sin `WITH CHECK`, medido en el diagnóstico de hoy). Ese
UPDATE **no pasa por `increment_views`**, así que **sí sella la fecha**. No es un camino que exista en
el código; es posible por la API.

---

## 5. Consecuencias a tener en cuenta

### 5.1. Las 7 fechas ya movidas no se recuperan solas

Las 7 propiedades de la tabla 1.4 tienen hoy un `updated_at` del **14 sep entre 16:18 y 16:26** que
**no corresponde a ninguna modificación**, y el mapa del sitio lo publica. **Los valores anteriores no
están guardados en ningún lado**: no hay historial, y en la medición de esta mañana el máximo de la
tabla era `2026-09-12 23:56`, pero eso no dice el valor de cada fila.

⚠ Si alguien quisiera corregirlas a mano, **la guarda lo impide también**: con la variable en `'on'`
el trigger repone `OLD.updated_at`, y sin ella sella `now()`. Restaurar una fecha anterior requiere
deshabilitar el trigger mientras dura el UPDATE. No lo propongo; lo anoto porque es contraintuitivo.

### 5.2. La guarda confía en quien pone la variable

Cualquier sesión de SQL puede hacer `SET LOCAL marka.skip_updated_at = 'on'`: los parámetros con
prefijo propio no requieren privilegios. **Desde la API no se puede**, porque PostgREST no deja
fijar variables arbitrarias. Solo lo haría quien ya tiene acceso SQL directo.

### 5.3. Cómo verificar la guarda con una visita real

Lo tenés que hacer vos, porque yo no puedo escribir. En el SQL Editor o el MCP, **antes**:

```sql
SELECT id, title, views_count, updated_at FROM properties WHERE slug = 'casa-demo-s7jw5o';
```

Después borrá `marka_visited` en el navegador (DevTools → Application → Local Storage), tocá el pin de
"Casa demo" y repetí la consulta. **`views_count` tiene que subir 1 y `updated_at` no tiene que
cambiar.** Si `updated_at` cambia, la guarda no funciona en el camino real (PostgREST + pooler),
aunque la prueba en el SQL Editor haya dado bien.

---

## 6. Sobre el intento que no funcionó

El prompt dice que no se pudo determinar por qué. Los logs muestran **cómo se verificó**, y eso
sugiere una causa. **La dejo como hipótesis: no la pude comprobar, porque exige un UPDATE.**

- **El intento** (16:27:24): el trigger comparaba `to_jsonb(NEW) - 'views_count' - 'updated_at'`
  contra lo mismo sobre `OLD`.
- **La verificación** (16:29:10): se hacía **fuera del trigger**, comparando la fila guardada antes y
  después de llamar a `increment_views` (`jsonb_each` sobre `row(p.*)` de la tabla contra una copia
  temporal).
- **`properties.location` es `GENERATED ALWAYS … STORED`** (medido: `attgenerated = 's'`). Postgres
  (17.6 en este proyecto) calcula las columnas generadas **después** de los triggers `BEFORE`.
  Dentro del trigger, `NEW.location` todavía no tiene el valor final y `OLD.location` sí, así que
  `to_jsonb(NEW)` y `to_jsonb(OLD)` **nunca darían iguales** y la fecha se sellaría siempre.
- Eso explica las dos observaciones a la vez: el trigger veía una diferencia en `location`, y la
  comparación sobre **filas ya guardadas** (con `location` recalculada e igual) solo mostraba
  `views_count` y `updated_at`.

Quedó escrita en el schema, marcada como no verificada, junto a la advertencia de no volver a ese
enfoque.

---

## 7. Baseline de calidad

Corrido al terminar. El archivo `.sql` no participa de ninguno de los tres chequeos:

```
### tsc
EXIT_TSC=0
### lint

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
### build
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 9.8s
  Running TypeScript ...
  Finished TypeScript in 10.6s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/20) ...
  Generating static pages using 3 workers (5/20) 
  Generating static pages using 3 workers (10/20) 
  Generating static pages using 3 workers (15/20) 
✓ Generating static pages using 3 workers (20/20) in 1138ms
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
├ ƒ /propiedades/[slug]
├ ƒ /register
├ ƒ /register/plan
├ ○ /robots.txt
└ ƒ /sitemap.xml


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

EXIT_BUILD=0
```

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores, **exit 0** ✅ |
| `npm run lint` | 0 errores, **1 warning** (`PropertyForm.tsx:808`, `react-hooks/incompatible-library`), **exit 0** ✅ |
| `npx next build` | verde, **exit 0**, **22 rutas** ✅ |

No hizo falta borrar `.next`.

---

## 8. ¿Algo del prompt resultó falso?

**Nada de lo que describe sobre las dos funciones es falso**: la variable, que sea local a la
transacción, que el trigger conserve la fecha en ese caso y selle en cualquier otro. Todo coincide
con lo medido. Pero hay cuatro cosas que conviene corregir o completar:

1. **"Se cambiaron dos funciones" se queda corto con `increment_views`.** Además de la variable pasó
   de `LANGUAGE sql` a **`plpgsql`** y ganó **`search_path` fijo**. Lo segundo es una mejora: el
   advisor ya no la marca.
2. **"Contar una visita estaba moviendo la fecha"** ya tuvo efecto: **7 propiedades** con fechas
   movidas por **12 visitas** anteriores a la guarda, sin forma de recuperar los valores (5.1).
3. **"La comparación de columnas confirmaba que solo diferían esas dos"** es cierto de lo que se
   midió, pero **no prueba lo que veía el trigger**. Según los logs, esa comparación se hizo sobre
   filas ya guardadas, no sobre `NEW` dentro del trigger. Es la base de la hipótesis del punto 6.
4. **"La solución aplicada"** está aplicada, pero **no está probada con una visita real**: no hubo
   ninguna llamada desde el navegador después de las 16:32, y la prueba del SQL Editor se revirtió
   sin resultado en los logs (5.3).
