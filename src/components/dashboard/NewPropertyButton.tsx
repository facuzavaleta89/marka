// src/components/dashboard/NewPropertyButton.tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import type { PlanUsage } from "@/types";
import { PLANS, PLAN_ORDER } from "@/types";

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

  // Plan siguiente en el orden free → inicial → profesional → premium.
  // Si el plan actual es premium (tope), no hay siguiente.
  const currentIdx = PLAN_ORDER.indexOf(planUsage.plan);
  const nextPlan =
    currentIdx >= 0 && currentIdx < PLAN_ORDER.length - 1
      ? PLAN_ORDER[currentIdx + 1]
      : null;

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
      {nextPlan ? (
        // Hay un plan superior: invitar al upgrade.
        <p className="font-sans text-xs text-graphite max-w-xs sm:text-right">
          Alcanzaste el límite de tu plan {PLANS[planUsage.plan].name}. Pasá a{" "}
          {PLANS[nextPlan].name} para publicar más.{" "}
          <Link
            href="/dashboard/suscripcion"
            className="text-terracota hover:underline"
          >
            Ver planes
          </Link>
        </p>
      ) : (
        // Plan premium (tope, 200 propiedades): no hay upgrade, ofrecer contacto.
        <p className="font-sans text-xs text-graphite max-w-xs sm:text-right">
          Alcanzaste el máximo de propiedades. Escribinos si necesitás más.{" "}
          <a
            href="mailto:hola@marka.app"
            className="text-terracota hover:underline"
          >
            Escribinos
          </a>
        </p>
      )}
    </div>
  );
}
