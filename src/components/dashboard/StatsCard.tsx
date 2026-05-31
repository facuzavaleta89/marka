"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number;
  /** Ícono ya renderizado (ej: <Building2 size={20} />). Hereda el color del wrapper. */
  icon: React.ReactNode;
  description?: string;
  /** Resalta la card como la métrica más relevante (acento terracota) */
  accent?: boolean;
}

// Count-up sutil al montar: el número sube de 0 al valor (ease-out, ~600ms).
// Respeta prefers-reduced-motion y no anima si el valor es 0.
function useCountUp(target: number, durationMs = 600) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce || target <= 0) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cúbico
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return n;
}

export function StatsCard({
  title,
  value,
  icon,
  description,
  accent,
}: StatsCardProps) {
  const n = useCountUp(value);

  return (
    <div
      className={cn(
        "relative rounded-lg border p-6",
        accent ? "border-terracota bg-terracota-subtle" : "border-stone bg-paper"
      )}
    >
      <div
        className={cn(
          "absolute top-4 right-4",
          accent ? "text-terracota" : "text-graphite/55"
        )}
      >
        {icon}
      </div>
      <p className="font-sans text-sm font-medium text-graphite">{title}</p>
      <p
        className={cn(
          "mt-1 font-serif text-4xl font-bold tabular-nums",
          accent ? "text-terracota" : "text-black"
        )}
      >
        {n.toLocaleString("es-AR")}
      </p>
      {description && (
        <p className="font-sans text-xs text-graphite mt-1.5">{description}</p>
      )}
    </div>
  );
}
