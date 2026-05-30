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
  pausePropertyAction,
  activatePropertyAction,
  markAsSoldAction,
  markAsRentedAction,
  deletePropertyAction,
} from "@/app/(agent)/dashboard/propiedades/actions";
import type { Currency, PropertyStatus, PropertyType, OperationType } from "@/types";

// ─── Tipos ───────────────────────────────────────────────────

type CoverImage = { url: string; is_cover: boolean; sort_order: number };

export type PropertyRow = {
  id: string;
  title: string;
  property_type: string;
  operation_type: string;
  price: number;
  currency: string;
  status: string;
  images: CoverImage[] | null;
};

interface PropertiesTableProps {
  properties: PropertyRow[];
}

// ─── Constantes ──────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PropertyStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Activa",
    className: "bg-terracota-subtle text-terracota",
  },
  paused: { label: "Pausada", className: "bg-mist text-graphite" },
  sold: { label: "Vendida", className: "bg-stone text-graphite" },
  rented: { label: "Alquilada", className: "bg-stone text-graphite" },
};

const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  casa: "Casa",
  departamento: "Depto.",
  terreno: "Terreno",
  local: "Local",
  oficina: "Oficina",
  campo: "Campo",
  cochera: "Cochera",
};

const OPERATION_LABEL: Record<OperationType, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Temporal",
};

// ─── Sub-componentes ──────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg =
    STATUS_CONFIG[status as PropertyStatus] ?? STATUS_CONFIG.paused;
  return (
    <span
      className={`inline-block font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm px-2 py-0.5 ${cfg.className}`}
    >
      {cfg.label}
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
      <div className="w-12 h-12 rounded bg-mist flex items-center justify-center shrink-0">
        <ImageOff size={16} className="text-stone" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cover.url}
      alt={title}
      className="w-12 h-12 object-cover rounded shrink-0"
    />
  );
}

// ─── Componente principal ─────────────────────────────────────

export function PropertiesTable({ properties }: PropertiesTableProps) {
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
                      {PROPERTY_TYPE_LABEL[p.property_type as PropertyType] ??
                        p.property_type}
                    </span>
                  </td>

                  {/* Operación */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-sans text-sm text-graphite">
                      {OPERATION_LABEL[p.operation_type as OperationType] ??
                        p.operation_type}
                    </span>
                  </td>

                  {/* Precio */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-sans text-sm font-medium text-black">
                      {formatPrice(p.price, p.currency as Currency)}
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>

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
                    {PROPERTY_TYPE_LABEL[p.property_type as PropertyType] ??
                      p.property_type}{" "}
                    ·{" "}
                    {OPERATION_LABEL[p.operation_type as OperationType] ??
                      p.operation_type}
                  </p>
                  <p className="font-sans text-sm font-medium text-black mt-1">
                    {formatPrice(p.price, p.currency as Currency)}
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
              <div className="mt-3 pt-3 border-t border-stone">
                <StatusBadge status={p.status} />
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
              <strong className="text-black">"{toDelete?.title}"</strong>. Esta
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
