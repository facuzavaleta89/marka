# Documentación del cierre — C3 y el grupo de captación y difusión

> **Modo ejecución, solo documentación.** Se modificaron **dos** archivos: `CLAUDE.md` y
> `PENDIENTES.md`. **No se tocó `src/`, `scripts/`, el archivo de migración ni `DESIGN.md`.**
> **No se ejecutó ningún comando de git** ni SQL de ninguna clase.
> **Fecha:** 10 sep 2026.

**Verificación de que no se tocó código** (por marca de tiempo, ya que no se puede usar git):

```
### src/ scripts/ supabase/ + DESIGN.md
11:09:30.3061670130  src/app/(public)/page.tsx
11:09:30.3061670130  src/components/auth/PublicHeaderAuth.tsx
11:09:30.3061670130  src/components/map/AgencyMapView.tsx
11:09:30.3061670130  src/components/map/CityPicker.tsx
11:09:30.3061670130  DESIGN.md
### lo que sí se editó en esta tanda
11:16:36  CLAUDE.md
11:19:25  PENDIENTES.md
```

Los cinco primeros comparten un timestamp **idéntico al nanosegundo** y son anteriores al inicio
de esta tanda (~11:10): son de las tandas de implementación previas, no de ésta.

---

## 1. CLAUDE.md — qué agregué, modifiqué y corregí

### Agregado: una sección nueva

**`### El encabezado público — tres variantes, y la puerta de captación`**, insertada entre "Las
dos puertas a la ficha" y "Infraestructura de buscadores" (queda con las demás superficies
públicas, y después de que white-label y la ficha ya están introducidas, que es a las que
referencia). Cubre, en este orden:

- **El antes**, con el dato medido: las únicas apariciones de la palabra "inmobiliaria" en toda la
  superficie pública eran **comentarios de código**.
- **Tabla de las tres superficies** (home / sitio de marca / ficha) con dónde vive cada encabezado
  y qué ofrece.
- **La home**: tabla de los tres enlaces con destino, tratamiento y comportamiento en `< sm` y
  `≥ sm`; por qué el llamado **no es terracota** (el FAB ya lo usa; precedente literal de DESIGN
  §11 con el `LocationPicker`); y por qué **el que se cae en pantalla chica es el llamado y no el
  ingreso**, con la consecuencia asumida escrita.
- **Por qué en el sitio de marca no va la captación** — con la razón comercial completa: ese sitio
  es lo que la agencia compra con `has_white_label`, el marketplace es **por ciudad**, y el llamado
  usaría el espacio que paga un cliente para captar a su competencia de la misma ciudad. Con el
  argumento textual que le daría para no renovar.
- **Por qué en la ficha tampoco va, por ahora** — quien llega busca una casa, y la página existe
  para renderizarse entera en el servidor: un llamado dependiente de sesión obligaría a estrenar
  una isla de cliente contra su razón de ser.
- **El componente compartido**: ruta, firma, por qué la prop no tiene default, y que **absorbió la
  detección de sesión** que estaba duplicada carácter por carácter.
- **Trampa 1 — el mecanismo antisalto**: la grilla 1×1, y que la rama inactiva se apaga con
  `invisible` y **nunca** con `hidden`, porque tiene que seguir ocupando la celda. Con el corolario
  para futuros cambios de breakpoint: se apaga **un enlace de adentro**, nunca una rama entera.
- **Trampa 2 — las guardas de ancho**: tabla de las cinco, contra qué protege cada una, que el
  fallo es **silencioso** (lo recorta el `overflow-hidden` del raíz), y que el caso máximo —
  "Santiago del Estero", 19 caracteres — **es el caso normal**, porque es la única ciudad activa.
- **Trampa 3 — el nombre suelto**: por qué el arreglo fue **envolverlo** y no agregarle una clase
  (un nodo de texto en un flex es un item anónimo: no había dónde poner `truncate`).
- **Los anchos medidos** con el método (fontkit + `wght` → `avar` → `HVAR`), la tabla completa, y
  **el umbral: desde 376 px el nombre entra completo**.

### Agregado: siete filas en "Decisiones de Arquitectura"

Componente compartido con variantes · sin captación en el sitio de marca · sin captación en la
ficha · el llamado no es terracota · en pantalla chica se cae el llamado · `visibility` y no
`display` para la rama inactiva · el estado de carga renderiza el encabezado real.

### Agregado: tres entradas en la estructura de carpetas

`PublicHeaderAuth.tsx` bajo `components/auth/`; la nota de `PublicHeader` en `(public)/page.tsx`
(con el ⚠ de que la rama `if (!city)` **no** lo usa); y las guardas del `CityPicker`.

### Corregido

| Dónde | Qué decía | Qué dice |
|---|---|---|
| **Estado** (párr. de apertura) | *"⚠ **El grupo de captación y difusión NO está cerrado**: falta convertir el botón «Ingresar»…"* | El grupo **CERRADO** el 10 sep, con qué trajo la pieza (desduplicación + guardas) |
| **Baseline medido** | *"última medición: 8 sep 2026"* | 10 sep 2026 (los números no cambiaron) |
| **Hoja de ruta de modelo** | *"**Pendiente:** registro opcional de visitantes; **página y link por propiedad**"* | Pendiente **solo** el registro opcional (C1). Ver el punto 3 |

---

## 2. PENDIENTES.md — qué cerré, abrí y ajusté

### Cerrado

- **C3**, con el nivel de detalle del archivo: qué quedó, **qué encontró el diagnóstico que el
  ítem no anticipaba** (la duplicación con divergencia iniciada, las guardas ausentes, y el tercer
  lugar que apareció — el esqueleto con el ancho viejo), una **tabla de cinco descartes**, el
  mecanismo antisalto marcado como la trampa a no romper, y el método de medición de anchos.
- **El grupo entero**, en "Cerrados recientemente": **GRUPO DE CAPTACIÓN Y DIFUSIÓN — CERRADO
  (7–10 sep 2026), tres piezas**, con el hilo común (la app pública era muda hacia afuera), el
  resumen de C2, D2 y C3, los descartes del grupo juntos, lo que dejó abierto, y el apartado de
  método.
- **Encabezado del archivo** (`Última actualización`) reescrito al estado nuevo.

### Los cinco descartes registrados en C3

Los tres que el prompt pedía, más dos que aparecieron midiendo:

1. **La pantalla intermedia** — es una pieza propia y merece pensarse aparte; el enlace va directo
   al registro, que ya dice para quién es en cuatro lugares.
2. **La captación en el sitio de marca** — razón comercial completa.
3. **La captación en la ficha** — los dos motivos (busca una casa / Server Component).
4. **El terracota para el llamado** — ya lo usa el FAB "Ver lista / Ver mapa".
5. **Resolver la sesión en el servidor** — volvería la home `ƒ (Dynamic)`.

### Abierto (cuatro ítems, los cuatro verificados en el código antes de escribirlos)

| Ítem | Dónde lo puse | Verificación |
|---|---|---|
| **C4 · La captación no se ve en el celular** | BLOQUE C, después de C3 | `hidden … sm:inline-flex` en el `<a href="/register">` de `PublicHeaderAuth.tsx` |
| **El subclaim oculto en pantallas chicas** | Deuda técnica (primero de la lista) | `AuthLayout.tsx:56` → `hidden … md:block`; textos en `RegisterForm.tsx:29-30` y `LoginForm.tsx:17` |
| **"Sin ciudades" sin encabezado** | Bugs / observaciones menores | `(public)/page.tsx:107-120`: `<div>` centrado, dos párrafos, **cero `href`** |
| **El último píxel del nombre de la ciudad** | Pulido estético | Medido: 147,8 disponibles contra 148,7 necesarios |

**C4 lleva la alternativa evaluada y no hecha**: el **pie de la lista de propiedades**, con el
argumento de por qué es la única candidata (`PropertyList` es la única superficie pública del
celular que scrollea; el mapa es `h-dvh` con el scroll del documento bloqueado, y los dos FABs ya
están tomados), los a favor y los en contra, y la nota de que **se entrelaza con la pantalla
intermedia descartada**.

### Ajustado

- **"Tamaños de botones"** (Pulido estético) — se le sumó el `h-9` del llamado del encabezado
  como **desviación consciente** de los 44 px de DESIGN §6, para que la pasada pareja la confirme
  o la unifique en vez de "arreglarla" sin contexto.

### Lo que revisé y NO toqué

Barrí el resto del archivo buscando cifras que esta pieza dejara viejas. **No encontré ninguna.**
El calendario de lanzamiento, el bloque de limpieza de datos previo al lanzamiento, la deuda
técnica existente, las decisiones de producto abiertas y V2 **no dicen nada que C3 contradiga**.
No inventé trabajo ahí.

---

## 3. Afirmaciones falsas que encontré

### (a) En CLAUDE.md — corregida

> *"**Pendiente:** registro opcional de visitantes; **página y link por propiedad**."*

**Falsa desde el 8 sep**: "página y link por propiedad" es C2, que está hecha — y el propio párrafo
de Estado, cuatro líneas más arriba, ya lo decía. **No la dejó falsa esta pieza sino la anterior**,
pero está en el mismo bloque de hoja de ruta que C3 tenía que actualizar, así que la corregí en el
mismo movimiento y lo reporto acá.

### (b) En `src/components/auth/PublicHeaderAuth.tsx:77` — **NO corregida, por el modo**

El comentario del mecanismo antisalto dice:

> *"el ancho del bloque se movería **~80 px** en el elemento más prominente del encabezado"*

**Ese número es falso.** Medido contra las fuentes del build: el salto real sería de **195,2 px en
`sm`+** (258,6 → 63,4) y de **22,7 px por debajo** (86,1 → 63,4). Ninguno de los dos se parece a
80. Es un residuo de la estimación por conteo de caracteres de la primera tanda, que sobrevivió a
la medición real y a la inversión del breakpoint.

**No lo toqué porque esta tanda es solo documentación y `src/` está fuera de alcance.** Los números
correctos quedaron en CLAUDE.md → "El encabezado público" y en PENDIENTES.md → C3, así que la
documentación no repite el error. **Es un arreglo de una línea para la próxima tanda que toque ese
archivo** — y encaja exactamente en el patrón que CLAUDE.md → "Método de Diagnóstico" ya advierte:
un comentario que afirma un número desactualiza la sospecha.

### (c) Nada más

Las tres afirmaciones del prompt sobre lo que trajo la pieza —duplicación con divergencia, guardas
ausentes en la home, salto de layout— se verificaron **las tres** contra el código y son exactas.

---

## 4. Los números que medí

**Método:** se cargaron con `fontkit` los `.woff2` que sirve el build (`.next/static/media`). Como
son **fuentes variables** que `fontkit` no puede instanciar en esos subconjuntos, la variación de
peso se aplicó a mano: normalización del eje `wght` → tabla `avar` → deltas de `HVAR`, más el
kerning del layout base. **Control de sanidad:** el mismo texto a peso 400 mide 84,3 px y a 500,
86,1 px — la variación efectivamente se aplica.

### Anchos de texto (DM Sans 500 a 14 px; Noto Serif 700 a 24 px con `tracking-[-0.01em]`)

| Texto | Ancho |
|---|---|
| "Marka." | **85,1 px** |
| "Santiago del Estero" | **126,7 px** |
| "Iniciar sesión" | **86,1 px** |
| "Ir al panel" | **63,4 px** |
| "Sumá tu inmobiliaria" | **134,5 px** |
| "Ingresar" (variante `agency`) | **53,2 px** |

### Slots

| Slot | Ancho | Composición |
|---|---|---|
| Marca | 85,1 px | — |
| Selector de ciudad | **148,7 px** | 126,7 + `gap-1.5` 6 + chevron 16 |
| Botón del llamado | 160,5 px | 134,5 + `px-3` 24 + borde 2 |
| Puerta `< sm` | **86,1 px** | `máx(86,1 · 63,4)` |
| Puerta `≥ sm` | **258,6 px** | `máx(160,5 + 12 + 86,1 · 63,4)` |

### El umbral

| Viewport | Dispone el selector | Necesita | Resultado |
|---|---|---|---|
| 320 px | 92,8 | 148,7 | recorta (−55,9) |
| 360 px | 132,8 | 148,7 | recorta (−15,9) |
| **375 px** | **147,8** | **148,7** | **recorta (−0,9)** |
| 390 / 393 / 412 / 430 px | 162,8 / 165,8 / 184,8 / 202,8 | 148,7 | ✅ completo |
| 640 px (`sm`) | 240,3 | 148,7 | ✅ completo (+91,6) |

**Umbral: desde 376 px de viewport el nombre de la ciudad entra completo.** Con el reparto
anterior de esta misma pieza —cuando en pantalla chica quedaba el llamado— el umbral era
**451 px**, o sea que **ningún teléfono** lo mostraba entero.

### Salto de layout que el mecanismo apaga

**195,2 px en `sm`+ · 22,7 px por debajo.**

### Datos de la base (solo lectura)

**Una sola ciudad activa: "Santiago del Estero", 19 caracteres** — o sea, el caso máximo y el caso
normal a la vez.

---

## 5. Baseline

Corrido **después** de escribir los dos `.md`. Se borraron `.next` y `tsconfig.tsbuildinfo` antes
de medir; **no apareció el ruido de herramienta: ningún error en `.next/**`.**

### `npx tsc --noEmit`

```
=== npx tsc --noEmit ===
EXIT_TSC=0
```

Salida vacía. **Exit code 0. 0 errores.** ✅

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

EXIT_LINT=0
```

**0 errores, 1 warning** — el único conocido, mismo archivo y misma línea. **Exit code 0.** ✅

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 7.1s
  Running TypeScript ...
  Finished TypeScript in 7.9s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (20/20) in 1379ms
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

**Verde, exit code 0, 22 rutas** (contadas una por una). `/` sigue `○ (Static)`, `/sitemap.xml`
sigue `ƒ`, `/robots.txt` sigue `○`. ✅ **Nada se movió**, como correspondía a una tanda que solo
toca `.md`.

---

## 6. Qué de este prompt resultó falso

**Nada de lo que el prompt afirma resultó falso.** Los tres hallazgos que enumera —el enlace
duplicado con copias ya divergentes, el encabezado de la home sin ninguna guarda de ancho mientras
el del sitio de marca las tenía todas, y el salto de layout por el cambio de texto según sesión—
se verificaron contra el código y son exactos.

**Dos precisiones, ninguna contradice el prompt:**

1. **Los lugares a tocar eran "dos y medio", no dos.** Además de los dos archivos con el enlace,
   apareció un tercero: el **esqueleto de carga** de la home tenía el ancho del slot derecho
   escrito a mano (`w-16` = 64 px, dimensionados para la palabra "Ingresar"). No estaba en la lista
   y era obligatorio: sin ajustarlo, la home saltaba al terminar de cargar. Quedó registrado en
   C3 como "el tercer lugar".
2. **La afirmación de que "no hay una sola línea de la interfaz que le hable" a una inmobiliaria
   era literalmente cierta**, verificada por barrido exhaustivo: las tres apariciones de la palabra
   "inmobiliaria" en toda la superficie pública eran comentarios de código. Lo dejo asentado porque
   es de las afirmaciones fáciles de escribir de memoria y ésta estaba medida.

**Y una cosa que el prompt no podía saber:** el comentario del propio componente
(`PublicHeaderAuth.tsx:77`) contiene un número falso (~80 px contra los 195,2 / 22,7 reales). Está
en el punto 3(b), sin corregir por estar fuera del alcance de esta tanda.

---

## Estado final

Dos archivos `.md` modificados. Baseline intacto en los tres frentes, 22 rutas con el mismo nombre
y el mismo tipo. **No se ejecutó ningún comando de git**, según lo indicado.
