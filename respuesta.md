# Informe — `location_source` en el schema documentado

> Tarea de documentación de schema. Se modificó **un solo archivo**:
> `supabase/migrations/20240101000000_initial_schema.sql`. No se ejecutó ningún comando de
> git ni ningún SQL de escritura; la base se leyó por MCP en solo lectura.
> Fecha del relevamiento: 31 ago 2026.

---

## 1. Lo medido (Paso 1)

### Definición de la columna

```sql
SELECT column_name, data_type, udt_name, is_nullable, column_default,
       character_maximum_length, ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name  = 'properties'
  AND column_name = 'location_source';
```

```
column_name      | data_type | udt_name | is_nullable | column_default | char_max_length | ordinal_position
-----------------+-----------+----------+-------------+----------------+-----------------+-----------------
location_source  | text      | text     | YES         | NULL           | NULL            | 34
```

- **Tipo:** `text` (sin largo máximo).
- **Nullability:** **nullable** (`is_nullable = YES`).
- **Default:** **ninguno** (`column_default` es `NULL`, o sea que no hay DEFAULT declarado).
- **Posición:** **34**, la última de la tabla — coherente con haberse agregado por `ALTER`.

### CHECK constraint, textual

```sql
SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class     rel ON rel.oid = con.conrelid
JOIN pg_namespace ns  ON ns.oid  = rel.relnamespace
WHERE ns.nspname = 'public'
  AND rel.relname = 'properties'
  AND pg_get_constraintdef(con.oid) ILIKE '%location_source%';
```

```
conname                          | contype | definition
---------------------------------+---------+--------------------------------------------------------------
properties_location_source_check | c       | CHECK (((location_source IS NULL) OR (location_source = ANY (ARRAY['manual'::text, 'suggested'::text]))))
```

Es **una sola** restricción, de tipo `c` (check), con el nombre autogenerado de un check a
nivel de columna (`<tabla>_<columna>_check`), y **admite `NULL` explícitamente**.

### Comprobaciones adicionales

- **`COMMENT ON` en la base:** ninguno. `col_description()` no devuelve nada para ninguna
  columna de `properties`, así que la explicación solo puede vivir en este archivo (que es
  justamente su rol).
- **Nada la lee en la base:** cero policies (`polqual`/`polwithcheck`), cero funciones
  (`prosrc`) y **cero índices** la mencionan. Confirma por medición que la columna no gatea
  nada del lado de Postgres.
- **Nada la ramifica en el código:** las únicas apariciones fuera de `src/types/` son las
  dos escrituras de `propiedades/actions.ts` (vía `normalizeLocationSource`) y la lectura
  del valor inicial en `PropertyForm.tsx`. Ninguna condición depende de su valor.

---

## 2. Dónde se agregó (Paso 2)

Tres bloques, todos dentro del mismo archivo. **No se tocó ninguna sentencia existente**:
lo único que se agregó es la columna y comentarios.

### a. La columna, en el bloque de Ubicación del `CREATE TABLE properties`

Va **inmediatamente después de `lng`** y antes de la columna generada `location`
(archivo actual: `supabase/migrations/20240101000000_initial_schema.sql:264`):

```sql
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  -- ── Origen de la coordenada (31 ago 2026, YA MIGRADO por ALTER) ────────
  -- De dónde salió el lat/lng de arriba:
  --   'manual'    → el agente arrastró el pin hasta el punto final.
  --   'suggested' → la ubicación la propuso el geocodificador a partir de la
  --                 dirección escrita, y el agente la confirmó SIN moverla.
  -- En los DOS casos el pin manual sigue siendo la fuente de verdad: la
  -- sugerencia es solo un punto de partida y no se guarda nada que el agente no
  -- haya confirmado. 'suggested' NO significa "sin revisar": significa
  -- "propuesta y aceptada tal cual".
  -- Vale la ÚLTIMA acción: si el agente pide una sugerencia y después arrastra
  -- el pin, la coordenada queda como 'manual'.
  --
  -- NULLABLE a propósito: las propiedades cargadas antes de que existiera el
  -- buscador de direcciones no tienen forma de saberlo, y ponerles un valor
  -- sería inventar el dato. Por eso el CHECK admite NULL explícitamente y la
  -- columna no tiene DEFAULT (que también sería inventarlo, en cada insert).
  --
  -- ⚠ Existe SOLO para poder MEDIR más adelante si las ubicaciones sugeridas
  -- quedaron peor puestas que las arrastradas a mano. NO gatea ni condiciona
  -- nada en la aplicación: ninguna query, policy, trigger ni pantalla ramifica
  -- por este valor, y no debe hacerlo. Si alguna vez condiciona una decisión,
  -- deja de medir el comportamiento y pasa a alterarlo.
  location_source  TEXT
                   CHECK (location_source IS NULL OR location_source IN ('manual','suggested')),
```

El formato del comentario sigue el que el archivo ya usa para columnas migradas a mano —
banner `── Título (fecha, YA MIGRADO por ALTER) ──` y después el porqué en prosa, igual que
`agencies.license_number` y `agencies.approval_status`.

**Por qué esto reproduce exactamente lo medido:**

- `TEXT` sin `NOT NULL` → `text`, nullable. ✅
- Sin cláusula `DEFAULT` → `column_default = NULL`. ✅
- El `CHECK` escrito **dentro de la definición de la columna** (constraint de columna, no de
  tabla) hace que Postgres le ponga el nombre autogenerado
  **`properties_location_source_check`**, idéntico al de la base. Si se hubiera escrito como
  constraint de tabla al final, el nombre habría sido el mismo, pero la forma de columna es
  la que usa el resto del archivo.
- `location_source IN ('manual','suggested')` es la forma que Postgres **normaliza** a
  `location_source = ANY (ARRAY['manual'::text, 'suggested'::text])`, que es exactamente lo
  que devolvió `pg_get_constraintdef`. Además `IN (...)` es el estilo que usan todos los
  demás CHECK del archivo (`status`, `property_type`, `currency`, `approval_status`…).

### b. Refinamiento del comentario del bloque de Ubicación (solo se agregó, no se borró nada)

El bloque abría con *"lat/lng se colocan MANUALMENTE moviendo un pin en el mapa (no por
geocoding automático)"*. Esas líneas **quedaron intactas**, y debajo se agregó la aclaración
de que la regla no se derogó sino que se refinó: hay un atajo **opcional** que sugiere una
ubicación a pedido explícito, sigue sin haber geocodificación automática, y la coordenada
que se guarda es siempre la confirmada. Sin esto, el comentario viejo y el de la columna
nueva se contradecían a dos líneas de distancia.

### c. Nota de fidelidad del encabezado

El archivo lleva una lista de "qué está YA MIGRADO" que se usa para saber si miente. Se le
agregó la entrada de `location_source` (fecha, que es dato de medición y no gatea nada, y
dónde está en el archivo), más la nota de orden de columnas del punto 3.

---

## 3. Diferencias encontradas

Una sola, y es de forma, no de fondo. Lo medido ganó donde correspondía.

**Orden de las columnas: en la base real `location_source` es la columna 34 (la última),
no una del bloque de ubicación.** Es la consecuencia normal de haberse agregado con
`ALTER TABLE ... ADD COLUMN`: Postgres la pone al final. La consigna pedía ubicarla junto a
`lat`/`lng`, y eso es lo que se hizo, porque es donde se entiende; pero significa que **una
base creada desde cero con este archivo tendría la columna en la posición ~27 en vez de la
34**.

- **No afecta la equivalencia funcional:** el tipo, la nullability, la ausencia de default y
  el CHECK (incluido su nombre) quedan idénticos. Todos los `INSERT` del código son por
  nombre, y los únicos `select("*")` que existen van con `head: true` (cuentan filas sin
  traer columnas), así que ninguna consulta depende del orden.
- **Queda anotado en el propio archivo**, en la nota de fidelidad, para que nadie compare las
  dos definiciones columna por columna y crea que encontró una discrepancia real.

Fuera de eso, **todo lo que describía la consigna coincide con lo medido**: `text`,
nullable, sin default, CHECK con `NULL` admitido y los dos valores `'manual'`/`'suggested'`.
No hubo nada que corregir en la semántica documentada.

Dos precisiones que salieron de medir y que la consigna no mencionaba, y quedaron escritas:

1. **La columna no tiene DEFAULT**, y eso es tan deliberado como el nullable: un default
   (`'manual'`, por ejemplo) inventaría el dato en cada insert que no lo mande, que es el
   mismo problema que backfillear las filas viejas.
2. **La afirmación "no gatea nada" está verificada, no asumida**: cero policies, cero
   funciones, cero índices y cero triggers la mencionan en la base, y en el código no hay
   ninguna rama que dependa de su valor.

---

## 4. Lo que quedó sin tocar

- **Todo el resto del archivo `.sql`.** Ninguna otra sentencia se modificó: solo se agregó
  una definición de columna y comentarios. `git status --porcelain` muestra únicamente
  `supabase/migrations/20240101000000_initial_schema.sql` modificado (más este informe).
- **Ningún otro archivo del repo.** `CLAUDE.md` ya documenta la columna y la feature desde
  la tanda anterior; no hacía falta tocar nada ahí.
- **Ningún comando de git** y **ningún SQL de escritura**. La columna ya está aplicada en la
  base: este trabajo era alinear la documentación con la base, no al revés.
- **No se corrieron `tsc` / `lint` / `build`**, como indicaba la consigna: el cambio es un
  `.sql` que no entra en la compilación.
- **El archivo no se ejecutó contra ninguna base para verificarlo**, porque el MCP está en
  solo lectura y el propio encabezado advierte que no debe correrse contra producción (los
  `CREATE TABLE` no son idempotentes). La equivalencia se sostiene por construcción, según
  lo detallado en el punto 2.a.
