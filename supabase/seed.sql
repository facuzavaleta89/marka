-- ============================================================
-- SEED — Datos de prueba para desarrollo local
-- Ejecutar en Supabase → SQL Editor DESPUÉS de aplicar el schema
-- (supabase/migrations/20240101000000_initial_schema.sql).
-- ============================================================
--
-- ⚠ ES EL ÚNICO SEED DEL PROYECTO. El archivo de schema tenía una copia
-- comentada que había quedado DISTINTA de esta (aquella decía `free, 1` y ésta
-- `free, 5`, aquella nombraba phone_wa y ésta no), o sea dos seeds divergentes
-- de los cuales el que la convención dice ejecutar era el roto. Desde el
-- 17 sep 2026 el schema solo apunta acá.
--
-- Revisado contra el schema real el 17 sep 2026 (information_schema y
-- pg_constraint). Lo que hace que este archivo corra y el anterior no:
--   · agencies.phone_wa es NOT NULL SIN DEFAULT, y además tiene el CHECK
--     agencies_phone_wa_format (^549[1-3][0-9]{9}$). El INSERT anterior no lo
--     nombraba: fallaba con 23502 en la línea 19 y nada de lo de abajo llegaba
--     a correr.
--   · agencies.approval_status cae en 'pending' por DEFAULT, y una agencia
--     pendiente NO SE VE EN PÚBLICO (agency_is_publicly_visible exige
--     approved). Para una demo usable se siembra 'approved' explícito.
--   · La suscripción ya NO se inserta: ver el punto 3.
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

-- 2. Agencia demo vinculada a la ciudad.
-- phone_wa: obligatorio y con formato de celular argentino (549 + característica
-- + número). approval_status: 'approved' a mano, porque el DEFAULT es 'pending'
-- y una agencia pendiente no aparece en el mapa ni tiene sitio de marca.
-- tenant_type cae en 'agency' por DEFAULT; NO sembrar 'individual', que es
-- legacy (la app es solo-agencias).
INSERT INTO agencies (city_id, name, slug, phone_wa, approval_status)
VALUES (
  (SELECT id FROM cities WHERE slug = 'santiago-del-estero'),
  'Inmobiliaria Demo',
  'inmobiliaria-demo',
  '5493854000000',
  'approved'
)
ON CONFLICT (slug) DO NOTHING;

-- 3. Suscripción: NO SE SIEMBRA, y no es un olvido.
--
-- El trigger trg_ensure_agency_subscription (AFTER INSERT ON agencies) ya creó
-- la fila junto con la agencia, con los DEFAULT de la tabla: plan 'free',
-- status 'active', property_limit 1, featured_limit 0 y los tres has_* en false
-- — que es exactamente el estado de aterrizaje de toda alta real.
--
-- ⚠ El INSERT que había acá era además un NO-OP: llevaba
-- `ON CONFLICT (agency_id) DO NOTHING` y subscriptions.agency_id es UNIQUE, así
-- que su `property_limit = 5` nunca se escribía. Peor: si alguien lo
-- "arreglaba" quitando el ON CONFLICT, la demo quedaba con un cupo que ninguna
-- agencia real tiene.
--
-- Para probar un plan pago, el camino es el de producción: activarlo desde
-- /admin. Si hace falta a mano, hay que escribir featured_limit y has_featured
-- JUNTOS (CHECK subscriptions_featured_coherence: has_featured = featured_limit > 0).

-- ============================================================
-- PASO MANUAL REQUERIDO
-- ============================================================
-- Antes de ejecutar el bloque de abajo debés:
--   1. Ir a Supabase → Authentication → Users → "Add user"
--   2. Crear el usuario con email y contraseña
--   3. Copiar el UUID generado y reemplazar 'TU-UUID-DE-AUTH-AQUI'
--
-- ⚠ El agente NO se puede sembrar sin ese paso: agents.id es la FK a
-- auth.users(id). Y tiene que ir por SQL o service role: `authenticated` no
-- tiene permiso de INSERT sobre agents (ver ROW LEVEL SECURITY en el schema).
-- ============================================================

-- 4. Agente (descomentar y completar el UUID después del paso manual).
-- role 'admin': es el único agente de la agencia, así que la gestiona (Equipo,
-- datos de la agencia, propiedades de todo el equipo). El DEFAULT es 'agent',
-- así que hay que escribirlo.
-- phone_wa: mismo formato que la agencia (CHECK agents_phone_wa_format). Es el
-- número con el que se arma el enlace de WhatsApp de cada propiedad.
-- email: copia de lectura de auth.users, la que muestra la pantalla de Equipo.
-- INSERT INTO agents (id, agency_id, role, full_name, phone_wa, email)
-- VALUES (
--   'TU-UUID-DE-AUTH-AQUI',
--   (SELECT id FROM agencies WHERE slug = 'inmobiliaria-demo'),
--   'admin',
--   'Juan Pérez',
--   '5493854000001',
--   'juan@inmobiliaria-demo.com'
-- )
-- ON CONFLICT (id) DO NOTHING;
