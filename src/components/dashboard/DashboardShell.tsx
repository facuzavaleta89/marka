import { Sidebar, type SidebarProps } from "./Sidebar";

// Shell del área privada: barra lateral + área de contenido. Lo usan los dos
// layouts que montan el panel (dashboard/layout.tsx y admin/layout.tsx), que
// antes devolvían este mismo JSX copiado. Cada layout conserva su resolución de
// sesión, su gating y el cálculo de isAppAdmin/isAgencyAdmin; acá solo vive la
// estructura, para que un cambio de layout no haya que hacerlo dos veces.
type DashboardShellProps = SidebarProps & {
  children: React.ReactNode;
};

export function DashboardShell({ children, ...sidebarProps }: DashboardShellProps) {
  return (
    // Columna en celular (barra superior de Sidebar arriba, main abajo) y fila
    // en escritorio (aside a la izquierda, main a la derecha). Los elementos
    // fixed de Sidebar (velo y cajón) no ocupan lugar en ninguna de las dos.
    <div className="flex h-dvh flex-col bg-mist overflow-hidden md:flex-row">
      <Sidebar {...sidebarProps} />
      {/* relative: main es el contenedor scrolleable del dashboard; al ser
          containing block, los descendientes position:absolute de los formularios
          (internos de Radix/shadcn) quedan anclados a él y no al viewport — si no,
          en páginas altas (nueva/editar) escapan al ICB y generan un segundo scroll
          fantasma en el documento por debajo del form. No quitar.
          min-h-0: en la columna de celular, sin esto el main no puede achicarse
          por debajo de su contenido y empujaría la pantalla en vez de scrollear. */}
      <main className="relative flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
