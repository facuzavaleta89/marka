"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle2 } from "lucide-react";
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
import { PLANS, type SubscriptionPlan, type TenantType } from "@/types";
import { activatePlanAction } from "./actions";

// ─── Tipos ───────────────────────────────────────────────────

// Fila del listado de pendientes. La agencia viene embebida desde la query
// (subscriptions → agencies). El plan es el elegido (pending, nunca 'free').
export interface PendingRow {
  agency_id: string;
  plan: SubscriptionPlan;
  agency: {
    name: string;
    slug: string;
    tenant_type: TenantType;
  } | null;
}

interface PendingAgenciesTableProps {
  rows: PendingRow[];
}

// ─── Sub-componentes ──────────────────────────────────────────

function PendingBadge() {
  return (
    <span className="inline-block font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm px-2 py-0.5 bg-mist text-graphite">
      Pendiente
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

// ─── Componente principal ─────────────────────────────────────

export function PendingAgenciesTable({ rows }: PendingAgenciesTableProps) {
  const router = useRouter();
  const [toActivate, setToActivate] = useState<PendingRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
        // La fila ya no está pending → refrescar el server component.
        router.refresh();
      }
    });
  };

  if (rows.length === 0) {
    return (
      <div className="bg-paper border border-stone rounded-lg px-6 py-16 text-center">
        <p className="font-sans text-base text-graphite">
          No hay planes pendientes de activación.
        </p>
      </div>
    );
  }

  return (
    <>
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

      {/* ── Tabla (desktop) ── */}
      <div className="hidden md:block bg-paper border border-stone rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone">
              {["Agencia", "Plan elegido", "Precio", "Límite", "Estado", ""].map(
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
            {rows.map((row) => {
              const loading = pendingId === row.agency_id;
              const plan = PLANS[row.plan];
              return (
                <tr
                  key={row.agency_id}
                  className={`transition-colors ${loading ? "opacity-50" : "hover:bg-mist/40"}`}
                >
                  {/* Agencia */}
                  <td className="px-5 py-3 max-w-[240px]">
                    <span className="font-sans text-sm font-medium text-black line-clamp-2">
                      {row.agency?.name ?? "—"}
                    </span>
                  </td>

                  {/* Plan elegido */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-serif text-base font-semibold text-black">
                      {plan.name}
                    </span>
                  </td>

                  {/* Precio */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-sans text-sm text-graphite">
                      {plan.priceLabel}
                    </span>
                  </td>

                  {/* Límite al activar */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-sans text-sm text-graphite">
                      {plan.propertyLimit === 1
                        ? "1 propiedad"
                        : `${plan.propertyLimit} propiedades`}
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <PendingBadge />
                  </td>

                  {/* Acción */}
                  <td className="px-5 py-3 text-right">
                    <ActivateButton
                      loading={loading}
                      onClick={() => setToActivate(row)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Cards (mobile) ── */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => {
          const loading = pendingId === row.agency_id;
          const plan = PLANS[row.plan];
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
                    Plan {plan.name} · {plan.priceLabel}
                  </p>
                  <p className="font-sans text-xs text-graphite mt-0.5">
                    {plan.propertyLimit === 1
                      ? "1 propiedad"
                      : `${plan.propertyLimit} propiedades`}{" "}
                    al activar
                  </p>
                </div>
                <PendingBadge />
              </div>
              <div className="mt-3 pt-3 border-t border-stone flex justify-end">
                <ActivateButton
                  loading={loading}
                  onClick={() => setToActivate(row)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* AlertDialog de confirmación antes de activar */}
      <AlertDialog
        open={!!toActivate}
        onOpenChange={(open) => !open && setToActivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Activar plan {toActivate ? PLANS[toActivate.plan].name : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a activar el plan{" "}
              <strong className="text-black">
                {toActivate ? PLANS[toActivate.plan].name : ""}
              </strong>{" "}
              para{" "}
              <strong className="text-black">
                &quot;{toActivate?.agency?.name ?? "—"}&quot;
              </strong>
              . La agencia pasará a tener sus límites y beneficios reales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toActivate && handleActivate(toActivate.agency_id)
              }
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
