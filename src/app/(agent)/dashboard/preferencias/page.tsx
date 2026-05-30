"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "marka_preferences";

type Preferences = {
  email_weekly_summary: boolean;
  dark_mode: boolean;
  timezone: string;
};

const DEFAULT_PREFERENCES: Preferences = {
  email_weekly_summary: false,
  dark_mode: false,
  timezone: "America/Argentina/Buenos_Aires",
};

const TIMEZONES = [
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (UTC-3)" },
  { value: "America/Santiago", label: "Chile (UTC-4 / -3 verano)" },
  { value: "America/Guayaquil", label: "Ecuador (UTC-5)" },
  { value: "America/Mexico_City", label: "México (UTC-6 / -5 verano)" },
  { value: "Europe/Madrid", label: "España (UTC+1 / +2 verano)" },
];

function Toggle({
  enabled,
  onToggle,
  id,
}: {
  enabled: boolean;
  onToggle: () => void;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={[
        "relative inline-flex w-11 h-6 rounded-full shrink-0 transition-colors duration-[120ms]",
        enabled ? "bg-terracota" : "bg-stone",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-1 left-1 w-4 h-4 bg-paper rounded-full shadow-sm transition-transform duration-[120ms]",
          enabled ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

export default function PreferenciasPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPrefs({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
      }
    } catch {
      // localStorage unavailable o JSON inválido — usar defaults
    }
  }, []);

  function toggle(key: "email_weekly_summary" | "dark_mode") {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setSaved(true);
    } catch {
      // localStorage unavailable
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="font-serif text-4xl font-bold text-black mb-8">Preferencias</h1>

      <div className="space-y-6">
        {/* Notificaciones */}
        <section className="bg-paper border border-stone rounded-lg p-6 space-y-4">
          <h2 className="font-serif text-2xl font-semibold text-black">Notificaciones</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-sans text-sm font-medium text-black">
                Resumen semanal por email
              </p>
              <p className="font-sans text-xs text-graphite mt-0.5">
                Recibí un resumen de tus propiedades y leads cada semana
              </p>
            </div>
            <Toggle
              enabled={prefs.email_weekly_summary}
              onToggle={() => toggle("email_weekly_summary")}
            />
          </div>
        </section>

        {/* Apariencia */}
        <section className="bg-paper border border-stone rounded-lg p-6 space-y-4">
          <h2 className="font-serif text-2xl font-semibold text-black">Apariencia</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-sans text-sm font-medium text-black">Modo oscuro</p>
              <p className="font-sans text-xs text-graphite mt-0.5">
                Próximamente disponible
              </p>
            </div>
            <Toggle
              enabled={prefs.dark_mode}
              onToggle={() => toggle("dark_mode")}
            />
          </div>
        </section>

        {/* Zona horaria */}
        <section className="bg-paper border border-stone rounded-lg p-6 space-y-4">
          <h2 className="font-serif text-2xl font-semibold text-black">Zona horaria</h2>
          <div className="space-y-1.5">
            <label
              htmlFor="timezone"
              className="font-sans text-sm font-medium text-black"
            >
              Tu zona horaria
            </label>
            <select
              id="timezone"
              value={prefs.timezone}
              onChange={(e) => {
                setPrefs((prev) => ({ ...prev, timezone: e.target.value }));
                setSaved(false);
              }}
              className="w-full font-sans text-sm text-black bg-white border border-stone rounded-md h-11 px-3 focus:outline-none focus:border-graphite focus:ring-2 focus:ring-terracota focus:ring-offset-1"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Guardar */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms]"
          >
            Guardar preferencias
          </button>
          {saved && (
            <p className="font-sans text-sm text-success">Preferencias guardadas</p>
          )}
        </div>
      </div>
    </div>
  );
}
