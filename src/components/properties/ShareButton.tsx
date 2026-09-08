"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Botón de compartir ───────────────────────────────────────
//
// Sin precedente en el proyecto: no había ni un uso de `navigator.share`, ni de
// `navigator.clipboard`, ni ningún patrón de "copiado ✓". Se construye desde cero.
//
// ══════════════════════════════════════════════════════════════
// LA CASCADA DE TRES NIVELES, Y POR QUÉ SON TRES Y NO UNO
// ══════════════════════════════════════════════════════════════
//
// Las dos capacidades modernas pueden NO EXISTIR, y no por navegadores raros:
//
//   · `navigator.share` es sobre todo móvil. En Firefox de escritorio y en
//     Chrome de escritorio sin configurar, no existe.
//   · `navigator.clipboard` exige CONTEXTO SEGURO (HTTPS o localhost). En
//     `http://` plano el objeto entero es `undefined`, no falla la promesa:
//     falla el acceso a la propiedad.
//
// Por eso la cascada, en orden de preferencia:
//
//   1. `navigator.share` — el diálogo nativo del sistema. Es lo mejor en
//      celular: manda a WhatsApp directo, que es exactamente el caso de uso.
//   2. `navigator.clipboard.writeText` — copia y confirma.
//   3. `document.execCommand("copy")` sobre un textarea temporal — obsoleto,
//      pero es SÍNCRONO y NO exige contexto seguro, así que cubre el hueco que
//      dejan los dos anteriores.
//
// ⚠ Y SI LOS TRES FALLAN, EL COMPONENTE MUESTRA EL ENLACE EN UN CAMPO
// SELECCIONABLE. No es adorno defensivo: es la única forma de garantizar lo
// pedido —que SIEMPRE haya un camino que funcione—. Un botón que no hace nada
// y no dice nada es peor que no tener botón.
//
// El cancelar del diálogo nativo llega como una excepción `AbortError`. NO es un
// error: es el visitante diciendo que no. Se traga en silencio, sin caer al
// portapapeles (copiar algo que la persona acaba de decidir no compartir sería
// hacer justo lo contrario de lo que pidió).

const FEEDBACK_MS = 2000;

type Outcome = "idle" | "copied" | "manual";

interface ShareButtonProps {
  /** URL absoluta a compartir. */
  url: string;
  /** Título para el diálogo nativo del sistema. */
  title: string;
  /** Texto que acompaña al título en el diálogo nativo. */
  text?: string;
  /**
   * `icon`: círculo flotante sobre la foto (modal). `button`: botón secundario
   * con etiqueta (página). El comportamiento es idéntico; cambia el envoltorio.
   */
  variant?: "icon" | "button";
  className?: string;
}

export function ShareButton({
  url,
  title,
  text,
  variant = "button",
  className,
}: ShareButtonProps) {
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El feedback se desvanece solo. El timeout se limpia al desmontar: en el
  // modal el componente desaparece al cerrar, y un setState sobre un componente
  // desmontado es exactamente lo que este cleanup evita.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const flash = (next: Outcome) => {
    setOutcome(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // El modo manual NO se desvanece: si el visitante tiene que seleccionar el
    // texto a mano, sacárselo a los dos segundos sería sacarle la única salida
    // que le quedaba.
    if (next === "copied") {
      timeoutRef.current = setTimeout(() => setOutcome("idle"), FEEDBACK_MS);
    }
  };

  // Nivel 3 de la cascada. Síncrono y sin exigencia de contexto seguro.
  const legacyCopy = (): boolean => {
    try {
      const el = document.createElement("textarea");
      el.value = url;
      // Fuera de vista pero enfocable: `display:none` o `hidden` harían que la
      // selección no exista y el copy no tenga nada que copiar.
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.top = "-9999px";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  };

  const handleShare = async () => {
    // 1. Diálogo nativo del sistema.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // Cancelar NO es un error: el visitante decidió que no. Se corta sin
        // copiar nada ni mostrar feedback.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Cualquier otra falla (permiso denegado, share no soportado para este
        // payload) cae al portapapeles.
      }
    }

    // 2. Portapapeles moderno. El `?.` no es cosmético: fuera de contexto seguro
    // `navigator.clipboard` es `undefined` y esto tiraría un TypeError.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        flash("copied");
        return;
      }
    } catch {
      // Permiso denegado o documento sin foco: sigue la cascada.
    }

    // 3. Portapapeles obsoleto.
    if (legacyCopy()) {
      flash("copied");
      return;
    }

    // 4. Nada funcionó: se muestra el enlace para copiarlo a mano.
    flash("manual");
  };

  const label = outcome === "copied" ? "Enlace copiado" : "Compartir";

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={handleShare}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-full bg-paper/85 backdrop-blur-sm shadow-sm transition-colors hover:bg-paper",
            outcome === "copied" ? "text-success" : "text-graphite hover:text-black",
            className
          )}
          aria-label={label}
          title={label}
        >
          {outcome === "copied" ? <Check size={18} /> : <Share2 size={18} />}
        </button>
        {outcome === "manual" && <ManualFallback url={url} floating />}
      </>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={handleShare}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-md border px-4 font-sans text-sm font-medium transition-colors duration-[120ms]",
          outcome === "copied"
            ? "border-success text-success"
            : "border-stone text-black hover:bg-mist"
        )}
      >
        {outcome === "copied" ? <Check size={16} /> : <Share2 size={16} />}
        {label}
      </button>
      {outcome === "manual" && <ManualFallback url={url} />}
    </div>
  );
}

// Último recurso: el enlace en un campo de solo lectura, preseleccionado. El
// visitante lo copia con el menú del navegador o con el teclado.
//
// `readOnly` y no `disabled`: un input deshabilitado NO se puede seleccionar, y
// seleccionar es justamente lo único que este campo existe para permitir.
function ManualFallback({ url, floating }: { url: string; floating?: boolean }) {
  return (
    <div
      className={cn(
        "space-y-1",
        // Sobre la foto no hay lugar en el flujo: se ancla debajo del botón.
        floating &&
          "absolute right-0 top-11 z-10 w-64 rounded-md border border-stone bg-paper p-2 shadow-lg"
      )}
      role="status"
    >
      <p className="font-sans text-xs text-graphite">
        Copiá el enlace a mano:
      </p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        autoFocus
        className="w-full rounded-md border border-stone bg-white px-2 py-1.5 font-sans text-xs text-black outline-none focus:border-graphite"
      />
    </div>
  );
}
