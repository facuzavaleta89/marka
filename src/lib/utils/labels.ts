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
//
// ⚠⚠ ACÁ DECÍA QUE 'pending' SIGNIFICABA "pidió un upgrade y espera que se lo
// activen" Y QUE "esa agencia está al día y publica normalmente". LAS DOS
// MITADES SON FALSAS, y era la CUARTA copia de la afirmación que escondió el bug
// más caro medido del proyecto (CLAUDE.md → "Un pedido de plan abierto" y
// "Método de Diagnóstico"; las otras tres se corrigieron el 11 sep 2026 y esta
// sobrevivió acá, que es justo el archivo que alguien abre para entender qué
// significa cada estado). Medido el 17 sep 2026:
//   · `requestPlanUpgradeAction` (dashboard/suscripcion/actions.ts) escribe
//     SOLO `pending_plan` — NO toca `status`. Así que pedir un upgrade no puede
//     producir 'pending', y un pedido abierto se detecta por
//     `pending_plan != null`, NUNCA por el estado.
//   · Quien escribe 'pending' es `selectPlanAction` (register/plan/actions.ts):
//     una agencia RECIÉN REGISTRADA que eligió su plan y espera la activación
//     manual del dueño. O sea: "todavía no tenés nada activo".
//   · Y esa agencia NO se ve en el mapa: `agency_is_publicly_visible()` exige
//     `status = 'active'`. Lo que sí puede es PUBLICAR, porque el trigger
//     check_agency_subscription() bloquea por lista negra
//     ('canceled'/'past_due') y 'pending' no está en ella — la asimetría es
//     deliberada, para que cargue su cartera mientras espera.
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
// propiedades, pero el cupo se comparte con toda la inmobiliaria. Va en una línea
// propia debajo del chip de destacadas.
export const FEATURED_QUOTA_AGENCY_NOTE =
  "El cupo de destacadas es de toda la inmobiliaria.";

// "Destacada": texto de la marca de propiedad destacada (accesible junto a la
// estrella del listado, visible en el detalle, la ficha y la tarjeta pública).
export const FEATURED_PROPERTY_LABEL = "Destacada";

// Opción del menú del listado cuando el cupo de destacadas está lleno.
export const FEATURED_QUOTA_FULL_SHORT = "Cupo completo";

// Cupo completo: la agencia ya tiene encendidas todas las destacadas de su plan.
export const FEATURED_QUOTA_FULL_MESSAGE =
  "Ya usaste todas las destacadas de tu plan.";

// Cómo destrabar el cupo completo desde el formulario de una propiedad.
export const FEATURED_QUOTA_FULL_HINT =
  "Para destacar esta propiedad, quitale la estrella a otra.";

// Vendida o alquilada: la base apaga la estrella (enforce_featured_quota).
export const FEATURED_CLOSED_STATUS_MESSAGE =
  "Las propiedades vendidas o alquiladas no se destacan";

// ─── Título de la sección de amenities ────────────────────────
//
// Una sola constante para las TRES pantallas que listan las comodidades de una
// propiedad: el filtro del mapa, el formulario de alta/edición y la ficha
// pública. Antes cada una lo escribía a mano y la ficha decía "Comodidades"
// mientras las otras dos decían "Amenities": el mismo concepto con dos nombres,
// en dos pantallas públicas.
//
// ⚠ DECISIÓN DEL DUEÑO, no una preferencia de estilo: en el rubro inmobiliario
// se dice "amenities", en inglés, así que la palabra que usa una inmobiliaria al
// hablar con un cliente es la que muestra la app. No "traducirla por prolijidad".
//
// Es el título del GRUPO. El nombre de cada amenity vive en AMENITY_LABELS.
export const AMENITIES_SECTION_LABEL = "Amenities";

// ─── Rechazos de la base al escribir una propiedad ────────────
//
// ⚠ Un 23514 que NO es ninguno de los tres gates de publicación es un CHECK de
// `properties` (medidos el 17 sep 2026: CATORCE, todos de datos — precio y
// moneda por operación, al menos una operación activa, dominio de
// property_type y status, forma de los requisitos de alquiler, location_source).
// Hasta hoy esos catorce caían en el cajón de sastre y salían como "alcanzaste
// el límite de tu plan": un error de datos que mandaba a la agencia a pagar un
// upgrade que no la destrababa. Es la tercera vez que el proyecto tropieza con
// lo mismo (CLAUDE.md → "antes de invitar a pagar más, verificar que pagar sea
// lo que destraba").
//
// El texto NO enumera los catorce: nombra los tres grupos que el agente puede
// mirar en su formulario. Y no dice "intentá de nuevo": reintentar con los
// mismos datos da siempre el mismo resultado.
export const PROPERTY_INVALID_DATA_MESSAGE =
  "Algún dato no es válido. Revisá los precios, las monedas y las operaciones.";
