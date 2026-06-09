"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  User,
  Settings,
  CreditCard,
  LogOut,
  Map,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { PlanBadge } from "./PlanBadge";
import { Wordmark } from "@/components/brand/Wordmark";
import { logoutAction } from "@/app/(agent)/dashboard/actions";
import type { PlanUsage } from "@/types";

type SidebarAgent = {
  full_name: string;
  avatar_url: string | null;
  agency: { name: string } | null;
};

interface SidebarProps {
  agent: SidebarAgent;
  planUsage: PlanUsage;
  // true solo si el usuario logueado es el dueño de la plataforma (calculado en
  // el server comparando user.id con ADMIN_USER_ID; nunca se expone el id al
  // cliente, solo este booleano). Gatea el acceso al panel /admin desde el nav.
  isAppAdmin: boolean;
}

const NAV_ITEMS = [
  { label: "Inicio", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Propiedades", href: "/dashboard/propiedades", icon: Building2 },
  { label: "Perfil", href: "/dashboard/perfil", icon: User },
  { label: "Preferencias", href: "/dashboard/preferencias", icon: Settings },
  { label: "Suscripción", href: "/dashboard/suscripcion", icon: CreditCard },
];

function NavContent({
  agent,
  planUsage,
  isAppAdmin,
  pathname,
  onClose,
}: SidebarProps & { pathname: string; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Encabezado: marca + agente */}
      <div className="px-6 py-5 border-b border-white/10">
        <Wordmark size="md" variant="light" className="mb-5" />
        <div className="flex items-center gap-3">
          {agent.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.avatar_url}
              alt={agent.full_name}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/15"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
              <span className="font-serif text-base font-semibold text-paper">
                {agent.full_name.trim().charAt(0).toUpperCase() || "?"}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-sans text-xs text-stone uppercase tracking-wider truncate">
              {agent.agency?.name ?? ""}
            </p>
            <p className="font-sans text-sm font-medium text-paper truncate">
              {agent.full_name}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <PlanBadge planUsage={planUsage} />
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={[
                "flex items-center gap-3 py-2.5 rounded-md font-sans text-sm transition-colors duration-100",
                active
                  ? "border-l-[3px] border-terracota text-paper bg-white/5 pl-[calc(0.75rem_-_3px)] pr-3"
                  : "text-stone hover:text-paper hover:bg-white/5 px-3",
              ].join(" ")}
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Salidas: ver el mapa público + cerrar sesión.
          "Ver el mapa" no es navegación interna del dashboard, por eso vive
          en el footer junto a logout y no en NAV_ITEMS (su match activo por
          pathname.startsWith("/") daría positivo en cualquier ruta). */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        {/* Panel admin: salida especial, solo para el dueño de la plataforma.
            No va en NAV_ITEMS (no es navegación de agencia y su match activo
            no aplica acá); vive en el footer junto a las otras salidas. */}
        {isAppAdmin && (
          <Link
            href="/admin"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 font-sans text-sm text-stone hover:text-paper transition-colors duration-100"
          >
            <ShieldCheck size={18} strokeWidth={1.75} />
            Panel admin
          </Link>
        )}
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 font-sans text-sm text-stone hover:text-paper transition-colors duration-100"
        >
          <Map size={18} strokeWidth={1.75} />
          Ver el mapa
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 w-full font-sans text-sm text-stone hover:text-paper transition-colors duration-100"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar({ agent, planUsage, isAppAdmin }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const close = () => setMobileOpen(false);

  return (
    <>
      {/* Botón hamburguesa (mobile) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-black text-paper shadow-md"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Overlay oscuro (mobile) */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar mobile */}
      <aside
        className={[
          "md:hidden fixed inset-y-0 left-0 w-64 bg-black z-50 transition-transform duration-[220ms] ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <button
          onClick={close}
          className="absolute top-4 right-4 p-1 text-stone hover:text-paper"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
        <NavContent
          agent={agent}
          planUsage={planUsage}
          isAppAdmin={isAppAdmin}
          pathname={pathname}
          onClose={close}
        />
      </aside>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-black h-screen sticky top-0">
        <NavContent
          agent={agent}
          planUsage={planUsage}
          isAppAdmin={isAppAdmin}
          pathname={pathname}
          onClose={close}
        />
      </aside>
    </>
  );
}
