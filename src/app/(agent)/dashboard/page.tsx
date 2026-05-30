import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LayoutDashboard, Building2, Eye, Layers } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { formatPrice } from "@/lib/utils/formatPrice";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
} from "@/lib/utils/labels";
import type { Currency, PropertyStatus, PropertyType } from "@/types";

const STATUS_COLOR: Record<PropertyStatus, string> = {
  active: "text-success",
  paused: "text-graphite",
  sold: "text-stone",
  rented: "text-stone",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("agency_id")
    .eq("id", user.id)
    .single();
  if (!agent) redirect("/login");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { count: activeCount },
    { count: leadsCount },
    { data: allProperties },
    { data: recentProperties },
    planUsage,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .eq("status", "active"),

    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .gte("created_at", thirtyDaysAgo.toISOString()),

    supabase
      .from("properties")
      .select("views_count")
      .eq("agent_id", user.id),

    supabase
      .from("properties")
      .select("id, title, property_type, price, currency, status")
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),

    getPlanUsage(supabase, agent.agency_id),
  ]);

  const totalViews = (allProperties ?? []).reduce(
    (sum, p) => sum + (p.views_count ?? 0),
    0
  );

  const propertyLimit = planUsage.limit;
  const used = planUsage.used;
  const available = propertyLimit - used;

  return (
    <div className="p-8">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">Inicio</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <StatsCard
          title="Propiedades activas"
          value={activeCount ?? 0}
          icon={Building2}
        />
        <StatsCard
          title="Leads este mes"
          value={leadsCount ?? 0}
          icon={LayoutDashboard}
          description="Últimos 30 días"
        />
        <StatsCard
          title="Vistas totales"
          value={totalViews.toLocaleString("es-AR")}
          icon={Eye}
        />
        <StatsCard
          title="Disponibles del plan"
          value={Math.max(0, available)}
          icon={Layers}
          description={`${used} de ${propertyLimit} usadas`}
        />
      </div>

      {/* Últimas propiedades */}
      <div>
        <h2 className="font-serif text-2xl font-semibold text-black mb-4">
          Últimas propiedades
        </h2>

        {!recentProperties || recentProperties.length === 0 ? (
          <div className="bg-paper border border-stone rounded-lg px-6 py-10 text-center">
            <p className="font-sans text-base text-graphite">
              No tenés propiedades publicadas aún.
            </p>
            <a
              href="/dashboard/propiedades/nueva"
              className="inline-block mt-3 font-sans text-sm font-medium text-terracota hover:underline"
            >
              Publicar primera propiedad
            </a>
          </div>
        ) : (
          <div className="bg-paper border border-stone rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone">
                  <th className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite text-left px-6 py-3">
                    Propiedad
                  </th>
                  <th className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite text-left px-6 py-3 hidden sm:table-cell">
                    Tipo
                  </th>
                  <th className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite text-left px-6 py-3">
                    Precio
                  </th>
                  <th className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite text-left px-6 py-3">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {recentProperties.map((p) => (
                  <tr key={p.id} className="hover:bg-mist/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-sans text-sm font-medium text-black line-clamp-1">
                        {p.title}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="font-sans text-sm text-graphite">
                        {PROPERTY_TYPE_LABELS[p.property_type as PropertyType]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-sans text-sm font-medium text-black">
                        {formatPrice(p.price, p.currency as Currency)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-sans text-sm ${STATUS_COLOR[p.status as PropertyStatus]}`}
                      >
                        {PROPERTY_STATUS_LABELS[p.status as PropertyStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
