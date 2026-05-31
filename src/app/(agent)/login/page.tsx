"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";
import { Wordmark } from "@/components/brand/Wordmark";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setServerError(null);
    const result = await loginAction(data);
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
    // En caso de éxito, loginAction llama a redirect() server-side
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center mb-8">
          <Wordmark size="lg" variant="dark" />
        </h1>

        <div className="bg-white border border-stone rounded-lg p-8 shadow-sm">
          <h2 className="font-serif text-2xl font-semibold text-black mb-6">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="font-sans text-sm font-medium text-black"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                {...register("email")}
                className={cn(errors.email && "border-error focus-visible:ring-error")}
              />
              {errors.email && (
                <p className="font-sans text-xs text-error">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="font-sans text-sm font-medium text-black"
              >
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password")}
                className={cn(
                  errors.password && "border-error focus-visible:ring-error"
                )}
              />
              {errors.password && (
                <p className="font-sans text-xs text-error">
                  {errors.password.message}
                </p>
              )}
            </div>

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
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </div>

        <p className="font-sans text-sm text-graphite text-center mt-6">
          ¿No tenés cuenta?{" "}
          <Link
            href="/register"
            className="text-terracota hover:underline font-medium"
          >
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
