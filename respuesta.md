# Documentación del cierre — grupo de coherencia del panel

> **Modo ejecución, solo documentación.** Se modificaron **dos** archivos: `CLAUDE.md` y
> `PENDIENTES.md`. **No se tocó `src/`, `scripts/`, el archivo de migración ni `DESIGN.md`.**
> **No se ejecutó ningún comando de git** ni SQL de escritura (las consultas a la base fueron
> lecturas por el MCP en modo solo lectura, que la Parte 2 d) pedía).
> **Fecha:** 12 sep 2026.

**Verificación de que no se tocó código.** Los ocho archivos de `src/` que aparecen como
modificados hoy comparten un timestamp **idéntico al segundo — 00:05:32 — y el mismo que
`respuesta.md` de la tanda anterior**, o sea una restauración del árbol, no ediciones mías:

```
00:05:32  src/app/(agent)/admin/actions.ts
00:05:32  src/app/(agent)/admin/AgenciesTable.tsx
00:05:32  src/app/(agent)/admin/page.tsx
00:05:32  src/app/(agent)/dashboard/suscripcion/actions.ts
00:05:32  src/components/dashboard/AgencyVisibilityNotice.tsx
00:05:32  src/components/dashboard/NewPropertyButton.tsx
00:05:32  src/components/dashboard/SubscriptionContent.tsx
00:05:32  src/lib/utils/getPublishBlock.ts
00:05:32  respuesta.md   ← el informe de la tanda anterior
### lo editado en ESTA tanda
00:13  CLAUDE.md
00:15  PENDIENTES.md
```

`DESIGN.md`, `scripts/` y `supabase/` no figuran: no se tocaron.

---

## 1. CLAUDE.md — qué agregué, modifiqué y corregí

### Agregado: tres secciones nuevas

**(a) `#### ⚠ UN PEDIDO DE PLAN ABIERTO SE DETECTA POR pending_plan, NUNCA POR status`**, dentro de
"Suscripciones y límites". Es **la regla más importante del grupo** y quedó documentada con:

- **Qué pasaba** y por qué (el pedido escribía `status: 'pending'`, la regla exige `'active'`).
- **La causa de fondo en una tabla:** los **dos sentidos incompatibles** de `'pending'` y por qué
  la regla de visibilidad solo puede asumir uno.
- **Los cinco lugares corregidos**, con la condición de antes y la de ahora (tabla).
- **Por qué se rompían a medias y en silencio:** los cinco **siguen funcionando** para el camino
  del registro, así que una prueba con una cuenta nueva los habría visto andar perfecto. Con la
  consigna: al probar este modelo hay que recorrer **los dos caminos**.
- **La guarda nueva** de `cancelSubscriptionAction`, con el porqué de su **posición** (después del
  chequeo de `free`, porque una agencia recién registrada tiene plan `free` **y** pedido a la vez).
- **La simetría resultante:** `canceled` + `pending_plan` está bloqueada por los dos lados.
- **⚠ Lo que NO se tocó y da ganas de tocar:** el `status: "active"` de `activatePlanAction`, que
  es un no-op para un upgrade pero es lo que saca del `'pending'` a una agencia nueva.

**(b) `### El cartel de visibilidad del panel — tres motivos, UNO SOLO a la vez`**, con:

- Dónde va y **por qué no en el layout compartido ni en `/dashboard/suscripcion`**.
- Los tres motivos con su componente, tono y título.
- **La garantía de "uno solo" en tres capas:** un solo `reason`; **en la estructura**, un ternario
  sobre él (que reemplazó a una condición suelta que podía dar verdadera a la vez); y **en los
  tipos**, el `Exclude<VisibilityBlockReason, "not_approved">` que hace que el motivo equivocado
  **no compile**.
- **`#### ⚠ LOS DOS HELPERS QUE PARECEN LO MISMO Y NO LO SON`**, con tabla comparativa y **las dos
  direcciones opuestas** en que falla usar el de publicación para la visibilidad (le SOBRA el cupo
  lleno, le FALTA `plan <> 'free'`), más la diferencia fina del estado (lista negra contra lista
  blanca).

**(c) `### ⚠ El estado de aterrizaje y su cupo — y la regla que salió de ahí`**, con:

- **El estado completo en una tabla** (las seis columnas + qué devuelve cada helper), con el cupo
  **1 medido en las dos fuentes**.
- **Los dos mensajes, citados textualmente**, y que la última frase es **literalmente la misma** en
  los dos, con el mismo destino de enlace.
- **⚠ Lo que el mensaje NO puede decir ni sugerir** (que la propiedad sea "de prueba") y por qué se
  afirma lo contrario en positivo.
- Que el número **se deriva del catálogo** y no se tipea en la prosa.
- **`#### ⚠ LA REGLA: antes de invitar a pagar más, verificar que pagar sea lo que destraba`**, con
  la tabla de **las dos veces** que el proyecto se tropezó con el mismo síntoma y por qué el
  `switch` exhaustivo cerró la primera vía y no la segunda.

### Agregado: siete filas en "Decisiones de Arquitectura"

La regla de `pending_plan` · que el upgrade no toque el estado y la base no se toque · los dos
helpers separados · la garantía del cartel por estructura y tipos · "antes de invitar a pagar,
verificar que pagar destrabe" · que el cupo no se subió · el margen del banner desde afuera.

### Agregado: el banner extraído y cuatro entradas de estructura

- `### Avisos persistentes` pasó a ser **`Notice + ErrorBanner + AgencyApprovalNotice`**, con tabla
  comparativa de los dos y **el porqué medido del margen desde afuera** (dos pantallas en un
  fragmento, dos en un `space-y-6`; la divergencia original **era comportamiento correcto**).
- En la estructura de carpetas: `ErrorBanner.tsx`, `AgencyVisibilityNotice.tsx`,
  `getVisibilityBlock.ts` y la nota en `getPublishBlock.ts` apuntando al otro.

### Agregado: `### ⚠ El sexto caso (11 sep 2026)` en "Método de Diagnóstico"

No como anécdota: con **las dos cosas que agrega** a los cinco anteriores.

1. **Las tres afirmaciones eran FALSAS A MEDIAS**, y la mitad verdadera era la que se leía (tabla
   con las tres). Los cinco casos anteriores se desmentían con una medición puntual; estos tres
   no: había que **notar que "operar normal" y "verse en el mapa" son dos preguntas distintas**.
2. **Estaban en tres archivos que se confirmaban entre sí**, y uno era `CLAUDE.md`. No había
   contradicción visible porque las tres copias estaban de acuerdo. **Tres fuentes coincidiendo no
   son tres verificaciones: pueden ser una sola afirmación copiada.** Con el corolario de por qué
   una afirmación falsa en `CLAUDE.md` se corrige en la misma tanda que el código.

### Corregido

| Dónde | Qué decía | Qué dice |
|---|---|---|
| **Estado** (párrafo de apertura) | nada del grupo | el grupo **CERRADO**, con el bug que destapó y la regla que salió |
| **Baseline medido** | "última medición: 10 sep 2026" | 12 sep 2026 |
| **Bloqueo de publicación** (`:134`) | *"'pending' significa «pidió un upgrade y espera que se lo activen»: esa agencia está al día"* + *"le cortaría el alta justo por haber querido pagar más"* | el sentido correcto, **con la marca de que ahí estaba la segunda copia de la afirmación falsa** y la nota de la asimetría lista negra/lista blanca |
| **Avisos persistentes** | *"el banner de error … está copiado a mano en cuatro pantallas"* | **era cierto y dejó de serlo**: se extrajo |
| **Avisos persistentes** | *"'pending' … es una agencia al día esperando activación"* | el motivo correcto: **una agencia que todavía no arrancó**, no una al día |
| **`AgencyApprovalNotice`** | montado por su propia condición; sin mención al texto viejo | es **una rama del ternario**, y sus dos textos **se corrigieron** (omitían que lo cargado tampoco se muestra) |
| **Tabla de Base de Datos**, fila `subscriptions` | solo enumeraba columnas | + qué significa `'pending'` (una sola cosa), que `pending_plan` es la única señal del pedido, y que **`past_due` no lo escribe ningún camino** |

---

## 2. PENDIENTES.md — qué cerré, abrí y ajusté

### Cerrado

- **El grupo entero**, en "Cerrados recientemente": **GRUPO DE COHERENCIA DEL PANEL — CERRADO
  (10–11 sep 2026), cinco tandas**, con las cinco descritas una por una, **una tabla de cinco
  descartes** (incluidos los tres que el prompt pedía registrar), lo que dejó abierto, y el
  apartado de método con la cuarta copia de la afirmación falsa.
- **El encabezado del archivo** reescrito al estado nuevo, avisando que **la base se limpió y pasó
  de 10 agencias a 4**.

### Los descartes registrados

Los tres que pedía el prompt, más dos que aparecieron midiendo:

1. **Cambiar la regla de visibilidad de la base para que aceptara `'pending'`** — habría dejado
   visible a una agencia recién registrada que todavía no tiene nada activo.
2. **Subir el cupo del aterrizaje** — con una propiedad la agencia igual aprende el formulario, y
   el número es andamio del modelo, no preferencia de producto.
3. **Reutilizar `getPublishBlock` para el aviso de visibilidad** — falla en dos direcciones
   opuestas.
4. Resolver la sesión del encabezado en el servidor (volvería `/` dinámica).
5. Señalar el pedido de plan en el badge del panel (reconstruiría en la interfaz la confusión que
   el modelo acaba de resolver).

### Abierto (cuatro ítems, los cuatro verificados en el código antes de escribirlos)

| Ítem | Verificación |
|---|---|
| **Los dos criterios opuestos de la base** (lista negra del trigger vs. lista blanca de la regla) | cuerpos de las dos funciones, medidos. Anotado **como algo a entender, no como bug**, con por qué unificarlos rompe en cualquiera de las dos direcciones |
| **`past_due` no lo escribe ningún camino** | barrido de las **seis** escrituras de `status`: ninguna lo escribe. **Tres** lugares lo leen, todos correctos. Anotado para que no se trate como código muerto |
| **El mensaje impreciso de la agencia que nunca eligió plan** | `planUsage.status` distingue el caso y está declarado en el código; las tres razones de haber elegido un texto único, y el ⚠ de que separarlo obliga a partir también el cartel de la home |
| **Tres familias de mensajes repetidos a mano** | contadas: **6 errores de formulario + 6 éxitos + 4 del molde de login/registro = 16 ocurrencias en 3 moldes**, con el ⚠ de que éxitos y errores conviven a dos líneas en el mismo archivo |

### Ajustado — siete cifras desactualizadas

| Dónde | Decía | Ahora |
|---|---|---|
| Calendario ("Hoy") | 10 agencias, 18 propiedades, 10 agentes, 10 consultas | **4 / 17 (16 activas) / 4 / 13**, + 7 imágenes y 1 ciudad activa |
| Limpieza previa al lanzamiento | "de las **18**, 17 activas y **16 se ofrecen**" | "de las **17**, 16 activas y **las 16 se ofrecen**" — ya no hay ninguna excluida por la regla de cobro |
| Precio opcional | "5 de 18 tienen alguna operación sin precio" | **6 de 17** |
| Quién publica | "1 de **10** agencias tiene logo" | **1 de 4** (la proporción se mantiene) |
| Colisión de slugs | "con 18 propiedades es inalcanzable" | con **17** |
| Policy de leads sin índice | "con 9 consultas es invisible" | con **13** |
| Matrícula faltante | "**8 de 10** agencias con `license_number` NULL" | **1 de 4** — la limpieza se llevó justo a las que no tenían |
| **2 usuarios de Auth huérfanos** | ítem abierto | **CERRADO: 0** (se los llevó la limpieza, no un arreglo de código), conservando la medición del 11 sep (2 de 11) porque prueba que el caso es real |

---

## 3. Afirmaciones falsas que encontré

### (a) 🔴 **UNA CUARTA COPIA de la afirmación del bug, en `CLAUDE.md`, sin corregir**

**Es el hallazgo de esta tanda.** El prompt decía que una de las tres estaba en `CLAUDE.md` y que
ya se había corregido, y pedía verificarlo. **Verifiqué: sí, la del bullet "Pedir upgrade desde el
dashboard" (`:81`) está corregida.** Pero **había una segunda copia en el mismo archivo, en otra
sección**, que la tanda de implementación no tocó — en "Bloqueo de publicación", `:134`:

> *"El dominio tiene CUATRO valores y `'pending'` significa **«pidió un upgrade y espera que se lo
> activen»: esa agencia está al día y publica normalmente**. Bloquear por `<> 'active'` le cortaría
> el alta **justo por haber querido pagar más**."*

⚠ **Y era peor que la otra:** no solo repetía el sentido equivocado, sino que **la última frase
nombraba como caso normal justo el que era el bug** — "le cortaría el alta justo por haber querido
pagar más" es la descripción exacta de lo que estaba pasando, escrita como si fuera el argumento
para no hacerlo. **Corregida**, con la marca de que ahí estaba la copia.

**Así que las afirmaciones falsas eran CUATRO, no tres, y dos de las cuatro vivían en `CLAUDE.md`.**
Es lo que da peso al punto (2) del método: tres fuentes coincidiendo pueden ser una sola afirmación
copiada — y acá una de las fuentes se había copiado a sí misma.

### (b) 🟠 Dos afirmaciones que las tandas dejaron falsas en "Avisos persistentes"

1. *"el banner de error … está **copiado a mano en cuatro pantallas**"* — **era cierto y dejó de
   serlo** el 10 sep, cuando se extrajo. Corregida, dejando la historia.
2. *"⚠ `'pending'` NO entra en esa rama y no debe entrar: **es una agencia al día esperando
   activación**"* — la regla sigue siendo correcta pero **el motivo escrito era el viejo**.
   Corregida: sigue sin entrar porque no le dieron de baja nada, pero **tampoco es "una agencia al
   día": es una que todavía no arrancó**.

### (c) 🟠 Siete cifras de datos desactualizadas en `PENDIENTES.md`

Detalladas en el punto 2. La base pasó de 10 agencias (8 sep) a 2 (10 sep), a 3 (11 sep), a **4**
(hoy), así que **ninguna cifra sin fecha del archivo era confiable**. Agregué el aviso explícito al
calendario.

### (d) 🟢 `DESIGN.md` no tenía nada falso de este grupo

Lo revisé: sus secciones del banner y del cartel se escribieron en las tandas de implementación y
están al día. **No lo toqué**, según lo indicado.

---

## 4. Los números que medí

Todo por lecturas del MCP en modo solo lectura.

### Datos de prueba (12 sep 2026)

| | Valor | Antes |
|---|---|---|
| Agencias | **4** | 10 (8 sep) → 2 (10 sep) → 3 (11 sep) |
| Suscripciones | **4** | — |
| Agentes | **4** | 10 |
| Propiedades | **17** (16 activas) | 18 (17 activas) |
| Consultas | **13** | 10 |
| Imágenes | **7** | 7 |
| Ciudades activas | **1** ("Santiago del Estero") | 1 |

### Composición, que cambió de forma relevante

| | Valor |
|---|---|
| Agencias aprobadas | **4 de 4** |
| Con logo cargado | **1 de 4** |
| Sin matrícula | **1 de 4** (era 8 de 10) |
| Usuarios de Auth sin fila en `agents` | **0** (era 2 de 11 el 11 sep) |
| Propiedades ofrecidas en `/sitemap.xml` | **16** (todas las activas) |
| En venta **y** alquiler a la vez | **3** |
| Con alguna operación sin precio | **6** |
| Consultas desvinculadas (`agent_id NULL`) | **1** |

### Estados de suscripción — y por qué importa para probar

| `status` | Filas |
|---|---|
| `active` | **4** |
| `pending` | **0** |
| `past_due` | **0** |
| `canceled` | **0** |
| Con `pending_plan` | **0** |

Planes presentes: **`inicial`, `profesional`, `premium`** — **ninguna en `free`**.

⚠ **Consecuencia: hoy no hay un solo caso real con el que probar nada de lo que este grupo
construyó.** Ni el estado de aterrizaje, ni la suscripción apagada, ni un pedido de plan abierto.
Los tres hay que fabricarlos. Quedó anotado en el calendario de `PENDIENTES.md`.

### Escrituras y lecturas del estado (barridos del código)

- **Seis** sitios escriben `subscriptions.status`; **ninguno escribe `past_due`**.
- **Tres** lugares lo leen para decidir (trigger, `getPublishBlock`, `getVisibilityBlock`), más
  `requestPlanUpgradeAction`, que lo lee para rechazar `canceled`/`past_due`.
- **16** ocurrencias de mensajes repetidos a mano, en **3** moldes.

---

## 5. Baseline

Corrido **después** de escribir los dos `.md`. Se borraron `.next` y `tsconfig.tsbuildinfo` antes
de medir; **no apareció el ruido de herramienta**.

### `npx tsc --noEmit`

```
=== npx tsc --noEmit ===
EXIT_TSC=0
```

Salida vacía. **0 errores, exit code 0.** ✅

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

**0 errores, 1 warning** — el único conocido, mismo archivo y línea. **Exit code 0.** ✅

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 7.8s
  Running TypeScript ...
  Finished TypeScript in 8.4s ...
✓ Generating static pages using 3 workers (20/20) in 1407ms

Route (app)
┌ ○ /                                     ├ ƒ /dashboard/propiedades
├ ○ /_not-found                           ├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /[slug]                               ├ ƒ /dashboard/propiedades/nueva
├ ƒ /admin                                ├ ƒ /dashboard/suscripcion
├ ƒ /api/geocode                          ├ ƒ /login
├ ○ /apple-icon.png                       ├ ƒ /logout
├ ƒ /dashboard                            ├ ƒ /propiedades/[slug]
├ ƒ /dashboard/equipo                     ├ ƒ /register
├ ƒ /dashboard/leads                      ├ ƒ /register/plan
├ ƒ /dashboard/perfil                     ├ ○ /robots.txt
├ ƒ /dashboard/preferencias               └ ƒ /sitemap.xml

ƒ Proxy (Middleware)
EXIT_BUILD=0
```

**Verde, exit code 0, 22 rutas.** ✅ `/` sigue `○`, `/sitemap.xml` sigue `ƒ`, `/robots.txt` sigue
`○`. **Nada se movió**, como correspondía a una tanda que solo toca `.md`.

---

## 6. Qué de este prompt resultó falso

### (a) 🔴 *"Uno de los tres [comentarios] estaba en CLAUDE.md, y ya se corrigió. Verificá que efectivamente esté corregido."*

**Verifiqué, y la respuesta es "sí, pero había otro".** El del bullet del upgrade (`:81`) está
corregido. **Pero había una SEGUNDA copia sin corregir en otra sección** de `CLAUDE.md` (`:134`,
"Bloqueo de publicación"), con el mismo sentido equivocado y una frase peor: *"le cortaría el alta
justo por haber querido pagar más"*, que **describe el bug como si fuera el argumento para no
cometerlo**.

**O sea que las afirmaciones falsas eran CUATRO, no tres**, y **dos de las cuatro vivían en
`CLAUDE.md`**. Lo corregí, y es lo que hizo que la nota de método valga más de lo que el prompt
anticipaba: una de las "tres fuentes independientes" se había copiado a sí misma.

### (b) 🟡 *"Cinco tandas"* — son cinco piezas, y el grupo llevó **seis** tandas contando las de documentación

Las cinco piezas del prompt están todas, tal cual. Pero midiendo el trabajo real: hubo **dos
tandas de diagnóstico de solo lectura** (una para las tres piezas de coherencia y otra para el bug
del upgrade) antes de las de implementación, y ésta de documentación. No cambia nada de lo
documentado; lo anoto porque el número "cinco" es de piezas, no de tandas.

### (c) 🟢 Todo lo demás resultó cierto y está medido

- **El grupo era chico y destapó un bug grande:** cierto, y el bug es el más caro medido hasta ahora.
- **Las cuatro copias del banner ya habían divergido:** cierto, dos con `mb-4` y dos sin.
- **Los dos helpers parecen lo mismo y fallan en dos direcciones opuestas:** cierto, y **los dos
  tienen la explicación escrita en su encabezado**, cada uno apuntando al otro por nombre, como el
  prompt anticipaba.
- **La garantía de "un solo cartel" no es por disciplina:** cierto — hay algo en la estructura (el
  ternario sobre un único `reason`) **y** algo en los tipos (el `Exclude` que no compila).
- **Es la segunda vez que el proyecto se tropieza con lo de invitar a pagar:** cierto, y la primera
  está documentada en el encabezado del mismo componente.
- **Los tres descartes que pedía registrar:** los tres verificados como razonamiento real, más dos
  que aparecieron midiendo.

### (d) Nada resultó imposible

Las ocho sub-tareas de la Parte 1 y las cuatro de la Parte 2 se hicieron tal cual.

---

## Estado final

Dos archivos `.md` modificados. Baseline intacto en los tres frentes, 22 rutas con el mismo nombre
y el mismo tipo. **No se ejecutó ningún comando de git**: el trabajo queda en el árbol para que lo
revises.
