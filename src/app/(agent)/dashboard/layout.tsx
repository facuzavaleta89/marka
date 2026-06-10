import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("full_name, avatar_url, agency_id, role, agency:agencies(name)")
    .eq("id", user.id)
    .single();

  if (!agent) redirect("/login");

  const planUsage = await getPlanUsage(supabase, agent.agency_id);

  // Acceso al panel de plataforma: solo el dueño. Se calcula en el server
  // (ADMIN_USER_ID es server-only); al cliente solo le llega el booleano.
  // Fail-closed: sin env, nadie es admin.
  const adminUserId = process.env.ADMIN_USER_ID;
  const isAppAdmin = !!adminUserId && user.id === adminUserId;

  // Admin DE SU agencia (distinto de isAppAdmin): gatea la gestión de equipo.
  // Solo oculta/muestra el menú; la página y la action revalidan el rol server-side.
  const isAgencyAdmin = agent.role === "admin";

  // Supabase devuelve agency como array cuando se usa join; normalizamos
  const agencyRaw = agent.agency;
  const agencyName = Array.isArray(agencyRaw)
    ? agencyRaw[0]?.name ?? null
    : (agencyRaw as { name: string } | null)?.name ?? null;

  return (
    <div className="flex h-screen bg-mist overflow-hidden">
      <Sidebar
        agent={{
          full_name: agent.full_name,
          avatar_url: agent.avatar_url,
          agency: agencyName ? { name: agencyName } : null,
        }}
        planUsage={planUsage}
        isAppAdmin={isAppAdmin}
        isAgencyAdmin={isAgencyAdmin}
      />
      {/* relative: main es el contenedor scrolleable del dashboard; al ser
          containing block, los descendientes position:absolute de los formularios
          (internos de Radix/shadcn) quedan anclados a él y no al viewport — si no,
          en páginas altas (nueva/editar) escapan al ICB y generan un segundo scroll
          fantasma en el documento por debajo del form. */}
      <main className="relative flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
