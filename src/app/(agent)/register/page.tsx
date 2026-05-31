"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "./actions";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { cn } from "@/lib/utils";

// Claim del panel de identidad (voz DESIGN §10: directo, sin marketing). Fácil de cambiar.
const CLAIM = "Sumá tu inmobiliaria al mapa de tu ciudad.";
const SUBCLAIM =
  "Publicá tus propiedades donde los compradores de tu ciudad ya están buscando.";

const schema = z
  .object({
    fullName: z.string().min(1, "El nombre es requerido"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirmá la contraseña"),
    phoneWa: z
      .string()
      .regex(/^\d{10,}$/, "Solo números, mínimo 10 dígitos (ej: 5493854000000)"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof schema>;

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

export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setServerError(null);
    const result = await registerAction({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      phoneWa: data.phoneWa,
    });
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
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
