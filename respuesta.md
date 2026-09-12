# El mensaje de cupo lleno ya no le propone pagar a quien no le sirve pagar

> **Modo ejecución, alcance mínimo: un mensaje.** **No se ejecutó ningún comando de git** y
> **no se ejecutó SQL** (ni de lectura: esta tanda no lo necesitó).
> No se tocaron `CLAUDE.md` ni `PENDIENTES.md`.
> **Fecha:** 11 sep 2026.

---

## 1. El archivo modificado

**Uno.**

| Archivo | Qué cambió |
|---|---|
| `src/components/dashboard/NewPropertyButton.tsx` | Una rama nueva en `PlanLimitMessage` para el estado de aterrizaje, y el encabezado del componente, que enumeraba tres mensajes y ahora son cuatro. |

**Verificado por marca de tiempo que es el único de `src/` tocado en esta tanda** (los demás son de
las tandas de hoy más temprano: 19:31–20:33 y 23:50; éste es 23:58).

---

## 2. El texto exacto de la rama nueva

> **[Nueva propiedad]** *(deshabilitado)*
>
> Llegaste al límite de lo que podés cargar por ahora. Cuando activemos tu plan vas a poder cargar
> el resto de tu cartera. [**Ver mi suscripción**]

Mismo tratamiento que las otras tres variantes: `font-sans text-xs text-graphite max-w-xs
sm:text-right`, con el enlace en `terracota`.

### Los tres sentidos pedidos

1. **"Llegaste al límite de lo que podés cargar por ahora"** — reconoce el límite, y el *"por
   ahora"* lo marca como transitorio en la misma frase.
2. **"Cuando activemos tu plan vas a poder cargar el resto de tu cartera"** — qué lo destraba.
3. **No invita a ningún plan.** El enlace es **"Ver mi suscripción"**, el mismo que usan el cartel
   de la pantalla principal y el mensaje de suscripción dada de baja — **no "Ver planes"**, que es
   el enlace del canal de venta y quedó exclusivamente en la rama del upgrade.

### La condición de la rama

```tsx
if (planUsage.plan === "free") { … }
```

**Es la condición exacta y no una aproximación:** para llegar a `PlanLimitMessage`,
`getPublishBlock` ya descartó que la agencia esté sin aprobar y que su suscripción esté dada de
baja o vencida. Así que "aprobada + al día + plan `free` + cupo lleno" **es** el aterrizaje. Va
antes del cálculo de `nextPlan`, así que `free` nunca vuelve a caer en la rama del upgrade.

---

## 3. Punto 3 — el dato SÍ está disponible, y elegí **un solo mensaje**

### Qué encontré, medido

`PlanLimitMessage` recibe el `PlanUsage` completo (`NewPropertyButton.tsx:153`), y ese objeto
(`src/types/index.ts`) trae:

| Campo | ¿Sirve para distinguir las dos situaciones? |
|---|---|
| **`status`** | ✅ **SÍ.** `'pending'` = ya pidió un plan y espera la activación · `'active'` con `plan: 'free'` = todavía no eligió ninguno (o le cancelaron el pedido) |
| **`pending_plan`** | ❌ **NO EXISTE en `PlanUsage`.** No se puede nombrar *cuál* plan pidió |

⚠ Y el `status` sirve **con precisión** recién desde el arreglo de hoy más temprano: hasta esta
mañana `'pending'` significaba dos cosas (agencia nueva **o** agencia con plan pago pidiendo un
upgrade), así que no habría servido para separar nada. Ahora `'pending'` solo lo escribe
`selectPlanAction`, o sea el registro.

### Qué decidí: **un solo texto para las dos**

**Tres razones, en orden de peso:**

1. **⚠ El punto 2 del prompt lo exige.** El cartel de la pantalla principal
   (`AgencyVisibilityNotice`, rama `plan_not_active`) cubre esas **mismas dos situaciones con un
   texto único y a propósito** — su comentario lo dice: *"Cubre DOS situaciones con un solo texto…
   'Tu plan todavía no está activo' es cierto en las dos"*. Si el cartel usa uno y el botón usara
   dos, las dos pantallas dejarían de contar la misma historia, que es justamente lo que el prompt
   pide evitar.
2. **El enlace cubre la diferencia sin partir el texto.** `Ver mi suscripción` lleva a
   `/dashboard/suscripcion`, donde **cada una ve lo que le corresponde**: la que pidió un plan ve
   su tarjeta en *"Pendiente"*, y la que no eligió ninguno ve las tarjetas de los planes para
   elegir. La precisión está en el destino, no hace falta duplicarla en la prosa.
3. **El alcance es un mensaje.** Dos ramas serían dos mensajes, y la segunda tendría que
   coordinarse además con el cartel de la home — que no toqué.

### ⚠ La imprecisión que queda, dicha derecho

Para la agencia que **nunca eligió** un plan, *"cuando activemos tu plan"* es levemente impreciso:
no hay ningún plan pendiente de activar. **Lo asumo**, por tres motivos:

- **Es el mismo grado de imprecisión que ya tiene el cartel de la home**, así que las dos
  pantallas son consistentes entre sí — que es la propiedad que el prompt prioriza.
- **Es el caso raro:** todo alta pasa por `/register/plan`, y hay que tocar *"Decidir más tarde"*
  —o que el dueño le cancele el pedido— para quedar ahí.
- **El enlace la corrige:** entra a su suscripción, ve los planes y elige. Nunca queda sin salida.

Si algún día se decide separarlas, **el dato ya está ahí** (`planUsage.status`) y quedó anotado en
el código: sería una rama más, sin ninguna consulta nueva. Pero habría que partir **también** el
texto del cartel de la home, o vuelven a contradecirse.

---

## 4. Confirmación: las otras dos variantes del mensaje de límite **NO se tocaron**

Verificado por barrido después del cambio:

```
src/lib/utils/getPublishBlock.ts:103:      message: "Alcanzaste el límite de propiedades de tu plan.",
src/app/(agent)/dashboard/propiedades/actions.ts:183:  "Alcanzaste el límite de propiedades de tu plan."
src/app/(agent)/dashboard/propiedades/actions.ts:560:  "Alcanzaste el límite de propiedades de tu plan."
src/app/(agent)/dashboard/propiedades/actions.ts:677:  "Alcanzaste el límite de propiedades de tu plan. No podés volver a activar esta propiedad."
```

| Variante | Dónde se ve | Estado |
|---|---|---|
| **El del estado vacío** (`getPublishBlock:103`) | estado vacío de `/dashboard` y de `PropertiesTable` | ✅ **intacta** |
| **El del rechazo al guardar** (`propiedades/actions.ts`, 3 sitios) | traducción del trigger `check_property_limit` | ✅ **intacta** |

Las dos dicen la verdad y **no mandan a ningún lado** — no proponen un upgrade —, y con el cartel
nuevo de la pantalla principal la agencia ya llega avisada de que su límite es de una sola. No
hacía falta tocarlas, y no las toqué.

**Y el punto 5 también:** la rama que **sí** invita a pasar de plan quedó intacta
(`NewPropertyButton.tsx:222-228`, *"Alcanzaste el límite de tu plan {X}. Pasá a {Y} para publicar
más. Ver planes"*), igual que la del plan tope (`:237`, *"Alcanzaste el máximo de propiedades.
Escribinos si necesitás más."*). Para una agencia con un plan de venta andando ese mensaje es
correcto y es un canal de venta legítimo. Lo dejé anotado en el código, arriba del cálculo de
`nextPlan`, para que nadie lo "unifique" con el nuevo.

**Tampoco se tocaron:** `getPublishBlock` (el helper del motivo), el cupo, el catálogo `PLANS`, la
base, ni las otras dos ramas de `BlockMessage` (agencia sin aprobar y suscripción de baja).

---

## 5. Cómo verifiqué que las dos pantallas cuentan la misma historia

Puse los dos textos uno al lado del otro. La agencia los lee **en este orden**, en la misma
pantalla (`/dashboard`): primero el cartel de ancho completo, después el mensaje bajo el botón.

**El cartel de la pantalla principal** (`AgencyVisibilityNotice`, rama `plan_not_active`):

> **Tus propiedades todavía no se ven en el mapa**
> **Ya podés cargar tu primera propiedad**, así vas conociendo el formulario. Por ahora el límite
> es de **una sola propiedad**, porque tu plan todavía no está activo.
> La que cargues queda guardada tal cual y **se publica sola cuando lo activemos**, sin que tengas
> que volver a tocarla. **Ahí vas a poder cargar el resto de tu cartera.**

**El mensaje nuevo bajo el botón**, una vez que cargó esa una:

> Llegaste al límite de lo que podés cargar por ahora. Cuando activemos tu plan **vas a poder
> cargar el resto de tu cartera**. → Ver mi suscripción

**Las cuatro cosas que verifiqué que coinciden:**

| | Cartel | Mensaje nuevo |
|---|---|---|
| **El límite** | "por ahora el límite es de una sola propiedad" | "el límite de lo que podés cargar **por ahora**" |
| **Qué lo destraba** | "se publica sola **cuando lo activemos**" | "**cuando activemos** tu plan" |
| **Qué viene después** | "**vas a poder cargar el resto de tu cartera**" | "**vas a poder cargar el resto de tu cartera**" ← **frase idéntica, a propósito** |
| **A dónde manda** | `Ver mi suscripción` | `Ver mi suscripción` ← **mismo enlace, no "Ver planes"** |

**La última frase es literalmente la misma** en los dos: el cartel la promete y el mensaje la
cumple. Se leen como una sola conversación en dos momentos —antes de cargar y después—, y en
ninguno aparece la palabra "pasá", "upgrade" ni el nombre de un plan mayor.

**El tono también coincide:** los dos son informativos y transitorios. El cartel va en `Notice`
tono `info` (*"algo está en curso, nadie hizo nada mal"*) y el mensaje del botón en
`text-graphite` —el gris secundario de DESIGN §2—, nunca en `error`.

**Y la contradicción que el prompt anticipaba está cerrada:** antes el cartel decía "esperá
tranquila, se publica sola" y el botón decía "Pasá a Inicial para publicar más". Ahora ninguno de
los dos menciona pagar.

---

## 6. Baseline

Se borraron `.next` y `tsconfig.tsbuildinfo` antes de medir. **No apareció el ruido de herramienta.**

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
✓ Compiled successfully in 7.9s
  Running TypeScript ...
  Finished TypeScript in 8.6s ...
✓ Generating static pages using 3 workers (20/20) in 1481ms

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

**Verde, exit code 0, 22 rutas.** ✅ Sin cambios: `/` sigue `○`, `/sitemap.xml` sigue `ƒ`,
`/robots.txt` sigue `○`. (Reformateé en dos columnas por espacio.)

---

## 7. Qué resultó falso

### Nada de lo que el prompt afirma resultó falso

Las cinco afirmaciones se verificaron contra el código antes de tocar nada:

- **El mensaje existía y decía eso:** `PlanLimitMessage` calculaba el plan siguiente en
  `PLAN_ORDER` y, con `plan = 'free'`, ofrecía *"Alcanzaste el límite de tu plan Gratis. Pasá a
  Inicial para publicar más."*
- **Ramifica por plan**, tal cual: `PLAN_ORDER.indexOf(planUsage.plan)` → `nextPlan`.
- **Es correcto para un plan de venta y no le destraba nada al aterrizaje.** Confirmado.
- **⚠ Es efectivamente la segunda aparición de la misma familia, y está documentada en el mismo
  archivo.** El encabezado del componente (`:29-35`) cuenta la primera: cuando se agregó el motivo
  `subscription_inactive`, cayó en el `else` de un ternario binario y **una agencia dada de baja
  leía exactamente esta misma frase** — *"alcanzaste el límite de tu plan Gratis, pasá a
  Inicial"*—. El `switch` con guarda `never` que se agregó entonces cerró **esa** vía, pero no
  ésta: el motivo `plan_limit` llega bien, y lo que falla es la ramificación **dentro** de su
  mensaje. Lo dejé anotado en la rama nueva, con el patrón a vigilar: **antes de invitar a pagar,
  verificar que pagar sea lo que destraba.**
- **El dato para separar las dos situaciones del aterrizaje existe** (`planUsage.status`), como el
  punto 3 preveía como posibilidad — y lo reporté con la decisión.

### Una decisión que tomé y una imprecisión que declaro

- **Un solo mensaje para las dos situaciones del aterrizaje**, para que las dos pantallas cuenten
  la misma historia (punto 3, con las tres razones).
- **La imprecisión residual** para la agencia que nunca eligió un plan (*"cuando activemos tu
  plan"*, cuando no hay ninguno pendiente) está declarada en el punto 3 y anotada en el código.
  **No la escondí**: es el mismo grado de imprecisión que ya tiene el cartel de la home, es el caso
  raro, y el enlace la corrige.

### Un cambio de más, chico, que declaro

Además de la rama, corregí el **encabezado del componente** (`:20-31`), que enumeraba *"TRES
motivos… cupo del plan lleno → se invita al upgrade"*. Con la rama nueva esa línea pasaba a ser
falsa: siguen siendo tres motivos pero ahora son **cuatro mensajes**, porque el del cupo se parte
según el plan. Es la clase de afirmación que este proyecto ya documentó como la más cara, así que
no la dejé desactualizada.

---

## Estado final

Un archivo modificado. Baseline intacto en los tres frentes, 22 rutas con el mismo nombre y el
mismo tipo. **No se ejecutó ningún comando de git** ni SQL: el trabajo queda en el árbol para que
lo revises.
