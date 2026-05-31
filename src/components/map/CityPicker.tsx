"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useCityStore } from "@/store/cityStore";
import { cn } from "@/lib/utils";

export function CityPicker() {
  const city = useCityStore((s) => s.city);
  const cities = useCityStore((s) => s.cities);
  const nearbyCityId = useCityStore((s) => s.nearbyCityId);
  const setCity = useCityStore((s) => s.setCity);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = cities.length > 8;

  // Orden: ciudad detectada por geolocalización primera, resto alfabético.
  const ordered = (() => {
    const sorted = [...cities].sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    );
    if (!nearbyCityId) return sorted;
    const idx = sorted.findIndex((c) => c.id === nearbyCityId);
    if (idx < 0) return sorted;
    const [near] = sorted.splice(idx, 1);
    return [near, ...sorted];
  })();

  const filtered = showSearch
    ? ordered.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : ordered;

  // Cerrar al hacer click afuera (solo mientras está abierto)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Enfocar la búsqueda al abrir (no con autoFocus: robaría el foco al montar)
  useEffect(() => {
    if (isOpen && showSearch) searchRef.current?.focus();
  }, [isOpen, showSearch]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 font-sans text-sm font-medium text-black transition-colors hover:text-graphite"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {city?.name ?? "Seleccioná ciudad"}
        <ChevronDown
          size={16}
          className={cn(
            "text-graphite transition-transform duration-[120ms]",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown — siempre montado para animar entrada y salida.
          max-w evita que desborde en pantallas chicas. */}
      <div
        role="listbox"
        aria-hidden={!isOpen}
        className={cn(
          "absolute top-full left-1/2 z-[600] mt-2 w-56 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 origin-top overflow-hidden rounded-lg border border-stone bg-paper shadow-lg",
          "transition duration-[120ms] ease-out",
          isOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        )}
      >
        {showSearch && (
          <div className="border-b border-stone px-3 py-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ciudad..."
              className="w-full bg-transparent font-sans text-sm text-black outline-none placeholder:text-stone"
            />
          </div>
        )}
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 font-sans text-sm text-graphite">
              Sin resultados
            </p>
          ) : (
            filtered.map((c) => {
              const active = c.id === city?.id;
              const isNearby = c.id === nearbyCityId;
              return (
                <button
                  key={c.id}
                  role="option"
                  aria-selected={active}
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => {
                    setCity(c);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors",
                    active
                      ? "bg-terracota-subtle text-terracota"
                      : "text-black hover:bg-mist"
                  )}
                >
                  <span className="flex flex-col">
                    <span className="font-sans text-sm">{c.name}</span>
                    {isNearby && (
                      <span className="font-sans text-[11px] text-graphite">
                        Cerca tuyo
                      </span>
                    )}
                  </span>
                  {active && <Check size={14} className="shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
