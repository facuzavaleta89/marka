import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
import { resolveAgentSession } from "@/lib/utils/resolveAgentSession";

// Layout del panel de plataforma (solo el dueño). Comparte el shell del dashboard
// (sidebar + área de contenido) pero centraliza acá el gating: este layout envuelve
// TODAS las sub-rutas de /admin, así que el chequeo de identidad en un solo lugar
// protege todo lo que cuelgue de /admin. La action (activatePlanAction) repite la
// verificación por su cuenta — esa es la defensa real.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Se resuelve la sesión con el helper compartido, pero los cortes se hacen a
  // mano para CONSERVAR EL ORDEN original: primero sesión, después identidad del
  // dueño, y recién al final la cuenta huérfana. Así un no-admin sigue yendo a
  // /dashboard sin que el estado de su agencia influya en nada.
  const session = await resolveAgentSession();
  if (session.status === "no_session") redirect("/login");

  // Fail-closed: sin ADMIN_USER_ID, nadie es admin. No revelamos que la ruta
  // existe — redirigimos al dashboard como cualquier no-admin.
  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || session.userId !== adminUserId) {
    redirect("/dashboard");
  }

  // Cuenta con sesión pero sin agencia resoluble: cerrar sesión (ver
  // requireAgentSession — es la salida del bucle de redirecciones).
  if (session.status === "unlinked") redirect("/logout?reason=no_agency");

  const { agent, agency } = session;

  const planUsage = await getPlanUsage(supabase, agent.agency_id);

  // El dueño ya pasó el gating de arriba, así que acá isAppAdmin es siempre true
  // (mantiene visible el ítem "Panel admin" del sidebar, que ahora queda activo).
  const isAppAdmin = true;
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
      {/* relative: load-bearing (mismo motivo que dashboard/layout.tsx). El main es
          el containing block de los descendientes position:absolute de los forms
          internos de Radix/shadcn; sin él se anclan al viewport y generan un scroll
          fantasma en páginas altas. No quitar. */}
      <main className="relative flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
