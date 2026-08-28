import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAgentSession } from "@/lib/utils/resolveAgentSession";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
import { getPublishBlock } from "@/lib/utils/getPublishBlock";

export default async function NuevaPropiedadPage() {
  const supabase = await createClient();

  // Antes esta página mandaba a /dashboard cuando no resolvía el agente, a
  // diferencia del resto. No arreglaba nada: el layout de /dashboard volvía a
  // evaluar lo mismo y ahí sí cortaba a /login, entrando al bucle. Se unifica
  // con el helper, que cierra la sesión y manda al login con el motivo.
  const { userId, agent, agency } = await requireAgentSession();

  // GATE DE PUBLICACIÓN. Antes esta ruta no validaba nada: se llegaba
  // escribiendo la URL, se llenaba el formulario entero y el rechazo aparecía
  // recién al guardar (lo tiran los triggers de la base). Ahora se corta antes
  // de renderizar, y el listado explica el motivo con el mismo criterio.
  const planUsage = await getPlanUsage(supabase, agent.agency_id);
  if (getPublishBlock(planUsage, agency.approval_status)) {
    redirect("/dashboard/propiedades");
  }

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

  // city_id de la agencia, para centrar el mapa del LocationPicker. Esta guarda
  // NO es la del bucle (esa era la del agente, arriba): protege contra que la
  // fila de agencies no traiga la ciudad. Se conserva tal cual estaba.
  const { data: agencyCity } = await supabase
    .from("agencies")
    .select("city_id")
    .eq("id", agent.agency_id)
    .single();

  if (!agencyCity) redirect("/dashboard");

  const { data: city } = await supabase
    .from("cities")
    .select("center_lat, center_lng")
    .eq("id", agencyCity.city_id)
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
        agentId={userId}
        agencyId={agent.agency_id}
        cityId={agencyCity.city_id}
        cityCenter={cityCenter}
        agencyAgents={agencyAgents}
      />
    </div>
  );
}
