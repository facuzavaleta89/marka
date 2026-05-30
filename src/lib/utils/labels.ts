// Etiquetas legibles (UI en español) para los literales del dominio.
// Fuente única de verdad: no duplicar estos mapas en los componentes.
import type {
  PropertyType,
  OperationType,
  PropertyStatus,
  Amenity,
  Currency,
} from "@/types";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  casa: "Casa",
  departamento: "Departamento",
  terreno: "Terreno",
  local: "Local",
  oficina: "Oficina",
  campo: "Campo",
  cochera: "Cochera",
};

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Alquiler temporal",
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  active: "Activa",
  paused: "Pausada",
  sold: "Vendida",
  rented: "Alquilada",
};

export const AMENITY_LABELS: Record<Amenity, string> = {
  pileta: "Pileta",
  quincho: "Quincho",
  parrilla: "Parrilla",
  gym: "Gym",
  sum: "SUM",
  seguridad_24h: "Seguridad 24h",
  portero: "Portero",
  laundry: "Laundry",
  solarium: "Solarium",
  jardin: "Jardín",
  terraza: "Terraza",
  cochera_cubierta: "Cochera cubierta",
  vista_al_rio: "Vista al río",
  vista_al_mar: "Vista al mar",
  apto_credito: "Apto crédito",
  apto_profesional: "Apto profesional",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "USD",
  ARS: "ARS",
};
