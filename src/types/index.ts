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

// Rol del agente dentro de su agencia (ya migrado en la base).
// 'admin': gestiona el equipo, ve los leads de toda la agencia y administra las
// propiedades de toda la agencia. 'agent': CRUD de sus propias propiedades.
// 'role' YA GATEA permisos: la sección Equipo (/dashboard/equipo y sus actions),
// el alcance de Consultas (policy "Admin reads agency leads") y la gestión de
// propiedades ajenas dentro de la agencia (helper authorizePropertyAccess).
export type AgentRole = "admin" | "agent";

// Planes y estados de suscripción.
// Cuatro valores posibles en la columna, pero SOLO TRES SE VENDEN: inicial=20,
// profesional=60, premium=200 propiedades.
// 'free' (límite 1) NO es un producto: es el ESTADO DE ATERRIZAJE de toda alta.
// Toda agencia nueva nace en free/active, y cuando pide un plan pago sigue en
// free hasta que el dueño de la app lo activa a mano (lo pedido vive en
// pending_plan). Ya no existen cuentas de particular; ver TenantType.
// No confundir el dominio de la columna con el catálogo de venta.
export type SubscriptionPlan = "free" | "inicial" | "profesional" | "premium";
// 'pending' = plan pago elegido pero todavía no activado, esperando la
// activación manual del admin (se usa en la selección de plan de Fase 3).
export type SubscriptionStatus = "active" | "pending" | "past_due" | "canceled";

// Tipo de cuenta/tenant. LEGACY: la app ya no acepta cuentas de particular
// ('individual'). El registro escribe siempre 'agency'. El tipo y la columna
// sobreviven porque el valor 'individual' sigue existiendo en filas históricas
// de la base y el panel /admin lo muestra. No ofrecer 'individual' en ningún
// flujo de alta.
export type TenantType = "individual" | "agency";

// Estado de aprobación de una agencia (columna agencies.approval_status).
// Es la respuesta a "¿es una inmobiliaria legítima?" y es un EJE INDEPENDIENTE
// de la suscripción, que responde "¿paga?". Nunca mezclar los dos en una misma
// clasificación: una agencia puede estar aprobada y sin plan pago, o pagar y
// estar pendiente de aprobación.
// 'rejected' NO es definitivo: la agencia corrige sus datos y vuelve a
// 'pending'. No existe un estado de rechazo permanente.
export type ApprovalStatus = "pending" | "approved" | "rejected";

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
  // Tipo de tenant. LEGACY: el registro escribe siempre 'agency'; 'individual'
  // (particular) solo aparece en filas históricas. La columna NO se borró y
  // nada de la base la lee (cero triggers, funciones o policies la consultan);
  // es puramente descriptiva y solo se muestra en el panel /admin.
  tenant_type: TenantType;
  // WhatsApp de la agencia (NOT NULL en la base). Obligatorio: se setea en el
  // registro (hereda el del admin fundador) y se edita en Preferencias (solo el
  // admin de agencia). Formato "5491112345678", igual que agents.phone_wa.
  phone_wa: string;
  // Número de matrícula del colegio de corredores inmobiliarios. Es nullable
  // porque las agencias históricas (las anteriores al alta manual) no la tienen,
  // pero en toda alta nueva es obligatoria: sin matrícula no hay aprobación.
  // Puede ser pública sin problema — el padrón del colegio ya lo es.
  // Unicidad: la impone un índice único PARCIAL en la base, por (city_id,
  // license_number) y solo entre agencias aprobadas, así que dos pendientes
  // pueden reclamar la misma matrícula hasta que el dueño resuelva cuál vale.
  license_number: string | null;
  // Estado de aprobación. EJE INDEPENDIENTE de la suscripción (ver ApprovalStatus).
  // Lo decide a mano el dueño de la plataforma desde /admin; el DEFAULT de la
  // base es 'pending', así que toda agencia nueva nace pendiente.
  approval_status: ApprovalStatus;
  logo_url: string | null;
  website: string | null;
  brand_color: string | null; // override del acento para futura vista white-label
  created_at: string;
  // Relaciones opcionales (joins)
  city?: City;
  subscription?: Subscription;
}

// Una decisión de aprobación tomada por el dueño de la plataforma sobre una
// agencia (tabla agency_reviews). Es un historial: cada aprobación y cada
// rechazo agrega una fila, no se pisan entre sí. Volver una agencia rechazada a
// 'pending' NO es un veredicto y no registra fila (el CHECK de decision solo
// admite 'approved' y 'rejected').
//
// ⚠ POR QUÉ LA NOTA VIVE EN UNA TABLA APARTE Y NO EN agencies:
// `agencies` tiene la policy `Public read agencies` con `qual: true`, o sea que
// CUALQUIERA con la anon key puede leer la tabla entera, sin sesión. Postgres no
// permite restringir columnas dentro de una policy, así que una nota guardada
// ahí —un texto que el dueño escribe sobre un tercero, del estilo "la matrícula
// no coincide con el titular"— sería pública de hecho. `agency_reviews` tiene
// RLS habilitada y CERO policies: nadie la lee ni la escribe salvo el server con
// service role. No agregarle policies ni mover la nota a `agencies`.
export interface AgencyReview {
  id: string;
  agency_id: string;
  // Solo veredictos: aprobar o rechazar. 'pending' no es una decisión.
  decision: Extract<ApprovalStatus, "approved" | "rejected">;
  // Motivo. Obligatorio al rechazar (lo exige la server action, no la base:
  // la columna es nullable); opcional al aprobar.
  note: string | null;
  // auth.users.id del dueño que decidió. Nullable por la FK ON DELETE SET NULL:
  // si ese usuario desaparece, la decisión sobrevive sin autor.
  reviewed_by: string | null;
  created_at: string;
}

// Largo máximo de la nota de una review. Vive acá y no en las server actions
// porque un archivo "use server" solo puede exportar funciones async: el panel
// de rechazo (client) y la validación del server necesitan el mismo número, así
// que se comparte desde el dominio. Es un motivo interno, no un texto legal:
// 500 caracteres alcanzan de sobra y ponen un techo a lo que se guarda.
export const REJECTION_NOTE_MAX = 500;

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
// ⚠ PLANS.free cumple DOS funciones que conviene no confundir: su 'name' es una
// etiqueta de estado ("Gratis", lo que ve una agencia que todavía no paga), y
// sus valores numéricos (propertyLimit: 1 + los tres flags en false) son los que
// el registro y la selección de plan ESCRIBEN como estado de aterrizaje. Si se
// tocan esos números se cambia el andamio, no una etiqueta.
export interface PlanInfo {
  id: SubscriptionPlan;
  name: string;            // nombre visible
  propertyLimit: number;
  priceLabel: string;      // placeholder editable
  featured: boolean;
  whiteLabel: boolean;
  metrics: boolean;
}

export const PLANS: Record<SubscriptionPlan, PlanInfo> = {
  free: {
    id: "free", name: "Gratis",
    propertyLimit: 1, priceLabel: "Gratis",
    featured: false, whiteLabel: false, metrics: false,
  },
  inicial: {
    id: "inicial", name: "Inicial",
    propertyLimit: 20, priceLabel: "$30.000",
    featured: false, whiteLabel: false, metrics: false,
  },
  profesional: {
    id: "profesional", name: "Profesional",
    propertyLimit: 60, priceLabel: "$65.000",
    featured: false, whiteLabel: true, metrics: false,
  },
  premium: {
    id: "premium", name: "Premium",
    propertyLimit: 200, priceLabel: "$140.000",
    featured: true, whiteLabel: true, metrics: true,
  },
};

// Orden ascendente de planes (free → premium). Es el DOMINIO DE LA COLUMNA, no
// el catálogo de venta: incluye 'free' porque es un valor real de la base.
// Para listar planes ofrecibles se filtra 'free' (ver PAID_PLANS en
// PlanSelector). Sirve además para calcular "el plan siguiente" (upgrades).
export const PLAN_ORDER = ["free", "inicial", "profesional", "premium"] as const;

// Estado de uso del plan, para mostrar en el dashboard y bloquear el alta.
// Incluye los entitlements efectivos leídos de la suscripción (no del nombre del plan).
export interface PlanUsage {
  plan: SubscriptionPlan;
  used: number;          // propiedades activas/pausadas actuales
  limit: number;         // property_limit del plan
  available: number;     // Math.max(0, limit - used). Saneado: NUNCA negativo (0 si used > limit)
  over: number;          // Math.max(0, used - limit). 0 si dentro del límite; > 0 si se excedió (ej. tras downgrade)
  canCreate: boolean;    // used < limit
  hasFeatured: boolean;     // = subscription.has_featured
  hasWhiteLabel: boolean;   // = subscription.has_white_label
  hasMetrics: boolean;      // = subscription.has_metrics
}