# Puesta al día de la documentación tras la fase de modelo de agencias

> **Modo ejecución, tarea de documentación.** Se tocaron 4 archivos `.md` y los
> comentarios + dos objetos del schema SQL. **Ningún archivo de código fuente.**
> Cero comandos de git, cero SQL de escritura.
>
> Los tres comandos dan **exactamente lo mismo que en el paso 1**: 0 errores de TS, 0 de
> lint, 1 warning conocido, build verde con **18 rutas**.
>
> **Encontré 3 afirmaciones falsas en `DESIGN.md` y `PLAN-ORIGINAL.md`** que no tenían
> nada que ver con este grupo de trabajo, y **1 diferencia entre el contexto que me
> pasaste y lo medido** (§3). Están en §3 y §4.

---

## 1 · Lo relevado (paso 1)

### a. Archivos de documentación en el repo

| Archivo | Líneas (antes) |
|---|---|
| `CLAUDE.md` | 397 |
| `DESIGN.md` | 720 |
| `PENDIENTES.md` | 188 |
| **`PLAN-ORIGINAL.md`** | 476 |
| `README.md` | 36 |
| `AGENTS.md` | 5 |
| `respuesta.md` | (este archivo, ignorado por git) |
| `supabase/migrations/20240101000000_initial_schema.sql` | 663 |
| `supabase/seed.sql` | 53 |

⚠ **`PLAN-ORIGINAL.md` es nuevo respecto de mi último relevamiento**: es el plan original
que en una tanda anterior reporté como "sin destino en el repo" porque vivía en el
Project. Alguien lo agregó, con un encabezado de "DOCUMENTO HISTÓRICO" correcto. Lo tomé
en cuenta (§2).

`README.md` es el de `create-next-app` sin tocar y `AGENTS.md` son 5 líneas de reglas de
Next.js — ninguno describe el dominio (§6).

### b. Estado real de la base

**`agencies` — 12 columnas:**

| # | columna | tipo | nullable | default |
|---|---|---|---|---|
| 1-10 | `id`, `city_id`, `name`, `slug`, `logo_url`, `website`, `brand_color`, `created_at`, `tenant_type`, `phone_wa` | — | — | (sin cambios) |
| **11** | `license_number` | text | **YES** | — |
| **12** | `approval_status` | text | **NO** | **`'pending'::text`** |

```
agencies_approval_status_check  CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
agencies_tenant_type_check      CHECK ((tenant_type = ANY (ARRAY['individual'::text, 'agency'::text])))
agencies_city_id_fkey           FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT
agencies_pkey / agencies_slug_key
```
```
CREATE INDEX idx_agencies_approval_status ON public.agencies USING btree (approval_status)
CREATE UNIQUE INDEX idx_agencies_license_unique_approved ON public.agencies USING btree (city_id, license_number)
  WHERE ((approval_status = 'approved'::text) AND (license_number IS NOT NULL))
CREATE INDEX idx_agencies_city / agencies_pkey / agencies_slug_key
```

**`agency_reviews` — 6 columnas** (`id`, `agency_id`, `decision`, `note` nullable,
`reviewed_by` nullable, `created_at` NOT NULL `now()`):
```
agency_reviews_decision_check    CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))
agency_reviews_agency_id_fkey    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
agency_reviews_reviewed_by_fkey  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL
CREATE INDEX idx_agency_reviews_agency ON public.agency_reviews USING btree (agency_id, created_at DESC)
```
RLS habilitada, **0 policies**. Hoy tiene **3 filas** (pruebas del panel).

**Los tres triggers de `properties`:**
```
trg_check_agency_approved  BEFORE INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION check_agency_approved()
trg_check_property_limit   BEFORE INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION check_property_limit()
trg_properties_updated_at  BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION update_updated_at()
```

**`check_agency_approved()`** (cuerpo medido, copiado literal al schema del repo):
```sql
DECLARE
  agency_state TEXT;
BEGIN
  SELECT approval_status INTO agency_state FROM agencies WHERE id = NEW.agency_id;
  -- Sin fila de agencia no se publica: es un estado inconsistente, no un permiso.
  IF agency_state IS NULL OR agency_state <> 'approved' THEN
    RAISE EXCEPTION 'La agencia no está aprobada para publicar propiedades'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
```

**`check_property_limit()`** — el único cambio respecto de la versión vieja:
```sql
  -- Sin fila de suscripción NO hay cupo: antes max_allowed quedaba NULL, la
  -- comparación daba NULL y el insert pasaba sin límite alguno.
  IF max_allowed IS NULL THEN
    max_allowed := 0;
  END IF;
```

**Otras mediciones que usé:** 0 funciones y 0 policies mencionan `tenant_type`;
`current_period_end` sigue en `null` en las 10 filas; siguen los **2 usuarios de Auth
huérfanos**; y `useProperties` filtra por `city_id` + `status='active'` (+ `agency_id`
opcional en white-label) — **no mira la agencia ni su suscripción**.

### c. Baseline (paso 1) — y el de después

Idéntico antes y después de esta tarea:

| | Paso 1 | Después |
|---|---|---|
| `npx tsc --noEmit` | exit **0**, sin salida | exit **0**, sin salida |
| `npm run lint` | exit **0** — `✖ 1 problem (0 errors, 1 warning)` | igual |
| `npx next build` | exit **0**, **18 rutas** | exit **0**, **18 rutas** |

### d. Archivos nuevos del grupo de trabajo

| Ruta | Qué hace |
|---|---|
| `src/lib/utils/resolveAgentSession.ts` | Resuelve usuario + agente + agencia. Unión de 3 estados (`no_session`/`unlinked`/`ok`), cacheada por request con `cache()` |
| `src/lib/utils/getPublishBlock.ts` | Espejo en la interfaz de los dos triggers: si se puede publicar y por qué no |
| `src/lib/utils/getLatestRejectionNote.ts` | Motivo del último rechazo (service role), verificando pertenencia |
| `src/lib/utils/licenseNumber.ts` | Formato + normalización de la matrícula, compartidos client/server |
| `src/components/feedback/Notice.tsx` | Aviso persistente reutilizable (Server Component, 3 tonos) |
| `src/components/dashboard/AgencyApprovalNotice.tsx` | Aviso de dominio: pendiente / rechazada con el motivo |
| `src/components/dashboard/AgencyIdentityForm.tsx` | Nombre + matrícula, editable o solo lectura según el estado |
| `src/app/(agent)/logout/route.ts` | Route handler `GET`: `signOut()` + redirect al login con motivo |
| `src/app/(agent)/login/LoginForm.tsx` | El formulario de login (client), separado de la page (Server) |

---

## 2 · Archivos de documentación modificados

| Archivo | Líneas | Qué cambió |
|---|---|---|
| `CLAUDE.md` | 397 → **465** | Dos secciones nuevas de modelo ("Aprobación de agencias" y "Bloqueo de publicación"), tres convenciones nuevas (sesión unificada, `/logout`, avisos), registro con matrícula + rollback, árbol de carpetas con los 9 archivos nuevos, `agency_reviews` y los triggers en la referencia rápida, 6 filas nuevas en la tabla de decisiones, baseline a 18 rutas |
| `PENDIENTES.md` | 188 → **206** | A2 cerrada con su detalle; el **bucle de redirecciones tachado como RESUELTO**; bloque nuevo "A-bis — lo que falta para poder COBRAR" con el mapa sin filtrar; 4 ítems nuevos de deuda técnica; "eliminar agencias" agregado al panel de ida y vuelta; baseline y referencias muertas corregidas |
| `DESIGN.md` | 720 (igual) | **3 correcciones de afirmaciones falsas** (§4), ninguna relacionada con esta fase |
| `PLAN-ORIGINAL.md` | 476 (igual) | 3 referencias corregidas (§4) |
| `supabase/migrations/…_initial_schema.sql` | 663 → **717** | `check_agency_approved()` + `trg_check_agency_approved` completos, el bloque de "límite 0" en `check_property_limit()`, y la nota de fidelidad de la cabecera |

**El schema sigue siendo ejecutable.** Los dos objetos nuevos son **idénticos a los
medidos** en el paso 1 (comparé cuerpo por cuerpo), y todo lo demás que agregué son
comentarios. El archivo pasó de 297 a **338 líneas ejecutables**, que son exactamente las
de la función y el trigger nuevos.

**Lo más valioso que quedó escrito** son los porqués que no se pueden deducir del código:
por qué el bloqueo es un trigger y no una policy (el service role saltea las policies),
por qué el índice de matrícula es parcial (un UNIQUE común le confirmaría al impostor qué
matrículas existen), por qué la nota vive en otra tabla (`Public read agencies` con
`qual: true` + Postgres no restringe columnas en una policy), por qué `/logout` es un
route handler (un Server Component no puede borrar cookies), y por qué los triggers se
distinguen por el texto y no por el código (comparten SQLSTATE y el orden alfabético
importa).

---

## 3 · Diferencias entre el contexto que me diste y lo medido

**Una sola, y es menor.** Los 13 puntos del contexto se verificaron uno por uno contra el
código o la base; 12 coinciden exactamente.

**Punto 7 — "la consulta estaba copiada en 21 lugares".** Correcto para el momento de la
unificación. Hoy hay **23 llamadas al helper**, porque la tanda siguiente sumó dos
consumidores nuevos (`getLatestRejectionNote` y `updateAgencyIdentityAction`). No es un
error tuyo: el 21 describe la duplicación que se eliminó, y así lo documenté. Lo aclaro
para que nadie cuente 23 y crea que la documentación miente.

**Verificaciones puntuales de lo demás** (todo confirmado):
- #1 — `tenant_type` sigue en la base: **0 funciones y 0 policies** la mencionan.
- #5 — `Public read agencies` sigue con `qual: true`; `agency_reviews` con RLS y **0 policies**.
- #6 — el índice parcial es exactamente `(city_id, license_number) WHERE approval_status = 'approved' AND license_number IS NOT NULL`.
- #9 — el `catch` de `src/lib/supabase/server.ts` dice literalmente *"En Server Components el set no tiene efecto; lo maneja el proxy"*.
- #10 — `createPropertyAction` usa service role cuando el `agent_id` de la propiedad ≠ el del creador.
- #11 — los dos triggers comparten `ERRCODE = 'check_violation'` y los nombres confirman el orden alfabético.
- #13 — `agencies` no tiene policy de UPDATE (su única policy es la de SELECT).

**Y una verificación del paso 3 que confirma lo que dijiste:** `useProperties` filtra por
`city_id` y `status='active'` y nada más. **Una agencia que deja de pagar mantiene sus
propiedades visibles.** Quedó anotado como bloque propio y bloqueante en `PENDIENTES.md`.

---

## 4 · Afirmaciones falsas encontradas en la documentación

Tres en `DESIGN.md` y tres referencias muertas en `PLAN-ORIGINAL.md`. **Ninguna tiene que
ver con este grupo de trabajo** — aparecieron al leer todo. Las corregí.

| # | Dónde | Decía | Dice el código | Qué hice |
|---|---|---|---|---|
| 1 | `DESIGN.md` §7 (línea 463) | *"el dashboard usa `flex h-screen overflow-hidden` en el wrapper"* | **`flex h-dvh overflow-hidden`** en los dos layouts (`dashboard` y `admin`) | Corregido, con una nota de que decía `h-screen` — importa porque el propio `CLAUDE.md` prohíbe `h-screen` en wrappers de pantalla completa, así que el documento de diseño contradecía la regla |
| 2 | `DESIGN.md` §7 (línea 485) | *"Modal 'Próximamente' usa el `Dialog` de shadcn"* | Ese modal **no existe**: el CTA abre un `AlertDialog` de confirmación y registra el pedido. `components/ui/dialog.tsx` **no lo importa nadie** | Corregido, con la aclaración de qué hace hoy |
| 3 | `DESIGN.md` §12 (línea 628) | *"El CTA 'Pasar a {plan}' abre el Dialog 'Próximamente' (la activación es manual por ahora; contacto vía mailto)"* | El CTA escribe `pending_plan` + `status: 'pending'` de verdad, y la card pasa a "Pendiente" | Corregido |
| 4 | `PLAN-ORIGINAL.md` ×2 | Remite a `03-schema.sql` como el schema ejecutable | Ese archivo **no está en el repo** | Apuntadas al `initial_schema.sql` real |
| 5 | `PLAN-ORIGINAL.md` | Tabla con `plan` (free/pro) | Hoy son 4 valores, 3 de venta | Marcado inline como desactualizado (el archivo es histórico y ya lo dice en su encabezado; no lo reescribí) |
| 6 | `PENDIENTES.md` | Ítem sobre *"`02-plan-app-inmobiliaria.md` (vive en el Project, NO en el repo)"* | El archivo **sí está en el repo**, como `PLAN-ORIGINAL.md` | Renombrada la referencia |

**Las 2 y 3 son las más molestas:** describen una pantalla que se rediseñó hace tiempo, y
alguien que leyera `DESIGN.md` para tocar la suscripción habría buscado un modal que no
existe.

---

## 5 · Verificación

### `npx tsc --noEmit` — exit code **0**
```
(sin salida)
```

### `npm run lint` — exit code **0**
```
/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  232:20  warning  Compilation Skipped: Use of incompatible library
  … React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
```

### `npx next build` — exit code **0**
```
✓ Generating static pages using 3 workers (18/18) in 1315ms

┌ ○ /                                   ├ ○ /_not-found
├ ƒ /[slug]                             ├ ƒ /admin
├ ○ /apple-icon.png                     ├ ƒ /dashboard
├ ƒ /dashboard/equipo                   ├ ƒ /dashboard/leads
├ ƒ /dashboard/perfil                   ├ ƒ /dashboard/preferencias
├ ƒ /dashboard/propiedades              ├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /dashboard/propiedades/nueva        ├ ƒ /dashboard/suscripcion
├ ƒ /login                              ├ ƒ /logout
├ ƒ /register                           └ ƒ /register/plan
```

**Idéntico al paso 1.** Esperable: solo se tocaron `.md` y comentarios/objetos del
schema, que no entra al build.

⚠ **Lo que no verifiqué:** que el schema corra en una base limpia. Los dos objetos nuevos
son copia literal de lo medido, y el archivo mantiene su estructura de dependencias
(función y trigger van después de `CREATE TABLE properties` y antes de los índices), pero
**no lo ejecuté** — no ejecuto SQL de escritura.

---

## 6 · Lo que dejé sin tocar, y por qué

1. **`README.md`** — es el de `create-next-app`, sin una sola línea del proyecto. Ponerlo
   al día es una tarea propia (qué es Marka, cómo levantarlo, qué variables de entorno
   hacen falta), no un ajuste dentro de esta. Es la puerta de entrada del repo y hoy no
   dice nada; lo dejo señalado.
2. **`AGENTS.md`** — 5 líneas de reglas de Next.js 16, sin relación con el dominio.
3. **`PLAN-ORIGINAL.md` no se reescribió.** Es un documento histórico y su encabezado ya
   avisa que su estado y su roadmap están desactualizados, remitiendo a `PENDIENTES.md` y
   `CLAUDE.md`. Solo corregí las referencias muertas y marqué la tabla de planes.
4. **El bloque de seed comentado del schema** sigue con el `INSERT` que no pasa `phone_wa`
   (NOT NULL sin default) y que caería en `approval_status = 'pending'`. Ya tiene la nota
   ⚠ que le puse en la tanda anterior; no toqué el SQL comentado en sí.
5. **`DESIGN.md` no recibió secciones nuevas.** El aviso `Notice` está documentado en
   `CLAUDE.md` con sus tonos, pero no lo agregué al sistema de diseño como componente
   canónico: eso merece una pasada de diseño (dónde va cada tono, cómo convive con el
   banner de error) y no era el alcance de esta tarea. Queda señalado acá.
6. **Ningún archivo de código fuente**, como pediste — incluidos los comentarios de
   código, que ya habían quedado al día en las tandas anteriores.
