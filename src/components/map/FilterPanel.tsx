"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useMapFilters, selectActiveFiltersCount } from "@/store/mapFiltersStore";
import { cn } from "@/lib/utils";
import type { PropertyType, Amenity } from "@/types";
import { PROPERTY_TYPE_LABELS, AMENITY_LABELS } from "@/lib/utils/labels";

// ─── Constantes ───────────────────────────────────────────────

// Todos los tipos de propiedad, para los botones del filtro
const PROPERTY_TYPE_VALUES = Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[];

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
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 font-sans text-sm text-black placeholder:text-stone bg-white border border-stone rounded-md outline-none focus:border-graphite focus:ring-2 focus:ring-terracota/20"
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

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Operación */}
        <Section title="Operación">
          <div className="flex gap-2">
            <ToggleBtn
              active={filters.operation_type === "venta"}
              onClick={() =>
                setFilter("operation_type", filters.operation_type === "venta" ? null : "venta")
              }
            >
              Venta
            </ToggleBtn>
            <ToggleBtn
              active={filters.operation_type === "alquiler"}
              onClick={() =>
                setFilter("operation_type", filters.operation_type === "alquiler" ? null : "alquiler")
              }
            >
              Alquiler
            </ToggleBtn>
            <ToggleBtn
              active={filters.operation_type === "alquiler_temporal"}
              onClick={() =>
                setFilter(
                  "operation_type",
                  filters.operation_type === "alquiler_temporal" ? null : "alquiler_temporal"
                )
              }
            >
              Temporal
            </ToggleBtn>
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

        {/* Precio */}
        <Section title="Precio">
          <div className="flex gap-2 mb-2">
            {(["USD", "ARS"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter("currency", c)}
                className={cn(
                  "flex-1 py-1.5 font-sans text-sm font-medium rounded-md transition-colors",
                  filters.currency === c
                    ? "bg-terracota text-paper"
                    : "bg-mist text-graphite hover:bg-stone/60"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumInput
              value={priceMin}
              onChange={setPriceMin}
              placeholder="Desde"
            />
            <NumInput
              value={priceMax}
              onChange={setPriceMax}
              placeholder="Hasta"
            />
          </div>
          <button
            type="button"
            onClick={() => { commitPrice("price_min", priceMin); commitPrice("price_max", priceMax); }}
            className="w-full mt-1 py-1.5 font-sans text-xs text-graphite bg-mist hover:bg-stone/60 rounded-md transition-colors"
          >
            Aplicar precio
          </button>
        </Section>

        {/* Superficie */}
        <Section title="Superficie (m²)">
          <div className="grid grid-cols-2 gap-2">
            <NumInput value={areaMin} onChange={setAreaMin} placeholder="Desde" />
            <NumInput value={areaMax} onChange={setAreaMax} placeholder="Hasta" />
          </div>
          <button
            type="button"
            onClick={() => { commitArea("area_min", areaMin); commitArea("area_max", areaMax); }}
            className="w-full mt-1 py-1.5 font-sans text-xs text-graphite bg-mist hover:bg-stone/60 rounded-md transition-colors"
          >
            Aplicar superficie
          </button>
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
          <div className="grid grid-cols-2 gap-2">
            {FILTER_AMENITIES.map((value) => {
              const active = filters.amenities.includes(value);
              return (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleAmenity(value)}
                    className="w-4 h-4 accent-terracota rounded"
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.only_featured}
              onChange={() => setFilter("only_featured", !filters.only_featured)}
              className="w-4 h-4 accent-terracota rounded"
            />
            <span className="font-sans text-sm text-black">Solo propiedades destacadas</span>
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
