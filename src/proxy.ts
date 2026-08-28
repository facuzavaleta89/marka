import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

// Rutas del área privada que exigen sesión. Con estos DOS prefijos alcanza:
// todas las pantallas del agente cuelgan de /dashboard (perfil, preferencias,
// suscripción, propiedades, equipo, consultas) y el panel de plataforma es
// /admin. Antes la lista incluía /perfil, /preferencias y /suscripcion sueltos,
// que NO son rutas reales (no existen a nivel raíz): eran prefijos muertos que
// hacían leer mal el mapa de rutas privadas.
// "/admin" exige sesión acá (primera barrera). La autorización de identidad
// del dueño (user.id === ADMIN_USER_ID) va en el server component y la action.
const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

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
