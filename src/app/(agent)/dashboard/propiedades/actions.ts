"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { generateSlug } from "@/lib/utils/generateSlug";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
import { resolveAgentSession } from "@/lib/utils/resolveAgentSession";
import {
  PROPERTY_IMAGES_BUCKET,
  extractStoragePath,
} from "@/lib/utils/storagePath";
import { RENT_REQUIREMENT_LABELS } from "@/lib/utils/labels";
import {
  RENT_REQUIREMENTS_OTHER_MAX,
  RENT_REQUIREMENT_OTHER_MAX_LEN,
} from "@/types";
import type { PropertyInsert, RentRequirement } from "@/types";
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

// Borra del bucket los archivos de una propiedad. Devuelve un motivo si algo
// quedó sin borrar, o null si salió todo bien: mismo contrato que
// removeAgencyFiles (admin/actions.ts), que es el precedente del proyecto.
//
// ⚠ SERVICE ROLE SIEMPRE, sin importar si el que borra es el dueño o el admin.
// No es simetría con el resto de la action: es el único client que alcanza los
// archivos. La primera carpeta del path es el agente que SUBIÓ el archivo, y
// las tres ramas de las policies de storage.objects comparan contra una fila
// (`agents` para propiedades, `agencies` para logos, auth.uid() para avatares).
// Si ese agente fue borrado después, no hay contra qué comparar, ninguna rama
// matchea y el borrado rebota para TODO usuario autenticado. En la base hay
// archivos exactamente en esa condición hoy.
async function removePropertyFiles(
  images: { url: string }[]
): Promise<string | null> {
  // Una URL que no contiene el marcador del bucket no se puede convertir en
  // path: se cuenta como "no se pudo borrar" en vez de mandarse a remove(),
  // donde sería un path inexistente que no borra nada y tampoco da error.
  const paths: string[] = [];
  let failed = 0;

  for (const image of images) {
    const path = extractStoragePath(image.url);
    if (path === null) {
      failed += 1;
      continue;
    }
    paths.push(path);
  }

  if (paths.length > 0) {
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .remove(paths);
    if (error) failed += paths.length;
  }

  return failed > 0 ? `${failed} archivo(s)` : null;
}

export async function deletePropertyAction(id: string): Promise<ActionResult> {
  const { ok, error, db } = await authorizePropertyAccess(id);
  if (!ok) return { error: error! };

  // ⚠ EL ORDEN DE LOS TRES PASOS TIENE DOS MOTIVOS DISTINTOS, Y CONVIENE LEER
  // LOS DOS ANTES DE REACOMODAR NADA:
  //   1. leer las URLs   ← antes del DELETE, o se pierden
  //   2. borrar la fila
  //   3. borrar los archivos  ← después del DELETE, o se rompe la propiedad
  //
  // MOTIVO 1 — POR QUÉ LAS URLs SE LEEN ANTES DEL DELETE.
  // property_images_property_id_fkey es ON DELETE CASCADE (medido contra la
  // base), así que el DELETE de la propiedad se lleva las filas con las URLs en
  // el MISMO instante: después no hay de dónde sacar los paths. Es el mismo
  // razonamiento que ya está escrito en removeAgencyFiles (admin/actions.ts),
  // donde los archivos se localizan primero porque "son lo único que NO se
  // puede volver a localizar una vez borradas las filas".
  //
  // MOTIVO 2 — POR QUÉ LOS ARCHIVOS SE BORRAN DESPUÉS DE LA FILA, Y NO PEGADOS
  // A LA LECTURA DE ARRIBA. Acá está la tentación: agrupar los pasos 1 y 3 se
  // ve más prolijo —"leo las URLs y borro los archivos de una"— y ES UN ERROR.
  // El motivo 1 se satisface con SOLO leerlas: una vez leídas viven en memoria
  // y el CASCADE ya no las alcanza, así que agrupar no compra nada y paga un
  // riesgo. La asimetría, que no es pareja ni por asomo:
  //   · si los archivos se borran y el DELETE de la fila falla después, queda
  //     una propiedad VIVA y PUBLICADA con sus imágenes destruidas: filas de
  //     property_images apuntando a archivos que ya no existen, o sea una
  //     propiedad rota en el mapa público, a la vista de cualquier visitante.
  //   · si la fila se borra y el borrado de archivos falla después, quedan
  //     archivos que ya no sirve nadie: basura inerte en un bucket, invisible
  //     para todo el mundo, y que además se avisa (ver el cierre de abajo).
  // Un archivo de más no lo ve nadie; una propiedad rota la ven todos. Por eso
  // el DELETE va en el medio: el paso irreversible sobre el bucket ocurre
  // recién cuando ya no queda nada que romper.
  //
  // Se lee con `db`, NO con el client normal: la RLS de property_images está
  // atada al agent_id dueño ("Agent manages own property images"), así que un
  // admin borrando la propiedad de otro agente de su agencia leería CERO filas
  // con el client normal — y el borrado de archivos no fallaría, simplemente no
  // borraría nada, en silencio. En mode "admin", `db` ya es service role.
  const { data: images, error: imagesError } = await db
    .from("property_images")
    .select("url")
    .eq("property_id", id);

  // ON DELETE CASCADE en la DB elimina property_images y leads asociados.
  const { error: dbError } = await db
    .from("properties")
    .delete()
    .eq("id", id);

  // Si la fila no se pudo borrar, NO se toca un solo archivo y se sale con el
  // error de siempre. Es exactamente el beneficio de este orden: la propiedad
  // queda intacta, con sus imágenes, y el agente puede reintentar.
  if (dbError) return { error: "No se pudo eliminar la propiedad" };
  revalidatePath("/dashboard/propiedades");

  // La propiedad ya no existe: a partir de acá nada puede romperse, solo
  // sobrar. Si las URLs no se pudieron leer, los archivos quedan y se avisa
  // igual (no hay forma de localizarlos: la lectura era la única oportunidad).
  const storageError = imagesError
    ? "no se pudieron leer las imágenes"
    : await removePropertyFiles(images ?? []);

  // BEST-EFFORT, PERO NO SILENCIOSO. Un archivo que queda es basura inerte en
  // un bucket; dejar viva una propiedad que el agente pidió borrar es peor, así
  // que el borrado de archivos nunca aborta el de la fila. Pero el error no se
  // traga: la propiedad ya no existe, con lo cual esto es un aviso y no un
  // fallo. Misma forma que el cierre de deleteAgencyAction.
  if (storageError) {
    return {
      error: `La propiedad se eliminó, pero quedaron archivos sin borrar en el almacenamiento (${storageError}).`,
    };
  }
}

// Traduce el error de la base a un mensaje propio. Sobre `properties` hay DOS
// triggers BEFORE INSERT que rechazan el alta y TODOS usan el mismo SQLSTATE
// (23514, check_violation), así que el código NO alcanza para distinguirlos: hay
// que mirar el mensaje.
//   - trg_check_agency_approved     → "La agencia no está aprobada para publicar…"
//   - trg_check_agency_subscription → "La suscripción de la agencia no está activa…"
//   - trg_check_property_limit      → "Límite de propiedades alcanzado…"
// El orden de los chequeos ES el orden en que disparan los triggers (Postgres
// los corre alfabéticamente por nombre) y también el orden de prioridad de
// getPublishBlock: aprobación → suscripción → cupo. Decirle "alcanzaste el
// límite de tu plan" a alguien que no fue aprobado, o a alguien dado de baja, es
// falso en los dos casos y lo manda a pagar un plan que no le destraba nada.
//
// ⚠ El último chequeo es un CAJÓN DE SASTRE: `code === "23514"` matchea
// CUALQUIER check violation. Por eso los motivos específicos van ANTES; si se
// agrega un trigger nuevo sobre properties, su rama va arriba de esa línea o se
// va a reportar como límite de plan.
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
  if (dbError.message.includes("suscripción")) {
    return "La suscripción de tu inmobiliaria no está activa, así que no podés publicar propiedades. Escribinos para reactivarla.";
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
// ─── Requisitos para alquilar: normalización SERVER-SIDE ──────
//
// ⚠ ESTO NO ES UN CAST NI UNA PROLIJIDAD: es la única barrera real. El tipado
// de TypeScript se borra al compilar, así que un cliente manipulado puede
// mandar cualquier cosa en el array. El precedente a NO repetir está al lado:
// `amenities` no valida en ninguna capa (su zod es z.array(z.string()), la
// action escribe sin filtrar y la columna no tiene CHECK), y lo que se cuele
// ahí se renderiza en el modal público. Los requisitos se filtran acá.
//
// Los valores que no pertenecen a la lista cerrada se DESCARTAN EN SILENCIO: no
// son un error que el agente pueda corregir (la interfaz solo ofrece casillas
// de la lista), así que un mensaje de error no le serviría de nada. Si llegan,
// o es un cliente manipulado o es un bug nuestro.
const RENT_REQUIREMENT_VALUES = new Set<string>(
  Object.keys(RENT_REQUIREMENT_LABELS)
);

function normalizeRentRequirements(value: unknown): RentRequirement[] {
  if (!Array.isArray(value)) return [];
  const out: RentRequirement[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!RENT_REQUIREMENT_VALUES.has(item)) continue;
    if (out.includes(item as RentRequirement)) continue; // sin duplicados
    out.push(item as RentRequirement);
  }
  return out;
}

// Requisitos libres escritos por el agente. Es una LISTA (antes era un texto
// único), así que se normaliza elemento por elemento con el mismo criterio que
// la lista cerrada de arriba: descartar lo que no sea string, trim, recorte a
// RENT_REQUIREMENT_OTHER_MAX_LEN, descartar los vacíos, deduplicar exacto y
// cortar en RENT_REQUIREMENTS_OTHER_MAX.
//
// Los tres topes replican los CHECK de la base
// (properties_rent_requirements_other_is_array / _max / _items): acá se recorta
// en vez de rechazar, para que un payload raro no le explote en la cara al
// agente por algo que la interfaz ya impide.
function normalizeRentRequirementsOther(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, RENT_REQUIREMENT_OTHER_MAX_LEN);
    if (trimmed === "") continue;
    if (out.includes(trimmed)) continue; // sin duplicados exactos
    out.push(trimmed);
    if (out.length === RENT_REQUIREMENTS_OTHER_MAX) break;
  }
  return out;
}

// Los requisitos solo tienen sentido si la propiedad se ofrece en alquiler. Si
// no, se guardan vacíos aunque hayan viajado en el payload.
function resolveRentRequirements(data: {
  for_rent: boolean;
  for_temp_rent: boolean;
  rent_requirements: unknown;
  rent_requirements_other: unknown;
}): { rent_requirements: RentRequirement[]; rent_requirements_other: string[] } {
  if (!data.for_rent && !data.for_temp_rent) {
    return { rent_requirements: [], rent_requirements_other: [] };
  }
  return {
    rent_requirements: normalizeRentRequirements(data.rent_requirements),
    rent_requirements_other: normalizeRentRequirementsOther(
      data.rent_requirements_other
    ),
  };
}

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
    // Operaciones y precios. Cada operación viaja con su par precio/moneda, y
    // el form ya manda null/null en las que no están marcadas (los CHECK de la
    // base rechazan un precio colgado de una operación apagada).
    for_sale: data.for_sale,
    sale_price: data.sale_price,
    sale_currency: data.sale_currency,
    for_rent: data.for_rent,
    rent_price: data.rent_price,
    rent_currency: data.rent_currency,
    for_temp_rent: data.for_temp_rent,
    temp_rent_price: data.temp_rent_price,
    temp_rent_currency: data.temp_rent_currency,
    // Requisitos filtrados contra la lista cerrada EN EL SERVER (ver
    // resolveRentRequirements). Nunca escribir data.rent_requirements directo.
    ...resolveRentRequirements(data),
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
      for_sale: data.for_sale,
      sale_price: data.sale_price,
      sale_currency: data.sale_currency,
      for_rent: data.for_rent,
      rent_price: data.rent_price,
      rent_currency: data.rent_currency,
      for_temp_rent: data.for_temp_rent,
      temp_rent_price: data.temp_rent_price,
      temp_rent_currency: data.temp_rent_currency,
      // Mismo filtrado server-side que en el alta.
      ...resolveRentRequirements(data),
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
