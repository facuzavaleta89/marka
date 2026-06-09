// src/components/dashboard/SubscriptionContent.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
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
import type {
  PlanInfo,
  PlanUsage,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/types";
import { PLANS, PLAN_ORDER } from "@/types";
import { requestPlanUpgradeAction } from "@/app/(agent)/dashboard/suscripcion/actions";

interface SubscriptionContentProps {
  // planUsage.plan es el plan que RIGE (efectivo); nunca el pedido.
  planUsage: PlanUsage;
  status: SubscriptionStatus;
  // Plan pago pedido esperando activación; null si no hay nada pendiente.
  pendingPlan: SubscriptionPlan | null;
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
  // Esta card es la del plan PEDIDO (pending_plan): muestra el estado en vez del CTA.
  isPendingCard,
  // Hay un pedido pendiente en la suscripción: las demás cards de upgrade se
  // deshabilitan (no se puede pedir dos a la vez).
  hasPendingRequest,
  onRequest,
  endDate,
}: {
  info: PlanInfo;
  variant: "current" | "recommended" | "neutral";
  isPendingCard: boolean;
  hasPendingRequest: boolean;
  onRequest?: (info: PlanInfo) => void;
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
        isPendingCard
          ? "bg-terracota-subtle border-2 border-terracota shadow-lg"
          : isRecommended
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
        ) : isPendingCard ? (
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wide bg-terracota text-paper rounded-sm px-2.5 py-1 shrink-0">
            Pendiente
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
        // Card del plan que rige hoy.
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
      ) : isPendingCard ? (
        // Card del plan pedido: estado pendiente + salida para cancelar.
        <>
          <button
            disabled
            className="w-full h-11 rounded-md font-sans text-sm font-medium bg-stone text-graphite cursor-not-allowed"
          >
            Pendiente
          </button>
          <p className="font-sans text-xs text-graphite mt-4 pt-4 border-t border-stone">
            Pendiente de activación ·{" "}
            <a
              href="mailto:hola@marka.app"
              className="text-terracota hover:underline"
            >
              escribinos
            </a>{" "}
            para cancelar
          </p>
        </>
      ) : (
        // Card de upgrade. Si ya hay un pedido pendiente, se deshabilita.
        <button
          onClick={() => onRequest?.(info)}
          disabled={hasPendingRequest}
          className={[
            "w-full h-11 rounded-md font-sans text-sm font-medium transition-colors duration-[120ms]",
            hasPendingRequest
              ? "bg-stone text-graphite cursor-not-allowed"
              : "bg-terracota hover:bg-terracota-hover text-paper",
          ].join(" ")}
        >
          Pasar a {info.name}
        </button>
      )}
    </div>
  );
}

export function SubscriptionContent({
  planUsage,
  status,
  pendingPlan,
  currentPeriodEnd,
}: SubscriptionContentProps) {
  const router = useRouter();
  const [toRequest, setToRequest] = useState<PlanInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const { plan, used, limit } = planUsage;
  const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  // Hay un upgrade pedido esperando activación manual del admin. El plan que
  // rige (`plan`) NO cambia mientras tanto; `pendingPlan` es solo el pedido.
  const hasPendingRequest = status === "pending" && pendingPlan !== null;

  const currentIdx = PLAN_ORDER.indexOf(plan);
  // Planes superiores al que rige (las opciones de upgrade); el primero es el "recomendado".
  const upgrades = PLAN_ORDER.slice(currentIdx + 1);

  const endDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const confirmRequest = () => {
    if (!toRequest) return;
    const planId = toRequest.id;
    setToRequest(null);
    setError(null);
    startTransition(async () => {
      const result = await requestPlanUpgradeAction(planId);
      if (result?.error) {
        setError(result.error);
      } else {
        // Quedó pending_plan registrado → refrescar para reflejar el estado.
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="space-y-6">
        {/* Barra de uso del plan que rige */}
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

        {/* Banner de error */}
        {error && (
          <div className="flex items-start gap-3 bg-terracota-subtle border border-terracota/20 rounded-md px-4 py-3">
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

        {/* Tarjeta del plan que rige + opciones de upgrade.
            flex-wrap + justify-center: las cards mantienen ancho fijo y se
            acomodan/centran (2 centradas, 3-4 en filas) sin deformarse.
            items-stretch iguala la altura de las cards de una misma fila. */}
        <div className="flex flex-wrap justify-center gap-6 items-stretch">
          <PlanCard
            info={PLANS[plan]}
            variant="current"
            isPendingCard={false}
            hasPendingRequest={hasPendingRequest}
            endDate={endDate}
          />
          {upgrades.map((p, i) => (
            <PlanCard
              key={p}
              info={PLANS[p]}
              variant={i === 0 ? "recommended" : "neutral"}
              isPendingCard={pendingPlan === p}
              hasPendingRequest={hasPendingRequest}
              onRequest={setToRequest}
            />
          ))}
        </div>
      </div>

      {/* AlertDialog de confirmación del pedido de upgrade */}
      <AlertDialog
        open={!!toRequest}
        onOpenChange={(open) => !open && setToRequest(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Pedir el plan {toRequest?.name ?? ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Te vamos a contactar para coordinar el pago. Mientras tanto seguís
              con tu plan actual sin cambios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRequest}
              disabled={isSubmitting}
              className="bg-terracota text-paper hover:bg-terracota-hover border-0"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
