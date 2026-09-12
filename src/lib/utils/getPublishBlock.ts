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
//
// ══════════════════════════════════════════════════════════════
// ⚠ NO USAR ESTO PARA SABER SI LA AGENCIA SE VE EN EL MAPA.
// ══════════════════════════════════════════════════════════════
//
// Para eso está `getVisibilityBlock`, que es el espejo de OTRA cosa: la función
// `agency_is_publicly_visible()`. Publicar y verse no son la misma pregunta, y
// este helper responde mal la segunda en dos direcciones opuestas:
//
//   · LE SOBRA `plan_limit`. Una agencia con el cupo lleno no puede publicar,
//     pero SÍ se está viendo. Usar esto para el aviso de visibilidad le diría
//     que desapareció del mapa —falso— justo cuando evalúa pagar un plan mayor.
//   · LE FALTA `plan <> 'free'`. La agencia del plan de aterrizaje no dispara
//     NINGÚN motivo acá (está aprobada, su estado no es canceled/past_due y
//     tiene cupo), y sin embargo no se ve. Este helper se quedaría mudo.
//
// Y hay una diferencia más fina en el estado de la suscripción: acá 'pending'
// NO bloquea (ver la lista negra de abajo), pero para la visibilidad sí, porque
// la base exige `status = 'active'`. Ver `getVisibilityBlock`.
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
// 'pending' significa "todavía no tiene nada activo": es una agencia recién
// registrada que eligió un plan y espera la activación manual. Esa agencia
// PUBLICA normalmente —para que pueda ir cargando su cartera mientras espera—,
// aunque todavía no se vea en el mapa. Lista negra explícita, no lista blanca.
//
// ⚠ ACÁ DECÍA QUE 'pending' SIGNIFICABA "pidió un upgrade y espera que se lo
// activen" Y QUE ESA AGENCIA "está al día y publica normalmente". Era falso a
// medias, y ese medio fue la razón por la que un bug real no se vio durante
// semanas: era cierto de PUBLICAR y falso de VERSE. Pedir un upgrade escribía
// 'pending', y `agency_is_publicly_visible()` exige `status = 'active'`, así que
// una agencia al día que quería pagar más se apagaba sola del mapa. Desde el
// arreglo, pedir un upgrade NO toca el estado (ver requestPlanUpgradeAction) y
// 'pending' significa una sola cosa. La lógica de este helper nunca estuvo mal:
// lo que estaba mal era la explicación.
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
