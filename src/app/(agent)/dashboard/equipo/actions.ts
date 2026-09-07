"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateAuthError } from "@/lib/utils/authErrors";
import { revalidatePath } from "next/cache";
import { resolveAgentSession } from "@/lib/utils/resolveAgentSession";
import { PROPERTY_IMAGES_BUCKET } from "@/lib/utils/storagePath";
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
  // 3) Autorización: el usuario tiene que ser admin DE SU agencia.
  // El agency_id sale de acá (la fila del admin), jamás del cliente.
  // Action: devuelve error, no redirige. Mismos mensajes que antes.
  const session = await resolveAgentSession();
  if (session.status !== "ok") return { error: "No autenticado" };
  const caller = session.agent;
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

// Elimina un agente de la agencia (Modelo B: sus propiedades se REASIGNAN al
// admin antes de borrar, nunca quedan huérfanas). Solo el admin de la agencia.
//
// DOS DESTINOS DISTINTOS, Y NO HAY QUE MEZCLARLOS:
//   · PROPIEDADES → se REASIGNAN al admin (acá, antes de borrar). Una propiedad
//     es un activo vivo de la agencia y tiene que seguir teniendo dueño.
//   · CONSULTAS   → se DESVINCULAN solas (`agent_id` a NULL, por el ON DELETE
//     SET NULL de la FK) y conservan el nombre en `leads.agent_name`. Una
//     consulta es un hecho histórico: no se borra, no se reasigna a otra persona
//     y no se le cambia quién la atendió. Ver el detalle en el paso 3.
//
// SEGURIDAD: role y agency_id del caller se leen del server (fila agents por
// auth.uid()), nunca del cliente. El agente a borrar tiene que pertenecer a la
// agencia del caller. No se permite el auto-borrado (la agencia no puede quedar
// sin su admin).
//
// ORDEN CRÍTICO: reasignar las propiedades ANTES de borrar. La FK real es
// `properties_agent_id_fkey: FOREIGN KEY (agent_id) REFERENCES agents(id) ON
// DELETE CASCADE` (medido contra la base), o sea que borrar primero no dejaría
// las propiedades huérfanas: LAS BORRARÍA, con sus imágenes y sus consultas
// detrás. Reasignar primero no es prolijidad, es lo único que impide perderlas.
//
// (Este comentario decía "ON DELETE SET NULL … dejaría las propiedades
// huérfanas". Era falso en la cláusula y en la consecuencia; el orden que
// prescribía, en cambio, era y sigue siendo el correcto.)
export async function deleteAgentAction(agentId: string): Promise<ActionResult> {
  if (typeof agentId !== "string" || agentId.trim() === "") {
    return { error: "Agente inválido" };
  }

  const supabase = await createClient();

  // Action: devuelve error, no redirige. Mismos mensajes que antes.
  const session = await resolveAgentSession();
  if (session.status !== "ok") return { error: "No autenticado" };

  // Auto-borrado: una agencia no puede quedar sin su admin.
  if (agentId === session.userId) {
    return { error: "No podés eliminarte a vos mismo" };
  }

  // Autorización: el caller tiene que ser admin. agency_id sale de acá.
  const caller = session.agent;
  if (caller.role !== "admin") return { error: "No autorizado" };

  // El agente a borrar tiene que pertenecer a la agencia del caller. Mismo
  // mensaje que "no existe" para no revelar agentes de otras agencias.
  const { data: target } = await supabase
    .from("agents")
    .select("id, agency_id")
    .eq("id", agentId)
    .maybeSingle();
  if (!target || target.agency_id !== caller.agency_id) {
    return { error: "Agente no encontrado" };
  }

  const admin = createAdminClient();

  // 1) Reasignar las propiedades del agente al admin (caller), ANTES de borrar.
  // Service role: toca filas de otro agente y la RLS no lo permite con el client
  // normal. Acotado a la agencia del caller (defensa en profundidad). El conteo
  // del plan no cambia: es por agency_id y sigue siendo la misma agencia. El
  // trigger de límite no se dispara (solo cambia agent_id, no el status).
  const { error: reassignError } = await admin
    .from("properties")
    .update({ agent_id: session.userId })
    .eq("agent_id", agentId)
    .eq("agency_id", caller.agency_id);
  if (reassignError) {
    return {
      error:
        "No se pudieron reasignar las propiedades del agente. No se eliminó nada.",
    };
  }

  // 2) El avatar del agente, ANTES de borrar la cuenta. Mismo criterio que
  // removeAgencyFiles: si algo falla a mitad de camino, el agente sigue
  // apareciendo en la pantalla de Equipo y la operación se puede reintentar.
  // Hecho después, el agente ya no estaría listado en ninguna parte.
  const storageError = await removeAgentAvatar(admin, agentId);

  // 3) Borrar el agente recién ahora (propiedades ya reasignadas → sin huérfanas).
  // deleteUser cascadea sobre la fila de agents por `agents_id_fkey: FOREIGN KEY
  // (id) REFERENCES auth.users(id) ON DELETE CASCADE`.
  //
  // ⚠ LAS CONSULTAS NO SE BORRAN NI SE REASIGNAN: SE DESVINCULAN. Una consulta
  // es un hecho histórico y sobrevive a la persona que la atendió. La FK real es
  // `leads_agent_id_fkey: FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE
  // SET NULL` y `leads.agent_id` es NULLABLE (las dos cosas medidas contra la
  // base). Así que al borrar al agente, sus consultas quedan con `agent_id` en
  // NULL, siguen perteneciendo a la agencia (`agency_id` es NOT NULL y no se
  // toca) y siguen apareciendo en /dashboard/leads.
  //
  // Quién las atendió no se pierde: `leads.agent_name` guarda una COPIA
  // CONGELADA del nombre, que escribe la base con el trigger
  // trg_set_lead_agent_name (BEFORE INSERT) y que este borrado no toca. La
  // pantalla muestra ese nombre con un badge "Ya no está".
  //
  // Efecto de alcance que conviene saber: una consulta desvinculada deja de
  // matchear la policy `Agent reads own leads` (`agent_id = auth.uid()`), así
  // que pasa a verla SOLO el admin de la agencia, por `Admin reads agency
  // leads`. Es lo correcto —el agente al que pertenecía ya no existe—, pero no
  // es obvio.
  //
  // (Este comentario afirmaba que la FK no tenía cláusula ON DELETE y que por
  // eso este deleteUser fallaba siempre si el agente tenía consultas. Era cierto
  // hasta la migración que introdujo el SET NULL y la copia del nombre.)
  const { error: deleteError } = await admin.auth.admin.deleteUser(agentId);
  if (deleteError) {
    // ⚠ EL ESTADO QUEDA A MEDIAS, NO "CONSISTENTE" (acá decía que sí lo era).
    // Los pasos 1 y 2 ya se ejecutaron y NO se revierten:
    //   · las propiedades del agente YA están a nombre del admin;
    //   · su avatar YA se borró del Storage (agents.avatar_url quedó apuntando a
    //     un archivo que no existe).
    // Y el agente SIGUE EXISTIENDO: su fila de `agents` y su usuario de Auth
    // están intactos, así que puede iniciar sesión y va a ver su listado de
    // propiedades vacío y su foto de perfil rota, sin que nadie le haya avisado.
    //
    // Reintentar es seguro (los dos pasos son idempotentes: ya no queda nada que
    // reasignar ni ningún archivo que borrar), pero puede no arreglar nada: la
    // causa más frecuente —el choque contra la FK de `leads`— desapareció con el
    // SET NULL, así que lo que quede acá es otra cosa. Por eso el mensaje dice
    // qué pasó y qué quedó hecho, en vez de un "intentá de nuevo" pelado.
    return {
      error:
        "No se pudo eliminar la cuenta del agente, así que sigue activa y puede ingresar. Sus propiedades ya pasaron a tu nombre y su foto de perfil ya se borró. Podés reintentar; si vuelve a fallar, escribinos.",
    };
  }

  revalidatePath("/dashboard/equipo");

  // BEST-EFFORT, PERO NO SILENCIOSO: la cuenta ya no existe, así que esto es un
  // aviso y no un fallo. Misma forma que el cierre de deleteAgencyAction y de
  // deletePropertyAction.
  if (storageError) {
    return {
      error: `El agente se eliminó, pero quedaron archivos sin borrar en el almacenamiento (${storageError}).`,
    };
  }
}

// Borra el avatar del agente. Devuelve un motivo si algo quedó sin borrar, o
// null si salió todo bien (mismo contrato que removeAgencyFiles).
//
// ⚠⚠ SOLO EL AVATAR, Y NO TOCAR ESTA REGLA. La tentación es barrer la carpeta
// `{agent_id}/` entera, y sería DESTRUCTIVO: los paths de las fotos de
// propiedades son `{agent_id}/{property_id}/{archivo}` donde ese primer uuid es
// EL AGENTE QUE SUBIÓ EL ARCHIVO, no el dueño de la propiedad (las páginas de
// nueva/editar le pasan al ImageUploader `agentId={userId}`, el de la sesión, y
// por eso la frontera de las policies de Storage es por agencia y no por
// usuario). Y el paso anterior REASIGNA las propiedades del agente al admin:
// siguen vivas y publicadas en el mapa. Barrer la carpeta se llevaría sus
// fotos. Medido en la base al escribir esto: 7 de los 12 archivos bajo una de
// esas carpetas pertenecen a propiedades que existen.
//
// Las fotos de propiedad se borran cuando se borra LA PROPIEDAD
// (deletePropertyAction), nunca cuando se borra una persona. `avatars/{id}` es
// el único prefijo que pertenece a la persona.
//
// Se LISTA la carpeta en vez de reconstruir el nombre porque la extensión
// depende del archivo que se subió (`avatar.png`, `avatar.jpeg`, …) y no se
// puede adivinar. De paso resuelve un caso que existe en la base: reemplazar el
// avatar por otro de distinta extensión deja los DOS archivos (el upsert pisa
// el mismo path, no el de otra extensión), y listar barre también los viejos.
// Molde tomado de removeAgencyFiles (admin/actions.ts).
async function removeAgentAvatar(
  admin: ReturnType<typeof createAdminClient>,
  agentId: string
): Promise<string | null> {
  const folder = `avatars/${agentId}`;

  const { data, error } = await admin.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .list(folder);

  // No poder LEER la carpeta no es lo mismo que no tener avatar: en el primer
  // caso no sabemos qué quedó y hay que decirlo.
  if (error) return "no se pudo leer la carpeta del avatar";
  if (!data || data.length === 0) return null;

  const paths = data.map((file) => `${folder}/${file.name}`);
  const { error: removeError } = await admin.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .remove(paths);

  return removeError ? `${paths.length} archivo(s)` : null;
}
