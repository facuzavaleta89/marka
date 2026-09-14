import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

// Página de estado para el slug de una agencia que existe pero cuyo sitio de
// marca no está disponible, por cualquiera de los motivos que clasifica
// `resolveAgencyBySlug`. No es un mapa: es un estado.
//
// ⚠ ESTE CARTEL ES EL DEL VISITANTE, Y NO DICE NI DEBE DECIR EL MOTIVO. Los
// motivos se colapsan a propósito: la situación comercial de una inmobiliaria
// —que no pagó, que no está aprobada, que bajó de plan— no es asunto de quien
// entra a mirar propiedades. El administrador de esa misma agencia SÍ ve el
// motivo y qué hacer, en `AgencyUnavailableForAdmin`; la ruta elige cuál de los
// dos renderiza.
//
// Voz del UI (DESIGN §10): directa, sin signos de exclamación.
export function AgencyUnavailable() {
  return (
    // ⚠ `h-dvh overflow-y-auto` + `min-h-full` en el hijo, NUNCA `min-h-dvh`.
    // Acá decía `min-h-dvh`, que es un MÍNIMO: deja crecer el contenido y delega
    // el scroll al documento, que lo tiene bloqueado (globals.css) — el final de
    // la pantalla queda inalcanzable, sin barra rota y sin error. Es la trampa
    // que CLAUDE.md documenta y que su gemela `PropertyUnavailable` ya tenía
    // resuelta con esta misma forma. Entraba sin scrollear por poco texto, pero
    // alcanza un teléfono en horizontal o el tamaño de letra subido.
    <div className="h-dvh overflow-y-auto bg-paper">
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
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
    </div>
  );
}
