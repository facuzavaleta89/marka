"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { PHONE_WA_ERROR, resolvePhoneWaForSave } from "@/lib/utils/phoneWa";
import { isStoragePublicUrl } from "@/lib/utils/storagePublicUrl";
import { translateFormatCheckError } from "@/lib/utils/dbFormatErrors";

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

  // ⚠ LA FOTO TAMBIÉN: `avatar_url` llega del navegador. Vale null (sin foto) o
  // una URL del Storage del proyecto, lo mismo que exige el CHECK
  // agents_avatar_url_storage de la base. `undefined` = no se tocó la foto.
  if (
    data.avatar_url !== undefined &&
    data.avatar_url !== null &&
    !isStoragePublicUrl(data.avatar_url)
  ) {
    return { error: "La foto de perfil no es válida. Volvé a subirla." };
  }

  // ⚠ EL TELÉFONO SE VALIDA ACÁ. Esta action escribía lo que le llegara, sin
  // mirar nada: el formulario validaba, pero una action se invoca sin pasar por
  // el formulario, y un número roto termina en el enlace de WhatsApp de la
  // agencia. Mismo criterio que el formulario (lib/utils/phoneWa).
  //
  // El número guardado HOY se lee de la fila real, no del cliente: es el único
  // valor que se acepta sin reformatear, para que guardar el perfil sin tocar
  // un número viejo con otro formato no lo cambie.
  const { data: current, error: readError } = await supabase
    .from("agents")
    .select("phone_wa")
    .eq("id", user.id)
    .single();

  if (readError || !current) {
    return { error: "No se pudo actualizar el perfil. Intentá de nuevo." };
  }

  const phone_wa =
    typeof data.phone_wa === "string"
      ? resolvePhoneWaForSave(data.phone_wa, current.phone_wa ?? null)
      : null;
  if (phone_wa === null) return { error: PHONE_WA_ERROR };

  const updatePayload: {
    full_name: string;
    phone_wa: string;
    avatar_url?: string | null;
  } = {
    full_name: data.full_name,
    phone_wa,
  };
  if (data.avatar_url !== undefined) {
    updatePayload.avatar_url = data.avatar_url;
  }

  const { error } = await supabase
    .from("agents")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) {
    return {
      error:
        translateFormatCheckError(error) ??
        "No se pudo actualizar el perfil. Intentá de nuevo.",
    };
  }

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
