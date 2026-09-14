import Link from "next/link";
import { Clock, ShieldX, CreditCard, Sparkles, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import type { AgencyDisabledReason } from "@/lib/utils/resolveAgencyBySlug";

// ─── El sitio apagado, visto por SU PROPIO ADMINISTRADOR ──────
//
// La misma dirección que para cualquier visitante muestra `AgencyUnavailable`
// —un cartel neutro, sin un solo dato de la cuenta— acá muestra el motivo real y
// qué hacer. Es probable que el admin entre: es su propia dirección y la va a
// tener en un marcador.
//
// ⚠ SOLO EL ADMIN DE **ESA** AGENCIA. Un agente común de la misma agencia no
// gestiona la suscripción, así que no le sirve y no le corresponde; y cualquier
// otra persona —logueada o no— no tiene por qué enterarse de la situación
// comercial de una inmobiliaria. La comparación la hace la ruta contra la
// sesión del servidor.
//
// ══════════════════════════════════════════════════════════════
// ⚠ UN MENSAJE POR MOTIVO, NO UNO GENÉRICO CON EL MOTIVO PEGADO
// ══════════════════════════════════════════════════════════════
//
// Lo que la agencia tiene que hacer es distinto en cada caso, así que el texto
// tiene que decir eso y no "tu sitio está apagado (motivo: X)". La división que
// gobierna los seis textos:
//
//   · LO QUE PUEDE RESOLVER ELLA  → se le da el botón que lleva a la pantalla
//     donde se resuelve: corregir los datos, ver la suscripción, ver los planes.
//   · LO QUE DEPENDE DEL DUEÑO    → NO se le da ningún botón de acción. Un botón
//     que no destraba nada es peor que ninguno: la manda a dar una vuelta para
//     volver al mismo lugar. Se le dice qué está pasando y que no tiene que
//     hacer nada.

type AdminMessage = {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  /** Solo para los motivos que la agencia puede resolver por su cuenta. */
  action?: { href: string; label: string };
};

// ⚠ Record EXHAUSTIVO sobre el tipo del motivo: agregar un motivo nuevo a
// `AgencyDisabledReason` sin escribirle su mensaje NO COMPILA. Es la misma
// garantía que el `switch` con guarda `never` de `NewPropertyButton`, que existe
// porque un motivo nuevo cayó una vez en el `else` de un ternario y una agencia
// dada de baja terminó leyendo el mensaje del cupo del plan.
const MESSAGES: Record<AgencyDisabledReason, (agencyName: string) => AdminMessage> = {
  // ── Depende de ELLA ────────────────────────────────────────
  rejected: () => ({
    icon: <ShieldX size={20} />,
    title: "Tu sitio está apagado porque tu solicitud no fue aprobada",
    body: (
      <>
        Revisamos los datos de tu inmobiliaria y no pudimos aprobarla. En
        Preferencias vas a ver el motivo. Corregí lo que haga falta y tu
        solicitud vuelve a revisión sola, sin que tengas que avisarnos.
      </>
    ),
    action: { href: "/dashboard/preferencias", label: "Corregir los datos" },
  }),

  subscription_inactive: () => ({
    icon: <CreditCard size={20} />,
    title: "Tu sitio está apagado porque tu suscripción no está al día",
    body: (
      <>
        Mientras siga así, tu sitio no se muestra y tus propiedades tampoco
        aparecen en el mapa general.{" "}
        <span className="text-black">No perdiste nada</span>: tus propiedades,
        tus fotos y tus consultas siguen donde las dejaste, y vuelven a verse
        apenas se reactive.
      </>
    ),
    action: { href: "/dashboard/suscripcion", label: "Ver mi suscripción" },
  }),

  // ⚠ ACÁ SÍ CORRESPONDE INVITAR A PAGAR MÁS, y es el único de los seis. La
  // regla del proyecto es "antes de invitar a pagar más, verificar que pagar sea
  // lo que destraba" — y en este motivo lo es: la agencia está aprobada y al
  // día, y lo único que le falta es un plan que incluya el sitio propio. En los
  // otros cinco, pasar de plan no enciende nada.
  no_white_label: () => ({
    icon: <Sparkles size={20} />,
    title: "Tu plan no incluye sitio propio",
    body: (
      <>
        Tu inmobiliaria está al día, pero la web propia viene con los planes
        Profesional y Premium. Mientras tanto{" "}
        <span className="text-black">
          tus propiedades siguen publicadas en el mapa general
        </span>{" "}
        de tu ciudad, con tu nombre y tu logo en cada una.
      </>
    ),
    action: { href: "/dashboard/suscripcion", label: "Ver los planes" },
  }),

  // ── Depende del DUEÑO DE LA PLATAFORMA — sin botón ─────────
  not_approved: () => ({
    icon: <Clock size={20} />,
    title: "Tu sitio se enciende cuando aprobemos tu inmobiliaria",
    body: (
      <>
        Estamos verificando tu matrícula en el colegio de corredores.{" "}
        <span className="text-black">No tenés que hacer nada</span>: cuando
        quede aprobada, tu sitio y tus propiedades aparecen solos. Mientras
        tanto podés ir completando los datos de tu inmobiliaria.
      </>
    ),
  }),

  plan_not_active: () => ({
    icon: <Clock size={20} />,
    title: "Tu sitio se enciende cuando activemos tu plan",
    body: (
      <>
        Tu plan todavía no está activo, así que tu sitio no se muestra. Lo
        activamos a mano y{" "}
        <span className="text-black">no tenés que hacer nada</span>. Mientras
        tanto podés ir cargando tu cartera: lo que cargues queda guardado tal
        cual y se publica solo cuando lo activemos.
      </>
    ),
  }),

  // ── Cajón de sastre ────────────────────────────────────────
  // No inventa un motivo que no conoce. Es lo único que ofrece escribirnos,
  // porque es lo único que efectivamente destraba un problema nuestro.
  unavailable: () => ({
    icon: <TriangleAlert size={20} />,
    title: "No pudimos cargar tu sitio",
    body: (
      <>
        Algo de nuestro lado no está funcionando como debería. Probá de nuevo en
        un rato; si sigue igual,{" "}
        <a
          href="mailto:hola@marka.app"
          className="font-medium text-terracota hover:underline"
        >
          escribinos
        </a>{" "}
        y lo resolvemos.
      </>
    ),
  }),
};

export function AgencyUnavailableForAdmin({
  agencyName,
  reason,
}: {
  agencyName: string;
  reason: AgencyDisabledReason;
}) {
  const message = MESSAGES[reason](agencyName);

  return (
    // ⚠ `h-dvh overflow-y-auto` en el contenedor y `min-h-full` en el hijo que
    // centra — NUNCA `min-h-dvh`. El documento tiene el scroll bloqueado
    // (globals.css), así que un `min-h-dvh` deja crecer el contenido y delega el
    // scroll a un documento que no scrollea: el final de la pantalla queda
    // INALCANZABLE, sin barra rota y sin error. Es la trampa que ya documenta
    // CLAUDE.md y que esta pantalla podía sufrir de verdad, porque tiene bastante
    // más texto que el cartel genérico.
    <div className="h-dvh overflow-y-auto bg-paper">
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
        <Link href="/" aria-label="Ir al mapa" className="mb-8">
          <Wordmark size="lg" variant="dark" />
        </Link>

        <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-wider text-graphite">
          {agencyName}
        </p>

        <div className="mb-3 text-terracota">{message.icon}</div>

        <h1 className="mb-3 max-w-lg font-serif text-3xl font-semibold leading-tight text-black">
          {message.title}
        </h1>

        <p className="mb-6 max-w-md font-sans text-[15px] leading-relaxed text-graphite">
          {message.body}
        </p>

        {/* ⚠ QUE SEPA QUE ESTO NO LO VE NADIE MÁS.
            Sin esta línea, un corredor que abre su propia dirección y lee "tu
            suscripción no está al día" asume que sus clientes están leyendo lo
            mismo — y es exactamente lo contrario de lo que pasa. Es la frase que
            convierte una pantalla alarmante en una útil. */}
        <p className="mb-8 max-w-md font-sans text-xs leading-relaxed text-stone">
          Solo vos ves este mensaje. Quien entre a esta dirección ve un aviso
          neutro, sin ningún dato de tu cuenta.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {message.action ? (
            <>
              <Link
                href={message.action.href}
                className="inline-flex h-11 items-center rounded-md bg-terracota px-5 font-sans text-sm font-medium text-paper transition-colors duration-[120ms] hover:bg-terracota-hover"
              >
                {message.action.label}
              </Link>
              <Link
                href="/"
                className="inline-flex h-11 items-center px-2 font-sans text-sm font-medium text-graphite transition-colors duration-[120ms] hover:text-black"
              >
                Ir al mapa
              </Link>
            </>
          ) : (
            // Sin acción propia: el único destino es el panel, y va en
            // secundario porque tampoco resuelve el bloqueo — solo es adonde la
            // persona seguiría trabajando mientras espera.
            <>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center rounded-md border border-stone px-5 font-sans text-sm font-medium text-black transition-colors duration-[120ms] hover:border-graphite hover:bg-mist"
              >
                Ir a mi panel
              </Link>
              <Link
                href="/"
                className="inline-flex h-11 items-center px-2 font-sans text-sm font-medium text-graphite transition-colors duration-[120ms] hover:text-black"
              >
                Ir al mapa
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
