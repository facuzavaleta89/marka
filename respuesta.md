# Implementación — Gestión de equipo (sub-pieza 1: admin crea agentes + ve su equipo)

> Hecho el 9 jun 2026. Un admin de agencia (`agents.role = 'admin'`) puede crear
> agentes nuevos en SU agencia y ver la lista de su equipo. Agentes ilimitados.
> NO incluye: eliminar/editar agentes, límite por plan, invitación por email.

Build: `npx tsc --noEmit` → **0 errores**. `npm run lint` → solo los 5 problemas
preexistentes conocidos (ClusterLayer ×2, StatsCard, PropertyForm, RegisterForm,
ver PENDIENTES.md); **ningún archivo nuevo/tocado aparece en el lint**.

---

## Archivos creados

| Archivo | Qué es |
|---|---|
| `src/app/(agent)/dashboard/equipo/page.tsx` | Página del equipo (Server Component). Gatea por `role === 'admin'` y lista los agentes de la agencia |
| `src/app/(agent)/dashboard/equipo/actions.ts` | `createAgentAction` (server action, service role) |
| `src/components/dashboard/TeamContent.tsx` | Cliente: tabla/cards del equipo + form de alta inline |
| `src/lib/utils/authErrors.ts` | `translateAuthError` extraído a util compartido (ver nota abajo) |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/types/index.ts` | `email: string \| null` agregado a la interface `Agent` (con comentario: denormalizado de auth.users, fuente de verdad sigue siendo auth.users) |
| `src/app/(agent)/dashboard/layout.tsx` | `role` agregado al select de `agents`; `const isAgencyAdmin = agent.role === "admin"`; pasado como prop al `<Sidebar>` |
| `src/components/dashboard/Sidebar.tsx` | Prop `isAgencyAdmin` (propagada a `NavContent` y a ambos call sites); tipo `NavItem`; ítem "Equipo" (`/dashboard/equipo`, ícono `Users`, `adminOnly: true`); `.filter()` del `.map` de `NAV_ITEMS` |
| `src/app/(agent)/register/actions.ts` | `email: data.email` agregado al insert de `agents`; `translateAuthError` ahora se importa del util compartido (se quitó la copia local) |

---

## Decisiones de implementación

### Seguridad (lo sensible)
- **Dos "admin" separados, sin mezclar.** `isAppAdmin` (dueño de plataforma, `ADMIN_USER_ID`, gatea `/admin`) quedó intacto. Se agregó `isAgencyAdmin` (`agent.role === 'admin'`) como pieza aparte para "Equipo".
- **Toda la autorización es server-side.** Tres capas:
  1. El **layout** calcula `isAgencyAdmin` y oculta el menú (solo cosmético).
  2. La **página** (`equipo/page.tsx`) hace `if (agent.role !== 'admin') redirect("/dashboard")` — un agente normal no recibe la página aunque navegue directo a la URL.
  3. La **action** (`createAgentAction`) re-lee la fila de `agents` del `auth.uid()` y aborta con `{ error: "No autorizado" }` si `role !== 'admin'`.
- **`agency_id` derivado del servidor, nunca del cliente.** La action lo saca de la fila del admin logueado (`caller.agency_id`), no de ningún input. El agente nuevo hereda esa agencia.
- **`createUser`, no `signUp`.** La action usa `admin.auth.admin.createUser({ email, password, email_confirm: true })` con service role. A diferencia de `signUp`, **no inicia sesión** → el admin sigue logueado como él mismo. `email_confirm: true` deja el usuario confirmado sin mail de verificación.
- **Insert en `agents` con service role.** La policy de INSERT solo permite `id = auth.uid()`, así que el alta de un agente ajeno va por el admin client (service role), salteando RLS. Se setea `role: "agent"`.
- **Rollback de huérfanos.** Si el insert en `agents` falla después de crear el user de Auth, se borra el user con `admin.auth.admin.deleteUser(created.user.id)` para no dejar una cuenta de Auth sin perfil.
- **Validación doble.** El form valida con zod en el cliente (UX) y `createAgentAction` revalida con el mismo esquema zod en el server (barrera real). Reglas: `full_name` min 1, `email` válido, `phone_wa` `/^\d{10,}$/`, `password` min 6.

### `translateAuthError` → util compartido
El helper vivía como función **local** dentro de `register/actions.ts`. Un archivo `"use server"` solo puede exportar funciones async, así que no se podía exportar un helper sync desde ahí. Lo extraje a `src/lib/utils/authErrors.ts` y lo importan tanto el registro como la nueva action. (De paso agregué el match `"already been registered"`, otra variante del mismo error de Supabase.) Es la forma limpia de "reusar `translateAuthError`" que pedía el prompt.

### UI / DESIGN
- **Tabla modelada sobre `PropertiesTable`**: tabla en desktop (`hidden md:block`, header en DM Sans 11px uppercase tracking-wider) + cards en mobile (`md:hidden`), mismo tratamiento `bg-paper`/`border-stone`/`rounded-lg`. Columnas: Nombre, Email, Teléfono, Rol.
- **Badge de rol**: "Admin" en `terracota-subtle`/`terracota`, "Agente" en `mist`/`graphite` (mismo lenguaje de badges del sistema). El admin actual se marca con "(vos)" al lado del nombre.
- **Form de alta inline**: botón "Agregar agente" (terracota, ícono `UserPlus`) que revela una `<section>` card con el form (patrón de `ProfileForm`). No usé un Dialog porque el form tiene 4 campos y un aclaratorio; inline respira mejor y es coherente con las secciones del dashboard. En éxito: `form.reset()` + cerrar + `router.refresh()` → el agente aparece en la lista.
- **Contraseña temporal**: campo `type="text"` (no `password`) a propósito, porque el admin necesita **leerla para compartírsela** al agente. Aclaración en voz DESIGN §10: "La contraseña es temporal: compartísela al agente para que ingrese. Después puede cambiarla desde su perfil."
- Título `font-serif text-4xl font-bold text-black`, contenedor `p-8` (patrón de `propiedades/page.tsx`).

### Detalles técnicos
- **No hay regresión de tipos por la columna `email`**: los clients Supabase del proyecto NO están tipados contra un `Database` generic (no existe `src/types/supabase.ts`), así que `select`/`insert` con `email` no rompen `tsc`.
- **`NAV_ITEMS` tipado explícito** (`NavItem[]` con `exact?` y `adminOnly?` opcionales) para que el `.filter().map()` no tenga sorpresas de inferencia. El ítem "Equipo" usa match activo por `startsWith` (sin `exact`).
- **Email en la lista**: `agents.email` puede ser `null` (agentes previos al backfill) → la UI muestra "—" en ese caso.

---

## Para probar
1. Logueate como un agente con `role = 'admin'` → aparece "Equipo" en el sidebar; `/dashboard/equipo` lista el equipo.
2. Logueate como `role = 'agent'` → NO aparece "Equipo"; entrar directo a `/dashboard/equipo` redirige a `/dashboard`.
3. Como admin, "Agregar agente" → completar y crear → el nuevo agente aparece en la lista con rol "Agente", y **tu sesión sigue activa** (no te desloguea).
4. Intentar crear con un email ya existente → error en español ("Ya existe una cuenta con ese email"), sin dejar huérfano en Auth.

> Nota: no verifiqué el flujo end-to-end contra la base/Auth reales (sin conexión Supabase en este entorno). `tsc` y `lint` pasan; la lógica de `createUser`/`deleteUser`/rollback es el patrón estándar de service role.
