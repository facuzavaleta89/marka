// src/components/dashboard/FeaturedBadge.tsx
import type { FeaturedUsage } from "@/types";

interface FeaturedBadgeProps {
  featuredUsage: Pick<FeaturedUsage, "limit" | "used">;
}

// Chip del cupo de destacadas: "DESTACADAS · 2/3 · ▰▰▱". Mismas clases que
// PlanBadge, a propósito: se muestran uno debajo del otro en la cabecera del
// listado y tienen que leerse como la misma familia de dato. Si PlanBadge cambia
// de estilo, cambiar este igual.
//
// Solo se monta con limit > 0 (el llamador decide). `used` puede superar a
// `limit` si el cupo bajó sin llegar a 0: la barra se topea en 100 %.
export function FeaturedBadge({ featuredUsage }: FeaturedBadgeProps) {
  const { used, limit } = featuredUsage;
  // Mismo criterio que PlanBadge: sin límite no hay proporción (y no divide por 0).
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <span className="inline-flex items-center gap-2 bg-mist rounded-sm px-2.5 py-1">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-graphite">
        Destacadas
      </span>
      <span className="font-sans text-[11px] font-semibold tabular-nums text-graphite">
        {used}/{limit}
      </span>
      <span className="relative h-1 w-10 overflow-hidden rounded-full bg-stone/50">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-terracota transition-all duration-[220ms]"
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}
