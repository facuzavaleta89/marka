import { createClient } from "@/lib/supabase/server";
import type { Coords } from "@/lib/utils/coords";

// Resuelve la ciudad de una agencia con los campos que hacen falta para armar
// una consulta de geocodificación: nombre, provincia, país y centro.
//
// POR QUÉ EXISTE: las dos páginas que renderizan el formulario de propiedad
// leen `cities` con un select acotado a `center_lat, center_lng`, así que el
// nombre y la provincia NUNCA llegan al cliente. No hacía falta ensancharlas:
// la ciudad se resuelve en el servidor, dentro de la ruta de búsqueda, a partir
// de la agencia del usuario logueado. Esto mantiene la disciplina del proyecto
// —la ciudad y la agencia salen del server, nunca del cliente— y deja el
// formulario sin datos nuevos que pudieran manipularse.
//
// SERVER-ONLY: crea su propio client de servidor y lee cookies.
//
// Lee con el client normal (no service role): `cities` y `agencies` tienen
// policies de lectura pública, así que no hace falta saltar RLS.

export interface AgencyCity {
  id: string;
  name: string;
  province: string | null;
  country: string;
  center: Coords;
}

// Fila cruda del select. El embed to-one de PostgREST puede materializarse como
// objeto o como array de uno, según la inferencia: lo normalizamos.
interface CityRow {
  id: string;
  name: string;
  province: string | null;
  country: string;
  center_lat: number;
  center_lng: number;
}

function firstOf<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function getAgencyCity(
  agencyId: string
): Promise<AgencyCity | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("agencies")
    .select(
      "city:cities(id, name, province, country, center_lat, center_lng)"
    )
    .eq("id", agencyId)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as { city: CityRow | CityRow[] | null };
  const city = firstOf(row.city);
  if (!city) return null;

  return {
    id: city.id,
    name: city.name,
    province: city.province,
    country: city.country,
    center: { lat: city.center_lat, lng: city.center_lng },
  };
}
