# Documentación de las policies finas de Storage — informe de ejecución

> **Modo:** ejecución, solo documentación. **No se tocó una sola línea de `src/`** (verificado:
> `find src -type f -newermt "2026-09-05 00:00" | wc -l` → **0**). No se ejecutó ningún comando
> de git. No se ejecutó SQL de escritura (el MCP está en `read_only=true`).
> **Archivos modificados:** `supabase/migrations/20240101000000_initial_schema.sql`, `CLAUDE.md`,
> `PENDIENTES.md` y este informe.
> **Fecha de medición:** 5 de septiembre de 2026.

---

## ⚠ LO QUE ESTE PROMPT AFIRMA Y LA BASE NO CONFIRMA

Tres cosas. Las dos primeras son importantes; la tercera es de forma.

### 1. "Lectura → solo para usuarios autenticados" es cierto SOLO para RLS, y RLS no es por dónde se leen las fotos

La policy de SELECT efectivamente pasó a rol `{authenticated}` — eso está medido y es real. **Pero
el bucket sigue siendo `public = true`**, y el endpoint `/storage/v1/object/public/…` **no pasa por
RLS en absoluto**. Verificado con `curl`, sin credenciales de ningún tipo, después del cambio:

```
200   8325   ← 7074968a-…/61a97f52-…/1788192987479-96ib.jpeg
200  13142   ← 76754c70-…/0307f1fd-…/1780187418169-12le.jpeg   (agente BORRADO, propiedad BORRADA)
200 109631   ← logos/6e819c62-…/logo.png
```

Cualquier persona, sin cuenta, sigue descargando cualquier archivo del bucket si conoce la URL.
**Y está bien que así sea** —es requisito del producto: el visitante anónimo del mapa tiene que ver
las fotos—, pero describirlo como "lectura solo para autenticados" induce a error, así que lo dejé
escrito con esa distinción explícita en los tres archivos.

**Lo que el cambio de rol SÍ cerró, y es una mejora real que el prompt no menciona: la
enumeración.** Con la policy vieja (rol `public`) se podía listar el árbol completo del bucket con
la anon key —la que está en el bundle de JavaScript de cualquier visitante—. Medido antes y
después:

```
POST /storage/v1/object/list/property-images   {"prefix":"","limit":100}
ANTES:  [{"name":"7074968a-…"},{"name":"76754c70-…"},{"name":"avatars"},{"name":"logos"}]
AHORA:  []
```

### 2. "una función nueva" — sí, pero NO cubre toda la dependencia que se buscaba cortar

`auth_agency_id()` existe y es `SECURITY DEFINER`, tal como dice el prompt. **Pero las tres
policies de escritura tienen una rama —la de los paths de propiedad— que hace su propio
`EXISTS (SELECT 1 FROM agents a …)` FUERA de la función**, porque necesita mirar a *otro* agente (el
dueño de la carpeta), no al logueado. Textual, de `pg_policies`:

```sql
AND EXISTS ( SELECT 1
   FROM agents a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[1]) AND (a.agency_id = auth_agency_id())))
```

Ese `SELECT ... FROM agents` **no está protegido por la función**: se evalúa con los privilegios del
que llama y respetando la RLS de `agents`. Hoy funciona porque `Public read agents` sigue con
`qual: true` (verificado hoy), pero **el día que se restrinja esa lectura, las subidas de fotos de
propiedad van a empezar a fallar con 403 igual** — que es exactamente el escenario que el
`SECURITY DEFINER` venía a prevenir. **Es media dependencia cortada, no una.** Lo documenté como
deuda conocida en los tres archivos, no lo maquillé.

### 3. El bucket tiene 24 objetos, no 23

Aparecieron dos cambios desde la medición anterior, coherentes con haber probado las policies
nuevas: un `logos/6e819c62-…/logo.jpg` creado hoy a las 22:02, y el `avatars/…/avatar.png`
sobrescrito (mismo `created_at`, tamaño distinto: 93.395 → 64.863 bytes). Son evidencia de que
**las policies de INSERT y de UPDATE funcionan** para el caso normal. Lo mencionó nadie, pero
cambia los números de los ítems nuevos, así que lo aclaro.

**Todo lo demás que afirma el prompt se confirmó tal cual.** La frontera implementada es
exactamente la descrita (agencia para propiedades y logos, usuario para avatares), hay cuatro
policies nuevas y una función nueva, y el bucket tiene límite de tamaño y lista de MIME donde antes
había `NULL`.

---

## 1. LAS POLICIES Y LA FUNCIÓN, TAL COMO SE LEYERON DE LA BASE

### 1.1. `pg_policies` sobre `storage.objects` — las cuatro, textuales

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='storage' ORDER BY tablename, cmd, policyname;
```

**Las cuatro son `PERMISSIVE` y `roles = {authenticated}`.** Solo hay policies sobre `objects`
(agrupado: `[{"tablename":"objects","count":4}]`), ninguna sobre `storage.buckets`.

**`Authenticated reads storage files` — SELECT**

```
qual:       (bucket_id = 'property-images'::text)
with_check: null
```

**`Agency writes own storage files` — INSERT**

```
qual:       null
with_check: ((bucket_id = 'property-images'::text) AND (((name ~~ 'logos/%'::text) AND ((storage.foldername(name))[2] = (auth_agency_id())::text)) OR ((name ~~ 'avatars/%'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR ((name !~~ 'logos/%'::text) AND (name !~~ 'avatars/%'::text) AND (EXISTS ( SELECT 1
   FROM agents a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[1]) AND (a.agency_id = auth_agency_id())))))))
```

**`Agency updates own storage files` — UPDATE**

```
qual:       ((bucket_id = 'property-images'::text) AND (((name ~~ 'logos/%'::text) AND ((storage.foldername(name))[2] = (auth_agency_id())::text)) OR ((name ~~ 'avatars/%'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR ((name !~~ 'logos/%'::text) AND (name !~~ 'avatars/%'::text) AND (EXISTS ( SELECT 1
   FROM agents a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[1]) AND (a.agency_id = auth_agency_id())))))))
with_check: ((bucket_id = 'property-images'::text) AND (((name ~~ 'logos/%'::text) AND ((storage.foldername(name))[2] = (auth_agency_id())::text)) OR ((name ~~ 'avatars/%'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR ((name !~~ 'logos/%'::text) AND (name !~~ 'avatars/%'::text) AND (EXISTS ( SELECT 1
   FROM agents a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[1]) AND (a.agency_id = auth_agency_id())))))))
```

> **`qual` y `with_check` son idénticos carácter por carácter.** Es la trampa 2 del prompt,
> confirmada en los datos: no es una suposición, es lo que la base tiene.

**`Agency deletes own storage files` — DELETE**

```
qual:       (idéntica al `qual` del UPDATE)
with_check: null
```

**Nota de transcripción:** `pg_policies` renderiza `auth_agency_id()` **sin calificar con el
esquema** (porque `public` está en el `search_path` del renderizado) y usa los operadores internos
`~~` / `!~~` en lugar de `LIKE` / `NOT LIKE`. En el archivo de migración escribí `LIKE` /
`NOT LIKE` y `auth_agency_id()` sin calificar —que es lo que un `CREATE POLICY` acepta y produce
exactamente estas mismas expresiones—. **La estructura lógica es idéntica**: mismos tres brazos,
mismo orden, mismas comparaciones, mismos casts.

### 1.2. La función nueva — `pg_get_functiondef`, textual

```sql
CREATE OR REPLACE FUNCTION public.auth_agency_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT agency_id FROM public.agents WHERE id = auth.uid();
$function$
```

Metadatos medidos: `nspname = public`, sin argumentos, `prosecdef = true`, `provolatile = 's'`
(STABLE), `proconfig = {search_path=public}`.

**El GRANT**, leído de `proacl`:

```
{=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
```

O sea: EXECUTE para `anon`, `authenticated` y `service_role` de forma explícita, más el `=X` de
`PUBLIC` que Postgres otorga por defecto a toda función nueva. En el archivo lo escribí como:

```sql
GRANT EXECUTE ON FUNCTION auth_agency_id() TO anon, authenticated, service_role;
```

que reproduce las tres entradas explícitas (la de `PUBLIC` sale sola con el `CREATE`).

### 1.3. `storage.buckets`, la fila entera

```json
[{
  "id": "property-images", "name": "property-images",
  "owner": null, "owner_id": null,
  "created_at": "2026-05-30 01:51:02.10007+00",
  "updated_at": "2026-05-30 01:51:02.10007+00",
  "public": true,
  "avif_autodetection": false,
  "file_size_limit": 5242880,
  "allowed_mime_types": ["image/png", "image/jpeg", "image/webp"],
  "type": "STANDARD", "versioning_status": "DISABLED"
}]
```

**`file_size_limit = 5242880` (5 MB)** y **`allowed_mime_types = {image/png, image/jpeg,
image/webp}`**, donde antes había `NULL` en los dos. `public` sigue en `true`.

Dos detalles que documenté porque no son obvios:

- **Los 5 MB son MÁS permisivos que los 2 MB que exige `AgencyLogoForm`.** Lo tomé como
  deliberado y lo escribí así: el bucket es el techo duro para todo tipo de archivo (una foto de
  propiedad de 2 MB es chica) y la regla estricta del logo sigue viviendo en su formulario.
- **Consecuencia medible del `allowed_mime_types`:** `ImageUploader` filtra con
  `f.type.startsWith("image/")` (`ImageUploader.tsx:48-50`), así que hasta ayer dejaba pasar un GIF
  o un HEIC. **Ahora esos rebotan en el motor.** Es un cambio de comportamiento real, no una
  formalidad, y quedó anotado.

### 1.4. Confirmación de que lo escrito coincide con lo medido

| Objeto medido | Dónde quedó en el archivo | ¿Coincide? |
|---|---|---|
| `auth_agency_id()` + su GRANT | `…initial_schema.sql:820` y `:830`, sección "FUNCIÓN: agencia del usuario autenticado" | **Sí** — cuerpo, `STABLE`, `SECURITY DEFINER`, `search_path` y los tres roles del GRANT |
| Fila de `storage.buckets` | `…initial_schema.sql:1109` | **Sí** — `public`, 5242880 y los tres MIME, con el `ON CONFLICT DO NOTHING` que ya tenía |
| `Authenticated reads storage files` | `…initial_schema.sql:1209` | **Sí** |
| `Agency writes own storage files` | `…initial_schema.sql:1215` | **Sí** |
| `Agency updates own storage files` | `…initial_schema.sql:1247` | **Sí**, con `USING` y `WITH CHECK` idénticos como en la base |
| `Agency deletes own storage files` | `…initial_schema.sql:1299` | **Sí** |

**Policies viejas SACADAS del archivo (las tres que ya no existen en la base):**
`Public read property images storage`, `Authenticated users can upload property images` y
`Users can delete own property images`. Verificado: ninguna de las tres aparece más en el archivo,
salvo nombrada dentro de un comentario histórico que explica qué reemplazó a qué.

> La policy de UPDATE laxa que se había agregado a mano **nunca estuvo en el archivo** (se corrió
> directo en el SQL Editor), así que no había nada que sacar; lo dejé dicho en la nota de fidelidad.

### 1.5. Los comentarios que se agregaron

En la sección de policies del archivo quedaron las dos trampas que el prompt pedía, escritas con la
evidencia medida y no como advertencia genérica:

- **TRAMPA 1 — la carpeta se compara en TEXTO, nunca casteándola a `uuid`.** Con la salida real de
  `storage.foldername()` para los tres tipos de path, el error textual
  (`ERROR: 22P02: invalid input syntax for type uuid: "avatars"`), y el porqué de que **excluir los
  prefijos con un `AND` antes de castear no sirva**: Postgres no garantiza el orden de evaluación
  de los `AND`, así que esa forma anda con 24 archivos y puede empezar a fallar con 5.000 **sin
  síntoma previo**.
- **TRAMPA 2 — `USING` y `WITH CHECK` idénticos a propósito**, con la explicación de qué controla
  cada uno y el ataque concreto que se abre si solo se endurece el `USING` (renombrar un archivo
  propio hacia la carpeta de otra agencia).
- **Por qué la función es `SECURITY DEFINER`**, junto a su definición: para que las policies no
  queden atadas a `Public read agents`, con la advertencia de que el 403 resultante **no tendría
  relación aparente con `agents`** — más la deuda de que la rama de propiedades todavía no está
  cubierta.

Agregué además tres comentarios que no estaban pedidos pero que salieron de la medición y sin los
cuales el archivo miente por omisión: que **la primera carpeta de un path de propiedad es el
uploader y no el dueño** (es la razón de que la frontera sea por agencia), que **el service role
saltea las cuatro policies** (`relforcerowsecurity = false`), y que **los archivos huérfanos
quedaron inalcanzables**.

---

## 2. QUÉ SE CORRIGIÓ EN `CLAUDE.md` Y EN `PENDIENTES.md`

### 2.1. La afirmación falsa — dónde estaba y qué dice ahora

Estaba en **dos lugares**, con la misma deducción equivocada:

| Archivo | Decía |
|---|---|
| `CLAUDE.md` (§ Imágenes y Storage) | *"son **laxas y consistentes** — INSERT, UPDATE y DELETE permiten a cualquier usuario `authenticated` operar sobre el bucket"* y *"La policy de DELETE vieja […] **quedó reemplazada por la laxa**"* |
| `PENDIENTES.md` (Deuda técnica) | *"la policy de DELETE original SÍ intentaba seguridad fina […] → **quedó reemplazada por la laxa** al arreglar el problema de reemplazo"* |

**Las dos son falsas, y lo verifiqué antes de tocar nada:** hasta este cambio, la policy de DELETE
seguía siendo `((bucket_id = 'property-images') AND ((auth.uid())::text = (storage.foldername(name))[1]))`
— **textualmente idéntica a la de la migración original** (`…initial_schema.sql:1071-1076` en la
versión anterior del archivo). Lo que se agregó al arreglar el 403 de reemplazo fue una policy de
**UPDATE nueva y laxa**, sin tocar la de DELETE. Las policies eran **tres laxas y una fina**, no
cuatro laxas.

**Corregido en los dos archivos, y sin borrar el error**: en vez de reescribir la historia, dejé el
desmentido explícito con lo que la afirmación falsa ocultaba, que es lo que importa:

- **Nadie podía borrar un avatar ni un logo por RLS, ni su dueño** (ahí `foldername[1]` es la
  palabra literal). No daba síntoma solo porque ningún camino del código lo intenta.
- **Un admin no podía borrar una foto subida por otro agente de su equipo.**
- **El daño real de las laxas nunca estuvo en el borrado sino en el UPDATE:** permitía
  **sobrescribir** con `upsert` el logo, el avatar o las fotos de cualquier otra agencia, dejando
  `agencies.logo_url` intacto y el sitio white-label de la víctima sirviendo contenido ajeno, sin
  una sola señal en las tablas.

**Un tercer lugar que también corregí, y que no estaba pedido:** `PENDIENTES.md:344`, el ítem
cerrado *"Arreglo policy UPDATE de Storage"*. Ese ítem **era exacto** (dice que se agregó una policy
de UPDATE, que es lo que pasó), pero es la fuente de la que las otras dos notas dedujeron mal. Le
agregué el señalamiento para que no vuelva a pasar: *"acá se AGREGÓ una policy de UPDATE; no se
reemplazó la de DELETE"*, más el enlace al ítem ahora cerrado.

### 2.2. `CLAUDE.md` — lo que se agregó

La sección **"Imágenes y Storage"** pasó de dos viñetas a dos subsecciones nuevas:

- **`#### Policies de storage.objects — seguridad fina (5 sep 2026)`**: la tabla de frontera por
  tipo de archivo, la función `auth_agency_id()` con su porqué (y su deuda), **las dos trampas**
  con el error textual medido, el recordatorio de por qué existe la policy de UPDATE (el `upsert`
  es UPDATE, no INSERT), el service role que saltea todo, la distinción entre "lectura por RLS
  cerrada" y "lectura pública por URL abierta", el cierre de la enumeración anónima con la
  verificación (`[]`), y el efecto colateral aceptado de los huérfanos inalcanzables.
- **`#### Límites del bucket — los aplica el MOTOR, no el JavaScript`**: los valores medidos, el
  hecho de que antes estaban en `NULL` y de que el *"no SVG, riesgo XSS"* del código **no lo
  aplicaba nadie**, la calibración de los 5 MB vs. los 2 MB del formulario, y el rebote de GIF/HEIC.

Además, dos lugares que quedaban contradiciendo lo nuevo:

- **La descripción de la Sub-pieza B1** decía que la validación del logo estaba *"chequeada en JS
  antes de subir"* a secas. Le agregué que **desde el 5 sep 2026 el bucket también valida**, y que
  los 2 MB del form siguen siendo su regla propia, más estricta que el techo del bucket.
- **La tabla "Decisiones de Arquitectura"** ganó **cinco filas**: la frontera por agencia/usuario;
  `auth_agency_id()` como `SECURITY DEFINER` en vez de un subselect suelto; la comparación en texto
  y no por cast; el `USING`/`WITH CHECK` idénticos; y los límites en el bucket y no solo en el
  formulario.

### 2.3. `PENDIENTES.md` — lo que se cerró y lo que se abrió

**CERRADO:** *"Seguridad fina de las policies de Storage — ANTES DE OCTUBRE"*, con la tabla de la
frontera resultante, la función, los límites del bucket, la corrección de la afirmación falsa, el
cierre no planeado de la enumeración anónima, y **cuatro cosas que deliberadamente NO se hicieron**:

1. **No se tocó `public = true`** del bucket (las fotos las tiene que ver el visitante anónimo).
2. **No se limpiaron los huérfanos** ni se agregó código que los borre.
3. **No se unificó la rama de propiedades dentro de `auth_agency_id()`** — sigue atada a
   `Public read agents`.
4. **No se movieron los paths de propiedad a `{agency_id}/…`**, que sería más limpio (pondría la
   frontera en el path y evitaría el `EXISTS`) pero obliga a migrar los objetos y a reescribir las
   URLs guardadas en `property_images.url`. Con 24 archivos y sin clientes reales, **es el momento
   más barato de la historia del proyecto para hacerlo**; si no se hace ahora, no se hace más.

**ABIERTO — un bloque nuevo con encabezado propio**, tal como pedía el punto 5 del prompt:

> `### Limpieza de Storage — grupo de trabajo SIGUIENTE (cambios de CÓDIGO)`

con la justificación explícita de por qué van juntos y aparte: **aquella tanda fue de policies y
bucket (SQL, cero líneas de `src/`) y estos cinco son cambios de código**, comparten causa raíz
(nadie borra archivos cuando se borra la fila que los referencia) y conviene medir el bucket una
sola vez. Los cinco ítems, cada uno verificado contra el código o la base **antes** de escribirlo:

1. Borrar una propiedad no borra sus archivos (con el comentario del código citado).
2. Borrar un agente no borra su avatar ni sus archivos.
3. `ImageUploader.tsx:114` no chequea el error de `remove()`.
4. Los huérfanos quedaron inalcanzables por las policies nuevas.
5. Las fotos siguen accesibles por URL directa — **anotado como decisión pendiente, no como bug**.

---

## 3. LOS NÚMEROS MEDIDOS PARA LOS ÍTEMS NUEVOS

Todo contra la base el 5 sep 2026, con **24 objetos** en `property-images`
(17 de propiedad, 3 de avatar, 4 de logo).

| Medición | Número |
|---|---|
| **Archivos de propiedades que ya no existen** | **10** (de 17), repartidos en **6** propiedades distintas |
| **Archivos bajo la carpeta de un agente que ya no existe** | **5**, de **1** agente (`76754c70-5cf1-46f8-8285-82396ab2dd03`) |
| Archivos de propiedad huérfanos por cualquiera de las dos causas | **10** (los 5 del agente borrado son un subconjunto de los 10) |
| Avatares de agentes que ya no existen | **0** |
| Carpetas `logos/` de agencias que ya no existen | **1** (`1a794e72-bf15-44fa-af3c-054242cd9506`, solo con un `.emptyFolderPlaceholder`) |

**Cómo leer el 10 sobre 17: casi la mitad del bucket ya es basura**, y eso con 17 propiedades de
prueba. Con un plan premium de 200 propiedades y fotos reales, es crecimiento de costo sin techo.

**El 0 de avatares huérfanos no es una buena noticia**, y lo escribí así en `PENDIENTES.md`: es 0
solo porque el único agente borrado nunca subió avatar. El camino está exactamente igual de
desprotegido — `equipo/actions.ts` no menciona Storage en ninguna línea.

**Sobre el ítem del error no chequeado**, la línea exacta, citada textual en `PENDIENTES.md`
(`src/components/properties/ImageUploader.tsx:114`, dentro de `handleRemove`):

```ts
await supabase.storage.from(BUCKET).remove([path]);
```

Es un `await` pelado: no hay `const { error } =`, no hay chequeo, no hay mensaje. Y en la línea
siguiente la imagen sale del estado del formulario igual. **Con las policies viejas esto era un bug
activo** (un admin borrando la foto de un compañero caía justo ahí); con las nuevas ese caso
concreto se arregló, **pero el silencio sigue**, y es exactamente el mecanismo por el cual se llega
a los 10 huérfanos.

**Sobre el ítem del comentario en el borrado de propiedades**, también citado textual
(`src/app/(agent)/dashboard/propiedades/actions.ts:217-218`):

```ts
// ON DELETE CASCADE en la DB elimina property_images y leads asociados.
// Las imágenes del Supabase Storage no se eliminan automáticamente.
```

No es una omisión sospechada: está escrita en el código, y en toda la action no hay una sola
llamada a Storage.

---

## 4. BASELINE DE CALIDAD

Esta tarea tocó solo `.md` y `.sql`, así que nada podía moverse. No se movió.

### `npx tsc --noEmit`

```
(sin salida)
TSC_EXIT=0
```

**0 errores.**

### `npm run lint`

```
> marka@0.1.0 lint
> eslint

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  808:30  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this,
by default React Compiler will skip memoizing this component/hook. However, you may see issues if
values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:808:30
  806 |   });
  807 |
> 808 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
      |                              ^^^^^ React Hook Form's `useForm()` API returns a `watch()`
      |                                    function which cannot be memoized safely.
  809 |   const lat = watch("lat");
  810 |   const lng = watch("lng");
  811 |   const address = watch("address") ?? "";  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)

LINT_EXIT=0
```

**0 errores, 1 warning**, el conocido de `react-hooks/incompatible-library` en
`PropertyForm.tsx:808`.

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 7.9s
  Running TypeScript ...
  Finished TypeScript in 7.9s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (19/19) in 1267ms
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

BUILD_EXIT=0
```

**Verde, exit 0, 19 rutas.**

### Veredicto

**Sin regresiones. Los tres coinciden exactamente con el baseline documentado** (0 / 0 errores + 1
warning conocido / verde con 19 rutas).

**Nota sobre archivos tocados:** `find` reporta como modificados hoy, además de los tres archivos de
documentación y este informe, a `next-env.d.ts` y `tsconfig.tsbuildinfo`. **Los dos los reescriben
`next build` y `tsc`**, no los toqué yo; `next-env.d.ts` se regenera con contenido idéntico y
`tsconfig.tsbuildinfo` es caché de compilación. **`src/` no tiene ni un archivo modificado**
(`find src -type f -newermt "2026-09-05 00:00" | wc -l` → `0`).

---

## 5. RESUMEN DE LO QUE HAY QUE SABER DE ESTE CAMBIO

**Lo que quedó bien y sin peros:**
- La frontera por agencia **es la correcta para este modelo de datos**, y la razón es más fuerte de
  lo que parece: la primera carpeta de un path de propiedad **es el que subió el archivo, no el
  dueño de la propiedad** (`agentId={userId}` en las dos páginas), así que con frontera por usuario
  un equipo directamente no puede gestionar sus propias fotos.
- La comparación en texto y el `USING`/`WITH CHECK` idénticos están bien resueltos en la base, y
  ahora están explicados en el schema para que nadie los "simplifique".
- Se cerró, de yapa, la enumeración anónima del bucket, que era una fuga real y no estaba en el
  plan.
- Los límites del bucket mueven al motor lo que hasta ayer solo decía el JavaScript.

**Los tres peros, en orden de importancia:**
1. **La rama de propiedades sigue dependiendo de `Public read agents`.** La función SECURITY
   DEFINER cortó media dependencia, no una. Anotado como deuda.
2. **La lectura pública de las fotos no cambió** y no puede cambiar sin bucket privado + URLs
   firmadas. Quedó como decisión pendiente, con el costo real explicado (toca todos los
   `getPublicUrl()` y la performance de la query caliente del mapa).
3. **El bucket quedó con 10 archivos huérfanos que ahora nadie puede borrar** salvo service role, y
   ningún código del proyecto los alcanza. No es una regresión —con la policy vieja tampoco eran
   alcanzables— pero ahora es estructural, y la causa raíz (nadie borra archivos al borrar filas)
   es el grupo de trabajo que sigue.
