import type { ApprovalStatus, PlanUsage } from "@/types";

// ¿Las propiedades de esta agencia se están VIENDO en el mapa público? Y si no,
// ¿por qué?
//
// ══════════════════════════════════════════════════════════════
// ⚠ NO CONFUNDIR CON `getPublishBlock`. SON DOS PREGUNTAS DISTINTAS.
// ══════════════════════════════════════════════════════════════
//
//   getPublishBlock   → "¿puede CARGAR una propiedad nueva?"
//                       Espejo de los TRES TRIGGERS de `properties`.
//   getVisibilityBlock → "¿lo que ya cargó SE VE en el mapa?"
//                       Espejo de la FUNCIÓN `agency_is_publicly_visible()`.
//
// Parecen lo mismo y no lo son. Usar aquel para esto falla en DOS DIRECCIONES
// OPUESTAS, y las dos se pagan caro:
//
//   · LE SOBRA UN MOTIVO. Una agencia con el cupo del plan lleno NO puede
//     publicar, pero SÍ se está viendo en el mapa. Avisarle que no se ve sería
//     mentirle justo a quien está por decidir si paga un plan mayor.
//   · LE FALTA UNA CONDICIÓN. La agencia en el plan de aterrizaje (`free`) no
//     produce ningún bloqueo de publicación —el botón está habilitado y la
//     propiedad se guarda sin error— y sin embargo NO SE VE. Aquel helper se
//     quedaría mudo en el caso más frecuente de todos.
//
// Por eso son dos archivos y no uno. La distinción está escrita también en el
// encabezado de `getPublishBlock`.

// Los tres motivos, en el orden en que la base los evalúa.
export type VisibilityBlockReason =
  | "not_approved" // la inmobiliaria todavía no está aprobada (o fue rechazada)
  | "not_current" // la suscripción está dada de baja o vencida
  | "plan_not_active"; // no hay un plan pago activo todavía

export type VisibilityBlock = {
  reason: VisibilityBlockReason;
};

// Espejo de `public.agency_is_publicly_visible(uuid)`, cuyo cuerpo es:
//
//   SELECT EXISTS (
//     SELECT 1 FROM agencies a JOIN subscriptions s ON s.agency_id = a.id
//     WHERE a.id = target_agency_id
//       AND a.approval_status = 'approved'   -- condición 1
//       AND s.status = 'active'              -- condición 2
//       AND s.plan <> 'free'                 -- condición 3
//   );
//
// Las tres condiciones se evalúan acá EN ESE MISMO ORDEN, y ese orden no es
// estético: es el mismo que ya usan `getPublishBlock` y los tres triggers de
// `properties` (que Postgres dispara alfabéticamente: agency_approved →
// agency_subscription → property_limit). Si el panel ordenara distinto, el
// cartel de la pantalla y el error al guardar contarían historias diferentes
// sobre la misma agencia.
//
// ⚠ NO NECESITA NINGUNA CONSULTA. Los tres datos ya están resueltos en la
// pantalla: `approvalStatus` viene de `requireAgentSession()` y `status`/`plan`
// vienen de `getPlanUsage()`, que la pantalla principal ya pide.
export function getVisibilityBlock(
  planUsage: PlanUsage,
  approvalStatus: ApprovalStatus
): VisibilityBlock | null {
  // ── Condición 1: a.approval_status = 'approved' ──────────────
  // Va primero porque si la inmobiliaria no está aprobada, el estado de su
  // suscripción es irrelevante: no se la va a mostrar igual.
  if (approvalStatus !== "approved") {
    return { reason: "not_approved" };
  }

  // ── Condición 2: s.status = 'active' ─────────────────────────
  // ⚠ ES LISTA BLANCA, NO LISTA NEGRA, Y ACÁ ESTÁ LA DIFERENCIA MÁS SUTIL CON
  // `getPublishBlock`. Aquel bloquea por `canceled`/`past_due` y deja publicar
  // a una agencia en `pending`, porque 'pending' significa "pidió un plan y
  // espera que se lo activen": está al día. Pero la función de la base exige
  // `= 'active'` a secas, así que esa MISMA agencia en `pending` NO SE VE en el
  // mapa. Publicar y verse no son lo mismo, y este es el caso donde se separan.
  //
  // Por eso el motivo se reparte según el estado: decirle "estás dada de baja"
  // a alguien que acaba de pedir un plan sería falso y alarmante.
  if (planUsage.status !== "active") {
    return planUsage.status === "pending"
      ? { reason: "plan_not_active" }
      : { reason: "not_current" };
  }

  // ── Condición 3: s.plan <> 'free' ────────────────────────────
  // El plan de aterrizaje. No bloquea nada —se puede cargar y guardar sin un
  // solo error— pero no se ve. Es el estado de TODA alta nueva hasta que el
  // dueño de la plataforma activa el plan a mano.
  if (planUsage.plan === "free") {
    return { reason: "plan_not_active" };
  }

  return null;
}
