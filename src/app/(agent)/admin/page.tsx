import {
  Building2,
  CreditCard,
  Clock,
  Users,
  Home,
  Inbox,
  ShieldQuestion,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AgenciesTable, type AgencyRow } from "./AgenciesTable";
import type {
  ApprovalStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/types";

// Forma cruda de la fila que devuelve la query de abajo. La suscripción y la
// ciudad llegan como embeds de PostgREST, que se materializan como objeto o como
// array de uno según la inferencia: por eso el tipo admite las dos formas y
// firstOf() las normaliza (mismo patrón que resolveAgencyBySlug).
type AgencyQueryRow = {
  id: string;
  name: string;
  slug: string;
  license_number: string | null;
  approval_status: string;
  subscription:
    | AgencySubscriptionEmbed
    | AgencySubscriptionEmbed[]
    | null;
  city: { name: string } | { name: string }[] | null;
};

type AgencySubscriptionEmbed = {
  plan: string;
  pending_plan: string | null;
  status: string;
  activated_at: string | null;
  current_period_end: string | null;
};

// Normaliza un embed to-one que PostgREST puede devolver como objeto o array.
function firstOf<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

// Panel de plataforma (solo el dueño). El gating (ADMIN_USER_ID) y el shell con
// sidebar viven en admin/layout.tsx: si esta página se renderiza, ya pasó el
// control de acceso. Las actions repiten la verificación aparte.
export default async function AdminPage() {
  // Service role: la policy de SELECT de subscriptions es por agencia propia,
  // así que el dueño necesita admin client para ver las de todas las agencias.
  // Sin filtro de status: el filtrado por categoría es client-side.
  const admin = createAdminClient();

  // Ventana de 30 días para "Leads del mes" (mismo patrón que dashboard/page.tsx).
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Métricas de negocio (counts con service role, omite RLS) en paralelo con la
  // query de la tabla. head:true → solo el count, sin traer filas.
  const [
    { data },
    { count: agenciesCount },
    { count: toApproveCount },
    { count: paidActiveCount },
    { count: pendingPlanCount },
    { count: agentsCount },
    { count: activePropertiesCount },
    { count: leadsMonthCount },
    { data: propertyOwners },
    { data: leadOwners },
  ] = await Promise.all([
    // La lista parte de AGENCIES, no de subscriptions. El sentido importa: esta
    // es la única pantalla donde se aprueba una agencia, así que ninguna agencia
    // puede quedar fuera. Partiendo de subscriptions, una agencia sin fila de
    // suscripción era invisible acá — justo el caso que el alta manual vuelve
    // posible. La suscripción ahora es un embed OPCIONAL (puede venir null).
    // Columnas explícitas, nunca "*".
    admin
      .from("agencies")
      .select(
        "id, name, slug, license_number, approval_status, subscription:subscriptions(plan, pending_plan, status, activated_at, current_period_end), city:cities(name)"
      )
      .order("created_at", { ascending: false }),

    admin.from("agencies").select("*", { count: "exact", head: true }),

    // Bandeja de entrada del dueño: agencias esperando su decisión.
    admin
      .from("agencies")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "pending"),

    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .neq("plan", "free"),

    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),

    admin.from("agents").select("*", { count: "exact", head: true }),

    admin
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),

    admin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString()),

    // Qué agencias tienen datos cargados, para decidir a cuáles se les OFRECE
    // la eliminación. Se traen los agency_id y se arman dos conjuntos, en vez
    // de un count por agencia (que serían N queries). Mismo patrón que
    // dashboard/equipo/page.tsx para contar propiedades por agente.
    //
    // ⚠ ESTO NO ES LA BARRERA: deleteAgencyAction vuelve a contar contra la
    // base antes de borrar. Acá solo se decide si el botón aparece, y por eso
    // se puede resolver con una lectura barata y potencialmente desactualizada.
    admin.from("properties").select("agency_id, status"),
    admin.from("leads").select("agency_id"),
  ]);

  // Conjuntos de agencias "no vacías". Si alguna de las dos lecturas fallara,
  // `data` viene null y el conjunto queda vacío → se ofrecería eliminar de más;
  // la action lo rechaza igual, así que el peor caso es un botón que no
  // funciona, nunca un borrado indebido.
  const agenciesWithProperties = new Set(
    (propertyOwners ?? []).map((p) => p.agency_id as string)
  );
  const agenciesWithLeads = new Set(
    (leadOwners ?? []).map((l) => l.agency_id as string)
  );

  // Propiedades que OCUPAN CUPO por agencia, para que el panel pueda anticipar
  // si un cambio de plan entraría o no.
  //
  // ⚠ EL CRITERIO ES EL DE LA BASE, no uno propio: check_property_limit() cuenta
  // `status IN ('active','paused')` por agency_id (las vendidas/alquiladas no
  // ocupan cupo). Contar distinto acá haría que la interfaz ofreciera un cambio
  // que la action rechaza, o al revés. Sale de la MISMA lectura que ya se hacía
  // para `can_delete` —solo se le sumó la columna `status`—, así que no hay
  // consulta nueva.
  const occupiedByAgency = new Map<string, number>();
  for (const row of propertyOwners ?? []) {
    const status = row.status as string;
    if (status !== "active" && status !== "paused") continue;
    const agencyId = row.agency_id as string;
    occupiedByAgency.set(agencyId, (occupiedByAgency.get(agencyId) ?? 0) + 1);
  }

  // Mapeo a la forma que consume la tabla. La suscripción puede faltar: en ese
  // caso `subscription` queda en null y la tabla lo muestra como "sin plan", no
  // como "undefined".
  const rows: AgencyRow[] = ((data ?? []) as unknown as AgencyQueryRow[]).map(
    (agency) => {
      const subscription = firstOf(agency.subscription);
      const city = firstOf(agency.city);
      return {
        agency_id: agency.id,
        name: agency.name,
        slug: agency.slug,
        license_number: agency.license_number,
        approval_status: agency.approval_status as ApprovalStatus,
        city_name: city?.name ?? null,
        // Vacía = sin propiedades y sin consultas. Es la única condición bajo la
        // que se ofrece eliminar.
        can_delete:
          !agenciesWithProperties.has(agency.id) &&
          !agenciesWithLeads.has(agency.id),
        occupied_properties: occupiedByAgency.get(agency.id) ?? 0,
        subscription: subscription
          ? {
              plan: subscription.plan as SubscriptionPlan,
              pending_plan:
                (subscription.pending_plan as SubscriptionPlan | null) ?? null,
              status: subscription.status as SubscriptionStatus,
              activated_at: subscription.activated_at,
              current_period_end: subscription.current_period_end,
            }
          : null,
      };
    }
  );

  return (
    <div className="p-8">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">
        Resumen
      </h1>

      {/* Métricas de negocio de la plataforma. Acento terracota SOLO en
          "Por aprobar": es la bandeja de entrada del dueño, lo que exige acción
          suya. "Planes por activar" quedó en tratamiento neutro para que no
          compitan dos acentos. La grilla es de 7 tarjetas: 2 / 4 / 7 por
          breakpoint, así ninguna fila queda con una sola card colgando. */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-12">
        <StatsCard
          title="Por aprobar"
          value={toApproveCount ?? 0}
          icon={<ShieldQuestion size={20} />}
          description="Agencias pendientes"
          accent
        />
        <StatsCard
          title="Agencias"
          value={agenciesCount ?? 0}
          icon={<Building2 size={20} />}
        />
        <StatsCard
          title="Pagas activas"
          value={paidActiveCount ?? 0}
          icon={<CreditCard size={20} />}
        />
        <StatsCard
          title="Planes"
          value={pendingPlanCount ?? 0}
          icon={<Clock size={20} />}
          description="Esperan activación"
        />
        <StatsCard
          title="Agentes"
          value={agentsCount ?? 0}
          icon={<Users size={20} />}
        />
        {/* Cuenta con service role, o sea SIN las policies públicas: incluye
            las propiedades que el mapa oculta porque su agencia no está al día
            (ver agency_is_publicly_visible). Es deliberado —acá interesa cuánto
            hay CARGADO, no cuánto se ve—, pero el número no coincide con el del
            mapa y sin la aclaración parecería un error. */}
        <StatsCard
          title="Propiedades activas"
          value={activePropertiesCount ?? 0}
          icon={<Home size={20} />}
          description="Cargadas, incluso las ocultas al público"
        />
        <StatsCard
          title="Leads"
          value={leadsMonthCount ?? 0}
          icon={<Inbox size={20} />}
          description="Últimos 30 días"
        />
      </div>

      {/* Zona de gestión: el listado de agencias, la aprobación y la activación
          de planes. */}
      <h2 className="font-serif text-2xl font-semibold text-black mb-2">
        Agencias
      </h2>
      <p className="font-sans text-sm text-graphite mb-6">
        Todas las agencias de la plataforma. Aprobá o rechazá las que están
        pendientes, y activá los planes pagos que esperan confirmación.
      </p>

      <AgenciesTable rows={rows} />
    </div>
  );
}
