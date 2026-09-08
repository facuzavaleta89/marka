import { TILE_CONFIG } from "@/lib/map/tiles";

// ─── Mapa estático (Server Component, CERO JavaScript) ────────
//
// No había precedente de mapa estático en el proyecto: los cinco archivos que
// tocan mapas usan react-leaflet, y el más chico —el LocationPicker del
// formulario, 280px— se monta con `dynamic(..., { ssr: false })`.
//
// ⚠ POR QUÉ NO SE REUSÓ ESE. Un Leaflet con `ssr: false` es una isla de cliente:
// un buscador ve un recuadro vacío, y la página arrastra la librería entera
// (Leaflet + react-leaflet + el CSS) a una página que queremos rápida y que en
// el 99% de las visitas nunca va a interactuar con el mapa. Esta página existe
// PARA ser indexada; el mapa tiene que estar en el HTML.
//
// ══════════════════════════════════════════════════════════════
// CÓMO FUNCIONA: una grilla de tiles posicionada con CSS
// ══════════════════════════════════════════════════════════════
//
// No hay ninguna API de imágenes estáticas disponible: OpenStreetMap no ofrece
// una, y la rama de MapTiler de `TILE_CONFIG` sí tendría, pero su key hoy está
// vacía (`NEXT_PUBLIC_MAPTILER_KEY` declarada y sin valor), así que depender de
// ella dejaría la página sin mapa. Se arma con las MISMAS tiles que ya usa el
// mapa grande: unas pocas `<img>` en una grilla, corridas con CSS para que el
// punto de la propiedad quede en el centro del recuadro.
//
// Ventajas de esta forma: está en el HTML, no necesita una sola línea de JS,
// no depende de ningún servicio nuevo, y usa `TILE_CONFIG` — o sea que el día
// que el proyecto migre a MapTiler, este mapa migra con el grande, solo.
//
// La grilla es de 4×2 tiles (1024×512 px). Los índices `x0`/`y0` se eligen con
// `Math.round(t - lados/2)`, que deja el punto en el tercio central de la
// grilla; con eso, un recuadro de hasta 672 px de ancho y 200 de alto centrado
// en el punto SIEMPRE cae dentro de la grilla y nunca muestra una franja vacía.
// Está verificado a mano en los dos ejes:
//   · offsetX ∈ [384, 640) y el recuadro toma ±336 → [48, 976] ⊂ [0, 1024] ✓
//   · offsetY ∈ [128, 384) y el recuadro toma ±100 → [28, 484] ⊂ [0, 512]  ✓
// Si se cambia el ancho o el alto del recuadro, hay que rehacer esa cuenta.

const TILE_SIZE = 256;
const COLS = 4;
const ROWS = 2;
// Escala de barrio: a esta latitud una tile cubre ~1 km, así que el recuadro
// muestra unos 850 m. Alcanza para "¿dónde queda?" sin revelar la manzana con
// más precisión de la que el pin tiene.
const ZOOM = 15;
// Alto del recuadro. Entra en la cuenta de arriba: si cambia, se rehace.
const VIEWPORT_HEIGHT = 200;

// Web Mercator: lat/lng → coordenada de tile (con decimales). La parte entera es
// el índice de la tile; la fraccionaria, la posición dentro de ella.
function toTileCoords(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y:
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n,
    n,
  };
}

// Arma la URL de una tile desde TILE_CONFIG, que es la fuente única de la config
// de tiles del proyecto. `{r}` (sufijo retina de la rama MapTiler) se resuelve a
// vacío: pedimos la versión 1x, que es lo que corresponde a un mapa decorativo.
function tileUrl(x: number, y: number, index: number): string {
  const subdomains = TILE_CONFIG.subdomains || "a";
  const s = subdomains[index % subdomains.length];
  return TILE_CONFIG.url
    .replace("{s}", s)
    .replace("{z}", String(ZOOM))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{r}", "");
}

interface StaticMapProps {
  lat: number;
  lng: number;
  /** Texto alternativo del conjunto: qué lugar se está mostrando. */
  label: string;
}

export function StaticMap({ lat, lng, label }: StaticMapProps) {
  const { x, y, n } = toTileCoords(lat, lng, ZOOM);

  const x0 = Math.round(x - COLS / 2);
  const y0 = Math.round(y - ROWS / 2);

  // Posición del punto dentro de la grilla, en píxeles desde su esquina.
  const offsetX = (x - x0) * TILE_SIZE;
  const offsetY = (y - y0) * TILE_SIZE;

  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ty = y0 + row;
      // Fuera del rango vertical del mundo no hay tile (cerca de los polos).
      // Se omite en vez de pedirla: sería un 404 y un ícono de imagen rota.
      if (ty < 0 || ty >= n) continue;
      // En el eje horizontal el mundo SÍ da la vuelta, así que se envuelve.
      // El doble módulo es para que un índice negativo no quede negativo.
      const tx = ((x0 + col) % n + n) % n;
      tiles.push({
        key: `${col}-${row}`,
        url: tileUrl(tx, ty, col + row),
        left: col * TILE_SIZE,
        top: row * TILE_SIZE,
      });
    }
  }

  return (
    <figure className="m-0">
      <div
        className="relative overflow-hidden rounded-md border border-stone bg-mist"
        style={{ height: VIEWPORT_HEIGHT }}
      >
        {/* La grilla, corrida para que el punto quede en el centro del recuadro.
            `calc(50% - offset)` es lo que lo hace responsive: el recuadro puede
            tener cualquier ancho y el punto sigue centrado. */}
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            width: COLS * TILE_SIZE,
            height: ROWS * TILE_SIZE,
            left: `calc(50% - ${offsetX}px)`,
            top: `calc(50% - ${offsetY}px)`,
          }}
        >
          {tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.key}
              src={t.url}
              alt=""
              width={TILE_SIZE}
              height={TILE_SIZE}
              // El mapa vive al pie de la página: cargar las tiles solo cuando
              // se acerca deja el primer pintado sin ocho pedidos de red.
              loading="lazy"
              decoding="async"
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ left: t.left, top: t.top }}
            />
          ))}
        </div>

        {/* El pin, en el centro exacto del recuadro — que es donde quedó el punto.
            `-translate-y-full` ancla la PUNTA en la coordenada, no el centro del
            dibujo: si no, la propiedad aparecería medio pin más al norte. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-md"
        >
          <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
            <path
              d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.7-6.3-14-14-14z"
              fill="#A0522D"
            />
            <circle cx="14" cy="14" r="5" fill="#FBF9F6" />
          </svg>
        </span>

        {/* Atribución de OpenStreetMap. Es obligatoria por la licencia de los
            datos, y en el mapa grande la pone sola el control de Leaflet; acá no
            hay Leaflet, así que va a mano.
            El `dangerouslySetInnerHTML` es sobre `TILE_CONFIG.attribution`, una
            CONSTANTE DE ESTE REPO que trae un <a> adentro — no hay ningún dato
            de usuario ni de la base en juego. Es exactamente lo que hace Leaflet
            con la misma cadena. */}
        <div
          className="absolute bottom-0 right-0 bg-paper/80 px-1.5 py-0.5 font-sans text-[10px] leading-none text-graphite backdrop-blur-sm [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: TILE_CONFIG.attribution }}
        />
      </div>

      {/* El recuadro es decorativo (`aria-hidden` en las tiles y en el pin), así
          que la información de dónde queda la propiedad la da este texto, que un
          lector de pantalla sí lee. */}
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
