import Link from "next/link";
import { Clock, ShieldX } from "lucide-react";
import type { ApprovalStatus } from "@/types";
import { Notice } from "@/components/feedback/Notice";

// Aviso del estado de aprobación de la agencia. Presentacional puro: recibe el
// estado y el motivo ya resueltos en el server (nunca consulta nada).
//
// Regla de negocio que explica el tono: una agencia pendiente o rechazada puede
// usar casi todo el panel — completar su perfil, subir el logo, cargar el
// teléfono. Lo ÚNICO que no puede es publicar propiedades. Por eso el mensaje
// no es un error ni una pared: dice qué falta y qué SÍ se puede hacer mientras
// tanto.
export function AgencyApprovalNotice({
  status,
  rejectionNote,
  showEditLink = true,
}: {
  status: ApprovalStatus;
  /** Motivo del último rechazo. Solo se usa si status es 'rejected'. */
  rejectionNote?: string | null;
  /** El enlace a Preferencias se oculta cuando el aviso ya se muestra ahí. */
  showEditLink?: boolean;
}) {
  // Una agencia aprobada no ve ningún aviso: es el estado normal.
  if (status === "approved") return null;

  if (status === "pending") {
    return (
      <Notice
        tone="info"
        title="Tu cuenta está en revisión"
        icon={<Clock size={18} />}
      >
        Estamos verificando la matrícula de tu inmobiliaria. Hasta que la
        aprobemos no vas a poder publicar propiedades, pero sí podés ir dejando
        todo listo: completá tu perfil y los datos de tu inmobiliaria.
      </Notice>
    );
  }

  return (
    <Notice
      tone="error"
      title="Tu solicitud no fue aprobada"
      icon={<ShieldX size={18} />}
    >
      {rejectionNote ? (
        <>
          <span className="block">
            Motivo:{" "}
            <span className="text-black">{rejectionNote}</span>
          </span>
          <span className="mt-1.5 block">
            Corregí los datos de tu inmobiliaria y tu solicitud vuelve a
            revisión automáticamente.
          </span>
        </>
      ) : (
        <span className="block">
          Corregí los datos de tu inmobiliaria y tu solicitud vuelve a revisión
          automáticamente.
        </span>
      )}
      {showEditLink && (
        <Link
          href="/dashboard/preferencias"
          className="mt-2 inline-block font-medium text-terracota hover:underline"
        >
          Corregir los datos
        </Link>
      )}
    </Notice>
  );
}
