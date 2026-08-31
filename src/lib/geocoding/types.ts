// Contrato GENÉRICO de geocodificación: "dame coordenadas para esta dirección
// en esta ciudad".
//
// Este archivo no sabe qué servicio hay del otro lado, y es a propósito: es la
// costura por la que se cambia de proveedor. Nada específico de Nominatim (ni
// URLs, ni nombres de parámetros, ni formas de respuesta) puede aparecer acá.
// Ver src/lib/geocoding/nominatim.ts (el único archivo que conoce Nominatim) y
// src/lib/geocoding/index.ts (el orquestador, que solo habla este contrato).

import type { Coords } from "@/lib/utils/coords";

// Lo que se le pide al proveedor. Va ESTRUCTURADO en piezas, no como una
// cadena ya armada: cada servicio arma su consulta a su manera (unos aceptan
// campos separados, otros solo texto libre, otros piden un sesgo geográfico en
// un formato propio), y decidir eso es trabajo del proveedor, no de quien lo
// llama.
export interface GeocodeQuery {
  /** Dirección tal como la escribió el agente, ya normalizada. */
  address: string;
  // ⚠ NO agregar el barrio acá. Se probó dos veces y se sacó dos veces: es un
  // dato dañino para geocodificar, no un desambiguador. El porqué, con el caso
  // medido, está en src/lib/geocoding/index.ts (comentario de `geocodeAddress`).
  city: string;
  province: string | null;
  country: string;
  /** Centro de la ciudad, para que el proveedor sesgue o acote su búsqueda. */
  center: Coords;
  /** Radio en km alrededor del centro dentro del cual el resultado es creíble. */
  radiusKm: number;
}

// Lo que devuelve el proveedor cuando encuentra algo.
export interface GeocodeCandidate extends Coords {
  /** Nombre legible del lugar encontrado, si el servicio lo da. */
  label: string | null;
}

// La interfaz que hay que implementar para cambiar de servicio.
//
// Reglas del contrato, que el orquestador da por sentadas:
//   - Devolver `null` significa "el servicio respondió y no hay resultado
//     utilizable". No es un error.
//   - Cualquier falla (red, HTTP no-2xx, respuesta ilegible, timeout) se
//     LANZA. El orquestador la traduce a 'unavailable' y nunca la propaga.
//   - `signal` es el presupuesto de tiempo de toda la operación y hay que
//     respetarlo: el proveedor no define su propio timeout.
export interface GeocodeProvider {
  /** Identificador corto del servicio. Entra en la clave de caché. */
  readonly name: string;
  search(
    query: GeocodeQuery,
    signal: AbortSignal
  ): Promise<GeocodeCandidate | null>;
}
