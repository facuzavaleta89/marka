"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "./ImageUploader";
import {
  createPropertyAction,
  updatePropertyAction,
} from "@/app/(agent)/dashboard/propiedades/actions";
import { cn } from "@/lib/utils";
import { AMENITY_LABELS } from "@/lib/utils/labels";
import type { Property, PropertyImage, Amenity } from "@/types";

// LocationPicker cargado solo en el cliente (Leaflet usa window)
const LocationPicker = dynamic(() => import("./LocationPicker"), { ssr: false });

// ─── Constantes ───────────────────────────────────────────────

const ALL_AMENITIES = Object.keys(AMENITY_LABELS) as Amenity[];

// Clases de override para los shadcn inputs (este proyecto usa estilo "línea")
const FIELD =
  "rounded-md border border-stone border-b-stone bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/20 focus-visible:ring-offset-1 focus-visible:border-graphite focus-visible:border-b-graphite";
const FIELD_ERR = "border-error border-b-error";

// ─── Zod schema ───────────────────────────────────────────────

const optNum = (positive = false) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    positive
      ? z.number().positive().nullable()
      : z.number().min(0).nullable()
  );

const schema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional(),
  property_type: z.enum([
    "casa", "departamento", "terreno", "local",
    "oficina", "campo", "cochera",
  ], { message: "Seleccioná el tipo de propiedad" }),
  operation_type: z.enum(["venta", "alquiler", "alquiler_temporal"], {
    message: "Seleccioná el tipo de operación",
  }),
  status: z.enum(["active", "paused", "sold", "rented"]).optional(),
  price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  currency: z.enum(["USD", "ARS"]),
  price_negotiable: z.boolean().default(false),
  area_total_m2: optNum(true),
  area_covered_m2: optNum(true),
  bedrooms: z.coerce.number().min(0).default(0),
  bathrooms: z.coerce.number().min(0).default(0),
  parking_spots: z.coerce.number().min(0).default(0),
  floor_number: optNum(),
  address: z.string().min(1, "La dirección es requerida"),
  neighborhood: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  amenities: z.array(z.string()).default([]),
  year_built: optNum(),
  is_featured: z.boolean().default(false),
  // Agente al que se asigna la propiedad (solo lo usa el admin de agencia). El
  // server valida que pertenezca a la agencia antes de aplicarlo.
  assigned_agent_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────

interface PropertyFormProps {
  mode: "create" | "edit";
  initialData?: Property;
  agentId: string;
  agencyId: string;
  cityId: string;
  cityCenter: { lat: number; lng: number };
  // Agentes de la agencia para el selector "Agente asignado". Solo lo pasa la
  // página cuando el user es admin de agencia; si no viene, el campo no se
  // muestra (un agente normal no reasigna). La validación de pertenencia a la
  // agencia es server-side en las actions; esto es solo la UI.
  agencyAgents?: { id: string; full_name: string }[];
}

// ─── Sub-componentes ──────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite whitespace-nowrap">
          {title}
        </span>
        <div className="flex-1 h-px bg-stone" />
      </div>
      {children}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="font-sans text-sm font-medium text-black">{label}</Label>
      {children}
      {error && <p className="font-sans text-xs text-error">{error}</p>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────

export function PropertyForm({
  mode,
  initialData,
  agentId,
  cityCenter,
  agencyAgents,
}: PropertyFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // En edición el pin ya tiene una ubicación real; en alta hay que colocarlo.
  const [pinMoved, setPinMoved] = useState(mode === "edit");
  const [pinError, setPinError] = useState(false);

  // UUID estable para el modo creación — permite subir imágenes antes de guardar
  const propertyId = useMemo(
    () => (mode === "create" ? crypto.randomUUID() : initialData!.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [images, setImages] = useState<PropertyImage[]>(
    initialData?.images ?? []
  );

  const defaultValues: Partial<FormValues> =
    mode === "edit" && initialData
      ? {
          title: initialData.title,
          description: initialData.description ?? "",
          property_type: initialData.property_type,
          operation_type: initialData.operation_type,
          status: initialData.status,
          price: initialData.price,
          currency: initialData.currency,
          price_negotiable: initialData.price_negotiable,
          area_total_m2: initialData.area_total_m2,
          area_covered_m2: initialData.area_covered_m2,
          bedrooms: initialData.bedrooms,
          bathrooms: initialData.bathrooms,
          parking_spots: initialData.parking_spots,
          floor_number: initialData.floor_number,
          address: initialData.address,
          neighborhood: initialData.neighborhood ?? "",
          lat: initialData.lat,
          lng: initialData.lng,
          amenities: initialData.amenities,
          year_built: initialData.year_built,
          is_featured: initialData.is_featured,
          // En edición, el agente actual de la propiedad.
          assigned_agent_id: initialData.agent_id,
        }
      : {
          property_type: "casa",
          operation_type: "venta",
          status: "active",
          currency: "USD",
          price_negotiable: false,
          bedrooms: 0,
          bathrooms: 0,
          parking_spots: 0,
          amenities: [],
          lat: cityCenter.lat,
          lng: cityCenter.lng,
          is_featured: false,
          // En alta, por defecto el propio admin que crea (o el agente normal).
          assigned_agent_id: agentId,
        };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    // Cast necesario: z.coerce en Zod v4 produce tipos de entrada 'unknown'
    // que no unifican con el Resolver genérico de react-hook-form
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues,
  });

  const currency = watch("currency");
  const selectedAmenities = (watch("amenities") ?? []) as string[];
  const lat = watch("lat");
  const lng = watch("lng");

  const toggleAmenity = (amenity: string) => {
    const next = selectedAmenities.includes(amenity)
      ? selectedAmenities.filter((a) => a !== amenity)
      : [...selectedAmenities, amenity];
    setValue("amenities", next);
  };

  const onSubmit = async (data: FormValues) => {
    // El agente debe colocar el pin en el mapa (no dejar el centro de la ciudad)
    if (!pinMoved) {
      setPinError(true);
      return;
    }

    setSubmitting(true);
    setServerError(null);

    const imagePayload = images.map((img, i) => ({
      id: img.id,
      url: img.url,
      sort_order: i,
      is_cover: i === 0,
    }));

    if (mode === "create") {
      const result = await createPropertyAction({
        id: propertyId,
        title: data.title,
        description: data.description ?? null,
        property_type: data.property_type,
        operation_type: data.operation_type,
        price: data.price,
        currency: data.currency,
        price_negotiable: data.price_negotiable,
        area_total_m2: data.area_total_m2 ?? null,
        area_covered_m2: data.area_covered_m2 ?? null,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        parking_spots: data.parking_spots,
        floor_number: data.floor_number ?? null,
        address: data.address,
        neighborhood: data.neighborhood ?? null,
        lat: data.lat,
        lng: data.lng,
        amenities: data.amenities as Amenity[],
        year_built: data.year_built ?? null,
        is_featured: data.is_featured,
        assigned_agent_id: data.assigned_agent_id,
        images: imagePayload,
      });

      if (result?.error) {
        setServerError(result.error);
        setSubmitting(false);
        return;
      }
    } else {
      const result = await updatePropertyAction(initialData!.id, {
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? initialData!.status,
        property_type: data.property_type,
        operation_type: data.operation_type,
        price: data.price,
        currency: data.currency,
        price_negotiable: data.price_negotiable,
        area_total_m2: data.area_total_m2 ?? null,
        area_covered_m2: data.area_covered_m2 ?? null,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        parking_spots: data.parking_spots,
        floor_number: data.floor_number ?? null,
        address: data.address,
        neighborhood: data.neighborhood ?? null,
        lat: data.lat,
        lng: data.lng,
        amenities: data.amenities as Amenity[],
        year_built: data.year_built ?? null,
        is_featured: data.is_featured,
        assigned_agent_id: data.assigned_agent_id,
        images: imagePayload,
      });

      if (result?.error) {
        setServerError(result.error);
        setSubmitting(false);
        return;
      }
    }

    router.push("/dashboard/propiedades");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10" noValidate>
      {/* ── Identificación ── */}
      <Section title="Identificación">
        <Field label="Título" error={errors.title?.message} className="col-span-full">
          <Input
            {...register("title")}
            placeholder="Casa 3 ambientes en el centro"
            className={cn(FIELD, errors.title && FIELD_ERR)}
          />
        </Field>

        <Field label="Descripción" className="col-span-full">
          <Textarea
            {...register("description")}
            placeholder="Describí la propiedad con detalle..."
            rows={4}
            className={cn(FIELD, "min-h-[96px] resize-y py-2")}
          />
        </Field>

        <FieldRow>
          <Field label="Tipo de propiedad" error={errors.property_type?.message}>
            <Controller
              name="property_type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(FIELD, "w-full", errors.property_type && FIELD_ERR)}>
                    <SelectValue placeholder="Seleccioná" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ["casa", "Casa"],
                      ["departamento", "Departamento"],
                      ["terreno", "Terreno"],
                      ["local", "Local"],
                      ["oficina", "Oficina"],
                      ["campo", "Campo"],
                      ["cochera", "Cochera"],
                    ].map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Tipo de operación" error={errors.operation_type?.message}>
            <Controller
              name="operation_type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(FIELD, "w-full", errors.operation_type && FIELD_ERR)}>
                    <SelectValue placeholder="Seleccioná" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="alquiler">Alquiler</SelectItem>
                    <SelectItem value="alquiler_temporal">Alquiler temporal</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </FieldRow>

        {/* Estado — solo en modo edit */}
        {mode === "edit" && (
          <Field label="Estado" error={errors.status?.message} className="sm:w-1/2">
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(FIELD, "w-full")}>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="sold">Vendida</SelectItem>
                    <SelectItem value="rented">Alquilada</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}

        {/* Agente asignado — solo para el admin de agencia (agencyAgents viene
            del server cuando el user es admin). El agente normal no lo ve. */}
        {agencyAgents && (
          <Field label="Agente asignado" className="sm:w-1/2">
            <Controller
              name="assigned_agent_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(FIELD, "w-full")}>
                    <SelectValue placeholder="Seleccioná un agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencyAgents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}
      </Section>

      {/* ── Precio ── */}
      <Section title="Precio">
        <FieldRow>
          <Field label="Precio" error={errors.price?.message}>
            <Input
              {...register("price")}
              type="text"
              inputMode="numeric"
              placeholder={currency === "USD" ? "250000" : "15000000"}
              className={cn(FIELD, errors.price && FIELD_ERR)}
            />
          </Field>

          <Field label="Moneda">
            <div className="flex h-10 rounded-md border border-stone overflow-hidden">
              {(["USD", "ARS"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue("currency", c)}
                  className={cn(
                    "flex-1 font-sans text-sm font-medium transition-colors",
                    currency === c
                      ? "bg-terracota text-paper"
                      : "bg-white text-graphite hover:bg-mist"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
        </FieldRow>

        <div className="flex items-center gap-2">
          <Controller
            name="price_negotiable"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="price_negotiable"
                checked={field.value}
                onCheckedChange={field.onChange}
                className="data-[state=checked]:bg-terracota data-[state=checked]:border-terracota"
              />
            )}
          />
          <Label
            htmlFor="price_negotiable"
            className="font-sans text-sm text-black cursor-pointer"
          >
            Precio negociable
          </Label>
        </div>
      </Section>

      {/* ── Superficie y ambientes ── */}
      <Section title="Superficie y ambientes">
        <FieldRow>
          <Field label="Área total m²">
            <Input
              {...register("area_total_m2")}
              type="text"
              inputMode="numeric"
              placeholder="150"
              className={FIELD}
            />
          </Field>
          <Field label="Área cubierta m²">
            <Input
              {...register("area_covered_m2")}
              type="text"
              inputMode="numeric"
              placeholder="120"
              className={FIELD}
            />
          </Field>
        </FieldRow>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(
            [
              ["bedrooms", "Dormitorios", errors.bedrooms],
              ["bathrooms", "Baños", errors.bathrooms],
              ["parking_spots", "Cocheras", errors.parking_spots],
              ["floor_number", "Piso", errors.floor_number],
            ] as const
          ).map(([name, label, err]) => (
            <Field key={name} label={label} error={err?.message}>
              <Input
                {...register(name)}
                type="text"
                inputMode="numeric"
                placeholder="0"
                className={cn(FIELD, err && FIELD_ERR)}
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* ── Ubicación ── */}
      <Section title="Ubicación">
        <FieldRow>
          <Field label="Dirección" error={errors.address?.message} className="sm:col-span-2">
            <Input
              {...register("address")}
              placeholder="Av. Belgrano 1234"
              className={cn(FIELD, errors.address && FIELD_ERR)}
            />
          </Field>
          <Field label="Barrio">
            <Input
              {...register("neighborhood")}
              placeholder="Centro"
              className={FIELD}
            />
          </Field>
        </FieldRow>

        <LocationPicker
          value={{ lat, lng }}
          onChange={({ lat: newLat, lng: newLng }) => {
            setValue("lat", newLat);
            setValue("lng", newLng);
          }}
          cityCenter={cityCenter}
          error={pinError}
          onMoved={() => {
            setPinMoved(true);
            setPinError(false);
          }}
        />
        {pinError && (
          <p className="font-sans text-xs text-error">
            Arrastrá el pin hasta la ubicación exacta del inmueble
          </p>
        )}
      </Section>

      {/* ── Amenities ── */}
      <Section title="Amenities">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ALL_AMENITIES.map((amenity) => (
            <div key={amenity} className="flex items-center gap-2">
              <Checkbox
                id={`amenity-${amenity}`}
                checked={selectedAmenities.includes(amenity)}
                onCheckedChange={() => toggleAmenity(amenity)}
                className="data-[state=checked]:bg-terracota data-[state=checked]:border-terracota"
              />
              <Label
                htmlFor={`amenity-${amenity}`}
                className="font-sans text-sm text-black cursor-pointer"
              >
                {AMENITY_LABELS[amenity]}
              </Label>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Imágenes ── */}
      <Section title="Imágenes">
        <ImageUploader
          propertyId={propertyId}
          agentId={agentId}
          existingImages={images}
          onChange={setImages}
        />
      </Section>

      {/* ── Extras ── */}
      <Section title="Extras">
        <FieldRow>
          <Field label="Año de construcción">
            <Input
              {...register("year_built")}
              type="text"
              inputMode="numeric"
              placeholder="2005"
              className={FIELD}
            />
          </Field>
        </FieldRow>

        <div className="flex items-center gap-2">
          <Controller
            name="is_featured"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="is_featured"
                checked={field.value}
                onCheckedChange={field.onChange}
                className="data-[state=checked]:bg-terracota data-[state=checked]:border-terracota"
              />
            )}
          />
          <Label
            htmlFor="is_featured"
            className="font-sans text-sm text-black cursor-pointer"
          >
            Marcar como destacada
          </Label>
        </div>
      </Section>

      {/* ── Error del servidor ── */}
      {serverError && (
        <p className="font-sans text-sm text-error bg-terracota-subtle rounded-md px-4 py-3">
          {serverError}
        </p>
      )}

      {/* ── Barra de acción sticky ──
          Siempre visible al pie mientras se scrollea el form (7 secciones).
          Sangra hasta los bordes del contenedor (-mx-8) y respeta el safe-area. */}
      <div
        className="sticky bottom-0 -mx-4 sm:-mx-8 mt-2 border-t border-stone bg-mist/85 backdrop-blur-sm px-4 sm:px-8 pt-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center h-11 px-8 font-sans text-sm font-medium text-paper bg-terracota hover:bg-terracota-hover rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Guardando..."
              : mode === "create"
              ? "Publicar propiedad"
              : "Guardar cambios"}
          </button>
        </div>
      </div>
    </form>
  );
}
