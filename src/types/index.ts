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

// Planes y estados de suscripción
export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "active" | "past_due" | "canceled";

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
  logo_url: string | null;
  website: string | null;
  brand_color: string | null; // override del acento para futura vista white-label
  created_at: string;
  // Relaciones opcionales (joins)
  city?: City;
  subscription?: Subscription;
}

// Suscripción de una agencia. Controla plan y límite de propiedades.
// La escritura ocurre solo en el backend (service role).
export interface Subscription {
  id: string;
  agency_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  property_limit: number;            // free = 5; pro = alto (ej. 9999)
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string; // = auth.users(id) de Supabase
  agency_id: string; // NOT NULL en el modelo marketplace
  full_name: string;
  phone_wa: string; // número sin "+" ej: "5491112345678"
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

// Estado de uso del plan, para mostrar en el dashboard y bloquear el alta.
export interface PlanUsage {
  plan: SubscriptionPlan;
  used: number;          // propiedades activas/pausadas actuales
  limit: number;         // property_limit del plan
  canCreate: boolean;    // used < limit
}
