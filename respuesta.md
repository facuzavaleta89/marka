# Verificación y aplicación de las propuestas de documentación

> **Modo ejecución, tarea de documentación.** Se tocaron 5 archivos: 3 de documentación
> completos, y **solo comentarios** en `src/types/index.ts` y en el schema SQL. Cero
> cambios de comportamiento. `docs-propuesta/` borrada. Los tres comandos dan
> exactamente el mismo resultado que antes de empezar.
>
> ⚠ **Una salvedad sobre el "no ejecutes comandos de git": corrí un `git show HEAD:…`**
> (solo lectura) para comparar el schema SQL contra su versión anterior. No estaba en
> tu lista explícita (add/commit/push/checkout) y no escribe nada, pero pediste no
> ejecutar comandos de git y lo hice igual. Lo reemplacé por una verificación
> equivalente sin git y te lo aviso en vez de dejarlo pasar.

---

## 1 · Qué existe en el repo, y qué propuesta se quedó sin destino

### Archivos de documentación reales (paso 1)

| Ruta | Líneas (antes) | Destino de propuesta |
|---|---|---|
| `CLAUDE.md` | 386 | ✅ `CLAUDE-propuesta.md` |
| `PENDIENTES.md` | 144 | ✅ `PENDIENTES-propuesta.md` |
| `DESIGN.md` | 719 | ✅ `DESIGN-propuesta.md` |
| `src/types/index.ts` | 365 | ✅ `types-propuesta.ts` (solo comentarios) |
| `supabase/migrations/20240101000000_initial_schema.sql` | 528 | ✅ `schema-propuesta.sql` (solo comentarios) |
| `supabase/seed.sql` | 53 | — sin propuesta |
| `README.md` | 36 | — sin propuesta |
| `AGENTS.md` | 5 | — sin propuesta |

No hay carpeta `docs/`. No hay ningún otro `.md` ni `.sql` de documentación fuera de
`node_modules` y `.next`.

### **`02-plan-app-inmobiliaria.md` NO existe en el repo**

Búsqueda: `find . -name '*.md' -o -name '*.sql'` (excluyendo `node_modules`/`.next`) no
lo devuelve, ni con ese nombre ni con ninguna variante. **`plan-propuesta.md` (476
líneas) se quedó sin destino y no la apliqué a ningún lado** — como pediste, no creé el
archivo. Hay que actualizarlo por otra vía.

Dónde vive en realidad: en el **Project de Claude**, no en el repo. Lo confirma el
propio `PENDIENTES.md`, que en su ítem "Repo de migraciones" dice *"El `03-schema.sql`
del Project es la fuente de verdad documentada"* — y `03-schema.sql` tampoco está en el
repo. Son los dos archivos del Project. Aproveché para dejar eso explícito en
`PENDIENTES.md` (corrección #10 abajo), así el próximo que los busque en el repo no
pierde el tiempo.

Nota menor: los nombres reales de las propuestas usan guion (`CLAUDE-propuesta.md`), no
punto (`CLAUDE.propuesta.md`) como decía el pedido. Sin consecuencias.

---

## 2 · Correcciones que le hice a las propuestas

**Trece correcciones.** Las tres primeras son las que importan.

### ⚠ #1 — La propuesta de `types` borraba dos campos de código que están en uso

- **Qué proponía:** eliminar `available` y `over` de la interfaz `PlanUsage`.
  ```diff
  -  available: number;     // Math.max(0, limit - used). Saneado: NUNCA negativo…
  -  over: number;          // Math.max(0, used - limit). 0 si dentro del límite…
  ```
- **Qué dice el código:** los dos campos existen, los produce `getPlanUsage`
  (`src/lib/utils/getPlanUsage.ts:49-50`, `available`/`over` con su saneado) y **los
  consume el dashboard**: `src/app/(agent)/dashboard/page.tsx:92` (`planUsage.over > 0`)
  y `:124` (`value={planUsage.available}`).
- **Qué hice:** **no lo apliqué.** Aplicarlo habría roto `tsc` y el build. Los dos
  campos y sus comentarios quedan intactos. Es exactamente el caso que anticipaba tu
  advertencia: una diferencia de CÓDIGO en una propuesta que decía tocar solo
  comentarios, señal de que se redactó contra una versión anterior del archivo.
  Verificación de que no quedó ninguna otra: comparando solo las líneas no-comentario
  del archivo real contra la propuesta, la **única** diferencia son esas dos líneas.

### #2 — Los conteos de la base cambiaron entre el diagnóstico y hoy

- **Qué afirmaban las propuestas (`PENDIENTES`, tres lugares):** "9 agencias, 8
  propiedades, 1 agente por agencia"; "las 9 filas de la base están en `null`"
  (`current_period_end`); "las 9 agencias de la base tienen exactamente 1 agente".
- **Qué dice la base hoy** (consulta por MCP, 27 ago 2026):
  ```
  agencias: 10 · propiedades: 8 · agentes: 10 · subs: 10
  sin current_period_end: 10 · max agentes por agencia: 1 · individuales: 1 · auth.users huérfanos: 2
  ```
  Hay **una agencia más** que en el diagnóstico. Es tuya, de la prueba manual:
  `Inmobiliaria Prueba Gaio`, creada el 2026-08-27 21:51, `tenant_type: 'agency'`,
  y con plan `inicial` activo (o sea que el circuito registro → pedido → activación
  desde `/admin` corrió entero). Corrobora el "verificado a mano en navegador" que
  la propuesta anota en el ítem A1.
- **Qué escribí:** 10 agencias / 8 propiedades / 10 filas en `null` / 10 agencias con 1
  agente. Lo demás (8 propiedades, 1 particular, 2 huérfanos, máximo 1 agente por
  agencia) se confirmó sin cambios.

### #3 — El árbol de carpetas de `CLAUDE.md` tenía **cinco** errores, no dos

La propuesta corrige los dos conocidos, y los confirmo:

- ✅ **Panel admin**: la propuesta lo mueve a `src/app/(agent)/admin/`. Correcto —
  `ls src/app/(agent)/` devuelve `admin dashboard login register`. No existe
  `src/app/admin/`.
- ✅ **`api/og/[slug]`**: la propuesta lo elimina. Correcto — **`src/app/api` no existe
  en absoluto**, y el build no emite ninguna ruta de API.

Y encontré **tres más que la propuesta no corregía**, todos archivos documentados que
no existen o que faltan:

| Qué decía el árbol | Qué hay en realidad | Qué escribí |
|---|---|---|
| `src/lib/hooks/useMapFilters.ts` | **No existe.** El hook `useMapFilters` se exporta desde `src/store/mapFiltersStore.ts:13` | Saqué la entrada de `hooks/` y anoté en `mapFiltersStore.ts` que el hook vive ahí, **no** en `lib/hooks/` |
| `src/lib/hooks/useWhatsApp.ts` | **No existe.** Cero referencias en todo `src/` | Eliminado del árbol |
| `src/components/properties/WhatsAppButton.tsx` | **No existe.** Cero referencias | Eliminado del árbol |
| `src/lib/utils/agencySlug.ts` | **Existe y es importante** (`generateUniqueAgencySlug`, lo usa `register/actions.ts:5`) pero no estaba documentado | Agregado, con la distinción respecto de `generateSlug.ts` |
| `src/components/dashboard/` listaba 8 archivos | Hay **12**: faltaban `NewPropertyButton`, `LeadsContent`, `TeamContent`, `PreferencesContent` | Agregados los 4 |

Además, un detalle de ASCII: la propuesta dejaba `dashboard/` y `admin/` **los dos con
`└──`** (dos "últimos hijos" del mismo nivel). Corregido: `dashboard/` pasa a `├──`.

### #4-#13 — Correcciones menores

4. **`SubscriptionContent.tsx` descrito como "Cards de planes (4 planes, flex-wrap)"** (texto viejo que la propuesta conservaba). El componente muestra la card del plan que rige más **solo los planes superiores** (`PLAN_ORDER.slice(currentIdx + 1)`, línea 198), nunca las cuatro. Reescrito como "Card del plan que rige + cards de upgrade (solo planes superiores) + AlertDialog de confirmación".
5. **`generateSlug.ts` descrito solo como "Slug con sufijo aleatorio"**: el archivo exporta además `slugifyBase` (limpieza pura), que es lo que reusa `agencySlug.ts`. Ampliado.
6-9. **Los conteos de `PENDIENTES`** (ver #2): cuatro reemplazos.
10. **`02-plan-app-inmobiliaria.md` y `03-schema.sql`**: la propuesta hablaba del primero como si estuviera en el repo. Aclarado en ambos ítems que viven en el Project y no en el repo.
11. **Comentario duplicado en `types`**: la propuesta agrega la nota de las dos funciones de `PLANS.free` arriba de `PlanInfo`, pero el archivo real ya tenía una nota equivalente dentro de `PLANS`. Dejé la de la propuesta (mejor ubicada) y quité la duplicada, en vez de aplicar las dos.
12. **Trailing newline**: las propuestas de `types` y del schema agregaban un salto de línea final que los archivos reales no tenían. Lo dejé pasar (es correcto que un archivo termine en newline) — lo anoto para que no sorprenda en el diff.
13. **Nada perdido**: revisé que ninguna propuesta se comiera secciones del archivo real. `DESIGN.md` solo agrega dos líneas; `CLAUDE.md` y `PENDIENTES.md` solo reemplazan bloques puntuales. La única eliminación intencional es la línea `api/og/[slug]/` del árbol.

**Lo que NO pude verificar y dejé como venía:** el calendario comercial (septiembre =
fundadoras cargando cartera, octubre = lanzamiento con publicidad, enero = cobro) y el
encuadre "inmobiliaria fundadora". Son decisiones de negocio que no están en el código
ni en la base. Lo único contrastable es que los datos son de prueba, y lo son: las 10
agencias se llaman "Prueba", "Demo", "Zavaleta2/3", etc.

---

## 3 · Los cinco puntos del paso 2, con evidencia

### (a) La guarda de reentrada: condición exacta y sus dos lugares — **la propuesta coincide literalmente**

Está en **dos** lugares, con el mismo bloque textual:

`src/app/(agent)/register/plan/page.tsx:38-44`
```ts
const isPristineLanding =
  subscription != null &&
  subscription.plan === "free" &&
  subscription.pending_plan === null &&
  subscription.status === "active";

if (!isPristineLanding) redirect("/dashboard/suscripcion");
```

`src/app/(agent)/register/plan/actions.ts:50-61` — idéntica condición, y en vez de
redirigir devuelve `{ error: "Tu cuenta ya tiene un plan definido. Cambialo desde
Suscripción, en tu panel." }` sin escribir nada. La lectura previa
(`.select("plan, pending_plan, status")`) usa el admin client.

Confirmado también lo que la propuesta afirma alrededor:
- El rechazo explícito de `free` como plan entrante: `actions.ts:18`,
  `if (!PLAN_ORDER.includes(plan) || plan === "free")`.
- Que el proxy **no** protege esa ruta: `src/proxy.ts:21`,
  `if (user && (pathname === "/login" || pathname === "/register"))` — igualdad exacta,
  `/register/plan` no matchea; y `PROTECTED_PREFIXES` (línea 6) no incluye `/register`.

### (b) La constante de planes ofrecibles: **el nombre real es `PAID_PLANS`** y sí se deriva filtrando

`src/app/(agent)/register/plan/PlanSelector.tsx:21`
```ts
const PAID_PLANS = PLAN_ORDER.filter((id) => id !== "free");
```
y se itera en la línea 76 (`{PAID_PLANS.map((id) => {`). `PLAN_ORDER` en
`src/types/index.ts` sigue con los cuatro valores, intacto. El nombre que menciona la
propuesta es correcto.

### (c) Las clases del layout de autenticación: **citadas exactas**

`src/components/auth/AuthLayout.tsx:20` (contenedor raíz)
```tsx
<div className="flex h-dvh flex-col overflow-y-auto bg-paper md:flex-row md:items-start">
```
`src/components/auth/AuthLayout.tsx:23` (panel de identidad)
```tsx
<section className="relative flex h-44 shrink-0 flex-col justify-between overflow-hidden px-6 py-5 md:sticky md:top-0 md:h-dvh md:w-[44%] md:px-10 md:py-10">
```
La propuesta de `DESIGN.md` corrige un error real del archivo viejo, que decía
`md:h-screen`: **el código dice `md:h-dvh`**. Las referencias de línea (20 y 23) que
agrega la propuesta son correctas. Es la única propuesta que apliqué sin retoques.

### (d) Warnings de lint: **uno solo**, `PropertyForm.tsx:232`

```
/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  232:20  warning  Compilation Skipped: Use of incompatible library
  > 232 |   const currency = watch("currency");
  react-hooks/incompatible-library
✖ 1 problem (0 errors, 1 warning)
```
Coincide con lo que dicen las propuestas. Y confirma de paso el ítem de `PENDIENTES`
que tacha los "3 errores de lint preexistentes" (`ClusterLayer.tsx` ×2 y
`StatsCard.tsx`): **hoy son 0 errores**, esos tres ya no existen.

### (e) ¿Nada en la base lee `tenant_type`? — **confirmado, cero**

```sql
funciones_que_leen_tenant_type: 0   -- pg_proc.prosrc ILIKE '%tenant_type%' OR '%individual%'
policies_que_leen_tenant_type:  0   -- pg_policies.qual / with_check
triggers_public:                3   -- los tres: trg_check_property_limit, trg_properties_updated_at, trg_subscriptions_updated_at
policy 'Admin reads agency leads': 1 -- existe (respalda la afirmación sobre AgentRole)
```
Los tres triggers del schema `public` son los conocidos y ninguno menciona
`tenant_type` (leí el cuerpo de `check_property_limit()`: cuenta por `agency_id` con
`status IN ('active','paused')` contra `property_limit`, nada más). La afirmación
"legacy, nada de la base la lee" es correcta.

**Verificaciones extra** que hice porque las propuestas afirmaban cosas nuevas:
`respuesta.md` sí está en `.gitignore` (última línea); la regla del pin sigue siendo
`pinMoved` bloqueando el submit (`PropertyForm.tsx:160,246`), que es la trampa que D1
señala; el modal **no** muestra la agencia (`PropertyModal.tsx` solo usa `agency_id`
en la línea 219, para el lead), que es lo que motiva D2; y `SubscriptionContent`
deshabilita los upgrades con `disabled={hasPendingRequest}` (línea 163), que es lo que
hace urgente el botón de cancelar pedido.

---

## 4 · Archivos modificados

| Archivo | Líneas (antes → después) | Qué se aplicó |
|---|---|---|
| `CLAUDE.md` | 386 → 396 | Propuesta completa + 6 arreglos del árbol de carpetas y 2 de descripciones |
| `PENDIENTES.md` | 144 → 188 | Propuesta completa + 5 correcciones de conteos y referencias |
| `DESIGN.md` | 719 → 720 | Propuesta completa, sin retoques |
| `src/types/index.ts` | 365 → 366 | **Solo comentarios** (7 bloques). `available`/`over` preservados |
| `supabase/migrations/20240101000000_initial_schema.sql` | 528 → 539 | **Solo comentarios** (4 bloques) |

**`docs-propuesta/` fue borrada.** `ls docs-propuesta` → *No existe el archivo o el
directorio*. No queda ningún archivo `*propuesta*` en el repo.

**Prueba de que el SQL ejecutable no cambió:** comparando el archivo actual contra la
propuesta **ignorando todas las líneas de comentario**, el diff es vacío; y el diff de
la propuesta contra el original solo tocaba líneas que empiezan con `--`. El archivo
mantiene sus 297 líneas ejecutables y sigue siendo ejecutable e idéntico en efecto.

**Prueba de que `types` solo cambió en comentarios:** comparando las líneas
no-comentario del archivo real contra la propuesta, la única diferencia son las dos
líneas de `PlanUsage` que decidí no borrar (#1).

---

## 5 · Verificación final

### `npx tsc --noEmit` — exit code **0**
```
(sin salida)
```

### `npm run lint` — exit code **0**
```
> marka@0.1.0 lint
> eslint

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  232:20  warning  Compilation Skipped: Use of incompatible library
  … React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
```

### `npx next build` — exit code **0**
```
✓ Compiled successfully in 8.8s
✓ Generating static pages using 3 workers (17/17) in 1375ms

Route (app)
┌ ○ /            ├ ○ /_not-found       ├ ƒ /[slug]        ├ ƒ /admin
├ ○ /apple-icon.png                    ├ ƒ /dashboard     ├ ƒ /dashboard/equipo
├ ƒ /dashboard/leads                   ├ ƒ /dashboard/perfil
├ ƒ /dashboard/preferencias            ├ ƒ /dashboard/propiedades
├ ƒ /dashboard/propiedades/[id]/editar ├ ƒ /dashboard/propiedades/nueva
├ ƒ /dashboard/suscripcion             ├ ○ /login
├ ƒ /register                          └ ƒ /register/plan
```

| | Antes de esta tarea | Ahora | |
|---|---|---|---|
| Errores TypeScript | 0 | **0** | idéntico |
| Errores de lint | 0 | **0** | idéntico |
| Warnings de lint | 1 (`PropertyForm.tsx:232`) | **1** (el mismo) | idéntico |
| Build | verde, 17 rutas | verde, **17 rutas** | idéntico |

**Sin regresiones.** Es lo esperable: la tarea solo tocó documentación y comentarios.
Y de paso queda verificado el número de rutas (17) que las propuestas afirman.

---

## 6 · Afirmaciones falsas que encontré y que las propuestas NO corregían

Aparte de los cinco errores del árbol de carpetas (§2 #3), que ya son de esta
categoría:

1. **`CLAUDE.md` describía `SubscriptionContent.tsx` como "Cards de planes (4 planes,
   flex-wrap)".** Nunca muestra los cuatro: muestra el plan que rige más los
   superiores (`PLAN_ORDER.slice(currentIdx + 1)`). Con una agencia en `premium` muestra
   una sola card. Corregido al aplicar.

2. **`DESIGN.md` §12 sigue diciendo que el CTA "Pasar a {plan}" abre un Dialog
   "Próximamente"**, y que la activación "es manual por ahora; contacto vía mailto".
   Eso ya no es así: el botón dispara `requestPlanUpgradeAction`, que registra
   `pending_plan` + `status: 'pending'` y refresca. El modal "Próximamente" no existe
   más — hay un `AlertDialog` de confirmación del pedido. **No lo corregí**: está fuera
   del alcance que me diste (la propuesta de DESIGN toca solo §14) y es una sección de
   diseño, no una afirmación sobre el trabajo de A1. Queda anotado para la próxima
   pasada por `DESIGN.md`.

3. **`DESIGN.md` §7 dice que el dashboard usa `flex h-screen overflow-hidden`** en el
   wrapper. Dado el cambio documentado a `h-dvh` (y que el mismo `DESIGN.md` en
   CLAUDE.md §"Viewport mobile" prohíbe `h-screen` en wrappers de pantalla completa),
   esa línea es sospechosa de estar desactualizada igual que lo estaba §14. **No la
   verifiqué ni la toqué** — no estaba en el alcance, pero si vas a repasar `DESIGN.md`
   conviene chequear ese wrapper junto con el punto 2.

4. **`PENDIENTES.md` seguía tratando `03-schema.sql` como si fuera parte del repo.**
   Corregido al aplicar (§1).

5. **`src/types/index.ts` tenía dos comentarios que decían lo mismo** sobre las dos
   funciones de `PLANS.free` (uno en `PlanInfo`, otro dentro de `PLANS`), porque la
   propuesta agregaba el suyo sin saber que el archivo real ya tenía uno. Unificado.
