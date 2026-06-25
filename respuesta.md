# Diagnóstico: loop de redirección en /dashboard — SOLO RELEVAMIENTO

> No se modificó nada. Causa raíz: **loop de redirección auth** entre el middleware
> (`proxy.ts`) y los Server Components del dashboard. El `replaceState` rate-limited
> (`DOMException: The operation is insecure`, `app-router.tsx:364`) es el **síntoma
> cliente** de que el App Router sigue una cadena de redirects que rebota en bucle.
> **El white-label `/[slug]` NO está involucrado** (lo confirmo abajo).

---

## 1. `proxy.ts` — el guard

```ts
import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/perfil", "/preferencias", "/suscripcion", "/admin"];

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // (A) Protegida sin sesión → /login
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);        // ← respuesta NUEVA
  }

  // (B) Con sesión y va a /login o /register → /dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);    // ← respuesta NUEVA
  }

  return supabaseResponse;                          // ← pass-through (con cookies)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- **Matcher:** matchea **todo** salvo estáticos (`_next/*`, favicon, imágenes). `/dashboard`,
  `/login`, `/`, y `/[slug]` **todos** pasan por el guard.
- **Redirects (cada uno con su condición):**
  - **(A)** `pathname` empieza con un prefijo protegido (incluye `/dashboard`) **y `!user`** →
    `/login`.
  - **(B)** `user` presente **y** `pathname === "/login" || "/register"` → `/dashboard`.
- **EL CICLO EN EL GRAFO:** (A) manda `/dashboard`(sin user)→`/login`; (B) manda
  `/login`(con user)→`/dashboard`. Si el veredicto "¿hay user?" **cambia entre `/dashboard` y
  `/login`**, se forma `/dashboard ⇄ /login` infinito. Eso es exactamente lo que pasa.
- **BUG HABILITANTE (footgun documentado de `@supabase/ssr`):** en **ambas** ramas de redirect
  se devuelve un `NextResponse.redirect(...)` **nuevo** que **NO copia las cookies** que
  `updateSession` dejó en `supabaseResponse`. Cuando `getUser()` dispara un **refresh** del token
  (rotación del refresh-token), las cookies nuevas viajan en `supabaseResponse` pero se **pierden**
  en el redirect → el navegador conserva el refresh-token viejo (ya **consumido** server-side) →
  en el siguiente request el auth "se da vuelta". La doc de Supabase exige copiar las cookies al
  `NextResponse.redirect` (`response.cookies.setAll(...)`); acá no se hace.

**Conclusión:** el guard tiene un ciclo `/dashboard ⇄ /login` y, al no reenviar las cookies
refrescadas en sus redirects, deja el auth en estado inconsistente que dispara el rebote.

### `updateSession` (`src/lib/supabase/middleware.ts`) — confirma el origen de las cookies

```ts
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(URL, KEY, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options));   // ← cookies SOLO en supabaseResponse
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();      // ← puede ROTAR el refresh token
  return { supabaseResponse, user };
}
```

Las cookies refrescadas se setean **solo** en `supabaseResponse`. El `proxy` las honra en el
pass-through (`return supabaseResponse`) pero **las tira** en las dos ramas de redirect. **Una
línea para confirmar:** `Set-Cookie` se pierde en cada 307 del proxy.

---

## 2. Interacción con `/[slug]` (white-label) — DESCARTADA

- **Precedencia de rutas:** existe `src/app/(agent)/dashboard/page.tsx` (segmento **estático**).
  En el App Router un segmento estático **gana** sobre uno dinámico (`(public)/[slug]`). Los
  grupos `(agent)`/`(public)` son transparentes para la URL. Por lo tanto `/dashboard` resuelve a
  `(agent)/dashboard`, **no** a `/[slug]`. No hay colisión.
- **`/[slug]/page.tsx` no tiene NINGÚN `redirect()`** — solo `notFound()` (slug inexistente) o
  renderiza `<AgencyUnavailable/>` / `<AgencyMapView/>`:
  ```ts
  if (result.status === "not_found") notFound();      // 404, NO redirect
  if (result.status === "disabled")  return <AgencyUnavailable/>;
  return <AgencyMapView .../>;
  ```
- **`resolveAgencyBySlug` no redirige** (solo lee la agencia y devuelve `not_found/disabled/active`).
- Grep confirmó: **0** `redirect()`/`permanentRedirect()` en `[slug]/`, `resolveAgencyBySlug.ts`,
  `AgencyMapView.tsx`, `AgencyUnavailable.tsx`.
- Aunque hipotéticamente `/dashboard` cayera en `/[slug]` (no cae), `resolveAgencyBySlug("dashboard")`
  daría `not_found` → `notFound()` → **404**, que **no** es un 307/redirect → no podría loopear.

**Conclusión:** `/[slug]` no captura `/dashboard` y no contiene redirects; **no es la causa del loop**.

---

## 3. ¿Qué cambió entre "andaba" y "no andaba"?

- **`proxy.ts` y `middleware.ts` NO los tocó el commit 2b72162** (white-label + fix navbar).
  `git log` de esos archivos: último cambio en `ea0b2bd` ("creada pagina de admin") y `1293aad`.
  `git show --stat 2b72162` → "NOT touched by 2b72162". Los **redirects del dashboard**
  (`layout.tsx`, `page.tsx`) tampoco están en ese commit.
- Lo que tocó 2b72162 en materia de rutas/redirects: **agregó** `(public)/[slug]/page.tsx`
  (sin redirects, punto 2) y el fix de viewport (`globals.css`, `h-dvh`, layouts) — **CSS y
  estructura, nada de auth/redirect**.
- **Redirects en layouts (Server Components) que SÍ participan del ciclo** —
  `(agent)/dashboard/layout.tsx`:
  ```ts
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");                 // l.16
  const { data: agent } = await supabase.from("agents")...eq("id", user.id).single();
  if (!agent) redirect("/login");                // l.24  ← segundo disparador
  ```
  y lo mismo en `(agent)/dashboard/page.tsx` (l.28 `!user`, l.35 `!agent`). **No hay
  `(public)/layout.tsx`** (confirmado).
- **DOS autoridades de redirect que pueden discrepar:** el middleware decide solo con **`user`**;
  el RSC del dashboard exige **`user` Y una fila `agent`**. Si el RSC ve `user` null (desync de
  cookies del punto 1) **o** la query de `agents` vuelve null (RLS/transitorio porque el client
  del RSC quedó sin sesión), el RSC hace `redirect("/login")`; el middleware en `/login` ve `user`
  (rama B) y manda de vuelta a `/dashboard`. **Loop.**
- **La pista del `/dashboard? 307` (con `?`):** el proxy hace `request.nextUrl.clone()` (preserva
  el `search`) y solo reescribe `pathname`; al redirigir a `/dashboard` con un search vacío/heredado
  queda `/dashboard?`. Es decorativo del clone, no manipula searchParams a propósito (no hay
  redirect que toque query strings).

**Conclusión:** el código de redirect/auth es **preexistente** (no lo introdujo el white-label);
el loop es un footgun **latente** del manejo de cookies en `proxy.ts` que se dispara por timing de
sesión (token vencido / refresh-token rotado / `.next` y cookies limpiadas), no por `/[slug]`.

---

## 4. HistoryUpdater / client-side — NO hay loop de router en efectos

- Todos los `router.push/replace/refresh` están en **handlers**, ninguno en `useEffect`:
  - `AgenciesTable.tsx:168` `router.refresh()` → dentro de un handler de activación.
  - `SubscriptionContent.tsx:219`, `TeamContent.tsx:82/349` `router.refresh()` → en
    `handleConfirm...` (handlers).
  - `PropertyForm.tsx:327` `router.push("/dashboard/propiedades")` → en `handleSubmit`.
  - (`useRouter()` se declara a nivel de componente, pero las **llamadas** son todas en eventos.)
- La **home del dashboard** (`page.tsx`) y su `layout.tsx` son Server Components; el `Sidebar`
  (client) usa `usePathname`, sin `router.push/replace`. No hay ningún `router.replace/push` ni
  `history.*` en un `useEffect` que corra al entrar a `/dashboard`.

**Conclusión:** no hay loop client-side propio de la app. El `replaceState` en
`HistoryUpdater` (`app-router.tsx:364`) es **código de Next** sincronizando el historial en **cada
salto** de la cadena de redirects del servidor; el rate-limit del navegador lo convierte en el
`DOMException`. Es síntoma, no causa.

---

## El ciclo exacto (paso a paso)

Estado: hay una sesión cuyo access-token necesita refresh (o cuyas cookies quedaron
desincronizadas por un redirect previo del proxy).

1. **`GET /dashboard`** → `proxy` → `updateSession.getUser()` refresca y **rota** el refresh-token
   (RT0→RT1); RT1 queda en `supabaseResponse`. El proxy, con `user` presente, **pasa**
   (`return supabaseResponse`).
2. El **RSC `dashboard/layout`** corre `getUser()` con el client de servidor. Por el desfase de
   cookies (RT1 no llegó al navegador en algún hop previo, o la fila `agents` vuelve null) ve
   **`!user`** (o `!agent`) → **`redirect("/login")`** → **307**. (En la terminal: `GET /dashboard 307`.)
3. **`GET /login`** → `proxy` → `updateSession.getUser()` ve `user` presente (rama **B**) →
   **`NextResponse.redirect("/dashboard")`** → **307**, pero **sin copiar las cookies** refrescadas
   (RT se vuelve a perder).
4. **`GET /dashboard`** otra vez → vuelve al paso 1/2 con el token aún más desincronizado →
   **307** de nuevo. → **Ráfaga `GET /dashboard 307`**.
5. Client-side, el App Router sigue cada 307 y llama `history.replaceState` en cada salto →
   el navegador lo **rate-limitea** → `DOMException: The operation is insecure` →
   "This page couldn't load".

**Eslabón que cierra el ciclo:** el proxy reenvía cookies en el pass-through pero **las descarta en
sus dos `NextResponse.redirect`**, y hay **dos autoridades de redirect** (middleware = solo `user`;
RSC del dashboard = `user` + `agent`) que, al discrepar, se rebotan `/dashboard ⇄ /login`.

> No se propone arreglo (pedido explícito). Confirmado el mecanismo; `/[slug]` queda descartado.
