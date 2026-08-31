// EL ÚNICO ARCHIVO DEL PROYECTO QUE SABE QUÉ ES NOMINATIM.
//
// Implementa GeocodeProvider (ver ./types.ts) contra el geocodificador de
// OpenStreetMap. Para cambiar de servicio se escribe otro archivo como este y
// se cambia UNA línea en ./index.ts (la constante `provider`): ni el
// orquestador, ni la ruta de API, ni el formulario se enteran.
//
// SERVER-ONLY: lee variables de entorno sin prefijo público y setea un
// User-Agent, cosa que el navegador no puede hacer. Nunca importar desde un
// Client Component.
//
// ─── Política de uso de Nominatim (obligaciones del proveedor) ──────────────
// https://operations.osmfoundation.org/policies/nominatim/
// Lo que se cumple ACÁ:
//   - User-Agent propio que identifica la aplicación (el de fábrica de la
//     librería HTTP no sirve). Por eso la llamada sale del servidor.
//   - Una sola consulta por búsqueda (`limit=1`): no paginamos ni exploramos.
// Lo que se cumple en ./index.ts (porque no es específico del proveedor):
//   - máximo 1 consulta por segundo en toda la aplicación;
//   - caché de resultados;
//   - la búsqueda la dispara un click explícito, nunca el tipeo.
// La atribución a OpenStreetMap ya está cubierta por el mapa: el TileLayer del
// selector de ubicación recibe TILE_CONFIG.attribution (src/lib/map/tiles.ts),
// que enlaza a openstreetmap.org/copyright, y el control de atribución de
// Leaflet está activo (nadie pasa attributionControl={false}).

import type { GeocodeCandidate, GeocodeProvider, GeocodeQuery } from "./types";

const SEARCH_URL = "https://nominatim.openstreetmap.org/search";

// Identificación de la aplicación. La política pide que sea propia y que
// permita contactarnos; el valor por defecto identifica la app pero NO lleva
// dirección de contacto, así que conviene setear la variable en producción.
// Se deja un default en vez de fallar sin la variable a propósito: esta feature
// es un atajo, y quedarse sin atajo por una variable sin setear sería peor que
// identificarse de forma genérica pero honesta.
const DEFAULT_USER_AGENT =
  "Marka/1.0 (marketplace inmobiliario; https://marka.com.ar)";

function userAgent(): string {
  const configured = process.env.GEOCODING_USER_AGENT?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_USER_AGENT;
}

// Grados aproximados por kilómetro, para armar el rectángulo de sesgo.
const KM_PER_LAT_DEGREE = 111.32;

// Rectángulo alrededor del centro de la ciudad, en el formato que pide
// Nominatim: <lng_izq>,<lat_arriba>,<lng_der>,<lat_abajo>.
//
// Se manda como SESGO, sin `bounded=1` (que lo volvería un filtro duro). Dos
// motivos: el descarte por distancia tiene que ser una garantía NUESTRA y no
// depender de un flag del proveedor, y con el filtro duro un resultado lejano
// volvería como "no encontré nada", perdiendo la diferencia entre "no existe"
// y "existe pero en otra provincia", que son avisos distintos para el agente.
function viewbox(query: GeocodeQuery): string {
  const latDelta = query.radiusKm / KM_PER_LAT_DEGREE;
  const lngDelta =
    query.radiusKm /
    (KM_PER_LAT_DEGREE * Math.cos((query.center.lat * Math.PI) / 180));

  const left = query.center.lng - lngDelta;
  const right = query.center.lng + lngDelta;
  const top = query.center.lat + latDelta;
  const bottom = query.center.lat - latDelta;

  return `${left},${top},${right},${bottom}`;
}

// Texto libre para `q`. Nominatim también acepta parámetros estructurados
// (street/city/state), pero mezclarlos con el texto libre no está permitido y
// la dirección que escribe el agente no viene separada en calle y número.
//
// Dirección + ciudad + provincia + país, y nada más. El barrio NO va: ver el
// comentario de `geocodeAddress` en ../index.ts, que documenta la medición por
// la que se sacó.
function searchText(query: GeocodeQuery): string {
  return [query.address, query.city, query.province, query.country]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(", ");
}

// Lee lat/lng de una fila de la respuesta sin confiar en su forma. Cualquier
// cosa rara devuelve null y el orquestador lo trata como "no encontrado":
// preferimos no ubicar nada antes que mover el pin a una coordenada basura.
function parseCandidate(row: unknown): GeocodeCandidate | null {
  if (typeof row !== "object" || row === null) return null;

  const record = row as Record<string, unknown>;
  const lat = Number(record.lat);
  const lng = Number(record.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const displayName = record.display_name;

  return {
    lat,
    lng,
    label: typeof displayName === "string" ? displayName : null,
  };
}

export const nominatimProvider: GeocodeProvider = {
  name: "nominatim",

  async search(
    query: GeocodeQuery,
    signal: AbortSignal
  ): Promise<GeocodeCandidate | null> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("q", searchText(query));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("viewbox", viewbox(query));
    url.searchParams.set("accept-language", "es");

    // `cache: "no-store"` es deliberado: la caché la maneja el orquestador con
    // su propio TTL, que además distingue qué desenlaces se pueden guardar y
    // cuáles no (un timeout jamás se cachea). Dejar que la Data Cache de
    // Next.js decidiera por su cuenta volvería no determinista un requisito de
    // la política del proveedor.
    const response = await fetch(url, {
      signal,
      cache: "no-store",
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // Se lanza con un mensaje propio: el cuerpo del error del servicio no se
      // lee ni se propaga. El orquestador lo traduce a 'unavailable'.
      throw new Error(`Nominatim respondió ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) return null;

    return parseCandidate(payload[0]);
  },
};
