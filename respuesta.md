# Corrección del comentario del transform en PropertyForm.tsx

Hecho. **Un solo archivo, un solo comentario, cero líneas de código.**

Baseline idéntico, hasta el número de línea del warning: **0 errores de TypeScript, 0 errores
de lint con 1 warning en `PropertyForm.tsx:524`, build verde con 19 rutas.** No se ejecutó
ningún comando de git ni ningún SQL de escritura.

---

## 1. Qué decía y qué dice

El comentario vivía en la regla (3.b) del `transform` del schema, la que manda la moneda a
null cuando la operación está marcada pero no tiene precio.

**Antes** (7 líneas), afirmaba que la base *no* rechaza ese par y que la barrera era el
formulario:

> `⚠ MEDIDO: ese par NO lo rechaza la base. El CHECK properties_<op>_price es "(precio IS NULL
> AND moneda IS NULL) OR (precio > 0 AND moneda IN (...))", y con precio NULL y moneda 'USD'
> evalúa a (FALSE OR NULL) = NULL — y un CHECK que da NULL se considera satisfecho. O sea que
> el dato sucio entraría en silencio, por un accidente de la lógica de tres valores y no
> porque esté permitido. La barrera real es esta línea.`

**Ahora** (7 líneas, mismo largo):

> `La BARRERA de ese par inconsistente es la BASE, no esta línea: los CHECK
> properties_sale_price, properties_rent_price y properties_temp_rent_price rechazan las dos
> direcciones (moneda sin precio y precio sin moneda). Esto normaliza ANTES de enviar para que
> el agente no se coma un error de la base por algo que la interfaz resuelve sola: es
> conveniencia, y por eso se conserva.`

Cubre los tres puntos pedidos: dónde está la barrera hoy (la base), cuál es el rol que le
queda al `transform` (normalizar antes de enviar; conveniencia, no barrera) y **los tres
constraints nombrados** para que quien lea sepa dónde mirar.

Cambié además una palabra de la línea anterior del mismo bloque: *"sin esto se **guardaría**
una moneda sin precio"* → *"se **enviaría**"*. El formulario no guarda, envía; y ahora que la
base rechaza ese par, "guardaría" sería directamente falso.

**Los nombres de los tres constraints se verificaron contra la base** antes de escribirlos
(`pg_constraint` sobre `public.properties`): `properties_sale_price`, `properties_rent_price`
y `properties_temp_rent_price` existen con esos nombres exactos.

---

## 2. Verificación de que no se tocó código

`git diff` no sirve para esto: compara contra HEAD, que es anterior a todo el trabajo sin
commitear de los turnos previos, así que muestra cientos de líneas ajenas a este cambio. Para
aislarlo reconstruí el archivo tal como estaba al empezar el turno (aplicando la sustitución
inversa) y lo diffeé contra el actual:

```
164,170c164,170        ← 7 líneas de comentario, reemplazadas por 7 líneas de comentario
```

```
líneas del diff que NO son comentario: 0
```

El bloque conserva el mismo largo (164–170 antes, 164–170 después), que es la razón por la que
el warning de lint no se movió de la línea 524.

---

## 3. Comandos de calidad

### `npx tsc --noEmit`

```
(sin salida)
TSC EXIT: 0
```

### `npm run lint`

```
/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  524:30  warning  Compilation Skipped: Use of incompatible library
  ...
> 524 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
      |                              ^^^^^ React Hook Form's `useForm()` API returns a `watch()`
                                           function which cannot be memoized safely.
  react-hooks/incompatible-library

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

### Contra el baseline

| Medición | Baseline | Ahora | |
|---|---|---|---|
| `tsc --noEmit` | 0 errores, exit 0 | 0 errores, exit 0 | sin cambios |
| `npm run lint` | 0 errores, 1 warning en `PropertyForm.tsx:524` | 0 errores, 1 warning en **`PropertyForm.tsx:524`** | sin cambios, ni de línea |
| `next build` | verde, 19 rutas, exit 0 | verde, 19 rutas, exit 0 | sin cambios |

---

## 4. Nada que reportar

No hubo obstáculos ni hallazgos. La base coincide con lo que describe el pedido, el comentario
era el único lugar de `src/` que quedaba afirmando lo viejo (ya lo había señalado en el informe
del turno anterior), y con esto queda cerrado. No se tocó ningún otro archivo, ni `CLAUDE.md`,
ni `PENDIENTES.md`, ni el archivo de migración.
