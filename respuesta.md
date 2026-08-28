# Matrícula + estado de aprobación de agencias — etapa 1

> **Modo ejecución.** Seis archivos modificados, ninguno creado ni borrado. **Cero
> comandos de git.** Cero SQL de escritura: el schema ya estaba aplicado y lo verifiqué
> por MCP antes de escribir una línea. **La etapa 2 (registro, pantalla de espera,
> bloqueo de carga) no se tocó**, como pediste.
>
> `npx tsc --noEmit` 0 errores · `npm run lint` 0 errores y **1 warning** (el conocido)
> · `npx next build` verde con **17 rutas**. Idéntico al baseline.

---

## 1 · El schema real, medido por MCP

**Coincide con lo que describiste, sin ninguna diferencia.** Un solo agregado que no
estaba en tu lista (un índice extra, ver al final).

### `agencies` — las dos columnas nuevas

| # | columna | tipo | nullable | default |
|---|---|---|---|---|
| 11 | `license_number` | text | **YES** | — |
| 12 | `approval_status` | text | **NO** | **`'pending'::text`** |

(las 10 columnas anteriores quedaron intactas, en las posiciones 1-10)

### CHECKs (`pg_get_constraintdef`), textual

```
agencies_approval_status_check   CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
agencies_tenant_type_check       CHECK ((tenant_type = ANY (ARRAY['individual'::text, 'agency'::text])))
agencies_city_id_fkey            FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT
agencies_pkey                    PRIMARY KEY (id)
agencies_slug_key                UNIQUE (slug)
```

### Índices de `agencies` (`pg_get_indexdef`), textual

```
CREATE UNIQUE INDEX agencies_pkey ON public.agencies USING btree (id)
CREATE UNIQUE INDEX agencies_slug_key ON public.agencies USING btree (slug)
CREATE INDEX idx_agencies_city ON public.agencies USING btree (city_id)
CREATE INDEX idx_agencies_approval_status ON public.agencies USING btree (approval_status)
CREATE UNIQUE INDEX idx_agencies_license_unique_approved ON public.agencies USING btree (city_id, license_number) WHERE ((approval_status = 'approved'::text) AND (license_number IS NOT NULL))
```

El índice único parcial está exactamente como lo describiste: por `(city_id,
license_number)`, restringido a `approval_status = 'approved' AND license_number IS NOT
NULL`. **Consecuencia que dejo anotada:** dos agencias *pendientes* pueden reclamar la
misma matrícula en la misma ciudad sin que la base se queje; el conflicto recién
aparece al aprobar la segunda, y ahí el `UPDATE` va a fallar con violación de índice
único. Lo documenté en el comentario del tipo, pero **no puse ningún manejo especial de
ese error en la action de aprobar** — cae en el mensaje genérico "No se pudo actualizar
la agencia". Está fuera de lo que pediste; lo señalo en §8.

### `agency_reviews` — tabla nueva

| # | columna | tipo | nullable | default |
|---|---|---|---|---|
| 1 | `id` | uuid | NO | `gen_random_uuid()` |
| 2 | `agency_id` | uuid | NO | — |
| 3 | `decision` | text | NO | — |
| 4 | `note` | text | **YES** | — |
| 5 | `reviewed_by` | uuid | **YES** | — |
| 6 | `created_at` | timestamptz | NO | `now()` |

```
agency_reviews_decision_check     CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))
agency_reviews_agency_id_fkey     FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
agency_reviews_reviewed_by_fkey   FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL
agency_reviews_pkey               PRIMARY KEY (id)
```

**Un índice que no estaba en tu descripción** (agregado, no faltante):
```
CREATE INDEX idx_agency_reviews_agency ON public.agency_reviews USING btree (agency_id, created_at DESC)
```
Es exactamente el índice que quiere "traeme el historial de esta agencia, lo más nuevo
primero". No cambia nada de lo que escribí; lo reporto porque pediste la definición
real y difiere (a favor) de la que me pasaste.

### RLS y datos

```json
[{"relname":"agencies","rls":true,"forzada":false,"policies":1},
 {"relname":"agency_reviews","rls":true,"forzada":false,"policies":0}]
```
La única policy de `agencies` sigue siendo `Public read agencies` (`cmd: SELECT`,
`qual: true`, `with_check: null`) — **confirmado: no hay policy de UPDATE**, así que
toda escritura va con service role, tal como asumías. `agency_reviews` tiene RLS
habilitada y **cero policies**: inaccesible salvo service role.

Backfill:
```json
[{"approval_status":"approved","filas":10,"con_matricula":0}]
```
Las 10 agencias quedaron en `approved`, ninguna con matrícula. `agency_reviews` está
vacía (0 filas), como corresponde: el backfill no inventó veredictos.

---

## 2 · Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/types/index.ts` | Tipo `ApprovalStatus`; `license_number` y `approval_status` en `Agency`; interfaz `AgencyReview` con el porqué de la tabla aparte; constante `REJECTION_NOTE_MAX` |
| `src/lib/utils/labels.ts` | `APPROVAL_STATUS_LABELS` (`Record<ApprovalStatus, string>`), sexta constante con la forma de las cinco existentes |
| `src/app/(agent)/admin/page.tsx` | Consulta invertida (parte de `agencies`, suscripción como embed opcional), columnas explícitas con matrícula/estado/ciudad, mapeo y tipo de fila nuevos, métrica "Por aprobar" y grilla de 7 tarjetas |
| `src/app/(agent)/admin/AgenciesTable.tsx` | Columnas rehechas, `overflow-x-auto`, dos ejes de filtros, badge de aprobación, acciones por estado, panel inline de rechazo, cards mobile actualizadas |
| `src/app/(agent)/admin/actions.ts` | Tres actions nuevas (`approveAgencyAction`, `rejectAgencyAction`, `reopenAgencyAction`) más los helpers `requireAppAdmin`, `writeApproval`, `parseNote`, `parseAgencyId` |
| `src/lib/utils/resolveAgencyBySlug.ts` | Gate de aprobación antes del gate de plan; `approval_status` en el select y en el tipo de fila |

### Detalle de la consulta invertida (tarea 3)

```ts
admin
  .from("agencies")
  .select(
    "id, name, slug, license_number, approval_status, subscription:subscriptions(plan, pending_plan, status, activated_at), city:cities(name)"
  )
  .order("created_at", { ascending: false }),
```

- Parte de `agencies`, columnas explícitas, nunca `*`.
- La suscripción es un embed **opcional**: `AgencyRow.subscription` es
  `AgencySubscription | null`, y todo lo que la renderiza tolera el null —
  "Plan" y "Pidió" muestran `—`, "Activación" muestra `—`, y el badge de estado
  muestra **"Sin plan"** en vez de un hueco o un `undefined`.
- El orden ahora es por `agencies.created_at` (antes era el de `subscriptions`).
- `AgencyRow` ganó `agency_id` como id de la **agencia** (antes era el `agency_id` de la
  fila de suscripción, que casualmente es el mismo valor pero significaba otra cosa),
  más `name`, `slug`, `license_number`, `approval_status` y `city_name`.
- Se agregó `firstOf()` para normalizar los embeds objeto-vs-array, el mismo helper que
  ya usa `resolveAgencyBySlug`.

**Métricas:** la nueva es "Por aprobar" (`agencies` con `approval_status = 'pending'`,
hoy **0**), va primera y es la única con `accent`. "Planes / Esperan activación" pasó a
tratamiento neutro para que no compitan dos acentos. La grilla pasó de
`grid-cols-2 md:grid-cols-3 lg:grid-cols-6` a **`grid-cols-2 md:grid-cols-4
lg:grid-cols-7`**: con 7 tarjetas queda 2+2+2+1 en mobile, 4+3 en `md` y 7 en una fila
en `lg`, sin la card colgando sola que daba 6+1.

---

## 3 · Cómo resolví el motivo del rechazo, y por qué

**Panel inline (`RejectPanel`), no diálogo.** Se despliega arriba del listado al tocar
"Rechazar", con `<Label>` + `<Textarea>` + contador de caracteres + botones
Rechazar/Cancelar y una `X` para cerrar.

Las tres razones, en orden de peso:

1. **Es la convención del proyecto para exactamente este caso.** El único precedente de
   "formulario que llena un admin" es `CreateAgentForm` dentro de `TeamContent.tsx`: un
   `<section className="bg-paper border border-stone rounded-lg p-6">` montado
   condicionalmente, con su botón de cerrar y su validación local. Copié esa estructura,
   incluidas las clases. Me pediste seguir las convenciones por encima de lo rápido, y
   lo rápido acá habría sido meter el textarea dentro del `AlertDialog` que ya está
   importado.
2. **El `AlertDialog` de Radix es semánticamente para confirmar, no para editar.** Los
   cuatro usos que tiene la app hoy (`AgenciesTable`, `TeamContent`, `PropertiesTable`,
   `SubscriptionContent`) son todos sí/no sin campos. Meter un textarea adentro rompe
   esa lectura y arrastra problemas de foco conocidos de los alert dialogs.
3. **`ui/dialog.tsx` no lo importa nadie.** Usarlo habría significado estrenar en esta
   pieza un componente que el proyecto nunca ejerció, con su propio comportamiento de
   foco y scroll por validar. No es el lugar para estrenarlo.

Lo que **sí** quedó en `AlertDialog` son las tres confirmaciones sí/no que no piden
texto: activar plan (ya existía), **aprobar** y **volver a pendiente**. O sea: diálogo
para confirmar, panel para escribir. La regla queda legible.

El contador de caracteres usa `REJECTION_NOTE_MAX`, la misma constante que valida el
server. El botón arranca deshabilitado y solo se habilita con una nota no vacía y
dentro del límite — pero **la validación real está en la action**, que rechaza sin
escribir nada si la nota viene vacía o pasada de largo.

---

## 4 · Convención de revalidación elegida

**`revalidatePath("/admin")`, en las tres actions nuevas.** Está en un solo lugar
(`writeApproval`), así que las tres la heredan por construcción: es imposible que una se
olvide.

Por qué esa y no `router.refresh()`:

- **La corrección no depende del cliente.** `router.refresh()` funciona solo si quien
  llama se acuerda de invocarlo; `revalidatePath` invalida la caché del servidor pase lo
  que pase. Para acciones que cambian el estado de aprobación de un tercero, prefiero
  que la frescura sea responsabilidad del server.
- Es la convención de las actions **más nuevas** del repo (`preferencias/actions.ts:63`),
  y la que el equipo de Next recomienda para mutaciones desde server actions.

**Lo que NO hice, y conviene que lo sepas:** el cliente sigue llamando
`router.refresh()` para las cuatro acciones, dentro del helper `run()`. No es una mezcla
de convenciones dentro de la misma capa — en el server las tres nuevas usan
`revalidatePath` y nada más; en el cliente el refresh es uniforme para todas — pero
**es necesario** porque `activatePlanAction` (que no toqué) no revalida nada y depende
de ese `router.refresh()` para que la fila se actualice. Sacarlo la habría roto. Si en
algún momento se le agrega `revalidatePath` a `activatePlanAction`, el `router.refresh()`
del cliente se puede eliminar entero.

---

## 5 · Los dos ejes de filtros, y el agujero tapado

**Son dos grupos separados, con su título en versalitas, y una fila se muestra solo si
pasa los dos:**

```ts
const visibleRows = useMemo(() => {
  return rows.filter(
    (row) =>
      activePlan[planCategoryOf(row)] && activeApproval[row.approval_status]
  );
}, [rows, activePlan, activeApproval]);
```

- **Eje "Aprobación"** (nuevo): `Por aprobar` / `Aprobada` / `Rechazada`, indexado
  directamente por `row.approval_status`. Las etiquetas salen de
  `APPROVAL_STATUS_LABELS`, no inline.
- **Eje "Suscripción"**: `Plan pendiente` / `Pagas activas` / `Free` / **`Otras`**.

**El agujero y cómo lo tapé.** `categoryOf` devolvía `Category | null`, y el filtro
exigía `cat !== null`: una fila `past_due`/`canceled` desaparecía del listado aunque
estuvieran las tres cajas marcadas. Ahora `planCategoryOf` devuelve **siempre** una
categoría — su firma es `: PlanCategory`, sin `| null`, así que TypeScript no deja
volver atrás — y la cuarta categoría **"Otras"** absorbe los tres casos que no encajan:
sin fila de suscripción, `past_due` y `canceled`.

**Por qué ninguna fila puede desaparecer con todo marcado, dicho como invariante:**
`planCategoryOf` es total (devuelve una de cuatro categorías para cualquier fila) y
`approval_status` es `NOT NULL` con CHECK de tres valores en la base. Con las siete
cajas marcadas, ambos lookups dan `true` para cualquier fila posible.

**Un caso nuevo que el eje de suscripción ahora cubre y antes no:** una agencia **sin
fila de suscripción** cae en "Otras" y se ve. Antes ni siquiera llegaba a la tabla,
porque la consulta partía de `subscriptions`.

### Otros cambios de la tabla (tarea 4)

- **Fuera "Tipo"** (Inmobiliaria/Particular) y **fuera el mapa `TENANT_LABELS` inline**
  que la alimentaba. Ya no queda ninguna etiqueta de tenant en el panel.
- **Fuera "Límite"**: era `PLANS[plan].propertyLimit`, derivable de "Plan".
- **Adentro "Matrícula"** (o `—`) y **"Aprobación"** (badge).
- El contenedor pasó de `overflow-hidden` a **`overflow-x-auto`**: nunca más recorta.
- Quedan 8 columnas, las mismas que antes: se sacaron dos y se agregaron dos.
- **Acciones por estado**, apiladas verticalmente en la celda (`flex flex-col items-end
  gap-2`) para que no queden tres botones apretados: pendiente → Aprobar (primary) +
  Rechazar (destructive); rechazada → Volver a pendiente (secondary); aprobada → nada
  del eje de aprobación. "Activar plan" aparece si hay `pending_plan`, independiente del
  estado de aprobación. Las variantes siguen la tabla de botones de DESIGN §6.
- **Cards mobile**: muestran matrícula, ciudad, plan (o "Sin suscripción"), pedido,
  activación, y **los dos badges apilados** a la derecha (aprobación arriba,
  suscripción abajo). Las acciones van en fila (`flex-wrap`) en el pie, que en la card
  hay ancho de sobra.

---

## 6 · Verificación

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
✓ Compiled successfully in 8.4s
✓ Generating static pages using 3 workers (17/17) in 2.1s

┌ ○ /                                   ├ ○ /_not-found
├ ƒ /[slug]                             ├ ƒ /admin
├ ○ /apple-icon.png                     ├ ƒ /dashboard
├ ƒ /dashboard/equipo                   ├ ƒ /dashboard/leads
├ ƒ /dashboard/perfil                   ├ ƒ /dashboard/preferencias
├ ƒ /dashboard/propiedades              ├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /dashboard/propiedades/nueva        ├ ƒ /dashboard/suscripcion
├ ○ /login                              ├ ƒ /register
└ ƒ /register/plan
```

| | Baseline | Ahora | |
|---|---|---|---|
| Errores TypeScript | 0 | **0** | igual |
| Errores de lint | 0 | **0** | igual |
| Warnings de lint | 1 (`PropertyForm.tsx:232`) | **1** (el mismo) | igual |
| Build | verde, 17 rutas | verde, **17 rutas** | igual |

**Sin regresiones.** No se agregaron rutas ni se tocó ningún formulario con `watch()`.

**Lo que la verificación automática NO cubre:** no hay tests en el repo y no levanté el
dev server, así que **aprobar, rechazar y volver a pendiente no se ejercitaron contra la
base**. Están verificados por tipos y por lectura. Como hoy las 10 agencias están en
`approved`, la única forma de probarlo a mano es poner una en `pending` desde el SQL
Editor (que es tuyo, no mío: no ejecuto escrituras).

---

## 7 · Decisiones que se apartan de las instrucciones

Cuatro, todas menores:

1. **`REJECTION_NOTE_MAX` vive en `src/types/index.ts`, no en `actions.ts`.** El límite
   lo necesitan el panel (para el contador) y el server (para validar), y tiene que ser
   el mismo número. No puede exportarse desde `actions.ts` porque **un archivo
   `"use server"` solo puede exportar funciones async** — Next.js lo rechaza. `types` ya
   exporta constantes de dominio (`PLANS`, `PLAN_ORDER`), así que encaja. Valor: 500.

2. **La métrica vieja "Pendientes" se llama ahora "Planes".** Con dos ejes en la misma
   grilla, dos tarjetas que dijeran "Pendientes" (una de agencias, otra de planes)
   habrían sido ilegibles. Quedó "Por aprobar / Agencias pendientes" para el eje de
   aprobación y "Planes / Esperan activación" para el de suscripción. Es cambio de
   etiqueta, no de consulta.

3. **`writeApproval` verifica que la agencia exista antes del UPDATE.** No estaba
   pedido. Sin eso, un id inventado produciría un `UPDATE` de 0 filas sin error, y le
   diríamos al dueño que la operación salió bien. Es el mismo criterio que
   `activatePlanAction` aplica cuando lee la suscripción antes de escribir.

4. **Si el `INSERT` en `agency_reviews` falla, el estado ya cambió y no se revierte.**
   Devuelvo un mensaje explícito ("El estado se actualizó, pero no se pudo registrar la
   decisión en el historial") en vez de tragarme el error o simular una transacción que
   el client de Supabase no me da. La alternativa —insertar la review primero y después
   el estado— tiene el problema simétrico y peor (historial con un veredicto que no se
   aplicó).

---

## 8 · Encontrado y NO tocado (fuera de alcance)

1. **La matrícula duplicada entre pendientes solo explota al aprobar.** El índice único
   es parcial (solo entre aprobadas), así que dos pendientes pueden tener la misma
   matrícula en la misma ciudad; al aprobar la segunda, el `UPDATE` va a fallar por
   violación de índice único y el dueño va a ver el mensaje genérico "No se pudo
   actualizar la agencia. Intentá de nuevo.", que **no le dice qué pasó realmente**. Un
   manejo específico de ese error (código `23505` → "ya hay una agencia aprobada con esa
   matrícula en esta ciudad") sería una mejora chica y valiosa, pero no estaba en el
   pedido y prefiero no inventar alcance.

2. **La nota de rechazo se guarda pero todavía no se muestra en ninguna parte.**
   `agency_reviews` se escribe correctamente, y el índice `(agency_id, created_at DESC)`
   está listo para leerla, pero el panel no tiene una vista de historial. Hoy la nota
   solo se puede leer desde el SQL Editor. No lo agregué porque no estaba pedido y
   porque tiene decisiones de diseño propias (¿se muestra la última, todas, en un
   expandible?).

3. **La aprobación no gatea nada además del sitio white-label.** Es lo correcto para
   esta etapa —el bloqueo de carga de propiedades es explícitamente etapa 2— pero
   conviene tenerlo presente: hoy una agencia `pending` o `rejected` puede publicar
   propiedades y **aparecen en el mapa público general**, porque `useProperties` filtra
   por `city_id` y `status`, sin mirar la agencia. Solo su `/[slug]` propio queda cerrado.

4. **`agencies` sigue sin `updated_at` ni triggers.** Cuándo se aprobó o rechazó algo se
   puede reconstruir de `agency_reviews.created_at`, pero volver a pendiente **no deja
   rastro temporal en ningún lado** (por diseño: no es un veredicto). Si en algún momento
   hace falta auditar eso, hoy no hay dónde.

5. **La agencia `individual` "Miguel Andrade" quedó aprobada** por el backfill, como
   cualquier otra. Ya lo había señalado en el diagnóstico anterior; sigue igual y sigue
   siendo, presumiblemente, data de prueba.

6. **`src/components/ui/dialog.tsx` sigue sin consumidores.** Después de esta tanda
   tampoco lo usa nadie (ver §3). Sigue siendo código muerto, y `DESIGN.md` §12 todavía
   afirma que el modal de suscripción lo usa, cosa que el código desmiente. No lo toqué:
   es documentación, no estaba en el pedido.
