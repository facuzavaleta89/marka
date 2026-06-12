# Implementación — `agencies.phone_wa`: registro, Preferencias y tipo

> Hecho el 12 jun 2026. La columna `agencies.phone_wa` (NOT NULL, ya migrada) se
> setea en el registro (heredando el del admin fundador), se puede editar en
> Preferencias (solo el admin de agencia) y se agregó al tipo `Agency`.
> NO se tocaron las queries del modal/useProperties ni el fallback de WhatsApp
> (eso es la Parte 2, junto con el borrado de agente).

Build: `npx tsc --noEmit` → **0 errores**. `npm run lint` → solo los 5 problemas
preexistentes conocidos (ClusterLayer ×2, StatsCard, PropertyForm, RegisterForm);
**ningún archivo tocado/nuevo aparece en el lint**.

---

## Archivos creados

| Archivo | Qué es |
|---|---|
| `src/app/(agent)/dashboard/preferencias/actions.ts` | `updateAgencyPhoneAction` (server action, gateada por admin) |
| `src/components/dashboard/AgencyPhoneForm.tsx` | Form client del teléfono de la agencia (rhf + zod) |
| `src/components/dashboard/PreferencesContent.tsx` | Las preferencias personales (localStorage) extraídas a un client component |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/types/index.ts` | `phone_wa: string` (NOT NULL) en la interface `Agency` |
| `src/app/(agent)/register/actions.ts` | El insert de `agencies` ahora setea `phone_wa: data.phoneWa` |
| `src/app/(agent)/dashboard/preferencias/page.tsx` | De client puro → **Server Component**: lee rol + teléfono de la agencia y monta el form (admin) + las preferencias |

---

## 1. Registro (`register/actions.ts`)
El insert de `agencies` pasó a setear `phone_wa: data.phoneWa` — **el mismo
teléfono que el del agente admin que crea la agencia**. Razón (comentada en el
código): el dueño es el contacto natural de la agencia recién creada, así no hace
falta un campo nuevo en el form de registro; lo puede cambiar después en
Preferencias si la agencia tiene otro número. Como `phone_wa` es NOT NULL, esto
era obligatorio: sin setearlo, el insert fallaría.

## 2. Tipo `Agency`
`phone_wa: string` (no nullable, refleja el NOT NULL de la base), con comentario
de su origen (hereda del admin / editable en Preferencias / futuro fallback).

## 3. Preferencias — edición del teléfono de la agencia (lo central)

### El gating por admin (en dos capas)
- **Página (`preferencias/page.tsx`)**: ahora es **Server Component**. Lee la fila
  `agents` del user (`role, agency_id`). `isAgencyAdmin = role === "admin"`. El
  `AgencyPhoneForm` **solo se renderiza si `isAgencyAdmin`** — un agente normal ni
  ve el campo. El teléfono actual de la agencia se trae solo en ese caso (para
  precargar el form) y se pasa como `initialPhone`.
- **Action (`updateAgencyPhoneAction`)**: la barrera real. Valida `phone_wa` con
  zod (`/^\d{10,}$/`), saca el `user` del server, lee su fila `agents`
  (`agency_id, role`), y si `role !== "admin"` → `{ error: "No autorizado" }`. El
  **`agency_id` se deriva de la fila del caller, nunca del cliente**. Ocultar el
  campo en la UI no alcanza; la action revalida igual.

### Por qué service role
No hay policy de UPDATE de `agencies` para usuarios (solo `Public read agencies`
de SELECT). Así que la action escribe con `createAdminClient()` (service role),
**acotando el UPDATE a `caller.agency_id`** (`.eq("id", caller.agency_id)`) — mismo
patrón que las otras escrituras administrativas (registro, equipo, suscripción).

### Separación agencia vs agente
El teléfono de la **agencia** se edita en Preferencias (sección "Datos de la
agencia"); el teléfono del **agente** sigue editándose en Perfil (`ProfileForm`).
Son campos distintos (`agencies.phone_wa` vs `agents.phone_wa`). El copy del form
lo aclara: "Es distinto del tuyo, que editás en Perfil."

### Validación
Mismo formato que el resto del proyecto: `/^\d{10,}$/` (solo dígitos, mín. 10, sin
+ ni espacios). Obligatorio (no puede quedar vacío, coherente con el NOT NULL). Se
valida en el cliente (zod en el form, UX) y se revalida en la action (barrera real).

### Refactor de la página (necesario)
La página era `"use client"` entera (preferencias en localStorage). Para poder leer
rol/agencia server-side hubo que volverla Server Component. Las preferencias
personales se movieron tal cual a `PreferencesContent.tsx` (client, mismo
localStorage, mismo comportamiento — el `eslint-disable` del seed en efecto viajó
con el código). La página ahora renderiza, dentro del mismo `space-y-6`:
`{isAgencyAdmin && <AgencyPhoneForm/>}` arriba y `<PreferencesContent/>` debajo.

---

## Lo que NO se tocó (Parte 2)
- **Queries del modal y `useProperties`**: NO se agregó `agency:agencies(phone_wa)`
  en el select. Se hará junto con la lógica de fallback (cuando una propiedad pueda
  quedar sin agente), para no dejar el join sin usar.
- **El fallback de WhatsApp** (`agent?.phone_wa ?? agency?.phone_wa`): sin cambios.
- **La policy `Public insert lead`**, el borrado de agente, etc.: fuera de alcance.

---

## Para probar
1. **Registro**: crear una agencia nueva → la fila `agencies` queda con
   `phone_wa` = el teléfono que cargó el admin. (Antes el insert habría fallado por
   el NOT NULL.)
2. **Admin en Preferencias**: aparece la sección "Datos de la agencia" con el
   teléfono precargado; editarlo y guardar lo actualiza.
3. **Agente normal en Preferencias**: NO ve la sección de la agencia, solo sus
   preferencias personales. Si forzara la action (tampering), recibe "No autorizado".

> Nota: no verifiqué contra la base/Auth reales (sin conexión Supabase en este
> entorno). `tsc` y `lint` pasan. Lo que más conviene confirmar en vivo: que el
> registro ya no rompa por el NOT NULL, y que el UPDATE con service role acotado a
> la agencia del caller funcione (y que un agente normal sea rechazado).
