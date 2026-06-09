"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PLANS,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type TenantType,
} from "@/types";
import { activatePlanAction } from "./actions";

// Override del Checkbox de shadcn a terracota en estado marcado (mismo patrón
// que FilterPanel/PropertyForm, para consistencia en toda la app).
const CHECKBOX_TERRACOTA =
  "border-stone data-[state=checked]:bg-terracota data-[state=checked]:border-terracota data-[state=checked]:text-paper";

// ─── Tipos ───────────────────────────────────────────────────

// Fila del listado de agencias. La agencia viene embebida desde la query
// (subscriptions → agencies). El panel lista TODAS las agencias.
export interface AgencyRow {
  agency_id: string;
  plan: SubscriptionPlan; // el plan que RIGE hoy
  pending_plan: SubscriptionPlan | null; // plan pago pedido, esperando activación
  status: SubscriptionStatus;
  activated_at: string | null;
  agency: {
    name: string;
    slug: string;
    tenant_type: TenantType;
  } | null;
}

interface AgenciesTableProps {
  rows: AgencyRow[];
}

// Categorías mutuamente excluyentes del filtro aditivo. Cada agencia cae en una.
type Category = "pending" | "paidActive" | "free";

const FILTERS: { key: Category; label: string }[] = [
  { key: "pending", label: "Pendientes" },
  { key: "paidActive", label: "Pagas activas" },
  { key: "free", label: "Free" },
];

// ─── Helpers ──────────────────────────────────────────────────

// Categoría de una fila. null = no cae en ninguna de las tres (ej. estados
// past_due/canceled fuera de alcance v1): no se muestra bajo ningún filtro.
function categoryOf(row: AgencyRow): Category | null {
  if (row.status === "pending") return "pending";
  if (row.status === "active" && row.plan !== "free") return "paidActive";
  if (row.plan === "free") return "free";
  return null;
}

// "9 jun 2026" o "—" si no hay fecha de activación.
function formatActivatedAt(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TENANT_LABELS: Record<TenantType, string> = {
  agency: "Inmobiliaria",
  individual: "Particular",
};

// ─── Sub-componentes ──────────────────────────────────────────

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  // Solo se muestran filas pending o active (las tres categorías); el resto del
  // mapa cubre por completitud, con tratamiento neutro.
  const map: Record<SubscriptionStatus, { label: string; className: string }> = {
    pending: { label: "Pendiente", className: "bg-mist text-graphite" },
    active: { label: "Activa", className: "bg-success/10 text-success" },
    past_due: { label: "Vencida", className: "bg-stone text-graphite" },
    canceled: { label: "Cancelada", className: "bg-stone text-graphite" },
  };
  const { label, className } = map[status];
  return (
    <span
      className={`inline-block font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm px-2 py-0.5 ${className}`}
    >
      {label}
    </span>
  );
}

function ActivateButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-40"
    >
      <CheckCircle2 size={14} />
      Activar
    </button>
  );
}

function limitLabel(plan: SubscriptionPlan): string {
  const n = PLANS[plan].propertyLimit;
  return n === 1 ? "1 propiedad" : `${n} propiedades`;
}

// ─── Componente principal ─────────────────────────────────────

export function AgenciesTable({ rows }: AgenciesTableProps) {
  const router = useRouter();
  const [toActivate, setToActivate] = useState<AgencyRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Filtros aditivos (OR). Por default las tres marcadas: se ve todo.
  const [active, setActive] = useState<Record<Category, boolean>>({
    pending: true,
    paidActive: true,
    free: true,
  });

  const toggle = (key: Category) =>
    setActive((prev) => ({ ...prev, [key]: !prev[key] }));

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      const cat = categoryOf(row);
      return cat !== null && active[cat];
    });
  }, [rows, active]);

  const handleActivate = (agencyId: string) => {
    setToActivate(null);
    setPendingId(agencyId);
    setError(null);
    startTransition(async () => {
      const result = await activatePlanAction(agencyId);
      setPendingId(null);
      if (result?.error) {
        setError(result.error);
      } else {
        // La fila pasó de pending a active → refrescar el server component.
        router.refresh();
      }
    });
  };

  return (
    <>
      {/* Barra de filtros aditivos */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {FILTERS.map(({ key, label }) => (
          <label
            key={key}
            htmlFor={`filter-${key}`}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Checkbox
              id={`filter-${key}`}
              checked={active[key]}
              onCheckedChange={() => toggle(key)}
              className={CHECKBOX_TERRACOTA}
            />
            <span className="font-sans text-sm text-black">{label}</span>
          </label>
        ))}
      </div>

      {/* Banner de error */}
      {error && (
        <div className="mb-4 flex items-start gap-3 bg-terracota-subtle border border-terracota/20 rounded-md px-4 py-3">
          <p className="flex-1 font-sans text-sm text-error">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-graphite hover:text-black shrink-0"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {visibleRows.length === 0 ? (
        <div className="bg-paper border border-stone rounded-lg px-6 py-16 text-center">
          <p className="font-sans text-base text-graphite">
            No hay agencias para los filtros seleccionados.
          </p>
        </div>
      ) : (
        <>
          {/* ── Tabla (desktop) ── */}
          <div className="hidden md:block bg-paper border border-stone rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone">
                  {[
                    "Agencia",
                    "Tipo",
                    "Plan",
                    "Pidió",
                    "Estado",
                    "Límite",
                    "Activación",
                    "",
                  ].map((col) => (
                    <th
                      key={col}
                      className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite text-left px-4 py-3 first:pl-5 last:pr-5"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {visibleRows.map((row) => {
                  const loading = pendingId === row.agency_id;
                  const plan = PLANS[row.plan];
                  const hasPending = row.pending_plan !== null;
                  return (
                    <tr
                      key={row.agency_id}
                      className={`transition-colors ${loading ? "opacity-50" : "hover:bg-mist/40"}`}
                    >
                      {/* Agencia */}
                      <td className="px-5 py-3 max-w-[220px]">
                        <span className="font-sans text-sm font-medium text-black line-clamp-2">
                          {row.agency?.name ?? "—"}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-sans text-sm text-graphite">
                          {row.agency
                            ? TENANT_LABELS[row.agency.tenant_type]
                            : "—"}
                        </span>
                      </td>

                      {/* Plan que rige */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-serif text-base font-semibold text-black">
                          {plan.name}
                        </span>
                      </td>

                      {/* Pidió (pending_plan) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.pending_plan ? (
                          <span className="font-sans text-sm font-medium text-terracota">
                            {PLANS[row.pending_plan].name}
                          </span>
                        ) : (
                          <span className="font-sans text-sm text-stone">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>

                      {/* Límite efectivo (del plan que rige) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-sans text-sm text-graphite">
                          {limitLabel(row.plan)}
                        </span>
                      </td>

                      {/* Activación */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-sans text-sm text-graphite tabular-nums">
                          {formatActivatedAt(row.activated_at)}
                        </span>
                      </td>

                      {/* Acción: Activar solo si hay un plan pedido */}
                      <td className="px-5 py-3 text-right">
                        {hasPending && (
                          <ActivateButton
                            loading={loading}
                            onClick={() => setToActivate(row)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Cards (mobile) ── */}
          <div className="md:hidden space-y-3">
            {visibleRows.map((row) => {
              const loading = pendingId === row.agency_id;
              const plan = PLANS[row.plan];
              const hasPending = row.pending_plan !== null;
              return (
                <div
                  key={row.agency_id}
                  className={`bg-paper border border-stone rounded-lg p-4 transition-opacity ${loading ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-medium text-black truncate">
                        {row.agency?.name ?? "—"}
                      </p>
                      <p className="font-sans text-xs text-graphite mt-0.5">
                        {row.agency
                          ? TENANT_LABELS[row.agency.tenant_type]
                          : "—"}{" "}
                        · Plan {plan.name} · {limitLabel(row.plan)}
                      </p>
                      {row.pending_plan && (
                        <p className="font-sans text-xs text-terracota mt-0.5 font-medium">
                          Pidió {PLANS[row.pending_plan].name}
                        </p>
                      )}
                      <p className="font-sans text-xs text-graphite mt-0.5 tabular-nums">
                        Activación: {formatActivatedAt(row.activated_at)}
                      </p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  {hasPending && (
                    <div className="mt-3 pt-3 border-t border-stone flex justify-end">
                      <ActivateButton
                        loading={loading}
                        onClick={() => setToActivate(row)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* AlertDialog de confirmación antes de activar */}
      <AlertDialog
        open={!!toActivate}
        onOpenChange={(open) => !open && setToActivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Activar plan{" "}
              {toActivate?.pending_plan
                ? PLANS[toActivate.pending_plan].name
                : ""}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a activar el plan{" "}
              <strong className="text-black">
                {toActivate?.pending_plan
                  ? PLANS[toActivate.pending_plan].name
                  : ""}
              </strong>{" "}
              para{" "}
              <strong className="text-black">
                &quot;{toActivate?.agency?.name ?? "—"}&quot;
              </strong>
              . El plan pedido pasará a regir, con sus límites y beneficios reales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toActivate && handleActivate(toActivate.agency_id)}
              className="bg-terracota text-paper hover:bg-terracota-hover border-0"
            >
              Activar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
