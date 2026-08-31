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
  -- agent_id es el agente que la cargó/gestiona. NULLABLE y ON DELETE SET NULL:
  -- la propiedad pertenece a la AGENCIA, no al agente. Si el agente se elimina/
  -- desvincula, la propiedad NO se borra; queda con agent_id NULL hasta que el
  -- admin la reasigne. El WhatsApp del lead usa el phone del agente asignado, y
  -- si es NULL, cae al phone_wa de la agencia (fallback).
  agent_id         UUID REFERENCES agents(id) ON DELETE SET NULL,
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
  operation_type   TEXT NOT NULL
                   CHECK (operation_type IN ('venta','alquiler','alquiler_temporal')),

  -- Precio
  price            NUMERIC(15,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','ARS')),
  price_negotiable BOOLEAN DEFAULT false,

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
  agent_id       UUID REFERENCES agents(id) ON DELETE SET NULL, -- NULL si la propiedad quedó sin agente
  agency_id      UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  contact_name   TEXT NOT NULL,
  contact_phone  TEXT,
  contact_email  TEXT,
  message        TEXT,
  source         TEXT NOT NULL DEFAULT 'whatsapp',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: agency_reviews ───────────────────────────────────
-- Historial de las decisiones de aprobación que el dueño de la plataforma toma
-- sobre una agencia. Una fila por veredicto: las decisiones NO se pisan entre
-- sí. El estado que RIGE hoy es agencies.approval_status; esta tabla es el
-- registro de cómo se llegó ahí.
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
-- Solo se registran VEREDICTOS: aprobar y rechazar. Volver una agencia rechazada
-- a 'pending' no es un veredicto y no deja fila (por eso el CHECK de decision no
-- admite 'pending').
CREATE TABLE agency_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- CASCADE: si se borra la agencia, su historial de revisiones se va con ella.
  decision    TEXT NOT NULL
              CHECK (decision IN ('approved', 'rejected')),
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

-- ─── ÍNDICES ─────────────────────────────────────────────────

-- Búsqueda geográfica (PostGIS)
CREATE INDEX idx_properties_location
  ON properties USING GIST(location);

-- Filtro principal del marketplace: ciudad + estado
CREATE INDEX idx_properties_city_status
  ON properties(city_id, status);

-- Filtros del mapa
CREATE INDEX idx_properties_type_op
  ON properties(property_type, operation_type);

CREATE INDEX idx_properties_price
  ON properties(price);

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

-- PROPERTIES: lectura pública solo 'active'; CRUD solo del agente dueño
CREATE POLICY "Public read active properties"
  ON properties FOR SELECT USING (status = 'active');

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

-- PROPERTY_IMAGES: lectura pública; escritura solo del agente dueño
CREATE POLICY "Public read property images"
  ON property_images FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_images.property_id AND p.status = 'active'
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
-- NOTA DE FIDELIDAD: esta es la policy REAL en producción hoy. NO contempla
-- todavía el caso agent_id IS NULL (agente desvinculado), porque ese caso aún
-- no puede ocurrir (ninguna propiedad tiene agent_id NULL). Cuando se implemente
-- la pieza "agente desvinculado" de Fase 3, esta policy se actualizará para
-- aceptar (p.agent_id IS NULL AND leads.agent_id IS NULL) y rutear el contacto
-- al phone_wa de la agencia. Recién entonces, no antes.
CREATE POLICY "Public insert lead"
  ON leads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leads.property_id
        AND p.status = 'active'
        AND p.agency_id = leads.agency_id
        AND p.agent_id = leads.agent_id
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
INSERT INTO properties (agent_id, agency_id, city_id, title, slug,
  property_type, operation_type, price, currency, area_covered_m2,
  bedrooms, bathrooms, address, neighborhood, city, lat, lng)
VALUES (
  'TU-UUID-DE-AUTH-AQUI',
  (SELECT id FROM agencies WHERE slug = 'inmobiliaria-demo'),
  (SELECT id FROM cities WHERE slug = 'santiago-del-estero'),
  'Casa 3 ambientes en el centro',
  'casa-3-amb-centro-001',
  'casa', 'venta',
  85000, 'USD', 120, 3, 2,
  'Av. Belgrano 1234', 'Centro', 'Santiago del Estero',
  -27.7951, -64.2615
);
*/