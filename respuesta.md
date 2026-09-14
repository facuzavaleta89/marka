# Cierre documental del contador de visitas

> **Modo ejecución, solo documentación.** Se modificaron **únicamente `CLAUDE.md` y
> `PENDIENTES.md`** (más este informe). No se tocó `src/`, `scripts/`, el archivo de migración ni
> `DESIGN.md`. No se ejecutó ningún comando de git ni SQL de escritura: la base se leyó con el MCP
> (catálogo, datos y logs) y la documentación de Postgres con una lectura web.
>
> 14 sep 2026. Todo lo documentado sale del código y de la base, no del prompt.

---

## Lo primero: dos cosas que se pudieron verificar y cambian el tono del cierre

1. **La guarda de `updated_at` FUNCIONA en el camino real.** Después de aplicarla (16:32 UTC) hubo
   **5 visitas reales** desde el navegador (logs: POST a `increment_views` a las 16:36:15, 16:36:39,
   16:38:52, 16:47:48 y 16:49:28). En la base: **"Casa Largo" pasó de 2 a 5 visitas y su
   `updated_at` sigue en 16:22:25**, y **"Casa demo" pasó de 0 a 2 conservando `2026-09-03`**. En el
   informe anterior eso estaba sin probar; ahora está probado.
2. **La trampa de las columnas generadas está confirmada por la documentación oficial de Postgres
   17**, no solo por inferencia. Citas textuales en el punto 1.8. La columna es
   `properties.location` (medido: `attgenerated = 's'`, la única de la tabla).

---

## 1. `CLAUDE.md`: qué agregué, modifiqué y corregí

### Agregado

| # | Dónde | Qué |
|---|---|---|
| 1.1 | **Nueva sección "Visitas y consultas por propiedad"** (en Convenciones de Dominio, después de "Favoritos y visitados") | Cinco subsecciones: **dónde se cuenta** (tabla de los tres lugares con archivo y línea: `ClusterLayer.tsx:137`, `PropertyList.tsx:140`, `PropertyViewTracker.tsx:68` montado en `propiedades/[slug]/page.tsx:196`) y **por qué NO en el modal**; **la deduplicación** (el código de `markVisited`, por qué la señal sale de una lectura síncrona y no del actualizador de estado, por qué el estado se actualiza aparte, persistencia, y **sin `localStorage` cada apertura cuenta**); **la ficha pública** (por qué no al montar ni en el servidor, tabla de los cuatro eventos, por qué no `scroll` ni `mousemove`, captura + `passive`, **`keydown` como el evento más flojo**, y las tres capas de "una sola vez por apertura" más la `key`); **`registerView`** (el parámetro `property_id` literal, no espera, no lanza); **las dos métricas del listado** (la consulta `leads(count)`, por qué service role, que la barrera es el filtro, el `null` → "—" y la trampa del `?? 0`, la diferencia con `/dashboard/leads` para un agente común, y las ventanas distintas de `/dashboard`) |
| 1.2 | **Base de Datos → nueva subsección "La guarda de `updated_at` ante el contador de visitas — dos funciones ACOPLADAS"** | Qué resuelve (`updated_at` = `lastModified` del mapa del sitio); tabla de las dos funciones con lo que escribe una y lo que lee la otra; **el acople por string y que romperlo se apaga en silencio**, en las dos direcciones; **por qué la variable es local a la transacción** (conexión reutilizada por PostgREST y el pooler); **el trigger compartido con `subscriptions`** y cómo lo afecta; que está **verificada con visitas reales**; y el aviso de no volver a la comparación de filas |
| 1.3 | **Método de Diagnóstico → nueva subsección "Dos observaciones ciertas que parecen contradecirse: columnas generadas y triggers BEFORE"** | La trampa con las dos citas de la documentación de Postgres 17, la columna nombrada (`properties.location`), el `IF` del primer intento textual, por qué la verificación sobre filas guardadas y el trigger decían cosas distintas siendo las dos ciertas, la regla ("verificar que midan el mismo objeto en el mismo momento"), y el aviso de que el comentario de la migración todavía la llama hipótesis |
| 1.4 | **Estado** (Resumen del Proyecto) | Un bloque "**El contador de visitas cuenta** (14 sep 2026, tres tandas)" con las tres tandas y el puntero a las secciones |
| 1.5 | **Visibilidad pública → sub-bullet** | La regla *"si leés propiedades con service role, la regla de cobro es tuya"* es de los caminos **públicos**: el listado del panel también usa service role para contar consultas y **no invoca la regla, correctamente**, porque su barrera es el alcance de la sesión |
| 1.6 | **Infraestructura de buscadores → sub-bullet del mapa del sitio** | El `lastModified` es `properties.updated_at` (`sitemap.ts:111`), por qué una visita no puede moverlo, puntero a la guarda y las 7 propiedades ya afectadas |
| 1.7 | **Decisiones de Arquitectura** | Seis filas nuevas: contar donde se marca y no en el modal; señal síncrona; primera interacción en la ficha; número crudo en todos los planes; consultas con service role acotado; guarda por variable local y no por comparación de filas |
| 1.8 | **Estructura de Carpetas** | Entradas nuevas `PropertyViewTracker.tsx` y `registerView.ts` |

Las dos citas de Postgres 17 (`trigger-definition.html`), leídas y transcriptas textuales:
> *"Stored generated columns are computed after `BEFORE` triggers and before `AFTER` triggers."*
> *"In `BEFORE` triggers, the `OLD` row contains the old generated value, as one would expect, but the `NEW` row does not yet contain the new generated value and should not be accessed."*

### Modificado (estaba incompleto)

- **Resumen → planes**: agregué que "métricas" en premium **es una promesa de catálogo, no un gate**.
- **Estructura → `propiedades/`, `ClusterLayer.tsx`, `PropertyList.tsx`, `PropertiesTable.tsx`,
  `useVisitedProperties.ts`**: cada una dice ahora lo que hace respecto del contador.
- **Base de Datos → fila `properties`**: `views_count` (solo lo incrementa `increment_views`,
  acumulado, sin fechas) y que `location` es la única columna generada.
- **Triggers de `properties`**: el paréntesis *"Hay además dos `trg_*_updated_at`"* apunta ahora a la
  guarda.
- **Baseline**: fecha 13 → 14 sep 2026.

### Corregido (era falso)

Ver punto 3.

---

## 2. `PENDIENTES.md`: qué cerré, abrí y ajusté

### Cerrado

- **El ítem de `increment_views`** (estaba en "Deuda técnica") pasó a `[x]` con lo que quedó y una
  tabla de **lo descartado**:
  - **contar desde el modal**: el pin marca antes, así que los pines no contarían nunca; moverlo al
    modal obligaba a sincronizar las instancias del hook o el tono visitado quedaría viejo;
  - **contar al montar la ficha**: el renderizador de los buscadores ejecuta JS sin `localStorage` y
    el mapa del sitio lo trae seguido;
  - **contar en el render del servidor**: además contaría a los robots de vista previa;
  - **esconder el número crudo detrás del plan**;
  - **la primera versión de la guarda y por qué falló**, con la cita de Postgres.
- **Entrada nueva en "Cerrados recientemente"**: "CONTADOR DE VISITAS — CERRADO", con el método que
  dejó.

### Abierto: los cuatro pedidos, cada uno verificado antes de escribirlo

| Ítem | Verificación |
|---|---|
| **Un agente logueado suma visitas sobre sus propias propiedades** | Ninguno de los tres lugares que cuentan mira la sesión (`ClusterLayer.tsx:137`, `PropertyList.tsx:140`, `PropertyViewTracker.tsx:68`). Anotado para cuando haya tráfico real. Aclara que detectar que hay **una** sesión no alcanza —el encabezado ya lo hace—: habría que comparar la agencia del agente contra la de cada propiedad |
| **`increment_views` sin ninguna barrera** | `SECURITY DEFINER`, `EXECUTE` a `anon` y `authenticated`, cuerpo sin validación; el advisor de Supabase la marca |
| **La lista no repinta los pines hasta recargar** | El mapa queda montado y oculto con CSS (`(public)/page.tsx:137`, `AgencyMapView.tsx:103`), y el hook lee el almacenamiento una sola vez al montar sin ninguna sincronización. El conteo es correcto; lo viejo es el color |
| **7 propiedades con `updated_at` falso** | Medido: las 7 con fecha del 14 sep entre 16:18 y 16:26 UTC, cada una coincidiendo con un POST de los logs anteriores a la guarda. Anotado que se resuelve con la limpieza de datos de prueba y que no vale la pena recuperar nada |

### Abierto: dos más que aparecieron verificando (no estaban en el prompt)

- **"Vistas totales" y "Leads este mes" están juntas en `/dashboard` con ventanas distintas** (acumulado
  sin filtro de estado contra últimos 30 días), medido en `dashboard/page.tsx`.
- **Dos documentos que esta tanda no podía tocar quedaron desfasados**: el comentario de la migración
  todavía dice "HIPÓTESIS NO VERIFICADA", y `DESIGN.md` §7 no describe las columnas nuevas.

### Ajustado (cifras re-medidas)

| Dónde | Antes | Ahora |
|---|---|---|
| Encabezado "Última actualización" | 13 sep | 14 sep, con el cierre |
| Calendario → datos de prueba | 13 consultas | **14 consultas** + **17 visitas en 8 propiedades** |
| Calendario → consultas desvinculadas | "1 de las 13" | **"1 de las 14"** |
| Limpieza de datos → propiedades en el mapa del sitio | 17 propiedades / 16 activas / 16 ofrecidas | **18 / 17 / 17** |
| Limpieza de datos → tabla de títulos de relleno | 5 filas | **4**: `casa prueba22` ya no existe en la base (medido) |
| Limpieza de datos | — | Nota de las 7 fechas movidas, que la limpieza resuelve |
| B1 → propiedades sin precio | 6 de 17 | **7 de 18** |
| Baseline | re-medido el 13 sep | **14 sep** |
| Vencimiento cargado | 1 de las 9 filas | **1 de las 3** |
| Multi-agente | 10 agencias con 1 agente | **3 agencias con 1 agente, los tres `admin`; 0 con rol `agent`** |
| Índice de `leads.agent_id` | 13 consultas | **14**, y que el listado del panel no ejercita esa policy |
| Matrícula | 1 de 4 sin matrícula, 3 filas en el índice | **1 de 3, 2 filas** |
| V2 → Dashboard analytics | "plan premium" | Aclara que el número crudo ya se muestra en todos los planes, que `has_metrics` no gatea nada y que `views_count` no guarda fechas |

---

## 3. Afirmaciones falsas que encontré

### En `CLAUDE.md`

1. **"Favoritos y visitados"** decía que **los dos hooks** *"se reflejan en vivo en el mapa, el modal
   y las cards (sync entre instancias vía CustomEvent + storage)"*. **Falso para los visitados**:
   `useVisitedProperties` lee el almacenamiento una vez al montar y **no escucha nada**; solo
   `useFavorites` sincroniza. Es la causa del ítem de los pines que no se repintan.
2. **"Funciones y RPC"** decía *"`increment_views` … ⚠ existe pero NO se la llama desde ningún lado, así
   que `views_count` es 0 en todas las propiedades"*. Falso desde el 14 sep: se llama desde tres
   lugares y suma 17. Además estaba descripta sin `plpgsql`, `search_path` fijo ni el acople.
3. **Resumen → planes**: *"premium (… + métricas)"* se leía como un gate. **`has_metrics` no lo
   consume ningún componente** y ninguna agencia lo tiene en `true`.
4. **Visibilidad pública**: *"si leés propiedades con service role, la regla de cobro es tuya"*
   quedaba desmentido por el listado del panel, que lee `properties` con service role sin
   invocarla, y está bien que no lo haga. Aclarado su alcance.
5. **Estructura**: `useVisitedProperties.ts` = *"Pines visitados en localStorage"* y `PropertyList.tsx`
   = *"Lista mobile"*: incompletos al punto de ocultar que son la deduplicación del contador y uno
   de los lugares que cuenta.

### En `PENDIENTES.md`

6. El ítem *"`increment_views` … NO se la llama desde ningún lado"* y su comentario sobre el modal.
7. Las **nueve cifras** de la tabla del punto 2, la más relevante: **`casa prueba22` figuraba como
   dirección que se indexaría y ya no existe**.

### Fuera de los dos archivos (no tocados, anotados en PENDIENTES)

8. **`supabase/migrations/…initial_schema.sql`**: el comentario del primer intento de la guarda dice
   **"HIPÓTESIS NO VERIFICADA"**. Está confirmada.
9. **`DESIGN.md` §7** no describe las columnas "Visitas" y "Consultas".

---

## 4. Números medidos

Todos el 14 sep 2026, por MCP (solo lectura), salvo donde se indica.

| Qué | Valor |
|---|---|
| Agencias / agentes / agentes con rol `agent` | **3 / 3 / 0** (1 agente por agencia, los tres `admin`) |
| Propiedades (activas / pausadas) | **18 (17 / 1)** |
| Visitas totales / propiedades con visitas | **17 / 8** |
| Consultas / desvinculadas | **14 / 1** |
| Imágenes / propiedades con alguna foto | **7 / 7** |
| Ciudades activas | **1** |
| En venta y alquiler a la vez | **3** |
| Con alguna operación sin precio | **7** |
| Propiedades que ofrece el mapa del sitio (activas + agencia visible) | **17** |
| Agencias con logo | **1 de 3** |
| Agencias con `has_metrics = true` | **0** |
| Agencias sin matrícula / filas en el predicado del índice único | **1 / 2** |
| Suscripciones con vencimiento cargado | **1 de 3** |
| Propiedades sin agente | **0** |
| Objetos del bucket de Storage | **9 / 723.872 bytes** (sin cambios) |
| Columnas generadas de `properties` | **1: `location`** |
| Triggers que usan `update_updated_at()` | **2: `trg_properties_updated_at` y `trg_subscriptions_updated_at`** |
| **Propiedades con `updated_at` movido por visitas antes de la guarda** | **7**: Casa Centenario, casa puente, Casa gaio, Casa Largo, casa lugones, Casa Autonomia y Campo |
| Visitas anteriores a la guarda (logs) | **12** POST, entre 16:17:22 y 16:26:05 UTC |
| Visitas posteriores a la guarda (logs) | **5** POST, entre 16:36:15 y 16:49:28 UTC |
| Guarda aplicada (logs) | **16:32:19 UTC** |
| Prueba de la guarda en camino real | Casa Largo 2 → 5 visitas, `updated_at` sin cambio · Casa demo 0 → 2, `updated_at` = 2026-09-03 |
| Placeholders de la tabla de limpieza que siguen en la base | **4 de 5** (falta `casa-prueba2-taf8a3`) |

---

## 5. Baseline de calidad

Corrido con los `.md` ya editados (ninguno de los tres chequeos lee archivos `.md`):

```
### tsc
EXIT_TSC=0
### lint

> marka@0.1.0 lint
> eslint


/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  808:30  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:808:30
  806 |   });
  807 |
> 808 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
      |                              ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  809 |   const lat = watch("lat");
  810 |   const lng = watch("lng");
  811 |   const address = watch("address") ?? "";  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)

EXIT_LINT=0
### build
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 7.2s
  Running TypeScript ...
  Finished TypeScript in 8.6s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/20) ...
  Generating static pages using 3 workers (5/20) 
  Generating static pages using 3 workers (10/20) 
  Generating static pages using 3 workers (15/20) 
✓ Generating static pages using 3 workers (20/20) in 1285ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /[slug]
├ ƒ /admin
├ ƒ /api/geocode
├ ○ /apple-icon.png
├ ƒ /dashboard
├ ƒ /dashboard/equipo
├ ƒ /dashboard/leads
├ ƒ /dashboard/perfil
├ ƒ /dashboard/preferencias
├ ƒ /dashboard/propiedades
├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /dashboard/propiedades/nueva
├ ƒ /dashboard/suscripcion
├ ƒ /login
├ ƒ /logout
├ ƒ /propiedades/[slug]
├ ƒ /register
├ ƒ /register/plan
├ ○ /robots.txt
└ ƒ /sitemap.xml


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

EXIT_BUILD=0
```

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores, **exit 0** ✅ |
| `npm run lint` | 0 errores, **1 warning** (`PropertyForm.tsx:808`, `react-hooks/incompatible-library`), **exit 0** ✅ |
| `npx next build` | verde, **exit 0**, **22 rutas** ✅ |

No hizo falta borrar `.next`.

---

## 6. ¿Algo del prompt resultó falso?

**Casi todo coincidió con lo medido.** Tres matices, dicho derecho:

1. **(e) "comparar la fila nueva contra la vieja NUNCA da iguales"**: coincide con la documentación,
   con una precisión de wording. Postgres no dice qué **valor** tiene la columna generada en `NEW`:
   dice que *"does not yet contain the new generated value and should not be accessed"*. El efecto
   es el descripto, porque `OLD.location` sí tiene valor, así que lo documenté con la cita textual
   en vez de afirmar un valor concreto. *"Costó dos intentos"* es exacto según los logs: uno que
   falló (16:27) y el actual (16:32).
2. **(c) "un atajo del navegador o del sistema lo dispara sin que nadie esté mirando la ficha"**: es
   cierto con una condición que conviene saber. `keydown` solo llega a la pestaña **que tiene el
   foco**, así que alguien tiene que estar en el teclado. Lo que ocurre es que **la tecla
   modificadora con la que empieza un atajo** (el Ctrl de Ctrl+Tab, el Alt de Alt+Tab) llega a la
   página antes de que el navegador o el sistema se la lleven, y cuenta aunque la persona se esté
   yendo. Lo documenté así. **No lo verifiqué navegador por navegador**: qué atajos reservados llegan
   a la página varía.
3. **(f) "cualquier afirmación sobre que las métricas estén detrás de un plan"**: la sospecha era
   correcta, y **es falso hoy en los dos documentos**. `has_metrics` no gatea nada y ninguna agencia
   lo tiene activo. Quedó corregido en `CLAUDE.md` y en el ítem de analytics de `PENDIENTES.md`.

Todo lo demás es cierto contra el código y la base: los tres lugares, la señal síncrona, la
consecuencia sin `localStorage`, los eventos, el trigger compartido (con **`subscriptions`**), el
mapa que no se desmonta, la función sin barrera, la columna generada (**`location`**) y que la
limpieza de datos de prueba ya estaba anotada.
