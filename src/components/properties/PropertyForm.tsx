"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { useForm, Controller, type Control, type Resolver } from "react-hook-form";
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
import { AddressSearchButton } from "./AddressSearchButton";
import {
  createPropertyAction,
  updatePropertyAction,
} from "@/app/(agent)/dashboard/propiedades/actions";
import { cn } from "@/lib/utils";
import { AMENITY_LABELS, RENT_REQUIREMENT_LABELS } from "@/lib/utils/labels";
import { roundCoords, type Coords } from "@/lib/utils/coords";
import type { LocationChangeCause } from "./LocationPicker";
import {
  RENT_REQUIREMENTS_OTHER_MAX,
  RENT_REQUIREMENT_OTHER_MAX_LEN,
} from "@/types";
import type {
  Property,
  PropertyImage,
  Amenity,
  RentRequirement,
  LocationSource,
} from "@/types";

// LocationPicker cargado solo en el cliente (Leaflet usa window)
const LocationPicker = dynamic(() => import("./LocationPicker"), { ssr: false });

// ─── Constantes ───────────────────────────────────────────────

const ALL_AMENITIES = Object.keys(AMENITY_LABELS) as Amenity[];

// Lista cerrada de requisitos, en el orden en que se le muestran al agente.
const ALL_RENT_REQUIREMENTS = Object.keys(
  RENT_REQUIREMENT_LABELS
) as RentRequirement[];

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

const currencyField = z.enum(["USD", "ARS"]).nullable().default(null);

const baseSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional(),
  property_type: z.enum([
    "casa", "departamento", "terreno", "local",
    "oficina", "campo", "cochera",
  ], { message: "Seleccioná el tipo de propiedad" }),
  status: z.enum(["active", "paused", "sold", "rented"]).optional(),
  // ─── Operaciones y precios ───
  // Tres operaciones independientes, cada una con su par precio + moneda. El
  // precio es OPCIONAL a propósito: vacío significa "a convenir", que es una
  // elección de la agencia (no publicar el precio en un mapa) y no un dato
  // faltante. Los precios usan optNum(true) — el mismo preprocesado del resto
  // de los numéricos opcionales: "" o null → null, y si hay valor tiene que ser
  // positivo.
  for_sale: z.boolean().default(false),
  sale_price: optNum(true),
  sale_currency: currencyField,
  for_rent: z.boolean().default(false),
  rent_price: optNum(true),
  rent_currency: currencyField,
  for_temp_rent: z.boolean().default(false),
  temp_rent_price: optNum(true),
  temp_rent_currency: currencyField,
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
  // Requisitos para alquilar. A diferencia de `amenities` (que es
  // z.array(z.string()) y no valida nada), acá se valida contra la LISTA
  // CERRADA. Igual la barrera que cuenta es el filtrado server-side de la
  // action: este zod corre en el cliente y no protege de un cliente manipulado.
  rent_requirements: z
    .array(z.enum(ALL_RENT_REQUIREMENTS as [RentRequirement, ...RentRequirement[]]))
    .default([]),
  // Requisitos libres: lista, no texto. Lo que valida el zod es la FORMA (hasta
  // 5 strings de hasta 300 caracteres); el contenido lo controla la interfaz al
  // agregar, y la barrera real es el filtrado server-side de la action.
  rent_requirements_other: z
    .array(z.string().max(RENT_REQUIREMENT_OTHER_MAX_LEN))
    .max(RENT_REQUIREMENTS_OTHER_MAX)
    .default([]),
  year_built: optNum(),
  is_featured: z.boolean().default(false),
  // Agente al que se asigna la propiedad (solo lo usa el admin de agencia). El
  // server valida que pertenezca a la agencia antes de aplicarlo.
  assigned_agent_id: z.string().optional(),
});

// Las tres operaciones, con los nombres de sus campos. Se usa para validar y
// para renderizar: agregar una operación es agregar una entrada acá.
const OPERATIONS = [
  {
    flag: "for_sale",
    price: "sale_price",
    currency: "sale_currency",
    label: "Venta",
  },
  {
    flag: "for_rent",
    price: "rent_price",
    currency: "rent_currency",
    label: "Alquiler",
  },
  {
    flag: "for_temp_rent",
    price: "temp_rent_price",
    currency: "temp_rent_currency",
    label: "Alquiler temporal",
  },
] as const;

// Replica en el formulario lo que los CHECK de la base ya exigen. La base sigue
// siendo la fuente de verdad; esto existe para que el agente vea el problema
// antes de mandar el formulario, no para reemplazarla.
const schema = baseSchema
  .superRefine((data, ctx) => {
    // (1) Al menos una operación. El error se cuelga de for_sale para que se
    // muestre debajo del grupo de checkboxes.
    if (!data.for_sale && !data.for_rent && !data.for_temp_rent) {
      ctx.addIssue({
        code: "custom",
        path: ["for_sale"],
        message: "Marcá al menos una operación (venta, alquiler o temporal).",
      });
    }
    // (2) Si hay precio, tiene que haber moneda — solo se mira en las
    // operaciones MARCADAS: en las apagadas el transform de abajo manda los dos
    // campos a null y lo que haya quedado escrito no importa.
    for (const op of OPERATIONS) {
      if (!data[op.flag]) continue;
      if (data[op.price] != null && data[op.currency] == null) {
        ctx.addIssue({
          code: "custom",
          path: [op.currency],
          message: "Elegí la moneda del precio.",
        });
      }
    }
  })
  // (3) Normalización del par precio/moneda, en DOS reglas:
  //
  //   a. Operación apagada → precio y moneda en null. Lo exige la base (CHECK
  //      properties_<op>_operation) y evita mandar un precio de alquiler
  //      colgado de una propiedad que solo está en venta porque el agente lo
  //      tipeó y después desmarcó la casilla.
  //
  //   b. Operación marcada SIN precio ("a convenir") → la moneda también va en
  //      null. Los botones de moneda siempre tienen una preseleccionada, así
  //      que sin esto se enviaría una moneda sin precio.
  //      La BARRERA de ese par inconsistente es la BASE, no esta línea: los
  //      CHECK properties_sale_price, properties_rent_price y
  //      properties_temp_rent_price rechazan las dos direcciones (moneda sin
  //      precio y precio sin moneda). Esto normaliza ANTES de enviar para que el
  //      agente no se coma un error de la base por algo que la interfaz resuelve
  //      sola: es conveniencia, y por eso se conserva.
  //
  //   c. SIN ninguna operación de alquiler → los requisitos para alquilar se
  //      vacían. Mismo caso que (a) y por el mismo motivo: el agente puede
  //      marcar alquiler, cargar requisitos y después desmarcarlo, y esos
  //      requisitos no pueden viajar en el payload de una propiedad que ahora es
  //      solo venta. La sección desaparece de la pantalla pero los valores
  //      siguen en el formulario, así que sin esto se enviarían igual.
  //      La action repite el corte server-side (resolveRentRequirements): esto
  //      es conveniencia, igual que (b).
  .transform((data) => {
    const pair = (on: boolean, price: number | null, currency: "USD" | "ARS" | null) =>
      on && price != null
        ? { price, currency }
        : { price: on ? price : null, currency: null };

    const sale = pair(data.for_sale, data.sale_price, data.sale_currency);
    const rent = pair(data.for_rent, data.rent_price, data.rent_currency);
    const temp = pair(
      data.for_temp_rent,
      data.temp_rent_price,
      data.temp_rent_currency
    );

    const rents = data.for_rent || data.for_temp_rent;

    return {
      ...data,
      sale_price: sale.price,
      sale_currency: sale.currency,
      rent_price: rent.price,
      rent_currency: rent.currency,
      temp_rent_price: temp.price,
      temp_rent_currency: temp.currency,
      rent_requirements: rents ? data.rent_requirements : [],
      rent_requirements_other: rents ? data.rent_requirements_other : [],
    };
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
  // Requisitos de alquiler con los que ABRIR un alta, tomados de la última
  // propiedad con alquiler de la agencia (la resuelve la página, en el server).
  // Evita que el agente marque las mismas casillas treinta veces mientras sube
  // su cartera.
  //
  // ⚠ Es aditiva y SOLO aplica a mode "create": en edición mandan los valores
  // guardados de la propiedad. Se agregó una prop en vez de mover los defaults
  // del alta al servidor a propósito — eso cambiaría el contrato del componente
  // para los dos modos.
  //
  // Los valores llegan MARCADOS y VISIBLES, y el agente los puede desmarcar
  // antes de guardar: un default invisible que se guarda solo sería peor que no
  // tener precarga.
  initialRentRequirements?: {
    rent_requirements: RentRequirement[];
    rent_requirements_other: string[];
  };
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

// ─── Una operación: casilla + (si está marcada) precio y moneda ───
//
// ⚠ Todo pasa por Controller, NO por watch(). El único warning de lint del repo
// era exactamente un watch() de este archivo (react-hooks/incompatible-library:
// el React Compiler no puede memoizar el watch() de react-hook-form y renuncia
// a memoizar el componente entero). Triplicar el par precio/moneda con watch()
// habría triplicado el warning; con Controller cada campo lee su propio valor
// del render prop y no hace falta ninguna suscripción global.

type OperationFlagName = (typeof OPERATIONS)[number]["flag"];
type OperationPriceName = (typeof OPERATIONS)[number]["price"];
type OperationCurrencyName = (typeof OPERATIONS)[number]["currency"];

function OperationField({
  control,
  flagName,
  priceName,
  currencyName,
  label,
  priceError,
  currencyError,
}: {
  control: Control<FormValues>;
  flagName: OperationFlagName;
  priceName: OperationPriceName;
  currencyName: OperationCurrencyName;
  label: string;
  priceError?: string;
  currencyError?: string;
}) {
  return (
    <Controller
      name={flagName}
      control={control}
      render={({ field: flagField }) => (
        <div
          className={cn(
            "rounded-md border transition-colors",
            flagField.value ? "border-stone bg-white p-4" : "border-transparent"
          )}
        >
          <div className="flex items-center gap-2">
            <Checkbox
              id={flagName}
              checked={flagField.value}
              onCheckedChange={(v) => flagField.onChange(v === true)}
              className="data-[state=checked]:bg-terracota data-[state=checked]:border-terracota"
            />
            <Label
              htmlFor={flagName}
              className="font-sans text-sm text-black cursor-pointer"
            >
              {label}
            </Label>
          </div>

          {flagField.value && (
            <Controller
              name={priceName}
              control={control}
              render={({ field: priceField }) => {
                // Vacío = "a convenir". El valor puede llegar como string (lo
                // que tipea el agente) o como number (el default de edición),
                // así que se normaliza para preguntar.
                const noPrice =
                  priceField.value == null ||
                  String(priceField.value).trim() === "";

                return (
                  <div className="mt-4 space-y-3">
                    <FieldRow>
                      <Field label={`Precio (${label.toLowerCase()})`} error={priceError}>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={priceField.value ?? ""}
                          onChange={(e) => priceField.onChange(e.target.value)}
                          onBlur={priceField.onBlur}
                          placeholder="Dejalo vacío si es a convenir"
                          className={cn(FIELD, priceError && FIELD_ERR)}
                        />
                      </Field>

                      <Field label="Moneda" error={currencyError}>
                        <Controller
                          name={currencyName}
                          control={control}
                          render={({ field: currencyFieldProps }) => (
                            <div className="flex h-10 rounded-md border border-stone overflow-hidden">
                              {(["USD", "ARS"] as const).map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => currencyFieldProps.onChange(c)}
                                  className={cn(
                                    "flex-1 font-sans text-sm font-medium transition-colors",
                                    currencyFieldProps.value === c
                                      ? "bg-terracota text-paper"
                                      : "bg-white text-graphite hover:bg-mist"
                                  )}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          )}
                        />
                      </Field>
                    </FieldRow>

                    {/* Consecuencia de dejar el precio vacío. Va VISIBLE y no
                        como letra chica: es información que la agencia necesita
                        para decidir, no un detalle. */}
                    {noPrice && (
                      <div className="rounded-md border border-stone bg-terracota-subtle px-3 py-2">
                        <p className="font-sans text-xs text-graphite">
                          Sin precio se publica como{" "}
                          <span className="font-medium text-black">
                            &ldquo;A convenir&rdquo;
                          </span>
                          . Tené en cuenta que la propiedad no va a aparecer
                          cuando alguien filtre por precio.
                        </p>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>
      )}
    />
  );
}

// ─── Requisitos libres: agregar y quitar ──────────────────────
//
// El agente escribe un requisito, lo agrega, el input se vacía y queda listo
// para el siguiente. Antes era un textarea único: una inmobiliaria no pide UN
// requisito extra, pide varios, y con un solo campo terminaban amontonados
// separados por comas.
//
// El borrador vive en useState LOCAL y no en el formulario: lo que no se agrega
// no se guarda (ver el aviso permanente debajo del input). Por eso este es un
// componente propio y no un render prop del Controller — los render props se
// ejecutan durante el render del padre y no pueden tener hooks.
function RentRequirementsOtherField({
  control,
}: {
  control: Control<FormValues>;
}) {
  const [draft, setDraft] = useState("");

  return (
    <Controller
      name="rent_requirements_other"
      control={control}
      render={({ field }) => {
        const items = field.value ?? [];
        const trimmed = draft.trim();
        const full = items.length >= RENT_REQUIREMENTS_OTHER_MAX;
        const tooLong = trimmed.length > RENT_REQUIREMENT_OTHER_MAX_LEN;
        const duplicate = trimmed !== "" && items.includes(trimmed);

        const add = () => {
          // Vacío: no se agrega y no pasa nada. No es un error que haya que
          // gritarle a nadie — el agente todavía no escribió.
          if (trimmed === "" || full || tooLong || duplicate) return;
          field.onChange([...items, trimmed]);
          setDraft("");
        };

        const remove = (index: number) =>
          field.onChange(items.filter((_, i) => i !== index));

        return (
          <Field label="Otros requisitos">
            {/* Lista de lo ya agregado. Va ARRIBA del input: es el resultado
                de la acción, y verlo crecer es la confirmación de que se
                agregó. */}
            {items.length > 0 && (
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li
                    key={`${item}-${i}`}
                    className="flex items-start gap-2 rounded-md border border-stone bg-white px-3 py-2"
                  >
                    <span className="flex-1 font-sans text-sm text-black break-words">
                      {item}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={`Quitar "${item}"`}
                      className="shrink-0 rounded-sm p-0.5 text-graphite transition-colors hover:bg-mist hover:text-black"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  value={draft}
                  disabled={full}
                  onChange={(e) => setDraft(e.target.value)}
                  // ⚠ Enter agrega, y NO envía el formulario. El input vive
                  // dentro de un <form> y en HTML un Enter en un campo de texto
                  // dispara el submit por defecto: sin este preventDefault, el
                  // agente que escribe un requisito y aprieta Enter publicaría
                  // la propiedad.
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    add();
                  }}
                  placeholder={
                    full
                      ? "Llegaste al máximo"
                      : "Ej: garante con propiedad en la ciudad"
                  }
                  className={cn(FIELD, tooLong && FIELD_ERR)}
                />
              </div>
              <button
                type="button"
                onClick={add}
                disabled={full || trimmed === "" || tooLong || duplicate}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 font-sans text-sm font-medium transition-colors",
                  full || trimmed === "" || tooLong || duplicate
                    ? "border-stone bg-mist text-stone cursor-not-allowed"
                    : "border-stone bg-white text-graphite hover:border-graphite hover:text-black"
                )}
              >
                <Plus size={16} />
                Agregar
              </button>
            </div>

            {/* Motivo por el que no se puede agregar, uno por vez y en el orden
                en que el agente se los va a encontrar. */}
            {full ? (
              <p className="font-sans text-xs text-graphite">
                Llegaste al máximo de {RENT_REQUIREMENTS_OTHER_MAX} requisitos
                libres. Quitá uno para agregar otro.
              </p>
            ) : tooLong ? (
              <p className="font-sans text-xs text-error">
                Máximo {RENT_REQUIREMENT_OTHER_MAX_LEN} caracteres por requisito
                (llevás {trimmed.length}).
              </p>
            ) : duplicate ? (
              <p className="font-sans text-xs text-graphite">
                Ese requisito ya está en la lista.
              </p>
            ) : (
              // Aviso permanente: lo que queda escrito sin agregar NO se
              // guarda. Va siempre visible y no solo cuando hay texto pendiente
              // — si apareciera recién al escribir, el agente ya estaría por
              // apretar guardar cuando lo lee.
              <p className="font-sans text-xs text-graphite">
                Escribí uno y tocá Agregar (o Enter). Lo que quede en el casillero
                sin agregar no se guarda.
              </p>
            )}
          </Field>
        );
      }}
    />
  );
}

// ─── Requisitos para alquilar (sección condicional) ───────────
//
// Solo se renderiza si la propiedad tiene alguna operación de ALQUILER, y en
// vivo: si el agente marca o desmarca las casillas de alquiler, la sección
// aparece y desaparece sin recargar nada.
//
// ⚠ Los dos flags se leen con Controller anidado, NO con watch(). El único
// warning de lint del repo es un watch() de este archivo
// (react-hooks/incompatible-library: el React Compiler no puede memoizar el
// watch() de react-hook-form y renuncia a memoizar el componente); sumar
// llamadas nuevas lo multiplicaría. Es el mismo patrón que usa OperationField.
//
// Desaparecer de la pantalla NO limpia los valores: siguen cargados en el
// formulario. El vaciado lo hace el transform del schema (regla c), y la action
// lo repite del lado del servidor.
function RentRequirementsSection({ control }: { control: Control<FormValues> }) {
  return (
    <Controller
      name="for_rent"
      control={control}
      render={({ field: rentField }) => (
        <Controller
          name="for_temp_rent"
          control={control}
          render={({ field: tempField }) => {
            if (!rentField.value && !tempField.value) return <></>;

            return (
              <Section title="Requisitos para alquilar">
                <p className="font-sans text-xs text-graphite">
                  Lo que le pedís al inquilino. Se muestran en la ficha pública,
                  así que quien consulta ya sabe si califica.
                </p>

                <Controller
                  name="rent_requirements"
                  control={control}
                  render={({ field }) => {
                    const selected = field.value ?? [];
                    const toggle = (req: RentRequirement) =>
                      field.onChange(
                        selected.includes(req)
                          ? selected.filter((r) => r !== req)
                          : [...selected, req]
                      );

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ALL_RENT_REQUIREMENTS.map((req) => (
                          <div key={req} className="flex items-center gap-2">
                            <Checkbox
                              id={`rent-req-${req}`}
                              checked={selected.includes(req)}
                              onCheckedChange={() => toggle(req)}
                              className="data-[state=checked]:bg-terracota data-[state=checked]:border-terracota"
                            />
                            <Label
                              htmlFor={`rent-req-${req}`}
                              className="font-sans text-sm text-black cursor-pointer"
                            >
                              {RENT_REQUIREMENT_LABELS[req]}
                            </Label>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />

                <RentRequirementsOtherField control={control} />
              </Section>
            );
          }}
        />
      )}
    />
  );
}

// ─── Componente principal ─────────────────────────────────────

export function PropertyForm({
  mode,
  initialData,
  agentId,
  cityCenter,
  agencyAgents,
  initialRentRequirements,
}: PropertyFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── Confirmación de la ubicación (ÚNICA FUENTE DE VERDAD) ───
  //
  // Antes esto eran DOS estados en dos componentes que no se conocían: un
  // `pinMoved` acá y un `hasBeenMoved` adentro del LocationPicker. Y la regla
  // era "el pin se movió alguna vez", irreversible: nada la devolvía a falso.
  // Eso permitía un bug real, sin ningún buscador de por medio — arrastrar el
  // pin (regla satisfecha), después tocar "Centrar" (el pin vuelve al centro de
  // la ciudad sin tocar el estado) y publicar: la propiedad quedaba justo en el
  // centro de la ciudad, que es lo que la regla existía para impedir.
  //
  // La regla ahora es "la ubicación ACTUAL está confirmada", y vive solo acá:
  //   - arrastrar el pin           → confirma  (acto deliberado sobre un punto)
  //   - "Centrar" en la ciudad     → DESCONFIRMA (es volver al punto de partida)
  //   - sugerencia del buscador    → DESCONFIRMA (la propuso una máquina)
  //   - botón "Confirmar ubicación"→ confirma
  //
  // En edición nace confirmada: la propiedad ya tenía una ubicación real y no
  // tiene sentido obligar a recolocar el pin para cambiarle el precio. Pero si
  // durante la edición la coordenada cambia por sugerencia o por centrar, se
  // desconfirma igual que en el alta.
  const [locationConfirmed, setLocationConfirmed] = useState(mode === "edit");
  // Se enciende solo si se intentó enviar sin confirmar.
  const [locationError, setLocationError] = useState(false);

  // Origen de la coordenada final, para medición posterior (no gatea nada).
  // En edición arranca con lo que tenga la propiedad; las cargadas antes de
  // esta feature no tienen valor y se asumen manuales, que es lo que eran.
  const [locationSource, setLocationSource] = useState<LocationSource>(
    mode === "edit" ? initialData?.location_source ?? "manual" : "manual"
  );

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
          status: initialData.status,
          for_sale: initialData.for_sale,
          sale_price: initialData.sale_price,
          // La moneda cae en "USD" si la operación no tiene precio cargado: es
          // solo el valor preseleccionado de los botones. Si la operación queda
          // apagada, el transform del schema la manda a null igual.
          sale_currency: initialData.sale_currency ?? "USD",
          for_rent: initialData.for_rent,
          rent_price: initialData.rent_price,
          rent_currency: initialData.rent_currency ?? "USD",
          for_temp_rent: initialData.for_temp_rent,
          temp_rent_price: initialData.temp_rent_price,
          temp_rent_currency: initialData.temp_rent_currency ?? "USD",
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
          rent_requirements: initialData.rent_requirements,
          rent_requirements_other: initialData.rent_requirements_other ?? [],
          year_built: initialData.year_built,
          is_featured: initialData.is_featured,
          // En edición, el agente actual de la propiedad.
          assigned_agent_id: initialData.agent_id,
        }
      : {
          property_type: "casa",
          status: "active",
          // Venta marcada por defecto (era el default del select de operación).
          for_sale: true,
          sale_price: null,
          sale_currency: "USD",
          for_rent: false,
          rent_price: null,
          rent_currency: "USD",
          for_temp_rent: false,
          temp_rent_price: null,
          temp_rent_currency: "USD",
          bedrooms: 0,
          bathrooms: 0,
          parking_spots: 0,
          amenities: [],
          // Precarga desde la última propiedad con alquiler de la agencia. Si
          // no hay ninguna, la página no manda la prop y el alta abre vacía,
          // sin ningún aviso.
          rent_requirements: initialRentRequirements?.rent_requirements ?? [],
          rent_requirements_other:
            initialRentRequirements?.rent_requirements_other ?? [],
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

  const selectedAmenities = (watch("amenities") ?? []) as string[];
  const lat = watch("lat");
  const lng = watch("lng");
  const address = watch("address") ?? "";

  const toggleAmenity = (amenity: string) => {
    const next = selectedAmenities.includes(amenity)
      ? selectedAmenities.filter((a) => a !== amenity)
      : [...selectedAmenities, amenity];
    setValue("amenities", next);
  };

  // ─── Movimientos del pin ──────────────────────────────────────

  const applyCoords = (coords: Coords) => {
    const rounded = roundCoords(coords);
    setValue("lat", rounded.lat);
    setValue("lng", rounded.lng);
  };

  // Cambio originado DENTRO del mapa: arrastre o botón "Centrar".
  const handlePickerChange = (coords: Coords, cause: LocationChangeCause) => {
    applyCoords(coords);
    // Arrastrar es confirmar; centrar en la ciudad es deshacer. En los dos
    // casos el origen es manual: "suggested" se reserva para una coordenada que
    // propuso el buscador y quedó tal cual.
    setLocationConfirmed(cause === "drag");
    setLocationSource("manual");
    if (cause === "drag") setLocationError(false);
  };

  // Sugerencia del buscador de direcciones: mueve el pin pero NO confirma.
  // Hasta que el agente confirme (o arrastre el pin él mismo) el envío sigue
  // bloqueado — si esto confirmara, la garantía se satisfaría sola y la feature
  // empeoraría la calidad de los datos en vez de mejorarla.
  const handleSuggestion = (coords: Coords) => {
    applyCoords(coords);
    setLocationConfirmed(false);
    setLocationSource("suggested");
  };

  const confirmLocation = () => {
    setLocationConfirmed(true);
    setLocationError(false);
  };

  const onSubmit = async (data: FormValues) => {
    // La ubicación actual tiene que estar confirmada (arrastrada a mano o
    // confirmada explícitamente después de una sugerencia).
    if (!locationConfirmed) {
      setLocationError(true);
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
        for_sale: data.for_sale,
        sale_price: data.sale_price,
        sale_currency: data.sale_currency,
        for_rent: data.for_rent,
        rent_price: data.rent_price,
        rent_currency: data.rent_currency,
        for_temp_rent: data.for_temp_rent,
        temp_rent_price: data.temp_rent_price,
        temp_rent_currency: data.temp_rent_currency,
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
        location_source: locationSource,
        amenities: data.amenities as Amenity[],
        rent_requirements: data.rent_requirements,
        rent_requirements_other: data.rent_requirements_other,
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
        for_sale: data.for_sale,
        sale_price: data.sale_price,
        sale_currency: data.sale_currency,
        for_rent: data.for_rent,
        rent_price: data.rent_price,
        rent_currency: data.rent_currency,
        for_temp_rent: data.for_temp_rent,
        temp_rent_price: data.temp_rent_price,
        temp_rent_currency: data.temp_rent_currency,
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
        location_source: locationSource,
        amenities: data.amenities as Amenity[],
        rent_requirements: data.rent_requirements,
        rent_requirements_other: data.rent_requirements_other,
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

      {/* ── Operaciones y precios ── */}
      {/* Una propiedad puede ofrecerse en VARIAS operaciones a la vez (la misma
          casa en venta y en alquiler). Por eso son tres casillas independientes
          y no un selector: antes había que elegir una o cargar la propiedad dos
          veces, lo que duplicaba el conteo del plan y ensuciaba el mapa. */}
      <Section title="Operaciones y precios">
        <p className="font-sans text-xs text-graphite">
          Marcá todas las operaciones en las que ofrecés la propiedad. Cada una
          lleva su propio precio.
        </p>

        <div className="space-y-4">
          {OPERATIONS.map((op) => (
            <OperationField
              key={op.flag}
              control={control}
              flagName={op.flag}
              priceName={op.price}
              currencyName={op.currency}
              label={op.label}
              currencyError={errors[op.currency]?.message}
              priceError={errors[op.price]?.message}
            />
          ))}
        </div>

        {/* Error de "al menos una operación" (colgado de for_sale en el schema) */}
        {errors.for_sale?.message && (
          <p className="font-sans text-xs text-error">
            {errors.for_sale.message}
          </p>
        )}
      </Section>

      {/* ── Requisitos para alquilar ── (solo si hay alguna operación de alquiler) */}
      <RentRequirementsSection control={control} />

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

        {/* Atajo: ubicar el pin desde la dirección escrita. La búsqueda sale de
            un click explícito (nunca del tipeo) y lo que devuelve es una
            SUGERENCIA: mueve el pin y deja la ubicación sin confirmar.
            Solo se manda la DIRECCIÓN: el barrio de arriba no participa de la
            búsqueda (ver el comentario de `geocodeAddress`), aunque se sigue
            guardando en la propiedad como siempre. */}
        <AddressSearchButton
          address={address}
          onSuggestion={handleSuggestion}
          disabled={submitting}
        />

        <LocationPicker
          value={{ lat, lng }}
          onChange={handlePickerChange}
          cityCenter={cityCenter}
          error={locationError}
        />

        {/* Confirmación de la ubicación. El botón es secundario a propósito: el
            terracota está reservado para el CTA de publicar y dos botones
            terracota compitiendo confunden cuál es el paso final. */}
        {locationConfirmed ? (
          <p className="inline-flex items-center gap-1.5 font-sans text-xs text-success">
            <Check size={14} />
            Ubicación confirmada
          </p>
        ) : (
          <button
            type="button"
            onClick={confirmLocation}
            className="inline-flex items-center gap-1.5 h-10 px-4 font-sans text-sm font-medium text-black bg-transparent border border-stone rounded-md transition-colors duration-[120ms] hover:bg-mist hover:border-graphite"
          >
            <Check size={16} />
            Confirmar esta ubicación
          </button>
        )}

        {locationError && (
          <p className="font-sans text-xs text-error">
            Confirmá la ubicación antes de guardar: arrastrá el pin hasta el
            punto exacto, o buscá la dirección y confirmá la sugerencia.
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
