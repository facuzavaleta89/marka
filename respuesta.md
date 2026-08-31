# Informe — Documentación de la sugerencia de ubicación (geocodificación)

> Tarea de documentación. Solo se modificaron archivos `.md`. No se tocó código fuente,
> no se ejecutó ningún comando de git ni ningún SQL de escritura. La base se leyó por MCP
> (solo lectura). Fecha del relevamiento: 31 ago 2026.

---

## 1. Lo relevado (Paso 1)

### a. Archivos nuevos de la feature

Todos salieron del commit `5c0115c` ("feat: sugerir ubicación desde la dirección y arreglar
la confirmación del pin"), mergeado en `eafa72d` (PR #10).

**Módulo de geocodificación — `src/lib/geocoding/` (server-only, 3 archivos):**

| Archivo | Qué hace |
|---|---|
| `types.ts` | Contrato **genérico**: `GeocodeQuery`, `GeocodeCandidate`, `GeocodeProvider`. Es la costura de cambio de proveedor: nada específico de Nominatim puede aparecer acá. Reglas del contrato: `null` = "respondió y no hay resultado utilizable" (no es error); cualquier falla se **lanza**; el `signal` es el presupuesto de tiempo de toda la operación. Ya lleva un `⚠ NO agregar el barrio acá` explícito |
| `nominatim.ts` | **Único archivo del repo que sabe qué es Nominatim**: URL (`/search`), parámetros (`q`, `format=jsonv2`, `limit=1`, `addressdetails=0`, `viewbox`, `accept-language=es`), User-Agent, armado del `viewbox` (sesgo, **sin `bounded=1`** a propósito) y parseo defensivo de la respuesta. En la cabecera lleva el enlace a la política y el reparto de qué obligación se cumple dónde |
| `index.ts` | Orquestador. Presupuesto de tiempo, limitador de 1 consulta/s, caché con TTL, descarte por distancia, sanitización de entrada y salida, y el interruptor de simulación de caída. Expone `geocodeAddress()` (**nunca lanza**) y `sanitizeAddress()`. Contiene la línea `const provider = nominatimProvider`, la única referencia al proveedor en todo el repo, y el comentario largo con la medición del barrio |

**Ruta de API:**

| Archivo | Qué hace |
|---|---|
| `src/app/api/geocode/route.ts` | `POST /api/geocode`. Cuatro pasos: (1) **gate de sesión propio** con `resolveAgentSession()` → 401 (usa `resolveAgentSession`, no `requireAgentSession`, porque un route handler responde un código, no redirige); (2) cuerpo ilegible → 400; (3) la **ciudad la deriva el servidor** vía `getAgencyCity(session.agent.agency_id)`; (4) llama a `geocodeAddress` y devuelve `GeocodeResponse`. Nunca devuelve el error crudo del servicio externo |

**Utilidades nuevas:**

| Archivo | Qué hace |
|---|---|
| `src/lib/utils/coords.ts` | `Coords`, `roundCoord`/`roundCoords` (**7 decimales, único redondeo del proyecto**) y `distanceKm` (equirectangular con corrección del ancho del grado de longitud por latitud). Sin dependencias: lo usan servidor y cliente |
| `src/lib/utils/getAgencyCity.ts` | Ciudad de una agencia (id, nombre, provincia, país, centro) para armar la consulta. Server-only, client normal (no service role: `cities` y `agencies` tienen lectura pública) |

**Interfaz:**

| Archivo | Qué hace |
|---|---|
| `src/components/properties/AddressSearchButton.tsx` (nuevo) | Botón "Buscar esta dirección en el mapa". `fetch` a `/api/geocode` desde el `onClick` **y solo desde ahí**. Timeout propio de cliente, cualquier respuesta ≠ 200 se trata como `unavailable`, y el mensaje se esconde solo si el agente edita la dirección (`staleResult`, que **no** dispara búsquedas) |
| `src/components/properties/LocationPicker.tsx` (reescrito) | Pasó a **componente controlado**: `value` es la fuente de verdad y ya no guarda copia. `onChange(coords, cause)` con `cause: "drag" \| "center"`. Efecto que recentra + pulsa cuando la posición llega de afuera, sin ningún camino de escritura hacia el padre (no puede realimentarse) |
| `src/components/properties/PropertyForm.tsx` (modificado) | Dueño único de la confirmación (`locationConfirmed`) y del `locationSource`. Monta el botón de búsqueda, aplica la sugerencia, y bloquea el submit si la ubicación no está confirmada |
| `src/lib/utils/labels.ts` | `GEOCODE_STATUS_MESSAGES`: un mensaje por desenlace |
| `src/types/index.ts` | `LocationSource`, `GeocodeStatus`, `GeocodeResponse` (unión discriminada) y `location_source` en `Property` |
| `src/app/(agent)/dashboard/propiedades/actions.ts` | `normalizeLocationSource`: todo lo que no sea exactamente `'suggested'` se guarda como `'manual'` |

### b. Variables de entorno

| Variable | Obligatoria | Ámbito | Notas |
|---|---|---|---|
| `GEOCODING_USER_AGENT` | **No**, pero **hay que setearla en producción** | Server-side (sin `NEXT_PUBLIC_`) | La política exige un User-Agent propio que permita contactar. Si falta, se usa `"Marka/1.0 (marketplace inmobiliario; https://marka.com.ar)"`, que identifica la app pero **no lleva dirección de contacto**. Se dejó un default en vez de fallar a propósito: la feature es un atajo, y quedarse sin atajo por una variable sin setear sería peor. Está presente en el `.env.local` de este repo |
| `GEOCODING_SIMULATE_OUTAGE` | No | Server-side | **Uso local únicamente, NUNCA en producción.** Ausente / vacía / `"0"` / `"false"` = apagado; cualquier otro valor la enciende. **No está en el `.env.local` actual** |

Ninguna de las dos es necesaria para que la app arranque. Las que sí hay que configurar en
producción son las que ya estaban (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`,
`ADMIN_USER_ID`) más `GEOCODING_USER_AGENT`.

### c. Valores concretos (leídos del código, no supuestos)

| Constante | Valor | Dónde |
|---|---|---|
| `GEOCODE_TIMEOUT_MS` | **5.000 ms** (presupuesto TOTAL: espera del cupo + red) | `lib/geocoding/index.ts` |
| `MIN_REQUEST_INTERVAL_MS` | **1.100 ms** (el límite es 1/s; 100 ms de margen de reloj) | `lib/geocoding/index.ts` |
| `CACHE_TTL_MS` | **24 h** (`24 * 60 * 60 * 1000`) | `lib/geocoding/index.ts` |
| `MAX_CACHE_ENTRIES` | **500** (desaloja la entrada más vieja) | `lib/geocoding/index.ts` |
| `CITY_RADIUS_KM` | **25 km** | `lib/geocoding/index.ts` |
| `MAX_ADDRESS_LENGTH` / `MAX_LABEL_LENGTH` | **200 / 120** caracteres | `lib/geocoding/index.ts` |
| `COORD_DECIMALS` | **7** (≈ 1 cm) | `lib/utils/coords.ts` |
| `CLIENT_TIMEOUT_MS` | **8.000 ms** (techo del cliente, por encima del servidor) | `AddressSearchButton.tsx` |
| `SUGGESTION_ZOOM` / `CITY_ZOOM` | **16 / 15** | `LocationPicker.tsx` |

Matiz de la caché que no estaba en el contexto y sí en el código: **es por desenlace**.
`found`, `not_found` y `out_of_city` se guardan; **`unavailable` nunca** (cachear una caída
de un minuto dejaría el atajo roto 24 horas).

### d. Columna nueva de `properties` (medida por MCP)

```
column_name      | data_type | is_nullable | column_default
location_source  | text      | YES         | (ninguno)

properties_location_source_check:
  CHECK ((location_source IS NULL) OR (location_source = ANY (ARRAY['manual'::text, 'suggested'::text])))
```

Nullable y sin default: las propiedades cargadas antes de la feature no lo tienen. De las 12
propiedades de la base, **2** tienen valor. El CHECK admite `NULL` explícitamente.

También se midió `cities`, para verificar el supuesto del umbral de distancia: sus columnas
son `id, name, slug, province, country, center_lat, center_lng, default_zoom, is_active,
created_at` — **no hay ningún límite geográfico**, solo el punto central y el zoom. El
supuesto documentado es correcto.

### e. Baseline

| Comando | Exit code | Resultado |
|---|---|---|
| `npx tsc --noEmit` | 0 | Sin salida (0 errores) |
| `npm run lint` | 0 | **0 errores, 1 warning** — `react-hooks/incompatible-library` en `PropertyForm.tsx:269` |
| `npx next build` | 0 | Verde, **19 rutas** |

**Dos números de la documentación quedaron desactualizados y se corrigieron:** el warning
está en `PropertyForm.tsx:**269**` (la documentación decía `:232`; es el mismo warning, el
archivo creció con la confirmación de ubicación) y el build tiene **19 rutas**, no 18 (la
nueva es `/api/geocode`).

---

## 2. Archivos de documentación modificados

### `CLAUDE.md`

1. **Baseline del encabezado:** `PropertyForm.tsx:232` → `:269`; 18 → **19 rutas**.
2. **Párrafo de la hoja de ruta de modelo:** la sugerencia de ubicación pasó de "pendiente"
   a la lista de "ya aplicado", nombrando el ítem D1.
3. **Estructura de carpetas:** se agregaron `src/app/api/geocode/route.ts` (como hermano de
   los route groups, con la nota de que el proxy no la cubre), `AddressSearchButton.tsx`,
   la carpeta `lib/geocoding/` con sus tres archivos, y `lib/utils/coords.ts` +
   `getAgencyCity.ts`. La línea de `LocationPicker.tsx` dejó de decir "Pin manual (NO
   geocoding)" y ahora dice que es **controlado** y que emite la causa del cambio.
4. **Sección "Ubicación — pin manual" → reescrita como "Ubicación de la propiedad — pin
   manual + sugerencia desde la dirección"** (es el grueso del trabajo). Contiene:
   - Un párrafo de apertura destacado: **la regla no se derogó, se refinó** — sigue sin haber
     geocodificación automática, el pin manual sigue siendo la fuente de verdad, y la
     sugerencia es un punto de partida opcional que no confirma nada.
   - El flujo completo en 6 pasos, del botón al pin, con los cuatro desenlaces.
   - **Tabla de obligaciones de la política de Nominatim**, con el enlace, presentadas como
     restricciones que el código tiene que seguir cumpliendo y con el archivo donde se
     cumple cada una. Incluye la advertencia de que la política puede cambiar sin aviso y
     que advierte específicamente a las aplicaciones comerciales.
   - Por qué la llamada sale del servidor; por qué la ruta tiene gate propio (con el detalle
     del `POST` redirigido que devolvería HTML con **200** y el cliente leería como éxito);
     por qué la ciudad la resuelve el servidor.
   - **Cómo se cambia de proveedor:** los dos pasos concretos, con el nombre del archivo a
     escribir, las reglas del contrato y **la línea exacta** (`const provider =
     nominatimProvider;` en `src/lib/geocoding/index.ts`).
   - **La regla del barrio**, como sub-sección con título en mayúsculas ("⚠ EL BARRIO NO
     PARTICIPA DE LA BÚSQUEDA. NO LO VUELVAS A AGREGAR"), con la tabla de los cuatro casos
     medidos y los números reales (0,9 km / Añatuya / 158 km).
   - La **regla nueva de confirmación**, con tabla de qué confirma y qué desconfirma, el bug
     que cierra (que existía sin geocodificador), y qué pasa al editar.
   - Por qué `LocationPicker` pasó a controlado, y por qué `roundCoord` es load-bearing.
   - "La feature es un ATAJO, nunca un requisito", con las cuatro capas que lo garantizan.
   - **Tabla de valores** que gobiernan el comportamiento, con el porqué de cada uno, más el
     supuesto explícito del umbral de 25 km.
   - El **interruptor de prueba**, con su advertencia de producción.
   - La **columna `location_source`**, con tipo, nullability, CHECK y el aviso de que no
     gatea nada.
5. **Tabla de la base de datos:** la fila de `properties` menciona `location_source`; la de
   `cities` deja anotado que **no tiene límites geográficos** (que es la razón del umbral).
6. **Tabla "Decisiones de Arquitectura":** la fila "Pin manual sin geocoding" se reemplazó
   por una que refleja el modelo nuevo, y se agregaron **siete filas**: búsqueda por botón,
   llamada desde el servidor, gate adentro del handler, el barrio fuera de la consulta, la
   regla de confirmación, el picker controlado y `location_source` que no gatea nada.
7. **Variables de entorno:** el bloque ya las tenía (las agregó el commit de la feature); se
   sumó debajo una línea que aclara cuál hay que setear en producción y cuál no debe existir.

### `DESIGN.md`

- **§11 · LocationPicker** reescrita como "LocationPicker (pin manual en el formulario) +
  sugerencia desde la dirección": diagrama actualizado con el botón de búsqueda, el botón
  "Centrar" y el de confirmación; la nota de que **ambos botones son secundarios y nunca
  terracota** (el terracota está reservado para el CTA de publicar); la voz de los mensajes
  de los cuatro desenlaces (§10); el pulse del pin.
- **§11 · Estados de validación:** la condición pasó a ser "guardar sin **confirmar**", con
  el texto real del mensaje de error, más el resumen de qué confirma y qué desconfirma.

### `PENDIENTES.md`

- Fecha de última actualización → 31 ago 2026, con el motivo.
- Calendario de lanzamiento: la autosugerencia figuraba como algo que "sube" de prioridad;
  ahora aclara que **ya está hecha**.
- **D1 marcado `[x]` con su cierre**, incluyendo que la trampa anotada era más grande de lo
  que el ítem creía (la regla vieja ya estaba rota sin geocoder) y la regla del barrio.
- **Tres ítems nuevos de deuda técnica** (Paso 3): limitador y caché en proceso, ciudades sin
  límites geográficos, y el módulo como candidato a estrenar pruebas automatizadas.
- Baseline de la sección de deuda técnica actualizado (269 / 19 rutas).
- Conteos de la base corregidos (ver punto 4).

### `PLAN-ORIGINAL.md`

- Una sola línea: la del árbol que describía `LocationPicker` como "(NO geocoding)" quedó
  marcada como desactualizada, con puntero a `CLAUDE.md`. El archivo entero sigue estando
  globalmente desactualizado y ya tiene su ítem propio en `PENDIENTES.md`; no se reescribió.

### No se tocaron

`README.md` (es el boilerplate de `create-next-app`, no documenta el proyecto) y `AGENTS.md`
(regla de Next.js, ajena a esto).

---

## 3. Diferencias entre el contexto dado y lo medido en el código

El contexto era **exacto en todo lo sustantivo**. Las diferencias son de detalle, y en todos
los casos ganó lo medido:

1. **El nombre del barrio mapeado.** El contexto decía que OpenStreetMap mapea "Mitre 291"
   en el barrio *"Parque"*. El comentario del código dice **"Barrio Parque Aguirre"**, y en
   su tabla de mediciones el caso probado es el barrio escrito como `"Parque"`. Se documentó
   como está en el código: `"Parque"` es lo que se le mandó al servicio, "Parque Aguirre" es
   el nombre completo del barrio en OSM. No cambia nada del argumento.
2. **La medición tiene cuatro casos, no dos.** El contexto describía "sin barrio" vs.
   "Centro". El código registra **cuatro**: sin barrio (0,9 km ✅), `"Parque"` (0,9 km ✅),
   `"Cabildo"` (no encuentra nada) y `"Centro"` (Añatuya, 158 km ❌). El tercer caso agrega
   un matiz que vale la pena: un barrio equivocado **también** puede tapar la dirección sin
   devolver nada. Se documentaron los cuatro.
3. **Un motivo extra por el que el barrio se sacó**, que el contexto no mencionaba: el
   módulo tenía una **cascada de dos intentos** que solo reintentaba ante "no encontré nada",
   y el caso del barrio "Centro" no devuelve vacío — o sea, la cascada no cubría el único
   caso para el que se había construido. Quedó documentado.
4. **La caché es por desenlace.** El contexto decía "cachear los resultados". El código
   distingue: `found`/`not_found`/`out_of_city` se guardan, **`unavailable` nunca**. Es un
   detalle load-bearing (cachear una caída fijaría el atajo roto por 24 h) y se documentó.
5. **Hay dos timeouts, no uno.** 5 s en el servidor (presupuesto total: espera del cupo +
   red) y **8 s en el cliente**, por encima, para que la interfaz se recupere sola si la
   ruta propia no responde. El contexto hablaba de "tiempo máximo de espera" en singular.
6. **La feature arregló un tercer bug que el contexto no menciona:** el mini-mapa abría
   siempre en el centro de la ciudad, también al **editar**, así que una propiedad alejada
   del centro abría la cámara mirando otro lado y el pin podía quedar fuera del recuadro de
   280 px. Ahora abre donde está el pin. Documentado en `DESIGN.md` y en `CLAUDE.md`.
7. **El botón de la interfaz no se llama como decía la hoja de ruta.** `PENDIENTES.md`
   anticipaba `"Ubicar dirección aproximada"`; el texto real es **"Buscar esta dirección en
   el mapa"**. Se documentó el real.
8. **El "punto 4" del contexto, matizado.** Es cierto que la ciudad se resuelve en el
   servidor por disciplina, pero además **hacía falta**: las dos páginas que renderizan el
   formulario leen `cities` con un select acotado a `center_lat, center_lng`, así que el
   nombre y la provincia nunca llegan al cliente. Se documentaron los dos motivos.
9. **El aviso de "aplicaciones comerciales" está en la política, no en el código.** El
   comentario de `nominatim.ts` enlaza la política y lista las obligaciones, pero no repite
   esa advertencia. Se documentó igual en `CLAUDE.md`, atribuida a la política, porque es
   material para decidir si algún día hay que migrar a un proveedor pago.

---

## 4. Afirmaciones falsas encontradas en la documentación

Todas se corrigieron.

| Dónde decía | Qué decía | Qué se hizo |
|---|---|---|
| `CLAUDE.md` (baseline del encabezado y sección ESLint) y `PENDIENTES.md` (deuda técnica) | El warning conocido está en `PropertyForm.tsx:**232**` | Corregido a **`:269`** en los tres lugares, aclarando en `PENDIENTES.md` que es el mismo warning y que el archivo creció |
| `CLAUDE.md` (baseline) y `PENDIENTES.md` | Build verde con **18 rutas** | Corregido a **19** (la nueva es `/api/geocode`), con la nota de cuál se sumó |
| `DESIGN.md` §11 | "El mini-mapa **se centra al inicio en el `center_lat`/`center_lng` de la ciudad de la agencia**" | **Era falso desde este commit**: el mapa abre donde está el pin (centro de la ciudad en el alta, la propiedad en la edición). Reescrito, con la explicación del bug que arregla |
| `DESIGN.md` §11 | El mensaje de validación es "Colocá el pin en el mapa" | **Era falso**: ese texto no existe en el código. El mensaje real es *"Confirmá la ubicación antes de guardar: arrastrá el pin hasta el punto exacto, o buscá la dirección y confirmá la sugerencia."* Reemplazado por el literal |
| `DESIGN.md` §11 | El pin tiene `shadow-md` | Inexacto: la sombra es un `drop-shadow` sobre `.marka-loc-pin__inner` en `globals.css`, no la utilidad de Tailwind. Reescrito |
| `CLAUDE.md` (árbol) | `LocationPicker.tsx ← Pin manual (NO geocoding)` | Quedaba engañoso: seguía siendo cierto que no hay geocodificación automática, pero la línea suelta hacía parecer que el módulo nuevo incumple la regla. Reescrita para decir qué es hoy (controlado, emite causa) |
| `PENDIENTES.md` (calendario) | "todo lo cargado es de prueba: **10 agencias, 8 propiedades**" | Medido: **11 agencias, 12 propiedades**, 11 agentes, 1 ciudad. Corregido con la fecha de la medición |
| `PENDIENTES.md` (`current_period_end`) | "las **10** filas de la base están en `null`" | El *hecho* sigue siendo cierto (nadie escribe la columna), pero son **11** filas, todas en `null`. Corregido |
| `PENDIENTES.md` (multi-agente) | "las **10** agencias de la base tienen exactamente 1 agente cada una" | Son **11**, y el máximo de agentes por agencia sigue siendo **1**: el hecho de fondo se sostiene. Corregido el número |
| `PLAN-ORIGINAL.md` | `LocationPicker.tsx ← Pin manual en mini-mapa (NO geocoding)` | Marcado como desactualizado con puntero a `CLAUDE.md`. **No se reescribió el archivo**: ya está declarado globalmente obsoleto y tiene su propio ítem en `PENDIENTES.md` |

---

## 5. Salida de los tres comandos

Corridos **antes** (Paso 1) y **después** de documentar. **Resultado idéntico en las dos
pasadas.**

```
$ npx tsc --noEmit
(sin salida)
TSC_EXIT=0
```

```
$ npm run lint

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  269:20  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent
this, by default React Compiler will skip memoizing this component/hook. ...

  267 |   });
  268 |
> 269 |   const currency = watch("currency");
      |                    ^^^^^ React Hook Form's `useForm()` API returns a `watch()`
                                 function which cannot be memoized safely.
  270 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
  271 |   const lat = watch("lat");
  272 |   const lng = watch("lng");  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)

LINT_EXIT=0
```

```
$ npx next build
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local
✓ Compiled successfully in 9.7s
  Finished TypeScript ...
✓ Generating static pages using 3 workers (19/19)

Route (app)
┌ ○ /                                     ├ ƒ /dashboard/perfil
├ ○ /_not-found                           ├ ƒ /dashboard/preferencias
├ ƒ /[slug]                               ├ ƒ /dashboard/propiedades
├ ƒ /admin                                ├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /api/geocode        ← NUEVA           ├ ƒ /dashboard/propiedades/nueva
├ ○ /apple-icon.png                       ├ ƒ /dashboard/suscripcion
├ ƒ /dashboard                            ├ ƒ /login
├ ƒ /dashboard/equipo                     ├ ƒ /logout
├ ƒ /dashboard/leads                      ├ ƒ /register
                                          └ ƒ /register/plan

ƒ Proxy (Middleware)
BUILD_EXIT=0
```

**19 rutas** (18 anteriores + `/api/geocode`). `git status --porcelain` confirma que lo único
modificado son archivos `.md`: `CLAUDE.md`, `DESIGN.md`, `PENDIENTES.md`, `PLAN-ORIGINAL.md`
(más este informe). Ningún archivo de código fue tocado.

---

## 6. Lo que quedó sin tocar, y por qué

- **Todo el código fuente.** Es una tarea de documentación; ninguna de las cosas que
  encontré exigía tocar código. Verificado con `git status --porcelain`: solo `.md`.
- **Ningún comando de git.** Los cambios quedan en el working tree, sin `add`, `commit`,
  `branch` ni `push`.
- **Ningún SQL de escritura.** La base se leyó por MCP en solo lectura; no hay `ALTER` ni
  migración pendiente que dejar anotada (la columna `location_source` **ya está aplicada**,
  con su CHECK).
- **`supabase/migrations/20240101000000_initial_schema.sql`.** Es la fuente de verdad
  documentada del schema y `PENDIENTES.md` dice que se mantiene a mano contra la base real,
  pero **es un archivo `.sql`, no `.md`**, y la restricción de esta tarea es explícita.
  ⚠ **Queda pendiente y lo señalo acá:** habría que agregarle la columna `location_source`
  (`text`, nullable, con el CHECK `NULL OR IN ('manual','suggested')`) para que el archivo
  siga reflejando la base real.
- **`PLAN-ORIGINAL.md` más allá de una línea.** Está declarado globalmente desactualizado y
  su reescritura o jubilación ya es un ítem propio de `PENDIENTES.md`; reescribirlo dentro de
  esta tarea habría sido otro trabajo entero.
- **`README.md` y `AGENTS.md`.** El primero es el boilerplate de `create-next-app` y no
  documenta el proyecto; el segundo es una regla sobre Next.js, ajena a esta feature. Nota:
  que el README siga siendo boilerplate es un hueco real, pero no es de esta tanda.
- **Las sub-piezas B2b y C del white-label**, y el resto de la hoja de ruta: siguen como
  estaban, en pausa o pendientes. Lo único que se movió de estado es **D1**.
