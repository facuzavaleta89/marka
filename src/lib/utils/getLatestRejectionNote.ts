import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAgentSession } from "@/lib/utils/resolveAgentSession";

// Trae el motivo del ÚLTIMO rechazo de una agencia (la nota que escribió el
// dueño de la plataforma al rechazarla), para mostrárselo a esa agencia y que
// sepa qué corregir.
//
// POR QUÉ SERVICE ROLE: `agency_reviews` tiene RLS habilitada y CERO policies,
// así que el client normal no lee nada de ahí. Es a propósito: la nota es un
// texto que el dueño escribe sobre un tercero y no puede quedar expuesta (la
// tabla existe justamente porque `agencies` es de lectura pública). El precio de
// omitir la RLS es que la barrera de pertenencia la tiene que poner este código.
//
// LA BARRERA: el `agencyId` NO se acepta del llamador. Se lee de la sesión
// (fila `agents` por auth.uid()) y recién si coincide con el pedido se consulta.
// Así es imposible pedir la nota de otra agencia, incluso llamando al helper a
// mano con un id ajeno.
export async function getLatestRejectionNote(
  agencyId: string
): Promise<string | null> {
  const session = await resolveAgentSession();
  if (session.status !== "ok") return null;
  if (session.agent.agency_id !== agencyId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("agency_reviews")
    .select("note")
    .eq("agency_id", agencyId)
    .eq("decision", "rejected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // La nota es obligatoria al rechazar (lo exige la action del panel), pero la
  // columna es nullable: un null acá significa "sin motivo registrado".
  return data?.note ?? null;
}

// ══════════════════════════════════════════════════════════════
// EL MOTIVO DE UN CAMBIO DE NOMBRE RECHAZADO
// ══════════════════════════════════════════════════════════════
//
// Cuando el dueño rechaza SOLO el nombre (rejectNameChangeAction), la agencia
// queda APROBADA y funcionando: se le revierte el nombre y listo. Eso deja el
// motivo sin ningún lugar donde leerse — `AgencyApprovalNotice`, que es donde se
// muestra el motivo de un rechazo, devuelve `null` para una agencia aprobada.
// Sin esto, la inmobiliaria vería su nombre viejo de vuelta y no sabría por qué.

/**
 * Prefijo fijo de la nota de un rechazo de nombre.
 *
 * ⚠ EXISTE PORQUE LA COLUMNA NO PUEDE DISTINGUIRLOS. Medido:
 * `agency_reviews_decision_check` admite seis valores —approved, rejected,
 * plan_canceled, subscription_canceled, subscription_restored, plan_changed— y
 * ninguno es específico de un rechazo de nombre, así que éste se registra como
 * `'rejected'` como cualquier otro. El prefijo es lo único que los separa.
 *
 * No es "parsear texto libre": lo escribe `rejectNameChangeAction` con esta
 * misma constante y lo lee la función de abajo. Es determinista mientras las dos
 * usen esta constante y nadie escriba la nota a mano.
 */
export const NAME_REJECTION_PREFIX = "Cambio de nombre rechazado";

/** Separador entre el contexto (los dos nombres) y el motivo del dueño. */
const NOTE_REASON_SEPARATOR = "Motivo: ";

/**
 * Motivo del rechazo del último cambio de nombre, SI ESE RECHAZO SIGUE VIGENTE.
 *
 * ⚠ LA VIGENCIA SE DECIDE MIRANDO LA ÚLTIMA DECISIÓN, no buscando el último
 * rechazo de nombre. Si la agencia pidió un nombre, se lo rechazaron, pidió otro
 * y ese se lo aprobaron, la nota vieja sigue en el historial —es un historial,
 * no se pisa— y mostrarla sería contarle un rechazo que ya superó. Por eso se
 * trae la última decisión del eje de aprobación y recién ahí se pregunta si es
 * un rechazo de nombre: si después hubo cualquier otra cosa, no se muestra nada.
 *
 * Misma barrera de pertenencia que `getLatestRejectionNote`: el `agencyId` se
 * compara contra el de la sesión antes de consultar.
 */
export async function getLatestNameRejectionNote(
  agencyId: string
): Promise<string | null> {
  const session = await resolveAgentSession();
  if (session.status !== "ok") return null;
  if (session.agent.agency_id !== agencyId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("agency_reviews")
    .select("decision, note")
    .eq("agency_id", agencyId)
    .in("decision", ["approved", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || data.decision !== "rejected") return null;

  const note = data.note ?? "";
  if (!note.startsWith(NAME_REJECTION_PREFIX)) return null;

  // Se devuelve solo lo que escribió el dueño. El contexto de los dos nombres
  // que lleva el prefijo es para el historial: a la agencia no le sirve leer
  // "se restauró «X»" cuando ya tiene ese nombre a la vista en el formulario.
  //
  // Ante cualquier forma inesperada se devuelve la nota entera en vez de null:
  // un motivo con formato raro es infinitamente mejor que ningún motivo. Mismo
  // criterio que `extractLicenseFromDetail` en el panel.
  const separatorAt = note.indexOf(NOTE_REASON_SEPARATOR);
  if (separatorAt === -1) return note;

  const reason = note.slice(separatorAt + NOTE_REASON_SEPARATOR.length).trim();
  return reason.length > 0 ? reason : note;
}
