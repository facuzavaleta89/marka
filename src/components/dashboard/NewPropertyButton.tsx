// src/components/dashboard/NewPropertyButton.tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ApprovalStatus, PlanUsage } from "@/types";
import { PLANS, PLAN_ORDER } from "@/types";
import { getPublishBlock } from "@/lib/utils/getPublishBlock";

interface NewPropertyButtonProps {
  planUsage: PlanUsage;
  approvalStatus: ApprovalStatus;
}

// Atajo "Nueva propiedad" con gate de publicación.
// Server Component presentacional: recibe el PlanUsage ya calculado por
// getPlanUsage() (por agency_id, solo server) — no hace fetch propio.
//
// Dos motivos posibles de bloqueo, con mensajes distintos (DESIGN.md §12: el
// botón NUNCA se oculta, se muestra deshabilitado con un mensaje constructivo):
//   - agencia no aprobada → no se invita a pagar, se explica qué falta;
//   - cupo del plan lleno → se invita al upgrade.
// Confundirlos sería mentirle a alguien sin aprobar diciéndole que llegó a un
// límite que no alcanzó.
export function NewPropertyButton({
  planUsage,
  approvalStatus,
}: NewPropertyButtonProps) {
  const block = getPublishBlock(planUsage, approvalStatus);

  if (!block) {
    return (
      <Link
        href="/dashboard/propiedades/nueva"
        className="inline-flex items-center gap-1.5 h-11 px-4 font-sans text-sm font-medium text-paper bg-terracota hover:bg-terracota-hover rounded-md transition-colors duration-[120ms]"
      >
        <Plus size={20} />
        Nueva propiedad
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <button
        disabled
        aria-disabled="true"
        className="inline-flex items-center gap-1.5 h-11 px-4 font-sans text-sm font-medium text-graphite bg-stone rounded-md cursor-not-allowed"
      >
        <Plus size={20} />
        Nueva propiedad
      </button>
      {block.reason === "not_approved" ? (
        <NotApprovedMessage approvalStatus={approvalStatus} />
      ) : (
        <PlanLimitMessage planUsage={planUsage} />
      )}
    </div>
  );
}

// Agencia sin aprobar: el bloqueo no se resuelve con plata, así que no se
// menciona ningún plan.
function NotApprovedMessage({
  approvalStatus,
}: {
  approvalStatus: ApprovalStatus;
}) {
  if (approvalStatus === "pending") {
    return (
      <p className="font-sans text-xs text-graphite max-w-xs sm:text-right">
        Vas a poder publicar cuando aprobemos tu inmobiliaria. Mientras tanto
        podés completar tus datos.
      </p>
    );
  }

  return (
    <p className="font-sans text-xs text-graphite max-w-xs sm:text-right">
      Tu solicitud no fue aprobada, así que todavía no podés publicar.{" "}
      <Link
        href="/dashboard/preferencias"
        className="text-terracota hover:underline"
      >
        Corregir los datos
      </Link>
    </p>
  );
}

// Cupo lleno: mensaje de upgrade (o de contacto si ya está en el plan tope).
function PlanLimitMessage({ planUsage }: { planUsage: PlanUsage }) {
  // Plan siguiente en el orden free → inicial → profesional → premium.
  // Si el plan actual es premium (tope), no hay siguiente.
  const currentIdx = PLAN_ORDER.indexOf(planUsage.plan);
  const nextPlan =
    currentIdx >= 0 && currentIdx < PLAN_ORDER.length - 1
      ? PLAN_ORDER[currentIdx + 1]
      : null;

  if (nextPlan) {
    return (
      <p className="font-sans text-xs text-graphite max-w-xs sm:text-right">
        Alcanzaste el límite de tu plan {PLANS[planUsage.plan].name}. Pasá a{" "}
        {PLANS[nextPlan].name} para publicar más.{" "}
        <Link
          href="/dashboard/suscripcion"
          className="text-terracota hover:underline"
        >
          Ver planes
        </Link>
      </p>
    );
  }

  // Plan premium (tope, 200 propiedades): no hay upgrade, ofrecer contacto.
  return (
    <p className="font-sans text-xs text-graphite max-w-xs sm:text-right">
      Alcanzaste el máximo de propiedades. Escribinos si necesitás más.{" "}
      <a href="mailto:hola@marka.app" className="text-terracota hover:underline">
        Escribinos
      </a>
    </p>
  );
}
