# Informe — Cambio de plan desde el panel de administración

> Modo ejecución. **1 archivo creado y 6 modificados** (más este informe). No se ejecutó
> ningún comando de git ni ningún SQL de escritura. Fecha: 31 ago 2026.

> ⚠ **Queda algo pendiente de tu lado:** el CHECK del historial todavía no admite el valor
> nuevo. El SQL está en el punto 1. Hasta que lo corras, el cambio de plan **se aplica bien**
> pero el registro en el historial falla y el dueño ve un aviso al respecto (es el contrato
> best-effort que ya tenían las demás actions).

---

## 1. El SQL para el historial

Medido primero, con `pg_get_constraintdef`:

```sql
agency_reviews_decision_check
  CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text, 'plan_canceled'::text, 'subscription_canceled'::text, 'subscription_restored'::text])))
```

Cinco valores, y ninguno sirve: `approved`/`rejected` son veredictos del eje de legitimidad;
`plan_canceled` es descartar una **solicitud de la agencia**; y la dupla
`subscription_canceled`/`subscription_restored` apaga y enciende la suscripción entera.
Cambiarle el plan a una agencia que sigue siendo cliente no es ninguno de esos.

**Valor nuevo elegido: `plan_changed`**, con el mismo criterio de nombre que los tres del eje
comercial (`<objeto>_<qué le pasó>`, en inglés).

Archivo: **`supabase/pending/2026-08-31-historial-cambio-de-plan.sql`**. Listo para copiar y
pegar:

```sql
-- Se reemplaza el CHECK entero (Postgres no permite "agregar un valor" a uno
-- existente). Solo se SUMA un valor, así que la revalidación de las filas que ya
-- están no puede fallar.
ALTER TABLE public.agency_reviews
  DROP CONSTRAINT IF EXISTS agency_reviews_decision_check;

ALTER TABLE public.agency_reviews
  ADD CONSTRAINT agency_reviews_decision_check
  CHECK (
    decision = ANY (ARRAY[
      'approved'::text,
      'rejected'::text,
      'plan_canceled'::text,
      'subscription_canceled'::text,
      'subscription_restored'::text,
      'plan_changed'::text
    ])
  );
```

---

## 2. Archivos

### Creado

| Archivo | Qué es |
|---|---|
| `supabase/pending/2026-08-31-historial-cambio-de-plan.sql` | El `ALTER` de arriba, pendiente de correr a mano. |

### Modificados

| Archivo | Qué cambió |
|---|---|
| `src/types/index.ts` | `ReviewDecision` suma `plan_changed`, y se exporta `PAID_PLANS` (derivado de `PLAN_ORDER`, que queda intacto). |
| `src/app/(agent)/admin/actions.ts` | Nueva `changePlanAction`: valida destino, estado, plan igual y exceso de cupo; escribe desde el catálogo; registra en el historial. |
| `src/app/(agent)/admin/AgenciesTable.tsx` | Ítem "Cambiar de plan" en el menú `⋯` + `ChangePlanPanel` (selección de plan, vencimiento precargado, anticipación del bloqueo y resumen de consecuencias). |
| `src/app/(agent)/admin/page.tsx` | Cuenta las propiedades que ocupan cupo por agencia y trae `current_period_end`, **sin consulta nueva**. |
| `src/app/(agent)/register/plan/PlanSelector.tsx` | Usa el `PAID_PLANS` compartido en vez de su copia local. |

---

## 3. Cómo cuento las propiedades, y cómo verifiqué que coincide

**El criterio de la base**, medido con `pg_get_functiondef` sobre `check_property_limit()`:

```sql
  -- Solo cuenta propiedades que ocupan cupo (no las vendidas/alquiladas)
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE agency_id = NEW.agency_id
    AND status IN ('active', 'paused');
```

O sea: **por `agency_id`** (no por agente) y **`status IN ('active','paused')`** — las vendidas
y alquiladas no ocupan cupo.

**En la action** no reimplementé ese conteo: uso **`getPlanUsage`**, que es el helper que ya lo
replica y que `CLAUDE.md` marca como obligatorio para esto. Su consulta es literalmente la
misma:

```ts
supabase.from("properties")
  .select("*", { count: "exact", head: true })
  .eq("agency_id", agencyId)
  .in("status", ["active", "paused"]),
```

**En la interfaz** el conteo se arma en `page.tsx` con el mismo filtro
(`status !== "active" && status !== "paused" → continue`), a partir de la lectura que **ya se
hacía** para decidir `can_delete`: solo le sumé la columna `status` al `select`. No hay consulta
nueva, como pediste.

Las tres puntas cuentan lo mismo, y está anotado en cada una. Si contaran distinto, el panel
podría ofrecer un cambio que la action rechaza (frustración) o —peor— aplicar uno que deje a la
agencia por encima de un límite que la base nunca habría permitido.

---

## 4. Las dos fechas

### `current_period_end` (vencimiento): **editable en el mismo movimiento, precargado, y el vacío BORRA**

Descarté conservarla en silencio: **la fecha vieja pertenece al plan viejo**. Dejarla haría que
la agencia leyera *"Plan Inicial activo hasta el 31/12"* cuando ese 31/12 se cargó para la
prueba gratuita de su Profesional. Es exactamente la misma clase de mentira que sacamos de la
pantalla de suscripción en la tanda anterior.

Y descarté limpiarla siempre: tu propio caso dice *"probablemente necesite una fecha distinta,
**o ninguna**"*, y "una fecha distinta" no es expresable si el cambio la borra a ciegas.

Lo que quedó es **"escribe lo que ves"**: el campo viene precargado con el vencimiento vigente,
y se guarda lo que el dueño deje. Si lo vacía, el plan nuevo queda sin vencimiento. El texto de
ayuda lo dice explícitamente, y el resumen de consecuencias remata con *"Vence el X"* o *"Queda
sin fecha de vencimiento"*.

⚠ **Esto es una asimetría deliberada con `activatePlanAction`**, donde el campo vacío **no
toca** la columna. El motivo: en una activación no hay fecha previa que pueda quedar vieja (la
suscripción venía de `pending`), así que no tocar es lo seguro. En un cambio de plan sí la hay,
así que no tocar sería lo peligroso. Está documentado en las dos actions para que nadie las
"unifique" sin ver la diferencia.

### `activated_at` (activación): **se actualiza a ahora**

Esa columna responde *"desde cuándo rige lo que rige"*. Después del cambio lo que rige es el
plan nuevo, y rige desde este momento. Conservar la fecha vieja le atribuiría al plan nuevo un
comienzo que nunca tuvo, y la columna "Activación" del panel mostraría una fecha **anterior al
cambio** para un plan que empezó después — el dueño no tendría cómo saber cuándo pasó.

Es además lo que ya hace `activatePlanAction`, así que las dos rutas que ponen un plan a regir
dejan la misma marca.

---

## 5. Plan pedido sin activar, y agencia dada de baja

**En los dos casos la acción NO se ofrece, y la action los rechaza igual** (la interfaz no es
una barrera). La condición para ofrecerla es la misma que para dar de baja: **suscripción
`active` con un plan de venta**.

**Suscripción `pending` (la agencia pidió un plan):** ese caso ya tiene **dos** acciones
propias —`activatePlanAction` (dársela) y `cancelPendingPlanAction` (descartarla)—, así que no
hay nada que agregar. Ofrecer además "cambiar de plan" abriría una pregunta que ninguna
respuesta resuelve bien: ¿qué pasa con la solicitud que quedó colgando? ¿Se descarta en
silencio? ¿Sobrevive apuntando a un plan que ya no tiene sentido? El mensaje de la action manda
al camino correcto: *"Esa agencia tiene una solicitud de plan sin resolver. Activala o cancelala
antes de cambiarle el plan."*

**Suscripción `canceled` (dada de baja):** acá hay un motivo más fuerte que la prolijidad. **La
baja conserva `plan` justamente para saber a qué reactivar** — es el único registro de qué tenía
contratado. Si se le pudiera cambiar el plan estando de baja, se pisaría esa memoria y
`restoreSubscriptionAction` devolvería a la agencia a un plan **que nunca tuvo**. El orden
correcto es reactivar y después cambiar, y eso dice el mensaje.

**`free` también queda afuera**, como pediste: para una agencia en el estado de aterrizaje el
camino es que pida un plan y el dueño se lo active. Y `free` tampoco es un **destino** válido:
para sacarle el plan a alguien está la baja (que además conserva a qué volver); degradar a
`free` perdería ese dato.

---

## 6. La interfaz

**Panel inline, no diálogo.** El criterio es el mismo que ya aplican los otros tres paneles de
esta pantalla (rechazo, activación, eliminación): el `AlertDialog` es para un *"¿seguro?"* de
una sola frase, y **su botón de acción cierra la ventana al hacer click**. Acá hay dos cosas que
no toleran eso:

1. **Una selección** (qué plan destino), que puede cambiar varias veces antes de decidir.
2. **Un mensaje de bloqueo por exceso** que tiene que poder mostrarse **sin cerrar**, mientras
   el dueño prueba otro destino. Con un diálogo, cada intento bloqueado cerraría la ventana y
   habría que reabrirla.

**El panel es la confirmación** — no le apilé un diálogo encima. La confirmación explícita es el
botón final, que **nombra el plan destino** (*"Cambiar a Inicial"*), y justo arriba va un bloque
**"Qué va a pasar"** con las consecuencias concretas: el límite nuevo contra el uso actual, qué
funciones **gana** (en verde) y cuáles **pierde** (en rojo), y qué pasa con el vencimiento.

**Anticipación del bloqueo.** Cada plan destino que no entra se muestra **deshabilitado**, con
el motivo en su propia línea y los números concretos: *"No entra: la agencia tiene 25
propiedades activas o pausadas y este plan permite 20. Habría que pausar o dar de baja 5
antes."* El dueño ve por qué antes de intentar. La action lo rechaza igual, con el mismo
mensaje.

**Dónde vive:** en el menú `⋯` de acciones secundarias, junto a las de deshacer, y no como botón
suelto — no es una acción del flujo diario. Aparece solo para agencias con plan de venta activo.
El plan que ya rige no está entre las opciones (`PAID_PLANS.filter(id => id !== currentPlan)`), y
si igual llegara, la action lo rechaza con *"Esa agencia ya está en el plan X"* en vez de
escribir sin efecto y dejar una fila en el historial diciendo que hubo un cambio que no hubo.

---

## 7. Con los datos de hoy

Medido: agencias con plan de venta activo, y a qué podrían cambiar. El límite de cada plan es
inicial=20, profesional=60, premium=200.

| Agencia | Plan actual | Ocupan cupo | → Inicial (20) | → Profesional (60) | → Premium (200) |
|---|---|---|---|---|---|
| Inmobiliaria Demo | profesional | **11** | ✅ entra | *(actual)* | ✅ entra |
| Inmobiliaria Gaio | profesional | 1 | ✅ entra | *(actual)* | ✅ entra |
| Inmobiliaria Juan Lopez2 | profesional | 0 | ✅ entra | *(actual)* | ✅ entra |
| Inmobiliaria Prueba | inicial | 0 | *(actual)* | ✅ entra | ✅ entra |
| Inmobiliaria Prueba Gaio | inicial | 0 | *(actual)* | ✅ entra | ✅ entra |
| Inmobiliaria Zavaleta3 | inicial | 0 | *(actual)* | ✅ entra | ✅ entra |

⚠ **Con los datos de hoy NINGÚN cambio queda bloqueado por exceso, y conviene saberlo antes de
dar la feature por probada.** El plan de venta más chico permite 20 propiedades y la agencia más
cargada tiene 11, así que **el camino de bloqueo es inalcanzable**: haría falta una agencia con
21 o más propiedades activas/pausadas. Para ejercitarlo a mano hay que cargar propiedades de
más (o bajar `property_limit` a mano, que no representa el caso real).

Dos agencias tienen vencimiento cargado (`Gaio` y `Prueba`, ambas 31/12/2026), así que el
comportamiento de la fecha precargada sí se puede probar con lo que hay.

---

## 8. Verificación

### `npx tsc --noEmit`
```
(sin salida)
```
**exit code: 0**

### `npm run lint`
```
> marka@0.1.0 lint
> eslint


/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  269:20  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:269:20
  267 |   });
  268 |
> 269 |   const currency = watch("currency");
      |                    ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  270 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
  271 |   const lat = watch("lat");
  272 |   const lng = watch("lng");  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
```
**exit code: 0**

### `npx next build`
```
✓ Generating static pages using 3 workers (19/19) in 1288ms
  Finalizing page optimization ...

Route (app)
┌ ○ /                                    ├ ƒ /dashboard/perfil
├ ○ /_not-found                          ├ ƒ /dashboard/preferencias
├ ƒ /[slug]                              ├ ƒ /dashboard/propiedades
├ ƒ /admin                               ├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /api/geocode                         ├ ƒ /dashboard/propiedades/nueva
├ ○ /apple-icon.png                      ├ ƒ /dashboard/suscripcion
├ ƒ /dashboard                           ├ ƒ /login
├ ƒ /dashboard/equipo                    ├ ƒ /logout
├ ƒ /dashboard/leads                     ├ ƒ /register
                                         └ ƒ /register/plan

ƒ Proxy (Middleware)
```
**exit code: 0**

### Comparación contra el baseline

| Métrica | Baseline | Medido | ¿Igual? |
|---|---|---|---|
| Errores de TypeScript | 0 | 0 | ✅ |
| Errores de lint | 0 | 0 | ✅ |
| Warnings de lint | 1 (`react-hooks/incompatible-library`, formulario de propiedad) | 1, el mismo, `PropertyForm.tsx:269` | ✅ |
| Build | verde, 19 rutas | verde, **19 rutas** | ✅ |

**Idéntico al baseline.** La acción es una server action, no una ruta.

---

## 9. Decisiones que se apartan de las instrucciones

**1. Exporté `PAID_PLANS` desde `src/types/index.ts` y cambié `PlanSelector` para usarlo.**
`CLAUDE.md` documenta que esa derivación se hace **dentro del componente**
(`PLAN_ORDER.filter(id => id !== "free")`). Con esta tanda hacían falta **tres** copias de la
misma línea (el selector del registro, la action nueva y el panel nuevo), y tres derivaciones a
mano del catálogo de venta son tres lugares donde se puede desincronizar. Exporté la constante
—**sin tocar `PLAN_ORDER`**, que sigue siendo el dominio completo de la columna con `free`
adentro, que es lo que esa nota de `CLAUDE.md` protege— y dejé el porqué escrito ahí. El cambio
en `PlanSelector` es un swap de import, sin cambio de comportamiento.

**2. El panel es la confirmación; no agregué un `AlertDialog` encima.** Pediste "confirmación
explícita antes de aplicarse". Interpreté que el botón final nombrado (*"Cambiar a Inicial"*),
con el bloque "Qué va a pasar" inmediatamente arriba, **es** esa confirmación explícita. Apilar
un diálogo sobre un panel que ya exige elegir y leer sería una segunda confirmación del mismo
acto, y ninguna de las otras tres acciones con panel lo hace.

**3. Las etiquetas de los tres entitlements quedaron locales al panel** (`ENTITLEMENTS`) y no en
`labels.ts`. La regla pide llevar allá los mapas indexados por **literales del dominio**, y
`featured`/`whiteLabel`/`metrics` son claves de `PlanInfo`, no una unión de literales del
dominio. Además hay precedente: `featuresFor` en `SubscriptionContent` las escribe inline. Si
algún día se vuelven un tipo propio, ahí sí corresponde moverlas.

---

## 10. Encontrado y NO tocado, por estar fuera del alcance

1. **El camino de bloqueo por exceso no se puede probar con los datos de hoy** (punto 7). No es
   un defecto del código, pero sí significa que la parte más delicada de esta pieza queda
   **verificada por tipos y build, no por ejecución**. Es lo primero que apuntaría a probar,
   cargando propiedades de más en una agencia de prueba.

2. **`supabase/pending/2026-08-31-bloqueo-publicacion-por-suscripcion.sql` sigue ahí aunque ya
   lo corriste.** Medí que `trg_check_agency_subscription` está aplicado en la base, así que ese
   archivo ya cumplió su función y debería mudarse al schema documentado y borrarse. Volverlo a
   correr es inofensivo (`CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`), pero deja la carpeta
   `pending/` diciendo que hay dos cosas sin aplicar cuando hay una. No lo toqué porque implica
   editar `migrations/20240101000000_initial_schema.sql`, que está fuera de esta tarea.

3. **`current_period_end` sigue sin tener ningún efecto automático.** Ahora se puede escribir
   desde dos lugares (activar y cambiar de plan) y la agencia la ve, pero **nada la vigila**: que
   una fecha pase no cambia el estado de la suscripción ni avisa a nadie. Sigue siendo un
   recordatorio para el dueño, como estaba anotado en `PENDIENTES.md`.

4. **Re-activar una propiedad pausada sigue salteando el trigger de suscripción**
   (`trg_check_agency_subscription` es solo `BEFORE INSERT`). Lo reporté en la tanda anterior y
   sigue igual; no es de esta pieza, pero se cruza con ella: una agencia a la que se le baja el
   plan queda con `property_limit` menor, y el trigger de límite **sí** cubre el UPDATE de
   `paused → active`, así que ese camino está protegido por el otro lado.

5. **Bajar de plan desde el panel del cliente sigue sin existir, y así debe quedar.** Lo dejé
   escrito en el comentario de `changePlanAction`: habilitarlo permitiría pagar un mes de plan
   grande, cargar muchas propiedades y bajar al más barato conservándolas visibles.
   `requestPlanUpgradeAction` sigue admitiendo solo subidas.

6. **No probé nada contra la base**, como en las tandas anteriores: el modo prohíbe SQL de
   escritura. El orden de prueba que sugiero: correr el SQL del punto 1; cambiar
   *Inmobiliaria Demo* de profesional a inicial (11 propiedades, entra) y confirmar que pierde
   el white-label y que su sitio `/inmobiliaria-demo` se apaga; verificar que a *Gaio* le
   aparece el 31/12/2026 precargado y que vaciarlo deja la columna en `null`; y comprobar que a
   una agencia con solicitud pendiente o dada de baja **no** le aparece la opción en el menú.
