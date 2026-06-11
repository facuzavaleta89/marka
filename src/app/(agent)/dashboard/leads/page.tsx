import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeadsContent, type LeadRow } from "@/components/dashboard/LeadsContent";

// Supabase puede devolver una relación embebida como objeto o como array según
// cómo infiera la cardinalidad. Normalizamos a un objeto (o null), mismo patrón
// que usa el layout para agency.
function firstOrSelf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function LeadsPage() {
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

  const isAgencyAdmin = agent.role === "admin";

  // Filtramos por agency_id y dejamos que la RLS recorte: un agente normal solo
  // ve sus propios leads (policy agent_id = auth.uid()), un admin ve los de toda
  // su agencia (policy Admin reads agency leads). Misma query, distinto resultado.
  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, contact_name, created_at, source, agent:agents(id, full_name), property:properties(id, title, slug)"
    )
    .eq("agency_id", agent.agency_id)
    .order("created_at", { ascending: false });

  const rows: LeadRow[] = (leads ?? []).map((l) => ({
    id: l.id,
    contact_name: l.contact_name,
    created_at: l.created_at,
    source: l.source,
    agent: firstOrSelf(l.agent),
    property: firstOrSelf(l.property),
  }));

  return (
    <div className="p-8">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">Consultas</h1>

      <LeadsContent leads={rows} isAgencyAdmin={isAgencyAdmin} />
    </div>
  );
}
