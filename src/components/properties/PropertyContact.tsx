"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { generateWaUrl } from "@/lib/utils/waMessage";
import { registerLead, LEAD_ERROR_MESSAGE } from "@/lib/utils/registerLead";

// Isla de cliente dentro de la página de servidor: el flujo de contacto necesita
// estado (el nombre que escribe el visitante) y `window.open`.
//
// Es el MISMO flujo del modal —botón → aparece el input → "Enviar mensaje"— y el
// mismo registro de consulta, pero el JSX se reescribe acá en vez de compartirse:
// son ~40 líneas sin lógica propia, y compartirlas acoplaría dos pantallas cuyo
// contexto visual es distinto (en el modal el botón compite con el precio a 200px
// y vive en una franja de alto contado; acá tiene la columna entera y aire).
//
// Lo que SÍ se comparte es lo que lleva decisiones encima: `registerLead`. Las
// cuatro que documenta ese archivo se respetan acá una por una:
//   1. el error se captura y NO bloquea → el window.open va después y fuera de
//      toda rama de error;
//   2. no se manda `agent_name` → lo hace el helper, que es el punto de haberlo
//      extraído;
//   3. con error el formulario NO se cierra;
//   4. el aviso va en `graphite` con role="status", no en rojo.

interface PropertyContactProps {
  propertyId: string;
  agentId: string;
  agencyId: string;
  propertyTitle: string;
  propertyAddress: string;
  /** Teléfono del agente. Vacío = no se puede contactar por WhatsApp. */
  agentPhone: string;
}

export function PropertyContact({
  propertyId,
  agentId,
  agencyId,
  propertyTitle,
  propertyAddress,
  agentPhone,
}: PropertyContactProps) {
  const [showNameInput, setShowNameInput] = useState(false);
  const [userName, setUserName] = useState("");
  const [sending, setSending] = useState(false);
  const [leadError, setLeadError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPhone = agentPhone.trim() !== "";

  useEffect(() => {
    if (showNameInput) inputRef.current?.focus();
  }, [showNameInput]);

  const handleSend = async () => {
    if (!userName.trim() || sending) return;

    const url = generateWaUrl({
      agentPhone,
      userName: userName.trim(),
      propertyTitle,
      propertyAddress,
    });
    // Sin número configurado no registramos consulta ni abrimos un link roto.
    if (!url) return;

    setSending(true);
    setLeadError(false);

    const registered = await registerLead({
      propertyId,
      agentId,
      agencyId,
      contactName: userName,
    });

    // Decisión 1: incondicional, fuera de toda rama de error. La operación
    // principal es el CONTACTO, no el registro.
    window.open(url, "_blank", "noopener,noreferrer");

    setSending(false);
    setLeadError(!registered);
    // Decisión 3: con error el flujo NO se cierra — el aviso quedaría flotando
    // al lado de un botón en estado inicial, sin contexto de a qué se refiere.
    if (registered) {
      setShowNameInput(false);
      setUserName("");
    }
  };

  if (!hasPhone) {
    return (
      <div>
        <button
          disabled
          className="flex w-full items-center justify-center gap-2 h-11 cursor-not-allowed rounded-md bg-stone font-sans text-sm font-medium text-graphite"
        >
          <MessageCircle size={18} />
          Consultar por WhatsApp
        </button>
        <p className="mt-2 font-sans text-xs text-graphite">
          Este agente no tiene número de WhatsApp configurado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* El input aparece con la misma animación que en el modal (DESIGN §8:
          height expand + fade-in, 200ms ease-out). */}
      <div
        className={
          "overflow-hidden transition-all duration-200 ease-out " +
          (showNameInput ? "max-h-14 opacity-100" : "max-h-0 opacity-0")
        }
      >
        <input
          ref={inputRef}
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Tu nombre"
          className="h-10 w-full rounded-md border border-stone bg-white px-3 font-sans text-sm text-black outline-none placeholder:text-stone focus:border-graphite focus:ring-2 focus:ring-terracota/20"
        />
      </div>

      {!showNameInput ? (
        <button
          onClick={() => setShowNameInput(true)}
          className="flex w-full items-center justify-center gap-2 h-11 rounded-md bg-whatsapp font-sans text-sm font-medium text-white transition-colors hover:bg-whatsapp-hover"
        >
          <MessageCircle size={18} />
          Consultar por WhatsApp
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!userName.trim() || sending}
          className="flex w-full items-center justify-center gap-2 h-11 rounded-md bg-whatsapp font-sans text-sm font-medium text-white transition-colors hover:bg-whatsapp-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={16} />
          {sending ? "Enviando..." : "Enviar mensaje"}
        </button>
      )}

      {/* Decisión 4: graphite y role="status", no rojo ni role="alert". Quien lo
          lee es un visitante al que no le falta nada — ya tiene el chat abierto. */}
      {leadError && (
        <p className="font-sans text-xs text-graphite" role="status">
          {LEAD_ERROR_MESSAGE}
        </p>
      )}
    </div>
  );
}
