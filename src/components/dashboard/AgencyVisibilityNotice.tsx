import Link from "next/link";
import { Clock, PauseCircle } from "lucide-react";
import { Notice } from "@/components/feedback/Notice";
import { PLANS } from "@/types";
import type { VisibilityBlockReason } from "@/lib/utils/getVisibilityBlock";

// El cupo que tiene una agencia cuyo plan todavía no está activo, DERIVADO del
// catálogo y no escrito a mano en la prosa del cartel.
//
// ⚠ POR QUÉ SE DERIVA Y NO SE TIPEA. El número ya vive en dos lugares —el
// catálogo (`PLANS.free.propertyLimit`) y el DEFAULT de
// `subscriptions.property_limit` en la base, medidos y coincidentes en 1—, y un
// tercero escrito en una frase es la copia que nadie va a acordarse de
// actualizar: el día que el aterrizaje cambie de cupo, el cartel mentiría sin
// que falle nada. Es el mismo criterio que ya usan `SubscriptionContent` y
// `PlanSelector` para listar los límites de cada plan, con la misma forma de
// singular/plural.
//
// ⚠ POR QUÉ ES EL DE `free` Y NO EL DE LA FILA DE ESA AGENCIA. Los dos caminos
// que producen este motivo escriben los límites de free: `registerAction` y
// `selectPlanAction` ponen `property_limit: PLANS.free.propertyLimit`, y el
// trigger `ensure_agency_subscription` deja el DEFAULT de la columna. O sea que
// en este estado el cupo ES el de free, por construcción y no por casualidad.
const FREE_LIMIT_LABEL =
  PLANS.free.propertyLimit === 1
    ? "una sola propiedad"
    : `${PLANS.free.propertyLimit} propiedades`;

// Aviso de que las propiedades de la agencia NO se están mostrando en el mapa
// público. Presentacional puro: recibe el motivo ya resuelto en el server y no
// consulta nada (mismo molde que AgencyApprovalNotice).
//
// ⚠ EL CARTEL DICE LA CONSECUENCIA, NO EL ESTADO ADMINISTRATIVO. Quien lo lee es
// un corredor inmobiliario: le importa que sus propiedades no se están viendo,
// no que una columna diga 'canceled'. El título es siempre lo que le pasa a su
// trabajo; el motivo va en el cuerpo.
//
// ⚠ ACÁ NO ENTRA EL MOTIVO DE APROBACIÓN, y el tipo lo impide: ese caso ya lo
// resuelve `AgencyApprovalNotice`, y mostrar los dos carteles a la vez sería
// decir lo mismo dos veces con otras palabras. El `Exclude` de la prop convierte
// esa regla en un error de compilación en vez de una convención que se olvida.
export function AgencyVisibilityNotice({
  reason,
}: {
  reason: Exclude<VisibilityBlockReason, "not_approved">;
}) {
  // ── Suscripción dada de baja o vencida ────────────────────────
  //
  // ⚠ TONO `warning`, NUNCA `error`, y el motivo está en el precedente de
  // `SubscriptionContent`: puede ser una baja acordada, una prueba que terminó o
  // un pago pendiente. El sistema no sabe cuál, así que no acusa a nadie.
  //
  // ⚠ Y DICE EXPLÍCITAMENTE QUE NO SE PERDIÓ NADA. Es lo segundo que esa persona
  // necesita leer: el miedo real frente a "no se ven tus propiedades" es haber
  // perdido el trabajo de cargarlas.
  //
  // El texto es la versión corta del que ya vive en /dashboard/suscripcion: los
  // mismos dos tiempos (qué pasa · qué NO se perdió) y el enlace a esa pantalla,
  // donde están el detalle completo y el correo de contacto. No se repite todo
  // acá para que los dos carteles no digan lo mismo con otras palabras.
  if (reason === "not_current") {
    return (
      <Notice
        tone="warning"
        title="Tus propiedades no se están mostrando en el mapa"
        icon={<PauseCircle size={18} />}
      >
        <span className="block">
          Tu suscripción no está activa, así que por ahora tus propiedades
          salieron del mapa público.{" "}
          <strong className="text-black">Tus datos están intactos:</strong> tus
          propiedades, tus fotos y tu equipo siguen acá, y vuelven a verse apenas
          se reactive.
        </span>
        <Link
          href="/dashboard/suscripcion"
          className="mt-2 inline-block font-medium text-terracota hover:underline"
        >
          Ver mi suscripción
        </Link>
      </Notice>
    );
  }

  // ── Plan todavía sin activar ──────────────────────────────────
  //
  // ⚠ TONO `info`, Y ESTO NO ES NEGOCIABLE: este es el estado NORMAL de una
  // cuenta recién creada, porque el plan lo activa a mano el dueño de la
  // plataforma. No falló nada y nadie hizo nada mal. Un tono de error o de
  // advertencia frenaría justo a la agencia que queremos que cargue su cartera
  // —que es el trabajo que más nos importa que haga esta semana—.
  //
  // Por eso el cuerpo invita a seguir: "seguí cargando" antes que cualquier otra
  // cosa, y la promesa de que se publican solas.
  //
  // Cubre DOS situaciones con un solo texto, y por eso no nombra el plan que
  // tiene: la agencia que todavía no eligió ninguno (`free` + `active`) y la que
  // ya lo pidió y espera la activación (`pending`). "Tu plan todavía no está
  // activo" es cierto en las dos.
  //
  // ══════════════════════════════════════════════════════════
  // ⚠ EL CARTEL DECÍA "SEGUÍ CARGANDO TUS PROPIEDADES" Y ERA UNA PROMESA FALSA.
  // ══════════════════════════════════════════════════════════
  //
  // En este estado el cupo es de UNA propiedad, así que la agencia cargaba la
  // primera con ese aliento, iba a cargar la segunda, y la frenaba la base con
  // "Alcanzaste el límite de propiedades de tu plan" — un mensaje que después de
  // leer "seguí cargando" suena a error cuando no lo es. El cupo no se cambió:
  // se cambió el texto, para que diga la verdad.
  //
  // ⚠ Y HAY UNA COSA QUE ESTE TEXTO NO PUEDE DECIR NI SUGERIR: que esa primera
  // propiedad sea "de prueba", un "ejemplo" o algo descartable. NO se borra
  // nunca: cuando el plan se active queda publicada como una más. Si la agencia
  // la carga creyendo que es un simulacro va a poner cualquier cosa, y esa
  // cualquier cosa termina en el mapa público con su nombre. Por eso el cuerpo
  // afirma lo contrario en positivo —"queda guardada tal cual", "se publica
  // sola"— en vez de negar la palabra "prueba", que plantearla ya la sugiere.
  return (
    <Notice
      tone="info"
      title="Tus propiedades todavía no se ven en el mapa"
      icon={<Clock size={18} />}
    >
      <span className="block">
        <strong className="text-black">
          Ya podés cargar tu primera propiedad
        </strong>
        , así vas conociendo el formulario. Por ahora el límite es de{" "}
        {FREE_LIMIT_LABEL}, porque tu plan todavía no está activo.
      </span>
      <span className="mt-1.5 block">
        La que cargues queda guardada tal cual y{" "}
        <strong className="text-black">se publica sola cuando lo activemos</strong>
        , sin que tengas que volver a tocarla. Ahí vas a poder cargar el resto de
        tu cartera.
      </span>
      <Link
        href="/dashboard/suscripcion"
        className="mt-2 inline-block font-medium text-terracota hover:underline"
      >
        Ver mi suscripción
      </Link>
    </Notice>
  );
}
