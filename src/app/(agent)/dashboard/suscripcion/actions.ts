"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { PLAN_ORDER, type SubscriptionPlan } from "@/types";
import { resolveAgentSession } from "@/lib/utils/resolveAgentSession";

// Pide un upgrade de plan desde el dashboard. Deja la suscripción de la agencia
// con pending_plan = <pedido> y status = 'pending'. NO toca `plan` (el que rige)
// ni property_limit/has_*/activated_at: el cliente sigue operando con lo que
// tiene hasta que el admin active. (Antes pisaba `plan`, ese era el bug.)
//
// Mismo patrón de seguridad que register/plan/actions.ts: el agency_id se deriva
// del auth.uid() server-side, nunca del cliente, y el UPDATE se acota a esa
// agencia con admin client (no hay policy de UPDATE de subscriptions para users).
export async function requestPlanUpgradeAction(
  plan: SubscriptionPlan
): Promise<{ error: string } | undefined> {
  // Validación: plan conocido y pago. No tiene sentido "pedir" free desde acá.
  if (!PLAN_ORDER.includes(plan) || plan === "free") {
    return { error: "Plan inválido" };
  }

  // Mismos destinos que antes ante sesión inválida; la única diferencia es que
  // "hay sesión pero la cuenta no resuelve su agencia" ahora cierra la sesión
  // en vez de rebotar contra el proxy (bucle).
  const session = await resolveAgentSession();
  if (session.status === "no_session") redirect("/login");
  if (session.status === "unlinked") redirect("/logout?reason=no_agency");
  const { agent } = session;

  const admin = createAdminClient();

  // ⚠ UNA SUSCRIPCIÓN DADA DE BAJA (o vencida) NO PUEDE PEDIR UN UPGRADE.
  // Esta action escribe status = 'pending' sin mirar el estado previo, así que
  // sin este corte una agencia en 'canceled' se sacaba la baja sola: pasaba a
  // 'pending', que NO está en la lista de estados que bloquean la publicación
  // (getPublishBlock), y volvía a poder publicar sin que el dueño hiciera nada.
  // La pantalla ya no ofrece los botones de upgrade en ese estado, pero la
  // interfaz no es una barrera: una server action se invoca sin pasar por el
  // render. Lo que esa agencia necesita es que le REACTIVEN lo que ya tenía,
  // no pedir un plan mayor.
  const { data: current } = await admin
    .from("subscriptions")
    .select("status")
    .eq("agency_id", agent.agency_id)
    .maybeSingle();

  if (current?.status === "canceled" || current?.status === "past_due") {
    return {
      error:
        "Tu suscripción no está activa. Escribinos para reactivarla antes de cambiar de plan.",
    };
  }

  // Solo pending_plan + status. `plan` (el que rige), property_limit, has_* y
  // activated_at quedan como están.
  //
  // ⚠ `count: "exact"` NO ES TELEMETRÍA: es la única forma de distinguir "se
  // guardó" de "no había nada que guardar". Un UPDATE acotado con .eq() sobre
  // una fila que no existe afecta CERO filas y devuelve `error: null`, así que
  // mirar solo el error informaba éxito y el pedido no existía: la agencia veía
  // la confirmación, volvía a la pantalla y el plan seguía igual, sin ningún
  // rastro de qué había pasado.
  //
  // Se cuenta en el UPDATE y no se lee la fila antes a propósito: el chequeo
  // previo (el de la baja, arriba) y la escritura son dos viajes distintos, y
  // preguntar "¿existe?" antes deja una ventana entre la pregunta y la
  // respuesta. El count mide lo que la escritura hizo de verdad.
  const { error, count } = await admin
    .from("subscriptions")
    .update(
      {
        pending_plan: plan,
        status: "pending",
      },
      { count: "exact" }
    )
    .eq("agency_id", agent.agency_id);

  if (error) {
    return { error: "No se pudo registrar el pedido. Intentá de nuevo." };
  }

  // Cero filas afectadas = la agencia no tiene fila de suscripción. Desde el
  // trigger `trg_ensure_agency_subscription` ese estado no se produce por
  // ningún camino de alta, así que llegar acá significa que la fila se borró a
  // mano: no es algo que la agencia pueda resolver cambiando de plan, y por eso
  // el mensaje NO habla de planes.
  if (count === 0) {
    return {
      error:
        "Hay un problema con la configuración de tu cuenta. Escribinos a hola@marka.app y lo resolvemos.",
    };
  }

  // Sin redirect: el client refresca la vista (router.refresh()).
}
