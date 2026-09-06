# Informe — Herramienta de auditoría y limpieza de huérfanos de Storage

**Modo ejecución.** Se creó un script y se agregaron dos entradas a `package.json`.
**No se ejecutó ningún comando de git.** **No se ejecutó SQL de escritura** (el MCP se usó
solo para medir). **No se ejecutó el script**: lo corre el dueño, primero en simulación.

**Baseline: intacto.** tsc 0 errores · lint 0 errores + el mismo warning único · build verde
con **las mismas 19 rutas**. Salidas completas en §6.

**Un número del prompt no coincide con la base: son 15 huérfanos, no 14.** Detalle en §7.

---

## 1. Dónde quedó el script y por qué ahí

**`scripts/storage-orphans.ts`**

| Decisión | Por qué |
|---|---|
| **Carpeta `scripts/` en la raíz** | Fuera de `src/`, como pedía la decisión 1. Next.js solo genera rutas desde `src/app/`, así que nada de acá puede entrar al bundle ni sumar una ruta — **verificado con el build: siguen siendo 19** |
| **Nombre en kebab-case** | `storage-orphans.ts`, siguiendo la convención de archivos y carpetas del proyecto |
| **Nombre en inglés** | CLAUDE.md → *"Lógica de negocio en español, código en inglés"*. Los nombres de archivo del repo son ingleses (`getPlanUsage`, `resolveAgencyBySlug`, `formatPrice`); los comentarios del script son todos en español |
| **TypeScript, no JavaScript** | El proyecto es estricto en TS y `tsconfig.json` ya incluye `"**/*.ts"`, así que **el script queda cubierto por `npx tsc --noEmit` sin tocar nada de la configuración**. ESLint también lo cubre (verificado abajo) |

### Que tsc y lint lo cubran no lo di por sentado: lo verifiqué

- **tsc.** `tsconfig.json` tiene `"include": [… "**/*.ts" …]` y `"exclude": ["node_modules"]`.
  `scripts/storage-orphans.ts` entra solo. Lo confirmé al toparme con **dos errores reales de
  tipos que el chequeo encontró y hubo que arreglar** (`.range()` mal ubicado antes de
  `.select()`, y un cast que PostgREST no podía inferir). Si el archivo no estuviera cubierto,
  esos errores habrían pasado a producción sin que nadie los viera.
- **ESLint.** Verificado que **no está ignorado**:
  ```
  $ npx eslint scripts/storage-orphans.ts        → exit 0
  $ npx eslint --print-config scripts/storage-orphans.ts   → 112 reglas activas,
    incluidas @typescript-eslint/no-explicit-any y compañía
  ```

**No hizo falta excluir ni incluir nada explícitamente, ni tocar `tsconfig.json` ni
`eslint.config.mjs`.**

### Cómo se ejecuta, y por qué no hizo falta ninguna dependencia

Node del proyecto: **v22.20.0** (CLAUDE.md pide 20+). Dos capacidades nativas alcanzan:

1. **`--env-file=.env.local`** (Node 20.6+) carga las variables sin ninguna librería. Este
   script corre **fuera de Next.js**, así que nadie le inyecta el entorno: sin ese flag,
   `process.env.SUPABASE_SERVICE_ROLE_KEY` viene vacío.
2. **Ejecución directa de TypeScript.** Node 22.18+ hace *type stripping* **por defecto**, sin
   flags ni warnings. Lo comprobé antes de escribir el script con un archivo `.ts` de prueba
   (que después borré): corre igual con `--experimental-strip-types` y sin él.

**Cero dependencias nuevas.** No hacía falta `tsx`, ni `ts-node`, ni `dotenv`.

---

## 2. Los dos comandos exactos

### Modo simulación — DETECTA E IMPRIME, NO BORRA NADA

```bash
npm run storage:huerfanos
```

### Modo borrado — DESTRUCTIVO

```bash
npm run storage:huerfanos:borrar
```

**Los dos hay que correrlos desde la raíz del repo** (`/home/facuzavaleta89/dev/marka`), que
es donde está `.env.local`.

### Lo mismo, sin npm

Si preferís ver qué hace cada uno, los scripts de npm son literalmente esto:

```bash
# Simulación
node --env-file=.env.local scripts/storage-orphans.ts

# Borrado
node --env-file=.env.local scripts/storage-orphans.ts --borrar
```

### El comportamiento de los argumentos

- **Sin argumentos → simulación.** Es el predeterminado: alguien que lo corra por curiosidad
  no puede destruir nada.
- **Solo borra con `--borrar` escrito completo.** No hay abreviatura ni variable de entorno
  que lo active.
- **Un argumento desconocido ABORTA**, no cae en simulación:
  ```ts
  const unknown = args.filter((arg) => arg !== "--borrar");
  if (unknown.length > 0) {
    throw new Error(
      `Argumento(s) no reconocido(s): ${unknown.join(", ")}\n` + …
  ```
  El motivo está comentado en el código: correr con `--borar` y ver un informe sin borrados
  haría pensar que **no había nada que borrar**, cuando en realidad no se pidió el borrado.
- **Si faltan las variables de entorno**, el error dice exactamente cuáles faltan **y repite el
  comando con `--env-file`**, porque ese es el error que va a cometer quien lo corra suelto.

---

## 3. Cómo detecta cada categoría

El script **calcula los huérfanos él mismo**: lista el bucket entero, lee las tablas de
referencia y clasifica archivo por archivo. No recibe ninguna lista.

### La función de clasificación, completa

```ts
function classify(file: StoredFile, refs: References): Verdict {
  const segments = file.path.split("/");
  const fileName = segments[segments.length - 1];

  // d) PLACEHOLDER. Va primero porque puede aparecer en cualquiera de los tres
  // prefijos y no depende de ninguna fila.
  if (fileName === PLACEHOLDER_NAME) {
    return {
      kind: "orphan",
      category: "placeholder",
      reason: "marcador de carpeta vacía del panel de Supabase",
    };
  }

  // Las tres formas conocidas tienen 3 segmentos como mínimo. Cualquier otra
  // cosa no se toca.
  if (segments.length < 3) {
    return { kind: "unknown_shape", reason: "el path no tiene la forma esperada" };
  }

  const [first, second] = segments;

  // b) AVATAR — avatars/{agent_id}/{archivo}
  if (first === AVATARS_PREFIX) {
    if (!UUID_PATTERN.test(second)) {
      return { kind: "unknown_shape", reason: "la carpeta no es un id de agente" };
    }
    if (!refs.avatarPathByAgent.has(second)) {
      return {
        kind: "orphan",
        category: "avatar_unreferenced",
        reason: `no existe el agente ${second}`,
      };
    }
    // Existe el agente pero su columna apunta a otro archivo: es el avatar
    // viejo que quedó cuando subió uno con otra extensión (el upsert pisa el
    // mismo path, no el de otra extensión).
    if (refs.avatarPathByAgent.get(second) !== file.path) {
      return {
        kind: "orphan",
        category: "avatar_unreferenced",
        reason: "el agente existe pero su avatar_url apunta a otro archivo",
      };
    }
    return { kind: "in_use", reason: "avatar referenciado por su agente" };
  }

  // c) LOGO — logos/{agency_id}/{archivo}
  if (first === LOGOS_PREFIX) {
    if (!UUID_PATTERN.test(second)) {
      return { kind: "unknown_shape", reason: "la carpeta no es un id de agencia" };
    }
    if (!refs.logoPathByAgency.has(second)) {
      return {
        kind: "orphan",
        category: "logo_unreferenced",
        reason: `no existe la agencia ${second}`,
      };
    }
    if (refs.logoPathByAgency.get(second) !== file.path) {
      return {
        kind: "orphan",
        category: "logo_unreferenced",
        reason: "la agencia existe pero su logo_url apunta a otro archivo",
      };
    }
    return { kind: "in_use", reason: "logo referenciado por su agencia" };
  }

  // a) FOTO DE PROPIEDAD — {uploader_agent_id}/{property_id}/{archivo}
  //
  // ⚠ EL PRIMER SEGMENTO ES EL AGENTE QUE SUBIÓ EL ARCHIVO, NO EL DUEÑO DE LA
  // PROPIEDAD (ver CLAUDE.md → "Imágenes y Storage"), así que NO se lo usa para
  // decidir nada: un agente borrado no vuelve huérfanas las fotos de las
  // propiedades que se reasignaron a su admin y siguen publicadas. Lo único que
  // manda es el SEGUNDO segmento: ¿existe esa propiedad?
  if (!UUID_PATTERN.test(second)) {
    return { kind: "unknown_shape", reason: "la carpeta no es un id de propiedad" };
  }
  if (!refs.propertyIds.has(second)) {
    return {
      kind: "orphan",
      category: "property_missing",
      reason: `no existe la propiedad ${second}`,
    };
  }
  return { kind: "in_use", reason: "foto de una propiedad que existe" };
}
```

### Categoría por categoría

| | Cómo se detecta |
|---|---|
| **a) Foto de propiedad inexistente** | Path `{uuid}/{property_id}/{archivo}`. **Solo mira el SEGUNDO segmento contra `propertyIds`.** El primero es el agente que subió el archivo, no el dueño, y usarlo sería el error destructivo clásico |
| **b) Avatar sin referencia** | Path `avatars/{agent_id}/…`. Dos causas distintas, con mensajes distintos: **el agente no existe**, o **existe pero su `avatar_url` apunta a otro archivo** (el avatar viejo que quedó al subir uno con otra extensión) |
| **c) Logo sin referencia** | Idéntico, contra `logos/{agency_id}/…` y `agencies.logo_url` |
| **d) Placeholder** | `fileName === ".emptyFolderPlaceholder"`. Se chequea **primero**, porque aparece dentro de los tres prefijos y no depende de ninguna fila |
| **Todo lo demás** | `in_use` (no se toca) o, si el path no responde a ninguna forma conocida, `unknown_shape` — que **nunca se borra** y se imprime en su propia sección. No saber qué es algo no autoriza a destruirlo |

### La regla de oro, aplicada donde importa

**El criterio es "¿existe la fila?", nunca "¿está publicada?".** El script **no mira `status`
en ningún lado**: `fetchReferences` pide `properties(id)` a secas, sin filtro. Una foto de una
propiedad pausada, vendida o alquilada tiene su fila y sale `in_use`. Lo mismo con las
propiedades de una agencia dada de baja, cuyos datos se conservan intactos a propósito.

### Cuatro salvaguardas que no estaban en el pedido y agregué

1. **Toda lectura es fail-closed.** Si falla el listado del bucket o cualquier consulta, se
   aborta y no se borra nada. **Es la falla más grave posible del script**: si la lista de
   propiedades vuelve incompleta, las fotos de las propiedades que no se leyeron pasan a
   "propiedad inexistente" y en modo borrado **se borran**. Mismo criterio que
   `deleteAgencyAction` (*"un count que no se pudo leer NO es un cero"*).
2. **Paginación en las dos puntas.** `list()` trae 100 por página y `select()` de PostgREST
   corta en 1000 filas. Sin paginar, **una propiedad viva que quedara fuera de la página 2
   volvería huérfanas a sus fotos**. Se paginan las dos, y el listado del bucket además baja
   recursivamente (`list()` devuelve un solo nivel y marca las carpetas con `id: null`).
3. **Se descarta la query string al comparar URLs.** Si un `logo_url` llevara un cache-buster
   (`?t=…`), la comparación exacta fallaría y **el logo que la agencia está mostrando ahora
   mismo se clasificaría como huérfano**. Un path nunca contiene `?` ni `#`, así que
   recortarlos es seguro y cierra ese agujero.
4. **El segmento del id tiene que ser un UUID.** Si no lo es, el archivo va a `unknown_shape`
   en vez de a "no existe la fila". Sin eso, cualquier carpeta con un nombre inesperado se
   clasificaría como huérfana por no matchear ninguna fila.

---

## 4. La regla de las 24 horas

### Por qué existe, en el código

```ts
// ⚠ NO SE BORRA NADA DE MENOS DE 24 HORAS, Y NO ES PRUDENCIA GENÉRICA.
// Al dar de alta una propiedad, las fotos se suben al bucket ANTES de que la
// propiedad exista en la base: el id se genera en el cliente (CreatePropertyInput
// .id) y las filas de property_images se escriben recién al guardar. O sea que
// un archivo bajo un property_id que todavía no existe puede ser basura de un
// formulario abandonado O un formulario que alguien tiene abierto en otra
// pestaña ahora mismo, y los dos casos son INDISTINGUIBLES desde acá.
// Se informan, nunca se borran — ni siquiera en modo borrado.
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
```

### Cómo se calcula

```ts
// ⚠ Un archivo cuya antigüedad NO se puede establecer se trata como RECIENTE,
// no como viejo: ante la duda no se borra.
function isRecent(file: StoredFile, now: number): boolean {
  if (!file.createdAt || Number.isNaN(file.createdAt.getTime())) return true;
  return now - file.createdAt.getTime() < RECENT_WINDOW_MS;
}
```

La fecha sale del `created_at` que devuelve el listado de Storage. **Un archivo sin fecha, o
con una fecha ilegible, se trata como reciente** — la duda siempre se resuelve del lado de no
borrar.

### Cómo se aplica

Se calcula **una sola vez por archivo**, junto con la clasificación:

```ts
  const classified: ClassifiedFile[] = files.map((file) => ({
    ...file,
    verdict: classify(file, refs),
    isRecent: isRecent(file, now),
  }));
```

Y el conjunto borrable sale de restarla, en **un solo lugar del que después bebe el borrado**:

```ts
  const deletable = orphans.filter((f) => !f.isRecent);
  const skipped = orphans.filter((f) => f.isRecent);
```

`report()` devuelve `deletable`, y `removeFiles()` recibe exactamente eso. **No hay ningún
camino por el cual un archivo reciente llegue a `remove()`**: la lista que se borra es la
misma que se imprimió como borrable.

### Qué ve el operador

Los recientes **sí se listan**, dentro de su categoría, con la marca `[RECIENTE, SE OMITE]`, y
se cuentan aparte en el subtotal y en los totales:

```
  Huérfanos            : 15 · 5.994.725 B (5,72 MiB)
     de los cuales:
     · borrables       : 15 · 5.994.725 B (5,72 MiB)
     · recientes (<24h): 0  ← nunca se borran
```

### Un detalle de la medición de hoy que muestra que la regla no es teórica

`logos/6e819c62-…/logo.jpg` tiene **24,2 horas** de antigüedad ahora mismo. Hace quince
minutos habría entrado como `[RECIENTE, SE OMITE]`. La ventana está haciendo su trabajo en el
borde justo hoy.

---

## 5. Qué agregué a `package.json`

**Dos scripts. Ninguna dependencia.**

```json
"storage:huerfanos": "node --env-file=.env.local scripts/storage-orphans.ts",
"storage:huerfanos:borrar": "node --env-file=.env.local scripts/storage-orphans.ts --borrar"
```

**Por qué dos entradas y no una con argumentos:** `npm run x -- --borrar` es exactamente el
tipo de sintaxis que se escribe mal (el doble guion se olvida y el argumento se pierde en
silencio, dejando al operador convencido de que borró). Dos nombres distintos hacen que
**pedir el borrado sea imposible por accidente**: hay que escribir la palabra `borrar`.

**Por qué existen:** el prompt pide comandos listos para copiar y pegar sin dar por sentado que
quien los corre sabe cargar variables de entorno en un script suelto. Estas dos entradas
encapsulan el `--env-file=.env.local`, que es justo la parte que se olvida.

**No se agregó ninguna dependencia**, ni de producción ni de desarrollo (§1).

---

## 6. Los tres comandos de calidad

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
✓ Compiled successfully in 9.0s
  Running TypeScript ...
  Finished TypeScript in 8.2s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/19) ...
  Generating static pages using 3 workers (4/19) 
  Generating static pages using 3 workers (9/19) 
  Generating static pages using 3 workers (14/19) 
✓ Generating static pages using 3 workers (19/19) in 1432ms
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

### Comparación contra el baseline

| | Baseline | Ahora | ¿Coincide? |
|---|---|---|---|
| `tsc --noEmit` | 0 errores, exit 0 | 0 errores, exit 0 | ✅ |
| `lint` errores | 0 | 0 | ✅ |
| `lint` warnings | 1 · `react-hooks/incompatible-library` · `PropertyForm.tsx:808` | 1 · el mismo · `808:30` | ✅ |
| `next build` | verde, exit 0 | verde, exit 0 | ✅ |
| **Rutas** | **19** | **19, las mismas** | ✅ |

El script vive en `scripts/`, fuera de `src/app/`, así que Next.js no lo ve como parte de la
aplicación — **y el build lo confirma**, que era exactamente la prueba que pedía el prompt.

---

## 7. Lo que no cerró como lo dice el prompt

### (1) Son 15 huérfanos, no 14

El prompt dice *"de 24 objetos en el bucket, 14 son huérfanos"*. **Medido contra la base hoy
(2026-09-06 22:05 UTC), aplicando exactamente los cuatro criterios de la decisión 4: son 15.**

| Categoría | Archivos | Bytes |
|---|---|---|
| a) Foto de propiedad inexistente | 10 | 5.897.004 |
| b) Avatar sin referencia | 1 | 64.863 |
| c) Logo sin referencia | 1 | 32.858 |
| d) Placeholder | 3 | 0 |
| **Total huérfanos** | **15** | **5.994.725** |
| En uso | 9 | 723.872 |
| **Total del bucket** | **24** | **6.718.597** |

Los otros dos números del prompt **sí dan**: ≈6 MB (5.994.725 B = 5,72 MiB) y **89,2 %** del
peso, que es *"más del 85 %"*.

**Dónde está la diferencia, casi con seguridad:** son **tres** placeholders, no dos. Uno está
en `avatars/`, dos en `logos/`. Una auditoría anterior contaba como huérfano solo el que está
bajo una agencia que ya no existe (`logos/1a794e72-…`) y dejaba los otros dos afuera; el
criterio (d) de este prompt los incluye a los tres, sin condición. **La diferencia es a favor
de este prompt, no en contra**: el criterio nuevo es más completo.

Lo digo porque el prompt pide contrastar la salida del script contra la lista conocida: **si al
correrlo dice 15 y no 14, no es un bug del script.** El desglose de arriba es contra qué
contrastar. Los 15 paths exactos salen del propio informe del script.

### (2) Nada va a quedar afuera por reciente en la primera corrida

Todos los huérfanos tienen más de 24 horas — el más nuevo, `logos/6e819c62-…/logo.jpg`, tiene
**24,2 h**. Así que el `recientes (<24h): 0` que va a imprimir es correcto, no un síntoma de
que la regla no funcione. Por el margen de 12 minutos, vale la pena saberlo de antemano.

### (3) La decisión 7 previó bien un obstáculo que efectivamente apareció

*"Usá el helper de service role que ya existe en el proyecto, **o construí el client de la
misma forma si desde un script no se puede importar**"* — no se puede. `src/lib/supabase/admin.ts`
se importa por el alias `@/…`, que lo resuelve el bundler de Next y no Node; y un import
relativo con extensión `.ts` exigiría activar `allowImportingTsExtensions` en el `tsconfig.json`
de toda la aplicación, que es un cambio desproporcionado para esto. **El client se construye
con la misma forma de llamada**, y está comentado por qué.

Por el mismo motivo, la función que traduce URL → path es una **réplica deliberada** de
`src/lib/utils/storagePath.ts`, marcada como tal en el código, con una diferencia justificada:
la del script además descarta la query string (§3, salvaguarda 3).

### (4) El resto se implementó tal cual, y una cosa que conviene tener presente

Las diez decisiones se implementaron como estaban descritas; ninguna resultó imposible.

Lo único que quiero dejar dicho, porque no está en el pedido y afecta cómo leer la salida: **el
script mira `properties`, `agents` y `agencies`, no `property_images`.** Un archivo cuya
propiedad existe cuenta como en uso **aunque no tenga fila en `property_images`** — el caso de
un alta abandonada donde la propiedad sí llegó a crearse. Es el criterio correcto según la
decisión 4 (que define la categoría (a) por la existencia de *la propiedad*), y es también el
más conservador de los dos. Solo conviene saberlo si algún día los números del script no cierran
contra un `SELECT` sobre `property_images`.
