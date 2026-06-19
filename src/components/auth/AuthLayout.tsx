import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";

// ─── Layout split-screen para login / register ───────────────
// Panel de identidad (izquierda en desktop / franja superior en mobile) +
// panel de formulario. Mismo tratamiento para ambas pantallas.

interface AuthLayoutProps {
  /** Claim editorial en Noto Serif para el panel de identidad */
  claim: string;
  /** Línea de apoyo en DM Sans (visible solo en desktop) */
  subclaim?: string;
  /** El formulario (heading + form + link) */
  children: React.ReactNode;
}

export function AuthLayout({ claim, subclaim, children }: AuthLayoutProps) {
  return (
    <div className="flex h-dvh flex-col overflow-y-auto bg-paper md:flex-row md:items-start">
      {/* ── Panel de identidad ──────────────────────────────────
          En mobile: franja superior corta. En desktop: columna a sangre. */}
      <section className="relative flex h-44 shrink-0 flex-col justify-between overflow-hidden px-6 py-5 md:sticky md:top-0 md:h-dvh md:w-[44%] md:px-10 md:py-10">
        {/* ════════════════════════════════════════════════════════════
            FONDO DEL PANEL — preparado para foto editorial.
            Cuando haya una fotografía real, reemplazar SOLO el <div> de
            gradiente de abajo por una imagen a sangre (una línea):

              <img src="/auth-cover.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />

            Los overlays (glow + degradé de legibilidad) se mantienen y
            funcionan igual sobre una foto.
            ════════════════════════════════════════════════════════════ */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#3b2a22] via-[#1c1512] to-black" />

        {/* Glow terracota: da profundidad y calidez, evita el plano */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(160,82,45,0.30),transparent_62%)]" />
        {/* Degradé de legibilidad (clave si en el futuro hay foto detrás) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />

        {/* Marca arriba — link de vuelta al mapa público */}
        <div className="relative z-10">
          <Link href="/" aria-label="Ir al mapa">
            <Wordmark size="lg" variant="light" />
          </Link>
        </div>

        {/* Claim abajo */}
        <div className="relative z-10">
          {/* Detalle editorial: hairline terracota (eco del punto del wordmark) */}
          <div className="mb-4 hidden h-px w-10 bg-terracota md:block" />
          <h1 className="max-w-md font-serif text-lg font-semibold leading-tight text-paper md:text-4xl">
            {claim}
          </h1>
          {subclaim && (
            <p className="mt-4 hidden max-w-sm font-sans text-[15px] leading-relaxed text-paper/70 md:block">
              {subclaim}
            </p>
          )}
        </div>
      </section>

      {/* ── Panel del formulario ─────────────────────────────────── */}
      {/* flex-col + m-auto en el hijo: centra el formulario cuando entra, pero si
          es más alto que el viewport (register con el campo condicional + teclado)
          el margen auto colapsa y el bloque fluye desde arriba, scrolleando dentro
          del contenedor raíz (h-dvh overflow-y-auto). Evita el recorte del top que
          produce justify-center con contenido que desborda. */}
      <main className="flex flex-1 flex-col px-6 py-10 md:px-10">
        <div className="m-auto w-full max-w-sm">
          {/* Salida explícita al mapa (navegación secundaria, no botón).
              Convive con el wordmark clickeable del panel de identidad. */}
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 font-sans text-sm text-graphite transition-colors duration-[120ms] ease-out hover:text-terracota"
          >
            <ArrowLeft size={16} />
            Volver al mapa
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
