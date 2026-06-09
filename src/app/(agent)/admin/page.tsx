import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/brand/Wordmark";
import { AgenciesTable, type AgencyRow } from "./AgenciesTable";
import type {
  SubscriptionPlan,
  SubscriptionStatus,
  TenantType,
} from "@/types";

// Panel de plataforma (solo el dueño). NO usa el sidebar del agente: es un área
// de administración de la plataforma, no de una agencia. Layout propio simple.
// La autorización por identidad acá es la primera defensa; la action repite la
// verificación (es la defensa real). Sin ADMIN_USER_ID definida → se deniega.
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fail-closed: sin env de admin, nadie es admin. No revelamos que la ruta
  // existe — redirigimos al dashboard como cualquier no-admin.
  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId) {
    redirect("/dashboard");
  }

  // Service role: la policy de SELECT de subscriptions es por agencia propia,
  // así que el dueño necesita admin client para ver las de todas las agencias.
  // Sin filtro de status: el filtrado por categoría es client-side.
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("agency_id, plan, pending_plan, status, activated_at, agencies(name, slug, tenant_type)")
    .order("created_at", { ascending: false });

  // El embedding agencies(...) puede llegar como objeto o array según la
  // inferencia; lo normalizamos a la forma que espera la tabla.
  const rows: AgencyRow[] = (data ?? []).map((sub) => {
    const agency = Array.isArray(sub.agencies) ? sub.agencies[0] : sub.agencies;
    return {
      agency_id: sub.agency_id,
      plan: sub.plan as SubscriptionPlan,
      pending_plan: (sub.pending_plan as SubscriptionPlan | null) ?? null,
      status: sub.status as SubscriptionStatus,
      activated_at: sub.activated_at,
      agency: agency
        ? {
            name: agency.name,
            slug: agency.slug,
            tenant_type: agency.tenant_type as TenantType,
          }
        : null,
    };
  });

  return (
    <div className="min-h-screen bg-mist">
      {/* Header de plataforma: wordmark + etiqueta de panel. */}
      <header className="border-b border-stone bg-paper">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between md:px-8">
          <Wordmark size="md" variant="dark" />
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
            Admin de plataforma
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 md:px-8 md:py-10">
        {/* Salida explícita al dashboard (navegación secundaria, no botón),
            coherente con el patrón "Volver al mapa" de AuthLayout. */}
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 font-sans text-sm text-graphite transition-colors duration-[120ms] ease-out hover:text-terracota"
        >
          <ArrowLeft size={16} />
          Volver al dashboard
        </Link>

        <h1 className="font-serif text-4xl font-bold text-black mb-2">
          Activación de planes
        </h1>
        <p className="font-sans text-sm text-graphite mb-8">
          Todas las agencias de la plataforma. Activá los planes pagos que están
          pendientes.
        </p>

        <AgenciesTable rows={rows} />
      </main>
    </div>
  );
}
