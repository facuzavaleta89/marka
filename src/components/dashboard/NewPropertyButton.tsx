// src/components/dashboard/NewPropertyButton.tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import type { PlanUsage } from "@/types";

interface NewPropertyButtonProps {
  planUsage: PlanUsage;
}

// Atajo "Nueva propiedad" con gate de plan.
// Server Component presentacional: recibe el PlanUsage ya calculado por
// getPlanUsage() (por agency_id, solo server) — no hace fetch propio.
// Si la agencia llegó al límite, el botón se muestra deshabilitado con el
// mensaje constructivo (DESIGN.md §12): nunca se oculta.
export function NewPropertyButton({ planUsage }: NewPropertyButtonProps) {
  if (planUsage.canCreate) {
    return (
      <Link
        href="/dashboard/propiedades/nueva"
        className="inline-flex items-center gap-1.5 h-11 px-4 font-sans text-sm font-medium text-paper bg-terracota hover:bg-terracota-hover rounded-md transition-colors duration-[120ms]"
      >
        <Plus size={20} />
        Nueva propiedad
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <button
        disabled
        aria-disabled="true"
        className="inline-flex items-center gap-1.5 h-11 px-4 font-sans text-sm font-medium text-graphite bg-stone rounded-md cursor-not-allowed"
      >
        <Plus size={20} />
        Nueva propiedad
      </button>
      <p className="font-sans text-xs text-graphite max-w-xs sm:text-right">
        Alcanzaste el límite de {planUsage.limit} propiedades del plan Free.
        Pasá a Pro para publicar sin límite.{" "}
        <Link
          href="/dashboard/suscripcion"
          className="text-terracota hover:underline"
        >
          Ver planes
        </Link>
      </p>
    </div>
  );
}
