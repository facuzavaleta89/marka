import { cn } from "@/lib/utils";

// ─── Wordmark de Marka ────────────────────────────────────────
// Marca tipográfica, no logo gráfico. "Marka" en Noto Serif con un punto
// final en terracota: una firma de masthead editorial (el "full stop" de
// las cabeceras de revista) que aporta carácter sin ser decorativo.

interface WordmarkProps {
  /** Tamaño: xs (atribución "powered by"), sm (sidebar), md (header), lg (login/register) */
  size?: "xs" | "sm" | "md" | "lg";
  /** dark = texto black sobre fondos claros · light = texto paper sobre fondos oscuros */
  variant?: "dark" | "light";
  className?: string;
}

// El tracking ligeramente negativo cierra el wordmark y lo hace más sólido.
const SIZE_CLASSES: Record<NonNullable<WordmarkProps["size"]>, string> = {
  xs: "text-sm",
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
};

export function Wordmark({
  size = "md",
  variant = "dark",
  className,
}: WordmarkProps) {
  const wordColor = variant === "light" ? "text-paper" : "text-black";

  return (
    <span
      aria-label="Marka"
      className={cn(
        "inline-flex items-baseline font-serif font-bold leading-none tracking-[-0.01em] select-none",
        SIZE_CLASSES[size],
        wordColor,
        className
      )}
    >
      Marka
      {/* El punto en terracota: el único acento, alineado a la baseline */}
      <span className="text-terracota" aria-hidden="true">
        .
      </span>
    </span>
  );
}
