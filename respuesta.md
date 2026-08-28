# Unificación de la sesión del área privada + arreglo del bucle de redirecciones

> **Modo ejecución.** Cero comandos de git. Cero SQL de escritura (la base solo se leyó
> por MCP). 22 archivos tocados, 3 creados.
>
> ⚠ **Dos diferencias contra el baseline que NO son regresiones sino consecuencias
> necesarias del arreglo: el build pasa de 17 a 18 rutas, y `/login` pasa de estática a
> dinámica.** Están explicadas en §8 y §9. Todo lo demás (0 errores de TS, 0 de lint, el
> mismo único warning) quedó idéntico.

---

## 1 · Usuarios sin fila en `agents`

```sql
SELECT count(*) AS usuarios_sin_agente
FROM auth.users u LEFT JOIN public.agents a ON a.id = u.id WHERE a.id IS NULL;
```
```json
[{"usuarios_sin_agente":2}]
```

**2**, como decías. Son `gaiozavaleta@gmail.com` (creado 30/05, último acceso 19/06) y
`juanperez@gmail.com` (creado y último acceso **en el mismo segundo**: la firma de un
registro que falló después del `signUp`). Los dos están hoy en el estado que dispara el
bucle: si inician sesión, quedan atrapados.

---

## 2 · La forma del resultado del helper, y por qué

**Unión discriminada de tres variantes**, en `src/lib/utils/resolveAgentSession.ts`:

```ts
export type AgentSession =
  | { status: "no_session" }
  | { status: "unlinked"; userId: string }
  | { status: "ok"; userId: string; agent: SessionAgent; agency: SessionAgency };
```

Por qué así:

1. **Es el patrón que el proyecto ya usa para exactamente este problema.**
   `resolveAgencyBySlug` resuelve tres estados (`not_found` / `disabled` / `active`) con
   una unión discriminada y su comentario dice *"No colapsar disabled en not_found: son
   páginas distintas"*. Acá el razonamiento es idéntico, y el bug nació justamente de
   colapsar dos estados: **"no hay sesión" y "hay sesión pero la cuenta no resuelve" se
   trataban igual y se mandaban al mismo destino.** Con la unión, colapsarlos otra vez
   requiere escribirlo a propósito.
2. **TypeScript obliga a contemplar los tres.** Un objeto con flags (`{ user, agent,
   agency }` todo nullable) dejaría escribir `session.agent!` y seguir; la unión no
   compila hasta que se descarta el caso.
3. `userId` viaja también en `unlinked`: quien corta necesita saber a quién está
   deslogueando (hoy no se usa, pero está disponible para logging).

**Dos funciones exportadas**, porque los llamadores no quieren lo mismo:

| Export | Para quién | Qué hace ante `unlinked` |
|---|---|---|
| `resolveAgentSession()` | server actions (devuelven `{ error }`) y el layout de `/admin` (necesita ordenar sus cortes) | devuelve la unión, sin cortar |
| `requireAgentSession()` | páginas y layouts | corta: `no_session` → `/login`; `unlinked` → `/logout?reason=no_agency` |

**El `select`** cubre de una sola vez lo que pedían las cinco variantes sueltas, más lo
que pediste para el trabajo siguiente:
```
id, full_name, phone_wa, avatar_url, role, agency_id,
agency:agencies(id, name, approval_status, license_number)
```
Los tipos se derivan con `Pick<Agent, …>` y `Pick<Agency, …>` — nada redefinido inline,
nada de `any`.

**Diferencia de firma con `getPlanUsage`, deliberada:** `getPlanUsage(supabase, agencyId)`
recibe el client; `resolveAgentSession()` **no recibe nada** y crea el suyo. El motivo es
la tarea 4: `cache()` de React desduplica **por argumentos**, y como `createClient()`
devuelve una instancia nueva en cada llamada, pasar el client rompería la deduplicación
entre el layout y su página. Está comentado en el archivo.

**Una mejora incluida:** el helper también devuelve `unlinked` cuando el agente existe
pero **su agencia no resuelve**. `PENDIENTES.md` describe el bug como *"su fila en
`agents` o su `agencies` no existe"*, y el código viejo solo cubría la primera mitad.

---

## 3 · La salida del bucle (tarea 2a)

**Un route handler nuevo: `src/app/(agent)/logout/route.ts` (`GET /logout`).**

### Por qué no se podía hacer de ninguna de las otras formas

Este es el hallazgo que decidió el diseño, y conviene que quede escrito:

> **Un Server Component no puede cerrar la sesión.** `signOut()` necesita borrar cookies,
> y en un Server Component el `set` de cookies **no tiene efecto**. No es una teoría: está
> escrito en el propio `src/lib/supabase/server.ts:15-23`, donde el `setAll` va envuelto en
> un `try/catch` cuyo comentario dice *"En Server Components el set no tiene efecto; lo
> maneja el proxy."*

De ahí que:

- **Extender `logoutAction`** (la server action que ya existe) no alcanza: una action se
  invoca desde un `<form>` o desde un evento de cliente, y acá quien necesita cortar es un
  Server Component en pleno render. Lo único que puede hacer es `redirect()`.
- **Que el helper lo haga** tampoco: corre dentro del mismo render, con la misma
  limitación de cookies.
- **Mandar a `/login` con la sesión viva** era justamente el bug: `proxy.ts:21` lo rebota
  a `/dashboard` y el ciclo se cierra.

Un **route handler sí puede escribir cookies**. Por eso el corte es
`redirect("/logout?reason=no_agency")` y el handler hace `signOut()` + redirect a
`/login?reason=no_agency`. Al llegar al login la cookie ya no está, la premisa de
`proxy.ts:21` (`user &&`) es falsa, y no hay rebote.

`logoutAction` **queda intacta**: el botón "Cerrar sesión" del sidebar sigue usándola.
Son dos salidas para dos contextos distintos, y está comentado en ambos archivos.

### La cadena, antes y después

```
ANTES:  /dashboard ──► layout: !agent ──307──► /login ──► proxy: hay sesión ──307──► /dashboard ──► ∞
AHORA:  /dashboard ──► layout: unlinked ──307──► /logout ──► signOut() ──307──► /login?reason=no_agency
                                                                                  (sin cookie → el proxy no rebota)
```

### El mensaje en el login (tarea 2b)

`login/page.tsx` era un Client Component, así que no podía `await searchParams`. Lo
**partí en dos siguiendo el reparto que ya usa `/register`**: `page.tsx` (Server, lee
`searchParams` y resuelve el texto) + `LoginForm.tsx` (Client, el formulario tal cual
estaba). No se convirtió ningún Server Component en Client — es al revés.

**El parámetro de la URL es un CÓDIGO, nunca el texto.** El mapa vive en el server:
```ts
const NOTICES: Record<string, string> = {
  no_agency:
    "Tu cuenta no está asociada a ninguna inmobiliaria. Escribinos si creés que es un error.",
};
```
Un código desconocido no renderiza nada. El route handler además valida el `reason`
contra su propia whitelist antes de reenviarlo, así que hay dos filtros y en ningún punto
se pinta texto que venga de la URL.

Visualmente el aviso usa el mismo bloque que el error de servidor de esa pantalla
(`rounded-md px-3 py-2`), pero en tono neutro (`text-graphite bg-mist` en vez de
`text-error bg-terracota-subtle`): es información, no un error de quien escribe.

---

## 4 · Cómo llega el estado a las páginas sin repetir la consulta (tarea 4)

**`cache()` de React sobre el helper.**

```ts
export const resolveAgentSession = cache(async (): Promise<AgentSession> => { … });
```

Dentro de un mismo request, el layout y la página que cuelga de él llaman los dos a
`requireAgentSession()` y **se ejecuta una sola consulta**: la segunda llamada recibe el
resultado memorizado. Cada página sigue escribiendo su propia línea (legible, sin
props que atraviesen archivos), y el costo en base es el de una sola.

**Alternativas descartadas:**

- **Pasar el estado por props desde el layout.** No se puede: en App Router un layout
  recibe `children` ya renderizados como `ReactNode`; no hay forma de inyectarle props a
  la página desde el layout. Habría que clonar elementos, que es frágil y no tipa.
- **React Context.** Requiere un Provider client (`"use client"`), y arrastraría a las
  páginas hacia el cliente. Choca de frente con la restricción dura que pusiste y con la
  regla del proyecto.
- **Un módulo con estado (variable global por request).** Es lo que `cache()` hace bien y
  a mano se hace mal: hay que resolver el aislamiento entre requests concurrentes, que es
  exactamente lo que `cache()` ya garantiza.
- **No cachear y aceptar dos consultas.** Funcionaría, pero duplicaría la carga por
  navegación justo cuando el objetivo era dejar de repetir la consulta.

⚠ Alcance honesto de `cache()`: garantiza deduplicación **dentro de un render**. En las
server actions cada invocación es su propio ciclo, así que ahí sigue siendo una consulta
por action — igual que antes, y correcto: una action tiene que leer el estado fresco.

---

## 5 · Los sitios unificados, uno por uno

**21 llamadas al helper** (tu enunciado decía 19; el recuento real dio 21 — dos de las
tres del archivo de propiedades son fáciles de pasar por alto).

### Páginas y layouts

| # | Archivo | Antes ante "no hay agente" | Ahora | ¿Cambió? |
|---|---|---|---|---|
| 1 | `dashboard/layout.tsx` | `redirect("/login")` → **bucle** | `/logout?reason=no_agency` → login con aviso | **Sí: es el arreglo** |
| 2 | `admin/layout.tsx` | `redirect("/login")` → **bucle** | ídem | **Sí: es el arreglo** |
| 3 | `dashboard/page.tsx` | `redirect("/login")` → bucle | ídem | Sí (arreglo) |
| 4 | `dashboard/propiedades/page.tsx` | `redirect("/login")` → bucle | ídem | Sí (arreglo) |
| 5 | `dashboard/leads/page.tsx` | `redirect("/login")` → bucle | ídem | Sí (arreglo) |
| 6 | `dashboard/perfil/page.tsx` | `redirect("/login")` → bucle | ídem | Sí (arreglo) |
| 7 | `dashboard/preferencias/page.tsx` | `redirect("/login")` → bucle | ídem | Sí (arreglo) |
| 8 | `dashboard/suscripcion/page.tsx` | `redirect("/login")` → bucle | ídem | Sí (arreglo) |
| 9 | `dashboard/equipo/page.tsx` | `redirect("/login")` → bucle | ídem | Sí (arreglo) |
| 10 | `dashboard/propiedades/nueva/page.tsx` | `redirect("/dashboard")` → bucle (vía el layout) | ídem | Sí (arreglo) — ver §7 |
| 11 | `dashboard/propiedades/[id]/editar/page.tsx` | **no cortaba** (`agent?.role`) | ídem | Sí — ver §7 |
| 12 | `register/plan/page.tsx` | `redirect("/login")` → bucle | ídem | Sí (arreglo) |

**Sin sesión, las 12 siguen yendo a `/login`**, exactamente como antes: ese caso nunca
fue el bug (el proxy no rebota `/login` cuando no hay sesión).

### Server actions

| # | Archivo | Antes | Ahora | ¿Cambió? |
|---|---|---|---|---|
| 13 | `dashboard/propiedades/actions.ts:130` (`authorizePropertyAccess`) | `agent` null → cae al "Propiedad no encontrada" | idéntico | **No** |
| 14 | `dashboard/propiedades/actions.ts:234` (`createPropertyAction`) | `{ error: "No autenticado" }` / `{ error: "Agente no encontrado" }` | los **mismos dos textos** | **No** |
| 15 | `dashboard/propiedades/actions.ts:366` (`updatePropertyAction`) | `caller?.role` con optional chaining | `caller` null si no resuelve; misma semántica | **No** |
| 16 | `dashboard/preferencias/actions.ts:41` (teléfono) | `{ error: "No autenticado" }` / `"No autorizado"` | mismos textos | **No** |
| 17 | `dashboard/preferencias/actions.ts:78` (logo) | ídem | mismos textos | **No** |
| 18 | `dashboard/equipo/actions.ts:42` (`createAgentAction`) | ídem | mismos textos | **No** |
| 19 | `dashboard/equipo/actions.ts:104` (`deleteAgentAction`) | ídem | mismos textos | **No** |
| 20 | `dashboard/suscripcion/actions.ts:27` | `redirect("/login")` | `no_session` → `/login`; `unlinked` → `/logout` | Solo el caso del bucle |
| 21 | `register/plan/actions.ts:23` | `redirect("/login")` | ídem | Solo el caso del bucle |

**Las 7 actions que devolvían `{ error }` siguen devolviendo `{ error }`, con el texto
exacto de antes.** Ninguna se convirtió en redirección: como advertiste, redirigir desde
un submit rompería el manejo de errores del formulario que la llama. Las dos que ya
redirigían (20 y 21) siguen redirigiendo.

### Un cambio de orden que vale aclarar

En `admin/layout.tsx` **preservé el orden original de los cortes** a propósito: primero
sesión, después identidad del dueño, y recién al final la cuenta huérfana. Por eso ese
archivo usa `resolveAgentSession()` crudo en vez de `requireAgentSession()`: un no-admin
sigue yendo a `/dashboard` sin que el estado de su agencia influya en nada, igual que
antes.

---

## 6 · El grep que demuestra que no quedó ninguna suelta

```
$ grep -rn '\.from("agents")' src/
src/app/(agent)/admin/page.tsx:106          admin.from("agents").select("*", { count: "exact", head: true }),
src/app/(agent)/dashboard/perfil/actions.ts:32    .from("agents")
src/app/(agent)/dashboard/propiedades/nueva/page.tsx:23      .from("agents")
src/app/(agent)/dashboard/propiedades/actions.ts:72    .from("agents")
src/app/(agent)/dashboard/equipo/actions.ts:65   await admin.from("agents").insert({
src/app/(agent)/dashboard/equipo/actions.ts:119    .from("agents")
src/app/(agent)/dashboard/equipo/page.tsx:20      .from("agents")
src/app/(agent)/dashboard/propiedades/[id]/editar/page.tsx:54      .from("agents")
src/app/(agent)/register/actions.ts:88   await admin.from("agents").insert({
src/lib/utils/resolveAgentSession.ts:83    .from("agents")
```

```
$ grep -rn -A4 '\.from("agents")' "src/app/(agent)/" | grep -E '\.eq\("id", (user|session)'
src/app/(agent)/dashboard/perfil/actions.ts-34-    .eq("id", user.id);
```

**Ninguna de las que quedan es la consulta duplicada.** Una por una:

| Archivo:línea | Qué es | Por qué queda |
|---|---|---|
| `perfil/actions.ts:32-34` | **UPDATE** de la propia fila (`updateProfileAction`) | Es una escritura, no la lectura duplicada. El helper no escribe |
| `admin/page.tsx:106` | `count` de TODOS los agentes | Métrica de plataforma, no la sesión del caller |
| `equipo/page.tsx:20` | agentes **por `agency_id`** | Lista el equipo, no al caller |
| `equipo/actions.ts:65` / `register/actions.ts:88` | `INSERT` de un agente nuevo | Alta, no lectura |
| `equipo/actions.ts:119` | agente **destino** de un borrado, por su id | No es el caller |
| `propiedades/nueva/page.tsx:23` y `[id]/editar/page.tsx:54` | agentes **por `agency_id`** para el selector "Agente asignado" | No es el caller |
| `propiedades/actions.ts:72` (`resolveAssignedAgent`) | agente **destino** de una reasignación | No es el caller |
| `resolveAgentSession.ts:83` | **el helper** | Es el único lugar donde vive la consulta |

La única línea que sigue filtrando `agents` por `user.id` es el **UPDATE** del perfil, que
por definición no puede reemplazarse por una lectura.

---

## 7 · Los dos casos raros

**`propiedades/nueva/page.tsx` — se unifica.** Tenías razón en la sospecha: mandar a
`/dashboard` no arreglaba nada, porque el layout de `/dashboard` volvía a evaluar lo mismo
y ahí sí cortaba a `/login`, entrando al bucle un salto más tarde. Ahora usa el helper
como el resto. **Su segundo `redirect("/dashboard")` (el de `!agency`) se conservó tal
cual**: ese no es el corte del agente sino el de la fila de `agencies` que trae el
`city_id` para centrar el mapa. Está comentado en el archivo para que no se confundan.

**`propiedades/[id]/editar/page.tsx` — era un descuido, y lo corregí.** Usaba
`agent?.role === "admin" && agent.agency_id === …` y seguía adelante sin fila de agente.
No creo que fuera deliberado: sin agente **no hay autorización posible**, así que el
único desenlace era caer en el chequeo de propiedad de la línea 45 y salir por
`/dashboard/propiedades`. Cortar antes con el helper es más correcto y, para un usuario
real, **no cambia nada de lo que ve**: sin agente no podía editar en ningún escenario.
La diferencia visible aparece solo para una cuenta huérfana, que antes terminaba en el
bucle y ahora sale por el login con el aviso.

---

## 8 · Verificación

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
  … React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
```

### `npx next build` — exit code **0**
```
✓ Compiled successfully in 10.7s
✓ Generating static pages using 3 workers (18/18) in 1348ms

Route (app)
┌ ○ /                                   ├ ○ /_not-found
├ ƒ /[slug]                             ├ ƒ /admin
├ ○ /apple-icon.png                     ├ ƒ /dashboard
├ ƒ /dashboard/equipo                   ├ ƒ /dashboard/leads
├ ƒ /dashboard/perfil                   ├ ƒ /dashboard/preferencias
├ ƒ /dashboard/propiedades              ├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /dashboard/propiedades/nueva        ├ ƒ /dashboard/suscripcion
├ ƒ /login                              ├ ƒ /logout
├ ƒ /register                           └ ƒ /register/plan
```

### Comparación contra el baseline

| | Baseline | Ahora | |
|---|---|---|---|
| Errores TypeScript | 0 | **0** | igual |
| Errores de lint | 0 | **0** | igual |
| Warnings de lint | 1 (`PropertyForm.tsx:232`) | **1** (el mismo) | igual |
| Build | verde | verde | igual |
| Rutas | 17 | **18** | ⚠ **+1: `/logout`** |
| `/login` | `○` estática | **`ƒ` dinámica** | ⚠ **cambió** |

**Las dos diferencias son consecuencia directa de lo que pediste, no regresiones:**

1. **`/logout`** es el route handler de la tarea 2a. Es la única forma de cerrar la
   sesión desde un Server Component (§3): sin él no hay arreglo posible del bucle. No es
   una pantalla — es un endpoint que redirige.
2. **`/login` pasó a dinámica** porque ahora lee `searchParams`, que es literalmente lo
   que pedía la tarea 2b. Una página que depende de la URL no se puede prerenderizar.

Si cualquiera de las dos no te sirve, decímelo: la primera se puede evitar solo
cambiando el enfoque del arreglo (por ejemplo, renderizar un estado en vez de redirigir),
y la segunda es inevitable si el login tiene que mostrar el mensaje.

**Lo que la verificación automática NO cubre:** no hay tests y no levanté el dev server.
El circuito `/dashboard → /logout → /login?reason=no_agency` está verificado por tipos y
por build, **no ejercitado en el navegador**. La prueba a mano que lo confirma: iniciar
sesión con `juanperez@gmail.com` (uno de los 2 huérfanos) y pedir `/dashboard` — antes
quedaba en la cadena de 307 hasta el `SecurityError`; ahora tiene que aterrizar en el
login con el aviso y **sin sesión**.

---

## 9 · Decisiones que se apartan de las instrucciones

1. **Se creó una ruta (`/logout`) y el login dejó de ser estático.** Detallado arriba.
   Era eso o no arreglar el bug: `src/lib/supabase/server.ts:20-22` documenta que en un
   Server Component el `set` de cookies no tiene efecto.
2. **`login/page.tsx` se partió en `page.tsx` + `LoginForm.tsx`.** No estaba pedido en
   esos términos, pero era necesario: la página era `"use client"` y no podía leer
   `searchParams`. El reparto copia el de `/register` (page server + form client). El
   formulario en sí no se tocó: mismo esquema, mismos campos, mismo estilo.
3. **El helper se llama `resolveAgentSession.ts` (camelCase), no kebab-case.** Las reglas
   piden kebab-case, pero **todos** sus vecinos en `src/lib/utils/` son camelCase
   (`getPlanUsage.ts`, `resolveAgencyBySlug.ts`, `agencySlug.ts`). Preferí la consistencia
   local; si querés kebab-case, es un renombre parejo de la carpeta entera, no de un
   archivo.
4. **En `admin/layout.tsx` se usa `resolveAgentSession()` en vez de
   `requireAgentSession()`**, para conservar el orden original de los cortes (§5).
5. **El helper amplió el caso `unlinked` a "tampoco resuelve la agencia"** (§2), que el
   código viejo no cubría pero `PENDIENTES.md` sí describe.
6. **Se eliminaron tres imports de `createClient`** que quedaron sin uso en las actions
   refactorizadas (lint los marcaba). Es limpieza obligada, no scope creep.

---

## 10 · Encontrado y NO tocado

1. **`registerAction` sigue sin rollback.** Si el `signUp` funciona y falla el insert de
   `agencies` o de `agents`, queda un `auth.users` huérfano — que es justo el estado que
   este trabajo aprendió a manejar con elegancia, pero **no dejó de producirse**. Los 2
   huérfanos de la base son de ahí. Está fuera del alcance de esta tarea (es el alta, no
   la sesión), pero es la fuente del problema y conviene cerrarla.
2. **`/logout` ocupa un slug de primer nivel.** `CLAUDE.md` advierte que
   `(public)/[slug]` es la ruta raíz de las agencias y que toda ruta estática de primer
   nivel compite con ella. `/logout` gana (las estáticas ganan a la dinámica), así que
   ninguna agencia va a poder tener el slug "logout". Es aceptable, pero queda anotado.
3. **La deduplicación de `cache()` no llega a las actions** (§4). Correcto, pero significa
   que las 9 actions siguen haciendo su propia consulta.
4. **Quedan 4 formas del "banner"/aviso copiadas a mano** por el proyecto; el aviso nuevo
   del login es una quinta variante inline. No creé un componente compartido porque no
   estaba pedido y porque el trabajo siguiente (el aviso de estado de aprobación en el
   panel) es el que va a justificar hacerlo bien.
5. **`authorizePropertyAccess` sigue llamando a `supabase.auth.getUser()` por su cuenta**
   además de usar el helper. Es el `user` para el chequeo de propiedad, no la fila de
   `agents`; unificarlo también era posible pero tocaba más de lo necesario.
6. **La documentación quedó atrás.** `CLAUDE.md` no menciona el helper ni `/logout`, y
   `PENDIENTES.md` sigue listando el bucle como deuda técnica abierta. No los toqué
   porque pediste no cambiar nada fuera del alcance; es una pasada aparte.
