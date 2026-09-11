import Link from "next/link";
import { Clock, PauseCircle } from "lucide-react";
import { Notice } from "@/components/feedback/Notice";
import type { VisibilityBlockReason } from "@/lib/utils/getVisibilityBlock";

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
  return (
    <Notice
      tone="info"
      title="Tus propiedades todavía no se ven en el mapa"
      icon={<Clock size={18} />}
    >
      <span className="block">
        Tu plan todavía no está activo. Seguí cargando tus propiedades con
        tranquilidad:{" "}
        <strong className="text-black">
          se publican solas apenas lo activemos
        </strong>
        , sin que tengas que volver a tocarlas.
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
