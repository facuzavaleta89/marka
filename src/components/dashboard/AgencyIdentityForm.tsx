"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock } from "lucide-react";
import { updateAgencyIdentityAction } from "@/app/(agent)/dashboard/preferencias/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApprovalStatus } from "@/types";
import {
  LICENSE_NUMBER_ERROR,
  LICENSE_NUMBER_PATTERN,
  normalizeLicenseNumber,
} from "@/lib/utils/licenseNumber";

const schema = z.object({
  name: z.string().trim().min(1, "El nombre de la inmobiliaria es requerido"),
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
// Editable SOLO si la agencia está 'pending' o 'rejected'. Aprobada → los datos
// se muestran igual, en modo lectura, porque son información de la cuenta que
// la persona necesita ver; lo que se saca es la posibilidad de cambiarlos.
// ⚠ Esto es cosmético: la regla real la aplica updateAgencyIdentityAction en el
// server (agencies no tiene policy de UPDATE y se escribe con service role).
export function AgencyIdentityForm({
  initialName,
  initialLicenseNumber,
  approvalStatus,
}: {
  initialName: string;
  initialLicenseNumber: string;
  approvalStatus: ApprovalStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isLocked = approvalStatus === "approved";

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
          {isLocked
            ? "Tu inmobiliaria está aprobada, así que estos datos quedan fijos."
            : "El nombre y la matrícula que verificamos para aprobar tu cuenta."}
        </p>
      </div>

      {isLocked ? (
        <ReadOnlyIdentity
          name={initialName}
          licenseNumber={initialLicenseNumber}
        />
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="agency_name"
              className="font-sans text-sm font-medium text-black"
            >
              Nombre de la inmobiliaria
            </Label>
            <Input
              id="agency_name"
              placeholder="Inmobiliaria López"
              {...form.register("name")}
              className="bg-white border-stone focus-visible:ring-terracota"
            />
            {form.formState.errors.name && (
              <p className="font-sans text-xs text-error">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="agency_license_number"
              className="font-sans text-sm font-medium text-black"
            >
              Matrícula del colegio de corredores
            </Label>
            <Input
              id="agency_license_number"
              placeholder="1234"
              {...form.register("license_number")}
              className="bg-white border-stone focus-visible:ring-terracota"
            />
            <p className="font-sans text-xs text-graphite">
              El número con el que figura tu inmobiliaria en el colegio.
            </p>
            {form.formState.errors.license_number && (
              <p className="font-sans text-xs text-error">
                {form.formState.errors.license_number.message}
              </p>
            )}
          </div>

          {approvalStatus === "rejected" && (
            <p className="font-sans text-xs text-graphite">
              Al guardar, tu solicitud vuelve a quedar en revisión.
            </p>
          )}

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
      )}
    </section>
  );
}

// Vista de solo lectura para una agencia aprobada: los datos se ven, pero no se
// tocan. No se ocultan porque son información de la cuenta.
function ReadOnlyIdentity({
  name,
  licenseNumber,
}: {
  name: string;
  licenseNumber: string;
}) {
  return (
    <div className="space-y-4">
      <ReadOnlyField label="Nombre de la inmobiliaria" value={name} />
      <ReadOnlyField
        label="Matrícula del colegio de corredores"
        value={licenseNumber || "—"}
      />
      <p className="flex items-start gap-2 font-sans text-xs text-graphite">
        <Lock size={14} className="mt-0.5 shrink-0" />
        <span>
          Estos datos se verificaron al aprobar tu inmobiliaria y el nombre está
          regulado por el colegio de corredores. Escribinos si necesitás
          corregirlos.
        </span>
      </p>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="font-sans text-sm font-medium text-black">{label}</p>
      <p className="font-sans text-[15px] text-graphite">{value}</p>
    </div>
  );
}
