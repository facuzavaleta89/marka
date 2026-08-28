"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUniqueAgencySlug } from "@/lib/utils/agencySlug";
import { translateAuthError } from "@/lib/utils/authErrors";
import { redirect } from "next/navigation";
import { PLANS } from "@/types";
import {
  LICENSE_NUMBER_PATTERN,
  normalizeLicenseNumber,
} from "@/lib/utils/licenseNumber";

type RegisterData = {
  fullName: string;
  // Razón social de la inmobiliaria. Siempre presente: la app solo registra
  // inmobiliarias (las cuentas de particular ya no se ofrecen en el alta).
  agencyName: string;
  // Matrícula del colegio de corredores. Obligatoria en toda alta nueva; se
  // guarda como TEXTO (ver lib/utils/licenseNumber).
  licenseNumber: string;
  cityId: string;
  email: string;
  password: string;
  phoneWa: string;
};

export async function registerAction(
  data: RegisterData
): Promise<{ error: string } | undefined> {
  // La matrícula se normaliza y valida en el server: el formulario ya lo hace,
  // pero el cliente no es una barrera.
  const licenseNumber = normalizeLicenseNumber(data.licenseNumber ?? "");
  if (!LICENSE_NUMBER_PATTERN.test(licenseNumber)) {
    return { error: "Matrícula inválida" };
  }

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

  // Crea una agencia nueva para este registro (ya no se cuelga de una demo).
  // El nombre es siempre la razón social de la inmobiliaria.
  // El insert va con service role porque no hay policy de INSERT en agencies.
  const agencyName = data.agencyName;

  // Slug LIMPIO para la agencia (white-label lo usa en la URL): sin sufijo
  // aleatorio, con -2/-3 solo ante colisión. El pre-chequeo de
  // generateUniqueAgencySlug no es atómico, así que reintentamos el insert ante
  // una violación de UNIQUE del slug (23505, race de dos registros con el mismo
  // nombre): en el siguiente intento ve el slug recién tomado y prueba el
  // siguiente número. agencies.slug UNIQUE es la garantía final.
  let agency: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !agency; attempt++) {
    const slug = await generateUniqueAgencySlug(admin, agencyName);
    const { data: inserted, error: insertError } = await admin
      .from("agencies")
      .insert({
        city_id: data.cityId,
        name: agencyName,
        slug,
        // Fijo en el servidor: la app solo opera con inmobiliarias. El cliente
        // ya no manda este dato (se eliminó el selector de tipo de cuenta del
        // registro). La columna sigue existiendo para las filas históricas.
        tenant_type: "agency",
        license_number: licenseNumber,
        // approval_status NO se setea acá: el DEFAULT de la base ya deja la
        // agencia en 'pending' hasta que el dueño la apruebe desde /admin.
        // La agencia hereda el WhatsApp de su admin fundador: el dueño es el
        // contacto natural de la agencia recién creada. Es editable después en
        // Preferencias si la agencia tiene otro número. phone_wa es NOT NULL en la
        // base, así que setearlo acá es obligatorio (sin esto el insert fallaría).
        phone_wa: data.phoneWa,
      })
      .select("id")
      .single();

    if (inserted) {
      agency = inserted;
      break;
    }
    // 23505 = unique_violation. OJO: agencies tiene DOS fuentes posibles de
    // 23505 — el UNIQUE de slug y el índice único parcial
    // (city_id, license_number) entre agencias APROBADAS. Acá solo puede venir
    // del slug, porque el alta nace en 'pending' y el índice de matrícula no
    // aplica a las pendientes. Por eso reintentar regenerando el slug es
    // correcto hoy; si algún día el alta escribiera una agencia ya aprobada,
    // habría que distinguir cuál de los dos índices falló antes de reintentar.
    if (insertError?.code !== "23505") break;
  }

  if (!agency) {
    // ROLLBACK: el usuario de Auth ya existe, pero sin agencia no hay cuenta
    // usable. Si lo dejáramos, quedaría un auth.users huérfano: una sesión
    // válida que no resuelve ninguna inmobiliaria (el caso que el área privada
    // tiene que expulsar al login). Se borra acá, igual que hace
    // createAgentAction cuando le falla el insert de agents.
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: "No se pudo crear la agencia" };
  }

  // El creador de la agencia es su admin (gestiona suscripción y, a futuro,
  // invita agentes y ve los leads de toda la agencia — Fase 3).
  const { error: agentError } = await admin.from("agents").insert({
    id: authData.user.id,
    agency_id: agency.id,
    role: "admin",
    full_name: data.fullName,
    phone_wa: data.phoneWa,
    email: data.email, // denormalizado para mostrarlo en la UI (lista de equipo)
  });

  if (agentError) {
    // Mismo rollback que arriba: sin fila en agents el usuario queda huérfano.
    // Se borra el user de Auth; la agencia recién creada queda sin agentes y la
    // limpia el dueño desde el panel (borrarla acá arriesgaría pisar datos si el
    // insert de agents falló por una carrera y no por el alta en sí).
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: "Error al crear el perfil del agente" };
  }

  // Garantiza que la agencia tenga una suscripción.
  // upsert con ignoreDuplicates: no pisa una suscripción existente (ej. una de pago).
  // Toda agencia nueva arranca en 'free'/'active' con los límites de free. La
  // selección de un plan pago es un paso posterior (/register/plan), no acá.
  const { error: subError } = await admin
    .from("subscriptions")
    .upsert(
      {
        agency_id: agency.id,
        plan: "free",
        status: "active",
        property_limit: PLANS.free.propertyLimit,
        has_featured: PLANS.free.featured,
        has_white_label: PLANS.free.whiteLabel,
        has_metrics: PLANS.free.metrics,
      },
      { onConflict: "agency_id", ignoreDuplicates: true }
    );

  if (subError) return { error: "No se pudo configurar la suscripción de la agencia" };

  // Si Supabase requiere confirmación de email, el usuario llega aquí sin sesión
  // → Desactivar "Confirm email" en Supabase > Auth > Settings para desarrollo.
  // Toda alta pasa por el paso de selección de plan: la cuenta queda en free
  // (estado de aterrizaje) y ahí elige el plan pago, o lo deja para después.
  redirect("/register/plan");
}
