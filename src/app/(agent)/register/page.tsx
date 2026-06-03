import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "./RegisterForm";

// Server Component: trae las ciudades activas y se las pasa al form (client).
// El registro elige la ciudad de la agencia acá, NO desde el cityStore del mapa
// (ese maneja la ciudad del marketplace público, otra cosa).
export default async function RegisterPage() {
  const supabase = await createClient();
  const { data: cities } = await supabase
    .from("cities")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return <RegisterForm cities={cities ?? []} />;
}
