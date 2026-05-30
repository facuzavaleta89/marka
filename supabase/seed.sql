-- ============================================================
-- SEED — Datos de prueba para desarrollo local
-- Ejecutar en Supabase → SQL Editor DESPUÉS de aplicar el schema
-- ============================================================

-- 1. Ciudad: Santiago del Estero
INSERT INTO cities (name, slug, province, center_lat, center_lng, default_zoom)
VALUES (
  'Santiago del Estero',
  'santiago-del-estero',
  'Santiago del Estero',
  -27.7951,
  -64.2615,
  13
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Agencia demo vinculada a la ciudad
INSERT INTO agencies (city_id, name, slug)
VALUES (
  (SELECT id FROM cities WHERE slug = 'santiago-del-estero'),
  'Inmobiliaria Demo',
  'inmobiliaria-demo'
)
ON CONFLICT (slug) DO NOTHING;

-- 3. Suscripción free para la agencia (property_limit = 5)
INSERT INTO subscriptions (agency_id, plan, property_limit)
VALUES (
  (SELECT id FROM agencies WHERE slug = 'inmobiliaria-demo'),
  'free',
  5
)
ON CONFLICT (agency_id) DO NOTHING;

-- ============================================================
-- PASO MANUAL REQUERIDO
-- ============================================================
-- Antes de ejecutar el bloque de abajo debés:
--   1. Ir a Supabase → Authentication → Users → "Add user"
--   2. Crear el usuario con email y contraseña
--   3. Copiar el UUID generado y reemplazar 'TU-UUID-DE-AUTH-AQUI'
-- ============================================================

-- 4. Agente (descomentar y completar el UUID después del paso manual)
-- INSERT INTO agents (id, agency_id, full_name, phone_wa)
-- VALUES (
--   'TU-UUID-DE-AUTH-AQUI',
--   (SELECT id FROM agencies WHERE slug = 'inmobiliaria-demo'),
--   'Juan Pérez',
--   '5493854000000'
-- )
-- ON CONFLICT (id) DO NOTHING;
