import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agency, Agent } from "@/types";

// Resolución del estado de sesión del ÁREA PRIVADA en un solo lugar: el usuario
// autenticado, su fila de `agents` y los datos de su agencia.
//
// POR QUÉ EXISTE: esta consulta estaba repetida en ~20 páginas y actions, con
// cinco formas distintas del mismo `select` y cuatro comportamientos distintos
// ante "hay sesión pero no hay fila en agents". Esa dispersión es la que produjo
// el bucle de redirecciones (ver `requireAgentSession` abajo): cada lugar
// decidía por su cuenta, y ninguno cerraba la sesión.
//
// SERVER-ONLY: crea su propio client de servidor y lee cookies. Nunca importar
// desde un Client Component.

// Datos del agente que necesita el área privada. Derivados de Agent, no
// redefinidos: si el tipo del dominio cambia, esto se entera.
export type SessionAgent = Pick<
  Agent,
  "id" | "full_name" | "phone_wa" | "avatar_url" | "role" | "agency_id"
>;

// Datos de la agencia que necesita el área privada.
// `approval_status` y `license_number` todavía no los consume ninguna pantalla:
// se traen acá porque el alta manual de agencias los va a necesitar en TODAS, y
// este helper es el único lugar que ya consulta una vez por navegación. Sumarlos
// al select existente no cuesta un viaje extra.
export type SessionAgency = Pick<
  Agency,
  "id" | "name" | "approval_status" | "license_number"
>;

// Los TRES estados posibles, como unión discriminada (mismo patrón que
// AgencyResolution en resolveAgencyBySlug):
//   - no_session : no hay usuario autenticado.
//   - unlinked   : hay sesión válida, pero no resuelve la fila de `agents` o la
//                  de su agencia. Es una cuenta huérfana: la sesión sirve, pero
//                  no está asociada a ninguna inmobiliaria.
//   - ok         : todo resuelto.
//
// No colapsar `unlinked` en `no_session`: son cosas distintas y el destino
// correcto de cada una también lo es (ver requireAgentSession).
export type AgentSession =
  | { status: "no_session" }
  | { status: "unlinked"; userId: string }
  | {
      status: "ok";
      userId: string;
      agent: SessionAgent;
      agency: SessionAgency;
    };

// Fila cruda del select. El embed to-one de PostgREST puede materializarse como
// objeto o como array de uno, según la inferencia: lo normalizamos.
type AgentRow = SessionAgent & {
  agency: SessionAgency | SessionAgency[] | null;
};

function firstOf<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

// Resuelve la sesión del área privada. Envuelto en `cache()` de React: dentro de
// un mismo request, el layout y la página que cuelga de él comparten UNA sola
// consulta, aunque las dos llamen a este helper. Por eso NO recibe el client de
// Supabase como parámetro (a diferencia de getPlanUsage): `cache()` desduplica
// por argumentos, y un client distinto por llamador rompería la deduplicación.
export const resolveAgentSession = cache(async (): Promise<AgentSession> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "no_session" };

  // Un solo select que cubre lo que antes pedían las cinco variantes sueltas
  // (nombre y avatar para el sidebar y el perfil, teléfono para el perfil, rol y
  // agencia para el gating) más los datos de agencia del alta manual.
  const { data } = await supabase
    .from("agents")
    .select(
      "id, full_name, phone_wa, avatar_url, role, agency_id, agency:agencies(id, name, approval_status, license_number)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return { status: "unlinked", userId: user.id };

  const row = data as unknown as AgentRow;
  const agency = firstOf(row.agency);

  // Sin agencia resoluble la cuenta tampoco sirve: `agents.agency_id` es NOT
  // NULL, así que llegar acá significa que la agencia se borró por debajo.
  if (!agency) return { status: "unlinked", userId: user.id };

  return {
    status: "ok",
    userId: user.id,
    agent: {
      id: row.id,
      full_name: row.full_name,
      phone_wa: row.phone_wa,
      avatar_url: row.avatar_url,
      role: row.role,
      agency_id: row.agency_id,
    },
    agency,
  };
});

// Variante para PÁGINAS Y LAYOUTS: resuelve o corta con un redirect.
//
// ⚠ ACÁ ESTÁ EL ARREGLO DEL BUCLE DE REDIRECCIONES. Los dos cortes NO van al
// mismo lugar, y esa diferencia es todo el arreglo:
//
//   - Sin sesión → /login. Correcto y sin ciclo: `proxy.ts` solo rebota /login
//     hacia /dashboard cuando HAY sesión.
//   - Con sesión pero sin agencia (unlinked) → /logout, que cierra la sesión y
//     recién después manda al login con el motivo. Antes esto iba directo a
//     /login, y como la sesión seguía viva el proxy lo devolvía a /dashboard,
//     que volvía a cortar a /login… hasta que el navegador mataba la cadena de
//     307. Cerrar la sesión rompe la premisa del proxy y el ciclo no se arma.
//     No se puede hacer el signOut acá: un Server Component no puede escribir
//     cookies (ver el catch de lib/supabase/server.ts), por eso se delega en el
//     route handler /logout.
export async function requireAgentSession(): Promise<
  Extract<AgentSession, { status: "ok" }>
> {
  const session = await resolveAgentSession();

  if (session.status === "no_session") redirect("/login");
  if (session.status === "unlinked") redirect("/logout?reason=no_agency");

  return session;
}
