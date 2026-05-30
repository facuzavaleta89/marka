"use client";

import { useRef, useState } from "react";
import { ImageOff, X, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PropertyImage } from "@/types";

interface ImageUploaderProps {
  propertyId: string;
  agentId: string;
  existingImages: PropertyImage[];
  onChange: (images: PropertyImage[]) => void;
}

const MAX_IMAGES = 10;
const BUCKET = "property-images";

function extractStoragePath(url: string): string {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : url;
}

export function ImageUploader({
  propertyId,
  agentId,
  existingImages,
  onChange,
}: ImageUploaderProps) {
  const [images, setImages] = useState<PropertyImage[]>(existingImages);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draggingFileOver, setDraggingFileOver] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncImages = (updated: PropertyImage[]) => {
    setImages(updated);
    onChange(updated);
  };

  // ── Upload de archivos ────────────────────────────────────────

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (fileArr.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;

    setUploading(true);
    setUploadError(null);

    const supabase = createClient();
    const newImages: PropertyImage[] = [];

    for (const file of fileArr.slice(0, remaining)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const path = `${agentId}/${propertyId}/${filename}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false });

      if (error) {
        setUploadError(`No se pudo subir "${file.name}"`);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      newImages.push({
        id: crypto.randomUUID(),
        property_id: propertyId,
        url: publicUrl,
        is_cover: images.length + newImages.length === 0,
        sort_order: images.length + newImages.length,
        created_at: new Date().toISOString(),
      });
    }

    const updated = [...images, ...newImages].map((img, i) => ({
      ...img,
      sort_order: i,
      is_cover: i === 0,
    }));

    syncImages(updated);
    setUploading(false);
  };

  // ── Eliminar imagen ───────────────────────────────────────────

  const handleRemove = async (index: number) => {
    const image = images[index];
    const path = extractStoragePath(image.url);

    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([path]);

    const updated = images
      .filter((_, i) => i !== index)
      .map((img, i) => ({ ...img, sort_order: i, is_cover: i === 0 }));

    syncImages(updated);
  };

  // ── Reordenar por drag & drop ─────────────────────────────────

  const handleImageDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    e.dataTransfer.setData("text/plain", String(index));
    setDraggingIndex(index);
  };

  const handleImageDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number
  ) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const reordered = [...images];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const updated = reordered.map((img, i) => ({
      ...img,
      sort_order: i,
      is_cover: i === 0,
    }));

    syncImages(updated);
    setDraggingIndex(null);
  };

  // ── Drop zone para archivos ───────────────────────────────────

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingFileOver(false);
    if (e.dataTransfer.files?.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const atLimit = images.length >= MAX_IMAGES;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!atLimit ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDraggingFileOver(true); }}
          onDragLeave={() => setDraggingFileOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            "flex flex-col items-center justify-center gap-2 h-32 rounded-md border-2 border-dashed cursor-pointer transition-colors",
            draggingFileOver
              ? "border-terracota bg-terracota-subtle"
              : "border-stone hover:border-graphite",
            uploading ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          <Upload size={20} className="text-graphite" />
          <p className="font-sans text-sm text-graphite text-center px-4">
            {uploading
              ? "Subiendo..."
              : "Arrastrá imágenes acá o hacé click para seleccionar"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
        </div>
      ) : (
        <p className="font-sans text-sm text-graphite bg-mist rounded-md px-4 py-3 text-center">
          Límite de {MAX_IMAGES} imágenes alcanzado
        </p>
      )}

      {uploadError && (
        <p className="font-sans text-xs text-error">{uploadError}</p>
      )}

      {/* Grilla de thumbnails */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div
              key={img.id}
              draggable
              onDragStart={(e) => handleImageDragStart(e, i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleImageDrop(e, i)}
              onDragEnd={() => setDraggingIndex(null)}
              className={[
                "relative rounded-md overflow-hidden aspect-square cursor-grab active:cursor-grabbing border",
                draggingIndex === i
                  ? "border-terracota opacity-60 scale-95"
                  : "border-stone",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Imagen ${i + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Badge portada */}
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 font-sans text-[10px] font-semibold uppercase tracking-wide bg-terracota text-paper rounded-sm px-1.5 py-0.5">
                  Portada
                </span>
              )}

              {/* Botón eliminar */}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
                aria-label="Eliminar imagen"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="flex items-center justify-center h-16 rounded-md bg-mist border border-stone">
          <ImageOff size={20} className="text-stone mr-2" />
          <span className="font-sans text-sm text-graphite">
            Sin imágenes
          </span>
        </div>
      )}

      <p className="font-sans text-xs text-graphite">
        {images.length}/{MAX_IMAGES} imágenes · Arrastrá los thumbnails para reordenar
      </p>
    </div>
  );
}
