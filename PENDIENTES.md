# PENDIENTES — App Mapa Inmobiliario (Marka)

> Lista viva de pendientes, deuda técnica y decisiones de producto abiertas.
> Se actualiza a medida que se cierran piezas o aparecen cosas nuevas.
> Última actualización: 27 ago 2026 (A1 cerrada: app solo-agencias + guarda de reentrada en `/register/plan`; MCP de Supabase conectado en solo lectura; hallazgos del diagnóstico incorporados; calendario de lanzamiento).

---

## 📅 Calendario de lanzamiento (contexto de prioridades)

No es una lista de tareas: es el marco que decide el orden de todo lo de abajo.

- **Hoy:** la app está deployada pero **sin datos reales** (todo lo cargado es de prueba: 10 agencias, 8 propiedades, 1 agente por agencia).
- **Septiembre:** terminar de afinar la app **mientras 2-3 inmobiliarias "fundadoras" cargan su cartera**. Las da de alta el dueño a mano; nadie se auto-registra todavía. ⚠ Es el mes en que la **fricción de carga** cuesta plata: si cargar 30 propiedades es tedioso, cargan 6 y abandonan.
- **Octubre:** lanzamiento con algo de publicidad. A partir de acá **sí** entra gente a registrarse sola → el alta manual (A2) tiene que estar lista antes.
- **Oct/nov/dic:** las fundadoras usan gratis (encuadre: "inmobiliaria fundadora", no "descuento").
- **1 de enero:** empieza el cobro real.

Consecuencias directas sobre el orden: la **autosugerencia de ubicación** sube (sirve antes de que carguen, no después); **C2** sube (hace que la publicidad de octubre se acumule en lugar de evaporarse); el **panel admin de ida y vuelta** tiene que existir antes de octubre (hoy un plan activado no se puede desactivar ni vencer).

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

- [x] **A1 · Eliminar particulares — HECHA (27 ago 2026).** Ver detalle en "Cerrados recientemente".

- [ ] **A2 · Matrícula + alta manual de agencias (SÍ O SÍ, ver la forma).** Dos partes: (a) **número de matrícula** como dato de la agencia (campo nuevo en `agencies` + probablemente estado de verificación → `ALTER` aditivo). (b) **Alta manual**: las agencias ya NO se dan de alta solas. Razón: el padrón es público, así que verificar la matrícula automáticamente probaría que la matrícula EXISTE, no que quien la carga es su dueño — cualquiera con los datos públicos podría hacerse pasar por una agencia. Por eso el alta la aprueba el dueño de la app manualmente. **Buena noticia: ya existe casi toda la infraestructura** — el dueño hoy activa planes pagos manualmente desde `/admin`; el alta de agencias es el mismo patrón (aprobación del dueño) un paso antes. Se EXTIENDE, no se inventa. **Conecta con** la deuda ya anotada "Edición del nombre de la agencia con aprobación del dueño" — misma familia (datos de agencia semi-regulados que el dueño valida); conviene diseñarlas juntas. La pieza "Selección de plan post-registro" actual y el flujo de registro de dos pasos se van a tener que repensar con esto.
  - **Piezas que se resuelven DENTRO de A2, no antes ni por separado:**
    - **Sacar la columna "Tipo" (Inmobiliaria/Particular) del panel `/admin`.** Sin particulares, la columna no distingue nada. Se saca en la misma pasada en que esa tabla reciba matrícula + estado de aprobación: una sola vez, no dos.
    - **El bug del loop del dashboard** (ver Deuda técnica). Con alta manual, "usuario registrado esperando aprobación" pasa a ser el estado normal de todo cliente nuevo, así que deja de ser una rareza.
    - **El registro no hace rollback del usuario de auth.** Si `signUp` funciona pero el insert de `agencies`/`agents` falla, queda un `auth.users` huérfano (medido: hay 2 en la base, uno de ellos con último login en el mismo segundo de su creación = registro fallido). `createAgentAction` sí hace rollback; `registerAction` no. Es el mismo problema de familia que el loop: sesión válida sin fila en `agents`.
    - **Verificación contra el padrón como ASISTENCIA, no como autorización.** El chequeo automático no sirve para autorizar (el padrón es público: prueba que la matrícula existe, no que quien la carga sea su dueño), pero sí para que el panel muestre "la matrícula 1234 existe y figura a nombre de X" y la aprobación del dueño sea un vistazo en vez de una investigación. **Depende de un dato no técnico: ¿el padrón del colegio es consultable automáticamente, o es un PDF/lista que hay que cargar como tabla de referencia?** Averiguarlo antes de diseñar. Nota estratégica: si el colegio da acceso al padrón, deja de ser un requisito de cumplimiento y pasa a ser un canal de adquisición.

### BLOQUE B — Datos de la propiedad (riqueza del listado)

- [ ] **B1 · Precio opcional / "Consultar" (EN EVALUACIÓN).** Problema real del rubro: el precio en el mapa filtra la tasación por m² de la zona, dato competitivo que las inmobiliarias no quieren regalar (es por lo que muchas no suben a Redfira, la competencia, que OBLIGA a poner precio). Tensión: el visitante quiere ver precio (es lo primero que mira), pero la agencia no siempre quiere mostrarlo. **Dirección propuesta (no cerrada):** que sea una decisión POR PROPIEDAD — cada propiedad puede ser "precio visible" o "precio a convenir / Consultar". El pin del mapa, cuando no hay precio, muestra "Consultar" (o ícono) en vez del número — nunca un hueco ni "SIN PRECIO". Convierte un problema ("obligo o no") en una feature diferenciadora vs Redfira ("en Marka vos decidís"). Riesgo a vigilar: si TODAS ocultan, el mapa pierde valor para el visitante — apuesta: no pasa (alquileres tienden a mostrar; ventas de alto valor tienden a ocultar → mix natural). Toca: campo en `properties`, el pin (`formatPriceCompact`/marker) y el modal. Acotado.

- [ ] **B2 · Requisitos para alquiler (feature nueva, fácil).** El agente, al crear/editar la propiedad, marca con checkboxes qué requisitos pide para alquilar (recibo de sueldo, fotos de DNI, garantía propietaria, etc.) + una opción **"otro"** de texto libre. **NO se cargan archivos** — son solo las opciones que la propiedad requiere. Se muestran en el **modal**. **Mismo patrón que `amenities`** (lista flexible JSONB marcada en la propiedad, mostrada como chips en el modal) — molde ya existente; el "otro" de texto libre es el único agregado. Toca: campo en `properties` (JSONB tipo amenities), el form de propiedad y el modal. La más fácil de todas.

### BLOQUE C — Crecimiento y monetización (ideas del socio)

- [ ] **C1 · Registro OPCIONAL de visitantes + base para monetización de datos (EN EVALUACIÓN).** El socio quiere monetizar datos. Parte técnica viable y ya medio pensada (ver "¿Login opcional de visitantes?" en Decisiones de producto): auth de visitantes opcional (NUNCA obligatorio — el registro mata conversión), habilita favoritos sincronizados, alertas de precio, etc. **Parte de venta de datos — NOTA LEGAL IMPORTANTE (criterio técnico, no decisión tomada):** vender datos personales identificables está fuertemente regulado en Argentina (Ley 25.326): requiere consentimiento explícito e informado + registro de la base ante la autoridad. Distinguir: (a) datos personales identificables → alto riesgo legal y de confianza; (b) **datos de mercado AGREGADOS y anónimos** (precio/m² por zona, evolución, demanda por barrio) → más seguros, igual o más valiosos, vendibles a tasadoras/bancos/desarrolladores/colegio. Recomendación a discutir con el socio: sí al registro opcional, sí a monetizar — orientado primero a datos de mercado agregados (valor grande y limpio); venta de datos personales solo con aparato legal completo. **Diseñar el registro PREPARADO para consentimiento desde el día 1** (checkbox claro de uso de datos) — barato ahora, caro de retrofittear. NO documentar como decisión tomada; es para discutir entre los tres.

- [ ] **C2 · Página + link por propiedad (viable, alto retorno).** Cada propiedad con su URL propia para compartir (caso de uso: una inmobiliaria habla con un cliente FUERA de Marka y le pasa el link de esa propiedad). **Ya medio caminado:** cada propiedad YA tiene `slug` único; y ya estaba anotada como "Página SEO por propiedad" (`/propiedades/[slug]` + Open Graph) en V2. El modal NO tiene URL (se abre sobre el mapa) → la solución es una **página propia** en `/propiedades/[slug]` (página real, indexable, con fotos+datos+WhatsApp y botón "ver en el mapa"), no "darle URL al modal". Bonus enorme: esa página es **SEO** — cada propiedad indexable en Google (difusión orgánica gratis). El `slug` ya existente resuelve la base. Toca: ruta nueva + botón compartir + Open Graph (link lindo al pegarlo en WhatsApp).

### BLOQUE D — Ajustes de producto salidos de las reuniones con el rubro (ago 2026)

- [ ] **D1 · Autosugerir la ubicación del pin desde la dirección (ALTA PRIORIDAD, antes de septiembre).** **No contradice** la decisión "pin manual, NO geocoding" — la refina: el geocoding es el **punto de partida**, el pin manual sigue siendo la **fuente de verdad**. Por qué importa ahora: el cuello de botella real no son las features, es que cargar propiedades una por una es lento, y una agencia que se suscribe y no termina de cargar su cartera no renueva. Ahorrarle al agente arrastrar el mapa desde el centro de la ciudad en cada carga es tiempo real por propiedad. **Forma:** botón explícito ("Ubicar dirección aproximada"), NO búsqueda mientras escribe — Nominatim (geocoder gratuito de OSM) limita a 1 consulta/segundo y su política no admite autocompletado agresivo; con botón se cumple y no hace falta API paga. ⚠ **Trampa a resolver sí o sí:** hoy la regla es "si el pin no se movió, el form bloquea el submit". Si el geocoder mueve el pin, esa regla se satisface sola y se pierde la garantía → hay que reemplazarla por una **confirmación explícita** ("confirmar ubicación"). Sin eso, la feature empeora la calidad de los datos en vez de mejorarla.

- [ ] **D2 · Mostrar la agencia en el modal de propiedad (barata, valor comercial directo).** El modal no dice hoy a qué inmobiliaria pertenece la propiedad. Argumento de venta que habilita: *"tu marca aparece en cada propiedad que publicás, no solo en tu web"* — para una inmobiliaria que teme diluirse en un marketplace, cambia la conversación; y al visitante le da confianza. **A decidir al diseñar:** de dónde traer el nombre (y quizá el logo). Inclinación: **no** engordar `useProperties` (es la query caliente del mapa, con SELECT acotado a propósito) sino una consulta puntual al abrir el modal, que ya hace trabajo propio. ⚠ **En el white-label NO va**: ahí el header ya es la agencia y repetirlo es ruido. Cuando llegue C2, la página por propiedad hereda esto resuelto.

- [ ] **D3 · Filtros mobile: fila fija + panel (híbrido).** La intención es correcta (un desplegable es fricción; en mobile no se abre lo que no se ve), pero poner *todos* los filtros fijos se come media pantalla de mapa, que es lo que el visitante vino a ver — sería cambiar una fricción por otra peor. **Forma propuesta:** una tira fina fija arriba con los 2-3 filtros del 80% de los casos (operación venta/alquiler + tipo de propiedad) como chips tocables, y el resto (precio, ambientes, amenities) en el panel desplegable actual con su contador de filtros activos. Prioridad media, tanda corta, no bloquea nada.

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

## Panel admin de ida y vuelta — HACER ANTES DE OCTUBRE

> **El problema de fondo, en una línea: hoy el panel `/admin` es de una sola vía.** Se activa un plan y no hay ninguna UI para deshacerlo — ni bajar, ni cancelar un pedido, ni poner vencimiento. Todo lo que se activa queda activado de por vida. Las tres piezas de abajo tocan el mismo panel y el mismo modelo de suscripciones: **conviene hacerlas en una sola tanda**, no abrir el archivo tres veces.

- [ ] **Cancelar una solicitud de upgrade pendiente.** Barata y ya diseñada: limpiar `pending_plan = null` y `status = 'active'` (como `plan` nunca se pisó, vuelve solo a lo que regía). ⚠ **Se volvió más urgente con la guarda de reentrada de A1**: antes, una agencia que pedía el plan equivocado podía volver a `/register/plan` y elegir otro; ahora rebota a `/dashboard/suscripcion`, donde los botones de upgrade están deshabilitados mientras hay un pedido pendiente. **Queda trabada hasta que el dueño active o revierta a mano.** El camino viejo era el peligroso (por eso se cerró), pero esto es ahora la única salida. Hace falta el botón, del lado del cliente y/o del panel.

- [ ] **Establecer fecha de vencimiento del plan (`current_period_end`).** **La columna YA EXISTE y la UI YA la sabe mostrar** (`SubscriptionContent` renderiza "Plan activo hasta el {fecha}"), pero **nadie la escribe nunca**: las 10 filas de la base están en `null`, así que ese bloque de UI no se renderiza jamás. Lo único que falta es un campo de fecha en el formulario de activación de `/admin`. **Esto es lo que resuelve la prueba gratuita hasta enero**: al activar a una fundadora se le pone el vencimiento, ella lo ve en su panel, y en diciembre el dueño sabe a quién llamar sin depender de acordarse. Casi cero código para bastante valor.

- [ ] **Dar de baja / bajar de plan.** La única de las tres con una **decisión de producto sin resolver**: ¿qué pasa con las propiedades que exceden el límite del plan menor? (ej. una agencia con 50 propiedades baja a un plan de 20). ¿Se pausan? ¿Cuáles, y quién elige — el dueño, la agencia, o las más viejas automáticamente? Hay que contestarlo antes de escribir código. Incluye poner `activated_at` a `null` al desactivar. Sin apuro real: no se va a dar de baja a nadie en 2026. Nota de modelo: **una baja no es expresable hoy** — el CHECK de `subscriptions.pending_plan` solo admite planes pagos, así que no hay forma de registrar "esta agencia pidió bajar".

---

## Cobro real (V2)

- [ ] **Fechas de vencimiento / ciclos de cobro** — manejo de `current_period_end`, avisos de vencimiento, desactivación automática. Hoy `current_period_end` no se toca; la activación y desactivación son 100% manuales.
- [ ] **Cobro automatizado** — integración MercadoPago/Stripe (reemplaza la activación manual).
- [ ] **Precios en ARS revisables vs anclados a USD** — decidir al activar cobro real.

---

## Deuda técnica

- [x] **~~3 errores de lint preexistentes~~ (`ClusterLayer.tsx` x2 y `StatsCard.tsx`) — YA NO EXISTEN.** Medido el 27 ago 2026 contra el repo: `npm run lint` da **0 errores**. Se arreglaron en algún momento y el ítem quedó sin tachar, contradiciendo a `CLAUDE.md`. **Baseline real y vigente: 0 errores de TS, 0 errores de lint, 1 warning** (`PropertyForm.tsx:232`, `react-hooks/incompatible-library` por el `watch()` de react-hook-form), build verde con 17 rutas. *Lección: los números de la documentación se relevan, no se asumen.*

- [ ] **`/register/plan` no está en `PROTECTED_PREFIXES` del proxy** — un usuario sin sesión que pida esa URL no rebota en el middleware sino en la propia página (`if (!user) redirect("/login")`, que ya estaba). Funciona, pero es una asimetría con el resto del área privada. No se cambió porque tocar `PROTECTED_PREFIXES` afecta a `/register` entero (que debe seguir siendo público). Cosmético; revisar cuando A2 rediseñe el flujo de entrada.

- [ ] **`subscriptions.current_period_end` es código muerto de facto** — se lee y se muestra, nadie la escribe. Absorbido por "Panel admin de ida y vuelta"; queda anotado acá porque es una columna con consumidor de UI y sin productor.

- [ ] **`public.spatial_ref_sys` sin RLS** (aviso del security advisor de Supabase) — tabla de catálogo de proyecciones de PostGIS, legible/escribible por `anon` y `authenticated`. Sin datos de negocio, riesgo real bajo, pero está expuesta. ⚠ **No basta con `ENABLE ROW LEVEL SECURITY`**: sin una policy de SELECT se romperían las transformaciones de coordenadas de PostGIS. Si se toca, hay que hacerlo con la policy de lectura pública incluida.

- [ ] **Multi-agente no tiene millaje real** — las 10 agencias de la base tienen **exactamente 1 agente cada una**. Toda la maquinaria (`/dashboard/equipo`, roles admin/agent, reasignación de `agent_id`, policy `Admin reads agency leads`) está implementada y probada en desarrollo, pero nunca se ejercitó con una agencia de varios agentes real. No es un problema; es un camino sin recorrer que conviene mirar con lupa cuando una fundadora sume su primer agente.

- [ ] **`02-plan-app-inmobiliaria.md` (vive en el Project de Claude, NO en el repo) está globalmente desactualizado** — describe el modelo viejo de 2 planes (free/pro, 5 propiedades) y su "Fase 3" está casi toda hecha. Se hicieron correcciones puntuales, pero el archivo entero merece una reescritura o una jubilación. **La hoja de ruta viva es este archivo (`PENDIENTES.md`), no aquel.**
- [x] **Slug de agencia "feo"** — RESUELTO. `generateUniqueAgencySlug` (`lib/utils/agencySlug.ts`) genera slug limpio para agencias (base + sufijo numérico incremental `-2`, `-3`…; aleatorio solo como último recurso ante 100 colisiones), distinto de `generateSlug` (propiedades, sufijo aleatorio). Consumido por la ruta white-label `/[slug]`. (Falta solo poder editarlo desde el dashboard → Sub-pieza C de white-label.)
- [ ] **Seguridad fina de las policies de Storage — ANTES DE OCTUBRE.** Hoy es aceptable porque no hay datos ni clientes reales; deja de serlo el día que entren las inmobiliarias fundadoras con sus fotos. Las policies de `storage.objects` hoy son **laxas**: INSERT/UPDATE/DELETE permiten a cualquier `authenticated` operar sobre todo el bucket `property-images`, sin validar uid ni agencia por path. Es aceptable en desarrollo pero permite que un autenticado toque archivos ajenos. Antes de producción real: reescribir con seguridad fina (validar uid en la posición correcta del path para avatares/propiedades, y pertenencia a la agencia para logos). Nota histórica: la policy de DELETE original SÍ intentaba seguridad fina (`(storage.foldername(name))[1] = auth.uid()`) pero nunca matcheaba para `avatars/`/`logos/` (la 1ª carpeta es la palabra literal, no el uid) → quedó reemplazada por la laxa al arreglar el problema de reemplazo. Este ítem absorbe el viejo "bug de DELETE de avatares".
- [ ] **Edición del nombre de la agencia (`agencies.name`)** — hoy el nombre es read-only tras el registro (se muestra en el white-label desde `agencies.name`). Permitir editarlo NO es un campo de texto libre: el nombre está **semi-regulado** (el colegio/consejo de corredores aprueba nombres de agencias matriculadas para evitar confusión, ej. no puede haber "Lima" y "Limah"). Por eso la edición debe ser un **flujo de aprobación**: el admin de la agencia *pide* el cambio, el dueño de la app lo *aprueba* desde el panel admin (parecido al flujo de activación de planes), no un campo editable directo con warning. Pieza propia, futura. Sacada de la Sub-pieza B por esta razón.
- [ ] **Dashboard entra en loop si el agente no tiene agencia resoluble** — si un usuario autenticado tiene sesión válida pero su fila en `agents` o su `agencies` no existe (ej. borrado manual de la agencia), el dashboard redirige en bucle (307 en cadena → el navegador rate-limita `history.replaceState` → `SecurityError`). En producción no debería pasar (no se borran agencias con usuarios vivos), pero el fallo es feo. Lo prolijo: detectar "sesión válida sin agente/agencia" y **cerrar sesión + mandar a login con mensaje**, en vez de ciclar. Encontrado al regenerar la agencia demo tras un borrado accidental. ⚠ **Deja de ser una rareza: se resuelve DENTRO de A2**, donde "registrado esperando aprobación" pasa a ser el estado normal de todo cliente nuevo. Emparentado con la falta de rollback del registro (hay 2 `auth.users` sin fila en `agents` en la base, medidos).
- [ ] **Escalado del panel `/admin`** — hoy trae todas las agencias y filtra client-side (correcto para pocas agencias). Cuando haya muchas, mover el filtrado a la query (server-side) y paginar.
- [ ] **Repo de migraciones**: RESUELTO (9 jun 2026). El `initial_schema.sql` ahora refleja la base real; se eliminó la bitácora parcial. El `03-schema.sql` del Project (tampoco está en el repo) es la fuente de verdad documentada.

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

- [x] **MCP de Supabase conectado (27 ago 2026)** — server remoto hosted (`https://mcp.supabase.com/mcp`, transporte HTTP, OAuth), configurado en `.mcp.json` con `--scope project`. **Acotado al proyecto (`project_ref`) y en `read_only=true`**: toda escritura rebota en el motor con `cannot execute UPDATE in a read-only transaction` (verificado con un `UPDATE ... WHERE false`). Grupos habilitados: `database`, `debugging`, `development`, `docs`; deshabilitados a propósito storage, branching, edge functions y gestión de cuenta. Consecuencia de método: **Claude Code mide la base solo**, ya no hace falta pasarle queries por chat; los `ALTER` los sigue corriendo el dueño a mano en el SQL Editor (ahora impuesto por la base, no por convención). `respuesta.md` agregado al `.gitignore`. Documentado en `CLAUDE.md` → "Acceso a la base".

- [x] **A1 · App solo-agencias + guarda de reentrada en `/register/plan` (27 ago 2026).** Dos cosas en una tanda. **(1) Eliminados los particulares:** fuera el toggle de tipo de cuenta del registro, `agencyName` siempre requerido (con `.trim()`), `tenant_type: 'agency'` fijo desde el servidor, redirect siempre a `/register/plan`, el selector de plan ofrece **solo los tres pagos** (`PAID_PLANS` derivado de `PLAN_ORDER`, sin tocar el dominio de la columna), `PLANS.free.name` pasó de "Particular" a "Gratis" y se eliminó `PlanInfo.tenantType` (nadie lo leía). **Sin ningún cambio de base**: se verificó por consulta que la única agencia `individual` estaba vacía (0 propiedades, 0 leads) y que **nada en la base lee `tenant_type`** (cero triggers/funciones/policies). La columna y el tipo `TenantType` sobreviven a propósito. **(2) Arreglado un bug serio encontrado en el diagnóstico:** `/register/plan` quedaba accesible para siempre y su action escribía `plan: 'free'` + límites de free **incondicionalmente** → una agencia con plan pago activo que volviera a esa URL se auto-degradaba (perdía white-label, quedaba sobre el límite), sin confirmación ni vuelta atrás. Cerrado con la guarda de "aterrizaje virgen" (`plan free` + `pending_plan null` + `status active` + fila existente) **en la página y en la action**, más rechazo explícito de `'free'` como plan entrante. Efecto lateral aceptado: cambiar un pedido pendiente ahora requiere al dueño (ver "Panel admin de ida y vuelta"). Verificado a mano en navegador: registro, validación de nombre en blanco, guarda que deja pasar el alta virgen y rebota los otros tres estados, activación desde `/admin`, white-label y etiquetas nuevas.

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
