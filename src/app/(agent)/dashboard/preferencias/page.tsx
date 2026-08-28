import { requireAgentSession } from "@/lib/utils/resolveAgentSession";
import { createClient } from "@/lib/supabase/server";
import { PreferencesContent } from "@/components/dashboard/PreferencesContent";
import { AgencyPhoneForm } from "@/components/dashboard/AgencyPhoneForm";
import { AgencyLogoForm } from "@/components/dashboard/AgencyLogoForm";
import { AgencyIdentityForm } from "@/components/dashboard/AgencyIdentityForm";
import { AgencyApprovalNotice } from "@/components/dashboard/AgencyApprovalNotice";
import { getLatestRejectionNote } from "@/lib/utils/getLatestRejectionNote";

export default async function PreferenciasPage() {
  const supabase = await createClient();

  // Rol del user: solo el admin de agencia gestiona datos de la agencia (el
  // teléfono de WhatsApp). Un agente normal ve solo sus preferencias personales.
  const { agent, agency } = await requireAgentSession();

  const isAgencyAdmin = agent.role === "admin";

  // Solo si es admin traemos los datos actuales de la agencia para precargar los
  // forms. La edición real se gatea de nuevo server-side en cada action.
  let agencyPhone = "";
  let agencyLogoUrl: string | null = null;
  if (isAgencyAdmin) {
    const { data: agencyContact } = await supabase
      .from("agencies")
      .select("phone_wa, logo_url")
      .eq("id", agent.agency_id)
      .single();
    agencyPhone = agencyContact?.phone_wa ?? "";
    agencyLogoUrl = agencyContact?.logo_url ?? null;
  }

  // Esta es la pantalla donde se corrige lo que motivó un rechazo, así que el
  // aviso se repite acá: si la persona llegó desde el enlace del panel, tiene
  // que seguir viendo el motivo mientras edita, no recordarlo de memoria.
  // Sin el enlace a Preferencias, que es donde ya está.
  const rejectionNote =
    agency.approval_status === "rejected"
      ? await getLatestRejectionNote(agency.id)
      : null;

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">Preferencias</h1>

      {agency.approval_status !== "approved" && (
        <div className="mb-6">
          <AgencyApprovalNotice
            status={agency.approval_status}
            rejectionNote={rejectionNote}
            showEditLink={false}
          />
        </div>
      )}

      <div className="space-y-6">
        {/* Datos de la agencia — solo el admin de agencia (identidad, teléfono y logo) */}
        {isAgencyAdmin && (
          <>
            <AgencyIdentityForm
              initialName={agency.name}
              initialLicenseNumber={agency.license_number ?? ""}
              approvalStatus={agency.approval_status}
            />
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
