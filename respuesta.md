# Cierre documental de C2 y D2 — informe

Solo documentación: modifiqué **`CLAUDE.md`** y **`PENDIENTES.md`**, y nada más. No toqué `src/`,
`scripts/`, el archivo de migración ni `DESIGN.md`. **No ejecuté ningún comando de git** ni SQL de
escritura.

Documenté **desde el código y desde la base**, no desde el prompt. Lo que medí y no coincidía está
en §6.

---

## 1. CLAUDE.md — qué agregué, modifiqué y corregí

### Agregado (4 secciones nuevas + 3 trampas)

| Sección | Qué documenta |
|---|---|
| **Página pública de la propiedad — `/propiedades/[slug]`** | La ruta y **por qué el prefijo no es opcional**; los tres estados con su tabla; los **dos motivos medidos** del service role; la regla de cobro por RPC; qué muestra y las dos cosas que la separan del modal (galería sin JS, descripción completa) |
| **Quién publica — el bloque de la agencia y el agente** | Las tres cosas que muestra, el caso sin logo (con el número medido), por qué el nombre no es enlace, por qué va hermano del ternario, y las dos trampas de tipos y de columnas |
| **Las dos puertas a la ficha, y por qué son distintas** | La tabla modal/tarjeta con el motivo de cada una, incluido **por qué en el modal el título NO es enlace** |
| **Infraestructura de buscadores** | `sitemap.ts` con `force-dynamic` y su cita textual, el mismo criterio que la página, `robots.ts`, `metadataBase`, y por qué no hay `opengraph-image` |

Las **tres trampas** van dentro de "Viewport mobile — altura y lock de scroll", que es donde ya
vivía la regla del scroll:

1. **Trampa 1 — la regla ya estaba escrita y aun así se incumplió.** Con el caso concreto (la
   página nueva nació con el contenido inalcanzable), la tabla `min-h-dvh` ❌ vs
   `h-dvh overflow-y-auto` ✅, la forma exacta de `AuthLayout`, y el patrón de **dos** elementos
   para las pantallas que centran (`min-h-full` en el hijo, **nunca** `min-h-dvh`).
2. **Trampa 2 — el presupuesto de alto de la zona inferior del modal.** Con el desglose de los
   129,5 px y la tabla: **≈177 px** de área scrolleable hoy en un iPhone SE, **≈123 px** si se le
   suma un botón. Es el número contra el que juega quien quiera agregar algo ahí.
3. **Trampa 3 — la tarjeta tiene un enlace adentro de algo clickeable.** Con la tabla de las **dos
   partes** (puntero → `stopPropagation`; teclado → la guarda `e.target !== e.currentTarget`) y por
   qué quedarse en la primera es el error fácil.

### Modificado

- **El párrafo de "Estado"**: se agregan las dos piezas cerradas, con el aviso explícito de que
  **el grupo NO está cerrado** porque falta C3.
- **El baseline**: 19 → **22 rutas**, con la justificación de las tres nuevas.
- **La estructura de carpetas**: las 3 rutas nuevas, los 5 componentes nuevos, los 4 utils nuevos,
  y las descripciones de `PropertyModal` y `PropertyCard` actualizadas.
- **La tabla de Decisiones de Arquitectura**: **11 filas nuevas** (prefijo, service role, RPC, el
  no-404, la galería, el mapa estático, la foto real, `force-dynamic`, la variable que corta, las
  dos extracciones y las dos puertas).

### Corregido (afirmaciones que las dos piezas dejaron falsas)

| Dónde | Decía | Dice ahora |
|---|---|---|
| "La consulta sobrevive al agente" | *"el **único** camino que crea consultas… (el modal del mapa inserta…)"* | **Son DOS** desde el 8 sep (modal y página), los dos por `registerLead` — que es justamente por qué se extrajo |
| "El registro de la consulta NO puede bloquear al visitante" | *"El `insert` de `leads` en **`PropertyModal.handleSendWA`**"* | El insert **ya no vive ahí**: se extrajo a `registerLead.ts`, con la tabla de las cuatro decisiones y dónde vive cada una |
| "Visibilidad pública" → por qué policy | *"Hay **DOS** caminos públicos…"* (implicando que la policy los cubre a todos) | Se agrega el punto que faltaba: **el service role saltea las policies**, y hoy hay **tres** lugares que no cubren (`resolveAgencyBySlug`, `resolvePropertyBySlug`, `sitemap.ts`). Los tres invocan la misma función por RPC |
| "Mapa — performance" | *"El modal usa `select("*")` y hereda las columnas solas"* | …más los embeds de imágenes, agente **y agencia** (esta con solo dos columnas nombradas) |
| Baseline | 19 rutas | 22, más la nota del **ruido de `.next/**/validator.ts`** que ya mordió una vez |

### Verificado y ya estaba bien

**`NEXT_PUBLIC_SITE_URL`** está en la sección de variables de entorno con todo lo necesario: que es
requerida, el formato sin barra final, quién la lee, que `siteUrl.ts` **lanza** si falta, y el
párrafo aparte que explica por qué corta en vez de caer a `localhost` y por qué no se usa
`VERCEL_URL`. **No le faltaba nada; no la toqué.**

---

## 2. PENDIENTES.md — qué cerré, abrí y ajusté

### Cerrado (2)

**C2 · Página + link por propiedad — HECHA (7–8 sep 2026).** Con la tabla de **lo que se descartó**
que el prompt pedía registrar, cada uno con su motivo medido:

| Descartado | Motivo |
|---|---|
| Leer con el client de servidor | Los tres estados indistinguibles + el OR de las policies permissive |
| Reescribir la regla de cobro en TS | La dejaría en **tres** lugares |
| Mapa interactivo con `ssr: false` | Buscador ve vacío + arrastra Leaflet. **En su lugar**: `StaticMap`, grilla 4×2 de tiles OSM en `<img>` con CSS, cero JS |
| Generar imagen para la vista previa | Suma ruta, build y otra fuente de verdad, para mostrar algo **peor** que la foto de la casa |
| El carrusel del modal para la galería | Deja **una sola foto** en el HTML |

Más la tabla de **las dos extracciones** (`AMENITY_ICONS` y el insert de la consulta) con por qué
esas dos y no más, y por qué los seis bloques restantes se reescribieron. Y los dos cabos que ató:
la nota de V2 sobre el enlace en Consultas, y la revisión que pedía la deuda del texto libre.

**D2 · Mostrar la agencia en el modal — HECHA (7 sep 2026).** Salió como el ítem se inclinaba (embed
en la consulta del modal, sin tocar `useProperties`). Registré **dos cosas que el ítem daba por
ciertas y no lo eran** — están en §3.

### Abierto (5)

Verifiqué cada uno en el código antes de escribirlo:

1. **Dos pantallas más dependen del scroll del documento.** Con la tabla de las dos, sus líneas
   exactas y sus wrappers: `AgencyUnavailable.tsx:10` (`flex min-h-dvh …`) y
   `(public)/page.tsx:86` (`h-dvh …` sin `overflow-y-auto`). Anoté que **la primera la propagué yo**
   al clonar el componente, y que el arreglo está probado en el clon.
2. **No hay pantalla propia de "página inexistente".** Verificado: cero `not-found.tsx` y cero
   `error.tsx` en `src/app`. Anoté que **se nota más ahora**, porque la página nueva hace 404 de
   verdad como uno de sus tres estados.
3. **La tarjeta tiene un elemento interactivo anidado dentro de otro.** Con las líneas (`:88` el
   `role="button"`, `:134` el favorito, `:190` el enlace), que **ya era así antes**, que las dos
   acciones sí conviven en la práctica, y que la salida limpia es una decisión de diseño.
4. **El slug es un sufijo aleatorio sin reintento y ahora es dirección pública permanente.** Con el
   código citado, la verificación de que no hay `while`/`retry`/`catch`, la **probabilidad real
   calculada** (≈2.176 millones de combinaciones por título base, y el choque solo entre títulos
   idénticos) y lo que sí conviene hacer: **traducir el `23505`**, que hoy cae al mensaje genérico.
5. **Limpieza de datos antes del lanzamiento** — puesto en el **calendario**, no en deuda técnica,
   como pedía el prompt. Con la tabla de los cinco títulos de relleno que hoy se ofrecerían y sus
   direcciones.

### Ajustado

- **Encabezado del archivo**: última actualización 8 sep 2026, con el aviso de que **el grupo no
  está cerrado**.
- **C3 sigue abierta**, actualizada con dos cosas medidas: que el botón está en **dos** archivos
  (`(public)/page.tsx` y `AgencyMapView.tsx`), y que **la oportunidad creció** — con C2 cerrada va a
  entrar gente por Google directo a una ficha, y ese encabezado tampoco le habla a nadie.
- **Calendario**: cifras re-medidas (10/18/10/**10**/7) + el dato de **1 agencia con logo**.
- **Baseline de la deuda técnica**: 19 → 22 rutas con la justificación.
- **V2**: "Página SEO por propiedad" tachada como hecha, y el enlace en Consultas **separado como
  ítem propio** — con las dos cosas que hay que decidir antes (qué pasa si la propiedad está
  pausada, y que `leads` no trae el `slug`).
- **Deuda del texto libre de requisitos**: la revisión que pedía **ya se hizo y no encontró nada**;
  el ítem queda abierto porque lo que importa es la regla, no la revisión.
- Tres cifras de datos re-medidas (5 de 18 sin precio, 3 de 18 doble operación, 18 filas).

---

## 3. Afirmaciones falsas que encontré

**En la documentación (corregidas):**

1. **"El `insert` de `leads` en `PropertyModal.handleSendWA`"** — ya no vive ahí.
2. **"El único camino que crea consultas"** — son dos.
3. **"Hay DOS caminos públicos que leen propiedades con la anon key"** — sigue siendo cierto, pero
   faltaba lo importante: hay **tres** que leen con **service role**, a los que ninguna policy cubre.
4. **"El modal usa `select("*")` y hereda las columnas solas"** — incompleto desde el embed.
5. **Baseline de 19 rutas** — son 22.
6. **V2: "Página SEO por propiedad" como pendiente** — está hecha.
7. **La deuda del texto libre: "revisar cuando se haga C2"** — C2 ya se hizo.

**En los ítems que cerré (registradas dentro del cierre):**

8. **D2 decía "en el white-label NO va".** Se decidió lo contrario: **sí se muestra también ahí**,
   porque quien abre un enlace compartido cae directo en el modal y el encabezado puede quedar fuera
   de vista. **Y la consecuencia fue la mejor de la pieza**: no hizo falta construir ningún canal
   para que el modal supiera en qué contexto se renderiza, que era el trabajo más caro.
9. **D2 daba por sentado que el modal mostraba al agente.** No lo mostraba: traía `full_name` y
   `avatar_url` y **no renderizaba ninguno**. La pieza terminó agregando dos identidades, no una.

---

## 4. Los números que medí

**Base de datos (8 sep 2026):**

| | Valor | Nota |
|---|---|---|
| Agencias | **10** | **1 sola con logo** — el caso "sin logo" es el normal |
| Propiedades | **18** | 17 activas |
| Ofrecidas hoy en `/sitemap.xml` | **16** | la 17ª activa es de una agencia en plan `free` |
| Agentes | **10** | 1 por agencia |
| Consultas | **10** | venía de 9 el 7 sep |
| Imágenes | **7** | solo 7 propiedades tienen alguna foto |
| Doble operación | **3** de 18 | |
| Sin precio en alguna operación | **5** de 18 | |
| Títulos de relleno inequívocos entre las ofrecidas | **5** | `fsdfsdfsdf`, `nueva propiedad 1/2/3`, `casa prueba22` |

**Código:**

| | Valor |
|---|---|
| Policies de SELECT sobre `properties` | **3**, las tres PERMISSIVE (se combinan con OR) |
| Caminos que leen propiedades con service role | **3**, los tres invocan el RPC |
| Columnas del embed de agencia | **2** (`name`, `logo_url`) |
| Zona inferior del modal | **129,5 px** |
| Área scrolleable en un iPhone SE | **≈177 px** (≈123 con un botón más) |
| Pantallas con el defecto de scroll sin corregir | **2** |
| `not-found.tsx` / `error.tsx` propios | **0** |
| Combinaciones del sufijo del slug | 36⁶ ≈ **2.176 millones** por título base |
| Reintentos ante colisión de slug | **0** |

---

## 5. Los tres comandos

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
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully
  Running TypeScript ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (20/20)
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

**Contra el baseline: idéntico.** 0 errores de TS, 0 errores de lint con el mismo warning único en
`PropertyForm.tsx:808:30`, build verde, **22 rutas** contadas una por una del listado. Esta tarea
tocó solo archivos `.md`, así que nada podía moverse — y no se movió.

---

## 6. Lo que el prompt afirma y no coincidió con lo medido

**Nada del prompt resultó falso.** Cuatro precisiones sobre cosas que el prompt daba de una forma y
la medición dio de otra, todas menores:

**a) "Hay al menos dos pantallas más con el mismo defecto de scroll".** Son **exactamente dos**
(`AgencyUnavailable.tsx:10` y `(public)/page.tsx:86`), y las dos tienen matices que anoté: la
primera es el **original del que cloné** el componente que sí corregí, y la segunda tiene `h-dvh`
bien puesto y solo le falta el `overflow-y-auto`. Además apareció un **tercer** caso relacionado que
no es una pantalla nuestra: el 404 del framework, que es el ítem siguiente.

**b) "Los datos de prueba se ofrecen a los buscadores".** Cierto, con una salvedad que cambia la
urgencia: **hoy no se ofrecen a nadie**, porque `NEXT_PUBLIC_SITE_URL` apunta a `http://localhost:3000`
y el mapa del sitio publica direcciones de localhost. **El riesgo empieza el día que esa variable
apunte al dominio real**, y lo dejé escrito como el disparador.

**c) "El identificador se genera con un sufijo aleatorio sin reintento… anotá el riesgo con su
probabilidad real".** Lo hice, y **la probabilidad real es despreciable** (≈2.176 millones de
combinaciones por título base, y el choque solo puede ocurrir entre títulos idénticos ya
normalizados). Lo escribí así, con el número, para que nadie sobre-reaccione: **lo que sí conviene
arreglar no es la generación sino el mensaje** — el `23505` cae hoy al error genérico.

**d) "La tarjeta tiene un elemento interactivo anidado… ya era así antes de esta tanda".** Confirmado
y matizado: el **botón de favorito** ya estaba anidado, sí, pero el **enlace del título** lo agregó
esta tanda. O sea que la tanda no introdujo el problema pero sí lo duplicó, y eso queda dicho en el
ítem.

**Y una cosa que el prompt no mencionaba y merece quedar acá:** midiendo encontré un **ruido de
herramienta** que ya hizo perder tiempo una vez y que ahora está documentado en el baseline de
`CLAUDE.md`. `tsconfig.json` incluye `".next/types/**/*.ts"` y `".next/dev/types/**/*.ts"`, o sea
artefactos generados: si se mezclan los de `next dev` con los de `next build`, `tsc` escupe decenas
de errores en `.next/**/validator.ts` que **no son del proyecto**. La regla que dejé escrita: si los
errores no están en `src/` ni en `scripts/`, borrar `.next` y repetir.
