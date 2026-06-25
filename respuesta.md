# White-label Sub-pieza B2a — Logo + nombre de la agencia en el header

> Implementado. La marca de la agencia (logo o nombre) ahora aparece en el header
> del white-label, con un "Powered by Marka." discreto al pie. NO incluye la
> variante admin en `disabled` (eso es B2b). `tsc --noEmit` y `lint` limpios
> (los 2 únicos warnings de lint son los preexistentes y cosméticos de CLAUDE.md).

---

## Archivos tocados

1. **`src/lib/utils/resolveAgencyBySlug.ts`** — agregado `logo_url` al `.select`, al
   type `AgencyRow`, al `Pick<>` del retorno `active` y al objeto `agency`. También
   actualicé el comentario de "campos no sensibles" para listar `logo_url`. El estado
   `disabled` NO se tocó (sigue `{ status: "disabled" }` pelado → se ensancha en B2b).
2. **`src/app/(public)/[slug]/page.tsx`** — el caso `active` ahora pasa también
   `agencyName={result.agency.name}` y `agencyLogoUrl={result.agency.logo_url}`.
3. **`src/components/map/AgencyMapView.tsx`** — props nuevas (`agencyName: string`,
   `agencyLogoUrl: string | null`), header reescrito con la marca de la agencia, y el
   bloque "Powered by Marka." al pie.
4. **`src/components/brand/Wordmark.tsx`** — agregado `size="xs"` (aditivo) a
   `SIZE_CLASSES` y a la union del prop `size`. Tamaños existentes intactos.

No se tocó la home, ni el modal, ni `AgencyUnavailable`, ni la sesión de la ruta, ni
el estado `disabled`, ni la validación de subida del logo (B1).

---

## Cómo se resolvió el dimensionamiento del logo (clases exactas)

En el slot izquierdo del header (`h-14` = 56px):

```jsx
<img
  src={agencyLogoUrl}
  alt={agencyName}
  className="h-9 w-auto max-w-[160px] object-contain"
/>
```

- **`h-9`** (36px): altura fija, deja ~10px de aire arriba/abajo dentro del header.
- **`w-auto`**: el ancho sigue la relación de aspecto del logo.
- **`object-contain`**: el logo entra completo en la caja sin deformarse, cualquiera
  sea su proporción (horizontal ocupa más ancho, cuadrado menos, vertical queda chico
  y centrado). **La altura del header NUNCA cambia.**
- **`max-w-[160px]`**: red de seguridad para logos muy horizontales — se acotan en
  ancho (object-contain los reescala) y no empujan al nombre del centro fuera de vista.

El header tiene `gap-3` entre slots (margen entre logo y nombre del centro). El slot
izquierdo es `flex items-center min-w-0` para que el `truncate` del nombre funcione
cuando NO hay logo.

**Nombre de la agencia (texto, Noto Serif):**
- Izquierda (cuando NO hay logo): `font-serif text-xl font-semibold text-black truncate`
- Centro (solo cuando SÍ hay logo): `hidden sm:block font-serif text-lg font-semibold text-black truncate`
  - El `hidden sm:block` evita que en pantallas muy chicas el nombre del centro
    compita con el logo + CTA; en `sm+` aparece. Nunca se duplica el nombre (centro
    solo si hay logo a la izquierda; si no hay logo, el nombre va a la izquierda y el
    centro queda vacío).

El header conserva las MISMAS clases base que la home para coherencia estructural
(`relative h-14 flex items-center justify-between ... px-4 md:px-6 bg-paper border-b
border-stone shrink-0 z-50`), con `gap-3` agregado para separar los slots.

---

## Dónde se ubicó el "Powered by Marka."

```jsx
<div
  className="pointer-events-none fixed left-1/2 z-[600] flex -translate-x-1/2 items-center gap-1 rounded-sm bg-paper/80 px-2 py-0.5 backdrop-blur-sm"
  style={{ bottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
>
  <span className="font-sans text-xs text-graphite">Powered by</span>
  <Wordmark size="xs" variant="dark" />
</div>
```

- **Posición: centrado al pie** (`fixed left-1/2 -translate-x-1/2`, `bottom` con
  safe-area). Elegido porque deja libres los dos rincones inferiores donde viven los
  FABs mobile (`left-4` filtros / `right-4` ver lista-mapa) y la atribución de Leaflet
  (bottom-right), y el zoom de Leaflet (top-left). No tapa ninguno.
- **`z-[600]`**: por debajo de los FABs (`z-[610]`) y del modal, por encima de los
  panes del mapa.
- **`pointer-events-none`**: no roba clicks al mapa (es atribución, no control).
- **`bg-paper/80 backdrop-blur-sm`**: pastilla discreta legible sobre el mapa, estilo
  atribución (como el "powered by" de Google Maps).
- Texto **"Powered by"** en DM Sans `text-xs` `text-graphite` (discreto) + el Wordmark
  "Marka." con su punto terracota.
- **Siempre presente**, haya logo o no.

---

## Qué `size="xs"` se eligió

`xs: "text-sm"` (14px) en `Wordmark`. Razón: junto al "Powered by" en `text-xs`
(12px graphite), el wordmark a 14px bold serif queda discreto pero con la leve
jerarquía que corresponde a la marca, sin gritar. Cambio aditivo: `sm`/`md`/`lg`
intactos.

---

## Pruebas a ejecutar (no las corrí yo)

1. **Agencia con logo:** entrar a `/[slug]` de una agencia con `has_white_label =
   true` y `logo_url` cargado (la demo si le subiste logo en B1). Header: LOGO a la
   izquierda + NOMBRE en el centro (en `sm+`). El logo no se deforma ni cambia la
   altura del header.
2. **Agencia sin logo:** `logo_url = null` (o una agencia white-label sin logo).
   Header: solo el NOMBRE a la izquierda, centro vacío. Sin Wordmark de Marka arriba.
3. **Proporciones del logo:** probar un logo horizontal y uno cuadrado. La altura del
   header se mantiene (`h-9`); el ancho varía y se acota en 160px. Nada se rompe.
4. **Powered by Marka:** visible y discreto, centrado al pie, sin tapar FABs ni zoom,
   en ambos casos (con y sin logo). En mobile respeta el safe-area inferior.
5. **La home NO cambió:** abrir `/` — Wordmark de Marka + CityPicker + CTA, igual que
   antes.
6. **`disabled` NO cambió:** una agencia sin `has_white_label` sigue mostrando
   `AgencyUnavailable` genérico.
7. **`npx tsc --noEmit`** ✅ limpio. **`npm run lint`** ✅ 0 errores (solo los 2
   warnings cosméticos preexistentes de `RegisterForm.tsx` y `PropertyForm.tsx`,
   documentados en CLAUDE.md — ninguno introducido acá).

---

## Cosas distintas de lo esperado / decisiones tomadas

- **Nombre del centro oculto en pantallas muy chicas (`hidden sm:block`):** no estaba
  pedido explícito, pero con logo + nombre + CTA en un header `h-14` a 360px de ancho
  el nombre del centro apretaba al CTA. En `sm+` (640px) aparece. La izquierda (logo
  o nombre) y el CTA están siempre. Si preferís el nombre del centro también en mobile
  con logo, es quitar `hidden sm:block` — avisame.
- **La marca de la agencia NO es un link.** La home envuelve su Wordmark en
  `Link href="/"` (volver al mapa general). Acá eso llevaría al marketplace de toda la
  ciudad, lo cual contradice el sentido white-label (mostrar SOLO esta agencia). Dejé
  la marca de la agencia como elemento presentacional, sin link. (El "Ir al panel" /
  "Ingresar" del CTA sigue igual.)
- **`logo_url` no se ensanchó en `disabled`** (correcto para B2a): el header con marca
  solo aplica al estado `active`; `disabled` se aborda en B2b.
