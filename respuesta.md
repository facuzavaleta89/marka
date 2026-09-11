# Tres piezas de coherencia — informe de ejecución

> **Modo ejecución.** **No se ejecutó ningún comando de git** y **no se tocó la base**.
> No se tocaron `CLAUDE.md` ni `PENDIENTES.md`.
> **Fecha:** 11 sep 2026.

---

## 1. Archivos creados y modificados

### Creados (3)

| Archivo | Qué es |
|---|---|
| `src/lib/utils/getVisibilityBlock.ts` | El helper nuevo: espejo de `agency_is_publicly_visible()`, sus tres condiciones en su mismo orden. Tres motivos. |
| `src/components/dashboard/AgencyVisibilityNotice.tsx` | Los dos carteles nuevos (suscripción de baja · plan sin activar). Presentacional puro. |
| `src/components/feedback/ErrorBanner.tsx` | El banner descartable extraído, junto a `Notice`. Client Component, margen desde afuera. |

### Modificados (9)

| Archivo | Qué cambió |
|---|---|
| `src/app/(agent)/dashboard/page.tsx` | Calcula `visibilityBlock` y monta **un solo** cartel: el de aprobación o el nuevo, nunca los dos. |
| `src/components/dashboard/AgencyApprovalNotice.tsx` | Los dos textos ahora dicen también que **lo ya cargado no se muestra en el mapa**. Era la media historia que faltaba. |
| `src/lib/utils/getPublishBlock.ts` | Solo comentarios: la contraparte de la distinción con el helper nuevo. **Cero cambios de comportamiento.** |
| `src/proxy.ts` | `/register/plan` en `PROTECTED_PREFIXES` + se corrigió el comentario que afirmaba algo falso. |
| `src/components/dashboard/PropertiesTable.tsx` | Copia 1 → `<ErrorBanner className="mb-4">`. Se sacó el import de `X`, que quedó sin uso. |
| `src/app/(agent)/admin/AgenciesTable.tsx` | Copia 2 → `<ErrorBanner className="mb-4">`. `X` sigue en uso (4 veces), se mantiene. |
| `src/components/dashboard/SubscriptionContent.tsx` | Copia 3 → `<ErrorBanner>` sin margen. Se sacó el import de `X`. |
| `src/components/dashboard/TeamContent.tsx` | Copia 4 → `<ErrorBanner>` sin margen. `X` sigue en uso (1 vez). |
| `DESIGN.md` | §6: dos secciones nuevas — "Los dos carteles: `ErrorBanner` y `Notice`" y "Aviso de que la agencia no se está viendo en el mapa". |

**No se tocó** la base, ni `/api/geocode`, ni los errores de formulario ni los bloques de éxito
repetidos (reportados en el punto 9).

---

## 2. El helper nuevo

### Firma

```ts
export type VisibilityBlockReason = "not_approved" | "not_current" | "plan_not_active";
export type VisibilityBlock = { reason: VisibilityBlockReason };

export function getVisibilityBlock(
  planUsage: PlanUsage,
  approvalStatus: ApprovalStatus
): VisibilityBlock | null
```

**Devuelve solo el motivo, no el mensaje** — a diferencia de `getPublishBlock`, que lleva un
`message` corto. Acá los textos son párrafos con negritas y un enlace, o sea JSX: meterlos en el
helper lo obligaría a saber de presentación.

### Los tres motivos, y cómo mapean a las tres condiciones de la base

La función de la base, medida por MCP:

```sql
WHERE a.id = target_agency_id
  AND a.approval_status = 'approved'   -- condición 1
  AND s.status = 'active'              -- condición 2
  AND s.plan <> 'free'                 -- condición 3
```

El helper las evalúa **en ese mismo orden**:

| Condición | Falla cuando | Motivo |
|---|---|---|
| 1 · aprobación | `approval_status !== 'approved'` | `not_approved` |
| 2 · estado | `status === 'canceled'` o `'past_due'` | `not_current` |
| 2 · estado | `status === 'pending'` | **`plan_not_active`** |
| 3 · plan | `plan === 'free'` | `plan_not_active` |

**Prioridad:** aprobación primero, igual que `getPublishBlock` y que el orden alfabético en que
Postgres dispara los tres triggers de `properties`. Si el panel ordenara distinto, el cartel y el
error al guardar contarían historias diferentes sobre la misma agencia.

⚠ **La condición 2 produce dos motivos distintos, y no es una licencia: es el hallazgo de la
tanda.** Está en el punto 9.

### Verificación de la decisión 2: **ninguna consulta nueva** ✅

Medido antes de escribir. `PlanUsage` (`src/types/index.ts`) expone `plan` y `status`:

```ts
export interface PlanUsage {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  …
}
```

Y `dashboard/page.tsx` ya tenía los tres datos: `agency.approval_status` de
`requireAgentSession()` (`:29`) y `planUsage` de `getPlanUsage` (`:84`, dentro del `Promise.all`
que ya existía). **El helper es una función pura sobre datos ya presentes.**

### Cómo quedó escrita la distinción, en los dos archivos

**En `getVisibilityBlock.ts`** (encabezado):

```
//   getPublishBlock   → "¿puede CARGAR una propiedad nueva?"
//                       Espejo de los TRES TRIGGERS de `properties`.
//   getVisibilityBlock → "¿lo que ya cargó SE VE en el mapa?"
//                       Espejo de la FUNCIÓN `agency_is_publicly_visible()`.
//
// Parecen lo mismo y no lo son. Usar aquel para esto falla en DOS DIRECCIONES
// OPUESTAS […]
//   · LE SOBRA UN MOTIVO. Una agencia con el cupo del plan lleno NO puede
//     publicar, pero SÍ se está viendo en el mapa. […]
//   · LE FALTA UNA CONDICIÓN. La agencia en el plan de aterrizaje (`free`) no
//     produce ningún bloqueo de publicación […] y sin embargo NO SE VE.
```

**En `getPublishBlock.ts`** (agregado, sin tocar la lógica):

```
// ⚠ NO USAR ESTO PARA SABER SI LA AGENCIA SE VE EN EL MAPA.
// […]
//   · LE SOBRA `plan_limit`. […] le diría que desapareció del mapa —falso— justo
//     cuando evalúa pagar un plan mayor.
//   · LE FALTA `plan <> 'free'`. […] Este helper se quedaría mudo.
//
// Y hay una diferencia más fina en el estado de la suscripción: acá 'pending'
// NO bloquea […], pero para la visibilidad sí, porque la base exige
// `status = 'active'`. Ver `getVisibilityBlock`.
```

Cada archivo apunta al otro por nombre, así que quien llegue por cualquiera de los dos encuentra
la respuesta a "¿por qué son dos?".

---

## 3. Los tres mensajes, tal como los lee una inmobiliaria

### Motivo 1 — sin aprobar o rechazada (`AgencyApprovalNotice`, **corregido**)

**Pendiente** — tono `info`, ícono reloj:

> **Tu cuenta está en revisión**
> Estamos verificando la matrícula de tu inmobiliaria. Hasta que la aprobemos no vas a poder
> publicar, **y las propiedades que ya tengas cargadas no se muestran en el mapa**. Mientras tanto
> podés ir dejando todo listo: completá tu perfil y los datos de tu inmobiliaria.

**Rechazada** — tono `error`, ícono escudo:

> **Tu solicitud no fue aprobada**
> Motivo: *(el que escribió el dueño, si lo hay)*
> **Mientras tanto tus propiedades no se muestran en el mapa y no podés publicar nuevas.** Corregí
> los datos de tu inmobiliaria y tu solicitud vuelve a revisión automáticamente.
> → *Corregir los datos*

**Lo agregado es lo que está en negrita.** Antes los dos decían solo que no se podía publicar.
⚠ Y no es teórico para una **rechazada**: puede tener la cartera entera cargada de cuando estaba
aprobada, porque los triggers de aprobación son **solo de `INSERT`** — rechazar no borra ni
despublica nada. Leía "no vas a poder publicar" y se quedaba creyendo que lo suyo seguía a la vista.

De paso se **desduplicó** el texto del rechazo, que estaba escrito dos veces (una en cada rama del
ternario de `rejectionNote`) y ahora es una sola frase.

### Motivo 2 — suscripción de baja o vencida (nuevo)

Tono **`warning`**, ícono pausa:

> **Tus propiedades no se están mostrando en el mapa**
> Tu suscripción no está activa, así que por ahora tus propiedades salieron del mapa público.
> **Tus datos están intactos:** tus propiedades, tus fotos y tu equipo siguen acá, y vuelven a
> verse apenas se reactive.
> → *Ver mi suscripción*

**Conserva las dos cosas que el texto de `/dashboard/suscripcion` hace bien**, con el porqué
escrito en el código: `warning` y no `error` porque *puede ser una baja acordada, una prueba que
terminó o un pago pendiente — el sistema no sabe cuál, así que no acusa a nadie*; y dice
explícitamente **que no se perdió nada**.

**Es la versión corta del que ya vive en la pantalla de suscripción**, con enlace a esa pantalla —
donde están el detalle completo y el correo de contacto. Así los dos carteles **no dicen lo mismo
con otras palabras**: este avisa y deriva, aquel explica.

### Motivo 3 — plan todavía sin activar (nuevo)

Tono **`info`**, ícono reloj:

> **Tus propiedades todavía no se ven en el mapa**
> Tu plan todavía no está activo. Seguí cargando tus propiedades con tranquilidad: **se publican
> solas apenas lo activemos**, sin que tengas que volver a tocarlas.
> → *Ver mi suscripción*

**`info` y no `warning`, y eso es deliberado:** es el estado **normal** de una cuenta recién
creada, porque el plan lo activa a mano el dueño. No falló nada. Un tono de alarma frenaría justo
a la agencia que queremos que cargue su cartera esta semana. Por eso el cuerpo **invita a seguir**
antes que cualquier otra cosa.

⚠ **No nombra el plan que tiene, y es a propósito:** cubre dos situaciones con un solo texto — la
que todavía no eligió ninguno (`free` + `active`) y la que ya lo pidió y espera la activación
(`pending`). *"Tu plan todavía no está activo"* es cierto en las dos.

### Chequeo de que ningún cartel contradice a otro

| Par | ¿Se pisan? |
|---|---|
| Aprobación vs. los dos nuevos | **No**: nunca se muestran juntos (punto 4) |
| Nuevo de suscripción vs. el de `/dashboard/suscripcion` | **No**: distinta pantalla, y el corto deriva al largo |
| Nuevo de plan vs. el bloqueo de "Nueva propiedad" | **No**: el botón **no está bloqueado** en ese estado, y el cartel no dice que lo esté — dice justamente lo contrario ("seguí cargando") |

---

## 4. Cómo se garantiza que nunca haya dos carteles

**Por estructura, no por disciplina.** Tres capas, cada una suficiente:

**(1) Hay un solo motivo, no dos banderas.** `getVisibilityBlock` devuelve **un** `reason`. Que la
agencia esté sin aprobar *y además* dada de baja no produce dos avisos: el helper ya resolvió la
prioridad (condición 1 primero) y devolvió uno solo.

**(2) El montaje es un ternario sobre ese único motivo**, no dos condicionales independientes
(`dashboard/page.tsx`):

```tsx
{visibilityBlock && (
  <div className="mb-8">
    {visibilityBlock.reason === "not_approved" ? (
      <AgencyApprovalNotice status={agency.approval_status} rejectionNote={rejectionNote} />
    ) : (
      <AgencyVisibilityNotice reason={visibilityBlock.reason} />
    )}
  </div>
)}
```

⚠ **Esto reemplazó a `{agency.approval_status !== "approved" && (…)}`**, que era una condición
suelta: si el cartel nuevo se hubiera montado al lado con su propia condición, **los dos podrían
dar verdadero a la vez**. Ahora son ramas de la misma expresión: es imposible por construcción.

**(3) El tipo lo hace además un error de compilación.** La prop de `AgencyVisibilityNotice` es:

```ts
reason: Exclude<VisibilityBlockReason, "not_approved">
```

Así que **pasarle el motivo de aprobación no compila**. TypeScript además estrecha el tipo en la
rama `else` del ternario, por lo que el llamador pasa el chequeo sin ningún cast.

---

## 5. Cómo se resolvió el margen del banner

**Viene de afuera, por `className`**, y el componente no trae ninguno propio:

```tsx
<div className={cn("flex items-start gap-3 rounded-md border border-terracota/20 bg-terracota-subtle px-4 py-3", className)}>
```

**Verifiqué el contenedor de cada una de las cuatro antes de decidir**, y la divergencia original
resultó ser **comportamiento correcto, no un descuido**:

| Pantalla | Contenedor raíz | ¿Separa a sus hijos? | Margen |
|---|---|---|---|
| `PropertiesTable` | `<>` (fragmento) | no | **`className="mb-4"`** |
| `AgenciesTable` | `<>` (fragmento) | no | **`className="mb-4"`** |
| `SubscriptionContent` | `<div className="space-y-6">` | **sí** | ninguno |
| `TeamContent` | `<div className="space-y-6">` | **sí** | ninguno |

Un margen fijo adentro del componente **rompería dos pantallas en una dirección o las otras dos en
la contraria**: o quedan pegadas o con el doble de aire. El porqué quedó escrito en el JSDoc de la
prop y en DESIGN.md §6.

**De paso, el componente devuelve `null` si no hay mensaje**, así que las cuatro pantallas dejaron
de escribir su propio `{error && (…)}` — la línea que se olvida al agregar la quinta.

**Verificación de que no quedó ninguna copia:**

```
$ grep -rn "flex items-start gap-3 bg-terracota-subtle|items-start gap-3 rounded-md border border-terracota" src/
src/components/feedback/ErrorBanner.tsx:47
```

**Una sola ocurrencia: la del componente.**

---

## 6. El prefijo del proxy, probado contra todas las rutas

`PROTECTED_PREFIXES = ["/dashboard", "/admin", "/register/plan"]`, evaluado con `startsWith`
contra las 22 rutas del build:

```
ruta                                   protegida?             esperado
/                                      no                     PUBLICA OK
/[slug]                                no                     PUBLICA OK
/propiedades/[slug]                    no                     PUBLICA OK
/robots.txt                            no                     PUBLICA OK
/sitemap.xml                           no                     PUBLICA OK
/apple-icon.png                        no                     PUBLICA OK
/login                                 no                     PUBLICA OK
/register                              no                     PUBLICA OK      ← la clave
/register/plan                         SI (/register/plan)    privada OK
/logout                                no                     PUBLICA OK
/api/geocode                           no                     PUBLICA OK
/dashboard                             SI (/dashboard)        privada OK
/dashboard/equipo                      SI (/dashboard)        privada OK
/dashboard/leads                       SI (/dashboard)        privada OK
/dashboard/perfil                      SI (/dashboard)        privada OK
/dashboard/preferencias                SI (/dashboard)        privada OK
/dashboard/propiedades                 SI (/dashboard)        privada OK
/dashboard/propiedades/nueva           SI (/dashboard)        privada OK
/dashboard/propiedades/[id]/editar     SI (/dashboard)        privada OK
/dashboard/suscripcion                 SI (/dashboard)        privada OK
/admin                                 SI (/admin)            privada OK
/_not-found                            no                     PUBLICA OK

discrepancias: 0

--- la pregunta puntual ---
"/register".startsWith("/register/plan")      = false
"/register/plan".startsWith("/register/plan") = true
```

✅ **`/register` sigue pública.** La pantalla de alta no exige sesión, así que una inmobiliaria
nueva puede registrarse.

**El comentario corregido**, que era la razón por la que nadie volvió a mirar esta lista:

```ts
// ⚠ ACÁ DECÍA QUE CON /dashboard Y /admin "ALCANZA", PORQUE "TODAS LAS PANTALLAS
// DEL AGENTE CUELGAN DE /dashboard". ERA FALSO […]
// ⚠ EL PREFIJO ES `/register/plan` COMPLETO, NUNCA `/register` A SECAS. […]
// ⚠ `/api/geocode` NO va en esta lista, y es deliberado […]
```

Le agregué también la nota de `/api/geocode`, para que la próxima persona que lea la lista no
intente "completarla".

---

## 7. Cómo probar cada uno de los tres estados

**Las dos agencias de la base están aprobadas, en plan `profesional` y `active`** — o sea las dos
visibles, así que **hoy el cartel no se le muestra a nadie** y cada caso hay que fabricarlo. Todo
lo de abajo es **reversible desde el panel `/admin`**, salvo donde se indica.

| Estado | Cómo fabricarlo | Cómo volver |
|---|---|---|
| **Sin aprobar / rechazada** | `/admin` → menú `⋯` de la agencia → **Rechazar** (pide un motivo, que aparece en el cartel) o **Reabrir** (la deja en `pending`) | **Aprobar** desde el mismo menú |
| **Suscripción de baja** | `/admin` → **Dar de baja**. Es un sí/no en diálogo | **Reactivar**, que repone los `has_*` del catálogo |
| **Plan sin activar** | **No hay botón que lleve a `free`.** Dos caminos, abajo | — |

### El tercero es el que cuesta, y conviene saber por qué

**No existe ninguna acción del panel que devuelva una agencia a `plan = 'free'`.** `changePlanAction`
rechaza explícitamente el destino `free` y `cancelSubscriptionAction` **conserva el `plan`** a
propósito (es la memoria de a qué reactivar). Dos formas de llegar:

1. **La natural, y la que va a pasar sola la semana que viene: registrar una inmobiliaria nueva.**
   `/register` → elegir un plan en `/register/plan` → el alta queda en `plan='free'` +
   `status='pending'`. **Aprobarla desde `/admin` y NO activarle el plan.** Ahí se ve el cartel en
   su caso real. ⚠ Si además se toca **"Cancelar solicitud"**, queda `free` + `active`, que es la
   otra mitad del mismo motivo.
2. **Un `UPDATE` a mano** sobre `subscriptions` (`plan='free'`, y opcionalmente
   `status='pending'`). ⚠ **No lo hice: esta tanda no toca la base.** Y hay que devolver también
   `property_limit`/`has_*`, o la agencia queda con el cupo de su plan viejo.

⚠ **Hay un tercer camino para el mismo cartel y no requiere fabricar nada:** desde
`/dashboard/suscripcion` de una agencia real, **pedir un upgrade**. Eso pone `status='pending'` y
el cartel aparece. **Es también la prueba de un problema serio que encontré midiendo — punto 9.**

---

## 8. Baseline

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
Los tres componentes nuevos **no agregaron ningún warning**, y los dos imports de `X` que quedaron
sin uso se sacaron (si no, serían errores de lint).

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 7.7s
  Running TypeScript ...
  Finished TypeScript in 8.5s ...
✓ Generating static pages using 3 workers (20/20) in 1561ms

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

**Verde, exit code 0, 22 rutas** — sin cambios, como se esperaba. `/` sigue `○`, `/sitemap.xml`
sigue `ƒ`, `/robots.txt` sigue `○`. ✅ (Reformateé en dos columnas por espacio.)

---

## 9. Lo que resultó falso, y una decisión que tuve que tomar

### (a) 🔴 EL HALLAZGO: **pedir un upgrade te saca del mapa**

**Es lo más importante de esta tanda y no estaba en el prompt.**

La condición 2 de la función de visibilidad es `s.status = 'active'` — **lista blanca**. El dominio
de esa columna tiene **cuatro** valores (medido: `CHECK (status = ANY (ARRAY['active','pending','past_due','canceled']))`).
Entonces **`pending` NO se ve en el mapa**.

Y `pending` significa *"pidió un plan y espera que se lo activen"*. Lo escriben dos lugares:

```
src/app/(agent)/register/plan/actions.ts:76      status: "pending",
src/app/(agent)/dashboard/suscripcion/actions.ts:75  status: "pending",
```

**La consecuencia, concreta:** una agencia con `profesional` activa y sus propiedades en el mapa
entra a `/dashboard/suscripcion`, toca "Pasar a Premium" **y desaparece del mapa** hasta que el
dueño le active el upgrade a mano. **Pedir pagar más te apaga.**

⚠ **Y contradice lo que el propio proyecto dice de sí mismo:** `SubscriptionContent.tsx:204-205`
afirma que *"'pending' […] es una agencia al día"* y la excluye de su aviso a propósito;
`getPublishBlock` la deja publicar; y `CLAUDE.md` dice que al pedir un upgrade *"el cliente sigue
operando con lo que rige hasta la activación"*. **Todo eso es cierto salvo para la visibilidad**,
que es lo único que el cliente paga.

**No lo arreglé: el arreglo está en la base** (la función, o el CHECK del gate) **o en
`requestPlanUpgradeAction`**, y esta tanda no toca ninguna de las dos. Queda para el cierre.

### (b) 🟠 La decisión que tuve que tomar: **tres motivos, pero la condición 2 produce dos**

El prompt dice "TRES MOTIVOS, TRES MENSAJES" y define el segundo como *"NO ESTÁ AL DÍA (baja o
vencida)"*. Al mirar la función de la base, la condición 2 **también atrapa `pending`**, que no es
ni "baja" ni "vencida".

Las tres salidas posibles y por qué elegí la tercera:

| Opción | Por qué no / sí |
|---|---|
| Meter `pending` en "no está al día" | ❌ **Le diría "tu suscripción está dada de baja" a alguien que acaba de pedir un plan.** Falso y alarmante, y contradice a `/dashboard/suscripcion`, que dice lo contrario en la misma app |
| Tratar `pending` como visible | ❌ **El helper mentiría**: la base dice que no se ve. Sería justo el defecto que el proyecto documenta como el más caro |
| **`pending` → el mensaje de "plan sin activar"** | ✅ **Es cierto** (su plan efectivamente no está activo), **no alarma**, y **mantiene los tres mensajes** que el prompt pidió |

**Elegí la tercera y no la considero una improvisación**: mantiene la cuenta de mensajes, respeta
el criterio de tono del prompt, y no inventa un cuarto cartel. Pero **es una decisión que el
prompt no anticipó** y por eso la declaro acá en vez de acomodarla.

⚠ **Con un residuo que dejo dicho:** para la agencia del caso (a) —`profesional` activa que pide
un upgrade— el cartel dice *"Tu plan todavía no está activo"*, que es **ambiguo**: ella tiene
Profesional. Es lo más honesto que se puede decir sin arreglar el problema de fondo, y al menos le
explica por qué desapareció del mapa, que hoy no le explica nada.

### (c) 🟢 Todo lo demás del prompt resultó cierto y está medido

- **El estado de aterrizaje no dispara ningún bloqueo:** `getPublishBlock` le devuelve `null`
  (aprobada ✓, estado no bloqueante ✓, y `canCreate` verdadero porque `PLANS.free.propertyLimit`
  es 1). Puede cargar su primera propiedad y creer que está publicada.
- **Las cuatro copias del banner ya habían divergido:** dos con `mb-4`, dos sin.
- **`/register/plan` estaba fuera de la lista** y el comentario del proxy afirmaba lo contrario.
- **El aviso de aprobación contaba media historia.**

### (d) 🟡 Lo que reporto y NO toqué, como se pidió

- **Los errores de formulario** — `<p className="font-sans text-sm text-error">` pelado, en
  `ProfileForm` (×2), `AgencyLogoForm`, `AgencyPhoneForm`, `AgencyIdentityForm` y el alta de
  `TeamContent`. **Seis ocurrencias, cinco archivos.** Otra familia: van con su campo, no como
  cartel de pantalla.
- **Los bloques de éxito** — `<p className="font-sans text-sm text-success">` en `AgencyPhoneForm`,
  `AgencyLogoForm`, `ProfileForm` (×2), `AgencyIdentityForm` y `PreferencesContent`. **Seis
  copias idénticas en clases**, cuatro con el texto embebido.
- **Un tercer molde fuera del panel** — `LoginForm:111`, `RegisterForm:262` y `PlanSelector:134`
  usan un error con fondo pero sin borde ni cierre (`px-3 py-2`), y `PlanSelector` le suma `mt-5`.
- ⚠ **Conviene resolverlos juntos**, porque los éxitos y los errores de formulario **conviven en el
  mismo archivo a dos líneas de distancia** (`ProfileForm:235` / `:238`;
  `AgencyIdentityForm:148` / `:150`). Extraer solo la mitad es cómo empiezan estas divergencias.

---

## Estado final

Doce archivos tocados (3 creados, 9 modificados). Baseline intacto en los tres frentes, 22 rutas
con el mismo nombre y el mismo tipo. **No se ejecutó ningún comando de git** ni SQL de escritura:
el trabajo queda en el árbol para que lo revises.
