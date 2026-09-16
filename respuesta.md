# Tanda de documentación — cierre del grupo de pulido visual

> **Modo ejecución, solo documentación.** Se modificaron **tres archivos `.md`** y ni una línea de `src/`, `scripts/` o la migración. No se ejecutó ningún comando de git. No se ejecutó SQL de escritura (el MCP es de solo lectura y toda medición fue con `SELECT`).
>
> **Cómo trabajé.** No documenté desde el prompt: **los informes de las seis tandas seguían en el transcripto de la sesión** aunque `respuesta.md` se haya sobrescrito, así que los recuperé enteros (siete versiones) y de ahí salió la lista cruda de inconsistencias. **Después verifiqué cada una contra el código de hoy**, porque varias se habían resuelto de paso. Donde el prompt y la medición no coincidieron, gana la medición y está reportado en la sección 5.

---

## 1. Qué cambió en cada archivo

### `CLAUDE.md` (+30.629 bytes)

**Agregado — cinco piezas nuevas:**

| Sección nueva | Qué contiene |
|---|---|
| **`## Formas, alturas y tipografía de los controles`** | La regla completa: **la forma la decide QUÉ ES el elemento**, con la tabla de cinco familias (marca chica 4 / tocable 6 / contenedor 8 / circular / sin caja), la advertencia de que venir del preset no exime, el porqué de que los tres valores sean fijos y no derivados, y **las seis excepciones deliberadas con su motivo**. Después: la **escala de altos** (44/36/28 + íconos) con la regla de que todo lo que baje de 44 px lleva área de toque extendida. Y la regla **rótulo corto en mayúsculas, frase en minúsculas**, escrita como regla y no como excepción |
| **`### Las hojas que suben desde abajo`** | Las dos hojas, la tabla de **cómo se cierra cada una** (y que el detalle **no** tiene Escape), el porqué de que el gesto sea **estructural y no una condición sobre `scrollTop`**, las cuatro piezas finas del gesto, y **el presupuesto de alto medido** de las dos |
| **`### El campo con caja`** | Las dos familias, la definición única y **por qué son constantes y no una variante del componente** (la caja tiene que vestir contenedores que no son un input) |
| **`### El campo de teléfono`** | Prefijo fijo, qué se guarda contra qué se muestra, qué limpia al pegar (con la tabla de las tres formas reales), por qué al tipear solo se filtran dígitos, la regla de **no corregir nunca** un número guardado, y la limitación aceptada de las líneas fijas |
| **`### ⚠⚠ UN DEFECTO "VISUAL" SOBRE UN CONTROL NO ES VISUAL`** | La lección del grupo, en **Método de Diagnóstico**, junto a los otros patrones |

**Las tres trampas**, dentro de la sección de las hojas:

1. **Un contenedor `h-full` con un hermano arriba desborda** — con el diagrama del `min-height: auto`, los tres archivos donde apareció, y que **en escritorio no se nota**.
2. **Los botones flotantes se pintan encima de la hoja** — con el porqué de que subir el z-index no alcance.
3. **Arrastrar y scrollear son dos gestos verticales en el mismo lugar** — resuelto por estructura.

Y una cuarta, dentro del campo con caja: **`tailwind-merge` elimina las clases del subrayado al recibir un color de borde de cuatro lados**, con el diagrama de qué clase se come a cuál y la regla general para cualquier componente del preset.

**Corregido:**

- El warning del baseline decía **`PropertyForm.tsx:808`** en dos lugares (`:25` y la sección ESLint) → **`:814`**, medido.
- Se agregó que **el número de línea NO es parte del baseline** (fue `:269`, `:808`, `:804`, `:814`): lo que se verifica es *un solo warning, de esa regla, sobre `watch()`*.
- El árbol de carpetas **no listaba `src/components/forms/`** (los dos archivos) ni **`src/lib/utils/phoneWa.ts`**.
- La línea de `FilterPanel.tsx` en el árbol no decía que **se monta dos veces** ni que en celular es una hoja.
- La convención de WhatsApp describía el formato guardado y nada del prefijo.

### `DESIGN.md` (+13.899 bytes)

**Agregado:** la tabla de formas completa (con casillas, menús, desplegables y diálogos, que no estaban), la escala de altos, el tratamiento tipográfico del botón, la regla de rótulo contra frase, las excepciones deliberadas, las **dos familias de campo** con la definición única y el campo con prefijo, y el **título "Precio"** en los dos diagramas.

**Corregido — cinco afirmaciones falsas** (detalle en la sección 3): el `tailwind.config.ts` que no existe, el layout móvil con chips y un FAB, los FABs que "se ocultan con el PropertyModal", la zona segura que no puede funcionar, y las columnas del listado del panel.

⚠ **Dos desvíos los dejé marcados en vez de borrarlos**, porque son inconsistencias abiertas y no errores del documento: el anillo de foco al 20 % y las etiquetas a 12 px. Están anotados como tales, con puntero a `PENDIENTES.md`.

### `PENDIENTES.md` (+31.019 bytes)

- **Sección nueva arriba de todo**: las **42 inconsistencias**, encabezadas por la de seguridad.
- **Cierre del grupo** (`## Pulido visual — grupo CERRADO`): las cuatro piezas, **la lección**, diez decisiones descartadas con su motivo, lo medido, y lo que quedó abierto —incluidas **las tres que este grupo introdujo**, marcadas como tales.
- **Corregido:** el `:808` del baseline (dos veces), el ítem D3 que hablaba de "el panel desplegable actual" cuando hoy es una hoja, el ítem de **"Tamaños de botones"** que quedó cerrado por la escala, y el desfasaje de `DESIGN.md` §7, ya resuelto.

---

## 2. Cuántas inconsistencias, y con qué criterio

| | |
|---|---|
| Anotadas a lo largo del grupo (crudas, con repeticiones entre informes) | **76** |
| Abiertas al relevamiento de formas, ya consolidadas | **46** |
| + las dos últimas tandas | **+12 = 58** |
| **Volcadas a `PENDIENTES.md`** | **42** |
| Resueltas en tandas posteriores a su anotación | **13** |
| **Descartadas al verificarlas contra el código** | **2** |
| Dejó de ser inconsistencia y pasó a ser regla | **1** |
| Fusionadas con otra | **3** |
| Nueva, aparecida en esta verificación | **+1** (`viewportFit`) |

**Las 13 que ya estaban resueltas** y por eso no se escribieron: los radios a 2 px de DESIGN, los siete altos de botón, el contraste de las casillas, las otras tres casillas invisibles, los botones rectos del alta, la forma de diálogos y menús, los filtros de admin, el botón de menú tapando los títulos, la estructura de las opciones de operación, el número de línea del warning, y los dos documentos desactualizados (que cerró esta misma tanda).

**Las 2 descartadas** están escritas en el archivo con lo que se midió, para que nadie las vuelva a anotar: la quita del "15" con característica de 4 dígitos (**probadas las 9.900 posibles, cero casos erróneos**) y el `relative` del botón (**cero hijos `absolute` en todos los usos de `<Button>`**).

**El criterio de prioridad, y por qué ése.** No ordena el **costo de arreglarlo** sino **a quién le pasa algo si se deja**, y el marco es el calendario: fundadoras en septiembre, publicidad en octubre.

- **P0 (1)** — puede comprometer los datos de una agencia frente a otra. Antes del primer cliente que no controlamos.
- **P1 (7)** — una inmobiliaria o un visitante lo ve y **cambia lo que hace o lo que carga**.
- **P2 (16)** — accesibilidad y coherencia visible: no bloquea, pero deja a alguien afuera o da imagen despareja.
- **P3 (18)** — deuda interna, documentación y cosmético.

⚠ **La decisión de orden que más discutiría, y por qué la sostengo:** las dos inconsistencias de las **casillas** están en **P1, no en accesibilidad**, aunque el arreglo sea una clase de color. Es la aplicación directa de la lección: **producen datos mal cargados**, y el costo de arreglar algo no dice nada sobre su prioridad. Por el mismo criterio, cosas que "se ven peor" —los dos altos de hoja, los FABs que desaparecen de golpe— están en P3.

---

## 3. Afirmaciones falsas que encontré

**En `DESIGN.md`** (las cinco corregidas):

| Decía | Lo medido |
|---|---|
| `### Extensión en tailwind.config.ts` con un bloque `theme.extend.colors` | **No existe ningún `tailwind.config.*` en el repo.** Es Tailwind v4: los tokens están en `@theme inline` de `globals.css:8`. Ese objeto no lo lee nadie |
| §4: el layout móvil es *"Filtros (chips inline, scroll horizontal)"* y un FAB único *"Ver en mapa"* en `bottom-6 right-6` | **Nunca hubo chips inline.** Son **dos** FABs en `left-4`/`right-4`, y los filtros abren una **hoja desde abajo** |
| §16: los FABs *"se ocultan cuando el PropertyModal está abierto"* | También con la hoja de filtros, desde la primera tanda del grupo |
| §13: los FABs respetan `env(safe-area-inset-bottom)` | **Cierto y sin efecto:** `layout.tsx:65-67` declara solo `themeColor`, y **sin `viewportFit: "cover"` esas variables valen 0 en todo dispositivo**. La regla está escrita, aplicada, y no hace nada |
| §7: el listado del panel sin las columnas de visitas y consultas | Las tiene desde el 14 sep (`PropertiesTable.tsx:228-229` y `:391-401`) |

**En `CLAUDE.md`:** el warning del baseline en **`:808`** (dos veces) cuando está en **`:814`** — exactamente el número desactualizado que anticipaba el prompt. Y el árbol de carpetas sin `components/forms/` ni `phoneWa.ts`, que existen desde la segunda tanda.

**En `PENDIENTES.md`:** el mismo `:808` (dos veces), y el ítem D3 describiendo "el panel desplegable actual" cuando hoy es una hoja.

**En la propia lista de inconsistencias**, dos afirmaciones que arrastraba de informes anteriores:

- *"Etiquetas en MAYÚSCULAS a **14 px**"* → son **12 px** (`text-xs`). El desvío contra DESIGN existe, pero es otro número.
- *"La quita del 15 **podría** fallar"* → estaba anotada como no verificada; **se verificó y no falla**.

---

## 4. Baseline de calidad

Corrido **después** de editar los tres `.md`. Borré `.next/` y `tsconfig.tsbuildinfo` antes de la primera corrida.

### `npx tsc --noEmit`

```
TSC_EXIT=0
```

Sin salida: **0 errores, exit 0.**

### `npm run lint`

```
> marka@0.1.0 lint
> eslint

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  814:30  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:814:30
  812 |   });
  813 |
> 814 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
      |                              ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  815 |   const lat = watch("lat");
  816 |   const lng = watch("lng");
  817 |   const address = watch("address") ?? "";  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)

LINT_EXIT=0
```

**0 errores, 1 warning** (el conocido, `react-hooks/incompatible-library`), **exit 0**. ⚠ **En `:814`, no en `:808`**: es el número que este informe corrigió en los dos archivos.

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 7.7s
  Running TypeScript ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (20/20) in 2.5s
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

BUILD_EXIT=0
```

**Verde, exit 0, 22 rutas.** Como anticipaba el prompt, tocar solo `.md` no movió nada: **idéntico antes y después** de las ediciones.

---

## 5. Lo que este prompt afirma y no resultó exacto

**1. ⚠ `PENDIENTES.md` NO tiene "sección de método", así que la lección fue a otro lado.** El prompt pide meterla "en la sección de método, junto a los otros patrones". Los patrones de método viven **en `CLAUDE.md` → "Método de Diagnóstico"** (ahí están los seis casos de comentarios que mienten, la regla de recorrer de punta a punta y la trampa de las columnas generadas). En `PENDIENTES.md` lo que hay son párrafos de *"Método, lo que dejó el grupo"* al cierre de cada grupo. **Hice las dos cosas**: el patrón completo en `CLAUDE.md`, donde están sus pares, y el resumen con el caso concreto en el cierre del grupo, donde el archivo ya lo espera.

**2. "El gesto escucha solo la zona que no scrollea" vale para UNA de las dos hojas.** La de filtros sí, y por estructura. **La del detalle sigue escuchando la hoja entera** (`PropertyModal.tsx:788-790`), sin mirar el scroll: no se tocó a propósito, porque cambiarlo le saca un gesto a quien ya lo usa. Lo documenté como la excepción abierta y es la **inconsistencia 4 (P1)**, no una nota al pie.

**3. "No respondía la tecla de escape" — se arregló en una sola hoja.** `FilterPanel.tsx:189-196` cierra con Escape; **el detalle no tiene ningún listener** (grep vacío en todo `src/`). Está en la inconsistencia 9 (P2).

**4. "Son más de cincuenta" — sí, pero solo 42 sobreviven a la verificación.** Crudas fueron 76; consolidadas y abiertas, 58. Verificar cada una contra el código de hoy fue la mitad del trabajo de esta tanda, y **16 se cayeron**: trece resueltas, dos que no existen y una que se convirtió en regla.

**5. El ítem de seguridad es como lo describe el prompt, con una precisión que conviene tener.** Confirmado que la policy no restringe columnas y que el rol autenticado puede escribir `role` y `agency_id`. Las precisiones: el permiso **no es por columna sino de tabla entera** (`authenticated=arwdDxtm`, y las nueve columnas tienen `attacl` nulo, o sea **cero restricciones**); `anon` tiene el mismo permiso pero **la policy lo frena** porque exige `auth.uid()`, así que hace falta **una sesión de agente real**; y la agravante que no estaba en el prompt: los caminos que confían en esas dos columnas —gestión de propiedades de la agencia y alta/baja de agentes— **escriben con service role**, que saltea la RLS.

**6. No creé `supabase/pending/`.** La convención del proyecto manda un cambio de schema sin aplicar a `supabase/pending/<fecha>-<tema>.sql`, y ese directorio **no existe hoy** (que es el estado sano). Esta tanda era de documentación y el prompt acotó a tres archivos, así que **el SQL de la corrección quedó escrito dentro del ítem**, listo para copiar. Si querés que además quede como archivo pendiente, es un `Write` de dos líneas.

**7. Dato de procedencia, para que no se lea como medido hoy.** Los números del bloque "Lo que se MIDIÓ al cerrar" (contraste 4,31–5,07:1, radios del CSS compilado, 28→44 px de área de toque, los altos scrolleables) **son las mediciones de las tandas que los produjeron**, recuperadas de sus informes; no las volví a tomar en esta tanda, que no levantó el servidor. Lo que **sí** medí hoy contra el código o la base: las 42 inconsistencias una por una, la policy y los permisos de `agents`, el baseline, y las cinco afirmaciones falsas de `DESIGN.md`.

**8. Una que el prompt da por sentada y es exacta:** *"sus números de radio eran los correctos y el código no los cumplía. Ahora sí"*. Verificado en el CSS compilado y en `globals.css:60-63`: los tres valores coinciden con la tabla de §4 por primera vez.
