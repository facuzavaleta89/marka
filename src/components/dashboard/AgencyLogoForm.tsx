"use client";

import { useRef, useState, useTransition } from "react";
import { ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateAgencyLogoAction } from "@/app/(agent)/dashboard/preferencias/actions";

// Tipos aceptados → extensión canónica. La extensión sale del MIME validado, NO
// del nombre del archivo (más robusto que el avatar de ProfileForm, que confía en
// file.name): un .png renombrado a .jpg igual se guarda con la extensión real.
const ACCEPTED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const BUCKET = "property-images";

// Editor del LOGO de la agencia. Solo se renderiza si el user es admin (la página
// lo gatea); la action revalida el rol server-side igual.
// Upload híbrido (mismo patrón que el avatar de ProfileForm): el archivo se sube
// client-side al bucket público; la URL resultante se persiste por server action
// gateada a admin (lo sensible es la escritura en agencies, no el archivo).
export function AgencyLogoForm({
  initialLogoUrl,
  agencyId,
}: {
  initialLogoUrl: string | null;
  agencyId: string;
}) {
  // URL del logo ya guardado que se muestra como "logo actual". Tras reemplazar se
  // le agrega un cache-buster (la URL en la DB queda limpia; ver respuesta.md).
  const [savedUrl, setSavedUrl] = useState<string | null>(initialLogoUrl);
  // Preview optimista del archivo recién elegido (object URL local), antes de subir.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSuccess(false);
    const picked = e.target.files?.[0];
    if (!picked) return;

    // Validación REAL en JS antes de subir (el logo se mostrará público).
    if (!ACCEPTED_TYPES[picked.type]) {
      setFile(null);
      setPreviewUrl(null);
      setError("Formato no permitido. Subí un PNG, JPG o WEBP.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setPreviewUrl(null);
      setError("El archivo supera los 2 MB. Probá con una imagen más liviana.");
      return;
    }

    // Liberar el object URL anterior antes de crear uno nuevo (evita leak).
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!file) {
      setError("Elegí una imagen para subir.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const ext = ACCEPTED_TYPES[file.type]; // garantizado por la validación
      const path = `logos/${agencyId}/logo.${ext}`;

      // 1. Subir el archivo client-side (upsert: pisa el logo anterior).
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true });
      if (uploadError) {
        setError("No se pudo subir el logo. Intentá de nuevo.");
        return;
      }

      // 2. URL pública (limpia, sin cache-buster: así se guarda en la DB).
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      // 3. Persistir la URL en agencies.logo_url (gateado a admin server-side).
      const result = await updateAgencyLogoAction({ logo_url: publicUrl });
      if (result?.error) {
        setError(result.error);
        return;
      }

      // 4. Mostrar el logo nuevo. Cache-buster solo en la preview: el path es fijo
      // (logo.{ext} con upsert), así que la URL pública no cambia y el navegador
      // mostraría el viejo cacheado. El timestamp NO se guarda en la DB.
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSavedUrl(`${publicUrl}?t=${Date.now()}`);
      setPreviewUrl(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess(true);
    });
  }

  // Qué se muestra en el recuadro: el archivo recién elegido (optimista) o el guardado.
  const shownUrl = previewUrl ?? savedUrl;

  return (
    <section className="bg-paper border border-stone rounded-lg p-6 space-y-4">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-black">
          Logo de la agencia
        </h2>
        <p className="font-sans text-xs text-graphite mt-0.5">
          Se usará en tu sitio. PNG, JPG o WEBP · Máx. 2 MB.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Preview del logo actual (o placeholder) */}
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone bg-white">
            {shownUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shownUrl}
                alt="Logo de la agencia"
                className="max-h-16 max-w-[112px] object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-stone">
                <ImageOff size={20} />
                <span className="font-sans text-[11px] text-graphite">
                  Sin logo
                </span>
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="font-sans text-sm font-medium text-terracota hover:text-terracota-hover transition-colors duration-[120ms]"
            >
              {savedUrl ? "Cambiar logo" : "Subir logo"}
            </button>
            <p className="font-sans text-xs text-graphite mt-1">
              JPG, PNG o WEBP · Máx. 2 MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {error && <p className="font-sans text-sm text-error">{error}</p>}
        {success && (
          <p className="font-sans text-sm text-success">Logo actualizado</p>
        )}

        <button
          type="submit"
          disabled={pending || !file}
          className="h-11 px-4 rounded-md font-sans text-sm font-medium bg-terracota hover:bg-terracota-hover text-paper transition-colors duration-[120ms] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Guardando..." : "Guardar logo"}
        </button>
      </form>
    </section>
  );
}
