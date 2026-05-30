"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useCityStore } from "@/store/cityStore";

export function CityPicker() {
  const city = useCityStore((s) => s.city);
  const cities = useCityStore((s) => s.cities);
  const setCity = useCityStore((s) => s.setCity);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const showSearch = cities.length > 8;
  const filtered = showSearch
    ? cities.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : cities;

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

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 font-sans text-sm font-medium text-black hover:text-graphite transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {city?.name ?? "Seleccioná ciudad"}
        <ChevronDown
          size={16}
          className={`text-graphite transition-transform duration-120 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-paper border border-stone rounded-lg shadow-lg z-[600] overflow-hidden">
          {showSearch && (
            <div className="px-3 py-2 border-b border-stone">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ciudad..."
                className="w-full font-sans text-sm text-black bg-transparent placeholder:text-stone outline-none"
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 font-sans text-sm text-graphite">
                Sin resultados
              </p>
            ) : (
              filtered.map((c) => {
                const active = c.id === city?.id;
                return (
                  <button
                    key={c.id}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setCity(c);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2.5 font-sans text-sm flex items-center justify-between transition-colors ${
                      active
                        ? "bg-terracota-subtle text-terracota"
                        : "text-black hover:bg-mist"
                    }`}
                  >
                    {c.name}
                    {active && <Check size={14} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
