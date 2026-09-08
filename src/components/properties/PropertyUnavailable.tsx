import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

// Página de estado para una propiedad que EXISTE pero no se puede mostrar: no
// está activa (pausada, vendida o alquilada) o su agencia no está al día.
//
// ⚠ NO ES UN 404, Y ESA ES TODA SU RAZÓN DE SER. Quien llega acá casi siempre
// recibió el enlace de alguien —esa es la función que la página nueva vino a
// cumplir—, y un error de página inexistente le diría que el enlace estaba roto.
// No lo está: la propiedad existió, y si estaba pausada puede volver.
//
// Clonado de AgencyUnavailable, que resuelve exactamente este estado para el
// sitio de marca de una agencia: mismo esqueleto, mismo tratamiento tipográfico,
// misma salida al mapa. Lo que cambia es el texto, porque lo que no está
// disponible es otra cosa.
//
// UNA SOLA VERSIÓN PARA TODOS LOS VISITANTES (no diferencia sesión), igual que
// aquel: el estado lo decide `resolvePropertyBySlug` con service role, así que
// el agente dueño de la propiedad ve lo mismo que un desconocido. Que es el
// punto: la página no puede decirle a quien la administra que está publicada
// cuando para el resto del mundo no lo está.
//
// NO se le cuenta al visitante POR QUÉ no está disponible: si la agencia dejó de
// pagar o si la propiedad se vendió no es asunto suyo, y los dos motivos se
// colapsan a propósito (mismo criterio que los tres gates de AgencyUnavailable).
//
// Voz del UI (DESIGN §10): directa, sin signos de exclamación, y el estado vacío
// es constructivo — sugiere la acción siguiente en vez de dejar al visitante sin
// nada que hacer.
export function PropertyUnavailable() {
  return (
    // ⚠ CONTENEDOR SCROLLEABLE PROPIO, aunque hoy el contenido entre sin
    // scrollear. El documento tiene el scroll bloqueado a nivel raíz
    // (`globals.css`), así que una pantalla que se pase del viewport se vuelve
    // INALCANZABLE — no aparece una barra, simplemente no hay forma de llegar.
    // Y esto se pasa fácil: alcanza con un teléfono chico en horizontal, o con
    // el tamaño de letra del navegador subido, para que el botón "Ir al mapa"
    // quede fuera. Depender de que el contenido sea corto es depender de algo
    // que nadie está midiendo.
    //
    // El par de clases es el patrón: el de afuera fija una pantalla y scrollea;
    // el de adentro lleva `min-h-full` para seguir CENTRANDO cuando sobra lugar
    // y crecer cuando falta. `min-h-dvh` en el hijo no serviría: volvería a
    // delegar el scroll al documento, que es de donde venimos.
    <div className="h-dvh overflow-y-auto bg-paper">
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
        <Link href="/" aria-label="Ir al mapa" className="mb-8">
          <Wordmark size="lg" variant="dark" />
        </Link>

        <h1 className="mb-3 max-w-md font-serif text-3xl font-semibold leading-tight text-black">
          Esta propiedad ya no está publicada
        </h1>

        <p className="mb-8 max-w-sm font-sans text-[15px] leading-relaxed text-graphite">
          El enlace es correcto, pero la publicación no está disponible en este
          momento. Podés seguir buscando entre las propiedades de tu ciudad en el
          mapa general.
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
