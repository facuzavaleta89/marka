import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SafeAreaProbe } from "./SafeAreaProbe";

// ⚠ PÁGINA DE MEDICIÓN TEMPORAL — rama descartable, nunca se mergea.
// Existe para medir en teléfonos reales cuánto valen las zonas seguras y los
// altos de viewport antes de diseñar su uso en la app.

// `viewportFit: "cover"` SOLO ACÁ. Next combina el `viewport` de cada segmento
// clave por clave (`mergeViewport` en next/dist/lib/metadata/resolve-metadata.js):
// esta clave se suma a la del layout raíz y el `themeColor` de allá se conserva
// sin repetirlo. El resto de la app sigue sin `viewport-fit`.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Sonda de zona segura",
  robots: { index: false, follow: false },
};

export default function SafeAreaProbePage() {
  return (
    // Pantalla completa con scroll propio: el documento tiene lock de scroll.
    <div className="h-dvh overflow-y-auto bg-paper">
      <main className="mx-auto max-w-2xl space-y-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
        <p
          role="status"
          className="rounded-md border border-terracota bg-terracota-subtle px-4 py-3 font-sans text-base font-semibold text-black"
        >
          Página de medición temporal
        </p>

        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-md border border-stone px-4 font-sans text-base text-black"
        >
          Volver a la home
        </Link>

        <SafeAreaProbe />
      </main>
    </div>
  );
}
