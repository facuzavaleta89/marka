# Matrícula en el alta, aviso de estado, bloqueo de publicación y reenvío de solicitud

> **Modo ejecución.** Cero comandos de git. Cero SQL de escritura (la base solo se leyó
> por MCP). **11 archivos modificados, 5 creados.**
>
> `npx tsc --noEmit` 0 errores · `npm run lint` 0 errores y **1 warning** (el conocido,
> en `PropertyForm.tsx:232`) · `npx next build` verde con **18 rutas**. **Idéntico al
> baseline: no agregué ninguna ruta y no aparecieron warnings nuevos.**

---

## 1 · Los dos triggers, medidos por MCP

Coinciden exactamente con lo que describiste. Nada difiere.

### `check_agency_approved()` + `trg_check_agency_approved`

```sql
CREATE OR REPLACE FUNCTION public.check_agency_approved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  agency_state TEXT;
BEGIN
  SELECT approval_status INTO agency_state
  FROM agencies
  WHERE id = NEW.agency_id;

  -- Sin fila de agencia no se publica: es un estado inconsistente, no un permiso.
  IF agency_state IS NULL OR agency_state <> 'approved' THEN
    RAISE EXCEPTION 'La agencia no está aprobada para publicar propiedades'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$
```
```
CREATE TRIGGER trg_check_agency_approved
  BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION check_agency_approved()
```
**Solo INSERT**, como pediste: editar una propiedad ya cargada sigue permitido aunque la
agencia se rechace después.

### `check_property_limit()` actualizada

El cambio respecto de la versión anterior es este bloque:
```sql
  -- Sin fila de suscripción NO hay cupo: antes max_allowed quedaba NULL, la
  -- comparación daba NULL y el insert pasaba sin límite alguno.
  IF max_allowed IS NULL THEN
    max_allowed := 0;
  END IF;
```
El resto (qué cuenta, contra qué compara, el mensaje `'Límite de propiedades alcanzado
para el plan actual (máximo: %)'` con `ERRCODE = 'check_violation'`) quedó igual. Su
trigger sigue siendo `BEFORE INSERT OR UPDATE`.

### Dato que usé para el diseño

Los dos triggers son `BEFORE INSERT` sobre la misma tabla, y **Postgres los dispara en
orden alfabético de nombre**: `trg_check_agency_approved` corre **antes** que
`trg_check_property_limit`. O sea que una agencia sin aprobar y con el cupo lleno recibe
el error de aprobación, no el de límite. La interfaz replica ese mismo orden (§5, §6).

### Estado de los datos

```json
[{"approval_status":"approved","agencias":10,"con_matricula":0}]
```
Las 10 agencias están `approved` y ninguna tiene matrícula. **Hoy nadie ve el aviso ni el
bloqueo**: hacen falta agencias `pending`/`rejected` para probarlo (§8).

---

## 2 · Archivos

### Creados (5)

| Archivo | Qué es |
|---|---|
| `src/components/feedback/Notice.tsx` | **El componente de aviso reutilizable**: Server Component, tres tonos (`info`/`warning`/`error`), título + ícono + contenido |
| `src/components/dashboard/AgencyApprovalNotice.tsx` | Aviso de dominio: recibe estado y motivo ya resueltos y arma el mensaje de pendiente o rechazada |
| `src/lib/utils/licenseNumber.ts` | Formato y normalización de la matrícula, compartidos por el alta y por Preferencias |
| `src/lib/utils/getLatestRejectionNote.ts` | Lee el motivo del último rechazo con service role, verificando pertenencia |
| `src/lib/utils/getPublishBlock.ts` | Espejo en la interfaz de los dos triggers: dice si se puede publicar y por qué no |
| `src/components/dashboard/AgencyIdentityForm.tsx` | Edición (o lectura, si está aprobada) de nombre + matrícula |

*(son 6 archivos nuevos contando el form de identidad)*

### Modificados (11)

| Archivo | Qué cambió |
|---|---|
| `register/RegisterForm.tsx` | Campo de matrícula obligatorio, junto al nombre de la inmobiliaria |
| `register/actions.ts` | Guarda `license_number`; **rollback del usuario de Auth** si falla la agencia o el agente; comentario del reintento de slug corregido |
| `dashboard/page.tsx` | Monta el aviso entre el título y las tarjetas; pasa el estado al botón; el enlace del estado vacío ahora se gatea |
| `dashboard/propiedades/page.tsx` | Pasa el estado al botón y el motivo de bloqueo a la tabla |
| `dashboard/propiedades/nueva/page.tsx` | **Gate de la ruta**: corta antes de renderizar el formulario |
| `dashboard/propiedades/actions.ts` | Distingue los dos motivos de rechazo del insert (helper `translatePropertyWriteError`) |
| `dashboard/preferencias/page.tsx` | Monta el aviso y el form de identidad |
| `dashboard/preferencias/actions.ts` | `updateAgencyIdentityAction`: guarda nombre + matrícula y reenvía la solicitud |
| `components/dashboard/NewPropertyButton.tsx` | Dos motivos de bloqueo con mensajes distintos |
| `components/dashboard/PropertiesTable.tsx` | Prop `publishBlockMessage` para el estado vacío |

---

## 3 · El componente de aviso, y dónde lo monté

**Dos piezas, separadas a propósito:**

1. **`Notice`** (`src/components/feedback/Notice.tsx`) — genérico y reusable. Server
   Component (sin `"use client"`), sin estado, sin botón de cerrar. Tres tonos según
   DESIGN §2: `info` sobre `mist` (neutro, nadie hizo nada mal), `warning` terracota
   suave, `error` sobre `terracota-subtle`. Lleva `role="status"`.
   **Por qué no reusé el "banner de error" que ya existe copiado en cuatro lugares:** ese
   es descartable, tiene `useState` de cliente y comunica que algo falló. Este se queda
   mientras el estado dure y describe una situación normal. Son cosas distintas y
   mezclarlas habría dado un aviso que se puede cerrar y no vuelve.
2. **`AgencyApprovalNotice`** — el de dominio. Presentacional puro: recibe
   `status` y `rejectionNote` ya resueltos y no consulta nada. Devuelve `null` si la
   agencia está aprobada.

**Los dos mensajes:**
- **Pendiente** (tono `info`, ícono `Clock`): *"Tu cuenta está en revisión — Estamos
  verificando la matrícula de tu inmobiliaria. Hasta que la aprobemos no vas a poder
  publicar propiedades, pero sí podés ir dejando todo listo: completá tu perfil y los
  datos de tu inmobiliaria."*
- **Rechazada** (tono `error`, ícono `ShieldX`): *"Tu solicitud no fue aprobada"* +
  **Motivo: <la nota del dueño>** + *"Corregí los datos de tu inmobiliaria y tu solicitud
  vuelve a revisión automáticamente"* + enlace **"Corregir los datos"** → Preferencias.
  Si no hay nota registrada, se omite la línea del motivo sin dejar un hueco raro.

**Dónde lo monté: en dos pantallas.**
- **`/dashboard`** (pedido): entre el `<h1>` y la grilla de tarjetas, en un `div` con
  `mb-8` que respeta el ritmo vertical de la página.
- **`/dashboard/preferencias`** (decisión mía, justificada): es la pantalla donde se
  corrige lo que motivó el rechazo. Si la persona llega desde el enlace del aviso, tiene
  que **seguir viendo el motivo mientras edita** en vez de recordarlo de memoria. Ahí el
  aviso va con `showEditLink={false}` — es la pantalla del enlace, mandarla a sí misma
  sería ruido.

No lo puse en el resto (Propiedades, Consultas, Equipo, Perfil, Suscripción): repetir el
mismo cartel en siete pantallas lo convierte en ruido que se deja de leer, y en
Propiedades el bloqueo ya se explica al lado del botón.

---

## 4 · Cómo leo la nota del rechazo, y qué verifico

`src/lib/utils/getLatestRejectionNote.ts`. La consulta es la última fila de
`agency_reviews` de esa agencia con `decision = 'rejected'`:

```ts
const admin = createAdminClient();
const { data } = await admin
  .from("agency_reviews")
  .select("note")
  .eq("agency_id", agencyId)
  .eq("decision", "rejected")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

**Service role, porque no hay alternativa:** `agency_reviews` tiene RLS habilitada y cero
policies, así que el client normal no lee nada de ahí. Eso es deliberado (la tabla existe
justamente para que la nota no sea pública), pero el precio es que **la barrera de
pertenencia la tiene que poner el código**.

**Qué verifico antes de devolver nada — dos condiciones, en este orden:**

```ts
const session = await resolveAgentSession();
if (session.status !== "ok") return null;          // 1. hay sesión y resuelve agencia
if (session.agent.agency_id !== agencyId) return null;  // 2. es SU agencia
```

El `agencyId` **no se acepta como autoridad**: se compara contra el que sale de la fila
`agents` por `auth.uid()`. Llamar al helper a mano con el id de otra agencia devuelve
`null`, no la nota. Es la misma disciplina que el resto del proyecto ("el `agency_id`
siempre del server, nunca del cliente").

Además, la lectura **solo ocurre si hace falta**: las páginas la piden únicamente cuando
`approval_status === "rejected"`.

---

## 5 · Cómo distingo los dos motivos si comparten el SQLSTATE

**Por el texto del mensaje, chequeando primero el de aprobación.** Un helper único en
`propiedades/actions.ts`, usado por los tres puntos que escriben propiedades:

```ts
function translatePropertyWriteError(
  dbError: DbLikeError,
  fallback: string,
  limitMessage: string
): string {
  if (dbError.message.includes("no está aprobada")) {
    return "Tu inmobiliaria todavía no está aprobada, así que no podés publicar propiedades.";
  }
  if (dbError.code === "23514" || dbError.message.includes("Límite")) {
    return limitMessage;
  }
  return fallback;
}
```

Tres decisiones detrás:

1. **El código no alcanza.** Los dos triggers usan `check_violation` → SQLSTATE 23514.
   Mirar el mensaje es la única señal disponible. Lo dejé escrito en el comentario del
   helper para que nadie lo "simplifique" volviendo a matchear solo por código.
2. **El de aprobación va primero** por dos motivos que coinciden: es el que dispara
   primero en la base (orden alfabético de triggers), y porque decirle *"alcanzaste el
   límite de tu plan"* a alguien que no fue aprobado **es falso y además lo manda a pagar
   un plan que no le va a destrabar nada**.
3. **Un solo helper para los tres sitios** (activar, crear, editar), cada uno con su
   `fallback` y su `limitMessage` propios — el de editar dice además *"No podés volver a
   activar esta propiedad"*, como antes.

⚠ Acoplamiento conocido: el match depende del texto de las funciones de la base. Ya
existía (el `includes("Límite")` estaba desde antes) y no lo empeoré, pero si alguien
edita el mensaje de un trigger tiene que tocar esto. Está comentado.

---

## 6 · Los cuatro puntos de entrada al formulario

Todos usan **el mismo criterio**, centralizado en `getPublishBlock(planUsage,
approvalStatus)` — el espejo en la interfaz de los dos triggers. Cubre **los dos
motivos** en los cuatro puntos, no solo el nuevo.

| # | Punto de entrada | Antes | Ahora |
|---|---|---|---|
| 1 | Botón "Nueva propiedad" (`NewPropertyButton`, montado en `/dashboard` y en `/dashboard/propiedades`) | Solo gateaba por límite de plan | Gatea por **los dos**, con mensaje distinto para cada uno. Nunca se oculta: deshabilitado + mensaje constructivo (DESIGN §12) |
| 2 | Enlace "Publicar primera propiedad" del estado vacío de `/dashboard` | **Sin gate**: llevaba al formulario siempre | Si hay bloqueo, en vez del enlace se muestra el motivo |
| 3 | El mismo enlace en el estado vacío de `PropertiesTable` | **Sin gate** | Ídem, vía la prop nueva `publishBlockMessage` |
| 4 | La ruta `/dashboard/propiedades/nueva` | **Sin gate**: se llegaba por URL | Corta antes de renderizar: `if (getPublishBlock(...)) redirect("/dashboard/propiedades")` |

Los mensajes del botón, según el motivo:
- **Pendiente:** *"Vas a poder publicar cuando aprobemos tu inmobiliaria. Mientras tanto
  podés completar tus datos."* — sin mencionar ningún plan: el bloqueo no se resuelve
  con plata.
- **Rechazada:** *"Tu solicitud no fue aprobada, así que todavía no podés publicar"* +
  enlace **"Corregir los datos"**.
- **Cupo lleno:** el mensaje de upgrade que ya existía, intacto (o el de contacto si está
  en premium).

Sobre el punto 4: elegí `redirect("/dashboard/propiedades")` y no un mensaje en la propia
ruta porque el listado es donde el motivo ya está explicado (por el botón y por el estado
vacío), así que la persona aterriza en la explicación en vez de en una pared.

---

## 7 · Cómo se valida en el server que no se editen los campos con la agencia aprobada

En `updateAgencyIdentityAction` (`preferencias/actions.ts`), y **la fila se relee del
server**:

```ts
const session = await resolveAgentSession();
if (session.status !== "ok") return { error: "No autenticado" };
if (session.agent.role !== "admin") return { error: "No autorizado" };

const admin = createAdminClient();
const { data: agency } = await admin
  .from("agencies")
  .select("approval_status")
  .eq("id", session.agent.agency_id)   // ← el id sale de la sesión, no del cliente
  .maybeSingle();

if (!agency) return { error: "No se encontró la agencia" };

if (agency.approval_status === "approved") {
  return { error: "Tu inmobiliaria ya está aprobada: el nombre y la matrícula no se pueden cambiar…" };
}
```

Cuatro barreras, todas server-side: hay sesión → es admin de agencia → el `agency_id` sale
de la fila `agents` por `auth.uid()` → el `approval_status` se lee de la fila real, **no
del que trae la sesión ni del que mande el cliente**.

Esto importa especialmente acá: `agencies` **no tiene policy de UPDATE**, así que la
escritura va con service role y la RLS no protege nada. Deshabilitar los inputs en
`AgencyIdentityForm` es cosmético, y está comentado como tal en los dos archivos.

**El reenvío:** si estaba `rejected`, el update incluye `approval_status: "pending"` y la
action devuelve `{ resubmitted: true }`, que el form usa para decir *"Datos guardados. Tu
solicitud volvió a quedar en revisión."* Si estaba `pending`, el estado no se toca.

**El `slug` no se toca** en ningún caso (fuera de alcance, y cambiarlo rompería la URL
pública de la agencia). Está comentado en la action.

Cuando la agencia está aprobada, el form **no oculta los campos**: los muestra en modo
lectura con un candado y la explicación de por qué están fijos.

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

**No apareció ningún warning nuevo en `RegisterForm.tsx`**: el campo de matrícula se
resolvió con `register("licenseNumber")` y validación en el schema, **sin usar `watch()`**.
No hacía falta: el campo no condiciona el render de nada.

### `npx next build` — exit code **0**
```
✓ Compiled successfully in 9.0s
✓ Generating static pages using 3 workers (18/18) in 1271ms

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

| | Baseline | Ahora | |
|---|---|---|---|
| Errores TypeScript | 0 | **0** | igual |
| Errores de lint | 0 | **0** | igual |
| Warnings de lint | 1 (`PropertyForm.tsx:232`) | **1** (el mismo) | igual |
| Build | verde, 18 rutas | verde, **18 rutas** | igual |

**Sin regresiones y sin rutas nuevas.**

**Lo que la verificación automática NO cubre.** No hay tests y no levanté el dev server.
Y hay un límite concreto: **las 10 agencias de la base están `approved`**, así que el
aviso, el bloqueo y el form de identidad editable **no se pueden ver hoy sin crear el
estado**. Los dos caminos para probarlo a mano:
1. **Registrar una agencia nueva** — nace `pending` por el DEFAULT, así que sirve para el
   aviso de pendiente, el bloqueo de publicación y la edición de matrícula.
2. **Rechazarla desde `/admin`** con una nota — sirve para el aviso de rechazo (con el
   motivo), el enlace a Preferencias y el reenvío al guardar.

---

## 9 · Decisiones que se apartan de las instrucciones

1. **El componente de aviso quedó partido en dos** (`Notice` genérico +
   `AgencyApprovalNotice` de dominio) en vez de uno solo. Pediste uno reutilizable; si el
   componente reusable tuviera adentro la copia de aprobación, no sería reusable. Así
   `Notice` sirve para cualquier aviso futuro y la copia vive en su capa.
2. **`Notice` vive en `src/components/feedback/`, una carpeta nueva.** No lo puse en
   `ui/` porque CLAUDE.md define esa carpeta como "shadcn/ui components" y este no lo es;
   tampoco en `dashboard/` porque no es exclusivo del dashboard.
3. **La copia de los avisos no sale de `labels.ts`.** La regla es para mapas
   `Record<TipoDelDominio, string>`; estos son párrafos con enlaces embebidos. `labels.ts`
   ya tiene `APPROVAL_STATUS_LABELS` para el literal del estado, que es lo que sí
   corresponde ahí (lo usa el panel `/admin`).
4. **Creé `getPublishBlock`**, que no estaba pedido. Sin él, los cuatro puntos de entrada
   habrían replicado el mismo criterio cuatro veces — que es exactamente el tipo de
   duplicación que este proyecto ya pagó caro con la consulta de sesión.
5. **El gate de la ruta redirige en vez de mostrar un mensaje** (§6).
6. **El aviso también va en Preferencias** (§3), justificado arriba.
7. **En el rollback del registro borro el usuario de Auth pero NO la agencia** cuando
   falla el insert de `agents`. Motivo: si el insert falló por una carrera y no por el
   alta en sí, borrar la agencia podría pisar datos. El usuario huérfano es el problema
   real (sesión válida sin cuenta usable); una agencia sin agentes es visible en `/admin`
   y el dueño la limpia. Está comentado en el código.

---

## 10 · Encontrado y NO tocado

1. **El índice único de matrícula es parcial (solo entre aprobadas) y por `(city_id,
   license_number)`.** Consecuencia práctica que ahora sí es alcanzable: dos agencias
   pendientes pueden cargar la misma matrícula, y el choque aparece **al aprobar la
   segunda** — donde el dueño verá el mensaje genérico "No se pudo actualizar la
   agencia", no "esa matrícula ya está aprobada". Ya lo había señalado en un informe
   anterior; con la matrícula ahora obligatoria en el alta, deja de ser hipotético.
2. **No se valida que la matrícula exista en el padrón.** El formulario acepta cualquier
   cadena con el formato correcto; la verificación real es el ojo del dueño en `/admin`.
   Es lo acordado, pero conviene tenerlo presente.
3. **`register/actions.ts` sigue sin rollback del upsert de `subscriptions`.** Agregué el
   rollback en las dos ramas que pediste (agencia y agente). Si falla la suscripción,
   quedan usuario + agencia + agente creados y una agencia **sin fila de suscripción** —
   que con el `check_property_limit` actualizado ahora significa **límite 0**. No es un
   huérfano de Auth (la cuenta funciona), así que borrar el usuario ahí sería peor; pero
   es un estado que hoy nadie repara.
4. **Los 2 usuarios de Auth huérfanos que ya existen no se limpiaron.** El rollback evita
   los nuevos, no borra los viejos. Se limpian desde el panel de Supabase.
5. **El "banner de error" sigue copiado a mano en cuatro lugares.** No los migré a
   `Notice`: son de otra naturaleza (descartables, con estado de cliente) y migrarlos
   habría cambiado comportamiento visible en pantallas que esta tarea no toca.
6. **La documentación quedó atrás.** `CLAUDE.md` no menciona la matrícula, el aviso, el
   gate de publicación ni los componentes nuevos; `PENDIENTES.md` tampoco. Es una pasada
   aparte.
