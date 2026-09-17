import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Estrella de propiedad destacada, en SVG (lucide Star, rellena).
//
// ⚠ NO EL CARÁCTER ★. DM Sans no cubre U+2605, así que cada dispositivo lo
// dibujaba con otra fuente del sistema: otra forma, otro tamaño y otro centrado.
// Un SVG se ve igual en todos.
//
// Color por defecto: `gold-deep`, el dorado para fondos claros (≥ 3:1 sobre
// paper, blanco y mist). El dorado es EXCLUSIVO de esta marca y es para lo que ve
// el VISITANTE (DESIGN §2): el modal y la ficha pública usan este default, y el
// pin del mapa usa el `gold` claro por CSS (--pin-star), no este componente.
//
// ⚠ EN EL PANEL LA ESTRELLA NO ES DORADA: hereda el color del texto que la
// acompaña. PropertiesTable la usa con `className="text-current"` (junto al
// título y en las opciones "Destacar" / "Quitar destacada" del menú), y así sigue
// al texto también en foco y deshabilitada. `cn` usa tailwind-merge, así que el
// `text-*` que se pase REEMPLAZA a `text-gold-deep`, no se suma.
//
// Es decorativa (`aria-hidden`): quien la usa pone el texto accesible al lado
// ("Destacada", visible o sr-only). Sin "use client": sirve en Server y Client
// Components.
export function FeaturedStarIcon({ className }: { className?: string }) {
  return (
    <Star
      aria-hidden="true"
      fill="currentColor"
      strokeWidth={0}
      className={cn("size-3.5 shrink-0 text-gold-deep", className)}
    />
  );
}
