import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-input/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline underline-offset-4 hover:underline",
      },
      size: {
        // ESCALA DE ALTOS (DESIGN §6: 44px es el mínimo táctil). Son TRES, y
        // nada más:
        //   default  L  44 · acción principal de una pantalla o un formulario
        //   sm       M  36 · contexto denso (filas, encabezados, filtros)
        //   xs       S  28 · sobre una imagen o un mapa; ⚠ bajo el mínimo
        //                    táctil, por eso lleva área de toque extendida
        //
        // ⚠ EL PRESET TRAÍA ADEMÁS `lg` E `icon-lg`, Y SE ELIMINARON (17 sep
        // 2026). `icon-lg` era `size-11`, byte a byte idéntico a `icon`; `lg`
        // tenía el MISMO alto que `default` (h-11) y solo cambiaba el relleno
        // horizontal. Los dos con CERO usos medidos en src/. Una escala de tres
        // alturas con cinco nombres es una invitación a elegir mal: quien
        // necesite un CTA más ancho usa `className="w-full"` o `px-*`, que es
        // lo que ya hacen los cuatro botones de ancho completo del proyecto.
        default:
          "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        // ⚠ 28px de alto: por debajo del mínimo táctil, así que el
        // pseudo-elemento extiende el área de toque a 44px de alto sin mover el
        // dibujo. Mismo recurso que ya usa ui/checkbox.tsx.
        xs: "h-7 gap-1 px-2.5 after:absolute after:-inset-x-2 after:-inset-y-2 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-11",
        "icon-xs": "size-7 after:absolute after:-inset-2 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
