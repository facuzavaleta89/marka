import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
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

  return (
    <div className="flex h-dvh bg-mist overflow-hidden">
      <Sidebar
        agent={{
          full_name: agent.full_name,
          avatar_url: agent.avatar_url,
          agency: { name: agency.name },
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
      {/* ⚠ `pt-14 md:pt-0`: en celular el botón que abre el menú lateral es FIJO
          (arriba a la izquierda, 16px de margen y 36px de alto: termina en
          y=52) y tapaba el título de TODAS las páginas, que arrancan con su
          propio `p-6` o `p-8`. Estos 56px de más, solo debajo de `md`, dejan el
          título por debajo del botón en las diez páginas a la vez. Va acá y no
          en cada página: diez copias del mismo ajuste es el patrón que más caro
          le salió a este proyecto. La misma línea está en admin/layout.tsx, que
          monta el mismo Sidebar. */}
      <main className="relative flex-1 overflow-y-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
