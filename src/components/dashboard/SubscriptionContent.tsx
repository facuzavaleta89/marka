// src/components/dashboard/SubscriptionContent.tsx
"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlanInfo, PlanUsage } from "@/types";
import { PLANS, PLAN_ORDER } from "@/types";

interface SubscriptionContentProps {
  planUsage: PlanUsage;
  currentPeriodEnd: string | null;
}

// Lista de features visible de un plan, derivada del catálogo PLANS.
function featuresFor(p: PlanInfo): string[] {
  const features = [
    p.propertyLimit === 1
      ? "1 propiedad activa"
      : `Hasta ${p.propertyLimit} propiedades activas`,
    "Acceso al mapa de la ciudad",
    "Leads por WhatsApp",
  ];
  if (p.featured) features.push("Propiedades destacadas en el mapa");
  if (p.whiteLabel) features.push("Vista white-label propia");
  if (p.metrics) features.push("Métricas de vistas y leads");
  return features;
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-2.5 mb-6 flex-1">
      {features.map((f) => (
        <li key={f} className="flex items-center gap-2">
          <Check size={16} className="text-success shrink-0" />
          <span className="font-sans text-sm text-graphite">{f}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  info,
  variant,
  onUpgrade,
  endDate,
}: {
  info: PlanInfo;
  variant: "current" | "recommended" | "neutral";
  onUpgrade?: () => void;
  endDate?: string | null;
}) {
  const isCurrent = variant === "current";
  const isRecommended = variant === "recommended";

  return (
    <div
      className={[
        // Ancho fijo cómodo de card de pricing: full en mobile, ~300px de sm en
        // adelante. Igual ancho siempre, sin importar cuántas cards haya.
        "w-full sm:w-[300px] rounded-lg p-6 flex flex-col",
        isRecommended
          ? "bg-terracota-subtle border-2 border-terracota shadow-lg"
          : isCurrent
            ? "bg-paper border-2 border-terracota"
            : "bg-paper border border-stone",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="font-serif text-2xl font-semibold text-black">
          Plan {info.name}
        </h2>
        {isCurrent ? (
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wide bg-terracota-subtle text-terracota rounded-sm px-2.5 py-1 shrink-0">
            Plan actual
          </span>
        ) : isRecommended ? (
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wide bg-terracota text-paper rounded-sm px-2.5 py-1 shrink-0">
            Recomendado ★
          </span>
        ) : null}
      </div>

      <p className="font-serif text-3xl font-bold text-black mb-4">
        {info.priceLabel}
      </p>

      <FeatureList features={featuresFor(info)} />

      {isCurrent ? (
        <>
          <button
            disabled
            className="w-full h-11 rounded-md font-sans text-sm font-medium bg-stone text-graphite cursor-not-allowed"
          >
            Plan actual
          </button>
          {endDate && (
            <p className="font-sans text-xs text-graphite mt-4 pt-4 border-t border-stone">
              Plan activo hasta el {endDate}
            </p>
          )}
        </>
      ) : (
        <button
          onClick={onUpgrade}
          className="w-full h-11 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms]"
        >
          Pasar a {info.name}
        </button>
      )}
    </div>
  );
}

export function SubscriptionContent({
  planUsage,
  currentPeriodEnd,
}: SubscriptionContentProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { plan, used, limit } = planUsage;
  const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  const currentIdx = PLAN_ORDER.indexOf(plan);
  // Planes superiores al actual (las opciones de upgrade); el primero es el "recomendado".
  const upgrades = PLAN_ORDER.slice(currentIdx + 1);

  const endDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <div className="space-y-6">
        {/* Barra de uso del plan actual */}
        <div className="bg-paper border border-stone rounded-lg p-6">
          <p className="font-sans text-sm font-medium text-black mb-1">
            Uso del plan
          </p>
          <p className="font-sans text-sm text-graphite mb-3">
            {used} de {limit} propiedades usadas
          </p>
          <div className="w-full h-2 bg-mist rounded-full overflow-hidden">
            <div
              className="h-full bg-terracota rounded-full transition-all duration-[220ms]"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        {/* Tarjeta del plan actual + opciones de upgrade.
            flex-wrap + justify-center: las cards mantienen ancho fijo y se
            acomodan/centran (2 centradas, 3-4 en filas) sin deformarse.
            items-stretch iguala la altura de las cards de una misma fila. */}
        <div className="flex flex-wrap justify-center gap-6 items-stretch">
          <PlanCard info={PLANS[plan]} variant="current" endDate={endDate} />
          {upgrades.map((p, i) => (
            <PlanCard
              key={p}
              info={PLANS[p]}
              variant={i === 0 ? "recommended" : "neutral"}
              onUpgrade={() => setModalOpen(true)}
            />
          ))}
        </div>
      </div>

      {/* Dialog "Próximamente" (shadcn) — la activación automática aún no existe */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-paper rounded-lg sm:max-w-md gap-4">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-semibold normal-case tracking-normal text-black">
              Próximamente
            </DialogTitle>
            <DialogDescription className="font-sans text-sm text-graphite">
              La activación automática de los planes está en desarrollo. Para
              cambiar de plan ahora, contactanos directamente y lo gestionamos.
            </DialogDescription>
          </DialogHeader>
          <a
            href="mailto:hola@marka.app"
            className="flex items-center justify-center w-full h-11 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms]"
          >
            Escribir a hola@marka.app
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
