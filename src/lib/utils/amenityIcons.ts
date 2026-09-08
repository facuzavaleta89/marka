import {
  Waves, Beef, Flame, Dumbbell, Users, ShieldCheck, BellRing,
  WashingMachine, Sun, Trees, Umbrella, Car, Sailboat, Ship,
  Landmark, Briefcase, Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Amenity } from "@/types";

// ─── Íconos de amenities (16px graphite en los chips) ─────────
//
// El ícono es una decisión de UI; las etiquetas viven en labels.ts. Este archivo
// está al lado de aquel por eso mismo: son las dos mitades de "cómo se muestra
// una amenity", y conviene que se encuentren juntas.
//
// ⚠ POR QUÉ ESTÁ ACÁ Y NO DENTRO DE UN COMPONENTE. Vivía dentro de
// PropertyModal.tsx, donde era privada del módulo. Al aparecer una segunda
// pantalla que muestra los mismos chips (la página pública de la propiedad), la
// alternativa era copiarla — y esta es exactamente la clase de constante que NO
// se puede duplicar: son DIECISÉIS entradas exhaustivas por tipo, y una amenity
// nueva agregada en un solo lado no rompe nada visible, solo hace que una
// pantalla muestre el ícono correcto y la otra el genérico. El proyecto ya se
// comió una vez ese defecto (AgenciesTable tenía la misma condición escrita dos
// veces y las dos copias se desincronizaron).
//
// El `Record<Amenity, LucideIcon>` es lo que vuelve barata la disciplina:
// agregar un valor a `Amenity` sin darle ícono acá NO compila.
export const AMENITY_ICONS: Record<Amenity, LucideIcon> = {
  pileta: Waves,
  quincho: Beef,
  parrilla: Flame,
  gym: Dumbbell,
  sum: Users,
  seguridad_24h: ShieldCheck,
  portero: BellRing,
  laundry: WashingMachine,
  solarium: Sun,
  jardin: Trees,
  terraza: Umbrella,
  cochera_cubierta: Car,
  vista_al_rio: Sailboat,
  vista_al_mar: Ship,
  apto_credito: Landmark,
  apto_profesional: Briefcase,
};

// Ícono de reserva para un valor que no esté en la tabla. No debería poder
// ocurrir (el Record es exhaustivo), pero los consumidores leen la tabla con un
// índice que TypeScript no puede verificar contra los datos reales de la base:
// `amenities` es JSONB y CLAUDE.md documenta que no tiene barrera de dominio en
// ninguna capa, así que un valor inesperado es representable.
export const AMENITY_FALLBACK_ICON: LucideIcon = Tag;
