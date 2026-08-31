import { NextResponse } from "next/server";
import { geocodeAddress, sanitizeAddress } from "@/lib/geocoding";
import { getAgencyCity } from "@/lib/utils/getAgencyCity";
import { resolveAgentSession } from "@/lib/utils/resolveAgentSession";
import type { GeocodeResponse } from "@/types";

// POST /api/geocode — intermediaria entre el formulario de propiedad y el
// servicio de geocodificación.
//
// POR QUÉ UNA RUTA PROPIA Y NO UNA LLAMADA DESDE EL NAVEGADOR: la política del
// proveedor exige un User-Agent que identifique a la aplicación, y el navegador
// no puede setear ese encabezado. Además, saliendo del servidor podemos aplicar
// el límite de 1 consulta por segundo para TODA la app y una caché compartida,
// cosas imposibles de garantizar con cada navegador tirando por su cuenta.
//
// ⚠ NACE PÚBLICA SI NO SE LA CIERRA. `src/proxy.ts` solo exige sesión bajo los
// prefijos /dashboard y /admin (PROTECTED_PREFIXES); /api no está en esa lista,
// así que el proxy la deja pasar sin mirar. El gate REAL es el de abajo: sin
// sesión válida, 401. Sin eso esto sería un proxy abierto a un servicio de
// terceros con nuestra identificación puesta, y el bloqueo nos lo comeríamos
// nosotros.
//
// LA CIUDAD NO VIENE DEL CLIENTE: se deriva de la agencia del usuario logueado
// (misma disciplina que el agency_id en el resto del proyecto). El cliente
// manda la dirección y NADA MÁS. En particular NO manda el barrio: no
// participa de la búsqueda (ver el comentario de `geocodeAddress`).
//
// CONTRATO DE RESPUESTA:
//   - 200 + GeocodeResponse  → los cuatro desenlaces normales del flujo.
//   - 400 / 401              → { error }. El cliente trata cualquier respuesta
//                              que no sea 200 como 'unavailable': el atajo no
//                              está, el camino manual sí.
// Nunca se devuelve el error crudo del servicio externo ni su respuesta cruda.

interface RequestBody {
  address?: unknown;
}

export async function POST(request: Request) {
  // 1. Sesión. La ruta es del área privada aunque no cuelgue de /dashboard.
  //    Se usa resolveAgentSession (no requireAgentSession): un route handler
  //    tiene que responder un código, no redirigir.
  const session = await resolveAgentSession();
  if (session.status !== "ok") {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 2. Entrada. Un cuerpo ilegible es un 400, no una excepción.
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  // Validación y normalización: recorta caracteres de control, colapsa
  // espacios y aplica un largo máximo. Misma función que usa el orquestador.
  const address = sanitizeAddress(body.address);
  if (!address) {
    return NextResponse.json({ error: "Falta la dirección" }, { status: 400 });
  }

  // 3. La ciudad, del servidor.
  const city = await getAgencyCity(session.agent.agency_id);
  if (!city) {
    // La agencia no resuelve su ciudad: no hay dónde buscar. No es un error
    // del agente ni algo que reintentar, así que se responde con el desenlace
    // que ya sabe manejar la interfaz.
    const response: GeocodeResponse = { status: "unavailable" };
    return NextResponse.json(response);
  }

  // 4. La búsqueda. `geocodeAddress` no lanza nunca: cualquier problema del
  //    servicio vuelve como 'unavailable'.
  const response: GeocodeResponse = await geocodeAddress({
    address,
    city: {
      name: city.name,
      province: city.province,
      country: city.country,
      center: city.center,
    },
  });

  return NextResponse.json(response);
}
