"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveAgentSession } from "@/lib/utils/resolveAgentSession";
import {
  LICENSE_NUMBER_ERROR,
  LICENSE_NUMBER_PATTERN,
  normalizeLicenseNumber,
} from "@/lib/utils/licenseNumber";
import {
  isAgencySlugTaken,
  normalizeAgencySlug,
  validateAgencySlug,
} from "@/lib/utils/agencySlug";
import {
  normalizeAgencyName,
  validateAgencyName,
} from "@/lib/utils/agencyName";
import { PHONE_WA_ERROR, resolvePhoneWaForSave } from "@/lib/utils/phoneWa";
import { isStoragePublicUrl } from "@/lib/utils/storagePublicUrl";
import { translateFormatCheckError } from "@/lib/utils/dbFormatErrors";

type ActionResult = { error: string } | undefined;

// El logo se sube client-side a Storage (bucket público); acá solo persistimos la
// URL pública ya resultante. Tiene que ser una URL del Storage del proyecto: lo
// mismo que exige el CHECK agencies_logo_url_storage de la base.
const agencyLogoSchema = z.object({
  logo_url: z
    .string()
    .url("URL de logo inválida")
    .refine(isStoragePublicUrl, "El logo no es válido. Volvé a subirlo."),
});

// Actualiza el teléfono de WhatsApp de la agencia del admin logueado.
// SEGURIDAD: solo el admin de la agencia puede tocar datos de la agencia. El
// role y el agency_id se leen del server (fila agents por auth.uid()), nunca del
// cliente. Como no hay policy de UPDATE de agencies para usuarios, se escribe con
// service role acotando el UPDATE a la agencia del caller.
//
// FORMATO: el de lib/utils/phoneWa, el mismo que el formulario y que los otros
// tres caminos que escriben un teléfono. ⚠ Acá decía "mismo formato que en el
// resto (perfil, alta de agente)", y perfil no validaba nada en el servidor.
//
// ⚠ DEVUELVE `{ changed }`, NO `undefined`, Y ESE BOOLEANO ES LA PIEZA. Este
// formulario guarda UNA sola cosa, y su mensaje la nombra ("Teléfono de la
// agencia actualizado"). Con un número guardado en un formato inesperado,
// `resolvePhoneWaForSave` lo devuelve TAL CUAL —a propósito: corregirlo sería
// cambiarle el teléfono a alguien sin que lo pida—, así que guardar sin tocar
// nada terminaba escribiendo el mismo valor y afirmando "actualizado" a dos
// dedos del aviso que dice "No lo cambiamos por vos". Ahora, si el número que
// llega es el que ya está guardado, NO SE ESCRIBE y el formulario lo dice.
// (ProfileForm no comparte el problema: su submit guarda tres campos, así que
// "Perfil actualizado" puede ser cierto aunque el teléfono no haya cambiado.)
export async function updateAgencyPhoneAction(input: {
  phone_wa: string;
}): Promise<{ error: string } | { changed: boolean }> {
  if (typeof input?.phone_wa !== "string") {
    return { error: PHONE_WA_ERROR };
  }

  // Es una action: ante sesión inválida devuelve error, NO redirige (redirigir
  // desde un submit rompe el manejo de errores del formulario que la llama).
  // Mismos mensajes que antes.
  const session = await resolveAgentSession();
  if (session.status !== "ok") return { error: "No autenticado" };
  const caller = session.agent;
  if (caller.role !== "admin") return { error: "No autorizado" };

  const admin = createAdminClient();

  // El número guardado HOY, de la fila real y no del cliente: es el único valor
  // que se acepta sin reformatear, para que guardar sin tocar un número viejo
  // con otro formato no lo cambie. La validación va después de la sesión porque
  // necesita saber de qué agencia es el número guardado.
  const { data: current, error: readError } = await admin
    .from("agencies")
    .select("phone_wa")
    .eq("id", caller.agency_id)
    .single();

  if (readError || !current) {
    return { error: "No se pudo actualizar el teléfono de la agencia. Intentá de nuevo." };
  }

  const phone_wa = resolvePhoneWaForSave(input.phone_wa, current.phone_wa ?? null);
  if (phone_wa === null) return { error: PHONE_WA_ERROR };

  // Sin cambios: no se escribe y se sale temprano. La comparación va contra la
  // fila REAL (`current`, releída con service role arriba), nunca contra un
  // valor que mande el cliente — mismo criterio que la comparación de nombre de
  // updateAgencyIdentityAction. No se revalida la ruta: no hay nada que
  // refrescar.
  if (phone_wa === current.phone_wa) return { changed: false };

  const { error } = await admin
    .from("agencies")
    .update({ phone_wa })
    .eq("id", caller.agency_id);

  if (error) {
    return {
      error:
        translateFormatCheckError(error) ??
        "No se pudo actualizar el teléfono de la agencia. Intentá de nuevo.",
    };
  }

  revalidatePath("/dashboard/preferencias");
  return { changed: true };
}

// Persiste la URL del logo de la agencia del admin logueado. El archivo ya se subió
// a Storage client-side; acá solo escribimos la URL en agencies.logo_url.
// SEGURIDAD: idéntica a updateAgencyPhoneAction — lo sensible es la escritura en la
// tabla agencies (dato de agencia, gateado a admin), no el archivo en el bucket
// público. role y agency_id se leen del server (fila agents por auth.uid()), nunca
// del cliente. Sin policy de UPDATE de agencies para usuarios → service role acotado
// al agency_id del caller.
export async function updateAgencyLogoAction(input: {
  logo_url: string;
}): Promise<ActionResult> {
  const parsed = agencyLogoSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { logo_url } = parsed.data;

  // Es una action: ante sesión inválida devuelve error, NO redirige (redirigir
  // desde un submit rompe el manejo de errores del formulario que la llama).
  // Mismos mensajes que antes.
  const session = await resolveAgentSession();
  if (session.status !== "ok") return { error: "No autenticado" };
  const caller = session.agent;
  if (caller.role !== "admin") return { error: "No autorizado" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("agencies")
    .update({ logo_url })
    .eq("id", caller.agency_id);

  if (error) {
    return {
      error:
        translateFormatCheckError(error) ??
        "No se pudo actualizar el logo de la agencia. Intentá de nuevo.",
    };
  }

  revalidatePath("/dashboard/preferencias");
}

// Identidad de la agencia: razón social + matrícula del colegio de corredores.
//
// ══════════════════════════════════════════════════════════════
// LOS DOS CAMPOS NO TIENEN LA MISMA REGLA, Y ESA ES LA DIFERENCIA
// ══════════════════════════════════════════════════════════════
//
//   · NOMBRE     → se puede cambiar SIEMPRE, incluso con la agencia aprobada.
//     El cambio vuelve a pasar por revisión (el colegio de corredores regula los
//     nombres comerciales), y ese viaje a la cola es justamente el flujo que el
//     panel ya sabe resolver: ve el nombre anterior junto al nuevo y decide.
//   · MATRÍCULA  → se congela al aprobar, como estaba. Es el dato que se
//     verificó contra el padrón para dar el alta, y cambiarlo no es "revisar un
//     nombre": es otra inmobiliaria.
//
// ⚠ ACÁ DECÍA QUE **LOS DOS** QUEDABAN CONGELADOS "porque cambiar el nombre
// tendría que pasar por otro flujo de aprobación QUE HOY NO EXISTE". Ese flujo
// ya existe —se construyó entero: el rastro en `previous_name`, la distinción en
// el panel y las dos formas de rechazo— y el congelamiento del nombre era lo
// único que faltaba sacar. Mientras estuvo, **toda esa maquinaria era
// inalcanzable**: sin campo que escribiera `previous_name`, nada llegaba nunca
// al panel.
//
// ⚠ LA VALIDACIÓN DE ESA REGLA VIVE ACÁ Y SOLO ACÁ. `agencies` no tiene policy
// de UPDATE, así que la escritura va con service role y la RLS no protege nada:
// deshabilitar los inputs en la interfaz es cosmético. El estado se LEE del
// server (fila agencies por el agency_id de la sesión), nunca de lo que mande
// el cliente.
//
// REENVÍO DE LA SOLICITUD: si la agencia estaba 'rejected', guardar la devuelve
// a 'pending'. Es la corrección del cliente volviendo a la cola, sin que el
// dueño tenga que intervenir. Si ya estaba 'pending', el estado no se toca.
const agencyIdentitySchema = z.object({
  // Mismo molde que la matrícula: normaliza y después valida, con la MISMA
  // función que usa el formulario (un solo criterio, dos capas).
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

export async function updateAgencyIdentityAction(input: {
  name: string;
  license_number: string;
}): Promise<{ error: string } | { resubmitted: boolean }> {
  const parsed = agencyIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, license_number } = parsed.data;

  const session = await resolveAgentSession();
  if (session.status !== "ok") return { error: "No autenticado" };
  if (session.agent.role !== "admin") return { error: "No autorizado" };

  const admin = createAdminClient();

  // El estado que rige se relee del server; el de la sesión sirve para la UI,
  // pero para autorizar una escritura se consulta la fila real.
  // ⚠ SE NOMBRAN `name` Y `previous_name` ADEMÁS DEL ESTADO. Es una lista
  // explícita de columnas: lo que no se nombra no llega, y el nombre vigente es
  // justo lo que hay que guardar como anterior si cambia.
  const { data: agency } = await admin
    .from("agencies")
    .select("approval_status, name, previous_name, license_number")
    .eq("id", session.agent.agency_id)
    .maybeSingle();

  if (!agency) return { error: "No se encontró la agencia" };

  const isApproved = agency.approval_status === "approved";

  // ══════════════════════════════════════════════════════════════
  // ⚠ LA MATRÍCULA SE CONGELA AL APROBAR; EL NOMBRE NO
  // ══════════════════════════════════════════════════════════════
  //
  // Acá había un corte que rechazaba la escritura ENTERA para una agencia
  // aprobada. Eso es lo que volvía inalcanzable todo el flujo de cambio de
  // nombre: no había forma de escribir `previous_name`, así que el panel nunca
  // recibía nada que distinguir.
  //
  // Ahora el corte es por campo. La matrícula es el dato que se verificó contra
  // el padrón del colegio para dar el alta: cambiarla no es "revisar un
  // nombre", es otra inmobiliaria. El nombre sí puede cambiar, y por eso vuelve
  // a revisión.
  //
  // ⚠ NO SE RECHAZA EL PEDIDO SI VIENE UNA MATRÍCULA DISTINTA: SE IGNORA. El
  // formulario ya la muestra en solo lectura para una agencia aprobada, pero eso
  // es cosmético —una server action se invoca sin pasar por el render—, así que
  // el valor que se escribe sale SIEMPRE de la fila real. Devolver un error
  // sería castigar a quien no hizo nada: en el camino normal el campo ni siquiera
  // se puede tocar, y lo que la persona quiso cambiar es el nombre.
  const effectiveLicenseNumber = isApproved
    ? (agency.license_number ?? license_number)
    : license_number;

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
  // ⚠ ES LISTA NEGRA (`canceled`/`past_due`), NUNCA "distinto de active", igual
  // que el trigger de publicación. El dominio tiene cuatro valores y `'pending'`
  // significa "todavía no tenés nada activo": es una agencia recién registrada
  // esperando la activación manual, que está perfectamente al día y tiene que
  // poder corregir sus datos mientras espera — es más, es JUSTO la que más lo
  // necesita, porque es la que todavía no fue aprobada.
  //
  // ⚠ Y SIN FILA DE SUSCRIPCIÓN NO SE BLOQUEA. Ese estado ya no es producible
  // (lo garantiza el trigger `trg_ensure_agency_subscription`), y si apareciera,
  // a esa agencia no le falta pagar: le falta una fila. Mandarla a reactivar una
  // suscripción que no existe sería mandarla a un lugar donde no hay nada.
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
      // No suena a castigo: explica el orden de las cosas y dice qué hacer
      // primero. Y no promete que después sí, porque la aprobación es otra
      // decisión: promete que se puede volver a pedir.
      return {
        error:
          "Para cambiar el nombre necesitamos que tu suscripción esté al día: el cambio vuelve a pasar por revisión y eso lo hacemos sobre cuentas activas. Reactivá tu suscripción y volvé a intentarlo.",
      };
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ⚠ EL RASTRO DEL CAMBIO DE NOMBRE — `previous_name` + `name_change_requested_at`
  // ══════════════════════════════════════════════════════════════
  //
  // Sin esto, el dueño de la plataforma ve "Pendiente" y no puede distinguir un
  // alta nueva de una agencia que solo se cambió el nombre, ni saber cómo se
  // llamaba antes: aprueba a ciegas. Las dos columnas son el rastro, y se
  // escriben EN LA MISMA ESCRITURA que ya devuelve la agencia a la cola — una
  // sola operación, sin un UPDATE de más y sin un estado intermedio posible.
  //
  // LA CONDICIÓN ES QUE EL NOMBRE HAYA CAMBIADO DE VERDAD, no que la agencia
  // estuviera rechazada. Guardar la misma razón social otra vez —o corregir solo
  // la matrícula— no es un cambio de nombre y no tiene por qué anunciarse como
  // tal en el panel: le agregaría ruido al dueño justo donde busca señal.
  // (`nameChanged` se calcula más arriba: la guarda de suscripción lo necesita.)

  // ⚠ SI YA HABÍA UN CAMBIO PENDIENTE, `previous_name` NO SE PISA. Si la agencia
  // se llamaba A, pidió pasar a B y antes de que se resuelva pide pasar a C, el
  // nombre anterior que el dueño necesita ver sigue siendo A —el último que rigió
  // de verdad—, no B, que nunca estuvo aprobado. Pisarlo perdería el único valor
  // que importa, y encima en silencio. Lo que sí se actualiza es la fecha: el
  // pedido vigente es el último.
  const previousName = agency.previous_name ?? agency.name;

  // ⚠ Y EL CASO DE IDA Y VUELTA: si vuelve exactamente al nombre que ya tenía
  // (A → B → A), no queda ningún cambio pendiente que mostrar. Sin esta rama el
  // panel diría "A → A", que no es un cambio: es ruido que el dueño tendría que
  // descartar a mano.
  const backToPrevious = nameChanged && name === agency.previous_name;

  const nameChangeFields = backToPrevious
    ? { previous_name: null, name_change_requested_at: null }
    : nameChanged
      ? {
          previous_name: previousName,
          name_change_requested_at: new Date().toISOString(),
        }
      : {};

  // ══════════════════════════════════════════════════════════════
  // ⚠ CUÁNDO LA CUENTA VUELVE A LA COLA DE REVISIÓN
  // ══════════════════════════════════════════════════════════════
  //
  // Dos casos, y el segundo es nuevo:
  //
  //   · `rejected` → SIEMPRE vuelve a 'pending'. Guardar acá es el reenvío de la
  //     solicitud corregida, sin importar qué campo se tocó.
  //   · `approved` + el nombre cambió → vuelve a 'pending'. Es el pedido de
  //     cambio de nombre: el colegio de corredores regula los nombres
  //     comerciales, así que el nuevo tiene que revisarse antes de regir.
  //
  // ⚠ Y `approved` SIN cambio de nombre NO toca el estado. Es lo que permite que
  // esta pantalla siga sirviendo para mirar los datos sin efectos: abrirla y
  // guardar sin cambiar nada no puede apagarle la cuenta a nadie.
  //
  // ⚠⚠ ESTA TRANSICIÓN APAGA A LA AGENCIA MIENTRAS ESPERA, y no es un efecto
  // lateral menor: `agency_is_publicly_visible()` exige `approval_status =
  // 'approved'`, y la invocan las TRES policies públicas más
  // `resolveAgencyBySlug`. O sea que pedir un cambio de nombre saca las
  // propiedades del mapa, deja de servir sus fotos, corta el registro de
  // consultas y apaga el sitio de marca, hasta que el dueño resuelva. Por eso el
  // formulario lo advierte ANTES de confirmar, con esas cuatro consecuencias
  // enumeradas (ver el aviso en AgencyIdentityForm).
  const backToReview = wasRejected || (isApproved && nameChanged);

  const { error } = await admin
    .from("agencies")
    .update({
      name,
      // ⚠ NO es el `license_number` que llegó del cliente: con la agencia
      // aprobada es el de la fila real (ver `effectiveLicenseNumber`).
      license_number: effectiveLicenseNumber,
      ...(backToReview ? { approval_status: "pending" } : {}),
      ...nameChangeFields,
    })
    .eq("id", session.agent.agency_id);

  if (error) {
    return { error: "No se pudieron guardar los datos. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/preferencias");
  revalidatePath("/dashboard");
  return { resubmitted: backToReview };
}

// ─── Dirección del sitio de marca (agencies.slug) ─────────────
//
// La URL pública de la agencia: `marka.com.ar/{slug}`. Hasta ahora se generaba
// sola en el alta a partir de la razón social y no se podía cambiar desde
// ningún lado, así que una agencia quedaba con una dirección que no eligió.
//
// ══════════════════════════════════════════════════════════════
// ⚠ CAMBIARLA ROMPE LOS ENLACES YA COMPARTIDOS, Y ESO ESTÁ ACEPTADO
// ══════════════════════════════════════════════════════════════
//
// NO se guarda historial de direcciones ni se redirige desde la vieja: eso
// exigiría una tabla de direcciones pasadas y una consulta más en CADA visita al
// sitio de marca — infraestructura permanente para un caso raro. La dirección
// vieja pasa a dar 404.
//
// La contrapartida es que el aviso previo no es letra chica: es la pieza. La
// agencia es dueña de la decisión SI LA ENTIENDE, así que `AgencySlugForm` le
// muestra las dos direcciones completas y le dice con todas las letras qué deja
// de funcionar, antes de confirmar.
//
// SIN LÍMITE de cuántas veces se puede cambiar: poner un número sería adivinar,
// y son clientes que pagan.
//
// ⚠ EL NOMBRE DE LA AGENCIA Y LA DIRECCIÓN SON INDEPENDIENTES. Cambiar el nombre
// (updateAgencyIdentityAction, acá arriba) NO regenera el slug, y es deliberado:
// regenerarlo solo le rompería los enlaces sin que lo haya pedido. Quien quiera
// cambiar la dirección la cambia acá, con su propio aviso.

// Nombre del índice único de la dirección, tal como Postgres lo devuelve dentro
// del mensaje del error.
const SLUG_UNIQUE_INDEX = "agencies_slug_key";

// Tipo estructural mínimo: se pide lo que se lee y nada más, en vez de atar esto
// al tipo del SDK. Mismo criterio que translateApprovalWriteError (admin) y
// translatePropertyWriteError (propiedades).
type DbLikeError = { code?: string; message: string; details?: string | null };

// Traduce el error del UPDATE de `agencies.slug`.
//
// ⚠ SE VERIFICAN DOS COSAS, Y EL CÓDIGO SOLO NO ALCANZA. Sobre `agencies` hay
// TRES índices únicos (medido): `agencies_pkey`, `agencies_slug_key` y
// `idx_agencies_license_unique_approved`, y LOS TRES levantan 23505. Un matcher
// que mirara solo el código reportaría "esa dirección ya está en uso" ante un
// choque de matrícula. Es exactamente la trampa que ya documenta
// `translateApprovalWriteError` en admin/actions.ts, mirada desde el otro lado:
// aquel exige el nombre del índice de matrícula, éste el de la dirección.
//
// POR QUÉ HACE FALTA si `isAgencySlugTaken` ya chequeó: el pre-chequeo y la
// escritura son DOS MOMENTOS distintos. Entre uno y otro, otra agencia puede
// tomar la misma dirección — y entonces el UNIQUE de la base rebota el UPDATE.
// Es raro, pero es el único camino por el que este error llega, y sin traducir
// saldría como "no se pudo guardar" sin decir qué pasó.
//
// El mensaje NO dice "intentá de nuevo" con la misma dirección: reintentar da
// siempre el mismo resultado, porque el conflicto es de datos y no transitorio.
// Lo que destraba es elegir otra.
function translateAgencySlugWriteError(dbError: DbLikeError): string {
  const isSlugConflict =
    dbError.code === "23505" && dbError.message.includes(SLUG_UNIQUE_INDEX);

  if (isSlugConflict) {
    return "Otra inmobiliaria tomó esa dirección hace un momento. Elegí una distinta.";
  }

  // Un CHECK de formato (teléfono, logo) se evalúa en CUALQUIER UPDATE de la
  // fila: no puede dispararse por el slug, pero si llegara no se disfraza de
  // choque de dirección.
  return (
    translateFormatCheckError(dbError) ??
    "No se pudo guardar la dirección. Intentá de nuevo."
  );
}

// El esquema normaliza ANTES de validar, mismo molde que la matrícula
// (`.transform(normalizeLicenseNumber)`): la persona escribe como le sale y el
// sistema se encarga de la forma. La validación fina la hace validateAgencySlug,
// que es la misma función que usa el formulario — un solo criterio, dos capas.
const agencySlugSchema = z.object({
  slug: z.string().transform(normalizeAgencySlug),
});

export async function updateAgencySlugAction(input: {
  slug: string;
}): Promise<{ error: string } | { slug: string }> {
  const parsed = agencySlugSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { slug } = parsed.data;

  // Es una action: ante sesión inválida devuelve error, NO redirige (redirigir
  // desde un submit rompe el manejo de errores del formulario que la llama).
  const session = await resolveAgentSession();
  if (session.status !== "ok") return { error: "No autenticado" };
  const caller = session.agent;
  if (caller.role !== "admin") return { error: "No autorizado" };

  // ⚠ ESTA ES LA BARRERA QUE CUENTA, NO LA DEL FORMULARIO. Una server action se
  // invoca sin pasar por el render, así que el esquema del cliente es feedback y
  // nada más: un cliente manipulado manda lo que quiere. Forma y lista negra se
  // vuelven a validar acá, con la MISMA función, sobre el valor ya normalizado.
  const validation = validateAgencySlug(slug);
  if (!validation.ok) return { error: validation.error };

  const admin = createAdminClient();

  // Pre-chequeo de unicidad, excluyendo a la propia agencia (volver a guardar la
  // dirección que ya se tiene no puede chocar consigo misma).
  //
  // ⚠ LA UNICIDAD ES GLOBAL, NO POR CIUDAD, y sale de la base: `agencies_slug_key
  // UNIQUE (slug)`, sin `city_id`. Es lo correcto para una dirección, que es una
  // sola en todo el dominio — a diferencia de la matrícula, cuyo índice sí lleva
  // la ciudad porque los colegios de corredores son provinciales.
  if (await isAgencySlugTaken(admin, slug, caller.agency_id)) {
    return {
      error:
        "Esa dirección ya la está usando otra inmobiliaria. Probá con una variante.",
    };
  }

  // ⚠ SE CUENTAN LAS FILAS AFECTADAS. Un UPDATE acotado sobre una fila que no
  // existe NO devuelve error: afecta cero filas y reporta éxito, así que mirar
  // solo `error` haría pasar por guardado algo que no se guardó (la regla está
  // en CLAUDE.md, y ya mordió una vez en requestPlanUpgradeAction). El `count`
  // mide lo que la escritura hizo de verdad, no lo que era cierto un momento
  // antes de preguntarlo.
  //
  // Sin policy de UPDATE en `agencies` → service role, acotado al agency_id del
  // caller, que sale del server y nunca del cliente.
  const { error, count } = await admin
    .from("agencies")
    .update({ slug }, { count: "exact" })
    .eq("id", caller.agency_id);

  if (error) {
    return { error: translateAgencySlugWriteError(error) };
  }

  if (count === 0) {
    // No habla de direcciones: lo que le falta a esta cuenta no se resuelve
    // eligiendo otra. Mismo criterio que el `count === 0` de la suscripción.
    return {
      error:
        "Hay un problema con la configuración de tu cuenta. Escribinos y lo resolvemos.",
    };
  }

  revalidatePath("/dashboard/preferencias");
  // La dirección vieja y la nueva son rutas públicas distintas: se revalidan las
  // dos para que el sitio de marca responda al toque por la nueva y deje de
  // servir contenido cacheado por la vieja.
  revalidatePath(`/${slug}`);

  return { slug };
}
