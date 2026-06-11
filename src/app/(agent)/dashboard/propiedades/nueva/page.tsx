import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PropertyForm } from "@/components/properties/PropertyForm";

export default async function NuevaPropiedadPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("agency_id, role")
    .eq("id", user.id)
    .single();

  if (!agent) redirect("/dashboard");

  // Si es admin de agencia, traemos los agentes de la agencia para el selector
  // "Agente asignado" (ordenados por nombre). Si es agente normal, no se pasa →
  // el campo no aparece y la propiedad se crea a su nombre.
  let agencyAgents: { id: string; full_name: string }[] | undefined;
  if (agent.role === "admin") {
    const { data: members } = await supabase
      .from("agents")
      .select("id, full_name")
      .eq("agency_id", agent.agency_id)
      .order("full_name", { ascending: true });
    agencyAgents = (members ?? []) as { id: string; full_name: string }[];
  }

  const { data: agency } = await supabase
    .from("agencies")
    .select("city_id")
    .eq("id", agent.agency_id)
    .single();

  if (!agency) redirect("/dashboard");

  const { data: city } = await supabase
    .from("cities")
    .select("center_lat, center_lng")
    .eq("id", agency.city_id)
    .single();

  const cityCenter = city
    ? { lat: city.center_lat, lng: city.center_lng }
    : { lat: -27.7951, lng: -64.2615 }; // fallback Santiago del Estero

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/dashboard/propiedades"
        className="inline-flex items-center gap-1.5 font-sans text-sm text-graphite hover:text-black mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Volver al listado
      </Link>

      <h1 className="font-serif text-4xl font-bold text-black mb-8">
        Nueva propiedad
      </h1>

      <PropertyForm
        mode="create"
        agentId={user.id}
        agencyId={agent.agency_id}
        cityId={agency.city_id}
        cityCenter={cityCenter}
        agencyAgents={agencyAgents}
      />
    </div>
  );
}
