import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils/siteUrl";

// ─── Instrucciones para buscadores ────────────────────────────
//
// Convención de archivo de Next.js: `robots.ts` en la raíz de `app/`, con una
// función por defecto que devuelve `MetadataRoute.Robots`. Se sirve en
// `/robots.txt`.
//
// A diferencia del mapa del sitio, este archivo NO lleva `force-dynamic`: su
// contenido es fijo y no depende de la base, así que dejar que se cachee al
// construir es lo correcto — no hay ninguna lista que pueda quedar vieja.
//
// ⚠ Se usan solo `rules` y `sitemap`. NO se usa el campo `other` (directivas no
// estándar por agente): la documentación lo marca como agregado en la versión
// 16.3.0 y el proyecto corre 16.2.6, así que acá todavía no existe.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // El área privada no tiene nada que un buscador pueda ni deba indexar, y
      // además está detrás de sesión: pedirla solo gasta rastreo. Son los mismos
      // dos prefijos que `PROTECTED_PREFIXES` en proxy.ts.
      // `/api/` tampoco: no devuelve páginas.
      disallow: ["/dashboard", "/admin", "/api/"],
    },
    // Es lo que le dice al buscador dónde está la lista. Sin esta línea, el
    // mapa del sitio existe pero hay que darlo de alta a mano en cada buscador.
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
