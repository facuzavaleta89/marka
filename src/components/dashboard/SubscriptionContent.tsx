"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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

        {/* Tarjetas de plan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plan Free — actual */}
          <div className="bg-paper border-2 border-terracota rounded-lg p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-serif text-2xl font-semibold text-black">Plan Free</h2>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wide bg-terracota text-paper rounded-sm px-2.5 py-1 shrink-0">
                Plan actual
              </span>
            </div>
            <p className="font-serif text-3xl font-bold text-black mb-4">Gratis</p>
            <ul className="space-y-2.5 mb-6 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check size={16} className="text-success shrink-0" />
                  <span className="font-sans text-sm text-graphite">{f}</span>
                </li>
              ))}
            </ul>
            <button
              disabled
              className="w-full h-11 rounded-md font-sans text-sm font-medium bg-stone text-graphite cursor-not-allowed"
            >
              Plan actual
            </button>
          </div>

          {/* Plan Pro */}
          <div className="bg-paper border border-stone rounded-lg p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-serif text-2xl font-semibold text-black">Plan Pro</h2>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wide bg-terracota text-paper rounded-sm px-2.5 py-1 shrink-0">
                Recomendado ★
              </span>
            </div>
            <p className="font-serif text-3xl font-bold text-black mb-4">Consultanos</p>
            <ul className="space-y-2.5 mb-6 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check size={16} className="text-success shrink-0" />
                  <span className="font-sans text-sm text-graphite">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setModalOpen(true)}
              className="w-full h-11 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms]"
            >
              Pasar a Pro
            </button>
          </div>
        </div>
      </div>

      {/* Modal "Próximamente" */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-paper rounded-lg shadow-lg p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-2xl font-semibold text-black mb-3">
              Próximamente
            </h3>
            <p className="font-sans text-sm text-graphite mb-6">
              La activación automática del Plan Pro está en desarrollo. Para activarlo
              ahora, contactanos directamente y lo gestionamos.
            </p>
            <a
              href="mailto:hola@marka.app"
              className="flex items-center justify-center w-full h-11 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] mb-3"
            >
              Escribir a hola@marka.app
            </a>
            <button
              onClick={() => setModalOpen(false)}
              className="w-full font-sans text-sm text-graphite hover:text-black transition-colors duration-[120ms] py-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
