import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanBadge } from "@/components/dashboard/PlanBadge";
import { NewPropertyButton } from "@/components/dashboard/NewPropertyButton";
import { PropertiesTable, type PropertyRow } from "@/components/dashboard/PropertiesTable";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";

export default async function PropiedadesPage() {
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
  if (!agent) redirect("/login");

  // Un admin de agencia ve (y gestiona) las propiedades de TODA su agencia; un
  // agente normal, solo las suyas (igual que hoy). El admin además trae el
  // nombre del agente de cada propiedad para la columna "Agente".
  const isAgencyAdmin = agent.role === "admin";

  const baseSelect =
    "id, title, property_type, operation_type, price, currency, status, images:property_images(url, is_cover, sort_order)";
  const adminSelect = `${baseSelect}, agent:agents(full_name)`;

  const propertiesQuery = isAgencyAdmin
    ? supabase
        .from("properties")
        .select(adminSelect)
        .eq("agency_id", agent.agency_id)
        .order("created_at", { ascending: false })
    : supabase
        .from("properties")
        .select(baseSelect)
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });

  const [{ data: properties }, planUsage] = await Promise.all([
    propertiesQuery,
    getPlanUsage(supabase, agent.agency_id),
  ]);

  // El join agent puede llegar como objeto o array; normalizamos a la forma
  // que espera la tabla (un nombre o null).
  const rows: PropertyRow[] = (properties ?? []).map((p) => {
    const agentRaw = (p as { agent?: unknown }).agent;
    const agentObj = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
    const agentName =
      (agentObj as { full_name?: string } | null | undefined)?.full_name ?? null;
    return {
      id: p.id,
      title: p.title,
      property_type: p.property_type,
      operation_type: p.operation_type,
      price: p.price,
      currency: p.currency,
      status: p.status,
      images: p.images,
      agent_name: agentName,
    } as PropertyRow;
  });

  return (
    <div className="p-8">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-4xl font-bold text-black">Propiedades</h1>
          <div className="mt-2">
            <PlanBadge planUsage={planUsage} />
          </div>
        </div>

        <div className="shrink-0">
          <NewPropertyButton planUsage={planUsage} />
        </div>
      </div>

      <PropertiesTable properties={rows} showAgent={isAgencyAdmin} />
    </div>
  );
}
