# Documentación del grupo de trabajo del modelo de la propiedad

Hecho. **Dos archivos modificados: `CLAUDE.md` y `PENDIENTES.md`.** Ni una línea de `src/` ni
del archivo de migración (verificado: `git status` lista solo esos dos). No se ejecutó ningún
comando de git ni ningún SQL de escritura.

Todo se escribió **midiendo**, no desde el prompt: abrí los archivos, leí la base con MCP, y
donde el prompt y la medición diferían, gana la medición (§4).

---

## 1. CLAUDE.md

### Secciones agregadas

- **`### Operaciones, precios y requisitos de la propiedad`** (dentro de "Convenciones de
  Dominio"), que **reemplaza a la vieja `### Precios`** de dos líneas. Es la pieza central, con
  seis sub-bloques: el modelo de tres pares simétricos (con la tabla de columnas), qué significa
  precio en NULL, la regla de qué precio se muestra, el filtro público, los requisitos de
  alquiler, y **las tres trampas medidas**.

### Secciones modificadas

| Dónde | Qué cambió |
|---|---|
| **Estado** (cabecera) | Se sumó "Fase de modelo de la propiedad CERRADA (3 sep 2026)" con las tres piezas. |
| **Estructura de Carpetas** | Entrada nueva para `propertyOperations.ts`; descripciones actualizadas de `formatPrice.ts`, `PropertyMarker.tsx`, `PropertyModal.tsx`, `FilterPanel.tsx`, `ClusterLayer.tsx`, `PropertyCard.tsx`, `PropertyForm.tsx` y `types/`. |
| **ESLint** | Además de corregir el dato falso (abajo), se agregó la regla operativa: **la regla señala una sola `watch()`, la primera del componente**, así que los campos nuevos van con `Controller` — es lo que hicieron las tres tandas y por eso el warning no se multiplicó. |
| **Mapa — performance** | El "diff por ids" ahora remite a la trampa 2; y se documentó que el SELECT del hook es una **lista explícita** casteada por `unknown` (una columna que falte llega `undefined` sin que el compilador avise), y que los requisitos **no** están ahí a propósito. |
| **Base de Datos — fila `properties`** | Los tres pares de operación y las dos columnas JSONB de requisitos. |
| **Base de Datos — Funciones y RPC** | `jsonb_is_short_string_array` con el porqué (un CHECK no admite subconsultas); la advertencia de que `increment_views` **no se llama**; y el **event trigger `ensure_rls`**, que no estaba documentado en ningún lado. |
| **Amenities** (referencia rápida) | Marcado que no tiene barrera de dominio en ninguna capa. |
| **Decisiones de Arquitectura** | Nueve filas nuevas: los dos modelos descartados, moneda por operación, temporal como operación propia, precio opcional, exclusión del filtro de rango, rango habilitado con una sola operación, la regla en una función pura, la validación en tres capas y los libres en columna aparte. |

### Corregido por estar diciendo algo falso

1. **La hoja de ruta listaba las tres piezas como pendientes.** Pasaron a "Ya aplicado"; el
   "Pendiente" quedó solo con registro de visitantes y página por propiedad.
2. **`src/types/supabase.ts` no existe.** Verificado (`ls src/types/` devuelve solo
   `index.ts`). Se corrigieron **las dos** menciones: el árbol de carpetas y el comando
   `supabase gen types typescript --local > src/types/supabase.ts` en "Comandos Útiles", que se
   eliminó y se reemplazó por una nota que explica por qué el proyecto no usa tipos generados.
3. **El baseline decía `PropertyForm.tsx:269` (`watch("currency")`)** en dos lugares (cabecera
   y sección ESLint). Medido: hoy es **`PropertyForm.tsx:808` (`watch("amenities")`)** — la
   llamada anterior desapareció con el campo de moneda. Ver §3.

---

## 2. PENDIENTES.md

### Cerrado

- **B1 · Precio opcional**, **B2 · Requisitos para alquiler** y **B3 · Venta y alquiler a la
  vez**, cada uno con el nivel de detalle que el archivo ya usa: qué se decidió, qué se
  descartó y por qué. Incluye las cinco decisiones que el pedido nombraba (los dos modelos
  alternativos descartados y sus motivos concretos, el temporal como operación simétrica, la
  eliminación de `price_negotiable`, la validación en tres capas, y el estado único), más tres
  que salieron de la implementación y no estaban anotadas:
  - **B1 no se llama "Consultar" sino "A convenir"**, y el precio terminó siendo por
    **operación**, no por propiedad: al hacerse B3 en el mismo grupo, no hizo falta un flag.
  - **B2 decía "mismo patrón que `amenities`" y eso es justamente lo que NO se hizo** en la
    validación. Quedó explícito para que nadie lo lea como un incumplimiento.
  - El texto libre de B2 **empezó siendo una columna TEXT y terminó siendo una lista**, y su
    CHECK necesitó una función porque PostgreSQL rechaza subconsultas dentro de un CHECK.
- Entrada compacta en **"Cerrados recientemente"** que apunta al bloque, siguiendo la
  convención del archivo.

### Abierto (cuatro ítems nuevos, todos verificados antes de escribirlos)

1. **`increment_views` existe pero nunca se llama.** Medido: la función está; `sum(views_count)`
   da **0** sobre 17 filas; la búsqueda en `src/` no devuelve una sola llamada. La métrica de
   visitas del panel muestra ceros. Anotado además que **el comentario del modal apunta al lugar
   equivocado** (dice que falta implementarla en el schema, cuando lo que falta es el `rpc`).
   Marcado como chico y de buen retorno, con el argumento de septiembre: un panel que dice "0
   visitas" con propiedades publicadas se lee como que el producto no funciona.
2. **El event trigger `ensure_rls` no está documentado.** Con su consecuencia práctica: una
   tabla nueva nace con RLS activada y sin policies, o sea invisible hasta que se le escriban.
3. **`amenities` sin barrera de dominio en ninguna capa**, con las tres verificadas y con el
   molde a copiar (el de los requisitos) ya identificado.
4. **El texto libre se guarda sin escapar**, por qué hoy no es riesgo, y por qué hay que
   revisarlo en C2 — con la regla a sostener: escapar en el punto de salida, no en el de entrada.

### Corregido

- El **baseline** de "Deuda técnica" repetía `PropertyForm.tsx:269`.
- El **calendario** decía "13 propiedades, 7 consultas"; medido hoy: **17 propiedades, 8
  consultas** (9 agencias y 9 agentes se mantienen). Agregué que 3 son de doble operación y 5
  tienen alguna operación sin precio, para que se sepa que son datos fabricados de prueba.
- **"Multi-agente no tiene millaje real"** decía "las 11 agencias"; son **9**. La sustancia del
  ítem sigue siendo cierta (re-medido: 0 agencias con más de un agente).
- **D3 (filtros mobile)** proponía chips de operación; se le agregó que **desde B3 ese filtro es
  de selección múltiple**, así que los chips tienen que ser interruptores independientes y no
  una tira excluyente. Es una restricción real para quien lo haga.

El resto del archivo se revisó y se dejó como estaba: D2, C1/C2/C3, las deudas de geocoding,
Storage, FKs de `agent_id`, `past_due`, vencimiento sin efecto automático y el resto de
"Decisiones de producto abiertas" siguen vigentes tal cual.

---

## 3. Afirmaciones falsas encontradas, más allá de las dos que el pedido nombraba

| # | Dónde | Decía | Es |
|---|---|---|---|
| 1 | `CLAUDE.md` cabecera **y** sección ESLint **y** `PENDIENTES.md` Deuda técnica (tres lugares) | warning en `PropertyForm.tsx:269` por `watch("currency")` | `PropertyForm.tsx:808` por `watch("amenities")`. La llamada anterior **ya no existe** |
| 2 | `PENDIENTES.md` calendario | 13 propiedades, 7 consultas | 17 propiedades, 8 consultas |
| 3 | `PENDIENTES.md` multi-agente | "las 11 agencias de la base" | 9 |
| 4 | `src/components/map/PropertyModal.tsx` (**NO lo toqué**) | *"Pendiente de implementar en el schema"* junto a `views_count` | La función **ya está en el schema**; lo que falta es la llamada. Quedó como ítem nuevo de PENDIENTES |

El punto 4 es un comentario de código, y el pedido decía explícitamente no tocar `src/`. Lo
reporto y lo dejé anotado en PENDIENTES.md en vez de corregirlo.

---

## 4. Lo que el prompt afirma y la medición ajustó

Nada resultó falso, pero **dos cosas quedaron más precisas de lo que el prompt las describe**, y
escribí lo medido:

- **El prompt dice "una función `rls_auto_enable`... un event trigger de Supabase".** Medido: la
  **función** se llama `rls_auto_enable()` pero el **event trigger** se llama **`ensure_rls`**.
  Documenté los dos nombres, porque quien vaya a buscar el trigger por el nombre de la función
  no lo encuentra. Además: dispara en `ddl_command_end`, solo para `CREATE TABLE` /
  `CREATE TABLE AS` / `SELECT INTO`, restringido al esquema `public`, y **falla en silencio**
  (loguea y sigue) si no puede habilitar RLS.
- **El prompt describe los CHECK de precio como que dejaban entrar "filas con media pareja".**
  Confirmado, y con las dos direcciones: moneda sin precio **y** precio sin moneda. Lo escribí
  así porque el segundo caso es el menos obvio de los dos.

Todo lo demás se verificó y coincide: las cuatro columnas viejas ya no existen en la base; la
función pura es `getDisplayOperationPrice` en `src/lib/utils/propertyOperations.ts`; el
mecanismo del cluster es un efecto aparte con clave `filters.operation_types.join(",")` que usa
`setMarkerPrice` para markers en el DOM y `setIcon` para los clusterizados; el `preventDefault()`
del Enter está en el campo de requisitos libres; los topes son 5 y 300; `amenities` no valida en
ninguna de las tres capas; y `views_count` es 0 en las 17 filas.

**Una cosa que no pude verificar y por eso no la escribí como hecho:** el pedido dice que la
métrica de visitas "muestra ceros" en el panel. Verifiqué que **el dato es 0** y que
`/dashboard` lo suma y lo muestra, pero no abrí la pantalla en un navegador. Lo escribí como
consecuencia de lo medido, no como observación visual.

---

## 5. Comandos de calidad

### `npx tsc --noEmit`
```
(sin salida)
TSC EXIT: 0
```

### `npm run lint`
```
/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:808:30
> 808 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
      |                              ^^^^^ React Hook Form's `useForm()` API returns a `watch()`
                                           function which cannot be memoized safely.
  809 |   const lat = watch("lat");
  810 |   const lng = watch("lng");
  811 |   const address = watch("address") ?? "";  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)

LINT EXIT: 0
```

### `npx next build`
```
Route (app)
┌ ○ /                                    ├ ƒ /dashboard/leads
├ ○ /_not-found                          ├ ƒ /dashboard/perfil
├ ƒ /[slug]                              ├ ƒ /dashboard/preferencias
├ ƒ /admin                               ├ ƒ /dashboard/propiedades
├ ƒ /api/geocode                         ├ ƒ /dashboard/propiedades/[id]/editar
├ ○ /apple-icon.png                      ├ ƒ /dashboard/propiedades/nueva
├ ƒ /dashboard                           ├ ƒ /dashboard/suscripcion
├ ƒ /dashboard/equipo                    ├ ƒ /login  ├ ƒ /logout
                                         ├ ƒ /register  └ ƒ /register/plan
ƒ Proxy (Middleware)

BUILD EXIT: 0
```
(19 rutas, contadas sobre la salida.)

### Contra el baseline

| Medición | Baseline conocido | Ahora | |
|---|---|---|---|
| `tsc --noEmit` | 0 errores, exit 0 | 0 errores, exit 0 | sin cambios |
| `npm run lint` | 0 errores, 1 warning, exit 0 | 0 errores, 1 warning, exit 0 | sin cambios |
| `next build` | verde, 19 rutas, exit 0 | verde, 19 rutas, exit 0 | sin cambios |

**Nada se movió**, como correspondía a un cambio que solo toca archivos `.md`. **No hay
regresión que reportar.** El único matiz es el que ya está en §3: el warning está en la línea
808 y no en la 269 que decía la documentación — pero eso no es un movimiento de este trabajo,
es la documentación que estaba desactualizada, y quedó corregida en los tres lugares.
