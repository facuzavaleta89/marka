-- ============================================================
-- PENDIENTE DE APLICAR A MANO — Marka
-- Bloqueo de publicación cuando la suscripción está dada de baja o vencida
-- ============================================================
--
-- ⚠ ESTE ARCHIVO TODAVÍA NO ESTÁ APLICADO. Correrlo entero en el SQL Editor de
-- Supabase. Cuando esté aplicado, trasladar su contenido a
-- supabase/migrations/20240101000000_initial_schema.sql (que documenta el estado
-- REAL de la base) y borrar este archivo. Mientras tanto vive acá y no ahí, para
-- que el schema documentado no afirme algo que la base todavía no tiene.
--
-- ─── QUÉ CIERRA ────────────────────────────────────────────────────────────
-- Hasta ahora, sobre `properties` había DOS gates de publicación:
--   trg_check_agency_approved  → la agencia tiene que estar aprobada
--   trg_check_property_limit   → tiene que quedar cupo en el plan
-- Ninguno mira el ESTADO de la suscripción, así que una agencia dada de baja
-- podía seguir cargando propiedades: quedaban ocultas al público (eso ya lo
-- resuelve agency_is_publicly_visible) pero entraban a la base igual. Sin esto,
-- "dar de baja" queda a medias.
--
-- ─── POR QUÉ UN TRIGGER Y NO UNA POLICY ────────────────────────────────────
-- Mismo motivo que los otros dos: createPropertyAction usa SERVICE ROLE cuando
-- un admin publica a nombre de otro agente, y el service role saltea las
-- policies. El trigger corre siempre, sin importar el rol.
--
-- ─── ⚠ POR QUÉ LISTA NEGRA Y NO "distinto de active" ───────────────────────
-- El dominio de subscriptions.status tiene CUATRO valores, y 'pending' significa
-- "la agencia pidió un upgrade y espera que el dueño se lo active". Esa agencia
-- está al día y hoy publica normalmente: bloquear por "<> 'active'" le cortaría
-- el alta justo por haber querido pagar más. Sería una regresión, no un arreglo.
-- Se bloquea SOLO por 'canceled' y 'past_due'.
--
-- ─── ⚠ POR QUÉ ESTE NOMBRE DE TRIGGER ──────────────────────────────────────
-- Postgres dispara los triggers en ORDEN ALFABÉTICO de nombre, y ese orden es el
-- que decide qué mensaje ve el agente cuando falla más de una condición. El
-- nombre `trg_check_agency_subscription` ordena así:
--     trg_check_agency_approved  <  trg_check_agency_subscription  <  trg_check_property_limit
-- que es exactamente la prioridad que queremos (aprobación → suscripción →
-- cupo) y la misma que aplica getPublishBlock en la interfaz. Renombrarlo
-- cambiaría el mensaje que se muestra: no es un nombre cosmético.
--
-- ─── ⚠ SI SE EDITA EL TEXTO DEL MENSAJE ────────────────────────────────────
-- Los tres triggers comparten SQLSTATE (23514, check_violation), así que el
-- código los distingue POR EL TEXTO: ver translatePropertyWriteError en
-- src/app/(agent)/dashboard/propiedades/actions.ts, que matchea la palabra
-- "suscripción". Si se cambia el mensaje de acá, hay que tocar ese helper.
-- ============================================================

-- Sin fila de suscripción NO se bloquea acá a propósito: ese caso ya lo cubre
-- check_property_limit(), que trata "sin fila" como límite 0. Duplicarlo solo
-- cambiaría el mensaje de error por uno menos preciso.
CREATE OR REPLACE FUNCTION public.check_agency_subscription()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

-- Solo BEFORE INSERT, igual que el de aprobación: editar una propiedad ya
-- cargada sigue permitido aunque la agencia se dé de baja después. No se le
-- quitan a nadie las propiedades que ya publicó, ni la posibilidad de
-- corregirlas mientras negocia su reactivación.
DROP TRIGGER IF EXISTS trg_check_agency_subscription ON public.properties;

CREATE TRIGGER trg_check_agency_subscription
  BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.check_agency_subscription();

-- ─── Verificación (opcional, después de correr lo de arriba) ────────────────
-- Debe listar los TRES triggers en este orden alfabético:
--   trg_check_agency_approved / trg_check_agency_subscription / trg_check_property_limit
--
-- SELECT tgname FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- WHERE c.relname = 'properties' AND NOT t.tgisinternal
-- ORDER BY tgname;
