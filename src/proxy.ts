import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

// Rutas del área privada que exigen sesión.
//
// ⚠ ACÁ DECÍA QUE CON /dashboard Y /admin "ALCANZA", PORQUE "TODAS LAS PANTALLAS
// DEL AGENTE CUELGAN DE /dashboard". ERA FALSO, y fue justamente la razón por la
// que nadie volvió a mirar esta lista: `/register/plan` —el paso 2 del alta,
// donde la inmobiliaria elige su plan— es una pantalla del agente que NO cuelga
// de /dashboard y se quedó afuera. (Antes la lista incluía además /perfil,
// /preferencias y /suscripcion sueltos, que NO son rutas reales: eran prefijos
// muertos que hacían leer mal el mapa.)
//
// ⚠ EL PREFIJO ES `/register/plan` COMPLETO, NUNCA `/register` A SECAS. La lista
// se evalúa con `startsWith`, así que `/register` capturaría también la pantalla
// PÚBLICA de alta: una inmobiliaria nueva no podría registrarse porque para
// registrarse necesitaría estar registrada, y el proxy la mandaría al login, que
// es exactamente donde no puede hacer nada.
//
// "/admin" exige sesión acá (primera barrera). La autorización de identidad
// del dueño (user.id === ADMIN_USER_ID) va en el server component y la action.
//
// ⚠ `/api/geocode` NO va en esta lista, y es deliberado: su gate vive adentro
// del handler porque un proxy que redirigiera un POST de `fetch` al login
// devolvería HTML con estado 200, que el cliente leería como éxito.
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/register/plan"];

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Rutas del área de agente requieren sesión activa
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Si ya tiene sesión y va a /login o /register, redirigir al dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
