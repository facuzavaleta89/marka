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
  const { error } = await admin
    .from("subscriptions")
    .update({
      pending_plan: plan,
      status: "pending",
    })
    .eq("agency_id", agent.agency_id);

  if (error) {
    return { error: "No se pudo registrar el pedido. Intentá de nuevo." };
  }

  // Sin redirect: el client refresca la vista (router.refresh()).
}
