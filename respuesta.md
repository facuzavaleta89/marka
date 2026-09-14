# Cierre documental del grupo del sitio de marca

> **Modo ejecución, solo documentación.** Se modificaron **únicamente `CLAUDE.md` y
> `PENDIENTES.md`** (más este informe). No se tocó `src/`, `scripts/`, el archivo de migración ni
> `DESIGN.md`. No se ejecutó ningún comando de git ni SQL de escritura.
>
> **Fecha:** 13 sep 2026. **Todo lo documentado salió de leer el código y medir la base**, no del
> prompt.

---

## 1 · CLAUDE.md

### Secciones nuevas (3)

| Sección | Qué documenta |
|---|---|
| **La dirección del sitio de marca — reservadas y edición** | La lista de 135 reservadas con sus tres grupos y **la regla de mantenimiento**; la edición (quién, qué se valida, el aviso) y la decisión de que los enlaces viejos no se redirigen |
| **El sitio apagado le habla a su dueño** | Los **seis motivos** de `AgencyDisabledReason`, el reparto entre lo que resuelve la agencia y lo que depende del dueño, y **el mecanismo exacto** del descarte por cookie |
| **El cambio de nombre de la agencia** | Las dos columnas con sus comentarios de la base, dónde se pide, el aviso, qué ve el dueño y **las tres formas de resolverlo**, con el porqué de que el rechazo sean dos |
| **Las guardas del cambio de nombre, y el alcance de cada una** | Las cuatro guardas con su motivo, y la comparación contra la base |

### La regla de método nueva

**La sección existía** (`## Método de Diagnóstico`) y la regla se agregó ahí, como séptimo caso,
junto a los otros patrones:

> ### ⚠⚠ RECORRER EL CAMINO DE PUNTA A PUNTA, NO DESDE EL MEDIO (13 sep 2026)
>
> **Es de otra familia que las seis anteriores.** Aquellas son sobre creerle a un comentario; ésta
> es sobre **construir lo que procesa un pedido sin verificar que el pedido se pueda hacer**.
>
> **⚠ EL ORIGEN DEL ERROR ES ESPECÍFICO:** se vio que `updateAgencyIdentityAction` **aceptaba**
> `name`, y de ahí se asumió que el formulario lo editaba. El formulario **sí llamaba a esa
> action** —así que la conexión se veía en cualquier búsqueda— pero el nombre viajaba dentro de una
> rama que **no se renderizaba** para una agencia aprobada.
>
> **LA REGLA: que una acción acepte un campo NO significa que alguien se lo mande.**
>
> ⚠ **Y el síntoma que lo delata sin abrir el navegador: una columna que nunca se escribe.**
> `previous_name` existía, el panel la leía, y **ninguna fila la tenía cargada**.

### Correcciones de lo que estas tandas dejaron falso

| Dónde | Decía | Ahora |
|---|---|---|
| **Estado** (encabezado) | *"B2b … y C … quedan EN PAUSA"* | Se cerraron el 12–13 sep; se agregó el grupo al párrafo de estado |
| **Aprobación de agencias** | *"Nombre y matrícula son editables SOLO mientras está `pending` o `rejected`"* | **El nombre se edita siempre; la matrícula se congela al aprobar**, con el detalle de que la action **ignora** (no rechaza) una matrícula entrante |
| **White-label → sub-piezas** | *"EN PAUSA … No se tocan hasta resolver los cambios profundos de modelo"* | Las dos hechas, con lo que el ítem preveía y lo que no |
| **Estructura de carpetas** | faltaban 4 archivos | Agregados `reservedSlugs.ts`, `agencyName.ts`, `AgencyUnavailableForAdmin.tsx`, `AgencySlugForm.tsx`; actualizados `agencySlug.ts`, `AgencyIdentityForm.tsx`, `agency/` y `preferencias/` |
| **Tabla `agencies`** | sin las columnas nuevas | `previous_name` + `name_change_requested_at`, y que **`name` solo tiene `NOT NULL`** |
| **Baseline** | *"última medición: 12 sep 2026"* | 13 sep 2026 |

---

## 2 · PENDIENTES.md

### Cerrado

- **Sub-pieza B2b** (estaba `[ ]` EN PAUSA) → cerrada, con lo que el ítem preveía (se cumplió tal
  cual) y **lo que no preveía: son seis motivos, no uno**.
- **Sub-pieza C** (estaba `[ ]` EN PAUSA) → cerrada, más el agujero que hubo que cerrar antes y que
  el ítem no mencionaba: **no había ninguna lista de direcciones reservadas**.
- **"Edición del nombre de la agencia"** (deuda abierta desde el trabajo de matrícula) → cerrada.
  Salió **como el ítem pedía**: un flujo de aprobación, no un campo editable con warning.
- **El grupo entero**, en un bloque nuevo: **"Sitio de marca — grupo CERRADO (12–13 sep 2026,
  cuatro tandas)"**.

### Los cuatro descartes, registrados con su motivo

| Descartado | Motivo |
|---|---|
| **Historial de direcciones para redirigir las viejas** | Implicaría una tabla de direcciones pasadas **y una consulta más en cada visita** al sitio de marca. Infraestructura permanente para un caso raro |
| **Límite de cuántas veces se cambia la dirección** | Poner un número sería adivinar, y son clientes que pagan |
| **Un formulario aparte para el nombre** | Entró como primer campo del formulario de identidad que ya existe. Una pantalla entera para un campo no se justifica |
| **Bloquear el cambio de dirección sin estar al día** | **Cambiar el nombre le genera trabajo de aprobación al dueño; cambiar la dirección no le genera nada a nadie.** Aplicarle la guarda sería costo sin beneficio |

### Abierto (4 ítems nuevos, todos aparecidos midiendo)

1. **⚠ Rechazar un cambio de nombre rechaza la agencia entera.** `approval_status` es de la agencia,
   no del nombre, así que la vuelta a `pending` apaga **cuatro cosas** (mapa, fotos, consultas,
   sitio). **Mitigado, no resuelto**: el aviso lo advierte y "Rechazar el nombre" la devuelve en un
   movimiento. De raíz pide un eje separado → otro cambio de base.
2. **La guarda `ever_approved` se apoya en un historial con huecos.** Existe para que un botón que
   dice *"rechazar"* no **apruebe** a una agencia que nunca lo estuvo. Falla cerrada.
3. **Las dos advertencias de Preferencias no se pueden confirmar juntas.** Son dos formularios con
   dos submits. No es un bug: es una pieza propia si alguna vez se quiere.
4. **Lo aceptado a conciencia**, tres ítems (ver §4).

### Ajustado

- Cabecera: última actualización 12 → **13 sep 2026**, con el resumen del grupo.
- **Todas las cifras de datos de prueba re-medidas** (ver §4).
- El ítem del baseline: re-medido el 13 sep, y se le sumó que **el grupo del sitio de marca
  confirmó dos veces más la regla de usar `Controller` en vez de `watch()`** — la vista previa de la
  dirección y el aviso del nombre necesitan el valor en vivo, y con `watch()` cada uno habría sumado
  su propio warning.

---

## 3 · Afirmaciones falsas encontradas

**Cinco en `CLAUDE.md`, todas dejadas por estas tandas**, más las cifras de `PENDIENTES.md`.

1. **"Nombre y matrícula son editables SOLO mientras está `pending` o `rejected`; se bloquean al
   aprobar."** El motivo que daba era que cambiarlo después *"tendría que ser otro flujo de
   aprobación que hoy no existe"*. **Ese flujo ya existe** y el congelamiento del nombre era lo
   único que faltaba sacar.
2. **"B2b … y C … quedan EN PAUSA"** (en el párrafo de Estado). Las dos cerradas.
3. **"EN PAUSA (Sub-piezas B2b y C) … No se tocan hasta resolver los cambios profundos de
   modelo"** (en la sección de white-label). Ese modelo se estabilizó.
4. **La estructura de carpetas omitía cuatro archivos** y describía `preferencias/` como si la
   identidad fuera editable solo con la agencia sin aprobar.
5. **La tabla `agencies` no tenía las dos columnas nuevas**, y no decía que `name` carece de
   unicidad y de largo máximo.

**En `PENDIENTES.md`:** las cifras de datos de prueba (agencias, propiedades, agentes, proporción de
logos, planes presentes) quedaron viejas porque **la base cambió entre tandas**.

⚠ **Y una que NO corregí porque no es falsa, solo incompleta:** `NameChangeCaveat` dice *"tu
inmobiliaria queda con el nombre nuevo hasta que vos lo corrijas: no lo volvemos atrás por nuestra
cuenta"*. Sigue siendo cierto para **"Rechazar la inmobiliaria"** y dejó de serlo para **"Rechazar
el nombre"**, que sí lo revierte. Es un texto de `src/`, que esta tarea no puede tocar — queda
señalado acá.

---

## 4 · Los números medidos

### ⚠ El que el prompt pide: direcciones existentes contra la lista reservada

**CERO.** Medido ejecutando el código real (`isReservedSlug` + `validateAgencySlug`) sobre las tres
agencias de la base:

```
SLUG                  RESERVADO  VALIDA
inmobiliaria-demo      false      OK
propiedades-gaio       false      OK
inmobiliaria-gaio-2    false      OK

=> agencias con slug RESERVADO: 0
=> agencias con slug que HOY SERÍA INVÁLIDO: 0
```

**Ninguna agencia quedó con una dirección que la lista o la validación nueva volverían inválida**, y
las tres pasan forma y largo (16, 17 y 19 caracteres, tope 40). La lista no obliga a migrar nada.

### La lista reservada

| | Cuántas |
|---|---|
| Grupo 1 · rutas de primer nivel de hoy | **7** |
| Grupo 2 · archivos servidos en la raíz | **21** |
| Grupo 3 · reservadas para el futuro | **107** |
| **Total** (`RESERVED_SLUGS_COUNT`) | **135** |

### Datos de prueba, re-medidos el 13 sep

| | 12 sep (documentado) | **13 sep (medido)** |
|---|---|---|
| Agencias | 4 | **3** |
| Propiedades | 17 (16 activas) | **18 (17 activas)** |
| Agentes | 4 | **3** |
| Consultas | 13 (1 desvinculada) | **13 (1 desvinculada)** — sin cambio |
| Imágenes | 7 | **7** — sin cambio |
| Ciudades activas | 1 | **1** — sin cambio |
| Agencias con logo | 1 de 4 | **1 de 3** |
| Propiedades con precio "a convenir" | 6 | **7** |
| Planes presentes | inicial, profesional, premium | **inicial, profesional** (ya no hay premium) |

### ⚠ Dos hallazgos de los datos que valía la pena documentar

- **Hay DOS agencias con el mismo nombre** ("Inmobiliaria Gaio 2"). Confirma **en datos reales** lo
  que dice la base: `agencies.name` **no tiene unicidad** (el único `UNIQUE` de la tabla es el del
  `slug`). Es la evidencia de por qué la validación del nombre no la inventa.
- **Una agencia tiene el slug `propiedades-gaio` con el nombre "Inmobiliaria Gaio 2"**, o sea una
  dirección que **ya no deriva del nombre**. Es la prueba de que la edición de la dirección se usó
  de verdad.
- **`previous_name` está en `null` en las tres**: no hay ningún cambio de nombre pendiente ahora
  mismo. ⚠ Y es el mismo síntoma que la regla de método nueva señala: **una columna vacía en todas
  las filas es lo que hay que mirar** para saber si un camino de escritura existe. Hoy está vacía
  porque no hay pedidos abiertos, no porque no se pueda escribir — la diferencia se ve en el
  historial: hay un `approved` del 14 sep sobre `propiedades-gaio`.

---

## 5 · Los tres comandos

### `npx tsc --noEmit`
```
(sin salida)
TSC_EXIT=0
```

### `npm run lint`
```
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

LINT_EXIT=0
```

### `npx next build`
```
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

BUILD_EXIT=0
```

**Verde, exit 0, 22 rutas.** Como correspondía: esta tarea toca solo archivos `.md`, así que nada
podía moverse — y no se movió.

| Métrica | Esperado | Medido | |
|---|---|---|---|
| `tsc --noEmit` | 0 errores | **0 errores, exit 0** | ✅ |
| `npm run lint` | 0 errores, 1 warning | **0 errores, 1 warning (`PropertyForm.tsx:808`), exit 0** | ✅ |
| `npx next build` | verde, 22 rutas | **verde, 22 rutas, exit 0** | ✅ |

---

## 6 · Lo que el prompt afirma y no se sostuvo

**Una sola cosa, y es de alcance, no de contenido.**

El prompt describe la tanda 1 como *"lista de direcciones reservadas **y** edición de la dirección"*
y la 4 como *"el campo que faltaba"*. **Las dos son correctas.** Pero el orden causal de la tanda 4
es más específico de lo que sugiere: no es que el campo faltara y se agregara, es que **el campo
existía y estaba tapado** por un gate (`isLocked = approvalStatus === "approved"`) que ocultaba el
formulario entero para una agencia aprobada — el estado del 100 % de las agencias reales. Lo
documenté así en la regla de método, porque **el modo de fallar importa más que el faltante**: un
campo que no existe se nota; uno tapado por una condición se ve en el código y no en la pantalla.

**El resto se verificó y coincide:**

- ✅ La lista de reservadas **cerraba un agujero que ya existía** (no había ninguna).
- ✅ El sitio apagado **ahora le habla a su administrador** con el motivo real.
- ✅ El cambio de nombre **devuelve la agencia a revisión**, con dos columnas nuevas y **dos formas
  de rechazo**.
- ✅ Las tres primeras tandas **se construyeron sin que existiera la punta en la interfaz**.
- ✅ La sección de método **existía** (`## Método de Diagnóstico`), así que la regla se agregó ahí y
  no hubo que crearla.

⚠ **Y una precisión sobre el punto (e) del encargo:** pedía documentar *"la que impide pedir un
cambio de nombre estando ya pendiente"*. **Esa guarda no existe como bloqueo.** Lo que hay es que
una agencia `pending` **puede** cambiar su nombre y **el estado no se mueve** —ya está en la cola,
no hay nada que reenviar—. Lo documenté como es, en la tabla de las cuatro guardas: es una guarda
sobre la **transición**, no sobre el pedido.
