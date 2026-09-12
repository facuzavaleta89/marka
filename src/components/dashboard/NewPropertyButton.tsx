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
// TRES motivos posibles de bloqueo (DESIGN.md §12: el botón NUNCA se oculta, se
// muestra deshabilitado con un mensaje constructivo), pero CUATRO mensajes,
// porque el del cupo se parte según qué plan tenga:
//   - agencia no aprobada      → no se invita a pagar, se explica qué falta;
//   - suscripción dada de baja → no se invita a pagar MÁS, se explica cómo
//                                reactivar lo que ya tenía;
//   - cupo lleno con plan de venta → se invita al upgrade (canal de venta
//                                legítimo: pasar de plan SÍ la destraba);
//   - cupo lleno en el aterrizaje  → NO se invita a nada: lo que la destraba es
//                                que le activen el plan, no comprar uno mayor.
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

// Cupo lleno. TRES mensajes, no uno: plan de aterrizaje (no se invita a nada),
// plan de venta con uno mayor disponible (se invita al upgrade) y plan tope
// (se ofrece contacto).
function PlanLimitMessage({ planUsage }: { planUsage: PlanUsage }) {
  // ── Estado de aterrizaje: aprobada, con el plan todavía sin activar ──
  //
  // ⚠ ACÁ CAÍA EN LA RAMA DEL UPGRADE Y LE DECÍA "Alcanzaste el límite de tu plan
  // Gratis. Pasá a Inicial para publicar más". Era el bloqueo correcto con el
  // mensaje equivocado: a esta agencia **pasar de plan no le destraba nada**, y
  // se lo proponía en el momento exacto en que está esperando otra cosa —que el
  // dueño de la plataforma le active el plan que ya pidió, o que se lo asigne—.
  //
  // ⚠ ES LA SEGUNDA VEZ QUE ESTE COMPONENTE COMETE ESTE MISMO ERROR, y la primera
  // está documentada arriba, en el encabezado: cuando se agregó
  // 'subscription_inactive', una agencia dada de baja leía exactamente esta misma
  // frase. Entonces la causa fue un ternario sin rama; ahora es una rama que
  // ramifica por el plan siguiente en el catálogo sin preguntarse si ese plan
  // resuelve algo. **El patrón a vigilar: antes de invitar a pagar, verificar que
  // pagar sea lo que destraba.**
  //
  // `plan === "free"` es la condición exacta y no una aproximación: para llegar a
  // este mensaje `getPublishBlock` ya descartó que la agencia esté sin aprobar y
  // que su suscripción esté dada de baja o vencida, así que "aprobada + al día +
  // plan free + cupo lleno" ES el aterrizaje.
  //
  // ⚠ UN SOLO TEXTO PARA LAS DOS SITUACIONES del aterrizaje (ya pidió un plan y
  // espera la activación, o todavía no eligió ninguno). El dato para separarlas
  // existe —`planUsage.status` vale 'pending' en la primera y 'active' en la
  // segunda—, pero el cartel de la pantalla principal las cubre con un texto
  // único a propósito, y estas dos pantallas TIENEN que contar la misma historia:
  // si una dice "esperá tranquila" y la otra "elegí un plan", la agencia no
  // entiende nada. El enlace a la suscripción cubre las dos (ahí la que pidió ve
  // su pedido en "Pendiente" y la que no eligió ve los planes).
  //
  // La última frase es la MISMA que cierra ese cartel —"vas a poder cargar el
  // resto de tu cartera"— para que se lean como una sola conversación.
  if (planUsage.plan === "free") {
    return (
      <p className="font-sans text-xs text-graphite max-w-xs sm:text-right">
        Llegaste al límite de lo que podés cargar por ahora. Cuando activemos tu
        plan vas a poder cargar el resto de tu cartera.{" "}
        <Link
          href="/dashboard/suscripcion"
          className="text-terracota hover:underline"
        >
          Ver mi suscripción
        </Link>
      </p>
    );
  }

  // Plan siguiente en el orden free → inicial → profesional → premium.
  // Si el plan actual es premium (tope), no hay siguiente.
  //
  // ⚠ Llegado acá el plan es de VENTA (free se fue arriba), así que invitar al
  // upgrade es correcto: para publicar más efectivamente tiene que pasar a uno
  // mayor. Es un canal de venta legítimo y no se toca.
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
