"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  // Busca la agencia del seed por slug (evita hardcodear el UUID)
  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("id")
    .eq("slug", "inmobiliaria-demo")
    .single();

  if (agencyError || !agency) {
    return { error: "No hay agencia disponible para el registro" };
  }

  const { error: agentError } = await supabase.from("agents").insert({
    id: authData.user.id,
    agency_id: agency.id,
    full_name: data.fullName,
    phone_wa: data.phoneWa,
  });

  if (agentError) return { error: "Error al crear el perfil del agente" };

  // Si Supabase requiere confirmación de email, el usuario llega aquí sin sesión
  // → Desactivar "Confirm email" en Supabase > Auth > Settings para desarrollo
  redirect("/dashboard");
}
