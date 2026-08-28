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
