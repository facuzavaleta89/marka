import type { ApprovalStatus, PlanUsage } from "@/types";

// ¿Puede esta agencia publicar una propiedad ahora mismo? Y si no, ¿por qué?
//
// La base es la fuente de verdad: sobre `properties` hay TRES triggers BEFORE
// INSERT que rechazan el alta —`trg_check_agency_approved` (agencia no
// aprobada), `trg_check_agency_subscription` (suscripción dada de baja o
// vencida) y `trg_check_property_limit` (cupo del plan)—. Este helper es el
// espejo de esos triggers en la interfaz: sirve para ANTICIPAR el rechazo y
// explicarlo antes de que la persona llene un formulario entero, nunca para
// reemplazarlo.
//
// Existe para que los cuatro puntos de entrada al alta (el botón, los dos
// estados vacíos y la ruta del formulario) apliquen exactamente el mismo
// criterio, en vez de que cada uno arme el suyo.
export type PublishBlockReason =
  | "not_approved"
  | "subscription_inactive"
  | "plan_limit";

export type PublishBlock = {
  reason: PublishBlockReason;
  /** Mensaje corto y autosuficiente, para donde no hay lugar a más. */
  message: string;
};

// ⚠ EL BLOQUEO POR SUSCRIPCIÓN ES POR 'canceled'/'past_due', NUNCA POR
// "distinta de 'active'". El dominio de la columna tiene CUATRO valores y
// 'pending' significa "pidió un upgrade y espera que se lo activen": esa agencia
// está al día y publica normalmente. Bloquear por "≠ active" le cortaría el alta
// justo por haber querido pagar más. Lista negra explícita, no lista blanca.
const BLOCKING_SUBSCRIPTION_STATUSES = ["canceled", "past_due"] as const;

// El orden importa: si la agencia no está aprobada, ese es el motivo que se
// muestra aunque además tenga la suscripción de baja y el cupo lleno. Es el
// mismo orden en que fallarían los triggers (Postgres los dispara
// alfabéticamente: agency_approved → agency_subscription → property_limit), así
// que la interfaz y la base cuentan la misma historia.
export function getPublishBlock(
  planUsage: PlanUsage,
  approvalStatus: ApprovalStatus
): PublishBlock | null {
  if (approvalStatus !== "approved") {
    return {
      reason: "not_approved",
      message:
        approvalStatus === "pending"
          ? "Vas a poder publicar cuando aprobemos tu inmobiliaria."
          : "Tu solicitud no fue aprobada. Corregí tus datos para volver a enviarla.",
    };
  }

  // Motivo propio, nunca el del límite de plan: decirle "alcanzaste el límite"
  // a alguien dado de baja es falso y lo manda a pagar un upgrade que no le
  // destraba nada. Lo que necesita es reactivar lo que ya tenía.
  if (
    (BLOCKING_SUBSCRIPTION_STATUSES as readonly string[]).includes(
      planUsage.status
    )
  ) {
    return {
      reason: "subscription_inactive",
      message:
        planUsage.status === "canceled"
          ? "Tu suscripción está dada de baja. Escribinos para reactivarla."
          : "Tu suscripción está vencida. Escribinos para regularizarla.",
    };
  }

  if (!planUsage.canCreate) {
    return {
      reason: "plan_limit",
      message: "Alcanzaste el límite de propiedades de tu plan.",
    };
  }

  return null;
}
