// Etiquetas legibles (UI en español) para los literales del dominio.
// Fuente única de verdad: no duplicar estos mapas en los componentes.
import type {
  PropertyType,
  OperationType,
  PropertyStatus,
  Amenity,
  RentRequirement,
  Currency,
  ApprovalStatus,
  GeocodeStatus,
  SubscriptionStatus,
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

// Requisitos para alquilar. Tipado como Record<RentRequirement, string> igual
// que AMENITY_LABELS: agregar un requisito al tipo sin darle etiqueta acá NO
// compila. El orden de las claves es el que ve el agente en el formulario.
export const RENT_REQUIREMENT_LABELS: Record<RentRequirement, string> = {
  recibo_de_sueldo: "Recibo de sueldo",
  garantia_propietaria: "Garantía propietaria",
  seguro_de_caucion: "Seguro de caución",
  dni: "DNI",
  comprobante_ingresos_monotributo: "Comprobante de ingresos o monotributo",
  deposito: "Depósito",
  mes_adelantado: "Mes adelantado",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "USD",
  ARS: "ARS",
};

// Estado de aprobación de una agencia. Estas etiquetas las lee el dueño de la
// plataforma en su panel, no el cliente: se redactan desde su punto de vista
// ("por aprobar" = algo que tiene que hacer él).
export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: "Por aprobar",
  approved: "Aprobada",
  rejected: "Rechazada",
};

// Estado de la SUSCRIPCIÓN, también para el panel del dueño. Es el eje
// COMERCIAL ("¿paga?"), independiente del de aprobación ("¿es legítima?"): las
// dos etiquetas conviven en la misma fila y no hay que leerlas como lo mismo.
// ⚠ 'pending' acá significa "pidió un upgrade y espera que se lo activen", NO
// "sin resolver": esa agencia está al día y publica normalmente.
export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Activa",
  pending: "Pendiente",
  past_due: "Vencida",
  canceled: "Dada de baja",
};

// Desenlaces de la búsqueda de direcciones, tal como se los cuenta al agente.
// Son frases y no etiquetas cortas, pero viven acá porque son un mapa indexado
// por un literal del dominio (GeocodeStatus) y este archivo es el único lugar
// del proyecto donde vive esa clase de mapa.
//
// Tono (DESIGN §10): ninguno de los cuatro es culpa de la persona, así que
// ninguno la reta ni le pide que "reintente". Los tres que no encuentran nada
// terminan diciendo lo mismo —el camino manual sigue ahí—, porque esa es la
// información que necesita para seguir trabajando: la búsqueda es un ATAJO, y
// que falte un atajo no bloquea nada.
export const GEOCODE_STATUS_MESSAGES: Record<GeocodeStatus, string> = {
  found:
    "Movimos el pin a esta dirección. Revisá que sea el lugar exacto y confirmá la ubicación, o arrastrá el pin si hay que corregirlo.",
  not_found:
    "No encontramos esa dirección en el mapa. Podés colocar el pin a mano, como siempre.",
  out_of_city:
    "Lo que encontramos queda lejos de tu ciudad, así que no movimos el pin. Colocalo a mano en el mapa.",
  unavailable:
    "El buscador de direcciones no está disponible en este momento. Podés colocar el pin a mano, como siempre.",
};

// ─── Destacadas: textos del cupo por plan ─────────────────────
//
// Un solo lugar para cómo se nombra el feature de destacadas en las pantallas
// de planes (registro, suscripción, /admin) y en el formulario de propiedad.
// El feature se describe por su CUPO (featuredLimit / featured_limit), nunca
// por el nombre del plan.

// Texto del feature en una lista de lo que incluye un plan. Con cupo 0 el plan
// no incluye destacadas: devuelve null y no se lista.
export function featuredQuotaFeatureLabel(limit: number): string | null {
  if (limit <= 0) return null;
  return limit === 1
    ? "1 propiedad destacada"
    : `Hasta ${limit} propiedades destacadas`;
}

// Contador de uso del cupo: "Destacadas: 2 de 3".
export function featuredUsageLabel(used: number, limit: number): string {
  return `Destacadas: ${used} de ${limit}`;
}

// Aclaración del contador para un agente común: su listado muestra solo sus
// propiedades, pero el cupo se comparte con toda la inmobiliaria.
export const FEATURED_QUOTA_AGENCY_NOTE = "el cupo es de toda la inmobiliaria";

// Texto accesible del indicador de propiedad destacada (la estrella del listado).
export const FEATURED_PROPERTY_LABEL = "Destacada";

// Cupo completo: la agencia ya tiene encendidas todas las destacadas de su plan.
export const FEATURED_QUOTA_FULL_MESSAGE =
  "Ya usaste todas las destacadas de tu plan.";

// Cómo destrabar el cupo completo desde el formulario de una propiedad.
export const FEATURED_QUOTA_FULL_HINT =
  "Para destacar esta propiedad, quitale la estrella a otra.";

// Vendida o alquilada: la base apaga la estrella (enforce_featured_quota).
export const FEATURED_CLOSED_STATUS_MESSAGE =
  "Las propiedades vendidas o alquiladas no se destacan";
