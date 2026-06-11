"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { generateSlug } from "@/lib/utils/generateSlug";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
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
};

export type UpdatePropertyInput = PropertyFormPayload & {
  status: PropertyInsert["status"];
  images: ImageInput[];
};

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
  const { data: agent } = await supabase
    .from("agents")
    .select("role, agency_id")
    .eq("id", user.id)
    .single();

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
    // El trigger check_property_limit lanza SQLSTATE 23514 al superar el límite del plan
    if (dbError.code === "23514" || dbError.message.includes("Límite")) {
      return {
        error: "Alcanzaste el límite de propiedades de tu plan.",
      };
    }
    return { error: "No se pudo activar la propiedad" };
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

// ─── Alta de propiedad ────────────────────────────────────────

export async function createPropertyAction(
  data: CreatePropertyInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Obtener datos del agente → agencia → ciudad (para city_id, city, province)
  const { data: agent } = await supabase
    .from("agents")
    .select("agency_id")
    .eq("id", user.id)
    .single();
  if (!agent) return { error: "Agente no encontrado" };

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

  const { error: insertError } = await supabase.from("properties").insert({
    id: data.id,
    agent_id: user.id,
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
    amenities: data.amenities,
    year_built: data.year_built ?? null,
    is_featured: isFeatured,
  });

  if (insertError) {
    // El trigger check_property_limit lanza SQLSTATE 23514 al superar el límite del plan
    if (insertError.code === "23514" || insertError.message.includes("Límite")) {
      return {
        error: "Alcanzaste el límite de propiedades de tu plan.",
      };
    }
    return { error: "No se pudo crear la propiedad" };
  }

  // Insertar imágenes (si las hay)
  if (data.images.length > 0) {
    const { error: imagesError } = await supabase.from("property_images").insert(
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
  const { ok, error, supabase, db } = await authorizePropertyAccess(id);
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

  const { error: updateError } = await db
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
      amenities: data.amenities,
      year_built: data.year_built ?? null,
      is_featured: isFeatured,
      // El slug no se recalcula al editar
    })
    .eq("id", id);

  if (updateError) {
    if (updateError.code === "23514" || updateError.message.includes("Límite")) {
      return {
        error:
          "Alcanzaste el límite de propiedades de tu plan. No podés volver a activar esta propiedad.",
      };
    }
    return { error: "No se pudieron guardar los cambios" };
  }

  // Reemplazar imágenes: delete + re-insert con el nuevo orden.
  // Si el delete falla, NO insertamos (evita duplicar) y avisamos sin perder las existentes.
  // Con `db`: la RLS de property_images también está atada al agent_id dueño, así
  // que un admin editando algo ajeno necesita service role acá igual que en el update.
  const { error: deleteError } = await db
    .from("property_images")
    .delete()
    .eq("property_id", id);
  if (deleteError) {
    return { error: "No se pudieron actualizar las imágenes. Volvé a intentar." };
  }

  if (data.images.length > 0) {
    const { error: imagesError } = await db.from("property_images").insert(
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
