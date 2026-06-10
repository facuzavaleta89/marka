"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateAuthError } from "@/lib/utils/authErrors";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = { error: string } | undefined;

// Mismo esquema que valida el form en el cliente. Se revalida en el server
// porque la validación del cliente es solo UX: nunca es la barrera real.
const createAgentSchema = z.object({
  full_name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  phone_wa: z
    .string()
    .regex(/^\d{10,}$/, "Solo números, sin + ni espacios. Ej: 5491112345678"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

// Crea un agente nuevo dentro de la agencia del admin logueado.
// SEGURIDAD: toda la autorización es server-side. El agency_id se deriva del
// auth.uid() (nunca del cliente), y solo un agent con role 'admin' puede crear.
export async function createAgentAction(
  input: CreateAgentInput
): Promise<ActionResult> {
  // 1) Validación server-side de los inputs
  const parsed = createAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { full_name, email, phone_wa, password } = parsed.data;

  // 2) Sesión: tiene que haber un usuario logueado
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // 3) Autorización: el usuario tiene que ser admin DE SU agencia.
  // El agency_id sale de acá (la fila del admin), jamás del cliente.
  const { data: caller } = await supabase
    .from("agents")
    .select("agency_id, role")
    .eq("id", user.id)
    .single();

  if (!caller) return { error: "No autenticado" };
  if (caller.role !== "admin") return { error: "No autorizado" };

  const agencyId = caller.agency_id;

  // 4) Alta del usuario de Auth con service role.
  // createUser (no signUp) NO inicia sesión: el admin sigue logueado como él.
  // email_confirm: true → queda confirmado, sin mail de verificación.
  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !created.user) {
    return { error: translateAuthError(authError?.message ?? "") };
  }

  // 5) Fila en agents (service role: la policy de INSERT solo deja id = auth.uid()).
  // role 'agent': el creado es un miembro común, no admin. agency_id heredado del admin.
  const { error: agentError } = await admin.from("agents").insert({
    id: created.user.id,
    agency_id: agencyId,
    role: "agent",
    full_name,
    phone_wa,
    email,
  });

  // 6) Rollback de huérfano: si falla el insert en agents, borramos el user
  // de Auth recién creado para no dejar una cuenta sin perfil.
  if (agentError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "No se pudo crear el agente. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/equipo");
}
