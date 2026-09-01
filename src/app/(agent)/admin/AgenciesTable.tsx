"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  CheckCircle2,
  ShieldCheck,
  ShieldX,
  Undo2,
  MoreHorizontal,
  Ban,
  RotateCcw,
  Trash2,
  CircleSlash,
  ArrowLeftRight,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  PAID_PLANS,
  PLANS,
  REJECTION_NOTE_MAX,
  type ApprovalStatus,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "@/types";
import {
  APPROVAL_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/utils/labels";
import {
  activatePlanAction,
  approveAgencyAction,
  cancelPendingPlanAction,
  cancelSubscriptionAction,
  changePlanAction,
  deleteAgencyAction,
  rejectAgencyAction,
  reopenAgencyAction,
  restoreSubscriptionAction,
} from "./actions";

// Override del Checkbox de shadcn a terracota en estado marcado (mismo patrón
// que FilterPanel/PropertyForm, para consistencia en toda la app).
// Mismo tratamiento de campo que el resto de los formularios del proyecto
// (DESIGN §6: fondo white, borde stone, rounded-md, foco terracota). El Input
// base del preset es de borde inferior, así que se lo sobreescribe igual que en
// PropertyForm y AgencyIdentityForm.
const FIELD =
  "rounded-md border border-stone border-b-stone bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/20 focus-visible:ring-offset-1 focus-visible:border-graphite focus-visible:border-b-graphite";

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
  // Vencimiento del plan vigente. Lo usa el panel de cambio de plan para
  // PRECARGAR el campo: ahí el vacío borra, así que el dueño tiene que ver qué
  // hay antes de decidir si lo conserva.
  current_period_end: string | null;
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
  // ¿Está vacía (sin propiedades y sin consultas)? Lo calcula la página en el
  // server. Acá solo decide si se OFRECE eliminar: la regla real la vuelve a
  // verificar deleteAgencyAction contra la base, porque un booleano que viaja al
  // cliente no es una barrera.
  can_delete: boolean;
  // Propiedades que OCUPAN CUPO (status active/paused), con el mismo criterio
  // que check_property_limit() en la base. Sirve para anticipar si un cambio de
  // plan entraría; la barrera real vuelve a contar en changePlanAction.
  occupied_properties: number;
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
type PlanCategory =
  | "pendingPlan"
  | "paidActive"
  | "free"
  | "canceled"
  | "other";

const PLAN_FILTERS: { key: PlanCategory; label: string }[] = [
  { key: "pendingPlan", label: "Plan pendiente" },
  { key: "paidActive", label: "Pagas activas" },
  { key: "free", label: "Free" },
  { key: "canceled", label: "Dadas de baja" },
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
  // Categoría propia: una agencia dada de baja es un grupo que el dueño va a
  // querer listar (a quién llamar, a quién reactivar). Antes caía en "other"
  // mezclada con las que no tienen fila de suscripción, que es una situación
  // completamente distinta.
  if (sub.status === "canceled") return "canceled";
  return "other"; // past_due, y cualquier estado futuro
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
  // Las etiquetas salen de labels.ts (mapa de un literal del dominio); acá vive
  // solo el tratamiento visual, que es propio de esta tabla.
  const className: Record<SubscriptionStatus, string> = {
    pending: "bg-mist text-graphite",
    active: "bg-success/10 text-success",
    past_due: "bg-stone text-graphite",
    // Dada de baja: se distingue del resto de los "apagados" porque es una
    // decisión del dueño y es reversible, no un estado a la deriva.
    canceled: "bg-error/10 text-error",
  };
  const label = SUBSCRIPTION_STATUS_LABELS[sub.status];
  return (
    <span
      className={`inline-block font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm px-2 py-0.5 ${className[sub.status]}`}
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

// ─── Qué acciones aplican a una fila ──────────────────────────
//
// FUENTE ÚNICA de las condiciones. Antes cada condición estaba escrita dos
// veces: adentro de RowActions y otra vez en la card de mobile, que decidía si
// renderizar el bloque entero. Las dos copias se desincronizaron —la de mobile
// solo contemplaba el eje de aprobación y el plan pendiente, así que una agencia
// aprobada con plan activo (justo el caso de "dar de baja") no mostraba NINGÚN
// botón en el celular—. Con esto, agregar una acción no puede volver a dejar
// mobile atrás.
interface RowActionAvailability {
  approve: boolean;
  reject: boolean;
  reopen: boolean;
  activate: boolean;
  cancelPlan: boolean;
  changePlan: boolean;
  suspend: boolean;
  restore: boolean;
  remove: boolean;
}

function availableActions(row: AgencyRow): RowActionAvailability {
  const sub = row.subscription;
  const hasPendingPlan = sub?.pending_plan != null;

  return {
    // Eje de legitimidad
    approve: row.approval_status === "pending",
    reject: row.approval_status === "pending",
    reopen: row.approval_status === "rejected",
    // Eje comercial. Activar y cancelar son las dos salidas del mismo estado.
    activate: hasPendingPlan,
    cancelPlan: hasPendingPlan,
    // Solo tiene sentido dar de baja un plan PAGO y vigente: 'free' es el estado
    // de aterrizaje, no algo contratado.
    suspend: sub != null && sub.status === "active" && sub.plan !== "free",
    // Misma condición que dar de baja, y por el mismo motivo: se le cambia el
    // plan a quien TIENE un plan de venta vigente. Con una solicitud sin
    // resolver está activar/cancelar, y con la suscripción de baja está
    // reactivar (que necesita el `plan` guardado intacto). Lo repite
    // changePlanAction del lado del server.
    changePlan: sub != null && sub.status === "active" && sub.plan !== "free",
    restore: sub?.status === "canceled",
    remove: row.can_delete,
  };
}

function hasAnyAction(row: AgencyRow): boolean {
  return Object.values(availableActions(row)).some(Boolean);
}

// Acciones de una fila, en una sola pieza reusada por la tabla (desktop) y por
// las cards (mobile).
//
// ⚠ REPARTO ENTRE BOTONES Y MENÚ, que es lo que evita que la celda reviente:
// una agencia recién registrada puede estar pendiente de aprobación Y tener un
// plan pedido Y estar vacía, o sea SIETE acciones aplicables a la vez. Siete
// botones apilados son ~250 px de alto de fila: ilegible, y contra DESIGN §1
// ("jerarquía antes que decoración").
//
// El corte no es por cantidad sino por naturaleza: quedan como BOTONES las
// acciones que hacen avanzar el flujo —aprobar, rechazar, activar el plan, que
// son la bandeja de entrada diaria del dueño— y se van al menú "⋯" las de
// DESHACER y las destructivas, que son excepcionales y conviene que cuesten un
// click más. Precedente del repo: PropertiesTable usa el mismo menú para lo
// mismo. Peor caso visible: 3 botones + el disparador del menú.
function RowActions({
  row,
  loading,
  layout,
  onApprove,
  onReject,
  onReopen,
  onActivate,
  onCancelPlan,
  onChangePlan,
  onSuspend,
  onRestore,
  onDelete,
}: {
  row: AgencyRow;
  loading: boolean;
  layout: "stacked" | "inline";
  onApprove: () => void;
  onReject: () => void;
  onReopen: () => void;
  onActivate: () => void;
  onCancelPlan: () => void;
  onChangePlan: () => void;
  onSuspend: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const can = availableActions(row);
  const wrapper =
    layout === "stacked"
      ? "flex flex-col items-end gap-2"
      : "flex flex-wrap justify-end items-center gap-2";

  const hasMenu =
    can.cancelPlan ||
    can.changePlan ||
    can.suspend ||
    can.restore ||
    can.remove;

  return (
    <div className={wrapper}>
      {/* Eje de aprobación */}
      {can.approve && (
        <RowButton
          variant="primary"
          loading={loading}
          onClick={onApprove}
          icon={<ShieldCheck size={14} />}
        >
          Aprobar
        </RowButton>
      )}
      {can.reject && (
        <RowButton
          variant="destructive"
          loading={loading}
          onClick={onReject}
          icon={<ShieldX size={14} />}
        >
          Rechazar
        </RowButton>
      )}
      {/* El rechazo no es definitivo: el dueño puede devolverla a pendiente. */}
      {can.reopen && (
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
      {can.activate && (
        <RowButton
          variant="primary"
          loading={loading}
          onClick={onActivate}
          icon={<CheckCircle2 size={14} />}
        >
          Activar plan
        </RowButton>
      )}

      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={loading}
              className="p-1.5 rounded-md text-graphite hover:text-black hover:bg-mist transition-colors disabled:opacity-40"
              aria-label="Más acciones"
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {can.cancelPlan && (
              <DropdownMenuItem
                onSelect={onCancelPlan}
                className="flex items-center gap-2"
              >
                <CircleSlash size={14} />
                Cancelar la solicitud
              </DropdownMenuItem>
            )}
            {can.changePlan && (
              <DropdownMenuItem
                onSelect={onChangePlan}
                className="flex items-center gap-2"
              >
                <ArrowLeftRight size={14} />
                Cambiar de plan
              </DropdownMenuItem>
            )}
            {can.suspend && (
              <DropdownMenuItem
                onSelect={onSuspend}
                className="flex items-center gap-2"
              >
                <Ban size={14} />
                Dar de baja
              </DropdownMenuItem>
            )}
            {can.restore && (
              <DropdownMenuItem
                onSelect={onRestore}
                className="flex items-center gap-2"
              >
                <RotateCcw size={14} />
                Reactivar suscripción
              </DropdownMenuItem>
            )}
            {can.remove && (
              <>
                {(can.cancelPlan ||
                  can.changePlan ||
                  can.suspend ||
                  can.restore) && <DropdownMenuSeparator />}
                {/* Irreversible: separada del resto y en color de error. */}
                <DropdownMenuItem
                  onSelect={onDelete}
                  className="flex items-center gap-2 text-error focus:text-error"
                >
                  <Trash2 size={14} />
                  Eliminar agencia
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────

export function AgenciesTable({ rows }: AgenciesTableProps) {
  const router = useRouter();
  const [toApprove, setToApprove] = useState<AgencyRow | null>(null);
  const [toReopen, setToReopen] = useState<AgencyRow | null>(null);
  // Confirmaciones sí/no del eje comercial (sin campos → AlertDialog).
  const [toCancelPlan, setToCancelPlan] = useState<AgencyRow | null>(null);
  const [toSuspend, setToSuspend] = useState<AgencyRow | null>(null);
  const [toRestore, setToRestore] = useState<AgencyRow | null>(null);
  // Paneles inline: los dos piden que el dueño ESCRIBA algo (el motivo del
  // rechazo, la fecha de vencimiento opcional, el nombre para confirmar el
  // borrado), así que no son confirmaciones sí/no y no van en el AlertDialog.
  const [toReject, setToReject] = useState<AgencyRow | null>(null);
  const [toActivate, setToActivate] = useState<AgencyRow | null>(null);
  const [toDelete, setToDelete] = useState<AgencyRow | null>(null);
  const [toChangePlan, setToChangePlan] = useState<AgencyRow | null>(null);
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
    canceled: true,
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

      {/* Activación de plan (panel inline: lleva la fecha de vencimiento) */}
      {toActivate && (
        <ActivatePlanPanel
          row={toActivate}
          loading={pendingId === toActivate.agency_id}
          onCancel={() => setToActivate(null)}
          onConfirm={(periodEnd) => {
            const target = toActivate;
            setToActivate(null);
            run(target.agency_id, () =>
              activatePlanAction({ agencyId: target.agency_id, periodEnd })
            );
          }}
        />
      )}

      {/* Cambio de plan (panel inline: hay una selección y un posible bloqueo
          por exceso que hay que mostrar sin cerrar) */}
      {toChangePlan && (
        <ChangePlanPanel
          row={toChangePlan}
          loading={pendingId === toChangePlan.agency_id}
          onCancel={() => setToChangePlan(null)}
          onConfirm={(targetPlan, periodEnd) => {
            const target = toChangePlan;
            setToChangePlan(null);
            run(target.agency_id, () =>
              changePlanAction({
                agencyId: target.agency_id,
                targetPlan,
                periodEnd,
              })
            );
          }}
        />
      )}

      {/* Eliminación (panel inline: hay que tipear el nombre) */}
      {toDelete && (
        <DeleteAgencyPanel
          row={toDelete}
          loading={pendingId === toDelete.agency_id}
          onCancel={() => setToDelete(null)}
          onConfirm={(confirmationName) => {
            const target = toDelete;
            setToDelete(null);
            run(target.agency_id, () =>
              deleteAgencyAction({
                agencyId: target.agency_id,
                confirmationName,
              })
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

                      {/* Acciones. min-w para que los botones no se compriman
                          cuando la tabla scrollea horizontalmente. */}
                      <td className="px-5 py-3 text-right min-w-[180px]">
                        <RowActions
                          row={row}
                          loading={loading}
                          layout="stacked"
                          onApprove={() => setToApprove(row)}
                          onReject={() => setToReject(row)}
                          onReopen={() => setToReopen(row)}
                          onActivate={() => setToActivate(row)}
                          onCancelPlan={() => setToCancelPlan(row)}
                          onChangePlan={() => setToChangePlan(row)}
                          onSuspend={() => setToSuspend(row)}
                          onRestore={() => setToRestore(row)}
                          onDelete={() => setToDelete(row)}
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
                  {/* ⚠ La condición sale de availableActions (fuente única):
                      antes estaba escrita a mano acá y se quedó vieja — una
                      agencia aprobada con plan activo no mostraba ningún botón
                      en mobile, justo el caso de "dar de baja". */}
                  {hasAnyAction(row) && (
                    <div className="mt-3 pt-3 border-t border-stone">
                      <RowActions
                        row={row}
                        loading={loading}
                        layout="inline"
                        onApprove={() => setToApprove(row)}
                        onReject={() => setToReject(row)}
                        onReopen={() => setToReopen(row)}
                        onActivate={() => setToActivate(row)}
                        onCancelPlan={() => setToCancelPlan(row)}
                        onChangePlan={() => setToChangePlan(row)}
                        onSuspend={() => setToSuspend(row)}
                        onRestore={() => setToRestore(row)}
                        onDelete={() => setToDelete(row)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Confirmaciones del eje comercial (sí/no, sin campos) ──
          Las tres son reversibles y de una sola frase, así que el AlertDialog
          alcanza. Las que piden escribir algo viven en paneles, más arriba. */}

      {/* Cancelar la solicitud de plan */}
      <AlertDialog
        open={!!toCancelPlan}
        onOpenChange={(open) => !open && setToCancelPlan(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar la solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-black">
                &quot;{toCancelPlan?.name ?? "—"}&quot;
              </strong>{" "}
              pidió el plan{" "}
              <strong className="text-black">
                {toCancelPlan?.subscription?.pending_plan
                  ? PLANS[toCancelPlan.subscription.pending_plan].name
                  : "—"}
              </strong>
              . Se descarta el pedido y la agencia vuelve a poder elegir otro
              plan desde su panel. El plan que rige hoy no cambia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toCancelPlan) return;
                const id = toCancelPlan.agency_id;
                setToCancelPlan(null);
                run(id, () => cancelPendingPlanAction({ agencyId: id }));
              }}
              className="bg-terracota text-paper hover:bg-terracota-hover border-0"
            >
              Cancelar la solicitud
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dar de baja la suscripción */}
      <AlertDialog
        open={!!toSuspend}
        onOpenChange={(open) => !open && setToSuspend(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja la suscripción?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-black">
                &quot;{toSuspend?.name ?? "—"}&quot;
              </strong>{" "}
              deja de estar al día. Sus propiedades{" "}
              <strong className="text-black">
                desaparecen del mapa público
              </strong>
              , su sitio de marca se apaga y no va a poder publicar nuevas. Sigue
              entrando a su panel y ve todo lo suyo. Se conserva el plan{" "}
              <strong className="text-black">
                {toSuspend?.subscription
                  ? PLANS[toSuspend.subscription.plan].name
                  : "—"}
              </strong>{" "}
              para poder reactivarla después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toSuspend) return;
                const id = toSuspend.agency_id;
                setToSuspend(null);
                run(id, () => cancelSubscriptionAction({ agencyId: id }));
              }}
              className="bg-terracota text-paper hover:bg-terracota-hover border-0"
            >
              Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivar la suscripción */}
      <AlertDialog
        open={!!toRestore}
        onOpenChange={(open) => !open && setToRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar la suscripción?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-black">
                &quot;{toRestore?.name ?? "—"}&quot;
              </strong>{" "}
              vuelve a estar al día con el plan{" "}
              <strong className="text-black">
                {toRestore?.subscription
                  ? PLANS[toRestore.subscription.plan].name
                  : "—"}
              </strong>
              , con los beneficios que ese plan incluye. Sus propiedades vuelven
              a verse en el mapa y puede publicar de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toRestore) return;
                const id = toRestore.agency_id;
                setToRestore(null);
                run(id, () => restoreSubscriptionAction({ agencyId: id }));
              }}
              className="bg-terracota text-paper hover:bg-terracota-hover border-0"
            >
              Reactivar
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

// ─── Panel de activación de plan ──────────────────────────────
// Activar era una confirmación sí/no en un AlertDialog. Ahora lleva la fecha de
// vencimiento, así que pasa a panel inline, por el mismo criterio que el de
// rechazo: un AlertDialog es para "¿seguro?" y su botón de acción CIERRA al
// hacer click, lo que deja sin lugar la validación local del campo (fecha mal
// formada, fecha pasada). El panel puede mostrar el error sin cerrarse.
//
// La fecha es OPCIONAL DE VERDAD: el botón está habilitado con el campo vacío y
// activar sin fecha deja la columna como estaba, igual que antes de esta pieza.
function ActivatePlanPanel({
  row,
  loading,
  onCancel,
  onConfirm,
}: {
  row: AgencyRow;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (periodEnd: string) => void;
}) {
  const [periodEnd, setPeriodEnd] = useState("");
  const pendingPlan = row.subscription?.pending_plan ?? null;

  // Mínimo del input nativo: mañana. Es una ayuda del navegador, no la barrera
  // (la action revalida en el server, que es donde importa).
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  // Validación local espejo de la del server, para no mandar un pedido que ya
  // sabemos que va a rebotar.
  const isPastDate = periodEnd !== "" && periodEnd < minDate;
  const canSubmit = !isPastDate && !loading;

  return (
    <section className="mb-4 bg-paper border border-stone rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-black">
            Activar plan {pendingPlan ? PLANS[pendingPlan].name : ""} ·{" "}
            {row.name}
          </h2>
          <p className="mt-1 font-sans text-xs text-graphite">
            El plan pedido pasa a regir, con sus límites y beneficios reales.
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

      <div className="space-y-1.5 max-w-xs">
        <Label
          htmlFor="activate-period-end"
          className="font-sans text-sm font-medium text-black"
        >
          Vencimiento del plan{" "}
          <span className="font-normal text-graphite">(opcional)</span>
        </Label>
        {/* Campo de fecha NATIVO: sin dependencias nuevas y en el celular abre
            el selector del sistema. Estilado como el resto de los inputs
            (DESIGN §6: fondo white, borde stone, focus terracota). */}
        <Input
          id="activate-period-end"
          type="date"
          value={periodEnd}
          min={minDate}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className={`${FIELD} ${isPastDate ? "border-error border-b-error" : ""}`}
        />
        <p
          className={`font-sans text-xs ${isPastDate ? "text-error" : "text-graphite"}`}
        >
          {isPastDate
            ? "La fecha tiene que ser posterior a hoy."
            : "Para las fundadoras con prueba gratuita: cargá hasta cuándo les rige. La agencia lo ve en su panel y vos sabés a quién llamar cuando se acerque. Si lo dejás vacío, el plan no vence."}
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => onConfirm(periodEnd)}
          disabled={!canSubmit}
          className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Activando..." : "Activar plan"}
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

// ─── Panel de eliminación ─────────────────────────────────────
// IRREVERSIBLE y toca varias tablas, así que no alcanza con un "¿seguro?": el
// dueño tiene que TIPEAR el nombre exacto de la agencia. La comparación de acá
// es solo para habilitar el botón; la action la repite contra el nombre real
// leído de la base, porque el nombre que conoce el cliente no prueba nada.
function DeleteAgencyPanel({
  row,
  loading,
  onCancel,
  onConfirm,
}: {
  row: AgencyRow;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (confirmationName: string) => void;
}) {
  const [typed, setTyped] = useState("");
  // Espejo de nameMatches() en la server action: ignora mayúsculas y espacios de
  // los bordes. Escribir el nombre es una barrera contra el click distraído, no
  // un examen de ortografía. Acá solo habilita el botón; la comparación que
  // cuenta es la del server, contra el nombre real de la base.
  const matches =
    typed.trim().toLocaleLowerCase("es-AR") ===
    row.name.trim().toLocaleLowerCase("es-AR");
  const canSubmit = matches && !loading;

  return (
    <section className="mb-4 bg-paper border border-error rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-black">
            Eliminar &quot;{row.name}&quot;
          </h2>
          <p className="mt-1 font-sans text-xs text-graphite">
            Se eliminan la agencia, su suscripción, su historial de decisiones,
            las cuentas de sus agentes y sus archivos. No se puede deshacer.
            Solo se ofrece para agencias sin propiedades ni consultas.
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

      <div className="space-y-1.5 max-w-md">
        {/* ⚠ El nombre NO va adentro del <Label>: el Label del preset lleva
            `uppercase`, así que el cartel mostraba el nombre en mayúsculas
            mientras la comparación exigía la capitalización exacta — escribir lo
            que la pantalla indicaba no funcionaba. Va en un <p> aparte, con el
            nombre tal cual está guardado, y se aclara que las mayúsculas no
            importan (la comparación ya las ignora en las dos puntas). */}
        <Label
          htmlFor="delete-confirm-name"
          className="font-sans text-sm font-medium text-black"
        >
          Confirmá el nombre de la agencia
        </Label>
        <p className="font-sans text-sm text-graphite">
          Escribí{" "}
          <span className="font-semibold text-error normal-case">
            {row.name}
          </span>{" "}
          para confirmar. No importan las mayúsculas.
        </p>
        <Input
          id="delete-confirm-name"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={row.name}
          autoComplete="off"
          className={FIELD}
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => onConfirm(typed.trim())}
          disabled={!canSubmit}
          className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-transparent border border-error text-error hover:bg-terracota-subtle transition-colors duration-[120ms] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Eliminando..." : "Eliminar definitivamente"}
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

// ─── Panel de cambio de plan ──────────────────────────────────
// PANEL INLINE y no AlertDialog, por el mismo criterio que los otros tres de
// esta pantalla: el diálogo es para un "¿seguro?" de una sola frase, y su botón
// de acción CIERRA al hacer click. Acá hay una SELECCIÓN (qué plan) y, sobre
// todo, un mensaje de bloqueo por exceso de propiedades que tiene que poder
// mostrarse SIN cerrar, mientras el dueño prueba otro destino. Con un diálogo,
// cada intento bloqueado cerraría la ventana.
//
// El panel ES la confirmación: no se apila un diálogo encima. La confirmación
// explícita es el botón final, que nombra el plan destino, y arriba de él se
// listan las consecuencias concretas (límite nuevo, funciones que gana y que
// pierde) para que nadie lo toque sin saber qué cambia.
const ENTITLEMENTS = [
  { key: "featured", label: "Propiedades destacadas" },
  { key: "whiteLabel", label: "Sitio propio (white-label)" },
  { key: "metrics", label: "Métricas" },
] as const;

function ChangePlanPanel({
  row,
  loading,
  onCancel,
  onConfirm,
}: {
  row: AgencyRow;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (targetPlan: SubscriptionPlan, periodEnd: string) => void;
}) {
  const currentPlan = row.subscription?.plan ?? "free";
  const used = row.occupied_properties;

  const [target, setTarget] = useState<SubscriptionPlan | null>(null);
  // Precargado con el vencimiento vigente: acá el vacío BORRA, así que el dueño
  // tiene que ver qué hay antes de decidir si lo conserva, lo cambia o lo saca.
  const [periodEnd, setPeriodEnd] = useState(
    row.subscription?.current_period_end?.slice(0, 10) ?? ""
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);
  const isPastDate = periodEnd !== "" && periodEnd < minDate;

  // Destinos posibles: los planes de venta menos el que ya rige.
  const options = PAID_PLANS.filter((id) => id !== currentPlan);

  // ¿Entran las propiedades que ocupan cupo en ese plan? Mismo criterio que la
  // base y que changePlanAction; acá solo para ANTICIPAR el rechazo.
  const fits = (plan: SubscriptionPlan) => used <= PLANS[plan].propertyLimit;

  const targetInfo = target ? PLANS[target] : null;
  // Se deriva del info ya resuelto en vez de volver a llamar a fits(target),
  // para no necesitar una aserción de no-nulo más abajo.
  const targetFits = targetInfo != null && used <= targetInfo.propertyLimit;
  const canSubmit = targetFits && !isPastDate && !loading;

  return (
    <section className="mb-4 bg-paper border border-stone rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-black">
            Cambiar el plan de &quot;{row.name}&quot;
          </h2>
          <p className="mt-1 font-sans text-xs text-graphite">
            Hoy tiene el plan{" "}
            <strong className="text-black">{PLANS[currentPlan].name}</strong> y
            usa {used} de {PLANS[currentPlan].propertyLimit} propiedades. El
            cambio se aplica en el momento, sin pasar por una solicitud.
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

      {/* Selección del plan destino */}
      <fieldset className="space-y-2">
        <legend className="font-sans text-sm font-medium text-black mb-2">
          Plan nuevo
        </legend>
        {options.map((id) => {
          const info = PLANS[id];
          const blocked = !fits(id);
          return (
            <label
              key={id}
              className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                blocked
                  ? "border-stone bg-mist/40 cursor-not-allowed"
                  : target === id
                    ? "border-terracota bg-terracota-subtle cursor-pointer"
                    : "border-stone hover:bg-mist cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name="target-plan"
                value={id}
                checked={target === id}
                disabled={blocked}
                onChange={() => setTarget(id)}
                className="mt-1 accent-[#A0522D]"
              />
              <span className="min-w-0">
                <span className="block font-sans text-sm font-medium text-black">
                  {info.name} · {info.propertyLimit} propiedades
                </span>
                {blocked ? (
                  // Anticipación del rechazo: se explica ANTES de intentar, no
                  // después de un error. La action lo rechaza igual.
                  <span className="block font-sans text-xs text-error mt-0.5">
                    No entra: la agencia tiene {used} propiedades activas o
                    pausadas y este plan permite {info.propertyLimit}. Habría que
                    pausar o dar de baja {used - info.propertyLimit} antes.
                  </span>
                ) : (
                  <span className="block font-sans text-xs text-graphite mt-0.5">
                    {info.priceLabel}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      {/* Vencimiento del plan nuevo */}
      <div className="mt-4 space-y-1.5 max-w-xs">
        <Label
          htmlFor="change-plan-period-end"
          className="font-sans text-sm font-medium text-black"
        >
          Vencimiento del plan nuevo{" "}
          <span className="font-normal text-graphite">(opcional)</span>
        </Label>
        <Input
          id="change-plan-period-end"
          type="date"
          value={periodEnd}
          min={minDate}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className={`${FIELD} ${isPastDate ? "border-error border-b-error" : ""}`}
        />
        <p
          className={`font-sans text-xs ${isPastDate ? "text-error" : "text-graphite"}`}
        >
          {isPastDate
            ? "La fecha tiene que ser posterior a hoy."
            : "Viene con el vencimiento actual cargado. Si lo dejás vacío, el plan nuevo queda sin vencimiento: la fecha de antes era del plan viejo."}
        </p>
      </div>

      {/* Consecuencias del cambio elegido: la confirmación explícita es el
          botón de abajo, y esto es lo que hay que leer antes de tocarlo. */}
      {targetInfo && targetFits && (
        <div className="mt-4 rounded-md border border-stone bg-mist/50 p-4">
          <p className="font-sans text-sm font-medium text-black">
            Qué va a pasar
          </p>
          <ul className="mt-1.5 space-y-1 font-sans text-xs text-graphite">
            <li>
              Pasa a <strong className="text-black">{targetInfo.name}</strong>,
              con un límite de{" "}
              <strong className="text-black">
                {targetInfo.propertyLimit} propiedades
              </strong>{" "}
              (hoy usa {used}).
            </li>
            {ENTITLEMENTS.map(({ key, label }) => {
              const before = PLANS[currentPlan][key];
              const after = targetInfo[key];
              if (before === after) return null;
              return (
                <li key={key} className={after ? "text-success" : "text-error"}>
                  {after ? "Gana" : "Pierde"}: {label}
                </li>
              );
            })}
            <li>
              {periodEnd
                ? `Vence el ${periodEnd}.`
                : "Queda sin fecha de vencimiento."}
            </li>
          </ul>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => target && onConfirm(target, periodEnd)}
          disabled={!canSubmit}
          className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? "Cambiando..."
            : targetInfo
              ? `Cambiar a ${targetInfo.name}`
              : "Elegí un plan"}
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
