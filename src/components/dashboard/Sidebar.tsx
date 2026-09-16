"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Inbox,
  Users,
  User,
  Settings,
  CreditCard,
  LogOut,
  Map,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PlanBadge } from "./PlanBadge";
import { Wordmark } from "@/components/brand/Wordmark";
import { logoutAction } from "@/app/(agent)/dashboard/actions";
import type { PlanUsage } from "@/types";

type SidebarAgent = {
  full_name: string;
  avatar_url: string | null;
  agency: { name: string } | null;
};

export interface SidebarProps {
  agent: SidebarAgent;
  planUsage: PlanUsage;
  // true solo si el usuario logueado es el dueño de la plataforma (calculado en
  // el server comparando user.id con ADMIN_USER_ID; nunca se expone el id al
  // cliente, solo este booleano). Gatea el acceso al panel /admin desde el nav.
  isAppAdmin: boolean;
  // true si el agente es admin DE SU agencia (agent.role === 'admin'). Distinto
  // de isAppAdmin: gatea el ítem "Equipo". La página y la action también lo
  // revalidan server-side; ocultar el menú es solo cosmético.
  isAgencyAdmin: boolean;
}

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  // Solo visible para el admin de la agencia (gestión de equipo).
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Propiedades", href: "/dashboard/propiedades", icon: Building2 },
  { label: "Consultas", href: "/dashboard/leads", icon: Inbox },
  { label: "Equipo", href: "/dashboard/equipo", icon: Users, adminOnly: true },
  { label: "Perfil", href: "/dashboard/perfil", icon: User },
  { label: "Preferencias", href: "/dashboard/preferencias", icon: Settings },
  { label: "Suscripción", href: "/dashboard/suscripcion", icon: CreditCard },
];

function NavContent({
  agent,
  planUsage,
  isAppAdmin,
  isAgencyAdmin,
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
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAgencyAdmin).map(({ label, href, icon: Icon, exact }) => {
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
            className={[
              "flex items-center gap-3 py-2.5 rounded-md font-sans text-sm transition-colors duration-100",
              pathname.startsWith("/admin")
                ? "border-l-[3px] border-terracota text-paper bg-white/5 pl-[calc(0.75rem_-_3px)] pr-3"
                : "text-stone hover:text-paper hover:bg-white/5 px-3",
            ].join(" ")}
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

// id del cajón de celular: lo referencia el `aria-controls` del botón de menú.
const MOBILE_NAV_ID = "dashboard-mobile-nav";

export function Sidebar({ agent, planUsage, isAppAdmin, isAgencyAdmin }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // ⚠ EL CAJÓN SE CIERRA AL CAMBIAR DE RUTA POR CUALQUIER CAMINO, no solo al
  // tocar un enlace del menú: también con "atrás" del navegador. Se resuelve
  // durante el render, comparando con la ruta anterior guardada en estado (el
  // patrón de React para ajustar estado cuando cambia una prop), y NO con un
  // efecto que mire `pathname`: un setState dentro de un efecto pinta un cuadro
  // con el cajón todavía abierto sobre la pantalla nueva.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setMobileOpen(false);
  }

  const close = () => setMobileOpen(false);

  // Cerrar a pedido (✕ o Escape) devuelve el foco al botón que abrió el cajón.
  // Sin esto el foco quedaría adentro de un aside que pasa a `inert`, o sea en
  // ningún lado, y quien navega con teclado pierde su lugar.
  const closeAndRestoreFocus = () => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <>
      {/* Barra superior (celular).
          ⚠ ESTÁ EN EL FLUJO, NO ES FIJA. Antes el botón de menú era `fixed` y el
          `main` —que es el que scrollea— solo le dejaba un relleno arriba: al
          bajar, el contenido pasaba por debajo del botón. Como parte del flujo,
          el área que scrollea arranca debajo de la barra y nunca pasa por detrás.
          Sin z-index a propósito: el velo y el cajón (fixed) la cubren al abrirse.
          Solo la marca: agencia, agente y plan ya están en el cajón. */}
      <div className="md:hidden flex h-14 shrink-0 items-center gap-1 border-b border-white/10 bg-black px-4">
        {/* 44×44 reales (mínimo táctil, DESIGN §6): en la barra sobra alto. El
            `-ml-3` alinea el ícono con el margen de 16px de la barra. */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          className="-ml-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-paper transition-colors duration-100 hover:bg-white/5"
          aria-label="Abrir menú"
          aria-expanded={mobileOpen}
          aria-controls={MOBILE_NAV_ID}
        >
          <Menu size={20} />
        </button>
        <Wordmark size="md" variant="light" />
      </div>

      {/* Overlay oscuro (mobile) */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar mobile.
          Cerrado es `inert`: queda fuera de pantalla por el translate, y sin
          esto sus enlaces seguían en el orden de tabulación y el lector de
          pantalla los leía. */}
      <aside
        id={MOBILE_NAV_ID}
        inert={!mobileOpen}
        className={[
          "md:hidden fixed inset-y-0 left-0 w-64 bg-black z-50 transition-transform duration-[220ms] ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Dibujo de 28px con el área de toque extendida a 44px por el
            pseudo-elemento (mismo recurso que ui/checkbox.tsx): más grande
            empujaría el encabezado del cajón. */}
        <button
          type="button"
          onClick={closeAndRestoreFocus}
          className="absolute top-4 right-4 p-1 text-stone hover:text-paper after:absolute after:-inset-2"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
        <NavContent
          agent={agent}
          planUsage={planUsage}
          isAppAdmin={isAppAdmin}
          isAgencyAdmin={isAgencyAdmin}
          pathname={pathname}
          onClose={close}
        />
      </aside>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-black h-dvh sticky top-0">
        <NavContent
          agent={agent}
          planUsage={planUsage}
          isAppAdmin={isAppAdmin}
          isAgencyAdmin={isAgencyAdmin}
          pathname={pathname}
          onClose={close}
        />
      </aside>
    </>
  );
}
