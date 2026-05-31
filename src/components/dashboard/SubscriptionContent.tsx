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
import type { PlanUsage } from "@/types";

interface SubscriptionContentProps {
  planUsage: PlanUsage;
  currentPeriodEnd: string | null;
}

const FREE_FEATURES = [
  "Hasta 5 propiedades activas",
  "Acceso al mapa de la ciudad",
  "Leads por WhatsApp",
];

const PRO_FEATURES = [
  "Propiedades ilimitadas",
  "Propiedades destacadas en el mapa",
  "Métricas de vistas por propiedad",
  "Todo lo incluido en el plan Free",
];

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

export function SubscriptionContent({
  planUsage,
  currentPeriodEnd,
}: SubscriptionContentProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { plan, used, limit } = planUsage;
  const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  // Si el agente ya es Pro, mostrar solo su tarjeta activa
  if (plan === "pro") {
    const endDate = currentPeriodEnd
      ? new Date(currentPeriodEnd).toLocaleDateString("es-AR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

    return (
      <div className="max-w-sm">
        <div className="bg-paper border-2 border-terracota rounded-lg p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="font-serif text-2xl font-semibold text-black">Plan Pro</h2>
            <span className="font-sans text-[11px] font-semibold uppercase tracking-wide bg-terracota text-paper rounded-sm px-2.5 py-1 shrink-0">
              Plan actual
            </span>
          </div>
          <ul className="space-y-2.5 mb-4">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check size={16} className="text-success shrink-0" />
                <span className="font-sans text-sm text-graphite">{f}</span>
              </li>
            ))}
          </ul>
          {endDate && (
            <p className="font-sans text-xs text-graphite mt-4 pt-4 border-t border-stone">
              Plan activo hasta el {endDate}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Plan free
  return (
    <>
      <div className="space-y-6">
        {/* Barra de uso */}
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

        {/* Tarjetas de plan — Pro destacado como foco del upgrade */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-stretch">
          {/* Plan Free — actual, en tono neutro (no compite con Pro) */}
          <div className="bg-paper border border-stone rounded-lg p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-serif text-2xl font-semibold text-black">Plan Free</h2>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wide bg-mist text-graphite rounded-sm px-2.5 py-1 shrink-0">
                Plan actual
              </span>
            </div>
            <p className="font-serif text-3xl font-bold text-black mb-4">Gratis</p>
            <FeatureList features={FREE_FEATURES} />
            <button
              disabled
              className="w-full h-11 rounded-md font-sans text-sm font-medium bg-stone text-graphite cursor-not-allowed"
            >
              Plan actual
            </button>
          </div>

          {/* Plan Pro — foco visual: fondo cálido, borde terracota, elevado */}
          <div className="bg-terracota-subtle border-2 border-terracota shadow-lg rounded-lg p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-serif text-2xl font-semibold text-black">Plan Pro</h2>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wide bg-terracota text-paper rounded-sm px-2.5 py-1 shrink-0">
                Recomendado ★
              </span>
            </div>
            <p className="font-serif text-3xl font-bold text-black mb-4">Consultanos</p>
            <FeatureList features={PRO_FEATURES} />
            <button
              onClick={() => setModalOpen(true)}
              className="w-full h-11 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms]"
            >
              Pasar a Pro
            </button>
          </div>
        </div>
      </div>

      {/* Dialog "Próximamente" (shadcn) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-paper rounded-lg sm:max-w-md gap-4">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-semibold normal-case tracking-normal text-black">
              Próximamente
            </DialogTitle>
            <DialogDescription className="font-sans text-sm text-graphite">
              La activación automática del Plan Pro está en desarrollo. Para
              activarlo ahora, contactanos directamente y lo gestionamos.
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
