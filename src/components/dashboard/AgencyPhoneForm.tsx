"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateAgencyPhoneAction } from "@/app/(agent)/dashboard/preferencias/actions";
import { Label } from "@/components/ui/label";
import {
  PhoneWaInput,
  PhoneWaReviewNotice,
} from "@/components/forms/PhoneWaInput";
import {
  PHONE_WA_HELP,
  phoneWaField,
  splitStoredPhoneWa,
} from "@/lib/utils/phoneWa";

// El esquema depende del número guardado: si es uno viejo sin el formato
// esperado, ese valor exacto se acepta sin reformatear (ver `phoneWaField`).
function makeSchema(preservedPhone: string | null) {
  return z.object({
    phone_wa: phoneWaField(preservedPhone),
  });
}

type Values = z.infer<ReturnType<typeof makeSchema>>;

// Editor del teléfono de WhatsApp de la AGENCIA. Se renderiza solo si el user es
// admin (la página lo gatea); la action revalida el rol server-side igual.
export function AgencyPhoneForm({ initialPhone }: { initialPhone: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  // ⚠ Un número guardado sin el formato esperado se muestra TAL CUAL y no se
  // corrige solo. Ver `splitStoredPhoneWa`.
  const storedPhone = splitStoredPhoneWa(initialPhone);
  const preservedPhone = storedPhone.recognized ? null : initialPhone;
  const schema = useMemo(() => makeSchema(preservedPhone), [preservedPhone]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { phone_wa: storedPhone.national },
  });

  function onSubmit(values: Values) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      // `values.phone_wa` ya es el número COMPLETO: lo armó el esquema.
      const result = await updateAgencyPhoneAction({ phone_wa: values.phone_wa });
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <section className="bg-paper border border-stone rounded-lg p-6 space-y-4">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-black">
          Datos de la agencia
        </h2>
        <p className="font-sans text-xs text-graphite mt-0.5">
          El WhatsApp de contacto de la agencia. Es distinto del tuyo, que editás
          en Perfil.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="agency_phone_wa"
            className="font-sans text-sm font-medium text-black"
          >
            Número de WhatsApp de la agencia
          </Label>
          <Controller
            control={form.control}
            name="phone_wa"
            render={({ field, fieldState }) => (
              <>
                <PhoneWaInput
                  id="agency_phone_wa"
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  variant="box"
                  invalid={!!fieldState.error}
                  preservedValue={preservedPhone}
                  describedBy="agency_phone_wa_help"
                />
                {preservedPhone !== null && field.value === preservedPhone && (
                  <PhoneWaReviewNotice stored={preservedPhone} />
                )}
              </>
            )}
          />
          <p
            id="agency_phone_wa_help"
            className="font-sans text-xs text-graphite"
          >
            {PHONE_WA_HELP}
          </p>
          {form.formState.errors.phone_wa && (
            <p className="font-sans text-xs text-error">
              {form.formState.errors.phone_wa.message}
            </p>
          )}
        </div>

        {error && <p className="font-sans text-sm text-error">{error}</p>}
        {success && (
          <p className="font-sans text-sm text-success">
            Teléfono de la agencia actualizado
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Guardando..." : "Guardar teléfono"}
        </button>
      </form>
    </section>
  );
}
