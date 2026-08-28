import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Salida de sesión con motivo. Es un ROUTE HANDLER y no una server action a
// propósito: lo dispara un Server Component (el corte de `requireAgentSession`
// cuando la cuenta no resuelve su agencia), y un Server Component no puede ni
// escribir cookies ni invocar una action por su cuenta — lo único que puede
// hacer es redirigir. Un route handler sí puede escribir cookies, que es lo que
// hace falta para que `signOut()` borre la sesión de verdad.
//
// Por qué el signOut es imprescindible acá: si se manda a /login con la sesión
// todavía viva, `proxy.ts` la rebota a /dashboard y se arma el bucle de 307.
// Cerrar la sesión rompe esa premisa. Ver requireAgentSession.
//
// El botón "Cerrar sesión" del sidebar NO usa esta ruta: sigue con su
// `logoutAction` (un form → server action), que ahí sí es lo correcto.

// Motivos permitidos. El parámetro de la URL es un CÓDIGO corto, nunca el texto
// del mensaje: el texto lo resuelve el login desde su propio mapa. Un código
// desconocido se ignora y se manda al login pelado.
const ALLOWED_REASONS = ["no_agency"] as const;
type LogoutReason = (typeof ALLOWED_REASONS)[number];

function parseReason(value: string | null): LogoutReason | null {
  return ALLOWED_REASONS.includes(value as LogoutReason)
    ? (value as LogoutReason)
    : null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const reason = parseReason(request.nextUrl.searchParams.get("reason"));
  const target = new URL("/login", request.url);
  if (reason) target.searchParams.set("reason", reason);

  return NextResponse.redirect(target);
}
