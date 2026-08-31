"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { generateSlug } from "@/lib/utils/generateSlug";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
import { resolveAgentSession } from "@/lib/utils/resolveAgentSession";
import type { PropertyInsert } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionResult = { error: string } | undefined;

// Mensaje cuando la propiedad se guardó pero el insert de imágenes falló
// (no hacemos rollback: la propiedad ya existe y el agente puede reintentar).
const PARTIAL_IMAGES_MSG =
  "La propiedad se guardó pero algunas imágenes no se guardaron. Podés agregarlas desde Editar.";

// ─── Tipos para alta y edición ────────────────────────────────

type ImageInput = {
  id: string;
  url: string;
  sort_order: number;
  is_cover: boolean;
};

// Campos de propiedad que provee el formulario; el server deriva el resto
// (agent_id, agency_id, city_id, status, city, province, country).
type PropertyFormPayload = Omit<
  PropertyInsert,
  "agent_id" | "agency_id" | "city_id" | "status" | "city" | "province" | "country"
>;

export type CreatePropertyInput = PropertyFormPayload & {
  id: string; // UUID pre-generado en el cliente
  images: ImageInput[];
  // Agente al que asignar la propiedad (lo manda el form del admin). El server
  // SOLO lo aplica si el caller es admin y el destino pertenece a su agencia.
  assigned_agent_id?: string | null;
};

export type UpdatePropertyInput = PropertyFormPayload & {
  status: PropertyInsert["status"];
  images: ImageInput[];
  // Reasignación de agente. Mismas reglas server-side que en el alta.
  assigned_agent_id?: string | null;
};

// Valida una reasignación de agente pedida desde el form. Devuelve el agent_id
// destino SOLO si: (a) el caller es admin, y (b) el agente destino pertenece a
// la agencia indicada (la del caller, leída del server). Si no, null → el
// llamador usa su fallback (no cambiar agent_id / usar user.id).
//
// SEGURIDAD (lo sensible del Paso 2): el agent_id destino NUNCA se acepta del
// cliente sin este chequeo de pertenencia. `agencyId` viene del server (la
// agencia del caller / de la propiedad), nunca de props. Un agente normal cae
// en el primer return (role !== 'admin') → no puede reasignar nada. Un admin no
// puede asignar a un agente de otra agencia → el .eq("agency_id", agencyId)
// hace que el destino no matchee y devuelve null. No se valida la existencia
// del agente "a secas": se valida existencia DENTRO de la agencia.
async function resolveAssignedAgent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callerRole: string | undefined,
  agencyId: string,
  assignedAgentId: string | null | undefined
): Promise<string | null> {
  if (!assignedAgentId) return null;
  if (callerRole !== "admin") return null;

  const { data: target } = await supabase
    .from("agents")
    .select("id")
    .eq("id", assignedAgentId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  return target ? assignedAgentId : null;
}

// Autoriza al user a operar sobre una propiedad y dice CÓMO está autorizado:
//   - "owner": es el agente dueño → opera con el client normal (la RLS
//     "Agent manages own properties" lo permite, igual que siempre).
//   - "admin": no es dueño, pero es admin de la agencia de esa propiedad →
//     opera con service role (la RLS agent_id = auth.uid() bloquearía al admin
//     sobre algo ajeno; el admin client salta RLS, y la única barrera es esta
//     validación de "admin de la MISMA agencia", hecha 100% server-side).
//   - null (ok:false): no autorizado.
//
// SEGURIDAD: el role y el agency_id del que llama se leen SIEMPRE de la fila
// agents por auth.uid(), nunca de props del cliente. La comparación de agencia
// es la única defensa cuando se usa service role.
//
// Devuelve también `db`: el client con el que cada action debe ESCRIBIR
// (normal para owner, admin para admin). Las lecturas auxiliares (getPlanUsage,
// agency_id) pueden seguir con el client normal: un admin es miembro de su
// agencia y la RLS de lectura por agencia ya lo cubre.
async function authorizePropertyAccess(id: string): Promise<{
  ok: boolean;
  error?: string;
  mode?: "owner" | "admin";
  supabase: Awaited<ReturnType<typeof createClient>>;
  db: SupabaseClient;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No autenticado", supabase, db: supabase };

  // Lee la propiedad SIN filtrar por agent_id: necesitamos saber de quién es y
  // de qué agencia para decidir la autorización.
  const { data: property } = await supabase
    .from("properties")
    .select("agent_id, agency_id")
    .eq("id", id)
    .maybeSingle();

  if (!property) {
    return { ok: false, error: "Propiedad no encontrada", supabase, db: supabase };
  }

  // Dueño: flujo de siempre, client normal.
  if (property.agent_id === user.id) {
    return { ok: true, mode: "owner", supabase, db: supabase };
  }

  // No es dueño: ¿es admin de la agencia de la propiedad?
  const session = await resolveAgentSession();
  const agent = session.status === "ok" ? session.agent : null;

  if (
    agent &&
    agent.role === "admin" &&
    agent.agency_id === property.agency_id
  ) {
    // Admin de la misma agencia → escribe con service role.
    return { ok: true, mode: "admin", supabase, db: createAdminClient() };
  }

  // Ajeno y no es admin de esa agencia: mismo mensaje que "no existe", para no
  // revelar que la propiedad existe pero es de otro.
  return { ok: false, error: "Propiedad no encontrada", supabase, db: supabase };
}

export async function pausePropertyAction(id: string): Promise<ActionResult> {
  const { ok, error, db } = await authorizePropertyAccess(id);
  if (!ok) return { error: error! };

  const { error: dbError } = await db
    .from("properties")
    .update({ status: "paused" })
    .eq("id", id);

  if (dbError) return { error: "No se pudo pausar la propiedad" };
  revalidatePath("/dashboard/propiedades");
}

export async function activatePropertyAction(id: string): Promise<ActionResult> {
  const { ok, error, db } = await authorizePropertyAccess(id);
  if (!ok) return { error: error! };

  const { error: dbError } = await db
    .from("properties")
    .update({ status: "active" })
    .eq("id", id);

  if (dbError) {
    return {
      error: translatePropertyWriteError(
        dbError,
        "No se pudo activar la propiedad",
        "Alcanzaste el límite de propiedades de tu plan."
      ),
    };
  }

  revalidatePath("/dashboard/propiedades");
}

export async function markAsSoldAction(id: string): Promise<ActionResult> {
  const { ok, error, db } = await authorizePropertyAccess(id);
  if (!ok) return { error: error! };

  const { error: dbError } = await db
    .from("properties")
    .update({ status: "sold" })
    .eq("id", id);

  if (dbError) return { error: "No se pudo marcar la propiedad como vendida" };
  revalidatePath("/dashboard/propiedades");
}

export async function markAsRentedAction(id: string): Promise<ActionResult> {
  const { ok, error, db } = await authorizePropertyAccess(id);
  if (!ok) return { error: error! };

  const { error: dbError } = await db
    .from("properties")
    .update({ status: "rented" })
    .eq("id", id);

  if (dbError) return { error: "No se pudo marcar la propiedad como alquilada" };
  revalidatePath("/dashboard/propiedades");
}

export async function deletePropertyAction(id: string): Promise<ActionResult> {
  const { ok, error, db } = await authorizePropertyAccess(id);
  if (!ok) return { error: error! };

  // ON DELETE CASCADE en la DB elimina property_images y leads asociados.
  // Las imágenes del Supabase Storage no se eliminan automáticamente.
  const { error: dbError } = await db
    .from("properties")
    .delete()
    .eq("id", id);

  if (dbError) return { error: "No se pudo eliminar la propiedad" };
  revalidatePath("/dashboard/propiedades");
}

// Traduce el error de la base a un mensaje propio. Sobre `properties` hay DOS
// triggers BEFORE INSERT que rechazan el alta y AMBOS usan el mismo SQLSTATE
// (23514, check_violation), así que el código NO alcanza para distinguirlos: hay
// que mirar el mensaje.
//   - trg_check_agency_approved → "La agencia no está aprobada para publicar…"
//   - trg_check_property_limit  → "Límite de propiedades alcanzado…"
// Se chequea primero el de aprobación porque es el que dispara primero (Postgres
// corre los triggers en orden alfabético de nombre) y porque decirle "alcanzaste
// el límite de tu plan" a alguien que todavía no fue aprobado es falso: no llegó
// a ningún límite y lo mandaría a pagar un plan que no le va a destrabar nada.
// `fallback` es el mensaje para cualquier otro error de base.
type DbLikeError = { code?: string; message: string };

function translatePropertyWriteError(
  dbError: DbLikeError,
  fallback: string,
  limitMessage: string
): string {
  if (dbError.message.includes("no está aprobada")) {
    return "Tu inmobiliaria todavía no está aprobada, así que no podés publicar propiedades.";
  }
  if (dbError.code === "23514" || dbError.message.includes("Límite")) {
    return limitMessage;
  }
  return fallback;
}

// Normaliza el origen de la coordenada antes de escribirlo. La columna tiene un
// CHECK ('manual' | 'suggested'), así que cualquier cosa que no sea exactamente
// 'suggested' se guarda como 'manual': es el valor honesto por defecto (una
// coordenada que no salió del buscador la puso una persona) y garantiza que el
// CHECK no pueda hacer fallar un alta por un dato que NO gatea nada.
//
// ⚠ Este campo es solo para medir después la calidad de las ubicaciones
// sugeridas contra las arrastradas. No debe condicionar ninguna decisión.
function normalizeLocationSource(
  value: PropertyInsert["location_source"]
): "manual" | "suggested" {
  return value === "suggested" ? "suggested" : "manual";
}

// ─── Alta de propiedad ────────────────────────────────────────

export async function createPropertyAction(
  data: CreatePropertyInput
): Promise<ActionResult> {
  const supabase = await createClient();

  // Datos del agente (para agency_id y para saber si puede reasignar). Action:
  // devuelve error, no redirige. Se conservan los dos mensajes de antes —
  // "No autenticado" si no hay sesión, "Agente no encontrado" si la cuenta no
  // resuelve su agencia.
  const session = await resolveAgentSession();
  if (session.status === "no_session") return { error: "No autenticado" };
  if (session.status === "unlinked") return { error: "Agente no encontrado" };
  const { userId: callerId, agent } = session;

  const { data: agency } = await supabase
    .from("agencies")
    .select("city_id")
    .eq("id", agent.agency_id)
    .single();
  if (!agency) return { error: "Agencia no encontrada" };

  const { data: city } = await supabase
    .from("cities")
    .select("name, province")
    .eq("id", agency.city_id)
    .single();
  if (!city) return { error: "Ciudad no encontrada" };

  const slug = generateSlug(data.title);

  // Destacar es un entitlement de la suscripción (has_featured): si la agencia
  // no lo tiene, se ignora el valor que mandó el form.
  const planUsage = await getPlanUsage(supabase, agent.agency_id);
  const isFeatured = data.is_featured && planUsage.hasFeatured;

  // Reasignación al crear (solo admin): si pidió asignar a otro agente de su
  // agencia y validó, la propiedad nace con ese agent_id. Si no, queda a nombre
  // del creador (user.id), como siempre.
  const resolvedAgentId = await resolveAssignedAgent(
    supabase,
    agent.role,
    agent.agency_id,
    data.assigned_agent_id
  );
  const propertyAgentId = resolvedAgentId ?? callerId;

  // Si la propiedad nace a nombre de OTRO agente, el insert tiene que ir con
  // service role: la RLS de properties (WITH CHECK implícito agent_id = auth.uid())
  // rechazaría un agent_id distinto al del creador. Lo mismo para sus imágenes.
  const usesServiceRole = propertyAgentId !== callerId;
  const db = usesServiceRole ? createAdminClient() : supabase;

  const { error: insertError } = await db.from("properties").insert({
    id: data.id,
    agent_id: propertyAgentId,
    agency_id: agent.agency_id,
    city_id: agency.city_id,
    title: data.title,
    slug,
    description: data.description ?? null,
    status: "active",
    property_type: data.property_type,
    operation_type: data.operation_type,
    price: data.price,
    currency: data.currency,
    price_negotiable: data.price_negotiable,
    area_total_m2: data.area_total_m2 ?? null,
    area_covered_m2: data.area_covered_m2 ?? null,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    parking_spots: data.parking_spots,
    floor_number: data.floor_number ?? null,
    address: data.address,
    neighborhood: data.neighborhood ?? null,
    city: city.name,
    province: city.province,
    country: "Argentina",
    lat: data.lat,
    lng: data.lng,
    location_source: normalizeLocationSource(data.location_source),
    amenities: data.amenities,
    year_built: data.year_built ?? null,
    is_featured: isFeatured,
  });

  if (insertError) {
    return {
      error: translatePropertyWriteError(
        insertError,
        "No se pudo crear la propiedad",
        "Alcanzaste el límite de propiedades de tu plan."
      ),
    };
  }

  // Insertar imágenes (si las hay). Mismo client que el insert de la propiedad:
  // si nació a nombre de otro agente, la RLS de property_images también exige el
  // agent_id dueño, así que va con service role.
  if (data.images.length > 0) {
    const { error: imagesError } = await db.from("property_images").insert(
      data.images.map((img) => ({
        id: img.id,
        property_id: data.id,
        url: img.url,
        is_cover: img.is_cover,
        sort_order: img.sort_order,
      }))
    );
    if (imagesError) {
      // La propiedad ya se creó; informamos la falla parcial de imágenes.
      revalidatePath("/dashboard/propiedades");
      return { error: PARTIAL_IMAGES_MSG };
    }
  }

  revalidatePath("/dashboard/propiedades");
}

// ─── Edición de propiedad ─────────────────────────────────────

export async function updatePropertyAction(
  id: string,
  data: UpdatePropertyInput
): Promise<ActionResult> {
  const { ok, error, supabase, db, mode } = await authorizePropertyAccess(id);
  if (!ok) return { error: error! };

  // Destacar es un entitlement de la suscripción (has_featured): si la agencia
  // no lo tiene, se ignora el valor que mandó el form. La lectura va con el
  // client normal: un admin es miembro de su agencia y la RLS de lectura por
  // agencia ya le permite leer esta propiedad y su suscripción.
  const { data: prop } = await supabase
    .from("properties")
    .select("agency_id")
    .eq("id", id)
    .single();
  const planUsage = prop ? await getPlanUsage(supabase, prop.agency_id) : null;
  const isFeatured = data.is_featured && (planUsage?.hasFeatured ?? false);

  // Reasignación de agente (solo admin). Validamos contra la agencia de la
  // PROPIEDAD (prop.agency_id), que authorizePropertyAccess ya confirmó que es
  // la del caller. role y user salen del server.
  const session = await resolveAgentSession();
  const caller = session.status === "ok" ? session.agent : null;
  const resolvedAgentId = prop
    ? await resolveAssignedAgent(
        supabase,
        caller?.role,
        prop.agency_id,
        data.assigned_agent_id
      )
    : null;

  // Cliente de escritura: si se reasigna a OTRO agente (distinto del que llama)
  // estando en mode "owner" (un admin editando SU propia propiedad), el client
  // normal rechazaría el nuevo agent_id por la RLS (WITH CHECK agent_id =
  // auth.uid()). En ese caso forzamos service role. En mode "admin", `db` ya es
  // service role.
  const reassigning =
    resolvedAgentId !== null &&
    resolvedAgentId !== (session.status === "ok" ? session.userId : null);
  const writeDb = mode === "owner" && reassigning ? createAdminClient() : db;

  const { error: updateError } = await writeDb
    .from("properties")
    .update({
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      property_type: data.property_type,
      operation_type: data.operation_type,
      price: data.price,
      currency: data.currency,
      price_negotiable: data.price_negotiable,
      area_total_m2: data.area_total_m2 ?? null,
      area_covered_m2: data.area_covered_m2 ?? null,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      parking_spots: data.parking_spots,
      floor_number: data.floor_number ?? null,
      address: data.address,
      neighborhood: data.neighborhood ?? null,
      lat: data.lat,
      lng: data.lng,
      location_source: normalizeLocationSource(data.location_source),
      amenities: data.amenities,
      year_built: data.year_built ?? null,
      is_featured: isFeatured,
      // agent_id SOLO se incluye si hubo una reasignación válida (admin +
      // destino de la agencia). Si no, no se toca (queda el agente actual).
      ...(resolvedAgentId !== null ? { agent_id: resolvedAgentId } : {}),
      // El slug no se recalcula al editar
    })
    .eq("id", id);

  if (updateError) {
    return {
      error: translatePropertyWriteError(
        updateError,
        "No se pudieron guardar los cambios",
        "Alcanzaste el límite de propiedades de tu plan. No podés volver a activar esta propiedad."
      ),
    };
  }

  // Reemplazar imágenes: delete + re-insert con el nuevo orden.
  // Si el delete falla, NO insertamos (evita duplicar) y avisamos sin perder las existentes.
  // Con `writeDb`: la RLS de property_images también está atada al agent_id dueño,
  // así que un admin editando algo ajeno (o que acaba de reasignar la propiedad a
  // otro agente) necesita service role acá igual que en el update de la propiedad.
  const { error: deleteError } = await writeDb
    .from("property_images")
    .delete()
    .eq("property_id", id);
  if (deleteError) {
    return { error: "No se pudieron actualizar las imágenes. Volvé a intentar." };
  }

  if (data.images.length > 0) {
    const { error: imagesError } = await writeDb.from("property_images").insert(
      data.images.map((img) => ({
        id: img.id,
        property_id: id,
        url: img.url,
        is_cover: img.is_cover,
        sort_order: img.sort_order,
      }))
    );
    if (imagesError) {
      revalidatePath("/dashboard/propiedades");
      return { error: PARTIAL_IMAGES_MSG };
    }
  }

  revalidatePath("/dashboard/propiedades");
}
