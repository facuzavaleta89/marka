/**
 * Auditoría y limpieza de archivos huérfanos del bucket `property-images`.
 *
 * ─── POR QUÉ EXISTE ──────────────────────────────────────────────────────
 *
 * Durante meses los caminos que borraban filas no borraban los archivos, así
 * que el bucket acumuló archivos que ya no referencia nadie. Esos caminos ya
 * están arreglados (borrar una propiedad borra sus fotos, borrar un agente
 * borra su avatar), pero lo acumulado antes del arreglo no lo limpia nada.
 *
 * Y NO ES UNA HERRAMIENTA DE UN SOLO USO. Queda una vía irreducible por la que
 * se generan huérfanos nuevos: el borrado de la fila y el del archivo son dos
 * sistemas distintos y no se pueden transaccionar juntos, así que si el proceso
 * muere entre uno y otro, el archivo queda. Esto sirve para auditar cada tanto.
 *
 * ─── LA REGLA QUE GOBIERNA TODO ──────────────────────────────────────────
 *
 * ⚠ EL CRITERIO ES "¿EXISTE LA FILA QUE LO REFERENCIA?", NUNCA "¿ESTÁ
 * PUBLICADO?". La foto de una propiedad pausada, vendida o alquilada NO es
 * huérfana: la propiedad existe y se puede reactivar. Lo mismo con las
 * propiedades de una agencia dada de baja, cuyos datos se conservan intactos a
 * propósito (ver CLAUDE.md → "Panel de plataforma" → Dar de baja). Confundir
 * las dos preguntas borraría fotos de propiedades vivas.
 *
 * ─── CÓMO SE CORRE ───────────────────────────────────────────────────────
 *
 *   Simulación (predeterminado, NO borra nada):
 *     node --env-file=.env.local scripts/storage-orphans.ts
 *
 *   Borrado real:
 *     node --env-file=.env.local scripts/storage-orphans.ts --borrar
 *
 * `--env-file` es nativo de Node (20.6+) y carga `.env.local`: este script
 * corre fuera de Next.js, así que nadie le inyecta las variables de entorno.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Constantes de dominio ───────────────────────────────────────────────

// Bucket único del proyecto: fotos de propiedades, avatares y logos conviven
// ahí separados por prefijo de path. Ver CLAUDE.md → "Imágenes y Storage".
const BUCKET = "property-images";

const AVATARS_PREFIX = "avatars";
const LOGOS_PREFIX = "logos";

// Lo crea el panel de Supabase al crear una carpeta a mano. No referencia nada
// y no hay que recrearlo. Ojo: su mimetype es application/octet-stream, que hoy
// NO está en los allowed_mime_types del bucket, así que una vez borrado no se
// puede volver a subir por la API. Es lo deseado: son basura.
const PLACEHOLDER_NAME = ".emptyFolderPlaceholder";

// ⚠ NO SE BORRA NADA DE MENOS DE 24 HORAS, Y NO ES PRUDENCIA GENÉRICA.
// Al dar de alta una propiedad, las fotos se suben al bucket ANTES de que la
// propiedad exista en la base: el id se genera en el cliente (CreatePropertyInput
// .id) y las filas de property_images se escriben recién al guardar. O sea que
// un archivo bajo un property_id que todavía no existe puede ser basura de un
// formulario abandonado O un formulario que alguien tiene abierto en otra
// pestaña ahora mismo, y los dos casos son INDISTINGUIBLES desde acá.
// Se informan, nunca se borran — ni siquiera en modo borrado.
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Tope de la API de Storage para `remove()`: 1000 objetos por llamada.
const REMOVE_BATCH_SIZE = 1000;

// Paginación. `list()` trae 100 por página si no se le dice otra cosa y
// `select()` de PostgREST corta en 1000 filas: las dos cosas hay que paginarlas
// o el script diría que sobran archivos que en realidad están en uso.
const LIST_PAGE_SIZE = 1000;
const ROWS_PAGE_SIZE = 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Tipos ───────────────────────────────────────────────────────────────

interface StoredFile {
  path: string;
  sizeBytes: number;
  createdAt: Date | null;
}

type OrphanCategory =
  | "property_missing"
  | "avatar_unreferenced"
  | "logo_unreferenced"
  | "placeholder";

type Verdict =
  | { kind: "orphan"; category: OrphanCategory; reason: string }
  | { kind: "in_use"; reason: string }
  // Un path que no responde a ninguna de las formas conocidas. NUNCA se borra:
  // no saber qué es algo no autoriza a destruirlo.
  | { kind: "unknown_shape"; reason: string };

interface References {
  propertyIds: Set<string>;
  /** agent_id → path del avatar que la fila referencia (o null si no tiene). */
  avatarPathByAgent: Map<string, string | null>;
  /** agency_id → path del logo que la fila referencia (o null si no tiene). */
  logoPathByAgency: Map<string, string | null>;
}

interface ClassifiedFile extends StoredFile {
  verdict: Verdict;
  isRecent: boolean;
}

// ─── Salida: formato ─────────────────────────────────────────────────────

const CATEGORY_TITLES: Record<OrphanCategory, string> = {
  property_missing: "a) FOTO DE PROPIEDAD INEXISTENTE",
  avatar_unreferenced: "b) AVATAR SIN REFERENCIA",
  logo_unreferenced: "c) LOGO SIN REFERENCIA",
  placeholder: "d) PLACEHOLDER DE CARPETA",
};

const CATEGORY_ORDER: OrphanCategory[] = [
  "property_missing",
  "avatar_unreferenced",
  "logo_unreferenced",
  "placeholder",
];

function formatBytes(bytes: number): string {
  const exact = bytes.toLocaleString("es-AR");
  if (bytes < 1024) return `${exact} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${exact} B (${value.toFixed(2)} ${units[unit]})`;
}

function line(char = "─"): string {
  return char.repeat(74);
}

// ─── Cliente ─────────────────────────────────────────────────────────────

// ⚠ SERVICE ROLE, Y NO ES POR COMODIDAD: es el único client que alcanza los
// archivos que hay que borrar. Las cuatro policies de storage.objects comparan
// contra una fila (`agents` para las fotos de propiedad, `agencies` para los
// logos, auth.uid() para los avatares), y justamente los huérfanos son archivos
// cuya fila ya no existe: ninguna rama matchea y el borrado rebota para TODO
// usuario autenticado. Con service_role (rolbypassrls = true, medido) las
// policies ni se evalúan.
//
// El client se construye acá en vez de importar src/lib/supabase/admin.ts
// porque ese módulo se importa por el alias `@/…`, que lo resuelve el bundler
// de Next y no Node: desde un script suelto no hay quien lo traduzca. La forma
// de la llamada es idéntica a la de aquel helper.
function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ]
      .filter(Boolean)
      .join(", ");

    throw new Error(
      `Faltan variables de entorno: ${missing}.\n` +
        `Este script corre fuera de Next.js, así que hay que pasarle el archivo a mano:\n` +
        `  node --env-file=.env.local scripts/storage-orphans.ts`
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Paso 1: listar TODO el bucket ───────────────────────────────────────

// `list()` devuelve un solo nivel y mezcla archivos con carpetas (las carpetas
// vienen con `id: null`), así que hay que bajar recursivamente. Y pagina: sin
// el bucle de offset, un bucket con más de LIST_PAGE_SIZE entradas en una misma
// carpeta se leería incompleto — y lo que no se lee no se audita, que es el
// error inofensivo de los dos posibles.
async function listAllFiles(
  supabase: SupabaseClient,
  prefix = ""
): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });

    // Fail-closed: un listado incompleto haría pasar por "en uso" a archivos
    // que no se llegaron a ver, pero sobre todo dejaría el conteo mintiendo.
    if (error) {
      throw new Error(
        `No se pudo listar "${prefix || "(raíz)"}" del bucket: ${error.message}`
      );
    }
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.id === null) {
        // Es una carpeta: bajar.
        files.push(...(await listAllFiles(supabase, path)));
        continue;
      }

      files.push({
        path,
        sizeBytes: entry.metadata?.size ?? 0,
        createdAt: entry.created_at ? new Date(entry.created_at) : null,
      });
    }

    if (data.length < LIST_PAGE_SIZE) break;
    offset += data.length;
  }

  return files;
}

// ─── Paso 2: traer las filas contra las que se compara ───────────────────

// ⚠ TODA LECTURA ES FAIL-CLOSED, Y ACÁ ESTÁ EL RIESGO MÁS GRAVE DEL SCRIPT.
// Si la lista de propiedades vuelve incompleta —un error de red, una página que
// falta— las fotos de las propiedades que no se leyeron pasan a "propiedad
// inexistente" y en modo borrado SE BORRAN. Por eso cualquier error aborta todo
// y no se borra nada: es el mismo criterio que deleteAgencyAction, donde "un
// count que no se pudo leer NO es un cero".
async function fetchAllRows<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  columns: string
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + ROWS_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`No se pudo leer la tabla ${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    // El cast va por `unknown` porque `columns` es un string variable y
    // PostgREST no puede inferir la forma de la fila. Mismo patrón que el
    // SELECT acotado de useProperties (ver CLAUDE.md → "Mapa — performance"),
    // con la misma advertencia: acá el compilador no ayuda, así que las
    // columnas que se pidan tienen que coincidir con el tipo que se pasa.
    rows.push(...(data as unknown as T[]));

    if (data.length < ROWS_PAGE_SIZE) break;
    from += data.length;
  }

  return rows;
}

// Traduce la URL pública guardada en la base al path dentro del bucket.
//
// Réplica deliberada de `src/lib/utils/storagePath.ts`: ese módulo se importa
// por el alias `@/…` y no hay forma de resolverlo desde un script suelto (ver
// createServiceRoleClient). Si cambia el criterio de allá, cambiarlo acá.
//
// ⚠ SE DESCARTA LA QUERY STRING, Y NO ES DECORATIVO. Si una URL guardada
// llevara un cache-buster (`?t=…`), la comparación exacta contra el path
// fallaría y el archivo VIVO se clasificaría como huérfano — o sea que el
// script borraría el logo que la agencia está mostrando. Un path nunca contiene
// "?" ni "#", así que recortarlos es seguro y cierra ese agujero.
function extractStoragePath(url: string | null): string | null {
  if (!url) return null;

  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;

  const path = url.slice(index + marker.length).split(/[?#]/)[0];
  return path === "" ? null : path;
}

async function fetchReferences(supabase: SupabaseClient): Promise<References> {
  const [properties, agents, agencies] = await Promise.all([
    fetchAllRows<{ id: string }>(supabase, "properties", "id"),
    fetchAllRows<{ id: string; avatar_url: string | null }>(
      supabase,
      "agents",
      "id, avatar_url"
    ),
    fetchAllRows<{ id: string; logo_url: string | null }>(
      supabase,
      "agencies",
      "id, logo_url"
    ),
  ]);

  return {
    propertyIds: new Set(properties.map((row) => row.id)),
    avatarPathByAgent: new Map(
      agents.map((row) => [row.id, extractStoragePath(row.avatar_url)])
    ),
    logoPathByAgency: new Map(
      agencies.map((row) => [row.id, extractStoragePath(row.logo_url)])
    ),
  };
}

// ─── Paso 3: clasificar ──────────────────────────────────────────────────

function classify(file: StoredFile, refs: References): Verdict {
  const segments = file.path.split("/");
  const fileName = segments[segments.length - 1];

  // d) PLACEHOLDER. Va primero porque puede aparecer en cualquiera de los tres
  // prefijos y no depende de ninguna fila.
  if (fileName === PLACEHOLDER_NAME) {
    return {
      kind: "orphan",
      category: "placeholder",
      reason: "marcador de carpeta vacía del panel de Supabase",
    };
  }

  // Las tres formas conocidas tienen 3 segmentos como mínimo. Cualquier otra
  // cosa no se toca.
  if (segments.length < 3) {
    return { kind: "unknown_shape", reason: "el path no tiene la forma esperada" };
  }

  const [first, second] = segments;

  // b) AVATAR — avatars/{agent_id}/{archivo}
  if (first === AVATARS_PREFIX) {
    if (!UUID_PATTERN.test(second)) {
      return { kind: "unknown_shape", reason: "la carpeta no es un id de agente" };
    }
    if (!refs.avatarPathByAgent.has(second)) {
      return {
        kind: "orphan",
        category: "avatar_unreferenced",
        reason: `no existe el agente ${second}`,
      };
    }
    // Existe el agente pero su columna apunta a otro archivo: es el avatar
    // viejo que quedó cuando subió uno con otra extensión (el upsert pisa el
    // mismo path, no el de otra extensión).
    if (refs.avatarPathByAgent.get(second) !== file.path) {
      return {
        kind: "orphan",
        category: "avatar_unreferenced",
        reason: "el agente existe pero su avatar_url apunta a otro archivo",
      };
    }
    return { kind: "in_use", reason: "avatar referenciado por su agente" };
  }

  // c) LOGO — logos/{agency_id}/{archivo}
  if (first === LOGOS_PREFIX) {
    if (!UUID_PATTERN.test(second)) {
      return { kind: "unknown_shape", reason: "la carpeta no es un id de agencia" };
    }
    if (!refs.logoPathByAgency.has(second)) {
      return {
        kind: "orphan",
        category: "logo_unreferenced",
        reason: `no existe la agencia ${second}`,
      };
    }
    if (refs.logoPathByAgency.get(second) !== file.path) {
      return {
        kind: "orphan",
        category: "logo_unreferenced",
        reason: "la agencia existe pero su logo_url apunta a otro archivo",
      };
    }
    return { kind: "in_use", reason: "logo referenciado por su agencia" };
  }

  // a) FOTO DE PROPIEDAD — {uploader_agent_id}/{property_id}/{archivo}
  //
  // ⚠ EL PRIMER SEGMENTO ES EL AGENTE QUE SUBIÓ EL ARCHIVO, NO EL DUEÑO DE LA
  // PROPIEDAD (ver CLAUDE.md → "Imágenes y Storage"), así que NO se lo usa para
  // decidir nada: un agente borrado no vuelve huérfanas las fotos de las
  // propiedades que se reasignaron a su admin y siguen publicadas. Lo único que
  // manda es el SEGUNDO segmento: ¿existe esa propiedad?
  if (!UUID_PATTERN.test(second)) {
    return { kind: "unknown_shape", reason: "la carpeta no es un id de propiedad" };
  }
  if (!refs.propertyIds.has(second)) {
    return {
      kind: "orphan",
      category: "property_missing",
      reason: `no existe la propiedad ${second}`,
    };
  }
  return { kind: "in_use", reason: "foto de una propiedad que existe" };
}

// ⚠ Un archivo cuya antigüedad NO se puede establecer se trata como RECIENTE,
// no como viejo: ante la duda no se borra.
function isRecent(file: StoredFile, now: number): boolean {
  if (!file.createdAt || Number.isNaN(file.createdAt.getTime())) return true;
  return now - file.createdAt.getTime() < RECENT_WINDOW_MS;
}

// ─── Paso 4: informe ─────────────────────────────────────────────────────

function report(files: ClassifiedFile[], deleteMode: boolean): ClassifiedFile[] {
  const orphans = files.filter((f) => f.verdict.kind === "orphan");
  const inUse = files.filter((f) => f.verdict.kind === "in_use");
  const unknown = files.filter((f) => f.verdict.kind === "unknown_shape");

  const deletable = orphans.filter((f) => !f.isRecent);
  const skipped = orphans.filter((f) => f.isRecent);

  for (const category of CATEGORY_ORDER) {
    const group = orphans.filter(
      (f) => f.verdict.kind === "orphan" && f.verdict.category === category
    );

    console.log(`\n${line()}`);
    console.log(`  ${CATEGORY_TITLES[category]}`);
    console.log(line());

    if (group.length === 0) {
      console.log("  (ninguno)");
      continue;
    }

    for (const file of group) {
      const tag = file.isRecent ? "  [RECIENTE, SE OMITE] " : "  ";
      console.log(`${tag}${file.path}`);
      console.log(`      ${formatBytes(file.sizeBytes)}`);
      if (file.verdict.kind === "orphan") {
        console.log(`      → ${file.verdict.reason}`);
      }
    }

    const bytes = group.reduce((sum, f) => sum + f.sizeBytes, 0);
    const recentInGroup = group.filter((f) => f.isRecent).length;
    console.log(
      `\n  Subtotal: ${group.length} archivo(s) · ${formatBytes(bytes)}` +
        (recentInGroup > 0 ? ` · ${recentInGroup} omitido(s) por recientes` : "")
    );
  }

  if (unknown.length > 0) {
    console.log(`\n${line()}`);
    console.log("  FORMA NO RECONOCIDA — NO SE TOCA");
    console.log(line());
    for (const file of unknown) {
      console.log(`  ${file.path}`);
      console.log(`      ${formatBytes(file.sizeBytes)}`);
      if (file.verdict.kind === "unknown_shape") {
        console.log(`      → ${file.verdict.reason}`);
      }
    }
    console.log(`\n  Subtotal: ${unknown.length} archivo(s)`);
  }

  const orphanBytes = orphans.reduce((sum, f) => sum + f.sizeBytes, 0);
  const deletableBytes = deletable.reduce((sum, f) => sum + f.sizeBytes, 0);
  const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);

  console.log(`\n${line("═")}`);
  console.log("  TOTALES");
  console.log(line("═"));
  console.log(`  Objetos en el bucket : ${files.length} · ${formatBytes(totalBytes)}`);
  console.log(`  En uso               : ${inUse.length}`);
  console.log(`  Forma no reconocida  : ${unknown.length}`);
  console.log(`  Huérfanos            : ${orphans.length} · ${formatBytes(orphanBytes)}`);
  console.log(`     de los cuales:`);
  console.log(`     · borrables       : ${deletable.length} · ${formatBytes(deletableBytes)}`);
  console.log(`     · recientes (<24h): ${skipped.length}  ← nunca se borran`);

  if (totalBytes > 0) {
    const share = ((orphanBytes / totalBytes) * 100).toFixed(1);
    console.log(`  Los huérfanos son el ${share}% del peso del bucket.`);
  }

  if (!deleteMode) {
    console.log(`\n  MODO SIMULACIÓN: no se borró nada.`);
    console.log(`  Para borrar los ${deletable.length} archivo(s) borrables:`);
    console.log(`    node --env-file=.env.local scripts/storage-orphans.ts --borrar`);
  }

  return deletable;
}

// ─── Paso 5: borrar ──────────────────────────────────────────────────────

// ⚠ SE BORRA POR LA API DE STORAGE, NUNCA POR SQL. Borrar filas de
// storage.objects con SQL NO borra el archivo del almacenamiento: lo deja
// facturándose y sin registro desde el cual encontrarlo. Está documentado por
// Supabase ("Deleting objects should always be done via the Storage API and NOT
// via a SQL query").
async function removeFiles(
  supabase: SupabaseClient,
  files: ClassifiedFile[]
): Promise<void> {
  console.log(`\n${line("═")}`);
  console.log("  BORRADO");
  console.log(line("═"));

  if (files.length === 0) {
    console.log("  No hay nada para borrar.");
    return;
  }

  const paths = files.map((f) => f.path);
  const removed = new Set<string>();
  const failures: { path: string; reason: string }[] = [];

  for (let i = 0; i < paths.length; i += REMOVE_BATCH_SIZE) {
    const batch = paths.slice(i, i + REMOVE_BATCH_SIZE);
    const batchNumber = Math.floor(i / REMOVE_BATCH_SIZE) + 1;
    const batchCount = Math.ceil(paths.length / REMOVE_BATCH_SIZE);

    console.log(`\n  Lote ${batchNumber}/${batchCount} — ${batch.length} archivo(s)…`);

    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);

    if (error) {
      // El lote entero falló: se anotan todos y se sigue con el próximo. Un
      // lote caído no tiene por qué dejar sin borrar a los demás.
      for (const path of batch) failures.push({ path, reason: error.message });
      console.log(`    ✗ el lote falló: ${error.message}`);
      continue;
    }

    // `remove()` devuelve los objetos que EFECTIVAMENTE borró. Comparar lo
    // pedido contra lo devuelto es lo que hace visible un borrado parcial:
    // mirar solo `error` lo dejaría pasar en silencio.
    for (const object of data ?? []) removed.add(object.name);
    for (const path of batch) {
      if (!removed.has(path)) {
        failures.push({ path, reason: "la API no lo devolvió como borrado" });
      }
    }
    console.log(`    ✓ ${data?.length ?? 0} borrado(s)`);
  }

  const removedBytes = files
    .filter((f) => removed.has(f.path))
    .reduce((sum, f) => sum + f.sizeBytes, 0);

  console.log(`\n${line()}`);
  console.log(`  Borrados : ${removed.size} de ${paths.length} · ${formatBytes(removedBytes)}`);
  console.log(`  Fallaron : ${failures.length}`);

  if (failures.length > 0) {
    console.log(`\n  Los que quedaron:`);
    for (const failure of failures) {
      console.log(`    ${failure.path}`);
      console.log(`        → ${failure.reason}`);
    }
    console.log(
      `\n  Volvé a correr el script para reintentar: los que sí se borraron ya no aparecen.`
    );
  }
}

// ─── Main ────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { deleteMode: boolean } {
  const args = argv.slice(2);
  const deleteMode = args.includes("--borrar");

  // ⚠ Un argumento desconocido ABORTA en vez de caer en simulación. Correr con
  // "--borar" y ver un informe sin borrados haría pensar que no había nada que
  // borrar, cuando en realidad no se pidió el borrado.
  const unknown = args.filter((arg) => arg !== "--borrar");
  if (unknown.length > 0) {
    throw new Error(
      `Argumento(s) no reconocido(s): ${unknown.join(", ")}\n` +
        `Uso:\n` +
        `  node --env-file=.env.local scripts/storage-orphans.ts            (simulación)\n` +
        `  node --env-file=.env.local scripts/storage-orphans.ts --borrar   (borra)`
    );
  }

  return { deleteMode };
}

async function main(): Promise<void> {
  const { deleteMode } = parseArgs(process.argv);
  const supabase = createServiceRoleClient();
  const now = Date.now();

  console.log(line("═"));
  console.log(`  ARCHIVOS HUÉRFANOS — bucket ${BUCKET}`);
  console.log(
    `  Modo: ${deleteMode ? "BORRADO (destructivo)" : "SIMULACIÓN (no borra nada)"}`
  );
  console.log(`  Fecha: ${new Date(now).toISOString()}`);
  console.log(line("═"));

  console.log("\n  Listando el bucket…");
  const files = await listAllFiles(supabase);

  console.log("  Leyendo las filas de referencia…");
  const refs = await fetchReferences(supabase);
  console.log(
    `  ${files.length} objeto(s) · ${refs.propertyIds.size} propiedad(es) · ` +
      `${refs.avatarPathByAgent.size} agente(s) · ${refs.logoPathByAgency.size} agencia(s)`
  );

  const classified: ClassifiedFile[] = files.map((file) => ({
    ...file,
    verdict: classify(file, refs),
    isRecent: isRecent(file, now),
  }));

  const deletable = report(classified, deleteMode);

  if (deleteMode) {
    await removeFiles(supabase, deletable);
  }

  console.log("");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✗ ${message}\n`);
  console.error("  No se borró nada.\n");
  process.exitCode = 1;
});
