"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateAgencyPhoneAction } from "@/app/(agent)/dashboard/preferencias/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  phone_wa: z
    .string()
    .regex(/^\d{10,}$/, "Solo números, sin + ni espacios. Ej: 5491112345678"),
});

type Values = z.infer<typeof schema>;

// Editor del teléfono de WhatsApp de la AGENCIA. Se renderiza solo si el user es
// admin (la página lo gatea); la action revalida el rol server-side igual.
export function AgencyPhoneForm({ initialPhone }: { initialPhone: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { phone_wa: initialPhone },
  });

  function onSubmit(values: Values) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
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
          <Input
            id="agency_phone_wa"
            placeholder="5491112345678"
            {...form.register("phone_wa")}
            className="bg-white border-stone focus-visible:ring-terracota"
          />
          <p className="font-sans text-xs text-graphite">
            Solo números, sin + ni espacios. Ejemplo: 5491112345678
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
