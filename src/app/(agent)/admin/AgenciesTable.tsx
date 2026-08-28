"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle2, ShieldCheck, ShieldX, Undo2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  REJECTION_NOTE_MAX,
  type ApprovalStatus,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "@/types";
import { APPROVAL_STATUS_LABELS } from "@/lib/utils/labels";
import {
  activatePlanAction,
  approveAgencyAction,
  rejectAgencyAction,
  reopenAgencyAction,
} from "./actions";

// Override del Checkbox de shadcn a terracota en estado marcado (mismo patrón
// que FilterPanel/PropertyForm, para consistencia en toda la app).
const CHECKBOX_TERRACOTA =
  "border-stone data-[state=checked]:bg-terracota data-[state=checked]:border-terracota data-[state=checked]:text-paper";

// ─── Tipos ───────────────────────────────────────────────────

// Suscripción de una agencia tal como la muestra el panel. Es OPCIONAL en la
// fila: la lista parte de `agencies`, así que una agencia puede no tener fila de
// suscripción todavía (ver page.tsx).
export interface AgencySubscription {
  plan: SubscriptionPlan; // el plan que RIGE hoy
  pending_plan: SubscriptionPlan | null; // plan pago pedido, esperando activación
  status: SubscriptionStatus;
  activated_at: string | null;
}

// Fila del listado de agencias. La agencia es la entidad principal (la query
// parte de ella); la suscripción viene embebida y puede faltar.
export interface AgencyRow {
  agency_id: string;
  name: string;
  slug: string;
  license_number: string | null;
  approval_status: ApprovalStatus;
  city_name: string | null;
  subscription: AgencySubscription | null;
}

interface AgenciesTableProps {
  rows: AgencyRow[];
}

// ─── Filtros: DOS ejes independientes ────────────────────────
// Eje 1: situación de suscripción ("¿paga?"). Eje 2: aprobación ("¿es legítima?").
// Una fila se muestra si pasa LOS DOS. No mezclar los ejes en una sola
// clasificación: son preguntas distintas sobre la misma agencia.

// Categorías del eje de suscripción. Son mutuamente excluyentes y CUBREN TODOS
// LOS CASOS: la categoría "other" es el cajón de sastre (sin fila de
// suscripción, o estados past_due/canceled). Antes esos casos devolvían null y
// la fila desaparecía del listado aunque estuvieran todos los filtros marcados;
// con "other" eso ya no puede pasar.
type PlanCategory = "pendingPlan" | "paidActive" | "free" | "other";

const PLAN_FILTERS: { key: PlanCategory; label: string }[] = [
  { key: "pendingPlan", label: "Plan pendiente" },
  { key: "paidActive", label: "Pagas activas" },
  { key: "free", label: "Free" },
  { key: "other", label: "Otras" },
];

const APPROVAL_FILTERS: { key: ApprovalStatus; label: string }[] = [
  { key: "pending", label: APPROVAL_STATUS_LABELS.pending },
  { key: "approved", label: APPROVAL_STATUS_LABELS.approved },
  { key: "rejected", label: APPROVAL_STATUS_LABELS.rejected },
];

// ─── Helpers ──────────────────────────────────────────────────

// Categoría de suscripción de una fila. SIEMPRE devuelve una categoría (nunca
// null): la última rama absorbe lo que no encaja en las tres primeras.
function planCategoryOf(row: AgencyRow): PlanCategory {
  const sub = row.subscription;
  if (!sub) return "other";
  if (sub.status === "pending") return "pendingPlan";
  if (sub.status === "active" && sub.plan !== "free") return "paidActive";
  if (sub.status === "active" && sub.plan === "free") return "free";
  return "other"; // past_due / canceled
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

// ─── Sub-componentes ──────────────────────────────────────────

function SubscriptionStatusBadge({ sub }: { sub: AgencySubscription | null }) {
  // Sin fila de suscripción no hay estado que mostrar: se dice explícitamente,
  // no se deja un hueco (ni un "undefined").
  if (!sub) {
    return (
      <span className="inline-block font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm px-2 py-0.5 bg-stone text-graphite">
        Sin plan
      </span>
    );
  }
  const map: Record<SubscriptionStatus, { label: string; className: string }> = {
    pending: { label: "Pendiente", className: "bg-mist text-graphite" },
    active: { label: "Activa", className: "bg-success/10 text-success" },
    past_due: { label: "Vencida", className: "bg-stone text-graphite" },
    canceled: { label: "Cancelada", className: "bg-stone text-graphite" },
  };
  const { label, className } = map[sub.status];
  return (
    <span
      className={`inline-block font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm px-2 py-0.5 ${className}`}
    >
      {label}
    </span>
  );
}

// Badge del eje de aprobación. Tratamiento visual distinto del de suscripción a
// propósito: son dos ejes y no deben leerse como lo mismo.
function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const className: Record<ApprovalStatus, string> = {
    pending: "bg-terracota-subtle text-terracota",
    approved: "bg-success/10 text-success",
    rejected: "bg-error/10 text-error",
  };
  return (
    <span
      className={`inline-block font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm px-2 py-0.5 ${className[status]}`}
    >
      {APPROVAL_STATUS_LABELS[status]}
    </span>
  );
}

// Botón de acción de la fila. Variantes según el peso de la acción (DESIGN §6):
// primary = terracota (la acción principal), secondary = borde stone,
// destructive = borde y texto en error.
type RowButtonVariant = "primary" | "secondary" | "destructive";

const ROW_BUTTON_STYLES: Record<RowButtonVariant, string> = {
  primary: "bg-terracota hover:bg-terracota-hover text-paper border-0",
  secondary:
    "bg-transparent border border-stone text-graphite hover:bg-mist hover:text-black",
  destructive:
    "bg-transparent border border-error text-error hover:bg-terracota-subtle",
};

function RowButton({
  variant,
  loading,
  onClick,
  icon,
  children,
}: {
  variant: RowButtonVariant;
  loading: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md font-sans text-sm font-medium transition-colors duration-[120ms] disabled:opacity-40 ${ROW_BUTTON_STYLES[variant]}`}
    >
      {icon}
      {children}
    </button>
  );
}

function limitLabel(plan: SubscriptionPlan): string {
  const n = PLANS[plan].propertyLimit;
  return n === 1 ? "1 propiedad" : `${n} propiedades`;
}

// Acciones disponibles para una fila, en una sola pieza reusada por la tabla
// (desktop) y por las cards (mobile). Se apilan verticalmente en la celda para
// que no queden tres botones apretados en una columna angosta (DESIGN §4: el
// aire es parte del diseño); en mobile van en fila, que hay ancho de sobra.
function RowActions({
  row,
  loading,
  layout,
  onApprove,
  onReject,
  onReopen,
  onActivate,
}: {
  row: AgencyRow;
  loading: boolean;
  layout: "stacked" | "inline";
  onApprove: () => void;
  onReject: () => void;
  onReopen: () => void;
  onActivate: () => void;
}) {
  const hasPendingPlan = row.subscription?.pending_plan != null;
  const wrapper =
    layout === "stacked"
      ? "flex flex-col items-end gap-2"
      : "flex flex-wrap justify-end gap-2";

  return (
    <div className={wrapper}>
      {/* Eje de aprobación */}
      {row.approval_status === "pending" && (
        <>
          <RowButton
            variant="primary"
            loading={loading}
            onClick={onApprove}
            icon={<ShieldCheck size={14} />}
          >
            Aprobar
          </RowButton>
          <RowButton
            variant="destructive"
            loading={loading}
            onClick={onReject}
            icon={<ShieldX size={14} />}
          >
            Rechazar
          </RowButton>
        </>
      )}
      {/* El rechazo no es definitivo: el dueño puede devolverla a pendiente. */}
      {row.approval_status === "rejected" && (
        <RowButton
          variant="secondary"
          loading={loading}
          onClick={onReopen}
          icon={<Undo2 size={14} />}
        >
          Volver a pendiente
        </RowButton>
      )}
      {/* Eje de suscripción (independiente del anterior) */}
      {hasPendingPlan && (
        <RowButton
          variant="primary"
          loading={loading}
          onClick={onActivate}
          icon={<CheckCircle2 size={14} />}
        >
          Activar plan
        </RowButton>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────

export function AgenciesTable({ rows }: AgenciesTableProps) {
  const router = useRouter();
  const [toActivate, setToActivate] = useState<AgencyRow | null>(null);
  const [toApprove, setToApprove] = useState<AgencyRow | null>(null);
  const [toReopen, setToReopen] = useState<AgencyRow | null>(null);
  // Rechazo: no es una confirmación sí/no sino un formulario (pide el motivo),
  // así que se resuelve con un panel inline y no con el AlertDialog. Ver informe.
  const [toReject, setToReject] = useState<AgencyRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Eje 1 (suscripción) y eje 2 (aprobación). Las cuatro/tres marcadas por
  // default: se ve todo. Como planCategoryOf() cubre todos los casos y
  // approval_status es NOT NULL en la base, con todo marcado NINGUNA fila puede
  // quedar oculta.
  const [activePlan, setActivePlan] = useState<Record<PlanCategory, boolean>>({
    pendingPlan: true,
    paidActive: true,
    free: true,
    other: true,
  });
  const [activeApproval, setActiveApproval] = useState<
    Record<ApprovalStatus, boolean>
  >({
    pending: true,
    approved: true,
    rejected: true,
  });

  const visibleRows = useMemo(() => {
    return rows.filter(
      (row) =>
        activePlan[planCategoryOf(row)] && activeApproval[row.approval_status]
    );
  }, [rows, activePlan, activeApproval]);

  // Envuelve una server action: marca la fila como cargando, muestra el error si
  // lo hay, y refresca el server component si salió bien. Mismo contrato que ya
  // usaba la activación de planes (la action devuelve { error } o undefined).
  const run = (
    agencyId: string,
    action: () => Promise<{ error: string } | undefined>
  ) => {
    setPendingId(agencyId);
    setError(null);
    startTransition(async () => {
      const result = await action();
      setPendingId(null);
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <>
      {/* Barra de filtros: dos ejes separados visualmente para que se lea que
          son preguntas distintas. Dentro de cada eje, las cajas son aditivas (OR). */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
            Aprobación
          </span>
          {APPROVAL_FILTERS.map(({ key, label }) => (
            <label
              key={key}
              htmlFor={`filter-approval-${key}`}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                id={`filter-approval-${key}`}
                checked={activeApproval[key]}
                onCheckedChange={() =>
                  setActiveApproval((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                className={CHECKBOX_TERRACOTA}
              />
              <span className="font-sans text-sm text-black">{label}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
            Suscripción
          </span>
          {PLAN_FILTERS.map(({ key, label }) => (
            <label
              key={key}
              htmlFor={`filter-plan-${key}`}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                id={`filter-plan-${key}`}
                checked={activePlan[key]}
                onCheckedChange={() =>
                  setActivePlan((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                className={CHECKBOX_TERRACOTA}
              />
              <span className="font-sans text-sm text-black">{label}</span>
            </label>
          ))}
        </div>
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

      {/* Formulario de rechazo (panel inline, no diálogo: pide un texto) */}
      {toReject && (
        <RejectPanel
          row={toReject}
          loading={pendingId === toReject.agency_id}
          onCancel={() => setToReject(null)}
          onConfirm={(note) => {
            const target = toReject;
            setToReject(null);
            run(target.agency_id, () =>
              rejectAgencyAction({ agencyId: target.agency_id, note })
            );
          }}
        />
      )}

      {visibleRows.length === 0 ? (
        <div className="bg-paper border border-stone rounded-lg px-6 py-16 text-center">
          <p className="font-sans text-base text-graphite">
            No hay agencias para los filtros seleccionados.
          </p>
        </div>
      ) : (
        <>
          {/* ── Tabla (desktop) ──
              overflow-x-auto (antes overflow-hidden): con más columnas la tabla
              scrollea en vez de recortar contenido. */}
          <div className="hidden md:block bg-paper border border-stone rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone">
                  {[
                    "Agencia",
                    "Matrícula",
                    "Aprobación",
                    "Plan",
                    "Pidió",
                    "Estado",
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
                  const sub = row.subscription;
                  return (
                    <tr
                      key={row.agency_id}
                      className={`transition-colors ${loading ? "opacity-50" : "hover:bg-mist/40"}`}
                    >
                      {/* Agencia (+ ciudad como metadato secundario) */}
                      <td className="px-5 py-3 max-w-[220px]">
                        <span className="block font-sans text-sm font-medium text-black line-clamp-2">
                          {row.name}
                        </span>
                        {row.city_name && (
                          <span className="block font-sans text-xs text-graphite mt-0.5">
                            {row.city_name}
                          </span>
                        )}
                      </td>

                      {/* Matrícula */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.license_number ? (
                          <span className="font-sans text-sm text-black tabular-nums">
                            {row.license_number}
                          </span>
                        ) : (
                          <span className="font-sans text-sm text-stone">—</span>
                        )}
                      </td>

                      {/* Aprobación */}
                      <td className="px-4 py-3">
                        <ApprovalBadge status={row.approval_status} />
                      </td>

                      {/* Plan que rige */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {sub ? (
                          <span className="font-serif text-base font-semibold text-black">
                            {PLANS[sub.plan].name}
                          </span>
                        ) : (
                          <span className="font-sans text-sm text-stone">—</span>
                        )}
                      </td>

                      {/* Pidió (pending_plan) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {sub?.pending_plan ? (
                          <span className="font-sans text-sm font-medium text-terracota">
                            {PLANS[sub.pending_plan].name}
                          </span>
                        ) : (
                          <span className="font-sans text-sm text-stone">—</span>
                        )}
                      </td>

                      {/* Estado de la suscripción */}
                      <td className="px-4 py-3">
                        <SubscriptionStatusBadge sub={sub} />
                      </td>

                      {/* Activación */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-sans text-sm text-graphite tabular-nums">
                          {formatActivatedAt(sub?.activated_at ?? null)}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-3 text-right">
                        <RowActions
                          row={row}
                          loading={loading}
                          layout="stacked"
                          onApprove={() => setToApprove(row)}
                          onReject={() => setToReject(row)}
                          onReopen={() => setToReopen(row)}
                          onActivate={() => setToActivate(row)}
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
            {visibleRows.map((row) => {
              const loading = pendingId === row.agency_id;
              const sub = row.subscription;
              return (
                <div
                  key={row.agency_id}
                  className={`bg-paper border border-stone rounded-lg p-4 transition-opacity ${loading ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-medium text-black truncate">
                        {row.name}
                      </p>
                      <p className="font-sans text-xs text-graphite mt-0.5">
                        Matrícula: {row.license_number ?? "—"}
                        {row.city_name ? ` · ${row.city_name}` : ""}
                      </p>
                      <p className="font-sans text-xs text-graphite mt-0.5">
                        {sub
                          ? `Plan ${PLANS[sub.plan].name} · ${limitLabel(sub.plan)}`
                          : "Sin suscripción"}
                      </p>
                      {sub?.pending_plan && (
                        <p className="font-sans text-xs text-terracota mt-0.5 font-medium">
                          Pidió {PLANS[sub.pending_plan].name}
                        </p>
                      )}
                      <p className="font-sans text-xs text-graphite mt-0.5 tabular-nums">
                        Activación: {formatActivatedAt(sub?.activated_at ?? null)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <ApprovalBadge status={row.approval_status} />
                      <SubscriptionStatusBadge sub={sub} />
                    </div>
                  </div>
                  {(row.approval_status !== "approved" ||
                    sub?.pending_plan != null) && (
                    <div className="mt-3 pt-3 border-t border-stone">
                      <RowActions
                        row={row}
                        loading={loading}
                        layout="inline"
                        onApprove={() => setToApprove(row)}
                        onReject={() => setToReject(row)}
                        onReopen={() => setToReopen(row)}
                        onActivate={() => setToActivate(row)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* AlertDialog de confirmación antes de activar un plan */}
      <AlertDialog
        open={!!toActivate}
        onOpenChange={(open) => !open && setToActivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Activar plan{" "}
              {toActivate?.subscription?.pending_plan
                ? PLANS[toActivate.subscription.pending_plan].name
                : ""}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a activar el plan{" "}
              <strong className="text-black">
                {toActivate?.subscription?.pending_plan
                  ? PLANS[toActivate.subscription.pending_plan].name
                  : ""}
              </strong>{" "}
              para{" "}
              <strong className="text-black">
                &quot;{toActivate?.name ?? "—"}&quot;
              </strong>
              . El plan pedido pasará a regir, con sus límites y beneficios reales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toActivate) return;
                const id = toActivate.agency_id;
                setToActivate(null);
                run(id, () => activatePlanAction(id));
              }}
              className="bg-terracota text-paper hover:bg-terracota-hover border-0"
            >
              Activar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog de confirmación antes de aprobar (sí/no, sin campos) */}
      <AlertDialog
        open={!!toApprove}
        onOpenChange={(open) => !open && setToApprove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar la agencia?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a aprobar a{" "}
              <strong className="text-black">
                &quot;{toApprove?.name ?? "—"}&quot;
              </strong>
              {toApprove?.license_number
                ? `, matrícula ${toApprove.license_number}`
                : ", que no tiene matrícula cargada"}
              . Queda habilitada como inmobiliaria legítima. Su plan no cambia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toApprove) return;
                const id = toApprove.agency_id;
                setToApprove(null);
                run(id, () => approveAgencyAction({ agencyId: id }));
              }}
              className="bg-terracota text-paper hover:bg-terracota-hover border-0"
            >
              Aprobar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog de confirmación antes de devolver a pendiente */}
      <AlertDialog
        open={!!toReopen}
        onOpenChange={(open) => !open && setToReopen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Volver a pendiente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-black">
                &quot;{toReopen?.name ?? "—"}&quot;
              </strong>{" "}
              vuelve a la bandeja de pendientes. El rechazo anterior queda en el
              historial, pero la agencia deja de estar rechazada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toReopen) return;
                const id = toReopen.agency_id;
                setToReopen(null);
                run(id, () => reopenAgencyAction({ agencyId: id }));
              }}
              className="bg-terracota text-paper hover:bg-terracota-hover border-0"
            >
              Volver a pendiente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Panel de rechazo ─────────────────────────────────────────
// Rechazar necesita que el dueño ESCRIBA un motivo, así que no es una
// confirmación sí/no y no va en el AlertDialog. Sigue el precedente de la app
// para "formulario que llena un admin": panel inline (ver CreateAgentForm en
// TeamContent.tsx), con su propio botón de cerrar y su validación local.
// El límite de largo se valida también en el server (REJECTION_NOTE_MAX).
function RejectPanel({
  row,
  loading,
  onCancel,
  onConfirm,
}: {
  row: AgencyRow;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const tooLong = trimmed.length > REJECTION_NOTE_MAX;
  const canSubmit = trimmed.length > 0 && !tooLong && !loading;

  return (
    <section className="mb-4 bg-paper border border-stone rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-black">
            Rechazar &quot;{row.name}&quot;
          </h2>
          <p className="mt-1 font-sans text-xs text-graphite">
            El motivo queda registrado para vos. La agencia puede corregir sus
            datos y volver a pendiente: el rechazo no es definitivo.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1 text-graphite hover:text-black transition-colors shrink-0"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="reject-note"
          className="font-sans text-sm font-medium text-black"
        >
          Motivo del rechazo
        </Label>
        <Textarea
          id="reject-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Ej: la matrícula no figura a nombre de la agencia."
          className={tooLong ? "border-error" : undefined}
        />
        <p
          className={`font-sans text-xs ${tooLong ? "text-error" : "text-graphite"}`}
        >
          {tooLong
            ? `Máximo ${REJECTION_NOTE_MAX} caracteres (llevás ${trimmed.length}).`
            : `${trimmed.length}/${REJECTION_NOTE_MAX} caracteres. Es obligatorio.`}
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => onConfirm(trimmed)}
          disabled={!canSubmit}
          className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Rechazando..." : "Rechazar agencia"}
        </button>
        <button
          onClick={onCancel}
          className="h-11 px-4 rounded-md font-sans text-sm font-medium text-graphite hover:text-black transition-colors duration-[120ms]"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
