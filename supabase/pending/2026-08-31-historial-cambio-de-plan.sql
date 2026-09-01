-- ============================================================
-- PENDIENTE DE APLICAR A MANO — Marka
-- Nuevo valor 'plan_changed' en el historial de decisiones
-- ============================================================
--
-- ⚠ ESTE ARCHIVO TODAVÍA NO ESTÁ APLICADO. Correrlo entero en el SQL Editor de
-- Supabase. Cuando esté aplicado, trasladar el CHECK resultante a
-- supabase/migrations/20240101000000_initial_schema.sql (que documenta el estado
-- REAL de la base) y borrar este archivo.
--
-- ─── QUÉ HABILITA ──────────────────────────────────────────────────────────
-- La acción nueva del panel "Cambiar de plan" (changePlanAction) registra su
-- decisión en agency_reviews, igual que las cinco que ya existen. El CHECK
-- actual, medido, admite exactamente cinco valores y NINGUNO sirve:
--
--   CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text,
--           'plan_canceled'::text, 'subscription_canceled'::text,
--           'subscription_restored'::text])))
--
--   - 'approved' / 'rejected'        → veredictos del eje de LEGITIMIDAD, otra cosa.
--   - 'plan_canceled'                → se descartó una SOLICITUD de la agencia.
--   - 'subscription_canceled'        → baja de la suscripción entera.
--   - 'subscription_restored'        → vuelta de esa baja.
--
-- Cambiar el plan vigente de una agencia que sigue siendo cliente no es ninguno
-- de esos. Se agrega 'plan_changed', con el mismo criterio de nombre que los
-- otros tres del eje comercial: <objeto>_<qué le pasó>, en inglés.
--
-- ⚠ SIN ESTE CAMBIO, changePlanAction escribe el plan nuevo y DESPUÉS falla al
-- registrar el historial: el estado queda cambiado (correcto) pero el dueño ve
-- el aviso "no se pudo registrar la decisión en el historial". Es el contrato
-- best-effort que ya tienen las demás actions, así que no rompe nada, pero deja
-- el historial incompleto hasta que esto se corra.
-- ============================================================

-- Se reemplaza el CHECK entero (Postgres no permite "agregar un valor" a uno
-- existente). Solo se SUMA un valor, así que la revalidación de las filas que ya
-- están no puede fallar.
ALTER TABLE public.agency_reviews
  DROP CONSTRAINT IF EXISTS agency_reviews_decision_check;

ALTER TABLE public.agency_reviews
  ADD CONSTRAINT agency_reviews_decision_check
  CHECK (
    decision = ANY (ARRAY[
      'approved'::text,
      'rejected'::text,
      'plan_canceled'::text,
      'subscription_canceled'::text,
      'subscription_restored'::text,
      'plan_changed'::text
    ])
  );

-- ─── Verificación (opcional, después de correr lo de arriba) ────────────────
-- Tiene que listar los SEIS valores.
--
-- SELECT pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.agency_reviews'::regclass
--   AND conname = 'agency_reviews_decision_check';
