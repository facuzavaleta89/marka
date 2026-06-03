// src/components/dashboard/PlanBadge.tsx
import type { PlanUsage } from "@/types";
import { PLANS } from "@/types";

interface PlanBadgeProps {
  planUsage: PlanUsage;
}

export function PlanBadge({ planUsage }: PlanBadgeProps) {
  const { plan, used, limit } = planUsage;

  // En el modelo de 4 planes todos tienen un límite finito → todos muestran
  // el contador + micro-barra de proporción (used/limit). Ya no hay "Ilimitado".
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <span className="inline-flex items-center gap-2 bg-mist rounded-sm px-2.5 py-1">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-graphite">
        Plan {PLANS[plan].name}
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
