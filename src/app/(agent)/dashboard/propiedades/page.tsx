import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanBadge } from "@/components/dashboard/PlanBadge";
import { NewPropertyButton } from "@/components/dashboard/NewPropertyButton";
import { PropertiesTable, type PropertyRow } from "@/components/dashboard/PropertiesTable";
import { getPlanUsage } from "@/lib/utils/getPlanUsage";

export default async function PropiedadesPage() {
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

  const [{ data: properties }, planUsage] = await Promise.all([
    supabase
      .from("properties")
      .select(
        "id, title, property_type, operation_type, price, currency, status, images:property_images(url, is_cover, sort_order)"
      )
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false }),

    getPlanUsage(supabase, agent.agency_id),
  ]);

  return (
    <div className="p-8">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-4xl font-bold text-black">Propiedades</h1>
          <div className="mt-2">
            <PlanBadge planUsage={planUsage} />
          </div>
        </div>

        <div className="shrink-0">
          <NewPropertyButton planUsage={planUsage} />
        </div>
      </div>

      <PropertiesTable properties={(properties ?? []) as PropertyRow[]} />
    </div>
  );
}
