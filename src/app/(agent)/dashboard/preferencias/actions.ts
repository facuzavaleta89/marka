"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = { error: string } | undefined;

// Mismo formato de phone_wa que en el resto (perfil, alta de agente): solo
// dígitos, mínimo 10, sin + ni espacios. Obligatorio (NOT NULL en la base).
const agencyPhoneSchema = z.object({
  phone_wa: z
    .string()
    .regex(/^\d{10,}$/, "Solo números, sin + ni espacios. Ej: 5491112345678"),
});

// El logo se sube client-side a Storage (bucket público); acá solo persistimos la
// URL pública ya resultante. Validamos que sea una URL no vacía.
const agencyLogoSchema = z.object({
  logo_url: z.string().url("URL de logo inválida"),
});

// Actualiza el teléfono de WhatsApp de la agencia del admin logueado.
// SEGURIDAD: solo el admin de la agencia puede tocar datos de la agencia. El
// role y el agency_id se leen del server (fila agents por auth.uid()), nunca del
// cliente. Como no hay policy de UPDATE de agencies para usuarios, se escribe con
// service role acotando el UPDATE a la agencia del caller.
export async function updateAgencyPhoneAction(input: {
  phone_wa: string;
}): Promise<ActionResult> {
  const parsed = agencyPhoneSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { phone_wa } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: caller } = await supabase
    .from("agents")
    .select("agency_id, role")
    .eq("id", user.id)
    .single();

  if (!caller) return { error: "No autenticado" };
  if (caller.role !== "admin") return { error: "No autorizado" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("agencies")
    .update({ phone_wa })
    .eq("id", caller.agency_id);

  if (error) {
    return { error: "No se pudo actualizar el teléfono de la agencia. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/preferencias");
}

// Persiste la URL del logo de la agencia del admin logueado. El archivo ya se subió
// a Storage client-side; acá solo escribimos la URL en agencies.logo_url.
// SEGURIDAD: idéntica a updateAgencyPhoneAction — lo sensible es la escritura en la
// tabla agencies (dato de agencia, gateado a admin), no el archivo en el bucket
// público. role y agency_id se leen del server (fila agents por auth.uid()), nunca
// del cliente. Sin policy de UPDATE de agencies para usuarios → service role acotado
// al agency_id del caller.
export async function updateAgencyLogoAction(input: {
  logo_url: string;
}): Promise<ActionResult> {
  const parsed = agencyLogoSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { logo_url } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: caller } = await supabase
    .from("agents")
    .select("agency_id, role")
    .eq("id", user.id)
    .single();

  if (!caller) return { error: "No autenticado" };
  if (caller.role !== "admin") return { error: "No autorizado" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("agencies")
    .update({ logo_url })
    .eq("id", caller.agency_id);

  if (error) {
    return { error: "No se pudo actualizar el logo de la agencia. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/preferencias");
}
