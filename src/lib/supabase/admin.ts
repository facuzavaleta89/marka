// ADVERTENCIA: este cliente usa la service role key que omite RLS.
// Importar SOLO en código de servidor (Server Actions, Route Handlers, scripts).
// NUNCA importar en componentes cliente ni en archivos con "use client".
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
