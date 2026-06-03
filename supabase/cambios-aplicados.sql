-- ============================================================
-- BITÁCORA DE CAMBIOS APLICADOS A LA BASE (en orden cronológico)
-- Cada bloque ya fue ejecutado a mano en el editor de Supabase.
-- Este archivo NO se ejecuta automáticamente; es el registro de
-- los cambios posteriores al initial_schema, para poder reconstruir.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 2026-06-02 — Modelo free/pro → 4 planes (free/inicial/profesional/premium)
-- ──────────────────────────────────────────────────────────

ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'inicial', 'profesional', 'premium'));

ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'pending', 'past_due', 'canceled'));

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS has_white_label BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_featured    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_metrics     BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE subscriptions ALTER COLUMN property_limit SET DEFAULT 1;

UPDATE subscriptions SET
  property_limit  = CASE plan
                      WHEN 'free'        THEN 1
                      WHEN 'inicial'     THEN 20
                      WHEN 'profesional' THEN 60
                      WHEN 'premium'     THEN 200
                      ELSE property_limit
                    END,
  has_white_label = (plan IN ('profesional', 'premium')),
  has_featured    = (plan = 'premium'),
  has_metrics     = (plan = 'premium');