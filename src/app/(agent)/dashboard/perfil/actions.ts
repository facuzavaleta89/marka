"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | undefined;

export async function updateProfileAction(data: {
  full_name: string;
  phone_wa: string;
  avatar_url?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const updatePayload: {
    full_name: string;
    phone_wa: string;
    avatar_url?: string | null;
  } = {
    full_name: data.full_name,
    phone_wa: data.phone_wa,
  };
  if (data.avatar_url !== undefined) {
    updatePayload.avatar_url = data.avatar_url;
  }

  const { error } = await supabase
    .from("agents")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) return { error: "No se pudo actualizar el perfil" };

  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard", "layout");
}

export async function updatePasswordAction(data: {
  password: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: data.password });
  if (error) return { error: "No se pudo cambiar la contraseña. Intentá de nuevo." };
}
