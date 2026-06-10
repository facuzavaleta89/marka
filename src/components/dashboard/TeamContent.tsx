"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, X, Mail, Phone } from "lucide-react";
import { createAgentAction } from "@/app/(agent)/dashboard/equipo/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Agent } from "@/types";

// ─── Tipos ───────────────────────────────────────────────────

export type TeamMember = Pick<
  Agent,
  "id" | "full_name" | "email" | "phone_wa" | "role" | "created_at"
>;

interface TeamContentProps {
  members: TeamMember[];
  // id del admin logueado: para marcar "Vos" en la lista.
  currentUserId: string;
}

// ─── Badge de rol ─────────────────────────────────────────────

function RoleBadge({ role }: { role: Agent["role"] }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={`inline-block font-sans text-[11px] font-semibold uppercase tracking-wide rounded-sm px-2 py-0.5 ${
        isAdmin ? "bg-terracota-subtle text-terracota" : "bg-mist text-graphite"
      }`}
    >
      {isAdmin ? "Admin" : "Agente"}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────

export function TeamContent({ members, currentUserId }: TeamContentProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Acción: agregar agente */}
      <div className="flex justify-end">
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms]"
          >
            <UserPlus size={18} strokeWidth={1.75} />
            Agregar agente
          </button>
        )}
      </div>

      {/* Form de alta (inline, se revela al tocar "Agregar agente") */}
      {showForm && (
        <CreateAgentForm onClose={() => setShowForm(false)} />
      )}

      {/* Lista del equipo */}
      <TeamList members={members} currentUserId={currentUserId} />
    </div>
  );
}

// ─── Lista / tabla del equipo ─────────────────────────────────

function TeamList({
  members,
  currentUserId,
}: {
  members: TeamMember[];
  currentUserId: string;
}) {
  if (members.length === 0) {
    return (
      <div className="bg-paper border border-stone rounded-lg px-6 py-16 text-center">
        <p className="font-sans text-base text-graphite">
          Todavía no hay agentes en tu equipo.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Tabla (desktop) ── */}
      <div className="hidden md:block bg-paper border border-stone rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone">
              {["Nombre", "Email", "Teléfono", "Rol"].map((col) => (
                <th
                  key={col}
                  className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite text-left px-4 py-3 first:pl-5 last:pr-5"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {members.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-mist/40">
                {/* Nombre */}
                <td className="px-5 py-3">
                  <span className="font-sans text-sm font-medium text-black">
                    {m.full_name}
                  </span>
                  {m.id === currentUserId && (
                    <span className="ml-2 font-sans text-xs text-graphite">
                      (vos)
                    </span>
                  )}
                </td>

                {/* Email */}
                <td className="px-4 py-3">
                  <span className="font-sans text-sm text-graphite">
                    {m.email ?? "—"}
                  </span>
                </td>

                {/* Teléfono */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-sans text-sm text-graphite">
                    {m.phone_wa}
                  </span>
                </td>

                {/* Rol */}
                <td className="px-4 py-3">
                  <RoleBadge role={m.role} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Cards (mobile) ── */}
      <div className="md:hidden space-y-3">
        {members.map((m) => (
          <div
            key={m.id}
            className="bg-paper border border-stone rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-sans text-sm font-medium text-black truncate">
                  {m.full_name}
                  {m.id === currentUserId && (
                    <span className="ml-2 font-sans text-xs text-graphite">
                      (vos)
                    </span>
                  )}
                </p>
              </div>
              <div className="shrink-0">
                <RoleBadge role={m.role} />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-stone space-y-1.5">
              <p className="flex items-center gap-2 font-sans text-sm text-graphite truncate">
                <Mail size={14} className="shrink-0" />
                {m.email ?? "—"}
              </p>
              <p className="flex items-center gap-2 font-sans text-sm text-graphite">
                <Phone size={14} className="shrink-0" />
                {m.phone_wa}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Form de creación de agente ───────────────────────────────

const createAgentSchema = z.object({
  full_name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  phone_wa: z
    .string()
    .regex(/^\d{10,}$/, "Solo números, sin + ni espacios. Ej: 5491112345678"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type CreateAgentValues = z.infer<typeof createAgentSchema>;

function CreateAgentForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateAgentValues>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: { full_name: "", email: "", phone_wa: "", password: "" },
  });

  function onSubmit(values: CreateAgentValues) {
    setError(null);
    startTransition(async () => {
      const result = await createAgentAction(values);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Éxito: limpiar, cerrar y refrescar para que el agente aparezca en la lista.
      form.reset();
      onClose();
      router.refresh();
    });
  }

  return (
    <section className="bg-paper border border-stone rounded-lg p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-black">
            Nuevo agente
          </h2>
          <p className="mt-1 font-sans text-xs text-graphite">
            La contraseña es temporal: compartísela al agente para que ingrese.
            Después puede cambiarla desde su perfil.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-graphite hover:text-black transition-colors shrink-0"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Nombre completo */}
        <div className="space-y-1.5">
          <Label
            htmlFor="agent_full_name"
            className="font-sans text-sm font-medium text-black"
          >
            Nombre completo
          </Label>
          <Input
            id="agent_full_name"
            {...form.register("full_name")}
            className="bg-white border-stone focus-visible:ring-terracota"
          />
          {form.formState.errors.full_name && (
            <p className="font-sans text-xs text-error">
              {form.formState.errors.full_name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label
            htmlFor="agent_email"
            className="font-sans text-sm font-medium text-black"
          >
            Email
          </Label>
          <Input
            id="agent_email"
            type="email"
            placeholder="agente@ejemplo.com"
            {...form.register("email")}
            className="bg-white border-stone focus-visible:ring-terracota"
          />
          {form.formState.errors.email && (
            <p className="font-sans text-xs text-error">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* WhatsApp */}
        <div className="space-y-1.5">
          <Label
            htmlFor="agent_phone_wa"
            className="font-sans text-sm font-medium text-black"
          >
            Número de WhatsApp
          </Label>
          <Input
            id="agent_phone_wa"
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

        {/* Contraseña temporal */}
        <div className="space-y-1.5">
          <Label
            htmlFor="agent_password"
            className="font-sans text-sm font-medium text-black"
          >
            Contraseña temporal
          </Label>
          <Input
            id="agent_password"
            type="text"
            {...form.register("password")}
            className="bg-white border-stone focus-visible:ring-terracota"
          />
          {form.formState.errors.password && (
            <p className="font-sans text-xs text-error">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {error && <p className="font-sans text-sm text-error">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? "Creando..." : "Crear agente"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-md font-sans text-sm font-medium text-graphite hover:text-black transition-colors duration-[120ms]"
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
