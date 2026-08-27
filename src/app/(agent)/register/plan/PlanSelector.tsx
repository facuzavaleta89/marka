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
  "El plan queda pendiente hasta que confirmemos la activación. Mientras tanto podés empezar a usar la cuenta.";

// Planes OFRECIBLES en el alta: los tres pagos. Se derivan de PLAN_ORDER
// excluyendo 'free', que no es un producto sino el estado de aterrizaje de la
// suscripción (ver PLANS en types). PLAN_ORDER queda intacto: es el dominio de
// la columna `plan`, no el catálogo de venta.
const PAID_PLANS = PLAN_ORDER.filter((id) => id !== "free");

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
  // Preselección: solo si el plan que trae la página es uno de los ofrecibles.
  // Con el estado de aterrizaje (plan 'free', sin pedido) no hay card que
  // preseleccionar → arranca en null y "Continuar" queda deshabilitado hasta
  // que la agencia elija. Nunca se manda 'free' a la action.
  const [selected, setSelected] = useState<SubscriptionPlan | null>(
    currentPlan === "free" ? null : currentPlan
  );
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const onContinue = async () => {
    if (!selected) return;
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
        Si preferís, podés decidirlo más tarde desde tu panel.
      </p>

      {/* Cards seleccionables — mismo estilo que el selector del registro
          (activo terracota/paper, inactivo stone/hover mist). */}
      <div className="space-y-3" role="radiogroup" aria-label="Plan">
        {PAID_PLANS.map((id) => {
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
        disabled={loading || !selected}
        className="w-full bg-terracota hover:bg-terracota-hover text-paper border-0 mt-6 disabled:opacity-40"
      >
        {loading ? "Guardando..." : "Continuar"}
      </Button>

      {/* Omitir: el registro ya dejó la cuenta en su estado de aterrizaje
          (free/active), así que ir al dashboard sin guardar la deja igual. El
          plan se puede elegir después desde /dashboard/suscripcion. */}
      <Link
        href="/dashboard"
        className="mt-4 block text-center font-sans text-sm text-graphite transition-colors duration-[120ms] ease-out hover:text-terracota"
      >
        Decidir más tarde
      </Link>
    </AuthLayout>
  );
}
