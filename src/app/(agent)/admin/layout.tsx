import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fail-closed: sin ADMIN_USER_ID, nadie es admin. No revelamos que la ruta
  // existe — redirigimos al dashboard como cualquier no-admin.
  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId) {
    redirect("/dashboard");
  }

  // Mismos datos que alimenta dashboard/layout.tsx al Sidebar.
  const { data: agent } = await supabase
    .from("agents")
    .select("full_name, avatar_url, agency_id, role, agency:agencies(name)")
    .eq("id", user.id)
    .single();

  if (!agent) redirect("/login");

  const planUsage = await getPlanUsage(supabase, agent.agency_id);

  // El dueño ya pasó el gating de arriba, así que acá isAppAdmin es siempre true
  // (mantiene visible el ítem "Panel admin" del sidebar, que ahora queda activo).
  const isAppAdmin = true;
  const isAgencyAdmin = agent.role === "admin";

  // Supabase devuelve agency como array cuando se usa join; normalizamos.
  const agencyRaw = agent.agency;
  const agencyName = Array.isArray(agencyRaw)
    ? agencyRaw[0]?.name ?? null
    : (agencyRaw as { name: string } | null)?.name ?? null;

  return (
    <div className="flex h-dvh bg-mist overflow-hidden">
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
      {/* relative: load-bearing (mismo motivo que dashboard/layout.tsx). El main es
          el containing block de los descendientes position:absolute de los forms
          internos de Radix/shadcn; sin él se anclan al viewport y generan un scroll
          fantasma en páginas altas. No quitar. */}
      <main className="relative flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
