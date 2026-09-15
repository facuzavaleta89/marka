# Tanda: campos de formulario — definición única de la caja y teléfono con prefijo

> **Modo ejecución.** Sin comandos de git y sin SQL de ningún tipo en esta tanda: la base no se tocó. `CLAUDE.md` y `PENDIENTES.md` no se tocaron. Tampoco se tocaron el enlace de contacto (`waMessage.ts`), las hojas del mapa ni la policy de `agents`.
>
> **Cómo se midió:**
> - **Build y navegador:** build de producción servido con `next start` y medido con Chrome headless por el protocolo de DevTools.
> - **Campos reales:** inicio de sesión y registro (incluidos el estado de error, el pegado y el tipeo en el teléfono).
> - **Pantallas con sesión** (perfil, preferencias, equipo, admin): no inicié sesión. Medí elementos con **la clase final que produce el código**, calculada con `tailwind-merge` a partir de las constantes reales de `fieldStyles.ts` e inyectada sobre `/login`, que carga la misma hoja de estilos global. Es el mismo CSS aplicado a la misma clase, **no la pantalla autenticada**.
> - **Limpieza:** servidor y Chrome apagados. Scripts en el scratchpad de la sesión, fuera del repo.

---

## 1. Archivos modificados

| Archivo | Qué cambió |
|---|---|
| **`src/components/forms/fieldStyles.ts`** (nuevo) | **La definición única** del campo con caja, su error, el error del subrayado y el campo con prefijo |
| **`src/components/forms/PhoneWaInput.tsx`** (nuevo) | Campo de teléfono con prefijo `+54 9` fijo (limpia al pegar y al salir) + aviso de número a revisar |
| **`src/lib/utils/phoneWa.ts`** (nuevo) | Fuente única del formato: normalización, validación de largo, separación del número guardado y campo de zod. Cliente y servidor |
| `src/components/dashboard/ProfileForm.tsx` | 4 campos pasan a la caja; teléfono con `PhoneWaInput` y número guardado preservado |
| `src/components/dashboard/AgencyPhoneForm.tsx` | Ídem para el teléfono de la agencia |
| `src/components/dashboard/AgencyIdentityForm.tsx` | 2 campos (nombre, matrícula) pasan a la caja |
| `src/components/dashboard/TeamContent.tsx` | 4 campos del alta de agente pasan a la caja; teléfono con `PhoneWaInput` |
| `src/components/dashboard/AgencySlugForm.tsx` | El campo con prefijo usa la definición única en vez de su caja escrita a mano |
| `src/components/properties/PropertyForm.tsx` | Se borró su constante `FIELD`/`FIELD_ERR`; importa la única (13 + 6 usos) |
| `src/app/(agent)/admin/AgenciesTable.tsx` | Se borró su copia de `FIELD`; importa la única. El área de texto del motivo de rechazo pasa a la caja |
| `src/app/(agent)/login/LoginForm.tsx` | El error colorea el subrayado en vez de convertir el campo en caja |
| `src/app/(agent)/register/RegisterForm.tsx` | Ídem (5 campos + selector de ciudad); teléfono con `PhoneWaInput` en variante subrayado |
| `src/app/(agent)/dashboard/perfil/actions.ts` | **Valida el teléfono en el servidor** (antes no validaba nada) |
| `src/app/(agent)/register/actions.ts` | **Valida el teléfono en el servidor** antes de crear el usuario; un solo valor para las dos tablas |
| `src/app/(agent)/dashboard/preferencias/actions.ts` | Validación del teléfono con la fuente única, preservando el número guardado |
| `src/app/(agent)/dashboard/equipo/actions.ts` | Validación del teléfono con la fuente única |

---

## 2. La definición única del campo con caja

### Dónde vive y cómo quedó

`src/components/forms/fieldStyles.ts`:

```ts
/** Caja completa para `Input`, `Textarea` y `SelectTrigger`. */
export const FIELD_BOX =
  "rounded-md border border-stone border-b-stone bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/20 focus-visible:ring-offset-1 focus-visible:border-graphite focus-visible:border-b-graphite";

/** Estado de error de la caja. Se suma a `FIELD_BOX`, nunca va solo. */
export const FIELD_BOX_ERROR = "border-error border-b-error";

export const FIELD_UNDERLINE_ERROR =
  "border-b-error focus-visible:border-b-error aria-invalid:border-b-error";

export const FIELD_BOX_GROUP =
  "flex items-center rounded-md border border-stone bg-white pl-3 focus-within:ring-2 focus-within:ring-terracota/20 focus-within:ring-offset-1 focus-within:border-graphite";
export const FIELD_BOX_GROUP_ERROR = "border-error";
export const FIELD_UNDERLINE_GROUP =
  "flex items-center border-b border-input focus-within:border-ring";
export const FIELD_UNDERLINE_GROUP_ERROR = "border-error focus-within:border-error";
export const FIELD_GROUP_PREFIX =
  "shrink-0 font-sans text-base md:text-sm text-graphite select-none whitespace-nowrap";
export const FIELD_BOX_GROUP_INPUT =
  "border-0 bg-transparent pr-3 shadow-none focus-visible:ring-0";
export const FIELD_UNDERLINE_GROUP_INPUT =
  "border-0 bg-transparent shadow-none focus-visible:ring-0";
```

**`FIELD_BOX` es textualmente la constante que ya tenían duplicada `PropertyForm` y `AgenciesTable`.** Se mudó, no se reinventó: esas dos pantallas se ven exactamente igual que antes, medido (12 px de relleno, anillo de foco igual).

### Por qué constantes y no una variante del componente

**Porque la caja tiene que vestir cosas que no son un `<input>`.** En un campo con prefijo fijo —la dirección del sitio de marca y ahora el teléfono— la caja la dibuja **el contenedor** `<div>`, y el input va adentro sin borde. Una variante de `Input` no llega a ese contenedor, y la definición del campo con prefijo quedaría en otro lado: dos fuentes.

Además, `Input`, `Textarea` y `SelectTrigger` consumen **la misma clase**, así que un solo lugar alcanza para los tres sin tocar los componentes de fábrica. Y es el patrón que ya estaba probado en `PropertyForm`, solo que copiado.

El archivo explica arriba de todo **por qué existe**: la trampa de `tailwind-merge`, que convertía un color de borde en una caja sin relleno.

### Quiénes la consumen

Búsqueda de `components/forms/fieldStyles` en `src/`: **9 archivos**.

| Consumidor | Qué usa |
|---|---|
| `ProfileForm.tsx` | `FIELD_BOX` (nombre, 2 contraseñas) + el teléfono vía `PhoneWaInput` |
| `AgencyPhoneForm.tsx` | teléfono vía `PhoneWaInput` |
| `AgencyIdentityForm.tsx` | `FIELD_BOX` (nombre, matrícula) |
| `TeamContent.tsx` | `FIELD_BOX` (nombre, email, contraseña) + teléfono vía `PhoneWaInput` |
| `AgencySlugForm.tsx` | `FIELD_BOX_GROUP` + `FIELD_GROUP_PREFIX` + `FIELD_BOX_GROUP_INPUT` |
| `PropertyForm.tsx` | `FIELD_BOX` (13 usos: `Input`, `Textarea`, 3 `SelectTrigger`) + `FIELD_BOX_ERROR` (6) |
| `AgenciesTable.tsx` | `FIELD_BOX` (3 `Input` + el `Textarea` del motivo) + `FIELD_BOX_ERROR` |
| `LoginForm.tsx`, `RegisterForm.tsx` | `FIELD_UNDERLINE_ERROR` (y `PhoneWaInput` en registro) |
| `PhoneWaInput.tsx` | las constantes de grupo |

**Verificación de "una sola fuente":**
- No queda ninguna `const FIELD` en `src/`.
- No queda ningún `bg-white border-stone focus-visible:ring-terracota` (búsquedas con resultado vacío).
- Único `"border-error"` suelto que queda: `LocationPicker.tsx:158`. Es el recuadro del mini-mapa, no un campo.

### ⚠ Cambios visibles en la dirección del sitio de marca

Al pasar su caja a la definición única, ese campo cambió en tres cosas:

| | Antes | Después | Por qué |
|---|---|---|---|
| Color del prefijo | `stone` (#C8C0B7) | **`graphite`** (#4E4A46) | `stone` es el color de los placeholders: el prefijo se leía como texto de ayuda. Contraste sobre blanco: ~1,7:1 → ~9:1 |
| Tamaño del prefijo en celular | 14 px | **16 px** | Igual al input que acompaña, que en celular va a 16 px |
| Anillo de foco | terracota **sólido** | **terracota al 20 %** + borde `graphite` | El de toda la familia caja. DESIGN.md pide sólido; ver la inconsistencia #16 del informe anterior, que sigue abierta |

La geometría no cambió (medido): prefijo a 13 px del borde, valor pegado al final del prefijo, alto 42 px.

### Decisión 5 — área de texto y selector

| Dónde conviven | Qué se hizo |
|---|---|
| **Formulario de propiedades** (`Textarea` y 3 `SelectTrigger` junto a `Input` con caja) | ya usaban la caja; ahora de la fuente única |
| **Panel admin** (`Textarea` del motivo de rechazo en una pantalla donde todos los demás campos son caja) | **pasó a `FIELD_BOX`** + `py-2`, como la descripción de propiedades. Medido: 12 px de relleno. Antes era subrayado, y con error, caja roja con 0 px |
| **Registro** (`SelectTrigger` de ciudad junto a `Input` subrayados) | **queda subrayado**, coherente con su pantalla; su error usa `FIELD_UNDERLINE_ERROR` |

No hay otro lugar donde un área de texto o un selector conviva con campos de la otra familia.

---

## 3. El estado de error de inicio de sesión y registro

**Elegí colorear el subrayado sin convertirlo en caja.**

**Por qué:**
- **Esas pantallas son de la familia subrayado.** Pasar a caja al fallar le cambiaría la forma al campo **justo en el momento del error**.
- **El texto se correría.** Con la caja entera (12 px de relleno), el texto se movería 12 px respecto de la etiqueta y del enlace "Volver al mapa", que DESIGN §14 alinea a propósito. Con la caja sin relleno se reproduciría el defecto.
- **Error debe ser menos cambio, no más.** El mismo campo, con otro color de línea.

La constante lleva **solo clases de borde inferior**. Ese es el punto: nunca le pasa a `tailwind-merge` un color de los cuatro lados.

⚠ **Un hallazgo que salió midiendo, y quedó resuelto en la misma constante.** La primera versión era `border-b-error focus-visible:border-b-error`. Con ella, el selector de ciudad salía con el rojo **del preset** (`lab(48 77 61)`) y no con el `error` del proyecto. El selector lleva `aria-invalid`, y la clase de fábrica `aria-invalid:border-b-destructive` pesa más: tiene selector de atributo. Se agregó `aria-invalid:border-b-error`, que hace que `tailwind-merge` descarte la de fábrica (verificado en la clase final). Medido después: **los tres campos del registro con error en `rgb(155, 35, 53)`**.

**Medido después, sobre los campos reales:**

| Campo | Bordes con ancho | Color de los laterales | Color inferior | Relleno | Radio |
|---|---|---|---|---|---|
| Inicio de sesión, email con error | 1 px (laterales transparentes) | `rgba(0,0,0,0)` | **`rgb(155, 35, 53)`** | 0 | 0 |
| Registro, nombre con error | ídem | transparente | **`rgb(155, 35, 53)`** | 0 | 0 |
| Registro, selector de ciudad con error | ídem | transparente | **`rgb(155, 35, 53)`** | 0 | 0 |
| Registro, teléfono con error | solo inferior | — | **`rgb(155, 35, 53)`** | 0 | 0 |

Antes (informe anterior, mismo código): **caja roja de 4 lados con 0 px de relleno**.

---

## 4. El anillo de foco

| Pantallas | Antes | Después |
|---|---|---|
| **Perfil, preferencias (nombre, matrícula, teléfono), equipo** | **ninguno** (medido `box-shadow: none`) | **resuelto por la definición única.** Medido: `rgb(255,255,255) 0 0 0 1px, lab(44 30 36 / 0.2) 0 0 0 3px` (anillo de 2 px terracota al 20 % con 1 px de separación), **idéntico al del formulario de propiedades** |
| Teléfono y dirección del sitio (con prefijo) | dirección: terracota sólido | el mismo anillo, en el contenedor (`focus-within`) |
| **Inicio de sesión y registro** | solo cambia el borde inferior | **igual: sin anillo**. Es el diseño de la familia subrayado (el foco se marca en la línea). Con error, la línea sigue roja al enfocar (medido). Lo reporto sin arreglarlo: agregarle anillo a esa familia es una decisión de diseño aparte |

⚠ **El anillo de la familia caja sigue siendo al 20 %, no el sólido que pide `DESIGN.md:433`.** Tomé el de la constante existente para no cambiar el aspecto de propiedades y admin. Esa divergencia con DESIGN ya estaba anotada (#16 del informe anterior) y sigue abierta.

---

## 5. Espacio entre el borde y el primer carácter

"Desde el borde externo" incluye el 1 px del borde.

| Pantalla y campo | Cómo se midió | Antes | Después |
|---|---|---|---|
| **Perfil** (nombre, contraseñas) | clase final inyectada | **1 px** (0 px de relleno), caja sin radio | **13 px** (12 de relleno), radio 8 px |
| **Preferencias** (nombre, matrícula) | ídem | **1 px** | **13 px** |
| **Equipo** (nombre, email, contraseña) | ídem | **1 px** | **13 px** |
| **Teléfono en perfil, preferencias y equipo** | contenedor + prefijo inyectados | **1 px** (sin prefijo) | prefijo `+54 9` a **13 px**; **8 px** entre el prefijo y el primer dígito (dígito a 58,3 px del borde) |
| Dirección del sitio | ídem | prefijo a 13 px, valor pegado | **igual**: prefijo a 13 px, valor pegado (0 px) |
| **Admin, motivo de rechazo** | ídem | 1 px (subrayado; con error, caja) | **13 px** |
| Propiedades y admin (fechas, confirmación) | ídem | 13 px | **13 px** (sin cambio) |
| **Inicio de sesión** (real) | real | 1 px, subrayado | **1 px, subrayado** (sin cambio, a propósito) |
| **Inicio de sesión con error** (real) | real | **1 px dentro de una caja roja** | **1 px, subrayado rojo** |
| **Registro** (real) | real | 1 px, subrayado | 1 px, subrayado |
| **Registro con error** (real) | real | **1 px dentro de una caja roja** | **1 px, subrayado rojo** |
| **Registro, teléfono** (real, 390×844) | real | 1 px, sin prefijo | prefijo `+54 9` a **0 px** (alineado con la etiqueta, medido); el input empieza a 50,6 px |

---

## 6. El campo de teléfono

### El JSX

`src/components/forms/PhoneWaInput.tsx`, el render:

```tsx
  return (
    <div
      className={cn(
        box ? FIELD_BOX_GROUP : FIELD_UNDERLINE_GROUP,
        invalid && (box ? FIELD_BOX_GROUP_ERROR : FIELD_UNDERLINE_GROUP_ERROR)
      )}
    >
      {!isPreserved && (
        <span id={prefixId} className={cn(FIELD_GROUP_PREFIX, "pr-2")}>
          {PHONE_WA_PREFIX_LABEL}
        </span>
      )}
      <Input
        id={id}
        name={name}
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={PHONE_WA_PLACEHOLDER}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [isPreserved ? null : prefixId, describedBy].filter(Boolean).join(" ") ||
          undefined
        }
        className={box ? FIELD_BOX_GROUP_INPUT : FIELD_UNDERLINE_GROUP_INPUT}
      />
    </div>
  );
```

Cuándo limpia:

```tsx
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    // Más de un carácter de una sola vez = pegado o autocompletado. …
    const insertedAtOnce = next.length - value.length > 1;
    onChange(
      insertedAtOnce ? normalizePhoneWaNational(next) : sanitizePhoneWaTyping(next)
    );
  }

  function handleBlur() {
    // … Un número guardado sin tocar NO se toca …
    if (!isPreserved) {
      const normalized = normalizePhoneWaNational(value);
      if (normalized !== value) onChange(normalized);
    }
    onBlur();
  }
```

Montaje en perfil (`ProfileForm.tsx`), con `Controller` y **sin `watch()`**:

```tsx
            <Controller
              control={profileForm.control}
              name="phone_wa"
              render={({ field, fieldState }) => (
                <>
                  <PhoneWaInput
                    id="phone_wa"
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    variant="box"
                    invalid={!!fieldState.error}
                    preservedValue={preservedPhone}
                    describedBy="phone_wa_help"
                  />
                  {preservedPhone !== null && field.value === preservedPhone && (
                    <PhoneWaReviewNotice stored={preservedPhone} />
                  )}
                </>
              )}
            />
```

**Teclado numérico (decisión 13):** los cuatro campos de teléfono (perfil, preferencias, equipo, registro) son ahora el mismo componente, con `type="tel"` y `inputMode="numeric"`. Medido en el registro real: `type: "tel"`, `inputMode: "numeric"`, `autoComplete: "tel-national"`. Antes, tres de los cuatro no tenían ninguno de los dos atributos.

### La función que limpia

`src/lib/utils/phoneWa.ts`:

```ts
export function normalizePhoneWaNational(value: string): string {
  let digits = value.replace(/\D/g, "");

  let previous: string;
  do {
    previous = digits;
    digits = digits.replace(/^0+/, "");
    if (digits.startsWith("54")) digits = digits.slice(2);
    if (digits.startsWith("9")) digits = digits.slice(1);
  } while (digits !== previous);

  if (digits.length === PHONE_WA_NATIONAL_LENGTH + 2) {
    for (const at of [2, 3, 4]) {
      if (digits.slice(at, at + 2) === "15") {
        return digits.slice(0, at) + digits.slice(at + 2);
      }
    }
  }

  return digits;
}
```

y la validación y el valor a guardar:

```ts
const NATIONAL_PATTERN = /^[1-3]\d{9}$/;

export function resolvePhoneWaForSave(
  input: string,
  preserved: string | null = null
): string | null {
  if (preserved !== null && preserved !== "" && input === preserved) {
    return preserved;
  }
  const national = normalizePhoneWaNational(input);
  return isValidPhoneWaNational(national)
    ? PHONE_WA_STORED_PREFIX + national
    : null;
}
```

**Por qué es seguro quitar 0, 9 y 54 del principio:** toda característica argentina empieza con 1, 2 o 3, así que ninguno de los tres puede ser el comienzo real del número.

**Largo (decisión 10): mínimo Y máximo, exactamente 10 dígitos.** Característica + número suman siempre 10 en Argentina, sea cual sea el largo de la característica.

### Qué produce cada entrada

Ejecutado contra la función real (`node` sobre `src/lib/utils/phoneWa.ts`):

| Entrada | Queda en el campo | Se guarda |
|---|---|---|
| **Número completo con el signo más** `+54 9 385 400-0000` | `3854000000` | **`5493854000000`** |
| **Con el código de país sin el signo** `5493854000000` | `3854000000` | **`5493854000000`** |
| **Con cero adelante** `03854000000` | `3854000000` | **`5493854000000`** |
| **Con quince** `0385 15 400 0000` | `3854000000` | **`5493854000000`** |
| **Solo característica y número** `3854000000` | `3854000000` | **`5493854000000`** |
| Con espacios `385 400 0000` | `3854000000` | `5493854000000` |
| Con quince sin cero `385154000000` | `3854000000` | `5493854000000` |
| 54 sin el 9 `543854000000` | `3854000000` | `5493854000000` |
| Buenos Aires con 0 y 15 `011 15 1234-5678` | `1112345678` | `5491112345678` |
| Bariloche (característica de 4) con 15 `02944 15 123456` | `2944123456` | `5492944123456` |
| Discado internacional `0054 9 385 4000000` | `3854000000` | `5493854000000` |
| **Prefijo duplicado** (pegado sobre el prefijo) `5495493854000000` | `3854000000` | `5493854000000` |
| Sin característica `15 4000000` | `154000000` | **error** |
| Corto `385400000` | igual | **error** |
| Largo `38540000000` | igual | **error** |

**Las cinco formas de escribir el mismo número (+, código de país, cero, quince, a mano) guardan exactamente el mismo valor.**

**Medido en el navegador**, sobre el campo real del registro:

| Acción | En el campo al hacerla | Al salir del campo |
|---|---|---|
| **Pegar** `+54 9 385 400-0000` | **`3854000000`** (limpio en el acto) | `3854000000` |
| Pegar `5493854000000` | `3854000000` | `3854000000` |
| Pegar `0385 15 400 0000` | `3854000000` | `3854000000` |
| Pegar `011 15 1234-5678` | `1112345678` | `1112345678` |
| **Tipear** `+54 9 385 400-0000` de a una tecla | `5493854000000` (solo dígitos) | **`3854000000`** |
| Tipear `03854000000` | `03854000000` | `3854000000` |
| Tipear `0385 15 400 0000` | `0385154000000` | `3854000000` |
| Tipear `385 4000000` | `3854000000` | `3854000000` |

**Por qué al tipear no se quitan prefijos tecla por tecla:** borraría un `5` o un `0` recién escrito antes de que la persona termine. Mientras tipea solo se sacan los caracteres que no son dígitos. Al salir del campo, al pegar y al validar, se limpia entero.

**Mensaje de error** (cliente y servidor, el mismo):

> Revisá el número: la característica y el número juntos tienen que ser 10 dígitos (ej: 385 4000000).

**Texto de ayuda** debajo del campo:

> Característica y número, sin el 0 ni el 15. Si pegás el número completo, se acomoda solo.

---

## 7. Un perfil cuyo número guardado no tiene el formato esperado

**El caso real:** 2 de los 6 números guardados son `543853000299`, sin el 9 de celular.

**Qué pasa, en orden:**

1. `splitStoredPhoneWa("543853000299")` → `{ national: "543853000299", recognized: false }` (ejecutado).
2. El campo se carga **con el número tal cual**: `543853000299`.
3. **El prefijo `+54 9` no se muestra** mientras el campo conserve ese valor sin tocar. Mostrarlo haría leer "+54 9 543853000299", que es otro número.
4. Al salir del campo **no se limpia**: `handleBlur` no normaliza un valor preservado.
5. **Debajo del campo aparece este aviso** (`PhoneWaReviewNotice`, tono `warning`, título con ícono de alerta):

   > **Revisá este número de WhatsApp**
   >
   > El número guardado, **543853000299**, no tiene el formato de un celular argentino (+54 9, característica y número), así que el enlace de WhatsApp puede no llegar a destino.
   >
   > No lo cambiamos por vos. Si está bien, dejalo como está; si no, borralo y escribí la característica y el número.

6. **Si guarda el perfil sin tocar el teléfono** (por ejemplo, cambió el nombre): el esquema acepta ese valor exacto y lo manda **sin reformatear**, y el servidor también (ver 9). Ejecutado:
   - `phoneWaField("543853000299").safeParse("543853000299")` → `{"success":true,"data":"543853000299"}`;
   - `resolvePhoneWaForSave("543853000299", "543853000299")` → `"543853000299"`.

   **El teléfono queda igual.** Sin la preservación, el mismo valor se habría guardado como `"5493853000299"`, corregido en silencio (ejecutado para comprobar el riesgo).
7. **Si toca el campo**, pasa a ser un número nuevo: aparece el prefijo, el aviso desaparece, y al salir se limpia y valida como cualquier otro.

⚠ **Límite:** este flujo **no lo vi en la pantalla real de perfil** (exige sesión). Lo verifiqué con la función real, el esquema real y el código del componente.

---

## 8. El registro escribe el mismo valor normalizado en las dos tablas

`src/app/(agent)/register/actions.ts`:
- **Resolución:** el teléfono se resuelve **una sola vez**, antes de crear el usuario de Auth.
- **Escrituras:** las dos usan esa variable, verificado por búsqueda.

```ts
  const phoneWa =
    typeof data.phoneWa === "string" ? resolvePhoneWaForSave(data.phoneWa) : null;
  if (phoneWa === null) {
    return { error: PHONE_WA_ERROR };
  }
```

```
100:        phone_wa: phoneWa,     ← insert en agencies
136:    phone_wa: phoneWa,         ← insert en agents
```

No queda ningún `data.phoneWa` en las escrituras. **Agencia y admin nacen con el mismo número, byte a byte.** Y como la validación va antes del `signUp`, un teléfono inválido no deja un usuario de Auth creado que haya que borrar.

---

## 9. Validaciones del servidor

**Los cuatro caminos que escriben un teléfono validan ahora en el servidor, con la misma función.**

| Camino | Antes | Ahora |
|---|---|---|
| `perfil/actions.ts` → `updateProfileAction` | **ninguna** | lee `phone_wa` actual de la fila del agente → `resolvePhoneWaForSave(input, actual)` → error si `null`. Se escribe el valor resuelto |
| `register/actions.ts` → `registerAction` | **ninguna** | `resolvePhoneWaForSave(input)` antes del `signUp`; un solo valor para las dos tablas |
| `preferencias/actions.ts` → `updateAgencyPhoneAction` | regex `^\d{10,}$` | lee `phone_wa` actual de la agencia (service role, acotado a la agencia de la sesión) → `resolvePhoneWaForSave(input, actual)` |
| `equipo/actions.ts` → `createAgentAction` | regex `^\d{10,}$` | `phoneWaField()` en su esquema de zod: normaliza, valida largo y entrega el valor completo |

**Detalles que importan:**
- **El valor preservado sale SIEMPRE de la fila real**, leída en la misma action, nunca del cliente. Solo permite reenviar el número que ya estaba guardado; no sirve para colar uno nuevo sin validar.
- **Un valor que no es texto** (cliente manipulado) se rechaza con el mismo mensaje.
- **Normalizar en el servidor es idempotente:** `resolvePhoneWaForSave("5493854000000")` → `"5493854000000"` (ejecutado). Que el cliente ya mande el número completo no rompe nada.
- **En preferencias la validación pasó a correr después de la sesión**, porque necesita saber de qué agencia es el número guardado. Los mensajes de sesión y rol son los mismos de antes.

---

## 10. Inconsistencias nuevas (sin arreglar, fuera de alcance)

Las de informes anteriores no se repiten.

1. **`CLAUDE.md` quedó desactualizado por esta tanda y no lo toqué, por instrucción:**
   - **baseline:** cita el warning en `PropertyForm.tsx:808`, y ahora está en **`:804`**: se borraron las 4 líneas de la constante duplicada más arriba. Es el mismo warning, sobre la misma llamada `watch("amenities")`;
   - **árbol de carpetas:** no lista `src/components/forms/` ni `src/lib/utils/phoneWa.ts`;
   - **"Convenciones → WhatsApp":** no describe el prefijo fijo ni la preservación.
2. **`DESIGN.md` §6 "Inputs y formularios" (`:427-433`) no describe las dos familias** (subrayado y caja) ni el campo con prefijo, que ahora son una definición del proyecto.
3. **Quedan cajas escritas a mano fuera de la definición única**, en pantallas fuera de alcance (dos son hojas del mapa):
   - `FilterPanel.tsx:115-122`;
   - `PropertyContact.tsx:119-127`;
   - `PropertyModal.tsx:597-605`;
   - `ShareButton.tsx:212-217`.

   Usan `focus:` en vez de `focus-visible:`, y rellenos de 12 y 8 px.
4. **Dentro de la familia caja, el error no se muestra igual:**
   - **formulario de propiedades:** colorea el campo (`FIELD_BOX_ERROR`);
   - **teléfono:** colorea el contenedor;
   - **nombre y contraseñas de perfil, y alta de agente e identidad** (`ProfileForm.tsx`, `TeamContent.tsx`, `AgencyIdentityForm.tsx`): solo muestran el texto rojo debajo, con el campo intacto.
5. **`aria-invalid` está solo en el selector de ciudad del registro y en el campo de teléfono.** Los demás campos de inicio de sesión, registro, perfil, equipo y preferencias no lo tienen: un lector de pantalla no anuncia que están en error.
6. **El campo de teléfono en variante subrayado mide 41 px de alto** y los otros subrayados 40 px (medido). El contenedor suma su borde inferior al alto del input.
7. **`PhoneWaReviewNotice` dice que "el enlace de WhatsApp puede no llegar a destino"** también en el teléfono de la agencia (`AgencyPhoneForm.tsx`), cuyo número no se usa para ningún enlace (hallazgo del informe anterior). El texto es cierto para perfil y exagerado ahí.
8. **Guardar un número preservado sin tocarlo muestra "Teléfono de la agencia actualizado"** (`AgencyPhoneForm.tsx`) aunque no cambió nada. El aviso de revisión sigue a la vista, pero el mensaje de éxito sugiere que algo se guardó.
9. **La familia subrayado no tiene anillo de foco** (`LoginForm.tsx`, `RegisterForm.tsx`): medido `box-shadow: none` al enfocar. DESIGN.md pide anillo terracota para todos los campos.
10. **`LoginForm.tsx:66-122` tiene los hijos del `<form>` con una indentación distinta** (12 espacios contra 6 del `<form>`) y el `</Button>` desalineado. Es cosmético y previo a esta tanda.
11. **La quita del 15 no distingue características de 4 dígitos terminadas en "15"**: el algoritmo prueba las posiciones 2, 3 y 4 en ese orden. **No verifiqué** si existe alguna característica argentina así; si existe, un número dictado con 15 podría resolverse mal (en ese caso, el largo sigue siendo 10 y no daría error).
12. **Un número con 54 y sin el 9 escrito a mano** (`543854000000`) se guarda **con el 9 agregado** (`5493854000000`). Es coherente con la decisión de solo celular. Pero una inmobiliaria que atienda WhatsApp Business desde una línea fija (van sin el 9) no puede cargar su número, y el sistema se lo "corrige" sin avisar mientras lo escribe. La decisión de no aceptar fijos ya estaba tomada; lo anoto por el efecto concreto.

---

## 11. Baseline de calidad

Borré `.next/` y `tsconfig.tsbuildinfo` antes de correr. **Corrida final, después del último cambio:**

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
  804:30  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:804:30
  802 |   });
  803 |
> 804 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
      |                              ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  805 |   const lat = watch("lat");
  806 |   const lng = watch("lng");
  807 |   const address = watch("address") ?? "";  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)

LINT_EXIT=0
```

**0 errores, 1 warning, exit 0.** Es el mismo warning, sobre la misma llamada `watch("amenities")`. **Solo cambió el número de línea (808 → 804)**, porque se borró la constante duplicada 4 líneas más arriba. **No se agregó ningún `watch()`:** los cuatro campos de teléfono usan `Controller`, y la búsqueda de `watch(` en los archivos tocados solo encuentra comentarios.

### `npx next build`

```
▲ Next.js 16.2.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 8.9s
  Running TypeScript ...
  Finished TypeScript in 8.5s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/20) ...
  Generating static pages using 3 workers (5/20) 
  Generating static pages using 3 workers (10/20) 
  Generating static pages using 3 workers (15/20) 
✓ Generating static pages using 3 workers (20/20) in 1171ms
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

BUILD_EXIT=0
```

**Verde, exit 0, 22 rutas**, mismos nombres y tipos. **Sin cambios en el baseline**, salvo el número de línea del warning ya explicado.

---

## 12. Lo que resultó falso o imposible

**Ninguna decisión resultó imposible.** Las trece se implementaron como estaban descritas.

**Lo que resultó falso o incompleto en el prompt:**

1. **"Sacá del principio … el quince que se usa al dictar un celular" — el quince no va al principio.** Se dicta **después de la característica** ("0385 **15** 400 0000", "011 **15** 1234 5678"), y su posición depende del largo de la característica. Se implementó en esas tres posiciones posibles, **solo cuando sobran exactamente dos dígitos**, que es la única forma de saber que está. Un "15" escrito realmente al principio, sin característica ("15 4000000"), no se puede completar y da error de largo, que es lo correcto.
2. **"Dos pantallas más ya definieron la variante de caja por su cuenta" — eran tres.** Además de las dos con la constante duplicada, **`AgencySlugForm` tenía su propia caja escrita a mano** (el contenedor del campo con prefijo, con otro anillo y otro color de prefijo). Se pasó a la definición única, y eso le cambió tres detalles visibles (sección 2). Siguen existiendo cajas a mano **fuera de alcance** (inconsistencia #3).
3. **"Hoy, cuando hay un error, esos campos se convierten en una caja sin relleno" — cierto, y había un segundo defecto en el mismo estado:** el selector de ciudad del registro no se convertía en caja (ya traía `aria-invalid`), pero se pintaba con **el rojo del preset**, no con el `error` del proyecto. Salió al medir y quedó resuelto en la misma constante (sección 3).
4. **Decisión 4 — "si la definición única lo resuelve, bien":** lo resuelve en perfil, preferencias y equipo (medido). En **inicio de sesión y registro no hay anillo y no es por el override**: es el diseño de la familia subrayado. Lo reporto sin arreglarlo (inconsistencia #9).
