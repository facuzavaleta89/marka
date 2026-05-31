import type { Metadata } from "next";
import { Noto_Serif, DM_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

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
  title: "Marka",
  description: "Marketplace inmobiliario",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
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
            genera scroll y no recorta contenido; pointer-events-none no bloquea. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9999] border border-stone"
        />
      </body>
    </html>
  );
}
