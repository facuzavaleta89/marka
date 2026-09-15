"use client";

import type { ChangeEvent, Ref } from "react";
import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/feedback/Notice";
import { cn } from "@/lib/utils";
import {
  FIELD_BOX_GROUP,
  FIELD_BOX_GROUP_ERROR,
  FIELD_BOX_GROUP_INPUT,
  FIELD_GROUP_PREFIX,
  FIELD_UNDERLINE_GROUP,
  FIELD_UNDERLINE_GROUP_ERROR,
  FIELD_UNDERLINE_GROUP_INPUT,
} from "./fieldStyles";
import {
  PHONE_WA_PLACEHOLDER,
  PHONE_WA_PREFIX_LABEL,
  normalizePhoneWaNational,
  sanitizePhoneWaTyping,
} from "@/lib/utils/phoneWa";

// Campo de teléfono de WhatsApp con el prefijo argentino de celular fijo a la
// izquierda. Mismo molde que la dirección del sitio de marca (AgencySlugForm):
// la caja la dibuja el contenedor, el prefijo es texto no editable y el input va
// adentro sin borde.
//
// ⚠ ES CONTROLADO y se monta con `Controller`, NUNCA con `watch()`: los
// formularios necesitan el valor en vivo (para el aviso de número a revisar) y
// `watch()` dispara el warning react-hooks/incompatible-library del React
// Compiler (CLAUDE.md → ESLint).
//
// El valor del campo es característica + número. El número completo para
// guardar lo arma el esquema (`phoneWaField`), no este componente.

interface PhoneWaInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: Ref<HTMLInputElement>;
  /** "box" en el panel; "underline" en el registro. */
  variant: "box" | "underline";
  invalid?: boolean;
  /**
   * Número guardado que NO tiene el formato esperado (ver `splitStoredPhoneWa`).
   * Mientras el campo lo conserve sin tocar, se muestra tal cual: sin el prefijo
   * —que lo haría leerse como "+54 9 54385…"— y sin limpiarlo al salir. En
   * cuanto la persona lo edita, pasa a ser un número nuevo y rige lo normal.
   */
  preservedValue?: string | null;
  /** id del texto de ayuda, para que un lector de pantalla lo lea con el campo. */
  describedBy?: string;
}

export function PhoneWaInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  inputRef,
  variant,
  invalid = false,
  preservedValue = null,
  describedBy,
}: PhoneWaInputProps) {
  const isPreserved =
    preservedValue !== null && preservedValue !== "" && value === preservedValue;
  const box = variant === "box";
  const prefixId = `${id}-prefix`;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    // Más de un carácter de una sola vez = pegado o autocompletado. Es el caso
    // más probable de un número con prefijo ("+54 9 385…" copiado del contacto
    // del teléfono), así que se limpia entero en el acto: si esperara a salir del
    // campo, se vería "+54 9 | 5493854000000" mientras tanto.
    const insertedAtOnce = next.length - value.length > 1;
    onChange(
      insertedAtOnce ? normalizePhoneWaNational(next) : sanitizePhoneWaTyping(next)
    );
  }

  function handleBlur() {
    // Al salir del campo se limpia lo que se tipeó a mano ("0385154000000" →
    // "3854000000"). Un número guardado sin tocar NO se toca: corregirlo acá
    // sería cambiarle el teléfono a alguien sin que lo pida.
    if (!isPreserved) {
      const normalized = normalizePhoneWaNational(value);
      if (normalized !== value) onChange(normalized);
    }
    onBlur();
  }

  return (
    <div
      className={cn(
        box ? FIELD_BOX_GROUP : FIELD_UNDERLINE_GROUP,
        invalid && (box ? FIELD_BOX_GROUP_ERROR : FIELD_UNDERLINE_GROUP_ERROR)
      )}
    >
      {!isPreserved && (
        <span id={prefixId} className={cn(FIELD_GROUP_PREFIX, "pr-2")}>
          {PHONE_WA_PREFIX_LABEL}
        </span>
      )}
      <Input
        id={id}
        name={name}
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={PHONE_WA_PLACEHOLDER}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [isPreserved ? null : prefixId, describedBy].filter(Boolean).join(" ") ||
          undefined
        }
        className={box ? FIELD_BOX_GROUP_INPUT : FIELD_UNDERLINE_GROUP_INPUT}
      />
    </div>
  );
}

/**
 * Aviso para un número guardado que no tiene el formato esperado. Se muestra
 * mientras el campo lo conserve sin tocar.
 *
 * ⚠ Tono `warning` y no `error`: no falló nada, el número está guardado y se
 * sigue usando. Y dice explícitamente que NO se cambió, porque es lo primero
 * que la persona necesita saber al ver su número marcado.
 */
export function PhoneWaReviewNotice({ stored }: { stored: string }) {
  return (
    <Notice
      tone="warning"
      title="Revisá este número de WhatsApp"
      icon={<TriangleAlert size={18} />}
    >
      <span className="block">
        El número guardado,{" "}
        <span className="font-medium text-black">{stored}</span>, no tiene el
        formato de un celular argentino (+54 9, característica y número), así que
        el enlace de WhatsApp puede no llegar a destino.
      </span>
      <span className="mt-1.5 block">
        No lo cambiamos por vos. Si está bien, dejalo como está; si no, borralo y
        escribí la característica y el número.
      </span>
    </Notice>
  );
}
