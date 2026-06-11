"use client";

import { MessageSquare, User, Calendar } from "lucide-react";
import type { Agent, Property } from "@/types";

// ─── Tipos ───────────────────────────────────────────────────

// Fila de la tabla de consultas: lo que la página le pasa al componente.
// agent puede ser null (lead de una propiedad sin agente asignado).
export type LeadRow = {
  id: string;
  contact_name: string;
  created_at: string;
  source: string;
  agent: Pick<Agent, "id" | "full_name"> | null;
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
                    {l.agent ? (
                      <span className="font-sans text-sm text-graphite">
                        {l.agent.full_name}
                      </span>
                    ) : (
                      <span className="font-sans text-sm italic text-stone">
                        Sin agente asignado
                      </span>
                    )}
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
                {l.agent ? (
                  l.agent.full_name
                ) : (
                  <span className="italic text-stone">Sin agente asignado</span>
                )}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
