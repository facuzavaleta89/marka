import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

// Página de estado para el slug de una agencia que existe pero cuya suscripción
// NO tiene white-label habilitado (nunca lo tuvo, o bajó de plan). No es un mapa:
// es un estado. Una sola versión para todos los visitantes (no diferencia sesión).
// Voz del UI (DESIGN §10): directa, sin signos de exclamación.
export function AgencyUnavailable() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 text-center">
      <Link href="/" aria-label="Ir al mapa" className="mb-8">
        <Wordmark size="lg" variant="dark" />
      </Link>

      <h1 className="mb-3 max-w-md font-serif text-3xl font-semibold leading-tight text-black">
        Este sitio no está disponible en este momento
      </h1>

      <p className="mb-8 max-w-sm font-sans text-[15px] leading-relaxed text-graphite">
        La página que buscás no está activa. Podés seguir explorando las
        propiedades de tu ciudad en el mapa general.
      </p>

      <Link
        href="/"
        className="inline-flex h-11 items-center rounded-md bg-terracota px-5 font-sans text-sm font-medium text-paper transition-colors hover:bg-terracota-hover"
      >
        Ir al mapa
      </Link>
    </div>
  );
}
