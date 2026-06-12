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
