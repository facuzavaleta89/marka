# Informe — Alinear el sitio de marca (`/[slug]`) con la regla de visibilidad pública

> Modo ejecución. Se modificaron **2 archivos** del proyecto (más este informe).
> No se ejecutó ningún comando de git ni ningún SQL de escritura: los cambios de base ya
> estaban aplicados y solo se **midieron** por MCP en solo lectura. Fecha: 31 ago 2026.

---

## 1. Lo medido en la base

### 1.1 La función

`pg_get_functiondef`, textual:

```sql
CREATE OR REPLACE FUNCTION public.agency_is_publicly_visible(target_agency_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM agencies a
    JOIN subscriptions s ON s.agency_id = a.id
    WHERE a.id = target_agency_id
      AND a.approval_status = 'approved'
      AND s.status = 'active'
      AND s.plan <> 'free'
  );
$function$
```

| Propiedad | Valor medido |
|---|---|
| Argumentos | `target_agency_id uuid` |
| Retorna | `boolean` |
| Volatilidad | `s` = **STABLE** ✅ |
| `prosecdef` | **true** = SECURITY DEFINER ✅ |
| `proconfig` | `search_path=public` |
| Owner | `postgres` |

**Coincide con lo descrito**, y con un extra que no mencionaste y que importa: la función
lleva `SET search_path TO 'public'`. En una función `SECURITY DEFINER` eso no es decorativo —
sin fijar el `search_path`, quien pueda crear objetos en un esquema anterior en la ruta de
búsqueda podría interponer una tabla `agencies` propia y hacer que la función responda lo que
él quiera, con los permisos del owner. Está bien puesto.

Permisos de ejecución medidos (`has_function_privilege`):

| Rol | EXECUTE |
|---|---|
| `anon` | ✅ |
| `authenticated` | ✅ |
| `service_role` | ✅ |
| `postgres` | ✅ |

### 1.2 Las tres policies

Medidas con `pg_policy` + `pg_get_expr`. Las tres invocan la función:

**`properties` · `Public read active properties`** (SELECT, PUBLIC, permissive) — `qual`:
```sql
((status = 'active'::text) AND agency_is_publicly_visible(agency_id))
```

**`property_images` · `Public read property images`** (SELECT, PUBLIC, permissive) — `qual`:
```sql
(EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_images.property_id) AND (p.status = 'active'::text) AND agency_is_publicly_visible(p.agency_id))))
```

**`leads` · `Public insert lead`** (INSERT, PUBLIC, permissive) — `with_check`:
```sql
(EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = leads.property_id) AND (p.status = 'active'::text) AND (p.agent_id = leads.agent_id) AND (p.agency_id = leads.agency_id) AND agency_is_publicly_visible(p.agency_id))))
```

Las policies del área privada quedaron **sin tocar**, como corresponde: `Agency members read
agency properties` (`agency_id IN (SELECT agents.agency_id FROM agents WHERE agents.id =
auth.uid())`), `Agent manages own properties` (`agent_id = auth.uid()`) y `Agency members read
own subscription`. Una agencia que dejó de pagar sigue entrando a su panel y viendo todo lo suyo.

**No hay diferencias con lo que describiste. No hubo que parar.**

### 1.3 Verificación del efecto (con una salvedad honesta)

No pude reproducir tu verificación ejecutando como visitante anónimo: el usuario de solo
lectura del MCP no puede cambiar de rol (`ERROR: 42501: permission denied to set role "anon"`)
y **tampoco puede ejecutar la función** (`ERROR: 42501: permission denied for function
agency_is_publicly_visible` — el `GRANT EXECUTE` está para `anon`/`authenticated`/`service_role`,
no para el rol de lectura del MCP).

Lo que sí hice fue evaluar **las mismas condiciones del cuerpo de la función** con SQL propio,
y el resultado coincide con el tuyo: **10 de las 12 propiedades activas quedan visibles**, y las
2 ocultas son de agencias en plan `free` (`Inmobiliaria Gaio`, con la suscripción en `pending`
esperando activación de `inicial`; e `Inmobiliaria Zavaleta2`, en `free`/`active`). Los números
de esta parte del informe salen de esa evaluación equivalente, no de una llamada a la función.

---

## 2. Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/lib/utils/resolveAgencyBySlug.ts` | Se agregó el **tercer gate** de visibilidad pública (llamada a `agency_is_publicly_visible` vía RPC, en un helper privado `isAgencyPubliclyVisible` que falla cerrado), más los comentarios que explican por qué el service role no queda cubierto por las policies y por qué `has_white_label` no alcanza. |
| `src/app/(agent)/admin/page.tsx` | La StatsCard "Propiedades activas" ahora lleva `description="Cargadas, incluso las ocultas al público"`, con un comentario que explica que cuenta con service role y por qué el número no coincide con el del mapa. |

**No se creó ningún archivo nuevo** y **no se cambió la forma de `AgencyResolution`**: se
reusó el estado `disabled` que ya existía, como pediste.

---

## 3. Cómo se evalúa la regla en el helper, y por qué así

### La forma elegida: preguntarle a la base (RPC), no reescribir las condiciones

```ts
async function isAgencyPubliclyVisible(
  supabase: ReturnType<typeof createAdminClient>,
  agencyId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("agency_is_publicly_visible", {
    target_agency_id: agencyId,
  });

  if (error) return false;
  return data === true;
}
```

y en el flujo, después de los dos gates que ya estaban:

```ts
if (row.approval_status !== "approved") {
  return { status: "disabled" };
}
if (subscription?.has_white_label !== true || !city) {
  return { status: "disabled" };
}
if (!(await isAgencyPubliclyVisible(supabase, row.id))) {
  return { status: "disabled" };
}
```

### Por qué la RPC y no repetir las condiciones en la consulta

Vos mismo pusiste el criterio de decisión: *"la regla tiene que decir lo mismo en los dos
lugares y si mañana cambia no puede quedar una mitad desactualizada."* Con eso, la comparación
es corta:

- **Repitiendo las condiciones en TypeScript** hubiera salido gratis en latencia (la consulta
  que ya existe podía traer `subscription.status` y `subscription.plan` en el mismo embed, sin
  round trip extra). Pero la regla quedaría escrita **dos veces**: una en la función SQL que
  usan las tres policies, otra en este archivo. El día que cambie —el ejemplo realista es que
  un `past_due` pase a tener período de gracia— habría que acordarse de tocar las dos. Y el
  síntoma de olvidarse es silencioso y feo: el mapa mostrando propiedades de una agencia cuyo
  sitio de marca está apagado, o al revés. Nadie se entera hasta que un cliente lo reporta.
- **Con la RPC**, la condición vive en **un solo lugar** (la función), y los cuatro consumidores
  —las tres policies y este helper— la leen de ahí. Cambiar la regla es cambiar la función.

**El precio es un viaje extra a la base**, y lo acoté a propósito:

- Se paga **solo si los otros dos gates pasan**. Los gates 1 y 2 se evalúan sobre datos que ya
  están en la fila (gratis), y cortan antes; con los datos de hoy, 9 de 11 agencias ni siquiera
  llegan a la llamada.
- **No está en el camino caliente.** Esto corre una vez por render de la página `/[slug]`, en un
  Server Component. La consulta caliente del proyecto (`useProperties`, que corre en cada
  paneo del mapa) **no se tocó** y sigue resolviéndose con la policy, sin round trips extra.

### Detalles de implementación

- **Falla cerrada.** Si la RPC devuelve error, el helper responde `false` → `disabled`. La
  dirección importa: si el sitio de una agencia al día queda abajo por un error transitorio, el
  dueño de la agencia reclama y se arregla; si el de una agencia que no paga queda arriba, no se
  entera nadie y es justo lo que este trabajo vino a cerrar.
- **Sin `any`.** El `data` de la RPC no se anota ni se castea: se compara con `data === true`,
  que produce un `boolean` y deja la firma de la función explícita en `Promise<boolean>`.
- **La lógica quedó en `lib/`**, en el mismo archivo del helper. No la extraje a un archivo
  propio porque tiene un solo consumidor; si mañana aparece un segundo, ahí sí conviene sacarla.
- **El gate 1 (aprobación) quedó redundante a propósito** y está documentado como tal: la
  función también exige `approval_status = 'approved'`, así que el chequeo local no agrega
  seguridad — agrega la posibilidad de cortar **antes** del viaje a la base. Lo dejé porque
  respeta tu instrucción ("las tres tienen que cumplirse") y porque el corte temprano es real.

---

## 4. Qué agencia tendría su sitio de marca visible hoy

Los tres gates, agencia por agencia (evaluados con SQL equivalente al cuerpo de la función):

| Agencia | slug | 1 · Aprobada | 2 · `has_white_label` | 3 · Al día (`plan` / `status`) | Resultado |
|---|---|---|---|---|---|
| Inmobiliaria Demo | `inmobiliaria-demo` | ✅ approved | ✅ true | ✅ profesional / active | **SITIO VISIBLE** |
| Inmobiliaria Juan Lopez2 | `inmobiliaria-juan-lopez2-php0fa` | ✅ approved | ✅ true | ✅ profesional / active | **SITIO VISIBLE** |
| Inmobiliaria Prueba Gaio | `inmobiliaria-prueba-gaio` | ✅ approved | ❌ **false** | ✅ inicial / active | APAGADO — plan pago pero **sin white-label** (gate 2) |
| Inmobiliaria Zavaleta3 | `inmobiliaria-zavaleta3-05ervf` | ✅ approved | ❌ **false** | ✅ inicial / active | APAGADO — plan pago pero **sin white-label** (gate 2) |
| Inmobiliaria Gaio | `inmobiliaria-gaio` | ✅ approved | ❌ false | ❌ free / **pending** | APAGADO — gates 2 y 3 |
| Inmobiliaria Juan Lopez | `inmobiliaria-juan-lopez-dw2w9x` | ✅ approved | ❌ false | ❌ free / active | APAGADO — gates 2 y 3 |
| Inmobiliaria Prueba | `inmobiliaria-prueba` | ✅ approved | ❌ false | ❌ free / active | APAGADO — gates 2 y 3 |
| Inmobiliaria Prueba *(2ª agencia, mismo nombre)* | `inmobiliaria-prueba-2` | ✅ approved | ❌ false | ❌ free / active | APAGADO — gates 2 y 3 |
| Inmobiliaria Zavaleta | `inmobiliaria-zavaleta-oybcap` | ✅ approved | ❌ false | ❌ free / active | APAGADO — gates 2 y 3 |
| Inmobiliaria Zavaleta2 | `inmobiliaria-zavaleta2-yufqg7` | ✅ approved | ❌ false | ❌ free / active | APAGADO — gates 2 y 3 |
| Miguel Andrade | `miguel-andrade-sjeo8g` | ✅ approved | ❌ false | ❌ free / active | APAGADO — gates 2 y 3 |

**Resultado: 2 sitios visibles, 9 apagados.** Las 11 agencias están `approved`, así que el gate 1
no apaga a nadie hoy.

**⚠ Lo importante, y hay que decirlo claro: con los datos de hoy este cambio no apaga ni un
solo sitio que antes estuviera prendido.** Las dos agencias con `has_white_label = true` pasan
también el gate 3 (profesional / active), así que el comportamiento observable es idéntico al
de antes. **Esto no significa que el cambio no haga nada**: cierra el agujero para el futuro —
el día que una de esas dos suscripciones pase a `past_due` o `canceled`, el flag va a seguir en
`true` (nada lo apaga) y hoy su sitio quedaría en pie mostrando un mapa vacío. Con el gate 3, se
apaga.

**Para probar el cambio a mano hace falta preparar datos**: no hay hoy ninguna agencia con
`has_white_label = true` y suscripción no-activa, que es exactamente el caso que este gate
existe para cubrir.

---

## 5. Confirmación: no quedó ningún filtro duplicado en las consultas públicas

Verificado por búsqueda sobre los cinco archivos del camino público
(`useProperties.ts`, `PropertyModal.tsx`, `MapView.tsx`, `PropertyList.tsx`, `AgencyMapView.tsx`)
de los términos `approval_status`, `has_white_label`, `subscriptions`, `plan` y
`agency_is_publicly_visible`:

```
>>> SIN filtros de agencia/suscripción en las consultas públicas
```

Los filtros de `useProperties.ts` siguen siendo exactamente los de antes —`city_id`,
`status='active'`, el `agency_id` opcional del white-label y los filtros de la UI— y
`PropertyModal.tsx` sigue con `id` + `status='active'`. **Los dos se apoyan solo en la policy.**

La única referencia a la regla en todo `src/` es la del helper (más dos menciones en
comentarios):

```
src/app/(agent)/admin/page.tsx:188   ← comentario
src/lib/utils/resolveAgencyBySlug.ts:29, 71   ← comentarios
src/lib/utils/resolveAgencyBySlug.ts:86       ← la única llamada real
```

También verifiqué lo que pediste sobre el helper antes de asumirlo: **usa service role**
(`createAdminClient()` en `resolveAgencyBySlug.ts:97`), por eso la policy no lo cubre y el gate
tuvo que escribirse en el código.

---

## 6. Verificación

### `npx tsc --noEmit`
```
(sin salida)
```
**exit code: 0**

### `npm run lint`
```
> marka@0.1.0 lint
> eslint


/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  269:20  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:269:20
  267 |   });
  268 |
> 269 |   const currency = watch("currency");
      |                    ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  270 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
  271 |   const lat = watch("lat");
  272 |   const lng = watch("lng");  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
```
**exit code: 0**

### `npx next build`
```
  Creating an optimized production build ...
✓ Compiled successfully in 7.8s
  Running TypeScript ...
  Finished TypeScript in 8.4s ...
✓ Generating static pages using 3 workers (19/19) in 1506ms
  Finalizing page optimization ...

Route (app)
┌ ○ /                                    ├ ƒ /dashboard/perfil
├ ○ /_not-found                          ├ ƒ /dashboard/preferencias
├ ƒ /[slug]                              ├ ƒ /dashboard/propiedades
├ ƒ /admin                               ├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /api/geocode                         ├ ƒ /dashboard/propiedades/nueva
├ ○ /apple-icon.png                      ├ ƒ /dashboard/suscripcion
├ ƒ /dashboard                           ├ ƒ /login
├ ƒ /dashboard/equipo                    ├ ƒ /logout
├ ƒ /dashboard/leads                     ├ ƒ /register
                                         └ ƒ /register/plan

ƒ Proxy (Middleware)
```
**exit code: 0**

### Comparación contra el baseline

| Métrica | Baseline esperado | Medido | ¿Igual? |
|---|---|---|---|
| Errores de TypeScript | 0 | 0 | ✅ |
| Errores de lint | 0 | 0 | ✅ |
| Warnings de lint | 1 (`react-hooks/incompatible-library`, `PropertyForm.tsx`) | 1, mismo, `PropertyForm.tsx:269` | ✅ |
| Build | verde, 19 rutas | verde, 19 rutas | ✅ |

**Idéntico al baseline.**

---

## 7. Decisiones que se apartan de las instrucciones

Una sola, y es menor:

- **Dejé el chequeo de aprobación (gate 1) aunque quedó redundante.** La función
  `agency_is_publicly_visible` ya exige `approval_status = 'approved'`, así que estrictamente
  el gate 1 podría borrarse y la regla se seguiría cumpliendo por dentro del gate 3. Lo
  conservé porque (a) pediste explícitamente que las tres condiciones se cumplan y que la
  nueva se **sume** a las dos existentes, y (b) evaluarlo localmente permite cortar sin pagar
  el viaje a la base. Está documentado en el código como redundancia deliberada, no como
  descuido, para que nadie lo "limpie" pensando que se coló.
  ⚠ El riesgo que asumo, y lo dejo dicho: si algún día la función dejara de exigir la
  aprobación, este chequeo local quedaría siendo más estricto que el mapa. Es poco probable
  (la aprobación es el eje de legitimidad y no se negocia), pero es el costo de la redundancia.

Fuera de eso, todo salió como estaba pedido: se reusó el estado `disabled`, no se cambió la
forma del retorno, `has_white_label` se conservó como gate propio, la lógica quedó en `lib/`,
los comentarios de negocio están en español, y no se tocó ni el panel privado, ni el hook del
mapa, ni el modal.

---

## 8. Encontrado y NO tocado, por estar fuera del alcance

1. **Nada apaga `has_white_label`.** Es la causa raíz de todo esto: el flag se escribe al
   activar un plan desde `/admin` y no existe ningún flujo que lo ponga en `false`. Este trabajo
   **compensa el síntoma** (el sitio de marca ya no depende solo del flag), pero la deuda sigue
   ahí y es la misma que `PENDIENTES.md` anota como *"el panel admin es de una sola vía"*. Si
   alguna vez se agrega "dar de baja / bajar de plan", ahí hay que decidir qué pasa con el flag.

2. **El sitio de marca se apaga, pero la agencia sigue siendo pública en `agencies`.** La policy
   `Public read agencies` tiene `qual: true`, así que cualquiera con la anon key sigue leyendo
   nombre, slug, matrícula y estado de aprobación de **todas** las agencias, paguen o no. Es
   preexistente y ya está documentado en CLAUDE.md; no lo toqué porque cambiarlo afecta a
   consumidores que no son de esta pieza.

3. **La ruta `/[slug]` no manda `noindex` cuando está `disabled`.** Un sitio que se apaga por
   falta de pago sigue devolviendo 200 con la página `AgencyUnavailable`, así que un buscador
   puede indexarla. No es parte de lo pedido y tiene decisiones de producto detrás (¿404?
   ¿410? ¿410 solo si vencida?), así que lo dejo anotado.

4. **`src/types/supabase.ts` no existe.** `CLAUDE.md` lo lista en la estructura de carpetas
   ("Generado por Supabase CLI (no editar)") y en Comandos Útiles, pero **el archivo no está en
   el repo y nadie lo importa**. Consecuencia concreta para este trabajo: los clients de
   Supabase no llevan el genérico `<Database>`, así que `.rpc()` no está tipado — el nombre de
   la función y el de su parámetro son strings que TypeScript no valida. Si esos types se
   generaran, un error de tipeo en `"agency_is_publicly_visible"` o en `target_agency_id`
   pasaría a fallar en compilación en vez de en runtime. **No lo generé** porque requiere
   correr la CLI de Supabase contra el proyecto y toca el tipado de todo el repo, que es una
   pieza propia y bastante más grande que esta.

5. **El `EXECUTE` de la función no está restringido.** `anon` puede llamar directamente a
   `agency_is_publicly_visible(uuid)` con la anon key y averiguar si una agencia cualquiera está
   al día. No es información sensible (es deducible mirando si sus propiedades aparecen en el
   mapa) y el `GRANT` a `anon` es **necesario** para que las policies funcionen para el
   visitante, así que no hay nada que arreglar — pero lo dejo dicho para que no sorprenda.

6. **El contador de `/admin` sigue contando con service role.** Lo pediste así; solo agregué la
   aclaración en la interfaz. No revisé si las otras seis métricas del panel tienen
   desalineaciones parecidas, porque estaba fuera del alcance.
