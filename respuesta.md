# Puesta al día del schema documentado

> **Un solo archivo modificado:** `supabase/migrations/20240101000000_initial_schema.sql`
> (528 → 663 líneas). Ningún otro archivo tocado. **Cero comandos de git.** Cero SQL de
> escritura: todo lo de la base se leyó por MCP (que además está en `read_only`).
>
> **No encontré ninguna diferencia** entre lo que describiste y lo que dice la base. Sí
> encontré un objeto que no estaba en tu lista y dos cosas del archivo que el cambio
> vuelve trampas; están en §4.

---

## 1 · Lo medido (paso 1)

### 1.1 · `agencies` — columnas

```sql
SELECT ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='agencies' ORDER BY ordinal_position;
```

| # | columna | tipo | nullable | default |
|---|---|---|---|---|
| 1 | `id` | uuid | NO | `gen_random_uuid()` |
| 2 | `city_id` | uuid | NO | — |
| 3 | `name` | text | NO | — |
| 4 | `slug` | text | NO | — |
| 5 | `logo_url` | text | YES | — |
| 6 | `website` | text | YES | — |
| 7 | `brand_color` | text | YES | — |
| 8 | `created_at` | timestamptz | YES | `now()` |
| 9 | `tenant_type` | text | NO | `'agency'::text` |
| 10 | `phone_wa` | text | NO | — |
| **11** | **`license_number`** | **text** | **YES** | — |
| **12** | **`approval_status`** | **text** | **NO** | **`'pending'::text`** |

### 1.2 · `agencies` — constraints (`pg_get_constraintdef`), textual

```
agencies_approval_status_check   CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
agencies_tenant_type_check       CHECK ((tenant_type = ANY (ARRAY['individual'::text, 'agency'::text])))
agencies_city_id_fkey            FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT
agencies_pkey                    PRIMARY KEY (id)
agencies_slug_key                UNIQUE (slug)
```

### 1.3 · `agencies` — índices (`pg_get_indexdef`), textual

```
CREATE UNIQUE INDEX agencies_pkey ON public.agencies USING btree (id)
CREATE UNIQUE INDEX agencies_slug_key ON public.agencies USING btree (slug)
CREATE INDEX idx_agencies_city ON public.agencies USING btree (city_id)
CREATE INDEX idx_agencies_approval_status ON public.agencies USING btree (approval_status)
CREATE UNIQUE INDEX idx_agencies_license_unique_approved ON public.agencies USING btree (city_id, license_number) WHERE ((approval_status = 'approved'::text) AND (license_number IS NOT NULL))
```

### 1.4 · `agency_reviews` — columnas

| # | columna | tipo | nullable | default |
|---|---|---|---|---|
| 1 | `id` | uuid | NO | `gen_random_uuid()` |
| 2 | `agency_id` | uuid | NO | — |
| 3 | `decision` | text | NO | — |
| 4 | `note` | text | YES | — |
| 5 | `reviewed_by` | uuid | YES | — |
| 6 | `created_at` | timestamptz | **NO** | `now()` |

### 1.5 · `agency_reviews` — constraints, textual

```
agency_reviews_decision_check     CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))
agency_reviews_agency_id_fkey     FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
agency_reviews_reviewed_by_fkey   FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL
agency_reviews_pkey               PRIMARY KEY (id)
```

### 1.6 · `agency_reviews` — índices, textual

```
CREATE UNIQUE INDEX agency_reviews_pkey ON public.agency_reviews USING btree (id)
CREATE INDEX idx_agency_reviews_agency ON public.agency_reviews USING btree (agency_id, created_at DESC)
```

### 1.7 · RLS, policies y triggers

```json
[{"relname":"agencies","rls_habilitada":true,"rls_forzada":false,"policies":1,"triggers":0},
 {"relname":"agency_reviews","rls_habilitada":true,"rls_forzada":false,"policies":0,"triggers":0}]
```

**`agency_reviews` tiene RLS habilitada y CERO policies**, confirmado. `agencies`
conserva su única policy (`Public read agencies`, SELECT, `qual: true`). Ninguna de las
dos tablas tiene triggers.

---

## 2 · Qué agregué y dónde (pasos 2 y 3)

Cinco bloques, cada uno en la sección que el archivo ya usaba para esa clase de objeto.

| Dónde | Línea aprox. | Qué |
|---|---|---|
| Cabecera, "NOTA DE FIDELIDAD" | 25-37 | Entrada nueva: `license_number` + `approval_status` + `agency_reviews` YA MIGRADOS (28 ago 2026), con la mención del backfill (10 agencias a `'approved'`, sin matrícula) |
| `CREATE TABLE agencies` | 84-116 | Las dos columnas nuevas, entre `phone_wa` y `brand_color` |
| Después de `CREATE TABLE leads` | 285-322 | `CREATE TABLE agency_reviews` completo |
| Sección `--- ÍNDICES ---` | 399-434 | `idx_agencies_approval_status`, `idx_agencies_license_unique_approved` y `idx_agency_reviews_agency` |
| Sección `--- ROW LEVEL SECURITY ---` | 466-476 | `ALTER TABLE agency_reviews ENABLE ROW LEVEL SECURITY;` + el comentario de por qué queda sin policies |

**Ubicación de las columnas nuevas.** Las puse en su lugar lógico (después de
`phone_wa`, agrupadas como bloque de "legitimidad de la agencia"), que es lo que el
archivo ya venía haciendo con `tenant_type` y `phone_wa` — en la base real esas dos
también están al final por haber entrado por `ALTER`. Como eso es una divergencia real
entre archivo y base, aunque sea inocua, **la dejé anotada explícitamente** debajo del
`CREATE TABLE`: las cuatro columnas migradas están en la base en las posiciones 9 a 12,
el orden del archivo es más legible y no cambia nada porque todo el acceso es por
nombre.

**Ubicación de la tabla nueva.** Después de `leads`, no entre `agencies` y
`subscriptions`: así no parte la cadena de tablas centrales que el archivo ordena por
dependencia (`cities → agencies → subscriptions → agents → properties → …`). El
comentario de `approval_status` remite a ella, así que quien busque "todo lo de
agencias" la encuentra.

### Lo documentado en comentarios (paso 3)

Los cuatro porqués que pediste quedaron escritos en el archivo, cada uno pegado al
objeto que explica:

1. **Eje independiente** — en el comentario de `approval_status`, marcado con ⚠:
   *"Responde '¿es una inmobiliaria legítima?', que NO es lo mismo que '¿paga?' (eso lo
   responde subscriptions.plan/status). Los dos ejes se cruzan libremente: una agencia
   puede estar aprobada y sin plan pago, o pagar y seguir pendiente de aprobación.
   Nunca mezclarlos en una misma clasificación ni derivar uno del otro."*

2. **Por qué el índice es parcial** — arriba de `idx_agencies_license_unique_approved`,
   con las dos mitades de la condición separadas. El argumento central quedó así:
   *"Con el índice parcial la solicitud entra normal, queda 'pending', y el dueño ve las
   dos y decide cuál vale. El choque recién ocurre al aprobar la segunda — donde tiene
   que ocurrir: frente a una persona que puede resolverlo."* Y antes, el motivo de que
   un UNIQUE común sería peor: la solicitud legítima nunca llegaría al panel, y **un
   impostor que probara matrículas ajenas recibiría del propio formulario la
   confirmación de cuáles existen**.
   La **limitación conocida** quedó como bloque ⚠ aparte: los colegios son
   **provinciales**, no municipales, así que la misma agencia podría aprobarse dos veces
   dándose de alta en dos ciudades de la misma provincia. Mientras haya una ciudad por
   provincia no pasa nada; el día que no, hay que mover el índice a
   `(provincia, license_number)` — y anoté que eso arrastra decidir de dónde sale la
   provincia, porque hoy `cities.province` es TEXT libre.

3. **Por qué la nota va en `agency_reviews`** — encabezando su `CREATE TABLE`, marcado
   como "la razón de que exista esta tabla": `Public read agencies` con `USING (true)`
   deja leer la tabla entera con la anon key y sin sesión, **Postgres no permite
   restringir columnas dentro de una policy**, y la nota es un texto que el dueño
   escribe sobre un tercero. Más la segunda razón, independiente: como el rechazo no es
   definitivo, una columna sola se pisaría en cada vuelta y se perdería el rastro.

4. **Por qué RLS sin policies** — en la sección de RLS: *"No es un olvido: con RLS
   habilitada y sin ninguna policy, Postgres deniega todo — SELECT, INSERT, UPDATE y
   DELETE — para anon y authenticated. La tabla solo es accesible con SERVICE ROLE desde
   el server, que es exactamente como funciona el panel /admin."* Con la instrucción
   explícita de **no agregarle policies "por prolijidad"**, porque cualquier policy de
   SELECT abriría la nota a alguien.

### El archivo sigue siendo ejecutable

Verificado por estructura, no por ejecución (no corro SQL de escritura):

- **8 `CREATE TABLE` y 8 `ENABLE ROW LEVEL SECURITY`** — todas las tablas quedan con RLS.
- Las columnas escritas coinciden una a una, en tipo, nullability y default, con lo
  medido en §1.1 y §1.4.
- Los dos CHECK se escribieron con la sintaxis `IN (...)` que usa el resto del archivo;
  Postgres los normaliza a `= ANY (ARRAY[...])`, que es como los devuelve
  `pg_get_constraintdef` (por eso lo medido y lo escrito se ven distintos siendo lo
  mismo — igual que ya pasaba con `tenant_type`).
- El orden de creación respeta las dependencias: `agency_reviews` va después de
  `agencies` (FK) y su índice va en la sección de índices, que corre después de todos
  los `CREATE TABLE`.
- **Cero `CREATE POLICY` sobre `agency_reviews`**, confirmado por grep.

---

## 3 · Diferencias entre lo que describiste y la base

**Ninguna en las columnas, constraints, defaults, CHECKs, FKs ni RLS.** Todo lo que
enumeraste está en la base exactamente como lo enumeraste.

**Un objeto de más, no de menos:**

> `CREATE INDEX idx_agency_reviews_agency ON public.agency_reviews USING btree (agency_id, created_at DESC)`

No estaba en tu descripción de `agency_reviews` (mencionabas solo las columnas y las
FKs). Existe en la base, así que **gana la base**: lo documenté en la sección de
índices. Es justo el índice que sirve "traeme el historial de esta agencia, lo más nuevo
primero", y sigue el mismo patrón que `idx_leads_agency (agency_id, created_at DESC)`
que el archivo ya tenía.

---

## 4 · Encontrado al pasar

Dos cosas del propio archivo que el cambio vuelve trampas, y una nota sobre el alcance:

1. **El seed comentado del final ahora sembraría una agencia `'pending'`.** El bloque
   `INSERT INTO agencies (city_id, name, slug)` (dentro del `/* … */` del final) no pasa
   `approval_status`, así que caería en `'pending'` por DEFAULT y **la agencia demo no
   tendría sitio white-label** hasta aprobarla a mano — un rato de desconcierto para
   quien recree la base desde cero. Le agregué una nota ⚠ de tres líneas al comentario
   que ya tenía. Aproveché para señalar en la misma nota que ese INSERT **ya estaba roto
   desde antes**: no pasa `phone_wa`, que es `NOT NULL` sin default, así que fallaría
   igual. No arreglé el INSERT en sí (está comentado, es ilustrativo, y "arreglarlo"
   sería cambiar contenido ejecutable de un bloque que nadie corre); solo lo documenté.

2. **`cities.province` es TEXT libre y sin índice**, lo cual importa para la limitación
   provincial del punto 2 de §2: el día que haya que mover el índice único a
   `(provincia, license_number)`, no hay una entidad "provincia" de la que colgarse — hay
   un string por ciudad. Lo dejé escrito dentro del comentario del índice para que
   aparezca justo donde va a hacer falta, no en un `PENDIENTES.md` que quizás no se lea.

3. **No toqué nada fuera de este archivo**, como pediste — incluidos `CLAUDE.md` y
   `PENDIENTES.md`, que también describen el schema y ahora están un poco atrás
   (`CLAUDE.md` → "Base de Datos — Referencia Rápida" no menciona `agency_reviews` ni las
   columnas nuevas). Si querés, esa es una pasada aparte.
