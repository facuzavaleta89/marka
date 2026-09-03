-- ============================================================
-- SCHEMA COMPLETO — App Mapa Inmobiliario (Marketplace multi-ciudad)
-- ============================================================
--
-- Este archivo es la FUENTE DE VERDAD del schema, y refleja el estado REAL
-- de la base de producción a la fecha. Correrlo entero contra una base limpia
-- (Supabase → SQL Editor, o supabase db reset) recrea la base completa.
-- Vive versionado en el repo como supabase/migrations/20240101000000_initial_schema.sql.
--
-- Reemplaza al antiguo schema de 2 planes (free/pro): este incluye los 4 planes,
-- agents.role, agencies.tenant_type, los entitlements has_* y todas las policies
-- de Fase 3 que se habían aplicado a mano y no estaban versionadas.
--
-- NO correr contra la base de producción actual (ya tiene todo): los CREATE TABLE/
-- POLICY no son idempotentes y tirarían "ya existe". Su propósito es recrear desde cero.
--
-- MODELO: Marketplace multi-tenant.
--   - El visitante ve UN mapa con las propiedades de TODAS las agencias
--     de una misma ciudad (mercado).
--   - Cada agencia pertenece a una ciudad y tiene una suscripción.
--   - 4 valores de plan, pero solo 3 de venta: inicial=20, profesional=60,
--     premium=200. 'free'=1 es el estado de aterrizaje, no un producto.
--   - El límite de propiedades del plan se valida a nivel de base de datos.
-- ============================================================
-- NOTA DE FIDELIDAD: este archivo refleja el estado REAL de la base a la fecha.
-- Solo se documenta acá lo que YA está migrado; nada "por venir", para que el
-- schema no mienta.
-- Estado actual:
--   * role en agents: YA MIGRADO (incluido abajo).
--   * tenant_type en agencies: YA MIGRADO (incluido abajo). Hoy es LEGACY.
--   * phone_wa en agencies: YA MIGRADO (nullable → backfill → NOT NULL). Incluido abajo.
--   * license_number y approval_status en agencies + tabla agency_reviews:
--     YA MIGRADOS (28 ago 2026). Alta manual de agencias con matrícula del
--     colegio de corredores y aprobación a mano del dueño desde /admin.
--     Backfill aplicado: las 10 agencias existentes quedaron en 'approved' y sin
--     matrícula. Incluidos abajo con sus índices y su RLS.
--   * check_agency_approved() + trg_check_agency_approved sobre properties, y
--     check_property_limit() actualizada (sin fila de suscripción → límite 0):
--     YA MIGRADOS (28 ago 2026). Son los DOS gates de publicación, incluidos
--     abajo con el porqué de que sean triggers y no policies.
--   * location_source en properties: YA MIGRADO por ALTER (31 ago 2026), junto
--     con el atajo que sugiere la ubicación del pin desde la dirección. Es un
--     dato de MEDICIÓN y no gatea nada. Incluido abajo, en el bloque de
--     ubicación de la tabla. Ojo con el ORDEN de las columnas: en la base real
--     quedó última (posición 34), porque se agregó por ALTER; acá va junto a
--     lat/lng, que es donde se entiende. El orden de columnas no cambia el
--     comportamiento (todos los INSERT son por nombre, y los únicos select('*')
--     del código van con head:true, o sea que cuentan filas sin traer columnas),
--     pero conviene saberlo si algún día se comparan las dos definiciones.
--   * agency_is_publicly_visible() + las TRES policies públicas reescritas para
--     usarla (lectura de properties, lectura de property_images, inserción de
--     leads): YA MIGRADAS (31 ago 2026). Es la regla de VISIBILIDAD PÚBLICA
--     —agencia aprobada + suscripción activa + plan pago—, incluida abajo con el
--     porqué de que viva en una función y no en cada consulta.
--   * check_agency_subscription() + trg_check_agency_subscription sobre
--     properties: YA MIGRADOS (31 ago 2026). Es el TERCER gate de publicación
--     (suscripción dada de baja o vencida). Incluido abajo.
--   * CHECK de agency_reviews.decision ampliado a SEIS valores (se sumaron
--     'plan_canceled', 'subscription_canceled', 'subscription_restored' y
--     'plan_changed'): YA MIGRADO (1 sep 2026). Incluido abajo.
--   * ⚠ DISCREPANCIA CONOCIDA Y NO RESUELTA en dos claves foráneas
--     (properties.agent_id y leads.agent_id): ver la nota en cada tabla. Este
--     archivo ahora dice lo que la base TIENE, que NO es lo que el modelo
--     pretendía. Resolverlo es la próxima tanda de trabajo (ver PENDIENTES.md).
-- ============================================================

-- Extensiones necesarias (PostGIS ya viene activado en Supabase)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- para búsquedas sin tildes

-- ─── TABLA: cities (mercados) ────────────────────────────────
-- Cada ciudad es un "mercado". El visitante navega un marketplace
-- filtrado por ciudad. El mapa se centra en center_lat/center_lng.
CREATE TABLE cities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,             -- "Santiago del Estero"
  slug         TEXT UNIQUE NOT NULL,      -- "santiago-del-estero"
  province     TEXT,                      -- "Santiago del Estero"
  country      TEXT NOT NULL DEFAULT 'Argentina',
  center_lat   DOUBLE PRECISION NOT NULL, -- centro del mapa al entrar
  center_lng   DOUBLE PRECISION NOT NULL,
  default_zoom INT NOT NULL DEFAULT 13,   -- zoom inicial del mapa
  is_active    BOOLEAN NOT NULL DEFAULT true, -- ciudad habilitada para el público
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: agencies ─────────────────────────────────────────
-- Cada agencia (inmobiliaria) pertenece a una ciudad.
CREATE TABLE agencies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,             -- nombre de la inmobiliaria
  slug        TEXT UNIQUE NOT NULL,
  -- tenant_type — LEGACY (27 ago 2026). La app es SOLO-AGENCIAS: el registro
  -- escribe siempre 'agency' y ningún flujo produce 'individual'. El valor
  -- sobrevive únicamente en filas históricas y se muestra en el panel /admin.
  -- La columna y el CHECK NO se borraron a propósito: nada de la base los lee
  -- (verificado por consulta: cero triggers, funciones o policies mencionan
  -- tenant_type), así que borrarlos no aporta nada y la tabla se vuelve a tocar
  -- en el trabajo de matrícula/alta manual.
  -- ⚠ CORRECCIÓN: una versión anterior de este comentario afirmaba que la regla
  -- "individual → solo free" se validaba en el backend del registro. Se relevó
  -- el código: ESA VALIDACIÓN NUNCA EXISTIÓ. El particular terminaba en free
  -- porque TODAS las altas terminan en free (estado de aterrizaje), no porque
  -- alguna capa lo evaluara. Un particular que navegara a mano a /register/plan
  -- podía pedir cualquier plan pago.
  tenant_type TEXT NOT NULL DEFAULT 'agency'
              CHECK (tenant_type IN ('individual', 'agency')),
  logo_url    TEXT,
  website     TEXT,
  -- Teléfono de WhatsApp de la agencia (Fase 3, YA MIGRADO: agregado por ALTER
  -- nullable → backfill con el phone_wa del admin fundador → SET NOT NULL).
  -- Obligatorio: toda agencia tiene un WhatsApp de contacto. Se setea en el
  -- registro (hereda el del admin que la crea) y se edita en Preferencias (solo
  -- el admin de agencia). Mismo formato que agents.phone_wa ("5491112345678").
  phone_wa    TEXT NOT NULL,
  -- ── Legitimidad de la agencia (28 ago 2026, YA MIGRADO por ALTER) ──────
  -- Número de matrícula del colegio de corredores inmobiliarios.
  -- NULLABLE a propósito: las agencias anteriores al alta manual no la tienen
  -- (el backfill las dejó aprobadas y sin matrícula). En toda alta nueva es
  -- obligatoria, pero esa obligación la impone el formulario de registro, no la
  -- base: si fuera NOT NULL no habría forma de migrar lo viejo sin inventar datos.
  -- Puede ser pública sin problema: el padrón del colegio ya lo es.
  license_number  TEXT,
  -- Estado de aprobación de la agencia, decidido A MANO por el dueño de la
  -- plataforma desde el panel /admin.
  --
  -- ⚠ ES UN EJE INDEPENDIENTE DE LA SUSCRIPCIÓN. Responde "¿es una inmobiliaria
  -- legítima?", que NO es lo mismo que "¿paga?" (eso lo responde
  -- subscriptions.plan/status). Los dos ejes se cruzan libremente: una agencia
  -- puede estar aprobada y sin plan pago, o pagar y seguir pendiente de
  -- aprobación. Nunca mezclarlos en una misma clasificación ni derivar uno del
  -- otro.
  --
  -- 'rejected' NO es definitivo: la agencia corrige sus datos y vuelve a
  -- 'pending'. No existe un estado de rechazo permanente (por eso el historial
  -- de decisiones va en agency_reviews, una fila por veredicto).
  --
  -- DEFAULT 'pending': toda agencia nueva nace pendiente. Las 10 filas que
  -- existían al migrar se backfillearon a 'approved'.
  approval_status TEXT NOT NULL DEFAULT 'pending'
              CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  -- Branding para la futura vista white-label (plan profesional/premium).
  brand_color TEXT,                       -- ej: "#A0522D" (override del acento)
  created_at  TIMESTAMPTZ DEFAULT now()
);
-- Nota de fidelidad sobre el ORDEN de columnas: tenant_type, phone_wa,
-- license_number y approval_status se agregaron por ALTER, así que en la base
-- real están al final (posiciones 9 a 12). Acá van en su lugar lógico, que es
-- más legible y no cambia nada funcional: todo el acceso es por nombre.

-- ─── TABLA: subscriptions ────────────────────────────────────
-- Una suscripción por agencia. Controla el plan y el límite de propiedades.
-- El límite se valida a nivel de DB (trigger check_property_limit) y es
-- POR AGENCIA (compartido entre todos sus agentes).
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID UNIQUE NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- 4 valores, pero SOLO TRES SE VENDEN: inicial=20, profesional=60, premium=200.
  -- white-label habilitado en profesional y premium; destacados+métricas en premium.
  -- 'free' (límite 1) NO es un producto: es el ESTADO DE ATERRIZAJE de toda alta.
  -- Toda agencia nace en free/active y sigue ahí mientras espera que el dueño de
  -- la app active el plan pago que pidió (lo pedido vive en pending_plan). Desde
  -- que se eliminaron los particulares, free ya no corresponde a ningún tipo de
  -- cuenta: es solo "todavía no paga". Nunca se ofrece como opción elegible.
  -- IMPORTANTE: 'plan' es el plan que RIGE hoy (sus límites son los efectivos).
  -- Nunca se pisa al pedir un upgrade; lo pedido va en pending_plan (ver abajo).
  plan            TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free', 'inicial', 'profesional', 'premium')),
  -- status: 'active' (free al instante, o pago confirmado); 'pending' (plan pago
  -- elegido, esperando activación manual por transferencia); past_due/canceled.
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'pending', 'past_due', 'canceled')),
  property_limit  INT NOT NULL DEFAULT 1,    -- del plan que rige. free=1, inicial=20, profesional=60, premium=200
  current_period_end TIMESTAMPTZ,             -- vencimiento del ciclo de cobro
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  -- Entitlements efectivos (fuente de verdad del gating de features en runtime;
  -- el código lee estos booleanos, NO el nombre del plan). Agregadas por ALTER
  -- en la migración de planes, por eso van al final del orden de columnas.
  has_white_label BOOLEAN NOT NULL DEFAULT false, -- profesional + premium
  has_featured    BOOLEAN NOT NULL DEFAULT false, -- premium (destacados)
  has_metrics     BOOLEAN NOT NULL DEFAULT false, -- premium (métricas)
  -- Plan pago PEDIDO esperando activación manual (Fase 3, agregada por ALTER).
  -- null = no hay upgrade pendiente. 'plan' sigue siendo el que rige; pending_plan
  -- es lo aspiracional. Al activar: pending_plan → plan, se suben límites/has_*
  -- a los reales, status → 'active', activated_at → now(), pending_plan → null.
  pending_plan    TEXT CHECK (pending_plan IS NULL OR pending_plan IN ('inicial', 'profesional', 'premium')),
  -- Fecha desde la que rige el plan pago activo actual; null si no hay plan pago
  -- activo (free, o pago en pending). La setea la activación del admin (no un
  -- trigger): se actualiza en cada activación/cambio/renovación de plan pago.
  activated_at    TIMESTAMPTZ
);
-- Nota: la escritura de subscriptions la hace solo el backend con service role.
-- La activación de un plan pago (status pending → active) la hace el admin de
-- la app desde un panel de admin, tras recibir la transferencia.

-- ─── TABLA: agents ───────────────────────────────────────────
-- id = mismo UUID que auth.users de Supabase Auth
-- Un agente pertenece a una agencia (NOT NULL en el modelo marketplace).
CREATE TABLE agents (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- role dentro de la agencia (Fase 3, YA MIGRADO).
  -- 'admin': gestiona suscripción, crea/ve agentes de su agencia, ve los leads de
  -- toda la agencia. 'agent': CRUD de sus propias propiedades.
  -- DEFAULT 'agent': nadie queda admin por accidente; el creador de la agencia
  -- se inserta explícitamente como 'admin'. Backfill: admin = el agente más
  -- antiguo de cada agencia. YA GATEA la sección "Equipo" (crear/listar agentes):
  -- la página y la action validan role === 'admin' server-side. Las RLS policies
  -- admin/agent más finas (ver leads de agencia, etc.) son piezas posteriores.
  role          TEXT NOT NULL DEFAULT 'agent'
                CHECK (role IN ('admin', 'agent')),
  full_name     TEXT NOT NULL,
  phone_wa      TEXT NOT NULL,   -- ej: "5491112345678" (sin +, sin espacios)
  -- Email denormalizado de auth.users (Fase 3, agregada por ALTER + backfill).
  -- Copia de lectura para mostrar en la UI; la fuente de verdad del login es
  -- auth.users. Nullable. El registro y el alta de agente por el admin lo setean.
  email         TEXT,
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: properties ───────────────────────────────────────
CREATE TABLE properties (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- agent_id es el agente que la cargó/gestiona.
  --
  -- ⚠ ESTO NO ES LO QUE EL MODELO PRETENDÍA, es lo que la base TIENE (medido el
  -- 1 sep 2026). El diseño escrito era "NULLABLE + ON DELETE SET NULL", con el
  -- argumento de que la propiedad pertenece a la AGENCIA y no al agente: si el
  -- agente desaparece, la propiedad queda sin asignar hasta que el admin la
  -- reasigne. La base nunca fue así: la columna es NOT NULL y la FK es CASCADE,
  -- o sea que borrar un agente BORRARÍA SUS PROPIEDADES.
  --
  -- Consecuencia viva: deleteAgentAction (equipo/actions.ts) reasigna las
  -- propiedades al admin ANTES de borrar al agente ("Modelo B"). Ese orden se
  -- justificaba como una prolijidad; con la FK real es lo ÚNICO que impide una
  -- pérdida de datos. No invertirlo.
  --
  -- Qué se decide después: si el modelo correcto es el escrito (y hay que
  -- ALTERar la base) o el real (y hay que corregir el modelo). Ver PENDIENTES.md.
  agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  agency_id        UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- city_id denormalizado: permite filtrar el mapa por ciudad sin JOIN.
  city_id          UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,

  -- Identificación
  title            TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'sold', 'rented')),

  -- Tipo
  property_type    TEXT NOT NULL
                   CHECK (property_type IN ('casa','departamento','terreno','local','oficina','campo','cochera')),

  -- ── COLUMNAS OBSOLETAS (3 sep 2026) ────────────────────────────────────
  -- Una propiedad tenía UNA operación y UN precio. Eso no permitía representar
  -- un caso real y frecuente del rubro: la misma casa ofrecida EN VENTA Y EN
  -- ALQUILER a la vez. La agencia tenía que elegir una operación o cargar la
  -- propiedad dos veces, lo que duplicaba el conteo del plan y ensuciaba el
  -- mapa. Las reemplazan las nueve columnas de abajo.
  --
  -- ⚠ SIGUEN EXISTIENDO EN LA BASE (medido), pero pasaron a ser NULLABLE y
  -- NINGÚN código las lee ni las escribe. Se borran en una migración posterior.
  -- Los datos ya se migraron: cada propiedad tiene activada la operación que
  -- tenía acá, con su precio y su moneda copiados.
  operation_type   TEXT
                   CHECK (operation_type IN ('venta','alquiler','alquiler_temporal')),
  price            NUMERIC(15,2),
  currency         TEXT DEFAULT 'USD' CHECK (currency IN ('USD','ARS')),
  -- price_negotiable: OBSOLETA Y PENDIENTE DE ELIMINACIÓN. Ya se eliminó del
  -- modelo, del formulario y de la interfaz (producía un sufijo "· Negociable"
  -- en el modal). Se solapaba con el precio a convenir, que es una señal más
  -- fuerte y más clara. La columna sobrevive solo hasta la migración de borrado.
  price_negotiable BOOLEAN DEFAULT false,

  -- ── OPERACIONES Y PRECIOS (3 sep 2026, YA MIGRADO por ALTER) ───────────
  -- Una propiedad puede ofrecerse en VARIAS operaciones a la vez, cada una con
  -- su propio precio: el dueño acepta lo que aparezca primero.
  --
  -- ⚠ PRECIO EN NULL CON LA OPERACIÓN ACTIVA = "A CONVENIR". No es un dato
  -- faltante ni un error: es una elección de la agencia. Publicar el precio en
  -- un mapa revela la tasación por m² de la zona, que es información
  -- competitiva, y muchas inmobiliarias no publican por eso. Cuando el precio
  -- era obligatorio, esas propiedades directamente no se cargaban.
  --
  -- Los CHECK de abajo imponen tres reglas, y las tres están medidas contra la
  -- base:
  --   1. properties_at_least_one_operation → al menos una operación activa.
  --   2. properties_<op>_operation  → operación apagada ⇒ su precio y su moneda
  --      son NULL (no queda un precio de alquiler colgado de algo que solo se
  --      vende).
  --   3. properties_<op>_price      → o precio y moneda son ambos NULL, o el
  --      precio es > 0 y la moneda es 'USD'/'ARS'. Precio y moneda viajan
  --      SIEMPRE juntos: no existe uno sin el otro (ver la nota de abajo).
  for_sale           BOOLEAN NOT NULL DEFAULT false,
  sale_price         NUMERIC(15,2),
  sale_currency      TEXT,
  for_rent           BOOLEAN NOT NULL DEFAULT false,
  rent_price         NUMERIC(15,2),
  rent_currency      TEXT,
  for_temp_rent      BOOLEAN NOT NULL DEFAULT false,
  temp_rent_price    NUMERIC(15,2),
  temp_rent_currency TEXT,

  CONSTRAINT properties_at_least_one_operation
    CHECK (for_sale OR for_rent OR for_temp_rent),

  -- ⚠ LOS TRES properties_<op>_price COMPARAN CONTRA "IS NOT NULL" EN LAS DOS
  -- RAMAS, Y NO ES REDUNDANTE: es lo único que cierra la trampa de la lógica de
  -- tres valores de PostgreSQL. Un CHECK rechaza la fila solo si su expresión da
  -- FALSE; si da NULL, se considera SATISFECHO.
  --
  -- La versión anterior era "(precio IS NULL AND moneda IS NULL) OR (precio > 0
  -- AND moneda IN (...))". Con un solo lado cargado —(NULL, 'USD') o (250000,
  -- NULL)— la primera rama daba FALSE y la segunda NULL (cualquier comparación
  -- contra NULL da NULL), o sea (FALSE OR NULL) = NULL: el par inconsistente
  -- entraba EN SILENCIO. Medido contra la base, las dos versiones lado a lado:
  --
  --   par                          vieja    nueva
  --   (NULL,   NULL)                true     true    ← "a convenir", válido
  --   (NULL,   'USD')               NULL     false   ← entraba; ahora se rechaza
  --   (250000, NULL)                NULL     false   ← entraba; ahora se rechaza
  --   (250000, 'USD')               true     true
  --   (0,      'USD')               false    false
  --
  -- Con el IS NOT NULL explícito la segunda rama nunca puede dar NULL, así que
  -- la expresión completa siempre es TRUE o FALSE y el CHECK decide de verdad.
  -- QUIEN SAQUE ESOS "IS NOT NULL" POR PARECER REDUNDANTES REABRE EL AGUJERO,
  -- y no se va a notar: no falla nada, solo entran filas con media pareja.
  --
  -- Transcritos exactamente como los devuelve pg_get_constraintdef (forma
  -- normalizada de PostgreSQL), solo con saltos de línea agregados.

  CONSTRAINT properties_sale_operation
    CHECK (for_sale OR (sale_price IS NULL AND sale_currency IS NULL)),
  CONSTRAINT properties_sale_price
    CHECK ((((sale_price IS NULL) AND (sale_currency IS NULL))
            OR ((sale_price IS NOT NULL) AND (sale_price > (0)::numeric)
                AND (sale_currency IS NOT NULL)
                AND (sale_currency = ANY (ARRAY['USD'::text, 'ARS'::text]))))),

  CONSTRAINT properties_rent_operation
    CHECK (for_rent OR (rent_price IS NULL AND rent_currency IS NULL)),
  CONSTRAINT properties_rent_price
    CHECK ((((rent_price IS NULL) AND (rent_currency IS NULL))
            OR ((rent_price IS NOT NULL) AND (rent_price > (0)::numeric)
                AND (rent_currency IS NOT NULL)
                AND (rent_currency = ANY (ARRAY['USD'::text, 'ARS'::text]))))),

  CONSTRAINT properties_temp_rent_operation
    CHECK (for_temp_rent OR (temp_rent_price IS NULL AND temp_rent_currency IS NULL)),
  CONSTRAINT properties_temp_rent_price
    CHECK ((((temp_rent_price IS NULL) AND (temp_rent_currency IS NULL))
            OR ((temp_rent_price IS NOT NULL) AND (temp_rent_price > (0)::numeric)
                AND (temp_rent_currency IS NOT NULL)
                AND (temp_rent_currency = ANY (ARRAY['USD'::text, 'ARS'::text]))))),

  -- Superficie
  area_total_m2    NUMERIC(10,2),
  area_covered_m2  NUMERIC(10,2),

  -- Ambientes
  bedrooms         INT NOT NULL DEFAULT 0,
  bathrooms        INT NOT NULL DEFAULT 0,
  parking_spots    INT NOT NULL DEFAULT 0,
  floor_number     INT,

  -- Ubicación
  -- IMPORTANTE: address es escrito por el agente, pero lat/lng se colocan
  -- MANUALMENTE moviendo un pin en el mapa (no por geocoding automático).
  -- Esa regla NO se derogó, se refinó (31 ago 2026): el formulario tiene un
  -- atajo OPCIONAL que, a pedido explícito del agente, sugiere una ubicación a
  -- partir de la dirección. Sigue sin haber geocodificación automática (nada
  -- busca solo) y la coordenada que se guarda es siempre la que el agente
  -- confirmó. Qué camino se usó queda registrado en location_source, abajo.
  address          TEXT NOT NULL,
  neighborhood     TEXT,
  city             TEXT NOT NULL,    -- nombre legible; city_id es la relación real
  province         TEXT,
  country          TEXT NOT NULL DEFAULT 'Argentina',
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  -- ── Origen de la coordenada (31 ago 2026, YA MIGRADO por ALTER) ────────
  -- De dónde salió el lat/lng de arriba:
  --   'manual'    → el agente arrastró el pin hasta el punto final.
  --   'suggested' → la ubicación la propuso el geocodificador a partir de la
  --                 dirección escrita, y el agente la confirmó SIN moverla.
  -- En los DOS casos el pin manual sigue siendo la fuente de verdad: la
  -- sugerencia es solo un punto de partida y no se guarda nada que el agente no
  -- haya confirmado. 'suggested' NO significa "sin revisar": significa
  -- "propuesta y aceptada tal cual".
  -- Vale la ÚLTIMA acción: si el agente pide una sugerencia y después arrastra
  -- el pin, la coordenada queda como 'manual'.
  --
  -- NULLABLE a propósito: las propiedades cargadas antes de que existiera el
  -- buscador de direcciones no tienen forma de saberlo, y ponerles un valor
  -- sería inventar el dato. Por eso el CHECK admite NULL explícitamente y la
  -- columna no tiene DEFAULT (que también sería inventarlo, en cada insert).
  --
  -- ⚠ Existe SOLO para poder MEDIR más adelante si las ubicaciones sugeridas
  -- quedaron peor puestas que las arrastradas a mano. NO gatea ni condiciona
  -- nada en la aplicación: ninguna query, policy, trigger ni pantalla ramifica
  -- por este valor, y no debe hacerlo. Si alguna vez condiciona una decisión,
  -- deja de medir el comportamiento y pasa a alterarlo.
  location_source  TEXT
                   CHECK (location_source IS NULL OR location_source IN ('manual','suggested')),

  -- Columna geográfica generada automáticamente desde lat/lng
  location         GEOGRAPHY(POINT, 4326)
                   GENERATED ALWAYS AS (ST_MakePoint(lng, lat)) STORED,

  -- Amenities como array JSONB flexible
  -- Ejemplo: ["pileta","quincho","seguridad_24h"]
  amenities        JSONB NOT NULL DEFAULT '[]',

  -- Extras
  year_built       INT,
  is_featured      BOOLEAN NOT NULL DEFAULT false,
  views_count      INT NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: property_images ───────────────────────────────────
CREATE TABLE property_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  is_cover      BOOLEAN NOT NULL DEFAULT false,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: leads ────────────────────────────────────────────
-- Se registra cada vez que alguien hace click en "Consultar por WhatsApp"
CREATE TABLE leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  -- ⚠ MISMA DISCREPANCIA que properties.agent_id, y peor: acá la FK real NO
  -- TIENE cláusula ON DELETE, o sea NO ACTION. Medido el 1 sep 2026.
  -- Consecuencia viva, hoy, en producción: NO SE PUEDE BORRAR UN AGENTE QUE
  -- TENGA CONSULTAS A SU NOMBRE — el DELETE de auth.users cascadea a `agents` y
  -- ahí choca contra esta FK. deleteAgentAction reasigna las propiedades, pero
  -- NO los leads (el comentario de CLAUDE.md que decía que los leads viejos
  -- quedaban en agent_id NULL describía el modelo escrito, no la base).
  agent_id       UUID NOT NULL REFERENCES agents(id),
  agency_id      UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  contact_name   TEXT NOT NULL,
  contact_phone  TEXT,
  contact_email  TEXT,
  message        TEXT,
  source         TEXT NOT NULL DEFAULT 'whatsapp',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: agency_reviews ───────────────────────────────────
-- Historial de las decisiones que el dueño de la plataforma toma sobre una
-- agencia: las de APROBACIÓN (aprobar/rechazar) y las COMERCIALES (cancelar una
-- solicitud de plan, dar de baja, reactivar, cambiar de plan). Una fila por
-- decisión: no se pisan entre sí. El estado que RIGE hoy vive en
-- agencies.approval_status y en subscriptions; esta tabla registra cómo se llegó
-- ahí. Ver el CHECK de `decision` más abajo para el reparto exacto.
--
-- ⚠ POR QUÉ LA NOTA VIVE ACÁ Y NO EN agencies (la razón de que exista esta tabla):
-- `agencies` tiene la policy `Public read agencies` con USING (true), o sea que
-- CUALQUIERA con la anon key puede leer esa tabla entera, sin sesión. Postgres
-- NO permite restringir columnas dentro de una policy, así que una columna
-- `rejection_note` en `agencies` sería pública de hecho — y la nota es un texto
-- que el dueño escribe sobre un tercero ("la matrícula no coincide con el
-- titular"). Sacarla a una tabla propia es lo que permite que sea privada.
-- Segunda razón, independiente: como el rechazo no es definitivo (la agencia
-- corrige y vuelve a 'pending'), una sola columna se pisaría en cada vuelta y se
-- perdería el rastro. Acá cada decisión queda.
--
-- Volver una agencia rechazada a 'pending' NO es un veredicto y no deja fila
-- (por eso el CHECK no admite 'pending').
--
-- ⚠ LA TABLA YA NO ES SOLO DEL EJE DE LEGITIMIDAD. El CHECK creció a SEIS
-- valores porque el panel /admin dejó de ser de una sola vía: las decisiones
-- COMERCIALES del dueño se registran en la misma línea de tiempo que las de
-- aprobación, para que al mirar una agencia se lea una sola historia.
--   'approved' / 'rejected'   → eje de LEGITIMIDAD (¿es una inmobiliaria real?).
--   'plan_canceled'           → se descartó una SOLICITUD de plan de la agencia.
--   'subscription_canceled'   → baja de la suscripción entera (reversible).
--   'subscription_restored'   → vuelta de esa baja.
--   'plan_changed'            → el dueño cambió el plan VIGENTE de una agencia
--                               que sigue siendo cliente. No es ninguno de los
--                               tres anteriores: no se descarta un pedido ni se
--                               apaga/enciende la suscripción.
--
-- ⚠ LA ELIMINACIÓN DE UNA AGENCIA NO SE REGISTRA ACÁ, y no es un olvido: la FK
-- de abajo es ON DELETE CASCADE, así que la fila "eliminé la agencia X" se
-- borraría junto con la agencia X. Un historial de eliminaciones no puede vivir
-- en una tabla que cascadea con lo eliminado; requeriría otra tabla sin FK, que
-- hoy no existe.
CREATE TABLE agency_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- CASCADE: si se borra la agencia, su historial de revisiones se va con ella.
  decision    TEXT NOT NULL
              CHECK (decision IN (
                'approved',
                'rejected',
                'plan_canceled',
                'subscription_canceled',
                'subscription_restored',
                'plan_changed'
              )),
  -- Motivo de la decisión. NULLABLE en la base, pero la server action lo EXIGE
  -- al rechazar (un rechazo sin motivo no le sirve a nadie) y lo deja opcional
  -- al aprobar. La regla vive en el código, no en la base, para no bloquear un
  -- futuro registro automático de decisiones sin nota.
  note        TEXT,
  -- auth.users.id del dueño que decidió. NULL si ese usuario se borra
  -- (ON DELETE SET NULL): la decisión sobrevive aunque se pierda el autor.
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── FUNCIÓN: límite de propiedades por plan ─────────────────
-- Impide que una agencia supere el property_limit de su suscripción.
-- Se valida a nivel de DB para que no dependa solo del frontend.
CREATE OR REPLACE FUNCTION check_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  max_allowed   INT;
BEGIN
  -- Solo cuenta propiedades que ocupan cupo (no las vendidas/alquiladas)
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE agency_id = NEW.agency_id
    AND status IN ('active', 'paused');

  SELECT property_limit INTO max_allowed
  FROM subscriptions
  WHERE agency_id = NEW.agency_id;

  -- Sin fila de suscripción NO hay cupo: antes max_allowed quedaba NULL, la
  -- comparación daba NULL y el insert pasaba sin límite alguno.
  IF max_allowed IS NULL THEN
    max_allowed := 0;
  END IF;

  -- En INSERT, o en UPDATE que reactiva una propiedad
  IF (TG_OP = 'INSERT' AND NEW.status IN ('active', 'paused'))
     OR (TG_OP = 'UPDATE' AND NEW.status IN ('active', 'paused')
         AND OLD.status NOT IN ('active', 'paused')) THEN
    IF current_count >= max_allowed THEN
      RAISE EXCEPTION 'Límite de propiedades alcanzado para el plan actual (máximo: %)', max_allowed
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_property_limit
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION check_property_limit();

-- ─── FUNCIÓN: agencia aprobada para publicar ─────────────────
-- Impide publicar propiedades si la agencia no pasó la aprobación manual del
-- dueño de la plataforma (agencies.approval_status).
--
-- ⚠ POR QUÉ ES UN TRIGGER Y NO UNA POLICY RLS: la server action que crea
-- propiedades usa SERVICE ROLE cuando un admin de agencia publica a nombre de
-- otro agente (la RLS `agent_id = auth.uid()` rechazaría ese agent_id), y el
-- service role SALTEA las policies. Un trigger corre siempre, sin importar el
-- rol: es la única barrera que cubre los dos caminos.
--
-- ⚠ SOLO EN INSERT, a propósito: editar una propiedad ya cargada sigue
-- permitido aunque la agencia se rechace después. A nadie se le quitan las
-- propiedades que ya publicó; lo que se bloquea es publicar nuevas.
--
-- Comparte ERRCODE con check_property_limit (23514), así que la aplicación los
-- distingue por el TEXTO del mensaje. Si se cambia este texto, hay que tocar
-- translatePropertyWriteError en dashboard/propiedades/actions.ts.
CREATE OR REPLACE FUNCTION check_agency_approved()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Nombre load-bearing: Postgres dispara los triggers en ORDEN ALFABÉTICO, y
-- "trg_check_agency_approved" va antes que "trg_check_property_limit". Es el
-- orden correcto: a una agencia sin aprobar hay que decirle que le falta la
-- aprobación, no que alcanzó un límite de plan que nunca alcanzó.
CREATE TRIGGER trg_check_agency_approved
  BEFORE INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION check_agency_approved();

-- ─── FUNCIÓN: suscripción activa para publicar ───────────────
-- TERCER gate de publicación. Impide cargar propiedades si la suscripción de la
-- agencia está dada de baja o vencida.
--
-- ⚠ POR QUÉ ES UN TRIGGER Y NO UNA POLICY RLS: exactamente el mismo motivo que
-- check_agency_approved(). createPropertyAction usa SERVICE ROLE cuando un admin
-- de agencia publica a nombre de otro agente, y el service role SALTEA las
-- policies. Ese camino existe y se usa: una policy dejaría el agujero abierto
-- justo por ahí. El trigger corre siempre, sin importar el rol.
--
-- ⚠ LISTA NEGRA EXPLÍCITA, NUNCA "distinto de 'active'". El dominio de
-- subscriptions.status tiene CUATRO valores, y 'pending' significa "la agencia
-- pidió un upgrade y espera que el dueño se lo active". Esa agencia está al día
-- y publica normalmente: bloquear por "<> 'active'" le cortaría el alta JUSTO
-- POR HABER QUERIDO PAGAR MÁS. Se bloquea solo por 'canceled' y 'past_due'.
--
-- Sin fila de suscripción NO se bloquea acá a propósito: ese caso ya lo cubre
-- check_property_limit(), que trata "sin fila" como límite 0. Duplicarlo solo
-- cambiaría el mensaje de error por uno menos preciso.
CREATE OR REPLACE FUNCTION check_agency_subscription()
RETURNS TRIGGER AS $$
DECLARE
  sub_status TEXT;
BEGIN
  SELECT status INTO sub_status
  FROM subscriptions
  WHERE agency_id = NEW.agency_id;

  IF sub_status IN ('canceled', 'past_due') THEN
    RAISE EXCEPTION 'La suscripción de la agencia no está activa: no se pueden publicar propiedades'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ⚠ EL NOMBRE NO ES COSMÉTICO. Postgres dispara los triggers de una tabla en
-- ORDEN ALFABÉTICO de nombre, y los TRES gates comparten SQLSTATE (23514), así
-- que la aplicación los distingue por el TEXTO del mensaje: el primero que falla
-- es el mensaje que ve el agente. Este nombre ordena así:
--   trg_check_agency_approved < trg_check_agency_subscription < trg_check_property_limit
-- o sea aprobación → suscripción → cupo, que es la prioridad correcta y la misma
-- que replica getPublishBlock() en la interfaz. Decirle "alcanzaste el límite de
-- tu plan" a una agencia dada de baja es falso y la manda a pagar un upgrade que
-- no le destraba nada. Renombrarlo cambia el mensaje que se muestra.
--
-- ⚠ SOLO BEFORE INSERT, igual que el de aprobación: editar una propiedad ya
-- cargada sigue permitido aunque la agencia se dé de baja después. (Efecto
-- lateral conocido: reactivar una propiedad pausada es un UPDATE y no pasa por
-- acá. Ver PENDIENTES.md.)
--
-- ⚠ Si se cambia el TEXTO del mensaje de arriba, hay que tocar
-- translatePropertyWriteError en dashboard/propiedades/actions.ts, que matchea
-- la palabra "suscripción".
CREATE TRIGGER trg_check_agency_subscription
  BEFORE INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION check_agency_subscription();

-- ─── FUNCIÓN: visibilidad pública de una agencia ─────────────
-- LA REGLA DE COBRO, y el único lugar donde vive: una agencia se muestra al
-- público solo si está APROBADA, su suscripción está ACTIVA y su plan NO es el
-- de aterrizaje ('free'). Tres condiciones, un solo lugar.
--
-- ⚠ POR QUÉ UNA POLICY (que llama a esto) Y NO UN FILTRO EN CADA CONSULTA:
-- hay DOS caminos públicos que leen propiedades con la anon key —el hook del
-- mapa (useProperties) y el modal, que consulta una propiedad por id—. Un filtro
-- por consulta habría que ponerlo en los dos, y el que se olvide filtra mal EN
-- SILENCIO: sigue devolviendo propiedades, solo que de agencias que no pagan.
-- En la policy la regla se aplica sola en todo camino, presente y futuro.
-- Se midió el plan de ejecución antes de decidir: el acceso a la tabla caliente
-- (properties) no se degradó, y las dos tablas del join tienen UNA fila por
-- agencia (agencies por PK, subscriptions por su UNIQUE de agency_id).
--
-- ⚠ POR QUÉ SECURITY DEFINER: el visitante es ANÓNIMO, y la policy
-- `Agency members read own subscription` solo deja leer `subscriptions` a los
-- agentes de esa agencia. Sin SECURITY DEFINER, el EXISTS de adentro no vería
-- ninguna fila de suscripción para nadie, daría false SIEMPRE y el mapa quedaría
-- vacío para todo el mundo. Es seguro: no recibe más que un id, no devuelve
-- datos (solo un booleano) y tiene search_path fijo.
--
-- STABLE: dentro de una misma consulta el resultado no cambia, así que el
-- planificador puede cachearla por agencia en vez de evaluarla fila por fila.
CREATE OR REPLACE FUNCTION agency_is_publicly_visible(target_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM agencies a
    JOIN subscriptions s ON s.agency_id = a.id
    WHERE a.id = target_agency_id
      AND a.approval_status = 'approved'
      AND s.status = 'active'
      AND s.plan <> 'free'
  );
$$;

-- ─── ÍNDICES ─────────────────────────────────────────────────

-- Búsqueda geográfica (PostGIS)
CREATE INDEX idx_properties_location
  ON properties USING GIST(location);

-- Filtro principal del marketplace: ciudad + estado
CREATE INDEX idx_properties_city_status
  ON properties(city_id, status);

-- Filtros del mapa
-- ⚠ Estos dos son de las columnas OBSOLETAS (operation_type / price) y se van
-- con ellas en la migración de borrado. Los reemplazan los tres parciales de
-- abajo.
CREATE INDEX idx_properties_type_op
  ON properties(property_type, operation_type);

CREATE INDEX idx_properties_price
  ON properties(price);

-- Un índice PARCIAL por operación (3 sep 2026, YA MIGRADO por ALTER): indexa
-- solo las filas que ofrecen esa operación, que es exactamente lo que el mapa
-- consulta (ciudad + la operación filtrada, con rango de precio opcional).
CREATE INDEX idx_properties_for_sale
  ON properties(city_id, sale_price) WHERE for_sale;

CREATE INDEX idx_properties_for_rent
  ON properties(city_id, rent_price) WHERE for_rent;

CREATE INDEX idx_properties_for_temp_rent
  ON properties(city_id, temp_rent_price) WHERE for_temp_rent;

CREATE INDEX idx_properties_agent
  ON properties(agent_id);

CREATE INDEX idx_properties_agency
  ON properties(agency_id);

-- Búsqueda de amenities dentro del JSONB
CREATE INDEX idx_properties_amenities
  ON properties USING GIN(amenities);

-- Imágenes por propiedad
CREATE INDEX idx_property_images_property
  ON property_images(property_id, sort_order);

-- Agencias por ciudad
CREATE INDEX idx_agencies_city
  ON agencies(city_id);

-- Bandeja de entrada del panel /admin: "traeme las agencias pendientes".
CREATE INDEX idx_agencies_approval_status
  ON agencies(approval_status);

-- Unicidad de matrícula. El índice es PARCIAL a propósito, y las dos mitades de
-- la condición importan:
--
--   1) Solo entre agencias APROBADAS. Si fuera un UNIQUE común, una solicitud
--      con una matrícula ya usada reventaría en el registro con un error de
--      base. Eso es malo por dos motivos: la solicitud legítima (un tipeo, una
--      agencia que rehace su alta) no llegaría nunca al panel, y un impostor que
--      probara matrículas ajenas recibiría, del propio formulario, la
--      confirmación de cuáles existen. Con el índice parcial la solicitud entra
--      normal, queda 'pending', y el dueño ve las dos y decide cuál vale. El
--      choque recién ocurre al aprobar la segunda — donde tiene que ocurrir:
--      frente a una persona que puede resolverlo.
--   2) Solo cuando license_number IS NOT NULL, para que las agencias históricas
--      sin matrícula no colisionen entre sí (en un índice común, varios NULL no
--      colisionan, pero dejarlo explícito documenta la intención).
--
-- ⚠ LIMITACIÓN CONOCIDA — revisar al abrir una segunda ciudad de la misma
-- provincia: la unicidad es por (city_id, license_number), pero los colegios de
-- corredores son PROVINCIALES, no municipales. Una misma matrícula es válida en
-- toda la provincia, así que hoy la misma agencia podría aprobarse dos veces si
-- se dan de alta en dos ciudades distintas de la misma provincia. Mientras haya
-- una sola ciudad por provincia el problema no existe; el día que no,
-- corresponde mover el índice a (provincia, license_number) — lo que implica
-- resolver antes de dónde sale la provincia (hoy cities.province es TEXT libre).
CREATE UNIQUE INDEX idx_agencies_license_unique_approved
  ON agencies(city_id, license_number)
  WHERE approval_status = 'approved' AND license_number IS NOT NULL;

-- Historial de revisiones de una agencia, lo más nuevo primero.
CREATE INDEX idx_agency_reviews_agency
  ON agency_reviews(agency_id, created_at DESC);

-- Leads por agencia (dashboard)
CREATE INDEX idx_leads_agency
  ON leads(agency_id, created_at DESC);

-- ─── TRIGGER: updated_at automático ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────

ALTER TABLE cities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_reviews   ENABLE ROW LEVEL SECURITY;

-- ⚠ agency_reviews queda con RLS HABILITADA y CERO POLICIES, a propósito.
-- No es un olvido: con RLS habilitada y sin ninguna policy, Postgres deniega
-- todo — SELECT, INSERT, UPDATE y DELETE — para anon y authenticated. La tabla
-- solo es accesible con SERVICE ROLE desde el server, que es exactamente como
-- funciona el panel /admin (createAdminClient en las server actions, nunca desde
-- el cliente). Es lo que mantiene privada la nota de un rechazo, que es la razón
-- por la que esta tabla existe (ver el comentario de su CREATE TABLE).
-- NO agregarle policies "por prolijidad": cualquier policy de SELECT abriría la
-- nota a alguien, y no hay nadie fuera del server que deba leerla.

-- CITIES: lectura pública de ciudades activas
CREATE POLICY "Public read active cities"
  ON cities FOR SELECT USING (is_active = true);

-- AGENCIES: lectura pública
CREATE POLICY "Public read agencies"
  ON agencies FOR SELECT USING (true);

-- SUBSCRIPTIONS: solo el agente de la agencia puede ver su suscripción
CREATE POLICY "Agency members read own subscription"
  ON subscriptions FOR SELECT USING (
    agency_id IN (SELECT agency_id FROM agents WHERE id = auth.uid())
  );
-- Nota: la escritura de subscriptions la hace el backend (service role),
-- nunca el cliente. No se define policy de INSERT/UPDATE para usuarios.

-- AGENTS: lectura pública, edición solo del propio agente, insert en registro
CREATE POLICY "Public read agents"
  ON agents FOR SELECT USING (true);

CREATE POLICY "Agent manages own profile"
  ON agents FOR UPDATE USING (id = auth.uid());

-- Necesario para el registro: el insert de agents usa service role (admin.ts),
-- pero esta policy cubre el caso de edición del propio perfil con sesión activa.
CREATE POLICY "Agent creates own profile"
  ON agents FOR INSERT
  WITH CHECK (id = auth.uid());

-- PROPERTIES: lectura pública solo 'active' Y de agencia visible; CRUD solo del
-- agente dueño.
--
-- ⚠ EL SEGUNDO TÉRMINO ES LO QUE HACE COBRABLE EL PRODUCTO. Antes esta policy
-- era solo `status = 'active'`: una agencia que dejaba de pagar conservaba TODAS
-- sus propiedades en el mapa para siempre, y no había forma de sostener el
-- cobro. La regla completa vive en agency_is_publicly_visible() (aprobada +
-- suscripción activa + plan pago), no acá: ver el porqué en esa función.
--
-- Efecto de borde deseado: la baja y la reactivación desde /admin no tocan una
-- sola propiedad. Cambian el status de la suscripción y el mapa se apaga o se
-- enciende solo.
CREATE POLICY "Public read active properties"
  ON properties FOR SELECT USING (
    status = 'active' AND agency_is_publicly_visible(agency_id)
  );

CREATE POLICY "Agent manages own properties"
  ON properties FOR ALL USING (agent_id = auth.uid());

-- Permite que agentes vean propiedades de toda su agencia (active/paused/sold).
-- Necesario para que getPlanUsage() cuente correctamente en agencias multi-agente.
-- No genera regresión: los anónimos siguen viendo solo 'active'.
CREATE POLICY "Agency members read agency properties"
  ON properties FOR SELECT
  USING (
    agency_id IN (SELECT agency_id FROM agents WHERE id = auth.uid())
  );

-- PROPERTY_IMAGES: lectura pública; escritura solo del agente dueño.
-- Espeja la condición de `Public read active properties`, incluida la
-- visibilidad de la agencia: sin esto, las fotos de una agencia dada de baja
-- seguirían siendo legibles con la anon key aunque su propiedad ya no se listara.
CREATE POLICY "Public read property images"
  ON property_images FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_images.property_id
        AND p.status = 'active'
        AND agency_is_publicly_visible(p.agency_id)
    )
  );

CREATE POLICY "Agent manages own property images"
  ON property_images FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_images.property_id AND p.agent_id = auth.uid()
    )
  );

-- LEADS: el agente dueño puede ver sus leads
CREATE POLICY "Agent reads own leads"
  ON leads FOR SELECT USING (agent_id = auth.uid());

-- El admin de la agencia lee TODOS los leads de su agencia (Fase 3).
-- Convive con "Agent reads own leads": las policies SELECT permisivas se
-- combinan con OR, así que un 'agent' ve solo los suyos y un 'admin' ve los
-- de toda su agencia (sus propios leads ya quedan incluidos en ese conjunto).
-- Usa el mismo patrón de subquery sobre agents que el resto del schema (la
-- lectura pública de agents evita recursión de RLS); no se usan funciones
-- SECURITY DEFINER.
CREATE POLICY "Admin reads agency leads"
  ON leads FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agents
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Lead válido solo si property_id y agency_id corresponden a una propiedad
-- activa real, y el agent_id del lead coincide con el de la propiedad. Previene
-- spam e inconsistencias.
-- NOTA DE FIDELIDAD: esta es la policy REAL en producción hoy. NO contempla el
-- caso agent_id IS NULL (agente desvinculado), y hoy ese caso NO PUEDE EXISTIR:
-- properties.agent_id es NOT NULL en la base (ver la nota de esa columna, que es
-- justamente la discrepancia abierta con el modelo escrito). Si algún día se
-- implementa "agente desvinculado", primero hay que resolver esa discrepancia y
-- después actualizar esta policy para aceptar
-- (p.agent_id IS NULL AND leads.agent_id IS NULL) y rutear el contacto al
-- phone_wa de la agencia. Recién entonces, no antes.
CREATE POLICY "Public insert lead"
  ON leads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leads.property_id
        AND p.status = 'active'
        AND p.agency_id = leads.agency_id
        AND p.agent_id = leads.agent_id
        -- Misma regla de visibilidad que la lectura: si la agencia no se muestra
        -- al público, tampoco se le pueden registrar consultas. Es coherencia,
        -- no defensa en profundidad — sin propiedades visibles no hay de dónde
        -- salga el click de WhatsApp.
        AND agency_is_publicly_visible(p.agency_id)
    )
  );

-- ─── STORAGE BUCKET ─────────────────────────────────────────
-- Ejecutar en Supabase → Storage → New Bucket
-- Nombre: "property-images"  |  Public: true
-- (o crear via SQL):

INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public read property images storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

CREATE POLICY "Authenticated users can upload property images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete own property images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── SEED: datos de prueba ────────────────────────────────────
-- Después de crear un usuario con Supabase Auth, reemplazar el UUID:

/*
-- 1. Ciudad (mercado)
INSERT INTO cities (name, slug, province, center_lat, center_lng, default_zoom)
VALUES ('Santiago del Estero', 'santiago-del-estero', 'Santiago del Estero',
        -27.7951, -64.2615, 13);

-- 2. Agencia (pertenece a la ciudad). tenant_type cae en 'agency' por DEFAULT;
-- NO sembrar 'individual': la app es solo-agencias y ese valor es legacy.
-- ⚠ Dos cosas al usar este seed tal cual: phone_wa es NOT NULL sin default (hay
-- que agregarlo a la lista de columnas), y approval_status cae en 'pending' por
-- DEFAULT, así que la agencia sembrada NO va a tener sitio white-label hasta
-- aprobarla. Para una demo usable conviene sembrarla con
-- approval_status = 'approved' explícito.
INSERT INTO agencies (city_id, name, slug)
VALUES (
  (SELECT id FROM cities WHERE slug = 'santiago-del-estero'),
  'Inmobiliaria Demo', 'inmobiliaria-demo'
);

-- 3. Suscripción de la agencia (free por defecto: límite 1)
INSERT INTO subscriptions (agency_id, plan, property_limit)
VALUES (
  (SELECT id FROM agencies WHERE slug = 'inmobiliaria-demo'),
  'free', 1
);

-- 4. Agente (id = UUID de Supabase Auth).
-- role 'admin': es el único agente de la agencia y la creó, así que la gestiona.
INSERT INTO agents (id, agency_id, role, full_name, phone_wa, email)
VALUES (
  'TU-UUID-DE-AUTH-AQUI',
  (SELECT id FROM agencies WHERE slug = 'inmobiliaria-demo'),
  'admin',
  'Juan Pérez',
  '5491112345678',
  'juan@inmobiliaria-demo.com'
);

-- 5. Propiedad
-- Esta casa está en venta Y en alquiler a la vez: cada operación lleva su
-- propio precio. Para publicarla "a convenir" en alguna de las dos, se dejan
-- NULL su precio y su moneda (las dos juntas), manteniendo el flag en true.
INSERT INTO properties (agent_id, agency_id, city_id, title, slug,
  property_type,
  for_sale, sale_price, sale_currency,
  for_rent, rent_price, rent_currency,
  area_covered_m2,
  bedrooms, bathrooms, address, neighborhood, city, lat, lng)
VALUES (
  'TU-UUID-DE-AUTH-AQUI',
  (SELECT id FROM agencies WHERE slug = 'inmobiliaria-demo'),
  (SELECT id FROM cities WHERE slug = 'santiago-del-estero'),
  'Casa 3 ambientes en el centro',
  'casa-3-amb-centro-001',
  'casa',
  true, 85000, 'USD',
  true, 350000, 'ARS',
  120, 3, 2,
  'Av. Belgrano 1234', 'Centro', 'Santiago del Estero',
  -27.7951, -64.2615
);
*/