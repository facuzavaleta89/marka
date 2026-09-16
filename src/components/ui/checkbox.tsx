"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

// ⚠ EL COLOR DEL ESTADO MARCADO VIVE ACÁ, Y SOLO ACÁ: fondo y borde terracota,
// ícono en paper. Ninguna pantalla lo pisa. Antes el componente marcaba en el
// `bg-primary` del preset (casi negro) y las ocho casillas de la app lo
// sobrescribían a mano, así que una casilla nueva sin la copia salía negra.
//
// ⚠ EL FOCO DE TECLADO ES UN CONTORNO (outline) TERRACOTA SEPARADO, NUNCA UN
// CAMBIO DE BORDE. La variante `data-checked` va dentro de `:where()` y pesa
// (0,1,0), así que un `focus-visible:border-*` (0,2,0) le gana y la casilla
// marcada perdía su borde terracota al enfocarla. El contorno no compite con el
// color de marcado, y separado 2px se ve igual sobre mist, paper y blanco.
// ⚠ `focus-visible:outline-solid` NO sobra: `outline-none` pone
// `--tw-outline-style: none`, y `outline-2` solo lee esa variable, así que sin
// fijar el estilo el contorno quedaba en `none` y no se dibujaba.
//
// ⚠ EL BORDE POR DEFECTO ES `graphite/80`, NO EL `border-input` DEL PRESET.
// `--input` es un gris casi blanco: sobre el `mist` del panel y del formulario de
// propiedades daba un contraste de ≈1:1 y la casilla sin marcar NO SE VEÍA (lo
// único visible de una opción era su texto suelto, y una propiedad que también se
// alquilaba terminaba cargada solo en venta). `stone`, el otro borde que usaban
// algunas pantallas, tampoco alcanzaba (1,42:1 sobre mist).
// `graphite/80` da 4,31:1 sobre mist, 4,88:1 sobre paper y 5,07:1 sobre blanco:
// por encima del 3:1 que pide WCAG 1.4.11 para el borde de un control en los tres
// fondos donde viven casillas. No pisar el color del borde desde una pantalla.
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4.5 shrink-0 items-center justify-center rounded-sm border border-graphite/80 bg-transparent transition-shadow outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/20 aria-invalid:aria-checked:border-terracota dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-terracota data-checked:bg-terracota data-checked:text-paper",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
