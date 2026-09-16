import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
import { requireAgentSession } from "@/lib/utils/resolveAgentSession";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Resuelve usuario + agente + agencia de una sola vez. Corta a /login si no
  // hay sesión, y a /logout (que cierra la sesión) si la cuenta no resuelve su
  // agencia — eso último es lo que rompe el bucle de redirecciones.
  // La llamada está cacheada por request: la página que cuelga de este layout
  // vuelve a pedirla sin generar una segunda consulta.
  const { userId, agent, agency } = await requireAgentSession();

  const planUsage = await getPlanUsage(supabase, agent.agency_id);

  // Acceso al panel de plataforma: solo el dueño. Se calcula en el server
  // (ADMIN_USER_ID es server-only); al cliente solo le llega el booleano.
  // Fail-closed: sin env, nadie es admin.
  const adminUserId = process.env.ADMIN_USER_ID;
  const isAppAdmin = !!adminUserId && userId === adminUserId;

  // Admin DE SU agencia (distinto de isAppAdmin): gatea la gestión de equipo.
  // Solo oculta/muestra el menú; la página y la action revalidan el rol server-side.
  const isAgencyAdmin = agent.role === "admin";

  // Estructura (barra lateral + main scrolleable): ver DashboardShell.
  return (
    <DashboardShell
      agent={{
        full_name: agent.full_name,
        avatar_url: agent.avatar_url,
        agency: { name: agency.name },
      }}
      planUsage={planUsage}
      isAppAdmin={isAppAdmin}
      isAgencyAdmin={isAgencyAdmin}
    >
      {children}
    </DashboardShell>
  );
}
