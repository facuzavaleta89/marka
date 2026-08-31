// Orquestador de la búsqueda de direcciones.
//
// Habla SOLO el contrato genérico de ./types.ts. Todo lo que hay acá —el
// presupuesto de tiempo, la caché, el límite de frecuencia, el descarte por
// distancia— es independiente del servicio que haya del otro lado.
//
// ⚠ REGLA DE ORO: `geocodeAddress` NUNCA lanza. Esta feature es un atajo; si el
// servicio falla, tarda o devuelve basura, la respuesta es 'unavailable' y el
// agente sigue colocando el pin a mano exactamente como antes. Ninguna ruta del
// alta o la edición de una propiedad depende de que esto funcione.
//
// SERVER-ONLY: el proveedor lee variables de entorno sin prefijo público y
// setea encabezados que el navegador no puede setear.

import type { Coords } from "@/lib/utils/coords";
import { distanceKm, roundCoords } from "@/lib/utils/coords";
import type { GeocodeResponse } from "@/types";
import { nominatimProvider } from "./nominatim";
import type { GeocodeQuery } from "./types";

// ─── El proveedor ─────────────────────────────────────────────
// PARA CAMBIAR DE SERVICIO: escribir otro archivo que implemente
// GeocodeProvider y cambiar esta línea. Nada más en el proyecto lo referencia.
const provider = nominatimProvider;

// ─── Constantes de política y de producto ─────────────────────

// Presupuesto TOTAL de la operación: incluye la espera por el cupo de
// frecuencia y la llamada de red. 5 s es holgado contra un servicio sano
// (Nominatim suele responder por debajo del segundo) y sigue estando por debajo
// del punto en que alguien mirando la pantalla concluye que la app se colgó.
// Al vencer, el agente ve "el buscador no está disponible" y el pin queda como
// estaba: nada se pierde por esperar poco.
const GEOCODE_TIMEOUT_MS = 5_000;

// Política de Nominatim: máximo 1 consulta por segundo contando TODO el
// tráfico de la aplicación. Se usan 1100 ms para dejar margen de reloj.
const MIN_REQUEST_INTERVAL_MS = 1_100;

// La política pide cachear: repetir consultas idénticas es motivo de bloqueo.
// 24 h porque los datos de OSM para una dirección concreta no cambian en
// horas, y porque el patrón real es el mismo agente reintentando la misma
// dirección en la misma sesión de carga.
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

// Tope de entradas, para que un proceso de larga vida no acumule sin techo.
const MAX_CACHE_ENTRIES = 500;

// Radio alrededor del centro de la ciudad dentro del cual un resultado se
// considera creíble.
//
// ⚠ SUPUESTO EXPLÍCITO: la tabla `cities` NO tiene límites geográficos (solo
// center_lat, center_lng y default_zoom), así que no hay forma de saber dónde
// termina el ejido. Este umbral no pretende ser el borde del municipio: existe
// para descartar el caso ruidoso —una calle con el mismo nombre en otra
// provincia—, que está a cientos de kilómetros, no a treinta.
//
// Por qué 25 km: el aglomerado de Santiago del Estero–La Banda mide del orden
// de 15–20 km de punta a punta, así que 25 km lo cubre entero con margen para
// el periurbano, y sigue siendo un orden de magnitud menos que la distancia a
// cualquier otra capital provincial. La asimetría de los errores empuja a ser
// generoso: aceptar de más es inocuo (el agente todavía tiene que CONFIRMAR, y
// puede arrastrar el pin), mientras que rechazar de más le rompe el atajo a una
// dirección legítima de las afueras.
const CITY_RADIUS_KM = 25;

// Largo máximo de la dirección aceptada. Una dirección real no se acerca; el
// tope existe para que no se pueda usar la ruta como túnel de texto arbitrario.
const MAX_ADDRESS_LENGTH = 200;

// Largo máximo de la etiqueta que se le devuelve al cliente. Los display_name
// de OSM pueden traer la jerarquía completa hasta el país.
const MAX_LABEL_LENGTH = 120;

// ─── Entrada y normalización ──────────────────────────────────

export interface GeocodeCity {
  name: string;
  province: string | null;
  country: string;
  center: Coords;
}

export interface GeocodeRequest {
  address: string;
  city: GeocodeCity;
}

// Saca caracteres de control, colapsa espacios y recorta. Devuelve null si no
// queda nada utilizable. Es la única definición de "texto aceptable" del módulo:
// la usan la dirección que entra y la etiqueta que sale.
function sanitizeQueryText(
  value: unknown,
  maxLength: number
): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value
    // Caracteres de control (saltos de línea, DEL) → espacio.
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) return null;
  return cleaned.slice(0, maxLength);
}

export function sanitizeAddress(value: unknown): string | null {
  return sanitizeQueryText(value, MAX_ADDRESS_LENGTH);
}

// ─── Interruptor de prueba: simular que el servicio no responde ─
//
// HERRAMIENTA DE DESARROLLO. Existe para poder verificar a mano la restricción
// dura de esta feature —"si el buscador se cae, cargar y editar propiedades
// tiene que seguir funcionando exactamente igual"— sin cortar internet, que
// también cortaría Supabase y haría que la prueba no probara nada: sin base no
// se puede guardar, así que no se podría distinguir "el atajo falló pero el
// flujo sobrevive" de "no anda nada".
//
// ⚠ NUNCA ACTIVA EN PRODUCCIÓN: mientras esté puesta, NINGUNA búsqueda de
// direcciones funciona. No es un feature flag de operación, es un simulador de
// caída.
//
// Sin prefijo público a propósito: es configuración de servidor y no tiene por
// qué viajar al bundle del navegador. Se lee dentro de la función (no en una
// constante de módulo) para que alcance con reiniciar el server en desarrollo.
//
// Ausente o vacía = apagado. "0" y "false" también se toman como apagado, para
// que escribir GEOCODING_SIMULATE_OUTAGE=false no encienda justo lo contrario
// de lo que uno quiso decir. Cualquier otro valor la enciende.
const FALSY_ENV_VALUES = new Set(["0", "false"]);

function isOutageSimulated(): boolean {
  const raw = process.env.GEOCODING_SIMULATE_OUTAGE?.trim().toLowerCase();
  if (!raw) return false;
  return !FALSY_ENV_VALUES.has(raw);
}

// ─── Límite de frecuencia (1 consulta/segundo, toda la app) ────
//
// Reserva turnos en vez de contarlos: cada llamada se agenda al menos
// MIN_REQUEST_INTERVAL_MS después de la anterior. Como JavaScript es de un solo
// hilo, leer y escribir `nextSlotAt` es atómico y dos pedidos simultáneos no
// pueden quedarse con el mismo turno.
//
// La espera consume del MISMO presupuesto de tiempo que la llamada: si el turno
// cae más allá del timeout, la operación se cancela y el agente ve "no
// disponible" en vez de quedarse esperando. La cola no puede crecer sin fin.
//
// ⚠ LIMITACIÓN CONOCIDA: el contador vive en el proceso. En un despliegue con
// varias instancias (serverless), cada una lleva el suyo y el ritmo agregado
// podría superar 1/s. Con una sola ciudad y un puñado de agencias el riesgo es
// teórico, y la caché recorta buena parte de las repeticiones. Si algún día hay
// volumen, esto se muda a un contador compartido.
let nextSlotAt = 0;

function waitForSlot(signal: AbortSignal): Promise<void> {
  const now = Date.now();
  const slotAt = Math.max(now, nextSlotAt);
  nextSlotAt = slotAt + MIN_REQUEST_INTERVAL_MS;

  const delay = slotAt - now;
  if (delay <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onAbort = () => {
      if (timer) clearTimeout(timer);
      reject(new Error("Se agotó el tiempo esperando el cupo de consultas"));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
  });
}

// ─── Caché por consulta ───────────────────────────────────────
//
// Mapa en proceso con TTL, no la Data Cache de Next.js ni `unstable_cache`.
// Motivos:
//   1. La llamada lleva un AbortSignal (lo exige el timeout). Que la Data Cache
//      guarde o no una respuesta abortable no es algo documentado en lo que
//      convenga apoyar un requisito de la política del proveedor, así que la
//      llamada va con `cache: "no-store"` y el guardado es explícito acá.
//   2. `unstable_cache` indexa por argumentos serializables y no puede envolver
//      una función que recibe una señal.
//   3. Hace falta cachear POR DESENLACE: los tres resultados reales se guardan,
//      pero un timeout o una caída jamás (sería fijar una falla transitoria por
//      24 horas). Ninguna caché declarativa expresa eso sin contorsiones.
// El costo es que la caché no se comparte entre instancias; ver la limitación
// del límite de frecuencia, es el mismo compromiso.

interface CacheEntry {
  response: GeocodeResponse;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();

// Clave por consulta: la misma dirección en la misma ciudad devuelve la misma
// entrada. Incluye el proveedor y el centro/radio porque un cambio de cualquiera
// de los dos cambia lo que se considera un resultado válido.
function cacheKey(query: GeocodeQuery): string {
  return [
    provider.name,
    query.center.lat,
    query.center.lng,
    query.radiusKm,
    query.address.toLowerCase(),
    query.city.toLowerCase(),
    query.province?.toLowerCase() ?? "",
    query.country.toLowerCase(),
  ].join("|");
}

function readCache(key: string): GeocodeResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.response;
}

function writeCache(key: string, response: GeocodeResponse): void {
  // 'unavailable' es transitorio: cachearlo dejaría el atajo roto durante un
  // día por una caída de un minuto.
  if (response.status === "unavailable") return;

  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next();
    if (!oldest.done) responseCache.delete(oldest.value);
  }

  responseCache.set(key, { response, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Evaluación del resultado ─────────────────────────────────

function truncateLabel(label: string | null): string | null {
  if (!label) return null;
  const cleaned = sanitizeQueryText(label, MAX_LABEL_LENGTH);
  return cleaned;
}

// ─── API pública ──────────────────────────────────────────────

// Busca una ubicación para una dirección dentro de una ciudad.
// Nunca lanza: cualquier problema se traduce a un desenlace del contrato.
//
// ─── ⚠ EL BARRIO NO PARTICIPA DE LA BÚSQUEDA. NO LO VUELVAS A AGREGAR ──────
//
// Parece obvio que el barrio ayudaría a desambiguar ("dos calles con el mismo
// nombre en zonas distintas"), y por eso ya se agregó DOS VECES y se sacó dos
// veces. La intuición es incorrecta: medido contra datos reales, el barrio es
// un dato DAÑINO para geocodificar.
//
// El caso que lo cerró — "Mitre 291", Santiago del Estero. Esa dirección está
// mapeada en OpenStreetMap dentro del "Barrio Parque Aguirre", pero la gente
// del lugar la ubica en "Centro". Consultado contra Nominatim, con la misma
// consulta que arma este módulo, según lo que escriba el agente:
//
//   sin barrio                            → Mitre 291, a 0,9 km del centro  ✅
//   barrio "Parque"  (el que está mapeado) → Mitre 291, a 0,9 km del centro  ✅
//   barrio "Cabildo" (otro cualquiera)     → no encuentra nada
//   barrio "Centro"  (el que la gente USA) → Bartolomé Mitre en AÑATUYA, otra
//                                            ciudad a 158 km, que el filtro de
//                                            distancia termina descartando  ❌
//
// O sea: el único barrio que un agente real va a escribir es el que falla, y
// falla del peor modo posible — no devuelve "no encontré nada", devuelve un
// resultado INCORRECTO Y LEJANO. Un barrio que no coincide con lo mapeado no
// solo tapa la dirección correcta: manda al servicio a buscar a otra ciudad.
// Sin el barrio, la misma dirección se encuentra bien.
//
// Eso también es lo que mató la cascada de dos intentos que hubo acá: solo
// reintentaba ante "no encontré nada", y este caso no devuelve vacío. La
// cascada no cubría el único caso para el que se había construido.
//
// El barrio SIGUE siendo un campo de la propiedad y se guarda tal como lo
// escribe el agente. Lo único que no hace es participar de esta consulta.
//
// La consulta es siempre: dirección + ciudad + provincia + país. Un intento.
export async function geocodeAddress(
  request: GeocodeRequest
): Promise<GeocodeResponse> {
  // Simulación de caída: lo PRIMERO de todo, antes de la caché, del limitador y
  // de cualquier llamada. Con el interruptor puesto no sale ni un pedido, y el
  // desenlace es idéntico al de una caída real (mismo estado, mismo mensaje,
  // pin sin tocar), que es justamente lo que se quiere poder probar.
  if (isOutageSimulated()) return { status: "unavailable" };

  const address = sanitizeAddress(request.address);
  if (!address) return { status: "not_found" };

  const query: GeocodeQuery = {
    address,
    city: request.city.name,
    province: request.city.province,
    country: request.city.country,
    center: request.city.center,
    radiusKm: CITY_RADIUS_KM,
  };

  // Una respuesta cacheada no pide turno ni sale a la red.
  const key = cacheKey(query);
  const cached = readCache(key);
  if (cached) return cached;

  // Un solo presupuesto de tiempo para todo: espera del cupo + red.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  try {
    await waitForSlot(controller.signal);

    const candidate = await provider.search(query, controller.signal);

    const response: GeocodeResponse = !candidate
      ? { status: "not_found" }
      : evaluateCandidate(candidate.lat, candidate.lng, candidate.label, query);

    writeCache(key, response);
    return response;
  } catch {
    // Red caída, HTTP no-2xx, JSON ilegible, timeout, cupo cancelado: todo cae
    // acá y sale por el mismo lugar. El error del servicio externo no se
    // registra en la respuesta ni se le devuelve al cliente.
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

function evaluateCandidate(
  lat: number,
  lng: number,
  label: string | null,
  query: GeocodeQuery
): GeocodeResponse {
  // Mismo redondeo que usa el arrastre del pin: la coordenada que viaja al
  // formulario tiene que ser comparable por igualdad con la que produce el
  // selector de ubicación (ver roundCoord en lib/utils/coords.ts).
  const point = roundCoords({ lat, lng });

  if (distanceKm(query.center, point) > query.radiusKm) {
    return { status: "out_of_city" };
  }

  return {
    status: "found",
    lat: point.lat,
    lng: point.lng,
    label: truncateLabel(label),
  };
}
