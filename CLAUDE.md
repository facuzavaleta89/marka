# CLAUDE.md — App Mapa Inmobiliario (Marka)

> Este archivo provee contexto persistente a Claude Code sobre la arquitectura, convenciones y reglas del proyecto. Leerlo antes de cualquier tarea de código.

---

## Resumen del Proyecto

Marketplace inmobiliario por ciudad llamado **Marka**. Una sola web pública donde el visitante ve en un mapa interactivo las propiedades de **todas las agencias de su ciudad**, filtra, y contacta al agente por WhatsApp. Las agencias pagan una suscripción para publicar.

**Modelo de negocio:** SaaS B2B, **solo para inmobiliarias** (no hay cuentas de particular). **Tres planes de venta:** inicial (20 propiedades), profesional (60, + white-label), premium (200, + white-label + destacados + métricas). El visitante no paga ni se registra. ⚠ **"Métricas" es hoy una promesa de catálogo, no un gate:** el flag `has_metrics` se escribe y se lee en `getPlanUsage`, pero **ningún componente lo consume** (medido el 14 sep 2026), y **ninguna de las agencias lo tiene en `true`**. Las visitas y consultas por propiedad se muestran **en todos los planes, a propósito** (ver "Visitas y consultas por propiedad"); lo que queda reservado a premium es el análisis, que todavía no existe.

**`free` NO es un plan de venta, es un estado.** La columna `subscriptions.plan` admite un cuarto valor, `free` (límite 1), que es el **estado de aterrizaje** de toda alta: la agencia nace ahí y sigue ahí mientras espera que el dueño de la app active el plan pago que pidió. Nunca se ofrece como opción. Ver "Suscripciones y límites".

**Dos tipos de usuario:**
- **Visitante (cliente)**: sin registro. Navega el mapa, filtra, ve detalles, contacta por WhatsApp, guarda favoritos localmente.
- **Agente (cliente de pago)**: login. CRUD de propiedades, perfil, preferencias, suscripción, métricas de sus propiedades y leads.

**Arquitectura:** marketplace multi-tenant. Un solo mapa por ciudad muestra todas las agencias juntas, pero los datos están separados por `agency_id` y `city_id`, lo que permite a futuro activar vistas white-label (`agencia.dominio.com` con solo sus propiedades) sin reescribir nada.

**Distribución:** web responsive + PWA instalable. No hay app nativa ni stores.

**Estado:** Deployado en Vercel, **sin datos reales todavía** (lo cargado es de prueba; el lanzamiento con inmobiliarias fundadoras se apunta a octubre). MVP + multi-agente completos. **Fase White-label cerrada** en lo esencial: Sub-pieza A (ruta `/[slug]` + mapa filtrado + gate de plan), B1 (subir logo) y B2a (mostrar logo + nombre + "powered by Marka." en el header) hechas y probadas. **B2b (variante admin en `disabled`) y C (slug editable) estuvieron EN PAUSA meses y se cerraron el 12–13 sep 2026** — ver el grupo del sitio de marca, al final de este párrafo. **Fase de modelo de agencias CERRADA** (ago 2026): solo-agencias, matrícula + aprobación manual, bloqueo de publicación en la base, sesión unificada. Ver "Aprobación de agencias" abajo. **Fase de cobrabilidad CERRADA** (31 ago – 1 sep 2026): la visibilidad pública ahora depende de que la agencia esté al día (ver "Visibilidad pública de las propiedades") y el panel `/admin` dejó de ser de una sola vía —cancelar solicitud, vencimiento, baja/reactivación, eliminación y cambio de plan (ver "Panel de plataforma")—. **Ese era el bloqueante para poder cobrar y ya no lo es.** **Fase de modelo de la propiedad CERRADA** (3 sep 2026): una propiedad puede ofrecerse en **varias operaciones a la vez** con precio y moneda propios por operación, el **precio es opcional** ("a convenir") y las propiedades en alquiler llevan **requisitos para el inquilino**. Ver "Operaciones, precios y requisitos de la propiedad". **Grupo de archivos de Storage CERRADO** (5–6 sep 2026), en tres tandas: policies finas por agencia, borrado de archivos en los caminos que no lo hacían, y una herramienta de línea de comandos que audita y limpia huérfanos. El bucket quedó en **9 objetos y 707 kB, sin un solo huérfano**; venía de 24 objetos y 6,4 MB con el 89 % del peso en basura. Ver "Imágenes y Storage". **Grupo de blindaje CERRADO** (7 sep 2026, última de sus cinco tandas): una agencia **ya no puede existir sin fila de suscripción** —lo garantiza un trigger en la base— y el choque de matrícula duplicada al aprobar **se explica**, con la matrícula en conflicto y la regla, en vez de un "no se pudo" genérico. Ver "Suscripciones y límites" y "Aprobación de agencias". **La consulta sobrevive al agente** (7 sep 2026): borrar un agente con consultas a su nombre **antes fallaba siempre** contra una clave foránea; ahora la consulta se **desvincula** y conserva el nombre de quien la atendió en una **copia congelada que escribe la base**, no el cliente. En la misma tanda: el registro de una consulta **ya no falla en silencio** en el mapa público, y el aviso previo al borrado de un agente **dice también qué pasa con sus consultas**. Ver "La consulta sobrevive al agente". **Cada propiedad tiene su página pública propia** (7–8 sep 2026): `/propiedades/[slug]`, renderizada en el servidor e indexable, con vista previa enriquecida al compartir el enlace, botón de compartir, mapa del sitio y archivo de instrucciones para buscadores. Y **el modal dice quién publica**: logo y nombre de la inmobiliaria más el nombre del agente que atiende. Ver "Página pública de la propiedad" y "Quién publica". **Grupo de captación y difusión CERRADO** (10 sep 2026, con su tercera y última pieza): el enlace del encabezado público que decía **"Ingresar"** —sin decir para quién era— es ahora una **puerta de captación**: un llamado a sumar la inmobiliaria que lleva al registro, más el ingreso como enlace secundario. La pieza además **desduplicó** ese enlace, que estaba escrito en dos archivos y cuyas copias ya habían empezado a divergir, y le puso al encabezado de la home las **guardas de ancho** que tenía el del sitio de marca y a él le faltaban enteras. Ver "El encabezado público". **Grupo de coherencia del panel CERRADO** (10–11 sep 2026, cinco tandas): era un grupo chico —un cartel, un banner y una ruta— y **destapó el bug más caro medido hasta ahora**: pedir un plan mayor **sacaba a la agencia del mapa** hasta que el dueño se lo activara a mano, porque el pedido escribía `status: 'pending'` y la regla de visibilidad exige `'active'`. **Una agencia que quería pagar más se apagaba sola.** De ahí salió la regla que gobierna el modelo de planes: **un pedido abierto se detecta por `pending_plan`, NUNCA por el estado** (ver "Un pedido de plan abierto"). En la misma tanda: el panel ahora **dice cuándo una agencia no se está viendo** (cartel de tres motivos, nunca dos a la vez, con un helper nuevo espejo de la regla de visibilidad), el **banner de error** se extrajo de las cuatro copias que ya habían divergido, `/register/plan` entró a la lista de rutas protegidas, y **dos mensajes dejaron de prometer lo que el cupo del aterrizaje no permite**. Ver "El cartel de visibilidad del panel" y "El estado de aterrizaje y su cupo". **Grupo del sitio de marca CERRADO** (12–13 sep 2026, cuatro tandas), y con él las dos sub-piezas que llevaban meses en pausa. **(1)** La dirección del sitio **ya se puede editar** —antes se generaba del nombre y no se cambiaba desde ningún lado—, y antes hubo que cerrar un agujero que ya existía: **no había NINGUNA lista de direcciones reservadas**, así que una agencia podía quedarse con `admin` o `precios` y dejar su propio sitio inalcanzable en silencio. **(2)** El sitio apagado **le habla a su administrador**: seis motivos distintos, con botón solo en los tres que él puede resolver, y un descarte por cookie para que el visitante anónimo no pague nada. **(3)** El cambio de nombre quedó completo: dos columnas de rastro, la distinción en el panel y **dos formas de rechazo**, porque rechazar un nombre no es lo mismo que rechazar una agencia que venía funcionando y pagando. **(4) Y recién en la cuarta tanda se descubrió que las tres anteriores se habían construido sin que existiera el campo para pedir el cambio**: una capacidad entera en el servidor sin punta en la interfaz. De ahí salió la regla de método más cara del grupo (ver "Método de Diagnóstico" → recorrer de punta a punta). Ver "La dirección del sitio de marca", "El sitio apagado le habla a su dueño" y "El cambio de nombre de la agencia". **El contador de visitas cuenta** (14 sep 2026, tres tandas): la columna `views_count` valía **0 en todas las propiedades** porque la función que la incrementa existía en la base y **ningún camino del código la llamaba**, y era lo primero que una inmobiliaria iba a mirar en su panel. **(1)** El listado del panel muestra **visitas y consultas por propiedad**, separadas y en todos los planes, con los contactos traídos en **una sola consulta agregada**. **(2)** La visita se cuenta desde **tres lugares** —pin, tarjeta de la lista y ficha pública—, **una vez por propiedad por visitante**, y en la ficha **con la primera interacción, nunca al montar**. **(3)** Contar una visita **movía la fecha de modificación que el mapa del sitio le informa a los buscadores**; se cerró con una guarda en la base que acopla dos funciones por una variable de transacción. **Y el primer intento de esa guarda falló por una trampa de PostgreSQL** que quedó escrita en "Método de Diagnóstico": dentro de un trigger BEFORE, la columna generada todavía no tiene su valor. Ver "Visitas y consultas por propiedad" y "Base de Datos" → la guarda de `updated_at`. **Panel y destacadas** (16 sep 2026): permisos de escritura de `agents` y `properties` cerrados en la base; el panel **se usa bien en un celular** (barra superior en el flujo, cajón accesible); las dos hojas comparten el gesto de arrastre y el mismo alto en `dvh`; contador de visitas, URLs de archivos y teléfonos **blindados en la base**; y las **destacadas pasaron a ser un cupo por plan** que hace cumplir la base, con su marca en el menú del listado. Ver "Permisos de escritura del usuario", "Blindaje de columnas", "Cupo de destacadas", "El panel en celular" y "Las hojas que suben desde abajo".

**Baseline de calidad medido (no documentado de memoria; última medición: 14 sep 2026):** `npx tsc --noEmit` 0 errores (exit 0), `npm run lint` **0 errores y 1 warning** (`PropertyForm.tsx:919`, exit 0), `npx next build` verde (exit 0) con **22 rutas**. *(Re-medido el 15 sep 2026 al cerrar el grupo de pulido, y el 16 sep 2026 al cerrar el panel y las destacadas: sin cambios salvo el número de línea del warning, que no es parte del baseline.)* Cualquier error nuevo, un warning distinto del único conocido, o una ruta que aparezca sin motivo, es una regresión.

> ⚠ **Las rutas pasaron de 19 a 22, y es la ÚNICA vez que el número se movió.** Las tres nuevas son de la página pública de la propiedad: **`/propiedades/[slug]`** (la página, dinámica), **`/sitemap.xml`** (dinámica: ver "Infraestructura de buscadores") y **`/robots.txt`** (estática). Las dos últimas no son código de aplicación sino **archivos de convención de Next**, que cuentan como ruta en ese listado igual que `/apple-icon.png`, que ya estaba. Las 19 anteriores siguen las 19, con el mismo nombre y el mismo tipo (`○`/`ƒ`).
>
> ⚠ **Y un ruido de medición que ya mordió una vez:** `tsconfig.json` incluye `".next/types/**/*.ts"` y `".next/dev/types/**/*.ts"`, o sea **artefactos generados**. Si se mezclan los de `next dev` con los de `next build` (por ejemplo corriendo `next start` entre medio), `npx tsc --noEmit` escupe decenas de errores en `.next/**/validator.ts` que **no son del proyecto**. Ante una corrida así: borrar `.next` y `tsconfig.tsbuildinfo` y repetir. ⚠ **Pasa también al cambiar de rama** (16 sep 2026: `tsc` falló por una ruta de otra rama que seguía en `.next/types`) **y después de agregar tokens al `@theme`** (el servidor de desarrollo siguió sirviendo el CSS viejo). Remedio: `rm -rf .next` y reiniciar `npm run dev`. Si los errores no están en `src/` ni en `scripts/`, no son tuyos. Ver "ESLint". ⚠ El chequeo de tipos y el lint **también cubren `scripts/`** (el `include` de `tsconfig.json` es `**/*.ts` y ESLint no lo ignora): una herramienta rota ahí rompe el baseline igual que el código de la app.

> **⚠️ Hoja de ruta de modelo (tras validación con el rubro y el colegio de corredores).** **Ya aplicado:** los particulares se eliminaron (la app es solo-agencias); las agencias requieren **número de matrícula + aprobación manual** del dueño de la plataforma (ver "Aprobación de agencias"); y el formulario de propiedad tiene el **atajo de sugerencia de ubicación desde la dirección** (ver "Ubicación de la propiedad"), que era el ítem D1 de la hoja de ruta; y **el mapa público ya filtra por agencia habilitada** (era el bloqueante para cobrar: ver "Visibilidad pública de las propiedades"); y **una propiedad puede estar en venta y en alquiler a la vez**, con **precio opcional** ("a convenir") y **requisitos de alquiler** (ver "Operaciones, precios y requisitos de la propiedad"); y **cada propiedad tiene su página propia con enlace compartible** (era el ítem C2, ver "Página pública de la propiedad"); y el encabezado público **le habla a las inmobiliarias** en vez de ofrecer un "Ingresar" mudo (era C3, ver "El encabezado público"). **Pendiente:** solo el registro opcional de visitantes (C1). Ver PENDIENTES.md → "Nueva fase".

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
- **Dos "admin" distintos, no mezclar:** `isAppAdmin` (dueño de la plataforma, por `ADMIN_USER_ID`, gatea `/admin` — ⚠ **`/admin` se gatea por `ADMIN_USER_ID` y NUNCA por `agents.role`**: un `role = 'admin'` es admin de SU agencia y no le abre nada de la plataforma) vs `isAgencyAdmin` (`agent.role === 'admin'`, admin de su agencia, gatea "Equipo"). El layout del dashboard calcula ambos y los pasa al Sidebar.
- **Gestión de equipo (`/dashboard/equipo`, `equipo/actions.ts`, solo admin):** el admin **crea** agentes (`createAgentAction`: `admin.auth.admin.createUser` con `email_confirm: true` + contraseña temporal que comparte; NO `signUp`, que pisaría su sesión; rollback con `deleteUser` si el insert en `agents` falla) y **elimina** agentes (`deleteAgentAction`, **Modelo B**: reasigna las propiedades del agente al admin ANTES de borrar, así nunca quedan huérfanas; después `admin.auth.admin.deleteUser` cascadea y borra la fila `agents`).
  - **⚠ LAS DOS COSAS DEL AGENTE TIENEN DESTINOS DISTINTOS, Y CONFUNDIRLOS ES EL ERROR CARO.** Las **propiedades** se **REASIGNAN** al admin (son un activo vivo: tienen que seguir teniendo dueño). Las **consultas** se **DESVINCULAN** solas y conservan el nombre (son un hecho histórico: no cambian de dueño ni desaparecen porque alguien se fue). Ver "La consulta sobrevive al agente".
  - **Las dos FK medidas contra la base (7 sep 2026):** `properties_agent_id_fkey` es **NOT NULL + `ON DELETE CASCADE`**, con lo cual la reasignación previa del Modelo B **no es una prolijidad: es lo único que impide perder las propiedades** —invertir ese orden las borraría, con sus imágenes detrás—. `leads_agent_id_fkey` es **nullable + `ON DELETE SET NULL`**.
  - ⚠ **CORRECCIÓN DE ALGO QUE ESTUVO ACÁ Y HOY ES FALSO.** Este párrafo decía que `leads.agent_id` era **NOT NULL** con la FK **sin cláusula `ON DELETE`**, y que por eso **"no se puede borrar un agente que tenga consultas a su nombre"**. Era cierto y está **RESUELTO** (7 sep 2026): la columna pasó a nullable y la FK a `SET NULL`. Hoy ese borrado funciona. **Medido en producción:** hay una consulta con `agent_id NULL` y `agent_name = 'Luis Lescano'` — un agente creado, contactado desde el mapa y después borrado, con su consulta intacta.
  - Barreras de `deleteAgentAction`: no auto-borrarse (la agencia no queda sin admin), ser admin, y que el agente target sea de la misma agencia (todo server-side). El `agency_id` del caller siempre del server. Falta (pieza siguiente): **desactivar** agente (`is_active`, reversible).
- **Gestión de propiedades por el admin (`propiedades/actions.ts`):** un admin de agencia edita/elimina/cambia estado de las propiedades de TODA su agencia; un agente normal, solo las suyas. La autorización vive en el helper **`authorizePropertyAccess(id)`** (reemplazó a `verifyOwnership`): lee la propiedad por id, y devuelve `mode: "owner"` si `agent_id === auth.uid()` (escribe con client normal, la RLS lo permite) o `mode: "admin"` si el user es `role === 'admin'` y su `agency_id` coincide con el de la propiedad (escribe con **service role**, porque la RLS `agent_id = auth.uid()` bloquearía al admin sobre algo ajeno). Cualquier otro caso → "Propiedad no encontrada" (mismo mensaje que "no existe", no revela propiedades ajenas). **El helper decide qué client usar (`db`), no cada action** — imposible que una action olvide el client correcto. `role`/`agency_id` del caller SIEMPRE del server; la igualdad de `agency_id` es la única barrera en `mode: "admin"`. Las policies RLS NO se tocaron en esa pieza (opción service role, no policy nueva). ⚠ El 16 sep 2026 `Agent manages own properties` sí cambió —ganó `WITH CHECK`—, sin afectar este camino: ver "Permisos de escritura del usuario" en "Base de Datos". El listado (`propiedades/page.tsx`) filtra por `agency_id` si admin (con columna "Agente") o por `agent_id` si no. `[id]/editar` permite abrir propiedades de la agencia si el user es admin.
- **Reasignar `agent_id` (admin, crear y editar):** el `PropertyForm` muestra un selector "Agente asignado" **solo si recibe `agencyAgents`** (las páginas lo pasan solo cuando el caller es admin; un agente normal no ve el campo). El input pasa por **`resolveAssignedAgent`** en la action, con tres barreras server-side: (1) si el caller no es `admin` → se ignora (devuelve null); (2) el destino debe existir **dentro de la agencia** (`.eq("agency_id", agencyId)`) → reasignar a otra agencia es imposible por construcción; (3) `role`/`agencyId` salen del server, el cliente solo aporta el `id` candidato. El peor caso de un input manipulado es "no se reasigna", nunca una reasignación no autorizada. Sutileza de RLS: `Agent manages own properties` exige `agent_id = auth.uid()` también en la fila resultante (antes porque el `USING` se reusaba como check; desde el 16 sep 2026 por su `WITH CHECK` explícito, que además fija agencia y ciudad), así que escribir un `agent_id` ≠ `auth.uid()` rebota con el client normal → al reasignar se usa **service role** (en create si nace a nombre de otro; en update incluso cuando un admin reasigna SU PROPIA propiedad, caso `mode: "owner" && reassigning`). Leads nuevos van al nuevo agente (el modal copia `property.agent_id`); los viejos quedan con el anterior (no retroactivo). Reasignar no afecta el conteo del plan (por `agency_id`) ni dispara el trigger de límite.
- Modelo previsto a futuro: `admin` además gestiona la suscripción y ve los leads de toda la agencia; `agent` hace CRUD de lo suyo.
- **Registro: SOLO INMOBILIARIAS, en dos pasos.** Paso 1 (`/register`): crea agencia nueva + agente `admin` + suscripción `free`/`active`, siempre. **No hay selector de tipo de cuenta**: `tenant_type: 'agency'` lo escribe el servidor, fijo. Campos obligatorios de la agencia: **razón social** (con `.trim()`, para que un nombre de solo espacios no pase) y **número de matrícula** del colegio de corredores. Paso 2 (`/register/plan`): elige plan. **Ambos caminos terminan en el paso 2**.
  - **La matrícula se guarda como TEXTO, nunca como número** (`agencies.license_number`): los ceros a la izquierda son parte de la matrícula, y aunque en Santiago del Estero es solo numérica, otras provincias usan letras. Formato y normalización (sin espacios, en MAYÚSCULAS, alfanumérico + guiones, hasta 20) viven en **`src/lib/utils/licenseNumber.ts`**, compartidos por el formulario y por las server actions — el cliente valida para dar feedback, el server valida de nuevo porque es la única barrera real.
  - **El alta NO escribe `approval_status`**: el DEFAULT de la base deja la agencia en `'pending'`. Escribirlo desde el código sería darle al alta la capacidad de auto-aprobarse.
  - **`registerAction` hace rollback del usuario de Auth** si falla el insert de `agencies` o el de `agents` (`admin.auth.admin.deleteUser`), igual que `createAgentAction`. Sin eso quedaba un `auth.users` huérfano: una sesión válida que no resuelve ninguna inmobiliaria. **Ojo: el upsert de `subscriptions` todavía no tiene rollback** (ver PENDIENTES.md).
- **Selección de plan (`/register/plan`):** modelo `plan` (lo que RIGE) vs `pending_plan` (lo PEDIDO). Ofrece **solo los tres planes pagos** (`PAID_PLANS`, derivado de `PLAN_ORDER` filtrando `free` dentro del componente — **no** se saca `free` de `PLAN_ORDER`, que es el dominio de la columna). Al elegir: `plan` queda en `free`, `pending_plan` = el elegido, `status: 'pending'`, y `property_limit`/`has_*` de free hasta la activación manual. **Nunca se pisa `plan` al pedir un upgrade** — lo pedido vive en `pending_plan`. Ninguna card viene preseleccionada y "Continuar" arranca deshabilitado, así que la pantalla no puede mandar `'free'` a la action. Se puede saltear con "Decidir más tarde" (link a `/dashboard`). La server action deriva el `agency_id` del `auth.uid()`, nunca del cliente, y usa admin client acotando el UPDATE a esa agencia (no hay policy de UPDATE de subscriptions para usuarios).
- **⚠ Guarda de reentrada en `/register/plan` (arreglo de bug, no tocar sin entender).** Esa ruta es **exclusivamente** para una agencia recién registrada que todavía no definió nada. La condición, idéntica en la página y en la action, es el "aterrizaje virgen": la suscripción existe **y** `plan === 'free'` **y** `pending_plan === null` **y** `status === 'active'`. Cualquier otro caso → `redirect("/dashboard/suscripcion")` en la página, y error sin escribir nada en la action. Va en los dos lugares porque **una server action se puede invocar sin pasar por el render**. El bug que cierra: la ruta quedaba accesible para siempre (el proxy compara `pathname === "/register"` con igualdad exacta, así que `/register/plan` no matchea) y la action escribía `plan: 'free'` + límites de free **incondicionalmente** — una agencia con plan pago activo que volviera ahí se auto-degradaba, perdía el white-label y quedaba por encima del límite, sin confirmación ni vuelta atrás. La action además rechaza explícitamente un `plan === 'free'` entrante. **La protección NO está en `proxy.ts`** (metería una query a la base en el middleware): si la buscás ahí, no está.
- **Pedir upgrade desde el dashboard** (`/dashboard/suscripcion`): mismo modelo. "Pasar a {plan}" pide confirmación y **anota `pending_plan` y NADA MÁS**: no toca `plan`, ni los límites, **ni `status`**. La agencia sigue `active` con el plan que rige y paga, así que **sus propiedades siguen en el mapa**. El botón pasa a "Pendiente". ⚠ **Acá decía que además seteaba `status: 'pending'` y que "el cliente sigue operando con lo que rige hasta la activación". La segunda mitad era FALSA y es la razón por la que el bug no se vio:** era cierta para el cupo y las funcionalidades, y falsa para lo único que la agencia paga —aparecer en el mapa—, porque `agency_is_publicly_visible()` exige `status = 'active'`. Una agencia que quería pagar más **se apagaba sola** hasta la activación manual. Corregido el 11 sep 2026: **`'pending'` significa ahora una sola cosa, "todavía no tenés nada activo"**, que es lo que la regla de visibilidad asume, y **la única señal de que hay un pedido abierto es `pending_plan != null`** (lo preguntan la barrera de `changePlanAction`, el botón y el filtro del panel, la métrica y esa pantalla). La regla de la base **no se tocó**. **El cliente no puede cancelar su propio pedido**: lo hace el dueño desde `/admin` (ver "Panel de plataforma"). ⚠ **Y una suscripción `canceled`/`past_due` NO puede pedir un upgrade**: la action escribía `status: 'pending'` **sin mirar el estado previo**, así que una agencia dada de baja **se sacaba la baja sola** (pasaba a `'pending'`, que no bloquea la publicación) y volvía a publicar sin que el dueño hiciera nada. El corte está **en la server action**, no solo escondiendo botones: una action se invoca sin pasar por el render.
- **Activación (panel `/admin`)**: el dueño de la plataforma lee `pending_plan`, lo copia a `plan`, sube `property_limit`/`has_*` a los reales, `status: 'active'`, sella `activated_at`, limpia `pending_plan` y **opcionalmente carga un vencimiento**. El gating en runtime (badge, dashboard, bloqueo de "Nueva propiedad") usa siempre el plan que RIGE vía `getPlanUsage`, nunca el pedido. Las otras cinco acciones del panel están en "Panel de plataforma".
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
- **El choque de matrícula se explica, no se reporta como "no se pudo".** Cuando el dueño intenta aprobar una agencia cuya matrícula ya usa otra **aprobada de la misma ciudad**, `writeApproval` traduce el error con `translateApprovalWriteError` (`admin/actions.ts`) y muestra:
  > **No se pudo aprobar: ya hay otra inmobiliaria aprobada en la misma ciudad con la matrícula 1234. Revisá cuál de las dos corresponde antes de aprobar esta.**

  (Sin la matrícula: *"…con **esa matrícula**."*) El mensaje **explica la regla** —aprobada + misma ciudad, que son literalmente las dos condiciones del índice— porque eso es lo que le permite al dueño encontrar la otra agencia. Y **no dice "intentá de nuevo"**: el conflicto es de datos, no transitorio, y reintentar da siempre el mismo resultado.
- **⚠ LA DETECCIÓN EXIGE TRES CONDICIONES, Y EL CÓDIGO DE ERROR SOLO NO ALCANZA.** Sobre `agencies` hay **TRES índices únicos** (medido): `agencies_pkey`, `agencies_slug_key` y `idx_agencies_license_unique_approved`. **Los tres levantan `23505`**, así que un matcher que mirara solo el código reportaría un choque de matrícula ante un choque de slug. Las tres condiciones:
  1. `status === "approved"` — el gate de alcance (ver el punto siguiente);
  2. `code === "23505"` — el código, que es lo estable entre versiones;
  3. `message.includes("idx_agencies_license_unique_approved")` — **el nombre del índice viaja en el `message`**; los valores en conflicto viajan en el `details` (`Key (city_id, license_number)=(…, 1234) already exists.`), de donde se extrae la matrícula.

  La extracción del `details` es **una mejora, no una dependencia**: ante cualquier forma inesperada devuelve `null` y el mensaje sale sin el número. El formato del `details` es texto de Postgres, no un contrato.
- **⚠ EL MENSAJE ESTÁ GATEADO A LA APROBACIÓN, aunque el error no pueda ocurrir en los otros dos caminos.** `writeApproval` es compartida por aprobar, rechazar y reabrir. Rechazar y reabrir **sacan la fila del predicado** del índice (`WHERE approval_status = 'approved'`), así que no pueden chocar — pero eso depende de una propiedad del índice que podría cambiar. El gate por `status` vuelve la imposibilidad **estructural en el código**: decirle *"esa matrícula ya está en uso"* a alguien que está rechazando una agencia sería inventar un conflicto que no existe.
- **⚠ RECHAZAR O REABRIR UNA AGENCIA APROBADA LIBERA SU MATRÍCULA.** Es consecuencia directa de que el índice sea parcial: al salir de `approval_status = 'approved'`, la fila sale del predicado y su par `(city_id, license_number)` queda libre. **Si en el medio se aprueba otra con la misma matrícula, volver a aprobar la original va a fallar** — con el mensaje correcto, pero el conflicto va a parecer nuevo. Es inherente al índice parcial, no un defecto del código.
- **El NOMBRE se edita siempre; la MATRÍCULA se congela al aprobar.** ⚠ **Acá decía que los DOS eran "editables SOLO mientras está `pending` o `rejected`"**, con el motivo de que cambiar el nombre después de la aprobación *"tendría que ser otro flujo de aprobación que hoy no existe"*. **Ese flujo ya existe** —se construyó entero (ver "El cambio de nombre de la agencia")— y el congelamiento del nombre era lo único que faltaba sacar. Mientras estuvo, **toda esa maquinaria fue inalcanzable**. Hoy:
  - **`name`**: editable en cualquier estado. Cambiarlo devuelve la cuenta a `'pending'`, porque el colegio de corredores regula los nombres comerciales.
  - **`license_number`**: solo lectura con la agencia aprobada. Es el dato que se verificó contra el padrón para dar el alta; cambiarlo no es "revisar un nombre", es otra inmobiliaria. ⚠ Y la action **no rechaza** una matrícula distinta entrante: **la ignora** y escribe la de la fila real (`effectiveLicenseNumber`). Rechazar castigaría a quien no hizo nada —en el camino normal el campo ni se puede tocar— y lo que la persona quiso cambiar es el nombre.
  - ⚠ **`agencies` NO tiene policy de UPDATE**, así que la escritura va con service role y **deshabilitar los inputs es cosmético**: la regla la aplica `updateAgencyIdentityAction`, que relee `approval_status` de la fila real (no del que trae la sesión ni del cliente). Guardar con la agencia rechazada además la devuelve a `'pending'` (es el reenvío de la solicitud). El `slug` NO se toca nunca desde ahí — se edita aparte, con su propio aviso (ver "La dirección del sitio de marca").

### Visibilidad pública de las propiedades — LA REGLA DE COBRO

> Es lo que hace cobrable el producto. Antes, lo público se filtraba **solo por ciudad y estado**: una agencia que dejaba de pagar mantenía todas sus propiedades en el mapa para siempre, y la suscripción no compraba nada que se pudiera perder.

- **La regla vive en la base, en una sola función: `agency_is_publicly_visible(agency_id)`.** Devuelve `true` si la agencia está **aprobada**, su suscripción está en **`active`** y su plan **no es `free`**. Tres condiciones, un solo lugar.
- **La usan TRES policies** (todas medidas contra la base): `Public read active properties` (`status = 'active' AND agency_is_publicly_visible(agency_id)`), `Public read property images` (misma condición vía la propiedad) y `Public insert lead` (además de lo que ya validaba). O sea: se apagan el mapa, las fotos y el registro de consultas, juntos.
- **⚠ POR QUÉ POLICY Y NO UN FILTRO EN CADA CONSULTA.** Hay **DOS caminos públicos** que leen propiedades con la anon key: el hook del mapa (`useProperties`) y el `PropertyModal`, que consulta una propiedad **por id**. Un filtro por consulta hay que ponerlo en los dos, y el que se olvide **filtra mal en silencio** (sigue devolviendo propiedades, solo que de agencias que no pagan). En la policy la regla se aplica sola en todo camino, presente y futuro.
- **⚠ PERO LAS POLICIES NO CUBREN TODO, Y DESDE EL 8 SEP 2026 SON TRES LOS LUGARES QUE NO CUBREN.** El **service role saltea las policies**, así que todo camino que lo use tiene que invocar la regla **a mano**. Hoy son tres, y los tres lo hacen: `resolveAgencyBySlug` (sitio de marca), `resolvePropertyBySlug` (página pública de la propiedad) y `src/app/sitemap.ts` (mapa del sitio). **Los tres llaman a la MISMA función por RPC**, ninguno reescribe las condiciones. Es la regla a sostener: *si leés propiedades con service role, la regla de cobro es tuya*. Se **midió el plan de ejecución antes de decidir**: el acceso a la tabla caliente (`properties`) no se degradó, y las dos tablas del join tienen **una fila por agencia** (`agencies` por PK, `subscriptions` por su UNIQUE de `agency_id`).
  - ⚠ **La regla es de los caminos PÚBLICOS, no de todo service role que toque `properties`.** Desde el 14 sep 2026 el listado del panel (`dashboard/propiedades/page.tsx`) también lee `properties` con service role, para traer el conteo de consultas por propiedad, y **no invoca la regla de cobro, correctamente**: es la vista de la agencia sobre su propia cartera, y su barrera es el **alcance de la sesión** (`agency_id` o `agent_id` sacados del servidor). Ver "Visitas y consultas por propiedad".
- **⚠ POR QUÉ LA FUNCIÓN ES `SECURITY DEFINER`.** El visitante es **anónimo**, y la policy `Agency members read own subscription` solo deja leer `subscriptions` a los agentes de esa agencia. Sin `SECURITY DEFINER`, el `EXISTS` de adentro no vería ninguna fila de suscripción **para nadie**, daría `false` siempre y **el mapa quedaría vacío para todo el mundo**. Es segura: recibe solo un id, devuelve solo un booleano y tiene `search_path` fijo. Es `STABLE`, así que el planificador la evalúa por agencia y no fila por fila.
- **Efecto de borde deseado:** dar de baja y reactivar desde `/admin` **no toca una sola propiedad**. Cambia el `status` de la suscripción y el mapa se apaga o se enciende solo.
- **El sitio de marca (`/[slug]`) se alineó por CÓDIGO, no por policy**, y no es redundancia: `resolveAgencyBySlug` lee con **service role**, que **saltea las policies**, así que ninguna de las tres lo cubre. Llama a la MISMA función por RPC (`isAgencyPubliclyVisible`, falla cerrada: si el RPC falla devuelve `false`) en vez de reescribir las comparaciones en TypeScript — el día que la regla cambie, el mapa y el sitio de marca no pueden decir cosas distintas.
- **⚠ Y el gate de pago del white-label NO es redundante con el de `has_white_label`**, que es la trampa de todo esto: **`has_white_label` se escribe una vez, al activar el plan, y nadie lo apaga nunca** (la baja sí lo apaga hoy, pero un `past_due` no, y no hay ningún proceso automático). Sin el gate de pago, una agencia que dejara de pagar conservaría el flag y su sitio seguiría **en pie mostrando un mapa vacío** — que parece un producto roto, no una suscripción vencida.

### Bloqueo de publicación — TRES triggers en la base, no policies

Sobre `properties` hay **tres triggers** que rechazan el alta, y los tres usan `ERRCODE = 'check_violation'` (**SQLSTATE 23514**). Medidos contra la base el 1 sep 2026:

| Orden | Trigger | Función | Cuándo | Qué bloquea |
|---|---|---|---|---|
| 1 | `trg_check_agency_approved` | `check_agency_approved()` | **solo INSERT** | agencia con `approval_status <> 'approved'` (o sin fila) |
| 2 | `trg_check_agency_subscription` | `check_agency_subscription()` | **solo INSERT** | suscripción en `canceled` o `past_due` |
| 3 | `trg_check_property_limit` | `check_property_limit()` | INSERT **o** UPDATE | cupo del plan agotado (cuenta `active`+`paused` por `agency_id`) |

- **⚠ Los tres NO son SECURITY DEFINER** (medido): leen `subscriptions` y `agencies` con la RLS de quien escribe. Restringir la lectura de `subscriptions` haría fallar la publicación de los agentes comunes con *"máximo: 0"*. Ver "Base de Datos" → "Permisos de escritura del usuario" → TRAMPA 2.
- **Por qué TRIGGERS y no policies RLS:** `createPropertyAction` usa **service role** cuando un admin publica a nombre de otro agente, y el service role **saltea las policies**. Los triggers corren siempre, sin importar el rol. Es la única barrera que cubre los dos caminos.
- **⚠ EL ORDEN DE LA TABLA NO ES DECORATIVO, Y LOS NOMBRES TAMPOCO.** Postgres dispara los triggers de una tabla **en orden alfabético de nombre**, y como los tres comparten SQLSTATE, **el primero que falla es el mensaje que ve el agente**. `agency_approved` < `agency_subscription` < `property_limit` da exactamente la prioridad que queremos: aprobación → suscripción → cupo. Renombrar cualquiera cambia el mensaje que se muestra.
- **El bloqueo por suscripción es por LISTA NEGRA (`canceled`/`past_due`), NUNCA por "distinto de `active`".** El dominio tiene CUATRO valores y `'pending'` significa **"todavía no tiene nada activo"**: es una agencia recién registrada que eligió un plan y espera la activación manual. Esa agencia **publica normalmente** —para que pueda ir cargando su cartera mientras espera—, **aunque todavía no se vea en el mapa**. Bloquear por `<> 'active'` le cortaría el alta sin motivo.
  ⚠ **ACÁ ESTABA LA SEGUNDA COPIA DE LA AFIRMACIÓN FALSA QUE ESCONDIÓ EL BUG DEL UPGRADE**, y sobrevivió a la tanda que corrigió la otra: decía que `'pending'` significaba *"pidió un upgrade y espera que se lo activen"* y que *"esa agencia está al día y publica normalmente"*, y cerraba con *"le cortaría el alta justo por haber querido pagar más"*. Era **cierto de publicar y falso de verse** — y peor: nombraba como caso normal justo el que era el bug. Desde el 11 sep 2026 pedir un upgrade **no toca el estado**, así que `'pending'` ya no puede querer decir eso. Ver "Un pedido de plan abierto".
  ⚠ **Y la asimetría con la visibilidad sigue en pie, a propósito:** este trigger usa **lista negra** (`'pending'` publica) y `agency_is_publicly_visible()` usa **lista blanca** (`'pending'` no se ve). No es una contradicción sin resolver: es el comportamiento deseado —una agencia nueva carga su cartera mientras espera, y aparece cuando le activan el plan—. Antes del arreglo esa asimetría **mordía**, porque `'pending'` también alcanzaba a agencias que ya pagaban.
- **Los de aprobación y suscripción van solo en INSERT** a propósito: editar una propiedad ya cargada sigue permitido aunque la agencia se rechace o se dé de baja después. No se le quitan a nadie las propiedades que ya publicó, ni la posibilidad de corregirlas mientras negocia su reactivación. (Efecto lateral conocido: **reactivar una propiedad pausada es un UPDATE y no pasa por el gate de suscripción** — ver PENDIENTES.md.)
- **`check_agency_subscription()` NO bloquea "sin fila de suscripción"** a propósito: ese caso ya lo cubre `check_property_limit()`, que trata "sin fila" como límite 0. Duplicarlo solo cambiaría el mensaje por uno menos preciso.
- **`check_property_limit()` trata "sin fila de suscripción" como límite 0** (antes `max_allowed` quedaba `NULL`, la comparación daba `NULL` y el insert pasaba **sin límite alguno**).
- **Los tres comparten SQLSTATE, así que el código los distingue POR EL TEXTO del mensaje** (`translatePropertyWriteError` en `propiedades/actions.ts`), en el mismo orden: primero *"no está aprobada"*, después *"suscripción"*, y recién ahí el límite. ⚠ Ese match depende del texto de las funciones: si se edita el mensaje de un trigger, hay que tocar el helper.
- **La interfaz anticipa el rechazo con `getPublishBlock(planUsage, approvalStatus)`** (`src/lib/utils/`), el espejo de los tres triggers y **fuente única del criterio**. Devuelve `null` o `{ reason: "not_approved" | "subscription_inactive" | "plan_limit", message }`, con el mismo orden de prioridad que la base. **Los CUATRO puntos de entrada al alta lo usan**: el botón `NewPropertyButton` (montado en `/dashboard` y en `/dashboard/propiedades`), el enlace del estado vacío de `/dashboard`, el del estado vacío de `PropertiesTable`, y **la ruta `/dashboard/propiedades/nueva`**. DESIGN §12: el botón **nunca se oculta**, se muestra deshabilitado con el mensaje del motivo.
- **⚠ EL REPARTO DE MENSAJES ES EXHAUSTIVO POR CONSTRUCCIÓN (bug real, arreglado).** Al agregar `subscription_inactive`, una agencia dada de baja veía *"alcanzaste el límite de tu plan Gratis, pasá a Inicial"*: el bloqueo correcto con el mensaje equivocado, invitándola a pagar un upgrade que no le destrababa nada. **La causa NO fue el orden de los motivos —ya era correcto—** sino un consumidor (`NewPropertyButton`) con un ternario binario: *"¿es `not_approved`? si no, mostrá el de cupo"*, y el motivo nuevo caía en el `else`. Se reemplazó por un `switch` con guarda `never`: **agregar un motivo sin darle mensaje no compila**. Si mañana aparece un cuarto motivo, el compilador lo va a exigir.

### Panel de plataforma (`/admin`) — el eje comercial, de ida y vuelta

> Hasta agosto de 2026 el panel era **de una sola vía**: se activaba un plan y no había forma de deshacerlo. Todo lo activado quedaba activado de por vida. Hoy tiene **seis acciones comerciales** (más las tres del eje de aprobación), todas con el mismo preámbulo de seguridad: forma del input → `ADMIN_USER_ID` **fail-closed** → sesión → identidad del dueño. **Se repite en cada action porque el gating del layout NO alcanza: una server action se invoca sin pasar por el render.** Todas escriben con **service role** (`subscriptions` y `agencies` no tienen policy de UPDATE) y registran su decisión en `agency_reviews`.

| Acción | Qué escribe | Condición para ofrecerse |
|---|---|---|
| **Activar plan** | `plan` ← `pending_plan`, límites/entitlements del catálogo, `status: 'active'`, `activated_at`, limpia `pending_plan`, vencimiento **opcional** | hay `pending_plan` |
| **Cancelar solicitud** | `pending_plan: null`, `status: 'active'` | hay `pending_plan` |
| **Cambiar de plan** | `plan`, límites/entitlements del catálogo, `activated_at`, vencimiento | `status = 'active'` y `plan <> 'free'` |
| **Dar de baja** | `status: 'canceled'` + los tres `has_*` en `false` | `status = 'active'` y `plan <> 'free'` |
| **Reactivar** | `status: 'active'` + `has_*` **del catálogo** | `status = 'canceled'` |
| **Eliminar agencia** | borra Storage → usuarios de Auth → fila de la agencia | sin propiedades **y** sin consultas |

**El historial es BEST-EFFORT respecto del estado:** si el insert en `agency_reviews` falla, el estado ya cambió y **no se revierte**, pero se avisa (no se traga el error). Los seis valores de `decision` están en el CHECK de la tabla (ver "Base de datos").

**Cancelar una solicitud de plan.** Limpia lo PEDIDO y devuelve la suscripción a `'active'`, sin tocar el plan que RIGE ni los límites — como pedir un upgrade nunca los pisó, cancelar es literalmente volver atrás con dos columnas. **Por qué hace falta:** la guarda de reentrada de `/register/plan` solo deja pasar a una agencia recién registrada, así que una que pidió el plan equivocado **ya no puede corregirlo sola** (rebota a `/dashboard/suscripcion`, donde los upgrades están deshabilitados mientras haya un pedido abierto). Sin esta acción quedaba trabada hasta que el dueño metiera SQL a mano. La nota del historial deja asentado QUÉ se canceló: después de limpiar la columna, el plan pedido no se reconstruye desde ninguna parte.

**Dar de baja (reversible) — qué conserva y qué apaga.**
- **Apaga:** `status` → `'canceled'` y **los tres entitlements** (`has_featured`, `has_white_label`, `has_metrics`) en `false`.
- **CONSERVA `plan`, y es deliberado: es el único registro de qué tenía contratado y a qué reactivar.** Pisarlo perdería esa memoria.
- **NO toca `property_limit`, y también es deliberado:** ponerlo en cero haría que la agencia leyera *"alcanzaste el límite de tu plan"* —**falso** para alguien dado de baja, y la mandaría a pagar un upgrade que no le destraba nada—. El bloqueo real lo dan el trigger de suscripción y `getPublishBlock`, con su propio mensaje. Además deja la reactivación en un solo movimiento.
- **NO toca `activated_at`:** es la fecha en que se activó ese plan, un dato histórico. Borrarlo no aporta y pierde información.
- **El efecto público sale gratis:** `agency_is_publicly_visible()` exige `status = 'active'`, así que las propiedades desaparecen del mapa y el sitio de marca se apaga **sin tocar una sola propiedad**. La agencia sigue entrando a su panel y ve todo lo suyo intacto.
- **Reactivar** vuelve a `'active'` y repone los `has_*` **desde el catálogo `PLANS[plan]`**, nunca desde las columnas (la baja las puso en `false`, no sirven de memoria) ni del nombre del plan escrito a mano. Es la misma fuente que usa la activación: una agencia reactivada queda **idéntica** a una recién activada con ese plan.

**Cambiar de plan (de un plan de venta a otro, sin dar de baja).**
- **Se aplica DIRECTO, no pasa por `pending_plan`.** Ese modelo existe para las SOLICITUDES de la agencia; acá la decisión ya es del dueño, y mandarse una solicitud a sí mismo para después activársela no agrega ningún control, agrega un paso.
- **⚠ La agencia NO puede bajar de plan por su cuenta, y así debe quedar.** Habilitaría el atajo de **pagar un mes de plan grande, cargar muchas propiedades y bajar al más barato conservándolas todas visibles**. Que el cambio pase por el dueño es lo que lo hace seguro: por eso vive solo en el panel, y `requestPlanUpgradeAction` (la del cliente) sigue admitiendo **solo subidas**.
- **Si las propiedades exceden el límite del plan destino, el cambio SE BLOQUEA** y se explica con los números ("tiene N y el plan X permite M; hay que pausar o dar de baja N−M"). **No se pausa nada automáticamente**: elegir qué propiedad sale del mapa es una decisión de la agencia, no un efecto colateral. El conteo usa `getPlanUsage` **porque replica exactamente el criterio de `check_property_limit()`** (por `agency_id`, `active`+`paused`): contar distinto dejaría aplicar un cambio que la base nunca habría permitido.
- **No se le cambia el plan a una agencia dada de baja** (hay que reactivarla primero): se pisaría el `plan` guardado, que es la memoria de a qué volver. Tampoco a una con solicitud sin resolver (para eso están activar/cancelar), ni a una en `free` (para eso está activar).
- `activated_at` se **resella**: después del cambio, lo que rige es el plan nuevo y rige desde ahora.

**⚠ La fecha de vencimiento (`current_period_end`) se comporta DISTINTO en cada acción, y es deliberado.**

| Acción | Campo vacío | Por qué |
|---|---|---|
| **Activar** | **no toca la columna** (`undefined` no viaja en el UPDATE de PostgREST) | no hay fecha previa que pueda quedar vieja |
| **Cambiar de plan** | **escribe `null`** (la borra) | la fecha previa pertenece al **plan viejo**: dejarla diría "Plan Inicial activo hasta el 31/12" cuando ese 31/12 se cargó para la prueba gratuita de su Profesional |

En el cambio de plan el campo viene **precargado** con el valor vigente, justamente porque ahí el vacío borra: el dueño tiene que ver qué hay antes de decidir si lo conserva, lo cambia o lo saca. Validación en el server (aunque el `<input type="date">` ya filtre): forma exacta `YYYY-MM-DD` y **posterior a hoy**. Se guarda como el **fin de ese día en UTC** (`23:59:59.999Z`): "vence el 31 de diciembre" en boca de una persona significa que el 31 todavía tiene plan. ⚠ **Nada vigila que la fecha pase**: es un recordatorio para el dueño, no un vencimiento automático (ver PENDIENTES.md).

**Eliminar una agencia — IRREVERSIBLE, y el orden importa.**
- **Solo agencias SIN propiedades y SIN consultas, y la regla la aplica ESTE CÓDIGO y nada más:** las **cinco** claves foráneas que apuntan a `agencies` (`agents`, `subscriptions`, `leads`, `properties`, `agency_reviews`) son **ON DELETE CASCADE**, ninguna RESTRICT (medido). Si el chequeo falla o se saltea, el DELETE se lleva todo **en silencio**. Por eso los conteos se leen del servidor con service role y **un count que no se pudo leer NO es un cero**: ante la duda se aborta.
- **La confirmación por nombre ignora mayúsculas y espacios de los bordes** (no los internos ni los acentos). Es una barrera contra el click distraído, no un examen de ortografía — y exigir la capitalización exacta **chocaba con el propio cartel**, que muestra el nombre en mayúsculas por el `uppercase` del `Label` del preset: escribir lo que la pantalla indicaba no funcionaba. La comparación real es contra el nombre leído de la base, no contra el que dice el cliente.
- **Orden de borrado, de lo periférico a la raíz:** (1) **archivos de Storage** (logo de la agencia + avatares de sus agentes) — van primero porque son lo único que **no se puede volver a localizar** una vez borradas las filas, ya que sus paths se arman con `agency_id`/`agent_id`; es **best-effort** (un archivo que queda es basura inerte, abortar por eso dejaría viva a la agencia por un motivo que no le importa a nadie). (2) **usuarios de Auth** — la FK va de `agents` **hacia** `auth.users`, así que borrar la agencia **no los borra**: si no se hace explícito quedan sesiones válidas sin cuenta detrás. Si alguno falla **se corta antes de borrar la agencia**, para que sigan siendo encontrables desde el panel. (3) **la fila de la agencia**, que cascadea al resto.
- **⚠ La eliminación NO se registra en `agency_reviews`, y es deliberado:** esa tabla cascadea con la agencia, así que la fila *"eliminé la agencia X"* se borraría junto con X. Un historial de eliminaciones no puede vivir en una tabla que se va con lo eliminado; requeriría otra tabla sin FK, que hoy no existe.

**Detalle de interfaz que es una restricción, no un gusto: los formularios del panel son PANELES INLINE, no `AlertDialog`.** El `AlertDialog` de shadcn **cierra al hacer click en su botón de acción**, así que un error de validación (fecha mal formada, nombre que no coincide, plan que no entra) **no tendría dónde mostrarse**. Los cuatro que piden escribir o elegir algo —rechazo, activación, cambio de plan y eliminación— son paneles inline; los sí/no puros (dar de baja, reactivar) sí van en `AlertDialog`.

### Suscripciones y límites

> **Toda agencia tiene fila en `subscriptions`, y eso lo garantiza la BASE.** El trigger
> `trg_ensure_agency_subscription` (AFTER INSERT ON `agencies` → `ensure_agency_subscription()`)
> la crea junto con la agencia. **El estado "agencia sin suscripción" ya no es producible por
> ningún camino** — ni el registro, ni un INSERT a mano, ni un flujo futuro. Ver "Toda agencia
> nace con su suscripción" abajo.

- Cada agencia tiene una fila en `subscriptions` con `plan` (`free`/`inicial`/`profesional`/`premium`), `property_limit` y los entitlements `has_featured`/`has_white_label`/`has_metrics`.
- **`free` es estado de aterrizaje, no producto.** No se vende, no se ofrece y no se puede elegir. Los valores de `PLANS.free` (`propertyLimit: 1` + los tres flags en `false`) son los que **escriben** el registro y la selección de plan como estado inicial, y los que `getPlanUsage` usa de fallback **para los tres entitlements y el estado** si falta la fila. ⚠ **PARA EL LÍMITE NO**: sin fila, `getPlanUsage` reporta **0**, no 1 — ver "Sin fila de suscripción el límite es 0". Su `name` (`"Gratis"`) es solo la etiqueta que ve una agencia que todavía no paga (badge del sidebar, card de plan actual, columna "Plan" de `/admin`). **Cambiar los números de `PLANS.free` cambia el andamio del modelo, no una etiqueta.**
- **Bajar de plan existe, pero SOLO desde el panel del dueño** (`changePlanAction`, ver "Panel de plataforma"): se aplica directo sobre `plan`. Lo que sigue sin ser expresable es una **SOLICITUD de bajada del cliente**: el CHECK de `pending_plan` solo admite planes pagos y el andamio `plan`/`pending_plan` solo modela subidas. **Es deliberado y así debe quedar**: el autoservicio de bajada habilitaría pagar un mes de plan grande, cargar muchas propiedades y bajar al más barato conservándolas visibles. Ver PENDIENTES.md.
- El límite se valida **en la DB** (trigger `check_property_limit`). El frontend lo anticipa pero la DB es la fuente de verdad.
- El conteo de propiedades usa **siempre `agency_id`**, nunca `agent_id`. Usar el helper `getPlanUsage` de `@/lib/utils/getPlanUsage`.
- **Destacadas: un CUPO por plan, que hace cumplir la BASE** (16 sep 2026). `subscriptions.featured_limit` (free 0, inicial 0, profesional 3, premium 10, desde `PLANS[plan].featuredLimit`) y el trigger `trg_featured_quota` rechaza ENCENDER una destacada con el cupo lleno (SQLSTATE `MKF01`); apagar o editar una ya encendida siempre pasa. `has_featured` se conserva (el gating de features es por booleanos, **NUNCA por el nombre del plan**) y la base lo obliga a valer `featured_limit > 0`. ⚠ **Acá decía que `is_featured` solo podía ser `true` con `has_featured` ("hoy: premium") y que las server actions lo forzaban a `false` en silencio: las dos cosas dejaron de ser ciertas.** Las actions ya no descartan nada: verifican el cupo con `getFeaturedUsage` antes de escribir y devuelven *"Ya usaste todas las destacadas de tu plan."*. Cupo a 0 apaga todas las destacadas de la agencia (`trg_clear_featured_on_zero_quota`); si baja sin llegar a 0, las que sobran quedan. Vendida o alquilada apaga la estrella en la base. Ver "Base de Datos" → "Cupo de destacadas".
- La creación de `agencies`, el insert de `agents` y la escritura de `subscriptions` en el registro se hacen **con service role** (`admin.ts`), nunca con el client normal.

#### ⚠ UN PEDIDO DE PLAN ABIERTO SE DETECTA POR `pending_plan`, NUNCA POR `status`

> **Es la regla más importante del modelo de planes, y salió del bug más caro medido hasta ahora.**
> Si vas a escribir cualquier cosa que necesite saber "¿esta agencia pidió un plan?", la respuesta
> es **`pending_plan != null`**. Mirar el estado da la respuesta correcta solo para la mitad de los
> casos, y en silencio.

**Qué pasaba.** `requestPlanUpgradeAction` escribía `pending_plan` **y `status: 'pending'`**. Y
`agency_is_publicly_visible()` exige `s.status = 'active'`. Entonces una agencia con su plan
andando y sus propiedades publicadas entraba a `/dashboard/suscripcion`, tocaba "Pasar a
{plan mayor}", y **sus propiedades desaparecían del mapa** hasta que el dueño le activara el plan
a mano. **Una agencia que quería pagar más se apagaba sola, justo por haber querido pagar más.**

**⚠ LA CAUSA DE FONDO NO ERA LA REGLA DE LA BASE: ERA QUE EL ESTADO SIGNIFICABA DOS COSAS
INCOMPATIBLES.**

| Lo que significaba `'pending'` | ¿Correcto que no se vea? |
|---|---|
| "soy nueva, elegí un plan y espero que me lo activen" (lo escribe `selectPlanAction`) | **sí**: todavía no tiene nada activo |
| "ya tengo un plan andando y quiero pasar a uno mayor" (lo escribía la del dashboard) | **no**: está al día, paga, y sus propiedades están publicadas |

Y **la regla de visibilidad solo puede asumir una de las dos**. El arreglo fue quitarle el segundo
sentido: **pedir un upgrade ya no toca `status`**, solo anota `pending_plan`. Así `'pending'`
significa una sola cosa —**"todavía no tenés nada activo"**— que es exactamente lo que la regla
asume. **La regla de la base NO se tocó** (ni la función, ni los triggers, ni las policies): con el
estado significando una sola cosa, las cinco quedaron correctas sin cambiar una línea.

**Los cinco lugares que se corrigieron por esta regla**, con la condición que quedó:

| # | Dónde | Antes | Ahora |
|---|---|---|---|
| 1 | `changePlanAction` — la barrera que impide cambiar el plan con un pedido abierto (`admin/actions.ts:988`) | `sub.status === "pending"` | **`sub.pending_plan !== null`** |
| 2 | `availableActions` — el botón "Cambiar de plan" (`AgenciesTable.tsx:352-360`) | `status === "active" && plan !== "free"` | **`… && !hasPendingPlan`** |
| 3 | `SubscriptionContent` — la condición que deshabilita los otros upgrades (`:207`) | `status === "pending" && pendingPlan !== null` | **`pendingPlan !== null`** |
| 4 | `planCategoryOf` — el filtro "Plan pendiente" del panel (`AgenciesTable.tsx:169`) | `sub.status === "pending"` | **`sub.pending_plan != null`** |
| 5 | La métrica "Planes · Esperan activación" (`admin/page.tsx:116`) | `.eq("status", "pending")` | **`.not("pending_plan", "is", null)`** |

**⚠ Y POR QUÉ SE ROMPÍAN A MEDIAS Y EN SILENCIO, que es lo que las volvía difíciles de ver:** las
cinco **siguen funcionando** para el camino del registro, donde `selectPlanAction` **sí** escribe
`'pending'` (y ahí es correcto: ver la decisión 3 de esa tanda). El agujero aparecía **solo** con
una agencia que ya tenía plan pago. **Una prueba con una cuenta nueva las habría visto andar
perfecto.** Al probar cualquier cosa de este modelo hay que recorrer **los dos caminos**.

**Una guarda nueva que la regla hizo necesaria** (`cancelSubscriptionAction`, `admin/actions.ts:612`):
dar de baja a una agencia con un pedido abierto **se rechaza**. Antes era imposible —el pedido
dejaba el estado en `'pending'` y la acción solo se ofrecía sobre `'active'`—; con el pedido sin
tocar el estado, la agencia queda en `'active'` y la acción la alcanzaba, dejando un estado
absurdo: **dada de baja pero con el botón "Activar plan" todavía ofrecido**, y activarlo desharía
la baja. ⚠ **Va DESPUÉS del chequeo de `plan === 'free'`, y el orden es el motivo:** una agencia
recién registrada tiene plan `free` **y** pedido abierto a la vez, y para ella el mensaje correcto
es *"no tiene un plan pago que dar de baja"*, no *"resolvé el pedido"*.

**El resultado es simétrico y vale la pena tenerlo presente:** la combinación
`canceled` + `pending_plan` está bloqueada **por los dos lados** — no se puede pedir un upgrade
estando de baja (`requestPlanUpgradeAction` rechaza `canceled`/`past_due`) ni dar de baja con un
pedido abierto (la guarda nueva).

**⚠ Lo que NO se tocó, y da ganas de tocar:** la línea `status: "active"` de `activatePlanAction`.
Para un upgrade pasó a ser un **no-op** y parece residuo, pero **es lo que saca del `'pending'` a
una agencia recién registrada**. Sacarla rompe el otro camino.

#### Toda agencia nace con su suscripción — el trigger, no el código

**`trg_ensure_agency_subscription`**, `AFTER INSERT ON agencies FOR EACH ROW`, ejecuta
`ensure_agency_subscription()` (SECURITY DEFINER, `search_path` fijo). El cuerpo entero:

```sql
INSERT INTO subscriptions (agency_id)
VALUES (NEW.id)
ON CONFLICT (agency_id) DO NOTHING;
```

- **⚠ NO ESCRIBE NINGÚN VALOR SALVO LA CLAVE, Y ES LA DECISIÓN DEL DISEÑO.** Los `DEFAULT` de
  las columnas de `subscriptions` **ya son** el estado de aterrizaje, así que ese `INSERT`
  produce exactamente la fila que corresponde. Repetir los valores en el trigger crearía una
  **segunda fuente de verdad**: el día que se cambie un default, la tabla y el trigger dirían
  cosas distintas y **la divergencia no daría ningún síntoma** —las agencias nuevas quedarían
  con un límite y las viejas con otro—. Si hay que mover el estado de aterrizaje, se mueve el
  `DEFAULT` de la columna y esto sigue siendo correcto solo.
- **Los defaults coinciden con `PLANS.free`** (medido contra `information_schema.columns` y
  contrastado con `src/types/index.ts`): `plan='free'` / `status='active'` /
  `property_limit=1` / `has_white_label=false` / `has_featured=false` / `has_metrics=false`, y
  `PLANS.free` es `propertyLimit: 1` + los tres flags en `false`. **Son los mismos siete
  valores que escribía el upsert del registro.**
- **⚠ EL UPSERT QUE SIGUE EN `registerAction` NO ES LO QUE CREA LA FILA.** Para cuando esa
  línea corre, el trigger ya la creó, y su `ignoreDuplicates` la deja intacta: en el camino
  normal **no escribe nada**. **No se eliminó a propósito**: si alguien deshabilita el trigger,
  el registro sigue funcionando. Es redundante e inofensivo, y esa redundancia es el punto.
- **Por qué la regla se mudó a la base:** el registro escribe cuatro cosas en orden —usuario de
  Auth, agencia, agente admin, suscripción— y hacía rollback de las dos del medio pero **no de
  la última**. Si fallaba ese paso quedaba una agencia funcionando sin suscripción, y nadie
  reparaba ese estado. Misma disciplina que los tres gates de publicación: **la regla vive en
  la base porque el código se olvida y la base no.**
- `ON CONFLICT DO NOTHING` lo hace idempotente, con respaldo real: `subscriptions.agency_id` es
  `UNIQUE`. `AFTER INSERT` y no `BEFORE` porque la fila de `agencies` tiene que existir para
  satisfacer la FK.

#### Sin fila de suscripción el límite es 0 — y los dos números tienen que coincidir

`getPlanUsage` es el **espejo en la interfaz** de `check_property_limit()`, así que ante la
ausencia de fila los dos dicen lo mismo:

| | Qué hace |
|---|---|
| `check_property_limit()` (base) | `SELECT property_limit INTO max_allowed …` y después `IF max_allowed IS NULL THEN max_allowed := 0` |
| `getPlanUsage` (`lib/utils/`) | `const limit = subscription?.property_limit ?? NO_SUBSCRIPTION_LIMIT`, con `NO_SUBSCRIPTION_LIMIT = 0` |

**⚠ Antes caía a `PLANS.free.propertyLimit` (= 1) y esa divergencia era un bug medido:** con
límite 1 y 0 propiedades, `canCreate` daba `true`, `getPublishBlock` no bloqueaba, el botón
"Nueva propiedad" quedaba habilitado, la ruta `/dashboard/propiedades/nueva` dejaba pasar, el
agente llenaba el formulario entero **y el rechazo llegaba recién al guardar** —del trigger,
con "máximo: 0"—, traducido a *"alcanzaste el límite de tu plan"*, que era falso: no había
alcanzado ningún límite, le faltaba una fila.

**Solo cambió el límite.** El `status` sigue cayendo a `'active'` y los tres `has_*` a los de
`PLANS.free`, a propósito: declararla inactiva cambiaría el motivo del bloqueo
(`subscription_inactive` en vez de `plan_limit`) sin que su situación lo justifique — no la
dieron de baja, le falta una fila.

Con el trigger el caso ya no se produce. **El espejo se alineó igual**, porque no puede
prometer lo que la base va a rechazar si alguna vez alguien borra una fila a mano.

---

## Estructura de Carpetas

```
/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx                 ← Mapa principal + lista mobile (home: todas las agencias de la ciudad
│   │   │   │                              activa). Define `PublicHeader`, UNA sola definición para el estado de
│   │   │   │                              carga y para el render real. ⚠ La rama `if (!city)` NO lo usa
│   │   │   ├── [slug]/page.tsx          ← Vista white-label por agencia (resuelve slug → 404 / no-disponible / mapa filtrado). Sub-pieza A
│   │   │   └── propiedades/[slug]/page.tsx ← PÁGINA PÚBLICA DE LA PROPIEDAD (Server Component + generateMetadata).
│   │   │                                     El prefijo NO es opcional: en el primer nivel ya vive el [slug] de
│   │   │                                     agencia y dos rutas dinámicas hermanas son ambiguas
│   │   ├── sitemap.ts                   ← Mapa del sitio (/sitemap.xml). `dynamic = "force-dynamic"`: sin eso se
│   │   │                                  cachearía al construir. Mismo criterio que la página
│   │   └── robots.ts                    ← /robots.txt. Contenido fijo → sin force-dynamic, a propósito
│   │   ├── (agent)/
│   │   │   ├── login/                    ← page.tsx (Server: lee ?reason y lo mapea a un mensaje fijo) + LoginForm.tsx (client). Split-screen editorial (AuthLayout)
│   │   │   ├── logout/route.ts           ← Route handler GET: signOut() + redirect a /login?reason=. Existe porque un Server Component NO puede borrar cookies (ver "Cierre de sesión")
│   │   │   ├── register/                  ← page.tsx (Server: trae ciudades) + RegisterForm.tsx (client; SIN selector de tipo de cuenta, CON matrícula obligatoria). actions.ts escribe license_number y hace rollback del user de Auth si falla agencies/agents. Paso 2: plan/ (page Server + PlanSelector client + actions). La page Y la action llevan la GUARDA DE REENTRADA (solo "aterrizaje virgen"; ver arriba)
│   │   │   ├── dashboard/
│   │   │       ├── page.tsx             ← Home: 4 StatsCard + últimas propiedades. Métricas por rol: admin ve la agencia (agency_id), agente lo suyo (agent_id)
│   │   │       ├── propiedades/         ← Listado CRUD (admin ve toda la agencia + col. Agente; agente solo lo suyo) + nueva + [id]/editar + loading.tsx. actions.ts con authorizePropertyAccess (owner/admin). El listado trae VISITAS (`views_count`) y CONSULTAS por propiedad: estas con `leads(count)` en UNA consulta con service role, acotada al mismo alcance de la sesión (ver "Visitas y consultas por propiedad")
│   │   │       ├── equipo/              ← Gestión de agentes (solo admin de agencia): page (Server, gatea role, cuenta props Y consultas por agente) + actions (createAgentAction + deleteAgentAction, service role). Borrar REASIGNA las props al admin (Modelo B) y DESVINCULA las consultas (SET NULL); el aviso previo dice las dos cosas
│   │   │       ├── leads/               ← Consultas (ambos roles; RLS recorta: agente ve los suyos, admin los de la agencia). page (Server; el embed del agente NO puede llevar !inner) + LeadsContent (client)
│   │   │       ├── perfil/
│   │   │       ├── preferencias/         ← Preferencias personales (localStorage) + datos de la agencia (solo admin), en CUATRO formularios separados con CUATRO actions: identidad (nombre siempre editable + matrícula congelada al aprobar), DIRECCIÓN del sitio (AgencySlugForm), teléfono y logo. Todos service role. page Server, muestra además el AgencyApprovalNotice y el motivo de un nombre rechazado
│   │   │       └── suscripcion/
│   │   │   └── admin/                   ← Panel de plataforma. OJO: vive DENTRO del route group (agent), o sea `src/app/(agent)/admin/`, aunque la URL sea /admin. Solo dueño, gateado por ADMIN_USER_ID en su layout.tsx: 6 métricas de negocio (StatsCard) + tabla de TODAS las agencias + filtros de dos ejes + NUEVE acciones (aprobar/rechazar/reabrir · activar plan con vencimiento/cancelar solicitud/cambiar de plan/dar de baja/reactivar/eliminar). layout (Server, gating + sidebar) + page (Server) + AgenciesTable (client) + actions. USA el sidebar del dashboard ("Panel admin" activo)
│   │   └── api/
│   │       └── geocode/route.ts         ← POST /api/geocode: intermediaria del buscador de direcciones. Está FUERA de los route groups y el proxy NO la cubre → gate de sesión propio adentro del handler. La ciudad la deriva del servidor. Ver "Ubicación de la propiedad"
│   │
│   ├── components/
│   │   ├── brand/
│   │   │   └── Wordmark.tsx             ← "Marka." con punto terracota (Lote 0)
│   │   ├── auth/
│   │   │   ├── AuthLayout.tsx           ← Shell split-screen de login/register
│   │   │   └── PublicHeaderAuth.tsx     ← ÚNICA puerta al área privada del encabezado público.
│   │   │                                  Dos variantes (marketplace = captación / agency = sin
│   │   │                                  ella) y la detección de sesión, que antes estaba
│   │   │                                  duplicada carácter por carácter en dos archivos
│   │   ├── map/
│   │   │   ├── MapView.tsx              ← Raíz del mapa (client, ssr:false)
│   │   │   ├── PropertyMarker.tsx       ← Pin terracota + estados (CSS sobre DivIcon). El precio del pin
│   │   │   │                              depende del filtro de operación → createPropertyIcon lo recibe
│   │   │   ├── PropertyModal.tsx        ← Drawer/sheet + flujo WA + carrusel. Muestra TODAS las operaciones
│   │   │   │                              con sus precios + los chips de requisitos + el bloque "quién
│   │   │   │                              publica". Sobre la foto: cerrar, compartir, favorito y el botón
│   │   │   │                              "Ver ficha completa" (los cuatro absolute: cuestan 0px de alto)
│   │   │   ├── FilterPanel.tsx          ← Filtros (checkboxes shadcn, commit on-blur). Operación es
│   │   │   │                              MÚLTIPLE; el rango de precio solo se habilita con UNA marcada.
│   │   │   │                              ⚠ Se monta DOS VECES: panel lateral en escritorio y HOJA desde
│   │   │   │                              abajo en celular (`h-[85dvh]`), que cierra con ✕, velo, Escape
│   │   │   │                              y arrastre. Ver "Las hojas que suben desde abajo"
│   │   │   ├── CityPicker.tsx           ← Selector de ciudad (lee cityStore). Es el slot ELÁSTICO del
│   │   │   │                              encabezado: `min-w-0` afuera y el nombre en un `<span>` con
│   │   │   │                              `truncate` — suelto era un item anónimo, imposible de recortar
│   │   │   ├── AgencyMapView.tsx        ← Mapa filtrado a una agencia (white-label, mirror de la home SIN CityPicker). Header con logo + nombre de la agencia + "Powered by Marka." (B2a). Sub-pieza A/B2a
│   │   │   └── ClusterLayer.tsx         ← Clustering, diff por id, estados live. ⚠ Efecto aparte que
│   │   │                                  refresca el PRECIO de los pines al cambiar el filtro de
│   │   │                                  operación: el diff por id no lo detecta (ver la trampa abajo).
│   │   │                                  El click en un pin MARCA la propiedad como vista y CUENTA la
│   │   │                                  visita si era nueva (ver "Visitas y consultas por propiedad")
│   │   ├── agency/
│   │   │   ├── AgencyUnavailable.tsx    ← Cartel del VISITANTE: "sitio no disponible", sin decir el
│   │   │   │                              motivo (no es asunto suyo). Los seis se colapsan acá
│   │   │   └── AgencyUnavailableForAdmin.tsx ← El mismo estado, visto por el ADMIN DE ESA AGENCIA:
│   │   │                                  un mensaje por motivo, con botón solo donde ella puede
│   │   │                                  resolver. Record exhaustivo: un motivo sin texto no compila
│   │   ├── feedback/
│   │   │   ├── Notice.tsx               ← Aviso PERSISTENTE reutilizable (Server Component, tonos
│   │   │   │                              info/warning/error). Describe un estado que dura
│   │   │   └── ErrorBanner.tsx          ← Banner de error DESCARTABLE (Client Component, ✕ para cerrar).
│   │   │                                  Extraído de sus 4 copias, que ya habían divergido.
│   │   │                                  ⚠ El margen viene de afuera: ver "Avisos persistentes"
│   │   ├── forms/
│   │   │   ├── fieldStyles.ts           ← ⚠ LA ÚNICA DEFINICIÓN DEL CAMPO CON CAJA. Constantes, no una
│   │   │   │                              variante de `Input`: la misma caja viste contenedores que no son
│   │   │   │                              un input (los campos con prefijo). Ver "El campo con caja"
│   │   │   └── PhoneWaInput.tsx         ← Campo de teléfono con el prefijo "+54 9" fijo y visible, en las
│   │   │                                  dos familias (caja y subrayado) + el aviso de número a revisar
│   │   ├── properties/
│   │   │   ├── PropertyCard.tsx         ← Card editorial reutilizable. Kicker con todas las operaciones,
│   │   │   │                              UN precio (el de getDisplayOperationPrice, según el filtro).
│   │   │   │                              El TÍTULO es enlace a la ficha dentro de una card clickeable:
│   │   │   │                              ver "La tarjeta tiene un enlace adentro de algo clickeable"
│   │   │   ├── PropertyList.tsx         ← Lista mobile (cards-first). Tocar una tarjeta MARCA la propiedad
│   │   │   │                              como vista y CUENTA la visita si era nueva (antes no marcaba nada)
│   │   │   ├── PropertyViewTracker.tsx  ← Isla de cliente de la ficha pública que renderiza null y cuenta
│   │   │   │                              la visita con la PRIMERA INTERACCIÓN, nunca al montar. Montada
│   │   │   │                              con key={property.id}. Ver "Visitas y consultas por propiedad"
│   │   │   ├── PropertyGallery.tsx      ← Galería de la página pública. Server Component, CERO JS: scroll-snap
│   │   │   │                              de CSS con las N fotos en el HTML (el carrusel del modal deja UNA)
│   │   │   ├── PropertyContact.tsx      ← Isla de cliente del flujo WA en la página. Usa registerLead
│   │   │   ├── PropertyUnavailable.tsx  ← Estado "la propiedad existe pero no se muestra". Clon de
│   │   │   │                              AgencyUnavailable. NUNCA un 404 (ver los tres estados)
│   │   │   ├── ShareButton.tsx          ← Compartir. Cascada: navigator.share → clipboard → execCommand →
│   │   │   │                              campo seleccionable. Las dos primeras exigen contexto seguro
│   │   │   ├── StaticMap.tsx            ← Mapa estático de la página: grilla 4x2 de tiles OSM en <img>,
│   │   │   │                              corrida con CSS. Server Component, sin Leaflet y sin JS
│   │   │   ├── PropertyForm.tsx         ← CRUD form + barra de acción sticky. Tres casillas de operación,
│   │   │   │                              cada una con su precio+moneda opcionales, y la sección de
│   │   │   │                              requisitos (solo si hay alquiler). Todo con Controller, sin watch()
│   │   │   ├── AddressSearchButton.tsx  ← Botón "Buscar esta dirección en el mapa": llama a /api/geocode y emite una SUGERENCIA. Nunca busca al tipear (política de Nominatim). No puede bloquear el guardado
│   │   │   ├── LocationPicker.tsx       ← Pin manual: CONTROLADO (la posición vive en el form), tiles compartidos. Emite la causa del cambio ("drag" confirma / "center" desconfirma). ⚠ El contenedor del mapa lleva `isolate`: ver "El panel en celular"
│   │   │   ├── FeaturedStarIcon.tsx     ← Estrella de destacada en SVG (nunca el carácter ★). Dorada por
│   │   │   │                              defecto (visitante); en el panel se usa con `text-current`
│   │   │   └── ImageUploader.tsx        ← Drag&drop, progreso por imagen, máx 10
│   │   ├── dashboard/
│   │   │   ├── DashboardShell.tsx       ← Estructura del panel (Server): columna en celular, fila en escritorio,
│   │   │   │                              `main` scrolleable. Lo usan dashboard/layout y admin/layout
│   │   │   ├── Sidebar.tsx              ← Wordmark + avatar + nav. En celular: barra superior en el flujo +
│   │   │   │                              cajón (Escape, `inert` cerrado, foco devuelto al botón)
│   │   │   ├── StatsCard.tsx            ← tabular-nums, count-up, acento en métrica clave
│   │   │   ├── PropertiesTable.tsx      ← Tabla desktop + cards mobile + skeleton. Columnas "Visitas" y
│   │   │   │                              "Consultas" separadas (en mobile, "N visitas · M consultas").
│   │   │   │                              `lead_count` null = no se pudo contar → "—", nunca un 0
│   │   │   ├── PlanBadge.tsx            ← Plan + micro-barra de uso
│   │   │   ├── FeaturedBadge.tsx        ← Chip "Destacadas usadas/límite" del listado, con las clases de PlanBadge
│   │   │   ├── ProfileForm.tsx           ← Perfil del agente: avatar (upload client-side, upsert) + nombre + teléfono
│   │   │   ├── AgencyPhoneForm.tsx       ← Teléfono de la agencia (solo admin). Sub-pieza B1
│   │   │   ├── AgencyLogoForm.tsx        ← Logo de la agencia (solo admin): upload client-side + updateAgencyLogoAction. Valida tipo/tamaño, cache-buster en preview. Sub-pieza B1
│   │   │   ├── AgencyIdentityForm.tsx   ← Nombre + matrícula (solo admin). ⚠ El NOMBRE se edita
│   │   │   │                              siempre; la MATRÍCULA se congela al aprobar. El aviso de
│   │   │   │                              "vuelve a revisión" aparece al tipear un nombre distinto
│   │   │   │                              (Controller, no watch). La regla REAL la aplica la action
│   │   │   ├── AgencySlugForm.tsx       ← Dirección del sitio (solo admin). Dos pasos: editar y
│   │   │   │                              confirmar en un panel inline que muestra las DOS
│   │   │   │                              direcciones completas y advierte que los enlaces mueren
│   │   │   ├── AgencyApprovalNotice.tsx ← Aviso de dominio: pendiente / rechazada (con el motivo).
│   │   │   │                              Presentacional puro, null si está aprobada. Es UNA de las dos
│   │   │   │                              ramas del cartel de visibilidad de /dashboard
│   │   │   ├── AgencyVisibilityNotice.tsx ← La OTRA rama: suscripción de baja · plan sin activar.
│   │   │   │                              ⚠ Su prop lleva Exclude<…,"not_approved">: pasarle el motivo
│   │   │   │                              de aprobación no compila (garantía de "un solo cartel")
│   │   │   ├── SubscriptionContent.tsx  ← Card del plan que rige + cards de upgrade (solo planes superiores) + AlertDialog de confirmación
│   │   │   ├── NewPropertyButton.tsx    ← CTA "Nueva propiedad" + bloqueo por getPublishBlock (agencia no aprobada O cupo lleno), con mensaje distinto para cada motivo
│   │   │   ├── LeadsContent.tsx         ← Tabla de Consultas (client). AgentCell: los 3 estados de la columna
│   │   │   │                              "Agente" (vinculado / desvinculado con nombre + badge / sin nombre)
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
│   │   │   ├── useSheetDragToClose.ts   ← Arrastre hacia abajo para cerrar las dos hojas de celular (Pointer
│   │   │   │                              Events, `style.translate`). Ver "Las hojas que suben desde abajo"
│   │   │   └── useVisitedProperties.ts  ← Propiedades vistas en localStorage. `markVisited` DEVUELVE si
│   │   │                                  la propiedad era nueva, con lectura SÍNCRONA del almacenamiento:
│   │   │                                  es la deduplicación del contador. ⚠ SIN sync entre instancias
│   │   └── utils/
│   │       ├── coords.ts                ← Coords + roundCoord (7 decimales, ÚNICO redondeo del proyecto) + distanceKm (equirectangular con corrección por latitud). Sin dependencias: lo usan servidor y cliente
│   │       ├── getAgencyCity.ts         ← Ciudad de una agencia (nombre, provincia, país, centro) para armar la consulta de geocodificación. Server-only; la ciudad NUNCA viene del cliente
│   │       ├── formatPrice.ts           ← formatPrice + formatPriceCompact (pines). Aceptan precio y
│   │       │                              moneda NULOS y devuelven "A convenir" (NO_PRICE_LABEL)
│   │       ├── propertyOperations.ts    ← Operaciones activas de una propiedad + REGLA DE PRIORIDAD de
│   │       │                              qué precio se muestra cuando entra uno solo. Fuente única:
│   │       │                              el pin y la card tienen que elegir el mismo
│   │       ├── generateSlug.ts          ← slugifyBase (limpieza pura) + generateSlug (propiedades, sufijo aleatorio)
│   │       ├── agencySlug.ts            ← TODO lo de la dirección de agencia: forma, normalización,
│   │       │                              validación, unicidad y la generación del registro (sufijo
│   │       │                              -2/-3 ante colisión, que ahora TAMBIÉN salta las
│   │       │                              reservadas). El UNIQUE de agencies.slug es la garantía
│   │       ├── reservedSlugs.ts         ← ⚠ Las 135 direcciones reservadas, en tres grupos. Agregar
│   │       │                              una ruta de primer nivel al proyecto OBLIGA a agregarla
│   │       │                              acá, o esa ruta queda inalcanzable. Ver la sección
│   │       ├── agencyName.ts            ← Forma del NOMBRE de la agencia (2-80 + colapso de
│   │       │                              espacios), compartida por el form y la action. NO valida
│   │       │                              unicidad: la base no la exige y hay dos nombres repetidos
│   │       ├── waMessage.ts             ← generateWaUrl(): string | null
│   │       ├── getPlanUsage.ts          ← Helper server: cuenta por agency_id
│   │       ├── getFeaturedUsage.ts      ← Cupo de destacadas { limit, used, available }: cuenta como el trigger
│   │       │                              (todas las destacadas de la agencia, cualquier status y agente)
│   │       ├── storagePublicUrl.ts      ← Prefijo público del bucket + isStoragePublicUrl (falla cerrada).
│   │       │                              Espejo de los CHECK de URL de la base
│   │       ├── dbFormatErrors.ts        ← translateFormatCheckError: traduce los CHECK de URL y teléfono y
│   │       │                              el 42501 del contador, por NOMBRE de constraint
│   │       ├── resolveAgentSession.ts   ← ÚNICO lugar donde vive "traer el agente logueado + su agencia". Unión de 3 estados, cacheado por request. requireAgentSession() corta; resolveAgentSession() devuelve
│   │       ├── getPublishBlock.ts       ← Espejo en la interfaz de los TRES triggers de properties:
│   │       │                              ¿se puede PUBLICAR, y si no, por qué? Fuente única del
│   │       │                              criterio para los 4 puntos de entrada al alta
│   │       ├── getVisibilityBlock.ts    ← ⚠ EL OTRO, y NO es lo mismo: espejo de la FUNCIÓN
│   │       │                              agency_is_publicly_visible() — ¿lo que ya cargó SE VE en el
│   │       │                              mapa? Usar aquel para esto falla en dos direcciones
│   │       │                              opuestas (ver "Los dos helpers que parecen lo mismo")
│   │       ├── getLatestRejectionNote.ts ← Motivo del último rechazo (agency_reviews, service role) verificando pertenencia antes de devolver nada
│   │       ├── licenseNumber.ts         ← Formato y normalización de la matrícula, compartidos por el alta y por Preferencias
│       ├── phoneWa.ts               ← Fuente única del teléfono: normalización de TODAS las formas en que
│       │                              se escribe un celular argentino, validación y el campo de zod.
│       │                              ⚠ `splitStoredPhoneWa` NUNCA corrige un número guardado
│   │       ├── resolveAgencyBySlug.ts   ← Resuelve slug → agencia + suscripción + ciudad (service role). 3 estados: not_found / disabled / active. `disabled` = 3 gates (aprobación + has_white_label + pago vía RPC agency_is_publicly_visible). White-label
│   │       ├── authErrors.ts            ← translateAuthError: mapea errores de Supabase Auth a español (registro + alta de agente)
│   │       ├── storagePath.ts           ← PROPERTY_IMAGES_BUCKET + extractStoragePath(url): string | null.
│   │       │                              URL pública → path del bucket. Servidor y cliente. Devuelve NULL
│   │       │                              si la URL no es del bucket: mandar la URL entera a remove() no
│   │       │                              borra nada y tampoco falla
│   │       ├── resolvePropertyBySlug.ts ← Resuelve slug → propiedad pública (service role + RPC de
│   │       │                              visibilidad). 3 estados: not_found / unavailable / available.
│   │       │                              Cacheado con cache() de React: la ruta lo llama DOS veces
│   │       ├── siteUrl.ts               ← SITE_URL / absoluteUrl() / propertyUrl(). LANZA si falta
│   │       │                              NEXT_PUBLIC_SITE_URL, en vez de inventar un valor
│   │       ├── registerLead.ts          ← El insert de la consulta, extraído del modal. Lleva escritas las
│   │       │                              cuatro decisiones; la más frágil es una OMISIÓN (agent_name)
│   │       ├── registerView.ts          ← La ÚNICA llamada a `increment_views` ({ property_id }, literal).
│   │       │                              No espera, nunca lanza, el error va a la consola. Se llama
│   │       │                              siempre DESPUÉS de markVisited y solo si devolvió true
│   │       ├── amenityIcons.ts          ← AMENITY_ICONS (16 entradas, Record exhaustivo) + el ícono de
│   │       │                              reserva. Extraído del modal al aparecer la segunda pantalla
│   │       └── labels.ts                ← Etiquetas UI compartidas
│   │
│   ├── store/
│   │   ├── mapFiltersStore.ts           ← Hook `useMapFilters` + selectActiveFiltersCount (el hook vive acá, NO en lib/hooks/)
│   │   └── cityStore.ts                 ← Ciudad activa, initCity(), setCity(), nearbyCityId
│   │
│   ├── types/
│   │   └── index.ts                     ← Todos los tipos del proyecto + constantes de dominio
│   │                                      (PLANS, DEFAULT_FILTERS, topes de requisitos libres).
│   │                                      ⚠ NO hay supabase.ts generado: los tipos de la base
│   │                                      se mantienen A MANO acá
│   │
│   └── proxy.ts                         ← Convención Next.js 16: auth guard
│
├── public/
│   ├── markers/                         ← SVG fuente de verdad de los pines
│   ├── icon-192.png / icon-512.png      ← PWA icons ("M" terracota)
│   └── manifest.json
│
├── scripts/                             ← Herramientas de línea de comandos. FUERA de src/ a propósito:
│   └── storage-orphans.ts                  Next solo genera rutas desde src/app/, así que nada de acá
│                                           entra al bundle ni suma una ruta al build. Detecta y borra
│                                           archivos huérfanos del bucket; simulación por defecto
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
- **Baseline medido: 0 errores y 1 warning.** El único warning es `react-hooks/incompatible-library` en `PropertyForm.tsx:919` (`watch("amenities")`): el React Compiler detecta que el `watch()` de react-hook-form no se puede memoizar y renuncia a memoizar el componente. Es inherente a la librería, no un defecto del código; no bloquea el build. **Cualquier otro warning es una regresión.**
- **La regla señala UNA sola llamada: la primera `watch()` del componente.** `PropertyForm.tsx` tiene cuatro (`amenities`, `lat`, `lng`, `address`) y el warning es uno solo, así que **al agregar campos nuevos no hay que usar `watch()`: hay que usar `Controller`**. Es lo que hacen el bloque de operaciones y precios y la sección de requisitos, y por eso ninguno de los dos sumó un warning. (Histórico: el warning apuntaba antes a `watch("currency")` y a un segundo idéntico en `RegisterForm.tsx`; los dos desaparecieron con sus campos, y el señalamiento se corrió a la `watch()` siguiente.) ⚠ **El NÚMERO DE LÍNEA se mueve con cualquier edición del archivo** —fue `:269`, `:808`, `:804`, `:814` y hoy es **`:919`**—, así que **no es parte del baseline**: lo que hay que verificar es que siga siendo **un solo warning, de esa regla, sobre `watch()`**. Un número distinto acá no es una regresión; dos warnings sí.

### Estilos
- Tailwind, sin CSS-in-JS ni módulos CSS. shadcn/ui para componentes base
- Seguir `DESIGN.md`

### Comentarios
- Lógica de negocio en español, código en inglés

---

## Formas, alturas y tipografía de los controles

> Espejo de `DESIGN.md` §4 y §6. Acá va lo que un cambio de código necesita saber; allá, cómo se ve.

### ⚠ LA FORMA LA DECIDE QUÉ ES EL ELEMENTO, NO DE DÓNDE VINO NI DÓNDE ESTÁ

**Un botón es un botón en el alta, en el panel y adentro de un diálogo, y lleva el mismo radio en los tres lados.** El criterio **no** es la pantalla, **no** es la librería de origen y **no** es "lo que traía el preset".

| Familia | Qué es | Token | Píxeles | Qué entra |
|---|---|---|---|---|
| **Marca chica** | se lee, no se toca | `rounded-sm` | **4** | chips, badges, etiquetas de estado, **casillas** |
| **Tocable / rellenable** | se toca, o se escribe adentro | `rounded-md` | **6** | botones, campos con caja, selectores, segmentados, **ítems de menú y de desplegable** |
| **Contenedor** | contiene a lo anterior | `rounded-lg` | **8** | tarjetas, secciones, paneles, avisos, **diálogos, menús, desplegables** |
| **Circular** | circular por naturaleza | `rounded-full` | — | avatares, interruptor, barras de progreso, botones de solo ícono sobre fotos y mapa |
| **Sin caja** | el campo subrayado | `rounded-none` | **0** | `Input`, `Textarea`, `SelectTrigger` |

**⚠ QUE UN COMPONENTE VENGA DEL PRESET "Sera" NO LO EXIME.** El preset trae sus propios radios —varios en `rounded-none`— y **se sobreescriben en `components/ui/`**. Al agregar un componente nuevo con `npx shadcn add`, lo primero es mirar qué radio trae y llevarlo a la tabla.

**Los tres valores son FIJOS EN PÍXELES y no se derivan de `--radius`** (`globals.css:60-63`). ⚠ Antes salían de `--radius` con multiplicadores (0,6 / 0,8 / 1) y daban **6 / 8 / 10**: dos píxeles por encima de la tabla documentada, **en toda la app a la vez**. Si alguien vuelve a derivarlos, el desvío reaparece en los 247 elementos de una sola vez y sin ningún síntoma.

**Excepciones deliberadas, con su motivo** (no "unificar" ninguna):

| Excepción | Valor | Por qué |
|---|---|---|
| Esquinas **superiores** de las dos hojas | `rounded-t-xl` = **14px** | Es el gesto de una hoja que entra desde el borde. `--radius-xl` existe **solo para esto**; no bajarlo por coherencia |
| Esquinas **inferiores** de esas hojas | **0** | Están contra el borde de la pantalla |
| Botones circulares sobre fotos y mapa | `rounded-full` | Flotan sobre una imagen: el círculo es lo que los separa del fondo |
| Pines y cromo de Leaflet | **siete `border-radius` literales** en `globals.css` (pin 8px `:231`, su punta 2px `:267`, sus badges y el cluster 50% `:286`/`:307`/`:362`, zoom 8px `:409`, atribución 6px `:441`) | **No pasan por el tema**: los dibuja CSS suelto sobre elementos que crea la librería. Cambiar un token no los toca |
| Esqueletos de carga | `rounded` (4px, literal de Tailwind) | No son un elemento: son la silueta de uno |
| `Input` / `Textarea` / `SelectTrigger` | `rounded-none` | Familia subrayado (ver "El campo con caja") |

### La escala de altos de botón

`ui/button.tsx` tiene **tres alturas y nada más**, y la escala está comentada en el propio archivo. El mínimo táctil de accesibilidad es **44 px**, así que ése es el tamaño por defecto.

⚠ **Eran cinco nombres para tres alturas hasta el 17 sep 2026**: el preset traía además `lg`
(la misma altura que `default`, solo con más relleno horizontal) e `icon-lg` (`size-11`, **byte a
byte idéntico** a `icon`). Los dos con **cero usos**, y los dos eliminados. Un CTA más ancho se pide
con `className="w-full"` o `px-*`, que es lo que ya hacen los botones de ancho completo del
proyecto. Si alguien vuelve a agregar un tamaño, que sea por una altura que no exista.


| Tamaño | Variante | Alto | Relleno | Para qué |
|---|---|---|---|---|
| **L** | `default` | **44** | 16px | Acción principal de una pantalla o un formulario: CTAs, WhatsApp, FABs, botones de diálogo |
| **M** | `sm` | **36** | 12px | Contexto denso donde 44 px rompen el ritmo: filas de tabla, encabezados, filtros |
| **S** | `xs` | **28** | 10px | Sobre una imagen o un mapa, donde el botón compite con el contenido |
| Íconos | `icon` / `icon-sm` / `icon-xs` | 44 / 36 / 28 | — | Los mismos tres, cuadrados |

#### ⚠⚠ UN BOTÓN DE MENOS DE 44 px LLEVA SIEMPRE ÁREA DE TOQUE EXTENDIDA

**No se dibuja más grande: se le agrega un pseudo-elemento que agranda la zona sensible sin mover el dibujo.**

```
after:absolute after:-inset-x-2 after:-inset-y-2     ← en el tamaño `xs` e `icon-xs`
```

Es el recurso que **`ui/checkbox.tsx` ya usaba** (`after:-inset-x-3 after:-inset-y-2`), y por eso el botón base lleva `relative`: sin él, el `absolute` del pseudo-elemento se ancla al ancestro posicionado más cercano y el área aparece en cualquier lado. Los tres tamaños S del proyecto lo tienen: el `xs` del componente, "Ver ficha completa" del detalle y "Centrar" del mapa de ubicación. **Medido: "Ver ficha completa" dibuja 28 px y toca 44.**

⚠ **Un botón chico sin esa extensión es un botón que en un teléfono se falla** — y el que lo falla es una inmobiliaria que paga.

### ⚠ RÓTULO CORTO EN MAYÚSCULAS, FRASE EN MINÚSCULAS

**Los botones dejaron las mayúsculas y los ítems de menú NO, y eso es deliberado: no es una inconsistencia pendiente de emparejar, es la misma regla aplicada a dos casos distintos.**

| | Qué es | Tratamiento | Dónde vive |
|---|---|---|---|
| Ítem de menú, etiqueta de formulario, badge, chip, título de sección | un **rótulo** de una o dos palabras ("Editar", "TELÉFONO", "Pileta") | **MAYÚSCULAS**, 11-12px, `tracking-wide`/`wider` | `ui/dropdown-menu.tsx`, `ui/label.tsx` |
| Botón | puede ser una **frase entera** ("Consultar por WhatsApp", "Ver todas las propiedades en el mapa") | **minúsculas**, 14px, `font-medium` | `ui/button.tsx` |

**El motivo es de legibilidad, no de gusto:** las mayúsculas espaciadas ordenan un rótulo corto y **empeoran una frase**, que además se vuelve bastante más ancha — y el ancho es justo lo que no sobra en un teléfono. Un botón puede crecer a una frase en cualquier momento; un ítem de menú, no.

⚠ **Quien "unifique" los dos casos va a empeorar el que hoy está bien.** Si alguna vez se decide que los ítems de menú bajen a minúsculas, es una decisión de diseño con su motivo, no una corrección de coherencia.

### Las casillas — `ui/checkbox.tsx` (16 sep 2026)

- **El color marcado vive SOLO en el componente** (`data-checked:border-terracota data-checked:bg-terracota data-checked:text-paper`). `CHECKBOX_TERRACOTA` y los overrides por pantalla **se eliminaron**: no volver a pisar el color desde afuera.
- **El foco es un contorno terracota de 2 px separado 2 px, y NO cambia el borde.** Motivo: la variante `data-checked` va dentro de `:where()` y pesa (0,1,0), así que un `focus-visible:border-*` (0,2,0) le ganaba y la casilla marcada perdía su borde terracota al enfocarla.
- ⚠ **TRAMPA de Tailwind v4: `focus-visible:outline-solid` NO sobra.** `outline-2` solo lee `--tw-outline-style`, y `outline-none` la pone en `none`: sin fijar el estilo, el contorno no se dibuja.
- `aria-invalid` usa el token `error`.
- **En `PropertyForm`, la franja superior de cada operación (`OperationField`) es un `<label>` de ancho completo**: tocar cualquier punto de la franja marca la casilla. El bloque de precio queda **afuera** del `<label>`, o tocar un campo de precio alternaría la operación.

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

### Avisos persistentes — Notice + ErrorBanner + AgencyApprovalNotice

- **`src/components/feedback/Notice.tsx`**: aviso persistente reutilizable. Server Component, sin estado, sin botón de cerrar, `role="status"`, tres tonos (`info`/`warning`/`error`). Describe **un estado de la cuenta que dura**.
- **`src/components/feedback/ErrorBanner.tsx`**: el otro, y **viven juntos a propósito en la misma carpeta porque la confusión entre los dos es el error de tipo que se comete**. ⚠ Acá decía que el banner de error *"está copiado a mano en cuatro pantallas"*: **era cierto y dejó de serlo** — se extrajo el 10 sep 2026, después de que las copias divergieran (dos con `mb-4` y dos sin).

| | `Notice` | `ErrorBanner` |
|---|---|---|
| Qué comunica | un **estado que dura** | **algo que la persona intentó, falló** |
| ¿Se cierra? | **no**: se va cuando el estado cambia | **sí**, con una ✕ (`useState` del llamador) |
| Render | **Server Component** | Client Component (`"use client"`) |
| Cuándo aparece | ya está al entrar a la pantalla | después de una acción |

  **⚠ EL MARGEN VIENE DE AFUERA (`className`), Y ES UNA RESTRICCIÓN MEDIDA, NO UN GUSTO DE API.** De las cuatro pantallas que lo usan, **dos** lo tienen suelto dentro de un fragmento y necesitan `mb-4` (`PropertiesTable`, `AgenciesTable`) y **dos** viven en un contenedor con `space-y-6` que ya separa a sus hijos (`SubscriptionContent`, `TeamContent`). Un margen fijo adentro del componente **rompe dos pantallas en una dirección o las otras dos en la contraria**: o quedan pegadas o con el doble de aire. La divergencia original de las copias **era comportamiento correcto**, no descuido. Y **devuelve `null` si no hay mensaje**, así que ningún llamador escribe su propio `{error && (…)}` — la línea que se olvidaba al agregar la quinta pantalla.
  ⚠ **Los errores de FORMULARIO son otra familia y NO usan esto:** un `<p className="font-sans text-sm text-error">` pelado, debajo del campo o del botón, sin caja y sin cierre. Van con su campo, no como cartel de pantalla (ver PENDIENTES.md).
- **Aviso de suscripción que no rige (`SubscriptionContent`)**: `Notice` en tono **`warning`, no `error`** — puede ser una baja acordada, una prueba que terminó o un pago pendiente, y el sistema no sabe cuál, así que no acusa a nadie. **Bug que cierra:** esa pantalla solo preguntaba por `'pending'`, así que `canceled` y `past_due` caían en la misma rama que una suscripción sana y la agencia dada de baja **veía su plan anterior como plan actual, con su fecha de vencimiento y sin un solo aviso** — era la única pantalla que no se lo decía (el bloqueo al publicar sí, y sus propiedades ya no estaban en el mapa). Ahora avisa, **oculta la fecha** (*"plan activo hasta el X"* de un plan dado de baja es justo la contradicción) y **no ofrece ningún upgrade**. ⚠ `'pending'` NO entra en esa rama y no debe entrar — pero **el motivo cambió y acá estaba escrito el viejo**: decía *"es una agencia al día esperando activación"*, que era el sentido de `'pending'` **cuando significaba dos cosas**. Desde el 11 sep 2026 significa una sola: **una agencia recién registrada que todavía no tiene nada activo**. Sigue sin entrar en la rama de `canceled`/`past_due` porque no le dieron de baja nada, pero tampoco es "una agencia al día": es una que todavía no arrancó. Ver "Un pedido de plan abierto".
- **`src/components/dashboard/AgencyApprovalNotice.tsx`**: el de dominio. Presentacional puro — recibe `status` y `rejectionNote` ya resueltos en el server y **no consulta nada**; devuelve `null` si la agencia está aprobada. Montado en `/dashboard` y en `/dashboard/preferencias` (con `showEditLink={false}`, porque es la pantalla del enlace y ahí se corrige lo que motivó el rechazo). ⚠ **En `/dashboard` ya NO se monta por su propia condición**: es una de las dos ramas del ternario del cartel de visibilidad, que es lo que garantiza que nunca se vea junto al otro aviso (ver "El cartel de visibilidad del panel"). ⚠ **Y sus dos textos se corrigieron:** decían solo que no se podía publicar, y **omitían que lo ya cargado tampoco se muestra en el mapa** — la aprobación es la PRIMERA condición de `agency_is_publicly_visible()`. No era teórico para una agencia **rechazada**, que puede tener la cartera entera cargada de cuando estaba aprobada (los triggers de aprobación son solo de `INSERT`: rechazar no borra ni despublica nada), y leía *"no vas a poder publicar"* quedándose con que lo suyo seguía a la vista.

### El cartel de visibilidad del panel — tres motivos, UNO SOLO a la vez

> Antes el panel **no decía nada** cuando las propiedades de una agencia no se estaban mostrando en
> el mapa: el listado se veía igual, el contador del plan se veía igual, y la agencia se enteraba
> recién si entraba a la pantalla de suscripción. Era el peor momento posible para no avisar,
> porque es justo cuando tiene que decidir si paga.

**Dónde va:** en `/dashboard`, entre el título y la grilla de tarjetas — el único hueco de ancho
completo del layout y lo primero que ve al entrar.

**⚠ NO va en el layout compartido:** ahí quedaría dentro del contenedor que scrollea y se iría de
pantalla al bajar, y repetido en las siete pantallas del panel se vuelve ruido que nadie lee.
**Tampoco en `/dashboard/suscripcion`**, que ya tiene su propio aviso, más largo y con el correo de
contacto.

**Los tres motivos y quién los cuenta:**

| Motivo | Componente | Tono | Título |
|---|---|---|---|
| `not_approved` | `AgencyApprovalNotice` | `info` / `error` | "Tu cuenta está en revisión" / "Tu solicitud no fue aprobada" |
| `not_current` | `AgencyVisibilityNotice` | **`warning`** | "Tus propiedades no se están mostrando en el mapa" |
| `plan_not_active` | `AgencyVisibilityNotice` | **`info`** | "Tus propiedades todavía no se ven en el mapa" |

#### ⚠ LA GARANTÍA DE QUE NUNCA SE MUESTRAN DOS: no es disciplina, son tres capas

1. **Un solo motivo, no dos banderas.** `getVisibilityBlock` devuelve **un** `reason`. Que la
   agencia esté sin aprobar **y además** dada de baja no produce dos avisos: el helper ya resolvió
   la prioridad y devolvió uno.
2. **En la estructura: un ternario sobre ese único motivo**, no dos condicionales independientes
   (`dashboard/page.tsx:139-150`). ⚠ Esto **reemplazó** a un `{agency.approval_status !== "approved" && (…)}`
   suelto: con dos condiciones separadas los dos carteles podían dar verdadero a la vez.
3. **En los tipos: `reason: Exclude<VisibilityBlockReason, "not_approved">`**
   (`AgencyVisibilityNotice.tsx:45`). **Pasarle el motivo de aprobación NO COMPILA**, y TypeScript
   estrecha el tipo en la rama `else` del ternario, así que el llamador pasa sin ningún cast. La
   regla dejó de ser una convención que se olvida.

#### ⚠ LOS DOS HELPERS QUE PARECEN LO MISMO Y NO LO SON

|  | `getPublishBlock` | `getVisibilityBlock` |
|---|---|---|
| Pregunta | **"¿puede CARGAR una propiedad nueva?"** | **"¿lo que ya cargó SE VE en el mapa?"** |
| Espejo de | los **TRES TRIGGERS** de `properties` | la **FUNCIÓN** `agency_is_publicly_visible()` |
| Motivos | `not_approved` · `subscription_inactive` · `plan_limit` | `not_approved` · `not_current` · `plan_not_active` |
| El estado | **lista negra** (`canceled`/`past_due`) | **lista blanca** (`= 'active'`) |

**⚠ USAR EL PRIMERO PARA LO SEGUNDO FALLA EN DOS DIRECCIONES OPUESTAS**, y las dos se pagan caro.
La explicación está escrita en el encabezado de los dos archivos, cada uno apuntando al otro por
nombre:

- **LE SOBRA UN MOTIVO.** Una agencia con el cupo del plan lleno **no puede publicar**, pero **SÍ
  se está viendo** en el mapa. Avisarle que no se ve sería mentirle **justo a quien está por
  decidir si paga un plan mayor**.
- **LE FALTA UNA CONDICIÓN.** La agencia del aterrizaje (`plan = 'free'`) **no produce ningún
  bloqueo de publicación** —el botón está habilitado y la propiedad se guarda sin error— y sin
  embargo **no se ve**. Aquel helper se quedaría **mudo en el caso más frecuente de todos**.

**Y hay una diferencia más fina en el estado:** para publicar, `'pending'` **no** bloquea (lista
negra, para que una agencia nueva pueda ir cargando su cartera mientras espera); para la
visibilidad **sí**, porque la base exige `= 'active'`. **Publicar y verse no son la misma
pregunta**, y este es el punto exacto donde se separan.

**`getVisibilityBlock` replica las tres condiciones de la función EN SU MISMO ORDEN** (aprobación →
estado → plan), que es además el orden en que Postgres dispara los tres triggers. Si el panel
ordenara distinto, **el cartel de la pantalla y el error al guardar contarían historias diferentes
sobre la misma agencia.** Y **no cuesta ninguna consulta**: `approvalStatus` viene de
`requireAgentSession()` y `status`/`plan` de `getPlanUsage()`, los dos ya pedidos por esa página.

### ⚠ El estado de aterrizaje y su cupo — y la regla que salió de ahí

**El estado completo de una agencia recién aprobada cuyo plan todavía no se activó:**

| | Valor |
|---|---|
`agencies.approval_status` | `approved`
`subscriptions.plan` | **`free`**
`subscriptions.status` | `active` (no eligió plan) o `pending` (lo eligió y espera)
`subscriptions.property_limit` | **1** — medido en las dos fuentes: `PLANS.free.propertyLimit` y el `DEFAULT` de la columna
`agency_is_publicly_visible()` | **`false`** (falla la tercera condición, `plan <> 'free'`)
`getPublishBlock` | **`null`** mientras tenga cupo: **puede cargar, sin ningún error**

**O sea: puede cargar UNA propiedad, y esa propiedad NO se ve en el mapa hasta que el plan se
active.** ⚠ Y es el estado de **toda alta nueva**, porque el plan lo activa a mano el dueño.

**Dos mensajes distintos lo explican, y cuentan la MISMA historia** — se leen como una sola
conversación en dos momentos, antes de cargar y después:

| Momento | Dónde | Qué dice |
|---|---|---|
| **Antes de cargar** | el cartel de `/dashboard` (`plan_not_active`) | *"**Ya podés cargar tu primera propiedad**, así vas conociendo el formulario. Por ahora el límite es de **una sola propiedad**, porque tu plan todavía no está activo. La que cargues queda guardada tal cual y **se publica sola cuando lo activemos**, sin que tengas que volver a tocarla. **Ahí vas a poder cargar el resto de tu cartera.**"* |
| **Cuando llegó al límite** | bajo el botón "Nueva propiedad" (`PlanLimitMessage`, rama `plan === 'free'`) | *"Llegaste al límite de lo que podés cargar por ahora. Cuando activemos tu plan **vas a poder cargar el resto de tu cartera**."* → `Ver mi suscripción` |

**⚠ La última frase es LITERALMENTE la misma en los dos, a propósito:** el cartel la promete y el
mensaje la cumple. Y los dos mandan al **mismo** destino (`Ver mi suscripción`), **nunca a
"Ver planes"**, que es el enlace del canal de venta.

**⚠ Y una cosa que el primer mensaje NO PUEDE DECIR NI SUGERIR: que esa propiedad sea "de prueba",
un "ejemplo" o algo descartable.** No se borra nunca: cuando el plan se active **queda publicada
como una más**. Si la agencia la carga creyendo que es un simulacro, pone cualquier cosa, y esa
cualquier cosa **termina en el mapa público con su nombre**. Por eso el texto afirma lo contrario
en positivo —*"queda guardada tal cual"*, *"se publica sola"*— en vez de negar la palabra "prueba",
que plantearla ya la sugiere.

**El número del cupo se DERIVA del catálogo**, no se tipea en la prosa (`FREE_LIMIT_LABEL` en
`AgencyVisibilityNotice.tsx`, con la forma singular/plural que ya usan `SubscriptionContent` y
`PlanSelector`): el número ya vive en dos lugares —el catálogo y el `DEFAULT` de la columna— y un
tercero escrito en una frase es la copia que nadie va a acordarse de actualizar.

#### ⚠ LA REGLA: antes de invitar a pagar más, verificar que pagar sea lo que destraba

**Es la segunda vez que el proyecto se tropieza con exactamente esto**, y las dos veces el síntoma
fue el mismo mensaje: *"Alcanzaste el límite de tu plan Gratis. Pasá a Inicial para publicar más."*

| | Cuándo | A quién se lo decía | Causa |
|---|---|---|---|
| **1ª** | al agregar el motivo `subscription_inactive` | a una agencia **dada de baja** | un **ternario binario**: el motivo nuevo cayó en el `else`. Se cerró con un `switch` exhaustivo con guarda `never` |
| **2ª** | al aparecer el estado de aterrizaje | a una agencia **con el plan por activarse** | una **rama que ramificaba por el plan siguiente del catálogo sin preguntarse si ese plan resuelve algo** |

**El `switch` con guarda `never` cerró la primera vía y no la segunda**: el motivo `plan_limit`
llegaba bien, y lo que fallaba era la ramificación **dentro** de su mensaje. Hoy `PlanLimitMessage`
tiene **tres** ramas (aterrizaje → no invita a nada · plan de venta → invita al upgrade, que es un
canal de venta legítimo · plan tope → ofrece contacto).

**Lo que hay que llevarse: un bloqueo correcto con el mensaje equivocado manda a la persona a
resolver algo que no la destraba, y en el peor momento — cuando está esperando otra cosa.** Antes
de escribir "pasá a {plan}", preguntarse si pasar de plan es lo que efectivamente la destraba.

### Plan usage — getPlanUsage
- Siempre `src/lib/utils/getPlanUsage.ts`. Cuenta por `agency_id`. Solo en server.
- **Sin fila de suscripción reporta límite `0`**, igual que `check_property_limit()`. Ver "Sin fila de suscripción el límite es 0".

### ⚠ Un UPDATE acotado sobre una fila que no existe NO devuelve error

**Afecta cero filas y reporta éxito.** `error` viene en `null`, así que mirar solo el error hace
pasar por guardado algo que no se guardó. **Es un fallo silencioso, no una excepción**, y por
eso hay que buscarlo a propósito.

Ya mordió una vez: `requestPlanUpgradeAction` (`dashboard/suscripcion/actions.ts`) hacía
`update({ pending_plan, status }).eq("agency_id", …)` y, sin fila, **la agencia veía la
confirmación del pedido, volvía a la pantalla y el plan seguía igual**, sin ningún rastro de
qué había pasado.

**Cómo se resolvió: contando las filas afectadas en la MISMA escritura.**

```ts
const { error, count } = await admin
  .from("subscriptions")
  .update({ pending_plan: plan, status: "pending" }, { count: "exact" })
  .eq("agency_id", agent.agency_id);
```

y después `if (count === 0)`, con un mensaje que **no habla de planes** (*"Hay un problema con
la configuración de tu cuenta. Escribinos…"*): lo que le falta a esa agencia no se resuelve
cambiando de plan.

**⚠ Por qué el `count` y no leer la fila antes:** leer y escribir son **dos viajes distintos**,
así que preguntar "¿existe?" antes deja una ventana entre la pregunta y la respuesta — y
además cuesta una consulta más. **El `count` mide lo que la escritura hizo de verdad**, no lo
que era cierto un momento antes. Es el patrón a repetir en cualquier `update`/`delete` acotado
cuyo resultado se le informe a una persona.

### ⚠ La guarda contra el cero de las barras de uso es VESTIGIAL, y hoy es load-bearing

**TRES** componentes calculan un porcentaje de uso **dividiendo por el límite**, y los tres
tienen la misma guarda:

- `src/components/dashboard/PlanBadge.tsx` — `const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;`
- `src/components/dashboard/SubscriptionContent.tsx` — `const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;`
- `src/components/dashboard/FeaturedBadge.tsx` — la misma línea para el **cupo de destacadas**, que
  llegó con la tanda del 16 sep 2026 y cuyo comentario apunta a `PlanBadge`. ⚠ Acá decía "dos
  componentes" y "si se toca una, se toca la otra": **son tres, y si se toca una se tocan las
  tres.**

**Esa guarda NO se escribió para el límite 0.** Quedó del modelo anterior de planes, cuando
existía uno "Ilimitado" — el propio comentario de `PlanBadge` lo dice: *"En el modelo de 4
planes todos tienen un límite finito … Ya no hay 'Ilimitado'"*. O sea que **parece muerta**.

**No lo está: desde que `getPlanUsage` reporta 0 sin fila, es lo único que evita una división
por cero.** Borrarla por prolija reintroduce el problema, y el síntoma aparecería en una
pantalla que nadie relacionaría con las suscripciones. **Si se toca una, se tocan las tres.**

⚠ En `FeaturedBadge` el caso es además **alcanzable hoy**: ese chip se monta solo con `limit > 0`,
pero `getFeaturedUsage` devuelve `limit: 0` cuando la agencia no tiene fila de suscripción, así que
la guarda es lo que sostiene la promesa de su propio llamador.

### Etiquetas UI — labels.ts
- Nunca definir mapas de etiquetas inline. Usar `PROPERTY_TYPE_LABELS`, `OPERATION_TYPE_LABELS`, `PROPERTY_STATUS_LABELS`, `AMENITY_LABELS`, `CURRENCY_LABELS`.

### Tiles del mapa — tiles.ts
- `src/lib/map/tiles.ts` es la fuente única de config de tiles (OSM estándar), consumida por `MapView` y `LocationPicker`. Rama opcional para `NEXT_PUBLIC_MAPTILER_KEY`.

### Favoritos y visitados
- `useFavorites` y `useVisitedProperties` en localStorage. Sin login.
- ⚠ **SOLO FAVORITOS SE SINCRONIZA ENTRE INSTANCIAS.** Acá decía que **los dos** *"se reflejan en vivo en el mapa, el modal y las cards (sync entre instancias vía CustomEvent + storage)"*, y **para los visitados es falso** (medido el 14 sep 2026): `useFavorites` escucha su `CustomEvent` y el evento `storage`; `useVisitedProperties` **lee el almacenamiento una sola vez al montar** (`useState(() => readVisited())`) y no escucha nada. Cada instancia del hook tiene su propia copia. Consecuencia concreta: lo que se marca desde la lista de celular **no repinta los pines hasta recargar**, porque el mapa no se desmonta al pasar a la lista (ver PENDIENTES.md).

### Visitas y consultas por propiedad

> Hasta el 14 sep 2026 `views_count` valía **0 en todas las propiedades**: la función de la base que la
> incrementa existía y **ningún camino del código la llamaba**. Y era lo primero que una inmobiliaria
> iba a mirar en su panel. Hoy se cuenta desde tres lugares y el listado muestra visitas y consultas
> por propiedad, **separadas**: una dice cuánta gente miró, la otra cuántos se decidieron a escribir.

#### Dónde se cuenta una visita: tres lugares, y NO el modal

| Lugar | Disparador | Código |
|---|---|---|
| **Pin del mapa** | click | `ClusterLayer.tsx:137` |
| **Tarjeta de la lista de celular** | toque (o Enter/espacio) | `PropertyList.tsx:140`. ⚠ Antes abría el modal **sin marcar nada**, contra lo que DESIGN §5 define como visitado ("ya abrió el modal") |
| **Ficha pública** | primera interacción real | `PropertyViewTracker.tsx:68`, montado en `propiedades/[slug]/page.tsx:196` |

Los tres hacen lo mismo, en el mismo orden: **`if (markVisited(id)) registerView(id);`**. Marcar va primero porque **no depende de la base** (el tono visitado se aplica aunque el incremento falle) y contar solo ocurre si la propiedad **era nueva para este visitante**. El sitio de marca `/[slug]` monta el mismo `MapView` y la misma `PropertyList`, así que **también cuenta, sin código propio**. El título de la tarjeta (enlace a la ficha) y el corazón frenan la propagación, así que **no cuentan desde la lista**: el título lleva a la ficha, que cuenta por su lado.

**⚠ POR QUÉ NO SE CUENTA EN EL MODAL, que parece el lugar natural.** El pin marca la propiedad **un instante antes** de que corra el efecto del modal, así que desde ahí `markVisited` devolvería **siempre** "ya estaba" y **los pines no contarían nunca**. Mover la marca al modal habría obligado a **sincronizar las instancias del hook**, o el tono "visitado" de los pines se perdería al recrear los markers hasta recargar. Tocar un pin es la misma intención que abrir la ficha. El comentario de `PropertyModal.tsx` lo dice, y agrega: **no agregar una segunda llamada ahí "para asegurarse"** — sin almacenamiento sumaría dos visitas por apertura, y con él, ninguna.

#### La deduplicación: la señal sale del almacenamiento, NUNCA del estado de React

`markVisited` (`useVisitedProperties.ts`) **devuelve `true` si la propiedad era nueva** para este visitante:

```ts
const markVisited = useCallback((propertyId: string): boolean => {
  const current = readVisited();
  const isNew = !current.includes(propertyId);
  if (isNew) writeVisited([...current, propertyId]);

  setVisited((prev) =>
    prev.includes(propertyId) ? prev : [...prev, propertyId]
  );

  return isNew;
}, []);
```

- **⚠ La señal sale de una LECTURA SÍNCRONA de `localStorage`**, antes de escribir. Antes la comparación vivía dentro de `setVisited((prev) => …)` y no salía de ahí; y aunque se la sacara, **un actualizador de estado no corre necesariamente en el momento de la llamada y en desarrollo corre DOS veces** (StrictMode): una variable asignada adentro podría leerse vacía o dar "nueva" dos veces. Es el molde de `toggleFavorite`: *el almacenamiento es la fuente de verdad*.
- **El estado se actualiza aparte, con el actualizador sobre lo que ya había en memoria**, y no con `setVisited(next)` como favoritos. Si `localStorage` falla, `next` sería solo esta propiedad y borraría de la pantalla las marcadas antes: así el tono visitado no depende del almacenamiento.
- **Es persistente**: una vez por propiedad **por visitante**, no por sesión. Quien vio una casa hace meses y vuelve no suma.
- ⚠ **SIN `localStorage` (bloqueado, modo privado con cuota llena) CADA APERTURA CUENTA COMO VISITA NUEVA**: la lectura da `[]` y la escritura falla en silencio. Está declarado en el código y **no se resolvió a propósito**.
- ⚠ **No es una barrera contra nadie**: `increment_views` se puede llamar directo por la API tantas veces como se quiera (ver PENDIENTES.md). La deduplicación solo evita el doble conteo honesto.

#### En la ficha pública: la primera interacción, nunca el montaje

**⚠ POR QUÉ NO AL MONTAR:** **el renderizador de un buscador EJECUTA JavaScript pero NO interactúa**, y arranca sin nada en `localStorage`, así que para él cada pasada sería una propiedad "nueva". Y el proyecto tiene un **mapa del sitio que le ofrece todas las fichas**: pasaría seguido. **Y nada se cuenta en el render del servidor**, que además contaría a los robots de vista previa (WhatsApp, Facebook) cada vez que alguien comparte el enlace. `PropertyViewTracker` es una isla de cliente que renderiza `null`: el HTML de la página no cambia.

| Evento | Qué cubre |
|---|---|
| `pointerdown` | cualquier toque o click, con mouse, dedo o lápiz; en pantalla táctil también al empezar a deslizar |
| `touchstart` | lo mismo en navegadores táctiles sin Pointer Events |
| `wheel` | rueda o trackpad del escritorio: la intención de scrollear, aunque la página no tenga más para bajar |
| `keydown` | teclado |

- **NO se escucha `scroll`**: no es una interacción sino su efecto, y dispara también cuando la página se desplaza **sola** (restauración al volver atrás, un ancla, el navegador llevando un elemento enfocado a la vista). **Tampoco `mousemove`**: pasar el mouse no es decidir mirar.
- Se escucha en **`window`, fase de captura** (llega antes que cualquier `stopPropagation` de la página) y **`passive`** (no frena el scroll).
- ⚠ **`keydown` ES EL MÁS FLOJO DE LOS CUATRO, y se dejó a sabiendas.** Cualquier tecla que llegue a la página cuenta, **incluida la tecla modificadora con la que empieza un atajo del navegador o del sistema** (el Ctrl de un Ctrl+Tab para cambiar de pestaña, el Alt de un Alt+Tab): la página la recibe antes de que el navegador o el sistema se la lleven, y la visita cuenta sin que nadie esté mirando la ficha. **No afecta el objetivo**: un buscador no dispara teclas. **No es un descuido**.
- **Una sola vez por apertura, en tres capas:** `firedRef` (el primer evento la pone en `true` y el resto sale sin hacer nada; la ref sobrevive al montaje doble de StrictMode), `stop()` (el propio manejador saca las cuatro escuchas, y el cleanup del efecto también) y `markVisited` (si ya estaba vista, por cualquier camino, devuelve `false`). El montaje lleva **`key={property.id}`**: sin la `key`, navegar a otra ficha reutilizando el componente dejaría la segunda sin contar.

#### `registerView`: nunca lanza, nunca muestra nada

`src/lib/utils/registerView.ts` es **la única llamada** a la función de la base:

```ts
void supabase.rpc("increment_views", { property_id: propertyId }).then(
  ({ error }) => { if (error) console.error("[registerView] No se pudo registrar la visita:", error.message); },
  (reason: unknown) => { console.error("[registerView] No se pudo registrar la visita:", reason); }
);
```

- ⚠ **El parámetro es `property_id`, LITERAL.** La otra RPC del proyecto usa `target_agency_id`: copiar ese molde (`target_property_id`) o escribir `propertyId` **compila perfecto y falla en cada apertura**, con un error que solo se ve en la consola.
- **No se espera y no lanza**: es una métrica para la agencia, no una función del visitante. Un fallo queda en la consola y no produce ningún cartel.
- La función de la base y su guarda sobre `updated_at` están en "Base de Datos" → la guarda de `updated_at`.

#### Las dos métricas en el listado del panel

`/dashboard/propiedades` muestra **"Visitas" y "Consultas" en dos columnas separadas** (en celular, *"N visitas · M consultas"*), **en todos los planes**. Lo que queda para premium es el **análisis**, que no existe todavía; y hoy **`has_metrics` no gatea nada** (ver el Resumen del Proyecto).

- **Visitas:** `views_count` en el `select` del listado, sin costo extra.
- **Consultas:** **UNA sola consulta agregada**, en paralelo con el listado (`propiedades/page.tsx:71-77`):
  ```ts
  createAdminClient().from("properties").select("id, leads(count)")
    .eq(isAgencyAdmin ? "agency_id" : "agent_id", isAgencyAdmin ? agent.agency_id : userId);
  ```
- **⚠ POR QUÉ SERVICE ROLE:** con el client normal **la RLS trunca el número en silencio**. Las dos policies de SELECT de `leads` son `Agent reads own leads` (`agent_id = auth.uid()`) y `Admin reads agency leads`, así que **un agente común** no vería las consultas de una propiedad suya que entraron cuando estaba a nombre de otro agente, ni las desvinculadas. **Y el conteo embebido no da error cuando la RLS recorta: devuelve `count: 0`** (medido con la anon key: HTTP 200 y ceros en propiedades que tienen consultas). El número tiene que ser el **de la propiedad**, igual que `views_count`, o la relación entre los dos miente.
- **⚠ La barrera es el FILTRO, no una policy:** el mismo alcance que el listado, con los dos valores sacados de la sesión del servidor. Un agente recibe solo los totales de las propiedades a su nombre; un admin, los de su agencia. Solo viajan números.
- **Un conteo que no se pudo leer es `null` y se muestra "—", nunca un 0**, que diría "nadie escribió". ⚠ La fila pregunta `leadCountById.has(p.id)` antes de leer: un `leadCountById.get(p.id) ?? 0` convertiría en 0 justo el `null` de un conteo con forma inesperada. Pasó una vez, compilando y pasando el lint.
- ⚠ **Consecuencia aceptada:** en el listado un agente común ve **todas** las consultas de su propiedad, pero en `/dashboard/leads` sigue viendo **solo las suyas** (esa pantalla usa la RLS). Los dos números pueden no coincidir.
- ⚠ **Y en `/dashboard` las dos tarjetas NO son comparables:** "Leads este mes" son **los últimos 30 días**, y "Vistas totales" es la suma de `views_count`, **acumulada desde siempre y sin filtro de estado**. En el listado las dos son acumuladas (ver PENDIENTES.md).

### White-label por agencia — `/[slug]` (Sub-pieza A)
- **Ruta pública `src/app/(public)/[slug]/page.tsx`** (Server Component, `params` es Promise → `await`): una URL por agencia (`marka.com.ar/[slug]`) que muestra el mapa filtrado SOLO a las propiedades de esa agencia. El root `/[slug]` es **exclusivo de agencias** — NO hay ruta `/[ciudad]` (la ciudad se resuelve por `cityStore`, nunca por URL). Cualquier ruta pública futura de primer nivel (`/precios`, etc.) compite con este `[slug]`; las estáticas ganan a la dinámica, pero tenerlo presente.
- **`resolveAgencyBySlug(slug)`** (`src/lib/utils/resolveAgencyBySlug.ts`, server-only): resuelve el slug en **3 estados** y la ruta bifurca: `not_found` → `notFound()` (404 real); `disabled` → `AgencyUnavailable`; `active` → `AgencyMapView`. **`disabled` tiene TRES gates independientes** que se colapsan a propósito (al visitante anónimo no se le cuenta por qué): **legitimidad** (la agencia tiene que estar aprobada), **entitlement** (`has_white_label = true`, el booleano y nunca el nombre del plan; sin ciudad tampoco hay mapa) y **pago** (`agency_is_publicly_visible`, por RPC). Los dos primeros van antes por ser gratis —los datos ya están en la fila—; el tercero cuesta un viaje a la base. **No colapsar `disabled` en `not_found`**: un slug que no existe y una agencia que existe sin plan son páginas distintas (la segunda no debe parecer "rota" para una agencia que bajó de plan).
- **Usa service role** (admin client), NO el client público. Motivo: la policy `Agency members read own subscription` solo deja leer `subscriptions` a los agentes de esa agencia; el visitante white-label es **anónimo**, así que con el anon client `has_white_label` volvería vacío y TODA agencia parecería `disabled` (el estado `active` sería inalcanzable). Es seguro: función server-only, lee pocos campos no sensibles (id, name, city_id, el flag, centro de la ciudad). **No se tocó ninguna policy.** Una sola query con embeds de PostgREST (`agencies` + `subscriptions` + `cities`); helper `firstOf` normaliza el embed to-one (objeto vs array de uno).
- **`AgencyMapView`** es mirror de la home pero **sin `CityPicker`**: la vista es de UNA agencia en SU ciudad (resuelta en server), no navegable a otras ciudades. Incluye lista mobile (cards-first) como la home. Sin personalización visual todavía (logo/nombre llegan en Sub-pieza B) — se ve con el diseño estándar de Marka.
- **Filtrado:** el `agencyId` opcional de `useProperties` agrega `.eq("agency_id", agencyId)` ADICIONAL a `city_id` + `status = 'active'`. Threadeado desde `AgencyMapView` → `MapView`/`PropertyList`. Sin el parámetro (la home), nada cambia.
- **Sub-pieza B1 — Subir el logo en Preferencias (HECHA):** `AgencyLogoForm` (solo admin) sube el logo **client-side** (browser client, como el avatar de `ProfileForm`) al bucket `property-images`, path `logos/{agency_id}/logo.{ext}`, `upsert: true`. La **URL** se persiste con `updateAgencyLogoAction` (server action que clona `updateAgencyPhoneAction`: gate `role === "admin"` + service role + `.eq("id", caller.agency_id)`). Decisión de diseño: lo sensible es la escritura en `agencies` (gateada a admin), no el archivo en Storage (bucket público, archivo huérfano inocuo) → no hace falta upload por server action/FormData. **Validación REAL** (más estricta que el avatar, porque el logo es público): solo PNG/JPG/WEBP (NO SVG, riesgo XSS), máx 2 MB, chequeado en JS antes de subir. ⚠ **Desde el 5 sep 2026 el bucket TAMBIÉN valida** (`allowed_mime_types` PNG/JPG/WEBP + `file_size_limit` 5 MB): el chequeo de JS dejó de ser la única barrera —nunca lo fue para quien no pasa por el formulario— y los 2 MB del logo siguen siendo la regla propia de este form, más estricta que el techo del bucket. Ver "Imágenes y Storage". La extensión sale del MIME validado (`ACCEPTED_TYPES[file.type]`), no de `file.name` sin sanear. **Cache-buster** (`?t={Date.now()}`) solo en la preview tras guardar (la URL en la DB queda limpia) — necesario porque el path es fijo con `upsert`, sin el buster el navegador mostraría el logo cacheado. El logo **NO se muestra en el white-label todavía** (eso es B2): en B1 solo se ve de vuelta en el form para verificar.
- **Sub-pieza B2a — Logo + nombre en el header (HECHA):** `AgencyMapView` recibe `agencyName` + `agencyLogoUrl` (la ruta los pasa; `resolveAgencyBySlug` ya trae `logo_url` en estado `active`). Header: **logo de la agencia a la izquierda** (donde en la home va el Wordmark de Marka) con `h-9 w-auto max-w-[160px] object-contain` (altura fija, ancho según relación de aspecto, tolera cualquier proporción sin romper el header); **nombre de la agencia en el centro** (`text-base sm:text-lg`, visible también en mobile). Si NO hay logo: el nombre va a la izquierda y el centro queda vacío (nunca el Wordmark de Marka). La marca de la agencia NO es link (llevaría al marketplace general, contradiciendo el white-label). **"Powered by Marka."** discreto centrado al pie (`fixed`, `pointer-events-none`, respeta safe-area y no tapa FABs/zoom), usando un `size="xs"` nuevo del `Wordmark` (aditivo). Validación de PROPORCIONES del logo al subir (rechazar verticales extremos) quedó como ajuste futuro a B1 — el `object-contain` ya protege el layout.
- **Sub-piezas B2b y C — HECHAS (12–13 sep 2026), después de estar en pausa.** ⚠ **Acá decía que estaban "EN PAUSA … hasta resolver los cambios profundos de modelo"**: ese modelo se estabilizó y las dos se cerraron.
  - **B2b** = el sitio apagado le habla a su administrador. Ver "El sitio apagado le habla a su dueño". Lo que el ítem preveía se cumplió tal cual: hubo que **ensanchar `disabled`** para que devuelva `id` y `name` (era `{ status: "disabled" }` pelado) y **meterle resolución de sesión a la ruta**, que era 100 % anónima.
  - **C** = la dirección del sitio es editable. Ver "La dirección del sitio de marca". Antes hubo que cerrar un agujero que ya existía: **no había ninguna lista de direcciones reservadas**.

### La dirección del sitio de marca — reservadas y edición

> Hasta el 12 sep 2026 la dirección (`agencies.slug`) se generaba sola del nombre al registrarse y
> **no se podía cambiar desde ningún lado**: una agencia quedaba con una dirección que no eligió, y
> corregirla exigía tocar la base a mano. Peor: **la app nunca se la mostraba** —no aparecía en
> Preferencias, ni en Suscripción, ni en `/admin`—, así que una inmobiliaria con plan profesional
> tenía un sitio cuya dirección no podía leer en ninguna pantalla.

#### ⚠ La lista de direcciones reservadas — `src/lib/utils/reservedSlugs.ts`

**Hubo que escribirla ANTES de permitir la edición, y cierra un agujero que ya existía.** `/[slug]`
es una ruta **dinámica de primer nivel**, así que compite por el mismo espacio de nombres que las
rutas reales, los archivos que el framework sirve en la raíz y toda ruta futura. Hasta esta pieza
**no había ninguna lista**: no pasaba nada por dos casualidades —las direcciones se derivaban del
nombre, y ninguna agencia se llamaba de una forma que colisionara—. Con el campo editable, la
casualidad desaparece.

**⚠ QUÉ PASA SI UNA AGENCIA TOMA UNA RESERVADA — no es un agujero de seguridad, es peor de
explicar.** Una ruta estática **siempre** le gana a la dinámica, así que la agencia no se apropia
de nada: **su propio sitio queda inalcanzable y en silencio**. Verificado por HTTP contra el build:

```
/inmobiliaria-demo  -> 200   (la dinámica resuelve)
/admin              -> 307   (gana la ruta real: redirect al login)
/propiedades        -> 404   (gana el segmento estático, que no tiene page)
```

O sea que una agencia con el slug `admin` pagaría su plan por una dirección que devuelve el login
del dueño de la plataforma, sin un solo error y sin ninguna pantalla donde enterarse.

**Los tres grupos, medidos: 135 entradas** (`RESERVED_SLUGS_COUNT`).

| Grupo | Cuántas | Qué hay |
|---|---|---|
| **1 · Rutas de primer nivel de HOY** | **7** | `admin` · `api` · `dashboard` · `login` · `logout` · `propiedades` · `register`. ⚠ `propiedades` y `api` entran **aunque no tengan página propia** (los dos dan 404): el segmento estático existe y le gana igual |
| **2 · Archivos servidos en la raíz** | **21** | Convención de Next (`robots.txt`, `sitemap.xml`, `favicon.ico`, `apple-icon.png`) + `public/` (`manifest.json`, `icon-192.png`, `markers`, los cinco SVG del andamio) + `_next`/`_vercel`. ⚠ Se guardan **con extensión y sin ella** a propósito: hoy la forma no admite puntos, así que `robots.txt` no es alcanzable, pero **la lista no puede depender de una regla que vive en otro archivo** |
| **3 · Reservadas para el futuro** | **107** | Seis bloques, cada uno con su motivo en el archivo: **(a) la marca propia y la suplantación** —`marka`, `oficial`, `soporte`, `seguridad`, `administrador`…— que es el bloque más importante porque puede hacer daño **aunque la ruta nunca exista**; (b) institucionales y de venta (`precios`, `contacto`, `terminos`…); (c) vocabulario del dominio (`ciudad`, `agencia`, `mapa`, `venta`…); (d) cuenta y sesión; (e) cobro; (f) infraestructura web (`www`, `static`, `cdn`…); (g) valores que se filtran de un bug (`null`, `undefined`…) |

**Dos decisiones de la lista que conviene no deshacer:**

- **La comparación es EXACTA contra el slug normalizado, no por prefijo.** Reservar `admin` no
  bloquea `administracion-lopez`, que es un nombre de inmobiliaria legítimo (verificado).
- **⚠ `ciudad` y `ciudades` son load-bearing**: `PENDIENTES.md` decide que la URL de ciudad, si
  alguna vez se hace, va como `/ciudad/[slug]`. Ese primer nivel **ya está comprometido** por una
  decisión escrita.

#### ⚠⚠ LA REGLA DE MANTENIMIENTO: AGREGAR UNA RUTA DE PRIMER NIVEL OBLIGA A AGREGARLA ACÁ

**Y hay que hacerlo ANTES de publicar la ruta.** El orden importa: si una agencia ya tomó esa
dirección, la ruta nueva nace ganándole y **le apaga el sitio a un cliente que paga**, sin aviso y
sin forma de detectarlo salvo que él lo reporte.

**Es la clase de acoplamiento que nadie recuerda**, porque el archivo que se toca (`src/app/...`) y
el que hay que actualizar (`lib/utils/reservedSlugs.ts`) no se parecen en nada y nada los conecta
en tiempo de compilación. La advertencia está escrita en el propio archivo, arriba de todo.

**La asimetría que decide el criterio de la lista: bloquear de más es gratis** (la agencia elige
otra dirección en el momento) **y bloquear de menos es irreversible en la práctica** (para cuando
se descubre, ya repartió su dirección). Por eso el grupo 3 es generoso.

#### La edición — `AgencySlugForm` + `updateAgencySlugAction`

- **Quién:** solo el **admin de la agencia**. La pantalla lo gatea y la action lo revalida
  (`caller.role !== "admin"`), con el `agency_id` del server.
- **Sin límite de cuántas veces.** Poner un número sería adivinar, y son clientes que pagan.
- **Dónde:** Preferencias, junto a los otros datos de identidad. La tarjeta **muestra la dirección
  actual completa y clickeable** — que es, de hecho, la primera vez que el producto se la enseña.

**Lo que se valida, en orden** (`lib/utils/agencySlug.ts`, mismas funciones en el formulario y en
la action):

| # | Validación | Valor |
|---|---|---|
| 1 | Normalización previa | `slugifyBase` + truncado + limpieza de bordes |
| 2 | Largo | **3 a 40** |
| 3 | Forma | `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` — la misma que produce `slugifyBase`, escrita como patrón |
| 4 | **Lista negra** | las 135 |
| 5 | Unicidad (pre-chequeo) | global, excluyéndose a sí misma (`.neq("id", agencyId)`) |
| 6 | Unicidad (garantía) | el `UNIQUE` de la base, traducido |
| 7 | Filas afectadas | `count === 0` → error de configuración |

⚠ **La unicidad del slug es GLOBAL, no por ciudad** (`agencies_slug_key UNIQUE (slug)`, medido), y
tiene que serlo: la dirección es una sola en todo el dominio. Es distinto de la matrícula, cuyo
índice sí lleva `city_id` porque los colegios son provinciales.

⚠ **El choque de unicidad se detecta con CÓDIGO + NOMBRE DEL ÍNDICE** (`23505` +
`agencies_slug_key`), nunca con el código solo: sobre `agencies` hay **tres** índices únicos y los
tres levantan `23505`. Es la misma trampa que ya documenta `translateApprovalWriteError`, mirada
desde el otro lado. El mensaje dice *"Otra inmobiliaria tomó esa dirección **hace un momento**"* —
lo de "hace un momento" no es adorno: describe algo que pasó **mientras la persona miraba la
pantalla**, y sin eso el rechazo se lee como un bug.

#### ⚠ LOS ENLACES VIEJOS NO SE REDIRIGEN, Y ESA ES LA DECISIÓN

**No se guarda historial de direcciones y la vieja pasa a dar 404.** El motivo: mantenerlas
andando implicaría **una tabla de direcciones pasadas y una consulta más en CADA visita al sitio de
marca** — infraestructura permanente para un caso raro.

**Por eso el aviso previo no es letra chica: es la pieza.** Es un **panel inline de dos pasos** (no
un `AlertDialog`: ese cierra al confirmar y el error de la action no tendría dónde mostrarse), que
muestra **las dos direcciones completas** —no el fragmento— y dice:

> **Los enlaces que ya compartiste van a dejar de funcionar**
>
> Tu sitio pasa a estar en **{nueva}**. La dirección anterior, **{vieja}**, deja de funcionar apenas
> confirmes: quien la abra va a ver una página inexistente.
>
> Eso alcanza a todos los enlaces que hayas repartido: los que mandaste por WhatsApp, los de tus
> redes, tu firma de mail, carteles y folletos impresos. No se redirigen solos a la dirección nueva.
>
> Tus propiedades, tus fotos y tus consultas no se tocan: lo único que cambia es la dirección.

⚠ **El tercer párrafo no es relleno**: frente a un cartel de advertencia, el miedo real de un
corredor es haber perdido el trabajo de cargar su cartera. Mismo criterio que el aviso de
visibilidad del panel.

⚠ **Y el daño del cambio es 100 % EXTERNO**, que es lo que vuelve al aviso la pieza entera:
`agencies.slug` lo consume **un solo lugar funcional** (la ruta `/[slug]`) más un `select` del panel
`/admin` que ni lo renderiza. **No está en el mapa del sitio, no hay ningún `agencyUrl()` en una
metadata, y no hay un solo `<Link>` a un sitio de marca en la app.** Adentro no se rompe nada.

### El sitio apagado le habla a su dueño

> El cartel genérico de "sitio no disponible" está bien para un visitante: la situación comercial de
> una inmobiliaria no es asunto suyo. Pero al **administrador de esa misma agencia** no le sirve —no
> le dice por qué está apagado ni qué hacer—, y es probable que entre: es su propia dirección y la
> va a tener en un marcador.

**`resolveAgencyBySlug` devuelve ahora el MOTIVO junto al estado `disabled`**, más el `id` y el
`name` de la agencia (antes era `{ status: "disabled" }` pelado). Los seis motivos de
`AgencyDisabledReason`, y la división que gobierna los textos —**qué puede resolver ella sola y qué
depende del dueño**—:

| Motivo | Qué pasa | ¿Puede sola? | Qué ofrece la pantalla |
|---|---|---|---|
| `rejected` | La solicitud fue rechazada | **Sí** | botón **"Corregir los datos"** → Preferencias |
| `subscription_inactive` | `canceled` / `past_due` | **Sí** | botón **"Ver mi suscripción"** |
| `no_white_label` | Al día, pero su plan no incluye sitio | **Sí** | botón **"Ver los planes"** |
| `not_approved` | Todavía en revisión (`pending`) | No — el dueño | **sin botón de acción** |
| `plan_not_active` | Plan `free`, o `status = 'pending'` | No — el dueño | **sin botón de acción** |
| `unavailable` | Cajón: sin fila de suscripción, sin ciudad, o el RPC falló | No | ofrece escribirnos |

⚠ **A los dos que dependen del dueño NO se les da botón**, a propósito: uno que no destraba nada
manda a la persona a dar una vuelta para volver al mismo lugar. Solo tienen *"Ir a mi panel"* como
enlace secundario.

⚠ **`no_white_label` es el ÚNICO de los seis que invita a pagar más, y ahí sí corresponde** — la
regla del proyecto es *"antes de invitar a pagar más, verificar que pagar sea lo que destraba"*.

⚠ **`classifyDisabled` CLASIFICA, NO DECIDE.** Se llama solo cuando los gates ya resolvieron que el
sitio está apagado: no agrega ni saca un caso. **La regla de cobro sigue viviendo en la base** (el
RPC decide si se muestra) y acá no se reescribe: se redacta. Los campos `status` y `plan` se
sumaron al `select` **solo para eso**.

⚠⚠ **Y SU ORDEN NO ES EL DE LOS GATES, QUE ES LA TRAMPA DE TODO ESTO.** Una agencia en el plan de
aterrizaje tiene `has_white_label = false` **y** `plan = 'free'` a la vez, y el gate la corta por el
flag (que es gratis) antes de llegar al RPC. **Si el motivo se leyera del gate que cortó, se le
diría *"tu plan no incluye sitio de marca"* —que suena a "comprate otro plan"— a una agencia que ya
pagó el premium y espera la activación manual**: el estado de toda alta nueva. Por eso
`no_white_label` se evalúa **último**.

#### ⚠ Cómo se reconoce al admin sin cobrarle el trabajo al visitante anónimo

**El mecanismo exacto: `resolveAgentSessionIfPresent()`** (en `resolveAgentSession.ts`), que **corta
antes de tocar nada** si no hay cookie de sesión:

```ts
async function hasAuthCookie(): Promise<boolean> {
  const store = await cookies();
  return store.getAll().some(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")
  );
}
```

`@supabase/ssr` guarda la sesión en cookies `sb-<project-ref>-auth-token` (más los sufijos `.0`,
`.1`… cuando el token se parte). Si no hay ninguna, **no puede haber sesión**, y eso se sabe leyendo
cookies que ya están en memoria.

| Quién | Costo agregado |
|---|---|
| Anónimo, **sitio activo** | **CERO. Ni se lee la cookie**: la llamada vive dentro del `if (disabled)`, así que la pantalla que ven los clientes que pagan no se tocó |
| Anónimo, sitio apagado | recorrer las cookies del request. **Cero red, cero consultas** |
| Logueado | lo de siempre, y suele estar ya pago (`resolveAgentSession` está en `cache()`) |

⚠ **ES UN DESCARTE, NO UNA AUTORIZACIÓN.** Una cookie presente no prueba nada —puede estar vencida
o ser de otro proyecto—, así que el camino positivo **no confía en ella** y sigue a
`resolveAgentSession()`, que valida contra Supabase. **Solo puede decir que NO hay sesión, nunca que
sí.** Verificado: una cookie falsa (`sb-fake-auth-token=inventado`) no cuela nada.

Y la comparación exige **tres condiciones**, todas del servidor: sesión válida, `role === "admin"`
y que la agencia de la sesión sea **ésta**. Un agente común de la misma agencia ve el cartel
genérico: no gestiona la suscripción.

⚠ **La pantalla dice "Solo vos ves este mensaje"**, y no es decoración: sin esa línea, un corredor
que abre su propia dirección y lee *"tu suscripción no está al día"* asume que **sus clientes están
leyendo lo mismo**. Es lo que convierte una pantalla alarmante en una útil.

⚠ **El caso `not_found` NO reconoce a nadie, incluida la dirección vieja liberada.** Una agencia que
cambió su dirección deja la anterior libre y su admin puede tenerla en un marcador — y aun así
recibe un 404. **No se puede saber que esa dirección fue suya** (no hay historial, por la decisión de
arriba), así que cualquier mensaje sería una conjetura; el admin **ya fue advertido** al cambiarla,
con las dos direcciones a la vista; y hacer que el código de estado dependa de quién mire es lo que
`resolvePropertyBySlug` documenta como el problema a evitar.

### El cambio de nombre de la agencia

> Cambiar el nombre devuelve la cuenta a revisión porque el **colegio de corredores regula los
> nombres comerciales**. El flujo completo se construyó en tres tandas… **sin que existiera el campo
> para pedirlo** (ver "Método de Diagnóstico" → recorrer de punta a punta).

#### Las dos columnas del rastro

`agencies.previous_name` y `agencies.name_change_requested_at`, las dos **nullable, sin default y
sin CHECK**. Sus comentarios en la base, transcritos:

> **`previous_name`** — *"Nombre que tenía la agencia antes del cambio pendiente de aprobación. Se
> escribe al pedir el cambio y se limpia al resolverlo (aprobar o rechazar). NULL = no hay cambio de
> nombre pendiente."*

> **`name_change_requested_at`** — *"Momento en que se pidió el cambio de nombre. Su presencia es lo
> que distingue, en approval_status=pending, un alta nueva de una agencia que ya venía funcionando y
> cambió su nombre. Se limpia junto con previous_name."*

⚠ **VAN SIEMPRE JUNTAS**: se escriben juntas al pedir el cambio —**en la misma escritura** que
devuelve la agencia a la cola, sin un UPDATE de más— y se limpian juntas al resolverlo. Una sola
cargada es un estado que no significa nada y que ninguna pantalla sabe leer. **Nada en la base lo
impone** (no hay CHECK): la regla la sostiene el código, en los cuatro lugares que las tocan.

⚠ **`previous_name` NO SE PISA si ya había un cambio pendiente.** Si la agencia se llamaba A, pidió
pasar a B y antes de que se resuelva pide pasar a C, el nombre anterior que el dueño necesita ver
sigue siendo **A** —el último que rigió de verdad—, no B, que nunca estuvo aprobado. Lo que sí se
actualiza es la fecha. **Y el caso de ida y vuelta** (A → B → A) **limpia las dos**: no queda ningún
cambio pendiente, y sin esa rama el panel diría "A → A".

#### Dónde se pide, y qué se le advierte

**Preferencias → Identidad de la inmobiliaria**, primer campo del formulario: el nombre es el dato
de identidad principal. Solo el admin.

**Validación** (`lib/utils/agencyName.ts`, compartida por el formulario y la action): no vacío,
**2 a 80 caracteres**, y normalización que **recorta bordes y colapsa espacios internos**.

⚠ **El colapso de espacios NO es cosmético**: `"Inmobiliaria  López"` y `"Inmobiliaria López"` son
el mismo nombre para una persona y dos strings distintos para una comparación — **y de esa
comparación depende que se detecte si el nombre cambió**. Sin normalizar, un espacio de más mandaría
la cuenta entera a revisión sin que nada haya cambiado.

⚠⚠ **NO HAY VALIDACIÓN DE UNICIDAD DEL NOMBRE, Y NO HAY QUE INVENTARLA.** Medido: sobre `agencies`
el único `UNIQUE` es el del `slug`; el nombre solo tiene `NOT NULL`, sin largo máximo y sin CHECK.
**Dos inmobiliarias pueden llamarse igual, y de hecho hay dos hoy** (dos filas con el nombre
"Inmobiliaria Gaio 2", medido). Inventar la restricción en el código rechazaría altas legítimas —dos
"López" de ciudades distintas— con un error que ninguna regla respalda, y encima no sería una
garantía: sin índice único, dos pedidos simultáneos entrarían igual.

**El aviso previo**, un `Notice` en tono `info` que aparece **al tipear un nombre distinto**:

> **Al guardar, tu cuenta vuelve a revisión**
>
> Vamos a verificar el nombre nuevo en el colegio de corredores. **Mientras tu cuenta está en
> revisión no se ve nada tuyo en público**: tus propiedades no aparecen en el mapa, sus fotos no se
> muestran, nadie puede mandarte una consulta desde ahí y tu sitio propio queda apagado. Tampoco vas
> a poder publicar propiedades nuevas.
>
> **No perdés nada** de lo que tengas cargado: tus propiedades, tus fotos y tus consultas quedan
> donde están, y todo vuelve a verse solo en cuanto te aprobemos.

⚠ **CUÁNDO APARECE es parte del diseño:** con la agencia **aprobada**, solo si el nombre difiere del
que rige —está funcionando y abrir Preferencias no le cambia nada, así que el aviso aparece en el
momento exacto en que empieza a ser cierto—; con la agencia **no aprobada**, siempre, porque ya está
en revisión. Mostrarlo siempre sería alarmar a alguien que todavía no pidió nada.

⚠ **Las CUATRO consecuencias no son una exageración**: `agency_is_publicly_visible()` exige
`approval_status = 'approved'`, y la invocan **las tres policies públicas** (`properties`,
`property_images`, `leads`) **más `resolveAgencyBySlug`**. Pedir un cambio de nombre **apaga las
cuatro cosas a la vez**, sin vencimiento y sin reversión automática. Una agencia podría pedirlo un
viernes creyendo que no pasa nada y quedar invisible todo el fin de semana.

#### Qué ve el dueño de la plataforma

En `/admin`, sobre una agencia `pending`, **dos señales en dos lugares distintos** —porque responden
dos preguntas distintas—:

- **`NameChangeBadge`**, junto al estado: **"CAMBIO DE NOMBRE"** en terracota sólido, con la fecha
  del pedido en el `title`. Es lo primero que necesita saber: *esto no es un alta*.
- **`PreviousNameLine`**, en la celda del **nombre**: *"Antes: ~~Inmobiliaria Gaio~~"*, tachado y en
  `graphite`. Va ahí y no en un tooltip porque **el dueño compara dos textos para decidir**.

Montado en las **dos vistas**, escritorio y celular. El badge de cambio de nombre **gana** sobre el
de reenvío (`ResubmissionBadge`): los dos dicen *"esta pendiente ya venía de antes"*, pero éste dice
además **qué cambió**.

#### ⚠ LAS TRES FORMAS DE RESOLVERLO, Y POR QUÉ EL RECHAZO SON DOS

| Acción | Qué escribe | Cuándo se ofrece |
|---|---|---|
| **Aprobar el nombre** | `approved`, limpia las dos columnas | hay cambio pendiente |
| **Rechazar el nombre** | `name` ← `previous_name`, `approved`, limpia las dos columnas | hay cambio pendiente **y** `ever_approved` |
| **Rechazar la inmobiliaria** | `rejected`, limpia las dos columnas | siempre que esté `pending` |

**Rechazar tenía un solo significado, y era el equivocado para este caso.** `rejectAgencyAction`
está diseñada para un alta que no corresponde: deja la agencia fuera, su sitio se apaga y sus
propiedades desaparecen del mapa. **Aplicado a una inmobiliaria que ya venía funcionando y pagando,
y cuyo único problema es el nombre que pidió, es desproporcionado.**

**Las dos son necesarias:** con solo la primera se pierde la capacidad de sacar a una agencia que se
cambió el nombre a algo que no corresponde de ninguna manera.

**El reparto en la interfaz sigue el criterio que el panel ya tiene** (DESIGN §12 — en la fila lo
que hace avanzar el flujo, en el menú `⋯` lo excepcional y destructivo):

```
fila  → "Aprobar el nombre" · "Rechazar el nombre"   (el caso normal)
menú  → "Rechazar la inmobiliaria"                   (el caso duro, en rojo)
```

⚠ **Para un alta nueva NO CAMBIA NADA**: `rejectName` es false y "Rechazar" sigue en la fila con su
texto y su rojo de siempre. Y `hasMenu` tuvo que aprender a contar el rechazo duro, o la acción
habría quedado **inalcanzable sin dar ninguna señal**.

⚠ **AL RECHAZAR EL NOMBRE NO SE REVIERTE… Y AL RECHAZAR LA AGENCIA TAMPOCO.** Son dos cosas
distintas y conviene no confundirlas:
- **Rechazar el nombre** SÍ revierte `name` ← `previous_name`: ése es su trabajo.
- **Rechazar la inmobiliaria** **conserva el nombre nuevo**. Mientras está `rejected` no se muestra
  en ningún lado (la primera condición de `agency_is_publicly_visible()`), así que el nombre sin
  aprobar no llega al público; y revertirlo en silencio le borraría lo que pidió, dejándola leer un
  motivo de rechazo sobre un nombre que ya no ve en ninguna pantalla.

⚠ **QUÉ REVIERTE Y QUÉ NO `rejectNameChangeAction`:** los cuatro campos del pedido de nombre
(`name`, las dos columnas, `approval_status`). **La MATRÍCULA no se toca**: no hay
`previous_license_number` del cual restaurarla, y sobre todo **esto rechaza el nombre, no la
matrícula** — si la agencia corrigió un tipeo en el mismo formulario, esa corrección es válida.

⚠ **El motivo se guarda en `agency_reviews` como `'rejected'`, con un PREFIJO FIJO.** Medido: el
CHECK de `decision` admite seis valores y **ninguno es específico de un rechazo de nombre**; agregar
uno es un cambio de base. El prefijo (`NAME_REJECTION_PREFIX`) es lo único que los separa, y la nota
lleva además **los dos nombres** — porque `previous_name` se limpia en ese mismo UPDATE y si no
quedaran ahí, qué nombre se rechazó no se podría reconstruir desde ninguna parte. La agencia lo lee
en Preferencias vía `getLatestNameRejectionNote`, **cuya vigencia se decide mirando la ÚLTIMA
decisión**, no buscando el último rechazo de nombre: si después hubo una aprobación, ese rechazo ya
se superó.

⚠ **Y el UPDATE del rechazo de nombre se traduce con `status: "approved"`**: mete la fila **dentro**
del predicado del índice parcial de matrícula, así que puede chocar con otra agencia aprobada de la
misma ciudad — exactamente como al aprobar.

### ⚠ Las guardas del cambio de nombre, y el alcance de cada una

**Son cuatro, y cada una existe por un motivo distinto. El alcance importa tanto como la regla.**

| # | Guarda | Dónde | Motivo |
|---|---|---|---|
| 1 | **La matrícula se congela al aprobar** | `updateAgencyIdentityAction` | Es el dato verificado contra el padrón. Cambiarlo no es revisar un nombre: es otra inmobiliaria |
| 2 | **Sin estar al día no se cambia el NOMBRE** | ídem, dentro de `if (nameChanged)` | Ver abajo |
| 3 | **Estando `pending`, el estado no se mueve** | ídem (`backToReview`) | Ya está en la cola: no hay nada que reenviar |
| 4 | **No se revierte un nombre sin cambio pendiente** | `rejectNameChangeAction` | Sin pedido abierto no hay nombre al que volver |

#### ⚠ La guarda de suscripción NO alcanza al logo ni a la dirección, y eso es deliberado

**El motivo no es disciplinario**, y por eso el alcance es el que es: lo que no corresponde hacer por
una cuenta dada de baja es **el trabajo de aprobación que un cambio de nombre le genera al dueño**.
El logo, la dirección del sitio y el teléfono **la agencia los resuelve sola, no le generan trabajo a
nadie**, y no hay ningún motivo para bloquearlos — están en **otras tres actions**, que nunca
tuvieron esta guarda (medido: cero menciones a `canceled`/`past_due` en las tres).

⚠ **Antes la guarda cubría la action entera**, con el argumento de que *"las dos viajan en el mismo
submit y las dos disparan el mismo reenvío"*. Dejó de ser cierto al congelarse la matrícula: con la
agencia aprobada, **lo único que puede disparar un reenvío desde ese formulario es el nombre**.

⚠ **Es LISTA NEGRA (`canceled`/`past_due`), nunca "distinto de `active`"**: `'pending'` significa
*"todavía no tenés nada activo"* y esa agencia está al día. **Y sin fila de suscripción tampoco
bloquea**: no le falta pagar, le falta una fila.

⚠ **Consecuencia asumida y escrita en el código:** una agencia **dada de baja Y sin aprobar** puede
corregir su matrícula, y eso la reenvía a la cola. Hueco chico y deliberado —el criterio es que la
guarda dispare cuando cambia el **nombre**— y el caso exige las dos condiciones juntas.

#### ⚠⚠ LA COMPARACIÓN QUE DECIDE SI EL NOMBRE CAMBIÓ VA CONTRA LA BASE, NUNCA CONTRA EL NAVEGADOR

```ts
const nameChanged = name !== agency.name;   // `agency` viene del SELECT, no del input
```

`agency.name` sale de la fila real, releída con service role en esa misma action. **Quien lo
"simplifique" —comparando contra un `initialName` que mande el formulario, o confiando en un flag
del cliente— abre un agujero**, y uno que no da síntoma: un cliente manipulado podría declarar que
el nombre no cambió y **saltearse la guarda de suscripción, la vuelta a revisión y el rastro de
`previous_name` a la vez**, quedándose con un nombre nuevo vigente que nadie revisó. Las tres cosas
cuelgan de esa única comparación.

Por el mismo motivo el `select` de esa action **nombra `name` y `previous_name` explícitamente**: es
una lista de columnas, y lo que no se nombra no llega.

### Página pública de la propiedad — `/propiedades/[slug]`

> Cada propiedad tiene su **dirección propia, renderizada en el servidor e indexable**. Antes toda la app pública era UNA sola dirección: el visitante abría un modal sobre el mapa, lo cerraba, y la barra de direcciones nunca cambiaba. Para un buscador la plataforma era una página sola, y una inmobiliaria que hablaba con un cliente fuera de Marka no tenía ningún enlace que mandarle.

- **Ruta: `src/app/(public)/propiedades/[slug]/page.tsx`** (Server Component, `params` es Promise → `await`). El identificador es `properties.slug`, que es `NOT NULL` + `UNIQUE` global (no parcial).
- **⚠ EL PREFIJO `/propiedades/` NO ES UNA PREFERENCIA DE ESTILO: EN EL PRIMER NIVEL NO ENTRA.** Ahí ya vive `src/app/(public)/[slug]/page.tsx`, el sitio de marca de una agencia, y **dos rutas dinámicas hermanas en el mismo nivel son ambiguas** — Next no las admite. (Es distinto del caso que ya estaba anotado en "White-label": una ruta **estática** de primer nivel sí convive con `[slug]`, porque las estáticas ganan. Dos dinámicas, no.)
- **El slug NO se regenera al editar**, y de eso depende que los enlaces compartidos sobrevivan. `generateSlug` se llama **una sola vez**, en `createPropertyAction`; `updatePropertyAction` no incluye la columna y lo dice (`// El slug no se recalcula al editar`). Verificado además en los datos: hay una fila con `slug = "casa-prueba2-taf8a3"` y `title = "casa prueba22"` — alguien editó el título y el slug se quedó.

#### Los tres estados, y dónde vive la decisión

Toda la lógica está en **`src/lib/utils/resolvePropertyBySlug.ts`**, no en la página — mismo rol y misma forma (unión discriminada) que `resolveAgencyBySlug`:

```ts
export type PropertyResolution =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "available"; property: PublicProperty };
```

| Estado | Cuándo | Qué hace la ruta |
|---|---|---|
| `not_found` | no existe ninguna propiedad con ese slug | `notFound()` → 404 real |
| `unavailable` | existe pero no se puede mostrar: `status <> 'active'`, **o** su agencia no está al día | renderiza `PropertyUnavailable` |
| `available` | pasa los dos gates | la página completa |

- **⚠ NO COLAPSAR `unavailable` EN `not_found`.** Quien llega casi siempre recibió el enlace de alguien —esa es la función que la página vino a cumplir—, y un 404 le diría que **el enlace estaba roto**. No lo está: la propiedad existió y, si estaba pausada, puede volver.
- **FALLA CERRADA:** si la consulta o el RPC fallan, se responde `unavailable`. ⚠ **Acá se separa de `resolveAgencyBySlug` a propósito:** aquel hace `if (error || !data) return { status: "not_found" }`, metiendo el error de lectura en la misma rama que "no existe". Acá no se puede: un error de lectura → `unavailable` (no sabemos nada, ante la duda la propiedad queda oculta) y **solo** la ausencia de fila → `not_found` (ahí sí sabemos: la base respondió y no hay nada).
- Está envuelto en **`cache()` de React** (mismo patrón que `resolveAgentSession`) porque la ruta lo llama **dos veces por request** —una en `generateMetadata` y otra en el render—: sin eso serían dos consultas y dos RPC. Por lo mismo **no recibe el client por parámetro**: lo crea adentro, o un client distinto por llamador rompería la deduplicación.

#### ⚠ POR QUÉ SERVICE ROLE Y NO EL CLIENT DE SERVIDOR CON SESIÓN

Los dos motivos están **medidos** y son los que gobiernan todo el diseño. No vuelven la alternativa "menos linda": la vuelven imposible.

**1. Con las policies, los tres estados son INDISTINGUIBLES.** `Public read active properties` es una sola condición —`status = 'active' AND agency_is_publicly_visible(agency_id)`—, así que una propiedad pausada, una de agencia que no paga y un slug inexistente devuelven **los tres la lista vacía**. Medido contra la API con la anon key:

```
asd-w6vx6j        activa, agencia en plan free  ->  []
asdsad-hewjr6     pausada, agencia al día       ->  []
casa-demo-s7jw5o  activa, agencia al día        ->  [{...}]
```

Con eso la página **solo podría hacer 404**, que es justo lo que el estado `unavailable` existe para evitar.

**2. El resultado dependería de QUIÉN MIRE.** Sobre `properties` hay **TRES policies de SELECT, las tres PERMISSIVE** (medido en `pg_policy.polpermissive`), y las permissive **se combinan con OR**:

| Policy | `qual` |
|---|---|
| `Public read active properties` | `status = 'active' AND agency_is_publicly_visible(agency_id)` |
| `Agency members read agency properties` | `agency_id IN (SELECT agency_id FROM agents WHERE id = auth.uid())` |
| `Agent manages own properties` (ALL) | `agent_id = auth.uid()` |

O sea que **un agente logueado de esa agencia entraría por la segunda y vería PUBLICADA una propiedad que para el resto del mundo no lo está**. La página le mentiría sobre su propio estado justo a quien la administra — y es el caso más probable de todos: el agente que acaba de pausar una propiedad y abre su enlace para ver cómo quedó.

Con service role el resultado es **idéntico para todos**: visitante anónimo, buscador y el propio agente.

**⚠ Y el precio de ese service role es que la regla de cobro hay que invocarla A MANO**, porque saltea las policies: ninguna de las tres la aplica acá. Sin la llamada, esta página quedaría en pie mostrando las propiedades de agencias que dejaron de pagar. Es el mismo riesgo, con la misma mitigación, que `resolveAgencyBySlug`.

#### ⚠ LA REGLA DE COBRO SE PREGUNTA A LA BASE POR RPC, NO SE REESCRIBE

```ts
  const { data, error } = await supabase.rpc("agency_is_publicly_visible", {
    target_agency_id: agencyId,
  });
  if (error) return false;   // falla cerrada
  return data === true;
```

Replicar las tres condiciones en TypeScript dejaría **la regla de cobro escrita en TRES lugares** (las policies, el sitio de marca y esta página): el día que cambie —por ejemplo si un `past_due` pasara a tener período de gracia— dirían cosas distintas y nadie se enteraría hasta que un cliente lo reportara. Se paga un viaje extra a la base a cambio de que la regla tenga un solo lugar donde vive.

#### Qué muestra, y las dos cosas que la separan del modal

Orden: fotos → tipo y operaciones → título → **precios** → ubicación → métricas → descripción → comodidades → requisitos de alquiler → quién publica → contacto por WhatsApp → compartir → mapa estático → vuelta al mapa general. El detalle visual está en `DESIGN.md` §5.

- **Todo se renderiza en el servidor.** Solo bajan como isla de cliente las dos piezas que necesitan estado: `PropertyContact` (el flujo de WhatsApp) y `ShareButton`.
- **⚠ La galería NO es el carrusel del modal, y no debe serlo.** Aquel guarda la foto activa en un `useState` y apila el resto con `opacity-0`: para un buscador **existe UNA sola foto**. `PropertyGallery` es un Server Component con `scroll-snap` de CSS y **cero JavaScript**: las N fotos están en el documento con su `alt`.
- **⚠ La descripción va COMPLETA, sin `line-clamp` y sin "Ver más".** En el modal se recorta con estado de cliente; acá el texto entero tiene que estar en el HTML, porque es justamente lo que un buscador lee.
- **El mapa del pie es ESTÁTICO** (`StaticMap`): una grilla de 4×2 tiles de OSM en `<img>` corrida con CSS para centrar el punto, con el pin encima y la atribución. Cero JS, cero Leaflet. Usa `TILE_CONFIG`, así que si el proyecto migra a MapTiler este mapa migra con el grande. **No se reusó `LocationPicker`**: se monta con `ssr: false`, o sea que un buscador ve un recuadro vacío y la página arrastraría Leaflet entero.
- **`generateMetadata`** arma título, descripción corta (tipo, operaciones, precio, ubicación y métricas) y `openGraph` con **la foto de portada real** de la propiedad. ⚠ Los estados `not_found` y `unavailable` salen con **`robots: { index: false }`**: no es redundante con el mapa del sitio —aquel decide qué se *ofrece*, esto decide qué pasa cuando el buscador llega igual, por un enlace ya indexado.

### Quién publica — el bloque de la agencia y el agente

En el **modal** y en la **página**, en la zona de contacto. Antes el visitante veía fotos, precio y un botón verde, y con eso tenía que decidir si le escribía a un número desconocido. Argumento comercial: *"tu marca aparece en cada propiedad que publicás, no solo en tu web"*.

- **Muestra tres cosas: el logo de la agencia, el nombre de la agencia y el nombre del agente** ("Atiende Juan Pérez"). **SIN foto del agente**, aunque la consulta traiga `avatar_url`: es una decisión de producto, no un olvido.
- **⚠ SI LA AGENCIA NO TIENE LOGO, EL NOMBRE OCUPA SU LUGAR.** Sin hueco, sin caja vacía y sin ningún cartel que anuncie la ausencia (a diferencia de la preview de `AgencyLogoForm`, que sí dice "Sin logo" porque ahí estás por subir un archivo). **Es el caso NORMAL, no el borde: medido, 1 de 10 agencias tiene logo cargado.** Un diseño que solo se vea bien con logo se va a ver mal casi siempre. Dimensiones tomadas del header del sitio de marca (`h-8 w-auto max-w-[96px] object-contain` en el modal, `h-10` en la página): altura fija, ancho según la relación de aspecto, tolera cualquier proporción.
- **⚠ EL NOMBRE DE LA AGENCIA NO ES UN ENLACE.** Solo algunos planes tienen sitio propio, y ese sitio se puede deshabilitar por **tres** motivos independientes (ver `resolveAgencyBySlug`), así que el enlace llevaría a veces a una página de "no disponible". Un nombre que a veces lleva a algún lado y a veces no es una inconsistencia que el visitante ve.
- **⚠ VA HERMANO DEL CONDICIONAL QUE ELIGE EL BOTÓN, NO DENTRO DE UNA DE SUS RAMAS.** El ternario elige entre "se puede contactar" y "el agente no cargó su número", y el bloque tiene que verse en **las dos**: la agencia cuyo agente no dejó teléfono es justamente de la que el visitante más necesita saber quién es, porque va a tener que buscarla por otro lado.
- **El dato viene EMBEBIDO en la consulta que el modal ya hace** (`agency:agencies(name, logo_url)`), no en una consulta aparte: la segunda necesitaría el `agency_id` que sale de la primera, así que sería secuencial y el bloque aparecería después de que el resto ya está pintado. **La consulta del mapa NO se tocó** (query caliente).
- **⚠ SE NOMBRAN SOLO LAS DOS COLUMNAS QUE SE USAN.** `Public read agencies` tiene `qual: true`, o sea que cualquiera con la anon key puede leer esa tabla entera, y Postgres no permite restringir columnas dentro de una policy: **lo único que acota qué se expone es la lista del `select`**. Ahí viven `phone_wa`, `license_number` y `approval_status`.
- **⚠ NO USAR EL TIPO COMPLETO `Agency` PARA EL EMBED.** `Property.agency` está declarado como `Agency` entero (doce columnas) y el resultado se castea por `unknown`, así que tiparlo así haría creer al compilador que están las doce: leer `agency.license_number` compilaría sin una queja y daría `undefined` en runtime. Se usa un **cast local al subconjunto real**, el mismo molde que el archivo ya usaba para el agente. En la página, `PublicProperty` hace lo mismo con un `Omit`.

### Las dos puertas a la ficha, y por qué son distintas

Se construyó la página y **no la puerta**: durante un tiempo solo se llegaba escribiendo la dirección a mano. Hay **dos** entradas, y son deliberadamente distintas porque el contexto lo es.

| Dónde | Qué es | Por qué |
|---|---|---|
| **Modal** | un **botón** con texto explícito, "Ver ficha completa", sobre la foto abajo a la izquierda | El modal vive **sobre el mapa**, donde el visitante está explorando |
| **Tarjeta de la lista** | el **título** como enlace | En la lista el visitante está **leyendo**, y el título como enlace es lo que espera |

- **⚠ EN EL MODAL EL TÍTULO NO ES ENLACE, A PROPÓSITO.** Sobre el mapa, un título clickeable **se toca por accidente** y saca al visitante del mapa sin que lo haya pedido. Un botón con texto explícito no tiene esa ambigüedad.
- **⚠ Y EL BOTÓN NO VA EN LA ZONA INFERIOR DEL MODAL**, aunque sea el lugar "natural" de un CTA. Ver "El presupuesto de alto de la zona inferior" abajo: ahí cuesta 54 px que salen enteros del área que scrollea. Sobre la foto es `absolute` y cuesta **cero**.

### El encabezado público — tres variantes, y la puerta de captación

> Hasta el 10 sep 2026 el encabezado público ofrecía **un solo enlace, que decía "Ingresar"**, sin decir para quién era. El visitante común no tiene por qué saber que la plataforma **no tiene cuentas de particular**, así que ese enlace le prometía algo que no existe —favoritos sincronizados, búsquedas guardadas— y lo llevaba a un login donde no puede hacer nada. Y del otro lado quedaba desaprovechada la oportunidad más grande: alguien de una inmobiliaria mirando el mapa de su ciudad es **exactamente el cliente que la plataforma busca**, y no había **una sola línea de la interfaz que le hablara** — medido por barrido, las únicas apariciones de la palabra "inmobiliaria" en toda la superficie pública eran comentarios de código.

Hay **TRES superficies públicas, cada una con su encabezado, y son distintos a propósito**:

| Superficie | Dónde vive el encabezado | Qué ofrece |
|---|---|---|
| **Home del mapa** (`/`) | `PublicHeader`, definido en `(public)/page.tsx` | Wordmark · `CityPicker` · **captación + ingreso** |
| **Sitio de marca** (`/[slug]`) | `AgencyMapView.tsx` | logo/nombre de la agencia · nombre · **solo "Ingresar"** |
| **Ficha de propiedad** (`/propiedades/[slug]`) | la propia página | Wordmark · **"← Volver al mapa"**, y nada más |

#### La home: dos enlaces, y uno se cae en pantalla chica

| Enlace | Destino | Tratamiento | `< sm` (640 px) | `≥ sm` |
|---|---|---|---|---|
| **"Sumá tu inmobiliaria"** | `/register` | botón **secundario** de DESIGN §6: `h-9`, `border-stone`, texto `black`, hover `bg-mist` | **oculto** | visible |
| **"Iniciar sesión"** | `/login` | **ghost**: texto `graphite` → hover `black`, sin caja ni borde | visible | visible |
| **"Ir al panel"** (con sesión) | `/dashboard` | ghost | visible | visible |

- **La jerarquía entre los dos no la da el color: la da la caja.** Uno tiene borde y padding, el otro es texto pelado.
- **⚠ EL LLAMADO NO ES TERRACOTA, Y NO ES UN DESCUIDO.** En esa pantalla el terracota ya está tomado por el FAB "Ver lista / Ver mapa", que es la acción principal **del visitante** — y el visitante es el 99 % del tráfico. Dos elementos terracota compitiendo confunden cuál es el paso siguiente: es el mismo criterio, con las mismas palabras, que DESIGN §11 aplica a los dos botones del `LocationPicker`. El llamado a sumarse es una **puerta lateral**, no el paso siguiente de quien está mirando el mapa.
- **⚠ POR DEBAJO DE `sm` EL QUE SE CAE ES EL LLAMADO, NO EL INGRESO, y el criterio es de PRODUCTO.** Los cuatro elementos no entran en un teléfono (ver los anchos medidos abajo), así que hay que sacar uno. **El ingreso es la función que un cliente usa todos los días** y el celular es donde más se navega: esconderlo ahí le agrega un paso a quien ya paga para ganar una conversión eventual de quien todavía no. ⚠ **Consecuencia asumida: en un teléfono la captación NO SE VE EN NINGÚN LADO** — no se movió a otro lugar, no está. Es deuda abierta a propósito (PENDIENTES.md).

#### ⚠ Por qué en el SITIO DE MARCA no va la captación — es comercial, no una excepción de layout

`AgencyMapView` consume la variante `agency`, que renderiza **"Ingresar" → `/login` y nada más**, con el texto y el destino de siempre.

**Ese sitio es literalmente lo que la agencia compra con su plan** (el entitlement `has_white_label`, que se vende en profesional y premium). Y el modelo es un **marketplace POR CIUDAD**, así que un llamado a "sumá tu inmobiliaria" ahí estaría **usando el espacio que paga un cliente para captar a su competencia directa, de su misma ciudad**. Le daría un argumento fácil y perfectamente articulable para no renovar: *"pago para tener mi propia web y me ponen un cartel invitando a la inmobiliaria de la esquina"*.

Es coherente con lo que ese encabezado ya decidió en otro lado: la marca que se muestra es la de la agencia y no el Wordmark de Marka, que queda como un "Powered by" deliberadamente discreto al pie. **No unificar las dos variantes "por prolijidad".**

#### ⚠ Por qué en la FICHA DE PROPIEDAD tampoco va, POR AHORA

Su encabezado no ofrece ninguna entrada al área privada: Wordmark + "← Volver al mapa", los dos a `/`.

Dos motivos:

1. **Quien llega ahí está buscando una casa**, no una plataforma para publicar. Es la superficie del tráfico frío de buscadores, y un llamado de captación competiría con el botón de WhatsApp, que es el paso final de esa pantalla.
2. **⚠ Es un Server Component y existe para renderizarse entero en el servidor** — es la restricción que gobierna toda esa página. Un llamado que dependa de si hay sesión **obligaría a estrenar una isla de cliente** ahí, contra su razón de ser. Y uno que no dependa de la sesión le mostraría "Sumá tu inmobiliaria" a un agente logueado.

Cuando exista la pantalla de venta —deliberadamente fuera de alcance— ese va a ser el lugar natural para el tráfico frío.

#### El componente compartido: `src/components/auth/PublicHeaderAuth.tsx`

```ts
variant: "marketplace" | "agency"
```

Una sola prop, obligatoria y cerrada a dos literales: **no hay default**, así que un consumidor nuevo está forzado a decidir explícitamente si su pantalla lleva captación. Esa es justamente la decisión que no puede tomarse por descuido.

**⚠ EXISTE PORQUE ANTES ERAN DOS COPIAS Y YA HABÍAN DIVERGIDO.** El enlace estaba escrito a mano en `(public)/page.tsx` y en `AgencyMapView.tsx`, y **el bloque de detección de sesión estaba duplicado carácter por carácter** (`useState(false)` + `useEffect` + `createClient()` + `getUser()`). Una de las dos copias tenía `shrink-0` y la otra no: mientras el texto fue "Ingresar" (ocho caracteres) esa diferencia no se notó, y **dejaba de no notarse exactamente con el texto nuevo**, que es tres veces más largo.

Es el mismo patrón que el proyecto ya se cobró dos veces (`AgenciesTable`, con las condiciones de fila escritas dos veces y desincronizadas; y `AgentCell`, que se centralizó **por ese precedente**). **La detección de sesión vive ahí y en ningún otro lado**, y eso es lo que vuelve imposible una tercera copia: quien mañana necesite la puerta en otra pantalla no tiene el bloque a mano para copiar, tiene un componente para importar.

#### ⚠ TRAMPA 1 — el mecanismo que apaga el salto de layout

El texto depende de si hay sesión, y eso se sabe **después del primer pintado** (`isAuthed` arranca en `false` y un efecto de cliente lo corrige). Sin mitigación, el bloque se encogería al resolverse: **medido, 195,2 px en `sm`+ y 22,7 px por debajo**, en el elemento más prominente del encabezado, en cada carga, para todo cliente que paga.

**La solución es de CSS y no de datos: los DOS estados se renderizan siempre, apilados en la MISMA celda de una grilla de 1×1** (`grid` + `col-start-1 row-start-1` en las dos ramas). El ancho del contenedor es el del más ancho de los dos, **estable desde el primer pintado**, y cambiar de estado solo alterna cuál se ve.

**⚠ LA RAMA INACTIVA SE APAGA CON `invisible` (`visibility: hidden`), NUNCA CON `hidden` (`display: none`), Y ESA ES TODA LA MECÁNICA.** El que no se ve **tiene que seguir ocupando su celda**: es lo que hace que la grilla mida el máximo. `display: none` lo sacaría del cálculo y el ancho volvería a depender de la sesión, o sea que **la "limpieza" obvia reintroduce exactamente el salto que esto existe para apagar**. De paso, `visibility: hidden` saca el subárbol del orden de tabulación y del árbol de accesibilidad, así que el enlace apagado no es enfocable ni lo anuncia un lector de pantalla.

**⚠ Corolario para cualquier cambio futuro de qué se oculta por tamaño de pantalla:** lo que se apaga por breakpoint es **un enlace de adentro** de una rama (`hidden sm:inline-flex` sobre el `<a href="/register">`), **nunca una rama entera**. Sacar una rama del documento devuelve el ancho a depender de la sesión. Se verificó sobre el HTML emitido por el build que las dos ramas siguen siendo hermanas en la celda `1/1` y que ninguna lleva `hidden`.

**Lo que NO se apagó, y es honesto decirlo:** queda el cambio de **texto**, dentro de una caja que ya no se mueve. Apagarlo del todo exigiría conocer la sesión en el primer pintado, o sea volver **dinámica** la home (hoy `○ Static` en el build) — renderizar en cada request la pantalla más visitada del producto por un parpadeo que solo ven los agentes.

#### ⚠ TRAMPA 2 — las guardas de ancho del encabezado de la home

Son tres slots en `justify-between` dentro de 56 px de alto, y **el del medio es el único que cede**:

| Guarda | Dónde | Contra qué protege |
|---|---|---|
| `gap-3` | el `<header>` | que los slots se toquen al apretarse |
| `shrink-0` | el `<Link>` del Wordmark | que la marca se deforme |
| `shrink-0` | la raíz de `PublicHeaderAuth` | que la puerta se achique o se parta |
| `min-w-0` | el contenedor del `CityPicker` | **un item de flex no puede achicarse por debajo de su contenido sin esto**, así que empujaría al resto fuera |
| `truncate` | el nombre de la ciudad | que un nombre largo desborde |

**⚠ SIN ESAS GUARDAS EL FALLO ES SILENCIOSO:** lo que desborda **lo recorta el `overflow-hidden` del contenedor raíz**. No aparece una barra de scroll, no hay error, no hay síntoma — solo texto cortado o partido en dos líneas, visible únicamente en un teléfono.

**El encabezado del sitio de marca tenía las cinco y el de la home NO tenía NINGUNA.** O sea que el problema ya estaba resuelto, en el archivo equivocado. Esta pieza lo trasplantó.

**⚠ Y EL CASO MÁXIMO ES EL CASO NORMAL: la única ciudad activa de la base es "Santiago del Estero", diecinueve caracteres** — o sea, también la más larga. No hay un caso benigno que sirva de referencia.

#### ⚠ TRAMPA 3 — el nombre de la ciudad iba SUELTO, y por eso no se podía recortar

El arreglo del `CityPicker` fue **envolver el nombre en su propio `<span className="truncate">`**, no agregarle una clase a algo. La causa es específica: el nombre era un **nodo de texto pelado dentro de un contenedor flex**, y eso lo convierte en un **item anónimo**, al que **no se le puede aplicar ninguna clase**. No es que faltara `truncate`: no había dónde ponerlo. Sin envoltorio, "Santiago del Estero" se partía en **dos líneas dentro de un encabezado de alto fijo** (`h-14`).

Van además `w-full` en el disparador (para que ocupe el ancho que le concedan) y `shrink-0` en el chevron, para que lo que se recorte sea el nombre y no el indicador de que hay un desplegable.

#### Los anchos MEDIDOS, y el umbral del nombre de la ciudad

> **No son estimaciones.** Se cargaron con `fontkit` los `.woff2` que sirve el build (`.next/static/media`) y, como son **fuentes variables** que `fontkit` no puede instanciar en esos subconjuntos, se aplicó la variación de peso a mano: normalización del eje `wght` → tabla `avar` → deltas de `HVAR`, más el kerning del layout base.

DM Sans 500 a 14 px; Noto Serif 700 a 24 px con `tracking-[-0.01em]`:

| Texto / slot | Ancho |
|---|---|
| "Marka." (marca) | **85,1 px** |
| "Santiago del Estero" | 126,7 px → **slot 148,7 px** (+ `gap-1.5` 6 + chevron 16) |
| "Iniciar sesión" | **86,1 px** |
| "Ir al panel" | **63,4 px** |
| "Sumá tu inmobiliaria" | 134,5 px → **botón 160,5 px** (+ `px-3` 24 + borde 2) |
| "Ingresar" (variante `agency`) | 53,2 px |
| Puerta `< sm` = `máx(86,1 · 63,4)` | **86,1 px** |
| Puerta `≥ sm` = `máx(160,5 + 12 + 86,1 · 63,4)` | **258,6 px** |

**⚠ EL NÚMERO QUE HAY QUE TENER A MANO ANTES DE AGREGARLE NADA AL ENCABEZADO: desde 376 px de viewport el nombre de la ciudad entra completo; por debajo se recorta con puntos suspensivos.** En un teléfono de 375 px con `px-4` quedan 343 px útiles, de los cuales marca + puerta + dos `gap-3` se llevan 195,2 y al selector le quedan **147,8 contra los 148,7 que necesita: falta menos de un píxel**. A 360 px faltan 15,9 y a 320 px faltan 55,9.

**El presupuesto es ese y no hay más:** el mapa ocupa todo lo que queda (`h-dvh` + lock de scroll del documento), así que **no existe ningún lugar "abajo" donde poner nada** — estos 56 px son todo el chrome de la home.

Contexto para dimensionar: con el reparto anterior de esta misma pieza —cuando el que quedaba en pantalla chica era el llamado y no el ingreso— ese umbral estaba en **451 px**, o sea que **ningún teléfono mostraba el nombre entero**.

### Infraestructura de buscadores

- **`src/app/sitemap.ts` → `/sitemap.xml`.** Convención de archivo de Next: función por defecto que devuelve `MetadataRoute.Sitemap`.
  - **⚠ LLEVA `export const dynamic = "force-dynamic"` Y SIN ESO SE CONGELA AL CONSTRUIR.** La documentación lo dice: *"`sitemap.js` is a special Route Handler that is **cached by default** unless it uses a Request-time API or dynamic config option"*. Por omisión, la consulta correría una vez durante `next build` y el archivo serviría para siempre la lista de ese día: las propiedades nuevas invisibles y las dadas de baja todavía ofrecidas. Se comprueba en el build: `/sitemap.xml` tiene que figurar como **`ƒ` (Dynamic)**; si sale `○`, quedó cacheado.
  - **⚠ APLICA EXACTAMENTE EL MISMO CRITERIO QUE LA PÁGINA**, y el segundo gate **con la misma función de la base**: `.eq("status", "active")` + `agency_is_publicly_visible` por RPC. Si listara propiedades que la página no muestra, un buscador indexaría carteles de "ya no está publicada" — peor que no listarlas, porque el resultado existe, se puede clickear y no sirve. El RPC se hace **una vez por agencia distinta**, no una por propiedad. Falla cerrada en los dos lugares.
  - **⚠ EL `lastModified` DE CADA FICHA ES `properties.updated_at`** (`sitemap.ts:111`), y por eso **contar una visita NO puede moverlo**: sería decirle al buscador que la propiedad cambió cuando solo cambió un contador, y con el tiempo le enseña que las fechas del sitio no significan nada. Lo impide una guarda en la base, acoplada entre dos funciones: ver "Base de Datos" → la guarda de `updated_at`. ⚠ Medido el 14 sep 2026: **7 propiedades de prueba ya tienen la fecha movida** por visitas contadas antes de la guarda (ver PENDIENTES.md).
- **`src/app/robots.ts` → `/robots.txt`.** `Allow: /`, `Disallow` de `/dashboard`, `/admin` y `/api/`, más la declaración del mapa del sitio. **NO lleva `force-dynamic` y es correcto**: su contenido es fijo y no lee la base, así que no hay lista que pueda quedar vieja. ⚠ No usar el campo `other` de `MetadataRoute.Robots`: se agregó en Next **16.3.0** y el proyecto corre **16.2.6**.
- **`metadataBase` en la disposición raíz** (`src/app/layout.tsx`), desde `NEXT_PUBLIC_SITE_URL`. **⚠ Sin él, usar una ruta relativa en cualquier campo de metadata basado en URL ROMPE LA CONSTRUCCIÓN**: *"Using a relative path in a URL-based metadata field without configuring a `metadataBase` will cause a build error"*. El `title` pasó de una cadena suelta a `{ default, template: "%s · Marka" }`, para que el título de la propiedad no borre la marca.
- **No hay `opengraph-image`**, y es deliberado: la vista previa usa **la foto de portada real** de la propiedad, que ya es una URL absoluta del bucket. Generar una imagen habría sumado una ruta, tiempo de build y otra fuente de verdad para mostrar algo peor que la foto de la casa.

### Viewport mobile — altura y lock de scroll
- **Wrappers de pantalla completa van con `h-dvh`/`min-h-dvh`, NUNCA `h-screen`/`100vh`.** `100vh` en mobile es el viewport grande (ignora la barra de URL), lo que dejaba el documento scrolleable por ese hueco; cualquier "scroll into view" del navegador (foco en un anchor de zoom de Leaflet, o en un input que abre el teclado) desplazaba el documento y sacaba el header (que está en flujo normal) fuera de vista, sin restituirlo. `dvh` sigue a la barra de URL y no deja hueco.
- **El documento tiene lock de scroll:** `globals.css` fija `html, body { height: 100%; overflow: hidden }`. Toda la app scrollea en **contenedores internos** (el `main` del dashboard con `overflow-y-auto`, la lista mobile, el cuerpo de los sheets), nunca el documento. Si creás una pantalla nueva, dale su propio contenedor scrolleable interno — NO dependas del scroll del documento.

#### ⚠ TRAMPA 1 — ESTA REGLA YA ESTABA ESCRITA Y AUN ASÍ SE INCUMPLIÓ

La página pública de la propiedad nació con `min-h-dvh` y **sin contenedor propio**. Resultado: el contenido estaba en el documento pero era **INALCANZABLE** de la mitad para abajo — ni el bloque de contacto, ni el mapa, ni el pie. No aparece una barra de scroll rota ni un error: simplemente **no hay forma de llegar**.

**El error específico, para reconocerlo:**

| | Qué hace |
|---|---|
| ❌ `min-h-dvh` | Es un **mínimo**: deja crecer el elemento más allá del viewport y **delega el scroll al documento**… que no scrollea |
| ✅ `h-dvh overflow-y-auto` | Fija una pantalla y le da **su propio scroll adentro** |

**La forma exacta que funciona** es la de `AuthLayout.tsx:20`, la otra pantalla que dependía del scroll del documento:

```tsx
<div className="flex h-dvh flex-col overflow-y-auto bg-paper …">
```

**Y si la pantalla además centra su contenido** (los estados "no disponible"), son **dos** elementos, cada uno con su trabajo — el de adentro lleva `min-h-full`, **nunca `min-h-dvh`**, que volvería a delegar al documento:

```tsx
<div className="h-dvh overflow-y-auto bg-paper">
  <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
```

⚠ **Que el contenido "entre sin scrollear" no es una excusa para omitirlo.** Alcanza un teléfono chico en horizontal, o el tamaño de letra del navegador subido, para que el único botón de la pantalla quede fuera. Hay al menos **dos pantallas del proyecto todavía así** (ver PENDIENTES.md).

#### ⚠ TRAMPA 2 — EL PRESUPUESTO DE ALTO DE LA ZONA INFERIOR DEL MODAL

El bottom sheet de celular tiene **alto FIJO** (`h-[85dvh]`, antes `h-[82vh]`), el carrusel es `shrink-0` y la zona inferior también: **el único que cede es el cuerpo**. O sea que **cada píxel que se le agrega a la zona inferior se lo resta al área que scrollea**.

Zona inferior hoy, con el input de nombre colapsado: `py-4`×2 (32) + borde (1) + bloque "quién publica" (32,5) + `space-y-2.5` (10) + input colapsado (0) + `space-y-2.5` (10) + botón `h-11` (44) = **129,5 px**.

En un iPhone SE (375×667), con el `82vh` de entonces = 546,9 px (con `85dvh` sobre 667 px de alto dinámico serían ≈ 20 px más: cálculo, no medición; ver "Las hojas que suben desde abajo"):

| | Área que scrollea |
|---|---|
| **Hoy** | 546,9 − 20 (handle) − 220 (carrusel) − 129,5 = **≈ 177 px** |
| Con un botón de ancho completo más (44 + 10) | **≈ 123 px** — menos de dos párrafos |

**177 px es contra lo que juega quien quiera agregar algo ahí.** Por eso el botón "Ver ficha completa" y el de compartir viven **sobre la foto**: los cuatro botones flotantes son `absolute` sobre el carrusel y cuestan **cero**. Es el lugar al que hay que mirar primero.

#### ⚠ TRAMPA 3 — LA TARJETA TIENE UN ENLACE ADENTRO DE ALGO CLICKEABLE

`PropertyCard` es un `<article role="button" tabIndex={0} onClick={onSelect}>`: **el click vive en el contenedor**. Desde que el título es un `<Link>` a la ficha, tocarlo dispararía **las dos cosas** — navegar **y** abrir el modal.

**La solución tiene DOS partes porque son dos problemas distintos, y quedarse en la primera es el error fácil:**

| | Problema | Cómo se corta |
|---|---|---|
| **Puntero** | el click burbujea al `<article>` | `onClick={(e) => e.stopPropagation()}` en el `<Link>` — el mismo recurso que ya usaba el botón de favorito |
| **Teclado** | `stopPropagation` del `onClick` **NO cubre el teclado**: un Enter sobre el enlace lo activa **y además** burbujea al `onKeyDown` del contenedor | `if (e.target !== e.currentTarget) return;` como primera línea del `onKeyDown` del `<article>` |

La guarda va **en el contenedor y no en cada hijo**: cubre a todos de una vez, presentes y futuros. (De paso cerró el mismo defecto que el botón de favorito tenía desde antes, sin que nadie lo hubiera notado.)

El `<Link>` lleva además `relative z-10`: sin eso, el enlace y el fondo de la tarjeta se pelean el mismo punto y el resultado depende del orden de pintado.

⚠ **`PropertyCardData` incluye `slug` desde entonces.** No hubo que tocar ninguna consulta: `useProperties` ya lo traía en su SELECT acotado.

⚠ **Deuda conocida y anotada:** un `<a>` dentro de un `role="button"` no es estrictamente válido. El componente **ya era así** (el botón de favorito está en la misma situación) y arreglarlo de raíz es decidir si la tarjeta sigue siendo un botón o pasa a ser un contenedor con enlace principal. Ver PENDIENTES.md.
- Tailwind v4 trae `h-dvh`/`min-h-dvh` nativas (no hace falta el arbitrario `h-[100dvh]`).
- Los `fixed`/`sticky` (bottom sheets, FABs, marco editorial, sidebar mobile) se reanclan bien y NO se tocan; el problema era solo el chrome en flujo normal sobre wrappers `100vh`.

### El panel en celular — `DashboardShell` + `Sidebar` (16 sep 2026)

- **`src/components/dashboard/DashboardShell.tsx`** (Server Component) es la estructura que usan `dashboard/layout.tsx` y `admin/layout.tsx`: `flex h-dvh flex-col … md:flex-row`, con `<main className="relative flex-1 min-h-0 overflow-y-auto">`. **Columna en celular, fila en escritorio.** Ya **no hay `pt-14`**: antes el botón de menú era `fixed` y el contenido pasaba por debajo al scrollear.
- **`Sidebar` en celular: barra superior EN EL FLUJO** (`h-14`, negra, botón de menú de 44 px + `Wordmark` claro). El `min-h-0` del `main` es lo que lo deja scrollear en la columna.
- **El cajón:** cierra con **Escape** y **al cambiar de ruta** (estado derivado durante el render: se compara `pathname` contra el último renderizado, sin efecto); cerrado es **`inert`**; al cerrar con ✕ o Escape **el foco vuelve al botón de menú**; el botón lleva `aria-expanded`/`aria-controls`; la ✕ tiene área de toque de 44 px (`after:-inset-2`).

#### ⚠ TRAMPA — Los paneles de Leaflet se pintan encima del cajón

Leaflet pone `z-index` propios a sus capas (400/401, y el botón "Centrar" 500), y sin un contexto de apilamiento **escapan al contexto raíz y se pintaban encima del cajón y del velo** del menú en celular (bug encontrado al hacer esta pieza). `LocationPicker` lo corta con **`isolate`** en el contenedor del mapa. **Todo mapa nuevo dentro del panel necesita `isolate`.**

### El campo con caja — UNA definición, en `src/components/forms/fieldStyles.ts`

Hay **dos familias de campo y las dos son deliberadas**:

| | **SUBRAYADO** | **CAJA** |
|---|---|---|
| Dónde | inicio de sesión y registro | todo el panel: perfil, preferencias, equipo, propiedades, `/admin` |
| Forma | solo borde inferior, **0 px de relleno**, fondo transparente | cuatro bordes, `rounded-md`, **12 px** de relleno, fondo blanco |
| Origen | el estilo de fábrica de `Input`, `Textarea` y `SelectTrigger` | definición propia |

El relleno cero del subrayado **no es un olvido**: alinea el texto con su etiqueta y con el enlace "Volver al mapa", que comparten ese eje (DESIGN §14).

**La caja vive en un solo lugar** (`FIELD_BOX`, `FIELD_BOX_ERROR`, `FIELD_UNDERLINE_ERROR` y el juego `FIELD_BOX_GROUP*` para los campos con prefijo). **No escribirla a mano en una pantalla.**

#### ⚠ POR QUÉ SON CONSTANTES Y NO UNA VARIANTE DEL COMPONENTE

Dos motivos, y los dos son estructurales:

1. **La misma caja tiene que vestir cosas que NO son un `<input>`:** el **contenedor** de un campo con prefijo fijo (el teléfono, la dirección del sitio de marca), donde la caja la dibuja un `<div>` y el input va adentro sin borde ni fondo. **Una variante de `Input` no llega ahí.**
2. **Los tres componentes de fábrica** (`Input`, `Textarea`, `SelectTrigger`) consumen la misma clase, así que un solo lugar alcanza para los tres.

#### ⚠⚠ LA TRAMPA QUE LA HIZO NECESARIA — VA A VOLVER A PASAR

**`cn` combina clases con `tailwind-merge`, que resuelve conflictos quedándose con la última clase de cada grupo. Y `border-stone` —un color de los CUATRO lados— es del mismo grupo que `border-transparent` y `border-b-input`, así que LOS ELIMINA.**

Qué producía, en las pantallas que le pasaban al campo subrayado solo un color de borde:

```
Input (subrayado)  :  border-transparent  border-b-input  px-0
   + className     :  border-stone
   = tailwind-merge:  border-stone                        px-0
                      ↑ cuatro bordes                     ↑ relleno del subrayado
```

O sea **una caja de cuatro lados con el relleno cero del subrayado**: el texto pegado al borde (medido: 0 px) y **sin anillo de foco**, porque `focus-visible:ring-terracota` sin `ring-2` da un color de anillo sin ancho y no dibuja nada. **Nadie escribió esa caja: la produjo el combinador.** No aparece en ningún archivo y por eso nadie la encontraba leyendo.

**Las dos consecuencias que hay que respetar al tocar esto:**

- **`FIELD_UNDERLINE_ERROR` colorea SOLO el borde inferior.** Pasarle `border-error` —el color de los cuatro lados— dispara exactamente el mismo conflicto: el subrayado se convertía en **una caja roja sin relleno justo cuando había un error**, y el texto se corría respecto de la etiqueta.
- **`aria-invalid:border-b-error` no es redundante.** Los componentes de fábrica traen `aria-invalid:border-b-destructive`, que **pesa más** (lleva un selector de atributo), así que en un campo con `aria-invalid` el subrayado salía con el rojo del preset y no con el `error` del proyecto. Nombrarla hace que `tailwind-merge` descarte la de fábrica.

⚠ **La regla general, que vale para cualquier componente del preset:** pasarle por `className` una clase del **mismo grupo** que una que el componente ya trae **no la agrega: la reemplaza**, y se lleva puestas a sus hermanas de grupo. Ante un estilo que "no se aplica" o que aparece de la nada, mirar primero qué clase se está pisando.

### Las hojas que suben desde abajo

Son **DOS**: la de **filtros** (`FilterPanel.tsx`) y la del **detalle de propiedad** (`PropertyModal.tsx`). Las dos: `md:hidden fixed bottom-0 inset-x-0 z-[610]`, **`h-[85dvh]`** (antes `85vh` y `82vh`, sin motivo escrito para la diferencia), `rounded-t-xl` arriba y 0 abajo, y se mueven con una transición de 220 ms. Sus velos también llevan `md:hidden`: sin eso, abrir la hoja en celular y agrandar la ventana la dejaba encima del panel lateral.

#### Cómo se cierran

| Forma | Filtros | Detalle |
|---|---|---|
| Botón ✕ | sí | sí |
| Tocar el velo | sí | sí |
| **Tecla Escape** | sí | **sí, desde el 16 sep 2026** (un solo listener, en `PropertyModal`, no en `ModalContent`, que se monta dos veces) |
| **Arrastrar hacia abajo** | desde la franja y el encabezado | desde la franja y **el bloque de la foto**. ⚠ **El cuerpo ya NO cierra** |

⚠ **La franja gris de arriba PROMETE un gesto, así que tiene que cumplirlo.** Una affordance que no responde se lee como una app rota, no como una app sin esa función.

⚠ **El detalle antes se cerraba arrastrando desde cualquier parte, cuerpo incluido.** Se cambió **antes del lanzamiento porque no hay visitantes que usen el gesto viejo**: después, quitarlo le habría sacado un gesto a quien ya lo usa.

#### El gesto: `src/lib/hooks/useSheetDragToClose.ts`, compartido por las dos

Devuelve `{ sheetRef, dragZoneProps }`. Quien lo usa pone `sheetRef` en la hoja y reparte `dragZoneProps` (Pointer Events) **solo en las zonas que no scrollean**, con `touch-none`.

**Arrastrar para cerrar y scrollear son dos gestos verticales en el mismo lugar.** Si la hoja entera escuchara el arrastre, un visitante que vuelve al principio del texto **cerraría la ficha sin querer**. **La garantía es ESTRUCTURAL, no una condición sobre `scrollTop`:** el cuerpo scrolleable no es descendiente de ninguna zona de arrastre, así que un `pointerdown` en el cuerpo **nunca llega** a los manejadores.

| Pieza | Para qué |
|---|---|
| **Umbral de 8 px** (`DRAG_SLOP_PX`) | Hasta ahí es un toque: la hoja no se mueve y el click llega a su botón |
| **Cierre a 120 px** (`DRAG_CLOSE_PX`) | Al soltar pasado ese desplazamiento se cierra; si no, vuelve. No se mira la velocidad |
| **Captura de puntero diferida sobre elementos interactivos** (`button, a, input, textarea, select, [role="button"]`) | Capturar de entrada redirigiría el `pointerup` y el click dejaría de caer en la ✕, en "Ver ficha completa" o en el campo de compartir |
| **Anulación del click posterior a un arrastre** | Se apaga en cada `pointerdown`, para no comerse el click de un toque siguiente |
| **`touch-none` en las zonas** | Sin eso el navegador puede reclamar el gesto y cancelarlo con `pointercancel` |

⚠ **La hoja se mueve con `style.translate`, NUNCA con `style.transform`.** En Tailwind v4 `translate-y-*` escribe la propiedad `translate` (medido: `transform` da `none` con la hoja abierta y cerrada), así que `transform` en línea **se sumaba** al desplazamiento de la clase. El detalle lo hacía, y al cerrar por gesto **saltaba sin animar**.

⚠ **Primero se limpia el estilo en línea y después se cierra.** Con `transition: none` todavía puesto, el cambio de clase a `translate-y-full` sería instantáneo.

**Carrusel del detalle: se sacaron los puntos.** Quedaban tapados por "Ver ficha completa" (con 10 fotos, 2 tapados a 390 px y 5 a 320 px) y medían 4 px de alto. Quedan las flechas y el contador `n/N`.

#### El presupuesto de alto

**Las dos hojas tienen alto FIJO y su cuerpo es lo ÚNICO que cede**, así que cada píxel que se le agrega a una zona fija se lo resta al área que se puede leer.

⚠ **Los números de esta tabla se midieron en 375×667 cuando las hojas eran `85vh` y `82vh`.** Con `85dvh` el alto depende de la barra del navegador: en un Samsung A21s con Chrome, `100dvh` = 771,43 px y `100vh` = 827,43 (56 px de barra). Las zonas fijas no cambiaron; la fila del detalle con `85dvh` sobre 667 px es un **cálculo, no una medición**.

| | Filtros (85vh = 566,94, medido) | Detalle (82vh = 546,94, medido) |
|---|---|---|
| Franja | 20 | 20 |
| Zona fija | encabezado 57 · pie "Limpiar filtros" 75 **solo si hay filtros activos** | carrusel 220 · zona inferior 129,5 |
| **Cuerpo scrolleable** | **489,94** sin filtros · **414,94** con filtros | **177,44** (con `85dvh` sobre 667 px: **≈ 197,4**, calculado) |

⚠ **Menos de 200 px es contra lo que juega quien quiera agregar algo a la zona inferior del detalle** — un par de párrafos. Por eso los botones flotantes (cerrar, compartir, favorito y "Ver ficha completa") van **sobre la foto**, en `absolute`: cuestan **cero** píxeles de alto. ⚠ **Y en horizontal casi no queda nada:** en el A21s con Chrome el alto útil es **331 px** y la foto sola se lleva 220 (ver PENDIENTES.md).

#### ⚠⚠ TRAMPA — UN CONTENEDOR AL 100 % DEL ALTO CON UN HERMANO ARRIBA DESBORDA

**Apareció en TRES lugares distintos** (`FilterPanel`, `ModalContent` y `ModalSkeleton`) y es la causa única de que el contenido de las dos hojas se saliera **exactamente 20 px** por debajo del borde de la pantalla — los 20 de la franja.

```
❌  <div className="h-full flex flex-col">      dentro de una hoja que ADEMÁS tiene la franja
✅  <div className="flex-1 min-h-0 flex flex-col">
```

**Por qué:** `h-full` es el 100 % del padre, y el padre ya gastó 20 px en la franja; como item de flex, su `min-height: auto` **le impide achicarse**, así que el excedente sale por abajo. `flex-1 min-h-0` le dice que ocupe *lo que quede* y que **puede** achicarse.

**El daño no era cosmético:** dejaba **4 px del botón "Consultar por WhatsApp" fuera de pantalla** en el detalle, y el pie entero de "Limpiar filtros" en los filtros. ⚠ Y `ModalSkeleton` tenía el mismo defecto: corregir solo el contenido real hacía que **todo saltara 20 px al terminar de cargar**.

⚠ **En escritorio NO se nota**, porque ahí el contenedor no tiene hermano arriba y las dos formas miden igual (medido: 744 px las dos). O sea que **se ve solo en un teléfono**.

#### ⚠ TRAMPA — LOS BOTONES FLOTANTES SE PINTAN ENCIMA DE LA HOJA

Los dos FABs están en `z-[610]` y el velo de la hoja en `z-[600]`, así que con una hoja abierta **quedaban encima y seguían siendo tocables**: tocar "Ver lista" cambiaba la vista de atrás **sin cerrar la hoja**, y el botón tapaba el final del contenido. Se ocultan con el mismo render condicional en las dos pantallas que los montan:

```tsx
{!selectedPropertyId && !filterPanelOpen && ( … )}
```

⚠ **Subir el z-index de la hoja NO alcanza**: la dejaría por encima pero los botones seguirían ahí, visibles y tocables sobre el velo. Y **ocultarlos es lo que libera el último renglón**: después de arreglar el desborde, la fila "Solo destacadas" ocupa justo donde estaban.

### WhatsApp
- `phone_wa` en formato `"5491112345678"` (solo dígitos: `549` + característica + número). `generateWaUrl()` retorna `string | null` — verificar antes de usar; si null, deshabilitar botón con mensaje.
- Registrar lead (con `agency_id`) antes de abrir WhatsApp. **Pero el registro no puede bloquear el contacto** — ver "El registro de la consulta NO puede bloquear al visitante".

### El campo de teléfono — prefijo argentino fijo

**La plataforma es para inmobiliarias argentinas y el número existe para armar un enlace de WhatsApp**, así que no hay selector de país: el campo muestra **`+54 9` fijo y visible** y la persona escribe solo característica y número. Fuente única: **`src/lib/utils/phoneWa.ts`**, que usan los cuatro formularios que escriben un teléfono (perfil, preferencias, alta de agente, registro) **y sus cuatro server actions**.

#### Lo que se guarda NO cambió

| | |
|---|---|
| **En la base** | `"549"` + característica + número, solo dígitos (`5493854000000`). **Es lo que consume `generateWaUrl`** y esta pieza no lo tocó |
| **En pantalla** | el prefijo `+54 9` como texto fijo a la izquierda, y en el campo solo `3854000000` |

**Característica + número son SIEMPRE 10 dígitos** en Argentina, sea cual sea el largo de la característica (11+8, 385+7, 2944+6). Por eso la validación tiene **mínimo y máximo**: sin máximo, un número con el prefijo duplicado (`549549…`) pasaba sin ningún error.

#### Qué limpia al pegar

`normalizePhoneWaNational` acepta **todas** las formas en que se escribe o se dicta un celular argentino:

| Lo que se pega | Queda |
|---|---|
| `+54 9 385 400-0000` (contacto copiado del teléfono) | `3854000000` |
| `5493854000000` (el formato viejo del campo) | `3854000000` |
| `0385 15 400 0000` (como se dicta en Argentina) | `3854000000` |

Del principio quita, **en cualquier combinación y en bucle**: signos, espacios, ceros, el `54` y el `9`. Es seguro porque **toda característica argentina empieza con 1, 2 o 3**, así que ninguno de los tres puede ser su comienzo. El **`15`** es el caso distinto: **no va al principio sino DESPUÉS de la característica**, así que se busca en las tres posiciones posibles (característica de 2, 3 o 4 dígitos) y **solo cuando sobran exactamente dos dígitos**, que es la única forma de saber que está.

⚠ **Mientras se tipea solo se filtran dígitos, sin quitar prefijos.** Hacerlo tecla por tecla borraría un `5` o un `0` recién escrito antes de que la persona termine. La limpieza completa corre **al pegar, al salir del campo y al validar**.

#### ⚠⚠ UN NÚMERO GUARDADO CON FORMATO INESPERADO SE MUESTRA TAL CUAL Y NO SE CORRIGE NUNCA

`splitStoredPhoneWa` devuelve un número guardado que no cumple el formato **entero, con `recognized: false`**, y el formulario muestra un aviso de revisión. **NO lo corrige.** ⚠ Acá decía que *"hay números viejos en la base sin el `9` de celular"*: dejó de ser cierto el 16 sep 2026, cuando se corrigieron y la base ganó los CHECK `agents_phone_wa_format` / `agencies_phone_wa_format`, así que hoy **no puede haber** un guardado fuera de formato. La rama se conserva por las dudas (ver "Blindaje de columnas" → TRAMPA 7).

**El motivo: editar el nombre de un perfil no puede cambiarle el teléfono a alguien sin que lo pida.** Una corrección silenciosa sobre un número que quizás está bien —y que es por donde esa inmobiliaria recibe sus consultas— es la clase de cambio que nadie nota hasta que deja de sonar el teléfono. Por lo mismo, `resolvePhoneWaForSave` recibe el valor **ya guardado** (`preserved`) y, si llega exactamente ese, lo devuelve **sin tocar**: guardar un formulario sin tocar el teléfono no lo reescribe. ⚠ En el servidor `preserved` sale **siempre de la fila real**, nunca del cliente, así que no sirve para colar un valor sin validar.

#### ⚠ LIMITACIÓN ACEPTADA: NO SE PUEDEN CARGAR LÍNEAS FIJAS

El campo antepone **siempre** `549`. Un número escrito con `54` y sin el `9` (`543854000000`) **se guarda con el 9 agregado** (verificado). Es coherente con la decisión de aceptar solo celulares, pero tiene un costo concreto: **una inmobiliaria que atienda WhatsApp Business desde una línea fija —que va sin el 9— no puede cargar su número**, y el campo se lo "corrige" mientras escribe. Anotado en `PENDIENTES.md`; si aparece una fundadora en ese caso, es lo primero a revisar. ⚠ Y cambiarlo exige además aflojar los CHECK de teléfono de la base (TRAMPA 7).

### La consulta sobrevive al agente que la atendió

> **Una consulta es un HECHO HISTÓRICO.** Si el agente que la recibió se va de la inmobiliaria, la
> consulta **no se borra y no se reasigna a otra persona**: queda en el historial de la agencia,
> desvinculada del agente, conservando el nombre de quien la atendió.

- **`leads.agent_id` es NULLABLE y su FK es `ON DELETE SET NULL`** (medido). Al borrarse el agente, sus consultas quedan con `agent_id` en NULL. **Siguen perteneciendo a la agencia**: `leads.agency_id` es NOT NULL y el borrado no lo toca, así que siguen apareciendo en `/dashboard/leads` y siguen contando para todo lo que cuenta por agencia.
- **`leads.agent_name` (TEXT nullable) guarda el nombre de quien la atendió.** Es lo que permite que la pantalla diga quién fue en vez de "sin agente asignado".

#### ⚠ EL NOMBRE LO ESCRIBE LA BASE, NUNCA EL CLIENTE

Lo completa el trigger **`trg_set_lead_agent_name`** (`BEFORE INSERT ON leads` → `set_lead_agent_name()`, SECURITY DEFINER, `search_path` fijo), copiándolo de `agents.full_name`.

**Poner ese campo en el `insert` del `PropertyModal` era muchísimo más barato de escribir, y es exactamente lo que no hay que hacer.** Las tres condiciones que lo vuelven inseguro se dan las tres a la vez:

1. **todo camino que crea consultas es PÚBLICO Y ANÓNIMO** (insertan con la anon key, sin sesión). ⚠ Desde el 8 sep 2026 son **DOS**: el modal del mapa y la página pública de la propiedad — los dos por `registerLead`, que es justamente por qué se extrajo;
2. **`leads` no tiene NI UN SOLO CHECK** (medido) — la base no tiene con qué rechazar un valor;
3. **la policy `Public insert lead` no puede validar una columna de texto**: compararla contra `agents.full_name` sería verificar contra la fuente que esta columna existe para no consultar.

O sea que si el nombre viajara en el payload del navegador **no habría ninguna barrera**: un visitante podría escribir cualquier cosa y el panel de una agencia lo mostraría en la columna "Agente" — donde se lee como un dato del sistema, no como texto que escribió un desconocido.

**El diseño cierra por los dos lados** (medido): si `agent_id` viene cargado, el trigger **pisa** cualquier `agent_name` entrante; y si viniera nulo, el insert ni siquiera se escribe, porque `Public insert lead` lo rechaza (`p.agent_id = leads.agent_id` con NULL da NULL, el `EXISTS` da `false`). **No hay ninguna combinación en la que un `agent_name` del navegador termine en la tabla.**

Misma disciplina que los tres gates de publicación y `ensure_agency_subscription`: **la regla vive en la base porque el código se olvida y la base no.**

#### ⚠ LA COPIA ES CONGELADA A PROPÓSITO — NO ES `agents.email`

El proyecto tiene otra columna denormalizada y **son casos opuestos**. Leer una por analogía con la otra lleva a la decisión equivocada:

| | `agents.email` | `leads.agent_name` |
|---|---|---|
| Qué es | copia de **LECTURA** de `auth.users` | copia **CONGELADA** de `agents.full_name` |
| Si la fuente cambia | idealmente debería seguirla (queda vieja: desprolijidad tolerada) | **NO debe seguirla** |
| Qué registra | "cómo se llama hoy" | "cómo se llamaba **cuando atendió esta consulta**" |

**Agregarle una sincronización con `agents.full_name` —"para que no quede vieja"— DESTRUIRÍA el dato histórico, que es su única razón de existir.** Y sería peor que un bug común: no daría ningún síntoma, solo empezaría a mentir sobre el pasado.

#### Los tres estados de la columna "Agente"

La decisión vive en **`AgentCell`** (`LeadsContent.tsx`), en **un solo lugar**, consumido por la tabla de escritorio y por las tarjetas de celular. Está centralizado por el precedente de `AgenciesTable`, donde esta misma clase de condición estaba escrita dos veces y **las dos copias se desincronizaron**. Devuelve siempre **un solo elemento**, para funcionar igual dentro del `<td>` (flujo inline) que dentro del `<p className="flex">` de la tarjeta (un único flex item).

| Orden | Criterio | Qué muestra | Tratamiento |
|---|---|---|---|
| 1 | hay `agent` embebido | `agent.full_name` — el nombre **ACTUAL**, no la copia congelada: para un agente presente, lo que vale es cómo se llama hoy | `text-sm text-graphite` |
| 2 | no hay `agent` pero sí `agent_name` | el nombre guardado + badge **"Ya no está"** | badge `bg-stone text-graphite`, el tratamiento de **estado cerrado** de DESIGN §6 (el mismo de las propiedades vendidas/alquiladas) |
| 3 | no hay ninguno de los dos | *"Sin agente asignado"* | `italic text-stone` |

- **El caso 3 es el último recurso**, para consultas anteriores a la migración sin la copia del nombre. Hoy no hay ninguna (9 de 9 tienen nombre), pero el caso es representable y no hay que sacarlo.
- **El nombre del caso 2 NO se atenúa.** La tentación es ponerlo en `stone` para "marcar" que ya no está, y es un error: el nombre **es el dato**, y es lo único que se conserva de quién atendió esa consulta. Lo que cambió de estado es la persona, no el registro, así que el estado va en el badge.

#### ⚠ CAMBIO DE ALCANCE QUE NADIE DECLARÓ: quién ve una consulta desvinculada

Las dos policies de SELECT de `leads` no cambiaron, pero **su resultado sí**:

- **`Agent reads own leads`** (`agent_id = auth.uid()`) **ya no alcanza** una consulta desvinculada: `NULL = uuid` da `NULL`, no `TRUE`, así que la fila no pasa.
- **`Admin reads agency leads`** (filtra por `agency_id`) la sigue viendo.

O sea: **una consulta desvinculada pasa a verla SOLO el admin de la agencia.** Es lo correcto —el agente al que pertenecía ya no existe— pero es un cambio real de quién ve qué, y no estaba enunciado en ninguna decisión.

**⚠ LA SALIDA OBVIA ES AFLOJAR ESA POLICY, Y NO HAY QUE HACERLO.** Agregarle un `OR agent_id IS NULL` le mostraría a **cualquier** agente de cualquier agencia las consultas de **todos** los que se fueron. La policy queda como está.

#### ⚠ Dos trampas

**1. El embed del agente NO puede llevar `!inner`.** La query de `/dashboard/leads` trae `agent:agents(id, full_name)` sin `!inner`, así que PostgREST lo resuelve como LEFT JOIN y la fila desvinculada viene igual, con `agent` en null. Agregarle un inner join —una "optimización" que parece inocua— **haría desaparecer de la pantalla, en silencio, exactamente las consultas que este modelo existe para conservar**: sin error, sin síntoma, solo filas que dejan de estar. Y `agent_name` hay que **nombrarla** en ese select: es una lista explícita de columnas y lo que no se nombra no llega.

**2. El borrado de un agente NO ES ATÓMICO, y sigue sin serlo.** `deleteAgentAction` hace tres pasos —reasignar propiedades → borrar el avatar → borrar la cuenta— y **los dos primeros no se revierten**. Si el tercero falla:

- las propiedades **ya** están a nombre del admin;
- el avatar **ya** se borró del Storage (`agents.avatar_url` apunta a un archivo que no existe);
- y **el agente sigue existiendo**: puede iniciar sesión, y ve su listado de propiedades vacío y su foto de perfil rota, sin que nadie le haya avisado.

⚠ **Acá había un comentario que llamaba a ese estado "consistente". Era falso** y ya se corrigió en el código. La causa más frecuente de ese fallo —el choque contra la FK de `leads`— **desapareció con el `SET NULL`**, así que hoy es mucho menos probable; pero el estado **sigue siendo alcanzable por cualquier otro fallo** de la API de Auth. Reintentar es seguro (los dos primeros pasos son idempotentes) pero puede no arreglar nada, y por eso el mensaje dice qué quedó hecho en vez de un "intentá de nuevo" pelado. Ver PENDIENTES.md.

#### El aviso previo al borrado dice las dos cosas

`/dashboard/equipo` cuenta las consultas por agente con el mismo patrón que ya usaba para las propiedades (una lectura por agencia + un conteo en memoria, no N queries) y el `AlertDialog` muestra **dos frases separadas**, porque son dos efectos distintos sobre dos cosas distintas:

> Sus **3 propiedades** pasan a tu nombre y vas a poder reasignarlas. La cuenta del agente se elimina y no podrá ingresar.
>
> Sus **5 consultas** no se borran: quedan en el historial de la agencia con su nombre, para que sepas quién las atendió.

**La segunda frase arranca por "no se borran" a propósito:** el admin está mirando un diálogo rojo de eliminación, y lo primero que necesita saber de sus consultas es que **no** las va a perder. Cada frase se muestra solo si su conteo es mayor a cero.

⚠ **La guarda `if (l.agent_id)` del conteo es load-bearing, no una formalidad copiada del conteo de propiedades.** En aquel era defensiva (esa columna es NOT NULL); acá **las filas con `agent_id` nulo existen de verdad** y no deben contarse para nadie: son de agentes que ya se fueron y no pertenecen a ningún miembro vivo del equipo.

### El registro de la consulta NO puede bloquear al visitante

El `insert` de `leads` **captura su error, pero el enlace de WhatsApp se abre igual**: el `window.open` va después y **fuera de toda rama de error**.

⚠ **El insert ya NO vive dentro del modal: se extrajo a `src/lib/utils/registerLead.ts`** (8 sep 2026), cuando apareció una **segunda** pantalla que contacta por WhatsApp (la página pública de la propiedad). Copiarlo habría sido copiar —o perder— las cuatro decisiones que lleva encima, y **la más frágil de las cuatro es una OMISIÓN**: que `agent_name` NO viaje en el payload. Las omisiones no se copian, se olvidan. La función **nunca lanza** (devuelve un booleano) y las otras tres decisiones son **contrato del llamador**, escritas en ese mismo archivo:

| # | Decisión | Dónde vive |
|---|---|---|
| 1 | el error se captura pero **no bloquea** el contacto | el llamador: `window.open` después y fuera de toda rama de error |
| 2 | **no se manda `agent_name`** — lo escribe el trigger | la función: que el campo no esté **es** la barrera |
| 3 | con error el formulario **no se cierra** | el llamador |
| 4 | el aviso **no es un error grave** (`graphite` + `role="status"`) | el llamador, con el texto en `LEAD_ERROR_MESSAGE` |

**El criterio: la operación principal acá es el CONTACTO, no el registro.** El lead es para la agencia, no para el visitante, y **no puede ser la razón por la que alguien no llegue a contactar a una inmobiliaria**. No hay ninguna rama en la que el visitante se quede sin poder escribir.

- **Qué cierra:** era un `await` pelado, sin `const { error } =`. Un rechazo de la policy, una caída de red o una agencia que dejó de ser públicamente visible entre el render y el click producían **exactamente la misma pantalla que el éxito** — se abría WhatsApp y la agencia nunca se enteraba de que hubo una consulta. **Misma familia de defecto que `ImageUploader.handleRemove`**, y misma forma de resolverlo: capturar, mostrar, y no abortar la operación principal.
- **Con error el flujo NO se cierra** (`showNameInput` y `userName` se conservan): si se reseteara, el aviso quedaría flotando al lado de un botón en estado inicial, sin contexto de a qué se refiere.
- **⚠ El aviso va en `graphite`, no en `error`, y es deliberado.** Es la única desviación del molde de `ImageUploader`, donde el rojo sí corresponde porque **quien lo lee es el agente y algo suyo quedó mal**. Acá quien lo lee es **un visitante al que no le falta nada**: ya tiene el chat abierto y su consulta va a llegar igual, por WhatsApp. Un texto rojo le comunicaría un problema que no es suyo y lo empujaría a no escribir. Por lo mismo lleva `role="status"` y no `role="alert"`: es información, no una alarma.
- **Cómo deja de pasar inadvertido un problema sistemático:** si la policy empieza a rechazar inserts, **todos** los visitantes que intenten contactar ven ese aviso. Antes no lo veía nadie, y la agencia tampoco: las consultas simplemente no aparecían.

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
- **⚠ EN LOS PATHS DE PROPIEDAD, LA PRIMERA CARPETA ES EL AGENTE QUE SUBIÓ EL ARCHIVO, NO EL DUEÑO DE LA PROPIEDAD.** Las páginas de nueva/editar le pasan al uploader `agentId={userId}` (el de la sesión), así que cuando un admin sube fotos a la propiedad de otro agente de su equipo, el archivo queda bajo la carpeta **del admin**. Es la razón de que la frontera de las policies sea por agencia y no por usuario.

#### Policies de `storage.objects` — seguridad fina (5 sep 2026)

**Cuatro policies, todas acotadas al rol `authenticated`.** La frontera depende del tipo de archivo:

| Archivo | Frontera | Cómo se valida |
|---|---|---|
| Propiedades (`{agent_id}/{property_id}/…`) | **por AGENCIA** | el agente de la 1ª carpeta pertenece a mi agencia (`EXISTS` sobre `agents`) |
| Logos (`logos/{agency_id}/…`) | **por AGENCIA** | la 2ª carpeta **es** mi `agency_id` — sin lookup |
| Avatares (`avatars/{agent_id}/…`) | **por USUARIO** | la 2ª carpeta es mi `auth.uid()`. El avatar es personal |

La agencia se resuelve con **`auth_agency_id()`** (`public`, SQL, `STABLE`, **`SECURITY DEFINER`**, `search_path` fijo). Es SECURITY DEFINER para que las policies **no dependan de que `Public read agents` siga teniendo `USING (true)`**: el día que se restrinja esa lectura —algo razonable, hoy expone email y teléfono de todos los agentes a la anon key— un subselect suelto dejaría de ver filas y **toda subida empezaría a fallar con un 403 sin relación aparente con `agents`**. ⚠ **Deuda conocida:** la rama de propiedades **todavía** hace su propio `EXISTS (SELECT 1 FROM agents …)` fuera de la función (necesita mirar a OTRO agente, no al logueado), así que **esa rama sigue atada a `Public read agents`**. Ver PENDIENTES.md.

**⚠⚠ TRAMPA 1 — LA CARPETA SE COMPARA EN TEXTO, NUNCA CASTEÁNDOLA A `uuid`.** `storage.foldername()` devuelve las carpetas del path, y para avatares y logos la **primera es una palabra literal** (`avatars`, `logos`), no un uuid. Castearla **no devuelve `false`: lanza un error que ABORTA LA SENTENCIA ENTERA** — medido: `ERROR: 22P02: invalid input syntax for type uuid: "avatars"`. Por eso se castea el uuid conocido a texto (`a.id::text`, `auth.uid()::text`, `auth_agency_id()::text`) y se lo compara contra la carpeta. **Y excluir los prefijos con un `AND` antes de castear NO SIRVE:** PostgreSQL **no garantiza el orden de evaluación de los `AND`** (el planificador los reordena por costo), así que esa forma anda con los 9 archivos de hoy y puede empezar a tirar `22P02` en producción con 5.000, sin síntoma previo.

**⚠⚠ TRAMPA 2 — EL `USING` Y EL `WITH CHECK` DE LA POLICY DE UPDATE SON IDÉNTICOS A PROPÓSITO.** No es copy-paste redundante: el `USING` controla **qué archivo se puede tocar** y el `WITH CHECK` **cómo puede quedar después**. Endureciendo solo el `USING`, un agente puede tomar un archivo propio y **renombrarlo hacia la carpeta de otra agencia** — escritura cruzada por la puerta de atrás. **Quien edite una, tiene que editar la otra.**

- **La policy de UPDATE es la que hace posible el reemplazo.** Un `upload(..., { upsert: true })` sobre un archivo que YA existe es un **UPDATE**, no un INSERT: es el camino del avatar y del logo, que usan path fijo. Sin ella, RLS lo niega con 403 *"new row violates row-level security policy"* mientras la **primera** subida (INSERT) sí pasa. Ese síntoma confuso ya se pagó una vez acá.
- **El service role saltea las cuatro.** `storage.objects` tiene RLS habilitada pero **no forzada** (`relforcerowsecurity = false`) y `service_role` tiene además `rolbypassrls = true` (las dos cosas medidas), así que **los cuatro caminos de borrado y la herramienta de auditoría** (ver "Quién borra los archivos") no se enteran de nada.
- **La lectura por RLS quedó acotada a `authenticated`, pero eso NO apaga la lectura pública de las fotos:** el bucket es `public = true` y `/storage/v1/object/public/…` **no pasa por RLS** (requisito del producto: el visitante anónimo del mapa ve las fotos). Lo que sí cerró es la **enumeración**: antes esa policy tenía rol `public`, o sea que con la anon key —la del bundle de JavaScript— se podía **listar el árbol completo del bucket**. Verificado después del cambio: ese listado devuelve `[]`.
- **Los archivos huérfanos son inalcanzables POR RLS, y de ahí sale todo lo que sigue.** Un archivo bajo la carpeta de un agente que ya no existe no matchea ninguna rama (no hay fila contra la cual comparar), así que **ningún usuario autenticado puede borrarlo** — ni siquiera el admin de su agencia. Solo el service role. **Esa es la razón de que los tres caminos de borrado usen service role y de que la limpieza sea un script y no una pantalla**: cualquier solución basada en el client del navegador dejaría afuera exactamente los archivos que hay que borrar. Ver "Quién borra los archivos" y "Auditoría y limpieza de huérfanos".
- **⚠ CORRECCIÓN DE UNA AFIRMACIÓN QUE ESTUVO ACÁ Y ERA FALSA.** Este archivo decía que las policies eran *"laxas y consistentes"* y que la policy de DELETE original *"quedó reemplazada por la laxa"*. **Nunca ocurrió.** Hasta el 5 sep 2026 la de DELETE fue **la única fina** del bucket (`auth.uid()::text = (storage.foldername(name))[1]`), textualmente la de la migración original; lo que se agregó al arreglar el 403 de reemplazo fue una policy de **UPDATE nueva y laxa**, sin tocar la de DELETE. O sea que las policies eran **tres laxas y una fina**, no cuatro laxas — y esa inconsistencia tenía dos consecuencias medidas: **nadie podía borrar un avatar ni un logo por RLS** (ni su dueño: ahí `foldername[1]` es la palabra literal), y **un admin no podía borrar una foto subida por otro agente de su equipo**. El daño real de las laxas nunca estuvo en el borrado sino en el **UPDATE**: permitía **sobrescribir** con `upsert` el logo, el avatar o las fotos de cualquier otra agencia, dejando `agencies.logo_url` intacto y el sitio white-label sirviendo contenido ajeno.

#### Límites del bucket — los aplica el MOTOR, no el JavaScript

**`file_size_limit = 5242880` (5 MB) y `allowed_mime_types = {image/png, image/jpeg, image/webp}`** (medidos en `storage.buckets`). Hasta el 5 sep 2026 **los dos estaban en `NULL`** y las únicas validaciones vivían en el JavaScript de los formularios (`AgencyLogoForm` valida 2 MB y PNG/JPG/WEBP; `ImageUploader` solo filtra `type.startsWith("image/")`). **El JavaScript no es una barrera**: quien hable con la API de Storage directamente con su anon key y su JWT no pasa por el formulario, así que el *"no SVG, riesgo XSS"* del código **no lo aplicaba nadie**. Ahora sí.

- **Los 5 MB son MÁS PERMISIVOS que los 2 MB del formulario del logo, a propósito:** el límite del bucket es el techo duro para todos los tipos de archivo (una foto de propiedad de 2 MB es chica); la regla más estricta del logo sigue viviendo en su formulario.
- ⚠ **Consecuencia medida:** un GIF o un HEIC que `ImageUploader` hoy dejaría pasar (`startsWith("image/")`) **ahora rebota en el motor**.
- Reemplazar (no acumular) es el comportamiento deseado para avatar y logo: `upsert: true` sobre path fijo. **⚠ Pero el `upsert` pisa el MISMO path, no el de otra extensión:** si cambia (`logo.png` → `logo.webp`, `avatar.png` → `avatar.jpeg`) quedan 2 objetos y el `logo_url`/`avatar_url` apunta al último. Los dos formularios siguen sin borrar el anterior, así que **el sobrante se sigue produciendo**; lo que cambió es que ya no es invisible: las categorías (b) y (c) de `scripts/storage-orphans.ts` lo detectan por esa vía exacta ("existe la fila pero su columna apunta a otro archivo"), y el borrado de un agente barre de paso los avatares viejos porque **lista** la carpeta en vez de reconstruir el nombre.

#### Quién borra los archivos, y cuándo

**Cuatro caminos borran archivos del bucket. Los cuatro con service role, los cuatro best-effort, ninguno silencioso.**

| Camino | Qué borra | Client | Si falla |
|---|---|---|---|
| `deletePropertyAction` (`propiedades/actions.ts`) | las fotos de esa propiedad, vía `removePropertyFiles` | service role, **siempre** | la propiedad ya se borró; se avisa *"…pero quedaron archivos sin borrar en el almacenamiento (N archivo(s))"* |
| `deleteAgentAction` (`equipo/actions.ts`) | **el avatar del agente y NADA MÁS**, vía `removeAgentAvatar` | service role | la cuenta ya se borró; mismo aviso |
| `deleteAgencyAction` (`admin/actions.ts`) | el logo de la agencia + los avatares de sus agentes, vía `removeAgencyFiles` | service role | la agencia ya se borró; mismo aviso. **Es el precedente del que salen los otros dos y no se tocó** |
| `ImageUploader.handleRemove` (navegador) | el archivo de la imagen que el agente saca del formulario | **client de navegador** | la imagen **se quita igual** de la grilla y se avisa *"La imagen se quitó, pero no se pudo borrar el archivo del almacenamiento"* |

- **Best-effort no significa silencioso.** Los tres del servidor devuelven el aviso por el mismo `{ error }` que ya usaba cada pantalla, y ninguno aborta la operación principal: un archivo que queda es basura inerte, dejar viva una fila que el usuario pidió borrar es peor.
- **Solo el del navegador NO usa service role**, y es deliberado: el path ya está a mano y la frontera por agencia de las policies le da permiso al agente (incluso sobre una foto que subió un compañero de equipo). Moverlo al servidor sería un viaje de más para hacer lo mismo. Lo que ahí se arregló fue el silencio: era un `await` pelado sin `const { error } =`, así que un rechazo de RLS, un 404 o una caída de red producían **exactamente la misma pantalla que el éxito**.

**⚠⚠ LA TRAMPA MÁS CARA DEL BUCKET: AL BORRAR UN AGENTE SE BORRA SU AVATAR Y NADA MÁS.**

Leé esto antes de tocar `removeAgentAvatar`. La tentación es barrer la carpeta `{agent_id}/` entera —se ve más completo— y **es destructivo**:

1. El primer segmento de un path de foto de propiedad es **el agente que SUBIÓ el archivo, no el dueño de la propiedad** (ver el ⚠ del principio de esta sección).
2. `deleteAgentAction` **reasigna las propiedades del agente al admin** antes de borrarlo (Modelo B), así que esas propiedades **siguen vivas y publicadas en el mapa**.
3. Por lo tanto, barrer `{agent_id}/` se llevaría las fotos de propiedades que están funcionando. Cuando se escribió esto había **7 de 12 archivos** bajo una de esas carpetas que pertenecían a propiedades existentes.

**La regla, sin excepciones: las fotos de propiedad se borran cuando se borra LA PROPIEDAD, nunca cuando se borra una persona.** `avatars/{agent_id}` es el único prefijo que pertenece a la persona. Y la garantía no es una promesa del comentario, es estructural: `removeAgentAvatar` **lista** `avatars/{agentId}` —una búsqueda por prefijo que un path de propiedad, que empieza con un uuid, no puede matchear— y borra exactamente lo que ese listado devolvió, re-prefijado con la misma carpeta. Se lista en vez de reconstruir el nombre porque la extensión depende del archivo que se subió y no se puede adivinar (y de paso barre los avatares viejos de otra extensión).

**⚠ EL ORDEN DE `deletePropertyAction` TIENE DOS MOTIVOS DISTINTOS, Y LOS DOS IMPORTAN.** El orden es: **① leer las URLs → ② borrar la fila → ③ borrar los archivos.**

- **① antes de ②, o los paths se pierden.** `property_images_property_id_fkey` es `ON DELETE CASCADE`: el `DELETE` de la propiedad se lleva las filas con las URLs en el mismo instante. Es el mismo razonamiento que `removeAgencyFiles`, que localiza los archivos primero porque *"son lo único que NO se puede volver a localizar una vez borradas las filas"*.
- **③ después de ②, y NO pegado a ①.** Acá está la tentación de "agrupar": leer las URLs y borrar los archivos de una parece más prolijo. **Es un error.** El motivo ① se satisface con solo leerlas —una vez leídas viven en memoria y el CASCADE ya no las alcanza—, así que agrupar no compra nada y paga un riesgo. La asimetría, que no es pareja ni por asomo:
  - si los archivos se borran y el `DELETE` falla después, queda una propiedad **viva y publicada con sus imágenes destruidas**: filas de `property_images` apuntando a archivos que no existen, o sea una propiedad rota en el mapa público, a la vista de cualquier visitante;
  - si la fila se borra y el borrado de archivos falla después, quedan archivos que ya no sirve nadie: basura inerte, invisible para todo el mundo, **y encima avisada**.
  - Un archivo de más no lo ve nadie; una propiedad rota la ven todos. El `DELETE` va en el medio para que el paso irreversible sobre el bucket ocurra recién cuando ya no queda nada que romper.

**⚠ LAS URLs SE LEEN CON `db`, NO CON EL CLIENT NORMAL.** `db` es el client que devuelve `authorizePropertyAccess` (normal para el dueño, service role para el admin de la agencia). Con el client normal, un **admin borrando la propiedad de otro agente de su agencia leería CERO filas**: la policy `Agent manages own property images` está atada a `agent_id = auth.uid()`. Y no daría error —daría una lista vacía—, así que el borrado de archivos no fallaría: **simplemente no borraría nada, en silencio**, que es justo el fallo que todo esto existe para eliminar.

**El util que traduce URL → path: `src/lib/utils/storagePath.ts`.** Exporta `PROPERTY_IMAGES_BUCKET` y `extractStoragePath(url): string | null`. Hace falta porque `property_images.url` guarda la **URL pública completa** (la de `getPublicUrl`) y la API de Storage borra **por path**. Vive en `lib/utils/` y no dentro de un componente porque lo usan servidor y cliente, mismo precedente que `coords.ts`.

> **⚠ Devuelve `null` —no la URL— cuando la URL no pertenece al bucket, y ESO es el arreglo.** La versión vieja vivía dentro de `ImageUploader` y en ese caso devolvía **la URL entera**. Pasada a `storage.remove()`, una URL completa es un path que no existe: **no borra nada y tampoco devuelve error** (borrar algo inexistente no falla). O sea que el defecto no se manifestaba como una falla sino como un éxito mentiroso. **Los llamadores tienen que descartar los nulos en vez de mandarlos a borrar**, y los dos lo hacen: `removePropertyFiles` los cuenta como archivos que quedaron, y `handleRemove` avisa sin llamar a `remove()`.

#### Auditoría y limpieza de huérfanos — `scripts/storage-orphans.ts`

**No es una herramienta de un solo uso.** Los cuatro caminos de arriba frenan la generación de huérfanos, pero queda una vía irreducible: el borrado de la fila y el del archivo son dos sistemas que no se pueden transaccionar juntos, así que si el proceso muere entre uno y otro el archivo queda. Esto sirve para auditar cada tanto.

```bash
npm run storage:huerfanos          # simulación: detecta e imprime, NO borra nada
npm run storage:huerfanos:borrar   # destructivo
```

Las dos entradas de `package.json` envuelven `node --env-file=.env.local scripts/storage-orphans.ts [--borrar]`. El script corre **fuera de Next.js**, así que nadie le inyecta el entorno: `--env-file` es lo que carga `.env.local` y es la parte que se olvida. No hay dependencias nuevas — Node 22 ejecuta TypeScript directo y `--env-file` es nativo desde 20.6.

**Qué detecta.** Lista el bucket entero (recursivo y paginado), lee `properties`, `agents` y `agencies`, y clasifica cada archivo en cuatro categorías, informando en cuál cae y por qué:

| | Categoría | Es huérfano si… |
|---|---|---|
| a | Foto de propiedad inexistente | `{uuid}/{property_id}/…` y no existe esa propiedad. **Solo mira el SEGUNDO segmento**: el primero es quien subió el archivo (ver la trampa de arriba) |
| b | Avatar sin referencia | `avatars/{agent_id}/…` y no existe el agente, **o** existe pero su `avatar_url` apunta a otro archivo |
| c | Logo sin referencia | ídem con `logos/{agency_id}/…` y `agencies.logo_url` |
| d | Placeholder | `.emptyFolderPlaceholder`, que crea el panel de Supabase al armar carpetas a mano |

Todo lo demás queda **en uso**, y un path que no responde a ninguna forma conocida va a un grupo aparte que **nunca se borra**.

**⚠ EL CRITERIO ES "¿EXISTE LA FILA?", NUNCA "¿ESTÁ PUBLICADO?".** El script no mira `status` en ningún lado. La foto de una propiedad pausada, vendida o alquilada **no es huérfana**: la propiedad existe y se puede reactivar. Lo mismo con las de una agencia dada de baja, cuyos datos se conservan intactos a propósito.

**Las dos salvaguardas:**

1. **El modo simulación es el predeterminado.** Sin argumentos detecta e imprime y no borra nada; solo borra con `--borrar` escrito completo. Un argumento desconocido **aborta** en vez de caer en simulación — correr con `--borar` y ver un informe sin borrados haría pensar que no había nada que borrar.
2. **⚠ NO SE BORRA NADA DE MENOS DE 24 HORAS, ni siquiera en modo borrado.** Al dar de alta una propiedad las fotos se suben al bucket **antes** de que la propiedad exista (el id se genera en el cliente y las filas se escriben al guardar), así que un archivo bajo un `property_id` que todavía no existe puede ser basura de un formulario abandonado **o** un formulario abierto en otra pestaña ahora mismo, y **son indistinguibles**. Se informan como `[RECIENTE, SE OMITE]` y se cuentan aparte. Un archivo cuya antigüedad no se puede establecer se trata como reciente: ante la duda no se borra.

Además: toda lectura es **fail-closed** (si falla el listado o cualquier consulta, se aborta y no se borra nada — una lista de propiedades incompleta convertiría fotos vivas en "huérfanas"), se pagina en las dos puntas (`list()` trae 100 por página, PostgREST corta en 1000 filas), y se borra **en lotes de 1000, por la API de Storage**, informando cuántos se borraron, cuántos fallaron y cuáles.

> **⚠ NUNCA borrar filas de `storage.objects` con SQL.** No borra el archivo del almacenamiento: lo deja facturándose y sin registro desde el cual encontrarlo. Es documentación oficial de Supabase, y es la razón de que la limpieza vaya por la API.

**Estado del bucket (medido el 6 sep 2026, después de correr la limpieza): 9 objetos, 723.872 bytes (707 kB), CERO huérfanos.** Venía de 24 objetos y 6.718.597 bytes, de los cuales 15 archivos y ~5,99 MB eran huérfanos: el 89 % del peso.

### Operaciones, precios y requisitos de la propiedad

#### Una propiedad, VARIAS operaciones

Una misma casa puede ofrecerse **en venta y en alquiler a la vez** (el dueño toma lo que aparezca primero). El modelo son **tres pares simétricos** de columnas en `properties`, uno por operación, cada uno con **su propio precio y su propia moneda**:

| Operación | Flag | Precio | Moneda |
|---|---|---|---|
| Venta | `for_sale` | `sale_price` | `sale_currency` |
| Alquiler | `for_rent` | `rent_price` | `rent_currency` |
| Alquiler temporal | `for_temp_rent` | `temp_rent_price` | `temp_rent_currency` |

- **Al menos una operación tiene que estar activa**: lo garantiza el CHECK `properties_at_least_one_operation`, no el tipo de TypeScript.
- **⚠ LA MONEDA ES POR OPERACIÓN, NO POR PROPIEDAD, y no es un lujo del modelo:** en Argentina **la venta se cotiza en dólares y el alquiler en pesos**. Con una moneda única por propiedad, la casa que está en venta y en alquiler a la vez —que es justo el caso que este modelo existe para representar— no se puede expresar.
- **Operación apagada ⇒ su precio y su moneda son NULL** (CHECK `properties_<op>_operation`): no queda un precio de alquiler colgado de algo que solo se vende.
- El **estado (`status`) sigue siendo UNO SOLO**. Cerrar cualquiera de las operaciones cierra la ficha entera; una propiedad con `for_sale` y `for_rent` ofrece las dos opciones de cierre en el menú del listado ("Marcar como vendida" y "Marcar como alquilada") y eso es correcto.

#### Precio en NULL = "A convenir"

- Una operación activa **sin precio cargado** significa **"a convenir"**. **NO es un dato faltante ni un error: es una elección de la agencia.** Publicar el precio en un mapa revela la tasación por m² de la zona, que es información competitiva, y muchas inmobiliarias no publicaban por eso.
- El texto es **"A convenir"** (`NO_PRICE_LABEL` en `formatPrice.ts`), nunca vacío, cero ni "sin datos". **No es "Consultar"**: el modal tiene dos botones que dicen "Consultar por WhatsApp" a centímetros del precio.
- `formatPrice(price, currency)` → `$250.000`; `formatPriceCompact` → `USD 250k` (pines). **Las dos aceptan `null` en los dos argumentos** y devuelven "A convenir".
- **Precio y moneda viajan SIEMPRE juntos**: o los dos en NULL, o los dos con valor (CHECK `properties_<op>_price`).
- **⚠ CONSECUENCIA DELIBERADA: una propiedad sin precio queda FUERA del filtro de rango de precio.** Sale gratis (`>=`/`<=` contra NULL no matchea) y **no hay que compensarlo**. El formulario **se lo advierte al agente antes de que decida**, en un aviso visible junto al campo vacío — es información que la agencia necesita para elegir, no letra chica.

#### Qué precio se muestra cuando entra UNO SOLO

El pin del mapa y la card de la lista tienen lugar para un solo número. La regla vive en **`getDisplayOperationPrice`** (`src/lib/utils/propertyOperations.ts`), función pura y **fuente única**: si se repartiera por componente, el pin y la card podrían mostrar números distintos para la misma propiedad.

1. Si el visitante marcó **exactamente una** operación **y la propiedad la tiene activa**, se muestra el precio de **esa** operación: es lo que pidió ver.
2. En cualquier otro caso (ninguna marcada, o varias), gana la prioridad **venta → alquiler → alquiler temporal** entre las que la propiedad tenga activas.
3. Si la operación elegida no tiene precio, se muestra "A convenir".

El mismo archivo exporta `getActiveOperations` (todas las activas, en orden de prioridad) para los kickers y el modal, y `OPERATION_COLUMNS` (el mapeo operación → nombres de columna) para que el hook del mapa no escriba esos nombres a mano.

- **El kicker de la card y del modal listan TODAS las operaciones activas** ("Casa · Venta · Alquiler"). En el pin no: no entra.
- **El modal es el único lugar que muestra las operaciones con sus precios completos**, una línea por operación.

#### Filtro público: operación múltiple, precio condicionado

- **El filtro de operación es de SELECCIÓN MÚLTIPLE** (como el de tipo de propiedad): marcar Venta y Alquiler muestra las que tengan **cualquiera** de las dos, no la intersección. En `MapFilters` es `operation_types: OperationType[]`.
- **⚠ EL RANGO DE PRECIO SOLO SE HABILITA CON EXACTAMENTE UNA OPERACIÓN MARCADA.** Con cero o con dos o más, los inputs y los botones de moneda quedan deshabilitados con una leyenda que lo explica. El motivo: **un precio de venta y uno de alquiler no viven en la misma escala**, y no hay una sola columna contra la cual comparar — filtrar los dos con un único rango devolvería un resultado que *parece* filtrado y no lo está.
- Al deshabilitarse, **`price_min`/`price_max` se limpian**: no pueden quedar aplicándose de forma invisible. La guarda está además en el hook (`useProperties`), no solo en la UI.

#### Requisitos para alquilar

Qué le pide la inmobiliaria al inquilino. Sin esto el visitante contacta por WhatsApp sin saber si califica, y la agencia contesta lo mismo una y otra vez.

- **Dos columnas JSONB, y son dos a propósito:**
  - `rent_requirements` → **lista cerrada** de siete valores (tipo `RentRequirement`), dato controlado.
  - `rent_requirements_other` → hasta **5** requisitos libres escritos por el agente, de hasta **300** caracteres cada uno. Los topes son constantes exportadas de `types/index.ts` (`RENT_REQUIREMENTS_OTHER_MAX`, `RENT_REQUIREMENT_OTHER_MAX_LEN`) porque los aplican tres capas: el formulario, la server action y los CHECK de la base.
  - Mezclar los libres dentro del array cerrado volvería imposible confiar en el contenido de aquel.
- **La lista cerrada está validada en las TRES capas** (CHECK de forma en la base, zod contra los siete literales en el formulario, y **filtrado contra la lista en la server action**, que descarta en silencio lo que no pertenezca). El cast de TypeScript no protege nada: se borra al compilar. **Esto NO copia el molde de `amenities`**, que no valida en ninguna capa — ver PENDIENTES.md.
- **La sección solo existe si la propiedad tiene alquiler** (`for_rent` o `for_temp_rent`), en el formulario y en el modal. En el formulario aparece y desaparece **en vivo** al marcar las casillas.
- **⚠ Si el agente carga requisitos y después desmarca las dos operaciones de alquiler, los requisitos NO viajan.** Desaparecer de la pantalla no limpia el formulario: el vaciado lo hace el `transform` del schema, y la action lo repite server-side.
- En el modal los dos tipos se muestran como **chips en una misma grilla**, primero los de la lista cerrada y después los libres, sin ícono. La sección no se muestra si no hay ningún requisito de ningún tipo.

#### ⚠ Tres trampas medidas

**1. En PostgreSQL, un CHECK que evalúa a NULL se considera SATISFECHO.** Los tres `properties_<op>_price` comparan contra `IS NOT NULL` **explícito en las dos ramas**, y no es redundante: escritos de la forma natural —`(precio IS NULL AND moneda IS NULL) OR (precio > 0 AND moneda IN (...))`— con media pareja cargada la primera rama da `FALSE` y la segunda `NULL`, o sea `(FALSE OR NULL) = NULL`, y la fila **entra en silencio**. Pasaba en las dos direcciones: moneda sin precio **y** precio sin moneda. **Quien saque esos `IS NOT NULL` por parecer redundantes reabre el agujero, y no falla nada visible.**

**2. `ClusterLayer` decide si redibujar comparando SOLO los ids de las propiedades**, y eso dejó de alcanzar. Una propiedad en venta **y** en alquiler aparece en los resultados de los dos filtros: al cambiar el filtro de operación **el conjunto de ids no cambia**, el diff corta temprano y el pin se queda mostrando el precio de la operación anterior. No rompe nada y no da síntoma — solo muestra un número equivocado. Lo resuelve un **efecto aparte**, con el mismo patrón que la selección y los favoritos: se actualiza lo que cambió en vez de recrear markers. Depende de la clave estable `filters.operation_types.join(",")` y lee las operaciones de una ref; si el marker está en el DOM le cambia el texto del precio (`setMarkerPrice`), y si está clusterizado le rehace el ícono. **No meter el precio en la firma del diff**: obligaría a destruir y recrear todos los markers en cada cambio de filtro para actualizar un texto, perdiendo las clases de estado vivas y las transiciones CSS que ese diff existe para preservar.

**3. Un Enter en un input de texto dentro de un `<form>` dispara el submit implícito.** En el campo de requisitos libres eso **publicaría la propiedad a medio cargar**. Está prevenido explícitamente:

```tsx
onKeyDown={(e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  add();
}}
```

**Es el patrón a seguir para cualquier campo futuro que agregue elementos a una lista**: el Enter tiene que agregar (es lo que el dedo espera), y el `preventDefault()` es lo único que impide que además envíe el formulario. El botón que acompaña va con `type="button"`, nunca `submit`.

### Mapa — performance
- Debounce 400ms en `moveend`. `ClusterLayer` diff por ids (**⚠ ese diff no detecta un cambio de precio por filtro de operación: ver la trampa 2 en "Operaciones, precios y requisitos"**). `useProperties` con SELECT acotado, no `*`. La lista mobile usa `bounds = null` (toda la ciudad).
- **⚠ El SELECT del hook es una lista EXPLÍCITA de columnas y el resultado se castea por `unknown`**, así que una columna que falte llega como `undefined` sin que el compilador diga nada (el pin imprimiría `NaN`). Las nueve columnas de operación/precio tienen que estar todas. Los requisitos de alquiler **NO** están ahí a propósito: no se muestran ni en el pin ni en la card, y esa es la query caliente. El modal usa `select("*")` y hereda las columnas solas, más los embeds de imágenes, agente y **agencia** (esta última con solo `name, logo_url` nombradas: ver "Quién publica").

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
- **Convención de `supabase/pending/`:** un cambio de schema todavía sin aplicar se escribe
  en `supabase/pending/<fecha>-<tema>.sql`. **Cuando se aplica, su contenido se traslada al
  schema documentado y el archivo se borra.** Que la carpeta esté **vacía** es el estado
  sano: un archivo ahí significa que la base y el schema no coinciden (y que el schema, a
  propósito, todavía no afirma lo que la base no tiene).
- ⚠ **El usuario de solo lectura NO ve permisos por `information_schema`**: `role_table_grants` y
  `column_privileges` devuelven vacío, y tampoco puede ejecutar `agency_is_publicly_visible` (`42501`).
  **Quien audite permisos así va a concluir que no hay ninguno.** Medir con `pg_class.relacl`,
  `pg_attribute.attacl` o `has_*_privilege` con el rol explícito (`has_table_privilege('anon', …)`).
  Es una limitación de la herramienta, no del proyecto.
- Grupos de tools habilitados: `database`, `debugging`, `development`, `docs`. Storage,
  branching, edge functions y gestión de cuenta están deshabilitados a propósito.

Schema en `supabase/migrations/20240101000000_initial_schema.sql`.

| Tabla | Descripción |
|---|---|
| `cities` | Mercados. Centro del mapa y zoom por ciudad. **No tiene límites geográficos** (solo `center_lat`/`center_lng`/`default_zoom`): por eso el buscador de direcciones usa un umbral de distancia en vez del ejido real |
| `agencies` | Inmobiliarias. `city_id` NOT NULL. `tenant_type` (`agency`/`individual`) **legacy**: el registro escribe siempre `'agency'`; nada de la base la lee (verificado: 0 funciones y 0 policies la mencionan). `phone_wa` NOT NULL. `license_number` (matrícula, TEXT nullable) + `approval_status` (`pending`/`approved`/`rejected`, DEFAULT `pending`). **`previous_name` + `name_change_requested_at`** (las dos nullable, sin default y sin CHECK): el rastro de un cambio de nombre esperando decisión — se escriben juntas al pedirlo y se limpian juntas al resolverlo; ver "El cambio de nombre de la agencia". `brand_color` para white-label futuro. ⚠ **`name` solo tiene `NOT NULL`**: sin unicidad, sin largo máximo y sin CHECK — el único `UNIQUE` de la tabla es el de `slug` |
| `subscriptions` | `plan` (el que RIGE) + `pending_plan` (pedido, esperando activación) + `status` (`active`/`pending`/`past_due`/`canceled`), `property_limit`, entitlements `has_*`, `activated_at` (desde cuándo rige el pago) y `current_period_end` (vencimiento; **lo escribe el panel, no lo vigila nadie**). Por agencia. ⚠ **`status = 'pending'` significa UNA sola cosa: "todavía no tiene nada activo"** (agencia recién registrada que eligió plan y espera). **NO significa "pidió un upgrade"**: para eso está `pending_plan`, que es **la única señal de que hay un pedido abierto**. Ver "Un pedido de plan abierto". ⚠ **`past_due` NO lo escribe ningún camino del código** (medido): está en el CHECK y lo leen tres lugares, pero es inalcanzable — hoy la columna tiene **tres** valores producibles, no cuatro |
| `agents` | `id` = `auth.users.id`. `agency_id` NOT NULL. `role` (`admin`/`agent`) gatea la sección Equipo. `email` denormalizado de auth.users (copia de lectura) |
| `properties` | `agency_id` y `city_id` NOT NULL; `location` GEOGRAPHY generada. **Tres pares de operación** (`for_sale`/`sale_price`/`sale_currency` y sus equivalentes de `rent` y `temp_rent`): al menos una activa, precio y moneda siempre juntos o los dos NULL (= "a convenir"). **Requisitos de alquiler** en dos JSONB: `rent_requirements` (lista cerrada) y `rent_requirements_other` (hasta 5 strings de hasta 300). `location_source` (TEXT nullable, CHECK `manual`/`suggested`): de dónde salió la coordenada. **Dato de medición: no gatea nada**. `views_count` (INT NOT NULL DEFAULT 0): lo incrementa **solo** `increment_views()`, acumulado desde siempre y **sin fechas**. ⚠ `location` es la **única columna generada** de la tabla, y eso importa en cualquier trigger BEFORE (ver "Método de Diagnóstico") |
| `property_images` | `is_cover` + `sort_order` |
| `leads` | Contactos WA. `agency_id` NOT NULL (por eso una consulta nunca pierde a qué agencia pertenece). **`agent_id` NULLABLE + FK `ON DELETE SET NULL`**: una consulta es un hecho histórico y **sobrevive al agente que la atendió**. **`agent_name` (TEXT nullable) es la COPIA CONGELADA del nombre**, la escribe el trigger `trg_set_lead_agent_name`, **nunca el cliente**. Sin ningún CHECK. Se listan en `/dashboard/leads` (Consultas), diferenciado por rol vía RLS. Ver "La consulta sobrevive al agente" |
| `agency_reviews` | Historial de decisiones del dueño sobre una agencia, de los DOS ejes en una sola línea de tiempo. `decision` admite **seis** valores (medido): `approved`/`rejected` (legitimidad) + `plan_canceled`/`subscription_canceled`/`subscription_restored`/`plan_changed` (comercial). **La eliminación de una agencia NO se registra** (la FK cascadea: la fila se borraría con lo registrado). **RLS habilitada y CERO policies a propósito**: solo service role desde el server. Ahí vive la nota del rechazo, que no puede ir en `agencies` porque esa tabla es de lectura pública |

**Función `agency_is_publicly_visible(agency_id)`** (SECURITY DEFINER, STABLE): aprobada + suscripción `active` + plan `<> 'free'`. **Es la regla de cobro y la usan las tres policies públicas** (ver "Visibilidad pública de las propiedades").

**Policies RLS clave:** lectura pública de cities/agencies; lectura pública de properties `active` **y de agencia visible**, y de sus imágenes con la misma condición; agentes ven y gestionan lo suyo (`Agent manages own properties`: `USING agent_id = auth.uid()` + `WITH CHECK` que además fija `agency_id` y `city_id` a los del propio agente, desde el 16 sep 2026) + leen propiedades de su agencia (para el conteo); el admin gestiona las propiedades de su agencia vía **service role + validación** (`authorizePropertyAccess`), NO por policy nueva; `agents` solo admite UPDATE del propio perfil y solo sobre `full_name`/`phone_wa`/`avatar_url` (GRANT por columna, sin INSERT ni DELETE para usuarios); `Agent reads own leads` (un agent ve los suyos) + `Admin reads agency leads` (un admin ve los de toda su agencia — Fase 3, ya aplicada); `Public insert lead` valida que property+agent+agency coincidan **y que la agencia sea públicamente visible**; escritura de subscriptions solo service role.

⚠ **Sobre las tres policies de `leads`, que NO se tocaron cuando `agent_id` pasó a nullable** (acá decía *"no contempla `agent_id IS NULL`, y hoy ese caso no puede existir: la columna es NOT NULL"* — la columna ya **no** es NOT NULL, y el caso **sí** existe):
- **`Public insert lead` sigue igual, y eso es lo que hay que preservar.** Un `agent_id` nulo entrante hace que `p.agent_id = leads.agent_id` dé NULL, el `EXISTS` dé `false` y **el insert se rechace** (medido en el motor). Es la **única barrera de escritura pública** de la tabla: aflojarla dejaría a cualquiera fabricar consultas sin agente, con el `agent_name` que se le antoje. **La nullabilidad de la columna no abre nada mientras esta policy quede como está.**
- **`Agent reads own leads` cambió de alcance efectivo sin cambiar de texto**: ya no alcanza las consultas desvinculadas, que pasan a verlas solo los admins. Ver "La consulta sobrevive al agente" → cambio de alcance, incluido por qué **no** hay que agregarle un `OR agent_id IS NULL`.

#### ⚠ Permisos de escritura del usuario: `agents`, `properties` y `property_images` (16 sep 2026)

> Se aplicó a mano en el SQL Editor y está transcripto en el archivo de schema. Cierra tres agujeros
> medidos: un usuario autenticado podía **cambiarse `role` y `agency_id`** (la tabla entera era
> escribible por `anon` y `authenticated` y la policy de UPDATE no tenía `WITH CHECK`); la policy de
> INSERT `Agent creates own profile` (`WITH CHECK id = auth.uid()`) dejaba que **un usuario de Auth
> SIN fila en `agents` se insertara como `admin` de cualquier agencia**; y `Agent manages own
> properties` (ALL, sin `WITH CHECK`) dejaba **insertar o mover una propiedad propia hacia otra
> agencia** — los triggers de publicación no lo frenaban porque evalúan `NEW.agency_id`, o sea que
> validan a la agencia **destino**.

**Cómo quedó (medido con `pg_policy`, `has_column_privilege` y `pg_class.relacl`):**

| Tabla | Policy de escritura | `USING` | `WITH CHECK` |
|---|---|---|---|
| `agents` | `Agent manages own profile` (UPDATE, `authenticated`) | `id = auth.uid()` | `id = auth.uid()` |
| `properties` | `Agent manages own properties` (ALL, `authenticated`) | `agent_id = auth.uid()` | `agent_id = auth.uid()` **AND** `agency_id = auth_agency_id()` **AND** `city_id` = la ciudad de `auth_agency_id()` |
| `property_images` | `Agent manages own property images` (ALL, `authenticated`) | la propiedad es mía | idéntico al `USING` (mismo comportamiento que antes, escrito en las dos direcciones) |

- **`agents`: `anon` y `authenticated` no tienen INSERT, UPDATE, DELETE ni TRUNCATE sobre la tabla.** `authenticated` tiene UPDATE **solo sobre `full_name`, `phone_wa` y `avatar_url`**. `Agent creates own profile` **ya no existe**.
- **Por qué:** `role` y `agency_id` gobiernan la autorización de toda la app —`resolveAgentSession`, `auth_agency_id()` y, a través de ella, las policies de Storage y el `WITH CHECK` de `properties`—, así que no pueden ser escribibles por el propio usuario. **El `WITH CHECK` de `properties` confía en `auth_agency_id()`, que es confiable solo porque `agents.agency_id` no es escribible.**
- **Las altas de `agents` se hacen SOLO con service role** (`registerAction` y `createAgentAction`): por eso no hay permiso ni policy de INSERT.
- **El CHECK de dominio de `role` EXISTE** (`agents_role_check`: `role IN ('admin','agent')`, medido). ⚠ Un informe anterior basado en el MCP afirmó que no existía: era falso.
- Los caminos del admin de agencia (reasignar `agent_id`, publicar a nombre de otro) no cambiaron: van por service role, que saltea las policies.

**⚠ `/admin` se gatea por `ADMIN_USER_ID`, NO por `agents.role`.** Que `role` deje de ser escribible protege "Equipo", las consultas de la agencia y la gestión de propiedades ajenas; el panel de plataforma nunca dependió de esa columna.

**⚠ `supabase.auth.signUp` devuelve sesión EN EL ACTO con la configuración actual.** La autoconfirmación de email está activa —inferido de `auth.users`: en las cuentas recientes `email_confirmed_at` llega **entre 25 y 38 ms** después de `created_at` (medido el 16 sep 2026)—. Consecuencia: **una cuenta recién registrada, sin agencia aprobada, ya tiene un JWT válido** con el rol `authenticated`, y cualquiera puede conseguir uno con la anon key sin pasar por el formulario. **La seguridad no puede depender de la aprobación de la agencia ni del formulario de registro**: tiene que vivir en los permisos y las policies. (⚠ El comentario de `register/actions.ts` que justifica el service role nombra la policy `Agent creates own profile`, que **ya no existe**: hoy el insert con el client normal rebotaría por falta de permiso de INSERT, haya sesión o no.)

##### ⚠ TRAMPA 1 — Una columna nueva de `agents` editable por el usuario exige un GRANT por columna

La policy de UPDATE filtra **filas**; qué **columnas** se pueden escribir lo decide el `GRANT UPDATE (…)`. Agregar a `agents` una columna que el usuario deba editar con su sesión **exige** `GRANT UPDATE (columna) ON public.agents TO authenticated`. Sin él, esa escritura falla con **`42501 permission denied for table agents`**, aunque la policy la permita y aunque la columna esté en el mismo `update()` que `full_name`. Hoy el único UPDATE con sesión es `updateProfileAction` (`dashboard/perfil/actions.ts`), que escribe exactamente las tres columnas habilitadas.

##### ⚠ TRAMPA 2 — Los triggers de publicación leen `subscriptions` con la RLS del usuario

`check_property_limit()`, `check_agency_subscription()` y `check_agency_approved()` **NO son SECURITY DEFINER** (medido: `prosecdef = false` en las tres). Corren con los permisos de quien escribe, así que su `SELECT` sobre `subscriptions` pasa por la policy `Agency members read own subscription`. Si el usuario **no ve** la fila de suscripción de `NEW.agency_id`:

- `check_property_limit()` toma `max_allowed` NULL → 0 y rechaza con *"Límite de propiedades alcanzado para el plan actual (máximo: 0)"*, **aunque la agencia tenga cupo**;
- `check_agency_subscription()` recibe `NULL`, `NULL IN ('canceled','past_due')` da NULL y **deja pasar**.

Se vio en las pruebas del 16 sep 2026: antes del cambio, un INSERT con `agency_id` ajeno fallaba **con ese "máximo: 0"** —el usuario no veía la suscripción ajena— y abriendo a propósito la lectura de `subscriptions` el mismo insert pasaba. **Ese rechazo nunca fue la barrera contra escribir en otra agencia; la barrera es el `WITH CHECK`.**

**Consecuencia viva:** si alguien restringe la lectura de `subscriptions` (por ejemplo, solo para admins), **los agentes comunes dejan de poder publicar**, con un mensaje de cupo que no tiene nada que ver. (`check_agency_approved()` lee `agencies`, hoy de lectura pública con `USING (true)`: restringir esa policy tendría el mismo efecto sobre la aprobación.)

##### Blindaje de columnas (16 sep 2026): contador de visitas, URLs de archivos y teléfonos

Cuatro reglas que vivían solo en las server actions pasaron a la base (aplicado a mano, transcripto en el archivo de schema → "BLINDAJE DE COLUMNAS"): `trg_protect_views_count` (las sesiones `anon`/`authenticated` no escriben `views_count`; `increment_views()` y service role sí), los CHECK `property_images_url_storage`, `agents_avatar_url_storage` y `agencies_logo_url_storage` (URL del Storage público del proyecto), y `agents_phone_wa_format` / `agencies_phone_wa_format` (`^549[1-3][0-9]{9}$`). Las actions validan lo mismo **antes** de escribir (`lib/utils/storagePublicUrl.ts`, `lib/utils/phoneWa.ts`) y traducen el rechazo por el **nombre** de la constraint (`lib/utils/dbFormatErrors.ts`), nunca solo por el código: todo CHECK levanta 23514, igual que los gates de publicación.

##### ⚠ TRAMPA 3 — Los CHECK de URL llevan escrito el host del proyecto

`https://mrvkurpampyucoonwgmy.supabase.co/storage/v1/object/public/property-images/` está literal en los tres CHECK. **Migrar a otro proyecto de Supabase exige un ALTER de los tres** y que `NEXT_PUBLIC_SUPABASE_URL` apunte al mismo host, porque `storagePublicUrl.ts` arma el prefijo desde esa variable. Si cambia solo uno de los dos lados, la app deja pasar URLs que la base rechaza, o rechaza las que la base acepta.

##### ⚠ TRAMPA 4 — Un CHECK se evalúa en cualquier INSERT/UPDATE de la fila, aunque no toque esa columna

Un dato viejo inválido **bloquea toda edición de su fila**: un agente con un teléfono mal formado no podría cambiar ni su nombre, y una acción de `/admin` sobre su agencia fallaría. Antes de agregar un CHECK hay que medir las filas que lo violan y corregirlas; para estos se corrigieron dos teléfonos de prueba sin el 9 (`543853000299` → `5493853000299`). En la edición de propiedades además las imágenes se **borran antes** de insertar las nuevas: por eso las URLs se validan en la action antes de cualquier escritura, o un rechazo de la base dejaría la propiedad sin fotos.

##### ⚠ TRAMPA 5 — `protect_views_count()` no puede ser SECURITY DEFINER

Decide por `current_user`, y dentro de una función SECURITY DEFINER `current_user` es **su dueño** (documentación de PostgreSQL). Siendo DEFINER vería siempre `postgres` y no bloquearía a nadie. Es el mismo mecanismo que deja pasar a `increment_views()`: SECURITY DEFINER con dueño `postgres`, así que su `UPDATE` llega al trigger con `current_user = 'postgres'`.

##### ⚠ TRAMPA 6 — La protección del contador y la guarda de `updated_at` usan mecanismos distintos, a propósito

La guarda reconoce a `increment_views()` por la variable `marka.skip_updated_at` (ver abajo). **Esa variable no sirve como permiso: cualquier sesión puede ponerla** con `set_config()` en su propia transacción (probado: un agente con la variable en `'on'` escribía el contador antes del trigger). Para la guarda alcanza —lo peor que logra quien la pone es no mover su propio `updated_at`—; para proteger el contador hace falta el rol. No "unificar" los dos mecanismos.

##### ⚠ TRAMPA 7 — Aceptar líneas fijas exige aflojar los CHECK de teléfono

`resolvePhoneWaForSave` (`phoneWa.ts`) preserva sin validar un valor igual al guardado; con el CHECK en la base, un valor guardado siempre cumple el formato. Pero si algún día se aceptan **líneas fijas** (hoy el formato exige el `549` de celular), no alcanza con cambiar `phoneWa.ts`: hay que aflojar `agents_phone_wa_format` y `agencies_phone_wa_format` con un ALTER, o el formulario acepta un número que la base rechaza.

##### Cupo de destacadas (16 sep 2026)

`subscriptions.featured_limit` (INT NOT NULL DEFAULT 0) con los CHECK `subscriptions_featured_limit_nonnegative` y `subscriptions_featured_coherence`, `enforce_featured_quota()` + `trg_featured_quota` (BEFORE INSERT OR UPDATE ON `properties`, SECURITY DEFINER) y `clear_featured_on_zero_quota()` + `trg_clear_featured_on_zero_quota` (AFTER UPDATE OF `featured_limit` ON `subscriptions`). Transcripto en el archivo de schema → "CUPO DE DESTACADAS". En el código: `getFeaturedUsage` (`lib/utils/`) cuenta como el trigger —todas las destacadas de la agencia, de cualquier status y agente— y las actions de propiedades lo usan antes de escribir.

##### ⚠ TRAMPA 8 — Toda escritura de `subscriptions` que ponga `has_featured` tiene que poner `featured_limit`

El CHECK `subscriptions_featured_coherence` obliga a `has_featured = (featured_limit > 0)`. Un UPDATE que escriba solo `has_featured: true` —el patrón de antes— rebota con 23514, y las acciones de `/admin` lo muestran como un error genérico. Las seis escrituras de hoy (activar, dar de baja, reactivar, cambiar de plan, registro y selección de plan) escriben los dos desde `PLANS[plan].featuredLimit`. El DEFAULT 0 es lo que deja que `ensure_agency_subscription()`, que inserta solo `agency_id`, siga cumpliendo el CHECK.

##### ⚠ TRAMPA 9 — El rechazo de cupo usa el SQLSTATE propio `MKF01`

Y un texto sin "Límite", "suscripción" ni "no está aprobada". **Un traductor que mire solo 23514 no lo ve**, y uno que busque esas palabras lo confundiría con otro gate. `translatePropertyWriteError` tiene una rama propia por `code === "MKF01"`, antes del cajón de sastre. Cambiar el código o sumarle una de esas palabras al texto lo manda a otra rama sin ningún error.

##### ⚠ TRAMPA 10 — Vendida o alquilada apaga la estrella en la base

`enforce_featured_quota()` pone `is_featured := false` cuando el status es `sold` o `rented`. Cualquier camino que cambie el status —el menú del listado, el select "Estado" del formulario de edición, o uno futuro— lo hereda sin escribir nada. Pausar no la apaga.

##### Cupo de destacadas: la decisión de producto y la interfaz

- **Cupos: free 0, inicial 0, profesional 3, premium 10.** 3 y 10 (y no 10 y 20) porque **una destacada vale por ser escasa** y premium tiene que diferenciarse; profesional las incluye para que las agencias las prueben desde el principio.
- **`has_featured` se conserva** y la base lo obliga a coincidir con `featured_limit > 0`. `PLANS[plan].featuredLimit` reemplazó al viejo flag `featured` del catálogo.
- **Bajar el cupo:** a 0 apaga todas (`trg_clear_featured_on_zero_quota`); si baja sin llegar a 0, las que sobran quedan. **Subir el cupo no las vuelve a encender.**
- **Formulario:** la casilla "Destacada" aparece solo con cupo > 0, con el contador *"Destacadas: X de Y"*; se deshabilita con el cupo lleno (salvo que la propiedad ya fuera destacada) y en vendida/alquilada. **No hay descarte silencioso**: con el cupo lleno la action devuelve el error.
- **Textos de plan** por `featuredQuotaFeatureLabel` (registro, suscripción, `/admin`); `/admin` muestra el cambio de cupo al cambiar de plan; `/dashboard/suscripcion` muestra *"Destacadas: X de Y"*.
- **Listado del panel:** estrella junto al título, chip `FeaturedBadge` con las clases de `PlanBadge` y, para un agente común, la nota *"El cupo de destacadas es de toda la inmobiliaria."*

##### El menú de tres puntos del listado

- **"Marcar como vendida/alquilada" solo en `active`/`paused`, y con `AlertDialog`.** Antes se marcaba con un toque y la agencia **no podía deshacerlo desde el menú**.
- **"Volver a publicar"** en vendida/alquilada (`activatePropertyAction`): respeta el límite de propiedades, y **la estrella no vuelve**.
- **"Destacar" / "Quitar destacada"** (`setPropertyFeaturedAction`); con el cupo lleno, deshabilitada con *"Cupo completo"*.
- `markAsSold`/`markAsRented` traducen el error de la base; el botón de tres puntos tiene área de toque de 44 px.
- **La estrella es SIEMPRE SVG** (`FeaturedStarIcon`; `STAR_SVG` en el pin), **nunca el carácter ★**, que DM Sans no cubre. En el pin, el círculo de la estrella se trata como el del corazón. ⚠ **Dorado para lo que ve el visitante** (pin, modal, ficha); **en el panel la estrella hereda el color del texto** (`text-current`), también en foco y deshabilitada. Ver DESIGN §2.
- **El pin destacado conserva su anillo `paper` de 2 px** y los círculos de estrella y corazón lo heredan: distingue el pin destacado **de lejos**, cuando la estrella de 9 px no se ve.

**Query principal:**
```sql
SELECT ... FROM properties
WHERE city_id = $1 AND status = 'active'
  AND lat BETWEEN $south AND $north AND lng BETWEEN $west AND $east;
```

**Amenities** JSONB: filtrar con `.contains("amenities", JSON.stringify([...]))` (genera `@>`). ⚠ **No tiene barrera de dominio en ninguna capa** (zod `z.array(z.string())`, la action escribe sin filtrar, la columna no tiene CHECK): lo que se cuele ahí se renderiza en el modal público. Es deuda anotada — el molde para arreglarlo es el de los requisitos de alquiler. Ver PENDIENTES.md.

**Triggers de `properties` (los TRES gates de publicación, ver "Bloqueo de publicación"), en el orden alfabético en que Postgres los dispara:** `trg_check_agency_approved` (BEFORE INSERT → agencia aprobada), `trg_check_agency_subscription` (BEFORE INSERT → suscripción no `canceled`/`past_due`) y `trg_check_property_limit` (BEFORE INSERT OR UPDATE → cupo del plan; sin fila de suscripción el límite es 0). Los tres lanzan SQLSTATE **23514**, así que **ese orden decide qué mensaje ve el agente**. (Hay además dos `trg_*_updated_at` sobre `properties` y `subscriptions` —ver la guarda, abajo— y, desde el 16 sep 2026, `trg_protect_views_count` sobre `properties`, que lanza **42501** y no 23514: ver "Blindaje de columnas", arriba; y `trg_featured_quota`, que lanza **MKF01**: ver "Cupo de destacadas", abajo.) **Orden alfabético actual de los BEFORE de `properties` (medido el 16 sep 2026):** `trg_check_agency_approved` → `trg_check_agency_subscription` → `trg_check_property_limit` → `trg_featured_quota` → `trg_properties_updated_at` → `trg_protect_views_count`.

#### ⚠ La guarda de `updated_at` ante el contador de visitas — dos funciones ACOPLADAS

**Qué resuelve.** `properties.updated_at` **no es una fecha interna**: es el `lastModified` que el mapa del sitio le informa a los buscadores por cada ficha. `increment_views()` es un `UPDATE` sobre `properties`, así que **disparaba el trigger que sella esa fecha**, y cada visita le decía a Google que la propiedad había cambiado. Con el tiempo eso le enseña que las fechas del sitio no significan nada.

**Cómo funciona** (medido contra la base el 14 sep 2026 y transcripto en el archivo de migración):

| Función | Qué hace |
|---|---|
| `increment_views(property_id uuid)` | `plpgsql`, `SECURITY DEFINER`, `search_path` fijo. **Escribe** `set_config('marka.skip_updated_at', 'on', true)` → `UPDATE properties SET views_count = views_count + 1` → `set_config(…, 'off', true)` |
| `update_updated_at()` | **Lee** la variable: si es un `UPDATE` y vale exactamente `'on'`, conserva `OLD.updated_at`; en **cualquier otro caso** sella `now()`, como siempre |

- **⚠⚠ ESTÁN ACOPLADAS POR UN STRING, Y ROMPER EL ACOPLE NO FALLA: SE APAGA EN SILENCIO.** El vínculo es el nombre `'marka.skip_updated_at'` y el valor `'on'`, escritos en los dos cuerpos, y **nada lo verifica**. Renombrar la variable, cambiar el valor o sacar el `set_config` de un solo lado apaga la guarda **sin ningún error**: el contador sigue subiendo bien y cada visita vuelve a mover la fecha. Al revés: otra función que pusiera la variable en `'on'` y actualizara algo más que el contador haría que **esa modificación real no sellara la fecha**, también sin error. **Quien toque una, tiene que leer y tocar la otra.**
- **⚠ LA VARIABLE ES LOCAL A LA TRANSACCIÓN (el `true` del tercer argumento), y tiene que serlo.** Con `false` quedaría puesta en la **conexión**, que PostgREST y el pooler reutilizan entre requests de distintos usuarios: se filtraría a la edición de una propiedad o a un cambio de estado posterior, que **dejarían de sellar la fecha sin error y sin forma de saber cuáles**. Local, muere con el COMMIT o el ROLLBACK de la llamada. El `'off'` posterior cubre el caso de que se la invoque dentro de una transacción más grande.
- **⚠ EL TRIGGER ES COMPARTIDO CON `subscriptions`** (`trg_subscriptions_updated_at` usa la misma `update_updated_at()`, medido), así que **la guarda también rige ahí**: un `UPDATE` sobre `subscriptions` dentro de una transacción con la variable en `'on'` conservaría su fecha anterior. **Hoy no ocurre**: la única función que pone la variable en `'on'` es `increment_views()`, y entre su `'on'` y su `'off'` solo toca `properties`. Tampoco lo notaría nadie: **ningún código lee `subscriptions.updated_at`** (solo figura en el tipo `Subscription`). Si algún día otra función usa la variable, este párrafo deja de ser cierto.
- **Verificada con visitas reales**, no solo en el SQL Editor: después de aplicarla, "Casa Largo" pasó de 2 a 5 visitas sin mover su `updated_at`, y "Casa demo" de 0 a 2 conservando la fecha del 3 sep.
- **⚠ El primer intento —comparar la fila vieja con la nueva— falló siempre por una trampa de PostgreSQL con las columnas generadas.** Ver "Método de Diagnóstico". **No volver a ese enfoque "porque es más limpio".**

**Trigger de `leads`:** `trg_set_lead_agent_name` (BEFORE INSERT → `set_lead_agent_name()`) copia `agents.full_name` en `leads.agent_name`. Es el **único** trigger de esa tabla. **BEFORE y no AFTER** (modifica `NEW` antes de escribir la fila, sin un UPDATE posterior) y **solo INSERT** (la copia es congelada: no debe recalcularse en ningún UPDATE). Ver "La consulta sobrevive al agente".

**Trigger de `agencies`:** `trg_ensure_agency_subscription` (AFTER INSERT → `ensure_agency_subscription()`) crea la fila de `subscriptions` de toda agencia nueva. **Es lo que vuelve imposible el estado "agencia sin suscripción"**, y su cuerpo no escribe ningún valor salvo la clave: los `DEFAULT` de la tabla ya son el estado de aterrizaje. Ver "Toda agencia nace con su suscripción".

**Funciones y RPC:** `agency_is_publicly_visible(target_agency_id)` — la regla de visibilidad pública, SECURITY DEFINER + STABLE, invocada por tres policies y por `resolveAgencyBySlug` (ver "Visibilidad pública de las propiedades"). `jsonb_is_short_string_array(arr, max_len)` — IMMUTABLE, la usa el CHECK `properties_rent_requirements_other_items`; **existe porque un CHECK no admite subconsultas** y recorrer un array JSONB exige `jsonb_array_elements()`, que devuelve filas: meter el SELECT dentro del CHECK no compila. `increment_views(property_id uuid)` — incrementa `views_count`; `plpgsql`, SECURITY DEFINER, `search_path` fijo, `EXECUTE` para `anon` y `authenticated`, **sin ninguna validación adentro**. La llama **solo** `registerView` desde el navegador (ver "Visitas y consultas por propiedad"), y **está acoplada a `update_updated_at()`** por la variable `marka.skip_updated_at` (ver la guarda, arriba). ⚠ **Acá decía que "existe pero NO se la llama desde ningún lado, así que `views_count` es 0 en todas las propiedades"**: era cierto hasta el 14 sep 2026 y dejó de serlo (medido ese día: 17 visitas en 8 propiedades). `ensure_agency_subscription()` — SECURITY DEFINER, `search_path` fijo; la dispara `trg_ensure_agency_subscription` sobre `agencies` (ver arriba). `set_lead_agent_name()` — SECURITY DEFINER, `search_path` fijo, VOLATILE; la dispara `trg_set_lead_agent_name` sobre `leads`. **Es SECURITY DEFINER porque el INSERT lo hace `anon`**: hoy `Public read agents` tiene `USING (true)`, pero esa es una policy que conviene restringir algún día (expone email y teléfono de todos los agentes a la anon key), y sin SECURITY DEFINER ese `SELECT` dejaría de ver la fila y **toda consulta nueva quedaría sin nombre EN SILENCIO** — sin error, sin síntoma, y sin forma de reconstruirlo después.

**⚠ Event trigger `ensure_rls`** (función `public.rls_auto_enable()`, SECURITY DEFINER): en `ddl_command_end`, **habilita RLS automáticamente en toda tabla nueva del esquema `public`**. Consecuencia práctica: una tabla nueva nace con RLS activada **y sin policies**, o sea invisible para todos —incluido el dueño— hasta que se le escriban. No es un bug: es la red de seguridad que evita publicar una tabla sin querer.

---

## Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # Requerido: registro de agentes + suscripciones
ADMIN_USER_ID=                 # Requerido para /admin: auth.uid() (UUID) del dueño de la plataforma. Server-side (sin NEXT_PUBLIC_). Fail-closed: si falta, /admin deniega a todos
NEXT_PUBLIC_SITE_URL=          # ⚠ REQUERIDA PARA QUE EL PROYECTO ARRANQUE. Dirección pública del sitio, SIN barra al final (ej: https://marka.com.ar; en local http://localhost:3000). La leen metadataBase (disposición raíz), la página pública de la propiedad (canónica + enlace a compartir), el mapa del sitio y robots.txt. Si falta, src/lib/utils/siteUrl.ts LANZA a propósito
NEXT_PUBLIC_MAPTILER_KEY=      # Opcional
GEOCODING_USER_AGENT=          # Opcional pero MUY recomendado en producción: User-Agent con contacto para el buscador de direcciones (política de Nominatim). Server-side (sin NEXT_PUBLIC_). Si falta, se usa un default que identifica la app pero no lleva dirección de contacto
GEOCODING_SIMULATE_OUTAGE=     # ⚠ SOLO PRUEBA LOCAL, NUNCA EN PRODUCCIÓN. Server-side (sin NEXT_PUBLIC_). Con cualquier valor distinto de vacío/"0"/"false", TODA búsqueda de direcciones devuelve "servicio no disponible" sin salir a la red. Existe para verificar a mano que una caída del buscador no rompe el alta ni la edición de propiedades (cortar internet no sirve: también corta Supabase y entonces no se puede guardar nada). Ausente = apagado
```

**`NEXT_PUBLIC_SITE_URL` es la única variable que CORTA si falta**, y es deliberado: `siteUrl.ts` lanza en vez de caer a un valor por defecto. La alternativa —caer a `http://localhost:3000` para que "ande igual"— es el peor de los dos mundos, porque el sitio construiría bien y **publicaría direcciones de localhost en la vista previa de los enlaces compartidos y en el mapa del sitio**, sin que nada avise; un fallo al construir se ve, una dirección equivocada indexada por Google no. ⚠ **No usar `VERCEL_URL`**: apunta al despliegue concreto, no al dominio, y cambia en cada publicación y en cada vista previa.

**Las dos del buscador de direcciones, en una línea:** ninguna es obligatoria para que la app arranque (la feature es un atajo). En **producción hay que setear `GEOCODING_USER_AGENT`** con una identificación que incluya contacto —lo pide la política de Nominatim— y **`GEOCODING_SIMULATE_OUTAGE` no debe existir**; es de uso local y mientras esté puesta ninguna búsqueda funciona. Ver "Ubicación de la propiedad".

---

## Comandos Útiles

```bash
npm run dev
npx tsc --noEmit
npm run lint          # debe dar 0 errors
npx next build
npx shadcn@latest add [componente]

npm run storage:huerfanos          # audita el bucket: detecta e imprime, NO borra nada
npm run storage:huerfanos:borrar   # ⚠ destructivo. Ver "Auditoría y limpieza de huérfanos"
```

> **No hay `supabase gen types`.** El proyecto NO usa tipos generados por el CLI de Supabase:
> `src/types/index.ts` se escribe a mano y es la única fuente de tipos del dominio. Si
> agregás una columna, la agregás ahí (y al schema documentado). Generar `supabase.ts` sin
> migrar todos los consumidores dejaría dos fuentes de verdad compitiendo.

---

## Decisiones de Arquitectura — No Cambiar sin Justificación

| Decisión | Razón |
|---|---|
| Marketplace por ciudad | La concentración de oferta es el valor; efecto de red |
| Multi-tenant (`agency_id`/`city_id`) | Permite white-label futuro sin reescribir |
| cityStore (Zustand) | Una sola instancia compartida; evita desincronización del selector con el mapa |
| getPlanUsage por agency_id | Coincide con el trigger; correcto en agencias multi-agente |
| Admin client para registro | La sesión no está disponible en server justo tras signUp. ⚠ **Con la configuración medida el 16 sep 2026 esto no es literal** (la autoconfirmación está activa y `signUp` devuelve sesión en el acto); el motivo que hoy sostiene la decisión es que `agents` **no tiene permiso ni policy de INSERT** para usuarios. Ver "Permisos de escritura del usuario" |
| El cupo de destacadas lo hace cumplir la base (`trg_featured_quota`), no la server action | Antes el gate vivía solo en las actions y descartaba en silencio; un agente podía encender destacadas llamando a la API directo. La action anticipa el rechazo para no escribir a medias, pero la barrera es el trigger |
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
| Tres pares de columnas por operación, no un array JSONB ni una tabla de ofertas | El array rompía el filtro de RANGO DE PRECIO, que necesita comparar contra una columna indexable; la tabla aparte obligaba a un JOIN en la query caliente del mapa. Con columnas, el filtro sigue siendo un `gte`/`lte` sobre un índice parcial |
| La moneda es POR OPERACIÓN, no por propiedad | En Argentina la venta se cotiza en dólares y el alquiler en pesos: con una moneda única, la casa en venta Y en alquiler —el caso que el modelo existe para representar— no se puede expresar |
| El alquiler temporal es una operación más, simétrica, no una modalidad del alquiler | Es más fiel a cómo lo piensa el rubro, y como modalidad habría obligado a rediseñar el filtro público para exponer un sub-eje |
| Precio opcional (NULL = "a convenir") | Pedido concreto del rubro: el precio en un mapa revela la tasación por m² de la zona, que es información competitiva. Con el precio obligatorio esas propiedades no se publicaban |
| Una propiedad sin precio queda FUERA del filtro de rango | Un rango numérico sobre un precio que no existe no significa nada. Sale gratis (comparar contra NULL no matchea) y el formulario se lo advierte al agente antes de que decida |
| El rango de precio solo se habilita con UNA operación marcada | Un precio de venta y uno de alquiler no viven en la misma escala, y no hay una sola columna contra la cual comparar: con dos operaciones el resultado parecería filtrado sin estarlo |
| La regla de qué precio mostrar vive en UNA función pura | El pin y la card muestran un solo número cada uno; si la regla se repartiera por componente, podrían elegir precios distintos para la misma propiedad y el mismo filtro |
| Los requisitos de alquiler SÍ validan en las tres capas (a diferencia de amenities) | El array cerrado se renderiza en el modal público. La única barrera real es el filtrado en la server action: el tipo de TypeScript se borra al compilar y el zod corre en el cliente |
| Los requisitos libres en su propia columna, no dentro del array cerrado | Uno es dato controlado y el otro es dato del usuario; mezclarlos volvería imposible confiar en el contenido del array |
| Leaflet en lugar de Mapbox | Tiles OSM gratuitos sin límite |
| `amenities` como JSONB | Flexible, sin migraciones al agregar amenities |
| `proxy.ts` (no middleware.ts) | Convención Next.js 16 |
| White-label en `/[slug]` del root (no prefijo, no subdominio) | Es lo que se vende: URL limpia. Las ciudades salen del root → sin colisión de namespace |
| `resolveAgencyBySlug` con service role | El visitante white-label es anónimo y la RLS de `subscriptions` le ocultaría `has_white_label`; sin service role, toda agencia parecería `disabled`. Server-only, campos no sensibles, sin tocar policies |
| `h-dvh` + lock de scroll del body (no `h-screen`) | `100vh` deja el documento scrolleable en mobile; el "scroll into view" al enfocar saca el header de flujo normal. `dvh` + lock atacan las dos condiciones de raíz, no los síntomas |
| Frontera de Storage por AGENCIA para propiedades y logos, y por USUARIO para avatares | La propiedad pertenece a la agencia, no al agente (el admin la edita y la reasigna; al borrar un agente sus propiedades pasan al admin), y **la primera carpeta de un path de propiedad es el que SUBIÓ el archivo, no el dueño**: con frontera por usuario, el equipo no puede gestionar sus propias fotos. El avatar sí es personal |
| La agencia del usuario se resuelve con `auth_agency_id()`, SECURITY DEFINER, y no con un subselect suelto | Un subselect queda atado a que `Public read agents` siga con `USING (true)`: si mañana se restringe esa lectura, **toda subida falla con un 403 sin relación aparente con `agents`**. La función corta esa dependencia oculta |
| Las carpetas del path se comparan EN TEXTO, nunca casteándolas a `uuid` | Para avatares y logos la primera carpeta es una palabra literal, y castearla **aborta la sentencia entera** (`22P02`), no devuelve `false`. Excluir los prefijos con un `AND` antes de castear no sirve: Postgres no garantiza el orden de evaluación de los `AND` |
| El `USING` y el `WITH CHECK` de la policy de UPDATE son idénticos | Controlan cosas distintas (qué archivo se toca vs. cómo queda después). Con solo el `USING` endurecido, se puede **renombrar** un archivo propio hacia la carpeta de otra agencia |
| Los límites de tamaño y tipo van en el bucket, no solo en el formulario | El JavaScript no es una barrera para quien habla con la API de Storage directo con su anon key: el "no SVG, riesgo XSS" del código no lo aplicaba nadie |
| Los archivos se borran EN EL ACTO, dentro de la misma action que borra la fila, best-effort pero nunca en silencio | Una cola o un proceso diferido sería infraestructura nueva para un problema chico. Y tragarse el error es cómo se llegó a que el 89 % del peso del bucket fuera basura: nadie se enteraba |
| Al borrar un agente se borra su avatar y NADA MÁS | La primera carpeta de un path de propiedad es quien SUBIÓ el archivo, y sus propiedades se reasignan al admin y siguen publicadas: barrer esa carpeta destruiría fotos en uso. Las fotos de propiedad se borran con la propiedad, nunca con una persona |
| Al borrar un agente, sus propiedades se REASIGNAN y sus consultas se DESVINCULAN | Son dos cosas de naturaleza distinta. Una propiedad es un activo vivo y tiene que seguir teniendo dueño; una consulta es un hecho histórico y **no cambia de dueño ni desaparece porque alguien se fue de la inmobiliaria**. Reasignarla mentiría sobre quién la atendió; borrarla perdería el historial comercial de la agencia |
| El nombre del agente en la consulta lo escribe un TRIGGER, no el insert del cliente | El camino que crea consultas es público y anónimo, `leads` no tiene ningún CHECK, y la policy de inserción no puede validar una columna de texto: sin el trigger no habría **ninguna** barrera y un visitante podría escribir cualquier cosa en la columna "Agente" del panel de una agencia |
| `leads.agent_name` es una copia CONGELADA, no una copia de lectura como `agents.email` | Registra cómo se llamaba el agente **cuando atendió esa consulta**. Sincronizarla con `agents.full_name` "para que no quede vieja" destruiría el dato histórico, que es su única razón de existir — y no daría ningún síntoma: solo empezaría a mentir sobre el pasado |
| El registro de la consulta no puede impedir el contacto por WhatsApp | La operación principal es el contacto, no el registro. El lead es para la agencia, no para el visitante, y no puede ser la razón por la que alguien no llegue a escribirle a una inmobiliaria. El error se captura y se avisa, en `graphite` y no en rojo: quien lee es un visitante al que no le falta nada |
| En `deletePropertyAction` el `DELETE` de la fila va ENTRE la lectura de las URLs y el borrado de los archivos | Leer primero es obligatorio (el CASCADE se lleva los paths), pero agrupar la lectura con el borrado paga un riesgo asimétrico: un archivo de más no lo ve nadie, una propiedad viva con sus imágenes destruidas la ven todos |
| Quitar una imagen desde el formulario se quedó en el navegador | El path ya está a mano y la frontera por agencia le da permiso al agente; moverlo al servidor sería un viaje de más. Lo que faltaba no era el lugar, era capturar el error |
| La limpieza de huérfanos es un script de línea de comandos, no una pantalla de `/admin` ni SQL | Una pantalla sería infraestructura permanente para un problema que los caminos arreglados ya no generan; y borrar filas de `storage.objects` con SQL **no borra el archivo**, lo deja facturándose y sin registro desde el cual encontrarlo |
| Logo de agencia: upload client-side + escritura de `logo_url` por service role (no upload por server action) | Lo sensible es la escritura en `agencies` (gateada a admin), no el archivo en Storage (bucket público). Reusa el patrón del avatar, no estrena upload server-side con FormData |
| `free` sobrevive como estado de aterrizaje al eliminar los particulares (no se borró del schema ni de `PLAN_ORDER`) | El plan cumplía dos funciones: plan comercial del particular (se eliminó) y estado inicial de toda alta (es el andamio de `plan`/`pending_plan`, del que dependen registro, activación en `/admin` y `getPlanUsage`). Borrarlo habría roto el flujo de upgrades |
| `tenant_type` no se borró al pasar a solo-agencias | Ninguna policy, función ni trigger la lee (verificado por consulta); borrar una columna NOT NULL con CHECK no aporta nada y la tabla `agencies` se vuelve a tocar en el trabajo de matrícula. Se cerró la puerta de entrada, no la columna |
| Guarda de reentrada de `/register/plan` en la página **y** en la action, no en `proxy.ts` | La server action se puede invocar sin pasar por el render, así que la página sola no alcanza. El proxy queda afuera porque necesitaría consultar `subscriptions` en el middleware: más caro y peor lugar |
| Estado de aprobación en `agencies`, independiente de la suscripción | "¿Es legítima?" y "¿paga?" son preguntas distintas y se cruzan libremente. Derivar una de la otra obligaría a inventar estados imposibles (una agencia aprobada que deja de pagar no deja de ser legítima) |
| La nota del rechazo en `agency_reviews` (RLS sin policies), no en `agencies` | `Public read agencies` (`qual: true`) hace legible **cualquier** columna de `agencies` con la anon key, y Postgres no permite restringir columnas dentro de una policy. Además, como el rechazo no es definitivo, cada decisión es una fila y no pisa la anterior |
| Índice único de matrícula PARCIAL (solo entre aprobadas de la misma ciudad) | Un UNIQUE común haría reventar el registro: la solicitud legítima nunca llegaría al panel y el formulario le confirmaría a un impostor qué matrículas existen. Con el parcial, el choque ocurre al aprobar, frente a una persona |
| Bloqueo de publicación por TRIGGER, no por policy RLS | `createPropertyAction` usa service role cuando un admin publica a nombre de otro agente, y el service role saltea las policies. El trigger corre siempre, sin importar el rol: es la única barrera que cubre los dos caminos |
| La visibilidad pública se decide en una **función de la base** invocada por policies, no con un filtro en cada consulta | Hay DOS caminos públicos que leen propiedades con la anon key (el hook del mapa y el modal por id): el filtro que se olvide en uno filtra mal en silencio. Medido antes de decidir: el acceso a la tabla caliente no se degrada, y las dos tablas del join tienen una fila por agencia |
| `agency_is_publicly_visible()` es SECURITY DEFINER | El visitante es anónimo y la RLS de `subscriptions` le oculta la fila: sin esto, la función daría `false` para todos y el mapa quedaría vacío para todo el mundo. Recibe un id, devuelve un booleano, `search_path` fijo |
| El white-label repite el gate de pago aunque ya mire `has_white_label` | `has_white_label` se escribe una vez al activar y nadie lo apaga por vencimiento: sin el gate, una agencia que deja de pagar conserva su sitio **mostrando un mapa vacío**, que parece un producto roto en vez de una suscripción vencida. Y `resolveAgencyBySlug` usa service role, que saltea las policies: ninguna lo cubre |
| Dar de baja conserva `plan` y NO toca `property_limit` | `plan` es el único registro de qué tenía contratado y a qué reactivar. Poner el límite en cero le mostraría "alcanzaste el límite de tu plan" —falso— y la mandaría a pagar un upgrade que no la destraba |
| Cambiar de plan se aplica directo, sin pasar por `pending_plan` | Ese modelo es para las solicitudes de la agencia; acá la decisión ya es del dueño y mandarse una solicitud a sí mismo no agrega control, agrega un paso |
| La agencia NO puede bajar de plan por autoservicio | Habilitaría pagar un mes de plan grande, cargar muchas propiedades y bajar al más barato conservándolas visibles. Que pase por el dueño es lo que lo hace seguro |
| El vencimiento vacío NO toca la columna al activar, pero SÍ la borra al cambiar de plan | Al activar no hay fecha previa que pueda quedar vieja; al cambiar sí, y esa fecha pertenece al plan viejo |
| Eliminar una agencia no se registra en `agency_reviews` | Esa tabla cascadea con la agencia: la fila que registra el borrado se borraría con lo borrado. Requeriría otra tabla sin FK, que hoy no existe |
| Los formularios del panel son paneles inline y no `AlertDialog` | El botón de acción del diálogo CIERRA al hacer click, así que un error de validación no tendría dónde mostrarse. Los sí/no puros sí van en diálogo |
| El reparto de mensajes de bloqueo es un `switch` exhaustivo con guarda `never` | Era un ternario binario y el motivo nuevo cayó en el `else`: una agencia dada de baja leía "alcanzaste el límite de tu plan". Con la guarda, agregar un motivo sin mensaje no compila |
| La sesión del área privada se resuelve en un solo helper cacheado (`resolveAgentSession`) | Estaba copiada en 21 lugares con 5 selects y 4 comportamientos distintos ante "no hay fila"; esa dispersión fue la causa raíz del bucle de redirecciones. `cache()` evita que centralizar cueste una consulta extra por página |
| Salida del bucle por route handler (`/logout`), no por action ni Server Component | Un Server Component no puede borrar cookies (documentado en `lib/supabase/server.ts`), así que no puede cerrar sesión; y una action se invoca desde un form, no desde un render. Solo el route handler puede hacer las dos cosas: cerrar la sesión y redirigir |
| La página de la propiedad va en `/propiedades/[slug]`, con prefijo | En el primer nivel ya vive el `[slug]` de agencia, y **dos rutas dinámicas hermanas en el mismo nivel son ambiguas**: el framework no las admite. No es estilo |
| La propiedad se lee con **service role** + la regla invocada a mano, no con el client de servidor | Con las policies los tres estados son **indistinguibles** (pausada, impaga e inexistente devuelven la misma lista vacía), así que la página solo podría hacer 404; y las tres policies de SELECT son permissive y se combinan con **OR**, así que un agente logueado vería publicada una propiedad que para el resto del mundo no lo está. Con service role el resultado es igual para todos |
| La regla de cobro se pregunta a la base **por RPC**, no se reescribe en TypeScript | Ya vive en `agency_is_publicly_visible()` y la invocan tres policies y el sitio de marca. Replicarla acá la dejaría escrita en tres lugares: el día que cambie, el mapa, el sitio de marca y esta página dirían cosas distintas y nadie se enteraría |
| El estado "no disponible" NO es un 404 | Quien llega casi siempre recibió el enlace de alguien —esa es la función de la página—, y un error de página inexistente le diría que el enlace estaba roto. No lo está: la propiedad existió y puede volver |
| La galería de la página es CSS puro, no el carrusel del modal | El carrusel guarda la foto activa en un `useState` y apila el resto con `opacity-0`: para un buscador existe **una sola foto**. En una página cuyo motivo de existir es ser indexada, eso es exactamente lo que no se puede hacer |
| El mapa de la página es una grilla de tiles estática, no Leaflet con `ssr: false` | Un Leaflet cargado solo en el cliente lo ve vacío un buscador, y arrastra la librería entera a una página que queremos rápida y con la que el 99 % de las visitas no va a interactuar. No hay API de imágenes estáticas disponible: OSM no ofrece una y la key de MapTiler está vacía |
| La vista previa al compartir usa la **foto real** de la propiedad, no una imagen generada | Generar una con `ImageResponse` sumaba una ruta, tiempo de build y otra fuente de verdad, para mostrar algo peor que la foto de la casa |
| El mapa del sitio lleva `force-dynamic` | Por omisión es un Route Handler **cacheado al construir**: serviría la lista del día del despliegue, con las propiedades nuevas invisibles y las dadas de baja todavía ofrecidas |
| `NEXT_PUBLIC_SITE_URL` corta si falta, en vez de caer a un valor por defecto | Caer a `localhost` sería el peor de los dos mundos: el sitio construiría bien y **publicaría direcciones de localhost** en la vista previa de los enlaces y en el mapa del sitio, sin que nada avise. Un fallo al construir se ve; una dirección equivocada indexada, no |
| Del modal se extrajeron **solo dos cosas**: la tabla de íconos de amenities y el registro de la consulta | Son las dos que **no se pueden duplicar sin que se rompan en silencio**: la tabla son 16 entradas exhaustivas por tipo (una amenity nueva en un solo lado no falla, solo muestra el ícono genérico), y el insert lleva encima cuatro decisiones de las cuales **la más frágil es una OMISIÓN** (`agent_name`), y las omisiones no se copian: se olvidan. El resto de la presentación son bloques de 12-25 líneas que solo componen helpers ya compartidos: extraerlos acoplaría dos pantallas que tienen que poder evolucionar distinto |
| En el modal el título NO es enlace; en la tarjeta de la lista SÍ | El modal vive sobre el mapa, donde un título clickeable se toca por accidente y saca al visitante del mapa sin que lo haya pedido. En la lista el visitante está leyendo, y el título como enlace es lo que espera |
| La puerta al área privada es UN componente compartido con variantes, no un enlace por pantalla | Estaba escrito en dos archivos con la detección de sesión duplicada **carácter por carácter**, y las copias ya divergían (una tenía `shrink-0` y la otra no). Con "Ingresar" no se notaba; con un texto tres veces más largo, sí. Mismo remedio que `AgentCell` tras el precedente de `AgenciesTable` |
| En el sitio de marca de una agencia NO va la captación | Ese sitio es lo que la agencia **compra con su plan**, y el marketplace es **por ciudad**: un llamado a sumar inmobiliarias ahí usa el espacio que paga un cliente para captar a su competencia directa, de su misma ciudad. Le da un argumento fácil para no renovar |
| En la ficha de propiedad tampoco va, por ahora | Quien llega desde un buscador está buscando una casa; y esa página existe para **renderizarse entera en el servidor**, así que un llamado que dependa de la sesión obligaría a estrenar una isla de cliente contra su razón de ser |
| El llamado de captación NO es terracota | En la home el terracota ya es del FAB "Ver lista / Ver mapa", la acción principal **del visitante**, que es el 99 % del tráfico. Mismo criterio que DESIGN §11 aplica a los dos botones del `LocationPicker`. La jerarquía contra el enlace vecino la da la caja, no el color |
| En pantalla chica se cae el LLAMADO y no el ingreso | Los cuatro elementos no entran en un teléfono (medido). El ingreso es la función que un cliente usa **todos los días** y el celular es donde más se navega: esconderlo ahí le agrega un paso a quien ya paga para ganar una conversión eventual de quien todavía no |
| Los dos estados de sesión se apilan en una celda y el inactivo se apaga con `visibility`, no con `display` | El que no se ve tiene que **seguir ocupando su celda** para que la grilla mida el máximo de los dos. Con `display: none` el ancho vuelve a depender de la sesión y reaparece el salto (medido: 195,2 px en `sm`+). La "limpieza" obvia es justamente lo que lo rompe |
| Un pedido de plan abierto se detecta por `pending_plan`, NUNCA por `status` | El estado significaba dos cosas incompatibles —"soy nueva y no tengo nada activo" y "ya tengo un plan y quiero uno mayor"— y la regla de visibilidad solo puede asumir una. Con las dos mezcladas, **pedir un plan mayor sacaba a la agencia del mapa**: quería pagar más y se apagaba sola |
| Pedir un upgrade NO toca `status`, y la regla de la base NO se tocó | Quitarle al estado su segundo sentido lo deja significando una sola cosa, que es justo lo que `agency_is_publicly_visible()` asume. Cambiar la función para que aceptara `'pending'` habría dejado visible a una agencia recién registrada que todavía no tiene nada activo |
| Dos helpers separados para "¿puede publicar?" y "¿se ve en el mapa?" | Usar el de publicación para la visibilidad falla en dos direcciones opuestas: le SOBRA el cupo lleno (esa agencia sí se ve) y le FALTA `plan <> 'free'` (el aterrizaje no bloquea nada y no se ve). Son espejos de cosas distintas: los tres triggers contra la función |
| El cartel del panel garantiza "uno solo" por estructura y por tipos, no por disciplina | Un solo `reason`, un ternario sobre él (no dos condicionales que pueden dar verdadero a la vez) y un `Exclude` en la prop que hace que pasar el motivo equivocado **no compile** |
| Antes de invitar a pagar más, verificar que pagar sea lo que destraba | **Es la segunda vez con el mismo síntoma.** Un bloqueo correcto con el mensaje equivocado manda a la persona a resolver algo que no la destraba, en el momento exacto en que está esperando otra cosa |
| El cupo del aterrizaje NO se subió: se corrigieron los mensajes | Con una propiedad la agencia igual aprende a usar el formulario, y el número del cupo es andamio del modelo (`PLANS.free`), no una preferencia de producto. Lo que estaba mal era prometerle que podía "seguir cargando" |
| El banner de error recibe su margen desde afuera | Dos de las cuatro pantallas lo tienen suelto en un fragmento y necesitan `mb-4`; las otras dos viven en un `space-y-6` que ya separa. Un margen fijo adentro rompe dos en una dirección o las otras dos en la contraria |
| El estado de carga de la home renderiza el encabezado REAL, no una imitación | Los tres slots eran bloques grises con anchos escritos a mano, y el de la derecha medía 64 px **dimensionados para la palabra "Ingresar"**: un ancho fijo que imita a otro componente es una copia que hay que mantener sincronizada, y no se mantuvo. Ni la marca ni la puerta dependen de la ciudad |
| La visita se cuenta donde se MARCA (pin, tarjeta, ficha), no en el modal | El pin marca la propiedad antes de que el modal cargue: desde ahí la señal diría siempre "ya estaba" y los pines no contarían nunca. Mover la marca al modal obligaba a sincronizar las instancias del hook, o el tono visitado de los pines quedaría viejo hasta recargar |
| La deduplicación sale de una lectura síncrona de `localStorage`, no del estado de React | El actualizador de estado no corre necesariamente en el momento de la llamada y en desarrollo corre dos veces: una señal sacada de ahí podría leerse vacía o dar "nueva" dos veces. Mismo molde que `toggleFavorite` |
| En la ficha pública la visita cuenta con la primera interacción, nunca al montar ni en el servidor | El renderizador de un buscador ejecuta JavaScript pero no interactúa, y el mapa del sitio le ofrece todas las fichas. En el servidor contarían además los robots de vista previa de cada enlace compartido |
| El número crudo de visitas y consultas se muestra en todos los planes | Esconder cuánta gente vio una publicación es raro en un marketplace, y ver el número es lo que da ganas de entenderlo. Lo reservado a premium es el análisis |
| Las consultas por propiedad se cuentan con service role, acotadas al alcance de la sesión | Con el client normal la RLS trunca el conteo de un agente común y el conteo embebido devuelve 0 sin error. El número tiene que ser el de la propiedad, igual que `views_count` |
| `agents` sin INSERT/DELETE para usuarios y con UPDATE solo sobre tres columnas; `WITH CHECK` en la policy de `properties` que fija agencia y ciudad | `role` y `agency_id` gobiernan la autorización de toda la app y no pueden ser escribibles por el propio usuario; las altas de agentes van solo por service role. Y con la autoconfirmación activa cualquiera obtiene un JWT válido sin agencia aprobada: la seguridad no puede depender de la aprobación ni del formulario |
| La guarda de `updated_at` es una variable local a la transacción, no una comparación de filas | Comparar `NEW` contra `OLD` en un trigger BEFORE nunca da iguales si la tabla tiene una columna generada (`location`). Y la variable tiene que ser local: en la sesión se filtraría por la conexión reutilizada a modificaciones reales, que dejarían de sellar la fecha |

---

## Método de Diagnóstico

Cuando el usuario reporta un síntoma visual, **inspeccionar el estado real del DOM y las clases aplicadas antes de teorizar sobre el pipeline de build**. La causa más simple (un elemento en otro estado, una clase pisada) es más probable que una corrupción de caché. No verificar en entornos aislados (headless, build paralelo) cuando el síntoma aparece en la app corriendo — la evidencia está en el DOM real.

**⚠ REGLA DE TRABAJO: NO verificar en la app corriendo nada que ESCRIBA en la base.** Tampoco abrir propiedades del mapa: cada apertura cuenta una visita (`increment_views`). Una verificación del 16 sep 2026 sumó visitas a **17 propiedades de prueba**. Lo que escribe se verifica con el MCP de solo lectura o se le pide al usuario.

**⚠ Y un patrón propio de este repo, que ya costó cinco veces: los comentarios que afirman que un caso ESTÁ CUBIERTO son los más peligrosos, porque desactivan la sospecha.** El ejemplo que lo cerró: `getPlanUsage` decía *"ese caso ya lo bloquea el límite 0"* mientras el límite que ese mismo archivo calculaba era **1**. Nadie volvió a mirar el caso justamente porque el comentario decía que estaba resuelto. Los otros cuatro fueron de la misma familia: dos cláusulas `ON DELETE` que la base no tenía; un *"el único código que borra logos y avatares"* que había dejado de ser único; y un **"Estado consistente"** en `deleteAgentAction` que describía un estado que **no lo era** —las propiedades ya reasignadas y el avatar ya borrado, sobre un agente todavía vivo—. **Un comentario que afirma una propiedad de la base o de otro archivo hay que medirlo antes de creerle**, sobre todo si es la razón por la que algo no se está revisando.

**El caso del "Estado consistente" agrega un matiz que los otros cuatro no tenían: el comentario que miente puede estar A DOS LÍNEAS del que dice la verdad.** El mismo bloque explicaba, arriba, que el borrado fallaba **siempre** en ese caso — o sea que quien lo escribió sabía que esa rama se ejecutaba de verdad, y aun así el mensaje de adentro describía un fallo transitorio. **La cercanía no es evidencia de coherencia**: hay que leer cada afirmación por separado.

### ⚠ El sexto caso (11 sep 2026) agrega DOS cosas que los cinco anteriores no tenían

El bug del upgrade —pedir un plan mayor apagaba a la agencia del mapa— estuvo escondido detrás de
**tres** afirmaciones falsas, no una. Y lo que las hacía distintas de las anteriores es esto:

**(1) LAS TRES ERAN FALSAS A MEDIAS, Y LA MITAD VERDADERA ERA LA QUE SE LEÍA.** Ninguna decía algo
completamente equivocado: decían algo cierto **de una pregunta** y falso **de la otra**.

| Dónde | Decía | Por qué engañaba |
|---|---|---|
| `requestPlanUpgradeAction` | *"el cliente sigue operando con lo que tiene hasta que el admin active"* | cierto del **cupo** y de las **funcionalidades**; falso de **aparecer en el mapa**, que es lo único que la agencia paga |
| `getPublishBlock` | *"'pending' … esa agencia está al día y **publica normalmente**"* | cierto de **publicar**; falso de **verse** |
| `CLAUDE.md` (la línea del upgrade) | lo mismo que la primera | ídem |

**Los cinco casos anteriores se desmentían con una medición puntual** (¿existe esa cláusula `ON
DELETE`? ¿cuánto vale ese límite?). **Estos tres no**: había que notar que *"operar normal"* y
*"verse en el mapa"* son dos preguntas distintas, y que el comentario respondía la primera cuando
la que importaba era la segunda. **La corrección de un comentario a medias no es medir un valor:
es separar las dos preguntas que estaba mezclando.**

**(2) EL COMENTARIO FALSO ESTABA EN TRES ARCHIVOS QUE SE CONFIRMABAN ENTRE SÍ, Y UNO ERA ESTE.**
No fue un comentario aislado: la action, el helper y la documentación decían lo mismo, así que
**cualquiera de los tres que se leyera confirmaba a los otros dos**. Ahí está el salto respecto del
"Estado consistente", donde la contradicción convivía en el mismo bloque: acá **no había ninguna
contradicción visible**, porque las tres copias estaban de acuerdo. **Tres fuentes coincidiendo no
son tres verificaciones: pueden ser una sola afirmación copiada.**

⚠ **Y la tercera copia vivía en este archivo.** Es el motivo por el que una afirmación falsa en
`CLAUDE.md` se corrige **en la misma tanda que el código** y no se deja para el cierre: mientras
esté escrita acá, es la fuente que alguien va a citar para no volver a mirar.

### ⚠⚠ RECORRER EL CAMINO DE PUNTA A PUNTA, NO DESDE EL MEDIO (13 sep 2026)

> **Es la regla más cara del grupo del sitio de marca, y es de otra familia que las seis
> anteriores.** Aquellas son sobre creerle a un comentario; ésta es sobre **construir lo que
> procesa un pedido sin verificar que el pedido se pueda hacer**.

**Qué pasó.** Se construyeron **tres tandas completas** del flujo de aprobación de un cambio de
nombre —la server action que lo pide, las dos columnas de la base que guardan el nombre anterior,
la distinción en el panel `/admin`, **las dos formas de rechazo**, los avisos a la agencia y el
lector del motivo— y recién en la cuarta se descubrió que **no existía el campo para pedirlo**.
Todo eso estuvo escrito, compilando y sin usarse: una capacidad entera en el servidor **sin punta
en la interfaz**.

**⚠ EL ORIGEN DEL ERROR ES ESPECÍFICO Y CONVIENE RECONOCERLO:** se vio que
`updateAgencyIdentityAction` **aceptaba** `name` en su firma y en su esquema, y de ahí se asumió
que el formulario lo editaba. El formulario **sí llamaba a esa action** —así que la conexión
existía y se veía en cualquier búsqueda— pero el nombre viajaba dentro de una rama que **no se
renderizaba** para una agencia aprobada, que es el estado del 100 % de las agencias reales.

**LA REGLA: que una acción acepte un campo NO significa que alguien se lo mande.** Antes de
construir lo que procesa un pedido, verificar que el pedido **se pueda hacer**, y verificarlo
**desde la punta**: abrir la pantalla, encontrar el control, seguir el dato hasta la escritura. No
alcanza con que el grep encuentre el llamador: hay que ver que el campo **efectivamente llegue**.

**Cómo se ve hecho mal y hecho bien, en una línea:**

| | |
|---|---|
| ❌ Desde el medio | "la action acepta `name` y el formulario la llama" → se asume la punta |
| ✅ De punta a punta | "abro Preferencias como el admin de una agencia **aprobada**, ¿veo un campo de nombre?" |

⚠ **Y el síntoma que lo delata sin necesidad de abrir el navegador: una columna que nunca se
escribe.** `previous_name` existía, el panel la leía y la mostraba, y **ninguna fila la tenía
cargada** — porque ningún camino podía escribirla. Una consulta de una línea sobre los datos
reales lo habría mostrado tres tandas antes.

### ⚠ DOS OBSERVACIONES CIERTAS QUE PARECEN CONTRADECIRSE: columnas generadas y triggers BEFORE (14 sep 2026)

> **Es de la misma familia que "tres fuentes coincidiendo pueden ser una sola afirmación copiada":
> la evidencia estaba bien, y lo que fallaba era QUÉ estaba midiendo cada una.**

**La trampa de PostgreSQL: las columnas generadas se calculan DESPUÉS de los triggers BEFORE.** Por
eso, dentro de un trigger BEFORE sobre una tabla que tiene una columna generada, **comparar la fila
nueva contra la vieja NUNCA da iguales**: la generada todavía no tiene su valor final en `NEW` y sí lo
tiene en `OLD`. La documentación oficial de Postgres 17 lo dice textual:

> *"Stored generated columns are computed after `BEFORE` triggers and before `AFTER` triggers."*
> *"In `BEFORE` triggers, the `OLD` row contains the old generated value, as one would expect, but the
> `NEW` row does not yet contain the new generated value and should not be accessed."*

**En este proyecto la columna es `properties.location`** (`GEOGRAPHY GENERATED ALWAYS AS
(ST_MakePoint(lng, lat)) STORED`; medido: es la única columna generada de la tabla).

**Qué pasó.** El primer intento de la guarda de `updated_at` hacía exactamente esa comparación:

```sql
IF (to_jsonb(NEW) - 'views_count' - 'updated_at')
   IS DISTINCT FROM
   (to_jsonb(OLD) - 'views_count' - 'updated_at') THEN
```

y **sellaba la fecha siempre**. Mientras tanto, la verificación —hecha **sobre filas ya guardadas**,
antes y después de llamar a la función, donde `location` ya estaba calculada— mostraba que **solo
diferían esas dos columnas**. **Las dos observaciones eran ciertas y parecían contradecirse**: no se
pudo determinar la causa y **se cambió de enfoque** (la variable de transacción) en vez de seguir
probando variantes. Recién después apareció la explicación.

**LA REGLA:** cuando una comparación da un resultado distinto adentro y afuera de un trigger, **no
asumir que las filas son las mismas**: dentro de un BEFORE, `NEW` todavía no es la fila que se va a
guardar. Y en general, **antes de declarar que dos mediciones se contradicen, verificar que midan el
mismo objeto en el mismo momento**.

⚠ **El comentario del archivo de migración todavía la llama "HIPÓTESIS NO VERIFICADA"**: se escribió
antes de encontrar la documentación. Está confirmada; hay que corregirlo la próxima vez que se toque
ese archivo (ver PENDIENTES.md).

### ⚠⚠ UN DEFECTO "VISUAL" SOBRE UN CONTROL NO ES VISUAL: ES UN AGUJERO DE DATOS (15 sep 2026)

> **Es la lección del grupo de pulido, y es la única de esta lista que no es sobre cómo se diagnostica
> sino sobre CÓMO SE PRIORIZA.** Se reportó como "se ven mal unas casillas". Lo que estaba pasando era
> que se cargaban mal las propiedades.

**El caso.** Las casillas sin marcar tenían un borde con **≈ 1,00:1 de contraste** contra el fondo —o sea,
invisible— y las tres opciones de operación (venta, alquiler, alquiler temporal) **no parecían tocables**.
La consecuencia no es estética:

> Una inmobiliaria carga una casa que **también alquila**, no ve que la opción se puede marcar, y la
> publica **solo en venta**. La propiedad queda fuera de los filtros de alquiler. **La consulta que
> nunca llega no aparece en ningún lado**: no hay error, no hay registro, y ni la agencia ni nosotros
> podemos distinguir esa propiedad de una que efectivamente solo se vende.

**Por qué no se puede medir después, que es lo que lo vuelve caro.** Un dato que nunca se cargó no deja
rastro. Cuando aparezca la sospecha —"pocas propiedades en alquiler"— **ya no hay forma de saber cuántas
fueron un error de carga**, y la corrección exige pedirle a cada agencia que revise su cartera.

**LA REGLA: cuando un defecto visual está sobre un CONTROL —algo que se marca, se elige o se escribe—,
la pregunta no es "¿se ve mal?" sino "¿QUÉ DATO PRODUCE, Y QUÉ PASA SI NO SE USA?".** Un control que no
parece operable no se usa, y lo que no se registra **es un agujero silencioso en los datos del negocio**,
no una imperfección de la interfaz. Eso lo saca de "pulido estético" y lo sube a la prioridad de los
bugs funcionales.

**Cómo se ve aplicada:** en la lista de inconsistencias de `PENDIENTES.md`, las casillas invisibles
quedaron en **P1** (junto a lo funcional) y no en el bloque de accesibilidad o de coherencia visual,
**aunque el arreglo fuera una clase de color**. El costo de arreglarlo no dice nada sobre su prioridad.

⚠ **El corolario incómodo:** el resto del grupo —radios, alturas, mayúsculas— **sí** era estético, y se
hizo en la misma pasada. La diferencia no estaba en cómo se reportó ninguno de los dos.

## Diseño

@DESIGN.md

## Pendientes

Para deuda técnica, piezas futuras y decisiones de producto abiertas, ver `PENDIENTES.md` (no se listan acá para mantener este archivo enfocado en lo que el proyecto ES, no en lo que falta).
