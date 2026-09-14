import { requireAgentSession } from "@/lib/utils/resolveAgentSession";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlanBadge } from "@/components/dashboard/PlanBadge";
import { NewPropertyButton } from "@/components/dashboard/NewPropertyButton";
import { PropertiesTable, type PropertyRow } from "@/components/dashboard/PropertiesTable";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
import { getPublishBlock } from "@/lib/utils/getPublishBlock";

// PostgREST devuelve el conteo embebido como `[{ count: N }]` (una relación
// to-many materializada como array de un elemento). Ante cualquier otra forma
// devuelve `null`, no 0: un cero diría "nadie escribió".
function embeddedCount(value: unknown): number | null {
  const first = Array.isArray(value) ? value[0] : value;
  const count = (first as { count?: unknown } | null | undefined)?.count;
  return typeof count === "number" ? count : null;
}

export default async function PropiedadesPage() {
  const supabase = await createClient();

  const { userId, agent, agency } = await requireAgentSession();

  // Un admin de agencia ve (y gestiona) las propiedades de TODA su agencia; un
  // agente normal, solo las suyas (igual que hoy). El admin además trae el
  // nombre del agente de cada propiedad para la columna "Agente".
  const isAgencyAdmin = agent.role === "admin";

  // Las NUEVE columnas de operación/precio: la tabla muestra todas las
  // operaciones activas con su precio (o "A convenir" si no tiene). Más
  // `views_count`, que vive en la misma fila y no cuesta nada traer.
  const baseSelect =
    "id, title, property_type, for_sale, sale_price, sale_currency, for_rent, rent_price, rent_currency, for_temp_rent, temp_rent_price, temp_rent_currency, status, views_count, images:property_images(url, is_cover, sort_order)";
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

  // ══════════════════════════════════════════════════════════════
  // CONTACTOS POR PROPIEDAD: UNA sola consulta, agregada en la base
  // ══════════════════════════════════════════════════════════════
  //
  // `leads(count)` embebido hace el conteo en PostgREST: una fila por
  // propiedad con su total, no una fila por consulta ni una consulta por fila.
  //
  // ⚠ VA CON SERVICE ROLE, y no por comodidad: con el client normal el número
  // SE TRUNCA EN SILENCIO. Las dos policies de SELECT de `leads` son
  // `Agent reads own leads` (agent_id = auth.uid()) y `Admin reads agency
  // leads` (por agencia). Un agente común no vería:
  //   · las consultas de una propiedad suya que entraron cuando estaba a nombre
  //     de otro agente (la reasignación no es retroactiva);
  //   · las consultas desvinculadas (agent_id NULL) de un agente que se fue.
  // Y el embed no da error: devuelve `count: 0`. Medido con la anon key: 200 y
  // ceros en propiedades que tienen consultas. El número tiene que ser el de LA
  // PROPIEDAD, igual que `views_count`, o la relación entre los dos miente.
  //
  // ⚠ LA BARRERA LA PONE ESTE FILTRO, NO UNA POLICY: es exactamente el mismo
  // alcance que el listado de arriba, con los dos valores sacados de la sesión
  // del servidor (nunca del cliente). Un agente solo recibe los totales de las
  // propiedades a su nombre; un admin, los de su agencia. Y solo viajan
  // números, ninguna consulta.
  const leadCountsQuery = createAdminClient()
    .from("properties")
    .select("id, leads(count)")
    .eq(
      isAgencyAdmin ? "agency_id" : "agent_id",
      isAgencyAdmin ? agent.agency_id : userId
    );

  const [{ data: properties }, planUsage, { data: leadCounts, error: leadCountsError }] =
    await Promise.all([
      propertiesQuery,
      getPlanUsage(supabase, agent.agency_id),
      leadCountsQuery,
    ]);

  // Si la consulta de conteo falla, cada propiedad queda con `null` y la tabla
  // muestra "—". Un 0 diría "nadie escribió", que sería inventar el dato.
  const leadCountById = new Map<string, number | null>();
  if (!leadCountsError) {
    for (const row of leadCounts ?? []) {
      leadCountById.set(row.id, embeddedCount((row as { leads?: unknown }).leads));
    }
  }

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
      views_count: p.views_count,
      images: p.images,
      agent_name: agentName,
      // Sin error, una propiedad AUSENTE del conteo tiene 0 consultas (p. ej.
      // se creó entre las dos lecturas). Con error, o si el conteo vino con una
      // forma inesperada (`null` en el mapa), queda `null` → "—".
      // ⚠ No usar `leadCountById.get(p.id) ?? 0`: el `??` convertiría ese `null`
      // en un 0 inventado. Por eso se pregunta `has()` primero.
      lead_count: leadCountsError
        ? null
        : leadCountById.has(p.id)
          ? (leadCountById.get(p.id) ?? null)
          : 0,
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
