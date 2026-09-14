"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link2, TriangleAlert } from "lucide-react";
import { updateAgencySlugAction } from "@/app/(agent)/dashboard/preferencias/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/feedback/Notice";
import { agencyUrl, SITE_URL } from "@/lib/utils/siteUrl";
import {
  AGENCY_SLUG_MAX_LENGTH,
  normalizeAgencySlug,
  validateAgencySlug,
} from "@/lib/utils/agencySlug";

// La dirección pública del sitio de marca: `marka.com.ar/{slug}`.
//
// Se renderiza solo para el admin de la agencia (lo gatea la página), igual que
// el teléfono, el logo y la identidad. ⚠ Eso es cosmético: la regla real la
// aplica `updateAgencySlugAction` en el server, que revalida rol, forma, lista
// negra y unicidad sobre el valor que efectivamente llega.
//
// ══════════════════════════════════════════════════════════════
// POR QUÉ SON DOS PASOS Y NO UN BOTÓN "GUARDAR"
// ══════════════════════════════════════════════════════════════
//
// Cambiar la dirección ROMPE todos los enlaces que la agencia ya repartió, y no
// hay vuelta atrás automática (no se guarda historial ni se redirige). Es la
// única acción de esta pantalla con una consecuencia que la persona no puede
// deshacer desde acá, así que no puede ocurrir de un solo click distraído.
//
// El criterio del proyecto es que la agencia es dueña de la decisión SI LA
// ENTIENDE: por eso el panel de confirmación muestra las DOS direcciones
// completas —no el fragmento— y dice con todas las letras qué deja de funcionar.
//
// ⚠ ES UN PANEL INLINE Y NO UN AlertDialog, por el precedente ya documentado en
// DESIGN §12: el botón de acción del diálogo CIERRA al hacer click, así que un
// error devuelto por la action —la dirección tomada por otra agencia entre la
// verificación y la escritura— no tendría dónde mostrarse. Los sí/no puros van
// en diálogo; los que piden escribir algo, inline.

const schema = z.object({
  // Normaliza ANTES de validar, mismo molde que la matrícula: la persona escribe
  // como le sale ("Inmobiliaria López") y el sistema se encarga de la forma.
  // No hay sorpresa posible porque la vista previa muestra, en vivo, exactamente
  // lo que se va a guardar.
  slug: z
    .string()
    .transform(normalizeAgencySlug)
    // MISMA función que usa la server action: un solo criterio, dos capas. Si el
    // día de mañana se agrega una palabra a la lista negra o cambia el largo
    // máximo, el formulario y el servidor no pueden quedar diciendo cosas
    // distintas.
    .superRefine((value, ctx) => {
      const result = validateAgencySlug(value);
      if (!result.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
      }
    }),
});

type Values = z.infer<typeof schema>;

export function AgencySlugForm({ initialSlug }: { initialSlug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Dirección validada esperando confirmación. Mientras no sea null, la pantalla
  // muestra el panel de aviso en vez del botón de cambiar.
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  // La que rige. Se actualiza al guardar para que la pantalla no quede mostrando
  // la vieja como "dirección actual" hasta que Next revalide.
  const [currentSlug, setCurrentSlug] = useState(initialSlug);
  const [pending, startTransition] = useTransition();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { slug: initialSlug },
  });

  // Paso 1: validar y pedir confirmación. NO guarda nada todavía.
  function onSubmit(values: Values) {
    setError(null);
    setSuccess(null);

    // Sin cambios: no tiene sentido advertir sobre romper enlaces para dejar
    // todo igual. Se corta acá, antes del aviso.
    if (values.slug === currentSlug) {
      setError("Esa ya es la dirección de tu sitio.");
      return;
    }

    setPendingSlug(values.slug);
  }

  // Paso 2: la persona confirmó. Recién acá se escribe.
  function confirmChange() {
    const slug = pendingSlug;
    if (!slug) return;

    setError(null);
    startTransition(async () => {
      const result = await updateAgencySlugAction({ slug });

      if ("error" in result) {
        // El panel NO se cierra ante un error: el aviso tiene que seguir a la
        // vista junto al mensaje, para que se entienda a qué se refiere.
        setError(result.error);
        return;
      }

      setCurrentSlug(result.slug);
      setPendingSlug(null);
      form.reset({ slug: result.slug });
      setSuccess("Listo. Tu sitio ya está en la dirección nueva.");
    });
  }

  function cancelChange() {
    setPendingSlug(null);
    setError(null);
    form.reset({ slug: currentSlug });
  }

  return (
    <section className="bg-paper border border-stone rounded-lg p-6 space-y-4">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-black">
          Dirección de tu sitio
        </h2>
        <p className="font-sans text-xs text-graphite mt-0.5">
          La dirección web donde se ve tu inmobiliaria con tus propiedades.
          Podés cambiarla las veces que quieras.
        </p>
      </div>

      {/* Dirección que rige, COMPLETA y clickeable. Hasta ahora la agencia no
          tenía ninguna pantalla donde leer su propia dirección. */}
      <div className="rounded-md border border-stone bg-mist px-4 py-3">
        <p className="font-sans text-xs font-medium text-graphite">
          Tu dirección actual
        </p>
        <a
          href={agencyUrl(currentSlug)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 font-sans text-sm font-medium text-black hover:text-terracota transition-colors duration-[120ms]"
        >
          <Link2 size={14} className="shrink-0" />
          <span className="break-all">{agencyUrl(currentSlug)}</span>
        </a>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="agency_slug"
            className="font-sans text-sm font-medium text-black"
          >
            Dirección nueva
          </Label>

          {/* ⚠ Controller y NO watch(): hace falta el valor en vivo para la vista
              previa, y `watch()` de react-hook-form dispara el warning
              react-hooks/incompatible-library del React Compiler — el proyecto
              ya carga uno conocido y cualquier otro es una regresión
              (CLAUDE.md → ESLint). Con Controller el valor llega por props. */}
          <Controller
            control={form.control}
            name="slug"
            render={({ field }) => {
              const preview = normalizeAgencySlug(field.value ?? "");
              return (
                <>
                  <div className="flex items-center rounded-md border border-stone bg-white focus-within:ring-2 focus-within:ring-terracota focus-within:ring-offset-1">
                    {/* El dominio a la izquierda, fijo: deja claro que lo que se
                        escribe es el final de una dirección, no un nombre. */}
                    <span className="pl-3 font-sans text-sm text-stone select-none whitespace-nowrap">
                      {SITE_URL.replace(/^https?:\/\//, "")}/
                    </span>
                    <Input
                      id="agency_slug"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      disabled={pending || pendingSlug !== null}
                      maxLength={AGENCY_SLUG_MAX_LENGTH * 2}
                      placeholder="inmobiliaria-lopez"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="border-0 bg-transparent pl-0 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  {/* Vista previa: la dirección COMPLETA que va a quedar, no el
                      fragmento. Solo aparece si lo escrito se normaliza a algo
                      distinto de lo tipeado, que es cuando el resultado podría
                      sorprender. */}
                  {preview !== (field.value ?? "") && preview.length > 0 && (
                    <p className="font-sans text-xs text-graphite">
                      Va a quedar como{" "}
                      <span className="font-medium text-black break-all">
                        {agencyUrl(preview)}
                      </span>
                    </p>
                  )}
                </>
              );
            }}
          />

          <p className="font-sans text-xs text-graphite">
            Letras minúsculas, números y guiones. Hasta{" "}
            {AGENCY_SLUG_MAX_LENGTH} caracteres.
          </p>

          {form.formState.errors.slug && (
            <p className="font-sans text-xs text-error">
              {form.formState.errors.slug.message}
            </p>
          )}
        </div>

        {/* ── Paso 2: el aviso ────────────────────────────────── */}
        {pendingSlug !== null && (
          <div className="space-y-3">
            <Notice
              tone="warning"
              title="Los enlaces que ya compartiste van a dejar de funcionar"
              icon={<TriangleAlert size={18} />}
            >
              <span className="block">
                Tu sitio pasa a estar en{" "}
                <span className="font-medium text-black break-all">
                  {agencyUrl(pendingSlug)}
                </span>
                . La dirección anterior,{" "}
                <span className="font-medium text-black break-all">
                  {agencyUrl(currentSlug)}
                </span>
                , deja de funcionar apenas confirmes: quien la abra va a ver una
                página inexistente.
              </span>
              <span className="mt-1.5 block">
                Eso alcanza a todos los enlaces que hayas repartido: los que
                mandaste por WhatsApp, los de tus redes, tu firma de mail,
                carteles y folletos impresos. No se redirigen solos a la
                dirección nueva.
              </span>
              <span className="mt-1.5 block">
                Tus propiedades, tus fotos y tus consultas no se tocan: lo único
                que cambia es la dirección.
              </span>
            </Notice>

            {error && <p className="font-sans text-sm text-error">{error}</p>}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={confirmChange}
                disabled={pending}
                className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pending ? "Cambiando..." : "Sí, cambiar la dirección"}
              </button>
              <button
                type="button"
                onClick={cancelChange}
                disabled={pending}
                className="h-11 px-4 rounded-md font-sans text-sm font-medium text-graphite hover:text-black transition-colors duration-[120ms] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 1: pedir el cambio ─────────────────────────── */}
        {pendingSlug === null && (
          <>
            {error && <p className="font-sans text-sm text-error">{error}</p>}
            {success && (
              <p className="font-sans text-sm text-success">{success}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="h-11 px-4 rounded-md font-sans text-sm font-medium border border-stone text-black hover:bg-mist hover:border-graphite transition-colors duration-[120ms] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cambiar la dirección
            </button>
          </>
        )}
      </form>
    </section>
  );
}
