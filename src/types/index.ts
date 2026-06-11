// ============================================================
// TIPOS GLOBALES — App Mapa Inmobiliario (Marketplace multi-ciudad)
// Archivo: types/index.ts
// ============================================================

// ─── Enums / Literales ───────────────────────────────────────

export type PropertyType =
  | "casa"
  | "departamento"
  | "terreno"
  | "local"
  | "oficina"
  | "campo"
  | "cochera";

export type OperationType = "venta" | "alquiler" | "alquiler_temporal";

export type PropertyStatus = "active" | "paused" | "sold" | "rented";

export type Currency = "USD" | "ARS";

// Rol del agente dentro de su agencia (Fase 3, ya migrado en la base).
// 'admin': gestiona la suscripción, invita/elimina agentes y ve los leads de
// toda la agencia. 'agent': CRUD de sus propias propiedades.
// IMPORTANTE: hoy la columna 'role' EXISTE en la base, pero todavía NO gatea
// permisos (las RLS policies admin/agent son una pieza posterior de Fase 3).
export type AgentRole = "admin" | "agent";

// Planes y estados de suscripción.
// Modelo unificado de 4 planes. Límites de propiedades: free=1, inicial=20,
// profesional=60, premium=200 (ver constante PLANS más abajo).
// 'free' es el plan del tenant_type 'individual' (particular); el resto, 'agency'.
export type SubscriptionPlan = "free" | "inicial" | "profesional" | "premium";
// 'pending' = plan pago elegido pero todavía no activado, esperando la
// activación manual del admin (se usa en la selección de plan de Fase 3).
export type SubscriptionStatus = "active" | "pending" | "past_due" | "canceled";

// Tipo de cuenta/tenant: particular individual (plan free) o agencia (resto).
export type TenantType = "individual" | "agency";

// Amenities disponibles en el sistema
export type Amenity =
  | "pileta"
  | "quincho"
  | "parrilla"
  | "gym"
  | "sum"
  | "seguridad_24h"
  | "portero"
  | "laundry"
  | "solarium"
  | "jardin"
  | "terraza"
  | "cochera_cubierta"
  | "vista_al_rio"
  | "vista_al_mar"
  | "apto_credito"
  | "apto_profesional";

// ─── Entidades principales ────────────────────────────────────

// Ciudad / mercado. El visitante navega un marketplace filtrado por ciudad.
export interface City {
  id: string;
  name: string;          // "Santiago del Estero"
  slug: string;          // "santiago-del-estero"
  province: string | null;
  country: string;
  center_lat: number;    // centro del mapa al entrar
  center_lng: number;
  default_zoom: number;  // zoom inicial
  is_active: boolean;    // habilitada para el público
  created_at: string;
}

export interface Agency {
  id: string;
  city_id: string;       // toda agencia pertenece a una ciudad
  name: string;
  slug: string;
  // Tipo de tenant (Fase 3, ya migrado en la base). 'agency' = inmobiliaria
  // (varios agentes); 'individual' = particular (una persona, plan free).
  // Internamente ambos son filas en agencies. La regla "individual → solo free"
  // se valida en el registro (backend), no en la base.
  tenant_type: TenantType;
  logo_url: string | null;
  website: string | null;
  brand_color: string | null; // override del acento para futura vista white-label
  created_at: string;
  // Relaciones opcionales (joins)
  city?: City;
  subscription?: Subscription;
}

// Suscripción de una agencia. Controla plan, límite de propiedades y los
// entitlements efectivos (destacados / white-label / métricas).
// La escritura ocurre solo en el backend (service role).
// IMPORTANTE: el gating de features se hace con estos booleanos (fuente de
// verdad en la DB ya migrada), NO comparando el nombre del plan.
export interface Subscription {
  id: string;
  agency_id: string;
  plan: SubscriptionPlan;            // el plan que RIGE hoy (límites/has_* efectivos)
  // Plan pago PEDIDO esperando activación manual del admin; null si no hay.
  // 'plan' nunca se pisa al pedir un upgrade: lo pedido vive acá hasta que el
  // admin lo activa (entonces pending_plan → plan y se limpia a null).
  pending_plan: SubscriptionPlan | null;
  status: SubscriptionStatus;
  property_limit: number;            // del plan que rige. free=1, inicial=20, profesional=60, premium=200
  has_featured: boolean;             // puede marcar propiedades como destacadas
  has_white_label: boolean;          // habilita la vista white-label
  has_metrics: boolean;              // métricas avanzadas de propiedades y leads
  current_period_end: string | null;
  // Fecha desde la que rige el plan pago activo actual; null si no hay plan
  // pago activo (free, o pago en pending sin activar). La setea la activación
  // del admin (no un trigger): se actualiza en cada activación/cambio/renovación.
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string; // = auth.users(id) de Supabase
  agency_id: string; // NOT NULL en el modelo marketplace
  role: AgentRole; // 'admin' | 'agent' (ya migrado; todavía no gatea permisos)
  full_name: string;
  phone_wa: string; // número sin "+" ej: "5491112345678"
  // Email denormalizado de auth.users, para mostrar en la UI (lista de equipo,
  // perfil). La fuente de verdad del login sigue siendo auth.users; esta es
  // copia de lectura. Nullable: agentes previos al backfill pueden no tenerlo.
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  // Relaciones opcionales (joins)
  agency?: Agency;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  is_cover: boolean;
  sort_order: number;
  created_at: string;
}

export interface Property {
  id: string;
  agent_id: string;
  agency_id: string;     // NOT NULL: toda propiedad pertenece a una agencia
  city_id: string;       // NOT NULL: denormalizado para filtrar el mapa sin JOIN

  // Identificación
  title: string;
  slug: string;
  description: string | null;
  status: PropertyStatus;

  // Tipo
  property_type: PropertyType;
  operation_type: OperationType;

  // Precio
  price: number;
  currency: Currency;
  price_negotiable: boolean;

  // Superficie
  area_total_m2: number | null;
  area_covered_m2: number | null;

  // Ambientes
  bedrooms: number;
  bathrooms: number;
  parking_spots: number;
  floor_number: number | null;

  // Ubicación (lat/lng se colocan con pin manual, NO geocoding)
  address: string;
  neighborhood: string | null;
  city: string;          // nombre legible; city_id es la relación real
  province: string | null;
  country: string;
  lat: number;
  lng: number;

  // Extras
  amenities: Amenity[];
  year_built: number | null;
  is_featured: boolean;
  views_count: number;

  created_at: string;
  updated_at: string;

  // Relaciones opcionales (joins)
  images?: PropertyImage[];
  agent?: Agent;
  agency?: Agency;
}

// ─── Leads ───────────────────────────────────────────────────

export interface Lead {
  id: string;
  property_id: string;
  agent_id: string;
  agency_id: string;     // incluido para queries del dashboard por agencia
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  message: string | null;
  source: string;
  created_at: string;
  // Relaciones opcionales (joins). Mismo patrón que Property.
  // agent puede ser null si la propiedad quedó sin agente (agente desvinculado,
  // hoy no ocurre). Se usan en la pantalla de Consultas (/dashboard/leads).
  agent?: Pick<Agent, "id" | "full_name"> | null;
  property?: Pick<Property, "id" | "title" | "slug">;
}

// ─── Filtros del mapa ─────────────────────────────────────────

export interface MapFilters {
  operation_type: OperationType | null;
  property_types: PropertyType[];
  price_min: number | null;
  price_max: number | null;
  currency: Currency;
  area_min: number | null;
  area_max: number | null;
  bedrooms_min: number | null;
  neighborhood: string | null;
  amenities: Amenity[];
  only_featured: boolean;
}

export const DEFAULT_FILTERS: MapFilters = {
  operation_type: null,
  property_types: [],
  price_min: null,
  price_max: null,
  currency: "USD",
  area_min: null,
  area_max: null,
  bedrooms_min: null,
  neighborhood: null,
  amenities: [],
  only_featured: false,
};

// Bounds del viewport del mapa, para la query de propiedades
export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

// ─── Props de componentes clave ───────────────────────────────

export interface PropertyModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

export interface WhatsAppContactForm {
  name: string; // único campo requerido al visitante
}

// Favorito guardado en localStorage (sin login). Solo se persiste el id;
// el resto se re-fetchea cuando el visitante abre su lista de favoritos.
export interface StoredFavorite {
  property_id: string;
  saved_at: string;
}

// ─── Supabase helpers ─────────────────────────────────────────

// Tipo para insertar una propiedad nueva (sin campos auto-generados).
// city_id se copia desde la agencia del agente al crear.
export type PropertyInsert = Omit<
  Property,
  "id" | "slug" | "views_count" | "created_at" | "updated_at" | "images" | "agent" | "agency"
>;

// Tipo para actualizar (todos los campos opcionales excepto id)
export type PropertyUpdate = Partial<PropertyInsert> & { id: string };

// ─── Helpers de plan ──────────────────────────────────────────

// Catálogo de planes para la UI (pricing, badges, mensajes de upgrade).
// Es la fuente de verdad de NOMBRE / PRECIO / LÍMITE de cada plan.
// Los flags (featured/whiteLabel/metrics) describen qué INCLUYE cada plan en
// las tarjetas de precios; el gating en runtime se hace con los booleanos de la
// suscripción (has_featured / has_white_label / has_metrics), no con estos.
export interface PlanInfo {
  id: SubscriptionPlan;
  name: string;            // nombre visible
  tenantType: TenantType;  // 'individual' (free) | 'agency' (resto)
  propertyLimit: number;
  priceLabel: string;      // placeholder editable
  featured: boolean;
  whiteLabel: boolean;
  metrics: boolean;
}

export const PLANS: Record<SubscriptionPlan, PlanInfo> = {
  free: {
    id: "free", name: "Particular", tenantType: "individual",
    propertyLimit: 1, priceLabel: "Gratis",
    featured: false, whiteLabel: false, metrics: false,
  },
  inicial: {
    id: "inicial", name: "Inicial", tenantType: "agency",
    propertyLimit: 20, priceLabel: "$30.000",
    featured: false, whiteLabel: false, metrics: false,
  },
  profesional: {
    id: "profesional", name: "Profesional", tenantType: "agency",
    propertyLimit: 60, priceLabel: "$65.000",
    featured: false, whiteLabel: true, metrics: false,
  },
  premium: {
    id: "premium", name: "Premium", tenantType: "agency",
    propertyLimit: 200, priceLabel: "$140.000",
    featured: true, whiteLabel: true, metrics: true,
  },
};

// Orden ascendente de planes (free → premium). Para mostrar "el plan siguiente".
export const PLAN_ORDER = ["free", "inicial", "profesional", "premium"] as const;

// Estado de uso del plan, para mostrar en el dashboard y bloquear el alta.
// Incluye los entitlements efectivos leídos de la suscripción (no del nombre del plan).
export interface PlanUsage {
  plan: SubscriptionPlan;
  used: number;          // propiedades activas/pausadas actuales
  limit: number;         // property_limit del plan
  canCreate: boolean;    // used < limit
  hasFeatured: boolean;     // = subscription.has_featured
  hasWhiteLabel: boolean;   // = subscription.has_white_label
  hasMetrics: boolean;      // = subscription.has_metrics
}