import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAgentSession } from "@/lib/utils/resolveAgentSession";
import type { SubscriptionPlan } from "@/types";
import { PlanSelector } from "./PlanSelector";

// Paso 2 del registro de una inmobiliaria: elegir plan. La cuenta ya existe
// (creada en free/active por el registro); acá solo se pide el plan pago.
// Es un paso de UNA sola vez: ver la guarda de reentrada más abajo.
export default async function RegisterPlanPage() {
  const supabase = await createClient();

  // Agencia del agente logueado.
  const { agent } = await requireAgentSession();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, pending_plan, status")
    .eq("agency_id", agent.agency_id)
    .single();

  // GUARDA DE REENTRADA. Este paso es SOLO para una agencia recién registrada
  // que todavía no definió nada: su suscripción está en el estado de aterrizaje
  // virgen (rige free, sin plan pedido, activa). Cualquier otra cosa —un plan
  // pago activo, o un pedido esperando activación— significa que la agencia ya
  // pasó por acá, y la pantalla correcta para cambiar de plan es
  // /dashboard/suscripcion (que pide confirmación y NO pisa el plan que rige).
  // Sin esta guarda, volver a esta URL y guardar degradaba la suscripción a free
  // (perdiendo white-label y quedando por encima del límite de propiedades).
  // Sin fila de suscripción tampoco es un alta virgen: se deriva igual.
  const isPristineLanding =
    subscription != null &&
    subscription.plan === "free" &&
    subscription.pending_plan === null &&
    subscription.status === "active";

  if (!isPristineLanding) redirect("/dashboard/suscripcion");

  // Llegado acá el plan que rige es siempre 'free' (el estado de aterrizaje):
  // no hay card que preseleccionar y el selector arranca sin elección.
  const currentPlan: SubscriptionPlan = subscription.plan;

  return <PlanSelector currentPlan={currentPlan} />;
}
