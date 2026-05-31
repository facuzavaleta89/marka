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
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      {/* ── Panel de identidad ──────────────────────────────────
          En mobile: franja superior corta. En desktop: columna a sangre. */}
      <section className="relative flex h-44 shrink-0 flex-col justify-between overflow-hidden px-6 py-5 md:h-auto md:min-h-screen md:w-[44%] md:px-10 md:py-10">
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

        {/* Marca arriba */}
        <div className="relative z-10">
          <Wordmark size="lg" variant="light" />
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
      <main className="flex flex-1 items-center justify-center px-6 py-10 md:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
