# Eliminación de las cuentas de particular + cierre de la reentrada a `/register/plan`

> **Modo ejecución, trabajo terminado.** No corrí ningún comando de git. No toqué la
> base de datos: cero SQL de escritura, cero `ALTER`, cero migraciones — y no hizo
> falta ninguno (ver §6). `AuthLayout.tsx` quedó intacto, como pediste.
>
> `npx tsc --noEmit`, `npm run lint` y `npx next build`: **los tres en verde**, con el
> warning de `RegisterForm.tsx` desaparecido tal como estaba previsto. Detalle en §3.

---

## 1 · Archivos modificados

**6 archivos, todos en `src/`.** Ningún archivo creado ni borrado.

| Archivo | Qué cambió |
|---|---|
| `src/app/(agent)/register/RegisterForm.tsx` | Se eliminó el selector de tipo de cuenta (campo zod, `defaultValues`, `watch()`, el `<Field id="tenantType">` con el toggle y el array `ACCOUNT_TYPES`); `agencyName` pasó a requerido en el objeto zod y siempre visible; el `superRefine` quedó solo con la comparación de contraseñas. |
| `src/app/(agent)/register/actions.ts` | `tenantType` fuera del tipo de entrada; el insert escribe `tenant_type: "agency"` fijo desde el servidor; el nombre de la agencia sale siempre de `agencyName`; el redirect final es siempre `/register/plan`; comentarios sobre el particular reescritos. |
| `src/app/(agent)/register/plan/PlanSelector.tsx` | La grilla itera `PAID_PLANS` (los tres pagos) en vez de `PLAN_ORDER`; la preselección arranca en `null` cuando el plan que rige es `free` y "Continuar" queda deshabilitado hasta elegir; el link al pie dice "Decidir más tarde"; copy del claim y del subtítulo actualizados. |
| `src/app/(agent)/register/plan/page.tsx` | **Guarda de reentrada** (server): lee `plan, pending_plan, status` y redirige a `/dashboard/suscripcion` si la suscripción no está en el estado de aterrizaje virgen. |
| `src/app/(agent)/register/plan/actions.ts` | **Misma guarda en la action** (devuelve error sin escribir nada); `plan === "free"` entrante ahora se rechaza; el `UPDATE` quedó con la rama de pago únicamente (`pending_plan: plan`, `status: "pending"`), sin el ternario `isPaid`. |
| `src/types/index.ts` | `PLANS.free.name`: `"Particular"` → `"Gratis"`; se eliminó `tenantType` de `PlanInfo` y de las 4 entradas de `PLANS`; se corrigieron los tres comentarios falsos señalados. |

Lo que **no** se tocó, a propósito: `src/components/auth/AuthLayout.tsx` (sus clases
`md:items-start` y `md:sticky md:top-0 md:h-dvh` siguen exactamente igual),
`src/app/(agent)/admin/**` (la columna "Tipo" con Inmobiliaria/Particular se queda),
el bloque de `subscriptions` del registro (función (b)), `PLAN_ORDER`, el tipo
`TenantType`, el campo `Agency.tenant_type`, y los valores numéricos y flags de
`PLANS.free`.

### Detalle por tarea

**Tarea 1 — `RegisterForm.tsx`.** El esquema pasó de 8 a 7 campos. `agencyName` quedó
como `z.string().trim().min(1, "El nombre de la inmobiliaria es requerido")`. El
`superRefine` conserva solo el chequeo de contraseñas. El bloque JSX de `agencyName`
pasó a ser el primer campo del formulario, ocupando el lugar que tenía el toggle. Se
eliminaron `ACCOUNT_TYPES` y el `watch` de la desestructuración de `useForm`
(`Controller` se mantiene: lo sigue usando el selector de ciudad).

**Tarea 2 — `register/actions.ts`.** `RegisterData` ya no tiene `tenantType`, y el
import quedó en `import { PLANS } from "@/types"` (se fue el `type TenantType`, que
en este archivo ya no se usa). El ternario del nombre desapareció:
`const agencyName = data.agencyName;`. El insert lleva ahora un `tenant_type: "agency"`
literal con un comentario que explica que lo decide el servidor. El redirect final es
`redirect("/register/plan")` sin condición. El upsert de `subscriptions` está
byte-por-byte igual que antes.

**Tarea 3 — `PlanSelector.tsx`.** `PAID_PLANS` se define en el componente como
`PLAN_ORDER.filter((id) => id !== "free")` — derivado, no una lista nueva escrita a
mano, así que si mañana se agrega un plan a `PLAN_ORDER` aparece solo. La
preselección: `useState<SubscriptionPlan | null>(currentPlan === "free" ? null : currentPlan)`.
Con el estado virgen (único que llega a esta pantalla tras la tarea 4) no se
preselecciona nada y no se rompe nada; además "Continuar" arranca `disabled` y
`onContinue` corta con `if (!selected) return`, así que **es imposible que la pantalla
mande `'free'` a la action** — que es lo que pasaría si hubiera dejado el estado
inicial en `currentPlan` a secas.

**Tarea 5 — `types/index.ts`.** Antes de tocar nada verifiqué con
`grep -rn "\.tenantType\|PlanInfo" src/` que **nadie lee `PlanInfo.tenantType`**: sus
únicas apariciones estaban en la propia definición y en las 4 entradas de `PLANS`
(los otros `tenantType` del código eran los del formulario de registro, otra cosa).
Por eso lo eliminé. Los tres comentarios corregidos:

- `SubscriptionPlan` — decía *"'free' es el plan del tenant_type 'individual'
  (particular)"*; ahora explica que `free` no se vende y es el estado de aterrizaje.
- `Agency.tenant_type` — decía que la regla "individual → solo free" *"se valida en el
  registro (backend)"*; ahora dice que el registro escribe siempre `'agency'` y que la
  columna sobrevive para filas históricas.
- `AgentRole` — decía que `role` *"todavía NO gatea permisos"*; ahora enumera lo que sí
  gatea (Equipo, alcance de Consultas, `authorizePropertyAccess`).

Aproveché para anotar en `PLAN_ORDER` que es el dominio de la columna y no el catálogo
de venta, apuntando a `PAID_PLANS` — para que el próximo que lo lea no vuelva a
mezclar las dos cosas.

**Tarea 6 — barrido.** Grep final de `particular|individual|tenant` sobre todo `src/`
excluyendo `admin/`: las únicas apariciones que quedan son **la definición del tipo
`TenantType`, el campo `Agency.tenant_type`, el `tenant_type: "agency"` del insert y
tres comentarios que describen correctamente la realidad nueva**. Ningún texto de
interfaz, etiqueta ni comentario ofrece o supone cuentas de particular en el alta.
Grep de `free` en los `.tsx` fuera de `admin/`: solo comentarios explicativos y el
`filter` de `PAID_PLANS`; ninguna cadena visible al usuario.

---

## 2 · La guarda de reentrada — diff conceptual

**Condición exacta** (idéntica en los dos lugares, textual):

```ts
const isPristineLanding =
  subscription != null &&
  subscription.plan === "free" &&
  subscription.pending_plan === null &&
  subscription.status === "active";
```

Es la que propusiste, con **un agregado**: `subscription != null`. Sin fila de
suscripción tampoco es un alta virgen, y sin ese chequeo el acceso a los campos
tiraría en runtime. No es apartarse del criterio, es cerrarle el caso nulo.

### Lugar 1 — `src/app/(agent)/register/plan/page.tsx` (Server Component)

Después de resolver `user` → `agent` → `agency_id`, la query pasó de
`.select("plan, pending_plan")` a `.select("plan, pending_plan, status")` y:

```ts
if (!isPristineLanding) redirect("/dashboard/suscripcion");
```

| Estado de la suscripción | Qué pasa al pedir `/register/plan` |
|---|---|
| `free` + `pending_plan: null` + `active` (alta virgen) | Se renderiza el selector, sin card preseleccionada |
| `free` + `pending_plan: 'inicial'` + `pending` (ya pidió) | → `/dashboard/suscripcion` |
| `profesional` + `active` (plan pago vigente) | → `/dashboard/suscripcion` |
| `free` + `past_due` / `canceled` | → `/dashboard/suscripcion` |
| No existe la fila de `subscriptions` | → `/dashboard/suscripcion` |
| Sin sesión / sin fila en `agents` | → `/login` (guardas que ya estaban) |

La redirección es a `/dashboard/suscripcion` y no a `/dashboard` porque la intención
del usuario que llegó ahí es cambiar de plan: se lo deja en la pantalla que hace eso
bien (pide confirmación, escribe `pending_plan` y **no pisa** el plan que rige).

### Lugar 2 — `src/app/(agent)/register/plan/actions.ts` (`selectPlanAction`)

La misma comprobación, ahora leyendo la suscripción con el admin client (que ya se
instanciaba ahí para el `UPDATE`), **antes de escribir**:

```ts
if (!isPristineLanding) {
  return {
    error:
      "Tu cuenta ya tiene un plan definido. Cambialo desde Suscripción, en tu panel.",
  };
}
```

No escribe nada y no redirige: devuelve el error por el canal que el componente ya
sabe mostrar (el banner de `serverError`). Se repite en la action y no solo en la
página porque **una server action se puede invocar directamente**, sin pasar por el
render — que es exactamente el agujero que tenía el bug.

Y arriba de todo, la validación del plan entrante pasó de:

```ts
if (!PLAN_ORDER.includes(plan)) {                       // antes
if (!PLAN_ORDER.includes(plan) || plan === "free") {    // ahora
```

**Tres barreras, entonces, sobre el mismo camino:** la UI no ofrece `free` (no hay
card) y no deja continuar sin elegir; la action rechaza `free` explícitamente; y la
action rechaza cualquier suscripción que no esté virgen. El `UPDATE` que quedó ya no
tiene ternarios (`pending_plan: plan`, `status: "pending"` fijos): la rama "eligió
free" dejó de ser alcanzable, y dejarla escrita habría sido código muerto que además
sugiere que elegir free es posible.

**Efecto sobre el bug reportado:** la agencia con `profesional` activo (con
white-label y propiedades por encima del límite de free) que vuelva a
`/register/plan` ahora aterriza en `/dashboard/suscripcion` sin que se escriba nada; y
si alguien invoca `selectPlanAction` a mano contra esa cuenta, recibe el error y la
suscripción queda intacta.

---

## 3 · Verificación

### `npx tsc --noEmit` — exit code **0**

```
(sin salida)
```

### `npm run lint` — exit code **0**

```
> marka@0.1.0 lint
> eslint


/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  232:20  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:232:20
  230 |   });
  231 |
> 232 |   const currency = watch("currency");
      |                    ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  233 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
  234 |   const lat = watch("lat");
  235 |   const lng = watch("lng");  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
```

### `npx next build` — exit code **0**

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 9.5s
  Running TypeScript ...
  Finished TypeScript in 7.9s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/17) ...
✓ Generating static pages using 3 workers (17/17) in 1612ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /[slug]
├ ƒ /admin
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
├ ○ /login
├ ƒ /register
└ ƒ /register/plan


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

### Comparación contra el baseline

| | Baseline (antes) | Ahora | |
|---|---|---|---|
| Errores TypeScript | 0 | **0** | igual |
| Errores de lint | 0 | **0** | igual |
| Warnings de lint | 2 (`RegisterForm.tsx:105`, `PropertyForm.tsx:232`) | **1** (`PropertyForm.tsx:232`) | **-1, como se esperaba** |
| Build | verde, 17 rutas | verde, 17 rutas | igual |

**El warning de `RegisterForm.tsx` desapareció**, que es la señal que pediste: el
`watch("tenantType")` que lo causaba ya no existe y no quedó ningún otro `watch()` en
ese archivo (verificado por grep además del lint). **No hay regresiones**: el único
warning que queda es exactamente el de `PropertyForm.tsx:232`, el mismo del baseline,
y su archivo no se tocó en este trabajo. Ninguna ruta nueva ni perdida en el build.

**Lo que la verificación automática NO cubre.** Estos tres comandos no ejercitan la
guarda: no hay tests en el repo y no levanté el dev server. La lógica de la guarda
está verificada por lectura y por tipos, no por ejecución. Si querés confirmarla a
mano, los dos casos que valen son (i) registrar una agencia nueva y ver que
`/register/plan` se muestra con las tres cards y sin preselección, y (ii) con una
cuenta ya existente (por ejemplo la de plan `profesional`), pedir `/register/plan` y
ver que rebota a `/dashboard/suscripcion` sin que cambie nada en la suscripción.

---

## 4 · Decisiones que se apartan de las instrucciones (o las extienden)

Cuatro, todas menores, ninguna cambia el alcance:

1. **`agencyName` usa `.trim().min(1)` y no `.min(1)` a secas.** El `superRefine` que
   eliminé chequeaba `!d.agencyName?.trim()`, o sea rechazaba un nombre de solo
   espacios. Con `.min(1)` pelado eso se perdía y " " habría pasado como razón social
   válida. `.trim()` lo conserva y además normaliza el valor que se guarda. Está
   comentado en el código.

2. **La condición de la guarda incluye `subscription != null`.** Explicado en §2: sin
   fila no es un alta virgen, y sin el chequeo el acceso a `subscription.plan`
   reventaría.

3. **`PlanSelector` maneja "nada seleccionado" en vez de solo no preseleccionar.**
   Pediste que con `free` no preseleccione ninguna card y no se rompa. Si me quedaba
   ahí, el estado inicial seguía siendo `'free'` y apretar "Continuar" sin tocar nada
   mandaba `'free'` a la action, que ahora lo rechaza → el usuario vería "Plan
   inválido" sin haber hecho nada mal. Por eso el estado es `SubscriptionPlan | null`
   y el botón arranca deshabilitado (con `disabled:opacity-40`, coherente con el
   tratamiento de deshabilitado del resto del proyecto).

4. **Toqué dos líneas de copy de `/register/plan` que no estaban en la lista.** El
   subtítulo del panel decía *"Free se activa al instante. Los planes pagos quedan
   pendientes…"* y el párrafo bajo el título decía *"Podés empezar en free y pasar a
   un plan pago cuando quieras"*. Las dos presentaban `free` como una opción elegible
   de esa pantalla, que es justamente lo que la tarea 3 elimina; dejarlas habría sido
   dejar texto falso en la pantalla que estaba modificando. Quedaron: *"El plan queda
   pendiente hasta que confirmemos la activación. Mientras tanto podés empezar a usar
   la cuenta."* y *"Si preferís, podés decidirlo más tarde desde tu panel."* Es cambio
   de texto, no de comportamiento: saltear la elección sigue siendo posible.

Y una nota sobre un punto del pedido: la tarea 2 dice "el nombre de la agencia sale
siempre de `agencyName`" y la 1 dice sacar `tenantType` del objeto que se manda a la
action. Ambas hechas, pero conviene saber que **`fullName` sigue usándose**: es el
nombre del agente admin que se inserta en `agents.full_name` (línea 91 del archivo).
Lo que se eliminó es su uso como *nombre de agencia*, no el campo.

---

## 5 · Efectos colaterales visibles que conviene que sepas (no son bugs)

Consecuencias directas y esperadas de los cambios, que se ven en pantallas que no
toqué:

- **Las agencias en `free` ahora ven "Plan Gratis" donde antes decía "Plan
  Particular".** Afecta al `PlanBadge` del sidebar, a la card "plan actual" de
  `/dashboard/suscripcion` y a la columna "Plan" del panel `/admin`. Es exactamente el
  efecto buscado al renombrar `PLANS.free.name`, y corrige una inconsistencia que ya
  existía: hasta hoy 6 inmobiliarias reales veían la etiqueta "Particular".

- **Toda alta nueva pasa ahora por `/register/plan`.** Antes el particular salteaba el
  paso; al no haber particulares, el ternario del redirect desapareció. Quien no
  quiera elegir plan usa el link "Decidir más tarde".

---

## 6 · Encontrado y NO tocado (fuera de alcance)

**Nada de esto lo modifiqué.** Lo dejo anotado porque apareció al trabajar.

1. **No hizo falta ningún cambio de schema, y lo confirmo explícitamente.** No hay
   `ALTER` pendiente ni migración que dejar escrita. `agencies.tenant_type` conserva su
   `DEFAULT 'agency'` y su `CHECK (tenant_type IN ('individual','agency'))`; el código
   ahora escribe siempre `'agency'`, así que el CHECK deja de tener un valor
   alcanzable pero no molesta a nadie. Si en algún momento se decide endurecerlo a
   solo `'agency'`, sería un trabajo aparte y habría que decidir antes qué hacer con
   la fila `individual` existente.

2. **La fila `individual` de la base sigue ahí** (agencia "Miguel Andrade",
   `562ed7b0-…`, 0 propiedades, 0 leads, 1 agente). Como acordamos, no se migra ni se
   borra: su usuario puede seguir entrando y su cuenta funciona igual que cualquier
   otra en `free`. Lo único que cambia para esa cuenta es la etiqueta que ve
   ("Gratis" en vez de "Particular"). **No hay ninguna pantalla que le impida operar**,
   y no me pareció que estuviera en el alcance decidirlo.

3. **`src/proxy.ts` no se tocó.** La comparación `pathname === "/register"` sigue
   siendo de igualdad exacta, así que `/register/plan` sigue sin ser interceptado por
   el proxy — pero eso ya no importa: la guarda de la tarea 4 cubre el caso en la
   página y en la action, que es donde está el dato de la suscripción. Meter la lógica
   en el proxy habría implicado consultar la base en el middleware, mucho más caro y
   peor lugar. Lo menciono porque si alguien lee el proxy buscando la protección, no
   la va a encontrar ahí.

4. **El panel `/admin` quedó intacto, como pediste**, incluida la columna "Tipo"
   (Inmobiliaria/Particular) y la categoría de filtro "Free" — que hoy agrupa 6
   inmobiliarias y 1 particular. Cuando se rehaga esa tabla, la etiqueta "Free" del
   filtro va a querer alinearse con el nombre nuevo del plan.

5. **`/register/plan` no está en `PROTECTED_PREFIXES` del proxy**, así que un usuario
   sin sesión que pida esa URL no rebota en el middleware sino en la propia página
   (`if (!user) redirect("/login")`, que ya estaba). Funciona, pero es una asimetría
   con el resto del área privada. No la cambié: no estaba en el pedido y tocar
   `PROTECTED_PREFIXES` afecta a `/register` entero.

6. **`subscriptions.current_period_end` sigue siendo código muerto** (se lee y se
   muestra en `SubscriptionContent`, nadie la escribe nunca, las 9 filas están en
   `null`). Sin relación con este trabajo; lo repito del informe anterior porque sigue
   igual.

7. **La documentación del repo quedó desactualizada por este cambio.** No la edité
   porque no estaba en el pedido, pero varias afirmaciones de `CLAUDE.md` ahora son
   falsas y conviene corregirlas antes de la próxima tarea: la línea 11 ("4 planes:
   free (particular, 1 propiedad)…"), la 63 ("El particular salta el paso 2 y va
   directo al dashboard"), la 68 ("el alta elige inmobiliaria o particular") y la
   descripción de `/register/plan` en la estructura de carpetas, que no menciona la
   guarda de reentrada. También quedó vieja la nota de la línea 212 sobre los dos
   warnings de lint: ahora es **uno solo**.
