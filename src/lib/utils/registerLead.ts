import { createClient } from "@/lib/supabase/client";

// ─── Registro de una consulta (lead) ──────────────────────────
//
// Vivía suelto dentro de `handleSendWA`, en PropertyModal. Se extrajo cuando
// apareció una SEGUNDA pantalla que contacta por WhatsApp (la página pública de
// la propiedad): copiar el insert habría sido copiar también, o perder, las
// cuatro decisiones que lleva encima. La más frágil de las cuatro es una
// OMISIÓN — ver el punto 2 —, y las omisiones no se copian: se olvidan.
//
// ══════════════════════════════════════════════════════════════
// LAS CUATRO DECISIONES. Una vive acá; las otras tres son CONTRATO DEL LLAMADOR
// y por eso están escritas acá, donde se leen antes de usar la función.
// ══════════════════════════════════════════════════════════════
//
// 1. EL ERROR SE CAPTURA, PERO NO BLOQUEA EL CONTACTO.
//    Esta función NUNCA lanza: devuelve `false` y ya. El llamador tiene que
//    abrir el enlace de WhatsApp DESPUÉS y FUERA DE TODA RAMA DE ERROR.
//    La operación principal es el CONTACTO, no el registro: el lead es para la
//    agencia, no para el visitante, y no puede ser la razón por la que alguien
//    no llegue a escribirle a una inmobiliaria.
//    (Antes esto era un `await` pelado sin `const { error } =`: un rechazo de la
//    policy, una caída de red o una agencia que dejó de ser públicamente visible
//    entre el render y el click producían EXACTAMENTE la misma pantalla que el
//    éxito. Se abría WhatsApp y la agencia nunca se enteraba de la consulta.)
//
// 2. ⚠ NO SE MANDA `agent_name`. LO ESCRIBE LA BASE.
//    Lo completa el trigger `trg_set_lead_agent_name` copiándolo de
//    `agents.full_name`. Que no esté en el objeto de abajo NO es un descuido:
//    es la barrera. El camino que crea consultas es PÚBLICO Y ANÓNIMO (anon
//    key, sin sesión), `leads` no tiene NI UN SOLO CHECK, y la policy
//    `Public insert lead` no puede validar una columna de texto. Si el nombre
//    viajara en este payload, cualquier visitante podría escribir lo que
//    quisiera en la columna "Agente" del panel de una agencia, donde se lee
//    como un dato del sistema.
//    ⚠ NO AGREGAR ESE CAMPO ACÁ, POR NINGÚN MOTIVO.
//
// 3. ANTE UN ERROR, EL FORMULARIO DEL LLAMADOR NO SE CIERRA.
//    El nombre escrito y el estado abierto se conservan: si se reseteara, el
//    aviso quedaría flotando al lado de un botón en estado inicial, sin
//    contexto de a qué se refiere.
//
// 4. EL AVISO NO SE MUESTRA COMO UN ERROR GRAVE.
//    Va en `graphite` y con `role="status"`, nunca en rojo ni con
//    `role="alert"`. Quien lo lee es un VISITANTE al que no le falta nada: ya
//    tiene el chat abierto y su consulta va a llegar igual por WhatsApp. Un
//    texto rojo le comunicaría un problema que no es suyo y lo empujaría a no
//    escribir.
//
// Es un client component helper a propósito (usa el browser client): las dos
// pantallas que contactan son islas de cliente, y el insert público con anon key
// es justamente el camino que la policy `Public insert lead` contempla.

export interface RegisterLeadInput {
  propertyId: string;
  /** El agente a cuyo nombre queda la consulta. Sale de la propiedad, no del visitante. */
  agentId: string;
  agencyId: string;
  /** Lo único que escribe el visitante. Se recorta acá para no repetirlo en cada llamador. */
  contactName: string;
}

/**
 * Registra la consulta. NUNCA lanza.
 *
 * @returns `true` si quedó registrada; `false` si no. Un `false` NO habilita a
 * abortar el contacto — ver la decisión 1 de arriba.
 */
export async function registerLead({
  propertyId,
  agentId,
  agencyId,
  contactName,
}: RegisterLeadInput): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase.from("leads").insert({
    property_id: propertyId,
    agent_id: agentId,
    agency_id: agencyId,
    contact_name: contactName.trim(),
    source: "whatsapp",
    // ⚠ `agent_name` NO va acá. Lo escribe el trigger. Ver la decisión 2.
  });

  return !error;
}

// Texto del aviso cuando el registro falla. Vive acá, al lado de la función,
// para que las dos pantallas digan lo mismo. DESIGN §10: dice qué pasó y qué
// hacer, sin retar a nadie y sin dramatizar.
export const LEAD_ERROR_MESSAGE =
  "Se abrió WhatsApp, pero no pudimos avisarle a la inmobiliaria de tu consulta. Escribile igual por el chat: te va a responder.";
