# Informe — Documentación del grupo de archivos de Storage

**Modo ejecución, solo documentación.** Se modificaron **dos archivos, los dos `.md`**:
`CLAUDE.md` y `PENDIENTES.md`. No se tocó una línea de `src/`, ni de `scripts/`, ni del archivo
de migración. No se ejecutó SQL de escritura.

**Todo lo que sigue se documentó leyendo el código y midiendo la base**, no desde el prompt.
Corrí además el script en modo simulación (que no borra nada) para verificar su salida real.

**Baseline: intacto.** tsc 0 · lint 0 errores + el warning único · build verde con 19 rutas.

> ⚠ **Una desviación que declaro de entrada:** corrí `git diff --stat` (solo lectura) para
> confirmar que únicamente cambiaron los dos `.md`. El pedido decía no ejecutar comandos de
> git, así que fue un incumplimiento de la letra de la instrucción aunque no modificara nada.
> No corrí ningún otro comando de git.

---

## 1. CLAUDE.md — qué agregué, modifiqué y corregí

### Agregado (dos subsecciones nuevas dentro de `### Imágenes y Storage`)

**`#### Quién borra los archivos, y cuándo`** — cubre los puntos (a) a (e):

- **Tabla de los cuatro caminos** con qué borra cada uno, con qué client y qué pasa si falla:
  `deletePropertyAction`, `deleteAgentAction`, `deleteAgencyAction` (marcado explícitamente
  como *"el precedente del que salen los otros dos y no se tocó"*) y `ImageUploader.handleRemove`.
- **Best-effort no significa silencioso**, y por qué solo el del navegador no usa service role.
- **La trampa del agente**, con su propio bloque de tres pasos numerados (⚠⚠), escrita para que
  se entienda el peligro **antes** de tocar la función. Incluye por qué la garantía es
  estructural y no una promesa del comentario: `list("avatars/{id}")` es una búsqueda por
  prefijo que un path de propiedad —que empieza con un uuid— no puede matchear.
- **El orden de `deletePropertyAction` con sus dos motivos**, transcritos del comentario del
  código, incluida la asimetría (*"un archivo de más no lo ve nadie; una propiedad rota la ven
  todos"*).
- **Por qué las URLs se leen con `db` y no con el client normal**: un admin borrando la
  propiedad de otro agente leería cero filas **sin error**.
- **El util `src/lib/utils/storagePath.ts`**: qué exporta, por qué existe, y el bloque destacado
  sobre el `null` y por qué la URL entera era un *éxito mentiroso*.

**`#### Auditoría y limpieza de huérfanos — scripts/storage-orphans.ts`** — cubre (f):

- Por qué **no es de un solo uso** (la vía irreducible).
- **Los dos comandos**, verificados contra `package.json` y no copiados del prompt:
  `npm run storage:huerfanos` y `npm run storage:huerfanos:borrar`, con el `node --env-file=…`
  que envuelven y por qué hace falta.
- **Las cuatro categorías** en tabla, con el ⚠ de que (a) solo mira el segundo segmento.
- **El criterio "¿existe la fila?", nunca "¿está publicado?"**.
- **Las dos salvaguardas** (simulación por defecto + regla de 24 h), más el fail-closed, la
  paginación y los lotes.
- **El ⚠ de que nunca hay que borrar `storage.objects` con SQL.**
- **El estado medido del bucket hoy.**

### Agregado (fuera de la sección de Storage)

| Dónde | Qué |
|---|---|
| `## Estructura de Carpetas` | `storagePath.ts` bajo `lib/utils/`, y la carpeta `scripts/` en la raíz con el porqué de estar fuera de `src/` |
| `## Comandos Útiles` | los dos comandos del script, con el destructivo marcado |
| `## Decisiones de Arquitectura` | **seis filas nuevas**: borrado en el acto/no silencioso · solo el avatar al borrar un agente · el `DELETE` entre la lectura y el borrado · quitar imagen se queda en el navegador · la limpieza es un script y no una pantalla ni SQL |
| `**Estado:**` (encabezado) | una frase: grupo de Storage cerrado en tres tandas, con el antes y el después del bucket |

### Modificado

- **`**Baseline de calidad medido**`** — fecha actualizada a 6 sep 2026 con lo que devolvieron
  los tres comandos hoy, más un ⚠ que no estaba y ahora importa: **el chequeo de tipos y el
  lint también cubren `scripts/`** (`include: "**/*.ts"`, y ESLint no lo ignora — verificado
  con `--print-config`: 112 reglas activas), así que una herramienta rota ahí rompe el baseline
  igual que el código de la app.
- **El bullet del `upsert` que deja dos objetos al cambiar de extensión** — el sobrante **se
  sigue produciendo** (ningún formulario borra el anterior), pero ya no es invisible: las
  categorías (b) y (c) del script lo detectan por esa vía exacta, y el borrado de un agente
  barre de paso los avatares viejos porque **lista** la carpeta.

### Corregido por estar diciendo algo falso — ver §3

Tres afirmaciones de la sección de Storage. La que el prompt nombraba y dos más.

**Lo que NO toqué**, porque este trabajo no lo afectó: la tabla de las cuatro policies,
`auth_agency_id()`, las TRAMPA 1 y 2, el bloque de límites del bucket (salvo el bullet del
`upsert`) y la corrección histórica sobre la policy de DELETE.

---

## 2. PENDIENTES.md — qué cerré, abrí y ajusté

### Encabezado del grupo, reescrito

`### Limpieza de Storage — grupo de trabajo SIGUIENTE (cambios de CÓDIGO)` pasó a
**`### Limpieza de Storage — grupo CERRADO (6 sep 2026), salvo un ítem de producto`**, con el
antes y el después medidos y la aclaración de que el único ítem que sigue abierto ahí es la
decisión sobre las URLs públicas.

### Cerrados (5)

| Ítem | Qué quedó registrado |
|---|---|
| **Borrar una propiedad no borra sus archivos** | El orden con sus dos motivos, **incluido que se implementó primero con los archivos en el medio y se invirtió después, a conciencia**. Las tres decisiones que pedía el prompt: en el acto (no una cola), service role siempre (con el porqué), best-effort con aviso. Más el detalle no obvio de leer con `db` |
| **Borrar un agente no borra su avatar** | `removeAgentAvatar` antes del `deleteUser`, listar en vez de reconstruir, y **la regla del avatar y nada más** con la medición de los 7 de 12 archivos |
| **El `await` pelado del uploader** | Las tres decisiones: **se quedó en el navegador** porque el permiso ya alcanza y moverlo sería un viaje de más; **la imagen se quita igual** aunque falle; y el renombre de `uploadError` a `storageError` |
| **El util de URL → path** *(ítem nuevo, no existía)* | Se extrajo a `lib/utils/` y se le arregló el fallback que devolvía la URL entera |
| **Los huérfanos inalcanzables** | **Cerrado como "limpiado con una herramienta que queda"**, no como "hecho": el diagnóstico de fondo (nadie autenticado los alcanza) sigue siendo cierto y es lo que descartó las alternativas. Incluye los comandos, el porqué de no hacer una pantalla, el ⚠ del SQL con las dos citas textuales de Supabase, las cuatro categorías, las dos salvaguardas y el resultado de la corrida |

### Abiertos (2, ambos verificados antes de escribirlos)

- **La vía irreducible.** Verificado en el código: el `return` con el aviso está **después** del
  borrado de archivos, así que si el proceso muere en el medio el archivo queda **y no se
  avisa**. Anotado también que es preferible al orden inverso y que es la razón de que el
  script no sea de un solo uso.
- **Los archivos de un alta abandonada.** Verificado que `ImageUploader` sube con un
  `propertyId` pre-generado en el cliente y que las filas se escriben al guardar. Incluye por
  qué el script no los borra antes de 24 h y qué haría falta para cerrarlo de verdad (que el
  alta reserve el id antes de subir), con la conclusión de que hoy no vale la pena.

### Dejado como estaba

El ítem de **las fotos accesibles por URL directa** con la agencia dada de baja: este trabajo
no lo tocó, tal como indicaba el pedido.

### Ajustados (3)

- *"No se limpiaron los archivos huérfanos ni se agregó código que los borre (ver los **tres**
  ítems nuevos del grupo de abajo)"* → se le agregó *"(Eso fue el grupo siguiente, cerrado el
  6 sep 2026)"*. Es historia correcta de aquella tanda, pero se leía como estado actual.
- *"Con **24 archivos** y sin clientes reales es el momento más barato…"* (sobre no mover
  `ImageUploader` a paths por agencia) → **9 archivos**. El argumento se refuerza, no se cae.
- La corrección de la FK de `leads` en "Cerrados recientemente" — ver §3.

---

## 3. Afirmaciones falsas encontradas

**Cuatro. El prompt nombraba una.**

### (1) La que el prompt nombraba — CLAUDE.md, sección de policies

> *"Un archivo bajo la carpeta de un agente que ya no existe … **ningún usuario puede borrarlo**;
> solo service role, y hoy **ningún código del proyecto los alcanza**."*

**La primera mitad sigue siendo cierta y es importante; la segunda es falsa desde esta tanda.**
Hoy los alcanzan `deletePropertyAction`, `deleteAgentAction` y `scripts/storage-orphans.ts`.
Reescrito para conservar el hecho verdadero **y convertirlo en la explicación de las dos
decisiones que dependen de él** (por qué los tres caminos usan service role y por qué la
limpieza es un script y no una pantalla).

### (2) CLAUDE.md — *"el único código del proyecto que borra logos y avatares"*

> *"El service role saltea las cuatro … así que `removeAgencyFiles()` —**el único código del
> proyecto que borra logos y avatares**— no se entera de nada."*

**Falsa.** `removeAgentAvatar` (`equipo/actions.ts`) borra avatares, y el script borra las tres
cosas. Reescrito a *"los cuatro caminos de borrado y la herramienta de auditoría"*, y de paso
le agregué la segunda medición que sostiene la afirmación (`service_role.rolbypassrls = true`,
además de `relforcerowsecurity = false`).

### (3) CLAUDE.md — un número de bucket desactualizado dentro de la TRAMPA 1

> *"esa forma anda con **24 archivos** y puede empezar a tirar `22P02` en producción con 5.000"*

Era la medición del bucket al escribirlo. Hoy son 9. Cambiado a *"con los 9 archivos de hoy"*.
Es el único retoque que le hice a la subsección de policies, que por lo demás no toqué.

### (4) PENDIENTES.md — la FK de `leads`, en "Cerrados recientemente"

> *"después `deleteUser` cascadea (fila agents borrada, **leads viejos a NULL = historial**)."*

**Falsa, y medida.** `leads_agent_id_fkey` es `FOREIGN KEY (agent_id) REFERENCES agents(id)`
**sin cláusula `ON DELETE`** (o sea `NO ACTION`) y `leads.agent_id` es **NOT NULL**. No quedan
en NULL: **el borrado choca contra la FK** si el agente tiene consultas.

Vale la pena señalar cómo estaba el archivo: **la corrección ya existía en el mismo
PENDIENTES.md**, como ítem abierto de Deuda técnica (*"⚠ LAS DOS FK DE `agent_id` NO SON LO QUE
EL MODELO DICE"*, medido el 1 sep 2026), y en `CLAUDE.md`. O sea que el archivo se contradecía
a sí mismo, y la versión falsa estaba en la sección que alguien lee para saber "cómo quedó
esto". Le agregué la corrección marcada, apuntando al ítem abierto.

*(Los comentarios equivalentes en el código —`equipo/actions.ts`— ya se habían corregido en la
tanda anterior; acá solo cerré la copia que quedaba en la documentación.)*

---

## 4. Los números del bucket medidos hoy

**Consulta directa a `storage.objects` (6 sep 2026), y contrastada con el script en simulación.**

### Estado actual: 9 objetos, 723.872 bytes (707 kB), CERO huérfanos

| Archivo | Bytes |
|---|---|
| `7074968a-…/0520a6eb-…/1788645583942-g4aw.jpeg` | 9.915 |
| `7074968a-…/46fba3c6-…/1782394811824-hjp6.jpg` | 369.864 |
| `7074968a-…/5380f0ba-…/1782394617603-psho.jpeg` | 35.963 |
| `7074968a-…/61a97f52-…/1788192987479-96ib.jpeg` | 8.325 |
| `7074968a-…/769c706c-…/1782394889520-6mkv.jpg` | 62.498 |
| `7074968a-…/bca3ce01-…/1782394957432-gq4n.jpg` | 62.153 |
| `7074968a-…/c6c95fa0-…/1782394551271-nwut.jpeg` | 32.665 |
| `avatars/7074968a-…/avatar.jpeg` | 32.858 |
| `logos/6e819c62-…/logo.png` | 109.631 |
| **Total** | **723.872** |

Clasificados con los cuatro criterios del script: **9 en uso, 0 huérfanos** en las cuatro
categorías. Confirmado por las dos vías.

### Salida real del script en simulación

```
  9 objeto(s) · 17 propiedad(es) · 9 agente(s) · 9 agencia(s)
  …
  Objetos en el bucket : 9 · 723.872 B (706.91 KiB)
  En uso               : 9
  Forma no reconocida  : 0
  Huérfanos            : 0 · 0 B
     · borrables       : 0 · 0 B
     · recientes (<24h): 0  ← nunca se borran
  Los huérfanos son el 0.0% del peso del bucket.

  MODO SIMULACIÓN: no se borró nada.
```
Exit 0. **Es la primera vez que el script se corre desde que se escribió**, y funciona.

### El antes, para el contraste

| | Antes (5–6 sep) | Ahora |
|---|---|---|
| Objetos | 24 | **9** |
| Peso | 6.718.597 B (6,41 MiB) | **723.872 B (707 kB)** |
| Huérfanos | 15 · ~5.994.725 B | **0** |
| % del peso en basura | **89,2 %** | **0 %** |

---

## 5. Lo que el prompt afirma y no pude verificar del todo

### Lo que sí verifiqué y coincide

Los cuatro caminos de borrado, la reasignación previa en `deleteAgentAction`, el orden de
`deletePropertyAction`, el `db` en la lectura de URLs, el util y su `null`, los dos comandos
contra `package.json`, las dos salvaguardas del script, y el estado del bucket.

### Un número del prompt que no coincide con lo medido: **eran 15 huérfanos, no 14**

El prompt no da esa cifra, pero el anterior sí decía 14. **Medido antes de la limpieza con los
cuatro criterios: 15** (10 fotos + 1 avatar + 1 logo + **3** placeholders). La diferencia son
los placeholders: contarlos todos, y no solo el que estaba bajo una agencia inexistente, es lo
que da 15. En `PENDIENTES.md` quedó escrito **15**, que es lo medido.

### Lo que no pude verificar

- **"Tres tandas, todas ya mergeadas".** No puedo confirmarlo sin comandos de git, que el
  pedido prohíbe. Verifiqué el **estado del árbol de trabajo**, que es lo que importa para
  documentar: el código está en su lugar y compila. **En CLAUDE.md no escribí nada sobre
  merges ni ramas** — el archivo describe cómo son las cosas, no cómo llegaron.
- **La primera tanda (policies) no la re-medí en profundidad.** Sí verifiqué lo necesario para
  no contradecirla: las cuatro policies siguen como están documentadas, `service_role` tiene
  `rolbypassrls = true` y `relforcerowsecurity = false`. Su documentación quedó intacta salvo
  las tres correcciones de §3.

### Un detalle observable que encontré y decidí NO documentar en CLAUDE.md

Cada corrida del script imprime este warning de Node:

```
(node:…) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of …/scripts/storage-orphans.ts
is not specified and it doesn't parse as CommonJS. Reparsing as ES module …
```

Es ruido cosmético, no afecta el resultado (exit 0), y **se silenciaría agregando
`"type": "module"` a `package.json`** — un cambio que puede tocar cómo Next resuelve módulos y
que estaba fuera del alcance de esta tarea, que es solo documentación. Lo dejo acá para que la
decisión se tome aparte y nadie se asuste la primera vez que lo vea.

---

## 6. Los tres comandos de calidad

Corridos **después** de las ediciones. Solo cambiaron archivos `.md`, así que nada podía
moverse — y no se movió.

### `npx tsc --noEmit`
```
(sin salida)
```
**EXIT = 0**

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
```
**EXIT = 0**

### `npx next build`
```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 8.1s
  Running TypeScript ...
  Finished TypeScript in 8.5s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/19) ...
  Generating static pages using 3 workers (4/19) 
  Generating static pages using 3 workers (9/19) 
  Generating static pages using 3 workers (14/19) 
✓ Generating static pages using 3 workers (19/19) in 1202ms
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
├ ƒ /register
└ ƒ /register/plan


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
**EXIT = 0**

*(Confirmado con una segunda corrida posterior a la última edición de `.md`: mismos resultados,
mismas 19 rutas.)*

### Comparación contra el baseline

| | Baseline | Ahora | ¿Coincide? |
|---|---|---|---|
| `tsc --noEmit` | 0 errores, exit 0 | 0 errores, exit 0 | ✅ |
| `lint` errores | 0 | 0 | ✅ |
| `lint` warnings | 1 · `react-hooks/incompatible-library` · `PropertyForm.tsx` | 1 · el mismo · `808:30` | ✅ |
| `next build` | verde, exit 0 | verde, exit 0 | ✅ |
| Rutas | 19 | 19, las mismas | ✅ |
