"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { PLANS } from "@/types";

type RegisterData = {
  fullName: string;
  email: string;
  password: string;
  phoneWa: string;
};

function translateAuthError(message: string): string {
  if (message.includes("already registered")) return "Ya existe una cuenta con ese email";
  if (message.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres";
  if (message.includes("Unable to validate")) return "Email inválido";
  return "Error al crear la cuenta. Intentá de nuevo";
}

export async function registerAction(
  data: RegisterData
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });

  if (error) return { error: translateAuthError(error.message) };
  if (!authData.user) return { error: "No se pudo crear el usuario" };

  // El aprovisionamiento del agente y su suscripción se hace con service role.
  // Motivo: si "Confirm email" está activo, después de signUp no hay sesión, así
  // que el client normal correría como anon (auth.uid() = null) y la policy
  // "Agent creates own profile" (WITH CHECK id = auth.uid()) rechazaría el insert.
  const admin = createAdminClient();

  // Busca la agencia del seed por slug (evita hardcodear el UUID)
  const { data: agency, error: agencyError } = await admin
    .from("agencies")
    .select("id")
    .eq("slug", "inmobiliaria-demo")
    .single();

  if (agencyError || !agency) {
    return { error: "No hay agencia disponible para el registro" };
  }

  const { error: agentError } = await admin.from("agents").insert({
    id: authData.user.id,
    agency_id: agency.id,
    full_name: data.fullName,
    phone_wa: data.phoneWa,
  });

  if (agentError) return { error: "Error al crear el perfil del agente" };

  // Garantiza que la agencia tenga una suscripción.
  // upsert con ignoreDuplicates: no pisa una suscripción existente (ej. una de pago).
  // Una agencia nueva arranca en el plan free (límite 1, sin entitlements).
  // NOTA: la selección de plan post-registro es trabajo de Fase 3.
  const { error: subError } = await admin
    .from("subscriptions")
    .upsert(
      {
        agency_id: agency.id,
        plan: "free",
        property_limit: PLANS.free.propertyLimit,
        has_featured: PLANS.free.featured,
        has_white_label: PLANS.free.whiteLabel,
        has_metrics: PLANS.free.metrics,
      },
      { onConflict: "agency_id", ignoreDuplicates: true }
    );

  if (subError) return { error: "No se pudo configurar la suscripción de la agencia" };

  // Si Supabase requiere confirmación de email, el usuario llega aquí sin sesión
  // → Desactivar "Confirm email" en Supabase > Auth > Settings para desarrollo
  redirect("/dashboard");
}
