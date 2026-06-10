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
--   - 4 planes: free=1 (particular), inicial=20, profesional=60, premium=200.
--   - El límite de propiedades del plan se valida a nivel de base de datos.
-- ============================================================
-- NOTA DE FIDELIDAD: este archivo refleja el estado REAL de la base a la fecha.
-- Fase 3 — estado actual:
--   * role en agents: YA MIGRADO (incluido abajo).
--   * tenant_type en agencies: YA MIGRADO (incluido abajo).
--   * phone_wa en agencies: NO existe todavía — se agregará por ALTER.
-- No incluyas phone_wa acá hasta que esté realmente migrada, para que el
-- schema no mienta.
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
  -- tenant_type (Fase 3, YA MIGRADO). Distingue inmobiliaria de particular.
  -- 'agency': inmobiliaria (varios agentes). 'individual': particular (una
  -- persona, plan free). Internamente ambos son filas en agencies; el particular
  -- es una agencia de un solo miembro. DEFAULT 'agency': todo lo existente es
  -- inmobiliaria; 'individual' se elige explícitamente en el registro. La regla
  -- "individual → solo free" se valida en el backend del registro, no en la base
  -- (la escritura de subscriptions ya es solo service role; un trigger cross-table
  -- sería sobre-ingeniería hoy).
  tenant_type TEXT NOT NULL DEFAULT 'agency'
              CHECK (tenant_type IN ('individual', 'agency')),
  logo_url    TEXT,
  website     TEXT,
  -- FASE 3 (no implementado aún): phone_wa de la agencia como fallback del lead
  -- cuando el agente asignado ya no existe. Hoy la base NO tiene esta columna.
  -- Branding para la futura vista white-label (plan profesional/premium).
  brand_color TEXT,                       -- ej: "#A0522D" (override del acento)
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: subscriptions ────────────────────────────────────
-- Una suscripción por agencia. Controla el plan y el límite de propiedades.
-- El límite se valida a nivel de DB (trigger check_property_limit) y es
-- POR AGENCIA (compartido entre todos sus agentes).
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID UNIQUE NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- 4 planes. Límites: free=1, inicial=20, profesional=60, premium=200.
  -- white-label habilitado en profesional y premium; destacados+métricas en premium.
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
  address          TEXT NOT NULL,
  neighborhood     TEXT,
  city             TEXT NOT NULL,    -- nombre legible; city_id es la relación real
  province         TEXT,
  country          TEXT NOT NULL DEFAULT 'Argentina',
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,

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
-- para sembrar un particular sería: ..., tenant_type) VALUES (..., 'individual').
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