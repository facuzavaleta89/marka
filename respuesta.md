# El campo del nombre: la punta que le faltaba al flujo

> **Modo ejecución.** No se ejecutó ningún comando de git ni SQL de escritura. El MCP se usó solo
> para leer. No se tocaron la base, el panel de administración, las dos formas de rechazo, la lista
> de direcciones reservadas, la validación de la dirección, `CLAUDE.md` ni `PENDIENTES.md`.
>
> **Fecha:** 13 sep 2026.

---

## ⚠ LEER PRIMERO: tres afirmaciones del prompt son falsas, y una decisión no se pudo implementar

Antes de tocar nada fui a verificar el estado del código, y **no coincide con el que el prompt
describe**. Lo digo derecho porque cambia qué se podía hacer.

| El prompt dice | Medido |
|---|---|
| *"NO HAY NINGÚN CAMPO … DONDE CAMBIAR EL NOMBRE"* | **Parcialmente cierto.** El campo **existía** (`AgencyIdentityForm.tsx:143-148`), pero el formulario entero se ocultaba para una agencia aprobada — y **las tres agencias están `approved`**. Efecto observable idéntico: no había dónde cambiarlo |
| *"El formulario de identidad de la agencia edita la dirección del sitio y el logo"* | **FALSO.** Edita **nombre + matrícula**. La dirección y el logo están en **otros dos formularios**, con sus propias actions |
| *"llama a una acción que además acepta el nombre, pero nunca se lo manda"* | **FALSO.** `AgencyIdentityForm.tsx:77` llama `updateAgencyIdentityAction(values)` **con** `{name, license_number}` |
| *"su diálogo de confirmación acumula advertencias"* | **FALSO.** Ese formulario no tiene diálogo de confirmación. El que lo tiene es `AgencySlugForm`, con **una** advertencia |
| *"cuando el campo exista, le va a bloquear también el logo y la dirección"* (punto 3) | **FALSO.** La guarda vivía solo en `updateAgencyIdentityAction`, que no toca el logo ni la dirección. **Medido:** `updateAgencyLogoAction`, `updateAgencySlugAction` y `updateAgencyPhoneAction` tienen **cero** menciones a `canceled`/`past_due` |
| *"Existe una guarda que impide pedir un cambio de nombre cuando la agencia está esperando su aprobación inicial"* (punto 6) | **FALSO. No existe.** La guarda que había era la inversa: bloqueaba a las **aprobadas** |

**Los cuatro formularios de agencia, medidos:**

| Componente | Edita | Action |
|---|---|---|
| `AgencyIdentityForm` | **nombre + matrícula** | `updateAgencyIdentityAction` |
| `AgencySlugForm` | solo `slug` | `updateAgencySlugAction` |
| `AgencyLogoForm` | solo `logo_url` | `updateAgencyLogoAction` |
| `AgencyPhoneForm` | solo `phone_wa` | `updateAgencyPhoneAction` |

### Qué hice con eso

**El problema real —el nombre no se puede cambiar y todo el flujo quedó inalcanzable— es cierto, y
lo resolví por completo.** La causa no era un campo faltante sino un gate:

```ts
// AgencyIdentityForm.tsx:63 (antes)
const isLocked = approvalStatus === "approved";
// :129  →  isLocked ? <ReadOnlyIdentity/> : <form>   ← el campo vivía en el else
```

**Lo que NO hice, y es la decisión que resultó imposible como está descrita:** el **punto 5** pide
que *"si la agencia cambia el nombre Y la dirección en la misma edición, el diálogo muestre las
dos"*. Eso exige **un formulario único con un submit único**, y hoy son dos formularios separados,
con dos actions y dos submits. Fusionarlos sería exactamente lo que el punto 1 prohíbe (*"No
construyas un formulario nuevo"*), sobre una premisa que resultó falsa. **Las dos advertencias sí
conviven en la pantalla**, y en §5 está verificado cómo — pero en dos tarjetas, no en un diálogo.

---

## 1 · Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/lib/utils/agencyName.ts` | **Creado.** Normalización y validación del nombre, compartidas por el formulario y la action (molde de `licenseNumber.ts`) |
| `src/components/dashboard/AgencyIdentityForm.tsx` | El corte pasó de "todo el formulario" a "solo la matrícula": el nombre es editable en cualquier estado, con el aviso condicionado a que cambie |
| `src/app/(agent)/dashboard/preferencias/actions.ts` | Congela la matrícula en vez de rechazar todo, acota la guarda de suscripción al nombre, y agrega la transición a revisión para una agencia aprobada |

---

## 2 · El campo nuevo: JSX y esquema

### El esquema del formulario

```ts
const schema = z.object({
  // MISMAS funciones que usa la server action: un solo criterio, dos capas. El
  // formulario valida para dar feedback; la barrera que cuenta es la del server.
  name: z
    .string()
    .transform(normalizeAgencyName)
    .superRefine((value, ctx) => {
      const result = validateAgencyName(value);
      if (!result.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
      }
    }),
  license_number: z
    .string()
    .transform(normalizeLicenseNumber)
    .refine((v) => v.length > 0, "La matrícula es requerida")
    .refine((v) => LICENSE_NUMBER_PATTERN.test(v), LICENSE_NUMBER_ERROR),
});
```

### El JSX del campo

Va **primero en el formulario**, antes de la matrícula: es el dato de identidad principal y es lo
que la persona viene a buscar.

```tsx
        {/* ── El nombre. Editable SIEMPRE, y es el dato de identidad principal:
            va primero porque es lo que la persona viene a buscar. ──────── */}
        <div className="space-y-1.5">
          <Label
            htmlFor="agency_name"
            className="font-sans text-sm font-medium text-black"
          >
            Nombre de la inmobiliaria
          </Label>

          {/* ⚠ Controller y NO watch(): hace falta el valor EN VIVO para saber
              si el nombre cambió —de eso depende que aparezca el aviso de que la
              cuenta vuelve a revisión— y `watch()` de react-hook-form dispara el
              warning react-hooks/incompatible-library del React Compiler. El
              proyecto carga uno conocido y cualquier otro es una regresión
              (CLAUDE.md → ESLint). */}
          <Controller
            control={form.control}
            name="name"
            render={({ field }) => (
              <Input
                id="agency_name"
                placeholder="Inmobiliaria López"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                maxLength={AGENCY_NAME_MAX_LENGTH}
                className="bg-white border-stone focus-visible:ring-terracota"
              />
            )}
          />
          <p className="font-sans text-xs text-graphite">
            {isApproved
              ? "La razón social con la que figurás en el colegio de corredores. Si la cambiás, revisamos el nombre nuevo antes de que quede."
              : "La razón social con la que figurás en el colegio de corredores."}
          </p>
          {form.formState.errors.name && (
            <p className="font-sans text-xs text-error">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
```

**Y la matrícula, que ahora es la que se congela:**

```tsx
        <div className="space-y-1.5">
          <Label htmlFor="agency_license_number" …>
            Matrícula del colegio de corredores
          </Label>
          {isApproved ? (
            <>
              {/* Se muestra igual, en lectura: es información de la cuenta que
                  la persona necesita ver. Lo que se saca es poder cambiarla. */}
              <p className="font-sans text-[15px] text-graphite">
                {initialLicenseNumber || "—"}
              </p>
              <p className="flex items-start gap-2 font-sans text-xs text-graphite">
                <Lock size={14} className="mt-0.5 shrink-0" />
                <span>
                  Esta matrícula se verificó al aprobar tu inmobiliaria y queda
                  fija. Escribinos si necesitás corregirla.
                </span>
              </p>
            </>
          ) : (
            <>
              <Input id="agency_license_number" placeholder="1234"
                {...form.register("license_number")} … />
              …
            </>
          )}
        </div>
```

---

## 3 · Restricciones del nombre en la base, y qué validación apliqué

### Lo que la base impone: casi nada

```
information_schema.columns:
  name | text | is_nullable: NO | character_maximum_length: null | default: null

pg_constraint sobre agencies (las cinco):
  agencies_pkey                  PRIMARY KEY (id)
  agencies_slug_key              UNIQUE (slug)
  agencies_city_id_fkey          FOREIGN KEY (city_id) → cities(id) ON DELETE RESTRICT
  agencies_approval_status_check CHECK (approval_status IN ('pending','approved','rejected'))
  agencies_tenant_type_check     CHECK (tenant_type IN ('individual','agency'))
```

| | Medido |
|---|---|
| Nulos | `NOT NULL` — lo único que la base impone |
| Largo máximo | **ninguno** |
| Formato / CHECK | **ninguno** |
| **Unicidad** | **NINGUNA.** El único `UNIQUE` de la tabla es el del `slug` |

### ⚠ La unicidad: el prompt pidió fijarse, y la respuesta es que NO la exige

Por eso **no la inventé**, y está escrito en el archivo:

```ts
// ⚠ POR ESO ACÁ NO SE VERIFICA QUE EL NOMBRE NO ESTÉ REPETIDO, y no es un olvido:
// dos inmobiliarias PUEDEN llamarse igual en la base. Inventar la restricción en
// el código sería peor que no tenerla — rechazaría altas legítimas (dos "López"
// de ciudades distintas) con un error que ninguna regla respalda, y encima no
// sería una garantía: sin índice único, dos pedidos simultáneos entrarían igual.
// Quien decida que el nombre debe ser único, que lo decida en la base primero.
```

### La validación que sí apliqué

| Regla | Valor | Por qué |
|---|---|---|
| No vacío | — | La base exige `NOT NULL` |
| Largo mínimo | **2** | Hay razones sociales muy cortas; un solo carácter no es un nombre comercial |
| Largo máximo | **80** | La columna no tiene techo. El más largo medido es `"Inmobiliaria Gaio 2"` (19); 80 cubre *"Inmobiliaria López y Asociados Sociedad de Responsabilidad Limitada"* (65). Por encima rompe el sidebar, la columna del panel y el encabezado del sitio de marca |
| Normalización | `trim` + colapso de espacios internos | Ver abajo |

⚠ **El colapso de espacios no es cosmético**, y está comentado en el archivo: `"Inmobiliaria  López"`
y `"Inmobiliaria López"` son el mismo nombre para una persona y dos strings distintos para una
comparación — **y de esa comparación depende que se detecte si el nombre cambió**, que es lo que
dispara la vuelta a revisión. Sin normalizar, agregar un espacio de más mandaría la cuenta entera a
revisión sin que nada haya cambiado.

**Verificado ejecutando la validación:**

```
"Inmobiliaria López"  -> "Inmobiliaria López"  OK
"  Grupo   Gaio  "    -> "Grupo Gaio"          OK      ← normaliza
""                    -> ""                    requerido
"   "                 -> ""                    requerido
"A"                   -> "A"                   muy corto (< 2)
"Ab"                  -> "Ab"                  OK
80 caracteres         ->                       OK
81 caracteres         ->                       muy largo (> 80)
```

---

## 4 · La guarda de suscripción, acotada al nombre

```ts
  // Rechazada → vuelve a la cola. Pendiente → sigue pendiente. El slug NO se
  // toca: cambiarlo rompería la URL pública de la agencia y está fuera de alcance.
  const wasRejected = agency.approval_status === "rejected";

  // ⚠ SE CALCULA ANTES DE LA GUARDA DE SUSCRIPCIÓN, y el orden es el motivo: esa
  // guarda ahora depende de si el nombre cambió (ver abajo).
  const nameChanged = name !== agency.name;

  // ══════════════════════════════════════════════════════════════
  // ⚠ LA GUARDA DE SUSCRIPCIÓN ES SOLO DEL NOMBRE, NO DE TODA LA ACCIÓN
  // ══════════════════════════════════════════════════════════════
  //
  // El motivo NO es disciplinario, y por eso el alcance importa: lo que no
  // corresponde hacer por una cuenta dada de baja es el TRABAJO DE APROBACIÓN
  // que un cambio de nombre le genera al dueño de la plataforma. Todo lo demás
  // que esta pantalla permite —el logo, la dirección del sitio, el teléfono— la
  // agencia lo resuelve sola, no le genera trabajo a nadie, y no hay ningún
  // motivo para bloquearlo.
  //
  // ⚠ ACÁ DECÍA QUE LA GUARDA "CUBRE LA ACTION ENTERA (nombre Y matrícula) …
  // porque las dos viajan en el mismo submit y las dos disparan el mismo
  // reenvío". Dejó de ser cierto: con la agencia APROBADA la matrícula ya no se
  // puede cambiar (se ignora, ver arriba), así que lo único que puede disparar
  // un reenvío desde este formulario es el nombre. Bloquear por el estado de la
  // suscripción cuando el nombre NO cambió sería rechazar un guardado que no le
  // pide nada a nadie.
  //
  // ⚠ CONSECUENCIA ASUMIDA, y conviene tenerla escrita: una agencia dada de baja
  // que esté `pending` o `rejected` SÍ puede corregir su matrícula, y eso la
  // reenvía a la cola. Es un hueco chico y deliberado —el criterio pedido es que
  // la guarda dispare cuando cambia el NOMBRE— y el caso es raro: exige estar sin
  // aprobar y dada de baja a la vez.
  //
  // ⚠ ES LISTA NEGRA (`canceled`/`past_due`), NUNCA "distinto de active" …
  // ⚠ Y SIN FILA DE SUSCRIPCIÓN NO SE BLOQUEA …
  if (nameChanged) {
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("status")
      .eq("agency_id", session.agent.agency_id)
      .maybeSingle();

    if (
      subscription?.status === "canceled" ||
      subscription?.status === "past_due"
    ) {
      return {
        error:
          "Para cambiar el nombre necesitamos que tu suscripción esté al día: el cambio vuelve a pasar por revisión y eso lo hacemos sobre cuentas activas. Reactivá tu suscripción y volvé a intentarlo.",
      };
    }
  }
```

**⚠ La consulta a `subscriptions` ahora vive DENTRO del `if`**: una agencia que guarda sin tocar el
nombre ya ni siquiera paga el viaje a la base.

**Verificado, los seis casos:**

```
sub=canceled  nombre cambió=true    BLOQUEA
sub=canceled  nombre cambió=false   deja pasar     ← el cambio de esta tanda
sub=past_due  nombre cambió=true    BLOQUEA
sub=active    nombre cambió=true    deja pasar
sub=pending   nombre cambió=true    deja pasar     ← 'pending' está al día
sub=null      nombre cambió=true    deja pasar     ← le falta una fila, no pagar
```

### Y el otro corte, el que reemplazó al bloqueo total

```ts
  // ⚠ NO SE RECHAZA EL PEDIDO SI VIENE UNA MATRÍCULA DISTINTA: SE IGNORA. El
  // formulario ya la muestra en solo lectura para una agencia aprobada, pero eso
  // es cosmético —una server action se invoca sin pasar por el render—, así que
  // el valor que se escribe sale SIEMPRE de la fila real. …
  const effectiveLicenseNumber = isApproved
    ? (agency.license_number ?? license_number)
    : license_number;
```

**Es la barrera real**: un cliente manipulado puede mandar la matrícula que quiera; se descarta y
se escribe la de la base.

---

## 5 · Cómo se ve el diálogo con una advertencia y con las dos

### ⚠ No hay un diálogo único que las acumule, y no lo pude construir

El punto 5 asume un formulario que edita nombre **y** dirección con un diálogo común. **Ese
formulario no existe:** son dos componentes con dos actions y dos submits (§0). Unificarlos era
justamente lo prohibido por el punto 1.

**Lo que sí verifiqué es que las dos advertencias conviven en la pantalla**, en tarjetas contiguas,
y que se leen como dos cosas distintas — que es el requisito de fondo.

### Con UNA advertencia: solo el nombre

La agencia está aprobada y escribe un nombre distinto. Aparece, **en vivo**, dentro de la tarjeta de
identidad:

```
┌─ Identidad de la inmobiliaria ───────────────────────────────────┐
│ Podés cambiar el nombre; el cambio pasa por revisión.            │
│ La matrícula quedó fija al aprobar tu cuenta.                    │
│                                                                  │
│  Nombre de la inmobiliaria                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Grupo Gaio                                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│  La razón social con la que figurás en el colegio de corredores. │
│  Si la cambiás, revisamos el nombre nuevo antes de que quede.    │
│                                                                  │
│  Matrícula del colegio de corredores                             │
│  1234                                                            │
│  🔒 Esta matrícula se verificó al aprobar tu inmobiliaria y      │
│     queda fija. Escribinos si necesitás corregirla.              │
│                                                                  │
│ ╭─ 🕐 Al guardar, tu cuenta vuelve a revisión ─────────────────╮ │
│ │ Vamos a verificar el nombre nuevo en el colegio de           │ │
│ │ corredores. Mientras tu cuenta está en revisión no se ve     │ │
│ │ nada tuyo en público: tus propiedades no aparecen en el      │ │
│ │ mapa, sus fotos no se muestran, nadie puede mandarte una     │ │
│ │ consulta desde ahí y tu sitio propio queda apagado. Tampoco  │ │
│ │ vas a poder publicar propiedades nuevas.                     │ │
│ │                                                               │ │
│ │ No perdés nada de lo que tengas cargado: tus propiedades,    │ │
│ │ tus fotos y tus consultas quedan donde están, y todo vuelve  │ │
│ │ a verse solo en cuanto te aprobemos.                         │ │
│ │                                                               │ │
│ │ Si cambiás el nombre, vamos a ver el anterior y el nuevo     │ │
│ │ juntos para revisar el cambio. …                             │ │
│ ╰───────────────────────────────────────────────────────────────╯ │
│  [ Guardar datos ]                                               │
└──────────────────────────────────────────────────────────────────┘
```

### Con LAS DOS: nombre y dirección

Si además toca *"Cambiar la dirección"* en la tarjeta siguiente, la pantalla muestra las dos, una
debajo de la otra, cada una en su tarjeta:

```
┌─ Identidad de la inmobiliaria ───────────────────────────────────┐
│  … Nombre: [ Grupo Gaio ]                                        │
│ ╭─ 🕐 Al guardar, tu cuenta vuelve a revisión ─────────────────╮ │
│ │ … no se ve nada tuyo en público … No perdés nada …           │ │
│ ╰───────────────────────────────────────────────────────────────╯ │
│  [ Guardar datos ]                                               │
└──────────────────────────────────────────────────────────────────┘
┌─ Dirección de tu sitio ──────────────────────────────────────────┐
│  Tu dirección actual: 🔗 http://localhost:3000/inmobiliaria-gaio │
│  Dirección nueva: [ localhost:3000/ ][ grupo-gaio            ]   │
│ ╭─ ⚠ Los enlaces que ya compartiste van a dejar de funcionar ──╮ │
│ │ Tu sitio pasa a estar en …/grupo-gaio. La dirección          │ │
│ │ anterior, …/inmobiliaria-gaio, deja de funcionar apenas      │ │
│ │ confirmes: quien la abra va a ver una página inexistente.    │ │
│ │ … No se redirigen solos a la dirección nueva.                │ │
│ │ Tus propiedades, tus fotos y tus consultas no se tocan: lo   │ │
│ │ único que cambia es la dirección.                            │ │
│ ╰───────────────────────────────────────────────────────────────╯ │
│  [ Sí, cambiar la dirección ]  Cancelar                          │
└──────────────────────────────────────────────────────────────────┘
```

**Se leen como dos cosas distintas, y el tratamiento lo refuerza:**

| | Nombre | Dirección |
|---|---|---|
| Tono del `Notice` | **`info`** (🕐 `Clock`) — está en curso, nadie hizo nada mal | **`warning`** (⚠ `TriangleAlert`) — hay algo que se rompe |
| Qué anuncia | la cuenta **vuelve a revisión** y deja de verse **temporalmente** | los **enlaces compartidos** dejan de funcionar, **para siempre** |
| Qué aclara que NO pasa | *"No perdés nada de lo que tengas cargado"* | *"Tus propiedades, tus fotos y tus consultas no se tocan"* |
| Cuándo aparece | **al tipear** un nombre distinto | al tocar *"Cambiar la dirección"* |

⚠ **Y son dos confirmaciones separadas**, con dos botones y dos escrituras. Es la consecuencia
directa de que sean dos formularios: **no hay forma de "cambiar las dos en la misma edición"** hoy.
Lo señalo como la limitación real, no como un detalle.

---

## 6 · La guarda de agencia pendiente

⚠ **No existe, y nunca existió.** Barrido de `preferencias/actions.ts`: las únicas menciones a
`pending` son comentarios y la escritura `approval_status: "pending"`. **La guarda que había era la
inversa**: bloqueaba a las **aprobadas** (que es justo la que hubo que sacar).

**Qué pasa hoy con una agencia `pending`**, verificado:

```
approved  nombre cambió=true    -> pending              ← la transición nueva
approved  nombre cambió=false   sin cambio de estado
rejected  (cualquiera)          -> pending              ← el reenvío de siempre
pending   (cualquiera)          sin cambio de estado    ← ya está en la cola
```

**Una agencia `pending` puede cambiar su nombre, y el estado no se mueve** — ya está esperando. Es
coherente: el dueño va a revisar el nombre que tenga al momento de aprobar, el rastro
`previous_name` se escribe igual, y el botón *"Rechazar el nombre"* **no se le ofrece** porque
requiere `ever_approved` (lo verifica el panel y lo repite la action).

**No agregué la guarda** porque el prompt pide verificar una que existe, no crear una nueva, y
bloquear ese caso no tiene un motivo claro: no genera trabajo extra —la agencia ya está en la cola—
y le impediría corregir un nombre mal escrito justo mientras espera.

---

## 7 · Cómo probar el flujo completo

### Preparación

`npm run dev`, con dos sesiones: el **admin de una agencia** y el **dueño** (`ADMIN_USER_ID`).
Las tres agencias están `approved`, o sea el caso principal.

### A · Pedir el cambio (lo que antes no se podía)

1. Como admin, **Preferencias → Identidad de la inmobiliaria**.
2. ⚠ **El campo "Nombre de la inmobiliaria" ahora es un input**, no texto con candado. La matrícula
   sí queda en lectura, con su candado.
3. **Sin tocar nada, no hay ningún aviso.** Es correcto: abrir la pantalla no pide nada.
4. Escribí un nombre distinto (`Inmobiliaria Gaio` → `Grupo Gaio`). **Al tipear aparece el aviso**
   *"Al guardar, tu cuenta vuelve a revisión"* con las cuatro consecuencias y el *"No perdés nada"*.
5. Borrá el cambio y volvé al nombre original → **el aviso desaparece**.
6. Probá los bordes del campo: vacío → *"El nombre de la inmobiliaria es requerido"*; `A` → *"muy
   corto"*; el input corta a los 80 caracteres.
7. ⚠ Escribí el mismo nombre **con un espacio doble** (`Inmobiliaria  Gaio`) → **no aparece el
   aviso**: la normalización lo colapsa y no es un cambio.
8. Guardá. Verificá en la base:
   ```sql
   SELECT name, approval_status, previous_name, name_change_requested_at FROM agencies;
   ```
   → `name='Grupo Gaio'`, `approval_status='pending'`, `previous_name='Inmobiliaria Gaio'`, fecha.
9. Abrí el sitio de marca de esa agencia: **apagado**, tal como el aviso anticipó.

### B · Verlo en el panel de administración

1. Como dueño, `/admin`. En su fila:
   - celda **Agencia**: `Grupo Gaio` y debajo **`Antes: `~~`Inmobiliaria Gaio`~~**
   - celda **Aprobación**: `PENDIENTE` + el badge terracota **`CAMBIO DE NOMBRE`**
   - botones: **`Aprobar el nombre`** · **`Rechazar el nombre`**, y **`Rechazar la inmobiliaria`**
     en el menú `⋯`

### C · Los tres caminos de resolución

| Camino | Qué hacer | Qué verificar |
|---|---|---|
| **Aprobar** | `Aprobar el nombre` | `name='Grupo Gaio'`, `approved`, las dos columnas en `null`. El sitio vuelve, con el nombre nuevo |
| **Rechazar el nombre** | `Rechazar el nombre` + motivo | `name='Inmobiliaria Gaio'` (revertido), `approved`, columnas en `null`. **Como la agencia:** en Preferencias aparece *"El cambio de nombre que pediste no fue aprobado"* con el motivo, y el sitio funciona |
| **Rechazar la inmobiliaria** | menú `⋯` → `Rechazar la inmobiliaria` + motivo | ⚠ tiene que aparecer la advertencia *"Esta inmobiliaria está funcionando hoy"*. Después: `rejected`, `name='Grupo Gaio'` (**no** se revierte), columnas en `null`, sitio apagado |

### D · La guarda de suscripción acotada

1. Como dueño, **dar de baja** la suscripción de la agencia.
2. Como admin: cambiá **solo el logo** → **funciona**. Cambiá **solo la dirección** → **funciona**.
3. En Identidad, **guardá sin tocar el nombre** → **funciona** (antes lo rechazaba).
4. Ahora **cambiá el nombre** y guardá → *"Para cambiar el nombre necesitamos que tu suscripción
   esté al día…"*.
5. **Control negativo:** con la suscripción en `pending` (agencia recién registrada), cambiar el
   nombre **tiene que funcionar**. Si ahí se bloquea, la guarda quedó como lista blanca.

### E · La matrícula sigue congelada

1. Con la agencia aprobada, la matrícula se ve pero no se edita.
2. La barrera real está en el servidor: aunque un cliente manipulado mande otra, la action escribe
   la de la base (`effectiveLicenseNumber`).

### F · Sin regresión

Verificado contra el build: `/` → 200, `/dashboard/preferencias` → 307, `/admin` → 307,
`/inmobiliaria-demo` → 200, **cero errores en el log del servidor**.

---

## 8 · Los tres comandos

Se borraron `.next` y `tsconfig.tsbuildinfo` antes de medir.

### `npx tsc --noEmit`
```
(sin salida)
TSC_EXIT=0
```

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

LINT_EXIT=0
```

⚠ **El mismo y único warning del baseline.** No salió solo: el campo del nombre necesita su valor en
vivo para decidir si muestra el aviso, que es el caso típico de `watch()` — y `watch()` habría
sumado un segundo warning. Se usó `Controller`, que es lo que `CLAUDE.md` indica.

### `npx next build`
```
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

BUILD_EXIT=0
```

**Verde, exit 0, 22 rutas.**

| Métrica | Baseline | Medido | |
|---|---|---|---|
| `tsc --noEmit` | 0 errores, exit 0 | **0 errores, exit 0** | ✅ |
| `npm run lint` | 0 errores, 1 warning | **0 errores, 1 warning (`PropertyForm.tsx:808`), exit 0** | ✅ |
| `npx next build` | verde, 22 rutas | **verde, 22 rutas, exit 0** | ✅ |

---

## 9 · Lo falso y lo imposible, en limpio

### Lo falso

Está en el bloque de arriba de todo, pero lo repito porque es lo que más cambia la lectura del
trabajo: **cinco afirmaciones del prompt no se sostienen contra el código.** La más importante es
que *"el formulario de identidad edita la dirección y el logo"* y *"nunca le manda el nombre"* — en
realidad edita **nombre + matrícula** y **sí** le manda el nombre. El problema era otro: **el
formulario entero se ocultaba para una agencia aprobada**, y las tres lo están.

El efecto observable era exactamente el reportado, así que el pedido de fondo era correcto. Lo que
cambia es dónde estaba la causa — y por lo tanto qué había que tocar.

### Lo imposible

**El punto 5, tal como está descrito.** Requiere un diálogo único que acumule las dos advertencias,
y eso exige un formulario único con un submit único. Hoy el nombre y la dirección viven en
componentes separados con actions separadas, y fusionarlos es lo que el punto 1 prohíbe
explícitamente. **Verifiqué y documenté lo más cercano que sí existe** (§5): las dos advertencias
conviven en la pantalla, en tarjetas contiguas, con tonos e íconos distintos y textos que dicen
cosas distintas. Pero son dos confirmaciones, no una.

**Si se quiere el diálogo único, es una pieza propia**: fusionar `AgencyIdentityForm` y
`AgencySlugForm` en un formulario de "datos de la agencia" con un submit que llame a las dos
actions (o a una nueva que las combine), decidiendo antes qué pasa si una escritura falla y la otra
no. No lo hice porque excede el alcance y contradice una instrucción explícita.

### Una consecuencia asumida que conviene tener a la vista

La guarda de suscripción ahora dispara **solo cuando cambia el nombre**, que es lo pedido. El hueco:
una agencia **dada de baja Y sin aprobar** puede corregir su matrícula, y eso la reenvía a la cola —
o sea que genera el trabajo de aprobación que la guarda existe para evitar. Es un caso raro (exige
las dos condiciones juntas) y está comentado en el código. Cerrarlo sería extender la guarda a
"cambió el nombre **o** la matrícula", que es una decisión de una línea si se quiere tomar.
