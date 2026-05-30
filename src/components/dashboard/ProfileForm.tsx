"use client";

import { useState, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  updateProfileAction,
  updatePasswordAction,
} from "@/app/(agent)/dashboard/perfil/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileFormProps {
  agentId: string;
  agent: {
    full_name: string;
    phone_wa: string;
    avatar_url: string | null;
  };
}

const profileSchema = z.object({
  full_name: z.string().min(1, "El nombre es requerido"),
  phone_wa: z
    .string()
    .min(10, "El número debe tener al menos 10 dígitos")
    .regex(/^\d+$/, "Solo números, sin + ni espacios. Ej: 5491112345678"),
});

const passwordSchema = z
  .object({
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirm: z.string().min(1, "Confirmá la contraseña"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export function ProfileForm({ agentId, agent }: ProfileFormProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(agent.avatar_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profilePending, startProfileTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: agent.full_name,
      phone_wa: agent.phone_wa,
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleProfileSubmit(values: ProfileValues) {
    setProfileError(null);
    setProfileSuccess(false);

    startProfileTransition(async () => {
      let avatar_url: string | undefined = undefined;

      if (avatarFile) {
        const supabase = createClient();
        const ext = avatarFile.name.split(".").pop();
        const path = `avatars/${agentId}/avatar${ext ? "." + ext : ""}`;
        const { error: uploadError } = await supabase.storage
          .from("property-images")
          .upload(path, avatarFile, { upsert: true });

        if (uploadError) {
          setProfileError("No se pudo subir la foto. Intentá de nuevo.");
          return;
        }

        const { data: urlData } = supabase.storage
          .from("property-images")
          .getPublicUrl(path);
        avatar_url = urlData.publicUrl;
      }

      const result = await updateProfileAction({
        full_name: values.full_name,
        phone_wa: values.phone_wa,
        avatar_url,
      });

      if (result?.error) {
        setProfileError(result.error);
      } else {
        setProfileSuccess(true);
        setAvatarFile(null);
      }
    });
  }

  function handlePasswordSubmit(values: PasswordValues) {
    setPasswordError(null);
    setPasswordSuccess(false);

    startPasswordTransition(async () => {
      const result = await updatePasswordAction({ password: values.password });
      if (result?.error) {
        setPasswordError(result.error);
      } else {
        setPasswordSuccess(true);
        passwordForm.reset();
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Datos del perfil */}
      <section className="bg-paper border border-stone rounded-lg p-6">
        <h2 className="font-serif text-2xl font-semibold text-black mb-6">
          Datos del perfil
        </h2>

        <form
          onSubmit={profileForm.handleSubmit(handleProfileSubmit)}
          className="space-y-5"
        >
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-mist border border-stone shrink-0">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Foto de perfil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-graphite">
                  <Camera size={24} />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-[120ms]"
                aria-label="Cambiar foto de perfil"
              >
                <Camera size={18} className="text-paper" />
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-sans text-sm font-medium text-terracota hover:text-terracota-hover transition-colors duration-[120ms]"
              >
                Cambiar foto
              </button>
              <p className="font-sans text-xs text-graphite mt-1">
                JPG, PNG o WEBP · Máx. 2 MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Nombre completo */}
          <div className="space-y-1.5">
            <Label
              htmlFor="full_name"
              className="font-sans text-sm font-medium text-black"
            >
              Nombre completo
            </Label>
            <Input
              id="full_name"
              {...profileForm.register("full_name")}
              className="bg-white border-stone focus-visible:ring-terracota"
            />
            {profileForm.formState.errors.full_name && (
              <p className="font-sans text-xs text-error">
                {profileForm.formState.errors.full_name.message}
              </p>
            )}
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <Label
              htmlFor="phone_wa"
              className="font-sans text-sm font-medium text-black"
            >
              Número de WhatsApp
            </Label>
            <Input
              id="phone_wa"
              placeholder="5491112345678"
              {...profileForm.register("phone_wa")}
              className="bg-white border-stone focus-visible:ring-terracota"
            />
            <p className="font-sans text-xs text-graphite">
              Solo números, sin + ni espacios. Ejemplo: 5491112345678
            </p>
            {profileForm.formState.errors.phone_wa && (
              <p className="font-sans text-xs text-error">
                {profileForm.formState.errors.phone_wa.message}
              </p>
            )}
          </div>

          {profileError && (
            <p className="font-sans text-sm text-error">{profileError}</p>
          )}
          {profileSuccess && (
            <p className="font-sans text-sm text-success">Perfil actualizado</p>
          )}

          <button
            type="submit"
            disabled={profilePending}
            className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {profilePending ? "Guardando..." : "Guardar perfil"}
          </button>
        </form>
      </section>

      {/* Cambiar contraseña */}
      <section className="bg-paper border border-stone rounded-lg p-6">
        <h2 className="font-serif text-2xl font-semibold text-black mb-6">
          Cambiar contraseña
        </h2>

        <form
          onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
          className="space-y-5"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="font-sans text-sm font-medium text-black"
            >
              Nueva contraseña
            </Label>
            <Input
              id="password"
              type="password"
              {...passwordForm.register("password")}
              className="bg-white border-stone focus-visible:ring-terracota"
            />
            {passwordForm.formState.errors.password && (
              <p className="font-sans text-xs text-error">
                {passwordForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="confirm"
              className="font-sans text-sm font-medium text-black"
            >
              Confirmar contraseña
            </Label>
            <Input
              id="confirm"
              type="password"
              {...passwordForm.register("confirm")}
              className="bg-white border-stone focus-visible:ring-terracota"
            />
            {passwordForm.formState.errors.confirm && (
              <p className="font-sans text-xs text-error">
                {passwordForm.formState.errors.confirm.message}
              </p>
            )}
          </div>

          {passwordError && (
            <p className="font-sans text-sm text-error">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="font-sans text-sm text-success">Contraseña actualizada</p>
          )}

          <button
            type="submit"
            disabled={passwordPending}
            className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {passwordPending ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>
      </section>
    </div>
  );
}
