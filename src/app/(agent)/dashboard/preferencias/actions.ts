"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveAgentSession } from "@/lib/utils/resolveAgentSession";
import {
  LICENSE_NUMBER_ERROR,
  LICENSE_NUMBER_PATTERN,
  normalizeLicenseNumber,
} from "@/lib/utils/licenseNumber";

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

  // Es una action: ante sesión inválida devuelve error, NO redirige (redirigir
  // desde un submit rompe el manejo de errores del formulario que la llama).
  // Mismos mensajes que antes.
  const session = await resolveAgentSession();
  if (session.status !== "ok") return { error: "No autenticado" };
  const caller = session.agent;
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

  // Es una action: ante sesión inválida devuelve error, NO redirige (redirigir
  // desde un submit rompe el manejo de errores del formulario que la llama).
  // Mismos mensajes que antes.
  const session = await resolveAgentSession();
  if (session.status !== "ok") return { error: "No autenticado" };
  const caller = session.agent;
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

// Identidad de la agencia: razón social + matrícula del colegio de corredores.
//
// REGLA DE NEGOCIO: estos dos campos se editan SOLO mientras la agencia está
// 'pending' o 'rejected'. Una vez aprobada quedan congelados, porque el nombre
// está semi-regulado por el colegio y cambiarlo después de la aprobación
// tendría que pasar por otro flujo de aprobación que hoy no existe.
//
// ⚠ LA VALIDACIÓN DE ESA REGLA VIVE ACÁ Y SOLO ACÁ. `agencies` no tiene policy
// de UPDATE, así que la escritura va con service role y la RLS no protege nada:
// deshabilitar los inputs en la interfaz es cosmético. El estado se LEE del
// server (fila agencies por el agency_id de la sesión), nunca de lo que mande
// el cliente.
//
// REENVÍO DE LA SOLICITUD: si la agencia estaba 'rejected', guardar la devuelve
// a 'pending'. Es la corrección del cliente volviendo a la cola, sin que el
// dueño tenga que intervenir. Si ya estaba 'pending', el estado no se toca.
const agencyIdentitySchema = z.object({
  name: z.string().trim().min(1, "El nombre de la inmobiliaria es requerido"),
  license_number: z
    .string()
    .transform(normalizeLicenseNumber)
    .refine((v) => v.length > 0, "La matrícula es requerida")
    .refine((v) => LICENSE_NUMBER_PATTERN.test(v), LICENSE_NUMBER_ERROR),
});

export async function updateAgencyIdentityAction(input: {
  name: string;
  license_number: string;
}): Promise<{ error: string } | { resubmitted: boolean }> {
  const parsed = agencyIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, license_number } = parsed.data;

  const session = await resolveAgentSession();
  if (session.status !== "ok") return { error: "No autenticado" };
  if (session.agent.role !== "admin") return { error: "No autorizado" };

  const admin = createAdminClient();

  // El estado que rige se relee del server; el de la sesión sirve para la UI,
  // pero para autorizar una escritura se consulta la fila real.
  const { data: agency } = await admin
    .from("agencies")
    .select("approval_status")
    .eq("id", session.agent.agency_id)
    .maybeSingle();

  if (!agency) return { error: "No se encontró la agencia" };

  if (agency.approval_status === "approved") {
    return {
      error:
        "Tu inmobiliaria ya está aprobada: el nombre y la matrícula no se pueden cambiar. Escribinos si necesitás corregirlos.",
    };
  }

  // Rechazada → vuelve a la cola. Pendiente → sigue pendiente. El slug NO se
  // toca: cambiarlo rompería la URL pública de la agencia y está fuera de alcance.
  const wasRejected = agency.approval_status === "rejected";

  const { error } = await admin
    .from("agencies")
    .update({
      name,
      license_number,
      ...(wasRejected ? { approval_status: "pending" } : {}),
    })
    .eq("id", session.agent.agency_id);

  if (error) {
    return { error: "No se pudieron guardar los datos. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/preferencias");
  revalidatePath("/dashboard");
  return { resubmitted: wasRejected };
}
