"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  ImageOff,
  Pencil,
  Pause,
  Play,
  CheckCircle2,
  KeyRound,
  Trash2,
  X,
} from "lucide-react";
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
import { formatPrice } from "@/lib/utils/formatPrice";
import {
  PROPERTY_TYPE_LABELS,
  OPERATION_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
} from "@/lib/utils/labels";
import {
  pausePropertyAction,
  activatePropertyAction,
  markAsSoldAction,
  markAsRentedAction,
  deletePropertyAction,
} from "@/app/(agent)/dashboard/propiedades/actions";
import type { Property, PropertyImage, PropertyStatus } from "@/types";

// ─── Tipos ───────────────────────────────────────────────────

type CoverImage = Pick<PropertyImage, "url" | "is_cover" | "sort_order">;

export type PropertyRow = Pick<
  Property,
  "id" | "title" | "property_type" | "operation_type" | "price" | "currency" | "status"
> & {
  images: CoverImage[] | null;
  // Nombre del agente dueño. Solo se usa en la vista de admin de agencia
  // (columna "Agente"); para el agente normal queda undefined/null y la columna
  // ni se muestra.
  agent_name?: string | null;
};

interface PropertiesTableProps {
  properties: PropertyRow[];
  // true solo en la vista del admin de agencia: muestra la columna "Agente"
  // (de quién es cada propiedad). El agente normal ve solo lo suyo → sin columna.
  showAgent?: boolean;
}

// ─── Constantes ──────────────────────────────────────────────

// Solo el estilo del badge; las etiquetas vienen de PROPERTY_STATUS_LABELS.
// "active" usa un verde sutil (success) en vez de terracota: "publicada/en vivo"
// es un estado positivo y así no compite con los CTAs terracota de las acciones.
const STATUS_CLASSNAME: Record<PropertyStatus, string> = {
  active: "bg-success/10 text-success",
  paused: "bg-mist text-graphite",
  sold: "bg-stone text-graphite",
  rented: "bg-stone text-graphite",
};

// ─── Sub-componentes ──────────────────────────────────────────

function StatusBadge({ status }: { status: PropertyStatus }) {
  return (
    <span
      className={`inline-block font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm px-2 py-0.5 ${STATUS_CLASSNAME[status]}`}
    >
      {PROPERTY_STATUS_LABELS[status]}
    </span>
  );
}

function Thumbnail({
  images,
  title,
}: {
  images: CoverImage[] | null;
  title: string;
}) {
  const cover =
    images?.find((i) => i.is_cover) ??
    images?.sort((a, b) => a.sort_order - b.sort_order)[0];

  if (!cover) {
    return (
      <div className="h-12 w-16 rounded-md bg-mist flex items-center justify-center shrink-0">
        <ImageOff size={16} className="text-stone" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cover.url}
      alt={title}
      className="h-12 w-16 object-cover rounded-md shrink-0"
    />
  );
}

// ─── Componente principal ─────────────────────────────────────

export function PropertiesTable({ properties, showAgent = false }: PropertiesTableProps) {
  const [toDelete, setToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleAction = (
    id: string,
    action: (id: string) => Promise<{ error: string } | undefined>
  ) => {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      setPendingId(null);
      if (result?.error) setError(result.error);
    });
  };

  const handleDelete = (id: string) => {
    setToDelete(null);
    handleAction(id, deletePropertyAction);
  };

  if (properties.length === 0) {
    return (
      <div className="bg-paper border border-stone rounded-lg px-6 py-16 text-center">
        <p className="font-sans text-base text-graphite">
          Todavía no publicaste ninguna propiedad.
        </p>
        <Link
          href="/dashboard/propiedades/nueva"
          className="inline-block mt-3 font-sans text-sm font-medium text-terracota hover:underline"
        >
          Publicar primera propiedad
        </Link>
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
              {[
                "Portada",
                "Título",
                "Tipo",
                "Operación",
                "Precio",
                "Estado",
                ...(showAgent ? ["Agente"] : []),
                "",
              ].map((col, i) => (
                <th
                  key={col || `col-${i}`}
                  className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite text-left px-4 py-3 first:pl-5 last:pr-5"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {properties.map((p) => {
              const loading = pendingId === p.id;
              return (
                <tr
                  key={p.id}
                  className={`transition-colors ${loading ? "opacity-50" : "hover:bg-mist/40"}`}
                >
                  {/* Portada */}
                  <td className="px-5 py-3">
                    <Thumbnail images={p.images} title={p.title} />
                  </td>

                  {/* Título */}
                  <td className="px-4 py-3 max-w-[200px]">
                    <span className="font-sans text-sm font-medium text-black line-clamp-2">
                      {p.title}
                    </span>
                  </td>

                  {/* Tipo */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-sans text-sm text-graphite">
                      {PROPERTY_TYPE_LABELS[p.property_type]}
                    </span>
                  </td>

                  {/* Operación */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-sans text-sm text-graphite">
                      {OPERATION_TYPE_LABELS[p.operation_type]}
                    </span>
                  </td>

                  {/* Precio */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-sans text-sm font-medium text-black">
                      {formatPrice(p.price, p.currency)}
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>

                  {/* Agente (solo admin de agencia) */}
                  {showAgent && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-sans text-sm text-graphite">
                        {p.agent_name ?? "—"}
                      </span>
                    </td>
                  )}

                  {/* Acciones */}
                  <td className="px-5 py-3">
                    <ActionMenu
                      property={p}
                      loading={loading}
                      onAction={handleAction}
                      onDeleteRequest={(id, title) => setToDelete({ id, title })}
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
        {properties.map((p) => {
          const loading = pendingId === p.id;
          return (
            <div
              key={p.id}
              className={`bg-paper border border-stone rounded-lg p-4 transition-opacity ${loading ? "opacity-50" : ""}`}
            >
              <div className="flex gap-3">
                <Thumbnail images={p.images} title={p.title} />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-black truncate">
                    {p.title}
                  </p>
                  <p className="font-sans text-xs text-graphite mt-0.5">
                    {PROPERTY_TYPE_LABELS[p.property_type]}{" "}
                    · {OPERATION_TYPE_LABELS[p.operation_type]}
                  </p>
                  <p className="font-sans text-sm font-medium text-black mt-1">
                    {formatPrice(p.price, p.currency)}
                  </p>
                </div>
                <div className="shrink-0">
                  <ActionMenu
                    property={p}
                    loading={loading}
                    onAction={handleAction}
                    onDeleteRequest={(id, title) => setToDelete({ id, title })}
                  />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-stone flex items-center justify-between gap-3">
                <StatusBadge status={p.status} />
                {showAgent && (
                  <span className="font-sans text-xs text-graphite truncate">
                    {p.agent_name ?? "—"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AlertDialog de confirmación de eliminación */}
      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar propiedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar{" "}
              <strong className="text-black">&quot;{toDelete?.title}&quot;</strong>. Esta
              acción no se puede deshacer. Se eliminarán las imágenes y los
              leads asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && handleDelete(toDelete.id)}
              className="bg-error text-paper hover:bg-error/90 border-0"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Skeleton de tabla (para el loading de la ruta) ───────────

export function PropertiesTableSkeleton({ rows = 5 }: { rows?: number }) {
  const items = Array.from({ length: rows });
  return (
    <div className="animate-pulse">
      {/* Desktop */}
      <div className="hidden md:block bg-paper border border-stone rounded-lg overflow-hidden">
        <div className="border-b border-stone px-5 py-3">
          <div className="h-2.5 w-28 rounded-sm bg-stone/30" />
        </div>
        <div className="divide-y divide-stone">
          {items.map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="h-12 w-16 shrink-0 rounded-md bg-stone/30" />
              <div className="h-3 w-48 rounded-sm bg-stone/30" />
              <div className="ml-auto h-3 w-16 rounded-sm bg-stone/30" />
              <div className="h-3 w-20 rounded-sm bg-stone/30" />
              <div className="h-5 w-16 rounded-sm bg-stone/30" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {items.map((_, i) => (
          <div key={i} className="bg-paper border border-stone rounded-lg p-4">
            <div className="flex gap-3">
              <div className="h-12 w-16 shrink-0 rounded-md bg-stone/30" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded-sm bg-stone/30" />
                <div className="h-2.5 w-1/2 rounded-sm bg-stone/30" />
                <div className="h-3 w-20 rounded-sm bg-stone/30" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-stone">
              <div className="h-5 w-16 rounded-sm bg-stone/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Menú de acciones por fila ────────────────────────────────

function ActionMenu({
  property,
  loading,
  onAction,
  onDeleteRequest,
}: {
  property: PropertyRow;
  loading: boolean;
  onAction: (
    id: string,
    action: (id: string) => Promise<{ error: string } | undefined>
  ) => void;
  onDeleteRequest: (id: string, title: string) => void;
}) {
  const isVenta = property.operation_type === "venta";
  const isAlquiler =
    property.operation_type === "alquiler" ||
    property.operation_type === "alquiler_temporal";
  const canToggle =
    property.status === "active" || property.status === "paused";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={loading}
          className="p-1.5 rounded-md text-graphite hover:text-black hover:bg-mist transition-colors disabled:opacity-40"
          aria-label="Acciones"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {/* Editar */}
        <DropdownMenuItem asChild>
          <Link
            href={`/dashboard/propiedades/${property.id}/editar`}
            className="flex items-center gap-2"
          >
            <Pencil size={14} />
            Editar
          </Link>
        </DropdownMenuItem>

        {/* Pausar / Activar */}
        {canToggle && (
          <>
            {property.status === "active" ? (
              <DropdownMenuItem
                onSelect={() => onAction(property.id, pausePropertyAction)}
                className="flex items-center gap-2"
              >
                <Pause size={14} />
                Pausar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() => onAction(property.id, activatePropertyAction)}
                className="flex items-center gap-2"
              >
                <Play size={14} />
                Activar
              </DropdownMenuItem>
            )}
          </>
        )}

        {/* Marcar como vendida / alquilada */}
        {(isVenta || isAlquiler) && <DropdownMenuSeparator />}
        {isVenta && (
          <DropdownMenuItem
            onSelect={() => onAction(property.id, markAsSoldAction)}
            className="flex items-center gap-2"
          >
            <CheckCircle2 size={14} />
            Marcar como vendida
          </DropdownMenuItem>
        )}
        {isAlquiler && (
          <DropdownMenuItem
            onSelect={() => onAction(property.id, markAsRentedAction)}
            className="flex items-center gap-2"
          >
            <KeyRound size={14} />
            Marcar como alquilada
          </DropdownMenuItem>
        )}

        {/* Eliminar */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDeleteRequest(property.id, property.title)}
          className="flex items-center gap-2 text-error focus:text-error focus:bg-terracota-subtle"
        >
          <Trash2 size={14} />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
