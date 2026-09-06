# Informe — Reordenamiento del borrado de una propiedad

**Modo ejecución, alcance mínimo.** Se modificó **un solo archivo** y **una sola función**.
No se ejecutó ningún comando de git. No se ejecutó SQL de escritura (ni de lectura: este
cambio no lo necesitaba, la clave foránea ya estaba medida y documentada).

**Baseline: intacto.** tsc 0 errores · lint 0 errores + el mismo warning único · build verde
con las mismas 19 rutas. Salidas completas en §5.

---

## 1. Qué se cambió

**Un archivo:** `src/app/(agent)/dashboard/propiedades/actions.ts`
**Una función:** `deletePropertyAction`

| Antes | Ahora |
|---|---|
| 1. leer las URLs | 1. leer las URLs *(sin cambios)* |
| 2. borrar los archivos del bucket | 2. **borrar la fila de la propiedad** |
| 3. borrar la fila de la propiedad | 3. **borrar los archivos del bucket** |

**Nada más se tocó.** Ni `deleteAgentAction` (`equipo/actions.ts`), ni `ImageUploader.tsx`,
ni `src/lib/utils/storagePath.ts`, ni `removePropertyFiles` (que quedó exactamente igual: la
función que borra no cambia, solo cambia cuándo se la llama), ni `CLAUDE.md`, ni
`PENDIENTES.md`.

---

## 2. Cómo quedó la función

`src/app/(agent)/dashboard/propiedades/actions.ts:257-331`:

```ts
export async function deletePropertyAction(id: string): Promise<ActionResult> {
  const { ok, error, db } = await authorizePropertyAccess(id);
  if (!ok) return { error: error! };

  // ⚠ EL ORDEN DE LOS TRES PASOS TIENE DOS MOTIVOS DISTINTOS, Y CONVIENE LEER
  // LOS DOS ANTES DE REACOMODAR NADA:
  //   1. leer las URLs   ← antes del DELETE, o se pierden
  //   2. borrar la fila
  //   3. borrar los archivos  ← después del DELETE, o se rompe la propiedad
  //
  // MOTIVO 1 — POR QUÉ LAS URLs SE LEEN ANTES DEL DELETE.
  // property_images_property_id_fkey es ON DELETE CASCADE (medido contra la
  // base), así que el DELETE de la propiedad se lleva las filas con las URLs en
  // el MISMO instante: después no hay de dónde sacar los paths. Es el mismo
  // razonamiento que ya está escrito en removeAgencyFiles (admin/actions.ts),
  // donde los archivos se localizan primero porque "son lo único que NO se
  // puede volver a localizar una vez borradas las filas".
  //
  // MOTIVO 2 — POR QUÉ LOS ARCHIVOS SE BORRAN DESPUÉS DE LA FILA, Y NO PEGADOS
  // A LA LECTURA DE ARRIBA. Acá está la tentación: agrupar los pasos 1 y 3 se
  // ve más prolijo —"leo las URLs y borro los archivos de una"— y ES UN ERROR.
  // El motivo 1 se satisface con SOLO leerlas: una vez leídas viven en memoria
  // y el CASCADE ya no las alcanza, así que agrupar no compra nada y paga un
  // riesgo. La asimetría, que no es pareja ni por asomo:
  //   · si los archivos se borran y el DELETE de la fila falla después, queda
  //     una propiedad VIVA y PUBLICADA con sus imágenes destruidas: filas de
  //     property_images apuntando a archivos que ya no existen, o sea una
  //     propiedad rota en el mapa público, a la vista de cualquier visitante.
  //   · si la fila se borra y el borrado de archivos falla después, quedan
  //     archivos que ya no sirve nadie: basura inerte en un bucket, invisible
  //     para todo el mundo, y que además se avisa (ver el cierre de abajo).
  // Un archivo de más no lo ve nadie; una propiedad rota la ven todos. Por eso
  // el DELETE va en el medio: el paso irreversible sobre el bucket ocurre
  // recién cuando ya no queda nada que romper.
  //
  // Se lee con `db`, NO con el client normal: la RLS de property_images está
  // atada al agent_id dueño ("Agent manages own property images"), así que un
  // admin borrando la propiedad de otro agente de su agencia leería CERO filas
  // con el client normal — y el borrado de archivos no fallaría, simplemente no
  // borraría nada, en silencio. En mode "admin", `db` ya es service role.
  const { data: images, error: imagesError } = await db   // ← ① LEER LAS URLs
    .from("property_images")
    .select("url")
    .eq("property_id", id);

  // ON DELETE CASCADE en la DB elimina property_images y leads asociados.
  const { error: dbError } = await db                     // ← ② BORRAR LA FILA
    .from("properties")
    .delete()
    .eq("id", id);

  // Si la fila no se pudo borrar, NO se toca un solo archivo y se sale con el
  // error de siempre. Es exactamente el beneficio de este orden: la propiedad
  // queda intacta, con sus imágenes, y el agente puede reintentar.
  if (dbError) return { error: "No se pudo eliminar la propiedad" };
  revalidatePath("/dashboard/propiedades");

  // La propiedad ya no existe: a partir de acá nada puede romperse, solo
  // sobrar. Si las URLs no se pudieron leer, los archivos quedan y se avisa
  // igual (no hay forma de localizarlos: la lectura era la única oportunidad).
  const storageError = imagesError                        // ← ③ BORRAR ARCHIVOS
    ? "no se pudieron leer las imágenes"
    : await removePropertyFiles(images ?? []);

  // BEST-EFFORT, PERO NO SILENCIOSO. Un archivo que queda es basura inerte en
  // un bucket; dejar viva una propiedad que el agente pidió borrar es peor, así
  // que el borrado de archivos nunca aborta el de la fila. Pero el error no se
  // traga: la propiedad ya no existe, con lo cual esto es un aviso y no un
  // fallo. Misma forma que el cierre de deleteAgencyAction.
  if (storageError) {
    return {
      error: `La propiedad se eliminó, pero quedaron archivos sin borrar en el almacenamiento (${storageError}).`,
    };
  }
}
```

### El detalle de implementación que el reordenamiento obligó a mover

`storageError` era **una sola expresión** que hacía dos cosas a la vez: decidir qué pasó con
la lectura **y** disparar el borrado de archivos. Con el orden nuevo esa expresión tiene que
evaluarse **después** del `DELETE`, no antes — si se hubiera quedado arriba, el
`await removePropertyFiles(...)` de su rama `else` habría seguido corriendo antes de la fila y
el reordenamiento no habría cambiado nada, aunque las líneas *parecieran* reordenadas.

Por eso lo que bajó no es solo la llamada al helper: **bajó la declaración entera de
`storageError`**, y `imagesError` viaja sola desde la lectura hasta después del `DELETE`. Es
la única diferencia estructural del cambio.

---

## 3. Las cuatro reglas que se mantienen sin cambio

| Regla | Dónde se ve, en el código de arriba | ¿Se cumple? |
|---|---|---|
| Si el borrado de la fila falla, **NO se borra ningún archivo** y se devuelve el error de siempre | `if (dbError) return { error: "No se pudo eliminar la propiedad" };` está **antes** de que `storageError` se evalúe, y `return` corta la función. `removePropertyFiles` no llega a llamarse nunca | ✅ Y es el punto de todo el cambio |
| Si el borrado de archivos falla, la propiedad ya se borró y **se avisa con el mismo mensaje que hoy** | El bloque `if (storageError)` final quedó **textualmente idéntico**: `"La propiedad se eliminó, pero quedaron archivos sin borrar en el almacenamiento (${storageError})."` | ✅ Sin tocar una letra |
| Si las URLs no se pudieron leer, **se sigue adelante con el borrado de la fila y se avisa** | `imagesError` no corta nada: el `DELETE` corre igual, y después la rama `imagesError ? "no se pudieron leer las imágenes"` produce el mismo aviso de siempre | ✅ Mismo texto del paréntesis |
| El borrado de archivos sigue con **service role**, y las URLs se siguen leyendo con **el mismo client** | `removePropertyFiles` no se tocó (sigue haciendo su propio `createAdminClient()` adentro); la lectura sigue siendo `await db.from("property_images")` | ✅ Ninguna de las dos líneas cambió |

**Ningún mensaje que ve el usuario cambió**, en ninguno de los tres desenlaces.

### Lo que sí cambió, que es lo que se pidió

El caso *"el `DELETE` falla"*. Antes: los archivos ya estaban borrados y la propiedad
sobrevivía con las imágenes destruidas — filas de `property_images` apuntando a archivos
inexistentes, o sea una propiedad rota en el mapa público. Ahora: **no se tocó un solo
archivo**, la propiedad queda intacta con sus imágenes, y el agente reintenta.

---

## 4. El comentario

Como pedía la tarea, el motivo original **se conservó entero** y se le agregó el segundo.

- **Motivo 1 (conservado):** por qué las URLs se leen antes del `DELETE` — el CASCADE se
  lleva las filas con los paths. Incluye la referencia al precedente de `removeAgencyFiles`.
  Le cambié **una palabra**: donde decía *"donde los archivos van primero"* ahora dice
  *"donde los archivos **se localizan** primero"*, porque con el orden nuevo "van primero"
  sería justo lo contrario de lo que hace esta función y confundiría a quien compare las dos.
- **Motivo 2 (nuevo):** por qué los archivos se borran después de la fila. Está escrito
  **anticipando explícitamente la tentación** que menciona la tarea (*"agrupar los pasos 1 y
  3 se ve más prolijo […] y ES UN ERROR"*) y explicando por qué agrupar no compra nada: el
  motivo 1 ya está satisfecho con solo leer, porque las URLs quedan en memoria.
- **La asimetría, explícita y en los dos sentidos**, con la frase que la resume:
  *"Un archivo de más no lo ve nadie; una propiedad rota la ven todos."*
- **Un mapa de tres líneas arriba de todo**, para que el orden se entienda sin leer los dos
  párrafos completos.
- Se agregaron además **dos comentarios cortos en el cuerpo**, en los puntos donde ahora pasa
  algo que antes no pasaba: uno sobre el `if (dbError)` (*"NO se toca un solo archivo"*) y
  otro sobre el bloque que bajó (*"a partir de acá nada puede romperse, solo sobrar"*).

La nota sobre por qué se lee con `db` y no con el client normal quedó donde estaba, pegada a
la lectura que explica.

---

## 5. Los tres comandos

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
✓ Compiled successfully in 7.8s
  Running TypeScript ...
  Finished TypeScript in 8.3s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/19) ...
  Generating static pages using 3 workers (4/19) 
  Generating static pages using 3 workers (9/19) 
  Generating static pages using 3 workers (14/19) 
✓ Generating static pages using 3 workers (19/19) in 1460ms
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
| `lint` warnings | 1 · `react-hooks/incompatible-library` · `PropertyForm.tsx:808` | 1 · el mismo · **`808:30`, misma línea y columna** | ✅ |
| `next build` | verde, exit 0 | verde, exit 0 | ✅ |
| Rutas | 19 | 19, las mismas | ✅ |

**Nada se movió salvo números de línea dentro del archivo tocado**, como correspondía a un
reordenamiento. El warning sigue en `808:30` porque `PropertyForm.tsx` no se tocó.

---

## 6. Nada que reportar como imposible o falso

El cambio se implementó exactamente como estaba descrito. Las cuatro reglas a conservar se
verificaron una por una contra el código final (§3) y ninguna requirió una excepción.

Dos observaciones de honestidad, ninguna bloqueante:

1. **El nuevo orden no elimina el riesgo, lo cambia por uno mucho más barato.** Sigue habiendo
   una ventana: si el proceso muere entre el `DELETE` y el `remove()`, los archivos quedan
   huérfanos **y sin aviso** (no llega a ejecutarse el `return`). Eso es exactamente la clase
   de huérfano que la limpieza pendiente tiene que barrer, y es preferible a una propiedad
   rota. Una garantía real exigiría transaccionar Storage con Postgres, que no se puede.
2. **`removePropertyFiles` ya no puede reportar nada al usuario si el `DELETE` falla** — pero
   es que en ese caso ya no se lo llama, así que no hay nada que reportar. El único aviso que
   sigue existiendo es el de archivos que quedaron **después** de un borrado exitoso, que es
   el que estaba especificado.
