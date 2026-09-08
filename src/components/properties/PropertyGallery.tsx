import { ImageOff } from "lucide-react";
import type { PropertyImage } from "@/types";

// ─── Galería de la página pública (Server Component, CERO JavaScript) ────
//
// ⚠ NO ES EL CARRUSEL DEL MODAL, Y NO DEBE SERLO. Aquel guarda la foto activa en
// un `useState` y apila las demás con `opacity-0`: para un buscador, y para
// cualquiera que lea el HTML, **existe UNA sola foto**. En una página cuyo
// motivo de existir es ser indexada, eso es justo lo que no se puede hacer.
//
// Acá las fotos están TODAS en el documento, una al lado de la otra, y el
// desplazamiento lo hace el navegador con `scroll-snap` — que es CSS, no JS. Sin
// estado, sin isla de cliente, sin hidratación: la galería funciona con
// JavaScript deshabilitado y el buscador ve las N imágenes con su `alt`.
//
// El precio de no tener JS es que no hay flechas ni puntitos (no se puede
// cambiar de foto sin estado). A cambio: gesto táctil nativo en celular —que es
// como se mira una galería de propiedades—, rueda horizontal en escritorio, y
// una barra de desplazamiento visible que anuncia sola que hay más fotos.
//
// `aspect-[4/3]` en vez de un alto fijo: reserva el espacio ANTES de que la
// imagen cargue, así la página no salta cuando aparece (CLS). En una página que
// se mide por su rendimiento, eso importa más que en un modal.

interface PropertyGalleryProps {
  images: PropertyImage[];
  /** Título de la propiedad: alimenta el `alt` de cada foto. */
  title: string;
}

export function PropertyGallery({ images, title }: PropertyGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] max-h-[420px] w-full items-center justify-center rounded-lg border border-stone bg-mist">
        <ImageOff size={32} className="text-stone" />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={images[0].url}
        alt={title}
        className="aspect-[4/3] max-h-[420px] w-full rounded-lg object-cover"
      />
    );
  }

  return (
    <div>
      {/* `snap-x snap-mandatory` + cada foto `w-full shrink-0 snap-center` = una
          foto por pantalla, con freno en cada una. Todo nativo del navegador. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {images.map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.id}
            src={img.url}
            alt={`${title} — foto ${i + 1} de ${images.length}`}
            // La primera es la más grande de la mitad superior de la página:
            // se pide con prioridad alta y sin diferir. Las demás, diferidas.
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            decoding="async"
            className="aspect-[4/3] max-h-[420px] w-full shrink-0 snap-center rounded-lg object-cover"
          />
        ))}
      </div>

      {/* Sin puntitos que indiquen la posición (harían falta estado), el conteo
          en texto es lo que le dice al visitante cuántas fotos hay. Y lo lee un
          lector de pantalla, que con la barra de desplazamiento no se entera. */}
      <p className="mt-1 font-sans text-xs text-graphite">
        {images.length} fotos · deslizá para ver todas
      </p>
    </div>
  );
}
