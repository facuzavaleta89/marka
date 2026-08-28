import type { ReactNode } from "react";

// Aviso persistente: un cartel informativo que explica un estado de la cuenta y
// qué se puede hacer al respecto. NO es el "banner de error" que ya existe
// copiado en varias pantallas: aquel es descartable, tiene estado de cliente y
// comunica que algo falló. Este se queda mientras el estado dure, no se cierra,
// y es un Server Component (no lleva "use client").
//
// Tonos según DESIGN.md §2 — un solo acento, usado con avaricia:
//   info    : neutro, sobre `mist`. Algo está en curso, nadie hizo nada mal.
//   warning : terracota suave. Requiere atención o acción de quien lo lee.
//   error   : `error` sobre terracota-subtle. Algo salió mal de verdad.
type NoticeTone = "info" | "warning" | "error";

const TONE_STYLES: Record<NoticeTone, { container: string; title: string }> = {
  info: {
    container: "bg-mist border-stone",
    title: "text-black",
  },
  warning: {
    container: "bg-terracota-subtle border-terracota/25",
    title: "text-terracota",
  },
  error: {
    container: "bg-terracota-subtle border-error/25",
    title: "text-error",
  },
};

export function Notice({
  tone = "info",
  title,
  icon,
  children,
}: {
  tone?: NoticeTone;
  title: string;
  /** Ícono ya renderizado (ej: <Clock size={18} />). Hereda el color del título. */
  icon?: ReactNode;
  children: ReactNode;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      role="status"
      className={`rounded-lg border px-5 py-4 ${styles.container}`}
    >
      <div className={`flex items-center gap-2 ${styles.title}`}>
        {icon}
        <p className="font-sans text-sm font-semibold">{title}</p>
      </div>
      <div className="mt-1.5 font-sans text-sm leading-relaxed text-graphite">
        {children}
      </div>
    </div>
  );
}
