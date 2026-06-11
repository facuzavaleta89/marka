# Implementación — Home del dashboard diferenciado por rol

> Hecho el 11 jun 2026. Las métricas del home (`dashboard/page.tsx`) ahora
> reflejan toda la agencia para un admin (`role === 'admin'`) y solo lo del
> agente para un agente normal — igual que ya se hizo en el listado de propiedades.

Build: `npx tsc --noEmit` → **0 errores**. `npm run lint` → solo los 5 problemas
preexistentes conocidos (ClusterLayer ×2, StatsCard, PropertyForm, RegisterForm);
**`dashboard/page.tsx` no aparece en el lint**.

---

## Archivo modificado

`src/app/(agent)/dashboard/page.tsx` (único archivo tocado, solo lecturas).

---

## Qué se hizo

### 1. Lee el rol
El select de `agents` pasó de `select("agency_id")` a `select("agency_id, role")`.
`const isAgencyAdmin = agent.role === "admin"`.

### 2. Un solo filtro reutilizado (`scope`)
Para no repetir el condicional en cada query, defino el filtro una vez:

```ts
const scope = isAgencyAdmin
  ? { col: "agency_id" as const, val: agent.agency_id }
  : { col: "agent_id" as const, val: user.id };
```

y lo aplico con `.eq(scope.col, scope.val)` en las 4 queries que antes filtraban
por `agent_id`:

| Métrica | Antes | Ahora |
|---|---|---|
| Propiedades activas | `.eq("agent_id", user.id)` + `status='active'` | `.eq(scope.col, scope.val)` + `status='active'` |
| Leads este mes | `.eq("agent_id", user.id)` + `created_at >= 30d` | `.eq(scope.col, scope.val)` + `created_at >= 30d` |
| Vistas totales | `views_count` por `agent_id` (reduce en JS) | `views_count` por `scope` (reduce igual) |
| Últimas 3 propiedades | `.eq("agent_id", user.id)` orden desc limit 3 | `.eq(scope.col, scope.val)` orden desc limit 3 |
| Disponibles del plan | `getPlanUsage(supabase, agent.agency_id)` | **sin cambios** (ya por agencia) |

- **Admin**: las 4 quedan por `agency_id` → números de toda la agencia.
- **Agente normal**: las 4 quedan por `agent_id` → exactamente como hoy.

El `as const` en `col` hace que TS infiera `"agency_id" | "agent_id"` (literales),
así `.eq()` lo acepta sin fricción de tipos. `tsc` limpio.

### 3. La RLS acompaña
No hace falta nada extra: la RLS ya deja pasar lo correcto según el rol.
- `properties` por `agency_id`: `Agency members read agency properties` permite al
  admin leer todas las de su agencia.
- `leads` por `agency_id`: `Admin reads agency leads` permite al admin contar los
  de toda la agencia (un agente normal solo ve los suyos por `Agent reads own leads`,
  pero acá filtra por `agent_id` igual).
- `getPlanUsage` ya contaba por `agency_id` desde siempre.

---

## Lo que NO se tocó
- **No se agregó "de quién es cada propiedad"** en las últimas 3 del home: el
  prompt lo dejaba opcional y la tabla del home (inline, simple) no muestra agente.
  El foco era que los números sean de la agencia; la columna "Agente" ya existe en
  el listado completo (`/dashboard/propiedades`). Mantenerlo simple acá es más
  coherente con el home como vista de resumen.
- **`getPlanUsage`, las otras páginas, y toda escritura**: intactas. Solo se
  condicionaron las lecturas del home.

---

## Para probar
1. **Agente normal**: el home muestra sus números (propiedades activas, leads,
   vistas, últimas 3) — idéntico a antes.
2. **Admin de agencia**: las mismas 4 cards y la lista de últimas propiedades
   ahora reflejan **toda la agencia** (propiedades y leads de todos los agentes).
   "Disponibles del plan" no cambia (siempre fue por agencia).

> Nota: no verifiqué contra la base/Auth reales (sin conexión Supabase en este
> entorno). `tsc` y `lint` pasan. La diferenciación se apoya en la RLS ya
> aplicada (lectura por agencia para el admin), igual que en el listado y en la
> pantalla de Consultas.
