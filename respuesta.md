# Implementación — Paso 1: el admin de agencia edita/elimina propiedades de su agencia

> Hecho el 11 jun 2026. Un `admin` (agents.role = 'admin') ahora puede editar,
> eliminar y cambiar el estado (pausar/activar/vendida/alquilada) de las
> propiedades de TODA su agencia. Un agente normal sigue tocando solo lo suyo.
> Vía **service role con validación server-side** (patrón de `createAgentAction`).
> NO se tocaron las policies RLS. NO se implementó reasignación de agente (Paso 2):
> ningún update escribe `agent_id`, ningún campo nuevo de "agente asignado".

Build: `npx tsc --noEmit` → **0 errores**. `npm run lint` → solo los 5 problemas
preexistentes conocidos (ClusterLayer ×2, StatsCard, PropertyForm, RegisterForm);
**ningún archivo tocado aparece en el lint**.

---

## El corazón: `authorizePropertyAccess` (lo sensible)

Reemplaza a `verifyOwnership` en `propiedades/actions.ts`. Donde antes la
autorización era binaria ("es tuyo o no"), ahora distingue **dueño** de **admin
de la agencia** y devuelve con qué client hay que escribir.

```ts
async function authorizePropertyAccess(id: string): Promise<{
  ok: boolean;
  error?: string;
  mode?: "owner" | "admin";
  supabase: Awaited<ReturnType<typeof createClient>>; // client normal (lecturas)
  db: SupabaseClient;                                  // client de ESCRITURA
}>
```

Lógica, en orden:
1. `getUser()` → sin user: `{ ok:false, error:"No autenticado" }`.
2. Lee la propiedad **sin filtrar por agent_id** (`select agent_id, agency_id ... eq id`). Si no existe → `"Propiedad no encontrada"`.
3. `property.agent_id === user.id` → **`mode:"owner"`**, `db = supabase` (client normal, la RLS `agent_id = auth.uid()` lo permite, flujo de siempre).
4. Si no es dueño: lee la fila `agents` del user (`role, agency_id`). Si `role === 'admin'` **y** `agent.agency_id === property.agency_id` → **`mode:"admin"`**, `db = createAdminClient()` (service role).
5. Cualquier otro caso → `"Propiedad no encontrada"` (mismo mensaje que "no existe", para no revelar que la propiedad existe pero es ajena).

### Por qué es seguro
- **`role` y `agency_id` del que llama se leen SIEMPRE del server** (de la fila `agents` por `auth.uid()`), nunca de props del cliente.
- Cuando se usa service role (que salta RLS), **la comparación `agent.agency_id === property.agency_id` es la única barrera** — y está en el helper, que llaman todas las actions que pueden tocar algo ajeno. Sin esa igualdad, no se entra al `mode:"admin"`.
- El `db` lo decide el helper, no la action: imposible que una action "se olvide" de usar el client correcto para el modo.
- El mensaje de error es idéntico para "no existe" y "ajeno sin permiso": no filtra la existencia de propiedades de otras agencias.

### Por qué las lecturas siguen con el client normal
`getPlanUsage` y la lectura de `agency_id` en `updatePropertyAction` usan el
`supabase` normal incluso en `mode:"admin"`: un admin es **miembro de su agencia**,
y la RLS `Agency members read agency properties` + `Agency members read own
subscription` ya le permiten leer esos datos. Solo la **escritura** necesita saltar
RLS, así que solo la escritura usa `db`.

---

## Cómo se aplicó a cada action

Las 6 actions (`pause`/`activate`/`markAsSold`/`markAsRented`/`delete`/`update`)
ahora: llaman `authorizePropertyAccess(id)`, devuelven el error si `!ok`, y
**escriben con `db`** (normal para owner, service role para admin). Toda la lógica
previa se mantuvo intacta:
- `activate`/`update`: la captura del error `23514`/"Límite" del trigger sigue igual.
- `revalidatePath("/dashboard/propiedades")` en todas.
- `update`: además del UPDATE de la propiedad, el **reemplazo de imágenes**
  (`property_images` delete + insert) también pasó a usar `db` — la RLS de
  `property_images` también está atada al `agent_id` dueño, así que un admin
  editando algo ajeno necesita service role ahí también.
- **`createPropertyAction` NO se tocó**: crear sigue igual (el admin crea a su
  propio nombre). La reasignación es el Paso 2.

---

## Resto de los cambios

### `propiedades/[id]/editar/page.tsx` — abrir la edición
Antes traía la propiedad con `.eq("agent_id", user.id)` (un admin no podía abrir
algo ajeno). Ahora: la trae **por id sin ese filtro**, y valida server-side con el
**mismo criterio que el helper** — si `property.agent_id !== user.id`, lee la fila
`agents` del user y exige `role === 'admin' && agency_id === property.agency_id`;
si no, `redirect("/dashboard/propiedades")`. La RLS de lectura por agencia ya
permite que un miembro lea la propiedad.

### `propiedades/page.tsx` — listado
- Lee también `role`. `isAgencyAdmin = role === 'admin'`.
- **Admin**: filtra por `agency_id` (ve todas las de la agencia) y trae
  `agent:agents(full_name)` en el select. **Agente normal**: filtra por
  `agent_id` (solo las suyas, sin el join), igual que hoy.
- Normaliza el join `agent` (objeto/array) a `agent_name` y arma las `PropertyRow`.
- Pasa `<PropertiesTable properties={rows} showAgent={isAgencyAdmin} />`.

### `PropertiesTable.tsx` — columna "Agente"
- `PropertyRow` ganó `agent_name?: string | null`.
- Prop nuevo `showAgent?: boolean` (default `false`).
- Cuando `showAgent`: columna "Agente" en la tabla desktop (entre Estado y
  Acciones) y el nombre en el pie de la card mobile (junto al badge de estado).
  Si `agent_name` es null → "—". Para el agente normal la columna ni se renderiza.

---

## Decisiones técnicas
- **`db` tipado como `SupabaseClient`** (de `@supabase/supabase-js`): tanto el
  client SSR normal como el admin son `SupabaseClient`, así que ambos encajan sin
  casts. `tsc` lo valida limpio.
- **No se tocó RLS**: las policies de `properties`/`property_images` quedan
  exactamente como estaban. El acceso del admin a lo ajeno es 100% vía service
  role + validación en la action, como pediste (opción B).
- **`createAdminClient()` solo se instancia en `mode:"admin"`** (dentro del
  helper, en esa rama) — no se crea de gusto para el flujo del dueño normal.

---

## Para probar (lo que conviene verificar)
1. **Agente normal**: ve y gestiona solo sus propiedades (sin columna "Agente").
   Igual que antes. Editar/eliminar/pausar lo suyo funciona.
2. **Admin de agencia**: el listado muestra TODAS las de la agencia + columna
   "Agente". Puede editar, eliminar y cambiar estado de propiedades de **otros
   agentes** de su agencia.
3. **Seguridad (lo crítico)**: un admin NO puede tocar una propiedad de OTRA
   agencia (el helper rechaza por `agency_id` distinto → "Propiedad no
   encontrada"). Un agente normal NO puede tocar nada ajeno (no entra al
   `mode:"admin"`). Entrar a `/dashboard/propiedades/<id-ajeno>/editar` de otra
   agencia redirige al listado.

> Nota: no verifiqué el flujo contra la base/Auth reales (sin conexión Supabase en
> este entorno). `tsc` y `lint` pasan. La parte que MÁS conviene testear en vivo es
> el `mode:"admin"` con service role: que un admin edite una propiedad ajena de su
> agencia (debe funcionar) y que falle sobre otra agencia (debe rebotar). Es donde
> la única barrera es la validación de agencia del helper.
