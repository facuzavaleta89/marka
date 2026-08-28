"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  PLANS,
  REJECTION_NOTE_MAX,
  type ApprovalStatus,
  type SubscriptionPlan,
} from "@/types";

// Activa un plan pago que quedó en status 'pending'. v1: solo activar (no hay
// desactivar/downgrade). La corre el dueño de la plataforma desde /admin.
//
// SEGURIDAD: la verificación de identidad acá es OBLIGATORIA y es la defensa
// real — la UI no alcanza. Sin ADMIN_USER_ID definida, se deniega (nunca
// "si no hay env, permitir").
export async function activatePlanAction(
  agencyId: string
): Promise<{ error: string } | undefined> {
  if (typeof agencyId !== "string" || agencyId.trim() === "") {
    return { error: "Agencia inválida" };
  }

  const adminUserId = process.env.ADMIN_USER_ID;
  // Fail-closed: si la env no está, nadie es admin.
  if (!adminUserId) {
    return { error: "Acción no autorizada" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.id !== adminUserId) {
    return { error: "Acción no autorizada" };
  }

  // Lee el plan PEDIDO (pending_plan), que es lo que hay que activar.
  // Con admin client: la policy de SELECT de subscriptions es por agencia propia,
  // así que el dueño necesita service role para leer otra agencia.
  const admin = createAdminClient();
  const { data: sub, error: readError } = await admin
    .from("subscriptions")
    .select("pending_plan")
    .eq("agency_id", agencyId)
    .single();

  if (readError || !sub) {
    return { error: "No se encontró la suscripción de esa agencia" };
  }

  const pendingPlan = sub.pending_plan as SubscriptionPlan | null;

  // Sin pending_plan no hay nada que activar.
  if (!pendingPlan) {
    return { error: "Esa agencia no tiene un plan pendiente que activar" };
  }

  const planInfo = PLANS[pendingPlan];
  if (!planInfo || pendingPlan === "free") {
    return { error: "Plan pendiente inválido" };
  }

  // Activación: el plan pedido pasa a REGIR (plan = pending_plan) y recibe sus
  // límites/entitlements reales. Se limpia pending_plan y status vuelve a 'active'.
  // activated_at sella la fecha de esta activación. current_period_end NO se toca (V2).
  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      plan: pendingPlan,
      pending_plan: null,
      status: "active",
      property_limit: planInfo.propertyLimit,
      has_featured: planInfo.featured,
      has_white_label: planInfo.whiteLabel,
      has_metrics: planInfo.metrics,
      activated_at: new Date().toISOString(),
    })
    .eq("agency_id", agencyId);

  if (updateError) {
    return { error: "No se pudo activar el plan. Intentá de nuevo." };
  }

  // Sin redirect: el client refresca la lista (router.refresh()).
}

// ─── Aprobación de agencias ───────────────────────────────────
//
// El estado de aprobación (agencies.approval_status) es un EJE INDEPENDIENTE de
// la suscripción: responde "¿es una inmobiliaria legítima?", no "¿paga?".
// Ninguna de estas actions toca subscriptions, y activatePlanAction no toca
// approval_status.
//
// SEGURIDAD: las tres repiten el mismo preámbulo que activatePlanAction
// (forma del input → env fail-closed → sesión → identidad del dueño) porque una
// server action se puede invocar sin pasar por el render: el gating del layout
// NO alcanza.
//
// ESCRITURA: `agencies` no tiene policy de UPDATE (verificado: su única policy
// es `Public read agencies`, de SELECT), así que toda escritura va con service
// role acotada por id. `agency_reviews` tiene RLS habilitada y CERO policies:
// solo es accesible con service role desde el server — ahí vive la nota, que no
// puede ir en `agencies` porque esa tabla es de lectura pública.

// Preámbulo común de autorización. Devuelve el id del dueño (para reviewed_by) o
// un error listo para devolverle al cliente.
async function requireAppAdmin(): Promise<
  { ownerId: string } | { error: string }
> {
  const adminUserId = process.env.ADMIN_USER_ID;
  // Fail-closed: si la env no está, nadie es admin.
  if (!adminUserId) {
    return { error: "Acción no autorizada" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.id !== adminUserId) {
    return { error: "Acción no autorizada" };
  }
  return { ownerId: user.id };
}

// Escribe el estado de aprobación y, si corresponde, registra la review.
// `decision` en null = no es un veredicto (volver a pendiente) y no deja fila.
async function writeApproval(
  agencyId: string,
  status: ApprovalStatus,
  decision: "approved" | "rejected" | null,
  note: string | null,
  ownerId: string
): Promise<{ error: string } | undefined> {
  const admin = createAdminClient();

  // La agencia tiene que existir: si no, el UPDATE afectaría 0 filas en
  // silencio y le diríamos al dueño que salió bien.
  const { data: agency, error: readError } = await admin
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .maybeSingle();

  if (readError || !agency) {
    return { error: "No se encontró esa agencia" };
  }

  const { error: updateError } = await admin
    .from("agencies")
    .update({ approval_status: status })
    .eq("id", agencyId);

  if (updateError) {
    return { error: "No se pudo actualizar la agencia. Intentá de nuevo." };
  }

  if (decision) {
    // El historial es best-effort respecto del estado: si el insert fallara, el
    // estado ya cambió y no se revierte, pero se avisa (no se traga el error).
    const { error: reviewError } = await admin.from("agency_reviews").insert({
      agency_id: agencyId,
      decision,
      note,
      reviewed_by: ownerId,
    });

    if (reviewError) {
      return {
        error:
          "El estado se actualizó, pero no se pudo registrar la decisión en el historial.",
      };
    }
  }

  revalidatePath("/admin");
}

// Normaliza y valida la nota. `required` distingue rechazo (obligatoria) de
// aprobación (opcional). Devuelve string | null, o un error.
function parseNote(
  note: string | undefined,
  required: boolean
): { note: string | null } | { error: string } {
  if (note !== undefined && typeof note !== "string") {
    return { error: "Motivo inválido" };
  }
  const trimmed = (note ?? "").trim();
  if (trimmed === "") {
    if (required) {
      return { error: "Escribí el motivo del rechazo" };
    }
    return { note: null };
  }
  if (trimmed.length > REJECTION_NOTE_MAX) {
    return { error: `El motivo no puede superar los ${REJECTION_NOTE_MAX} caracteres` };
  }
  return { note: trimmed };
}

// Valida el id de agencia que llega del cliente (misma forma que activatePlanAction).
function parseAgencyId(agencyId: unknown): boolean {
  return typeof agencyId === "string" && agencyId.trim() !== "";
}

// Aprueba una agencia. La nota es OPCIONAL (el dueño puede dejar constancia de
// por qué la aprobó, pero no se le exige). No toca la suscripción.
export async function approveAgencyAction(input: {
  agencyId: string;
  note?: string;
}): Promise<{ error: string } | undefined> {
  if (!parseAgencyId(input?.agencyId)) {
    return { error: "Agencia inválida" };
  }

  const auth = await requireAppAdmin();
  if ("error" in auth) return { error: auth.error };

  const parsed = parseNote(input.note, false);
  if ("error" in parsed) return { error: parsed.error };

  return writeApproval(
    input.agencyId,
    "approved",
    "approved",
    parsed.note,
    auth.ownerId
  );
}

// Rechaza una agencia. La nota es OBLIGATORIA: un rechazo sin motivo no le sirve
// a nadie (ni al dueño dentro de seis meses, ni para responderle a la agencia).
// Si falta, no se escribe NADA.
export async function rejectAgencyAction(input: {
  agencyId: string;
  note: string;
}): Promise<{ error: string } | undefined> {
  if (!parseAgencyId(input?.agencyId)) {
    return { error: "Agencia inválida" };
  }

  const auth = await requireAppAdmin();
  if ("error" in auth) return { error: auth.error };

  const parsed = parseNote(input.note, true);
  if ("error" in parsed) return { error: parsed.error };

  return writeApproval(
    input.agencyId,
    "rejected",
    "rejected",
    parsed.note,
    auth.ownerId
  );
}

// Devuelve una agencia rechazada a 'pending'. NO registra fila en
// agency_reviews: no es un veredicto (y el CHECK de decision solo admite
// 'approved'/'rejected'). El rechazo previo queda en el historial.
export async function reopenAgencyAction(input: {
  agencyId: string;
}): Promise<{ error: string } | undefined> {
  if (!parseAgencyId(input?.agencyId)) {
    return { error: "Agencia inválida" };
  }

  const auth = await requireAppAdmin();
  if ("error" in auth) return { error: auth.error };

  return writeApproval(input.agencyId, "pending", null, null, auth.ownerId);
}
