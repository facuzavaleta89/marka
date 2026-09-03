"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useMapFilters, selectActiveFiltersCount } from "@/store/mapFiltersStore";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { PropertyType, Amenity, OperationType } from "@/types";
import {
  PROPERTY_TYPE_LABELS,
  AMENITY_LABELS,
  OPERATION_TYPE_LABELS,
} from "@/lib/utils/labels";

// Override para que el Checkbox de shadcn use terracota en estado marcado
// (mismo patrón que PropertyForm, para consistencia en todo el form).
const CHECKBOX_TERRACOTA =
  "border-stone data-[state=checked]:bg-terracota data-[state=checked]:border-terracota data-[state=checked]:text-paper";

// ─── Constantes ───────────────────────────────────────────────

// Todos los tipos de propiedad, para los botones del filtro
const PROPERTY_TYPE_VALUES = Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[];

// Operaciones del filtro. La etiqueta de "alquiler_temporal" se acorta a
// "Temporal" solo acá: los tres botones comparten una fila de 320px y
// "Alquiler temporal" no entra. OPERATION_TYPE_LABELS sigue siendo la fuente
// para todo el resto de la UI (kicker de la card, modal, tabla del dashboard).
const OPERATION_FILTERS: { value: OperationType; label: string }[] = [
  { value: "venta", label: OPERATION_TYPE_LABELS.venta },
  { value: "alquiler", label: OPERATION_TYPE_LABELS.alquiler },
  { value: "alquiler_temporal", label: "Temporal" },
];

// Subconjunto curado de amenities que se ofrece en el filtro
const FILTER_AMENITIES: Amenity[] = [
  "pileta",
  "quincho",
  "parrilla",
  "gym",
  "seguridad_24h",
  "cochera_cubierta",
  "jardin",
  "terraza",
];

// ─── Sub-componentes internos ─────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite whitespace-nowrap">
          {title}
        </span>
        <div className="flex-1 h-px bg-stone" />
      </div>
      {children}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 py-2 font-sans text-sm font-medium rounded-md transition-colors duration-100",
        active ? "bg-terracota text-paper" : "bg-mist text-graphite hover:bg-stone/60"
      )}
    >
      {children}
    </button>
  );
}

function NumInput({
  value,
  onChange,
  onCommit,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Se aplica el filtro al perder el foco o con Enter (sin botón "Aplicar") */
  onCommit: () => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "w-full h-9 px-3 font-sans text-sm text-black placeholder:text-stone bg-white border border-stone rounded-md outline-none focus:border-graphite focus:ring-2 focus:ring-terracota/20",
        disabled && "bg-mist text-stone cursor-not-allowed"
      )}
    />
  );
}

// ─── Componente principal ─────────────────────────────────────

interface FilterPanelProps {
  /** Solo en mobile: controla si el bottom sheet está abierto */
  isOpen?: boolean;
  /** Solo en mobile: callback para cerrar el panel */
  onClose?: () => void;
  /** true = renderizar como bottom sheet mobile */
  mobile?: boolean;
}

export function FilterPanel({ isOpen, onClose, mobile }: FilterPanelProps) {
  const { filters, setFilter, resetFilters } = useMapFilters();
  const activeCount = useMapFilters(selectActiveFiltersCount);

  // Inputs con estado local para evitar re-render por cada tecla
  const [priceMin, setPriceMin] = useState(filters.price_min?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(filters.price_max?.toString() ?? "");
  const [areaMin, setAreaMin] = useState(filters.area_min?.toString() ?? "");
  const [areaMax, setAreaMax] = useState(filters.area_max?.toString() ?? "");

  // Resync de los inputs locales cuando el store cambia desde afuera (ej: resetFilters).
  // Patrón "ajustar estado durante el render" (no en un efecto) para evitar
  // renders en cascada. Tipear no toca el store, así que no se pisa lo que se escribe.
  const [storeSnapshot, setStoreSnapshot] = useState({
    price_min: filters.price_min,
    price_max: filters.price_max,
    area_min: filters.area_min,
    area_max: filters.area_max,
  });
  if (
    storeSnapshot.price_min !== filters.price_min ||
    storeSnapshot.price_max !== filters.price_max ||
    storeSnapshot.area_min !== filters.area_min ||
    storeSnapshot.area_max !== filters.area_max
  ) {
    setStoreSnapshot({
      price_min: filters.price_min,
      price_max: filters.price_max,
      area_min: filters.area_min,
      area_max: filters.area_max,
    });
    setPriceMin(filters.price_min?.toString() ?? "");
    setPriceMax(filters.price_max?.toString() ?? "");
    setAreaMin(filters.area_min?.toString() ?? "");
    setAreaMax(filters.area_max?.toString() ?? "");
  }

  const commitPrice = (field: "price_min" | "price_max", raw: string) => {
    const n = raw === "" ? null : parseFloat(raw);
    setFilter(field, isNaN(n ?? NaN) ? null : n);
  };

  const commitArea = (field: "area_min" | "area_max", raw: string) => {
    const n = raw === "" ? null : parseFloat(raw);
    setFilter(field, isNaN(n ?? NaN) ? null : n);
  };

  // El rango de precio solo se puede aplicar contra UNA columna de precio, y
  // cada operación tiene la suya (sale_price / rent_price / temp_rent_price).
  // Con cero o con varias operaciones marcadas no hay una columna que elegir, y
  // un rango de venta no significa nada sobre un alquiler: el rango se
  // deshabilita en vez de devolver un resultado que parece filtrado y no lo está.
  const priceEnabled = filters.operation_types.length === 1;

  // Operación: selección múltiple, igual que el tipo de propiedad.
  const toggleOperation = (op: OperationType) => {
    const current = filters.operation_types;
    const next = current.includes(op)
      ? current.filter((o) => o !== op)
      : [...current, op];
    setFilter("operation_types", next);

    // Si el cambio deja el rango de precio deshabilitado, se LIMPIA. Dejarlo
    // cargado lo haría seguir aplicándose de forma invisible (el usuario ve los
    // inputs grises y no sabe que hay un rango puesto). El resync de los inputs
    // locales contra el store lo hace el bloque de arriba, sin efectos.
    if (next.length !== 1) {
      setFilter("price_min", null);
      setFilter("price_max", null);
    }
  };

  const togglePropertyType = (type: PropertyType) => {
    const current = filters.property_types;
    setFilter(
      "property_types",
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    );
  };

  const toggleAmenity = (amenity: Amenity) => {
    const current = filters.amenities;
    setFilter(
      "amenities",
      current.includes(amenity)
        ? current.filter((a) => a !== amenity)
        : [...current, amenity]
    );
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header del panel (solo mobile) */}
      {mobile && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone shrink-0">
          <span className="font-sans text-base font-medium text-black">Filtros</span>
          <button onClick={onClose} className="text-graphite hover:text-black">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 md:space-y-8">
        {/* Operación — selección múltiple: una propiedad puede estar en venta y
            en alquiler a la vez, así que marcar las dos muestra las que tengan
            cualquiera de las dos (no la intersección). */}
        <Section title="Operación">
          <div className="flex gap-2">
            {OPERATION_FILTERS.map(({ value, label }) => (
              <ToggleBtn
                key={value}
                active={filters.operation_types.includes(value)}
                onClick={() => toggleOperation(value)}
              >
                {label}
              </ToggleBtn>
            ))}
          </div>
        </Section>

        {/* Tipo de propiedad */}
        <Section title="Tipo de propiedad">
          <div className="grid grid-cols-2 gap-2">
            {PROPERTY_TYPE_VALUES.map((value) => {
              const active = filters.property_types.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => togglePropertyType(value)}
                  className={cn(
                    "py-1.5 px-3 font-sans text-sm rounded-md border transition-colors text-left",
                    active
                      ? "border-terracota bg-terracota-subtle text-terracota"
                      : "border-stone bg-white text-graphite hover:border-graphite"
                  )}
                >
                  {PROPERTY_TYPE_LABELS[value]}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Precio — solo con UNA operación marcada (ver priceEnabled) */}
        <Section title="Precio">
          <div className="flex gap-2 mb-2">
            {(["USD", "ARS"] as const).map((c) => (
              <button
                key={c}
                type="button"
                disabled={!priceEnabled}
                onClick={() => setFilter("currency", c)}
                className={cn(
                  "flex-1 py-1.5 font-sans text-sm font-medium rounded-md transition-colors",
                  !priceEnabled
                    ? "bg-mist text-stone cursor-not-allowed"
                    : filters.currency === c
                      ? "bg-terracota text-paper"
                      : "bg-mist text-graphite hover:bg-stone/60"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <NumInput
              value={priceMin}
              onChange={setPriceMin}
              onCommit={() => commitPrice("price_min", priceMin)}
              placeholder="Desde"
              disabled={!priceEnabled}
            />
            <span className={priceEnabled ? "text-stone" : "text-stone/60"}>–</span>
            <NumInput
              value={priceMax}
              onChange={setPriceMax}
              onCommit={() => commitPrice("price_max", priceMax)}
              placeholder="Hasta"
              disabled={!priceEnabled}
            />
          </div>
          {/* La leyenda es visible, no una letra chica: sin ella los inputs
              grises parecen un error de la app. */}
          {!priceEnabled && (
            <p className="font-sans text-xs text-graphite">
              Elegí una sola operación para filtrar por precio.
            </p>
          )}
        </Section>

        {/* Superficie */}
        <Section title="Superficie (m²)">
          <div className="flex items-center gap-2">
            <NumInput
              value={areaMin}
              onChange={setAreaMin}
              onCommit={() => commitArea("area_min", areaMin)}
              placeholder="Desde"
            />
            <span className="text-stone">–</span>
            <NumInput
              value={areaMax}
              onChange={setAreaMax}
              onCommit={() => commitArea("area_max", areaMax)}
              placeholder="Hasta"
            />
          </div>
        </Section>

        {/* Dormitorios */}
        <Section title="Dormitorios">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => {
              const value = n;
              const label = n === 4 ? "4+" : String(n);
              const active = filters.bedrooms_min === value;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFilter("bedrooms_min", active ? null : value)}
                  className={cn(
                    "flex-1 py-2 font-sans text-sm font-medium rounded-md transition-colors",
                    active
                      ? "bg-terracota text-paper"
                      : "bg-mist text-graphite hover:bg-stone/60"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Amenities */}
        <Section title="Amenities">
          <div className="grid grid-cols-2 gap-2.5">
            {FILTER_AMENITIES.map((value) => {
              const active = filters.amenities.includes(value);
              return (
                <label
                  key={value}
                  htmlFor={`amenity-${value}`}
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <Checkbox
                    id={`amenity-${value}`}
                    checked={active}
                    onCheckedChange={() => toggleAmenity(value)}
                    className={CHECKBOX_TERRACOTA}
                  />
                  <span className="font-sans text-sm text-black">
                    {AMENITY_LABELS[value]}
                  </span>
                </label>
              );
            })}
          </div>
        </Section>

        {/* Solo destacadas */}
        <Section title="Destacadas">
          <label
            htmlFor="only-featured"
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <Checkbox
              id="only-featured"
              checked={filters.only_featured}
              onCheckedChange={() =>
                setFilter("only_featured", !filters.only_featured)
              }
              className={CHECKBOX_TERRACOTA}
            />
            <span className="font-sans text-sm text-black">
              Solo propiedades destacadas
            </span>
          </label>
        </Section>
      </div>

      {/* Botón limpiar filtros */}
      {activeCount > 0 && (
        <div className="px-5 py-4 border-t border-stone shrink-0">
          <button
            type="button"
            onClick={() => {
              resetFilters();
              setPriceMin(""); setPriceMax(""); setAreaMin(""); setAreaMax("");
            }}
            className="w-full py-2.5 font-sans text-sm font-medium text-error border border-error rounded-md hover:bg-terracota-subtle transition-colors"
          >
            Limpiar filtros ({activeCount})
          </button>
        </div>
      )}
    </div>
  );

  // ── Modo desktop: panel inline ────────────────────────────────
  if (!mobile) {
    return (
      <div className="relative h-full bg-paper flex flex-col z-10">{content}</div>
    );
  }

  // ── Modo mobile: bottom sheet ─────────────────────────────────
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[600]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          "fixed bottom-0 inset-x-0 z-[610] bg-paper rounded-t-xl shadow-xl transition-transform duration-220 ease-out",
          "h-[85vh] flex flex-col",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle visual */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-stone rounded-full" />
        </div>
        {content}
      </div>
    </>
  );
}
