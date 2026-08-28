import type { ApprovalStatus, PlanUsage } from "@/types";

// ¿Puede esta agencia publicar una propiedad ahora mismo? Y si no, ¿por qué?
//
// La base es la fuente de verdad: sobre `properties` hay DOS triggers BEFORE
// INSERT que rechazan el alta —`trg_check_agency_approved` (agencia no aprobada)
// y `trg_check_property_limit` (cupo del plan)—. Este helper es el espejo de
// esos dos triggers en la interfaz: sirve para ANTICIPAR el rechazo y explicarlo
// antes de que la persona llene un formulario entero, nunca para reemplazarlo.
//
// Existe para que los cuatro puntos de entrada al alta (el botón, los dos
// estados vacíos y la ruta del formulario) apliquen exactamente el mismo
// criterio, en vez de que cada uno arme el suyo.
export type PublishBlockReason = "not_approved" | "plan_limit";

export type PublishBlock = {
  reason: PublishBlockReason;
  /** Mensaje corto y autosuficiente, para donde no hay lugar a más. */
  message: string;
};

// El orden importa: si la agencia no está aprobada, ese es el motivo que se
// muestra aunque además tenga el cupo lleno. Es el mismo orden en que fallarían
// los triggers (Postgres los dispara alfabéticamente y
// trg_check_agency_approved va primero), así que la interfaz y la base cuentan
// la misma historia.
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

  if (!planUsage.canCreate) {
    return {
      reason: "plan_limit",
      message: "Alcanzaste el límite de propiedades de tu plan.",
    };
  }

  return null;
}
