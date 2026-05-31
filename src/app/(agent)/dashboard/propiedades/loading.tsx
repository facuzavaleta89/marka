import { PropertiesTableSkeleton } from "@/components/dashboard/PropertiesTable";

// UI de carga de la ruta (Next.js la muestra durante el fetch del server component).
export default function Loading() {
  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-4xl font-bold text-black">Propiedades</h1>
          <div className="mt-2 h-6 w-44 rounded-sm bg-stone/30 animate-pulse" />
        </div>
        <div className="h-10 w-40 shrink-0 rounded-md bg-stone/30 animate-pulse" />
      </div>
      <PropertiesTableSkeleton />
    </div>
  );
}
