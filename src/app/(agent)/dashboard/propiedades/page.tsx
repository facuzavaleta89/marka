import { requireAgentSession } from "@/lib/utils/resolveAgentSession";
import { createClient } from "@/lib/supabase/server";
import { PlanBadge } from "@/components/dashboard/PlanBadge";
import { NewPropertyButton } from "@/components/dashboard/NewPropertyButton";
import { PropertiesTable, type PropertyRow } from "@/components/dashboard/PropertiesTable";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
import { getPublishBlock } from "@/lib/utils/getPublishBlock";

export default async function PropiedadesPage() {
  const supabase = await createClient();

  const { userId, agent, agency } = await requireAgentSession();

  // Un admin de agencia ve (y gestiona) las propiedades de TODA su agencia; un
  // agente normal, solo las suyas (igual que hoy). El admin además trae el
  // nombre del agente de cada propiedad para la columna "Agente".
  const isAgencyAdmin = agent.role === "admin";

  // Las NUEVE columnas de operación/precio: la tabla muestra todas las
  // operaciones activas con su precio (o "A convenir" si no tiene).
  const baseSelect =
    "id, title, property_type, for_sale, sale_price, sale_currency, for_rent, rent_price, rent_currency, for_temp_rent, temp_rent_price, temp_rent_currency, status, images:property_images(url, is_cover, sort_order)";
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
        .eq("agent_id", userId)
        .order("created_at", { ascending: false });

  const [{ data: properties }, planUsage] = await Promise.all([
    propertiesQuery,
    getPlanUsage(supabase, agent.agency_id),
  ]);

  // Mismo criterio que los triggers de la base (ver getPublishBlock).
  const publishBlock = getPublishBlock(planUsage, agency.approval_status);

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
      for_sale: p.for_sale,
      sale_price: p.sale_price,
      sale_currency: p.sale_currency,
      for_rent: p.for_rent,
      rent_price: p.rent_price,
      rent_currency: p.rent_currency,
      for_temp_rent: p.for_temp_rent,
      temp_rent_price: p.temp_rent_price,
      temp_rent_currency: p.temp_rent_currency,
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
          <NewPropertyButton
            planUsage={planUsage}
            approvalStatus={agency.approval_status}
          />
        </div>
      </div>

      <PropertiesTable
        properties={rows}
        showAgent={isAgencyAdmin}
        publishBlockMessage={publishBlock?.message}
      />
    </div>
  );
}
