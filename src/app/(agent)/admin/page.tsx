import {
  Building2,
  CreditCard,
  Clock,
  Users,
  Home,
  Inbox,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AgenciesTable, type AgencyRow } from "./AgenciesTable";
import type {
  SubscriptionPlan,
  SubscriptionStatus,
  TenantType,
} from "@/types";

// Panel de plataforma (solo el dueño). El gating (ADMIN_USER_ID) y el shell con
// sidebar viven en admin/layout.tsx: si esta página se renderiza, ya pasó el
// control de acceso. La action (activatePlanAction) repite la verificación aparte.
export default async function AdminPage() {
  // Service role: la policy de SELECT de subscriptions es por agencia propia,
  // así que el dueño necesita admin client para ver las de todas las agencias.
  // Sin filtro de status: el filtrado por categoría es client-side.
  const admin = createAdminClient();

  // Ventana de 30 días para "Leads del mes" (mismo patrón que dashboard/page.tsx).
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Métricas de negocio (counts con service role, omite RLS) en paralelo con la
  // query de la tabla. head:true → solo el count, sin traer filas.
  const [
    { data },
    { count: agenciesCount },
    { count: paidActiveCount },
    { count: pendingCount },
    { count: agentsCount },
    { count: activePropertiesCount },
    { count: leadsMonthCount },
  ] = await Promise.all([
    admin
      .from("subscriptions")
      .select("agency_id, plan, pending_plan, status, activated_at, agencies(name, slug, tenant_type)")
      .order("created_at", { ascending: false }),

    admin.from("agencies").select("*", { count: "exact", head: true }),

    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .neq("plan", "free"),

    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),

    admin.from("agents").select("*", { count: "exact", head: true }),

    admin
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),

    admin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

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
    <div className="p-8">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">
        Resumen
      </h1>

      {/* Métricas de negocio de la plataforma. Acento terracota en "Pendientes
          de activación": es la métrica que requiere acción del dueño. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
        <StatsCard
          title="Agencias"
          value={agenciesCount ?? 0}
          icon={<Building2 size={20} />}
        />
        <StatsCard
          title="Pagas activas"
          value={paidActiveCount ?? 0}
          icon={<CreditCard size={20} />}
        />
        <StatsCard
          title="Pendientes"
          value={pendingCount ?? 0}
          icon={<Clock size={20} />}
          description="Esperan activación"
          accent
        />
        <StatsCard
          title="Agentes"
          value={agentsCount ?? 0}
          icon={<Users size={20} />}
        />
        <StatsCard
          title="Propiedades activas"
          value={activePropertiesCount ?? 0}
          icon={<Home size={20} />}
        />
        <StatsCard
          title="Leads"
          value={leadsMonthCount ?? 0}
          icon={<Inbox size={20} />}
          description="Últimos 30 días"
        />
      </div>

      {/* Zona de gestión: el listado de agencias y la activación de planes. */}
      <h2 className="font-serif text-2xl font-semibold text-black mb-2">
        Agencias
      </h2>
      <p className="font-sans text-sm text-graphite mb-6">
        Todas las agencias de la plataforma. Activá los planes pagos que están
        pendientes.
      </p>

      <AgenciesTable rows={rows} />
    </div>
  );
}
