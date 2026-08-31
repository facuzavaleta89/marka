// src/components/dashboard/NewPropertyButton.tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ApprovalStatus, PlanUsage } from "@/types";
import { PLANS, PLAN_ORDER } from "@/types";
import {
  getPublishBlock,
  type PublishBlockReason,
} from "@/lib/utils/getPublishBlock";

interface NewPropertyButtonProps {
  planUsage: PlanUsage;
  approvalStatus: ApprovalStatus;
}

// Atajo "Nueva propiedad" con gate de publicación.
// Server Component presentacional: recibe el PlanUsage ya calculado por
// getPlanUsage() (por agency_id, solo server) — no hace fetch propio.
//
// TRES motivos posibles de bloqueo, cada uno con su mensaje (DESIGN.md §12: el
// botón NUNCA se oculta, se muestra deshabilitado con un mensaje constructivo):
//   - agencia no aprobada     → no se invita a pagar, se explica qué falta;
//   - suscripción dada de baja → no se invita a pagar MÁS, se explica cómo
//                                reactivar lo que ya tenía;
//   - cupo del plan lleno      → se invita al upgrade.
// Confundirlos es mentirle a la persona y mandarla a resolver algo que no la
// destraba.
//
// ⚠ EL REPARTO ES EXHAUSTIVO A PROPÓSITO (switch con guarda `never`). Antes esto
// era un ternario binario: "¿es not_approved? si no, mostrá el mensaje de cupo".
// Cuando se agregó el motivo 'subscription_inactive', cayó en el `else` y una
// agencia dada de baja veía "alcanzaste el límite de tu plan Gratis, pasá a
// Inicial" —el bloqueo correcto, con el mensaje equivocado, invitándola a pagar
// un upgrade que no le destraba nada—. Con el switch exhaustivo, agregar un
// motivo nuevo sin darle mensaje NO compila.
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
      <BlockMessage
        reason={block.reason}
        planUsage={planUsage}
        approvalStatus={approvalStatus}
      />
    </div>
  );
}

// Despacho por motivo. El `never` del default es lo que obliga a que todo motivo
// nuevo de PublishBlockReason tenga su mensaje: si se agrega uno y no se lo
// contempla acá, TypeScript no deja compilar.
function BlockMessage({
  reason,
  planUsage,
  approvalStatus,
}: {
  reason: PublishBlockReason;
  planUsage: PlanUsage;
  approvalStatus: ApprovalStatus;
}) {
  switch (reason) {
    case "not_approved":
      return <NotApprovedMessage approvalStatus={approvalStatus} />;
    case "subscription_inactive":
      return <SubscriptionInactiveMessage status={planUsage.status} />;
    case "plan_limit":
      return <PlanLimitMessage planUsage={planUsage} />;
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

// Suscripción dada de baja o vencida: NO se ofrece un upgrade. Lo que destraba
// esto es reactivar lo que la agencia ya tenía, no comprar un plan mayor, así
// que el enlace va a su pantalla de suscripción (donde el aviso explica el
// estado completo) y no a la lista de planes.
function SubscriptionInactiveMessage({
  status,
}: {
  status: PlanUsage["status"];
}) {
  return (
    <p className="font-sans text-xs text-graphite max-w-xs sm:text-right">
      {status === "canceled"
        ? "Tu suscripción está dada de baja, así que no podés publicar."
        : "Tu suscripción está vencida, así que no podés publicar."}{" "}
      <Link
        href="/dashboard/suscripcion"
        className="text-terracota hover:underline"
      >
        Ver mi suscripción
      </Link>
    </p>
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
