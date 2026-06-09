import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

// "/admin" exige sesión acá (primera barrera). La autorización de identidad
// del dueño (user.id === ADMIN_USER_ID) va en el server component y la action.
const PROTECTED_PREFIXES = ["/dashboard", "/perfil", "/preferencias", "/suscripcion", "/admin"];

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
