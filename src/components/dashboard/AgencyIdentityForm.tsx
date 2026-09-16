"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, Lock, ShieldX } from "lucide-react";
import { updateAgencyIdentityAction } from "@/app/(agent)/dashboard/preferencias/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/feedback/Notice";
import { FIELD_BOX } from "@/components/forms/fieldStyles";
import type { ApprovalStatus } from "@/types";
import {
  LICENSE_NUMBER_ERROR,
  LICENSE_NUMBER_PATTERN,
  normalizeLicenseNumber,
} from "@/lib/utils/licenseNumber";
import {
  AGENCY_NAME_MAX_LENGTH,
  normalizeAgencyName,
  validateAgencyName,
} from "@/lib/utils/agencyName";

const schema = z.object({
  // MISMAS funciones que usa la server action: un solo criterio, dos capas. El
  // formulario valida para dar feedback; la barrera que cuenta es la del server.
  name: z
    .string()
    .transform(normalizeAgencyName)
    .superRefine((value, ctx) => {
      const result = validateAgencyName(value);
      if (!result.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
      }
    }),
  license_number: z
    .string()
    .transform(normalizeLicenseNumber)
    .refine((v) => v.length > 0, "La matrícula es requerida")
    .refine((v) => LICENSE_NUMBER_PATTERN.test(v), LICENSE_NUMBER_ERROR),
});

type Values = z.infer<typeof schema>;

// Identidad de la agencia (razón social + matrícula). Se renderiza solo para el
// admin de la agencia (lo gatea la página), igual que el teléfono y el logo.
//
// ══════════════════════════════════════════════════════════════
// ⚠ EL NOMBRE SE EDITA SIEMPRE; LA MATRÍCULA SE CONGELA AL APROBAR
// ══════════════════════════════════════════════════════════════
//
// Acá el formulario ENTERO se ocultaba para una agencia aprobada y se mostraba
// una vista de solo lectura con un candado. Eso dejaba sin punto de entrada a
// TODO el flujo de cambio de nombre —el rastro en `previous_name`, la distinción
// en el panel, las dos formas de rechazo—: estaba construido y no había campo
// que lo disparara.
//
// Ahora el corte es por campo:
//   · nombre    → editable siempre. Cambiarlo devuelve la cuenta a revisión, y
//     el aviso de abajo lo advierte ANTES de confirmar.
//   · matrícula → solo lectura con la agencia aprobada. Es el dato que se
//     verificó contra el padrón del colegio para dar el alta.
//
// ⚠ Esto es cosmético: la regla real la aplica updateAgencyIdentityAction en el
// server (agencies no tiene policy de UPDATE y se escribe con service role), que
// además IGNORA la matrícula entrante si la agencia está aprobada.
export function AgencyIdentityForm({
  initialName,
  initialLicenseNumber,
  approvalStatus,
  nameRejectionNote,
}: {
  initialName: string;
  initialLicenseNumber: string;
  approvalStatus: ApprovalStatus;
  /**
   * Motivo por el que NO se aprobó el último cambio de nombre, si ese rechazo
   * sigue vigente. Ya resuelto en el server.
   *
   * ⚠ Sin esto la agencia se queda sin saber por qué. El rechazo del nombre la
   * deja APROBADA —solo se le revierte el nombre—, y `AgencyApprovalNotice`,
   * que es donde se lee el motivo de un rechazo, devuelve `null` para una
   * agencia aprobada: el mensaje no tendría dónde aparecer. Lo único que vería
   * es su nombre viejo de vuelta, sin explicación.
   */
  nameRejectionNote?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // ⚠ Ya NO bloquea el formulario entero: solo la matrícula. El nombre se edita
  // en cualquier estado (ver la cabecera del componente).
  const isApproved = approvalStatus === "approved";

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialName,
      license_number: initialLicenseNumber,
    },
  });

  function onSubmit(values: Values) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateAgencyIdentityAction(values);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // Si venía rechazada, guardar es además el reenvío de la solicitud: hay
      // que decirlo, porque el estado de la cuenta cambió.
      setSuccess(
        result.resubmitted
          ? "Datos guardados. Tu solicitud volvió a quedar en revisión."
          : "Datos de la inmobiliaria actualizados"
      );
    });
  }

  return (
    <section className="bg-paper border border-stone rounded-lg p-6 space-y-4">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-black">
          Identidad de la inmobiliaria
        </h2>
        <p className="font-sans text-xs text-graphite mt-0.5">
          {isApproved
            ? "Podés cambiar el nombre; el cambio pasa por revisión. La matrícula quedó fija al aprobar tu cuenta."
            : "El nombre y la matrícula que verificamos para aprobar tu cuenta."}
        </p>
      </div>

      {/* El nombre que se pidió no se aprobó. Va ARRIBA del formulario y de la
          vista bloqueada, en las dos: es lo primero que explica por qué la
          inmobiliaria se llama como se llama. Tono `warning` y no `error`
          —nadie hizo nada mal, el nombre no pasó y se puede proponer otro— y
          dice el paso siguiente sin prometer que ese otro se apruebe. */}
      {nameRejectionNote && (
        <Notice
          tone="warning"
          title="El cambio de nombre que pediste no fue aprobado"
          icon={<ShieldX size={18} />}
        >
          <span className="block">
            Motivo: <span className="text-black">{nameRejectionNote}</span>
          </span>
          <span className="mt-1.5 block">
            Le devolvimos a tu inmobiliaria el nombre que tenía antes, así que{" "}
            <span className="text-black">
              sigue funcionando con normalidad
            </span>
            . Podés proponer otro nombre cuando quieras.
          </span>
        </Notice>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* ── El nombre. Editable SIEMPRE, y es el dato de identidad principal:
            va primero porque es lo que la persona viene a buscar. ──────── */}
        <div className="space-y-1.5">
          <Label
            htmlFor="agency_name"
            className="font-sans text-sm font-medium text-black"
          >
            Nombre de la inmobiliaria
          </Label>

          {/* ⚠ Controller y NO watch(): hace falta el valor EN VIVO para saber
              si el nombre cambió —de eso depende que aparezca el aviso de que la
              cuenta vuelve a revisión— y `watch()` de react-hook-form dispara el
              warning react-hooks/incompatible-library del React Compiler. El
              proyecto carga uno conocido y cualquier otro es una regresión
              (CLAUDE.md → ESLint). */}
          <Controller
            control={form.control}
            name="name"
            render={({ field }) => (
              <Input
                id="agency_name"
                placeholder="Inmobiliaria López"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                maxLength={AGENCY_NAME_MAX_LENGTH}
                className={FIELD_BOX}
              />
            )}
          />
          <p className="font-sans text-xs text-graphite">
            {isApproved
              ? "La razón social con la que figurás en el colegio de corredores. Si la cambiás, revisamos el nombre nuevo antes de que quede."
              : "La razón social con la que figurás en el colegio de corredores."}
          </p>
          {form.formState.errors.name && (
            <p className="font-sans text-xs text-error">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        {/* ── La matrícula. Congelada al aprobar. ───────────────────────── */}
        <div className="space-y-1.5">
          <Label
            htmlFor="agency_license_number"
            className="font-sans text-sm font-medium text-black"
          >
            Matrícula del colegio de corredores
          </Label>
          {isApproved ? (
            <>
              {/* Se muestra igual, en lectura: es información de la cuenta que
                  la persona necesita ver. Lo que se saca es poder cambiarla. */}
              <p className="font-sans text-[15px] text-graphite">
                {initialLicenseNumber || "—"}
              </p>
              <p className="flex items-start gap-2 font-sans text-xs text-graphite">
                <Lock size={14} className="mt-0.5 shrink-0" />
                <span>
                  Esta matrícula se verificó al aprobar tu inmobiliaria y queda
                  fija. Escribinos si necesitás corregirla.
                </span>
              </p>
            </>
          ) : (
            <>
              <Input
                id="agency_license_number"
                placeholder="1234"
                {...form.register("license_number")}
                className={FIELD_BOX}
              />
              <p className="font-sans text-xs text-graphite">
                El número con el que figura tu inmobiliaria en el colegio.
              </p>
              {form.formState.errors.license_number && (
                <p className="font-sans text-xs text-error">
                  {form.formState.errors.license_number.message}
                </p>
              )}
            </>
          )}
        </div>

          {/* ══════════════════════════════════════════════════════
              ⚠ QUÉ LE PASA A LA CUENTA SI GUARDA, ANTES DE GUARDAR
              ══════════════════════════════════════════════════════

              Acá había UNA LÍNEA en `text-xs text-graphite` —el tratamiento más
              apagado de la escala— que decía solo "Al guardar, tu solicitud
              vuelve a quedar en revisión", y únicamente para una agencia
              rechazada. Le faltaban las dos mitades que importan: QUÉ implica
              volver a revisión, y QUÉ NO se pierde. Frente a un cartel que habla
              de revisiones, el miedo real de un corredor es haber perdido el
              trabajo de cargar su cartera — el mismo criterio que ya rige el
              aviso de visibilidad del panel, que dice explícitamente que no se
              perdió nada.

              ⚠⚠ Y ACÁ ESTABA EL TEXTO INCOMPLETO QUE HUBO QUE CORREGIR. Decía
              que la inmobiliaria "sigue sin aparecer en el mapa […] IGUAL QUE
              AHORA", y enumeraba solo dos consecuencias (el mapa y publicar).
              Dos problemas:

                · OMITÍA EL SITIO DE MARCA y el resto. Medido contra la función
                  de la base:
                      agency_is_publicly_visible(agency_id) exige
                      approval_status = 'approved' AND s.status = 'active'
                      AND s.plan <> 'free'
                  y esa función la invocan las TRES policies públicas
                  (properties, property_images, leads) más resolveAgencyBySlug,
                  que es el sitio `/[slug]`. O sea que al no estar aprobada se
                  apagan CUATRO cosas, no dos: el mapa, las fotos, el registro
                  de consultas y el sitio propio.
                · "IGUAL QUE AHORA" ata el texto al estado de hoy. Es cierto
                  para una agencia ya apagada, y sería FALSO para una aprobada y
                  funcionando — que es exactamente hacia donde va este flujo (el
                  rechazo de nombre existe para agencias que venían andando).

              Una agencia podría pedir el cambio un viernes creyendo que no pasa
              nada y quedar invisible todo el fin de semana. Por eso el texto
              ahora enumera qué deja de verse, sin compararlo con el estado
              actual, y cierra con lo que NO se pierde. */}
        {/* ⚠ CUÁNDO SE MUESTRA, que es lo que lo volvió alcanzable:

              · agencia NO aprobada → siempre. Ya está en revisión, así que el
                aviso describe un estado en curso.
              · agencia APROBADA    → SOLO si el nombre difiere del que rige.
                Está funcionando y abrir Preferencias no le cambia nada; el
                aviso aparece en el momento exacto en que empieza a ser cierto,
                o sea cuando escribe un nombre distinto. Mostrarlo siempre sería
                alarmar a alguien que todavía no pidió nada. */}
        <Controller
          control={form.control}
          name="name"
          render={({ field }) => {
            const nameChanged =
              normalizeAgencyName(field.value ?? "") !==
              normalizeAgencyName(initialName);
            if (isApproved && !nameChanged) return <></>;

            return (
              <Notice
                tone="info"
                title={
                  isApproved
                    ? "Al guardar, tu cuenta vuelve a revisión"
                    : approvalStatus === "rejected"
                      ? "Al guardar, tu solicitud vuelve a revisión"
                      : "Tu solicitud ya está en revisión"
                }
                icon={<Clock size={18} />}
              >
                <>
                  <span className="block">
                    {isApproved
                      ? "Vamos a verificar el nombre nuevo en el colegio de corredores. "
                      : approvalStatus === "rejected"
                        ? "Vamos a verificar de nuevo el nombre y la matrícula en el colegio de corredores. "
                        : "Si cambiás estos datos, vamos a verificar los nuevos en el colegio de corredores. "}
                    <span className="text-black">
                      Mientras tu cuenta está en revisión no se ve nada tuyo en
                      público
                    </span>
                    : tus propiedades no aparecen en el mapa, sus fotos no se
                    muestran, nadie puede mandarte una consulta desde ahí y tu
                    sitio propio queda apagado. Tampoco vas a poder publicar
                    propiedades nuevas.
                  </span>
                  <span className="mt-1.5 block">
                    <span className="text-black">No perdés nada</span> de lo que
                    tengas cargado: tus propiedades, tus fotos y tus consultas
                    quedan donde están, y todo vuelve a verse solo en cuanto te
                    aprobemos.
                  </span>
                  <NameChangeCaveat />
                </>
              </Notice>
            );
          }}
        />

        {error && <p className="font-sans text-sm text-error">{error}</p>}
        {success && (
          <p className="font-sans text-sm text-success">{success}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending
            ? "Guardando..."
            : approvalStatus === "rejected"
              ? "Guardar y reenviar solicitud"
              : "Guardar datos"}
        </button>
      </form>
    </section>
  );
}

// ─── Lo que pasa específicamente con el NOMBRE ────────────────
//
// ⚠ Esto se agregó al aparecer `previous_name` / `name_change_requested_at` en
// `agencies`. El aviso decía qué le pasa a la CUENTA (vuelve a revisión, no se
// pierde nada) y no decía nada del NOMBRE en sí, que ahora es una decisión
// aparte y visible: el dueño compara el anterior con el nuevo y resuelve sobre
// ese cambio.
//
// ⚠ Y DICE QUÉ PASA SI EL NOMBRE NO SE APRUEBA, que es la parte que la agencia
// no puede adivinar: NO se revierte solo. Queda el nombre nuevo, con el motivo
// del rechazo a la vista, y es ella la que decide si lo corrige o insiste. Sin
// esta frase, una agencia rechazada podría quedarse esperando que el sistema le
// devuelva el nombre viejo —que no va a pasar— o creer que lo perdió.
//
// Va en las DOS ramas del aviso porque el cambio de nombre se puede pedir desde
// las dos (pendiente y rechazada), y está redactado condicionalmente ("si
// cambiás el nombre") para no afirmar un cambio que quizás no ocurra: esta misma
// pantalla también se usa para corregir solo la matrícula.
function NameChangeCaveat() {
  return (
    <span className="mt-1.5 block">
      <span className="text-black">Si cambiás el nombre</span>, vamos a ver el
      anterior y el nuevo juntos para revisar el cambio. Si no lo aprobamos, te
      decimos por qué y tu inmobiliaria queda con el nombre nuevo hasta que vos
      lo corrijas: no lo volvemos atrás por nuestra cuenta.
    </span>
  );
}

// ⚠ Acá vivían `ReadOnlyIdentity` y `ReadOnlyField`, que renderizaban los DOS
// campos en modo lectura para una agencia aprobada. Se eliminaron al pasar el
// corte de "todo el formulario" a "solo la matrícula": el nombre ahora es un
// campo editable en cualquier estado, y la matrícula muestra su valor y su
// candado dentro del propio formulario, junto a su Label.
