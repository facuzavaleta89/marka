// Utilidades de coordenadas. Framework-agnósticas y sin dependencias: las
// importan tanto el servidor (el módulo de geocodificación) como el cliente
// (el selector de ubicación), así que no pueden tocar Supabase, Leaflet ni
// variables de entorno.
//
// Antes de esto el proyecto no tenía NINGUNA utilidad de coordenadas: la única
// matemática que existía era una distancia euclidiana en grados dentro de
// cityStore, que sirve para "cuál de N ciudades está más cerca" pero no para
// medir metros (un grado de longitud mide distinto según la latitud).

export interface Coords {
  lat: number;
  lng: number;
}

// Decimales con los que se guarda y se compara toda coordenada del proyecto.
// 7 decimales ≈ 1 cm, muy por debajo de la precisión de un pin arrastrado a
// mano; el valor exacto importa menos que el hecho de que sea UNO SOLO.
//
// Por qué es load-bearing y no cosmético: el selector de ubicación es un
// componente controlado (el pin sigue a la prop). Para distinguir "la posición
// cambió por mi propio arrastre" de "me la mandaron desde afuera" se comparan
// números por igualdad, y eso solo funciona si TODOS los caminos que producen
// una coordenada —el arrastre y la sugerencia del buscador— la redondean igual.
const COORD_DECIMALS = 7;

export function roundCoord(value: number): number {
  return parseFloat(value.toFixed(COORD_DECIMALS));
}

export function roundCoords(coords: Coords): Coords {
  return { lat: roundCoord(coords.lat), lng: roundCoord(coords.lng) };
}

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

// Distancia aproximada en kilómetros entre dos puntos (equirectangular).
//
// Por qué esta aproximación y no Haversine: a las distancias que nos importan
// (decenas de kilómetros) el error contra Haversine es de milésimas, y acá el
// número no se le muestra a nadie ni se guarda — solo se compara contra un
// umbral grueso. Lo que SÍ hacía falta corregir es el ancho del grado de
// longitud, que se achica con el coseno de la latitud: sin eso, en Santiago del
// Estero (~-27.8°) un grado de longitud se contaría un 11% más largo de lo que
// mide, y el umbral quedaría deformado según la dirección del error.
export function distanceKm(a: Coords, b: Coords): number {
  const meanLat = toRadians((a.lat + b.lat) / 2);
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng) * Math.cos(meanLat);
  return Math.sqrt(dLat * dLat + dLng * dLng) * EARTH_RADIUS_KM;
}
