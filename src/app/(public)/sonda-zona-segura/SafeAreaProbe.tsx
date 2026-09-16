"use client";

import { useEffect, useRef, useState } from "react";

// ⚠ TEMPORAL — rama descartable. Mide en vivo zonas seguras y altos de viewport.

type Insets = { top: number; right: number; bottom: number; left: number };

type Measurement = {
  insets: Insets;
  inner: string;
  visualViewport: string;
  screen: string;
  devicePixelRatio: number;
  heights: { vh: number; dvh: number; svh: number; lvh: number };
  orientation: string;
  displayModeStandalone: boolean;
  navigatorStandalone: string;
  userAgent: string;
  measuredAt: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

function toText(m: Measurement): string {
  return [
    `safe-area-inset-top: ${m.insets.top}px`,
    `safe-area-inset-right: ${m.insets.right}px`,
    `safe-area-inset-bottom: ${m.insets.bottom}px`,
    `safe-area-inset-left: ${m.insets.left}px`,
    `innerWidth × innerHeight: ${m.inner}`,
    `visualViewport: ${m.visualViewport}`,
    `screen: ${m.screen}`,
    `devicePixelRatio: ${m.devicePixelRatio}`,
    `100vh: ${m.heights.vh}px`,
    `100dvh: ${m.heights.dvh}px`,
    `100svh: ${m.heights.svh}px`,
    `100lvh: ${m.heights.lvh}px`,
    `orientación: ${m.orientation}`,
    `display-mode standalone: ${m.displayModeStandalone}`,
    `navigator.standalone (iOS): ${m.navigatorStandalone}`,
    `userAgent: ${m.userAgent}`,
    `medido: ${m.measuredAt}`,
  ].join("\n");
}

export function SafeAreaProbe() {
  // Elemento oculto con padding = env(...) en cada lado: getComputedStyle
  // devuelve el valor resuelto en px.
  const insetRef = useRef<HTMLDivElement>(null);
  const vhRef = useRef<HTMLDivElement>(null);
  const dvhRef = useRef<HTMLDivElement>(null);
  const svhRef = useRef<HTMLDivElement>(null);
  const lvhRef = useRef<HTMLDivElement>(null);

  const [m, setM] = useState<Measurement | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");

  useEffect(() => {
    const measure = () => {
      const insetEl = insetRef.current;
      if (!insetEl) return;
      const cs = getComputedStyle(insetEl);
      const height = (el: HTMLDivElement | null) =>
        el ? round(el.getBoundingClientRect().height) : NaN;
      const vv = window.visualViewport;
      const orientation =
        screen.orientation?.type ??
        (window.innerWidth > window.innerHeight ? "landscape (por ancho/alto)" : "portrait (por ancho/alto)");
      const nav = navigator as Navigator & { standalone?: boolean };

      setM({
        insets: {
          top: round(parseFloat(cs.paddingTop)),
          right: round(parseFloat(cs.paddingRight)),
          bottom: round(parseFloat(cs.paddingBottom)),
          left: round(parseFloat(cs.paddingLeft)),
        },
        inner: `${window.innerWidth} × ${window.innerHeight}`,
        visualViewport: vv
          ? `${round(vv.width)} × ${round(vv.height)} · offsetTop ${round(vv.offsetTop)}`
          : "no existe",
        screen: `${screen.width} × ${screen.height}`,
        devicePixelRatio: window.devicePixelRatio,
        heights: {
          vh: height(vhRef.current),
          dvh: height(dvhRef.current),
          svh: height(svhRef.current),
          lvh: height(lvhRef.current),
        },
        orientation,
        displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
        navigatorStandalone:
          nav.standalone === undefined ? "no existe" : String(nav.standalone),
        userAgent: navigator.userAgent,
        measuredAt: new Date().toLocaleTimeString("es-AR"),
      });
    };

    // Medir en el cuadro siguiente y, tras un cambio de orientación, también un
    // rato después: algunos navegadores disparan el evento antes de reacomodar.
    let raf = requestAnimationFrame(measure);
    const timers: number[] = [];
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
      timers.push(window.setTimeout(measure, 350));
    };

    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, []);

  const copyAll = async () => {
    if (!m) return;
    try {
      await navigator.clipboard.writeText(toText(m));
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  };

  const rows: [string, string][] = m
    ? [
        ["safe-area-inset-top", `${m.insets.top}px`],
        ["safe-area-inset-right", `${m.insets.right}px`],
        ["safe-area-inset-bottom", `${m.insets.bottom}px`],
        ["safe-area-inset-left", `${m.insets.left}px`],
        ["innerWidth × innerHeight", m.inner],
        ["visualViewport", m.visualViewport],
        ["screen", m.screen],
        ["devicePixelRatio", String(m.devicePixelRatio)],
        ["100vh", `${m.heights.vh}px`],
        ["100dvh", `${m.heights.dvh}px`],
        ["100svh", `${m.heights.svh}px`],
        ["100lvh", `${m.heights.lvh}px`],
        ["orientación", m.orientation],
        ["display-mode standalone", String(m.displayModeStandalone)],
        ["navigator.standalone (iOS)", m.navigatorStandalone],
        ["medido", m.measuredAt],
      ]
    : [];

  return (
    <>
      {/* Medidores ocultos: fixed, invisibles y sin ancho, para no generar scroll. */}
      <div
        ref={insetRef}
        aria-hidden="true"
        className="invisible pointer-events-none fixed left-0 top-0 h-0 w-0 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]"
      />
      <div ref={vhRef} aria-hidden="true" className="invisible pointer-events-none fixed left-0 top-0 w-0 h-[100vh]" />
      <div ref={dvhRef} aria-hidden="true" className="invisible pointer-events-none fixed left-0 top-0 w-0 h-[100dvh]" />
      <div ref={svhRef} aria-hidden="true" className="invisible pointer-events-none fixed left-0 top-0 w-0 h-[100svh]" />
      <div ref={lvhRef} aria-hidden="true" className="invisible pointer-events-none fixed left-0 top-0 w-0 h-[100lvh]" />

      {/* Franjas: cada zona segura dibujada en su borde, con su ancho/alto exacto. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[9000] h-[env(safe-area-inset-top)] bg-error/40" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-[9000] h-[env(safe-area-inset-bottom)] bg-success/40" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 left-0 z-[9000] w-[env(safe-area-inset-left)] bg-terracota/40" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 right-0 z-[9000] w-[env(safe-area-inset-right)] bg-graphite/40" />

      {/* Etiquetas de las franjas, pegadas al borde interior de cada zona. */}
      {m && (
        <>
          <span className="pointer-events-none fixed left-1/2 top-[env(safe-area-inset-top)] z-[9001] -translate-x-1/2 rounded-sm bg-error px-2 py-0.5 font-sans text-base text-paper">
            top {m.insets.top}px
          </span>
          <span className="pointer-events-none fixed bottom-[env(safe-area-inset-bottom)] left-1/2 z-[9001] -translate-x-1/2 rounded-sm bg-success px-2 py-0.5 font-sans text-base text-paper">
            bottom {m.insets.bottom}px
          </span>
          <span className="pointer-events-none fixed left-[env(safe-area-inset-left)] top-1/2 z-[9001] rounded-sm bg-terracota px-2 py-0.5 font-sans text-base text-paper">
            left {m.insets.left}px
          </span>
          <span className="pointer-events-none fixed right-[env(safe-area-inset-right)] top-1/2 z-[9001] translate-y-10 rounded-sm bg-graphite px-2 py-0.5 font-sans text-base text-paper">
            right {m.insets.right}px
          </span>
        </>
      )}

      {m === null ? (
        <p className="font-sans text-base text-graphite">Midiendo…</p>
      ) : (
        <div className="space-y-4">
          <dl className="divide-y divide-stone rounded-lg border border-stone bg-white">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                <dt className="font-sans text-base text-graphite">{label}</dt>
                <dd className="font-sans text-lg font-semibold tabular-nums text-black">{value}</dd>
              </div>
            ))}
            <div className="px-4 py-3">
              <dt className="font-sans text-base text-graphite">userAgent</dt>
              <dd className="mt-1 break-all font-mono text-base text-black">{m.userAgent}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={copyAll}
            className="inline-flex h-11 items-center rounded-md bg-terracota px-4 font-sans text-base font-medium text-paper"
          >
            {copyState === "copied" ? "Copiado" : "Copiar todo"}
          </button>

          {copyState === "manual" && (
            <div className="space-y-2">
              <p className="font-sans text-base text-graphite">
                No se pudo copiar solo. Seleccioná el texto y copialo a mano:
              </p>
              <textarea
                readOnly
                value={toText(m)}
                rows={17}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-md border border-stone bg-white p-3 font-mono text-base text-black"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
