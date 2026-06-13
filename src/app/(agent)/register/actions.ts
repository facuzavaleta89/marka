"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUniqueAgencySlug } from "@/lib/utils/agencySlug";
import { translateAuthError } from "@/lib/utils/authErrors";
import { redirect } from "next/navigation";
import { PLANS, type TenantType } from "@/types";

type RegisterData = {
  tenantType: TenantType;
  fullName: string;
  // Nombre de la inmobiliaria. Solo se usa cuando tenantType === "agency";
  // para un particular ("individual") la agencia toma el fullName.
  agencyName: string;
  cityId: string;
  email: string;
  password: string;
  phoneWa: string;
};

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

  // El aprovisionamiento del agente y su suscripción se hace con service role.
  // Motivo: si "Confirm email" está activo, después de signUp no hay sesión, así
  // que el client normal correría como anon (auth.uid() = null) y la policy
  // "Agent creates own profile" (WITH CHECK id = auth.uid()) rechazaría el insert.
  const admin = createAdminClient();

  // Crea una agencia nueva para este registro (ya no se cuelga de una demo).
  // Una inmobiliaria usa su razón social; un particular usa su nombre completo.
  // El insert va con service role porque no hay policy de INSERT en agencies.
  const agencyName =
    data.tenantType === "agency" ? data.agencyName : data.fullName;

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
        tenant_type: data.tenantType,
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
    // 23505 = unique_violation. En agencies el único UNIQUE relevante es el slug,
    // así que reintentamos regenerando. Cualquier otro error: no insistir.
    if (insertError?.code !== "23505") break;
  }

  if (!agency) {
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

  if (agentError) return { error: "Error al crear el perfil del agente" };

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
  // Un particular ya tiene su plan (free) → directo al dashboard. Una inmobiliaria
  // pasa por el paso de selección de plan.
  redirect(data.tenantType === "individual" ? "/dashboard" : "/register/plan");
}
