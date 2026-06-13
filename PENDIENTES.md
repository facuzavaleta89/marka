# PENDIENTES — App Mapa Inmobiliario (Marka)

> Lista viva de pendientes, deuda técnica y decisiones de producto abiertas.
> Se actualiza a medida que se cierran piezas o aparecen cosas nuevas.
> Última actualización: 12 jun 2026 (limpieza: available/over saneados, slug limpio de agencia, 3 errores de lint resueltos).

---

## Fase 3 — piezas que faltan

> Multi-agente es el marco que da sentido a varias de estas. Sub-pieza 1 (crear
> agentes + listar equipo) YA está hecha. Las que siguen son sus continuaciones.

- [ ] **Multi-agente · sub-pieza 4 — Desactivar agente (soft delete, reversible)** — alternativa al borrado: marcar `agents.is_active = false` (la columna ya existe) en vez de eliminar. Un agente desactivado no puede loguearse, no aparece como activo, no recibe leads ni se le asignan propiedades — pero su historial queda intacto y es reversible. Es la pieza MÁS invasiva (hay que filtrar `is_active` en varios lados: login/proxy, lista de equipo, selector de reasignación, etc.), por eso se dejó después del borrado real (que ya está). Decidir qué pasa con sus propiedades al desactivar (¿quedan a su nombre ocultas, o se reasignan como en el borrado?).

- [ ] **White-label** (planes profesional+) — URL por agencia (`marka.com.ar/[slug-agencia]`) con el mapa filtrado a esa agencia. Personalización (color, nombre, logo) en Preferencias, "apagada" si el plan no la incluye. Acá conviene el slug limpio (ver deuda técnica). Es la pieza más independiente del resto. **Próxima pieza grande** (se hará en una conversación nueva).

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

- [ ] **Editar el slug de agencia en Preferencias** — el slug limpio ya se autogenera al crear la agencia (base + `-2`/`-3` ante colisión). Falta permitir cambiarlo manualmente desde Preferencias (con check de disponibilidad). Se dejó para white-label: ahí el slug va a la URL pública, y cambiarlo implica decidir qué pasa con los links viejos (¿redirect del slug anterior?). Diseñarlo con white-label, no antes.
- [ ] **Escalado del panel `/admin`** — hoy trae todas las agencias y filtra client-side (correcto para pocas agencias). Cuando haya muchas, mover el filtrado a la query (server-side) y paginar.
- [ ] **Repo de migraciones**: RESUELTO (9 jun 2026). El `initial_schema.sql` ahora refleja la base real; se eliminó la bitácora parcial. El `03-schema.sql` del Project es la fuente de verdad documentada.

---

## Decisiones de producto abiertas

- [ ] **¿Login opcional de visitantes?** — hoy el visitante NO se registra (favoritos en localStorage). Un login *opcional* (nunca obligatorio) habilitaría favoritos sincronizados entre dispositivos, historial y alertas ("bajó el precio de una que viste"). Decidido: NO ahora (el registro mata conversión, que es lo que más se cuida; el uso es corto e intenso). Solo evaluar a futuro como opt-in para usuarios recurrentes. NUNCA obligatorio. Nota: del visitante hoy solo se captura el nombre — el teléfono/email no, porque el agente ya recibe el número por WhatsApp (pedirlo sería fricción redundante).

- [ ] **¿Un particular (free) puede pagar por destacar su única propiedad?** — decisión de modelo de negocio.
- [ ] **Validar precios con el mercado** — cuánto pagan las inmobiliarias locales por Zonaprop, para calibrar los precios de los planes ($30k/$65k/$140k son placeholders).

---

## V2 / más adelante (del roadmap original)

- [ ] Modo oscuro (esfuerzo grande: rediseñar paleta y revisar contraste).
- [ ] Vista "Mis favoritos" (panel que liste todos los favoritos guardados).
- [ ] Página SEO por propiedad (`/propiedades/[slug]`) + Open Graph dinámico. (Cuando exista: en la pantalla de Consultas, el título de la propiedad hoy es texto plano — envolverlo en `<Link href={\`/propiedades/${slug}\`}>`. Se dejó sin link a propósito para no romper con un 404.)
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
- [x] Limpieza (tanda 12 jun): (a) `getPlanUsage` ahora expone `available` (saneado, nunca negativo) y `over` (excedente); el home usa `available` directo + subtítulo claro cuando se excede el límite — cierra el footgun del negativo de raíz, listo para el downgrade. (b) Slug limpio de agencia al crear (`generateUniqueAgencySlug`: base + `-2`/`-3` ante colisión + reintento ante 23505); `generateSlug` y el slug de propiedades intactos. (c) Los 3 errores de lint preexistentes resueltos (ClusterLayer refs → `useLayoutEffect`; StatsCard count-up → disable comentado): `npm run lint` en 0 errores, quedan los 2 warnings RHF conocidos.
