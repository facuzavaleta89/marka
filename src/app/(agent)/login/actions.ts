"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function translateAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) return "Email o contraseña incorrectos";
  if (message.includes("Email not confirmed")) return "Confirmá tu email antes de ingresar";
  if (message.includes("Too many requests")) return "Demasiados intentos. Intentá más tarde";
  return "Error al iniciar sesión. Intentá de nuevo";
}

export async function loginAction({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error.message) };
  redirect("/dashboard");
}
