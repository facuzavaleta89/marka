# Informe — Tres correcciones sobre la baja de agencias

> Modo ejecución. **5 archivos modificados**, ninguno creado. No se ejecutó ningún comando de
> git ni ningún SQL de escritura. Fecha: 31 ago 2026.

> ⚠ **Dos cosas se apartan de lo que pediste, y las dos porque medí antes de tocar:**
> el orden del helper **ya era el correcto** —el bug estaba en otro lado, en un consumidor— y
> el orden de los triggers en la base **también**, así que no hay SQL para correr. El detalle
> está en los puntos 1 y 2.

---

## 1. El orden del helper: ya era correcto, el bug era otro

### Lo que medí

`src/lib/utils/getPublishBlock.ts` **ya evaluaba los motivos en el orden que pedías**:

```
1. approvalStatus !== "approved"                     → not_approved
2. status ∈ ("canceled", "past_due")                 → subscription_inactive
3. !planUsage.canCreate                              → plan_limit
```

O sea que `getPublishBlock` devolvía `subscription_inactive` con el mensaje correcto
(*"Tu suscripción está dada de baja. Escribinos para reactivarla."*). **No hubo nada que
reordenar.**

### Dónde estaba el bug de verdad

En **`src/components/dashboard/NewPropertyButton.tsx:51-55`**, que no usaba `block.message`
sino que elegía un componente con un **ternario binario**:

```tsx
{block.reason === "not_approved" ? (
  <NotApprovedMessage approvalStatus={approvalStatus} />
) : (
  <PlanLimitMessage planUsage={planUsage} />   // ← todo lo que no sea not_approved
)}
```

Cuando se agregó el motivo `subscription_inactive`, **cayó en el `else`** y se renderizó
`PlanLimitMessage`, que además arma su texto por su cuenta: con plan `free` calcula el
siguiente plan y escribe *"Alcanzaste el límite de tu plan Gratis. Pasá a Inicial para publicar
más. **Ver planes**"*. Es exactamente el mensaje que viste, con el agravante del enlace a la
lista de planes.

El bloqueo era **correcto** (la agencia no podía publicar); lo que estaba mal era solo el
cartel. Y por eso el síntoma aparecía en el botón y no en otros lados: los otros tres puntos de
entrada (`dashboard/page.tsx:168`, `PropertiesTable.tsx:171`, y el `redirect` de
`nueva/page.tsx`) usan `publishBlock.message`, o sea el string que arma el helper, así que
**ya mostraban el mensaje correcto**. Solo el botón se armaba el suyo.

### Cómo quedó

El ternario pasó a ser un **switch exhaustivo** con guarda `never`:

```tsx
function BlockMessage({ reason, planUsage, approvalStatus }) {
  switch (reason) {
    case "not_approved":          return <NotApprovedMessage approvalStatus={approvalStatus} />;
    case "subscription_inactive": return <SubscriptionInactiveMessage status={planUsage.status} />;
    case "plan_limit":            return <PlanLimitMessage planUsage={planUsage} />;
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}
```

**Agregar un motivo nuevo a `PublishBlockReason` sin darle mensaje ya no compila.** Es lo que
evita que esto se repita: el problema no fue el orden, fue que un consumidor tenía un `else`
que se tragaba lo que no conocía.

El mensaje nuevo **no ofrece un upgrade**: manda a `/dashboard/suscripcion`, donde ahora está
el aviso completo (corrección 2), porque lo que destraba a esa agencia es reactivar lo que ya
tenía.

---

## 2. El orden de los triggers: medido, ya es correcto. No hay SQL

Medido con `pg_get_triggerdef` sobre `properties`, ordenado por nombre:

| Trigger | Definición |
|---|---|
| `trg_check_agency_approved` | `BEFORE INSERT ... EXECUTE FUNCTION check_agency_approved()` |
| `trg_check_agency_subscription` | `BEFORE INSERT ... EXECUTE FUNCTION check_agency_subscription()` |
| `trg_check_property_limit` | `BEFORE INSERT OR UPDATE ... EXECUTE FUNCTION check_property_limit()` |
| `trg_properties_updated_at` | `BEFORE UPDATE ... EXECUTE FUNCTION update_updated_at()` |

**El trigger de suscripción está aplicado** (corriste el SQL de la tanda anterior). Y el orden
alfabético da exactamente la prioridad pedida:

```
trg_check_agency_approved  <  trg_check_agency_subscription  <  trg_check_property_limit
        (1) aprobación             (2) suscripción                   (3) cupo
```

Prefijo común `trg_check_agency_`, y después `approved` < `subscription` porque `'a' < 's'`;
y `trg_check_agency_*` < `trg_check_property_*` porque `'a' < 'p'`.

**Conclusión: el orden ya es correcto y no toqué nada.** No hay archivo con SQL para correr en
esta tanda.

⚠ **Una asimetría real que sí encontré, y que no es de orden sino de alcance:**
`trg_check_agency_subscription` es **BEFORE INSERT**, mientras que `trg_check_property_limit`
es **BEFORE INSERT OR UPDATE**. O sea que **re-activar una propiedad pausada** (status
`paused` → `active`) de una agencia dada de baja **no pasa por el trigger de suscripción**:
solo por el de cupo. Fue una decisión deliberada de la tanda anterior (*"editar una propiedad
ya cargada sigue permitido aunque la agencia se dé de baja después"*), y ampliarla es una
decisión de producto, no una corrección de orden — así que la dejé y la anoto en el punto 7.

---

## 3. La pantalla de suscripción del agente

Archivo: `src/components/dashboard/SubscriptionContent.tsx`.

**La causa exacta:** la pantalla calculaba `hasPendingRequest = status === "pending" && ...` y
**nada más**. `canceled` y `past_due` caían en la misma rama que una suscripción sana.

### Cómo quedó

Se agregó un solo predicado —`isInactive = status === "canceled" || status === "past_due"`—
del que cuelgan tres cambios. **`pending` no entra**, como pediste.

**a. Un `Notice` arriba de todo**, con el componente reutilizable que ya existía
(`src/components/feedback/Notice.tsx`), **tono `warning`, no `error`**. El propio componente
documenta los tonos: `error` es *"algo salió mal de verdad"*, y acá no salió mal nada — puede
ser una baja acordada, una prueba que terminó o un pago pendiente, y el sistema no sabe cuál.
`warning` es *"requiere atención o acción de quien lo lee"*, que es exactamente el caso.

El texto, con título según el estado (*"Tu suscripción está dada de baja"* / *"...está
vencida"*):

> Mientras tanto, tus propiedades no se muestran en el mapa público, tu sitio propio está
> apagado si tenías uno, y no podés publicar nuevas.
>
> **Tus datos están intactos:** tus propiedades, tus fotos y tu equipo siguen acá y volvés a
> verlos publicados apenas se reactive. Escribinos a hola@marka.app y lo resolvemos.

Dice las tres consecuencias concretas, dice qué **no** se perdió, y da la salida. No acusa a
nadie ni usa la palabra "impago".

**b. La fecha de vencimiento se oculta** mientras la suscripción no rige. "Plan activo hasta el
X" de un plan dado de baja es justo la contradicción que esto viene a sacar.

**c. Los botones de mejora de plan: los saqué.** Dos motivos, y el segundo no es de tono:

1. Es la misma mentira que el mensaje de cupo: lo que destraba a esa agencia es **reactivar lo
   que ya tenía**, no comprar un plan mayor.
2. **Era un agujero real, no cosmético.** `requestPlanUpgradeAction`
   (`suscripcion/actions.ts:37-41`) escribe `status: "pending"` **sin mirar el estado previo**.
   Una agencia en `canceled` que tocaba "Pasá a Inicial" pasaba a `pending`, que **no está en
   la lista de estados que bloquean la publicación** → **se sacaba la baja sola y volvía a
   poder publicar**, sin que el dueño hiciera nada. (Sus propiedades seguían ocultas, porque
   `agency_is_publicly_visible` exige `active`, así que quedaba en un estado incoherente: podía
   cargar propiedades que nadie iba a ver.)

Por eso **también agregué el corte en la server action**: si la suscripción está `canceled` o
`past_due`, el pedido se rechaza con *"Tu suscripción no está activa. Escribinos para
reactivarla antes de cambiar de plan."* Esconder los botones sin eso habría sido cosmético —
una server action se invoca sin pasar por el render, que es el criterio que usa todo el repo.
Lo marco como decisión propia en el punto 6.

---

## 4. La comparación del nombre

**La causa exacta:** el `Label` de este preset de shadcn lleva **`uppercase` en su clase base**
(`src/components/ui/label.tsx`), y el nombre estaba **adentro** del `<Label>`. Así que el cartel
decía `ESCRIBÍ INMOBILIARIA PRUEBA PARA CONFIRMAR` mientras la comparación exigía
`Inmobiliaria Prueba` exacto. Escribir lo que la pantalla indicaba no funcionaba.

**En el servidor** (`admin/actions.ts`), helper nuevo, que es la comparación que cuenta —
contra el nombre **real leído de la base**:

```ts
function nameMatches(typed: string, actual: string): boolean {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("es-AR");
  return normalize(typed) === normalize(actual) && actual.trim() !== "";
}
```

**En el cliente** (`AgenciesTable.tsx`, `DeleteAgencyPanel`), el mismo criterio, solo para
habilitar el botón:

```ts
const matches =
  typed.trim().toLocaleLowerCase("es-AR") ===
  row.name.trim().toLocaleLowerCase("es-AR");
```

**Qué se relaja y qué no:** se ignoran mayúsculas y espacios de los bordes. **No** se relajan
los espacios internos ni los acentos: sigue teniendo que ser el nombre de esa agencia, no algo
parecido. (El `&& actual.trim() !== ""` del server evita el caso patológico de una agencia con
nombre vacío, donde un input vacío "coincidiría".)

**El cartel** también cambió: el nombre salió de adentro del `<Label>` —que lo pasaba a
mayúsculas— y ahora va en un `<p>` aparte, **tal cual está guardado**, con la aclaración
explícita:

> Escribí **Inmobiliaria Prueba** para confirmar. No importan las mayúsculas.

---

## 5. Verificación

### `npx tsc --noEmit`
```
(sin salida)
```
**exit code: 0**

### `npm run lint`
```
> marka@0.1.0 lint
> eslint


/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx
  269:20  warning  Compilation Skipped: Use of incompatible library

This API returns functions which cannot be memoized without leading to stale UI. To prevent this, by default React Compiler will skip memoizing this component/hook. However, you may see issues if values from this API are passed to other components/hooks that are memoized.

/home/facuzavaleta89/dev/marka/src/components/properties/PropertyForm.tsx:269:20
  267 |   });
  268 |
> 269 |   const currency = watch("currency");
      |                    ^^^^^ React Hook Form's `useForm()` API returns a `watch()` function which cannot be memoized safely.
  270 |   const selectedAmenities = (watch("amenities") ?? []) as string[];
  271 |   const lat = watch("lat");
  272 |   const lng = watch("lng");  react-hooks/incompatible-library

✖ 1 problem (0 errors, 1 warning)
```
**exit code: 0**

### `npx next build`
```
✓ Generating static pages using 3 workers (19/19) in 1148ms
  Finalizing page optimization ...

Route (app)
┌ ○ /                                    ├ ƒ /dashboard/perfil
├ ○ /_not-found                          ├ ƒ /dashboard/preferencias
├ ƒ /[slug]                              ├ ƒ /dashboard/propiedades
├ ƒ /admin                               ├ ƒ /dashboard/propiedades/[id]/editar
├ ƒ /api/geocode                         ├ ƒ /dashboard/propiedades/nueva
├ ○ /apple-icon.png                      ├ ƒ /dashboard/suscripcion
├ ƒ /dashboard                           ├ ƒ /login
├ ƒ /dashboard/equipo                    ├ ƒ /logout
├ ƒ /dashboard/leads                     ├ ƒ /register
                                         └ ƒ /register/plan

ƒ Proxy (Middleware)
```
**exit code: 0**

### Comparación contra el baseline

| Métrica | Baseline | Medido | ¿Igual? |
|---|---|---|---|
| Errores de TypeScript | 0 | 0 | ✅ |
| Errores de lint | 0 | 0 | ✅ |
| Warnings de lint | 1 (`react-hooks/incompatible-library`, formulario de propiedad) | 1, el mismo, `PropertyForm.tsx:269` | ✅ |
| Build | verde, 19 rutas | verde, **19 rutas** | ✅ |

**Idéntico al baseline.**

### Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/components/dashboard/NewPropertyButton.tsx` | El ternario binario pasó a switch exhaustivo con guarda `never` + mensaje propio para `subscription_inactive`. **Es el arreglo del síntoma reportado.** |
| `src/components/dashboard/SubscriptionContent.tsx` | Aviso `Notice` (tono warning) cuando la suscripción no rige, sin fecha de vencimiento y sin cards de upgrade. |
| `src/app/(agent)/dashboard/suscripcion/actions.ts` | `requestPlanUpgradeAction` rechaza pedidos si la suscripción está `canceled`/`past_due`. |
| `src/app/(agent)/admin/actions.ts` | `nameMatches()`: la confirmación por nombre ignora mayúsculas y espacios de los bordes. |
| `src/app/(agent)/admin/AgenciesTable.tsx` | Misma comparación en el cliente + el nombre sale del `<Label>` (que lo ponía en mayúsculas) y se aclara que no importan. |

---

## 6. Decisiones que se apartan de las instrucciones

**1. No reordené el helper, porque el orden ya era el correcto.** Pediste "revisá en qué orden
evalúa hoy los motivos y corregilo"; al medirlo, ya evaluaba aprobación → suscripción → cupo.
Cambiar algo ahí habría sido trabajo inventado y no habría arreglado el síntoma. El arreglo fue
en el consumidor (`NewPropertyButton`), que es donde estaba el `else` que se tragaba el motivo
nuevo. Lo mismo con el punto 2: los triggers ya disparan en el orden correcto, así que **no hay
SQL para correr** — dijiste explícitamente que si ya era correcto lo dijera y no tocara nada.

**2. Agregué un corte en `requestPlanUpgradeAction`, que no estaba en el pedido.** Pediste
decidir sobre los botones de upgrade y justificarlo. Al mirarlo encontré que no era una decisión
de presentación: esa action escribe `status: 'pending'` sin mirar el estado previo, así que una
agencia dada de baja podía **sacarse la baja sola** pidiendo un upgrade y recuperar la
posibilidad de publicar. Esconder los botones sin cerrar la action habría dejado el agujero
abierto, y "la interfaz no es una barrera" es la regla que sigue todo el repo. Es un cambio
chico (una lectura y un `return`), pero está fuera de las tres correcciones que enumeraste.

**3. Usé el mensaje de suscripción inactiva del botón para mandar a `/dashboard/suscripcion`,
no a la lista de planes.** El `PlanLimitMessage` original enlaza a "Ver planes" porque su
bloqueo se resuelve pagando más. El de baja no: enlaza a la pantalla de suscripción, que ahora
es donde está la explicación completa.

---

## 7. Encontrado y NO tocado, por estar fuera del alcance

1. **⚠ Re-activar una propiedad pausada saltea el trigger de suscripción.**
   `trg_check_agency_subscription` es solo `BEFORE INSERT`; `trg_check_property_limit` es
   `BEFORE INSERT OR UPDATE`. Una agencia dada de baja **puede pasar una propiedad de `paused` a
   `active`** (mientras tenga cupo), y si no tiene cupo el error que ve es el de límite, no el de
   la baja. En la práctica la propiedad no se ve igual (la oculta
   `agency_is_publicly_visible`), así que el daño es acotado. Ampliar el trigger a UPDATE es una
   decisión de producto —contradice lo que se decidió a propósito en la tanda anterior ("editar
   una propiedad ya cargada sigue permitido")— así que la dejo planteada, no resuelta.

2. **El dashboard (`/dashboard`) tampoco avisa de la baja.** `getPublishBlock` le da el mensaje
   correcto al estado vacío y al botón, pero no hay un aviso de estado como el que sí tiene la
   agencia no aprobada (`AgencyApprovalNotice`, montado en `/dashboard` y en Preferencias). El
   equivalente para la suscripción sería montar el `Notice` nuevo también ahí. Pediste
   explícitamente la pantalla de suscripción, así que no lo extendí.

3. **`past_due` no lo escribe nadie todavía.** Lo contemplé en las tres correcciones porque
   comparte el bloqueo con `canceled`, pero ninguna action del panel lo produce: hoy solo se
   llega ahí por SQL a mano. Cuando exista el cobro automático va a llegar solo.

4. **El schema documentado sigue mintiendo sobre dos FKs** (`properties.agent_id` es NOT NULL +
   CASCADE, `leads.agent_id` es NOT NULL + NO ACTION, contra lo que dicen el archivo de
   migración y `CLAUDE.md`). Sin relación con estas tres correcciones; lo repito porque sigue
   ahí y sigue afectando a `deleteAgentAction`.

5. **No probé nada contra la base**, como en la tanda anterior: el modo prohíbe SQL de
   escritura. Lo que conviene reprobar a mano ahora, con la agencia que ya tenés dada de baja:
   que el botón "Nueva propiedad" diga *"Tu suscripción está dada de baja..."* en vez del
   mensaje de cupo; que `/dashboard/suscripcion` muestre el aviso, sin fecha y sin cards de
   upgrade; y que eliminar una agencia acepte el nombre en minúsculas.
