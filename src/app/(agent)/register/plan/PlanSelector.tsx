"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { cn } from "@/lib/utils";
import { PLANS, PLAN_ORDER, type PlanInfo, type SubscriptionPlan } from "@/types";
import { selectPlanAction } from "./actions";

// Claim del panel de identidad (voz DESIGN §10: directo, sin marketing).
const CLAIM = "Elegí el plan de tu inmobiliaria.";
const SUBCLAIM =
  "Free se activa al instante. Los planes pagos quedan pendientes hasta que confirmemos la activación.";

// Features visibles de un plan, derivadas del catálogo PLANS. Selector propio:
// no se reusa el PlanCard del dashboard (queda intacto).
function planFeatures(p: PlanInfo): string[] {
  const features = [
    p.propertyLimit === 1
      ? "1 propiedad activa"
      : `Hasta ${p.propertyLimit} propiedades activas`,
  ];
  if (p.featured) features.push("Destacados en el mapa");
  if (p.whiteLabel) features.push("Vista white-label propia");
  if (p.metrics) features.push("Métricas de vistas y leads");
  return features;
}

export function PlanSelector({
  currentPlan,
}: {
  currentPlan: SubscriptionPlan;
}) {
  const [selected, setSelected] = useState<SubscriptionPlan>(currentPlan);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const onContinue = async () => {
    setLoading(true);
    setServerError(null);
    const result = await selectPlanAction(selected);
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
    // En caso de éxito, selectPlanAction llama a redirect() server-side.
  };

  return (
    <AuthLayout claim={CLAIM} subclaim={SUBCLAIM}>
      <h2 className="font-serif text-3xl font-semibold text-black mb-1.5">
        Elegí tu plan
      </h2>
      <p className="font-sans text-sm text-graphite mb-7">
        Podés empezar en free y pasar a un plan pago cuando quieras.
      </p>

      {/* Cards seleccionables — mismo estilo que el selector del registro
          (activo terracota/paper, inactivo stone/hover mist). */}
      <div className="space-y-3" role="radiogroup" aria-label="Plan">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              role="radio"
              aria-checked={active}
              className={cn(
                "flex w-full flex-col gap-2 rounded-md border p-4 text-left transition-colors duration-[120ms] ease-out",
                active
                  ? "border-terracota bg-terracota text-paper"
                  : "border-stone bg-transparent text-graphite hover:bg-mist"
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    "font-serif text-lg font-semibold leading-tight",
                    active ? "text-paper" : "text-black"
                  )}
                >
                  {plan.name}
                </span>
                <span className="font-sans text-sm font-medium">
                  {plan.priceLabel}
                </span>
              </div>
              <ul className="space-y-1">
                {planFeatures(plan).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check
                      size={14}
                      className={cn(
                        "shrink-0",
                        active ? "text-paper" : "text-success"
                      )}
                    />
                    <span
                      className={cn(
                        "font-sans text-xs",
                        active ? "text-paper/90" : "text-graphite"
                      )}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {serverError && (
        <p className="font-sans text-sm text-error bg-terracota-subtle rounded-md px-3 py-2 mt-5">
          {serverError}
        </p>
      )}

      <Button
        type="button"
        onClick={onContinue}
        disabled={loading}
        className="w-full bg-terracota hover:bg-terracota-hover text-paper border-0 mt-6"
      >
        {loading ? "Guardando..." : "Continuar"}
      </Button>

      {/* Omitir: el registro ya dejó la cuenta en free/active, así que ir al
          dashboard sin guardar deja el plan free tal cual. */}
      <Link
        href="/dashboard"
        className="mt-4 block text-center font-sans text-sm text-graphite transition-colors duration-[120ms] ease-out hover:text-terracota"
      >
        Por ahora sigo en free
      </Link>
    </AuthLayout>
  );
}
