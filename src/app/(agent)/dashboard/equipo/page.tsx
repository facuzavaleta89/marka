import { redirect } from "next/navigation";
import { requireAgentSession } from "@/lib/utils/resolveAgentSession";
import { createClient } from "@/lib/supabase/server";
import { TeamContent, type TeamMember } from "@/components/dashboard/TeamContent";

export default async function EquipoPage() {
  const supabase = await createClient();

  // Rol y agencia del usuario. Gating server-side: la gestión de equipo es
  // solo para el admin de la agencia; un agente normal no debe ni ver la página
  // (ocultar el menú en el Sidebar no alcanza).
  const { userId, agent } = await requireAgentSession();
  if (agent.role !== "admin") redirect("/dashboard");

  // Equipo: todos los agentes de la misma agencia (incluido el admin actual) +
  // las propiedades de la agencia (solo agent_id) para contar cuántas tiene cada
  // uno + las consultas de la agencia, para el mismo fin.
  // La lectura de agents/properties por agencia ya la permite la RLS; la de
  // leads también, por `Admin reads agency leads` (esta página es solo-admin, ya
  // cortada arriba, así que el caller siempre pasa esa policy).
  const [{ data: members }, { data: agencyProps }, { data: agencyLeads }] =
    await Promise.all([
      supabase
        .from("agents")
        .select("id, full_name, email, phone_wa, role, created_at")
        .eq("agency_id", agent.agency_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("properties")
        .select("agent_id")
        .eq("agency_id", agent.agency_id),
      supabase
        .from("leads")
        .select("agent_id")
        .eq("agency_id", agent.agency_id),
    ]);

  // Cuántas propiedades tiene cada agente (para el aviso de borrado: esas pasan
  // al admin). Se cuenta por agent_id; las huérfanas (NULL) no aplican acá.
  const countByAgent = new Map<string, number>();
  for (const p of agencyProps ?? []) {
    if (p.agent_id) {
      countByAgent.set(p.agent_id, (countByAgent.get(p.agent_id) ?? 0) + 1);
    }
  }

  // Cuántas consultas tiene cada agente. Mismo patrón que las propiedades (un
  // conteo en memoria, no N queries), pero el efecto del borrado es OTRO: estas
  // no se reasignan a nadie, se desvinculan y quedan en el historial de la
  // agencia con el nombre congelado. El aviso de borrado tiene que decirlo,
  // porque es igual de irreversible.
  // Las que ya están desvinculadas (agent_id NULL) no se cuentan para nadie: no
  // pertenecen a ningún agente vivo.
  const leadsByAgent = new Map<string, number>();
  for (const l of agencyLeads ?? []) {
    if (l.agent_id) {
      leadsByAgent.set(l.agent_id, (leadsByAgent.get(l.agent_id) ?? 0) + 1);
    }
  }

  const teamMembers: TeamMember[] = (members ?? []).map((m) => ({
    ...m,
    property_count: countByAgent.get(m.id) ?? 0,
    lead_count: leadsByAgent.get(m.id) ?? 0,
  })) as TeamMember[];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-black">Equipo</h1>
        <p className="mt-2 font-sans text-sm text-graphite">
          Los agentes de tu agencia. Creá nuevos miembros y compartiles su
          contraseña para que ingresen.
        </p>
      </div>

      <TeamContent members={teamMembers} currentUserId={userId} />
    </div>
  );
}
