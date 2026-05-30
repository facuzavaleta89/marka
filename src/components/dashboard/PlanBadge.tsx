import type { PlanUsage } from "@/types";

interface PlanBadgeProps {
  planUsage: PlanUsage;
}

export function PlanBadge({ planUsage }: PlanBadgeProps) {
  const { plan, used, limit } = planUsage;

  if (plan === "pro") {
    return (
      <span className="inline-flex items-center font-sans text-[11px] font-semibold uppercase tracking-wide bg-terracota text-paper rounded-sm px-2.5 py-1">
        Plan Pro · Ilimitado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center font-sans text-[11px] font-semibold uppercase tracking-wide bg-mist text-graphite rounded-sm px-2.5 py-1">
      Plan Free ·{" "}
      <strong className="ml-1 font-semibold">
        {used}/{limit}
      </strong>
      &nbsp;propiedades
    </span>
  );
}
