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
  pathname,
  onClose,
}: SidebarProps & { pathname: string; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Encabezado: marca + agente */}
      <div className="px-6 py-5 border-b border-white/10">
        <Wordmark size="md" variant="light" className="mb-5" />
        <p className="font-sans text-xs text-stone uppercase tracking-wider">
          {agent.agency?.name ?? ""}
        </p>
        <p className="font-sans text-base font-medium text-paper mt-0.5 truncate">
          {agent.full_name}
        </p>
        <div className="mt-3">
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
                  : "text-stone hover:text-paper px-3",
              ].join(" ")}
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-3 py-4 border-t border-white/10">
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

export function Sidebar({ agent, planUsage }: SidebarProps) {
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
          pathname={pathname}
          onClose={close}
        />
      </aside>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-black h-screen sticky top-0">
        <NavContent
          agent={agent}
          planUsage={planUsage}
          pathname={pathname}
          onClose={close}
        />
      </aside>
    </>
  );
}
