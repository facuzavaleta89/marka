"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  PLANS,
  REJECTION_NOTE_MAX,
  type ApprovalStatus,
  type ReviewDecision,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "@/types";

// Bucket único del proyecto (fotos de propiedades, avatares y logos conviven
// ahí, separados por prefijo de path). Ver CLAUDE.md → "Imágenes y Storage".
const PROPERTY_IMAGES_BUCKET = "property-images";

// Activa un plan pago que quedó en status 'pending'. v1: solo activar (no hay
// desactivar/downgrade). La corre el dueño de la plataforma desde /admin.
//
// SEGURIDAD: la verificación de identidad acá es OBLIGATORIA y es la defensa
// real — la UI no alcanza. Sin ADMIN_USER_ID definida, se deniega (nunca
// "si no hay env, permitir").
export async function activatePlanAction(input: {
  agencyId: string;
  /**
   * Vencimiento OPCIONAL, en formato YYYY-MM-DD (lo que emite un <input
   * type="date">). Sin valor, la columna queda como está: no se inventa una
   * fecha por defecto.
   */
  periodEnd?: string;
}): Promise<{ error: string } | undefined> {
  const agencyId = input?.agencyId;
  if (typeof agencyId !== "string" || agencyId.trim() === "") {
    return { error: "Agencia inválida" };
  }

  const parsedPeriodEnd = parsePeriodEnd(input?.periodEnd);
  if ("error" in parsedPeriodEnd) return { error: parsedPeriodEnd.error };

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
      // Solo se escribe si el dueño cargó una fecha. `undefined` no viaja en el
      // UPDATE de PostgREST, así que sin fecha la columna queda intacta —que es
      // exactamente el comportamiento de antes de esta pieza—. Poner `null`
      // acá borraría un vencimiento ya cargado al reactivar algo.
      ...(parsedPeriodEnd.periodEnd
        ? { current_period_end: parsedPeriodEnd.periodEnd }
        : {}),
    })
    .eq("agency_id", agencyId);

  if (updateError) {
    return { error: "No se pudo activar el plan. Intentá de nuevo." };
  }

  // Revalida el server component, igual que las otras cuatro actions del panel.
  // El router.refresh() del cliente sigue existiendo (limpia el estado de
  // "cargando"), pero la invalidación no depende de que el llamador se acuerde.
  revalidatePath("/admin");
}

// Valida la fecha de vencimiento que carga el dueño al activar un plan.
//
// ES OPCIONAL DE VERDAD: vacía o ausente devuelve `null` y el UPDATE ni toca la
// columna. Para qué sirve cuando SÍ se carga: el dueño les activa el plan a las
// agencias fundadoras con una prueba gratuita hasta fin de año, y en diciembre
// necesita saber a quién llamar. La agencia la ve en su panel como "Plan activo
// hasta el {fecha}".
//
// Se valida en el SERVER aunque el <input type="date"> ya filtre: el navegador
// es sugerencia, la action es la barrera (se la puede invocar sin pasar por el
// render). Dos reglas: que sea una fecha real, y que sea POSTERIOR a hoy —un
// vencimiento en el pasado activaría un plan ya vencido, que no es un estado que
// nadie quiera pedir a propósito.
//
// Formato de entrada: YYYY-MM-DD (lo que emite el input nativo). Se guarda como
// el FIN de ese día en UTC (23:59:59.999Z) y no como su comienzo: "vence el 31
// de diciembre" en boca de una persona significa que el 31 todavía tiene plan.
function parsePeriodEnd(
  value: string | undefined
): { periodEnd: string | null } | { error: string } {
  if (value === undefined || value === null) return { periodEnd: null };
  if (typeof value !== "string") return { error: "Fecha inválida" };

  const trimmed = value.trim();
  if (trimmed === "") return { periodEnd: null };

  // Forma exacta antes de parsear: `new Date()` acepta demasiadas cosas y
  // convierte basura en fechas plausibles.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { error: "La fecha de vencimiento tiene que ser una fecha válida" };
  }

  const endOfDay = new Date(`${trimmed}T23:59:59.999Z`);
  if (Number.isNaN(endOfDay.getTime())) {
    return { error: "La fecha de vencimiento tiene que ser una fecha válida" };
  }

  if (endOfDay.getTime() <= Date.now()) {
    return { error: "La fecha de vencimiento tiene que ser posterior a hoy" };
  }

  return { periodEnd: endOfDay.toISOString() };
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
    const logError = await logDecision(agencyId, decision, note, ownerId);
    if (logError) return logError;
  }

  revalidatePath("/admin");
}

// Registra una decisión del dueño en agency_reviews.
//
// El historial es BEST-EFFORT respecto del estado: si el insert falla, el estado
// ya cambió y NO se revierte, pero se avisa (no se traga el error). Es el
// contrato que ya tenían las acciones de aprobación y lo comparten ahora las de
// suscripción, para que las cinco decisiones queden en la misma línea de tiempo.
//
// ⚠ `decision` tiene que ser uno de los cinco valores del CHECK de la columna
// (ver ReviewDecision). Un valor fuera de esa lista no falla en TypeScript si se
// lo castea: falla en la base, después de haber cambiado el estado.
async function logDecision(
  agencyId: string,
  decision: ReviewDecision,
  note: string | null,
  ownerId: string
): Promise<{ error: string } | undefined> {
  const admin = createAdminClient();

  const { error } = await admin.from("agency_reviews").insert({
    agency_id: agencyId,
    decision,
    note,
    reviewed_by: ownerId,
  });

  if (error) {
    return {
      error:
        "El estado se actualizó, pero no se pudo registrar la decisión en el historial.",
    };
  }
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

// ─── Eje comercial: cancelar pedido, dar de baja, reactivar ───
//
// Las tres siguen el mismo preámbulo de seguridad que las de aprobación
// (env fail-closed → sesión → identidad del dueño), escriben con service role
// —`subscriptions` no tiene policy de UPDATE para usuarios— y registran en el
// historial con su propia decisión.
//
// ⚠ NINGUNA toca `agencies.approval_status`: la legitimidad y el pago son ejes
// independientes. Dar de baja a una agencia no la vuelve ilegítima.
//
// ⚠ BAJAR DE PLAN (downgrade) NO ESTÁ ACÁ Y NO ES UN OLVIDO: falta decidir qué
// pasa con las propiedades que exceden el límite del plan menor, y además el
// CHECK de `pending_plan` solo admite planes pagos, así que el modelo ni siquiera
// puede expresar "pidió bajar". Dar de baja no tiene ese problema porque no
// cambia el límite: por eso entra y el downgrade no.

// Lee la suscripción de una agencia con service role (la policy de SELECT es por
// agencia propia, así que el dueño no la vería con el client normal).
async function readSubscription(agencyId: string): Promise<
  | {
      plan: SubscriptionPlan;
      status: SubscriptionStatus;
      pending_plan: SubscriptionPlan | null;
    }
  | { error: string }
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan, status, pending_plan")
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error || !data) {
    return { error: "No se encontró la suscripción de esa agencia" };
  }

  return {
    plan: data.plan as SubscriptionPlan,
    status: data.status as SubscriptionStatus,
    pending_plan: (data.pending_plan as SubscriptionPlan | null) ?? null,
  };
}

// TAREA 1 — Cancela una solicitud de plan pendiente.
//
// Limpia lo PEDIDO y devuelve la suscripción a 'active', sin tocar el plan que
// RIGE ni los límites/entitlements: como pedir un upgrade nunca los pisó (ver
// requestPlanUpgradeAction), cancelar es literalmente volver al estado anterior
// con dos columnas.
//
// POR QUÉ HACE FALTA: `/register/plan` tiene una guarda de reentrada que solo
// deja pasar a una agencia recién registrada. Una que pidió el plan equivocado
// ya no puede corregirlo sola —rebota a /dashboard/suscripcion, donde los
// botones de upgrade están deshabilitados mientras haya un pedido abierto—, así
// que sin esto queda trabada hasta que el dueño interviene por SQL.
export async function cancelPendingPlanAction(input: {
  agencyId: string;
}): Promise<{ error: string } | undefined> {
  if (!parseAgencyId(input?.agencyId)) {
    return { error: "Agencia inválida" };
  }

  const auth = await requireAppAdmin();
  if ("error" in auth) return { error: auth.error };

  const sub = await readSubscription(input.agencyId);
  if ("error" in sub) return { error: sub.error };

  // Sin pedido no hay nada que cancelar. Se chequea en el server porque el
  // botón de la interfaz no es una barrera.
  if (!sub.pending_plan) {
    return { error: "Esa agencia no tiene un plan pendiente que cancelar" };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("subscriptions")
    .update({ pending_plan: null, status: "active" })
    .eq("agency_id", input.agencyId);

  if (updateError) {
    return { error: "No se pudo cancelar la solicitud. Intentá de nuevo." };
  }

  // La nota deja asentado QUÉ se canceló: después de limpiar la columna, el
  // plan pedido no se puede reconstruir desde ninguna otra parte.
  const logError = await logDecision(
    input.agencyId,
    "plan_canceled",
    `Se canceló la solicitud del plan ${PLANS[sub.pending_plan].name}.`,
    auth.ownerId
  );
  if (logError) return logError;

  revalidatePath("/admin");
}

// TAREA 3 — Da de baja la suscripción de una agencia. REVERSIBLE.
//
// Qué cambia: status → 'canceled' y los tres entitlements a false.
// Qué NO cambia, y es deliberado:
//   - `plan`: se conserva para saber a qué reactivar. Es el único registro de
//     qué tenía contratado.
//   - `property_limit`: se deja como está. Ponerlo en cero haría que la agencia
//     viera "alcanzaste el límite de tu plan" —falso para alguien dado de baja, y
//     la mandaría a pagar un upgrade que no le destraba nada—; el bloqueo real
//     lo da el estado de la suscripción (getPublishBlock + el trigger nuevo).
//     Además deja la reactivación en un solo movimiento.
//   - `activated_at`: es la fecha en que se activó ese plan, un dato histórico.
//     Borrarlo no aporta y pierde información.
//
// El efecto público sale gratis: agency_is_publicly_visible() exige
// status = 'active', así que las propiedades desaparecen del mapa y el sitio de
// marca se apaga sin tocar nada más. La agencia sigue entrando a su panel y ve
// todo lo suyo intacto.
export async function cancelSubscriptionAction(input: {
  agencyId: string;
}): Promise<{ error: string } | undefined> {
  if (!parseAgencyId(input?.agencyId)) {
    return { error: "Agencia inválida" };
  }

  const auth = await requireAppAdmin();
  if ("error" in auth) return { error: auth.error };

  const sub = await readSubscription(input.agencyId);
  if ("error" in sub) return { error: sub.error };

  if (sub.status === "canceled") {
    return { error: "Esa agencia ya está dada de baja" };
  }
  // Dar de baja un plan de aterrizaje no significa nada: 'free' no es un
  // producto contratado, es el estado en el que nace toda agencia.
  if (sub.plan === "free") {
    return { error: "Esa agencia no tiene un plan pago que dar de baja" };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      has_featured: false,
      has_white_label: false,
      has_metrics: false,
    })
    .eq("agency_id", input.agencyId);

  if (updateError) {
    return { error: "No se pudo dar de baja la suscripción. Intentá de nuevo." };
  }

  const logError = await logDecision(
    input.agencyId,
    "subscription_canceled",
    `Baja de la suscripción con plan ${PLANS[sub.plan].name}.`,
    auth.ownerId
  );
  if (logError) return logError;

  revalidatePath("/admin");
}

// TAREA 3 (vuelta) — Reactiva una suscripción dada de baja.
//
// DE DÓNDE SALEN LOS ENTITLEMENTS: del catálogo `PLANS[plan]`, no de las
// columnas `has_*` (que la baja puso en false, así que no sirven como memoria) y
// no del nombre del plan escrito a mano. Es la MISMA fuente que usa
// activatePlanAction, así que una agencia reactivada queda idéntica a una recién
// activada con ese plan: si mañana el catálogo cambia qué incluye 'profesional',
// las dos rutas cambian juntas y no hay que acordarse de sincronizarlas.
export async function restoreSubscriptionAction(input: {
  agencyId: string;
}): Promise<{ error: string } | undefined> {
  if (!parseAgencyId(input?.agencyId)) {
    return { error: "Agencia inválida" };
  }

  const auth = await requireAppAdmin();
  if ("error" in auth) return { error: auth.error };

  const sub = await readSubscription(input.agencyId);
  if ("error" in sub) return { error: sub.error };

  if (sub.status !== "canceled") {
    return { error: "Esa agencia no está dada de baja" };
  }

  const planInfo = PLANS[sub.plan];
  if (!planInfo) {
    return { error: "El plan guardado de esa agencia no es válido" };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      has_featured: planInfo.featured,
      has_white_label: planInfo.whiteLabel,
      has_metrics: planInfo.metrics,
    })
    .eq("agency_id", input.agencyId);

  if (updateError) {
    return { error: "No se pudo reactivar la suscripción. Intentá de nuevo." };
  }

  const logError = await logDecision(
    input.agencyId,
    "subscription_restored",
    `Reactivación de la suscripción con plan ${planInfo.name}.`,
    auth.ownerId
  );
  if (logError) return logError;

  revalidatePath("/admin");
}

// ─── TAREA 4 — Eliminar una agencia. IRREVERSIBLE ─────────────
//
// ⚠ SOLO agencias SIN propiedades y SIN consultas. La regla la aplica ESTE
// código y nada más: las CINCO claves foráneas que apuntan a `agencies`
// (agents, subscriptions, leads, properties, agency_reviews) son ON DELETE
// CASCADE, ninguna RESTRICT. Si este chequeo falla o se saltea, el DELETE se
// lleva puesto todo en silencio, sin que la base proteste. Por eso los conteos
// se leen del SERVIDOR con service role y nunca se confía en lo que manda el
// cliente: la interfaz solo decide si mostrar el botón.
//
// ⚠ NO SE REGISTRA EN agency_reviews, y es deliberado: la FK
// `agency_reviews_agency_id_fkey` es ON DELETE CASCADE, así que la fila "eliminé
// la agencia X" se borraría junto con la agencia X. Un historial de
// eliminaciones no puede vivir en una tabla que cascadea con lo eliminado.
// Registrarlo requeriría otra tabla, sin FK, que hoy no existe.
export async function deleteAgencyAction(input: {
  agencyId: string;
  /** El dueño tiene que tipear el nombre exacto: la acción es irreversible. */
  confirmationName: string;
}): Promise<{ error: string } | undefined> {
  if (!parseAgencyId(input?.agencyId)) {
    return { error: "Agencia inválida" };
  }

  const auth = await requireAppAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();

  // 1) La agencia tiene que existir, y necesitamos su nombre para contrastar la
  //    confirmación tipeada contra el valor REAL, no contra lo que diga el
  //    cliente sobre sí mismo.
  const { data: agency, error: agencyError } = await admin
    .from("agencies")
    .select("id, name")
    .eq("id", input.agencyId)
    .maybeSingle();

  if (agencyError || !agency) {
    return { error: "No se encontró esa agencia" };
  }

  if (
    typeof input?.confirmationName !== "string" ||
    !nameMatches(input.confirmationName, agency.name)
  ) {
    return {
      error: "El nombre que escribiste no coincide con el de la agencia",
    };
  }

  // 2) LA REGLA. Dos conteos con head:true (no traen filas). Si cualquiera de
  //    los dos falla se aborta: ante la duda no se borra, porque un count que
  //    no se pudo leer NO es un cero.
  const [{ count: propertyCount, error: propError }, { count: leadCount, error: leadError }] =
    await Promise.all([
      admin
        .from("properties")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", input.agencyId),
      admin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", input.agencyId),
    ]);

  if (propError || leadError) {
    return {
      error:
        "No se pudo verificar si la agencia tiene datos cargados. No se eliminó nada.",
    };
  }

  if ((propertyCount ?? 0) > 0 || (leadCount ?? 0) > 0) {
    return {
      error:
        "Esa agencia tiene propiedades o consultas cargadas: no se puede eliminar.",
    };
  }

  // 3) Los agentes, ANTES de borrar nada. Sus ids son la única forma de llegar
  //    a sus usuarios de Auth y a sus avatares: si la fila de la agencia
  //    desapareciera primero, `agents` se iría en cascada y quedarían huérfanos
  //    imposibles de encontrar desde ninguna pantalla.
  const { data: agents, error: agentsError } = await admin
    .from("agents")
    .select("id")
    .eq("agency_id", input.agencyId);

  if (agentsError) {
    return {
      error:
        "No se pudieron leer los agentes de la agencia. No se eliminó nada.",
    };
  }

  const agentIds = (agents ?? []).map((a) => a.id as string);

  // ─── ORDEN DE BORRADO: de lo más periférico a la raíz ───────
  // El criterio es que cada paso destruya solo cosas que ya nadie referencia, y
  // que la fila de la agencia vaya ÚLTIMA porque es la llave que permite
  // encontrar todo lo demás. Si algo falla a mitad de camino, lo que queda
  // sigue siendo visible y reintentable desde el panel.

  // 3a) Archivos del Storage. Van primero porque son lo único que NO se puede
  //     volver a localizar una vez borradas las filas (sus paths se arman con
  //     agency_id y agent_id). Solo se eliminan agencias vacías, así que no
  //     puede haber fotos de propiedades: quedan el logo y los avatares.
  //     Es best-effort a propósito: un archivo que no se borra es basura inerte
  //     en un bucket, y abortar la eliminación por eso dejaría a la agencia
  //     viva por un motivo que no le importa a nadie.
  const storageError = await removeAgencyFiles(input.agencyId, agentIds);

  // 3b) Usuarios de Auth. La FK va de `agents` HACIA `auth.users`, no al revés:
  //     borrar la agencia NO los borra, así que hay que hacerlo explícito o
  //     quedan usuarios con sesión válida y sin ninguna cuenta detrás. Cada
  //     deleteUser cascadea y se lleva su fila de `agents`.
  //     Mismo precedente que deleteAgentAction (equipo/actions.ts).
  const failedUsers: string[] = [];
  for (const agentId of agentIds) {
    const { error } = await admin.auth.admin.deleteUser(agentId);
    if (error) failedUsers.push(agentId);
  }

  if (failedUsers.length > 0) {
    // Se corta ANTES de borrar la agencia: si siguiéramos, esos usuarios
    // quedarían huérfanos para siempre y sin ninguna pantalla desde donde
    // encontrarlos. Con la agencia todavía en pie, el dueño reintenta.
    return {
      error: `No se pudieron eliminar ${failedUsers.length} de ${agentIds.length} cuentas de agente. La agencia NO se eliminó: reintentá.`,
    };
  }

  // 3c) La fila de la agencia. Cascadea a subscriptions y agency_reviews (y a
  //     agents, que a esta altura ya no existen).
  const { error: deleteError } = await admin
    .from("agencies")
    .delete()
    .eq("id", input.agencyId);

  if (deleteError) {
    return {
      error:
        "Se eliminaron las cuentas de los agentes, pero no se pudo eliminar la agencia. Reintentá.",
    };
  }

  revalidatePath("/admin");

  // La agencia ya no existe: el aviso de archivos es informativo, no un fallo.
  if (storageError) {
    return {
      error: `La agencia se eliminó, pero quedaron archivos sin borrar en el almacenamiento (${storageError}).`,
    };
  }
}

// ¿El nombre tipeado confirma esta agencia?
//
// Ignora mayúsculas y espacios de los bordes A PROPÓSITO: escribir el nombre es
// una barrera contra el click distraído, no un examen de ortografía. Exigir la
// capitalización exacta además chocaba con el cartel, que muestra el nombre en
// mayúsculas (el Label del preset lleva `uppercase`), así que escribir lo que la
// pantalla indicaba no funcionaba.
//
// Lo que NO se relaja: los espacios internos y los acentos. El nombre tiene que
// ser el de la agencia, no algo parecido.
//
// ⚠ El cliente hace la misma comparación para habilitar el botón, pero la de acá
// es la única que cuenta: compara contra el nombre REAL leído de la base, no
// contra el que el cliente dice tener.
function nameMatches(typed: string, actual: string): boolean {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("es-AR");
  return normalize(typed) === normalize(actual) && actual.trim() !== "";
}

// Borra el logo de la agencia y los avatares de sus agentes.
//
// Los paths son los documentados en CLAUDE.md: `logos/{agency_id}/logo.{ext}` y
// `avatars/{agent_id}/avatar.{ext}`. Como la extensión depende del MIME del
// archivo que se subió, no se puede reconstruir el nombre: hay que LISTAR cada
// carpeta y borrar lo que haya. Devuelve un motivo si algo quedó sin borrar, o
// null si salió todo bien.
async function removeAgencyFiles(
  agencyId: string,
  agentIds: string[]
): Promise<string | null> {
  const admin = createAdminClient();
  const folders = [
    `logos/${agencyId}`,
    ...agentIds.map((id) => `avatars/${id}`),
  ];

  const paths: string[] = [];
  for (const folder of folders) {
    const { data, error } = await admin.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .list(folder);
    // Una carpeta que no se puede listar (o que no existe) no es un error: la
    // mayoría de las agencias no tiene logo ni avatares.
    if (error || !data) continue;
    for (const file of data) paths.push(`${folder}/${file.name}`);
  }

  if (paths.length === 0) return null;

  const { error } = await admin.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .remove(paths);

  return error ? `${paths.length} archivo(s)` : null;
}
