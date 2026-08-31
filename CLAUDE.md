# CLAUDE.md — App Mapa Inmobiliario (Marka)

> Este archivo provee contexto persistente a Claude Code sobre la arquitectura, convenciones y reglas del proyecto. Leerlo antes de cualquier tarea de código.

---

## Resumen del Proyecto

Marketplace inmobiliario por ciudad llamado **Marka**. Una sola web pública donde el visitante ve en un mapa interactivo las propiedades de **todas las agencias de su ciudad**, filtra, y contacta al agente por WhatsApp. Las agencias pagan una suscripción para publicar.

**Modelo de negocio:** SaaS B2B, **solo para inmobiliarias** (no hay cuentas de particular). **Tres planes de venta:** inicial (20 propiedades), profesional (60, + white-label), premium (200, + white-label + destacados + métricas). El visitante no paga ni se registra.

**`free` NO es un plan de venta, es un estado.** La columna `subscriptions.plan` admite un cuarto valor, `free` (límite 1), que es el **estado de aterrizaje** de toda alta: la agencia nace ahí y sigue ahí mientras espera que el dueño de la app active el plan pago que pidió. Nunca se ofrece como opción. Ver "Suscripciones y límites".

**Dos tipos de usuario:**
- **Visitante (cliente)**: sin registro. Navega el mapa, filtra, ve detalles, contacta por WhatsApp, guarda favoritos localmente.
- **Agente (cliente de pago)**: login. CRUD de propiedades, perfil, preferencias, suscripción, métricas de sus propiedades y leads.

**Arquitectura:** marketplace multi-tenant. Un solo mapa por ciudad muestra todas las agencias juntas, pero los datos están separados por `agency_id` y `city_id`, lo que permite a futuro activar vistas white-label (`agencia.dominio.com` con solo sus propiedades) sin reescribir nada.

**Distribución:** web responsive + PWA instalable. No hay app nativa ni stores.

**Estado:** Deployado en Vercel, **sin datos reales todavía** (lo cargado es de prueba; el lanzamiento con inmobiliarias fundadoras se apunta a octubre). MVP + multi-agente completos. **Fase White-label cerrada** en lo esencial: Sub-pieza A (ruta `/[slug]` + mapa filtrado + gate de plan), B1 (subir logo) y B2a (mostrar logo + nombre + "powered by Marka." en el header) hechas y probadas. **B2b (variante admin en `disabled`) y C (slug editable) quedan EN PAUSA**. **Fase de modelo de agencias CERRADA** (ago 2026): solo-agencias, matrícula + aprobación manual, bloqueo de publicación en la base, sesión unificada. Ver "Aprobación de agencias" abajo.

**Baseline de calidad medido (no documentado de memoria):** `npx tsc --noEmit` 0 errores, `npm run lint` **0 errores y 1 warning** (`PropertyForm.tsx:269`), `npx next build` verde con **19 rutas**. Cualquier error nuevo, un warning distinto del único conocido, o una ruta que aparezca sin motivo, es una regresión. Ver "ESLint".

> **⚠️ Hoja de ruta de modelo (tras validación con el rubro y el colegio de corredores).** **Ya aplicado:** los particulares se eliminaron (la app es solo-agencias); las agencias requieren **número de matrícula + aprobación manual** del dueño de la plataforma (ver "Aprobación de agencias"); y el formulario de propiedad tiene el **atajo de sugerencia de ubicación desde la dirección** (ver "Ubicación de la propiedad"), que era el ítem D1 de la hoja de ruta. **Pendiente:** precio opcional en las propiedades ("Consultar"/"a convenir") y requisitos de alquiler; registro opcional de visitantes; página y link por propiedad; y **filtrar el mapa público por agencia habilitada** (hoy NO filtra — ver PENDIENTES.md, es bloqueante para cobrar). Ver PENDIENTES.md → "Nueva fase".

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) + React + TypeScript |
| Estilos | Tailwind CSS + shadcn/ui (preset Sera) |
| Mapa | react-leaflet + OpenStreetMap + leaflet.markercluster |
| Estado global | Zustand (filtros del mapa + ciudad activa) |
| Formularios | react-hook-form + zod |
| DB + Auth + Storage | Supabase (PostgreSQL + PostGIS) |
| PWA | manifest + service worker |
| Deploy | Vercel |
| Node.js | 20+ (requerido por Next.js 16) |

---

## Modelos de Negocio y Multi-Tenancy — Reglas Críticas

### Marketplace por ciudad
- El visitante ve propiedades de **todas las agencias de UNA ciudad** en el mismo mapa.
- Toda query pública de propiedades **filtra por `city_id`**. Nunca mostrar propiedades de otra ciudad.
- La ciudad activa se gestiona con `cityStore` (Zustand): localStorage → geolocalización → primera ciudad activa.

### Multi-tenant
- Toda propiedad pertenece a una `agency_id` (NOT NULL) y a una `city_id` (NOT NULL).
- `city_id` está **denormalizado en `properties`** para filtrar el mapa sin JOIN.
- Al crear una propiedad, copiar `city_id` y `agency_id` del agente autenticado — nunca del cliente.

### Roles de agente (Fase 3 — parcial)
- `agents.role` (`admin`/`agent`) **ya está migrado** en la base. Backfill aplicado: el admin de cada agencia es el agente más antiguo.
- **`role` YA gatea la sección "Equipo"** (crear/listar agentes): la página `/dashboard/equipo` y la action `createAgentAction` validan `role === 'admin'` server-side, y el ítem del sidebar se muestra solo a admins (`isAgencyAdmin`). La pantalla **Consultas** (`/dashboard/leads`) también diferencia por rol: usa la policy `Admin reads agency leads` (un admin ve los leads de toda su agencia; un agente, solo los suyos) — la query filtra por `agency_id` y la RLS recorta sola. El admin además **gestiona** (edita/elimina/cambia estado de) las propiedades de toda su agencia, no solo las suyas, y puede **reasignar el `agent_id`** de una propiedad a otro agente de su agencia (ver "Gestión de propiedades por el admin" abajo).
- **Dos "admin" distintos, no mezclar:** `isAppAdmin` (dueño de la plataforma, por `ADMIN_USER_ID`, gatea `/admin`) vs `isAgencyAdmin` (`agent.role === 'admin'`, admin de su agencia, gatea "Equipo"). El layout del dashboard calcula ambos y los pasa al Sidebar.
- **Gestión de equipo (`/dashboard/equipo`, `equipo/actions.ts`, solo admin):** el admin **crea** agentes (`createAgentAction`: `admin.auth.admin.createUser` con `email_confirm: true` + contraseña temporal que comparte; NO `signUp`, que pisaría su sesión; rollback con `deleteUser` si el insert en `agents` falla) y **elimina** agentes (`deleteAgentAction`, **Modelo B**: reasigna las propiedades del agente al admin ANTES de borrar, así nunca quedan huérfanas; después `admin.auth.admin.deleteUser` cascadea —borra la fila `agents`, pone los leads viejos en `agent_id NULL` (historial, los ve el admin en Consultas como "Sin agente asignado")—; el orden importa por la FK `ON DELETE SET NULL`). Barreras de `deleteAgentAction`: no auto-borrarse (la agencia no queda sin admin), ser admin, y que el agente target sea de la misma agencia (todo server-side). El `agency_id` del caller siempre del server. Falta (pieza siguiente): **desactivar** agente (`is_active`, reversible).
- **Gestión de propiedades por el admin (`propiedades/actions.ts`):** un admin de agencia edita/elimina/cambia estado de las propiedades de TODA su agencia; un agente normal, solo las suyas. La autorización vive en el helper **`authorizePropertyAccess(id)`** (reemplazó a `verifyOwnership`): lee la propiedad por id, y devuelve `mode: "owner"` si `agent_id === auth.uid()` (escribe con client normal, la RLS lo permite) o `mode: "admin"` si el user es `role === 'admin'` y su `agency_id` coincide con el de la propiedad (escribe con **service role**, porque la RLS `agent_id = auth.uid()` bloquearía al admin sobre algo ajeno). Cualquier otro caso → "Propiedad no encontrada" (mismo mensaje que "no existe", no revela propiedades ajenas). **El helper decide qué client usar (`db`), no cada action** — imposible que una action olvide el client correcto. `role`/`agency_id` del caller SIEMPRE del server; la igualdad de `agency_id` es la única barrera en `mode: "admin"`. Las policies RLS NO se tocaron (opción service role, no policy nueva). El listado (`propiedades/page.tsx`) filtra por `agency_id` si admin (con columna "Agente") o por `agent_id` si no. `[id]/editar` permite abrir propiedades de la agencia si el user es admin.
- **Reasignar `agent_id` (admin, crear y editar):** el `PropertyForm` muestra un selector "Agente asignado" **solo si recibe `agencyAgents`** (las páginas lo pasan solo cuando el caller es admin; un agente normal no ve el campo). El input pasa por **`resolveAssignedAgent`** en la action, con tres barreras server-side: (1) si el caller no es `admin` → se ignora (devuelve null); (2) el destino debe existir **dentro de la agencia** (`.eq("agency_id", agencyId)`) → reasignar a otra agencia es imposible por construcción; (3) `role`/`agencyId` salen del server, el cliente solo aporta el `id` candidato. El peor caso de un input manipulado es "no se reasigna", nunca una reasignación no autorizada. Sutileza de RLS: como `Agent manages own properties` no tiene `WITH CHECK` explícito, escribir un `agent_id` ≠ `auth.uid()` rebota con el client normal → al reasignar se usa **service role** (en create si nace a nombre de otro; en update incluso cuando un admin reasigna SU PROPIA propiedad, caso `mode: "owner" && reassigning`). Leads nuevos van al nuevo agente (el modal copia `property.agent_id`); los viejos quedan con el anterior (no retroactivo). Reasignar no afecta el conteo del plan (por `agency_id`) ni dispara el trigger de límite.
- Modelo previsto a futuro: `admin` además gestiona la suscripción y ve los leads de toda la agencia; `agent` hace CRUD de lo suyo.
- **Registro: SOLO INMOBILIARIAS, en dos pasos.** Paso 1 (`/register`): crea agencia nueva + agente `admin` + suscripción `free`/`active`, siempre. **No hay selector de tipo de cuenta**: `tenant_type: 'agency'` lo escribe el servidor, fijo. Campos obligatorios de la agencia: **razón social** (con `.trim()`, para que un nombre de solo espacios no pase) y **número de matrícula** del colegio de corredores. Paso 2 (`/register/plan`): elige plan. **Ambos caminos terminan en el paso 2**.
  - **La matrícula se guarda como TEXTO, nunca como número** (`agencies.license_number`): los ceros a la izquierda son parte de la matrícula, y aunque en Santiago del Estero es solo numérica, otras provincias usan letras. Formato y normalización (sin espacios, en MAYÚSCULAS, alfanumérico + guiones, hasta 20) viven en **`src/lib/utils/licenseNumber.ts`**, compartidos por el formulario y por las server actions — el cliente valida para dar feedback, el server valida de nuevo porque es la única barrera real.
  - **El alta NO escribe `approval_status`**: el DEFAULT de la base deja la agencia en `'pending'`. Escribirlo desde el código sería darle al alta la capacidad de auto-aprobarse.
  - **`registerAction` hace rollback del usuario de Auth** si falla el insert de `agencies` o el de `agents` (`admin.auth.admin.deleteUser`), igual que `createAgentAction`. Sin eso quedaba un `auth.users` huérfano: una sesión válida que no resuelve ninguna inmobiliaria. **Ojo: el upsert de `subscriptions` todavía no tiene rollback** (ver PENDIENTES.md).
- **Selección de plan (`/register/plan`):** modelo `plan` (lo que RIGE) vs `pending_plan` (lo PEDIDO). Ofrece **solo los tres planes pagos** (`PAID_PLANS`, derivado de `PLAN_ORDER` filtrando `free` dentro del componente — **no** se saca `free` de `PLAN_ORDER`, que es el dominio de la columna). Al elegir: `plan` queda en `free`, `pending_plan` = el elegido, `status: 'pending'`, y `property_limit`/`has_*` de free hasta la activación manual. **Nunca se pisa `plan` al pedir un upgrade** — lo pedido vive en `pending_plan`. Ninguna card viene preseleccionada y "Continuar" arranca deshabilitado, así que la pantalla no puede mandar `'free'` a la action. Se puede saltear con "Decidir más tarde" (link a `/dashboard`). La server action deriva el `agency_id` del `auth.uid()`, nunca del cliente, y usa admin client acotando el UPDATE a esa agencia (no hay policy de UPDATE de subscriptions para usuarios).
- **⚠ Guarda de reentrada en `/register/plan` (arreglo de bug, no tocar sin entender).** Esa ruta es **exclusivamente** para una agencia recién registrada que todavía no definió nada. La condición, idéntica en la página y en la action, es el "aterrizaje virgen": la suscripción existe **y** `plan === 'free'` **y** `pending_plan === null` **y** `status === 'active'`. Cualquier otro caso → `redirect("/dashboard/suscripcion")` en la página, y error sin escribir nada en la action. Va en los dos lugares porque **una server action se puede invocar sin pasar por el render**. El bug que cierra: la ruta quedaba accesible para siempre (el proxy compara `pathname === "/register"` con igualdad exacta, así que `/register/plan` no matchea) y la action escribía `plan: 'free'` + límites de free **incondicionalmente** — una agencia con plan pago activo que volviera ahí se auto-degradaba, perdía el white-label y quedaba por encima del límite, sin confirmación ni vuelta atrás. La action además rechaza explícitamente un `plan === 'free'` entrante. **La protección NO está en `proxy.ts`** (metería una query a la base en el middleware): si la buscás ahí, no está.
- **Pedir upgrade desde el dashboard** (`/dashboard/suscripcion`): mismo modelo. "Pasar a {plan}" pide confirmación y setea `pending_plan` + `status: 'pending'` SIN tocar `plan` ni los límites (el cliente sigue operando con lo que rige hasta la activación). El botón pasa a "Pendiente". Cancelar el pedido aún no está (el cliente escribe; ver PENDIENTES.md).
- **Activación (panel `/admin`)**: el admin de la plataforma lee `pending_plan`, lo copia a `plan`, sube `property_limit`/`has_*` a los reales, `status: 'active'`, sella `activated_at`, y limpia `pending_plan`. El gating en runtime (badge, dashboard, bloqueo de "Nueva propiedad") usa siempre el plan que RIGE vía `getPlanUsage`, nunca el pedido.
- Las altas siguientes a una agencia existente (por invitación) caerán en `agent` — pieza futura.
- `tenant_type` (en `agencies`) es **LEGACY**: sigue existiendo en la base (`agency`/`individual`, default `agency`, con su CHECK) pero **el registro escribe siempre `'agency'`** y no hay ningún flujo que produzca `'individual'`. Se verificó por consulta que **nada en la base la lee**: cero triggers, funciones o policies la consultan. Su único consumidor es la columna "Tipo" del panel `/admin`, que muestra filas históricas. **No se borró a propósito** (borrarla no aporta nada y ensucia el trabajo de matrícula/alta manual que va a volver a tocar esa tabla). `phone_wa` de agencia (`agencies.phone_wa`) **ya está migrado y es NOT NULL** (obligatorio): el registro lo setea heredando el del admin fundador, y el admin lo edita en Preferencias. Es distinto de `agents.phone_wa` (el del agente, editable en Perfil).

### Aprobación de agencias (matrícula) — EJE INDEPENDIENTE DE LA SUSCRIPCIÓN

- **`agencies.approval_status`** (`pending`/`approved`/`rejected`, DEFAULT `'pending'`) responde **"¿es una inmobiliaria legítima?"**. `subscriptions.plan`/`status` responden **"¿paga?"**. **Son dos ejes distintos y no se derivan uno del otro**: una agencia puede estar aprobada sin plan pago, o pagar y seguir pendiente de aprobación. No mezclarlos en una misma clasificación (el panel `/admin` los muestra como dos grupos de filtros separados, a propósito).
- **Quién decide:** el dueño de la plataforma, a mano, desde `/admin`. No hay verificación automática contra el padrón: el padrón del colegio es público, así que verificar la matrícula probaría que EXISTE, no que quien la carga sea su dueño.
- **El rechazo NO es definitivo.** Una agencia rechazada conserva todos sus datos, corrige lo que estaba mal en Preferencias y **vuelve a `'pending'` sola**, sin que el dueño intervenga. No existe un estado de rechazo permanente.
- **Una agencia pendiente o rechazada puede usar casi todo el panel** — perfil, logo, teléfono, ver sus secciones. **Lo ÚNICO bloqueado es publicar propiedades.** Razón de negocio: si alguien se registra un martes y se lo aprueba el jueves, que pueda dejar la cuenta lista mientras tanto; el cuello de botella real del producto es la carga de propiedades, no el alta.
- **La nota del rechazo vive en `agency_reviews`, NO en `agencies`.** Dos motivos, los dos load-bearing: (1) `agencies` tiene la policy `Public read agencies` con `qual: true`, o sea que **cualquiera con la anon key puede leer la tabla entera**, y Postgres no permite restringir columnas dentro de una policy — la nota es un texto que el dueño escribe sobre un tercero y no puede ser pública; (2) como el rechazo no es definitivo, cada decisión es una fila y no pisa a la anterior. **`agency_reviews` tiene RLS habilitada y CERO policies a propósito**: solo se accede con service role desde el server. No agregarle policies "por prolijidad".
- **Leer la nota:** `getLatestRejectionNote(agencyId)` (`src/lib/utils/`). Usa service role (no hay alternativa) y **la barrera de pertenencia la pone el código**: el `agencyId` se compara contra el de la sesión antes de consultar, así que pedir la nota de otra agencia devuelve `null`.
- **Índice único de matrícula: PARCIAL a propósito** — `(city_id, license_number) WHERE approval_status = 'approved' AND license_number IS NOT NULL`. Si fuera un UNIQUE común, una solicitud con una matrícula ya usada reventaría en el registro: la solicitud legítima (un tipeo, una agencia que rehace el alta) nunca llegaría al panel, y **un impostor que probara matrículas ajenas recibiría del propio formulario la confirmación de cuáles existen**. Con el índice parcial la solicitud entra, queda pendiente, y el choque ocurre al aprobar la segunda — frente a una persona que puede resolverlo. ⚠ **Limitación conocida:** los colegios de corredores son **PROVINCIALES**, no municipales; revisar el día que se abra una segunda ciudad de la misma provincia.
- **Nombre y matrícula son editables SOLO mientras está `pending` o `rejected`; se bloquean al aprobar.** El nombre está semi-regulado por el colegio, así que cambiarlo después de la aprobación tendría que ser otro flujo de aprobación que hoy no existe. ⚠ **`agencies` NO tiene policy de UPDATE**, así que la escritura va con service role y **deshabilitar los inputs es cosmético**: la regla la aplica `updateAgencyIdentityAction`, que relee `approval_status` de la fila real (no del que trae la sesión ni del cliente). Guardar con la agencia rechazada además la devuelve a `'pending'` (es el reenvío de la solicitud). El `slug` NO se toca nunca desde ahí.

### Bloqueo de publicación — dos triggers en la base, no policies

Sobre `properties` hay **dos triggers `BEFORE INSERT`** que rechazan el alta, y ambos usan `ERRCODE = 'check_violation'` (**SQLSTATE 23514**):

| Trigger | Función | Cuándo | Qué bloquea |
|---|---|---|---|
| `trg_check_agency_approved` | `check_agency_approved()` | **solo INSERT** | agencia con `approval_status <> 'approved'` (o sin fila) |
| `trg_check_property_limit` | `check_property_limit()` | INSERT **o** UPDATE | cupo del plan agotado (cuenta `active`+`paused` por `agency_id`) |

- **Por qué TRIGGERS y no policies RLS:** `createPropertyAction` usa **service role** cuando un admin publica a nombre de otro agente, y el service role **saltea las policies**. Los triggers corren siempre, sin importar el rol. Es la única barrera que cubre los dos caminos.
- **El de aprobación va solo en INSERT** a propósito: editar una propiedad ya cargada sigue permitido aunque la agencia se rechace después. No se le quitan a nadie las propiedades que ya publicó.
- **`check_property_limit()` trata "sin fila de suscripción" como límite 0** (antes `max_allowed` quedaba `NULL`, la comparación daba `NULL` y el insert pasaba **sin límite alguno**).
- **Los dos comparten SQLSTATE, así que el código los distingue POR EL TEXTO del mensaje**, chequeando primero el de aprobación (`translatePropertyWriteError` en `propiedades/actions.ts`). Dos motivos que coinciden: Postgres dispara los triggers **en orden alfabético de nombre**, y `trg_check_agency_approved` va primero; y decirle *"alcanzaste el límite de tu plan"* a alguien no aprobado es **falso** y lo manda a pagar un plan que no le destraba nada. ⚠ Ese match depende del texto de las funciones: si se edita el mensaje de un trigger, hay que tocar el helper.
- **La interfaz anticipa el rechazo con `getPublishBlock(planUsage, approvalStatus)`** (`src/lib/utils/`), el espejo de los dos triggers y **fuente única del criterio**. Devuelve `null` o `{ reason: "not_approved" | "plan_limit", message }`, con el mismo orden de prioridad que la base. **Los CUATRO puntos de entrada al alta lo usan** (antes solo uno tenía gate, y solo por límite de plan): el botón `NewPropertyButton` (montado en `/dashboard` y en `/dashboard/propiedades`), el enlace del estado vacío de `/dashboard`, el del estado vacío de `PropertiesTable`, y **la ruta `/dashboard/propiedades/nueva`**, que antes se alcanzaba escribiendo la URL y dejaba llenar el formulario entero para rechazarlo al guardar. DESIGN §12: el botón **nunca se oculta**, se muestra deshabilitado con el mensaje del motivo.

### Suscripciones y límites
- Cada agencia tiene una fila en `subscriptions` con `plan` (`free`/`inicial`/`profesional`/`premium`), `property_limit` y los entitlements `has_featured`/`has_white_label`/`has_metrics`.
- **`free` es estado de aterrizaje, no producto.** No se vende, no se ofrece y no se puede elegir. Los valores de `PLANS.free` (`propertyLimit: 1` + los tres flags en `false`) son los que **escriben** el registro y la selección de plan como estado inicial, y los que `getPlanUsage` usa de fallback si falta la fila. Su `name` (`"Gratis"`) es solo la etiqueta que ve una agencia que todavía no paga (badge del sidebar, card de plan actual, columna "Plan" de `/admin`). **Cambiar los números de `PLANS.free` cambia el andamio del modelo, no una etiqueta.**
- **Bajar de plan no es expresable en el modelo actual**: el CHECK de `pending_plan` solo admite planes pagos, así que no hay forma de registrar "esta agencia pidió bajar". Es coherente (el andamio solo modela subidas) pero hay que saberlo. Ver PENDIENTES.md.
- El límite se valida **en la DB** (trigger `check_property_limit`). El frontend lo anticipa pero la DB es la fuente de verdad.
- El conteo de propiedades usa **siempre `agency_id`**, nunca `agent_id`. Usar el helper `getPlanUsage` de `@/lib/utils/getPlanUsage`.
- `is_featured` solo puede ser `true` si la suscripción tiene `has_featured` (hoy: premium). Las server actions lo fuerzan a `false` silenciosamente si la agencia no lo tiene. **El gating se hace por el booleano `has_featured` (vía `planUsage.hasFeatured`), NUNCA comparando el nombre del plan (`=== "premium"`).**
- La creación de `agencies`, el insert de `agents` y la escritura de `subscriptions` en el registro se hacen **con service role** (`admin.ts`), nunca con el client normal.

---

## Estructura de Carpetas

```
/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx                 ← Mapa principal + lista mobile (home: todas las agencias de la ciudad activa)
│   │   │   └── [slug]/page.tsx          ← Vista white-label por agencia (resuelve slug → 404 / no-disponible / mapa filtrado). Sub-pieza A
│   │   ├── (agent)/
│   │   │   ├── login/                    ← page.tsx (Server: lee ?reason y lo mapea a un mensaje fijo) + LoginForm.tsx (client). Split-screen editorial (AuthLayout)
│   │   │   ├── logout/route.ts           ← Route handler GET: signOut() + redirect a /login?reason=. Existe porque un Server Component NO puede borrar cookies (ver "Cierre de sesión")
│   │   │   ├── register/                  ← page.tsx (Server: trae ciudades) + RegisterForm.tsx (client; SIN selector de tipo de cuenta, CON matrícula obligatoria). actions.ts escribe license_number y hace rollback del user de Auth si falla agencies/agents. Paso 2: plan/ (page Server + PlanSelector client + actions). La page Y la action llevan la GUARDA DE REENTRADA (solo "aterrizaje virgen"; ver arriba)
│   │   │   ├── dashboard/
│   │   │       ├── page.tsx             ← Home: 4 StatsCard + últimas propiedades. Métricas por rol: admin ve la agencia (agency_id), agente lo suyo (agent_id)
│   │   │       ├── propiedades/         ← Listado CRUD (admin ve toda la agencia + col. Agente; agente solo lo suyo) + nueva + [id]/editar + loading.tsx. actions.ts con authorizePropertyAccess (owner/admin)
│   │   │       ├── equipo/              ← Gestión de agentes (solo admin de agencia): page (Server, gatea role, cuenta props por agente) + actions (createAgentAction + deleteAgentAction, service role). Borrar reasigna props al admin (Modelo B) antes de borrar
│   │   │       ├── leads/               ← Consultas (ambos roles; RLS recorta: agente ve los suyos, admin los de la agencia). page (Server) + LeadsContent (client)
│   │   │       ├── perfil/
│   │   │       ├── preferencias/         ← Preferencias personales (localStorage) + datos de la agencia (solo admin): identidad (AgencyIdentityForm + updateAgencyIdentityAction: nombre + matrícula, editables solo si NO está aprobada; guardar con la agencia rechazada la devuelve a 'pending'), teléfono (AgencyPhoneForm) y logo (AgencyLogoForm). Todos service role. page Server, muestra además el AgencyApprovalNotice
│   │   │       └── suscripcion/
│   │   │   └── admin/                   ← Panel de plataforma. OJO: vive DENTRO del route group (agent), o sea `src/app/(agent)/admin/`, aunque la URL sea /admin. Solo dueño, gateado por ADMIN_USER_ID en su layout.tsx: 6 métricas de negocio (StatsCard) + tabla de TODAS las agencias + filtros aditivos + activar planes. layout (Server, gating + sidebar) + page (Server) + AgenciesTable (client) + actions. USA el sidebar del dashboard ("Panel admin" activo)
│   │   └── api/
│   │       └── geocode/route.ts         ← POST /api/geocode: intermediaria del buscador de direcciones. Está FUERA de los route groups y el proxy NO la cubre → gate de sesión propio adentro del handler. La ciudad la deriva del servidor. Ver "Ubicación de la propiedad"
│   │
│   ├── components/
│   │   ├── brand/
│   │   │   └── Wordmark.tsx             ← "Marka." con punto terracota (Lote 0)
│   │   ├── auth/
│   │   │   └── AuthLayout.tsx           ← Shell split-screen de login/register
│   │   ├── map/
│   │   │   ├── MapView.tsx              ← Raíz del mapa (client, ssr:false)
│   │   │   ├── PropertyMarker.tsx       ← Pin terracota + estados (CSS sobre DivIcon)
│   │   │   ├── PropertyModal.tsx        ← Drawer/sheet + flujo WA + carrusel
│   │   │   ├── FilterPanel.tsx          ← Filtros (checkboxes shadcn, commit on-blur)
│   │   │   ├── CityPicker.tsx           ← Selector de ciudad (lee cityStore)
│   │   │   ├── AgencyMapView.tsx        ← Mapa filtrado a una agencia (white-label, mirror de la home SIN CityPicker). Header con logo + nombre de la agencia + "Powered by Marka." (B2a). Sub-pieza A/B2a
│   │   │   └── ClusterLayer.tsx         ← Clustering, diff por id, estados live
│   │   ├── agency/
│   │   │   └── AgencyUnavailable.tsx    ← Página "sitio no disponible" (estado disabled: sin has_white_label o agencia no aprobada). Sub-pieza A
│   │   ├── feedback/
│   │   │   └── Notice.tsx               ← Aviso persistente reutilizable (Server Component, tonos info/warning/error). NO es el "banner de error" descartable
│   │   ├── properties/
│   │   │   ├── PropertyCard.tsx         ← Card editorial reutilizable
│   │   │   ├── PropertyList.tsx         ← Lista mobile (cards-first)
│   │   │   ├── PropertyForm.tsx         ← CRUD form + barra de acción sticky
│   │   │   ├── AddressSearchButton.tsx  ← Botón "Buscar esta dirección en el mapa": llama a /api/geocode y emite una SUGERENCIA. Nunca busca al tipear (política de Nominatim). No puede bloquear el guardado
│   │   │   ├── LocationPicker.tsx       ← Pin manual: CONTROLADO (la posición vive en el form), tiles compartidos. Emite la causa del cambio ("drag" confirma / "center" desconfirma)
│   │   │   └── ImageUploader.tsx        ← Drag&drop, progreso por imagen, máx 10
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx              ← Wordmark + avatar + nav
│   │   │   ├── StatsCard.tsx            ← tabular-nums, count-up, acento en métrica clave
│   │   │   ├── PropertiesTable.tsx      ← Tabla desktop + cards mobile + skeleton
│   │   │   ├── PlanBadge.tsx            ← Plan + micro-barra de uso
│   │   │   ├── ProfileForm.tsx           ← Perfil del agente: avatar (upload client-side, upsert) + nombre + teléfono
│   │   │   ├── AgencyPhoneForm.tsx       ← Teléfono de la agencia (solo admin). Sub-pieza B1
│   │   │   ├── AgencyLogoForm.tsx        ← Logo de la agencia (solo admin): upload client-side + updateAgencyLogoAction. Valida tipo/tamaño, cache-buster en preview. Sub-pieza B1
│   │   │   ├── AgencyIdentityForm.tsx   ← Nombre + matrícula (solo admin). Editable si pending/rejected; solo lectura con candado si approved. La regla REAL la aplica la action
│   │   │   ├── AgencyApprovalNotice.tsx ← Aviso de dominio: pendiente / rechazada (con el motivo). Presentacional puro, null si está aprobada
│   │   │   ├── SubscriptionContent.tsx  ← Card del plan que rige + cards de upgrade (solo planes superiores) + AlertDialog de confirmación
│   │   │   ├── NewPropertyButton.tsx    ← CTA "Nueva propiedad" + bloqueo por getPublishBlock (agencia no aprobada O cupo lleno), con mensaje distinto para cada motivo
│   │   │   ├── LeadsContent.tsx         ← Tabla de Consultas (client)
│   │   │   ├── TeamContent.tsx          ← Equipo: alta/baja de agentes (client)
│   │   │   └── PreferencesContent.tsx   ← Preferencias personales (localStorage)
│   │   └── ui/                          ← shadcn/ui components
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                ← Browser client
│   │   │   ├── server.ts                ← SSR client
│   │   │   ├── admin.ts                 ← Service role (registro: agencies + agents + subscriptions). NUNCA en cliente
│   │   │   └── middleware.ts            ← Helper de cookies para proxy.ts
│   │   ├── geocoding/                   ← Búsqueda de direcciones (SERVER-ONLY). Ver "Ubicación de la propiedad"
│   │   │   ├── types.ts                 ← Contrato GENÉRICO (GeocodeProvider/Query/Candidate). La costura por la que se cambia de proveedor: nada de Nominatim puede aparecer acá
│   │   │   ├── nominatim.ts             ← ÚNICO archivo que sabe qué es Nominatim: URL, parámetros, User-Agent, viewbox
│   │   │   └── index.ts                 ← Orquestador: timeout, límite de 1 consulta/s, caché con TTL, descarte por distancia. `geocodeAddress` NUNCA lanza. La línea `const provider = ...` es la que se cambia para cambiar de servicio
│   │   ├── map/
│   │   │   └── tiles.ts                 ← Config de tiles compartida (mapa + LocationPicker)
│   │   ├── hooks/
│   │   │   ├── useProperties.ts         ← Fetch reactivo con debounce + diff + SELECT acotado. Params: (cityId, bounds, agencyId?). Con agencyId filtra a una sola agencia (white-label)
│   │   │   ├── useFavorites.ts          ← Favoritos en localStorage (sync entre instancias)
│   │   │   └── useVisitedProperties.ts  ← Pines visitados en localStorage
│   │   └── utils/
│   │       ├── coords.ts                ← Coords + roundCoord (7 decimales, ÚNICO redondeo del proyecto) + distanceKm (equirectangular con corrección por latitud). Sin dependencias: lo usan servidor y cliente
│   │       ├── getAgencyCity.ts         ← Ciudad de una agencia (nombre, provincia, país, centro) para armar la consulta de geocodificación. Server-only; la ciudad NUNCA viene del cliente
│   │       ├── formatPrice.ts           ← formatPrice + formatPriceCompact (pines)
│   │       ├── generateSlug.ts          ← slugifyBase (limpieza pura) + generateSlug (propiedades, sufijo aleatorio)
│   │       ├── agencySlug.ts            ← generateUniqueAgencySlug: slug LIMPIO de agencia (sufijo numérico -2/-3 ante colisión). Lo usa el registro; el UNIQUE de agencies.slug es la garantía final
│   │       ├── waMessage.ts             ← generateWaUrl(): string | null
│   │       ├── getPlanUsage.ts          ← Helper server: cuenta por agency_id
│   │       ├── resolveAgentSession.ts   ← ÚNICO lugar donde vive "traer el agente logueado + su agencia". Unión de 3 estados, cacheado por request. requireAgentSession() corta; resolveAgentSession() devuelve
│   │       ├── getPublishBlock.ts       ← Espejo en la interfaz de los dos triggers de properties: ¿se puede publicar, y si no, por qué? Fuente única del criterio para los 4 puntos de entrada
│   │       ├── getLatestRejectionNote.ts ← Motivo del último rechazo (agency_reviews, service role) verificando pertenencia antes de devolver nada
│   │       ├── licenseNumber.ts         ← Formato y normalización de la matrícula, compartidos por el alta y por Preferencias
│   │       ├── resolveAgencyBySlug.ts   ← Resuelve slug → agencia + suscripción + ciudad (service role). 3 estados: not_found / disabled / active. White-label. Sub-pieza A
│   │       ├── authErrors.ts            ← translateAuthError: mapea errores de Supabase Auth a español (registro + alta de agente)
│   │       └── labels.ts                ← Etiquetas UI compartidas
│   │
│   ├── store/
│   │   ├── mapFiltersStore.ts           ← Hook `useMapFilters` + selectActiveFiltersCount (el hook vive acá, NO en lib/hooks/)
│   │   └── cityStore.ts                 ← Ciudad activa, initCity(), setCity(), nearbyCityId
│   │
│   ├── types/
│   │   ├── index.ts                     ← Todos los tipos del proyecto
│   │   └── supabase.ts                  ← Generado por Supabase CLI (no editar)
│   │
│   └── proxy.ts                         ← Convención Next.js 16: auth guard
│
├── public/
│   ├── markers/                         ← SVG fuente de verdad de los pines
│   ├── icon-192.png / icon-512.png      ← PWA icons ("M" terracota)
│   └── manifest.json
│
├── supabase/
│   ├── migrations/20240101000000_initial_schema.sql
│   └── seed.sql
│
├── CLAUDE.md
└── DESIGN.md
```

> **Alias `@/*`**: resuelve a `src/*`. Configurado por Next.js con `--src-dir`.

---

## Reglas de Código — Seguir SIEMPRE

### TypeScript
- Estricto en todo. Usar los tipos de `src/types/index.ts`. **Nunca `any`**
- Para extender tipos: `Pick<>`, `Omit<>`, `Partial<>` — nunca redefinir campos inline
- Interfaces en PascalCase, variables y funciones en camelCase, archivos y carpetas en kebab-case

### Next.js 16
- `src/proxy.ts` exporta `proxy()`, no `middleware()`. `src/lib/supabase/middleware.ts` es un utilitario distinto (helper de cookies)
- `params` y `searchParams` son Promises — siempre `await`
- Server Components por defecto; `"use client"` solo cuando sea necesario
- El mapa siempre con `dynamic(..., { ssr: false })` — Leaflet usa `window`
- Al pasar íconos de Server a Client Component, pasarlos como **elemento** (`<Icon size={20}/>`), no como referencia, para no romper la serialización

### Supabase — cuál client usar

| Contexto | Client |
|---|---|
| Server Components, Server Actions | `@/lib/supabase/server` |
| Client Components | `@/lib/supabase/client` |
| Crear `agencies`, insert `agents`, upsert `subscriptions` en registro | `@/lib/supabase/admin` (service role) |

- No hacer queries directas en componentes → hooks en `src/lib/hooks/`
- Respetar RLS siempre. Admin client solo en server

### ESLint
- El patrón `setIsLoading(true)` al inicio de efectos: usar IIFE async dentro del efecto. No bajar la regla globalmente.
- **Baseline medido: 0 errores y 1 warning.** El único warning es `react-hooks/incompatible-library` en `PropertyForm.tsx:269` (`watch("currency")`): el React Compiler detecta que el `watch()` de react-hook-form no se puede memoizar y renuncia a memoizar el componente. Es inherente a la librería, no un defecto del código; no bloquea el build. **Cualquier otro warning es una regresión.** (Histórico: había un segundo warning idéntico en `RegisterForm.tsx` por `watch("tenantType")`; desapareció al eliminarse el selector de tipo de cuenta.)

### Estilos
- Tailwind, sin CSS-in-JS ni módulos CSS. shadcn/ui para componentes base
- Seguir `DESIGN.md`

### Comentarios
- Lógica de negocio en español, código en inglés

---

## Convenciones de Dominio

### Ciudad activa — cityStore
- `src/store/cityStore.ts`. `initCity()` se llama **una sola vez** desde la raíz, no en componentes hijos.
- `CityPicker` y todo componente que necesite la ciudad leen del store. `useCity.ts` fue eliminado.
- `nearbyCityId` (campo del store) marca la ciudad detectada por geolocalización para el label "Cerca tuyo".

### Sesión del área privada — resolveAgentSession (ÚNICO lugar)

- **`src/lib/utils/resolveAgentSession.ts`** resuelve de una sola vez **usuario + fila de `agents` + datos de su agencia** (incluidos `approval_status` y `license_number`). **Es el único lugar donde debe vivir esa consulta.** Antes estaba copiada en **21 lugares** de `src/app/(agent)/`, con **cinco formas distintas del mismo `select`** y **cuatro comportamientos distintos** ante "hay sesión pero no hay fila" — y esa dispersión fue exactamente la que produjo el bucle de redirecciones.
- **Tres estados, como unión discriminada** (mismo patrón que `resolveAgencyBySlug`): `no_session` / `unlinked` (hay sesión pero no resuelve la fila de `agents` **o** la de su agencia) / `ok`. **No colapsar `unlinked` en `no_session`**: son cosas distintas y su destino correcto también.
- **Dos exports:** `requireAgentSession()` para **páginas y layouts** (corta con `redirect`), y `resolveAgentSession()` crudo para **server actions** (que devuelven `{ error }`, no redirigen — redirigir desde un submit rompe el manejo de errores del formulario que la llama) y para `admin/layout.tsx`, que necesita ordenar sus cortes a mano.
- **Envuelto en `cache()` de React**, y por eso **NO recibe el client de Supabase como parámetro** (a diferencia de `getPlanUsage`): `cache()` desduplica por argumentos y un client distinto por llamador rompería la deduplicación. Así el layout y la página que cuelga de él comparten UNA sola consulta por request. La deduplicación **no llega a las server actions** (cada invocación es su propio ciclo), y está bien: una action tiene que leer estado fresco.
- **No agregar consultas nuevas a `agents` por `auth.uid()`.** Las únicas lecturas de `agents` que quedan fuera del helper son de OTRO agente (equipo, reasignación) o un UPDATE del propio perfil.

### Cierre de sesión — `/logout` es un route handler, y tiene que serlo

- **`src/app/(agent)/logout/route.ts`** (`GET /logout`) hace `signOut()` y redirige a `/login?reason=<código>`.
- **Por qué un route handler y no una server action ni el propio Server Component:** en un Server Component **el `set` de cookies NO tiene efecto** — está documentado en el `catch` de `src/lib/supabase/server.ts` (*"En Server Components el set no tiene efecto; lo maneja el proxy"*). Sin borrar la cookie, `signOut()` no cierra nada. Un route handler **sí** puede escribir cookies.
- **Qué bug cierra:** un usuario con sesión válida pero **sin fila en `agents`** quedaba en un bucle infinito — el layout cortaba a `/login`, `proxy.ts` veía que había sesión y lo rebotaba a `/dashboard`, y así hasta que el navegador mataba la cadena de 307 con un `SecurityError`. **Nadie cerraba la sesión en el camino**, así que la premisa del proxy nunca cambiaba. Al cerrar la sesión, `proxy.ts` deja de rebotar y el ciclo no se arma.
- **El parámetro `reason` es un CÓDIGO corto, nunca el texto**: el route handler lo valida contra una whitelist y `login/page.tsx` (Server) lo mapea a un mensaje fijo. Renderizar texto que venga de la URL sería una puerta a inyección de contenido.
- El botón "Cerrar sesión" del sidebar **no** usa esta ruta: sigue con `logoutAction` (un `<form>` → server action), que ahí sí es lo correcto.

### Avisos persistentes — Notice + AgencyApprovalNotice

- **`src/components/feedback/Notice.tsx`**: aviso persistente reutilizable. Server Component, sin estado, sin botón de cerrar, `role="status"`, tres tonos (`info`/`warning`/`error`). **No confundir con el "banner de error"** que está copiado a mano en cuatro pantallas (`AgenciesTable`, `PropertiesTable`, `SubscriptionContent`, `TeamContent`): aquel es descartable, tiene `useState` de cliente y comunica que algo falló. Este describe un estado que dura.
- **`src/components/dashboard/AgencyApprovalNotice.tsx`**: el de dominio. Presentacional puro — recibe `status` y `rejectionNote` ya resueltos en el server y **no consulta nada**; devuelve `null` si la agencia está aprobada. Montado en `/dashboard` (entre el título y la grilla de tarjetas, el único hueco de ancho completo) y en `/dashboard/preferencias` (con `showEditLink={false}`, porque es la pantalla del enlace y ahí se corrige lo que motivó el rechazo).

### Plan usage — getPlanUsage
- Siempre `src/lib/utils/getPlanUsage.ts`. Cuenta por `agency_id`. Solo en server.

### Etiquetas UI — labels.ts
- Nunca definir mapas de etiquetas inline. Usar `PROPERTY_TYPE_LABELS`, `OPERATION_TYPE_LABELS`, `PROPERTY_STATUS_LABELS`, `AMENITY_LABELS`, `CURRENCY_LABELS`.

### Tiles del mapa — tiles.ts
- `src/lib/map/tiles.ts` es la fuente única de config de tiles (OSM estándar), consumida por `MapView` y `LocationPicker`. Rama opcional para `NEXT_PUBLIC_MAPTILER_KEY`.

### Favoritos y visitados
- `useFavorites` y `useVisitedProperties` en localStorage. Se reflejan en vivo en el mapa, el modal y las cards (sync entre instancias vía CustomEvent + storage). Sin login.

### White-label por agencia — `/[slug]` (Sub-pieza A)
- **Ruta pública `src/app/(public)/[slug]/page.tsx`** (Server Component, `params` es Promise → `await`): una URL por agencia (`marka.com.ar/[slug]`) que muestra el mapa filtrado SOLO a las propiedades de esa agencia. El root `/[slug]` es **exclusivo de agencias** — NO hay ruta `/[ciudad]` (la ciudad se resuelve por `cityStore`, nunca por URL). Cualquier ruta pública futura de primer nivel (`/precios`, etc.) compite con este `[slug]`; las estáticas ganan a la dinámica, pero tenerlo presente.
- **`resolveAgencyBySlug(slug)`** (`src/lib/utils/resolveAgencyBySlug.ts`, server-only): resuelve el slug en **3 estados** y la ruta bifurca: `not_found` → `notFound()` (404 real); `disabled` (la agencia existe pero su suscripción NO tiene `has_white_label`) → `AgencyUnavailable`; `active` (existe + `has_white_label = true`) → `AgencyMapView`. **No colapsar `disabled` en `not_found`**: un slug que no existe y una agencia que existe sin plan son páginas distintas (la segunda no debe parecer "rota" para una agencia que bajó de plan).
- **Usa service role** (admin client), NO el client público. Motivo: la policy `Agency members read own subscription` solo deja leer `subscriptions` a los agentes de esa agencia; el visitante white-label es **anónimo**, así que con el anon client `has_white_label` volvería vacío y TODA agencia parecería `disabled` (el estado `active` sería inalcanzable). Es seguro: función server-only, lee pocos campos no sensibles (id, name, city_id, el flag, centro de la ciudad). **No se tocó ninguna policy.** Una sola query con embeds de PostgREST (`agencies` + `subscriptions` + `cities`); helper `firstOf` normaliza el embed to-one (objeto vs array de uno).
- **`AgencyMapView`** es mirror de la home pero **sin `CityPicker`**: la vista es de UNA agencia en SU ciudad (resuelta en server), no navegable a otras ciudades. Incluye lista mobile (cards-first) como la home. Sin personalización visual todavía (logo/nombre llegan en Sub-pieza B) — se ve con el diseño estándar de Marka.
- **Filtrado:** el `agencyId` opcional de `useProperties` agrega `.eq("agency_id", agencyId)` ADICIONAL a `city_id` + `status = 'active'`. Threadeado desde `AgencyMapView` → `MapView`/`PropertyList`. Sin el parámetro (la home), nada cambia.
- **Sub-pieza B1 — Subir el logo en Preferencias (HECHA):** `AgencyLogoForm` (solo admin) sube el logo **client-side** (browser client, como el avatar de `ProfileForm`) al bucket `property-images`, path `logos/{agency_id}/logo.{ext}`, `upsert: true`. La **URL** se persiste con `updateAgencyLogoAction` (server action que clona `updateAgencyPhoneAction`: gate `role === "admin"` + service role + `.eq("id", caller.agency_id)`). Decisión de diseño: lo sensible es la escritura en `agencies` (gateada a admin), no el archivo en Storage (bucket público, archivo huérfano inocuo) → no hace falta upload por server action/FormData. **Validación REAL** (más estricta que el avatar, porque el logo es público): solo PNG/JPG/WEBP (NO SVG, riesgo XSS), máx 2 MB, chequeado en JS antes de subir. La extensión sale del MIME validado (`ACCEPTED_TYPES[file.type]`), no de `file.name` sin sanear. **Cache-buster** (`?t={Date.now()}`) solo en la preview tras guardar (la URL en la DB queda limpia) — necesario porque el path es fijo con `upsert`, sin el buster el navegador mostraría el logo cacheado. El logo **NO se muestra en el white-label todavía** (eso es B2): en B1 solo se ve de vuelta en el form para verificar.
- **Sub-pieza B2a — Logo + nombre en el header (HECHA):** `AgencyMapView` recibe `agencyName` + `agencyLogoUrl` (la ruta los pasa; `resolveAgencyBySlug` ya trae `logo_url` en estado `active`). Header: **logo de la agencia a la izquierda** (donde en la home va el Wordmark de Marka) con `h-9 w-auto max-w-[160px] object-contain` (altura fija, ancho según relación de aspecto, tolera cualquier proporción sin romper el header); **nombre de la agencia en el centro** (`text-base sm:text-lg`, visible también en mobile). Si NO hay logo: el nombre va a la izquierda y el centro queda vacío (nunca el Wordmark de Marka). La marca de la agencia NO es link (llevaría al marketplace general, contradiciendo el white-label). **"Powered by Marka."** discreto centrado al pie (`fixed`, `pointer-events-none`, respeta safe-area y no tapa FABs/zoom), usando un `size="xs"` nuevo del `Wordmark` (aditivo). Validación de PROPORCIONES del logo al subir (rechazar verticales extremos) quedó como ajuste futuro a B1 — el `object-contain` ya protege el layout.
- **EN PAUSA (Sub-piezas B2b y C):** B2b = variante "admin logueado de la agencia ve invitación a reactivar" en estado `disabled` (requiere meterle sesión a la ruta `/[slug]`, hoy anónima, + ensanchar `resolveAgencyBySlug` para que `disabled` devuelva id/name). C = slug editable. **No se tocan hasta resolver los cambios profundos de modelo** (eliminar particulares, matrícula + alta manual): esas piezas están entrelazadas con agencias/roles/slugs y diseñarlas ahora sería trabajar sobre un modelo que va a cambiar. Ver PENDIENTES.md → "Nueva fase".

### Viewport mobile — altura y lock de scroll
- **Wrappers de pantalla completa van con `h-dvh`/`min-h-dvh`, NUNCA `h-screen`/`100vh`.** `100vh` en mobile es el viewport grande (ignora la barra de URL), lo que dejaba el documento scrolleable por ese hueco; cualquier "scroll into view" del navegador (foco en un anchor de zoom de Leaflet, o en un input que abre el teclado) desplazaba el documento y sacaba el header (que está en flujo normal) fuera de vista, sin restituirlo. `dvh` sigue a la barra de URL y no deja hueco.
- **El documento tiene lock de scroll:** `globals.css` fija `html, body { height: 100%; overflow: hidden }`. Toda la app scrollea en **contenedores internos** (el `main` del dashboard con `overflow-y-auto`, la lista mobile, el cuerpo de los sheets), nunca el documento. Si creás una pantalla nueva, dale su propio contenedor scrolleable interno — NO dependas del scroll del documento (lo hace `AuthLayout` con `h-dvh overflow-y-auto`, el único caso que lo necesitaba).
- Tailwind v4 trae `h-dvh`/`min-h-dvh` nativas (no hace falta el arbitrario `h-[100dvh]`).
- Los `fixed`/`sticky` (bottom sheets, FABs, marco editorial, sidebar mobile) se reanclan bien y NO se tocan; el problema era solo el chrome en flujo normal sobre wrappers `100vh`.

### WhatsApp
- `phone_wa` en formato `"5491112345678"`. `generateWaUrl()` retorna `string | null` — verificar antes de usar; si null, deshabilitar botón con mensaje.
- Registrar lead (con `agency_id`) antes de abrir WhatsApp.

### Ubicación de la propiedad — pin manual + sugerencia desde la dirección

> **La regla histórica "pin manual, NO geocoding automático" NO se derogó: se refinó.** Sigue sin haber geocodificación automática (nada busca solo, ni al tipear, ni al montar, ni al guardar) y el pin manual sigue siendo la **fuente de verdad**. Lo que se agregó es un **atajo opcional**: un botón que, a pedido explícito del agente, propone un punto de partida. La coordenada que se guarda es siempre la que el agente **confirmó**.

#### El flujo, del botón al pin

1. El agente escribe la dirección en el formulario y toca **"Buscar esta dirección en el mapa"** (`AddressSearchButton`). Nada se dispara solo.
2. El botón hace `POST /api/geocode` con **la dirección y nada más**.
3. La ruta valida sesión, resuelve la ciudad de la agencia en el servidor y llama a `geocodeAddress`.
4. El orquestador (`src/lib/geocoding/index.ts`) espera su turno del limitador, consulta al proveedor, redondea y descarta lo que caiga lejos del centro de la ciudad.
5. La respuesta es uno de **cuatro desenlaces** (`GeocodeStatus`): `found` / `not_found` / `out_of_city` / `unavailable`. Los cuatro son estados normales; en los cuatro el camino manual queda intacto.
6. Con `found`, el formulario mueve el pin (`LocationPicker` recentra y hace un pulse) y **deja la ubicación SIN CONFIRMAR**. El agente revisa, corrige arrastrando si hace falta, y confirma.

Los mensajes de los cuatro desenlaces viven en `GEOCODE_STATUS_MESSAGES` (`lib/utils/labels.ts`), no inline.

#### La política de uso del servicio es una restricción del código, no una preferencia

Proveedor actual: **Nominatim** (el geocodificador de OpenStreetMap), gratuito. Su política de uso —<https://operations.osmfoundation.org/policies/nominatim/>— **prohíbe explícitamente el autocompletado**, y el resto de sus exigencias explican casi toda la forma de este módulo:

| Obligación de la política | Cómo se cumple | Dónde |
|---|---|---|
| **Nada de autocompletado / búsqueda al tipear** | La consulta sale SOLO del `onClick` del botón. No hay debounce, ni `onBlur`, ni efecto que busque al montar | `AddressSearchButton.tsx` |
| Máximo **1 consulta por segundo** contando TODA la app | Limitador por reserva de turnos, `MIN_REQUEST_INTERVAL_MS = 1100` | `lib/geocoding/index.ts` |
| **User-Agent propio** que identifique la app | `GEOCODING_USER_AGENT` (con default sin contacto si falta). **Por esto la llamada sale del servidor: el navegador no puede setear ese header** | `lib/geocoding/nominatim.ts` |
| **Cachear** los resultados | Mapa en proceso con TTL de 24 h | `lib/geocoding/index.ts` |
| Poder **cambiar de proveedor** sin actualizar la app | Contrato genérico + una sola línea de cableado (abajo) | `lib/geocoding/types.ts` |
| Atribución a OSM | Ya la da el `TileLayer` del mapa (`TILE_CONFIG.attribution`) y el control de atribución de Leaflet | `lib/map/tiles.ts` |

⚠ **La política puede cambiar sin aviso y advierte específicamente a las aplicaciones comerciales que dependan de ella.** Marka es comercial: el día que Nominatim deje de servir, hay que poder mudarse rápido, y por eso la costura de proveedor es parte del diseño y no un lujo.

**Por qué la llamada sale del servidor y no del navegador** (tres razones, todas de la política): el User-Agent no se puede setear desde el browser; el límite de 1/s solo se puede aplicar para toda la app si hay un solo punto de salida; y la caché y el cambio de proveedor serían imposibles con cada navegador tirando por su cuenta.

**Por qué `/api/geocode` tiene su propio control de sesión.** `src/proxy.ts` solo exige sesión bajo `/dashboard` y `/admin` (`PROTECTED_PREFIXES`); **cualquier otra ruta nace pública**, `/api` incluida. El gate real es el `resolveAgentSession()` de adentro del handler → sin sesión, **401**. Sin eso, esto sería un proxy abierto a un servicio de terceros **con nuestra identificación puesta**, y el bloqueo nos lo comeríamos nosotros. Va **adentro del handler y no en el proxy** a propósito: un proxy que redirige un `POST` de `fetch` a la pantalla de login devolvería HTML con estado **200**, y el cliente lo leería como éxito.

**Por qué la ciudad la resuelve el servidor.** Misma disciplina que el `agency_id` en el resto del proyecto: el cliente manda la dirección y nada más. `getAgencyCity(agency_id)` deriva nombre, provincia, país y centro desde la agencia de la sesión. Además hacía falta: las dos páginas que renderizan el formulario leen `cities` con un select acotado a `center_lat, center_lng`, así que el nombre y la provincia nunca llegan al cliente.

#### Cómo se cambia de proveedor de geocodificación

Dos pasos, y ninguno toca la interfaz ni la ruta:

1. Escribir un archivo nuevo al lado de `nominatim.ts` que implemente `GeocodeProvider` (`src/lib/geocoding/types.ts`): un `name` corto (entra en la clave de caché) y un `search(query, signal)`. Reglas del contrato: devolver `null` es "respondió y no hay resultado utilizable" (no es error); **cualquier falla se LANZA** (el orquestador la traduce a `unavailable`); el `signal` es el presupuesto de tiempo de toda la operación y el proveedor no define uno propio.
2. Cambiar **una línea** en `src/lib/geocoding/index.ts`:
   ```ts
   const provider = nominatimProvider;   // ← la única referencia al proveedor en todo el repo
   ```

Nada más lo referencia: ni el orquestador (que solo habla el contrato genérico), ni `/api/geocode`, ni `AddressSearchButton`, ni `PropertyForm`. `types.ts` **no puede** contener nada específico de un servicio (ni URLs, ni nombres de parámetros, ni formas de respuesta): esa es la costura.

#### ⚠ EL BARRIO NO PARTICIPA DE LA BÚSQUEDA. NO LO VUELVAS A AGREGAR

Parece obvio que el barrio desambiguaría en ciudades del interior. **Ya se agregó DOS VECES y se sacó dos veces**: medido contra el servicio real, el barrio es un dato **dañino** para geocodificar. El caso que lo cerró — `"Mitre 291"`, Santiago del Estero (medición registrada en el comentario de `geocodeAddress`):

| Lo que se manda | Lo que devuelve Nominatim |
|---|---|
| sin barrio | Mitre 291, a **0,9 km** del centro ✅ |
| barrio `"Parque"` (el que OSM tiene mapeado) | Mitre 291, a **0,9 km** del centro ✅ |
| barrio `"Cabildo"` (otro cualquiera) | no encuentra nada |
| barrio `"Centro"` (**el que la gente USA**) | Bartolomé Mitre en **Añatuya**, otra ciudad de la misma provincia **a 158 km** ❌ (lo descarta el filtro de distancia) |

O sea: **el único barrio que un agente real va a escribir es el que falla, y falla del peor modo posible** — no devuelve "no encontré nada", devuelve un resultado *incorrecto y lejano*. Un barrio que no coincide con lo mapeado no solo tapa la dirección correcta: manda al servicio a buscar a otra ciudad. Eso también mató la cascada de dos intentos que hubo en el módulo: solo reintentaba ante "no encontré nada", y este caso no devuelve vacío.

**El barrio sigue siendo un campo de la propiedad y se guarda tal como lo escribe el agente.** Lo único que no hace es viajar a la consulta. La consulta es siempre: **dirección + ciudad + provincia + país**, un intento.

#### Confirmación de la ubicación (arreglo de bug, no solo adaptación a la feature)

La regla vieja era *"el pin se movió al menos una vez"*, **irreversible**: nada la devolvía a falso. Eso tenía un agujero **que existía sin ningún geocodificador de por medio**: arrastrar el pin (regla satisfecha) → tocar "Centrar" (el pin vuelve al centro de la ciudad sin tocar el estado) → publicar, y la propiedad quedaba **exactamente en el centro de la ciudad**, que es justo lo que la regla existía para impedir.

La regla ahora es **"la ubicación ACTUAL está confirmada"**, y el mapa no tiene forma de cambiar la coordenada sin declarar la causa:

| Acción | Efecto sobre la confirmación | `location_source` |
|---|---|---|
| Arrastrar el pin (`cause: "drag"`) | **Confirma** — acto deliberado sobre un punto concreto | `manual` |
| "Centrar" en la ciudad (`cause: "center"`) | **Desconfirma** — es volver al punto de partida | `manual` |
| Sugerencia del buscador | **Desconfirma** — la propuso una máquina | `suggested` |
| Botón "Confirmar esta ubicación" | **Confirma** | (no lo toca) |

- Si se intenta guardar sin confirmar, el submit se corta con un mensaje; **no hay forma de publicar una ubicación sin confirmar.**
- **Al editar** una propiedad, la ubicación **nace confirmada** (ya tenía una ubicación real: no tiene sentido obligar a recolocar el pin para cambiarle el precio). Pero si durante la edición la coordenada cambia por sugerencia o por "Centrar", **se desconfirma igual que en el alta**.
- Si la sugerencia confirmara sola, la garantía se satisfaría a sí misma y la feature **empeoraría** la calidad de los datos en vez de mejorarla.

#### `LocationPicker` es un componente CONTROLADO

Antes guardaba la posición del pin en su propio estado **además** de recibirla por props, y la confirmación estaba duplicada en dos componentes que no se conocían (`pinMoved` en el form y `hasBeenMoved` adentro del picker). **Esa duplicación es lo que permitió el bug de arriba.** Ahora la posición existe en un solo lugar (el formulario) y el picker solo la refleja y emite cambios con su causa.

- La comparación "¿este cambio lo originé yo o me lo mandaron de afuera?" se hace **por igualdad de números**, y por eso `roundCoord` (7 decimales, `lib/utils/coords.ts`) es **load-bearing**: todos los caminos que producen una coordenada —el arrastre y la sugerencia— tienen que redondear igual. No es cosmético.
- El efecto que reacciona a una posición externa **no llama a `onChange`**: no hay camino de escritura hacia el padre, así que no puede realimentarse.
- ⚠ **Arreglo de paso:** el mapa abre centrado **donde está el pin**, no siempre en el centro de la ciudad. Antes, al **editar** una propiedad alejada del centro, el mapa abría mirando el centro y el pin podía quedar fuera del recuadro de 280 px.

#### La feature es un ATAJO, nunca un requisito

**Restricción de diseño, no casualidad: si el servicio falla, tarda o está caído, cargar y editar propiedades tiene que seguir funcionando exactamente igual.** Está garantizado en varias capas:

- `geocodeAddress` **nunca lanza**: red caída, HTTP no-2xx, JSON ilegible, timeout o turno cancelado salen todos por el mismo lugar como `{ status: "unavailable" }`.
- La ruta nunca devuelve el error crudo del servicio externo: 200 con un desenlace del contrato, o 400/401 con `{ error }`.
- El cliente trata **cualquier** respuesta que no sea 200 como `unavailable`, y tiene su **propio timeout (8 s, por encima de los 5 s del servidor)** para no quedarse en "Buscando..." si la ruta propia no responde.
- `AddressSearchButton` no tiene ninguna forma de impedir que se guarde una propiedad: todo lo que puede salir mal termina en un mensaje.

#### Valores que gobiernan el comportamiento

Todos en `src/lib/geocoding/index.ts` salvo el último:

| Constante | Valor | Por qué |
|---|---|---|
| `GEOCODE_TIMEOUT_MS` | **5 s** | Presupuesto TOTAL (espera del turno + red). Holgado contra un servicio sano; por debajo del punto en que se lee como "la app se colgó" |
| `MIN_REQUEST_INTERVAL_MS` | **1100 ms** | El límite de la política es 1/s; los 100 ms extra son margen de reloj |
| `CACHE_TTL_MS` | **24 h** | Los datos de OSM para una dirección no cambian en horas; el patrón real es el mismo agente reintentando la misma dirección |
| `MAX_CACHE_ENTRIES` | **500** | Techo para que un proceso de larga vida no acumule sin fin (se desaloja la entrada más vieja) |
| `CITY_RADIUS_KM` | **25 km** | Umbral de credibilidad. **Ver el supuesto de abajo** |
| `MAX_ADDRESS_LENGTH` / `MAX_LABEL_LENGTH` | **200 / 120** | Que la ruta no sea un túnel de texto arbitrario; los `display_name` de OSM traen la jerarquía hasta el país |
| `CLIENT_TIMEOUT_MS` (`AddressSearchButton.tsx`) | **8 s** | Techo del cliente, por encima del presupuesto del servidor |

**La caché es por desenlace:** `found`, `not_found` y `out_of_city` se guardan; **`unavailable` NUNCA** (cachear una caída de un minuto dejaría el atajo roto por 24 horas).

⚠ **Supuesto explícito del umbral de distancia:** la tabla `cities` **no tiene límites geográficos** — solo `center_lat`, `center_lng` y `default_zoom` (verificado contra la base). Los 25 km no pretenden ser el borde del ejido: existen para descartar el caso ruidoso (una calle homónima a cientos de kilómetros), no para recortar el municipio. La asimetría de los errores empuja a ser generoso: aceptar de más es inocuo (el agente todavía tiene que confirmar), rechazar de más le rompe el atajo a una dirección legítima de las afueras. **Revisar antes de abrir una segunda ciudad**, sobre todo del mismo aglomerado o de la misma provincia (ver PENDIENTES.md).

#### `GEOCODING_SIMULATE_OUTAGE` — interruptor de prueba

Simulador de caída para poder verificar a mano la restricción de arriba. **Existe porque cortar internet no sirve como prueba: también corta Supabase**, y sin base no se puede guardar nada, así que no se podría distinguir "el atajo falló pero el flujo sobrevive" de "no anda nada".

- Se lee **lo primero de todo** en `geocodeAddress`, antes de la caché, del limitador y de cualquier llamada: con el interruptor puesto **no sale ni un pedido**, y el desenlace es idéntico al de una caída real (mismo estado, mismo mensaje, pin sin tocar).
- Ausente o vacía = apagado. `"0"` y `"false"` también apagan (para que `GEOCODING_SIMULATE_OUTAGE=false` no encienda justo lo contrario). Cualquier otro valor la enciende.
- Se lee dentro de la función, no en una constante de módulo: alcanza con reiniciar el server en desarrollo.
- ⚠ **NUNCA EN PRODUCCIÓN.** Mientras esté puesta, **ninguna** búsqueda de direcciones funciona. No es un feature flag de operación.

#### `properties.location_source` — dato de MEDICIÓN, no de negocio

Columna nueva: `text`, **nullable**, con `CHECK (location_source IS NULL OR location_source IN ('manual','suggested'))` (medido por MCP: `properties_location_source_check`, sin default).

- `manual`: la coordenada final la puso una persona arrastrando el pin.
- `suggested`: la propuso el buscador y el agente la confirmó **tal cual**. Si después la arrastra, vuelve a `manual` — **vale la última acción**.
- **Nullable** porque las propiedades cargadas antes de esta feature no lo tienen (al editarlas se asumen `manual`, que es lo que eran).
- La server action normaliza con `normalizeLocationSource`: cualquier cosa que no sea exactamente `'suggested'` se guarda como `'manual'`. Es el valor honesto por defecto y garantiza que el CHECK no pueda hacer fallar un alta por un dato que no gatea nada.
- **Existe ÚNICAMENTE para poder medir dentro de unos meses si las ubicaciones sugeridas quedaron peor puestas que las arrastradas. NO gatea ni condiciona nada en la app, y no debe hacerlo: si alguna pantalla empieza a ramificar por este valor, es un bug de diseño.**

### Imágenes y Storage
- Bucket **`property-images`** (público), tres tipos de path: propiedades `{agent_id}/{property_id}/{filename}`, avatares `avatars/{agent_id}/avatar.{ext}`, logos de agencia `logos/{agency_id}/logo.{ext}`.
- Primera imagen de propiedad `sort_order = 0`, `is_cover = true`. Si falla el insert: avisar, no hacer rollback.
- **Policies de Storage (`storage.objects`) — estado real, importante:** son **laxas y consistentes** — INSERT, UPDATE y DELETE permiten a cualquier usuario `authenticated` operar sobre el bucket, sin restringir por path. SELECT es público. **La policy de UPDATE se agregó tarde** (un upload con `upsert` sobre un archivo que YA existe es un UPDATE, no un INSERT; sin policy de UPDATE, RLS lo negaba → 403 "new row violates row-level security policy" al *reemplazar* avatar/logo, mientras la primera subida —INSERT— sí pasaba). Si en el futuro se reemplaza un archivo y da 403, revisar que exista la policy de UPDATE.
- **Deuda de seguridad (ver PENDIENTES):** las policies laxas son aceptables en desarrollo pero permiten que cualquier autenticado toque archivos ajenos. Antes de producción real conviene un repaso de RLS de Storage con seguridad fina (validar uid/agencia por path). La policy de DELETE vieja intentaba seguridad fina (`uid` = primera carpeta) pero nunca matcheaba para `avatars/`/`logos/` (la primera carpeta es la palabra literal) — quedó reemplazada por la laxa.
- Reemplazar (no acumular) es el comportamiento deseado para avatar y logo: `upsert: true` sobre path fijo. Para logos, ojo que si cambia la extensión (`logo.png` → `logo.webp`) quedan 2 objetos; el `logo_url` apunta al último, el anterior queda huérfano (inocuo).

### Precios
- `formatPrice(price, currency)` → `$250.000`. `formatPriceCompact` → `USD 250k` (pines).

### Mapa — performance
- Debounce 400ms en `moveend`. `ClusterLayer` diff por ids. `useProperties` con SELECT acotado, no `*`. La lista mobile usa `bounds = null` (toda la ciudad).

---

## Base de Datos — Referencia Rápida

### Acceso a la base — MCP de Supabase (solo lectura)

El repo tiene configurado el MCP oficial de Supabase (`.mcp.json`, transporte HTTP,
hosted). Está **acotado a este proyecto** (`project_ref`) y en **modo solo lectura**
(`read_only=true`): todas las consultas corren como usuario de Postgres de solo lectura.

- **Para medir la base, usar las tools de MCP** (`list_tables`, `execute_sql`). No pedirle
  al usuario que corra queries a mano ni asumir el contenido de la base a partir de la
  documentación: la documentación puede estar desactualizada, la base no.
- **Toda escritura rebota en el motor**, no por convención: `INSERT`/`UPDATE`/`DELETE`/
  `ALTER` fallan con "read-only transaction". No intentar rodearlo.
- **Los cambios de schema los ejecuta el usuario a mano** en el SQL Editor de Supabase.
  Si una tarea necesita un `ALTER`, dejarlo escrito en el informe; nunca ejecutarlo.
- Grupos de tools habilitados: `database`, `debugging`, `development`, `docs`. Storage,
  branching, edge functions y gestión de cuenta están deshabilitados a propósito.

Schema en `supabase/migrations/20240101000000_initial_schema.sql`.

| Tabla | Descripción |
|---|---|
| `cities` | Mercados. Centro del mapa y zoom por ciudad. **No tiene límites geográficos** (solo `center_lat`/`center_lng`/`default_zoom`): por eso el buscador de direcciones usa un umbral de distancia en vez del ejido real |
| `agencies` | Inmobiliarias. `city_id` NOT NULL. `tenant_type` (`agency`/`individual`) **legacy**: el registro escribe siempre `'agency'`; nada de la base la lee (verificado: 0 funciones y 0 policies la mencionan). `phone_wa` NOT NULL. `license_number` (matrícula, TEXT nullable) + `approval_status` (`pending`/`approved`/`rejected`, DEFAULT `pending`). `brand_color` para white-label futuro |
| `subscriptions` | `plan` (el que RIGE) + `pending_plan` (pedido, esperando activación) + `status`, `property_limit`, entitlements `has_*`, y `activated_at` (desde cuándo rige el pago). Por agencia |
| `agents` | `id` = `auth.users.id`. `agency_id` NOT NULL. `role` (`admin`/`agent`) gatea la sección Equipo. `email` denormalizado de auth.users (copia de lectura) |
| `properties` | `agency_id` y `city_id` NOT NULL; `location` GEOGRAPHY generada. `location_source` (TEXT nullable, CHECK `manual`/`suggested`): de dónde salió la coordenada. **Dato de medición: no gatea nada** |
| `property_images` | `is_cover` + `sort_order` |
| `leads` | Contactos WA. Incluye `agency_id`. Se listan en `/dashboard/leads` (Consultas), diferenciado por rol vía RLS |
| `agency_reviews` | Historial de decisiones de aprobación (`decision` `approved`/`rejected`, `note`, `reviewed_by`, `created_at`). **RLS habilitada y CERO policies a propósito**: solo service role desde el server. Ahí vive la nota del rechazo, que no puede ir en `agencies` porque esa tabla es de lectura pública |

**Policies RLS clave:** lectura pública de cities/agencies/properties activas; agentes ven y gestionan lo suyo (`Agent manages own properties` = `agent_id = auth.uid()`) + leen propiedades de su agencia (para el conteo); el admin gestiona las propiedades de su agencia vía **service role + validación** (`authorizePropertyAccess`), NO por policy nueva — las policies de `properties` no se tocaron; `Agent reads own leads` (un agent ve los suyos) + `Admin reads agency leads` (un admin ve los de toda su agencia — Fase 3, ya aplicada); `Public insert lead` valida que property+agent+agency coincidan (todavía no contempla `agent_id IS NULL`, eso llega con agente desvinculado); escritura de subscriptions solo service role.

**Query principal:**
```sql
SELECT ... FROM properties
WHERE city_id = $1 AND status = 'active'
  AND lat BETWEEN $south AND $north AND lng BETWEEN $west AND $east;
```

**Amenities** JSONB: filtrar con `.contains("amenities", JSON.stringify([...]))` (genera `@>`).

**Triggers de `properties` (los dos gates de publicación, ver "Bloqueo de publicación"):** `trg_check_agency_approved` (BEFORE INSERT → agencia aprobada) y `trg_check_property_limit` (BEFORE INSERT OR UPDATE → cupo del plan; sin fila de suscripción el límite es 0). Los dos lanzan SQLSTATE **23514**.

**Vistas RPC:** `increment_views(property_id)` — incrementa `views_count` (SECURITY DEFINER).

---

## Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # Requerido: registro de agentes + suscripciones
ADMIN_USER_ID=                 # Requerido para /admin: auth.uid() (UUID) del dueño de la plataforma. Server-side (sin NEXT_PUBLIC_). Fail-closed: si falta, /admin deniega a todos
NEXT_PUBLIC_MAPTILER_KEY=      # Opcional
GEOCODING_USER_AGENT=          # Opcional pero MUY recomendado en producción: User-Agent con contacto para el buscador de direcciones (política de Nominatim). Server-side (sin NEXT_PUBLIC_). Si falta, se usa un default que identifica la app pero no lleva dirección de contacto
GEOCODING_SIMULATE_OUTAGE=     # ⚠ SOLO PRUEBA LOCAL, NUNCA EN PRODUCCIÓN. Server-side (sin NEXT_PUBLIC_). Con cualquier valor distinto de vacío/"0"/"false", TODA búsqueda de direcciones devuelve "servicio no disponible" sin salir a la red. Existe para verificar a mano que una caída del buscador no rompe el alta ni la edición de propiedades (cortar internet no sirve: también corta Supabase y entonces no se puede guardar nada). Ausente = apagado
```

**Las dos del buscador de direcciones, en una línea:** ninguna es obligatoria para que la app arranque (la feature es un atajo). En **producción hay que setear `GEOCODING_USER_AGENT`** con una identificación que incluya contacto —lo pide la política de Nominatim— y **`GEOCODING_SIMULATE_OUTAGE` no debe existir**; es de uso local y mientras esté puesta ninguna búsqueda funciona. Ver "Ubicación de la propiedad".

---

## Comandos Útiles

```bash
npm run dev
npx tsc --noEmit
npm run lint          # debe dar 0 errors
npx next build
supabase gen types typescript --local > src/types/supabase.ts
npx shadcn@latest add [componente]
```

---

## Decisiones de Arquitectura — No Cambiar sin Justificación

| Decisión | Razón |
|---|---|
| Marketplace por ciudad | La concentración de oferta es el valor; efecto de red |
| Multi-tenant (`agency_id`/`city_id`) | Permite white-label futuro sin reescribir |
| cityStore (Zustand) | Una sola instancia compartida; evita desincronización del selector con el mapa |
| getPlanUsage por agency_id | Coincide con el trigger; correcto en agencias multi-agente |
| Admin client para registro | La sesión no está disponible en server justo tras signUp |
| is_featured gateado por `has_featured` en server action | El trigger solo valida cantidad, no features; el gating lee el booleano de la suscripción, no el nombre del plan |
| Debounce 400ms + diff por ids | Evita ráfaga de queries y recreación de markers al panear |
| Tiles OSM (no CARTO/tonal) | Mejor contraste con los pines terracota; CARTO lavaba el mapa |
| Pin terracota (no blanco) | Contraste sobre el mapa; activo en negro para distinguir selección |
| Suscripción fija, no comisión | El cierre ocurre en WhatsApp fuera de la app |
| PWA, no app nativa | El visitante usa la app pocas semanas |
| Pin manual como fuente de verdad, con sugerencia opcional a pedido | Los mapas no son precisos en muchas ciudades, así que la coordenada final la decide una persona. La sugerencia es un punto de partida que **no confirma nada**: refina la regla vieja, no la deroga |
| Búsqueda de dirección por BOTÓN, nunca al tipear | La política de uso de Nominatim prohíbe el autocompletado. No es una preferencia de diseño: incumplirla se paga con un bloqueo |
| La llamada al geocodificador sale del servidor (ruta propia), no del navegador | El navegador no puede setear el User-Agent que la política exige; y solo con un punto de salida único se pueden garantizar el límite de 1/s, la caché y el cambio de proveedor sin tocar el cliente |
| El gate de sesión de `/api/geocode` vive adentro del handler, no en `proxy.ts` | El proxy solo cubre `/dashboard` y `/admin`, así que la ruta nace pública; y un proxy que redirigiera un `POST` de `fetch` al login devolvería HTML con estado 200, que el cliente leería como éxito |
| El barrio NO viaja a la consulta de geocodificación | Medido: el barrio que la gente usa ("Centro") devolvió una calle homónima a 158 km, mientras que sin barrio la dirección se encuentra a 0,9 km. Un barrio que no coincide con lo mapeado no solo tapa la dirección: manda a buscar a otra ciudad |
| Guardar exige "la ubicación actual está confirmada", no "el pin se movió alguna vez" | La regla vieja era irreversible y se podía satisfacer y después deshacer: arrastrar el pin y luego tocar "Centrar" publicaba la propiedad en el centro exacto de la ciudad. Es un bug que existía sin ningún geocodificador de por medio |
| `LocationPicker` controlado (la posición vive solo en el formulario) | Tenía estado propio *además* de la prop, y la confirmación estaba duplicada en dos componentes que no se conocían: esa duplicación es lo que permitió el bug de arriba |
| `location_source` no gatea nada | Es un dato de medición para comparar a posteriori la calidad de las ubicaciones sugeridas contra las arrastradas. En cuanto condicione una decisión deja de medir el comportamiento y empieza a alterarlo |
| Leaflet en lugar de Mapbox | Tiles OSM gratuitos sin límite |
| `amenities` como JSONB | Flexible, sin migraciones al agregar amenities |
| `proxy.ts` (no middleware.ts) | Convención Next.js 16 |
| White-label en `/[slug]` del root (no prefijo, no subdominio) | Es lo que se vende: URL limpia. Las ciudades salen del root → sin colisión de namespace |
| `resolveAgencyBySlug` con service role | El visitante white-label es anónimo y la RLS de `subscriptions` le ocultaría `has_white_label`; sin service role, toda agencia parecería `disabled`. Server-only, campos no sensibles, sin tocar policies |
| `h-dvh` + lock de scroll del body (no `h-screen`) | `100vh` deja el documento scrolleable en mobile; el "scroll into view" al enfocar saca el header de flujo normal. `dvh` + lock atacan las dos condiciones de raíz, no los síntomas |
| Logo de agencia: upload client-side + escritura de `logo_url` por service role (no upload por server action) | Lo sensible es la escritura en `agencies` (gateada a admin), no el archivo en Storage (bucket público). Reusa el patrón del avatar, no estrena upload server-side con FormData |
| `free` sobrevive como estado de aterrizaje al eliminar los particulares (no se borró del schema ni de `PLAN_ORDER`) | El plan cumplía dos funciones: plan comercial del particular (se eliminó) y estado inicial de toda alta (es el andamio de `plan`/`pending_plan`, del que dependen registro, activación en `/admin` y `getPlanUsage`). Borrarlo habría roto el flujo de upgrades |
| `tenant_type` no se borró al pasar a solo-agencias | Ninguna policy, función ni trigger la lee (verificado por consulta); borrar una columna NOT NULL con CHECK no aporta nada y la tabla `agencies` se vuelve a tocar en el trabajo de matrícula. Se cerró la puerta de entrada, no la columna |
| Guarda de reentrada de `/register/plan` en la página **y** en la action, no en `proxy.ts` | La server action se puede invocar sin pasar por el render, así que la página sola no alcanza. El proxy queda afuera porque necesitaría consultar `subscriptions` en el middleware: más caro y peor lugar |
| Estado de aprobación en `agencies`, independiente de la suscripción | "¿Es legítima?" y "¿paga?" son preguntas distintas y se cruzan libremente. Derivar una de la otra obligaría a inventar estados imposibles (una agencia aprobada que deja de pagar no deja de ser legítima) |
| La nota del rechazo en `agency_reviews` (RLS sin policies), no en `agencies` | `Public read agencies` (`qual: true`) hace legible **cualquier** columna de `agencies` con la anon key, y Postgres no permite restringir columnas dentro de una policy. Además, como el rechazo no es definitivo, cada decisión es una fila y no pisa la anterior |
| Índice único de matrícula PARCIAL (solo entre aprobadas de la misma ciudad) | Un UNIQUE común haría reventar el registro: la solicitud legítima nunca llegaría al panel y el formulario le confirmaría a un impostor qué matrículas existen. Con el parcial, el choque ocurre al aprobar, frente a una persona |
| Bloqueo de publicación por TRIGGER, no por policy RLS | `createPropertyAction` usa service role cuando un admin publica a nombre de otro agente, y el service role saltea las policies. El trigger corre siempre, sin importar el rol: es la única barrera que cubre los dos caminos |
| La sesión del área privada se resuelve en un solo helper cacheado (`resolveAgentSession`) | Estaba copiada en 21 lugares con 5 selects y 4 comportamientos distintos ante "no hay fila"; esa dispersión fue la causa raíz del bucle de redirecciones. `cache()` evita que centralizar cueste una consulta extra por página |
| Salida del bucle por route handler (`/logout`), no por action ni Server Component | Un Server Component no puede borrar cookies (documentado en `lib/supabase/server.ts`), así que no puede cerrar sesión; y una action se invoca desde un form, no desde un render. Solo el route handler puede hacer las dos cosas: cerrar la sesión y redirigir |

---

## Método de Diagnóstico

Cuando el usuario reporta un síntoma visual, **inspeccionar el estado real del DOM y las clases aplicadas antes de teorizar sobre el pipeline de build**. La causa más simple (un elemento en otro estado, una clase pisada) es más probable que una corrupción de caché. No verificar en entornos aislados (headless, build paralelo) cuando el síntoma aparece en la app corriendo — la evidencia está en el DOM real.

## Diseño

@DESIGN.md

## Pendientes

Para deuda técnica, piezas futuras y decisiones de producto abiertas, ver `PENDIENTES.md` (no se listan acá para mantener este archivo enfocado en lo que el proyecto ES, no en lo que falta).
