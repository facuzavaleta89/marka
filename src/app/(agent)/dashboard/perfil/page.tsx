import { requireAgentSession } from "@/lib/utils/resolveAgentSession";
import { ProfileForm } from "@/components/dashboard/ProfileForm";

export default async function PerfilPage() {
  const { userId, agent } = await requireAgentSession();

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">Perfil</h1>
      <ProfileForm
        agentId={userId}
        agent={{
          full_name: agent.full_name,
          phone_wa: agent.phone_wa ?? "",
          avatar_url: agent.avatar_url,
        }}
      />
    </div>
  );
}
