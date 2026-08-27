# PENDIENTES — App Mapa Inmobiliario (Marka)

> Lista viva de pendientes, deuda técnica y decisiones de producto abiertas.
> Se actualiza a medida que se cierran piezas o aparecen cosas nuevas.
> Última actualización: 29 jun 2026 (cierre fase White-label: B2a hecha, B2b/C en pausa; + hoja de ruta NUEVA FASE tras validación con el rubro y el colegio de corredores, y entrada de socio/financiamiento).

---

## 🚀 NUEVA FASE — Cambios profundos de modelo (post-validación con el rubro)

> Contexto: tras reuniones con inmobiliarias del rubro y con el presidente del colegio
> de corredores de Santiago, + entrada de un socio que financia la startup (sueldo +
> dedicación full-time + participa en decisiones), surge una hoja de ruta nueva. Varios
> de estos cambios REVIERTEN o AJUSTAN decisiones del modelo actual. Nada de esto rompe
> la arquitectura (mapa, propiedades, dashboard, roles, panel admin, white-label se
> mantienen); son cambios de MODELO DE ENTRADA y de RIQUEZA del listado. Casi todo se
> apoya en infraestructura que ya existe o estaba anotada.
>
> Agrupados en 3 bloques temáticos. Orden sugerido: arrancar por el BLOQUE A (define
> quién entra a la plataforma; es lo que el colegio mira y da legitimidad). Las
> decisiones ahora se toman entre el usuario, el socio y Claude (criterio técnico).

### BLOQUE A — Modelo de agencias (legitimidad) — arrancar por acá

- [ ] **A1 · Eliminar particulares (SÍ O SÍ).** La app pasa a ser **solo agencias**. Razón de negocio: las inmobiliarias que pagan no quieren competir con particulares gratis (les socava el negocio) ni con corredores no matriculados. Impacto acotado: el particular nunca fue entidad separada — es `tenant_type = 'individual'` en `agencies` (una agencia de un miembro). Eliminar = cerrar la puerta de entrada: sacar la opción "particular" del registro y el plan `free` como auto-registro. A decidir al diseñar: qué se hace con `tenant_type` y el plan `free` en el schema (borrar / código muerto / reutilizar). Toca sobre todo el flujo de REGISTRO; no toca mapa, white-label ni propiedades.

- [ ] **A2 · Matrícula + alta manual de agencias (SÍ O SÍ, ver la forma).** Dos partes: (a) **número de matrícula** como dato de la agencia (campo nuevo en `agencies` + probablemente estado de verificación → `ALTER` aditivo). (b) **Alta manual**: las agencias ya NO se dan de alta solas. Razón: el padrón es público, así que verificar la matrícula automáticamente probaría que la matrícula EXISTE, no que quien la carga es su dueño — cualquiera con los datos públicos podría hacerse pasar por una agencia. Por eso el alta la aprueba el dueño de la app manualmente. **Buena noticia: ya existe casi toda la infraestructura** — el dueño hoy activa planes pagos manualmente desde `/admin`; el alta de agencias es el mismo patrón (aprobación del dueño) un paso antes. Se EXTIENDE, no se inventa. **Conecta con** la deuda ya anotada "Edición del nombre de la agencia con aprobación del dueño" — misma familia (datos de agencia semi-regulados que el dueño valida); conviene diseñarlas juntas. La pieza "Selección de plan post-registro" actual y el flujo de registro de dos pasos se van a tener que repensar con esto.

### BLOQUE B — Datos de la propiedad (riqueza del listado)

- [ ] **B1 · Precio opcional / "Consultar" (EN EVALUACIÓN).** Problema real del rubro: el precio en el mapa filtra la tasación por m² de la zona, dato competitivo que las inmobiliarias no quieren regalar (es por lo que muchas no suben a Redfira, la competencia, que OBLIGA a poner precio). Tensión: el visitante quiere ver precio (es lo primero que mira), pero la agencia no siempre quiere mostrarlo. **Dirección propuesta (no cerrada):** que sea una decisión POR PROPIEDAD — cada propiedad puede ser "precio visible" o "precio a convenir / Consultar". El pin del mapa, cuando no hay precio, muestra "Consultar" (o ícono) en vez del número — nunca un hueco ni "SIN PRECIO". Convierte un problema ("obligo o no") en una feature diferenciadora vs Redfira ("en Marka vos decidís"). Riesgo a vigilar: si TODAS ocultan, el mapa pierde valor para el visitante — apuesta: no pasa (alquileres tienden a mostrar; ventas de alto valor tienden a ocultar → mix natural). Toca: campo en `properties`, el pin (`formatPriceCompact`/marker) y el modal. Acotado.

- [ ] **B2 · Requisitos para alquiler (feature nueva, fácil).** El agente, al crear/editar la propiedad, marca con checkboxes qué requisitos pide para alquilar (recibo de sueldo, fotos de DNI, garantía propietaria, etc.) + una opción **"otro"** de texto libre. **NO se cargan archivos** — son solo las opciones que la propiedad requiere. Se muestran en el **modal**. **Mismo patrón que `amenities`** (lista flexible JSONB marcada en la propiedad, mostrada como chips en el modal) — molde ya existente; el "otro" de texto libre es el único agregado. Toca: campo en `properties` (JSONB tipo amenities), el form de propiedad y el modal. La más fácil de todas.

### BLOQUE C — Crecimiento y monetización (ideas del socio)

- [ ] **C1 · Registro OPCIONAL de visitantes + base para monetización de datos (EN EVALUACIÓN).** El socio quiere monetizar datos. Parte técnica viable y ya medio pensada (ver "¿Login opcional de visitantes?" en Decisiones de producto): auth de visitantes opcional (NUNCA obligatorio — el registro mata conversión), habilita favoritos sincronizados, alertas de precio, etc. **Parte de venta de datos — NOTA LEGAL IMPORTANTE (criterio técnico, no decisión tomada):** vender datos personales identificables está fuertemente regulado en Argentina (Ley 25.326): requiere consentimiento explícito e informado + registro de la base ante la autoridad. Distinguir: (a) datos personales identificables → alto riesgo legal y de confianza; (b) **datos de mercado AGREGADOS y anónimos** (precio/m² por zona, evolución, demanda por barrio) → más seguros, igual o más valiosos, vendibles a tasadoras/bancos/desarrolladores/colegio. Recomendación a discutir con el socio: sí al registro opcional, sí a monetizar — orientado primero a datos de mercado agregados (valor grande y limpio); venta de datos personales solo con aparato legal completo. **Diseñar el registro PREPARADO para consentimiento desde el día 1** (checkbox claro de uso de datos) — barato ahora, caro de retrofittear. NO documentar como decisión tomada; es para discutir entre los tres.

- [ ] **C2 · Página + link por propiedad (viable, alto retorno).** Cada propiedad con su URL propia para compartir (caso de uso: una inmobiliaria habla con un cliente FUERA de Marka y le pasa el link de esa propiedad). **Ya medio caminado:** cada propiedad YA tiene `slug` único; y ya estaba anotada como "Página SEO por propiedad" (`/propiedades/[slug]` + Open Graph) en V2. El modal NO tiene URL (se abre sobre el mapa) → la solución es una **página propia** en `/propiedades/[slug]` (página real, indexable, con fotos+datos+WhatsApp y botón "ver en el mapa"), no "darle URL al modal". Bonus enorme: esa página es **SEO** — cada propiedad indexable en Google (difusión orgánica gratis). El `slug` ya existente resuelve la base. Toca: ruta nueva + botón compartir + Open Graph (link lindo al pegarlo en WhatsApp).

---


> Multi-agente es el marco que da sentido a varias de estas. Sub-pieza 1 (crear
> agentes + listar equipo) YA está hecha. Las que siguen son sus continuaciones.

- [ ] **Multi-agente · sub-pieza 4 — Desactivar agente (soft delete, reversible)** — alternativa al borrado: marcar `agents.is_active = false` (la columna ya existe) en vez de eliminar. Un agente desactivado no puede loguearse, no aparece como activo, no recibe leads ni se le asignan propiedades — pero su historial queda intacto y es reversible. Es la pieza MÁS invasiva (hay que filtrar `is_active` en varios lados: login/proxy, lista de equipo, selector de reasignación, etc.), por eso se dejó después del borrado real (que ya está). Decidir qué pasa con sus propiedades al desactivar (¿quedan a su nombre ocultas, o se reasignan como en el borrado?).

- [ ] **White-label** (planes profesional+) — URL por agencia (`marka.com.ar/[slug]`) con el mapa filtrado a esa agencia. Partido en sub-piezas; A ya está hecha:
  - [x] **Sub-pieza A — Ruta pública + resolución por slug + mapa filtrado + gate de plan.** `/[slug]` en el root (exclusivo de agencias; las ciudades salen del root). `resolveAgencyBySlug` (service role, 3 estados: `not_found`→404 / `disabled`→página "sitio no disponible" / `active`→mapa). `AgencyMapView` (mirror de la home sin CityPicker) + `AgencyUnavailable`. `agencyId` opcional en `useProperties`/`MapView`/`PropertyList`. SIN personalización todavía. Probado (3 caminos + filtrado con contraste de 2 agencias en la misma ciudad). Ver CLAUDE.md "White-label por agencia".
  - [x] **Sub-pieza B1 — Subir el logo en Preferencias.** `AgencyLogoForm` (admin-only) sube el logo **client-side** (como el avatar) a `logos/{agency_id}/logo.{ext}` con `upsert`; la URL se persiste con `updateAgencyLogoAction` (gate admin + service role + `.eq("id", caller.agency_id)`). Enfoque híbrido decidido: lo sensible es la escritura en `agencies`, no el archivo (bucket público) → no hace falta upload por server action/FormData. Validación real (PNG/JPG/WEBP, no SVG, máx 2 MB), extensión del MIME, cache-buster en preview. El logo NO se muestra en el white-label todavía (es B2). Probado: subir, persistir tras reload, reemplazar, validaciones. Ver CLAUDE.md "White-label · B1".
  - [x] **Sub-pieza B2a — Logo + nombre en el header.** `AgencyMapView` muestra el logo de la agencia (izquierda, `object-contain` altura fija, tolera cualquier proporción) + nombre (centro, visible en mobile). Sin logo → nombre a la izquierda, centro vacío, nunca Wordmark de Marka. "Powered by Marka." discreto centrado al pie (`size="xs"` nuevo del Wordmark, aditivo). `resolveAgencyBySlug` ahora trae `logo_url` en `active`. Probado en reunión real con el rubro. Ver CLAUDE.md "Sub-pieza B2a".
  - [ ] **EN PAUSA — Sub-pieza B2b — Variante admin en `disabled`.** Cuando el admin logueado de una agencia caída entra a su propia URL, ve invitación a reactivar en vez de `AgencyUnavailable` genérica. Requiere: meterle resolución de sesión a la ruta `/[slug]` (hoy 100% anónima) SIN guard de redirect, + ensanchar el estado `disabled` de `resolveAgencyBySlug` para que devuelva `id`+`name` (hoy es `{ status: "disabled" }` pelado), + comparar `agent.agency_id === id de la agencia del slug`. Diagnóstico ya relevado. **PAUSADA** hasta resolver los cambios de modelo (matrícula/alta manual tocan agencias/roles).
  - [ ] **EN PAUSA — Sub-pieza C — Slug editable en Preferencias.** Admin-only, server-side; check de disponibilidad contra `generateUniqueAgencySlug`; advertencia de que los links viejos mueren. **PAUSADA** por la misma razón.
  - Nota de namespace: si a futuro se quiere URL de ciudad (SEO/compartir), va con **prefijo** (`/ciudad/[slug]`), nunca en el root — el root es de las agencias. La extensión de `generateUniqueAgencySlug` para chequear también `cities` se descartó: al salir las ciudades del root, no hay colisión posible.

---

## Desactivar / downgrade de planes (pariente de "cancelar upgrade")

- [ ] **Desactivar un plan pago** (bajar a free) desde el panel admin. Decisión pendiente: **¿qué pasa con las propiedades que exceden el límite del plan menor?** (ej. premium con 50 props baja a free con límite 1). ¿Se pausan? ¿Cuáles? Hay que diseñarlo. Incluye poner `activated_at` a `null` al desactivar.

- [ ] **Cancelar una solicitud de upgrade pendiente** (desde la card de suscripción del cliente). Con el modelo `plan`/`pending_plan` ya implementado, esto es simple: cancelar = limpiar `pending_plan = null` y `status = 'active'` (como `plan` nunca se pisó, vuelve solo a lo que regía). Hoy resuelto a mano: el cliente escribe y se revierte desde el panel/Supabase. Falta el botón funcional.
  - **Desactivar y cancelar comparten lógica** (limpiar el pendiente / bajar de plan). Conviene diseñarlos juntos. Nota: el modelo `pending_plan` ya resolvió el "a qué estado volver" para cancelar; desactivar todavía tiene la decisión de qué pasa con las propiedades de más.

---

## Cobro real (V2)

- [ ] **Fechas de vencimiento / ciclos de cobro** — manejo de `current_period_end`, avisos de vencimiento, desactivación automática. Hoy `current_period_end` no se toca; la activación y desactivación son 100% manuales.
- [ ] **Cobro automatizado** — integración MercadoPago/Stripe (reemplaza la activación manual).
- [ ] **Precios en ARS revisables vs anclados a USD** — decidir al activar cobro real.

---

## Deuda técnica

- [ ] **3 errores de lint preexistentes** — `ClusterLayer.tsx` (x2, refs) y `StatsCard.tsx` (set-state-in-effect). No bloquean el build. Arreglar cuando se pueda.
- [x] **Slug de agencia "feo"** — RESUELTO. `generateUniqueAgencySlug` (`lib/utils/agencySlug.ts`) genera slug limpio para agencias (base + sufijo numérico incremental `-2`, `-3`…; aleatorio solo como último recurso ante 100 colisiones), distinto de `generateSlug` (propiedades, sufijo aleatorio). Consumido por la ruta white-label `/[slug]`. (Falta solo poder editarlo desde el dashboard → Sub-pieza C de white-label.)
- [ ] **Seguridad fina de las policies de Storage (repaso antes de producción)** — las policies de `storage.objects` hoy son **laxas**: INSERT/UPDATE/DELETE permiten a cualquier `authenticated` operar sobre todo el bucket `property-images`, sin validar uid ni agencia por path. Es aceptable en desarrollo pero permite que un autenticado toque archivos ajenos. Antes de producción real: reescribir con seguridad fina (validar uid en la posición correcta del path para avatares/propiedades, y pertenencia a la agencia para logos). Nota histórica: la policy de DELETE original SÍ intentaba seguridad fina (`(storage.foldername(name))[1] = auth.uid()`) pero nunca matcheaba para `avatars/`/`logos/` (la 1ª carpeta es la palabra literal, no el uid) → quedó reemplazada por la laxa al arreglar el problema de reemplazo. Este ítem absorbe el viejo "bug de DELETE de avatares".
- [ ] **Edición del nombre de la agencia (`agencies.name`)** — hoy el nombre es read-only tras el registro (se muestra en el white-label desde `agencies.name`). Permitir editarlo NO es un campo de texto libre: el nombre está **semi-regulado** (el colegio/consejo de corredores aprueba nombres de agencias matriculadas para evitar confusión, ej. no puede haber "Lima" y "Limah"). Por eso la edición debe ser un **flujo de aprobación**: el admin de la agencia *pide* el cambio, el dueño de la app lo *aprueba* desde el panel admin (parecido al flujo de activación de planes), no un campo editable directo con warning. Pieza propia, futura. Sacada de la Sub-pieza B por esta razón.
- [ ] **Dashboard entra en loop si el agente no tiene agencia resoluble** — si un usuario autenticado tiene sesión válida pero su fila en `agents` o su `agencies` no existe (ej. borrado manual de la agencia), el dashboard redirige en bucle (307 en cadena → el navegador rate-limita `history.replaceState` → `SecurityError`). En producción no debería pasar (no se borran agencias con usuarios vivos), pero el fallo es feo. Lo prolijo: detectar "sesión válida sin agente/agencia" y **cerrar sesión + mandar a login con mensaje**, en vez de ciclar. Encontrado al regenerar la agencia demo tras un borrado accidental.
- [ ] **Escalado del panel `/admin`** — hoy trae todas las agencias y filtra client-side (correcto para pocas agencias). Cuando haya muchas, mover el filtrado a la query (server-side) y paginar.
- [ ] **Repo de migraciones**: RESUELTO (9 jun 2026). El `initial_schema.sql` ahora refleja la base real; se eliminó la bitácora parcial. El `03-schema.sql` del Project es la fuente de verdad documentada.

---

## Decisiones de producto abiertas

- [ ] **¿Login opcional de visitantes?** — hoy el visitante NO se registra (favoritos en localStorage). Un login *opcional* (nunca obligatorio) habilitaría favoritos sincronizados entre dispositivos, historial y alertas ("bajó el precio de una que viste"). Decidido en su momento: NO ahora. **REABIERTO por C1 de la nueva fase** (el socio quiere monetizar datos) — ahora SÍ se va a evaluar en serio, siempre opt-in, nunca obligatorio, y preparado para consentimiento de datos desde el día 1. Ver "🚀 NUEVA FASE → C1".

- [ ] ~~**¿Un particular (free) puede pagar por destacar su única propiedad?**~~ — **OBSOLETA por A1 de la nueva fase** (se eliminan los particulares). Sin particulares, la pregunta no aplica.
- [ ] **Validar precios con el mercado** — cuánto pagan las inmobiliarias locales por Zonaprop, para calibrar los precios de los planes ($30k/$65k/$140k son placeholders).

---

## Bugs / observaciones menores

- [ ] **Cálculo `available` negativo** en el dashboard home cuando una agencia bajó de plan (quedó con más propiedades activas que el límite del plan nuevo). Revisar el cálculo para que no muestre negativo.

---

## V2 / más adelante (del roadmap original)

- [ ] Modo oscuro (esfuerzo grande: rediseñar paleta y revisar contraste).
- [ ] Vista "Mis favoritos" (panel que liste todos los favoritos guardados).
- [ ] Página SEO por propiedad (`/propiedades/[slug]`) + Open Graph dinámico. **PROMOVIDA a C2 de la nueva fase** (el socio la pidió como link-para-compartir; sube de prioridad). (Cuando exista: en la pantalla de Consultas, el título de la propiedad hoy es texto plano — envolverlo en `<Link href={\`/propiedades/${slug}\`}>`. Se dejó sin link a propósito para no romper con un 404.)
- [ ] Dashboard analytics (gráficos de consultas y propiedades más vistas — plan premium).
- [ ] Deduplicación de propiedades listadas por 2 agencias.
- [ ] Notificaciones por email al agente ante nuevo lead (Resend).
- [ ] "Dibujar zona" en el mapa (PostGIS `ST_Within`).
- [ ] "Propiedades similares".
- [ ] Tour virtual embed (YouTube/Matterport por propiedad).
- [ ] Nuevas ciudades (expansión del marketplace).
- [ ] Subdominio white-label (`agencia.marka.com.ar`) si una agencia grande lo pide.

---

## Cerrados recientemente (para referencia)

- [x] Roles de agente (`agents.role`) — migrado + backfill.
- [x] Policy `Admin reads agency leads`.
- [x] `agencies.tenant_type` (inmobiliaria/particular) — migrado.
- [x] Flujo de registro: crea agencia real + agente admin + suscripción free (adiós hardcodeo demo).
- [x] Bug visual del toggle en el split-screen del registro (sticky panel).
- [x] Consolidación de migraciones (repo refleja la base real).
- [x] Selección de plan post-registro (paso 2, free instantáneo / pago pending).
- [x] Panel de admin `/admin` — activar planes pending, gateado por `ADMIN_USER_ID`.
- [x] Panel `/admin` mejorado: tabla de todas las agencias + filtros aditivos + fecha de activación (`activated_at`) + acceso desde el sidebar (solo dueño).
- [x] "Mejorar plan" funcional desde el dashboard (pide upgrade → pending → botón "Pendiente").
- [x] Modelo `plan` (lo que rige) vs `pending_plan` (lo pedido) — separados en columnas distintas; el plan pedido ya no pisa el que rige. Coherencia en badge/dashboard/bloqueo de "Nueva propiedad".
- [x] Multi-agente · sub-pieza 1: el admin de agencia crea agentes (con contraseña temporal, vía `createUser` service role) y ve la lista de su equipo en `/dashboard/equipo`. Gateado por `role === 'admin'` server-side. Columna `agents.email` denormalizada + ítem "Equipo" en el sidebar (solo admin).
- [x] Pantalla de Consultas (`/dashboard/leads`): lista los leads, diferenciada por rol vía RLS (admin ve los de la agencia, agente los suyos). Tipo `Lead` extendido con relaciones `agent`/`property`. Ítem "Consultas" en el sidebar (ambos roles).
- [x] Panel del dueño mejorado: 6 métricas de negocio (StatsCard) arriba de la tabla de agencias en `/admin`. Además, `/admin` ahora usa el sidebar del dashboard (layout propio con gating centralizado de `ADMIN_USER_ID`; "Panel admin" se resalta activo).
- [x] Multi-agente · sub-pieza 2 (Paso 1): el admin gestiona (edita/elimina/cambia estado de) las propiedades de toda su agencia. Helper `authorizePropertyAccess` (owner/admin, elige el client de escritura); listado por `agency_id` con columna "Agente" para el admin. Service role + validación, sin tocar policies RLS. Probado: agente normal no toca lo ajeno, nadie cruza agencias.
- [x] Multi-agente · sub-pieza 2 (Paso 2): el admin reasigna el `agent_id` de una propiedad a otro agente de su agencia, desde el `PropertyForm` (crear y editar). Helper `resolveAssignedAgent` con 3 barreras server-side (rol admin, destino dentro de la agencia, datos del server). Service role al reasignar (incluso reasignando propia propiedad, por el WITH CHECK implícito de la RLS). Probado + query de invariante (0 propiedades cruzadas).
- [x] Home del dashboard diferenciado por rol: las 4 métricas + últimas propiedades filtran por `agency_id` si el user es admin (toda la agencia) o `agent_id` si es agente (lo suyo). Cierra la sub-pieza 2 de multi-agente. Solo lecturas, vía un `scope` reusado en las queries.
- [x] `agencies.phone_wa` (NOT NULL): WhatsApp obligatorio de la agencia. Migrado (nullable → backfill con el del admin fundador → NOT NULL). Se setea en el registro (hereda el del admin) y se edita en Preferencias (solo admin, `updateAgencyPhoneAction` service role). Agregado al tipo `Agency`.
- [x] Multi-agente · sub-pieza 3: el admin elimina (borrado real) un agente de su agencia (`deleteAgentAction`). **Modelo B**: las propiedades del agente se reasignan al admin ANTES de borrar (nunca quedan huérfanas), después `deleteUser` cascadea (fila agents borrada, leads viejos a NULL = historial). Barreras: no auto-borrarse, ser admin, target de la misma agencia. Como las propiedades nunca quedan huérfanas, NO hizo falta el fallback de WhatsApp ni tocar la policy del lead (se evaluaron y se descartaron por el Modelo B). Probado + invariante (0 huérfanas, 0 cruzadas).
- [x] **White-label · Sub-pieza A**: ruta pública `/[slug]` (root, exclusivo de agencias) que muestra el mapa filtrado a UNA agencia. `resolveAgencyBySlug` (service role, 3 estados not_found/disabled/active), `AgencyMapView` (mirror de la home sin CityPicker), `AgencyUnavailable` (página "sitio no disponible"), `agencyId` opcional en `useProperties`/`MapView`/`PropertyList`. Sin personalización (eso es B). Probado: 404 / no-disponible / mapa filtrado, con contraste de 2 agencias en la misma ciudad. Decidido: la ruta de ciudad (si alguna vez se hace) va con prefijo `/ciudad/[slug]`, no en el root.
- [x] **Fix viewport mobile**: la navbar superior se scrolleaba fuera de vista al enfocar (zoom de Leaflet o input de WhatsApp). Causa raíz: `h-screen` (`100vh`) dejaba el documento scrolleable en mobile + header en flujo normal. Arreglo parejo en toda la app: `h-screen`→`h-dvh` en todos los wrappers de pantalla completa + lock de scroll del documento (`html, body { overflow: hidden }`). `AuthLayout` (login/register) era el único que dependía del scroll del documento → se le dio contenedor scrolleable propio (`h-dvh overflow-y-auto` + centrado por `m-auto`), preservando el sticky del split-screen (DESIGN §14). Tailwind v4 trae `h-dvh` nativo. Probado en mobile real (los 2 disparadores + register + scroll interno del dashboard).
- [x] **White-label · Sub-pieza B1**: subir el logo de la agencia en Preferencias (admin-only). `AgencyLogoForm` (upload client-side a `logos/{agency_id}/logo.{ext}` con `upsert`) + `updateAgencyLogoAction` (gate admin + service role persiste `logo_url`). Validación real (PNG/JPG/WEBP, no SVG, máx 2 MB), extensión del MIME, cache-buster en preview. El logo aún NO se muestra en el white-label (eso es B2). Probado: subir, persistir tras reload, reemplazar N veces, validaciones de tipo y tamaño.
- [x] **Arreglo policy UPDATE de Storage**: al reemplazar avatar/logo daba 403 "new row violates row-level security policy". Causa: un `upsert` sobre archivo existente es un UPDATE, y **no existía policy de UPDATE** en `storage.objects` (solo INSERT/DELETE/SELECT) → RLS lo negaba por defecto. La primera subida (INSERT) sí pasaba; el reemplazo (UPDATE) no. Arreglado agregando policy de UPDATE laxa (cualquier `authenticated`, igual que el INSERT). Corrido a mano en Supabase. NO confundir con el problema de loop del dashboard (ese fue por borrado manual de la agencia, no por Storage). La seguridad fina de las policies quedó como deuda (ver arriba).
- [x] **White-label · Sub-pieza B2a**: logo + nombre de la agencia en el header del white-label. `AgencyMapView` recibe `agencyName`+`agencyLogoUrl`; `resolveAgencyBySlug` trae `logo_url` en `active`. Logo izquierda (`object-contain`, altura fija, tolera cualquier proporción), nombre centro (visible en mobile, `text-base sm:text-lg`); sin logo → nombre a la izquierda. "Powered by Marka." discreto al pie (`size="xs"` nuevo del Wordmark, aditivo). La marca de la agencia no es link. Probado en reunión real con el rubro. B2b (variante admin) y C (slug editable) quedaron EN PAUSA por los cambios de modelo entrantes.
