"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Banner de error DESCARTABLE: algo que la persona intentó hacer falló, y puede
// cerrar el cartel cuando lo leyó.
//
// ⚠ NO CONFUNDIR CON `Notice`, que está al lado en esta misma carpeta. La
// distinción ya estaba escrita en el encabezado de aquel y este componente la
// respeta:
//
//   Notice       → aviso PERSISTENTE. Describe un estado de la cuenta que dura,
//                  no se cierra, y es Server Component.
//   ErrorBanner  → algo FALLÓ recién. Se cierra, tiene estado de cliente
//                  (por eso lleva "use client") y desaparece al reintentar.
//
// Estaba escrito a mano en CUATRO pantallas del panel y las copias ya habían
// divergido (dos con `mb-4` y dos sin). Es el mismo patrón que el proyecto ya se
// cobró dos veces: `AgenciesTable` con sus condiciones de fila duplicadas, y
// `AgentCell`, que se centralizó por ese precedente.
export function ErrorBanner({
  message,
  onDismiss,
  className,
}: {
  /** El texto del error. Si es null/undefined no se renderiza nada. */
  message: string | null | undefined;
  onDismiss: () => void;
  /**
   * ⚠ EL MARGEN VIENE DE AFUERA, Y NO ES UN CAPRICHO DE API. De las cuatro
   * pantallas que lo usan, DOS lo tienen suelto dentro de un fragmento y
   * necesitan `mb-4`, y las otras DOS viven en un contenedor que ya separa a sus
   * hijos (`space-y-6`) y no lo necesitan. Un margen fijo adentro del componente
   * rompe dos pantallas en una dirección o las otras dos en la contraria: o
   * quedan pegadas o quedan con el doble de aire. Cada llamador pasa el suyo.
   */
  className?: string;
}) {
  // La guarda vive acá y no en los cuatro llamadores: antes cada uno escribía su
  // propio `{error && (…)}`, que es una línea más para olvidarse en el quinto.
  if (!message) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-terracota/20 bg-terracota-subtle px-4 py-3",
        className
      )}
    >
      <p className="flex-1 font-sans text-sm text-error">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-graphite hover:text-black"
        aria-label="Cerrar"
      >
        <X size={16} />
      </button>
    </div>
  );
}
