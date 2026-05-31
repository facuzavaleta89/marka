# VISUAL-PLAN.md — Repaso visual de Marka

> Plan de elevación de diseño: de "funciona" a "premium editorial".
> No es un changelog de features — es un mapa de ruta visual. Todo lo propuesto respeta
> estrictamente `DESIGN.md` (paleta, Noto Serif + DM Sans, espaciado base-4, componentes).
> **Este documento no contiene código de componentes. Es el plan que ejecutaremos por lotes.**

---

## Paso 1 — Investigación de referencias

Analicé cómo resuelven el diseño los portales inmobiliarios mejor diseñados del mundo
y las apps de mapas premium. Resumen de los patrones concretos que vale la pena **adaptar**
a la identidad editorial de Marka (no copiar):

### Idealista (España)
- **Pin de precio como protagonista absoluto.** El pin no es un marcador genérico: es una
  cápsula con el precio en negrita, esquinas suaves, sombra sutil. Marka ya hace esto — la
  oportunidad está en el *refinamiento* (tipografía real DM Sans en el pin, no font-stack
  del sistema; estados hover/activo más marcados).
- **Estado "visitado".** Los pines de propiedades ya vistas cambian de color (gris). Da
  sensación de progreso y control. Adoptable con `localStorage` (ya usamos favoritos así).
- **Cluster con forma de gota/burbuja, no círculo plano.** Jerarquía por tamaño + número.
- **Panel lateral de resultados sincronizado con el mapa**: hover en card → resalta el pin.
  Marka hoy no tiene lista desktop sincronizada (es solo mapa). Oportunidad media.

### Sotheby's International Realty
- **La fotografía es el producto.** Tratamiento editorial: imágenes a sangre, ratios
  consistentes (3:2 / 4:3), cero bordes redondeados agresivos en las fotos grandes, overlays
  de gradiente sutil de abajo hacia arriba para apoyar texto encima.
- **Tipografía serif en displays, sans en operativa** — exactamente la tesis de Marka
  (Noto Serif + DM Sans). Sotheby's usa serif para precios y títulos; respira muchísimo.
- **Paleta neutra cálida + un solo acento.** Validación directa de la decisión de Marka
  (paper + terracota).
- **Microtipografía:** uso de `letter-spacing` amplio en labels en mayúsculas, líneas
  divisorias finísimas, números tabulares para precios.

### Immowelt (Alemania)
- **Limpieza editorial y espacio negativo.** Menos densidad, más aire. Cada card tiene
  padding generoso. Las divisiones son por espacio, no por cajas.
- **Jerarquía vertical clara dentro de la card:** tipo·operación (kicker) → título → precio
  → ubicación → métricas. Marka ya sigue este orden en el modal; falta llevarlo a una
  PropertyCard real (hoy inexistente).

### Zillow (USA) / apps de mapas premium
- **Transición mapa → detalle sin recargar.** El detalle es un panel que se desliza,
  el mapa nunca desaparece. Marka ya lo hace (drawer derecho). Bien.
- **Tiles de mapa con estilo propio, NO el OSM crudo gris.** Zillow, Airbnb, Idealista
  usan tiles personalizados de baja saturación que hacen "respirar" los pines de color.
  **Este es el hallazgo más importante de toda la investigación** (ver Lote 1).
- **Skeleton loaders** en vez de spinners o texto "Cargando...". Sensación de velocidad.
- **Hover magnético en cards** (elevación sutil de 2-4px + sombra), 200ms ease-out.

### Qué separa "premium" de "genérico" — síntesis
| Genérico ("AI app" / demo) | Premium (editorial) |
|---|---|
| Tiles OSM grises de fábrica | Tiles de baja saturación, tonal, alineados a la paleta |
| Spinners / "Cargando..." en texto | Skeletons que imitan el layout final |
| Fotos con bordes redondeados parejos y chicas | Fotos a sangre, ratio consistente, protagonistas |
| Sombra dura uniforme en todo | Bordes finos + sombra solo en lo que flota |
| Tipografía de un solo peso/fuente | Contraste serif display vs sans operativa |
| Acento repartido en muchos colores | Un acento (terracota), usado con avaricia |
| Estados vacíos con texto plano | Estados vacíos con ilustración/ícono + acción |
| Transiciones ausentes o de 0ms | Microinteracciones de 120–220ms, intencionales |

**Fuentes consultadas:**
- [Sotheby's International Realty — map view](https://www.sothebysrealty.com/eng/sales/int/map-view)
- [Idealista — Spain Sotheby's listings](https://www.idealista.com/en/pro/spain-sothebys-international-realty-mad/venta-viviendas/)
- [Felix & Friends — Sotheby's brand/UX case study](https://felixandfriends.com/portfolio/sothebys-international-realty)
- [Webflow — 15 microinteraction examples](https://webflow.com/blog/microinteractions)
- [Bricx Labs — micro animation examples 2025](https://bricxlabs.com/blogs/micro-interactions-2025-examples)
- [Justinmind — web micro-interactions 2025](https://www.justinmind.com/web-design/micro-interactions)

---

## Paso 2 — Auditoría de componentes actuales

Recorrí todos los componentes visuales contra `DESIGN.md`. Para cada uno: qué cumple,
qué se desvía/quedó genérico, y la oportunidad premium.

> **Convención de severidad:** 🔴 alto (define la percepción / primero que ve el usuario) ·
> 🟡 medio · 🟢 bajo (pulido fino).

---

### 2.1 Mapa base — `MapView.tsx` 🔴
**Cumple:** CSR con `ssr:false`, debounce de bounds correcto, clustering activo, estructura sólida.

**Se desvía / genérico:**
- **Usa los tiles crudos de OpenStreetMap** (`{s}.tile.openstreetmap.org`). Son grises-azulados,
  saturados, con POIs y etiquetas que compiten con los pines. Es *la* señal #1 de "mapa de
  demo de Leaflet". Rompe el principio de DESIGN "el mapa es protagonista" y la "calidez contenida":
  el fondo es frío, no evoca papel.
- `NEXT_PUBLIC_MAPTILER_KEY` ya está previsto en CLAUDE.md pero no se usa.
- `zoomControl` por defecto de Leaflet (botones `+/-` con estilo de fábrica, esquina sup-izq)
  choca con la estética editorial.

**Oportunidad premium:** tiles tonales de baja saturación alineados a `paper`/`stone`
(MapTiler estilo custom, o CARTO Positron/“Voyager” atenuado). Controles de zoom rediseñados
o reubicados. Atmósfera cálida que haga que los pines terracota "salten".

---

### 2.2 Pin de propiedad — `PropertyMarker.tsx` 🔴
**Cumple:** estructura exacta de DESIGN (precio visible, estados normal/hover/activo, badge ★
para destacadas, `rounded-lg`, sombra). Colores correctos.

**Se desvía / genérico:**
- **`font-family` del pin es el font-stack del sistema** (`-apple-system…`), no **DM Sans**.
  DESIGN exige DM Sans 12px Medium. En pantalla se nota: el pin "habla otro idioma" que el resto.
- Sombra `0 2px 6px rgba(0,0,0,0.14)` es un poco dura/plana; DESIGN pide `shadow-md` con
  carácter más suave.
- El triángulo/punta inferior que muestra el mock de DESIGN (`▼`) no existe — los pines son
  cápsulas flotantes sin ancla visual al punto exacto. Es defendible, pero la punta ayuda a la
  precisión percibida.
- Hover hace `.replace()` de string sobre el HTML para cambiar el borde: frágil y sin transición real.

**Oportunidad premium:** inyectar DM Sans en el `DivIcon` (cargar la variable de fuente),
añadir punta inferior sutil, estado "visitado" (gris), microtransición de escala al seleccionar,
números tabulares.

---

### 2.3 Clusters — `ClusterLayer.tsx` 🟡
**Cumple:** colores `graphite`/`paper`, tamaños 40/52/64 exactos según DESIGN, círculo, peso 600.

**Se desvía / genérico:**
- Misma deuda de fuente: font-stack del sistema en vez de DM Sans.
- Círculo plano de un solo tono. Idealista/Zillow le dan un halo/anillo o un degradé sutil que
  comunica "muchos" sin gritar.
- Sin animación de aparición al hacer zoom (DESIGN acepta "Leaflet default" pero podemos pulir).

**Oportunidad premium:** anillo exterior translúcido (`stone`/`terracota` al 15%), DM Sans real,
micro-bounce al formar/disolver cluster.

---

### 2.4 PropertyModal — `PropertyModal.tsx` 🔴
**Cumple:** drawer derecho desktop / bottom sheet mobile, swipe-to-close, flujo WhatsApp
(input aparece al click → "Enviar mensaje"), registro de lead antes de abrir WA, jerarquía
tipo·operación → título → precio → ubicación → métricas → descripción → amenities. Botón WA
en verde. Muy alineado a DESIGN sección 5.

**Se desvía / genérico:**
- **`bg-white` puro** en el drawer (DESIGN: el fondo general nunca es blanco puro; usar `paper`).
  El modal es la superficie de conversión: el blanco frío rompe la calidez.
- **Carrusel:** flechas `bg-black/50` redondas genéricas, dots simples. Falta tratamiento
  editorial de la foto (gradiente inferior para legibilidad, ratio fijo, transición entre fotos).
  Hoy el cambio de foto es un corte seco (sin fade/slide).
- **Estados de carga:** "Cargando..." en texto plano dentro del drawer. Debería ser skeleton.
- Botones flotantes sobre la foto (cerrar/favorito) son círculos `bg-black/50` — funcionales pero
  sin la finura del resto.
- El precio (terracota, Noto Serif 3xl) está perfecto — es el ancla. Mantener.
- Amenities como chips `bg-mist`: OK, pero podrían llevar íconos `lucide` 16px (DESIGN sección 9
  los menciona en `graphite`).

**Oportunidad premium:** fondo `paper`, foto a sangre con gradiente sutil + crossfade entre
imágenes, skeleton de carga, chips de amenity con ícono, dot indicators más finos, sombra `shadow-lg`.

---

### 2.5 FilterPanel — `FilterPanel.tsx` 🟡
**Cumple:** secciones con divisor `stone`, títulos DM Sans 11px uppercase `tracking-wider`,
toggles terracota/mist, chips de tipo con borde, bottom sheet en mobile, contador de filtros activos.
Muy fiel a DESIGN sección 6.

**Se desvía / genérico:**
- **Checkboxes nativos** (`<input type="checkbox" className="accent-terracota">`) en Amenities y
  Destacadas. Rompe consistencia: el resto del form usa el `Checkbox` de shadcn estilizado.
  El check nativo se ve "de sistema operativo".
- **Botones "Aplicar precio"/"Aplicar superficie"** son fricción visual y de UX: dos botones
  grises extra dentro del panel. Premium = aplicar on-blur o con debounce, sin botón.
- Rango de precio con dos inputs sueltos: un `Slider` (ya existe `ui/slider.tsx`, sin usar) sería
  más premium y alineado a Idealista.
- Inputs `bg-white` (correcto por DESIGN para formularios) pero el panel entero podría respirar más
  (space-8 entre secciones en vez de space-6 en desktop).

**Oportunidad premium:** reemplazar checkboxes nativos por shadcn, eliminar botones "Aplicar"
(commit on-blur), evaluar slider de precio, más aire vertical.

---

### 2.6 CityPicker — `CityPicker.tsx` 🟡
**Cumple:** trigger con nombre + `chevron-down` que rota, dropdown con búsqueda si >8 ciudades,
ítem activo en `terracota-subtle`/`terracota` con check. Fiel a DESIGN sección 11.

**Se desvía / genérico:**
- **Falta el label "Cerca tuyo"** para la ciudad detectada por geolocalización (DESIGN lo pide
  explícitamente, DM Sans 11px graphite, primera de la lista).
- Sin orden alfabético garantizado.
- El dropdown aparece sin transición (corte seco). DESIGN admite microinteracción de 120ms.
- Posición centrada (`left-1/2 -translate-x-1/2`) puede desbordar en mobile.

**Oportunidad premium:** label "Cerca tuyo", orden alfabético, fade/scale del dropdown,
ícono `MapPin` sutil junto a la ciudad activa.

---

### 2.7 PropertyCard — **NO EXISTE** 🔴
**Estado:** la vista de lista mobile es un placeholder ("Lista de propiedades próximamente",
`page.tsx:93-101`). DESIGN sección 6 especifica la PropertyCard al detalle (imagen 180px, kicker,
título Noto Serif 17px, precio 20px, ubicación, métricas, badge destacada, hover `shadow-sm`).

**Impacto:** en mobile el mapa es secundario y la lista es el punto de entrada (DESIGN sección 4,
"cards-first"). Hoy **mobile no tiene experiencia de navegación real.** Es el hueco funcional-visual
más grande del proyecto público.

**Oportunidad premium:** construir la PropertyCard editorial y la lista mobile scrolleable.
Reutilizable también en una futura vista de resultados desktop sincronizada con el mapa.

---

### 2.8 PropertyForm — `PropertyForm.tsx` 🟡
**Cumple:** secciones con divisor, `Field`/`FieldRow` consistentes, inputs shadcn con override de
foco terracota, toggle de moneda, checkboxes shadcn (bien acá), validación de pin obligatorio,
ImageUploader integrado. Sólido.

**Se desvía / genérico:**
- Es un **formulario largo de una sola columna** sin navegación ni sentido de progreso. Para 7
  secciones, los formularios premium (Sotheby's back-office, Airbnb host) usan o bien stepper, o
  bien una columna sticky de navegación de secciones, o agrupación en cards.
- El override `FIELD` con `border-b-stone` sugiere que originalmente se buscó estilo "línea" pero
  quedó mezclado con borde completo — inconsistencia menor.
- Submit único al final, sin resumen ni sticky bar. En forms largos, una barra de acción sticky
  ("Publicar") es más premium y evita scroll.

**Oportunidad premium:** barra de acción sticky inferior, secciones como cards sobre fondo `mist`
(coherente con el dashboard), feedback de sección completada.

---

### 2.9 LocationPicker — `LocationPicker.tsx` 🟡
**Cumple:** instructivo permanente (DESIGN lo exige), pin SVG terracota con ancla en la punta,
coords solo-lectura con `tabular-nums`, borde de error, altura 280px. Muy fiel a DESIGN sección 11.

**Se desvía / genérico:**
- **Tiles OSM crudos** otra vez (mismo problema que el mapa principal, en chico).
- El pin no tiene sombra (`shadow-md` que pide DESIGN) ni feedback de "agarre" al arrastrar.
- Sin botón "centrar en la ciudad" / reset.

**Oportunidad premium:** mismos tiles tonales del mapa principal, sombra en el pin, micro-feedback
al soltar (pulse), heredar la mejora del Lote 1 automáticamente.

---

### 2.10 ImageUploader — `ImageUploader.tsx` 🟢
**Cumple:** dropzone con dashed border, hover terracota, grilla 3 col, badge "Portada", reordenar
por drag, contador, estados de límite/error. Funcional y prolijo.

**Se desvía / genérico:**
- Dropzone es correcto pero algo plano; el ícono `Upload` 20px en `graphite` podría tener más
  presencia (estado vacío más editorial).
- Sin barra de progreso por archivo (solo "Subiendo..." global).
- El handle de drag no es evidente (todo el thumbnail es `cursor-grab`, pero falta affordance visual).

**Oportunidad premium:** indicador de progreso por imagen, ícono de "arrastrar" sutil en hover del
thumbnail, animación de reordenamiento.

---

### 2.11 Dashboard — Sidebar `Sidebar.tsx` 🟢
**Cumple:** fondo `black`, ítems `stone`, activo con borde izq 3px `terracota` + `paper` + bg sutil,
hamburguesa mobile, PlanBadge integrado, encabezado con agencia + nombre. Exactamente DESIGN sección 7.

**Se desvía / genérico:**
- No hay **logo/marca** arriba, solo el nombre del agente. DESIGN menciona "Logo y nombre del agente
  en la parte superior".
- Sin avatar del agente en el encabezado (existe `avatar_url`, no se muestra acá).
- Transición de activo correcta; podría añadirse un sutil indicador de hover de fondo.

**Oportunidad premium:** logo Marka arriba, avatar del agente, refinamiento de hover.

---

### 2.12 Dashboard — StatsCard `StatsCard.tsx` 🟡
**Cumple:** número Noto Serif 4xl bold, label DM Sans, ícono `stone` arriba-derecha, borde `stone`,
`rounded-lg`. Fiel a DESIGN sección 7.

**Se desvía / genérico:**
- **Es la card de stats más estándar posible.** Cuatro cajas iguales con un número. Funciona, pero
  no comunica nada más allá del dato (sin tendencia, sin contexto, sin micro-visualización).
- El ícono arriba-derecha en `stone` casi no se ve (bajo contraste intencional, pero queda anémico).
- Número sin `tabular-nums`.

**Oportunidad premium:** mini-tendencia (sparkline o delta vs período anterior), `tabular-nums`,
quizá un acento terracota en la métrica más relevante (disponibles del plan), animación de conteo
al montar (count-up) — sutil, no decorativa.

---

### 2.13 Dashboard — PropertiesTable `PropertiesTable.tsx` 🟢
**Cumple:** tabla desktop + cards mobile, thumbnails, StatusBadge con colores por estado, menú de
acciones (shadcn dropdown), AlertDialog de borrado, banner de error, hover de fila `bg-mist/40`,
estado vacío con CTA. Muy completo y fiel.

**Se desvía / genérico:**
- StatusBadge usa colores de DESIGN pero el `active` en `terracota-subtle/terracota` compite
  visualmente con CTAs; DESIGN reserva un badge de estado distinto (revisar coherencia con sección 6).
- Header de tabla correcto; podría llevar acción de ordenamiento.
- Thumbnails `w-12 h-12` (48px) algo chicos para evaluar la foto.

**Oportunidad premium:** thumbnails un poco mayores con ratio fijo, hover que muestre preview,
ordenamiento por columna, skeleton de tabla.

---

### 2.14 Dashboard — PlanBadge `PlanBadge.tsx` 🟢
**Cumple:** Free en `mist`/`graphite` con contador `used/limit`, Pro en `terracota`/`paper`,
DM Sans 11px uppercase. Exactamente DESIGN sección 12.

**Se desvía / genérico:** prácticamente nada. Quizá una micro-barra de uso integrada en el badge
free (3/5 con un fill sutil) lo haría más informativo. 🟢

---

### 2.15 SubscriptionContent `SubscriptionContent.tsx` 🟡
**Cumple:** dos cards lado a lado, card actual con borde terracota + badge "Plan actual", Pro con
"Recomendado ★", features con `check` `success`, barra de uso, modal "Próximamente". Fiel a DESIGN
sección 12.

**Se desvía / genérico:**
- El **modal "Próximamente"** es un overlay casero (`fixed inset-0 bg-black/50`) en vez del `Dialog`
  de shadcn ya disponible. Inconsistencia de patrón y de animación.
- Precio "Consultanos"/"Gratis" en Noto Serif está bien; falta jerarquía de "lo que ganás" al pasar
  a Pro (las cards son casi simétricas, no "venden" el upgrade).
- La card Pro no destaca lo suficiente sobre la Free (DESIGN sugiere que Pro sea el foco).

**Oportunidad premium:** usar `Dialog` de shadcn, dar más peso visual a la card Pro (fondo sutil,
escala), destacar el diferencial.

---

### 2.16 Login / Register `login/page.tsx`, `register/page.tsx` 🔴
**Cumple:** fondo `paper`, card `bg-white` con borde `stone`, título Marka en Noto Serif, inputs
shadcn, errores en `error`, CTA terracota, link a la otra ruta. Limpio.

**Se desvía / genérico:**
- **Es la pantalla más "genérica/AI app" de todo el proyecto:** una card centrada sobre fondo
  plano. Es la primera impresión del agente (cliente que paga) y no comunica nada de la marca ni
  del producto. Cero personalidad editorial.
- Sin imagen, sin claim, sin contexto del producto. Compará con el login de Sotheby's/Airbnb host:
  split-screen con fotografía a sangre + claim serif a un lado, form al otro.
- "Marka" como texto plano — no hay identidad de marca (logo).

**Oportunidad premium:** layout split-screen (fotografía editorial de propiedad/ciudad + claim en
Noto Serif a la izquierda, formulario a la derecha), o al menos un panel lateral con identidad.
Esta es la transformación de mayor relación impacto/esfuerzo del área privada.

---

### 2.17 Header público + estados globales `(public)/page.tsx` 🟡
**Cumple:** header 56px (`h-14`), logo texto + CityPicker + "Ingresar", FilterPanel 320px (`w-80`),
FABs mobile (Filtros / Ver mapa-lista) con safe-area. Estructura fiel a DESIGN sección 4.

**Se desvía / genérico:**
- **Estados de carga y vacío en texto plano** ("Cargando...", "Lista de propiedades próximamente").
  Skeletons elevarían la percepción de velocidad y terminación.
- **"Marka" como texto** en el header — falta logo/identidad (recurrente en todo el proyecto).
- El FAB de filtros (`bg-graphite`) y el de mapa/lista (`bg-terracota`) coexisten abajo; coherente,
  pero el de filtros gris compite poco. Revisar jerarquía.
- Loading del MapView es un `bg-mist animate-pulse` plano — aceptable, mejorable con skeleton de pines.

**Oportunidad premium:** logo real, skeletons, pulido de FABs.

---

### 2.18 Identidad de marca — **transversal / NO EXISTE** 🔴
No hay logo, no hay favicon propio más allá del default, no hay markers SVG personalizados en
`public/markers/` (referenciados en CLAUDE.md). "Marka" aparece como texto Noto Serif en 4 lugares
distintos sin tratamiento. Una marca premium necesita una firma visual mínima y consistente.

**Oportunidad premium:** wordmark/monograma simple (Noto Serif + detalle terracota), favicon,
íconos PWA (DESIGN sección 13), markers SVG. Es el pegamento que hace que todo "se sienta del mismo producto".

---

## Paso 3 — Plan de ejecución priorizado (por lotes)

Ordenado por impacto visual. Cada lote es ejecutable de forma independiente.

---

### 🔴 LOTE 1 — Mapa base + pines (la cara del producto)
> **El cambio de mayor impacto del proyecto.** El mapa es el 100% del viewport público.
> Pasar de tiles OSM grises a un mapa tonal editorial transforma la percepción al instante.

| Cambio | Tokens / referencia DESIGN | Severidad |
|---|---|---|
| Reemplazar tiles OSM por tiles de baja saturación alineados a la paleta (MapTiler estilo custom warm/tonal con `NEXT_PUBLIC_MAPTILER_KEY`, o CARTO Voyager/Positron atenuado como fallback gratis) | Filosofía "el mapa es protagonista" + "calidez contenida"; fondo evoca `paper`/`stone` | 🔴 |
| Inyectar **DM Sans** en el HTML del pin y del cluster (cargar la variable de fuente en el `DivIcon`) | DESIGN 5: pin DM Sans 12px Medium; cluster DM Sans 13px SemiBold | 🔴 |
| Añadir punta inferior sutil al pin (ancla al punto exacto) + `tabular-nums` en el precio | DESIGN 5 (mock con `▼`) | 🟡 |
| Estado "visitado" del pin (gris `stone`) vía `localStorage` | Adaptado de Idealista; coherente con `useFavorites` | 🟡 |
| Microtransición de escala al seleccionar pin; hover con transición real (no `.replace()` de string) | DESIGN 8: hover 120ms ease-out | 🟡 |
| Cluster con anillo translúcido exterior (`stone`/`terracota` 15%) | DESIGN 5 ClusterLayer | 🟢 |
| Rediseñar/reubicar el control de zoom de Leaflet (estilo `paper`/`stone`, sin look de fábrica) | DESIGN 6 botones | 🟢 |

**Assets nuevos:** cuenta/estilo de MapTiler (o config de CARTO). Opcional: clave en `.env.local`.

---

### 🔴 LOTE 2 — PropertyModal (la superficie de conversión)
> Donde el visitante decide contactar. Cada detalle cuenta para la confianza.

| Cambio | Tokens / referencia DESIGN | Severidad |
|---|---|---|
| Fondo del drawer/sheet de `bg-white` → **`paper`** | DESIGN 2: nunca blanco puro | 🔴 |
| Foto a sangre con ratio consistente + gradiente inferior sutil para legibilidad | Patrón Sotheby's; DESIGN 5 carrusel 260/220px | 🔴 |
| Crossfade/slide entre fotos del carrusel (hoy corte seco) | DESIGN 8: 180–220ms ease | 🟡 |
| Skeleton de carga en vez de "Cargando..." | DESIGN 10 voz + patrón premium | 🟡 |
| Chips de amenity con ícono `lucide` 16px `graphite` | DESIGN 9 iconografía | 🟡 |
| Dot indicators y botones flotantes (cerrar/favorito) más finos, coherentes con la paleta | DESIGN 5 | 🟢 |
| Mantener intacto: precio terracota Noto Serif, flujo WhatsApp, registro de lead | DESIGN 5 (ya correcto) | — |

**Assets nuevos:** ninguno (íconos ya en `lucide-react`).

---

### 🔴 LOTE 3 — PropertyCard + lista mobile (el hueco funcional-visual)
> Mobile es "cards-first" (DESIGN 4) y hoy es un placeholder. Construir la experiencia que falta.

| Cambio | Tokens / referencia DESIGN | Severidad |
|---|---|---|
| Crear `PropertyCard` editorial: imagen 180px, kicker tipo·operación, título Noto Serif 17px, precio 20px bold, ubicación, métricas, badge destacada, hover `shadow-sm` + border `graphite` | DESIGN 6 (spec completa) | 🔴 |
| Reemplazar el placeholder "Lista de propiedades próximamente" por lista scrolleable de cards | DESIGN 4 layout mobile | 🔴 |
| Hover magnético sutil (elevación 2–4px) en desktop | Patrón premium; DESIGN 8 120ms | 🟡 |
| Reutilizar la card a futuro en panel de resultados desktop sincronizado con el mapa | Idealista (futuro) | 🟢 |

**Assets nuevos:** ninguno.

---

### 🟡 LOTE 4 — Login / Register + identidad de marca
> Primera impresión del cliente que paga. Hoy es lo más genérico del proyecto.

| Cambio | Tokens / referencia DESIGN | Severidad |
|---|---|---|
| Layout split-screen: fotografía editorial + claim Noto Serif a un lado, formulario al otro | Patrón Sotheby's/Airbnb host; DESIGN 1 editorial | 🔴 |
| Crear wordmark/monograma Marka (Noto Serif + detalle terracota) y usarlo consistente | DESIGN 2/3; identidad transversal | 🔴 |
| Favicon + íconos PWA 192/512 sobre `paper`, theme color `paper` | DESIGN 13 | 🟡 |
| Markers SVG en `public/markers/` | CLAUDE.md estructura | 🟢 |

**Assets nuevos:** 1 fotografía editorial (ciudad/propiedad AR), wordmark SVG, favicon, íconos PWA.

---

### 🟡 LOTE 5 — FilterPanel + CityPicker (operativa del visitante)

| Cambio | Tokens / referencia DESIGN | Severidad |
|---|---|---|
| Reemplazar checkboxes nativos por `Checkbox` de shadcn (Amenities, Destacadas) | DESIGN 6 consistencia | 🟡 |
| Eliminar botones "Aplicar precio/superficie": commit on-blur o debounce | UX premium, menos fricción | 🟡 |
| Evaluar `Slider` de precio (ya existe `ui/slider.tsx` sin usar) | Patrón Idealista | 🟢 |
| CityPicker: label "Cerca tuyo" en ciudad geolocalizada, orden alfabético, fade/scale del dropdown | DESIGN 11 (explícito) | 🟡 |
| Más aire vertical entre secciones del panel (space-8) | DESIGN 4 espaciado | 🟢 |

**Assets nuevos:** ninguno.

---

### 🟡 LOTE 6 — Dashboard (área del agente)

| Cambio | Tokens / referencia DESIGN | Severidad |
|---|---|---|
| StatsCard: `tabular-nums`, delta/mini-tendencia, acento terracota en la métrica clave, count-up sutil al montar | DESIGN 7 stats | 🟡 |
| Sidebar: logo Marka arriba + avatar del agente | DESIGN 7 | 🟡 |
| SubscriptionContent: usar `Dialog` de shadcn para "Próximamente"; dar más peso visual a la card Pro | DESIGN 12 consistencia | 🟡 |
| PropertiesTable: thumbnails con ratio fijo algo mayores, skeleton de tabla, ordenamiento | DESIGN 6/7 | 🟢 |
| PlanBadge: micro-barra de uso integrada (free) | DESIGN 12 | 🟢 |

**Assets nuevos:** ninguno (logo/avatar vienen del Lote 4).

---

### 🟢 LOTE 7 — Formularios largos + pulido fino

| Cambio | Tokens / referencia DESIGN | Severidad |
|---|---|---|
| PropertyForm: barra de acción sticky ("Publicar"), secciones como cards sobre `mist`, feedback de sección completada | DESIGN 7 patrón dashboard | 🟢 |
| LocationPicker: heredar tiles del Lote 1, sombra `shadow-md` en el pin, micro-feedback al soltar, botón reset | DESIGN 11/5 | 🟢 |
| ImageUploader: progreso por imagen, affordance de drag, animación de reorden | DESIGN 8 | 🟢 |
| Skeletons globales (mapa, modal, tabla, dashboard) reemplazando todos los "Cargando..." | DESIGN 10 voz | 🟢 |
| Auditoría final de voz del UI (DESIGN 10): sin exclamaciones, mensajes específicos | DESIGN 10 | 🟢 |

**Assets nuevos:** ninguno.

---

## Resumen de impacto

| Lote | Foco | Severidad | Esfuerzo rel. | Assets |
|---|---|---|---|---|
| 1 | Mapa + pines | 🔴 Alto | Medio | MapTiler key (opc.) |
| 2 | PropertyModal | 🔴 Alto | Medio | — |
| 3 | PropertyCard + lista mobile | 🔴 Alto | Medio-alto | — |
| 4 | Login/Register + marca | 🟡/🔴 | Medio | Foto, wordmark, favicon |
| 5 | FilterPanel + CityPicker | 🟡 Medio | Bajo-medio | — |
| 6 | Dashboard | 🟡 Medio | Medio | — |
| 7 | Forms largos + pulido | 🟢 Bajo | Variable | — |

**Orden recomendado de ejecución:** 1 → 2 → 3 → 4 → 5 → 6 → 7.
Los lotes 1–3 son lo que un usuario ve y recuerda; mueven la aguja de "funciona" a "premium".
4–7 consolidan coherencia y pulido.
