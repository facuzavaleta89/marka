// ─── Configuración de tiles del mapa (fuente única de verdad) ──────────────
// La comparten el mapa principal (MapView) y el mini-mapa del formulario
// (LocationPicker), para que ambos se vean idénticos. Si se define
// NEXT_PUBLIC_MAPTILER_KEY, los dos mapas migran juntos a MapTiler.
//
// CARTO/MapTiler de baja saturación dejan que los pines terracota sean los
// protagonistas. Sin key, caemos a OpenStreetMap estándar.

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export interface TileConfig {
  url: string;
  attribution: string;
  subdomains: string;
  maxZoom: number;
}

export const TILE_CONFIG: TileConfig = MAPTILER_KEY
  ? {
      // Estilo claro de MapTiler (cuando se agregue la key)
      url: `https://api.maptiler.com/maps/dataviz-light/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`,
      attribution:
        '© <a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abc",
      maxZoom: 20,
    }
  : {
      // OpenStreetMap estándar (fallback por defecto, sin key): se siente más
      // vivo y da mejor contraste con los pines terracota que los estilos lavados.
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abc",
      maxZoom: 19,
    };
