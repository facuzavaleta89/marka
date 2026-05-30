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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
