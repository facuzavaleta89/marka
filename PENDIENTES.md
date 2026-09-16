# PENDIENTES — App Mapa Inmobiliario (Marka)

> Lista viva de pendientes, deuda técnica y decisiones de producto abiertas.
> Se actualiza a medida que se cierran piezas o aparecen cosas nuevas.
> Última actualización: 15 sep 2026 (**GRUPO DE PULIDO VISUAL CERRADO**, seis tandas: dos relevamientos y cuatro de implementación — las hojas que suben desde abajo, los campos de formulario y el teléfono con prefijo, cuatro defectos de forma que rompían algo, y la unificación de formas. **Y la tanda de documentación que volcó las inconsistencias acumuladas**: de las 58 que seguían anotadas, **42 quedan abiertas** y encabezadas por una de **seguridad** — ver la sección nueva arriba de todo. Baseline re-medido: el warning de lint está en `PropertyForm.tsx:814`, no en `:808`). Antes: 14 sep 2026 (**CONTADOR DE VISITAS CERRADO**, tres tandas: visitas y consultas por propiedad en el listado del panel, el conteo desde tres lugares con deduplicación por visitante y disparo por interacción en la ficha pública, y la guarda de la base que impide que una visita mueva la fecha que el mapa del sitio informa a los buscadores. **Seis ítems nuevos abiertos**, los seis verificados (los cuatro que salieron del cierre más las dos tarjetas de `/dashboard` con ventanas distintas y los dos documentos que quedaron desfasados). **Cifras re-medidas**: 14 consultas, 17 visitas en 8 propiedades). Antes: 13 sep 2026 (**GRUPO DEL SITIO DE MARCA CERRADO**, cuatro tandas: direcciones reservadas + dirección editable, el sitio apagado le habla a su dueño, el cambio de nombre completo con dos formas de rechazo, y **el campo que faltaba** — las tres primeras tandas se habían construido sin punta en la interfaz, de donde salió la regla de método de recorrer de punta a punta. Cerró además las dos sub-piezas de white-label que llevaban meses en pausa. **Cifras re-medidas**: la base pasó de 4 agencias a 3). Antes: 12 sep 2026 (**GRUPO DE COHERENCIA DEL PANEL CERRADO**, cinco tandas: era chico —un cartel, un banner y una ruta— y **destapó el bug más caro medido hasta ahora**, que pedir un plan mayor sacaba a la agencia del mapa. Cuatro ítems nuevos abiertos, los cuatro aparecidos midiendo, y **todas las cifras de datos de prueba re-medidas**: la base se limpió y pasó de 10 agencias a 4). Y antes: grupo de captación y difusión cerrado el 10 sep; C2 y D2 el 8 sep; BLOQUE B entero el 3 sep; A1 y A2 hechas → el BLOQUE A está completo.

---

## 📅 Calendario de lanzamiento (contexto de prioridades)

No es una lista de tareas: es el marco que decide el orden de todo lo de abajo.

- **Hoy:** la app está deployada pero **sin datos reales** (todo lo cargado es de prueba: **3 agencias, 18 propiedades (17 activas), 3 agentes, 14 consultas, 7 imágenes, 1 ciudad activa, 17 visitas repartidas en 8 propiedades** — re-medido el 14 sep 2026. ⚠ **LA BASE SE LIMPIÓ Y LAS CIFRAS VIEJAS DE ESTE ARCHIVO QUEDARON TODAS DESACTUALIZADAS**: venía de **10** agencias / 18 propiedades / 10 agentes / 10 consultas el 8 sep, pasó por 2 y por 3 en los diagnósticos del 10 y el 11, llegó a 4 el 12, y hoy son **3**. Cualquier número de agencias que se lea acá sin fecha hay que volver a medirlo. ⚠ **1 de las 3 agencias tiene logo cargado**, dato que gobierna el diseño del bloque "quién publica". **1 de las 14 consultas está DESVINCULADA** (`agent_id NULL`): es la prueba real del borrado de agentes del 7 sep. De las propiedades, **3 están en venta y alquiler a la vez** y **7 tienen alguna operación sin precio** ("a convenir"): son las de prueba del BLOQUE B. ⚠ Y un cambio de composición que importa: **ninguna agencia está en `free`** —los planes presentes son `inicial` y `profesional` (ya no hay ninguna en `premium`), las tres `active` y aprobadas—, así que **hoy no hay ningún caso real del estado de aterrizaje ni de suscripción apagada con el que probar los carteles nuevos**; hay que fabricarlos).
- **Septiembre:** terminar de afinar la app **mientras 2-3 inmobiliarias "fundadoras" cargan su cartera**. Las da de alta el dueño a mano; nadie se auto-registra todavía. ⚠ Es el mes en que la **fricción de carga** cuesta plata: si cargar 30 propiedades es tedioso, cargan 6 y abandonan.
- **Octubre:** lanzamiento con algo de publicidad. A partir de acá **sí** entra gente a registrarse sola → el alta manual (A2) tiene que estar lista antes.
- **Oct/nov/dic:** las fundadoras usan gratis (encuadre: "inmobiliaria fundadora", no "descuento").
- **1 de enero:** empieza el cobro real.

> ### ⚠ LIMPIEZA DE DATOS ANTES DEL LANZAMIENTO — nuevo desde el 8 sep 2026
>
> **No es deuda técnica: no hay nada roto.** Es que **los datos de prueba dejaron de ser privados**. Desde que existe el mapa del sitio (C2), la base **le ofrece activamente a los buscadores** todas las propiedades activas de agencias al día — y esas propiedades hoy son inventadas.
>
> **Re-medido el 14 sep 2026** (venía de 17/16/16 el 12 sep): de las **18** propiedades, **17** están activas y **las 17 se ofrecen hoy en `/sitemap.xml`** — ninguna queda excluida por la regla de cobro, porque ninguna agencia está en `free`. Entre ellas siguen habiendo **títulos que son texto de relleno sin ninguna ambigüedad**:
>
> | Título | Slug (la dirección pública que se indexaría) |
> |---|---|
> | `fsdfsdfsdf` | `/propiedades/fsdfsdfsdf-abgpi4` |
> | `nueva propiedad 1` | `/propiedades/nueva-propiedad-1-m4qfc9` |
> | `nueva propiedad 2` | `/propiedades/nueva-propiedad-2-8ksdji` |
> | `nueva propiedad 3` | `/propiedades/nueva-propiedad-3-rguw79` |
>
> (La quinta fila que figuraba acá, `casa prueba22` → `casa-prueba2-taf8a3`, **ya no existe en la base**: medido el 14 sep 2026.)
>
> El resto son plausibles pero igual de fabricadas (`Casa demo`, `Campo`, `casa lugones`, `Casa Largo`…). Y **solo 7 propiedades tienen alguna foto**, así que la mayoría de las fichas se indexarían sin imagen.
>
> ⚠ **Y desde el 14 sep 2026 hay un motivo más para limpiar: 7 propiedades tienen un `updated_at` que no corresponde a ninguna edición**, movido por visitas contadas antes de que existiera la guarda de la base (ver el ítem abierto en "Deuda técnica"). El mapa del sitio lo informa como su última modificación. Borrar o recargar los datos de prueba lo resuelve solo.
>
> **Qué hacer, y cuándo:** borrar o pausar los datos de prueba **antes de que el sitio se dé de alta en Google Search Console**, no después. Una vez indexado, sacar una página del índice es lento y deja el rastro. **El momento natural es septiembre**, cuando las fundadoras empiecen a cargar su cartera: conviene que la base quede solo con lo real antes de que entre el primer robot.
>
> ⚠ **Y el orden importa:** mientras la variable `NEXT_PUBLIC_SITE_URL` apunte a `localhost`, el mapa del sitio publica direcciones de localhost y nada se indexa. El riesgo empieza **el día que esa variable apunte al dominio real**.


Consecuencias directas sobre el orden: la **autosugerencia de ubicación** subía (sirve antes de que carguen, no después) y **ya está hecha** (D1, 31 ago 2026); **C2** sube (hace que la publicidad de octubre se acumule en lugar de evaporarse); el **panel admin de ida y vuelta** tenía que existir antes de octubre y **ya está** (1 sep 2026: cancelar solicitud, vencimiento, baja/reactivación, eliminación y cambio de plan).

---

## ⚠ INCONSISTENCIAS ACUMULADAS — 47 abiertas (volcadas el 15 sep 2026; la P0 se resolvió y se sumaron 6 de seguridad el 16 sep 2026)

> **De dónde salen.** A lo largo de las seis tandas del grupo de pulido se fueron anotando sin arreglar,
> en informes que se sobrescriben. **Acá quedan por escrito por primera vez.** Al relevamiento de formas
> seguían abiertas **46**; las dos últimas tandas sumaron **12**, o sea **58**. Hoy quedan **42**:
>
> | | |
> |---|---|
> | **13 se resolvieron** en tandas posteriores a su anotación | radios, alturas de botón, contraste de las casillas, botones del alta, filtros de admin, forma de diálogos y menús, y los dos documentos desactualizados |
> | **2 se descartaron al verificarlas** | ver "Las que se verificaron y NO existen", abajo |
> | **1 dejó de ser inconsistencia y pasó a ser regla** | los ítems de menú en mayúsculas (ver `CLAUDE.md` → "Rótulo corto en mayúsculas, frase en minúsculas") |
>
> ⚠ **Cada una se verificó contra el código actual antes de escribirla**, con su archivo y su línea de hoy.
> Las líneas se corrieron mucho durante el grupo: si no coinciden, buscar por contenido.

**El criterio de orden, y por qué es ése.** El marco es el calendario: entran inmobiliarias reales en
septiembre y publicidad en octubre. Así que **no ordena el costo de arreglarlo sino a quién le pasa algo
si se deja**:

- **P0 — antes de que entre el primer cliente que no controlamos.** Puede comprometer los datos de una
  agencia frente a otra. Era una sola, y quedó resuelta el 16 sep 2026.
- **P1 — la primera semana.** Una inmobiliaria o un visitante lo ve y **cambia lo que hace o lo que
  carga**. Acá entra lo que produce datos mal cargados, aunque el arreglo sea una clase de color: ver
  `CLAUDE.md` → "Un defecto visual sobre un control no es visual".
- **P2 — accesibilidad y coherencia visible.** No bloquea a nadie, pero deja afuera a alguien o da una
  imagen despareja.
- **P3 — deuda interna, documentación y cosmético.** No lo nota nadie de afuera; se paga en tiempo
  nuestro más adelante.

Dentro de cada nivel, primero lo que ven más personas.

---

### 🔴 P0 — Seguridad

#### 1. ~~UN AGENTE LOGUEADO PUEDE CAMBIARSE EL ROL Y LA AGENCIA CON LA CLAVE PÚBLICA~~ — ✅ RESUELTO (16 sep 2026)

**Qué se hizo:** en `agents` se revocaron INSERT/UPDATE/DELETE/TRUNCATE a `anon` y `authenticated`, se dejó `GRANT UPDATE (full_name, phone_wa, avatar_url)` a `authenticated`, se eliminó la policy de INSERT `Agent creates own profile` y la de UPDATE ganó `WITH CHECK`; además `Agent manages own properties` ganó un `WITH CHECK` que fija `agency_id` y `city_id` a los del propio agente, y `Agent manages own property images` quedó con `WITH CHECK` explícito. Aplicado a mano, probado simulando el JWT de un agente común (antes pasaba / ahora `42501`) y verificado en el navegador. Detalle y trampas en `CLAUDE.md` → "Base de Datos" → "Permisos de escritura del usuario".

⚠ **El agujero era más grande que lo que describía este ítem**, y se cerró entero en la misma tanda: (1) la policy `Agent creates own profile` (`WITH CHECK id = auth.uid()`) dejaba que **un usuario de Auth sin fila en `agents` se insertara como `admin` de cualquier agencia**, y con la autoconfirmación de email activa ese usuario lo consigue cualquiera con `signUp`; (2) `Agent manages own properties` sin `WITH CHECK` dejaba **insertar o mover una propiedad propia hacia otra agencia**. Este ítem decía también que *"hace falta una sesión válida, y eso acota quién puede: un agente de una inmobiliaria que nosotros dimos de alta"*: **era falso** por (1) — la sesión no la da el alta de la agencia, la da `signUp`.

---

### 🟠 P1 — La primera semana

> Lo que una inmobiliaria o un visitante ve y **cambia lo que hace o lo que carga**.

**Datos mal cargados** (la familia de la lección del grupo):

| # | Qué | Dónde | Riesgo de dejarla |
|---|---|---|---|
| 2 | **La tarjeta de operación se ve tocable entera, pero solo responden la casilla y el texto.** El `Label` no ocupa el ancho del contenedor, así que tocar el relleno de `p-4` no marca nada | `PropertyForm.tsx:352-373` | Es **el mismo control** cuyo defecto de contraste ya produjo el agujero de datos: la tarjeta invita a tocar y no pasa nada, así que la operación queda sin marcar |
| 3 | **Al enfocar una casilla con el teclado, su borde se ACLARA**: el componente mantiene `focus-visible:border-ring` y `--ring` (`globals.css:101`) es más claro que el `graphite/80` nuevo | `ui/checkbox.tsx:26` | Pierde contraste **justo en el foco**, que es cuando se la está por marcar. Deshace a medias lo que arregló la tanda de las casillas |

**Funcional y de producto:**

| # | Qué | Dónde | Riesgo de dejarla |
|---|---|---|---|
| 4 | **El detalle de propiedad se cierra al arrastrar hacia abajo desde el CUERPO, sin mirar el scroll** | `PropertyModal.tsx:788-790` | Un visitante que vuelve al principio del texto **pierde la ficha**. Es la única hoja que no sigue la regla de acotar el gesto (ver `CLAUDE.md`) |
| 5 | **En celular, el contenido del panel pasa por debajo del botón de menú al scrollear.** El `pt-14` libera la posición inicial del título, pero el botón es `fixed` y el `main` es el que scrollea | `Sidebar.tsx:187` + `dashboard/layout.tsx:57` y `admin/layout.tsx:65` | El panel se ve roto en el teléfono de cada inmobiliaria. Lo resolvería de raíz una barra superior en el flujo |
| 6 | **`agencies.phone_wa` se exige en el alta y se edita en Preferencias, pero NADIE lo usa para contactar**: los dos caminos de WhatsApp arman la URL con `agents.phone_wa` | `preferencias/page.tsx:37` y `AgencyPhoneForm.tsx:23,52` vs `PropertyContact.tsx:42,59` y `PropertyModal.tsx:198,220` | Una inmobiliaria cambia "su WhatsApp" y **las consultas siguen llegando al número del agente**. Es una decisión de producto (¿fallback? ¿se saca el campo?), no un bug de código |
| 7 | **El aviso de "revisá este número" dice que "el enlace de WhatsApp puede no llegar a destino" también en el teléfono de la AGENCIA**, cuyo número no arma ningún enlace | `PhoneWaInput.tsx` (`PhoneWaReviewNotice`) usado en `AgencyPhoneForm.tsx:99` | El texto es cierto en perfil y **exagerado** ahí. Sale gratis: depende del ítem 6 |
| 43 | **`spatial_ref_sys`: `anon` y `authenticated` conservan INSERT/UPDATE/DELETE.** El dueño de la tabla es `supabase_admin` (la crea PostGIS) y el rol `postgres` no puede revocar: el `REVOKE` del 16 sep 2026 se corrió y **no tuvo efecto** (medido: `has_table_privilege('anon', …, 'UPDATE')` sigue en `true`). **Acción:** pedido al soporte de Supabase para que revoquen la escritura (PostGIS solo necesita SELECT) | base (`public.spatial_ref_sys`) | Sabotaje de las definiciones de coordenadas, no fuga de datos |
| 8 | **Una línea fija no se puede cargar**: el campo antepone siempre `549` y un `543854000000` se guarda con el 9 agregado (verificado) | `phoneWa.ts:139-150` | Una inmobiliaria que atienda WhatsApp Business desde una línea fija **no puede cargar su número**, y el campo se lo "corrige" mientras escribe. Decisión de producto tomada a conciencia; lo que falta es saber si alguna fundadora está en ese caso |

---

### 🟡 P2 — Accesibilidad y coherencia visible

**Accesibilidad** (nadie de afuera la reporta, y deja gente afuera):

| # | Qué | Dónde | Riesgo |
|---|---|---|---|
| 9 | Las hojas **no son diálogos accesibles**: sin `role="dialog"`, sin `aria-modal`, sin captura de foco, y **cerradas siguen montadas y tabulables** (sin `inert`/`aria-hidden`). ⚠ Incluye que **el detalle no cierra con Escape** (la de filtros sí, desde el 15 sep) | `FilterPanel.tsx:604-623`, `PropertyModal.tsx:757-803` | Navegación con teclado confusa; se tabula hacia controles que están fuera de pantalla |
| 10 | Al cerrar la hoja de filtros **el foco no vuelve a ningún lado**: el botón que la abrió se desmonta mientras está abierta | `page.tsx:170-181`, `AgencyMapView.tsx:143-154` | El foco queda perdido fuera de pantalla. **Lo introdujo la tanda de las hojas** al ocultar los FABs |
| 11 | **IDs duplicados**: el panel se monta dos veces y hay dos de cada `amenity-*` y `only-featured`; el `htmlFor` apunta al primero, que es el del panel de escritorio | `FilterPanel.tsx:533`, `:554`, montado en `page.tsx:131` y `:155` | Las casillas de la hoja de celular **quedan sin nombre accesible** |
| 12 | La ✕ de la hoja de filtros **sin `aria-label` ni `type="button"`** (la del detalle sí los tiene) | `FilterPanel.tsx:380-382` | Un lector de pantalla anuncia "botón" sin nombre |
| 13 | **`aria-invalid` solo en dos campos** de toda la app: el selector de ciudad del registro y el teléfono | `RegisterForm.tsx:197`, `PhoneWaInput.tsx:121` | Un lector de pantalla **no anuncia** que un campo está en error |
| 14 | El **anillo de foco** de la familia caja está al **20 %** y la familia subrayado **no tiene anillo**; `DESIGN.md` pide sólido para todos | `fieldStyles.ts:35`, `:66`, `:71-72` | Foco poco visible al navegar con teclado |
| 15 | **`viewportFit: "cover"` no está declarado**, así que `env(safe-area-inset-*)` **vale 0 en todos los dispositivos** y la regla de zona segura de DESIGN §13 está escrita, aplicada y sin efecto | `src/app/layout.tsx:65-67` | Los FABs y las hojas pueden quedar bajo la barra de gestos en teléfonos con notch. **Es una línea** |

**Seguridad — endurecimiento pendiente** (anotado el 16 sep 2026, al cerrar la P0):

| # | Qué | Dónde | Riesgo |
|---|---|---|---|
| 44 | **`is_featured` es escribible por el agente con su sesión**: el gate de `has_featured` vive solo en las server actions. No se puso en el `WITH CHECK` de `Agent manages own properties` porque rompería la edición de las propiedades destacadas de una agencia que baja de plan; requiere un trigger que compare `OLD` y `NEW` | base (`properties`) + `propiedades/actions.ts` | Una agencia sin `has_featured` se marca destacada hablando con la API directo |
| 45 | **`views_count` es escribible por el agente sobre sus propiedades** (además de la RPC pública `increment_views`, ya anotada en "Deuda técnica") | base (`properties`) | El número de visitas del panel se puede inflar a mano |

**Coherencia visible:**

| # | Qué | Dónde | Riesgo |
|---|---|---|---|
| 16 | **El color del estado MARCADO de las casillas sigue sobrescrito a mano en 8 lugares** (`CHECKBOX_TERRACOTA` ×2 archivos + el literal repetido 4 veces) | `FilterPanel.tsx:19,536,559`; `admin/AgenciesTable.tsx:72,855,879`; `PropertyForm.tsx:366,652,1219,1265` | **Una casilla nueva sin el override se marca en casi negro**, porque el componente marca en `bg-primary`. Es el molde exacto de las duplicaciones que el proyecto ya se cobró |
| 17 | **Cuatro cajas de campo escritas a mano** fuera de la definición única, todas con `focus:` en vez de `focus-visible:` | `FilterPanel.tsx:129`, `PropertyContact.tsx:126`, `PropertyModal.tsx:616`, `ShareButton.tsx:217` | Se desincronizan de `fieldStyles.ts`, que existe justamente para eso |
| 18 | **Las etiquetas de formulario son 12px SemiBold en MAYÚSCULAS** y `DESIGN.md` pide 13px Medium. ⚠ **Las mayúsculas ya NO son la inconsistencia** (son regla: rótulo corto); lo que no coincide es **el tamaño y el peso** | `ui/label.tsx:16` | Formularios levemente más "gritados" que el diseño documentado. Hay que decidir cuál de los dos se mueve |
| 19 | **Campos de autenticación con fondo transparente**; DESIGN pide blanco | `ui/input.tsx:11` | O se corrige el código o se corrige el documento: hoy se contradicen |
| 20 | **"Amenities" en el filtro y en el formulario, "Comodidades" en la ficha pública** | `FilterPanel.tsx:522`, `PropertyForm.tsx:1211`, `propiedades/[slug]/page.tsx:314` | El mismo concepto con dos nombres en dos pantallas públicas, uno en inglés |
| 21 | **`ModalContent` se monta DOS veces** por apertura (panel de escritorio + hoja de celular), con estado separado | `PropertyModal.tsx:764-768`, `:797-801` | El doble de DOM y de trabajo; dos estados que pueden divergir. Es lo que produjo la medición falsa de `alto: 0` al medir la copia oculta |
| 22 | **El área de toque extendida de "Ver ficha completa" puede solaparse con los puntos del carrusel** | `PropertyModal.tsx:342` vs `:96` | Medido a 390 px no se tocan, pero en una pantalla más angosta el toque puede caer en el botón equivocado |
| 23 | Guardar un teléfono **preservado sin tocarlo** igual dice "Teléfono de la agencia actualizado" | `preferencias/actions.ts:71-79`, `AgencyPhoneForm.tsx:118-122` | El mensaje sugiere que algo se guardó cuando no cambió nada, **justo al lado del aviso de revisión** |
| 24 | El **teléfono en variante subrayado mide 41 px** y los demás campos 40: el contenedor suma su borde al alto del input | `fieldStyles.ts:71` + `ui/input.tsx:11` | Un píxel; se ve al apilar campos |

---

### ⚪ P3 — Deuda interna, documentación y cosmético

| # | Qué | Dónde | Riesgo |
|---|---|---|---|
| 25 | **Los dos FABs y el montaje del panel están duplicados carácter por carácter** entre la home y el sitio de marca | `page.tsx:129-203`, `AgencyMapView.tsx:129-176` | Todo arreglo hay que hacerlo dos veces, y es el patrón que el proyecto ya se cobró tres veces (`AgenciesTable`, `AgentCell`, el encabezado público) |
| 26 | El detalle mueve la hoja con **`transform`** mientras su clase usa **`translate`**: se **suman** en vez de reemplazarse (la de filtros ya usa `translate`) | `PropertyModal.tsx:785` vs `:787` | Salto visual al cerrar por gesto |
| 27 | **Hoja y velo de filtros sin `md:hidden`** (los del detalle lo tienen) | `FilterPanel.tsx:598-611` | Abrir la hoja en celular y agrandar la ventana deja la hoja encima del panel lateral |
| 28 | **Dos hojas hermanas con dos altos** (`85vh` y `82vh`), y ninguna en `dvh` | `FilterPanel.tsx:608`, `PropertyModal.tsx:783` | Sin motivo escrito; `vh` es el viewport grande del celular |
| 29 | **`top-14` fijo** en el panel lateral del detalle, acoplado por un número repetido al `h-14` de los dos encabezados | `PropertyModal.tsx:759` | Si un encabezado cambia de alto, el panel queda encima o deja un hueco, **sin ningún error** |
| 30 | **Los FABs desaparecen de golpe** mientras la hoja sube en 220 ms | `page.tsx:170` | Estético; las dos hojas son coherentes entre sí |
| 31 | **Dos contenedores con scroll anidados** en el panel de filtros de escritorio | `page.tsx:130` + `FilterPanel.tsx:386` | — |
| 32 | **`commitPrice` y `commitArea` son idénticas**, y `parseFloat` acepta `"12abc"` → 12 y negativos | `FilterPanel.tsx:312-320` | Filtros con valores raros, sin aviso |
| 33 | **Estado local de los inputs por instancia** del panel: lo tipeado y no confirmado no se comparte | `FilterPanel.tsx:152-155` | Invisible hoy (nunca se ven las dos instancias a la vez) |
| 34 | Dentro de la familia caja, **el error se muestra de tres formas**: el formulario de propiedades colorea el campo, el teléfono colorea el contenedor, y perfil/equipo/identidad solo ponen texto rojo debajo | `PropertyForm.tsx:971` vs `ProfileForm.tsx:266-268`, `TeamContent.tsx:467-469`, `AgencyIdentityForm.tsx:200-202` | El error es menos evidente en tres pantallas |
| 35 | **`lg` quedó con la misma altura que `default`** (44) y **`icon-lg` igual que `icon`**; los dos con **cero usos** | `ui/button.tsx:30,37,38,41` | Tamaños redundantes en una escala que acaba de definirse. O se les da un rol o se sacan |
| 36 | **Cuatro componentes del preset sin un solo consumidor**: `Badge`, `Card`, `Slider` y `Dialog`. Los dos primeros siguen en `rounded-none`, fuera de la regla de formas | `ui/badge.tsx:8`, `ui/card.tsx:15,28`, `ui/slider.tsx`, `ui/dialog.tsx` | Alguien los usa creyendo que siguen el diseño, y entran rectos sin que nada avise |
| 37 | **Sin CHECK de formato en `agents.phone_wa` ni `agencies.phone_wa`** | base | Toda la garantía vive en el código. ⚠ **Mejoró mucho**: hoy los cuatro caminos validan en el servidor (verificado), así que es defensa en profundidad y no un agujero |
| 38 | **`leads.contact_phone` es una columna muerta**: ningún camino la escribe | `types/index.ts:447` + la migración | Confusión para quien lea el modelo |
| 39 | Comentario que dice que los botones de operación **"comparten una fila de 320px"** — es el ancho del panel de escritorio; en la hoja de un teléfono de 320 px la fila tiene 280 | `FilterPanel.tsx:27-29` | Un número escrito que no describe el caso que importa |
| 40 | **Indentación irregular** en el formulario de inicio de sesión (hijos a 12 espacios, `</Button>` desalineado) | `LoginForm.tsx:69-124` | Cosmético, previo al grupo |
| 41 | **Indentación irregular** en el bloque de filtros del panel de plataforma (el `.map` al mismo nivel que su contenedor) | `admin/AgenciesTable.tsx:842-843`, `:866-867` | Cosmético; **lo introdujo la tanda de los cuatro defectos** |
| 46 | **`property_images.url` es texto libre**: un agente puede apuntar una imagen a cualquier dominio | base (`property_images`) | Una ficha pública cargando imágenes de un tercero |
| 47 | **Los default privileges de `public` otorgan INSERT/UPDATE/DELETE a `anon` y `authenticated` en toda tabla nueva** (medido en `pg_default_acl`: `arwdDxtm` para los dos, de `postgres` y de `supabase_admin`). Hoy la protección de `agencies`, `subscriptions`, `cities` y `agency_reviews` depende de que **no tengan policies de escritura** | base | Una policy de escritura agregada "por prolijidad" abre la tabla. Endurecerlo es una decisión de otra escala |
| 48 | **Activar "Confirm email" en Supabase Auth** cuando exista el servicio de correo propio. Hoy la autoconfirmación está activa y `signUp` devuelve sesión en el acto | configuración de Auth | Cualquiera obtiene un JWT válido sin confirmar la dirección. |
| 42 | **El usuario de solo lectura del MCP no puede ejecutar `agency_is_publicly_visible`** (`42501`) ni ve permisos en `information_schema.role_table_grants` / `column_privileges` (devuelven vacío) | herramienta | ⚠ **Quien audite permisos por MCP con `information_schema` va a concluir que NO HAY NINGUNO.** Hay que usar `pg_class.relacl` / `pg_attribute.attacl` o `has_*_privilege`. Fue exactamente así como se midió el ítem 1 |

---

### Las que se verificaron y NO existen (no se escriben como deuda)

| Qué decía la anotación | Qué se midió |
|---|---|
| **La quita del "15" podría fallar con una característica de 4 dígitos terminada en "15"** (`phoneWa.ts`) | **No se reproduce.** Se probaron **todas** las características de 3 y 4 dígitos que empiezan en 1-3 (100 a 9999) con el 15 intercalado: el patrón colapsa al mismo resultado sin importar cuál de las dos ocurrencias matchee el bucle. **Cero casos erróneos.** La anotación decía "no verificado"; ahora está verificado y descartado |
| **`ui/button.tsx` ganó `relative` y eso cambia el bloque contenedor de cualquier hijo `absolute` dentro de un botón** | **No hay ningún caso real**: barrido de todos los usos de `<Button>` en `src/`, cero hijos posicionados en absoluto. El riesgo era teórico y sigue siéndolo; queda escrito en `CLAUDE.md` junto al porqué del `relative`, que es donde sirve |

---

## 🚀 NUEVA FASE — Cambios profundos de modelo (post-validación con el rubro)

> Contexto: tras reuniones con inmobiliarias del rubro y con el presidente del colegio
> de corredores de Santiago, + entrada de un socio que financia la startup (sueldo +
> dedicación full-time + participa en decisiones), surge una hoja de ruta nueva. Varios
> de estos cambios REVIERTEN o AJUSTAN decisiones del modelo actual. Nada de esto rompe
> la arquitectura (mapa, propiedades, dashboard, roles, panel admin, white-label se
> mantienen); son cambios de MODELO DE ENTRADA y de RIQUEZA del listado. Casi todo se
> apoya en infraestructura que ya existe o estaba anotada.
>
> Agrupados en 3 bloques temáticos. Orden sugerido: arrancar por el BLOQUE A (define
> quién entra a la plataforma; es lo que el colegio mira y da legitimidad). Las
> decisiones ahora se toman entre el usuario, el socio y Claude (criterio técnico).

### BLOQUE A — Modelo de agencias (legitimidad) — arrancar por acá

- [x] **A1 · Eliminar particulares — HECHA (27 ago 2026).** Ver detalle en "Cerrados recientemente".

- [x] **A2 · Matrícula + alta manual de agencias — HECHA (28 ago 2026).** Ver detalle en "Cerrados recientemente". Queda el texto original abajo como registro del razonamiento con el que se diseñó:

- [x] ~~**A2 · Matrícula + alta manual de agencias (SÍ O SÍ, ver la forma).**~~ Dos partes: (a) **número de matrícula** como dato de la agencia (campo nuevo en `agencies` + probablemente estado de verificación → `ALTER` aditivo). (b) **Alta manual**: las agencias ya NO se dan de alta solas. Razón: el padrón es público, así que verificar la matrícula automáticamente probaría que la matrícula EXISTE, no que quien la carga es su dueño — cualquiera con los datos públicos podría hacerse pasar por una agencia. Por eso el alta la aprueba el dueño de la app manualmente. **Buena noticia: ya existe casi toda la infraestructura** — el dueño hoy activa planes pagos manualmente desde `/admin`; el alta de agencias es el mismo patrón (aprobación del dueño) un paso antes. Se EXTIENDE, no se inventa. **Conecta con** la deuda ya anotada "Edición del nombre de la agencia con aprobación del dueño" — misma familia (datos de agencia semi-regulados que el dueño valida); conviene diseñarlas juntas. La pieza "Selección de plan post-registro" actual y el flujo de registro de dos pasos se van a tener que repensar con esto.
  - **Piezas que se resuelven DENTRO de A2, no antes ni por separado:**
    - [x] **Sacar la columna "Tipo" del panel `/admin`** — HECHO. Se sacó junto con su mapa de etiquetas inline al rehacer la tabla.
    - [x] **El bug del loop del dashboard** — HECHO. Ver "Cerrados recientemente".
    - [x] **Rollback del usuario de auth en el registro** — HECHO para las fallas de `agencies` y de `agents`. ⚠ **Falta el caso de `subscriptions`** (ver Deuda técnica).
    - **Verificación contra el padrón como ASISTENCIA, no como autorización.** El chequeo automático no sirve para autorizar (el padrón es público: prueba que la matrícula existe, no que quien la carga sea su dueño), pero sí para que el panel muestre "la matrícula 1234 existe y figura a nombre de X" y la aprobación del dueño sea un vistazo en vez de una investigación. **Depende de un dato no técnico: ¿el padrón del colegio es consultable automáticamente, o es un PDF/lista que hay que cargar como tabla de referencia?** Averiguarlo antes de diseñar. Nota estratégica: si el colegio da acceso al padrón, deja de ser un requisito de cumplimiento y pasa a ser un canal de adquisición.

### BLOQUE A-bis — Lo que falta para poder COBRAR

- [x] **~~El mapa público no filtra por agencia habilitada~~ — RESUELTO (31 ago 2026). Era EL bloqueante para poder cobrar.** La forma elegida no fue ninguna de las tres que estaban anotadas (flag denormalizado / join en la query / pausar propiedades al dar de baja): la regla vive en una **función de la base** (`agency_is_publicly_visible`: aprobada + suscripción `active` + plan pago) y la invocan **tres policies** — lectura pública de `properties`, lectura pública de `property_images` e inserción de `leads`. **Por qué policy y no un filtro en la query:** hay DOS caminos públicos que leen propiedades con la anon key (el hook del mapa y el modal, que consulta por id), y el que se olvide filtra mal **en silencio**. Se midió el plan de ejecución antes de decidir: la query caliente no se degradó y las dos tablas del join tienen una fila por agencia. La función es SECURITY DEFINER porque el visitante anónimo no puede leer `subscriptions` (sin eso, ocultaría todo). El sitio de marca `/[slug]` se alineó **por código** (llama a la misma función por RPC), porque lee con service role y las policies no lo cubren. Ver `CLAUDE.md` → "Visibilidad pública de las propiedades".

### BLOQUE B — Datos de la propiedad (riqueza del listado)

- [x] **B1 · Precio opcional — HECHA (3 sep 2026).** Se implementó la dirección que estaba propuesta (decisión POR PROPIEDAD), con dos correcciones sobre lo anotado. **(1) El texto NO es "Consultar", es "A convenir"**: el modal tiene dos botones que dicen "Consultar por WhatsApp" a centímetros del precio y las dos frases juntas se leerían como la misma cosa. La constante es `NO_PRICE_LABEL` en `formatPrice.ts`. **(2) El precio no es "visible/oculto" por propiedad sino POR OPERACIÓN**: al haberse hecho B3 en la misma tanda, una casa puede tener precio de venta publicado y alquiler a convenir. Un precio en NULL con la operación activa **es** "a convenir" — no hizo falta un flag aparte.
  **Lo que quedó:** `formatPrice` y `formatPriceCompact` aceptan precio y moneda nulos (antes la primera **crasheaba** con null y la segunda devolvía un `"USD 0k"` silencioso y falso); los CHECK de la base exigen que precio y moneda vayan siempre juntos o los dos en NULL.
  **La consecuencia de producto que hay que recordar: una propiedad sin precio queda FUERA del filtro de rango de precio.** Es deliberado y sale gratis (comparar contra NULL no matchea, verificado contra la base). El formulario **se lo advierte al agente** en un aviso visible junto al campo vacío, porque es información que la agencia necesita para decidir, no letra chica. El riesgo que el ítem anotaba —"si TODAS ocultan, el mapa pierde valor"— **sigue vigente y hay que medirlo cuando carguen las fundadoras**: hoy **7 de 18** propiedades de prueba tienen alguna operación sin precio (re-medido el 14 sep 2026; era 6 de 17 el 12 sep y 5 de 18 el 8 sep), pero son datos fabricados y no dicen nada.

- [x] **B2 · Requisitos para alquiler — HECHA (3 sep 2026).** Dos columnas JSONB en `properties`: `rent_requirements` (lista cerrada de siete: recibo de sueldo, garantía propietaria, seguro de caución, DNI, comprobante de ingresos o monotributo, depósito, mes adelantado) y `rent_requirements_other` (hasta **5** requisitos libres de hasta **300** caracteres). Se muestran como chips en el modal y solo existen si la propiedad tiene alguna operación de alquiler.
  ⚠ **Lo que este ítem decía y NO se hizo: "mismo patrón que `amenities`".** Se copió la FORMA (JSONB marcado en la propiedad, chips en el modal) pero **NO la falta de validación**, a propósito. `amenities` no tiene barrera de dominio en ninguna capa, así que un cliente manipulado le escribe cualquier string y se renderiza en el modal público (ver el ítem nuevo en Deuda técnica). Los requisitos validan en **las tres**: CHECK en la base, zod contra los siete literales en el formulario, y **filtrado contra la lista cerrada en la server action** — que es la única barrera real, porque el tipo de TypeScript se borra al compilar y el zod corre en el cliente.
  **Dos cosas que cambiaron durante la implementación:** el "otro" de texto libre **empezó siendo UNA columna TEXT y terminó siendo una lista**. Probándolo quedó claro que una inmobiliaria no pide *un* requisito extra, pide varios ("garante con propiedad en la ciudad", "seis meses de antigüedad laboral", "no se aceptan mascotas"): con un campo único había que amontonarlos separados por comas y quedaban apretados en una línea al lado de siete chips prolijos. Y el CHECK que valida elemento por elemento **necesitó una función** (`jsonb_is_short_string_array`, IMMUTABLE) porque **PostgreSQL rechaza subconsultas dentro de un CHECK** y recorrer un array JSONB exige `jsonb_array_elements()`, que devuelve filas.

- [x] **B3 · Una propiedad en VENTA Y EN ALQUILER a la vez — HECHA (3 sep 2026).** Era la pieza que arrastraba a las otras dos, y se hizo primero.
  **Cómo se representa, y qué se descartó.** Se eligieron **tres pares simétricos de columnas** (`for_sale`/`sale_price`/`sale_currency`, y sus equivalentes de `rent` y `temp_rent`). Las dos alternativas que el ítem anotaba se descartaron por motivos concretos:
  - **Un array/JSONB de operaciones al estilo `amenities`** → **rompía el filtro de rango de precio**, que necesita comparar contra una columna indexable. Con las operaciones adentro de un JSONB, filtrar "alquileres entre X e Y" deja de ser un `gte`/`lte` sobre un índice y pasa a ser una extracción por elemento.
  - **Una tabla de ofertas por propiedad** → obligaba a un **JOIN en la query caliente del mapa**, que está acotada a propósito (SELECT explícito, sin `*`).
  Con columnas, el filtro sigue siendo un `gte`/`lte` y hay un **índice parcial por operación** (`idx_properties_for_sale`, `_for_rent`, `_for_temp_rent`).
  **La moneda quedó POR OPERACIÓN, no por propiedad**, y no es un detalle: en Argentina la venta se cotiza en dólares y el alquiler en pesos, así que con una moneda única el caso que esta pieza existe para representar no se puede expresar.
  **El alquiler temporal quedó como una operación más, simétrica a las otras dos**, en vez de como una modalidad del alquiler: es más fiel a cómo lo piensa el rubro y no obliga a rediseñar el filtro público para exponer un sub-eje.
  **`price_negotiable` se eliminó** (del modelo, del formulario y del modal, donde producía un sufijo "· Negociable"): se solapaba con "a convenir" — dos señales sobre el mismo número, y la nueva es más clara y más fuerte.
  **El estado de la propiedad sigue siendo UNO SOLO.** Cerrar cualquiera de las operaciones cierra la ficha entera; una propiedad con las dos ofrece las dos opciones de cierre en el menú y eso es correcto. Para el caso raro (se vendió pero se sigue alquilando), la agencia **desmarca la operación que se concretó**. Se evaluó permitir un estado por operación y se descartó: multiplica los estados posibles por tres para un caso que todavía nadie reportó.
  **La pregunta de producto que el ítem dejaba abierta —"¿qué precio muestra el pin?"— se contestó** con una regla en una función pura (`getDisplayOperationPrice`): si el visitante marcó exactamente una operación y la propiedad la tiene, se muestra la de esa operación; si no, gana la prioridad venta → alquiler → temporal. Está en `src/lib/utils/propertyOperations.ts` y la consumen el pin y la card, para que no puedan mostrar números distintos para lo mismo.
  **El filtro de operación pasó a selección MÚLTIPLE**, y el rango de precio **solo se habilita con una operación marcada** (un precio de venta y uno de alquiler no viven en la misma escala).
  ⚠ **La trampa que apareció midiendo, y que no estaba anotada:** `ClusterLayer` decide si redibujar comparando **solo los ids**, y una propiedad de doble operación aparece en los resultados de los dos filtros — así que al cambiar el filtro el conjunto no cambia, el diff corta y **el pin se queda mostrando el precio de la operación anterior**, sin ningún síntoma. Se resolvió con un efecto aparte que refresca solo el precio. Ver `CLAUDE.md` → "Operaciones, precios y requisitos" → trampas.
  **Lo que el ítem pedía validar sigue pendiente de datos reales:** cuántas propiedades son realmente de doble operación y qué esperan ver las agencias. Hoy son 3 de 18, todas fabricadas para probar (re-medido el 8 sep 2026).

### BLOQUE C — Crecimiento y monetización (ideas del socio)

- [ ] **C1 · Registro OPCIONAL de visitantes + base para monetización de datos (EN EVALUACIÓN).** El socio quiere monetizar datos. Parte técnica viable y ya medio pensada (ver "¿Login opcional de visitantes?" en Decisiones de producto): auth de visitantes opcional (NUNCA obligatorio — el registro mata conversión), habilita favoritos sincronizados, alertas de precio, etc. **Parte de venta de datos — NOTA LEGAL IMPORTANTE (criterio técnico, no decisión tomada):** vender datos personales identificables está fuertemente regulado en Argentina (Ley 25.326): requiere consentimiento explícito e informado + registro de la base ante la autoridad. Distinguir: (a) datos personales identificables → alto riesgo legal y de confianza; (b) **datos de mercado AGREGADOS y anónimos** (precio/m² por zona, evolución, demanda por barrio) → más seguros, igual o más valiosos, vendibles a tasadoras/bancos/desarrolladores/colegio. Recomendación a discutir con el socio: sí al registro opcional, sí a monetizar — orientado primero a datos de mercado agregados (valor grande y limpio); venta de datos personales solo con aparato legal completo. **Diseñar el registro PREPARADO para consentimiento desde el día 1** (checkbox claro de uso de datos) — barato ahora, caro de retrofittear. NO documentar como decisión tomada; es para discutir entre los tres.

- [x] **C2 · Página + link por propiedad — HECHA (7–8 sep 2026), en dos tandas** (la página + su infraestructura, y después la corrección del scroll y las dos puertas de entrada). Salió como estaba anotada —página real en `/propiedades/[slug]`, no "darle URL al modal"— y el bonus de SEO que el ítem preveía se hizo entero: mapa del sitio y archivo de instrucciones para buscadores. Los porqués completos están en `CLAUDE.md` → "Página pública de la propiedad".

  **La ruta lleva PREFIJO, y no era opcional.** El ítem anotaba `/propiedades/[slug]` y esa forma resultó ser la única posible: en el primer nivel ya vive el `[slug]` de agencia, y **dos rutas dinámicas hermanas en el mismo nivel son ambiguas** — el framework no las admite. (Es distinto de la nota de namespace del white-label, que hablaba de rutas **estáticas**: aquellas sí conviven, porque le ganan a la dinámica.)

  **Lo que se decidió, y lo que se DESCARTÓ midiendo:**

  | Se descartó | Por qué |
  |---|---|
  | **Leer la propiedad con el client de servidor (con sesión)** | Dos motivos medidos, y los dos vuelven la alternativa **imposible**, no solo peor. **(1)** Con las policies los tres estados son **indistinguibles**: `Public read active properties` es una sola condición (`status = 'active' AND agency_is_publicly_visible(...)`), así que una propiedad pausada, una de agencia impaga y un slug inexistente devuelven **los tres la lista vacía** — verificado contra la API con la anon key. Con eso la página **solo podría hacer 404**, que es justo lo que el estado "no disponible" existe para evitar. **(2)** Las **tres** policies de SELECT de `properties` son PERMISSIVE y se combinan con **OR**, así que un **agente logueado de esa agencia** entraría por `Agency members read agency properties` y **vería publicada una propiedad que para el resto del mundo no lo está** — y es el caso más probable: el agente que acaba de pausar algo y abre su enlace para ver cómo quedó. Con service role el resultado es idéntico para todos |
  | **Reescribir la regla de cobro en TypeScript** | La dejaría escrita en **tres** lugares (las policies, el sitio de marca y esta página). Se pregunta a la base por RPC (`agency_is_publicly_visible`), falla cerrada. El día que la regla cambie —un `past_due` con período de gracia, por ejemplo— el mapa, el sitio de marca y la página no pueden decir cosas distintas |
  | **Un mapa interactivo cargado solo en el cliente** (reusar `LocationPicker`) | Se monta con `ssr: false`: un buscador ve un recuadro vacío y la página arrastra Leaflet entero para algo con lo que el 99 % de las visitas no va a interactuar. **En su lugar** se escribió `StaticMap`: una grilla de **4×2 tiles de OSM en `<img>`** corrida con CSS para centrar el punto, con el pin encima y la atribución. Cero JS, cero librería, y usa `TILE_CONFIG` — el día que el proyecto migre a MapTiler, este mapa migra con el grande. **No había alternativa comprada**: OSM no ofrece API de imágenes estáticas y la rama de MapTiler existe pero su key está vacía |
  | **Generar una imagen propia para la vista previa** (`opengraph-image` con `ImageResponse`) | Sumaba una ruta, tiempo de build y otra fuente de verdad **para mostrar algo peor que la foto de la casa**. Se usa la **foto de portada real**, que ya es una URL absoluta del bucket |
  | **El carrusel del modal para la galería** | Guarda la foto activa en un `useState` y apila el resto con `opacity-0`: para un buscador **existe una sola foto**. Se escribió `PropertyGallery`, Server Component con `scroll-snap` de CSS y **cero JS**, con las N fotos en el HTML. El precio es que no hay flechas ni puntitos; a cambio, gesto táctil nativo y el conteo en texto |

  **Del modal se extrajeron EXACTAMENTE DOS cosas, y el resto se reescribió.** Es la decisión que más tiempo llevó y conviene que quede asentada:

  | Extraído | Por qué **esa** |
  |---|---|
  | **`AMENITY_ICONS`** → `lib/utils/amenityIcons.ts` | Son **16 entradas exhaustivas por tipo** (`Record<Amenity, LucideIcon>`). Duplicarla es la clase de constante que se desincroniza **sin fallar**: una amenity nueva agregada en un solo lado no rompe nada, solo hace que una pantalla muestre el ícono correcto y la otra el genérico. El proyecto ya se comió ese defecto una vez (`AgenciesTable`) |
  | **El insert de la consulta** → `lib/utils/registerLead.ts` | Lleva encima **cuatro decisiones**, y **la más frágil es una OMISIÓN**: que `agent_name` NO viaje en el payload (lo escribe el trigger). Las omisiones no se copian: se olvidan. Extraerlo puso las cuatro por escrito, una en la función y tres como contrato del llamador |

  **Lo que NO se extrajo, y por qué:** el kicker, los precios, la ubicación, las métricas, los chips y el bloque de contacto son **seis bloques de 12-25 líneas sin lógica propia**, que solo componen helpers ya compartidos (`formatPrice`, `getActiveOperations`, `labels.ts`). Extraerlos costaba más código del que ahorraba y —más caro— **acoplaba dos pantallas que tienen que poder evolucionar distinto**: en el modal el precio compite con un CTA a 200 px y vive en una franja de alto contado; en la página tiene la columna entera.

  **Lo que se resolvió en la segunda tanda (8 sep):** la página nació **sin contenedor de scroll propio** y su contenido era inalcanzable de la mitad para abajo; y **no había ninguna puerta** hacia ella desde la app. Ver los dos ítems de abajo.

  **Cabos que este ítem dejó atados y estaban anotados en otro lado:**
  - La nota de V2 sobre enlazar el título de la propiedad en la pantalla de **Consultas** (`/dashboard/leads`) —que se había dejado sin enlace *"para no romper con un 404"*— **ya se puede hacer**: la ruta existe. Sigue abierta, ver "V2".
  - La advertencia de la deuda del **texto libre de los requisitos** ("revisar cuando se haga C2, porque aparecen caminos donde el escapado de React no aplica"): se revisó. Los requisitos **no** entran en la metadata ni en el `title`; lo único que sale de JSX es la descripción corta de `openGraph`, armada con tipo, operaciones, precio, ubicación y métricas — todos datos controlados o numéricos. **El riesgo no se materializó**, y el ítem queda abierto con esa verificación anotada.

- [x] **C3 · El botón "Ingresar" como puerta de captación — HECHA (10 sep 2026), en tres tandas** (diagnóstico de solo lectura, implementación, y la inversión de cuál de los dos enlaces se oculta en pantalla chica). El encabezado de la home tiene ahora **dos** enlaces donde había uno: **"Sumá tu inmobiliaria" → `/register`** (botón secundario) e **"Iniciar sesión" → `/login`** (ghost). Con sesión, los dos se reemplazan por "Ir al panel". Los porqués completos están en `CLAUDE.md` → "El encabezado público".

  **⚠ EL DIAGNÓSTICO ENCONTRÓ QUE ERAN DOS LUGARES Y MEDIO, NO DOS.** El ítem anotaba dos archivos y acertaba, pero se quedaba corto en dos cosas que resultaron obligatorias:
  - **El bloque de detección de sesión estaba duplicado CARÁCTER POR CARÁCTER** en los dos (`useState(false)` + `useEffect` + `createClient()` + `getUser()`), y **las copias ya divergían**: una tenía `shrink-0` y la otra no. Con "Ingresar" (ocho caracteres) no se notaba; con un texto tres veces más largo, sí. Se extrajo `src/components/auth/PublicHeaderAuth.tsx`, con variantes `marketplace` / `agency` y sin default en la prop, para que un consumidor nuevo esté **forzado a decidir** si su pantalla lleva captación. Mismo remedio que `AgentCell` tras el precedente de `AgenciesTable`.
  - **El encabezado de la home no tenía NI UNA guarda de ancho** (sin `gap`, `min-w-0`, `truncate`, `shrink-0` ni `max-w`), mientras el del sitio de marca las tenía las cinco: el problema **ya estaba resuelto, en el archivo equivocado**. Se trasplantaron. Y el `CityPicker` tenía el nombre de la ciudad como **nodo de texto suelto dentro de un flex** —un item anónimo, al que no se le puede aplicar ninguna clase—, así que no es que le faltara `truncate`: **no había dónde ponerlo**. Se envolvió en un `<span>`.
  - **De paso apareció un tercer lugar:** el esqueleto de carga de la home tenía los tres slots como bloques grises con anchos escritos a mano, y el de la derecha medía `w-16` = **64 px dimensionados a ojo para la palabra "Ingresar"**. Se eliminó el ancho en vez de ajustarlo: el estado de carga renderiza el encabezado **real**, y el único placeholder que queda es el del selector de ciudad, que es lo único que efectivamente espera al `cityStore`.

  **Lo que se DESCARTÓ, y por qué:**

  | Se descartó | Por qué |
  |---|---|
  | **Una pantalla intermedia que explique la propuesta a una inmobiliaria** | Es una **pieza propia**, con su copy, sus argumentos y sus precios, y merece pensarse aparte en vez de salir apurada como anexo de un cambio de encabezado. El enlace va **directo al registro**, que ya dice para quién es en cuatro lugares (claim, subclaim, "Sumá tu inmobiliaria en un par de pasos", y los campos de razón social y matrícula). Cuando exista, va a ser además el destino natural del tráfico frío de buscadores |
  | **Poner la captación en el sitio de marca de una agencia** | **Decisión comercial y firme.** Ese sitio es lo que la agencia compra con su plan (`has_white_label`), y el marketplace es **por ciudad**: un llamado a sumar inmobiliarias ahí usa el espacio que paga un cliente para **captar a su competencia directa, de su misma ciudad**. Le daría un argumento fácil y perfectamente articulable para no renovar. Además contradice lo que ese encabezado ya decidió: la marca que se muestra es la de la agencia, y Marka queda como un "Powered by" deliberadamente discreto al pie |
  | **Poner la captación en la página pública de la propiedad** | Dos motivos. **(1)** Quien llega ahí desde un buscador está buscando **una casa**, y el llamado competiría con el botón de WhatsApp, que es el paso final de esa pantalla. **(2)** Esa página **existe para renderizarse entera en el servidor** — es la restricción que gobierna todo su diseño—, así que un llamado que dependa de la sesión **obligaría a estrenar una isla de cliente** contra su razón de ser, y uno que no dependa le mostraría "Sumá tu inmobiliaria" a un agente logueado |
  | **Usar terracota para el llamado** | En esa pantalla el terracota **ya está tomado** por el FAB "Ver lista / Ver mapa", que es la acción principal **del visitante** — y el visitante es el 99 % del tráfico. Dos elementos del color de la marca compitiendo confunden cuál es el paso siguiente. Es el mismo criterio, con las mismas palabras, que DESIGN §11 aplica a los dos botones del `LocationPicker`. El llamado quedó como **botón secundario** (borde `stone`, hover `mist`): la jerarquía contra el enlace vecino **la da la caja, no el color** |
  | **Resolver la sesión en el servidor** para que el texto no parpadee | Habría que volver la home un Server Component, o sea **`ƒ (Dynamic)` en vez de `○ (Static)`**: renderizar en cada request la pantalla más visitada del producto, por un parpadeo que solo ven los agentes. El tipo de ruta es parte del baseline medido. En su lugar se apagó el **salto de layout**, que era lo que se veía |

  **⚠ EL MECANISMO ANTISALTO ES LA TRAMPA QUE HAY QUE NO ROMPER.** Los dos estados de sesión se renderizan **siempre**, apilados en la misma celda de una grilla de 1×1, y el inactivo se apaga con **`invisible` (`visibility: hidden`) y NUNCA con `hidden` (`display: none`)**: el que no se ve tiene que **seguir ocupando su celda** para que la grilla mida el máximo de los dos. Con `display: none` el ancho vuelve a depender de la sesión y reaparece el salto —**medido: 195,2 px en `sm`+ y 22,7 px por debajo**—. O sea que **la "limpieza" obvia es justamente lo que lo rompe**. Corolario: lo que se apaga por breakpoint es un **enlace de adentro** de una rama, nunca una rama entera.

  **Se midieron los anchos de verdad, no se estimaron:** se cargaron con `fontkit` los `.woff2` que sirve el build y se aplicó la variación de peso a mano (normalización del eje `wght` → `avar` → deltas de `HVAR`), porque son fuentes variables que la librería no puede instanciar en esos subconjuntos. **Desde 376 px de viewport el nombre de la ciudad entra completo**; por debajo se recorta. Ver el ítem de pulido estético.

- [ ] **C4 · ⚠ EN EL CELULAR LA CAPTACIÓN NO SE VE EN NINGÚN LADO, así que C3 queda cumplida a medias justo en el dispositivo donde va a caer la mayoría del tráfico (abierto el 10 sep 2026, consecuencia deliberada de C3).** Verificado en el código: en `PublicHeaderAuth.tsx` el enlace a `/register` lleva `hidden … sm:inline-flex`, o sea que **por debajo de 640 px no se renderiza**. Y no se mudó a otro lado: **no está**.

  **No es un olvido, fue una decisión de producto y sigue siendo la correcta:** los cuatro elementos del encabezado no entran en un teléfono (medido: a 375 px hacen falta ~523 px), así que había que sacar uno. **El ingreso es la función que un cliente usa todos los días** y el celular es donde más se navega; esconderlo ahí le agrega un paso a quien ya paga para ganar una conversión eventual de quien todavía no. Entre molestar a un cliente todos los días y perder una puerta de captación en un tamaño de pantalla, se eligió lo segundo.

  **⚠ Pero el problema queda abierto, y se agranda en octubre:** cuando arranque la publicidad, el visitante de inmobiliaria que mire el mapa desde el teléfono —el caso más frecuente— **no va a tener una sola línea de la interfaz que le hable**, que es exactamente la situación que C3 vino a resolver. La pieza la resuelve en escritorio y la deja abierta en celular.

  **La alternativa evaluada y NO implementada: el pie de la lista de propiedades.** Es la **única superficie pública del celular que scrollea** — el mapa es `h-dvh` con el scroll del documento bloqueado a nivel raíz (`globals.css`), así que **no existe ningún "abajo" donde colgar nada**, y los dos FABs ya están tomados. `PropertyList`, en cambio, tiene scroll propio y un final natural: quien llegó hasta ahí **ya recorrió la oferta de su ciudad**, que es justo el momento en que una inmobiliaria entiende para qué sirve la plataforma. A favor: no compite con nada, no toca el presupuesto de 56 px del encabezado y se ve solo cuando el visitante terminó de mirar. En contra: lo ve solo quien scrollea hasta el final, y hay que decidir si es un bloque de esa lista o el primer pie de página de la app pública.

  **Se entrelaza con la pantalla intermedia descartada en C3:** si esa pantalla llega a existir, el pie de la lista es su puerta natural en celular, y conviene diseñar las dos juntas en vez de meter dos veces el mismo bloque.

### BLOQUE D — Ajustes de producto salidos de las reuniones con el rubro (ago 2026)

- [x] **D1 · Sugerir la ubicación del pin desde la dirección — HECHA (31 ago 2026).** La decisión "pin manual, NO geocoding" **no se derogó: se refinó** — la sugerencia es el punto de partida, el pin manual sigue siendo la fuente de verdad y la coordenada que se guarda es la que el agente **confirmó**. **Lo que quedó:** módulo `src/lib/geocoding/` (contrato genérico + proveedor Nominatim aislado + orquestador con timeout de 5 s, límite de 1 consulta/1100 ms, caché de 24 h y descarte a más de 25 km del centro), ruta `POST /api/geocode` con **gate de sesión propio** (el proxy no cubre `/api`) y la ciudad derivada del servidor, botón `AddressSearchButton` en el formulario y `location_source` en `properties` (solo para medir). **La trampa anotada acá se resolvió como estaba previsto, y era más grande de lo que decía:** la regla vieja ("el pin se movió alguna vez") no solo se satisfacía sola con el geocoder — **ya estaba rota sin él**, porque era irreversible y se podía arrastrar el pin y después tocar "Centrar", publicando la propiedad en el centro exacto de la ciudad. La regla nueva es "la ubicación **actual** está confirmada" (arrastrar confirma, "Centrar" desconfirma, la sugerencia desconfirma), y para poder aplicarla `LocationPicker` pasó a ser un componente **controlado**. ⚠ **Y el barrio NO participa de la búsqueda**: se intentó dos veces, y la medición contra el servicio real lo desmintió las dos (ver `CLAUDE.md` → "EL BARRIO NO PARTICIPA DE LA BÚSQUEDA"). Los porqués completos están en `CLAUDE.md` → "Ubicación de la propiedad".

- [x] **D2 · Mostrar la agencia en el modal — HECHA (7 sep 2026).** Se hizo como el ítem se inclinaba: **NO se engordó `useProperties`** (la query caliente quedó intacta) sino que el dato se **embebe en la consulta que el modal ya hace** (`agency:agencies(name, logo_url)`). Se descartó una consulta aparte: necesitaría el `agency_id` que sale de la primera, así que sería **secuencial** y el bloque aparecería después de que el resto ya está pintado, además de estrenar un camino de red que puede fallar solo.

  **Muestra TRES cosas, no dos: el logo, el nombre de la agencia y el nombre del agente que atiende** ("Atiende Juan Pérez"). **Sin foto del agente**, aunque la consulta ya la traía.

  ⚠ **Un hallazgo que corrigió la premisa del ítem: el modal NO mostraba al agente por ningún lado.** El ítem daba por sentado que el bloque iría "junto al agente que va a atender", y midiendo resultó que la consulta traía `full_name` y `avatar_url` **y no renderizaba ninguno de los dos**: lo único que hacía con el agente era leerle el teléfono para armar la URL de WhatsApp. Así que la pieza terminó agregando **dos** identidades, no una.

  ⚠ **Y el caso "sin logo" es el NORMAL, no el borde: medido, 1 de 3 agencias tiene logo cargado** (re-medido el 13 sep 2026; era 1 de 10 antes de la limpieza y 1 de 4 el 12 sep — la proporción se mantiene). Por eso el nombre **ocupa el lugar del logo** cuando falta, sin hueco ni caja vacía ni cartel de "sin logo". Un diseño que solo se viera bien con logo se vería mal el 90 % de las veces.

  **Lo que el ítem decía y NO se cumplió: "en el white-label NO va".** Se decidió mostrarlo también ahí. Motivo: cuando alguien **comparte el enlace de una propiedad**, el destinatario abre el modal directo y el encabezado de la agencia puede quedar fuera de vista; y la propiedad se ve igual sin importar por dónde se entró. La consecuencia práctica es que **no hizo falta construir ningún canal** para que el modal supiera en qué contexto se renderiza — que era el trabajo más caro de la pieza y se evitó entero.

  **El nombre de la agencia NO es enlace**: solo algunos planes tienen sitio propio y ese sitio se deshabilita por tres motivos, así que a veces llevaría a "no disponible". Un nombre que a veces lleva a algún lado y a veces no es una inconsistencia visible.

  **Cabo que ató:** el ítem decía *"cuando llegue C2, la página por propiedad hereda esto resuelto"*. Se cumplió: la página muestra el mismo bloque con las mismas reglas, una talla más grande.

- [ ] **D3 · Filtros mobile: fila fija + panel (híbrido).** La intención es correcta (un desplegable es fricción; en mobile no se abre lo que no se ve), pero poner *todos* los filtros fijos se come media pantalla de mapa, que es lo que el visitante vino a ver — sería cambiar una fricción por otra peor. **Forma propuesta:** una tira fina fija arriba con los 2-3 filtros del 80% de los casos (operación venta/alquiler + tipo de propiedad) como chips tocables, y el resto (precio, ambientes, amenities) en la **hoja que sube desde abajo** (que es lo que hay hoy, no un desplegable) con su contador de filtros activos. ⚠ Esa hoja se rehízo el 15 sep 2026 —cierra con ✕, velo, Escape y arrastre desde la franja— así que **D3 parte de una base que ya funciona**: lo que agrega es la tira fija, no el panel. ⚠ **Ojo al diseñarlo: desde B3 el filtro de operación es de selección MÚLTIPLE** (marcar Venta y Alquiler muestra las que tengan cualquiera de las dos), así que los chips tienen que comportarse como interruptores independientes y no como una tira de opciones excluyentes. Prioridad media, tanda corta, no bloquea nada.

---


> Multi-agente es el marco que da sentido a varias de estas. Sub-pieza 1 (crear
> agentes + listar equipo) YA está hecha. Las que siguen son sus continuaciones.

- [ ] **Multi-agente · sub-pieza 4 — Desactivar agente (soft delete, reversible). SIGUE ABIERTA: NO se hizo en la tanda del 7 sep 2026**, que tocó el borrado real (el destino de las consultas), no la desactivación. Alternativa al borrado: marcar `agents.is_active = false` (la columna ya existe) en vez de eliminar. Un agente desactivado no puede loguearse, no aparece como activo, no recibe leads ni se le asignan propiedades — pero su historial queda intacto y es reversible. Es la pieza MÁS invasiva (hay que filtrar `is_active` en varios lados: login/proxy, lista de equipo, selector de reasignación, etc.), por eso se dejó después del borrado real (que ya está). Decidir qué pasa con sus propiedades al desactivar (¿quedan a su nombre ocultas, o se reasignan como en el borrado?). ⚠ **Y qué pasa con sus consultas, que en el borrado ya está decidido** (se desvinculan y conservan el nombre): en una desactivación **reversible** eso probablemente NO corresponda —el agente sigue existiendo y puede volver—, así que lo natural es que sus consultas queden a su nombre, tal cual. Conviene decidirlo explícitamente en vez de heredarlo del borrado, que es un caso distinto.

- [ ] **White-label** (planes profesional+) — URL por agencia (`marka.com.ar/[slug]`) con el mapa filtrado a esa agencia. Partido en sub-piezas; A ya está hecha:
  - [x] **Sub-pieza A — Ruta pública + resolución por slug + mapa filtrado + gate de plan.** `/[slug]` en el root (exclusivo de agencias; las ciudades salen del root). `resolveAgencyBySlug` (service role, 3 estados: `not_found`→404 / `disabled`→página "sitio no disponible" / `active`→mapa). `AgencyMapView` (mirror de la home sin CityPicker) + `AgencyUnavailable`. `agencyId` opcional en `useProperties`/`MapView`/`PropertyList`. SIN personalización todavía. Probado (3 caminos + filtrado con contraste de 2 agencias en la misma ciudad). Ver CLAUDE.md "White-label por agencia".
  - [x] **Sub-pieza B1 — Subir el logo en Preferencias.** `AgencyLogoForm` (admin-only) sube el logo **client-side** (como el avatar) a `logos/{agency_id}/logo.{ext}` con `upsert`; la URL se persiste con `updateAgencyLogoAction` (gate admin + service role + `.eq("id", caller.agency_id)`). Enfoque híbrido decidido: lo sensible es la escritura en `agencies`, no el archivo (bucket público) → no hace falta upload por server action/FormData. Validación real (PNG/JPG/WEBP, no SVG, máx 2 MB), extensión del MIME, cache-buster en preview. El logo NO se muestra en el white-label todavía (es B2). Probado: subir, persistir tras reload, reemplazar, validaciones. Ver CLAUDE.md "White-label · B1".
  - [x] **Sub-pieza B2a — Logo + nombre en el header.** `AgencyMapView` muestra el logo de la agencia (izquierda, `object-contain` altura fija, tolera cualquier proporción) + nombre (centro, visible en mobile). Sin logo → nombre a la izquierda, centro vacío, nunca Wordmark de Marka. "Powered by Marka." discreto centrado al pie (`size="xs"` nuevo del Wordmark, aditivo). `resolveAgencyBySlug` ahora trae `logo_url` en `active`. Probado en reunión real con el rubro. Ver CLAUDE.md "Sub-pieza B2a".
  - [x] **~~EN PAUSA~~ — Sub-pieza B2b — HECHA (12 sep 2026).** El sitio apagado le habla a su administrador. **Los tres requisitos que este ítem preveía se cumplieron tal cual**: se ensanchó `disabled` para que devuelva `id`+`name` (era `{ status: "disabled" }` pelado), se le metió resolución de sesión a la ruta SIN guard de redirect, y la comparación es `agent.agency_id === id de la agencia` **más `role === "admin"`** (un agente común no gestiona la suscripción y ve el cartel genérico).

    **Lo que el ítem NO preveía y resultó ser el trabajo real: son SEIS motivos, no uno.** El ítem hablaba de "invitación a reactivar", o sea del caso de la suscripción. `resolveAgencyBySlug` distingue `rejected` · `subscription_inactive` · `no_white_label` · `not_approved` · `plan_not_active` · `unavailable`, y **los tres primeros los resuelve la agencia sola** (botón a la pantalla que corresponde) mientras **los dos siguientes dependen del dueño** y a propósito **no llevan botón**: uno que no destraba nada la manda a dar una vuelta.

    **⚠ El costo para el visitante anónimo es CERO, y ése fue el diseño.** `resolveAgentSessionIfPresent()` descarta leyendo las cookies del request —sin red y sin base— y la llamada vive **dentro de la rama `disabled`**, así que la pantalla que ven los clientes que pagan no se tocó. Es un descarte, no una autorización: una cookie falsa no cuela nada (verificado).

    **⚠ Y la trampa que apareció midiendo:** una agencia en el plan de aterrizaje tiene `has_white_label = false` **y** `plan = 'free'` a la vez, y el gate la corta por el flag. Si el motivo se leyera del gate que cortó, se le diría *"tu plan no incluye sitio de marca"* a una agencia que ya pagó el premium y espera la activación — el caso más frecuente de todos. Ver CLAUDE.md → "El sitio apagado le habla a su dueño".
  - [x] **~~EN PAUSA~~ — Sub-pieza C — HECHA (12 sep 2026).** La dirección del sitio se edita en Preferencias: admin-only, validación en el server, y el aviso de que los enlaces viejos mueren. Salió como estaba anotada.

    **⚠ Pero antes hubo que cerrar un agujero que YA EXISTÍA y este ítem no mencionaba: no había NINGUNA lista de direcciones reservadas.** `/[slug]` es una ruta dinámica de primer nivel: sin lista, una agencia podía tomar `admin`, `precios` o `ciudad`. No es un agujero de seguridad —la ruta estática siempre le gana— sino algo peor de explicar: **su propio sitio quedaría inalcanzable y en silencio**, pagando el plan por una dirección que devuelve el login del dueño. Se escribieron **135 reservadas en tres grupos** (`lib/utils/reservedSlugs.ts`), y la generación automática del registro **también las salta** —con el mismo mecanismo de sufijo `-2`/`-3` que ya usaba para las colisiones, así que una razón social como "Agencia" no frena el alta: le toca `agencia-2`—.

    **Lo descartado, con su motivo** (ver el bloque de decisiones abajo): historial de direcciones para redirigir las viejas, límite de cambios, y bloquear el cambio para una agencia que no está al día.

    ⚠ **Efecto de borde que el ítem no preveía y que quedó anotado**: la dirección vieja liberada da **404**, incluso para el admin que la tenga en un marcador. Ver CLAUDE.md → "La dirección del sitio de marca".
  - Nota de namespace: si a futuro se quiere URL de ciudad (SEO/compartir), va con **prefijo** (`/ciudad/[slug]`), nunca en el root — el root es de las agencias. La extensión de `generateUniqueAgencySlug` para chequear también `cities` se descartó: al salir las ciudades del root, no hay colisión posible.

---

## Pulido visual — grupo CERRADO (15 sep 2026, seis tandas)

> **El disparador fue el dueño probando la aplicación antes de mostrársela a inmobiliarias**, o sea el
> primer recorrido completo con ojos de cliente. Dos relevamientos de solo lectura y cuatro tandas de
> implementación. **Hilo común: la app funcionaba y no se veía terminada** — y en un caso, lo que
> parecía estética estaba rompiendo los datos.

### Las cuatro piezas

1. **Las hojas que suben desde abajo.** El contenido se desbordaba **exactamente 20 px** por debajo del
   borde de la pantalla —dejando **4 px del botón "Consultar por WhatsApp" fuera**—, los botones
   flotantes tapaban el final y eran tocables **sobre el velo**, la franja gris prometía un gesto de
   arrastre que no existía en la hoja de filtros, y ninguna cerraba con Escape. Causa única del
   desborde: **un contenedor `h-full` con un hermano arriba**, en tres archivos. Ver `CLAUDE.md` →
   "Las hojas que suben desde abajo".
2. **Los campos de formulario y el teléfono.** El texto quedaba pegado al borde en perfil, preferencias
   y equipo **por una causa que no era la obvia**: `tailwind-merge` eliminaba las clases del subrayado
   al recibir un color de borde de cuatro lados, produciendo **una caja que no estaba escrita en ningún
   archivo**. Se resolvió con una definición única (`src/components/forms/fieldStyles.ts`). En la misma
   tanda, el teléfono pasó a tener **prefijo argentino fijo y visible**, con normalización de todas las
   formas en que se dicta un celular y la regla de **no corregir nunca un número guardado**.
3. **Cuatro defectos de forma que rompían algo.** Casillas con borde **invisible** (≈1,00:1), las tres
   opciones de operación con estructura distinta según el estado, el botón de menú **tapando el título**
   de todas las páginas del panel en celular, y los filtros de administración desordenados.
4. **La unificación de formas.** Los radios pasaron a valores fijos (4/6/8, que era lo que `DESIGN.md`
   decía y el código nunca cumplió), el botón dejó de ser recto y de ir en mayúsculas y llegó al mínimo
   táctil de 44 px, los diálogos, menús y desplegables entraron en la regla, y se definió una **escala
   de tres alturas**. Más un título **"Precio"** en el bloque de precios de las dos pantallas públicas.

### ⚠ La lección, y no es sobre estética

**Las casillas invisibles producían DATOS MAL CARGADOS.** Una inmobiliaria carga una casa que también
alquila, no ve que la opción se puede marcar, y la publica **solo en venta**: la propiedad queda fuera
de los filtros de alquiler y **la consulta que nunca llega no aparece en ningún lado**. No hay error, no
hay registro, y después **no hay forma de distinguirla** de una que efectivamente solo se vende.

**Lo que se reportó como un problema visual estaba rompiendo el negocio.** Quedó escrito como patrón en
`CLAUDE.md` → "Método de Diagnóstico": *cuando un defecto visual está sobre un **control**, la pregunta
no es si se ve mal sino qué dato produce y qué pasa si no se usa*. Por eso en la lista de arriba las
casillas están en **P1**, junto a lo funcional, **aunque el arreglo fuera una clase de color**: el costo
de arreglar algo no dice nada sobre su prioridad.

### Lo que se DESCARTÓ, con su motivo

| Se descartó | Por qué |
|---|---|
| **Cambiar el alto de las hojas** para que el contenido entrara | El desborde no era falta de espacio sino un contenedor que no podía achicarse. Cambiar el alto habría tapado el síntoma y dejado la causa en los otros dos archivos |
| **Subir el z-index de la hoja** por encima de los botones flotantes | Los dejaría debajo pero **igual visibles y tocables** sobre el velo. Ocultarlos es además lo que libera el último renglón del contenido |
| **Extraer una hoja compartida** entre filtros y detalle | Las dos difieren en algo que no es cosmético: **desde dónde se puede arrastrar**. Extraerlas tal cual trasplanta el defecto del detalle; corregirlo al extraer **le saca un gesto a quien ya lo usa**. Es una pieza propia, con su decisión de producto |
| **Usar una biblioteca de diálogos** para las hojas | Daría Escape, foco y portal —cierra cuatro ítems de accesibilidad— pero **no da el gesto**, que era el problema reportado, y cambia el comportamiento de dos pantallas públicas a la vez |
| **Un selector de país en el teléfono** | La plataforma es para inmobiliarias argentinas y el campo existe para armar un enlace de WhatsApp. Un selector agrega un paso a todos para un caso que no existe |
| **Corregir en silencio los números guardados sin el 9** | Editar el nombre de un perfil no puede cambiarle el teléfono a alguien sin que lo pida. Se muestran tal cual, con un aviso de revisión |
| **Una variante del componente `Input` para el campo con caja** | La misma caja tiene que vestir **contenedores que no son un input** (los campos con prefijo). Por eso son constantes |
| **Derivar los radios de `--radius`** con multiplicadores, como estaban | Es lo que produjo un desvío de 2 px **en toda la app a la vez**, sin ningún síntoma. Ahora son tres valores fijos |
| **Bajar los ítems de menú a minúsculas** junto con los botones | Rótulo corto en mayúsculas, frase en minúsculas: son dos casos distintos de la misma regla. Ver `CLAUDE.md` |
| **Tocar las etiquetas de formulario** | Vienen del preset y son rótulos, así que entran en la regla de arriba. Lo que no coincide con `DESIGN.md` es el tamaño; quedó anotado (ítem 18) |

### Lo que se MIDIÓ al cerrar

- **Radios, en el CSS compilado, antes → después:** `rounded-sm` 6 → **4**, `rounded-md` 8 → **6**,
  `rounded-lg` 10 → **8**, `rounded-t-xl` **14 sin cambios** (la excepción de las hojas).
- **Botón del alta:** de 40 px, radio 0, 12 px en MAYÚSCULAS → **44 px, radio 6, 14 px en minúsculas**.
- **Área de toque:** "Ver ficha completa" **dibuja 28 px y toca 44**.
- **Desborde de las hojas:** 20 px → **0** en las dos, con el botón de contacto entero.
- **Contraste del borde de las casillas:** ≈**1,00:1** → **4,31–5,07:1** (WCAG 1.4.11 pide 3:1).
- **Cuerpo scrolleable** tras el arreglo: filtros **489,94** px (sin filtros) y **414,94** (con), detalle
  **177,44** px. ⚠ El área **bajó** 20 px y es lo correcto: antes esos píxeles estaban fuera de pantalla.
- **Baseline sin moverse en las seis tandas:** 0 errores de TS, 0 de lint con el warning conocido,
  build verde, 22 rutas.

### Lo que quedó ABIERTO

**Las 42 inconsistencias de la sección de arriba**, encabezadas por la de seguridad — que **no es de este
grupo**: apareció midiendo la base durante el relevamiento de los campos y se dejó aparte a propósito,
porque es una tanda propia. De las demás, tres las **introdujo** este grupo y están marcadas como tales
(el foco que no vuelve al cerrar la hoja, la indentación de los filtros de admin, y los dos tamaños de
botón que quedaron redundantes).

## Sitio de marca — grupo CERRADO (12–13 sep 2026, cuatro tandas)

> Cerró las dos sub-piezas de white-label que llevaban meses en pausa (B2b y C) **más** la deuda
> "Edición del nombre de la agencia", que estaba anotada desde el trabajo de matrícula. Los detalles
> de cada una están en sus ítems, arriba. Acá va lo que no vive en ninguno: **lo que se descartó, lo
> que quedó medido y lo que quedó abierto.**

### Lo que se DESCARTÓ, con su motivo

- **Guardar un historial de direcciones para redirigir las viejas.** Mantener andando una dirección
  anterior implicaría **una tabla de direcciones pasadas y una consulta más en CADA visita al sitio
  de marca** — infraestructura permanente para un caso raro. La dirección vieja pasa a dar 404, y
  por eso **el aviso previo no es letra chica: es la pieza**. Muestra las dos direcciones completas
  y enumera dónde quedaron enlaces (WhatsApp, redes, firma de mail, carteles, folletos).
  ⚠ **Y el daño es 100 % externo**, que es lo que vuelve al aviso suficiente: adentro de la app
  `agencies.slug` lo consume un solo lugar funcional (la ruta `/[slug]`) más un `select` de `/admin`
  que ni lo renderiza — no está en el mapa del sitio, no hay ningún `agencyUrl()` en una metadata, y
  no hay un solo `<Link>` a un sitio de marca.
- **Poner un límite a cuántas veces se puede cambiar la dirección.** Poner un número sería adivinar,
  y son clientes que pagan. Sin límite.
- **Un formulario aparte para el nombre.** El campo entró en el formulario de identidad que ya
  existe, como primer campo (es el dato de identidad principal). Construir una pantalla entera para
  un campo no se justifica.
- **Bloquear el cambio de dirección para una agencia que no está al día.** No son el mismo caso que
  el nombre: **cambiar el nombre le genera trabajo de aprobación al dueño de la plataforma; cambiar
  la dirección no le genera nada a nadie** y la agencia lo resuelve sola. Aplicarle la guarda sería
  costo para el cliente y cero beneficio. Por el mismo criterio tampoco se bloquea el logo ni el
  teléfono, que viven en otras dos actions que nunca tuvieron esa guarda (medido: cero menciones a
  `canceled`/`past_due` en las tres).

### Lo que se MIDIÓ al cerrar

- **⚠ Direcciones existentes que la lista reservada dejaría inválidas: CERO.** Medido contra la base
  ejecutando el código real (`isReservedSlug` + `validateAgencySlug`) sobre las **3 agencias** que
  hay: ninguna toma una reservada, las tres pasan la forma y el largo (16, 17 y 19 caracteres, tope
  40). **No hay ninguna agencia que quedara con una dirección que hoy sería inválida**, así que la
  lista no obliga a migrar nada.
- **Las 135 reservadas se reparten 7 + 21 + 107** (rutas de hoy / archivos de raíz / futuras).
- **⚠ Hay DOS agencias con el mismo nombre** ("Inmobiliaria Gaio 2"), medido. Confirma en datos
  reales lo que dice la base: **`agencies.name` no tiene unicidad** (el único `UNIQUE` de la tabla
  es el del `slug`), y por eso la validación del nombre **no la inventa**. Quien decida que el
  nombre debe ser único, que lo decida en la base primero: sin índice, dos pedidos simultáneos
  entrarían igual.

### Lo que el código declara ACEPTADO A CONCIENCIA en estas tandas

- [ ] **Una agencia dada de baja Y sin aprobar puede corregir su matrícula, y eso la reenvía a la
  cola.** Está escrito en `preferencias/actions.ts` como *"CONSECUENCIA ASUMIDA … Es un hueco chico
  y deliberado"*. La guarda de suscripción se acotó a **"cambió el nombre"**, así que el reenvío que
  dispara una corrección de matrícula no la alcanza. **El caso exige las dos condiciones juntas** y
  es raro. Cerrarlo sería extender la guarda a "cambió el nombre **o** la matrícula": una línea, si
  alguna vez molesta.
- [ ] **La dirección vieja liberada da 404, incluso para el admin que la tenga en un marcador.**
  Aceptado: no se puede saber que esa dirección fue suya (no hay historial, por la decisión de
  arriba), así que cualquier mensaje sería una conjetura; y el admin **ya fue advertido** al
  cambiarla, con las dos direcciones a la vista. ⚠ Lo que sí conviene recordar es que **el proyecto
  no tiene pantalla propia de 404** (ítem aparte, más abajo), así que lo que ve es el del framework:
  esta pieza **aumenta la frecuencia** con que se llega ahí.
- [ ] **Al resolver una revisión, `previous_name` se limpia y el nombre anterior se pierde.** Es el
  comportamiento pedido (las dos columnas se limpian juntas, siempre). El costo: si la agencia
  quiere volver a su nombre viejo tiene que acordárselo, y el dueño tampoco lo encuentra después —
  `agency_reviews` guarda `decision`, `note`, `reviewed_by` y `created_at`, **ningún nombre**.
  **Mitigación en su lugar**: el panel muestra "Ahora → Antes" mientras la revisión está abierta, o
  sea justo cuando el dueño escribe la nota del rechazo, así que puede incluirlo si quiere.

### Lo que quedó ABIERTO, revisando de punta a punta

> Recorrido con la regla nueva (CLAUDE.md → "Método de Diagnóstico"): desde que la agencia lo pide
> hasta que el dueño lo resuelve. **Los quince tramos del cambio de nombre están construidos y
> tienen punta.** Lo que sigue es lo que apareció al mirarlo entero.

- [ ] **⚠ Rechazar un cambio de nombre RECHAZA LA AGENCIA ENTERA, y no hay forma de evitarlo hoy.**
  `approval_status` es un estado **de la agencia**, no del nombre. Así que la vuelta a `'pending'`
  que dispara un pedido de cambio de nombre apaga **cuatro cosas a la vez** —las propiedades en el
  mapa, sus fotos, el registro de consultas y el sitio de marca— porque
  `agency_is_publicly_visible()` exige `approved` y la invocan las tres policies públicas más
  `resolveAgencyBySlug`. **Una inmobiliaria con su cartera publicada queda invisible mientras espera
  que se le revise un nombre**, sin vencimiento y sin reversión automática.
  **Está mitigado, no resuelto:** el aviso previo lo advierte con las cuatro consecuencias
  enumeradas y el *"no perdés nada"*, y "Rechazar el nombre" la devuelve a `approved` en un
  movimiento. **Resolverlo de raíz pide un eje separado** —que el nombre tenga su propio estado de
  aprobación y no toque `approval_status`—, o sea otro cambio de base. Decisión de producto, no de
  código.
- [ ] **La guarda `ever_approved` de "Rechazar el nombre" se apoya en un historial con huecos.**
  Existe para impedir que un botón que dice *"rechazar"* **apruebe** a una agencia que nunca lo
  estuvo (la acción escribe `approved`: sobre una que nunca lo fue no revierte, **otorga**). Se
  verifica contra `agency_reviews`, que tiene huecos conocidos —`reopenAgencyAction` no registra, el
  reenvío del cliente tampoco, y `logDecision` es best-effort—. **Falla cerrada**: ante un hueco la
  acción no se ofrece y el dueño usa el rechazo de siempre. Las 3 agencias de hoy tienen su
  `approved` registrado (medido), así que no molesta a ninguna.
- [ ] **Las dos advertencias de Preferencias no se pueden confirmar juntas.** Si la agencia cambia
  el nombre **y** la dirección, ve las dos —una en cada tarjeta, con tonos e íconos distintos
  (`info` 🕐 para la revisión, `warning` ⚠ para los enlaces rotos)— pero son **dos formularios con
  dos submits y dos actions**, así que son dos confirmaciones. Unificarlas sería fusionar
  `AgencyIdentityForm` y `AgencySlugForm` en un formulario de "datos de la agencia", decidiendo
  antes qué pasa si una escritura falla y la otra no. **No es un bug**: es una pieza propia si
  alguna vez se quiere.

## Panel admin de ida y vuelta — CERRADO (31 ago – 1 sep 2026)

> **El problema de fondo era: el panel `/admin` es de una sola vía.** Se activaba un plan y no había ninguna UI para deshacerlo. **Ya no.** Las cuatro piezas se hicieron en una sola tanda, más una quinta que no estaba anotada (cambiar de plan). Los porqués completos están en `CLAUDE.md` → "Panel de plataforma".

- [x] **~~Cancelar una solicitud de upgrade pendiente~~ — HECHO.** `cancelPendingPlanAction`: `pending_plan = null` + `status = 'active'`, sin tocar el plan que rige (nunca se pisó). Se hizo **del lado del panel, no del cliente**: la agencia no cancela su propio pedido. La nota del historial deja asentado QUÉ se canceló, porque después de limpiar la columna el plan pedido no se reconstruye desde ninguna parte.

- [x] **~~Establecer fecha de vencimiento del plan (`current_period_end`)~~ — HECHO.** Campo de fecha opcional en la activación, y otro en el cambio de plan. Validado en el server (forma `YYYY-MM-DD` + posterior a hoy) y guardado como el **fin del día en UTC**: "vence el 31 de diciembre" significa que el 31 todavía tiene plan. ⚠ **El vacío se comporta distinto en cada acción a propósito**: al activar **no toca** la columna (no hay fecha previa que pueda quedar vieja); al cambiar de plan **la borra** (la fecha previa pertenece al plan viejo). Por eso en el cambio el campo viene precargado. **Sigue sin tener efecto automático** — ver Deuda técnica.

- [x] **~~Eliminar agencias desde el panel~~ — HECHO.** `deleteAgencyAction`, solo para agencias **sin propiedades y sin consultas**. ⚠ **La regla la aplica el código y nada más**: las cinco FK que apuntan a `agencies` son CASCADE, ninguna RESTRICT (medido), así que un chequeo salteado se lleva todo en silencio; un count que no se pudo leer **no es un cero** y aborta. Borra también los **archivos de Storage** (logo + avatares, best-effort, primero porque sus paths se arman con los ids que están por desaparecer) y los **usuarios de Auth** (la FK va de `agents` hacia `auth.users`: borrar la agencia no los toca). Orden: Storage → Auth → fila de la agencia; si falla un usuario **se corta antes** de borrar la agencia, para que siga siendo encontrable. **No se registra en `agency_reviews`**: esa tabla cascadea con la agencia.

- [x] **~~Dar de baja~~ — HECHO (reversible).** `status: 'canceled'` + los tres `has_*` en `false`. **Conserva `plan`** (es el único registro de a qué reactivar) y **NO toca `property_limit`** —ponerlo en cero le mostraría "alcanzaste el límite de tu plan", que es falso y la mandaría a pagar un upgrade que no la destraba—. El efecto público sale gratis por la regla de visibilidad: las propiedades desaparecen del mapa y el sitio de marca se apaga **sin tocar una sola propiedad**. `restoreSubscriptionAction` repone los `has_*` **desde el catálogo `PLANS`**, no desde las columnas (que la baja puso en false): una agencia reactivada queda idéntica a una recién activada.

- [x] **~~Bajar de plan~~ — HECHO como "cambiar de plan" (1 sep 2026), y la decisión de producto que estaba abierta se contestó:** si las propiedades exceden el límite del plan destino, **el cambio se bloquea** y se explica con los números. **No se pausa nada automáticamente** — elegir qué propiedad sale del mapa es de la agencia, no un efecto colateral. Se aplica directo sobre `plan` (no pasa por `pending_plan`: el dueño no se manda solicitudes a sí mismo) y **no se le puede cambiar el plan a una agencia dada de baja** (se pisaría la memoria de a qué reactivarla). Valor nuevo `plan_changed` en el CHECK de `agency_reviews`. ⚠ **Lo que sigue sin existir, y debe seguir así, es el AUTOSERVICIO** — ver "Decisiones de producto abiertas".

---

## Cobro real (V2)

- [ ] **Fechas de vencimiento / ciclos de cobro** — avisos de vencimiento y desactivación automática. `current_period_end` **ya se escribe** desde el panel (activación y cambio de plan) y la agencia la ve, pero **nada la vigila**: es un recordatorio para el dueño. La activación y la desactivación siguen siendo 100% manuales. Ver la deuda "la fecha de vencimiento no tiene efecto automático".
- [ ] **Cobro automatizado** — integración MercadoPago/Stripe (reemplaza la activación manual).
- [ ] **Precios en ARS revisables vs anclados a USD** — decidir al activar cobro real.

---

## Deuda técnica

> Los cuatro primeros salieron de MEDIR durante el BLOQUE B (3 sep 2026). Ninguno lo
> introdujo ese trabajo: estaban, y recién se vieron al pasar por ahí.

- [ ] **⚠ El mejor argumento de venta del producto está OCULTO en pantallas chicas, y C3 acaba de subirle la importancia (medido el 10 sep 2026).** `AuthLayout.tsx:56` renderiza el `subclaim` con `className="mt-4 hidden … md:block"`: **por debajo de 768 px no se ve**. Los dos textos afectados son constantes de sus formularios — `RegisterForm.tsx:29-30`: *"Publicá tus propiedades donde los compradores de tu ciudad ya están buscando."*, y `LoginForm.tsx:17`: *"Entrá para gestionar tus propiedades y tus leads."*
  **Por qué importa más ahora:** el llamado nuevo del encabezado **manda tráfico a `/register`**, y en un teléfono ese prospecto llega a una pantalla que le muestra "Crear cuenta", "Sumá tu inmobiliaria en un par de pasos" y un formulario de siete campos, **sin el argumento**. Es el eslabón inmediatamente posterior a la puerta que se acaba de construir, y el celular es donde va a caer la mayoría del tráfico.
  ⚠ **Y hay un detalle de diagnóstico:** el `hidden md:block` es coherente con el diseño del panel de identidad, que en celular colapsa a una franja de `h-44` donde el claim ya ocupa casi todo el alto — **no es que alguien se olvidó de mostrarlo, es que ahí no entra**. Así que el arreglo no es sacarle el `hidden`: es decidir **dónde** va el argumento en celular (¿debajo del heading del formulario? ¿reemplazando al claim en la franja?). Chico, pero es una decisión de diseño, no un borrado de clase.

- [x] **~~`increment_views` existe en la base pero NO se la llama desde ningún lado~~ — CERRADO (14 sep 2026), en tres tandas.** Medido al cerrar: **17 visitas repartidas en 8 propiedades**. Los porqués completos están en `CLAUDE.md` → "Visitas y consultas por propiedad" y "Base de Datos" → la guarda de `updated_at`.

  **Lo que quedó:**
  1. **El listado del panel muestra visitas y consultas por propiedad**, en dos columnas separadas (en celular, "N visitas · M consultas") y **en todos los planes**. Las consultas vienen de **una sola consulta agregada** (`leads(count)` embebido) con service role, porque con el client normal **la RLS trunca el número en silencio** para un agente común (medido con la anon key: 200 y ceros en propiedades que tienen consultas). La barrera es el mismo alcance de la sesión que el listado.
  2. **La visita se cuenta desde tres lugares**, siempre **después de marcar la propiedad como vista y solo si era nueva**: el click en el pin (`ClusterLayer`), el toque en la tarjeta de la lista (`PropertyList`, que antes no marcaba nada) y la ficha pública (`PropertyViewTracker`). La deduplicación sale de `markVisited`, que **ahora devuelve si la propiedad era nueva**, leyendo `localStorage` de forma síncrona. Un fallo del incremento queda en la consola y no se ve.
  3. **La guarda de la fecha de modificación** en la base: `increment_views()` pone `marka.skip_updated_at` en `'on'`, local a la transacción, alrededor de su UPDATE, y `update_updated_at()` conserva la fecha en ese caso. **Verificada con visitas reales** después de aplicarla: "Casa Largo" pasó de 2 a 5 visitas sin mover su `updated_at`, y "Casa demo" de 0 a 2 conservando la del 3 sep.
  4. **El comentario falso del modal se corrigió** dos veces: primero para decir que la función existía (no "pendiente en el schema"), y después para decir dónde está la llamada y por qué no está ahí.

  **Lo que se DESCARTÓ:**

  | Se descartó | Por qué |
  |---|---|
  | **Contar desde el modal** | El pin marca la propiedad un instante **antes** de que el modal cargue, así que desde ahí `markVisited` devolvería siempre "ya estaba" y **los pines no contarían nunca**. Mover la marca al modal habría obligado a **sincronizar las instancias del hook**, o el tono "visitado" de los pines se perdería al recrear los markers hasta recargar |
  | **Contar al montar la ficha pública** | **El renderizador de un buscador ejecuta JavaScript** y arranca sin nada en `localStorage`, así que cada pasada sería una propiedad "nueva". Y el mapa del sitio le ofrece todas las fichas: pasaría seguido. Se cuenta con la primera interacción, que un robot no hace |
  | **Contar en el render del servidor** | Además de los buscadores, contaría a los robots de vista previa (WhatsApp, Facebook), que piden la ficha **cada vez que alguien comparte el enlace**: el caso central de esa página |
  | **Esconder el número crudo detrás del plan** (`has_metrics`) | Esconder cuánta gente vio una publicación es raro en un marketplace, y ver el número es lo que da ganas de entenderlo. Queda para premium el **análisis** (evolución, promedios, comparaciones), que todavía no existe. ⚠ Y medido: `has_metrics` **no gatea nada hoy** y **ninguna agencia lo tiene en `true`** |
  | **La primera versión de la guarda: comparar la fila vieja con la nueva** salvo `views_count` y `updated_at` (`to_jsonb(NEW) - … IS DISTINCT FROM to_jsonb(OLD) - …`) | **Falló siempre.** `properties.location` es una columna **generada**, y Postgres las calcula **después** de los triggers BEFORE: dentro del trigger, `NEW.location` todavía no tiene su valor y `OLD.location` sí, así que las filas nunca dan iguales. La verificación, hecha sobre filas **ya guardadas**, mostraba que solo diferían dos columnas: **las dos observaciones eran ciertas**. Documentación oficial de Postgres 17: *"the `NEW` row does not yet contain the new generated value and should not be accessed."* Ver `CLAUDE.md` → "Método de Diagnóstico" |

- [ ] **Un agente logueado mirando sus propias propiedades SUMA visitas, una vez por propiedad por navegador (anotado el 14 sep 2026).** Verificado en el código: `registerView` usa el client del navegador y **ninguno de los tres lugares que cuentan mira si hay sesión** (`ClusterLayer.tsx:137`, `PropertyList.tsx:140`, `PropertyViewTracker.tsx:68`). La deduplicación lo acota a una vez por propiedad en cada navegador, pero un agente que revisa su cartera desde el celular y la computadora suma dos. **Se decidió dejarlo por ahora**: excluirlo exige saber, **en cada visita**, si quien mira pertenece a la agencia de esa propiedad. Detectar que hay **una** sesión no alcanza —el encabezado público ya lo hace en el cliente (`PublicHeaderAuth`)—: habría que resolver la fila de `agents` y compararla contra el `agency_id` de cada propiedad abierta, y la ficha es un Server Component que existe para no depender de la sesión. **Revisar cuando haya tráfico real**, que es cuando la proporción importa.

- [ ] **`increment_views` NO tiene ninguna barrera: cualquiera con la clave pública puede llamarla las veces que quiera (anotado el 14 sep 2026).** Medido en la base: es `SECURITY DEFINER`, `anon` y `authenticated` tienen `EXECUTE`, y el cuerpo **no valida nada** —ni el estado de la propiedad, ni que su agencia esté al día, ni ninguna frecuencia—. Un `POST /rest/v1/rpc/increment_views` en bucle infla el contador de cualquier propiedad, incluidas las pausadas. **La deduplicación es del navegador y no protege contra eso**: solo evita el doble conteo honesto. El advisor de seguridad de Supabase la marca como *"Public Can Execute SECURITY DEFINER Function"*. Cerrarlo pediría validación en la función (activa + `agency_is_publicly_visible`) y algún límite de frecuencia, o sacarle `EXECUTE` a `anon` y contar desde el servidor. **No es urgente mientras la métrica no se use para cobrar ni para rankear.**

- [ ] **Lo que se marca desde la lista de celular NO repinta los pines del mapa hasta recargar (anotado el 14 sep 2026).** Verificado en el código: el mapa **no se desmonta** al pasar a la lista —queda oculto con CSS (`(public)/page.tsx:137` y `AgencyMapView.tsx:103`: `className={showMap ? "h-full" : "hidden md:block h-full"}`)—, y su `ClusterLayer` guarda **su propia copia** del estado del hook (`useState(() => readVisited())`, que se lee una sola vez al montar). `useVisitedProperties` **no tiene sincronización entre instancias** (a diferencia de `useFavorites`, que escucha un `CustomEvent` y `storage`). **El conteo es correcto**: la señal sale del almacenamiento, que es compartido. **Lo que queda viejo es el color** de esos pines. No es una regresión: antes la lista no marcaba nada. Se resolvería copiando la sincronización de `useFavorites`, que es justo lo que la decisión de contar donde se marca eligió no hacer todavía.

- [ ] **7 propiedades quedaron con un `updated_at` que no corresponde a ninguna edición (medido el 14 sep 2026).** Las movieron **12 visitas contadas antes de la guarda** (logs: `POST /rest/v1/rpc/increment_views` entre 16:17 y 16:26 UTC; la guarda se aplicó a las 16:32). Son: Casa Centenario, casa puente, Casa gaio, Casa Largo, casa lugones, Casa Autonomia y Campo, todas con fecha del 14 sep entre 16:18 y 16:26 UTC. El mapa del sitio les informa esa fecha a los buscadores como última modificación. **Se resuelve solo con la limpieza de datos de prueba que ya está pendiente** (ver el aviso de arriba de todo), y **no vale la pena recuperar nada**: los valores anteriores no están guardados en ningún lado, y son datos de prueba.

- [ ] **"Vistas totales" y "Leads este mes" están lado a lado en `/dashboard` con ventanas distintas (anotado el 14 sep 2026).** Medido en `dashboard/page.tsx`: las consultas se cuentan con `.gte("created_at", thirtyDaysAgo)` y la tarjeta dice *"Últimos 30 días"*; las visitas son la suma de `views_count`, **acumulada desde siempre y sin filtro de estado** (entran pausadas, vendidas y alquiladas). Puestas juntas invitan a una comparación que no es válida. En el **listado** de propiedades las dos son acumuladas, así que ahí sí se comparan bien. `views_count` no guarda fechas, así que una ventana de visitas exigiría otra tabla.

- [ ] **Dos documentos quedaron desfasados por el cierre, y esta tanda no podía tocarlos (anotado el 14 sep 2026).** (1) El comentario del archivo de migración sobre el primer intento de la guarda dice **"HIPÓTESIS NO VERIFICADA"**: ya está confirmada por la documentación de Postgres y por la guarda funcionando. Corregirlo la próxima vez que se toque ese archivo. ~~(2) `DESIGN.md` §7 ("PropertiesTable") no describe las columnas "Visitas" y "Consultas"~~ — **RESUELTO el 15 sep 2026**: §7 ya las describe, con la regla de que un conteo que no se pudo leer se muestra "—" y nunca 0.

- [ ] **Hay un event trigger `ensure_rls` en la base que no está documentado en ningún lado del repo.** Medido el 3 sep 2026: `ensure_rls` (evento `ddl_command_end`, función `public.rls_auto_enable()`, SECURITY DEFINER, `search_path = pg_catalog`) **habilita RLS automáticamente en toda tabla nueva** de los command tags `CREATE TABLE` / `CREATE TABLE AS` / `SELECT INTO`, restringido al esquema `public`. Falla en silencio (loguea y sigue) si no puede.
  **Consecuencia práctica, y es la que importa: una tabla nueva nace con RLS activada y SIN policies, o sea invisible para todos** —incluido el dueño desde el cliente normal— **hasta que se le escriban**. Quien cree una tabla y la vea vacía desde la app va a buscar el problema en la query, no en una policy que no existe.
  No es un bug ni hay que sacarlo: es una red de seguridad razonable (evita publicar una tabla sin querer). **Lo que falta es que esté escrito**, porque el próximo `CREATE TABLE` lo va a encontrar de golpe. Ya quedó anotado en `CLAUDE.md` → "Base de Datos"; este ítem es el recordatorio de tenerlo presente al diseñar la próxima tabla.

- [ ] **`amenities` no tiene barrera de dominio en NINGUNA capa.** Medido el 3 sep 2026, las tres: el zod del formulario es `z.array(z.string()).default([])` (acepta cualquier string), la server action escribe `amenities: data.amenities` **sin filtrar** (en el alta y en la edición), y la columna **no tiene ningún CHECK** (cero constraints la mencionan). O sea: **un cliente manipulado puede escribir cualquier valor y se renderiza en el modal público** como un chip más.
  **El daño real es acotado** (React escapa el texto al renderizar, así que no es inyección; lo que entra es basura visible), pero es exactamente el agujero que los requisitos de alquiler evitaron a propósito.
  **El molde para arreglarlo ya existe en el repo**, así que no hay que diseñar nada: copiar lo que hace `normalizeRentRequirements` en `propiedades/actions.ts` —filtrar el array recibido contra `Object.keys(AMENITY_LABELS)`, descartando en silencio lo que no pertenezca— y ajustar el zod a `z.enum`. La barrera que cuenta es la de la action; el zod es feedback.

- [ ] **El texto libre de los requisitos se guarda sin escapar, y hoy eso está bien.** Medido: `normalizeRentRequirementsOther` hace trim, recorta a 300 y descarta vacíos y duplicados, pero **no escapa ni rechaza** contenido — un `<script>alert(1)</script>` se guarda tal cual. **Hoy NO es un riesgo**: el único lugar que lo muestra es el `PropertyModal`, que lo renderiza como hijo de texto de un `<span>`, y React escapa eso por defecto (no hay `dangerouslySetInnerHTML` en ese camino). Escaparlo al guardar sería peor: rompería un apóstrofo o un signo `<` legítimo en un requisito real.
  **⚠ LA REVISIÓN QUE ESTE ÍTEM PEDÍA YA SE HIZO (8 sep 2026), Y NO ENCONTRÓ NADA — pero el ítem sigue abierto.** Decía "revisar cuando se haga C2, porque ahí aparecen caminos donde el escapado automático no aplica (Open Graph, `title`, atributos, serialización a HTML fuera de JSX)". Se revisó al construir la página: **los requisitos NO entran en ninguno de esos caminos**. Lo único que sale de JSX es la descripción corta de `openGraph`, y se arma con tipo, operaciones, precio, ubicación y métricas — todos datos controlados o numéricos, ninguno escrito por el agente. En la página los requisitos se renderizan como hijos de texto de un `<span>`, igual que en el modal.
  **Queda abierto porque la regla es la que importa, no la revisión:** *escapar en el punto de salida, no en el de entrada, y verificar cada punto de salida nuevo*. Los dos puntos de salida existentes están verificados; el próximo hay que verificarlo también.


- [x] **~~3 errores de lint preexistentes~~ (`ClusterLayer.tsx` x2 y `StatsCard.tsx`) — YA NO EXISTEN.** Medido el 27 ago 2026 contra el repo: `npm run lint` da **0 errores**. Se arreglaron en algún momento y el ítem quedó sin tachar, contradiciendo a `CLAUDE.md`. **Baseline real y vigente: 0 errores de TS, 0 errores de lint, 1 warning** (`react-hooks/incompatible-library` por el `watch()` de react-hook-form en `PropertyForm.tsx`), build verde. *Lección: los números de la documentación se relevan, no se asumen.* **Baseline vigente re-medido el 14 sep 2026 (sin cambios desde el 8 sep, incluido el cierre del contador de visitas, que no sumó rutas): `npx tsc --noEmit` 0 errores (exit 0) / `npm run lint` 0 errores y 1 warning (`PropertyForm.tsx:814`, exit 0) / `npx next build` verde (exit 0) con 22 rutas.** ⚠ **Re-medido el 15 sep 2026: idéntico, salvo el número de línea del warning, que pasó a `:814`.** ⚠ **Las rutas pasaron de 19 a 22 y es la ÚNICA vez que el número se movió** en todo el proyecto: las tres nuevas son `/propiedades/[slug]`, `/sitemap.xml` y `/robots.txt` — las dos últimas son **archivos de convención de Next**, que cuentan como ruta igual que `/apple-icon.png`. Los errores y el warning no se movieron nunca. ⚠ **El warning cambió de llamada, no de cantidad**: apuntaba a `watch("currency")` (línea 269) y hoy apunta a `watch("amenities")` (línea 814). La regla señala **la primera `watch()` del componente**, y al desaparecer el campo de moneda el señalamiento se corrió a la siguiente. Por eso los campos nuevos del BLOQUE B se hicieron con `Controller`: con `watch()` el warning se habría multiplicado. ⚠ **Y el grupo del sitio de marca (12–13 sep) lo confirmó dos veces más**: tanto la vista previa en vivo de la dirección como el aviso que aparece al tipear un nombre distinto **necesitan el valor del campo en vivo** —el caso típico de `watch()`— y los dos se hicieron con `Controller`. Con `watch()` cada uno habría sumado su propio warning y roto el baseline.

- [ ] **⚠ DOS pantallas más dependen del scroll del documento, que está bloqueado.** Abierto el 8 sep 2026, al corregir el mismo defecto en la página pública de la propiedad. `globals.css` fija `html, body { overflow: hidden }` a propósito (arregla el header del mapa en celulares), así que **una pantalla que se pase del viewport se vuelve inalcanzable** — no aparece una barra rota: simplemente no hay forma de llegar. Verificado en el código, las dos:

  | Pantalla | Línea | Wrapper |
  |---|---|---|
  | `src/components/agency/AgencyUnavailable.tsx` | `:10` | `flex min-h-dvh flex-col items-center justify-center bg-paper px-4 text-center` |
  | `src/app/(public)/page.tsx` (estado "Sin ciudades disponibles") | `:86` | `h-dvh bg-paper flex items-center justify-center px-4` |

  **Hoy el contenido de las dos entra sin scrollear, así que el defecto no se ve.** Pero depende de que el contenido sea corto y eso no lo está midiendo nadie: alcanza un teléfono chico en horizontal, o el tamaño de letra del navegador subido, para que el **único botón de la pantalla** quede fuera. En `AgencyUnavailable` ese botón ("Ir al mapa") es literalmente la única salida.
  ⚠ **La primera la propagué yo:** `PropertyUnavailable` se clonó de `AgencyUnavailable` y se trajo el defecto; se corrigió en el clon y **no en el original**, para no tocar código fuera del alcance de esa tanda.
  **El arreglo es de dos clases y está probado** en `PropertyUnavailable.tsx`: contenedor `h-dvh overflow-y-auto` + hijo `flex min-h-full …` (con `min-h-full`, **nunca `min-h-dvh`**, que volvería a delegar el scroll al documento). Ver `CLAUDE.md` → "Viewport mobile" → trampa 1. Barato; el momento natural es cuando se toque cualquiera de las dos.

- [ ] **El proyecto no tiene pantalla propia para "página inexistente".** Verificado el 8 sep 2026: no hay ningún `not-found.tsx` ni `error.tsx` en `src/app`, así que el 404 lo renderiza el del framework — **dentro de nuestro `<body>` con el scroll bloqueado**, y sin nada de la identidad de Marka (ni wordmark, ni salida al mapa, ni la voz del UI de DESIGN §10). Se nota más ahora que antes: la página pública de la propiedad **hace 404 de verdad** cuando el slug no existe (es uno de sus tres estados), o sea que ese 404 pasó de ser inalcanzable en la práctica a ser un desenlace normal de un enlace mal copiado. **El molde ya existe** (`AgencyUnavailable` / `PropertyUnavailable`: wordmark, `h1` serif, párrafo `graphite`, botón terracota "Ir al mapa"), así que es escribir un archivo, no diseñar una pantalla. ⚠ Y nace con la trampa del scroll: hay que darle su contenedor propio.

- [ ] **⚠ La tarjeta de propiedad tiene un elemento interactivo anidado dentro de otro.** `PropertyCard` es un `<article role="button" tabIndex={0} onClick={onSelect}>` (`:88`) y adentro tiene **dos** elementos interactivos: el botón de favorito (`:134`) y, desde el 8 sep 2026, el enlace del título (`:190`). Contenido interactivo dentro de un rol de botón **no es estrictamente válido**, y un lector de pantalla anuncia la tarjeta como un botón que contiene cosas que no debería.
  **Ya era así antes de esta tanda** —el botón de favorito está en la misma situación desde que existe la card—, así que el enlace del título no introdujo el problema: lo hizo más visible.
  **Las dos acciones sí conviven correctamente en la práctica**, con puntero y con teclado (`stopPropagation` en el `onClick` del hijo + la guarda `e.target !== e.currentTarget` en el `onKeyDown` del contenedor; ver `CLAUDE.md` → trampa 3). **Lo que queda es la semántica.**
  **No es un arreglo de una línea: es una decisión de diseño.** La salida limpia sería que la tarjeta deje de ser un `role="button"` y pase a ser un contenedor con un **enlace principal** (el título) más acciones sueltas — pero el click de la tarjeta abre un **modal**, no navega, así que "botón" describe bien lo que hace. **Anotado para cuando se revise ese componente**, no para hacerlo suelto.

- [ ] **El identificador legible de la propiedad ahora es una dirección pública permanente, y se genera con un sufijo aleatorio SIN reintento ante colisión.** Verificado el 8 sep 2026 — `generateSlug` es literalmente esto, y no hay ningún `while`, `retry` ni `catch` en el archivo:

  ```ts
  export function generateSlug(title: string): string {
    const suffix = Math.random().toString(36).slice(2, 8); // 6 chars [a-z0-9]
    return `${slugifyBase(title)}-${suffix}`;
  }
  ```

  La unicidad la garantiza la base (`properties_slug_key`, UNIQUE **común**, no parcial), así que una colisión **no ensucia datos**: hace fallar el alta con un `23505`. **El problema es que ese error no está traducido**: `translatePropertyWriteError` distingue los tres triggers de publicación por el texto del mensaje, y un choque de slug cae al mensaje genérico — el agente vería "no se pudo guardar" sin saber que alcanza con reintentar.
  **La probabilidad real es despreciable y conviene tenerla escrita para no sobre-reaccionar:** el sufijo son 6 caracteres de un alfabeto de 36, o sea **≈ 2.176 millones de combinaciones POR TÍTULO BASE** — y el choque solo puede ocurrir entre propiedades con el **mismo título ya normalizado**. Con 18 propiedades (13 sep 2026) es inalcanzable; incluso con cien agencias cargando "Casa 3 ambientes" el riesgo por alta sigue siendo del orden de una en decenas de millones.
  **Por qué se anota igual:** antes el slug era un detalle interno; ahora es la dirección que una inmobiliaria le pasa a un cliente y que Google indexa. **Lo barato es traducir el error** (una rama más en el helper, "probá guardar de nuevo"), no reintentar el alta. `slugifyBase` además puede producir cadena vacía si el título es solo símbolos, y ahí el slug queda como `-xxxxxx`: feo pero válido y único.

- [ ] **`/register/plan` no está en `PROTECTED_PREFIXES` del proxy** — un usuario sin sesión que pida esa URL no rebota en el middleware sino en la propia página (`if (!user) redirect("/login")`, que ya estaba). Funciona, pero es una asimetría con el resto del área privada. No se cambió porque tocar `PROTECTED_PREFIXES` afecta a `/register` entero (que debe seguir siendo público). Cosmético; revisar cuando A2 rediseñe el flujo de entrada.

- [x] **~~`subscriptions.current_period_end` es código muerto de facto~~ — RESUELTO (1 sep 2026).** Ya tiene productor: el panel la escribe al activar un plan y al cambiarlo. Medido: 1 de las 3 filas tiene fecha cargada (re-medido el 14 sep 2026; eran 9 filas antes de la limpieza de datos). **Lo que queda es otra cosa** (ver el ítem siguiente).

- [ ] **La fecha de vencimiento NO tiene ningún efecto automático.** Nada vigila que pase: no hay proceso que compare `current_period_end` contra la fecha de hoy, ni aviso previo, ni cambio de estado al vencer. Es un **recordatorio para el dueño** (y un dato que la agencia ve en su panel), nada más. Verificado por búsqueda: los únicos consumidores de la columna la **muestran** o la **escriben**, ninguno la compara contra `now()`. Cuando llegue el cobro real esto se convierte en el ciclo de facturación.

- [ ] **El estado `past_due` ("Vencida") no lo escribe nadie todavía.** Está en el CHECK de la columna, tiene etiqueta en `labels.ts`, badge en el panel, bloquea la publicación (trigger + `getPublishBlock`) y apaga la visibilidad pública — o sea que **todo el camino está listo**, pero **solo se llega a ese estado por SQL a mano**. Ninguna acción del panel lo escribe: la baja escribe `canceled`. Se resuelve solo cuando exista el vencimiento automático o el cobro real; hasta entonces, si alguien quiere probarlo, es un `UPDATE` manual.

- [ ] **Reactivar una propiedad pausada saltea el gate de suscripción.** `trg_check_agency_subscription` es **solo BEFORE INSERT** (igual que el de aprobación), así que pasar una propiedad de `paused` a `active` no lo dispara: una agencia dada de baja puede reactivar una propiedad vieja. **El daño es acotado** —la propiedad igual no se ve, porque la visibilidad pública la corta por policy— pero es una **asimetría real** entre lo que la base impide crear y lo que permite reactivar. ⚠ **Ampliarlo a UPDATE contradice lo que se decidió a propósito** ("editar una propiedad ya cargada sigue permitido aunque la agencia se dé de baja después: no se le quitan a nadie las propiedades que ya publicó"), así que **no es un bug a arreglar de una: es una decisión de producto**. Dónde está el matiz: reactivar no es *editar*, es *volver a publicar*. Nota: `check_property_limit()` sí corre en UPDATE, pero solo cuando la propiedad **entra** a ocupar cupo, y `paused` ya ocupa cupo — así que ese tampoco frena esta transición.

- [ ] **El dashboard no avisa de la baja.** Una agencia **no aprobada** tiene su aviso en dos pantallas (`/dashboard` y `/dashboard/preferencias`, vía `AgencyApprovalNotice`); una agencia **dada de baja** solo lo tiene en `/dashboard/suscripcion`. En el home ve sus métricas normales y un botón de publicar deshabilitado con su motivo, pero ningún aviso de ancho completo que explique el estado. Asimetría chica y barata de cerrar (el molde `Notice` + el hueco del home ya existen); vale la pena antes de que haya agencias reales que se den de baja.

- [ ] **El limitador de frecuencia y la caché del geocodificador viven EN EL PROCESO.** `nextSlotAt` y el `Map` de resultados (`src/lib/geocoding/index.ts`) son variables de módulo: en un despliegue con **varias instancias** (que es lo que hace Vercel), cada una lleva su propio contador y su propia caché, así que el **ritmo agregado podría superar el límite de 1 consulta/segundo** que exige la política de Nominatim, y las mismas direcciones se consultarían una vez por instancia. **Hoy el riesgo es teórico**: una sola ciudad, un puñado de agencias, y un botón que se toca una vez por propiedad. **La solución real necesita infraestructura compartida** (un contador y una caché fuera del proceso — Redis/Upstash o equivalente), que es una decisión de infra, no un refactor. Revisar si el volumen de carga crece o si Nominatim empieza a devolver 429.

- [ ] **Las ciudades no tienen límites geográficos en la base.** `cities` solo guarda `center_lat`, `center_lng` y `default_zoom` (medido). El umbral de 25 km que descarta resultados lejanos del buscador de direcciones (`CITY_RADIUS_KM`) es un **sustituto de un dato que no existe**: no es el borde del ejido, es un filtro grueso contra la calle homónima en otra provincia. ⚠ **Hay que revisarlo antes de abrir una segunda ciudad**, sobre todo si es del mismo aglomerado (dos centros a menos de 25 km: los radios se pisan y una dirección de una ciudad pasa el filtro de la otra) o de la misma provincia. La solución de fondo sería guardar un radio o un polígono por ciudad.

- [ ] **`src/lib/geocoding/` es el mejor candidato del repo para estrenar pruebas automatizadas.** **El proyecto no tiene ningún marco de pruebas instalado** (no hay Vitest, Jest ni Playwright en `package.json`), y esa es la razón por la que este ítem es una deuda y no una tarea. El módulo es el mejor punto de entrada porque es **lógica pura**: sin interfaz, sin base de datos, con entradas simples y **desenlaces discretos** (`found` / `not_found` / `out_of_city` / `unavailable`) — o sea, se prueba con un proveedor falso y sin red. Lo que más valor tendría cubrir: que `geocodeAddress` **nunca lance** pase lo que pase del otro lado, que el descarte por distancia haga de umbral, que `unavailable` **no se cachee** nunca, que el limitador respete el intervalo, y que la consulta **no incluya el barrio**. Empezar por acá también evita la discusión de qué framework elegir para probar componentes de React.

- [ ] **`public.spatial_ref_sys` sin RLS** (aviso del security advisor de Supabase) — tabla de catálogo de proyecciones de PostGIS, legible/escribible por `anon` y `authenticated`. Sin datos de negocio, riesgo real bajo, pero está expuesta. ⚠ **No basta con `ENABLE ROW LEVEL SECURITY`**: sin una policy de SELECT se romperían las transformaciones de coordenadas de PostGIS. Si se toca, hay que hacerlo con la policy de lectura pública incluida. ⚠ **Y no se puede tocar desde el SQL Editor** (medido el 16 sep 2026): el dueño es `supabase_admin` y un `REVOKE` corrido como `postgres` no tuvo efecto. Ver la inconsistencia **#43** (pedido al soporte).

- [ ] **Multi-agente sigue sin millaje real, pero YA NO ES CERO.** Re-medido el 14 sep 2026: las **3** agencias tienen **exactamente 1 agente cada una**, los tres con rol `admin` (0 agencias con más de uno, y **0 agentes con rol `agent`** en toda la base; el 7 sep eran 10 agencias, también con 1 agente cada una), así que la maquinaria (`/dashboard/equipo`, roles admin/agent, reasignación de `agent_id`, policy `Admin reads agency leads`) sigue sin ejercitarse con una agencia de varios agentes **en estado estable**.
  **Lo que sí se recorrió (7 sep 2026):** el **ciclo completo de alta y baja de un agente**, de punta a punta y con datos reales — se creó un agente (`Luis Lescano`), se le generó una consulta desde el mapa público, y después se lo borró. Sobrevivieron las dos cosas que tenían que sobrevivir: la consulta quedó desvinculada con su nombre, y las propiedades pasaron al admin. Eso ejercitó de verdad `createAgentAction`, `deleteAgentAction`, el trigger `trg_set_lead_agent_name` y el `ON DELETE SET NULL`.
  **Lo que sigue sin recorrerse** es la **convivencia**: dos agentes activos a la vez en una agencia, un agente NO-admin abriendo Consultas (el único perfil que ejercita la policy `Agent reads own leads`), y la reasignación de propiedades entre pares. No es un problema; es un camino a mirar con lupa cuando una fundadora sume su primer agente y **lo conserve**.

- [ ] **⚠ LAS DOS FK DE `agent_id`: UNA RESUELTA (7 sep 2026), LA OTRA ABIERTA A PROPÓSITO.** Medido el 1 sep 2026 y **re-medido el 7 sep 2026**. El schema documentado afirmaba que las dos eran **nullable con `ON DELETE SET NULL`** ("la propiedad pertenece a la agencia, no al agente"), y la base decía otra cosa. Hoy:

  | Columna | Lo que la base TIENE (7 sep 2026) | Estado |
  |---|---|---|
  | `leads.agent_id` | **nullable**, `ON DELETE SET NULL` | ✅ **RESUELTA** |
  | `properties.agent_id` | **NOT NULL**, `ON DELETE CASCADE` | ⬜ **ABIERTA, y no es un olvido** |

  **✅ La mitad de las CONSULTAS quedó cerrada.** Cerraba un bug vivo en producción: **no se podía borrar un agente que tuviera consultas a su nombre** —el `deleteUser` cascadeaba a `agents` y ahí chocaba contra la FK—. Lo que se decidió: **una consulta es un HECHO HISTÓRICO**, así que al borrarse el agente **se desvincula** (`agent_id` a NULL) y **conserva el nombre** de quien la atendió en `leads.agent_name`, una **copia congelada** que escribe el trigger `trg_set_lead_agent_name` (BEFORE INSERT, SECURITY DEFINER) y **nunca el cliente**. La consulta sigue perteneciendo a la agencia (`agency_id` es NOT NULL) y sigue apareciendo en `/dashboard/leads`, con un badge "Ya no está". **Verificado en producción:** hay una consulta con `agent_id NULL` y `agent_name = 'Luis Lescano'` — un agente real creado, contactado desde el mapa y después borrado, con su consulta intacta. Ver `CLAUDE.md` → "La consulta sobrevive al agente".

  **Las DOS alternativas que se evaluaron y se DESCARTARON para las consultas** (anotadas para que no se vuelvan a proponer):

  | Alternativa | Por qué NO |
  |---|---|
  | **Reasignarlas al admin**, como se hace con las propiedades | Mentiría sobre quién la atendió. Una propiedad es un **activo vivo** y necesita dueño; una consulta es un **registro de algo que pasó**, y ese hecho no cambia de dueño porque una persona se fue de la inmobiliaria |
  | **Borrarlas junto con el agente** (FK a `ON DELETE CASCADE`) | Perdería el historial comercial de la **agencia**, que es quien pagó por esas consultas y quien las sigue necesitando. La agencia no pierde su historial porque se le vaya un empleado |

  **⬜ La mitad de las PROPIEDADES sigue abierta, y el reparto asimétrico es DELIBERADO, no una tarea a medias.** `properties.agent_id` sigue **NOT NULL + `ON DELETE CASCADE`**, así que la **reasignación previa al admin** de `deleteAgentAction` (Modelo B) **no es una prolijidad: es lo único que impide perder las propiedades** —invertir ese orden las borraría, con sus imágenes detrás—. Que las propiedades se **reasignen** y las consultas se **desvinculen** es el modelo correcto, no una inconsistencia pendiente de emparejar.
  **Qué queda por decidir, entonces:** si vale la pena `ALTER`ar `properties.agent_id` a nullable + `SET NULL` para que una propiedad pueda existir sin agente asignado. **No hay ninguna urgencia** (medido: 0 propiedades sin agente, y el camino de borrado ya no pierde nada). Está entrelazado con "desactivar agente" (sub-pieza 4) y con el fallback de WhatsApp a la agencia: recién ahí una propiedad sin agente necesitaría un número al cual rutear el contacto. **Antes de tocar esa FK hay que resolver ese fallback**, o el botón de WhatsApp quedaría sin destino.
  ⚠ **Y la policy `Public insert lead` NO hay que aflojarla** para aceptar `agent_id IS NULL`, aunque una nota vieja del schema lo pidiera: es la única barrera de escritura pública de la tabla, y el caso al que apuntaba (una PROPIEDAD sin agente) sigue sin existir.

- [ ] **⚠ El borrado de un agente NO ES ATÓMICO, y sigue sin serlo.** Abierto el 7 sep 2026, al medir el flujo de borrado. `deleteAgentAction` hace **tres pasos** y **los dos primeros no se revierten**:

  | Paso | Si el paso 3 falla |
  |---|---|
  | 1. Reasignar las propiedades al admin | **ya está hecho** — las propiedades quedaron a nombre del admin |
  | 2. Borrar el avatar del Storage | **ya está hecho** — `agents.avatar_url` apunta a un archivo que no existe |
  | 3. `admin.auth.admin.deleteUser(agentId)` | falla |

  **El agente sigue existiendo** (su fila de `agents` y su usuario de Auth están intactos), así que **puede iniciar sesión y ve su listado de propiedades vacío y su foto de perfil rota**, sin que nadie le haya avisado.
  ⚠ **Había un comentario en el código que llamaba a ese estado "consistente". Era falso, y ya se corrigió**: ahora enumera qué quedó hecho y qué no, y el mensaje de error se lo dice al admin en vez de un "intentá de nuevo" pelado. **Lo que se arregló fue la descripción, no el estado.**
  **La causa más frecuente desapareció** con el `SET NULL` de `leads.agent_id` (era el choque contra esa FK), así que hoy es mucho menos probable — pero **el estado sigue siendo alcanzable** por cualquier otro fallo de la API de Auth (red, rate limit, un 5xx de GoTrue).
  **Por qué no se cerró en esa tanda:** cerrarlo de verdad exige **reordenar o compensar** los pasos —mover el borrado del avatar después del `deleteUser`, o devolver las propiedades al agente si el borrado falla—, y eso es un **cambio de comportamiento** que no estaba autorizado ahí. Reordenar además tiene su propio costo, ya documentado: el avatar va antes justamente para que, si algo falla a mitad de camino, el agente siga apareciendo en la pantalla de Equipo y la operación se pueda reintentar. **Es una decisión a tomar, no un descuido.** Mitigación actual: los dos primeros pasos son **idempotentes**, así que reintentar es seguro.

- [ ] **La consulta sobrevive al borrado del AGENTE pero no al de la PROPIEDAD — asimetría a decidir, no bug.** Medido el 7 sep 2026: `leads_agent_id_fkey` es `ON DELETE SET NULL` (la consulta se desvincula y queda), pero **`leads_property_id_fkey` sigue siendo `ON DELETE CASCADE`**: borrar una propiedad **se lleva puestas todas sus consultas**. El código lo sabe y lo dice (`propiedades/actions.ts`: *"ON DELETE CASCADE en la DB elimina property_images y leads asociados"*).
  O sea que *"una consulta es un hecho histórico"* vale **frente a la persona que la atendió, pero no frente al inmueble consultado**. Es una asimetría real del modelo, no una omisión de la tanda de las consultas.
  **Hay argumentos de los dos lados y por eso queda para decidir**, no para arreglar: una consulta sin propiedad pierde casi todo su sentido (la pantalla muestra el título del inmueble, que dejaría de existir), pero el conteo de leads de una agencia y su historial comercial sí sobrevivirían. **Si alguna vez se cambia**, hay que resolver antes qué muestra la columna "Propiedad" —hoy cae a `"—"` si la relación viene vacía— y probablemente congelar también el título, con el mismo criterio que `agent_name`.

- [ ] **`leads` no tiene índice sobre `agent_id`, y una policy filtra por ahí.** Medido el 7 sep 2026: los únicos índices de la tabla son `leads_pkey` (por `id`) e `idx_leads_agency` (`agency_id, created_at DESC`); **cero índices que incluyan `agent_id`**. La policy `Agent reads own leads` es `(agent_id = auth.uid())`, así que **todo agente no-admin que abra Consultas filtra por una columna sin índice**.
  **Es PREEXISTENTE, no una regresión** de la tanda de las consultas: la policy y la falta de índice son de antes, y lo único que cambió es que ahora esa columna admite nulos. **Con 14 consultas es invisible** (re-medido el 14 sep 2026). ⚠ **Y el listado del panel no lo ejercita**: el conteo de consultas por propiedad se hace con service role filtrando por `agency_id`/`agent_id` de `properties`, no por la policy. Anotado para cuando haya volumen — el momento natural de mirarlo es cuando una agencia fundadora sume su primer agente no-admin, que es el único perfil que ejercita esa policy.

- [ ] **`PLAN-ORIGINAL.md` (el plan original, ya en el repo) está globalmente desactualizado** — describe el modelo viejo de 2 planes (free/pro, 5 propiedades) y su "Fase 3" está casi toda hecha. Se hicieron correcciones puntuales, pero el archivo entero merece una reescritura o una jubilación. **La hoja de ruta viva es este archivo (`PENDIENTES.md`), no aquel.**
- [x] **Slug de agencia "feo"** — RESUELTO. `generateUniqueAgencySlug` (`lib/utils/agencySlug.ts`) genera slug limpio para agencias (base + sufijo numérico incremental `-2`, `-3`…; aleatorio solo como último recurso ante 100 colisiones), distinto de `generateSlug` (propiedades, sufijo aleatorio). Consumido por la ruta white-label `/[slug]`. (Falta solo poder editarlo desde el dashboard → Sub-pieza C de white-label.)
- [x] **~~Seguridad fina de las policies de Storage~~ — HECHO (5 sep 2026). Estaba marcado "antes de octubre" y llegó.** Las tres policies laxas se reemplazaron por **cuatro finas**, todas acotadas al rol `authenticated`, y el bucket dejó de aceptar cualquier archivo.

  **Qué quedó:**

  | Archivo | Frontera | Cómo se valida |
  |---|---|---|
  | Propiedades (`{agent_id}/{property_id}/…`) | **por AGENCIA** | el agente de la 1ª carpeta pertenece a mi agencia (`EXISTS` sobre `agents`) |
  | Logos (`logos/{agency_id}/…`) | **por AGENCIA** | la 2ª carpeta **es** mi `agency_id` — sin lookup |
  | Avatares (`avatars/{agent_id}/…`) | **por USUARIO** | la 2ª carpeta es mi `auth.uid()` |

  La agencia la resuelve **`auth_agency_id()`** (función nueva en `public`, `STABLE`, **`SECURITY DEFINER`**, `search_path` fijo): sin ella, las policies quedaban atadas a que `Public read agents` siguiera con `USING (true)`, y el día que se restrinja esa lectura **toda subida fallaría con un 403 sin relación aparente con `agents`**. El bucket además pasó de `file_size_limit`/`allowed_mime_types` en `NULL` a **5 MB + PNG/JPG/WEBP**, o sea que el "no SVG, riesgo XSS" ahora **lo aplica el motor** y no solo el JavaScript del formulario. Todo transcrito al schema documentado con las dos trampas comentadas (comparar la carpeta **en texto** y nunca casteándola a `uuid`; `USING` y `WITH CHECK` idénticos en la de UPDATE). Ver `CLAUDE.md` → "Imágenes y Storage".

  **⚠ CORRECCIÓN DE UNA AFIRMACIÓN QUE ESTABA ACÁ Y ERA FALSA.** Este ítem decía que la policy de DELETE original "quedó reemplazada por la laxa al arreglar el problema de reemplazo". **Nunca ocurrió.** Medido antes de tocar nada: la de DELETE seguía siendo **la única fina** del bucket (`auth.uid()::text = (storage.foldername(name))[1]`), textualmente idéntica a la de la migración original. Lo que se agregó en su momento fue una policy de **UPDATE nueva y laxa** (ver el ítem "Arreglo policy UPDATE de Storage" en "Cerrados recientemente"), sin tocar la de DELETE. O sea que eran **tres laxas y una fina**, no cuatro laxas — y esa inconsistencia tenía dos consecuencias reales: nadie podía borrar un avatar ni un logo por RLS (ni su dueño), y un admin no podía borrar una foto subida por otro agente de su equipo. **El daño real de las laxas nunca estuvo en el borrado sino en el UPDATE**, que permitía sobrescribir con `upsert` el logo, el avatar o las fotos de cualquier otra agencia dejando `agencies.logo_url` intacto — el sitio white-label de la víctima sirviendo contenido ajeno, sin una sola señal en las tablas.

  **Efecto de borde MEDIDO que sí se cerró y no estaba en el plan:** la policy de SELECT tenía rol `public`, así que con la anon key —la del bundle de JavaScript de cualquier visitante— se podía **listar el árbol completo del bucket** y quedarse con todos los `agent_id`, `agency_id` y `property_id` con archivos, incluidos los de propiedades pausadas y borradas. Verificado después del cambio: ese listado devuelve `[]`.

  **Lo que deliberadamente NO se hizo:**
  - **No se tocó `public = true` del bucket.** Las fotos las tiene que ver el visitante anónimo del mapa. Consecuencia asumida: `/storage/v1/object/public/…` sigue sirviendo cualquier archivo sin pasar por RLS (ver el ítem nuevo sobre URLs firmadas más abajo).
  - **No se limpiaron los archivos huérfanos** ni se agregó código que los borre. *(Eso fue el grupo siguiente, cerrado el 6 sep 2026: ver abajo.)*
  - **No se unificó la rama de propiedades dentro de `auth_agency_id()`.** Esa rama necesita mirar a **otro** agente (el dueño de la carpeta), no al logueado, así que sigue haciendo su propio `EXISTS (SELECT 1 FROM agents …)` y **sigue dependiendo de `Public read agents`**. Es la mitad de la dependencia que la función vino a cortar, y queda anotada como deuda: si algún día se restringe la lectura de `agents`, hay que meter esa rama en una segunda función SECURITY DEFINER.
  - **No se movió `ImageUploader` a paths por agencia.** Sería más limpio (`{agency_id}/{property_id}/…` pone la frontera en el path y evita el `EXISTS`), pero obliga a migrar los objetos y a reescribir las URLs guardadas en `property_images.url`. Con **9 archivos** (el bucket quedó así después de la limpieza del 6 sep 2026) y sin clientes reales es el momento más barato de la historia del proyecto para hacerlo; si no se hace ahora, no se hace más.

### Limpieza de Storage — grupo CERRADO (6 sep 2026), salvo un ítem de producto

> Este bloque salió del trabajo de policies del 5 sep 2026 y se hizo en dos tandas de código más una corrida de limpieza. Causa raíz común: **nadie borraba archivos de Storage cuando se borraba la fila que los referencia**. **Resultado medido el 6 sep 2026: el bucket pasó de 24 objetos / 6.718.597 bytes (15 huérfanos, ~5,99 MB, el 89 % del peso) a 9 objetos / 723.872 bytes (707 kB) y CERO huérfanos.** El único ítem que sigue abierto acá es la decisión de producto sobre las URLs públicas, que este grupo no tocó. El detalle de cómo quedó todo está en `CLAUDE.md` → "Imágenes y Storage".

- [x] **~~Borrar una propiedad NO borra sus archivos de Storage~~ — HECHO (6 sep 2026).** `deletePropertyAction` (`propiedades/actions.ts`) lee las URLs de `property_images`, borra los archivos con `removePropertyFiles` y borra la fila. Venía medido: **10 de los 17 archivos de propiedad del bucket pertenecían a propiedades que ya no existían** (6 propiedades distintas), o sea casi la mitad del bucket, con 17 propiedades de prueba.

  **⚠ EL ORDEN ES `leer las URLs → borrar la fila → borrar los archivos`, y tiene DOS motivos distintos.** Se implementó primero con los archivos en el medio y se invirtió después, a conciencia:
  - **Leer antes del `DELETE` es obligatorio:** `property_images_property_id_fkey` es `ON DELETE CASCADE` (medido), así que el borrado de la propiedad se lleva las filas con las URLs en el mismo instante. Después no hay de dónde sacar los paths.
  - **Borrar los archivos DESPUÉS de la fila, y no pegado a la lectura**, aunque agrupar se vea más prolijo: leer ya satisface el motivo anterior (las URLs quedan en memoria y el CASCADE no las alcanza), así que agrupar no compra nada y paga un riesgo asimétrico. Si los archivos se van y el `DELETE` falla después, queda **una propiedad viva y publicada con sus imágenes destruidas** — una propiedad rota en el mapa público. Al revés solo quedan archivos que nadie ve, y encima avisados.

  **Decisiones:** borrado **en el acto** dentro de la misma action (no una cola ni un proceso diferido: infraestructura nueva para un problema chico); **service role siempre**, porque es el único client que alcanza los archivos subidos por un agente que después fue borrado —las policies comparan contra filas que en esos casos no están—; y **best-effort pero nunca silencioso**: si falla, la propiedad se borra igual y se avisa *"…pero quedaron archivos sin borrar en el almacenamiento (N archivo(s))"*, con la misma forma que `deleteAgencyAction`. **Un detalle que no era obvio:** las URLs se leen con el `db` de `authorizePropertyAccess`, no con el client normal — un admin borrando la propiedad de otro agente de su agencia leería **cero filas sin error**, y el borrado no fallaría: no borraría nada, en silencio.

- [x] **~~Borrar un agente NO borra su avatar ni sus archivos~~ — HECHO (6 sep 2026).** `deleteAgentAction` borra el avatar con `removeAgentAvatar` **antes** del `deleteUser` (si algo falla, el agente sigue listado en Equipo y se puede reintentar). Se **lista** `avatars/{agentId}` en vez de reconstruir el nombre, porque la extensión depende del archivo subido — y de paso barre los avatares viejos de otra extensión, que el `upsert` no pisa. Molde tomado de `removeAgencyFiles`. Best-effort con aviso, igual que el resto.

  **⚠⚠ SE BORRA EL AVATAR Y NADA MÁS, Y ES LA DECISIÓN MÁS IMPORTANTE DEL GRUPO.** Barrer la carpeta `{agent_id}/` entera se ve más completo y **es destructivo**: el primer segmento de un path de foto de propiedad es **el agente que SUBIÓ el archivo, no el dueño de la propiedad**, y `deleteAgentAction` **reasigna las propiedades al admin** antes de borrar, así que esas propiedades siguen vivas y publicadas. Medido al implementarlo: **7 de los 12 archivos** bajo una de esas carpetas pertenecían a propiedades existentes. La regla que quedó escrita en `CLAUDE.md`: **las fotos de propiedad se borran cuando se borra la propiedad, nunca cuando se borra una persona.**

- [x] **~~El borrado de una imagen desde el navegador NO chequea el error~~ — HECHO (6 sep 2026).** `handleRemove` captura el resultado de `remove()` y avisa, siguiendo el patrón que la **subida** de ese mismo componente ya usaba. Era un `await` pelado, sin `const { error } =`: un rechazo de RLS, un 404 o una caída de red producían **exactamente la misma pantalla que el éxito**, la fila de `property_images` desaparecía al guardar y el archivo quedaba vivo. Es cómo se llegó a los 10 huérfanos del ítem de arriba.

  **Decisiones:**
  - **Se quedó en el navegador.** El path ya está a mano y la frontera por AGENCIA de las policies nuevas le da permiso al agente, incluso sobre una foto que subió un compañero de equipo (con la policy fina vieja, `auth.uid()::text = foldername[1]`, ese caso daba 403). Moverlo a una server action sería un viaje de más para hacer lo mismo. **Lo que faltaba no era el lugar, era capturar el error.**
  - **La imagen se quita igual de la grilla aunque el borrado falle.** El agente pidió sacarla y eso se respeta; lo único que cambia es que ahora se entera: *"La imagen se quitó, pero no se pudo borrar el archivo del almacenamiento."*
  - El estado del componente pasó de llamarse `uploadError` a `storageError`, porque ahora reporta las dos cosas.

- [x] **~~La función que traduce URL pública a path vivía dentro de un componente y fallaba hacia adelante~~ — HECHO (6 sep 2026).** Se extrajo a **`src/lib/utils/storagePath.ts`** (exporta `PROPERTY_IMAGES_BUCKET` y `extractStoragePath`), porque el borrado del servidor la necesitaba y estaba encerrada en un `"use client"`. Mismo precedente que `coords.ts`: sin dependencias, la usan servidor y cliente. **Y se le arregló un defecto de paso:** ante una URL sin el marcador del bucket devolvía **la URL entera**, y una URL completa pasada a `remove()` es un path inexistente que **no borra nada y tampoco da error** — un éxito mentiroso, que es la forma exacta en que se acumulan huérfanos sin que nadie se entere. Ahora devuelve `null` y los dos llamadores descartan los nulos en vez de mandarlos a borrar.

- [x] **~~Los archivos huérfanos quedaron INALCANZABLES por las policies nuevas~~ — LIMPIADO (6 sep 2026) con una herramienta que queda.** El diagnóstico era correcto y sigue siéndolo: las tres ramas de las policies comparan contra una fila (`agents` para propiedades, `agencies` para logos, `auth.uid()` para avatares), así que si el agente o la agencia ya no existen **no hay contra qué comparar y ningún usuario autenticado puede borrar el archivo**. Solo service role. Eso es exactamente lo que descartó las otras dos formas de resolverlo.

  **Se hizo con `scripts/storage-orphans.ts`**, fuera de `src/` para que no entre al bundle ni sume una ruta al build:

  ```bash
  npm run storage:huerfanos          # simulación: detecta e imprime, NO borra nada
  npm run storage:huerfanos:borrar   # destructivo
  ```

  Las dos entradas de `package.json` envuelven `node --env-file=.env.local scripts/storage-orphans.ts [--borrar]`. Cero dependencias nuevas: Node 22 ejecuta TypeScript directo y `--env-file` es nativo desde 20.6. El script queda cubierto por `npx tsc --noEmit` y por el lint sin tocar ninguna configuración.

  **Por qué un script y NO una pantalla en `/admin`, ni SQL:**
  - **No una pantalla:** sería infraestructura permanente en el panel —donde ya conviven nueve acciones por fila— para un problema que los caminos arreglados ya no generan. Y el panel es de gestión comercial, no de mantenimiento del almacenamiento.
  - **⚠ NO SQL, Y ESTO ES LO QUE HAY QUE RECORDAR: borrar filas de `storage.objects` con un `DELETE` NO borra el archivo del almacenamiento.** Deja el archivo **facturándose** y sin ninguna fila desde la cual encontrarlo, o sea que empeora el problema en vez de resolverlo. Es documentación oficial de Supabase, textual: *"Deleting objects should always be done via the Storage API and NOT via a SQL query. Deleting objects via a SQL query will not remove the object from the bucket and will result in the object being orphaned"*, y *"Deleting the metadata doesn't remove the object in the underlying storage provider. This results in your object being inaccessible, but you'll still be billed for it."* **Alguien va a tener la tentación de resolver esto con un `DELETE` algún día: no se puede.**

  **Qué detecta** (cuatro categorías, informando en cuál cae cada archivo y por qué): (a) foto de propiedad inexistente, (b) avatar sin referencia —el agente no existe **o** su `avatar_url` apunta a otro archivo—, (c) logo sin referencia, ídem, (d) `.emptyFolderPlaceholder`. **El criterio es "¿existe la fila?", nunca "¿está publicado?":** la foto de una propiedad pausada, vendida o alquilada no es huérfana, y las de una agencia dada de baja tampoco.

  **Dos salvaguardas:** el **modo simulación es el predeterminado** (solo borra con `--borrar` escrito completo; un argumento desconocido aborta en vez de caer en simulación), y **no se borra nada de menos de 24 horas** (ver el ítem del alta abandonada, abajo). Además: toda lectura es fail-closed —una lista de propiedades incompleta convertiría fotos vivas en "huérfanas"—, se pagina en las dos puntas, y se borra en lotes de 1000 por la API, informando cuántos se borraron, cuántos fallaron y cuáles.

  **Resultado de la corrida:** de **24 objetos / 6.718.597 bytes** con **15 huérfanos (~5,99 MB, el 89 % del peso)** a **9 objetos / 723.872 bytes (707 kB) y CERO huérfanos**. Verificado después con el propio script en simulación y con una consulta directa a la base.

- [ ] **Queda una vía IRREDUCIBLE por la que se generan huérfanos nuevos, y no tiene arreglo.** El borrado de la fila y el del archivo son dos sistemas distintos —Postgres y el almacenamiento de Storage— y **no se pueden transaccionar juntos**. Si el proceso muere entre uno y otro, el archivo queda **y no se avisa**: el `return` con el aviso está después del borrado de archivos y no llega a ejecutarse. Es una ventana chica y es **preferible al orden inverso**, que en la misma situación dejaría una propiedad viva con sus imágenes destruidas (ver el ítem de `deletePropertyAction`, arriba). No es un pendiente a resolver: es la razón por la que `scripts/storage-orphans.ts` **no es una herramienta de un solo uso** y conviene correrlo en simulación cada tanto.

- [ ] **Los archivos de un alta abandonada, y por qué el script no los borra enseguida.** Al dar de alta una propiedad, `ImageUploader` sube las fotos al bucket **antes de que la propiedad exista en la base**: el id se genera en el cliente (`CreatePropertyInput.id`) y las filas de `property_images` se escriben recién al guardar. Un formulario que se abandona deja archivos sin fila. El script los detecta como categoría (a), pero **no borra nada de menos de 24 horas, ni siquiera en modo borrado**: un archivo bajo un `property_id` que todavía no existe puede ser basura de un formulario abandonado **o** un formulario que alguien tiene abierto en otra pestaña ahora mismo, y **son indistinguibles desde el bucket**. Se informan como `[RECIENTE, SE OMITE]` y se cuentan aparte; un archivo cuya antigüedad no se puede establecer también se trata como reciente. **Cerrarlo de verdad exigiría que el alta reserve el id en la base antes de subir**, que es rediseñar el formulario para un caso que se limpia solo en la siguiente corrida. No vale la pena hoy.

- [ ] **DECISIÓN PENDIENTE, no bug a arreglar ya: las fotos siguen accesibles por URL directa aunque la agencia esté dada de baja o la propiedad pausada.** El bucket es `public = true`, y `/storage/v1/object/public/…` **no pasa por RLS**: ninguna policy participa. Verificado con `curl` sin credenciales de ningún tipo — devuelve **200 con el contenido intacto** incluso para un archivo cuyo agente **y** cuya propiedad fueron borrados. O sea que `agency_is_publicly_visible()` apaga el mapa, el modal, el registro de leads y el sitio de marca, **pero no apaga una sola foto**. Matiz justo antes de alarmarse: **esto no rompe la cobrabilidad** — nadie descubre propiedades por URL de foto, y sin mapa ni modal no hay de dónde salga esa URL (y desde el 5 sep 2026 tampoco se puede enumerar el bucket con la anon key). Es una fuga de **contenido**, no de **distribución**. **Cerrarlo requeriría bucket privado con URLs firmadas**, que es un cambio grande: toca todos los `getPublicUrl()` del código, obliga a generar y renovar firmas para cada foto de cada pin visible, y **pega justo en la performance de la query caliente del mapa**. Se anota como decisión de producto a tomar a conciencia, no como arreglo pendiente.
- [x] **~~Edición del nombre de la agencia (`agencies.name`)~~ — HECHA (12–13 sep 2026), en tres tandas más una cuarta que no estaba prevista.** Salió como el ítem pedía: **un flujo de aprobación**, no un campo editable directo con warning. El admin pide el cambio, la cuenta vuelve a `'pending'`, y el dueño resuelve desde `/admin`.

  **Lo construido:** dos columnas de rastro en `agencies` (`previous_name` + `name_change_requested_at`, las dos nullable, aplicadas a mano por el dueño), la distinción en el panel (badge **"CAMBIO DE NOMBRE"** + el nombre anterior tachado junto al nuevo, en escritorio y celular), el aviso previo a la agencia con las cuatro consecuencias, y **DOS formas de rechazo**.

  **⚠ POR QUÉ EL RECHAZO SON DOS ACCIONES, que es la decisión de producto de la pieza.** Rechazar tenía un solo significado, diseñado para un alta que no corresponde: deja la agencia fuera, su sitio se apaga y sus propiedades desaparecen del mapa. **Aplicado a una inmobiliaria que ya venía funcionando y pagando, y cuyo único problema es el nombre que pidió, es desproporcionado.** Ahora: *"Rechazar el nombre"* revierte al anterior y la deja funcionando (el caso normal, en la fila), y *"Rechazar la inmobiliaria"* es lo de siempre (el caso duro, en el menú `⋯`, en rojo, con una advertencia de que la agencia está funcionando hoy). **Las dos son necesarias**: con solo la primera se pierde la capacidad de sacar a una agencia que se cambió el nombre a algo que no corresponde de ninguna manera.

  **⚠⚠ Y LA CUARTA TANDA ES LA LECCIÓN MÁS CARA DEL GRUPO: las tres primeras se construyeron SIN QUE EXISTIERA EL CAMPO PARA PEDIR EL CAMBIO.** La action aceptaba `name`, el formulario la llamaba, pero el campo vivía dentro de una rama que no se renderizaba para una agencia aprobada — el estado del 100 % de las agencias reales. Toda la maquinaria estuvo escrita, compilando y sin usarse. El síntoma que lo habría delatado tres tandas antes: **`previous_name` existía, el panel la leía, y ninguna fila la tenía cargada.** La regla que salió de ahí está en CLAUDE.md → "Método de Diagnóstico" → *recorrer de punta a punta, no desde el medio*.

  **Lo descartado:** un formulario aparte para el nombre (ver el bloque de decisiones abajo).
- [x] **~~Dashboard entra en loop si el agente no tiene agencia resoluble~~ — RESUELTO (28 ago 2026).** El helper `resolveAgentSession` distingue "no hay sesión" de "hay sesión pero no resuelve la agencia" (`unlinked`), y el segundo caso corta a `/logout`, que **cierra la sesión** y recién después manda al login con el motivo. Al no haber sesión, `proxy.ts` deja de rebotar y el ciclo no se arma. El detalle de por qué la salida tuvo que ser un route handler está en `CLAUDE.md` → "Cierre de sesión".
- [x] **~~Matrículas duplicadas entre agencias pendientes: el error no se explica~~ — HECHO (7 sep 2026).** El índice único de matrícula sigue siendo **parcial** (solo entre aprobadas de la misma ciudad) y eso no se tocó: es deliberado y correcto, porque si el alta rechazara una matrícula ya usada, el formulario le confirmaría a un impostor cuáles existen. Lo que cambió es el mensaje. `writeApproval` ahora traduce el error con `translateApprovalWriteError` (`admin/actions.ts`), siguiendo el molde de `translatePropertyWriteError` —incluido su tipo estructural mínimo (`DbLikeError`) en vez de atarse al tipo del SDK, y su regla de que el motivo específico va ANTES del cajón de sastre—.

  **El mensaje:**
  > No se pudo aprobar: ya hay otra inmobiliaria aprobada en la misma ciudad con la matrícula 1234. Revisá cuál de las dos corresponde antes de aprobar esta.

  **Decisiones:**
  - **La detección exige TRES condiciones, no una.** `status === "approved"` **+** `code === "23505"` **+** que el `message` nombre `idx_agencies_license_unique_approved`. ⚠ **El código solo NO alcanza:** sobre `agencies` hay **tres índices únicos** (medido: `agencies_pkey`, `agencies_slug_key` y el de matrícula) y los tres levantan 23505, así que un matcher que mirara solo el código reportaría un choque de matrícula ante un choque de slug.
  - **El mensaje incluye la matrícula en conflicto**, extraída del `details` del error (`Key (city_id, license_number)=(…, 1234) already exists.` — el nombre del índice viaja en el `message`, los valores en el `details`). **Si la extracción falla, el mensaje funciona igual** y dice "esa matrícula": la extracción es una mejora, no una dependencia, y devuelve `null` ante cualquier forma inesperada. El formato del `details` es texto de Postgres, no un contrato.
  - **Explica la REGLA, no solo el hecho** ("aprobada" + "misma ciudad" son literalmente las dos condiciones del índice): es lo que le permite al dueño encontrar la otra agencia. Y **no dice "intentá de nuevo"** — el conflicto es de datos, no transitorio.
  - **Gateado a la aprobación**, aunque rechazar y reabrir no puedan chocar (sacan la fila del predicado). `writeApproval` es compartida por las tres, y el gate por `status` vuelve la imposibilidad estructural en el código en vez de depender de una propiedad del índice que podría cambiar.
  - **Efecto colateral documentado en el código** (no en los .md, a propósito): rechazar o reabrir una agencia APROBADA **libera su matrícula**, porque la fila sale del predicado parcial. Si en el medio se aprueba otra con la misma, reaprobar la original falla.

- [x] **~~El registro no deshace el upsert de `subscriptions`~~ — RESUELTO POR LA BASE (7 sep 2026), y no como decía este ítem.** El diagnóstico era correcto —si fallaba el cuarto paso del registro quedaba una agencia funcionando sin fila de suscripción, o sea con límite 0 y sin que nadie lo reparara—, pero **las dos salidas que proponía se descartaron las dos**.

  **Lo que se hizo: un trigger.** `trg_ensure_agency_subscription` (AFTER INSERT ON `agencies` → `ensure_agency_subscription()`, SECURITY DEFINER con `search_path` fijo) crea la fila junto con la agencia. **El cuerpo no escribe ningún valor salvo la clave**: los `DEFAULT` de `subscriptions` ya son el estado de aterrizaje, así que `INSERT INTO subscriptions (agency_id)` produce exactamente esa fila, y repetir los valores crearía una segunda fuente de verdad que divergiría en silencio el día que se cambie un default. `ON CONFLICT (agency_id) DO NOTHING` lo hace idempotente.

  **Por qué la base y no las dos opciones que este ítem proponía:**
  - **NO reintentar en el código.** Un reintento solo cubre fallos transitorios: uno persistente agota los intentos y deja el mismo estado. Achica la probabilidad, no cierra el agujero — y no cubre el SQL a mano ni ningún camino de alta futuro.
  - **NO una acción de reparación en `/admin`.** Es reactiva (la agencia queda rota hasta que el dueño lo note) y, sobre todo, **con el trigger el estado deja de ser producible**: sería una décima acción de fila, permanente, para algo que no puede ocurrir. Peso muerto.
  - La barrera en la base es la única que **cubre todos los caminos y no depende de que ningún código se acuerde**. Misma disciplina que los tres gates de publicación.

  **El upsert de `registerAction` se mantiene**, con el comentario reescrito: ya no es lo que crea la fila —para cuando corre, el trigger ya la creó y su `ignoreDuplicates` la deja intacta— sino una **red de respaldo** por si alguien deshabilita el trigger.

  **Y se atendieron los otros dos síntomas del mismo estado, que este ítem no mencionaba:**
  - **`getPlanUsage` reportaba límite 1 donde la base dice 0.** Ahora reporta `0` (constante `NO_SUBSCRIPTION_LIMIT`), que es lo que hace `check_property_limit()`. Antes la interfaz habilitaba el botón, dejaba pasar la ruta, y el rechazo llegaba al guardar el formulario entero con un mensaje falso sobre el límite del plan. **Solo cambió el límite**: el `status` y los tres `has_*` siguen cayendo a los de `PLANS.free`.
  - **Pedir un cambio de plan sin fila informaba un éxito que no ocurría.** Un UPDATE acotado con `.eq()` sobre una fila inexistente afecta cero filas y devuelve `error: null`. Resuelto con `update(values, { count: "exact" })` y `if (count === 0)`, con un mensaje que no habla de planes. Se prefirió el `count` sobre leer la fila antes porque leer y escribir son dos viajes distintos: el count mide lo que la escritura hizo, no lo que era cierto un momento antes.

  **Verificado en la base, no solo por lectura:** el alta de prueba "Inmoprueba 1" (7 sep 2026) tiene su fila de suscripción con `created_at` **idéntico al microsegundo** al de la agencia (`02:32:41.767784+00` las dos), o sea creada por el trigger dentro de la misma sentencia — no por el upsert de la aplicación, que en las agencias viejas se ve ~400 ms después. Estado resultante: `free`/`active`/`property_limit=1`/`has_*` en false.

- [ ] **RESIDUO CONSCIENTE del límite 0: el bloqueo es correcto, el mensaje no.** Si una agencia quedara sin fila de suscripción —hoy **solo posible borrándola a mano**, porque el trigger cubre todos los caminos de alta—, `getPlanUsage` reporta límite 0, `getPublishBlock` devuelve `plan_limit` y el botón **bloquea bien**. Pero `NewPropertyButton` muestra *"Alcanzaste el límite de tu plan Gratis. Pasá a Inicial para publicar más"*, que es impreciso: no alcanzó ningún límite, le falta una fila, y pasar a Inicial no la destrabaría. **Arreglarlo exige un cuarto motivo en `PublishBlockReason`**, lo que obliga a tocar el `switch` exhaustivo con guarda `never` que `CLAUDE.md` marca como sensible (es el que ya se rompió una vez con un ternario binario). **Se decidió NO hacerlo**: es construir para un estado improducible. Lo que sí se arregló, y era el bug real, es que antes **no bloqueaba** y el rechazo llegaba al guardar el formulario entero.

- [ ] **NO VERIFICADO EN PANTALLA: el bloqueo con límite 0.** Se verificó **por lectura de código** (`getPlanUsage` → `getPublishBlock` → los cuatro puntos de entrada al alta) y **revisando uno por uno los consumidores del límite** frente al cero, pero **no se probó en el navegador**. Motivo: fabricar el caso exige que la agencia no tenga fila de suscripción, y con el trigger eso significa borrarla y navegar antes de que nada la recree — o sea dejar una transacción abierta mientras se usa la app, que es más frágil que lo que se quiere comprobar. **Riesgo bajo**: el camino es el mismo que ya usan los otros dos motivos de bloqueo, que sí están probados en pantalla, y las dos divisiones por el límite ya estaban guardadas contra el cero. Queda anotado como lo que es: no verificado.

- [ ] **LIMPIEZA DE DATOS PREVIA AL LANZAMIENTO (no deuda técnica): la mayoría de las agencias de prueba no tiene matrícula.** Re-medido el 14 sep 2026: **1 de 3 agencias tiene `license_number` en `NULL`** (era 1 de 4 el 12 sep y 8 de 10 el 7 sep: la limpieza se llevó justamente a las que no tenían), así que **2 filas** caen hoy dentro del predicado del índice único (`approval_status = 'approved' AND license_number IS NOT NULL`). O sea que hoy **la regla de unicidad de matrícula casi no tiene datos sobre los cuales aplicarse**. Es irrelevante mientras sean datos de prueba —las 8 son anteriores a que la matrícula existiera—, pero **las agencias reales tienen que tenerla**, o quedan fuera de la regla para siempre. Va con la limpieza de datos de prueba previa al lanzamiento. (Los 2 usuarios de Auth huérfanos que este ítem mencionaba **ya no existen**: ver el ítem de abajo.)

- [x] **~~Quedan 2 usuarios de Auth huérfanos en la base~~ — YA NO QUEDA NINGUNO (re-medido el 12 sep 2026: `0`).** Eran de registros que fallaron **antes** de que existiera el rollback, y se los llevó la limpieza de datos de prueba, no un arreglo de código. ⚠ **El rollback de `registerAction` sigue siendo lo que evita los nuevos** y no hay que tocarlo. Y el ítem deja una medición útil: el 11 sep todavía había **2 de 11** usuarios de Auth sin fila en `agents`, los dos con el correo confirmado y uno con ingreso ese mismo día — o sea que el caso es real y alcanzable, no teórico.

- [ ] **El "banner de error" sigue copiado a mano en cuatro pantallas** (`AgenciesTable`, `PropertiesTable`, `SubscriptionContent`, `TeamContent`) y **no se migró** al `Notice` nuevo. Es deliberado: son de naturaleza distinta (descartables, con `useState` de cliente, comunican una falla puntual) y migrarlos habría cambiado comportamiento visible en pantallas fuera del alcance de esa tanda. Si algún día se unifican, el patrón a extender es `Notice` con un tono descartable, no al revés.

- [ ] **Escalado del panel `/admin`** — hoy trae todas las agencias y filtra client-side (correcto para pocas agencias). Cuando haya muchas, mover el filtrado a la query (server-side) y paginar.
- [x] **Repo de migraciones**: RESUELTO (9 jun 2026, revisado el 1 sep 2026). La fuente de verdad documentada del schema es `supabase/migrations/20240101000000_initial_schema.sql`, que se mantiene al día **a mano contra la base real** (los `ALTER` los corre el dueño en el SQL Editor; el MCP es solo lectura).
  **Convención de trabajo:** un cambio de schema todavía sin aplicar se escribe en `supabase/pending/<fecha>-<tema>.sql`; **cuando se aplica, su contenido se traslada al schema y el archivo se borra**. Hoy `supabase/pending/` está **vacío** (1 sep 2026: se aplicaron y trasladaron el trigger de suscripción y el CHECK ampliado de `agency_reviews`, y se borraron los dos archivos). Que quede vacío es el estado sano: un archivo ahí significa que la base y el schema no coinciden.
  ⚠ **Salvedad medida el 1 sep 2026, y su desenlace (7 sep):** el schema documentado **sí mentía** sobre las dos FK de `agent_id`. Se corrigió para que dijera lo que la base tenía, con la discrepancia marcada; y el 7 sep la mitad de las consultas **se migró para que coincidiera con el modelo escrito** (nullable + `ON DELETE SET NULL` + `agent_name`). La de propiedades sigue como está, ahora por decisión y no por olvido — ver la deuda "LAS DOS FK DE `agent_id`".

---

## Decisiones de producto abiertas

- [ ] **¿Login opcional de visitantes?** — hoy el visitante NO se registra (favoritos en localStorage). Un login *opcional* (nunca obligatorio) habilitaría favoritos sincronizados entre dispositivos, historial y alertas ("bajó el precio de una que viste"). Decidido en su momento: NO ahora. **REABIERTO por C1 de la nueva fase** (el socio quiere monetizar datos) — ahora SÍ se va a evaluar en serio, siempre opt-in, nunca obligatorio, y preparado para consentimiento de datos desde el día 1. Ver "🚀 NUEVA FASE → C1".

- [ ] ~~**¿Un particular (free) puede pagar por destacar su única propiedad?**~~ — **OBSOLETA por A1 de la nueva fase** (se eliminan los particulares). Sin particulares, la pregunta no aplica.
- [ ] **⚠ Bajar de plan desde el panel del CLIENTE (autoservicio): NO EXISTE Y ASÍ DEBE QUEDAR** hasta resolver el atajo del plan grande. El problema, concreto: una agencia podría **pagar un mes de plan Premium, cargar 200 propiedades y bajar a Inicial conservándolas todas visibles**. El límite se valida al *entrar* (INSERT y reactivación), no de forma continua, así que un downgrade no saca del mapa lo ya cargado. Hoy el cambio de plan **solo lo hace el dueño** (`changePlanAction`), que además bloquea el cambio si las propiedades no entran — y esa barrera es precisamente lo que un autoservicio saltearía. Lo que habría que resolver primero: qué pasa con el excedente (¿se pausa? ¿quién elige cuál?), y si el downgrade rige recién al fin del período pago. **No abrirlo "porque el modelo ya lo soporta": el modelo lo soporta, el negocio no.**

- [ ] **Validar precios con el mercado** — cuánto pagan las inmobiliarias locales por Zonaprop, para calibrar los precios de los planes ($30k/$65k/$140k son placeholders).

---

## Bugs / observaciones menores

- [ ] **El estado "sin ciudades disponibles" de la home es un callejón sin salida: no tiene encabezado, ni marca, ni un solo enlace (medido el 10 sep 2026).** `src/app/(public)/page.tsx:107-120`, la rama `if (!city)`: devuelve un `<div>` centrado con dos párrafos —*"Sin ciudades disponibles"* y *"Configurá al menos una ciudad activa en el panel de administración."*— y **nada más**. Sin Wordmark, sin `CityPicker`, sin puerta al panel, sin ningún `href`. Quien caiga ahí no tiene ninguna acción disponible.
  **Hoy es inalcanzable en producción** (hay una ciudad activa, "Santiago del Estero"), pero es código vivo y la condición es alcanzable — alcanza con desactivar la única ciudad.
  ⚠ **Y C3 lo dejó como la ÚNICA superficie pública sin la puerta:** las otras dos ramas de la home comparten `PublicHeader` y ésta no, así que la asimetría pasó de "tres pantallas contra una" a que esta rama quede sola. Además el texto está escrito para el dueño de la plataforma ("configurá… en el panel de administración"), no para un visitante, que es quien más probablemente lo vea. Arreglo chico: envolverla en `PublicHeader` con el slot del selector vacío, o al menos darle el Wordmark como enlace.

- [x] **~~Cálculo `available` negativo~~ — RESUELTO.** `getPlanUsage` saneó el cálculo en un solo lugar: `available = Math.max(0, limit - used)` y `over = Math.max(0, used - limit)` (verificado en `src/lib/utils/getPlanUsage.ts`), y ningún consumidor vuelve a restar suelto — el único que lo lee es la StatsCard del home. **El caso que lo disparaba ya no se puede producir por la vía del panel:** `changePlanAction` bloquea el cambio si las propiedades no entran en el plan destino. Sigue siendo alcanzable por un `UPDATE` manual del límite, y ahí `over` es el número que hay que mostrar.

---

## Pulido estético — juntar y hacer al final

> Bloque de acumulación deliberada: son ajustes visuales chicos que **no vale la pena hacer de a uno** (cada uno cuesta más abrir y verificar la pantalla que aplicar el cambio). Se juntan acá y se hacen en una sola pasada, después de que el modelo deje de moverse.

- [ ] **⚠ A 375 px el nombre de la ciudad se recorta por MENOS DE UN PÍXEL (medido el 10 sep 2026).** El encabezado de la home deja **147,8 px** para el `CityPicker` y "Santiago del Estero" necesita **148,7 px**: **faltan 0,9 px** y `truncate` se activa, comiéndose el último carácter contra los puntos suspensivos. **Desde 376 px entra completo**, así que afecta solo a los teléfonos de 375 px y menos (iPhone SE/mini; a 360 px faltan 15,9 y a 320 px, 55,9).
  Los anchos están **medidos, no estimados**: se cargaron los `.woff2` del build con `fontkit` y se aplicó la variación de peso a mano (eje `wght` → `avar` → deltas de `HVAR`). Marca 85,1 + puerta 86,1 + dos `gap-3` 24 = 195,2 de los 343 px útiles.
  **La salida evaluada y no tomada: acortar el texto del inicio de sesión** de *"Iniciar sesión"* (86,1 px) a *"Ingresar"* (53,2 px) — que es lo que decía antes de C3, y lo que sigue diciendo la variante del sitio de marca. Eso deja la puerta en 63,4 px y el selector con **170,5 contra 148,7: 21,8 px de sobra**, y baja el umbral por debajo de 320 px. **Se paga con la ambigüedad que "Iniciar sesión" vino a resolver**, que era medio motivo de existir de C3: "Ingresar" no dice para quién es. Es una decisión de producto, no de layout, y por eso quedó sin tomar.
  ⚠ **Contexto para no sobredimensionarlo:** con el reparto anterior de C3 —cuando el que quedaba en pantalla chica era el llamado— ese umbral estaba en **451 px**, o sea que **ningún teléfono** mostraba el nombre entero. La situación mejoró 75 px; lo que queda es el último píxel.

- [x] **~~Tamaños de botones~~ — HECHO (15 sep 2026).** Hay una escala de tres alturas (44 / 36 / 28) documentada en `DESIGN.md` §6 y en el propio `ui/button.tsx`, y todo botón por debajo de 44 px lleva área de toque extendida. Quedaba pendiente: la revisión pareja que este ítem pedía. ⚠ **Sumar a la lista el llamado del encabezado público** (`h-9`): es una desviación **consciente** de los 44 px, porque en un encabezado de 56 px un botón de 44 deja 6 px arriba y abajo y lee como un bloque que lo ocupa entero. Está anotada en DESIGN §11; al hacer la pasada pareja hay que decidir si la excepción se confirma o se unifica.
- [ ] Ir sumando acá lo estético que aparezca mientras tanto, en vez de resolverlo suelto.

---

## V2 / más adelante (del roadmap original)

- [ ] Modo oscuro (esfuerzo grande: rediseñar paleta y revisar contraste).
- [ ] Vista "Mis favoritos" (panel que liste todos los favoritos guardados).
- [x] ~~Página SEO por propiedad (`/propiedades/[slug]`) + Open Graph dinámico.~~ **HECHA como C2 (7–8 sep 2026)** — ver el ítem cerrado en la NUEVA FASE.
- [ ] **Enlazar el título de la propiedad en la pantalla de Consultas.** Hoy es texto plano en `/dashboard/leads`; se dejó sin enlace a propósito *"para no romper con un 404"*, y **ese motivo ya no existe**: la ruta `/propiedades/[slug]` está. ⚠ Antes de hacerlo hay que decidir dos cosas que la página nueva introdujo: la consulta puede apuntar a una propiedad **pausada o de agencia impaga**, que muestra el cartel de "ya no está publicada" (¿es aceptable para el agente, que sí puede verla en su panel?), y `leads` sigue sin traer el `slug` en su consulta, así que hay que agregarlo al select.
- [ ] Dashboard analytics (gráficos de consultas y propiedades más vistas — plan premium). ⚠ **El número crudo ya no es parte de esto**: desde el 14 sep 2026 las visitas y las consultas por propiedad se muestran en el listado **en todos los planes**, a propósito. Lo que queda para premium es el **análisis** (evolución, promedios, comparaciones). Dos cosas a saber antes de diseñarlo: **`has_metrics` hoy no gatea nada** (ningún componente lo consume, medido), y **`views_count` no guarda fechas**, así que cualquier evolución de visitas en el tiempo necesita otra tabla.
- [ ] Deduplicación de propiedades listadas por 2 agencias.
- [ ] Notificaciones por email al agente ante nuevo lead (Resend).
- [ ] "Dibujar zona" en el mapa (PostGIS `ST_Within`).
- [ ] "Propiedades similares".
- [ ] Tour virtual embed (YouTube/Matterport por propiedad).
- [ ] Nuevas ciudades (expansión del marketplace).
- [ ] Subdominio white-label (`agencia.marka.com.ar`) si una agencia grande lo pide.

---

## Cerrados recientemente (para referencia)

- [x] **PERMISOS DE `agents` Y `properties` — CERRADO (16 sep 2026).** Era la P0 de las inconsistencias acumuladas. `agents` quedó sin INSERT/DELETE para usuarios y con UPDATE solo sobre `full_name`/`phone_wa`/`avatar_url`; las policies de UPDATE de `agents`, ALL de `properties` y ALL de `property_images` ganaron `WITH CHECK` (la de `properties` fija agencia y ciudad). Ver la P0 arriba y `CLAUDE.md`.

- [x] **CONTADOR DE VISITAS — CERRADO (14 sep 2026), tres tandas.** `views_count` valía 0 en todas las propiedades: la función existía en la base y ningún camino del código la llamaba. **(1)** Visitas y consultas por propiedad en el listado del panel, separadas y en todos los planes, con las consultas en una sola consulta agregada. **(2)** El conteo desde tres lugares (pin, tarjeta de la lista, ficha pública con la primera interacción), una vez por propiedad por visitante, con `markVisited` devolviendo la señal. **(3)** La guarda de la base que impide que una visita mueva `updated_at`, que es lo que el mapa del sitio informa a los buscadores. El detalle, lo descartado y los seis ítems nuevos están en "Deuda técnica" → el ítem cerrado de `increment_views` y los que lo siguen.

  **Método, lo que dejó el grupo:** el primer intento de la guarda **falló sin que se supiera por qué**, y la evidencia parecía contradecirse —la función sellaba la fecha, y la comparación de columnas decía que solo cambiaban dos—. **Las dos observaciones eran ciertas**: dentro de un trigger BEFORE la columna generada `location` todavía no tiene su valor, y afuera sí. Quedó escrito en `CLAUDE.md` → "Método de Diagnóstico", junto a los otros patrones.

- [x] **GRUPO DE COHERENCIA DEL PANEL ENTERO — CERRADO (10–11 sep 2026), cinco tandas.** Nació chico —un cartel, un banner y una ruta— y **destapó el bug más caro medido hasta ahora**. Hilo común de las cinco: **el panel del agente afirmaba cosas que la base desmentía**.

  1. **Avisos de visibilidad** (10 sep) — el panel no decía cuándo las propiedades de una agencia no se estaban mostrando en el mapa: el listado se veía igual, el contador del plan se veía igual, y se enteraba recién si entraba a la pantalla de suscripción. Ahora hay un cartel en `/dashboard` con **tres motivos** y la garantía de que **nunca se muestran dos a la vez** (un solo `reason`, un ternario sobre él, y un `Exclude` en la prop que hace que el motivo equivocado **no compile**). Hizo falta `getVisibilityBlock`, espejo de `agency_is_publicly_visible()`, **distinto** del `getPublishBlock` que ya existía. Y se corrigieron los dos textos de `AgencyApprovalNotice`, que decían solo que no se podía publicar y **omitían que lo ya cargado tampoco se muestra**.
  2. **Banner de error unificado** (10 sep) — el mismo bloque estaba escrito a mano en cuatro pantallas y **las copias ya habían divergido**: dos con `mb-4` y dos sin. Se extrajo `src/components/feedback/ErrorBanner.tsx`, junto a `Notice`. ⚠ **El margen viene de afuera**, y la divergencia original **era comportamiento correcto**: dos pantallas lo tienen suelto en un fragmento y dos viven en un `space-y-6`.
  3. **`/register/plan` a la lista de rutas protegidas** (10 sep) — el comentario del proxy afirmaba que con `/dashboard` y `/admin` alcanzaba *"porque todas las pantallas del agente cuelgan de /dashboard"*, y era falso. ⚠ **El prefijo es `/register/plan` completo, nunca `/register`**: con `startsWith`, aquel habría vuelto privada la pantalla pública de alta. **No era un agujero**: la página se cortaba sola con `requireAgentSession()`. Es defensa en profundidad.
  4. **⚠ EL BUG GRANDE: pedir un plan mayor sacaba a la agencia del mapa** (11 sep) — el pedido escribía `status: 'pending'` y `agency_is_publicly_visible()` exige `'active'`. **Una agencia que quería pagar más se apagaba sola** hasta la activación manual. El arreglo fue **una línea** (dejar de escribir el estado) más **cinco correcciones obligatorias** y **una guarda nueva**. Ver el ítem siguiente y `CLAUDE.md` → "Un pedido de plan abierto".
  5. **Dos mensajes corregidos por el cupo del aterrizaje** (11–12 sep) — el cartel invitaba a *"seguí cargando tus propiedades"* con un cupo de **una**, y el mensaje del cupo lleno le proponía *"Pasá a Inicial para publicar más"*, que **no le destraba nada**.

  **Lo que se DESCARTÓ en el grupo, junto:**

  | Se descartó | Por qué |
  |---|---|
  | **Cambiar la regla de visibilidad de la base** para que aceptara `'pending'` | Habría dejado **visible a una agencia recién registrada que todavía no tiene nada activo** — el otro sentido del mismo estado. El problema no era la regla: era que el estado significaba dos cosas |
  | **Subir el cupo del estado de aterrizaje** | **Con una propiedad la agencia igual aprende a usar el formulario**, que es para lo que sirve ese cupo. Y el número es andamio del modelo (`PLANS.free`, y el `DEFAULT` de la columna), no una preferencia de producto: lo que estaba mal era el mensaje que prometía más |
  | **Reutilizar `getPublishBlock` para el aviso de visibilidad** | Falla en **dos direcciones opuestas**: le sobra el cupo lleno (esa agencia SÍ se ve) y le falta `plan <> 'free'` (el aterrizaje no bloquea nada y no se ve). Publicar y verse no son la misma pregunta |
  | **Resolver la sesión del encabezado en el servidor** (de la pieza 1 del grupo anterior, medido acá) | Volvería `/` de `○ Static` a `ƒ Dynamic`: renderizar en cada request la pantalla más visitada |
  | **Señalar el pedido de plan en el badge de estado del panel** | Sería reconstruir en la interfaz la confusión que el modelo acaba de resolver. El pedido ya tiene **su propia columna pegada** ("Plan · Pidió · Estado") y el filtro y la métrica ahora lo encuentran |

  **Lo que el grupo dejó abierto** (los cuatro ítems nuevos de abajo): la asimetría lista negra / lista blanca de la base, el valor del dominio que nadie escribe, el mensaje impreciso de la agencia que nunca eligió plan, y las familias de mensajes que siguen repetidas a mano.

  **Método, y es lo que más se repitió:** el bug grande estuvo escondido detrás de **tres afirmaciones falsas** —en la action, en el helper y en `CLAUDE.md`— que **se confirmaban entre sí**. Las tres eran **falsas a medias**: ciertas de *publicar* y falsas de *verse*. ⚠ Y al documentar el cierre apareció **una cuarta copia en `CLAUDE.md`**, en otra sección, que la tanda de implementación no había tocado. Quedó anotado en `CLAUDE.md` → "Método de Diagnóstico": **tres fuentes coincidiendo no son tres verificaciones, pueden ser una sola afirmación copiada.**

- [ ] **⚠ La base tiene DOS CRITERIOS OPUESTOS sobre el mismo estado, y hay que entenderlo antes de tocar cualquiera de los dos (anotado el 12 sep 2026; NO es un bug).** Medido en los cuerpos de las dos funciones:

  | Quién | Criterio | Con `'pending'` |
  |---|---|---|
  | `check_agency_subscription()` (trigger de publicación) | **lista negra**: `IF sub_status IN ('canceled','past_due')` | **publica normal** |
  | `agency_is_publicly_visible()` (regla de cobro) | **lista blanca**: `AND s.status = 'active'` | **no se ve** |

  **Es el comportamiento deseado, no una contradicción sin resolver:** una agencia recién registrada **puede ir cargando su cartera mientras espera la activación**, y aparece en el mapa cuando el plan se activa. Esa es toda la utilidad del cupo del aterrizaje.
  ⚠ **Lo que cambió es que dejó de morder.** Antes del arreglo del 11 sep, `'pending'` también alcanzaba a agencias que **ya pagaban**, y para ellas la asimetría significaba "podés cargar lo que nadie va a ver". Ahora el estado significa una sola cosa y la asimetría solo aplica a quien efectivamente no tiene nada activo.
  **Por qué queda anotado:** quien lea las dos funciones va a ver dos criterios distintos sobre la misma columna y va a querer "unificarlos". **Unificarlos rompe algo en cualquiera de las dos direcciones**: por lista blanca, una agencia nueva no podría cargar nada mientras espera; por lista negra, una recién registrada aparecería en el mapa sin tener nada activo.

- [ ] **⚠ `past_due` está en el dominio de `subscriptions.status` pero NO LO ESCRIBE NINGÚN CAMINO DEL CÓDIGO (medido el 12 sep 2026).** El CHECK admite cuatro valores —`CHECK (status = ANY (ARRAY['active','pending','past_due','canceled']))`— y el barrido de las escrituras da **seis sitios**, ninguno de los cuales escribe `past_due`: `registerAction` y las cuatro del panel escriben `active`/`canceled`, y `selectPlanAction` escribe `pending`. O sea que **hoy la columna tiene TRES valores producibles, no cuatro**.
  **Y sin embargo lo LEEN tres lugares**, todos correctos: el trigger de publicación (lista negra), `getPublishBlock` (misma lista) y `getVisibilityBlock` (lista blanca). También `requestPlanUpgradeAction`, que rechaza pedir un upgrade en ese estado.
  **No hay que sacarlo del dominio ni de los lectores:** es el estado natural de "el pago no entró", y cuando exista el cobro real (V2) va a ser lo primero que escriba el proveedor de pagos. **Queda anotado para que nadie lo trate como código muerto**, y para que quien implemente el cobro sepa que los lectores ya lo esperan.

- [ ] **La agencia que NUNCA eligió un plan lee un mensaje levemente impreciso, y se aceptó a propósito (anotado el 12 sep 2026).** Los dos mensajes del aterrizaje dicen *"cuando activemos tu plan"* / *"tu plan todavía no está activo"*, y para esa agencia **no hay ningún plan pendiente de activar**: llegó ahí por tocar "Decidir más tarde" en `/register/plan`, o porque el dueño le canceló la solicitud.
  **El dato para separarla existe** (`planUsage.status` vale `'pending'` si pidió un plan y `'active'` si no), y está declarado en el código. **Se eligió un solo texto por tres razones:** el cartel de `/dashboard` cubre las dos situaciones con un texto único a propósito, y las dos pantallas **tienen que contar la misma historia**; el enlace `Ver mi suscripción` cubre la diferencia (la que pidió ve su pedido en "Pendiente", la que no eligió ve los planes para elegir); y es el caso raro.
  ⚠ **Si algún día se separan, hay que partir TAMBIÉN el texto del cartel de la home**, o vuelven a contradecirse — que es el defecto que esta tanda cerró.

- [ ] **Quedan TRES FAMILIAS de mensajes repetidos a mano, de otra clase que la que se unificó (contadas el 12 sep 2026).** El `ErrorBanner` que se extrajo era el **banner de pantalla**, descartable y con ✕. Estas tres son otra cosa y **no se tocaron a propósito**:

  | Familia | Ocurrencias | Dónde |
  |---|---|---|
  | **Error de formulario** — `<p className="font-sans text-sm text-error">` pelado, sin caja ni cierre | **6** | `ProfileForm` (×2), `AgencyLogoForm`, `AgencyPhoneForm`, `AgencyIdentityForm`, el alta de `TeamContent` |
  | **Éxito** — `<p className="font-sans text-sm text-success">`, idénticas en clases | **6** | `AgencyPhoneForm`, `AgencyLogoForm`, `ProfileForm` (×2), `AgencyIdentityForm`, `PreferencesContent`. **Cuatro con el texto embebido** y dos con variable |
  | **Error con fondo, sin borde ni cierre** (`px-3 py-2`) | **4** | `LoginForm`, `RegisterForm`, `PlanSelector` (que además le suma `mt-5`) y `PropertyForm` (con `px-4 py-3`) |

  **Total: 16 ocurrencias en tres moldes.** ⚠ **Conviene resolverlas juntas**, porque los éxitos y los errores de formulario **conviven en el mismo archivo a dos líneas de distancia** (`ProfileForm:235`/`:238`, `AgencyIdentityForm:148`/`:150`): extraer solo la mitad deja medio patrón factorizado y medio a mano, que es exactamente cómo empezó la divergencia del banner.
  **El molde para arreglarlo ya existe**: `ErrorBanner`, con el margen desde afuera y el `null` cuando no hay mensaje.

- [x] **GRUPO DE CAPTACIÓN Y DIFUSIÓN ENTERO — CERRADO (7–10 sep 2026), tres piezas.** Estaba esperando a C3 desde el 8 sep. **Hilo común de las tres: la app pública era muda hacia afuera** — una sola dirección para todo el marketplace, ninguna forma de mandarle a alguien una propiedad concreta, y ni una línea que le hablara a una inmobiliaria.

  1. **C2 · Página propia por propiedad** (7–8 sep) — `/propiedades/[slug]`, Server Component indexable, con mapa del sitio y `robots.txt`. Leída con **service role** porque con las policies los tres estados son indistinguibles y el resultado dependería de quién mire; la regla de cobro se pregunta a la base **por RPC** para no escribirla en tres lugares. Galería y mapa sin una línea de JavaScript.
  2. **D2 · Quién publica** (7 sep) — logo y nombre de la inmobiliaria más el nombre del agente, en el modal y en la ficha. Embebido en la consulta que el modal **ya hacía**, sin tocar la query caliente del mapa.
  3. **C3 · La puerta de captación** (10 sep) — el enlace "Ingresar" del encabezado, que no decía para quién era, pasó a ser "Sumá tu inmobiliaria" + ingreso secundario. Ver el ítem cerrado arriba.

  **Lo que se descartó en el grupo, junto:** una pantalla intermedia que explique la propuesta (es una pieza propia); la captación en el sitio de marca (usa el espacio que paga un cliente para captar a su competencia de la misma ciudad) y en la ficha de propiedad (rompe su renderizado íntegro en servidor); el terracota para el llamado (ya lo usa el FAB del mapa); una imagen generada para la vista previa (peor que la foto real de la casa); y resolver la sesión en el servidor (volvería dinámica la home).

  **Lo que el grupo dejó abierto, y no es deuda escondida:** **C4** (la captación no se ve en el celular — consecuencia deliberada, con la alternativa del pie de la lista anotada), el subclaim oculto en pantallas chicas, el estado "sin ciudades" sin encabezado, y el último píxel del nombre de la ciudad a 375 px. Los cuatro están arriba con su medición.

  **Método, lo que más se repitió:** las tres piezas empezaron **midiendo antes de escribir**, y las tres encontraron que el archivo decía cosas que el código no. En C3 el hallazgo caro fue una **duplicación con divergencia ya iniciada** que ningún documento mencionaba: el mismo enlace en dos archivos, la detección de sesión copiada carácter por carácter, y `shrink-0` en una copia y no en la otra. **Era inofensiva solo porque el texto era corto** — o sea, inofensiva hasta exactamente la tanda que venía a alargarlo.

- [x] **GRUPO DE BLINDAJE ENTERO — CERRADO (5–7 sep 2026), cinco tandas.** No tenía encabezado propio en este archivo (los ítems vivían repartidos entre "Deuda técnica" y el grupo de Storage); queda cerrado acá. Causa raíz común de las cinco: **reglas que vivían solo en el código, donde se olvidan, en vez de en la base o en un mensaje que se entienda.**

  1. **Policies finas de `storage.objects`** (5 sep) — de tres laxas + una fina a cuatro finas, acotadas a `authenticated`, con frontera por AGENCIA para propiedades y logos y por USUARIO para avatares, vía `auth_agency_id()`.
  2. **Límites del bucket** (5 sep) — `file_size_limit` 5 MB y `allowed_mime_types` PNG/JPG/WEBP pasaron de `NULL` al motor: el "no SVG, riesgo XSS" del formulario dejó de ser la única barrera.
  3. **Borrado de archivos en los caminos que lo generaban** (6 sep) — borrar una propiedad borra sus fotos, borrar un agente borra **solo su avatar**, y el borrado desde el formulario dejó de ignorar el error. Con el util `storagePath.ts` extraído y su fallback arreglado.
  4. **Herramienta de auditoría de huérfanos** (6 sep) — `scripts/storage-orphans.ts`, simulación por defecto y regla de 24 h. El bucket pasó de 24 objetos / 6,4 MB (89 % basura) a **9 objetos / 707 kB y cero huérfanos**.
  5. **Suscripción garantizada + matrícula explicada** (7 sep) — el trigger `trg_ensure_agency_subscription` vuelve improducible el estado "agencia sin suscripción"; `getPlanUsage` se alineó con la base (límite 0); el pedido de cambio de plan dejó de informar éxitos falsos; y el choque de matrícula al aprobar ahora nombra la matrícula y explica la regla. Ver los dos ítems cerrados en "Deuda técnica".

  6. **La consulta sobrevive al agente** (7 sep) — `leads.agent_id` pasó a nullable con `ON DELETE SET NULL` y se sumó `leads.agent_name`, una **copia congelada** que escribe el trigger `trg_set_lead_agent_name` y **nunca el cliente** (el camino es público y anónimo, la tabla no tiene CHECKs y la policy no puede validar texto). Cierra el bug de que no se pudiera borrar un agente con consultas a su nombre. En la misma tanda: el `insert` del lead **dejó de fallar en silencio** en el mapa público —captura el error y avisa, pero **el WhatsApp se abre igual**, porque la operación principal es el contacto, no el registro— y el aviso previo al borrado de un agente **ahora dice también qué pasa con sus consultas**. Probado de punta a punta con un agente real. Ver el ítem "LAS DOS FK DE `agent_id`".

  **Lo que quedó abierto a propósito, y no es deuda del grupo:** la vía irreducible de huérfanos nuevos (Storage y Postgres no se pueden transaccionar juntos), los archivos de un alta abandonada, la decisión de producto sobre las URLs públicas, el residuo del mensaje con límite 0, y el **estado no atómico del borrado de agentes** (cerrarlo exige reordenar o compensar pasos, que es un cambio de comportamiento). Los cinco están arriba con su explicación.

  **Método, que es lo que más se repitió:** en las cinco tandas aparecieron afirmaciones —en comentarios del código y en estos .md— que la base desmentía. La más cara fue un *"ese caso ya lo bloquea el límite 0"* en un archivo cuyo límite era 1: **el comentario era la razón por la que nadie volvía a mirar el caso.** Quedó anotado en `CLAUDE.md` → "Método de Diagnóstico".

- [x] **BLOQUE B entero — modelo de la propiedad (3 sep 2026), en tres tandas.** B3 (venta y alquiler a la vez: tres pares simétricos de columnas, moneda por operación, alquiler temporal como operación propia, `price_negotiable` eliminado), B1 (precio opcional = "a convenir", y las propiedades sin precio quedan fuera del filtro de rango) y B2 (requisitos de alquiler: lista cerrada de siete + hasta 5 libres, validados en las tres capas a diferencia de `amenities`). **El detalle de qué se descartó y por qué está arriba, en el BLOQUE B.** Las cuatro columnas viejas (`operation_type`, `price`, `currency`, `price_negotiable`) ya se eliminaron de la base. Tres trampas medidas quedaron documentadas en `CLAUDE.md`: el CHECK que evalúa a NULL se considera satisfecho, el diff por ids del cluster no detecta un cambio de precio por filtro, y el Enter en un input dentro de un `<form>` envía el formulario.

- [x] **Cambiar el plan de una agencia desde el panel (1 sep 2026).** `changePlanAction` + panel inline con selector de plan destino, consecuencias listadas (límite nuevo, funciones que gana y pierde) y campo de vencimiento **precargado**. Reglas: se aplica **directo** (no pasa por `pending_plan`), **se bloquea si las propiedades exceden** el límite del destino —con los números y sin pausar nada automáticamente—, **no se le cambia el plan a una agencia dada de baja** (se pisaría la memoria de a qué reactivar) ni a una con solicitud sin resolver, y el vencimiento vacío **borra** (al revés que en la activación). `PAID_PLANS` subió a `types/index.ts` porque ya hacían falta tres copias de la misma derivación. Valor `plan_changed` agregado al CHECK de `agency_reviews` (aplicado y ya usado: 3 filas). ⚠ **Lo único que NO se pudo probar de punta a punta es el bloqueo por exceso**: ninguna agencia real llega al límite del plan más chico (20 propiedades; la que más tiene está muy por debajo), así que probarlo requiere **fabricar datos** — cargar ~21 propiedades de prueba en una agencia o bajarle el `property_limit` a mano. Se verificó la lógica y el conteo (`getPlanUsage`, mismo criterio que `check_property_limit()`), no el camino completo en pantalla.

- [x] **Panel `/admin` de ida y vuelta (31 ago 2026).** Cuatro acciones nuevas: cancelar solicitud de plan, fecha de vencimiento al activar, dar de baja / reactivar, y eliminar agencias vacías. Ver la sección "Panel admin de ida y vuelta" arriba para las reglas de cada una. Además: `availableActions` como fuente única de qué acción aplica a una fila (antes estaba duplicado y la copia de mobile se había desincronizado: una agencia aprobada con plan activo no mostraba **ningún** botón en el celular), reparto botones/menú `⋯` por naturaleza de la acción, y categoría propia para las dadas de baja en los filtros.

- [x] **Visibilidad pública por agencia (31 ago 2026).** La regla de cobro: `agency_is_publicly_visible()` + tres policies (properties, property_images, leads) + alineación del sitio de marca por RPC. Detalle completo en el BLOQUE A-bis, arriba.

- [x] **Tres correcciones encontradas probando a mano (31 ago – 1 sep 2026).**
  1. **El botón de publicar mostraba el mensaje equivocado a una agencia dada de baja** ("alcanzaste el límite de tu plan Gratis, pasá a Inicial"). ⚠ **La causa NO era el orden de los motivos** —ya era correcto, en `getPublishBlock` y en los triggers— **sino un consumidor con un ternario binario**: `NewPropertyButton` preguntaba "¿es `not_approved`? si no, mostrá el de cupo", y el motivo nuevo caía en el `else`. Se reemplazó por un `switch` con guarda `never`: **agregar un motivo sin mensaje ya no compila**. Lección: un reparto binario sobre un tipo que va a crecer es una bomba de tiempo silenciosa.
  2. **La pantalla de suscripción del agente no se enteraba de la baja**: solo preguntaba por `'pending'`, así que `canceled`/`past_due` caían en la misma rama que una suscripción sana y la agencia veía **su plan viejo como vigente, con su fecha de vencimiento y sin un solo aviso**. Ahora avisa (`Notice` en tono `warning`, no `error`: puede ser una baja acordada), **oculta la fecha** y **no ofrece upgrades**.
  3. **Y ahí apareció un agujero real:** `requestPlanUpgradeAction` escribía `status: 'pending'` **sin mirar el estado previo**, así que una agencia dada de baja **se sacaba la baja sola** —`'pending'` no bloquea la publicación— y volvía a publicar sin que el dueño hiciera nada. **Se cerró en la server action**, no solo escondiendo los botones: una action se invoca sin pasar por el render.
  4. (Bonus) **La confirmación por nombre al eliminar** exigía coincidencia exacta mientras el cartel mostraba el nombre **en mayúsculas** por el `uppercase` del `Label`: escribir literalmente lo que la pantalla indicaba no funcionaba. Ahora ignora mayúsculas y espacios de los bordes (no los internos ni los acentos).

- [x] **MCP de Supabase conectado (27 ago 2026)** — server remoto hosted (`https://mcp.supabase.com/mcp`, transporte HTTP, OAuth), configurado en `.mcp.json` con `--scope project`. **Acotado al proyecto (`project_ref`) y en `read_only=true`**: toda escritura rebota en el motor con `cannot execute UPDATE in a read-only transaction` (verificado con un `UPDATE ... WHERE false`). Grupos habilitados: `database`, `debugging`, `development`, `docs`; deshabilitados a propósito storage, branching, edge functions y gestión de cuenta. Consecuencia de método: **Claude Code mide la base solo**, ya no hace falta pasarle queries por chat; los `ALTER` los sigue corriendo el dueño a mano en el SQL Editor (ahora impuesto por la base, no por convención). `respuesta.md` agregado al `.gitignore`. Documentado en `CLAUDE.md` → "Acceso a la base".

- [x] **A2 · Matrícula + aprobación manual + bloqueo de publicación + sesión unificada (28 ago 2026).** La tanda más grande hasta ahora. **(1) Modelo:** `agencies.license_number` (TEXT, matrícula del colegio) y `agencies.approval_status` (`pending`/`approved`/`rejected`, DEFAULT `pending`), más la tabla `agency_reviews` con el historial de decisiones (RLS habilitada, CERO policies: solo service role). Las 10 agencias existentes se backfillearon a `approved` sin matrícula. **(2) Alta:** el registro pide matrícula obligatoria y la agencia nace pendiente por el DEFAULT (el código NO escribe `approval_status`, para que el alta no pueda auto-aprobarse). Se agregó el rollback del usuario de Auth. **(3) Panel `/admin` rehecho:** la lista ahora parte de `agencies` (antes partía de `subscriptions`, así que una agencia sin suscripción era invisible justo en la pantalla donde se la aprueba), con columnas de matrícula y aprobación, dos ejes de filtros independientes, y acciones de aprobar / rechazar (con nota, en un panel inline) / volver a pendiente. **(4) Bloqueo de publicación:** dos triggers en la base (`trg_check_agency_approved` y `trg_check_property_limit` actualizada), y los **cuatro** puntos de entrada al alta gateados por `getPublishBlock` — antes solo uno tenía gate, y solo por límite de plan. **(5) Aviso de estado** en el panel (`Notice` + `AgencyApprovalNotice`), con el motivo del rechazo leído de `agency_reviews`. **(6) Edición de nombre y matrícula** en Preferencias, habilitada solo si la agencia no está aprobada; guardar con la agencia rechazada la devuelve a `pending` (es el reenvío). **(7) Sesión unificada:** `resolveAgentSession` reemplazó la consulta duplicada en 21 lugares, y con eso se cerró el bucle de redirecciones (ver Deuda técnica). Los porqués de cada decisión están en `CLAUDE.md`.

- [x] **A1 · App solo-agencias + guarda de reentrada en `/register/plan` (27 ago 2026).** Dos cosas en una tanda. **(1) Eliminados los particulares:** fuera el toggle de tipo de cuenta del registro, `agencyName` siempre requerido (con `.trim()`), `tenant_type: 'agency'` fijo desde el servidor, redirect siempre a `/register/plan`, el selector de plan ofrece **solo los tres pagos** (`PAID_PLANS` derivado de `PLAN_ORDER`, sin tocar el dominio de la columna), `PLANS.free.name` pasó de "Particular" a "Gratis" y se eliminó `PlanInfo.tenantType` (nadie lo leía). **Sin ningún cambio de base**: se verificó por consulta que la única agencia `individual` estaba vacía (0 propiedades, 0 leads) y que **nada en la base lee `tenant_type`** (cero triggers/funciones/policies). La columna y el tipo `TenantType` sobreviven a propósito. **(2) Arreglado un bug serio encontrado en el diagnóstico:** `/register/plan` quedaba accesible para siempre y su action escribía `plan: 'free'` + límites de free **incondicionalmente** → una agencia con plan pago activo que volviera a esa URL se auto-degradaba (perdía white-label, quedaba sobre el límite), sin confirmación ni vuelta atrás. Cerrado con la guarda de "aterrizaje virgen" (`plan free` + `pending_plan null` + `status active` + fila existente) **en la página y en la action**, más rechazo explícito de `'free'` como plan entrante. Efecto lateral aceptado: cambiar un pedido pendiente ahora requiere al dueño (ver "Panel admin de ida y vuelta"). Verificado a mano en navegador: registro, validación de nombre en blanco, guarda que deja pasar el alta virgen y rebota los otros tres estados, activación desde `/admin`, white-label y etiquetas nuevas.

- [x] Roles de agente (`agents.role`) — migrado + backfill.
- [x] Policy `Admin reads agency leads`.
- [x] `agencies.tenant_type` (inmobiliaria/particular) — migrado.
- [x] Flujo de registro: crea agencia real + agente admin + suscripción free (adiós hardcodeo demo).
- [x] Bug visual del toggle en el split-screen del registro (sticky panel).
- [x] Consolidación de migraciones (repo refleja la base real).
- [x] Selección de plan post-registro (paso 2, free instantáneo / pago pending).
- [x] Panel de admin `/admin` — activar planes pending, gateado por `ADMIN_USER_ID`.
- [x] Panel `/admin` mejorado: tabla de todas las agencias + filtros aditivos + fecha de activación (`activated_at`) + acceso desde el sidebar (solo dueño).
- [x] "Mejorar plan" funcional desde el dashboard (pide upgrade → pending → botón "Pendiente").
- [x] Modelo `plan` (lo que rige) vs `pending_plan` (lo pedido) — separados en columnas distintas; el plan pedido ya no pisa el que rige. Coherencia en badge/dashboard/bloqueo de "Nueva propiedad".
- [x] Multi-agente · sub-pieza 1: el admin de agencia crea agentes (con contraseña temporal, vía `createUser` service role) y ve la lista de su equipo en `/dashboard/equipo`. Gateado por `role === 'admin'` server-side. Columna `agents.email` denormalizada + ítem "Equipo" en el sidebar (solo admin).
- [x] Pantalla de Consultas (`/dashboard/leads`): lista los leads, diferenciada por rol vía RLS (admin ve los de la agencia, agente los suyos). Tipo `Lead` extendido con relaciones `agent`/`property`. Ítem "Consultas" en el sidebar (ambos roles).
- [x] Panel del dueño mejorado: 6 métricas de negocio (StatsCard) arriba de la tabla de agencias en `/admin`. Además, `/admin` ahora usa el sidebar del dashboard (layout propio con gating centralizado de `ADMIN_USER_ID`; "Panel admin" se resalta activo).
- [x] Multi-agente · sub-pieza 2 (Paso 1): el admin gestiona (edita/elimina/cambia estado de) las propiedades de toda su agencia. Helper `authorizePropertyAccess` (owner/admin, elige el client de escritura); listado por `agency_id` con columna "Agente" para el admin. Service role + validación, sin tocar policies RLS. Probado: agente normal no toca lo ajeno, nadie cruza agencias.
- [x] Multi-agente · sub-pieza 2 (Paso 2): el admin reasigna el `agent_id` de una propiedad a otro agente de su agencia, desde el `PropertyForm` (crear y editar). Helper `resolveAssignedAgent` con 3 barreras server-side (rol admin, destino dentro de la agencia, datos del server). Service role al reasignar (incluso reasignando propia propiedad, por el WITH CHECK implícito de la RLS). Probado + query de invariante (0 propiedades cruzadas).
- [x] Home del dashboard diferenciado por rol: las 4 métricas + últimas propiedades filtran por `agency_id` si el user es admin (toda la agencia) o `agent_id` si es agente (lo suyo). Cierra la sub-pieza 2 de multi-agente. Solo lecturas, vía un `scope` reusado en las queries.
- [x] `agencies.phone_wa` (NOT NULL): WhatsApp obligatorio de la agencia. Migrado (nullable → backfill con el del admin fundador → NOT NULL). Se setea en el registro (hereda el del admin) y se edita en Preferencias (solo admin, `updateAgencyPhoneAction` service role). Agregado al tipo `Agency`.
- [x] Multi-agente · sub-pieza 3: el admin elimina (borrado real) un agente de su agencia (`deleteAgentAction`). **Modelo B**: las propiedades del agente se reasignan al admin ANTES de borrar (nunca quedan huérfanas), después `deleteUser` cascadea sobre la fila de `agents`. ⚠ **DOS VUELTAS SOBRE LOS LEADS, y la segunda cierra el tema.** (a) Este ítem decía originalmente que los leads viejos quedaban **a NULL como historial**; medido el 1 sep 2026 resultó **falso** —`leads_agent_id_fkey` no tenía cláusula `ON DELETE` y la columna era **NOT NULL**—, así que el borrado **chocaba** contra esa FK si el agente tenía consultas. (b) **RESUELTO el 7 sep 2026**: la columna pasó a nullable y la FK a `ON DELETE SET NULL`, más una copia congelada del nombre en `leads.agent_name`. O sea que lo que el ítem afirmaba de más terminó siendo verdad, pero recién después de migrarlo a propósito — no estaba describiendo la base, estaba describiendo un deseo. Ver el ítem "LAS DOS FK DE `agent_id`" en Deuda técnica. Barreras: no auto-borrarse, ser admin, target de la misma agencia. Como las propiedades nunca quedan huérfanas, NO hizo falta el fallback de WhatsApp ni tocar la policy del lead (se evaluaron y se descartaron por el Modelo B). Probado + invariante (0 huérfanas, 0 cruzadas).
- [x] **White-label · Sub-pieza A**: ruta pública `/[slug]` (root, exclusivo de agencias) que muestra el mapa filtrado a UNA agencia. `resolveAgencyBySlug` (service role, 3 estados not_found/disabled/active), `AgencyMapView` (mirror de la home sin CityPicker), `AgencyUnavailable` (página "sitio no disponible"), `agencyId` opcional en `useProperties`/`MapView`/`PropertyList`. Sin personalización (eso es B). Probado: 404 / no-disponible / mapa filtrado, con contraste de 2 agencias en la misma ciudad. Decidido: la ruta de ciudad (si alguna vez se hace) va con prefijo `/ciudad/[slug]`, no en el root.
- [x] **Fix viewport mobile**: la navbar superior se scrolleaba fuera de vista al enfocar (zoom de Leaflet o input de WhatsApp). Causa raíz: `h-screen` (`100vh`) dejaba el documento scrolleable en mobile + header en flujo normal. Arreglo parejo en toda la app: `h-screen`→`h-dvh` en todos los wrappers de pantalla completa + lock de scroll del documento (`html, body { overflow: hidden }`). `AuthLayout` (login/register) era el único que dependía del scroll del documento → se le dio contenedor scrolleable propio (`h-dvh overflow-y-auto` + centrado por `m-auto`), preservando el sticky del split-screen (DESIGN §14). Tailwind v4 trae `h-dvh` nativo. Probado en mobile real (los 2 disparadores + register + scroll interno del dashboard).
- [x] **White-label · Sub-pieza B1**: subir el logo de la agencia en Preferencias (admin-only). `AgencyLogoForm` (upload client-side a `logos/{agency_id}/logo.{ext}` con `upsert`) + `updateAgencyLogoAction` (gate admin + service role persiste `logo_url`). Validación real (PNG/JPG/WEBP, no SVG, máx 2 MB), extensión del MIME, cache-buster en preview. El logo aún NO se muestra en el white-label (eso es B2). Probado: subir, persistir tras reload, reemplazar N veces, validaciones de tipo y tamaño.
- [x] **Arreglo policy UPDATE de Storage**: al reemplazar avatar/logo daba 403 "new row violates row-level security policy". Causa: un `upsert` sobre archivo existente es un UPDATE, y **no existía policy de UPDATE** en `storage.objects` (solo INSERT/DELETE/SELECT) → RLS lo negaba por defecto. La primera subida (INSERT) sí pasaba; el reemplazo (UPDATE) no. Arreglado agregando policy de UPDATE laxa (cualquier `authenticated`, igual que el INSERT). Corrido a mano en Supabase. NO confundir con el problema de loop del dashboard (ese fue por borrado manual de la agencia, no por Storage). La seguridad fina de las policies quedó como deuda, **cerrada el 5 sep 2026** (ver "Seguridad fina de las policies de Storage" en Deuda técnica). ⚠ **Este ítem es exacto y NO hay que confundirlo con lo que otras notas dedujeron de él:** acá se AGREGÓ una policy de UPDATE; **no se reemplazó la de DELETE**, que siguió siendo la única fina del bucket hasta el 5 sep 2026.
- [x] **White-label · Sub-pieza B2a**: logo + nombre de la agencia en el header del white-label. `AgencyMapView` recibe `agencyName`+`agencyLogoUrl`; `resolveAgencyBySlug` trae `logo_url` en `active`. Logo izquierda (`object-contain`, altura fija, tolera cualquier proporción), nombre centro (visible en mobile, `text-base sm:text-lg`); sin logo → nombre a la izquierda. "Powered by Marka." discreto al pie (`size="xs"` nuevo del Wordmark, aditivo). La marca de la agencia no es link. Probado en reunión real con el rubro. B2b (variante admin) y C (slug editable) quedaron EN PAUSA por los cambios de modelo entrantes.
