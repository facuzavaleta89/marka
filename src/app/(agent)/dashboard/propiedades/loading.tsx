import { PropertiesTableSkeleton } from "@/components/dashboard/PropertiesTable";

// UI de carga de la ruta (Next.js la muestra durante el fetch del server component).
export default function Loading() {
  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-4xl font-bold text-black">Propiedades</h1>
          {/* DOS chips, con el mismo alto y el mismo `mt-2` que los reales: el
              PlanBadge —que está siempre— y el FeaturedBadge, que aparece en
              cuanto el plan trae cupo de destacadas (hoy, dos de las tres
              agencias). Reservar solo el primero hacía saltar la cabecera
              ~32px al terminar de cargar, justo en las que pagan más.
              ⚠ La nota del agente común ("El cupo de destacadas es de toda la
              inmobiliaria") NO se reserva a propósito: depende del rol, que acá
              todavía no se sabe, y reservarla dejaría un hueco permanente para
              un admin. */}
          <div className="mt-2 h-6 w-44 rounded-sm bg-stone/30 animate-pulse" />
          <div className="mt-2 h-6 w-44 rounded-sm bg-stone/30 animate-pulse" />
        </div>
        <div className="h-10 w-40 shrink-0 rounded-md bg-stone/30 animate-pulse" />
      </div>
      <PropertiesTableSkeleton />
    </div>
  );
}
