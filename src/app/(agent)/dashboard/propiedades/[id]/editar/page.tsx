import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PropertyForm } from "@/components/properties/PropertyForm";
import type { Property, PropertyImage } from "@/types";

export default async function EditarPropiedadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 16: awaitar params antes de usarlos
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Traemos la propiedad SIN filtrar por agent_id: el dueño la edita, y también
  // un admin de la misma agencia. La RLS de lectura por agencia ya permite que
  // un miembro lea las propiedades de su agencia.
  const { data: property } = await supabase
    .from("properties")
    .select(
      "*, images:property_images(id, property_id, url, is_cover, sort_order, created_at)"
    )
    .eq("id", id)
    .single();

  if (!property) redirect("/dashboard/propiedades");

  // Rol y agencia del caller (del server). Sirve para la autorización y para
  // decidir si mostrar el selector "Agente asignado".
  const { data: agent } = await supabase
    .from("agents")
    .select("role, agency_id")
    .eq("id", user.id)
    .single();

  // Admin de la MISMA agencia que la propiedad.
  const isAgencyAdmin =
    agent?.role === "admin" && agent.agency_id === property.agency_id;

  // Autorización server-side (mismo criterio que authorizePropertyAccess en las
  // actions): puede editar el dueño, o un admin de la agencia de la propiedad.
  if (property.agent_id !== user.id && !isAgencyAdmin) {
    redirect("/dashboard/propiedades");
  }

  // Si es admin, traemos los agentes de la agencia para el selector "Agente
  // asignado" (ordenados por nombre). Si no, no se pasa → el campo no aparece.
  let agencyAgents: { id: string; full_name: string }[] | undefined;
  if (isAgencyAdmin) {
    const { data: members } = await supabase
      .from("agents")
      .select("id, full_name")
      .eq("agency_id", property.agency_id)
      .order("full_name", { ascending: true });
    agencyAgents = (members ?? []) as { id: string; full_name: string }[];
  }

  const { data: agency } = await supabase
    .from("agencies")
    .select("city_id")
    .eq("id", property.agency_id)
    .single();

  const { data: city } = agency
    ? await supabase
        .from("cities")
        .select("center_lat, center_lng")
        .eq("id", agency.city_id)
        .single()
    : { data: null };

  const cityCenter = city
    ? { lat: city.center_lat, lng: city.center_lng }
    : { lat: property.lat, lng: property.lng };

  // Ordenar imágenes por sort_order
  const images: PropertyImage[] = (
    (property.images as PropertyImage[]) ?? []
  ).sort((a, b) => a.sort_order - b.sort_order);

  const initialData: Property = {
    ...property,
    images,
  } as Property;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/dashboard/propiedades"
        className="inline-flex items-center gap-1.5 font-sans text-sm text-graphite hover:text-black mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Volver al listado
      </Link>

      <h1 className="font-serif text-4xl font-bold text-black mb-2">
        Editar propiedad
      </h1>
      <p className="font-sans text-sm text-graphite mb-8 truncate">
        {property.title}
      </p>

      <PropertyForm
        mode="edit"
        initialData={initialData}
        agentId={user.id}
        agencyId={property.agency_id}
        cityId={property.city_id}
        cityCenter={cityCenter}
        agencyAgents={agencyAgents}
      />
    </div>
  );
}
