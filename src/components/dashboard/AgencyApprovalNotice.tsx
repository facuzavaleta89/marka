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
//
// ⚠ Y DICE TAMBIÉN QUE LO YA CARGADO NO SE MUESTRA, que es la mitad de la
// historia que a este cartel le faltaba. La aprobación es la PRIMERA de las tres
// condiciones de `agency_is_publicly_visible()`, así que una agencia sin aprobar
// tampoco aparece en el mapa — y eso no es teórico para una RECHAZADA, que puede
// tener cartera entera cargada de cuando estaba aprobada (los triggers de
// aprobación y suscripción son solo de INSERT: rechazar no borra ni despublica
// nada). Decir únicamente "no vas a poder publicar" la dejaba creyendo que lo
// suyo seguía a la vista.
//
// Este cartel es el que se muestra cuando `getVisibilityBlock` devuelve
// `not_approved`; los otros dos motivos los cubre `AgencyVisibilityNotice`.
// Nunca se muestran los dos juntos (ver el montaje en dashboard/page.tsx).
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
        aprobemos no vas a poder publicar, y las propiedades que ya tengas
        cargadas no se muestran en el mapa. Mientras tanto podés ir dejando todo
        listo: completá tu perfil y los datos de tu inmobiliaria.
      </Notice>
    );
  }

  return (
    <Notice
      tone="error"
      title="Tu solicitud no fue aprobada"
      icon={<ShieldX size={18} />}
    >
      {rejectionNote && (
        <span className="block">
          Motivo: <span className="text-black">{rejectionNote}</span>
        </span>
      )}
      <span className={rejectionNote ? "mt-1.5 block" : "block"}>
        Mientras tanto tus propiedades no se muestran en el mapa y no podés
        publicar nuevas. Corregí los datos de tu inmobiliaria y tu solicitud
        vuelve a revisión automáticamente.
      </span>
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
