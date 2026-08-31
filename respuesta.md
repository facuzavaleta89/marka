# Informe de ejecución — El barrio sale de la búsqueda; se elimina la cascada

**Modo:** ejecución. **No se ejecutó ningún comando de git.** No se ejecutó SQL de escritura.

**Fecha:** 2026-08-31.

**Balance: se sacó código, no se agregó.** El orquestador pasó de 434 a 369 líneas, y de esas 369 una parte creció porque el comentario que documenta *por qué* el barrio no va es deliberadamente largo (tarea 3). En código ejecutable la reducción es mayor de lo que sugiere el conteo.

**Archivos modificados: 6.** Ninguno creado, ninguno eliminado.

---

## 0. Reproducción del caso medido (antes de tocar nada, y después)

Antes de escribir el informe reproduje tu medición contra Nominatim real, con exactamente la consulta que arma este módulo (`viewbox` incluido), espaciando 1,5 s entre pedidos por la política de uso:

```
ANTES · barrio "Centro"  (el que la gente usa)   → OUT_OF_CITY  157.8 km  Bartolomé Mitre, Barrio Centro, Añatuya, Municipio de Añatuya…
ANTES · barrio "Parque"  (el mapeado)            → found          0.9 km  291, Mitre, Barrio Parque Aguirre, Santiago del Estero…
ANTES · barrio "Cabildo" (otro cualquiera)       → not_found
AHORA · SIN barrio                               → found          0.9 km  291, Mitre, Barrio Parque Aguirre, Santiago del Estero…
```

**Tu hallazgo queda confirmado, y el arreglo también:** sin barrio, "Mitre 291" se encuentra bien, a 0,9 km del centro. **Dos precisiones sobre el reporte**, que anoté porque el comentario del código tiene que llevar datos exactos si su trabajo es impedir que alguien vuelva a agregar el barrio:

1. **Con "Centro" el resultado no cae en otra provincia, sino en otra ciudad de la MISMA provincia:** Bartolomé Mitre en **Añatuya**, a 158 km. No cambia nada de la conclusión —el filtro de distancia lo descarta igual y el resultado sigue siendo incorrecto y lejano—, pero es lo que efectivamente devuelve el servicio.
2. **Con "Cabildo" a mí me dio `not_found`, no un acierto.** Tu reporte decía "encuentra bien". Puede ser una diferencia de momento o de cómo se armó la consulta. Tampoco cambia la conclusión (un barrio que no coincide con lo mapeado o tapa la dirección o desvía la búsqueda), pero preferí escribir en el código lo que yo medí y no lo que me pasaron.

El comentario del orquestador quedó con estos números, no con los del enunciado.

---

## 1. Todos los lugares de los que salió el barrio

Recorrido completo, de la interfaz al proveedor:

| # | Archivo | Qué salió |
|---|---|---|
| 1 | `src/components/properties/PropertyForm.tsx:274` | `const neighborhood = watch("neighborhood") ?? "";` — existía **solo** para alimentar el botón. |
| 2 | `src/components/properties/PropertyForm.tsx:649` | La prop `neighborhood={...}` que se le pasaba a `<AddressSearchButton>`. |
| 3 | `src/components/properties/AddressSearchButton.tsx:25` | El campo `neighborhood: string \| null` de `AddressSearchButtonProps`. |
| 4 | `src/components/properties/AddressSearchButton.tsx:46` | El parámetro `neighborhood` de la desestructuración. |
| 5 | `src/components/properties/AddressSearchButton.tsx:77` | El `neighborhood` del cuerpo JSON del `fetch`. Ahora manda solo `{ address }`. |
| 6 | `src/app/api/geocode/route.ts:40` | El campo `neighborhood?: unknown` de `RequestBody`. La ruta ya no lo recibe. |
| 7 | `src/app/api/geocode/route.ts:66` | `const neighborhood = sanitizeNeighborhood(body.neighborhood);` — ya no se valida. |
| 8 | `src/app/api/geocode/route.ts:82` | El `neighborhood` que se le pasaba a `geocodeAddress`. |
| 9 | `src/app/api/geocode/route.ts:2` | El import de `sanitizeNeighborhood`. |
| 10 | `src/lib/geocoding/index.ts:94` | El campo `neighborhood: string \| null` de `GeocodeRequest`. El orquestador ya no lo acepta. |
| 11 | `src/lib/geocoding/index.ts:77` | La constante `MAX_NEIGHBORHOOD_LENGTH`. |
| 12 | `src/lib/geocoding/index.ts:121-123` | La función `sanitizeNeighborhood` completa. |
| 13 | `src/lib/geocoding/index.ts:241` | El barrio dentro de `cacheKey`. |
| 14 | `src/lib/geocoding/index.ts:356` | El `sanitizeNeighborhood(request.neighborhood)` de `geocodeAddress`. |
| 15 | `src/lib/geocoding/nominatim.ts:76` | El `query.neighborhood` del armado del texto de consulta. |
| 16 | `src/lib/geocoding/types.ts:20-21` | El campo `neighborhood` de `GeocodeQuery` (el tipo de la consulta genérica). |

**Sacarlo del tipo `GeocodeQuery` no rompió nada más**: `tsc --noEmit` pasa en 0, y el único otro consumidor del tipo es `nominatim.ts`, ya ajustado.

**Verificación de que no quedó nada** en el camino de geocodificación:

```
$ grep -rn "neighborhood" src/lib/geocoding/ src/app/api/geocode/ src/components/properties/AddressSearchButton.tsx
0 ocurrencias de código
```

### El barrio como campo de la propiedad: intacto

Estas ocurrencias **siguen y tienen que seguir**, verificadas una por una:

- `PropertyForm.tsx:81` — `neighborhood: z.string().optional()` en el esquema.
- `PropertyForm.tsx:229` — valor inicial en modo edición.
- `PropertyForm.tsx:351, 384` — se manda a las actions de alta y de edición.
- `PropertyForm.tsx:634-636` — el input "Barrio" del formulario.
- `propiedades/actions.ts:339, 447` — se persiste en la base.
- `PropertyCard.tsx`, `PropertyModal.tsx` — se muestra al visitante.
- `useProperties.ts:76-77` — filtro del mapa por barrio.
- `types/index.ts` — el campo de `Property` y de `MapFilters`.

**El agente sigue escribiendo el barrio y se sigue guardando tal cual.** Lo único que cambió es que dejó de viajar a la consulta de geocodificación.

### La ciudad sigue resolviéndose en el servidor

Sin tocar: `route.ts:68` sigue haciendo `getAgencyCity(session.agent.agency_id)`, y el cliente sigue sin poder influir en la ciudad, la provincia ni el país. Verificado en el banco de pruebas (comprobación 4): si un llamador cuela un `neighborhood` en el objeto, el orquestador lo ignora — ya no está en el tipo y nadie lo lee.

---

## 2. Todo lo que se eliminó con la cascada, y la verificación de que nadie más lo usaba

| Qué se eliminó | Dónde estaba | Verificación de que nada más lo usaba |
|---|---|---|
| **La constante `MIN_RETRY_BUDGET_MS`** (2 s) y su comentario | `index.ts:40-45` | `grep -rn "MIN_RETRY_BUDGET_MS" src/` → **0 usos** |
| **La lógica de los dos intentos**: las variables `withNeighborhood` / `withoutNeighborhood`, el `deadline`, y las tres condiciones (`if (!neighborhood)`, `if (status !== "not_found")`, `if (deadline - Date.now() < …)`) | `index.ts:370-407` | `grep -n "withNeighborhood\|deadline"` → **0 ocurrencias** |
| **La salvaguarda** `if (withoutNeighborhood.status === "unavailable") return withNeighborhood;` | `index.ts:405` | eliminada con el bloque; sin segundo intento no tiene sentido |
| **El tipo auxiliar** `Omit<GeocodeQuery, "neighborhood">` de `baseQuery` | `index.ts:361` | existía solo para armar dos variantes de la misma consulta |
| **La función `runAttempt`** | `index.ts:281-315` | ver punto 3 |
| **El comentario de `cacheKey`** que explicaba cómo convivían las dos entradas de la cascada | `index.ts:223-233` | reemplazado por uno que describe la clave real |
| **El comentario de cabecera "EL BARRIO ES UNA PISTA, NO UN REQUISITO"** con el diagrama de los dos intentos | `index.ts:322-343` | reemplazado por el de la tarea 3 |

**Relectura completa del orquestador después de sacar todo**, como pediste. Lo que encontré y resolví:

- **`sanitizeNeighborhood`** quedaba definida y exportada sin ningún llamador → eliminada.
- **`MAX_NEIGHBORHOOD_LENGTH`** quedaba sin usar → eliminada.
- **`sanitizeQueryText` seguía exportada, y su comentario decía "se exporta porque la ruta valida la entrada con esto mismo"** — falso: la ruta importaba `sanitizeAddress` y `sanitizeNeighborhood`, nunca `sanitizeQueryText`, y ahora importa solo `sanitizeAddress`. Era superficie pública sin consumidor con un comentario que la justificaba con un consumidor inexistente. La bajé a función privada del módulo y corregí el comentario. Ver punto 7.
- **Ninguna condición quedó siempre verdadera**: las tres del descarte de la cascada se fueron enteras, no se degradaron a `if (true)`.

**Lo que NO se tocó y sigue intacto: ver punto 5.**

---

## 3. Qué decidí sobre `runAttempt`, y por qué

**La reintegré al cuerpo de `geocodeAddress`.** Decisión mía, la pusiste en mis manos.

**Por qué.** `runAttempt` no nació por claridad: nació porque la cascada necesitaba invocar dos veces la misma secuencia y compartir un `AbortSignal` entre las dos. Con un solo llamador, todo lo que aportaba se da vuelta:

1. **El parámetro `signal` dejaba de tener razón de ser.** Existía para que dos intentos compartieran un presupuesto. Con uno solo, el controller se crea y se usa en el mismo lugar, y el parámetro era una indirección que sugería una flexibilidad que ya no existe.
2. **Partía en dos el manejo de errores.** `runAttempt` tenía `try/catch` y `geocodeAddress` tenía `try/finally`: dos bloques haciendo un trabajo. Ahora es un solo `try/catch/finally` que se lee de arriba abajo.
3. **Obligaba a saltar de función para leer un flujo lineal de treinta líneas.** Con una sola invocación, la indirección cuesta más de lo que ahorra.

El resultado es exactamente la forma que el módulo tenía **antes** de que se agregara la cascada: una función, un camino, sin ramas. Si mañana volviera a hacer falta repetir un intento (no debería), extraerla de nuevo es mecánico.

---

## 4. Qué quedó del orquestador — el flujo completo de un vistazo

`geocodeAddress` (`src/lib/geocoding/index.ts:297-346`), **sin una sola rama de estrategia**:

```
1. ¿Interruptor de caída simulada puesto?      → 'unavailable', y se termina.
                                                  (antes de la caché, del limitador y de la red)
2. Sanitizar la dirección                      → si queda vacía: 'not_found'
3. Armar la consulta:
       dirección + ciudad + provincia + país + centro + radio
4. ¿Está en caché?                             → devolverla (sin turno ni red)
5. Abrir el presupuesto de 5 s (AbortController + setTimeout)
6. Esperar el turno del limitador (1 consulta/segundo)
7. provider.search(query, signal)
8. ¿No hay candidato?                          → 'not_found'
   ¿Hay candidato?                             → evaluateCandidate:
                                                    redondear a 7 decimales
                                                    ¿a más de 25 km del centro? → 'out_of_city'
                                                    si no                        → 'found'
9. Guardar en caché (salvo 'unavailable')
10. Devolver

catch   → 'unavailable'   (red, HTTP no-2xx, JSON ilegible, timeout, turno cancelado)
finally → clearTimeout
```

Un intento. Un presupuesto. Un `try`. Los cuatro desenlaces salen de tres lugares y nada más.

---

## 5. Confirmación de que las piezas que NO había que tocar siguen intactas

Una por una, con la verificación:

| Pieza | Estado | Verificación |
|---|---|---|
| **Presupuesto de tiempo total y su cancelación** | intacto, `GEOCODE_TIMEOUT_MS = 5_000` | comprobación 11 del banco: `unavailable` a los **5006 ms** con un `fetch` colgado 9 s |
| **Límite de 1 consulta/segundo** | intacto, `MIN_REQUEST_INTERVAL_MS = 1_100`, `waitForSlot` sin cambios | comprobación 10: dos búsquedas seguidas tardaron **2201 ms** |
| **Caché con su TTL** | intacta, `CACHE_TTL_MS` 24 h, `MAX_CACHE_ENTRIES` 500 | comprobación 7: repetición servida con **0 pedidos** |
| **No cachear `unavailable`** | intacta, `writeCache` sigue cortando | comprobación 8: 1ª = `unavailable`, 2ª = `found` (volvió a salir) |
| **Descarte por distancia y su umbral** | intacto, `CITY_RADIUS_KM = 25`, `evaluateCandidate` sin cambios | comprobaciones 6 y 14: lejano → `out_of_city`, centro → `found` |
| **Interruptor de simulación de caída** | intacto, `GEOCODING_SIMULATE_OUTAGE`, primera línea de `geocodeAddress` | comprobaciones 12, 12b y 13: ON → `unavailable` con **0 pedidos**, incluso sobre una dirección cacheada como `found` |
| **User-Agent propio** | intacto, `nominatim.ts` sin cambios salvo `searchText` | el `GEOCODING_USER_AGENT` y su default siguen igual |
| **Los cuatro desenlaces y sus mensajes** | intactos | `GEOCODE_STATUS_MESSAGES` en `labels.ts` **no se tocó**; `GeocodeResponse` y `GeocodeStatus` en `types/index.ts` tampoco |
| **La ciudad resuelta en el servidor** | intacta | `route.ts:68`, `getAgencyCity(session.agent.agency_id)` |
| **El gate de sesión de la ruta** | intacto | `route.ts:47-50`, 401 sin sesión |

### Banco de pruebas completo (15 comprobaciones, todas pasan)

Corrido contra el **módulo real compilado**, con `fetch` interceptado para contar los pedidos que salen:

```
=== EL BARRIO YA NO PARTICIPA ===
  OK   │ 1. la consulta es dirección + ciudad + provincia + país  → Mitre 291, Santiago del Estero, Santiago del Estero, Argentina
  OK   │ 2. la consulta NO menciona ningún barrio
  OK   │ 3. un solo intento, siempre  → status=found, intentos=1
  OK   │ 4. un 'neighborhood' colado por el llamador se ignora

=== SIN CASCADA: 'not_found' es final ===
  OK   │ 5. vacío → not_found con UN intento (antes reintentaba)  → status=not_found, intentos=1
  OK   │ 6. resultado lejano → out_of_city, UN intento  → status=out_of_city, intentos=1

=== LO QUE NO HABÍA QUE TOCAR SIGUE INTACTO ===
  OK   │ 7. caché: repetición sin salir a la red  → status=found, pedidos=0
  OK   │ 8. 'unavailable' NO se cachea (el reintento del agente vuelve a salir)  → 1ª=unavailable, 2ª=found
  OK   │ 9. HTTP 500 → unavailable  → status=unavailable
  OK   │ 10. límite de 1 consulta/segundo respetado entre dos búsquedas  → 2201ms
  OK   │ 11. presupuesto de 5 s con cancelación  → status=unavailable, 5006ms
  OK   │ 12. interruptor ON → unavailable, cero pedidos  → pedidos=0
  OK   │ 12b. se evalúa antes de la caché
  OK   │ 13. interruptor ausente → comportamiento por defecto
  OK   │ 14. umbral de distancia sigue en pie (centro → found)

TODAS LAS COMPROBACIONES PASARON
```

La comprobación **5** es la que registra el cambio de comportamiento: antes ese caso disparaba un segundo intento, ahora `not_found` es final.

---

## 6. Verificación: los tres comandos

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
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 7.7s
  Running TypeScript ...
  Finished TypeScript in 8.5s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (19/19) in 1189ms
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
**exit code: 0**

### Comparación contra el baseline

| Métrica | Baseline | Ahora | Veredicto |
|---|---|---|---|
| Errores de TypeScript | 0 | **0** | idéntico |
| Errores de lint | 0 | **0** | idéntico |
| Warnings de lint | exactamente 1 (`watch()` en `PropertyForm`) | **exactamente 1**, el mismo, en `PropertyForm.tsx:269` | idéntico |
| Rutas del build | 19 | **19** | idéntico |

**Idéntico en las cuatro.** Nota sobre el warning: se sacó una llamada a `watch()` de `PropertyForm` (la del barrio, que quedaron cinco), y el warning no se movió ni de línea ni de cantidad — la regla reporta una sola vez por componente, en la primera llamada (`watch("currency")`, línea 269).

---

## 7. Decisiones que se apartan de las instrucciones

**a) Bajé `sanitizeQueryText` de export a función privada del módulo.** No me lo pediste explícitamente, pero sí pediste releer el orquestador y sacar "comentarios que describen un comportamiento que ya no existe". Su comentario decía *"Se exporta porque la ruta valida la entrada con esto mismo antes de llamar"*, y eso era falso: la ruta nunca la importó (importaba los dos envoltorios) y ahora importa uno solo. Era superficie pública sin consumidor, justificada por un consumidor inexistente. La dejé privada y corregí el comentario. `tsc` confirma que nadie la usaba desde afuera.

**b) Corregí los datos del caso medido en el comentario, respecto de cómo venían en el enunciado.** El comentario del código dice ahora "otra ciudad a 158 km (Añatuya)" en vez de "otra provincia", y "Cabildo → no encuentra nada" en vez de "encuentra bien", porque es lo que devolvió Nominatim cuando lo reproduje. Un comentario cuyo único trabajo es impedir una regresión pierde autoridad si sus números no aguantan una verificación. La conclusión es la misma y más fuerte.

**c) Dejé una advertencia corta en `GeocodeQuery`** (`types.ts`) además del comentario largo en el orquestador: *"⚠ NO agregar el barrio acá"*, con puntero al porqué. Motivo: el tipo es el lugar donde alguien iría a agregar el campo, y el comentario largo está en otro archivo. Son tres líneas, no duplican la explicación.

**d) Puse punteros al comentario canónico desde `nominatim.ts`, `route.ts` y `PropertyForm.tsx`,** en vez de repetir la explicación. La explicación completa vive en un solo lugar (`geocodeAddress`); los demás archivos dicen "el barrio no va, ver ahí". Ya se agregó dos veces: el que lo encuentre por cualquiera de las cuatro puertas tiene que llegar a la medición.

---

## 8. Restos que encontré y no pude sacar

**Ninguno en el camino de geocodificación.** El `grep` de `neighborhood` sobre `src/lib/geocoding/`, `src/app/api/geocode/` y `AddressSearchButton.tsx` devuelve **0 ocurrencias de código** (solo quedan las menciones en comentarios, que están ahí a propósito).

Tres cosas que quedan anotadas, ninguna es un resto de esta tarea:

1. **El límite de 1/s y la caché siguen siendo por proceso.** Sin cambios. La buena noticia de esta tarea es que **el peor caso mejoró**: al desaparecer la cascada, una búsqueda vuelve a consumir como máximo **un** turno en vez de dos.

2. **El barrio sigue participando del filtro del mapa público** (`useProperties.ts:76-77`, `filters.neighborhood` con un `ilike`). Eso **no** es geocodificación: filtra contra el texto que la propia agencia cargó en su propia base, así que el problema de "OSM lo llama distinto" no aplica. No se tocó y no debería tocarse.

3. **`location_source` no distingue si una sugerencia salió de una consulta con barrio o sin él.** Las propiedades cargadas mientras el barrio participaba pueden tener un `suggested` cuya coordenada vino de una consulta peor. Son datos de prueba y hoy no hay ninguna propiedad real cargada, así que no hay nada que corregir; lo dejo dicho por si al analizar los primeros datos reales aparece algo raro en las cargas viejas.
