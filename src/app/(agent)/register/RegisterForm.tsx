"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerAction } from "./actions";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { cn } from "@/lib/utils";
import {
  LICENSE_NUMBER_ERROR,
  LICENSE_NUMBER_PATTERN,
  normalizeLicenseNumber,
} from "@/lib/utils/licenseNumber";

// Claim del panel de identidad (voz DESIGN §10: directo, sin marketing). Fácil de cambiar.
const CLAIM = "Sumá tu inmobiliaria al mapa de tu ciudad.";
const SUBCLAIM =
  "Publicá tus propiedades donde los compradores de tu ciudad ya están buscando.";

// Ciudad mínima para el selector (no necesitamos el resto de la fila).
type CityOption = { id: string; name: string };

const schema = z
  .object({
    fullName: z.string().min(1, "El nombre es requerido"),
    // La app solo registra inmobiliarias, así que siempre hay razón social.
    // .trim() conserva el rechazo de un nombre de solo espacios que antes hacía
    // el superRefine con `!d.agencyName?.trim()`.
    agencyName: z.string().trim().min(1, "El nombre de la inmobiliaria es requerido"),
    // Matrícula del colegio de corredores. Se normaliza ANTES de validar (sin
    // espacios, en mayúsculas), así "  1234 " entra como "1234". El transform
    // deja el valor ya normalizado en lo que se manda a la action.
    licenseNumber: z
      .string()
      .transform(normalizeLicenseNumber)
      .refine((v) => v.length > 0, "La matrícula es requerida")
      .refine((v) => LICENSE_NUMBER_PATTERN.test(v), LICENSE_NUMBER_ERROR),
    cityId: z.string().min(1, "Elegí una ciudad"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirmá la contraseña"),
    phoneWa: z
      .string()
      .regex(/^\d{10,}$/, "Solo números, mínimo 10 dígitos (ej: 5493854000000)"),
  })
  .superRefine((d, ctx) => {
    if (d.password !== d.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Las contraseñas no coinciden",
        path: ["confirmPassword"],
      });
    }
  });

type RegisterFormValues = z.infer<typeof schema>;

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-sans text-sm font-medium text-black">
        {label}
      </Label>
      {children}
      {error && <p className="font-sans text-xs text-error">{error}</p>}
    </div>
  );
}

export function RegisterForm({ cities }: { cities: CityOption[] }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cityId: "" },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    setServerError(null);
    const result = await registerAction({
      fullName: data.fullName,
      agencyName: data.agencyName,
      licenseNumber: data.licenseNumber,
      cityId: data.cityId,
      email: data.email,
      password: data.password,
      phoneWa: data.phoneWa,
    });
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
    // En caso de éxito, registerAction llama a redirect() server-side
  };

  return (
    <AuthLayout claim={CLAIM} subclaim={SUBCLAIM}>
      <h2 className="font-serif text-3xl font-semibold text-black mb-1.5">
        Crear cuenta
      </h2>
      <p className="font-sans text-sm text-graphite mb-7">
        Sumá tu inmobiliaria en un par de pasos.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Razón social de la inmobiliaria. Siempre requerida: la app solo
            registra inmobiliarias (ya no existen las cuentas de particular). */}
        <Field
          id="agencyName"
          label="Nombre de la inmobiliaria"
          error={errors.agencyName?.message}
        >
          <Input
            id="agencyName"
            type="text"
            autoComplete="organization"
            placeholder="Inmobiliaria López"
            {...register("agencyName")}
            className={cn(errors.agencyName && "border-error")}
          />
        </Field>

        {/* Matrícula: junto al nombre, son los dos datos de la agencia. Se
            guarda como texto (los ceros a la izquierda importan). */}
        <Field
          id="licenseNumber"
          label="Matrícula del colegio de corredores"
          error={errors.licenseNumber?.message}
        >
          <Input
            id="licenseNumber"
            type="text"
            inputMode="text"
            placeholder="1234"
            {...register("licenseNumber")}
            className={cn(errors.licenseNumber && "border-error")}
          />
          <p className="font-sans text-xs text-graphite">
            El número con el que figura tu inmobiliaria en el colegio de
            corredores. Lo verificamos antes de habilitar tu cuenta.
          </p>
        </Field>

        <Field id="fullName" label="Nombre completo" error={errors.fullName?.message}>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Juan Pérez"
            {...register("fullName")}
            className={cn(errors.fullName && "border-error")}
          />
        </Field>

        <Field id="cityId" label="Ciudad" error={errors.cityId?.message}>
          <Controller
            control={control}
            name="cityId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="cityId"
                  aria-invalid={!!errors.cityId}
                  className="w-full"
                >
                  <SelectValue placeholder="Elegí tu ciudad" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            {...register("email")}
            className={cn(errors.email && "border-error")}
          />
        </Field>

        <Field id="password" label="Contraseña" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("password")}
            className={cn(errors.password && "border-error")}
          />
        </Field>

        <Field
          id="confirmPassword"
          label="Confirmar contraseña"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("confirmPassword")}
            className={cn(errors.confirmPassword && "border-error")}
          />
        </Field>

        <Field
          id="phoneWa"
          label="WhatsApp (sin + ni espacios)"
          error={errors.phoneWa?.message}
        >
          <Input
            id="phoneWa"
            type="tel"
            autoComplete="tel"
            placeholder="5493854000000"
            {...register("phoneWa")}
            className={cn(errors.phoneWa && "border-error")}
          />
        </Field>

        {serverError && (
          <p className="font-sans text-sm text-error bg-terracota-subtle rounded-md px-3 py-2">
            {serverError}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-terracota hover:bg-terracota-hover text-paper border-0"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="font-sans text-sm text-graphite mt-7">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-terracota hover:underline font-medium">
          Iniciá sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
