import type { Metadata } from "next";
import { Noto_Serif, DM_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/utils/siteUrl";

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // ⚠ SIN `metadataBase`, USAR UNA RUTA RELATIVA EN CUALQUIER CAMPO DE METADATA
  // BASADO EN URL ROMPE LA CONSTRUCCIÓN DEL SITIO. La documentación oficial lo
  // dice con esas palabras: "Using a relative path in a URL-based metadata field
  // without configuring a metadataBase will cause a build error". Y esta tanda
  // estrenó justamente esos campos: la canónica y la imagen de la vista previa
  // de la página de la propiedad.
  //
  // Va acá, en la disposición raíz, porque aplica "al segmento actual y a todos
  // los de abajo" — o sea a todas las rutas de una sola vez.
  //
  // El valor sale de NEXT_PUBLIC_SITE_URL vía `SITE_URL`, que además es quien
  // corta si la variable falta. NO se usa la variable automática del proveedor
  // de despliegue: apunta al despliegue concreto, no al dominio. Ver siteUrl.ts.
  metadataBase: new URL(SITE_URL),
  title: {
    // `default` para las rutas que no ponen título propio; `template` para que
    // las que sí lo ponen —la página de la propiedad— queden como
    // "Casa 3 ambientes centro · Marka" en vez de perder la marca. Antes era una
    // cadena suelta, con la que un título hijo reemplazaba todo.
    default: "Marka",
    template: "%s · Marka",
  },
  description: "Marketplace inmobiliario",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
  },
  // Vista previa por defecto al pegar un enlace de Marka en una app de
  // mensajería. La página de la propiedad la pisa con sus propios datos y su
  // foto de portada; esto es lo que ven el resto de las rutas, que hasta ahora
  // no mostraban ni imagen ni descripción.
  openGraph: {
    type: "website",
    siteName: "Marka",
    locale: "es_AR",
    title: "Marka",
    description: "Marketplace inmobiliario",
    // Relativa a propósito: es exactamente el caso que `metadataBase` resuelve.
    images: ["/icon-512.png"],
  },
};

export const viewport = {
  themeColor: "#FBF9F6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={cn("h-full antialiased", notoSerif.variable, dmSans.variable)}
    >
      <body className="min-h-full">
        {children}
        {/* Marco editorial fino alrededor de toda la ventana de la app: 1px stone,
            como el margen de una página. Overlay fixed → no afecta el layout, no
            genera scroll y no recorta contenido; pointer-events-none no bloquea.
            mix-blend-multiply: la hairline stone se multiplica contra el fondo —
            sobre paper queda como un hilo cálido sutil; sobre los fondos oscuros
            (sidebar negro, gradiente del login) tiende a negro y se desvanece,
            en vez de "saltar" como una línea blanquecina. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9999] border border-stone mix-blend-multiply"
        />
      </body>
    </html>
  );
}
