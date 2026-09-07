"use client";

import { MessageSquare, User, Calendar } from "lucide-react";
import type { Agent, Property } from "@/types";

// ─── Tipos ───────────────────────────────────────────────────

// Fila de la tabla de consultas: lo que la página le pasa al componente.
// agent es null cuando el agente que la atendió se fue de la agencia
// (leads.agent_id quedó en NULL por el ON DELETE SET NULL de su FK). En ese caso
// el nombre sale de agent_name, la copia congelada que guardó la base.
export type LeadRow = {
  id: string;
  contact_name: string;
  created_at: string;
  source: string;
  agent: Pick<Agent, "id" | "full_name"> | null;
  /** Copia CONGELADA del nombre del agente al momento de la consulta. */
  agent_name: string | null;
  property: Pick<Property, "id" | "title" | "slug"> | null;
};

interface LeadsContentProps {
  leads: LeadRow[];
  // Solo el admin de agencia ve la columna "Agente" (a un agente normal no le
  // aporta: todas las consultas son suyas).
  isAgencyAdmin: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────

// "10 jun 2026"
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Quién atendió la consulta ────────────────────────────────

// Tres casos, en orden de preferencia. Vive en UN solo lugar a propósito: la
// tabla de escritorio y las tarjetas de celular tienen que decidir lo mismo. El
// precedente de por qué importa está en AgenciesTable, donde esta misma clase de
// condición estaba escrita dos veces y las dos copias se desincronizaron.
//
// Devuelve SIEMPRE un solo elemento, así funciona igual dentro del <td> de la
// tabla (flujo inline) y dentro del <p class="flex"> de la tarjeta (un flex item).
function AgentCell({
  agent,
  agentName,
}: {
  agent: LeadRow["agent"];
  agentName: string | null;
}) {
  // 1) El agente sigue en la agencia → su nombre ACTUAL (el de la fila viva, no
  // la copia congelada: si se corrigió el nombre, lo que vale es el de hoy).
  if (agent) {
    return (
      <span className="font-sans text-sm text-graphite">{agent.full_name}</span>
    );
  }

  // 2) El agente se fue, pero la base guardó cómo se llamaba cuando atendió esta
  // consulta. Se muestra el nombre + un badge que lo distingue de un agente
  // activo: son dos situaciones distintas y no pueden leerse igual. El badge usa
  // el tratamiento de "estado cerrado" de DESIGN §6 (fondo stone, texto
  // graphite), el mismo de las propiedades vendidas/alquiladas.
  if (agentName) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-sans text-sm text-graphite">{agentName}</span>
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm bg-stone px-2 py-0.5 text-graphite whitespace-nowrap">
          Ya no está
        </span>
      </span>
    );
  }

  // 3) Último recurso: consultas anteriores a la migración que quedaron sin la
  // copia del nombre. Hoy no hay ninguna, pero el caso es representable.
  return (
    <span className="font-sans text-sm italic text-stone">
      Sin agente asignado
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────

export function LeadsContent({ leads, isAgencyAdmin }: LeadsContentProps) {
  if (leads.length === 0) {
    return (
      <div className="bg-paper border border-stone rounded-lg px-6 py-16 text-center">
        <p className="font-sans text-base text-graphite">
          Todavía no hay consultas.
        </p>
        <p className="font-sans text-sm text-graphite/80 mt-1">
          Cuando alguien contacte por WhatsApp desde el mapa, vas a verlo acá.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Tabla (desktop) ── */}
      <div className="hidden md:block bg-paper border border-stone rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone">
              {["Contacto", "Propiedad", "Fecha", ...(isAgencyAdmin ? ["Agente"] : [])].map(
                (col) => (
                  <th
                    key={col}
                    className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite text-left px-4 py-3 first:pl-5 last:pr-5"
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {leads.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-mist/40">
                {/* Contacto */}
                <td className="px-5 py-3">
                  <span className="font-sans text-sm font-medium text-black">
                    {l.contact_name}
                  </span>
                </td>

                {/* Propiedad */}
                <td className="px-4 py-3 max-w-[260px]">
                  <span className="font-sans text-sm text-graphite line-clamp-1">
                    {l.property?.title ?? "—"}
                  </span>
                </td>

                {/* Fecha */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-sans text-sm text-graphite tabular-nums">
                    {formatDate(l.created_at)}
                  </span>
                </td>

                {/* Agente (solo admin) */}
                {isAgencyAdmin && (
                  <td className="px-5 py-3 whitespace-nowrap">
                    <AgentCell agent={l.agent} agentName={l.agent_name} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Cards (mobile) ── */}
      <div className="md:hidden space-y-3">
        {leads.map((l) => (
          <div key={l.id} className="bg-paper border border-stone rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-sans text-sm font-medium text-black">
                {l.contact_name}
              </p>
              <span className="font-sans text-xs text-graphite tabular-nums shrink-0 flex items-center gap-1.5">
                <Calendar size={13} />
                {formatDate(l.created_at)}
              </span>
            </div>

            <p className="mt-2 flex items-start gap-2 font-sans text-sm text-graphite">
              <MessageSquare size={14} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2">{l.property?.title ?? "—"}</span>
            </p>

            {isAgencyAdmin && (
              <p className="mt-2 pt-2 border-t border-stone flex items-center gap-2 font-sans text-sm text-graphite">
                <User size={14} className="shrink-0" />
                <AgentCell agent={l.agent} agentName={l.agent_name} />
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
