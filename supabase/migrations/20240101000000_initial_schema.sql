-- ============================================================
-- SCHEMA COMPLETO — App Mapa Inmobiliario (Marketplace multi-ciudad)
-- Ejecutar en Supabase → SQL Editor (en orden)
-- ============================================================
--
-- MODELO: Marketplace multi-tenant.
--   - El visitante ve UN mapa con las propiedades de TODAS las agencias
--     de una misma ciudad (mercado).
--   - Cada agencia pertenece a una ciudad y tiene una suscripción (free/pro).
--   - El límite de propiedades del plan se valida a nivel de base de datos.
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
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  website     TEXT,
  -- Branding opcional para una futura vista white-label (agencia.dominio.com)
  brand_color TEXT,                       -- ej: "#A0522D" (override del acento)
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: subscriptions ────────────────────────────────────
-- Una suscripción por agencia. Controla el plan y el límite de propiedades.
-- El plan 'free' permite hasta property_limit propiedades activas.
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID UNIQUE NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  plan            TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free', 'pro')),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'past_due', 'canceled')),
  property_limit  INT NOT NULL DEFAULT 5,    -- free = 5; pro = un número alto (ej: 9999)
  current_period_end TIMESTAMPTZ,             -- vencimiento del ciclo de cobro
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: agents ───────────────────────────────────────────
-- id = mismo UUID que auth.users de Supabase Auth
-- Un agente pertenece a una agencia (NOT NULL en el modelo marketplace).
CREATE TABLE agents (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone_wa      TEXT NOT NULL,   -- ej: "5491112345678" (sin +, sin espacios)
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── TABLA: properties ───────────────────────────────────────
CREATE TABLE properties (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  agent_id       UUID NOT NULL REFERENCES agents(id),
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

-- AGENTS: lectura pública, edición solo del propio agente
CREATE POLICY "Public read agents"
  ON agents FOR SELECT USING (true);

CREATE POLICY "Agent manages own profile"
  ON agents FOR UPDATE USING (id = auth.uid());

-- PROPERTIES: lectura pública solo 'active'; CRUD solo del agente dueño
CREATE POLICY "Public read active properties"
  ON properties FOR SELECT USING (status = 'active');

CREATE POLICY "Agent manages own properties"
  ON properties FOR ALL USING (agent_id = auth.uid());

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

-- Cualquiera puede generar un lead, pero property_id/agent_id/agency_id
-- deben corresponder a una propiedad activa real (evita spam e inconsistencias).
CREATE POLICY "Public insert lead"
  ON leads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leads.property_id
        AND p.status = 'active'
        AND p.agent_id = leads.agent_id
        AND p.agency_id = leads.agency_id
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

-- 2. Agencia (pertenece a la ciudad)
INSERT INTO agencies (city_id, name, slug)
VALUES (
  (SELECT id FROM cities WHERE slug = 'santiago-del-estero'),
  'Inmobiliaria Demo', 'inmobiliaria-demo'
);

-- 3. Suscripción de la agencia (free por defecto)
INSERT INTO subscriptions (agency_id, plan, property_limit)
VALUES (
  (SELECT id FROM agencies WHERE slug = 'inmobiliaria-demo'),
  'free', 5
);

-- 4. Agente (id = UUID de Supabase Auth)
INSERT INTO agents (id, agency_id, full_name, phone_wa)
VALUES (
  'TU-UUID-DE-AUTH-AQUI',
  (SELECT id FROM agencies WHERE slug = 'inmobiliaria-demo'),
  'Juan Pérez',
  '5491112345678'
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
