import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/dashboard/ProfileForm";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("full_name, phone_wa, avatar_url")
    .eq("id", user.id)
    .single();

  if (!agent) redirect("/login");

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">Perfil</h1>
      <ProfileForm
        agentId={user.id}
        agent={{
          full_name: agent.full_name,
          phone_wa: agent.phone_wa ?? "",
          avatar_url: agent.avatar_url,
        }}
      />
    </div>
  );
}
