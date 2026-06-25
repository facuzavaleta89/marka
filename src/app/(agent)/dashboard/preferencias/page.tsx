import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PreferencesContent } from "@/components/dashboard/PreferencesContent";
import { AgencyPhoneForm } from "@/components/dashboard/AgencyPhoneForm";
import { AgencyLogoForm } from "@/components/dashboard/AgencyLogoForm";

export default async function PreferenciasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Rol del user: solo el admin de agencia gestiona datos de la agencia (el
  // teléfono de WhatsApp). Un agente normal ve solo sus preferencias personales.
  const { data: agent } = await supabase
    .from("agents")
    .select("role, agency_id")
    .eq("id", user.id)
    .single();
  if (!agent) redirect("/login");

  const isAgencyAdmin = agent.role === "admin";

  // Solo si es admin traemos los datos actuales de la agencia para precargar los
  // forms. La edición real se gatea de nuevo server-side en cada action.
  let agencyPhone = "";
  let agencyLogoUrl: string | null = null;
  if (isAgencyAdmin) {
    const { data: agency } = await supabase
      .from("agencies")
      .select("phone_wa, logo_url")
      .eq("id", agent.agency_id)
      .single();
    agencyPhone = agency?.phone_wa ?? "";
    agencyLogoUrl = agency?.logo_url ?? null;
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">Preferencias</h1>

      <div className="space-y-6">
        {/* Datos de la agencia — solo el admin de agencia (teléfono + logo juntos) */}
        {isAgencyAdmin && (
          <>
            <AgencyPhoneForm initialPhone={agencyPhone} />
            <AgencyLogoForm
              initialLogoUrl={agencyLogoUrl}
              agencyId={agent.agency_id}
            />
          </>
        )}

        {/* Preferencias personales (localStorage) */}
        <PreferencesContent />
      </div>
    </div>
  );
}
