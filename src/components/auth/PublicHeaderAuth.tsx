"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Puerta al área privada, en el encabezado público ─────────
//
// ⚠ ESTE COMPONENTE EXISTE PORQUE ANTES ERAN DOS COPIAS Y YA HABÍAN DIVERGIDO.
// El enlace estaba escrito a mano en `(public)/page.tsx` y en `AgencyMapView.tsx`,
// con el bloque de detección de sesión duplicado CARÁCTER POR CARÁCTER, y una de
// las dos copias tenía `shrink-0` y la otra no. Mientras el texto fue "Ingresar"
// (ocho caracteres) esa diferencia no se notó; con el texto de captación —que es
// tres veces más largo— la copia sin `shrink-0` se hubiera achicado y roto.
//
// Es el mismo patrón que el proyecto ya se cobró dos veces (`AgenciesTable` con
// las condiciones de fila escritas dos veces y desincronizadas, y `AgentCell`,
// que se centralizó por ese precedente). No volver a copiar y pegar esto.
//
// La detección de sesión vive ACÁ y en ningún otro lado: es lo que garantiza que
// no pueda aparecer una tercera copia.

interface PublicHeaderAuthProps {
  /**
   * `marketplace` — home del mapa general: CAPTACIÓN. Enlace principal a
   * `/register` + inicio de sesión secundario.
   *
   * `agency` — sitio de marca de una agencia (`/[slug]`): SIN CAPTACIÓN, el
   * enlace de siempre y nada más. ⚠ Es una decisión COMERCIAL y es firme: ese
   * sitio es literalmente lo que la agencia compra con su plan (entitlement
   * `has_white_label`), y el modelo es un marketplace POR CIUDAD, así que
   * invitar ahí a sumar inmobiliarias sería usar el espacio que paga un cliente
   * para captar a su competencia directa, de su misma ciudad. Le daría un
   * argumento fácil para no renovar. No unificar las dos variantes "por
   * prolijidad".
   */
  variant: "marketplace" | "agency";
}

// Enlace secundario / terciario (DESIGN §6 "Ghost"): texto pelado, sin fondo ni
// borde. Es el tratamiento que el enlace de ingreso ya tenía.
const GHOST_LINK =
  "font-sans text-sm font-medium text-graphite transition-colors duration-[120ms] ease-out hover:text-black";

export function PublicHeaderAuth({ variant }: PublicHeaderAuthProps) {
  // ⚠ ARRANCA EN `false` A PROPÓSITO: el estado anónimo es el de casi todo el
  // tráfico, y es el que ya viene en el HTML prerenderizado de la home (la ruta
  // `/` es estática en el build). Ver el bloque sobre el salto, más abajo.
  const [isAuthed, setIsAuthed] = useState(false);

  // Detecta sesión client-side. IIFE async dentro del efecto (CLAUDE.md: no
  // bajar la regla de ESLint por el patrón de set-al-inicio-del-efecto).
  //
  // No se resuelve en el servidor a propósito: la home es un Client Component
  // y pasarle la sesión desde arriba obligaría a volverla dinámica, o sea a
  // renderizar en cada request la pantalla más visitada del producto. El build
  // la reporta hoy como `○ (Static)` y ese tipo es parte del baseline medido.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthed(!!user);
    })();
  }, []);

  return (
    // ══════════════════════════════════════════════════════════
    // EL SALTO DE TEXTO POR LA SESIÓN, Y CÓMO SE APAGA
    // ══════════════════════════════════════════════════════════
    //
    // El texto cambia cuando `getUser()` vuelve, y eso ocurre DESPUÉS del primer
    // pintado. Mientras el enlace decía "Ingresar" → "Ir al panel" el cambio era
    // de dos palabras de ancho parecido y no se notaba; con "Sumá tu
    // inmobiliaria" el ancho del bloque se movería ~80 px en el elemento más
    // prominente del encabezado, en cada carga, para todo cliente que paga.
    //
    // LA SOLUCIÓN ES DE CSS Y NO DE DATOS: los DOS estados se renderizan siempre,
    // apilados en la MISMA celda de una grilla de 1×1. El ancho del contenedor
    // es entonces el del más ancho de los dos, ESTABLE DESDE EL PRIMER PINTADO,
    // y cambiar de estado solo alterna cuál se ve. El layout no se mueve ni un
    // píxel: no hay reflow, no hay CLS, y el `justify-between` del encabezado no
    // reacomoda nada.
    //
    // Se usa `invisible` (`visibility: hidden`) y NO `hidden` (`display: none`)
    // porque el que no se ve tiene que seguir OCUPANDO su celda: es lo que hace
    // que la grilla mida el máximo de los dos. `visibility: hidden` además saca
    // el subárbol del orden de tabulación y del árbol de accesibilidad, así que
    // el enlace oculto no es enfocable ni lo anuncia un lector de pantalla.
    //
    // Lo que queda es el cambio de TEXTO dentro de una caja que ya no se mueve.
    // Apagarlo del todo exigiría conocer la sesión en el primer pintado, o sea
    // volver dinámica la home: un costo desproporcionado para el caso.
    <div className="grid shrink-0 justify-items-end">
      {/* ── Estado anónimo ────────────────────────────────────── */}
      <div
        className={cn(
          "col-start-1 row-start-1 flex items-center gap-3",
          isAuthed && "invisible pointer-events-none"
        )}
        aria-hidden={isAuthed}
      >
        {variant === "marketplace" ? (
          <>
            {/* Llamado a la captación — botón secundario de DESIGN §6 (borde
                `stone`, texto `black`, hover `mist`), NUNCA terracota.
                ⚠ El terracota está reservado en esta pantalla al FAB "Ver
                lista / Ver mapa", que es la acción principal del visitante —y el
                visitante es el 99 % del tráfico—. Dos elementos terracota
                compitiendo confunden cuál es el paso siguiente; es el mismo
                criterio, con las mismas palabras, que DESIGN §11 ya aplica a los
                dos botones del LocationPicker. La jerarquía contra el enlace de
                al lado no la da el color: la da tener borde y caja contra texto
                pelado.

                ⚠ `hidden sm:inline-flex`: DE LOS DOS, ES ÉSTE EL QUE SE CAE POR
                DEBAJO DE 640 px. Los cuatro elementos del encabezado no entran
                en un teléfono —ancho útil ~343 px en uno de 375— así que hay que
                sacar uno, y el que se saca es el llamado.

                El criterio es de PRODUCTO y no de layout: el ingreso es la
                función que un cliente usa TODOS LOS DÍAS, y el celular es el
                dispositivo donde más se navega. Esconderlo ahí le agrega un paso
                a quien ya paga, para ganar una conversión eventual de quien
                todavía no. Entre molestar a un cliente todos los días y perder
                una puerta de captación en un tamaño de pantalla, se elige lo
                segundo. ⚠ Consecuencia asumida y explícita: en un teléfono la
                captación NO SE VE EN NINGÚN LADO (ver DESIGN §11). */}
            <Link
              href="/register"
              className="hidden h-9 shrink-0 items-center rounded-md border border-stone px-3 font-sans text-sm font-medium text-black transition-colors duration-[120ms] ease-out hover:border-graphite hover:bg-mist sm:inline-flex"
            >
              Sumá tu inmobiliaria
            </Link>

            {/* Ingreso — para quien ya es cliente. SIEMPRE VISIBLE, en todos los
                tamaños.
                ⚠ Va en `GHOST_LINK`, o sea texto pelado sin caja ni borde, y eso
                importa especialmente en celular, donde queda SOLO: si acá
                apareciera un enlace con borde, sería un botón que se materializó
                sin motivo justo en el tamaño en que el otro desaparece. Es el
                mismo tratamiento que este enlace tenía antes de toda esta pieza
                (`text-graphite` → `hover:text-black`, sin fondo ni borde). */}
            <Link href="/login" className={cn(GHOST_LINK, "shrink-0")}>
              Iniciar sesión
            </Link>
          </>
        ) : (
          // Sitio de marca: el enlace de siempre, mismo texto y mismo destino.
          <Link href="/login" className={cn(GHOST_LINK, "shrink-0")}>
            Ingresar
          </Link>
        )}
      </div>

      {/* ── Estado con sesión ─────────────────────────────────── */}
      {/* Un agente logueado no es un prospecto: no se le ofrece registrarse.
          Va en `ghost` y no como botón porque es una vuelta al panel, no un
          llamado a la acción. */}
      <div
        className={cn(
          "col-start-1 row-start-1 flex items-center",
          !isAuthed && "invisible pointer-events-none"
        )}
        aria-hidden={!isAuthed}
      >
        <Link href="/dashboard" className={cn(GHOST_LINK, "shrink-0")}>
          Ir al panel
        </Link>
      </div>
    </div>
  );
}
