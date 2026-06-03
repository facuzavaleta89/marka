"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateSlug } from "@/lib/utils/generateSlug";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
import type { PropertyInsert } from "@/types";

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

// Verifica explícitamente que la propiedad pertenece al agente.
// No confiar solo en RLS; validar también en la action.
async function verifyOwnership(id: string): Promise<{
  ok: boolean;
  error?: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No autenticado", supabase };

  const { data: owned } = await supabase
    .from("properties")
    .select("id")
    .eq("id", id)
    .eq("agent_id", user.id)
    .maybeSingle();

  if (!owned) return { ok: false, error: "Propiedad no encontrada", supabase };

  return { ok: true, supabase };
}

export async function pausePropertyAction(id: string): Promise<ActionResult> {
  const { ok, error, supabase } = await verifyOwnership(id);
  if (!ok) return { error: error! };

  const { error: dbError } = await supabase
    .from("properties")
    .update({ status: "paused" })
    .eq("id", id);

  if (dbError) return { error: "No se pudo pausar la propiedad" };
  revalidatePath("/dashboard/propiedades");
}

export async function activatePropertyAction(id: string): Promise<ActionResult> {
  const { ok, error, supabase } = await verifyOwnership(id);
  if (!ok) return { error: error! };

  const { error: dbError } = await supabase
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
  const { ok, error, supabase } = await verifyOwnership(id);
  if (!ok) return { error: error! };

  const { error: dbError } = await supabase
    .from("properties")
    .update({ status: "sold" })
    .eq("id", id);

  if (dbError) return { error: "No se pudo marcar la propiedad como vendida" };
  revalidatePath("/dashboard/propiedades");
}

export async function markAsRentedAction(id: string): Promise<ActionResult> {
  const { ok, error, supabase } = await verifyOwnership(id);
  if (!ok) return { error: error! };

  const { error: dbError } = await supabase
    .from("properties")
    .update({ status: "rented" })
    .eq("id", id);

  if (dbError) return { error: "No se pudo marcar la propiedad como alquilada" };
  revalidatePath("/dashboard/propiedades");
}

export async function deletePropertyAction(id: string): Promise<ActionResult> {
  const { ok, error, supabase } = await verifyOwnership(id);
  if (!ok) return { error: error! };

  // ON DELETE CASCADE en la DB elimina property_images y leads asociados.
  // Las imágenes del Supabase Storage no se eliminan automáticamente.
  const { error: dbError } = await supabase
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
  const { ok, error, supabase } = await verifyOwnership(id);
  if (!ok) return { error: error! };

  // Destacar es un entitlement de la suscripción (has_featured): si la agencia
  // no lo tiene, se ignora el valor que mandó el form.
  const { data: prop } = await supabase
    .from("properties")
    .select("agency_id")
    .eq("id", id)
    .single();
  const planUsage = prop ? await getPlanUsage(supabase, prop.agency_id) : null;
  const isFeatured = data.is_featured && (planUsage?.hasFeatured ?? false);

  const { error: updateError } = await supabase
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
  const { error: deleteError } = await supabase
    .from("property_images")
    .delete()
    .eq("property_id", id);
  if (deleteError) {
    return { error: "No se pudieron actualizar las imágenes. Volvé a intentar." };
  }

  if (data.images.length > 0) {
    const { error: imagesError } = await supabase.from("property_images").insert(
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
