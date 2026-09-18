# OMniLeads vs FieldQuo — a read of seven call-floor features

Design study, read-only. Written 2026-09-17 against the OMniLeads source at
`/Volumes/1TB emilio ssd/Downloads Archive/ominicontacto-master` (LGPL-3.0,
Django + jQuery agent console + Vue supervisor UI + Asterisk + Kamailio; the
softphone is **JsSIP**, not SIP.js — `phoneJsSip.js` line 1 `/* globals JsSIP */`)
and FieldQuo's sales floor in `/Users/emilioboves/StudioProjects/fq-wt-nocap`.
Nothing was copied; nothing on the volume was touched.

**OMniLeads runs on Asterisk, not Twilio.** Every one of its call-control
verbs — hold, transfer, conference, queue, MixMonitor, QueuePause — is an
Asterisk primitive driven either by DTMF feature codes from the browser
softphone or by AMI actions from Django. FieldQuo's equivalents are Twilio
REST calls and TwiML (`<Dial>`, `<Conference>`, `<Record>`, `<Redirect>`,
participant `hold`). Each gap below names the Twilio mechanism that
would carry it, because "do what OMniLeads does" is not an instruction that
survives the change of carrier.

Two caveats on scope, stated up front:

- **The static Asterisk dialplan is not in this archive.** `extensions.conf`,
  `features.conf`, the `sub-oml-*` contexts, `hangup-fts`, `canal-llamado`,
  the `queuelogSub` and the `/usr/local/parselog/*.pl` scripts that insert
  `LlamadaLog` rows live in OMniLeads' separate Asterisk image
  (`omnileads/asterisk` on GitLab). What IS here is everything Django
  generates (`asterisk_config_generador_de_partes.py`, `asterisk_config.py`),
  the Redis "families" the dialplan reads (`services/asterisk/redis_database.py`),
  the DTMF codes the browser sends, the SIP headers the browser reads, and the
  event vocabulary the reports consume (`reportes_app/models.py`). Where a
  behaviour is only inferable from those, it is marked *inferred*.
- **`app/components/sales/CallbacksStrip.js` does not exist** in FieldQuo. The
  callback surfaces are the Tasks tab in `app/sales/queue/page.js`
  (`TasksTab`), `NextSteps.js`, `callbackState()` in
  `lib/sales/calls/reporting.js`, and the `callback` retry rule in
  `lib/sales/retryRules.js`. Those were read instead.

`docs/sales-intel/CALL-HANDLING.md` (2026-09-03) was read as the map, and it
is now behind the code in four places — transfers, the hold queue, recording
(reversed 2026-09-17) and voicemail — all of which shipped after it. This
document reads the code, not that document.

---

## 1. Transfers

### OMniLeads

Files read in full: `ominicontacto_app/static/ominicontacto/JS/agente/phoneJsSip.js`
(`dialTransfer`, `endTransfer`, `confer`, `putOnHold`, `SessionData`),
`phoneJsController.js` (`makeSelectedTransfer`, `OutTransferData`,
`subscribeToPhoneEvents` → `onTransferDialed` / `onTransferReceipt`,
`onNotificationEndTransferredCall`, `setConsultativeHold`), `phoneJsFSM.js`,
`phoneJsView.js` (`startTransferMenu`, `cargarAgentes`), `omlAPI.js`
(`getAgentes`, `notifyEndTransferredCall`, `consultativeConferHold`, `eventHold`),
`api_app/views/agente.py` (`ApiAgentesParaTransferencia`, `NotifyEndTransferredCall`,
`ApiConsultativeConferHold`, `ApiEventoHold`, `HangUpCallView`),
`services/asterisk/supervisor_activity.py` (`obtener_agentes_activos`),
`services/asterisk/asterisk_ami.py`, `reportes_app/models.py` (`LlamadaLog` events).

**The whole transfer is DTMF.** There is no API call that starts a transfer.
`PhoneJS.dialTransfer(transfer)` sends in-band digits over the JsSIP session
and Asterisk's dynamic features (`features.conf`, not in the archive) do the
rest:

| Kind | Digits sent by the browser | Asterisk-side event family |
|---|---|---|
| Blind → agent | `##` then, 2.5 s later, `0000` + agent id | `BT-TRY` / `BT-ANSWER` / `BT-COMPLETE` / `BT-BUSY`, `BT-NOANSWER`, `BT-ABANDON` … |
| Blind → campaign (queue) | `##` + `9999` + campaign id | `ENTERQUEUE-TRANSFER`, `CAMPT-COMPLETE`, `CAMPT-FAIL` |
| Blind → external number / quick-list | `##` + the digits | `BTOUT-TRY` / `BTOUT-ANSWER` / `BTOUT-COMPLETE`, `BTOUT-*` failures |
| Consultative → agent | `*2` + `1111` + agent id | `CT-TRY` / `CT-ACCEPT` / `CT-COMPLETE` / `CT-DISCARD`, `CT-ABANDON` |
| Consultative → campaign | `*2` + `8888` + campaign id | `CAMPCT-*` (gated in the view by `consultToCampEnabled`, a flag with a "remove when permanent" comment) |
| Consultative → external | `*2` + the digits | `CTOUT-TRY` / `CTOUT-ACCEPT` / `CTOUT-COMPLETE` |
| End consult, return to caller | `*1` (`endTransfer`) | FSM `Transfering → OnCall` |
| Three-way | `*3` (`confer`) | UI prints "En Conferencia con: A y B" |
| Survey hand-off | blind to `098*` | `TransferenciaAEncuestaLog` via `api_app/views/logging.py` |

The 2.5-second `setTimeout` between the feature code and the destination is
the browser waiting for Asterisk to enter the feature's digit-collection
state. `cancelDialTransfer` only clears that timer; once the digits are out,
nothing in the browser can cancel.

**Who is offered.** `ApiAgentesParaTransferencia` returns every `OML:AGENT:*`
Redis hash; `cargarAgentes` enables only entries whose `STATUS == 'READY'` and
renders the rest disabled with their status text. Status is the agent's own
declared Redis state (login/pause/unpause), not a SIP registration probe.

**What the target sees.** The INVITE carries `Transfer: 1|2|3` and
`OMLFROMAGENT` (`SessionData.is_transfered`, `transfer_type_str`,
`from_agent_name`); `manageCallReceipt` shows the receive modal with
"Transf. asistida / directa / a campaña" and the originating agent's name.
A campaign transfer is auto-attended when the group has `auto_attend_IN`.

**Consultative target does not answer.** *Inferred from the FSM and events:*
Asterisk's attended-transfer feature returns the transferer to the held party
on failure; the browser sees the FSM edge `transferNotAccepted /
endTransfer: Transfering → OnCall` and the log records `CT-DISCARD` /
`CT-BUSY` / `CT-CANCEL`. The comment beside `transferNotAccepted` reads
"Cuando sucede?" — the authors were not sure when that edge fires. When the
target has accepted and then hangs up, the target's browser posts
`notifyEndTransferredCall(agent_id)` and the originating agent gets a
websocket `end_transferred_call` and a growl "El agente X finalizó la
llamada", after which `onSessionFailed` in state `Transfering` moves them to
`Ready` (`transferAccepted`). Note that transition: an originating agent whose
consult partner hangs up is treated as if the transfer completed.

**Does the caller hear hold music?** Yes, but by Asterisk defaults, not by
anything in this repo: `putOnHold` is a SIP re-INVITE (`session.hold()`), the
attended transfer parks the caller, and both play the channel's music class.
The per-campaign class is `Queue.musiconhold` → Redis `OML:CAMP:<id>` field
`MOH` (`redis_database.py` `CampanaFamily._create_dict`), a `Playlist`
directory under `sounds/moh/` (`GeneradorParaPlaylist`). Nothing in the Python
or JS chooses the music at transfer time; the dialplan reads `MOH`.

**Logging.** Every leg event is an `LlamadaLog` row written by Asterisk-side
scripts into Postgres (`reportes_app_llamadalog`), with `agente_extra_id`,
`campana_extra_id`, `numero_extra` for the transfer's far side, and
`tipo_llamada` 8 (internal transfer) / 9 (external transfer).
`obtener_cantidades_de_transferencias_recibidas` counts `BT-ANSWER` and
`CT-ACCEPT` per agent per campaign. Hold/unhold are the ONE transfer-adjacent
event Django writes itself (`ApiEventoHold` toggles HOLD/UNHOLD on the last
row for that callid). Consultative mute-client / mute-consultant
(`ApiConsultativeConferHold`) is an Enterprise-only stub in the open code —
it answers "Funcionalidad solo disponible en la versión Enterprise".

### FieldQuo

Files read in full: `lib/sales/calls/transfer.js` (`transferTargets`,
`startTransferPlan`, `conferenceMoveLeg`, `onParticipantJoin`,
`onParticipantLeave`, `onTargetEnded`, `onComplete`, `onCancel`, `repLegPlan`,
`targetLegPlan`, `describeTransfer`), `lib/sales/calls/transferRest.js`
(`moveCallerToConference`, `moveRepToConference`, `conferenceJoinTwiml`,
`dialTransferTarget`, `applyTransferActions`, `legIsUp`,
`conferenceParticipantSids`), `app/api/sales/calls/transfer/route.js`,
`app/api/rep-dial/transfer/route.js`, `app/components/sales/TransferControl.js`,
the transfer functions in `lib/sales/calls/store.js` (`startTransfer`,
`advanceTransfer`, `attachTransferTarget`, `openTransferFor`, `transferById`).

Two kinds, `warm` and `cold`, one state machine
(`ringing → talking → completed | returned | cancelled | failed`). The
mechanism is a Twilio `<Conference>` named `fq_xfer_<transferId>`:

1. The caller's leg (outbound) or the rep's leg (inbound —
   `conferenceMoveLeg` says which, because redirecting a `<Dial>` parent hangs
   the child up) is redirected into the conference with `startConferenceOnEnter=false`.
2. The other leg follows through the `<Dial>` action
   (`/api/rep-dial/transfer?stage=rep-leg` or `/api/rep-dial/inbound?stage=after-dial`).
3. Both are put on **participant hold** as they join; a `calls.create` to
   `client:<identity>` or the standing number rings the target for
   `TRANSFER_RING_SECONDS = 25`, with a whisper naming the sender.
4. On the target's `participant-join`: warm → `unhold rep` (rep and target talk,
   caller still held); cold → `endOnExit target`, `unhold caller`, `hangup rep`.
5. Warm "put them through" (`onComplete`) does the same three actions; refused
   while still `ringing`. Cancel hangs the target up first, then unholds both.
6. Target ends without answering → `returned` (unhold rep, unhold caller — the
   caller is back with the person they were talking to). If the rep's own leg
   is gone (`legIsUp` read fresh from Twilio) → `failed` with `callerToQueue`
   (the hold queue, §4, which ends at voicemail) — never silence.

Hold music is Twilio's default (no `holdUrl` on purpose: a missing asset must
not become silence). Every state change is a compare-and-set
(`advanceTransfer` with `fromState`) before any Twilio call, because
conference webhooks arrive three at a time.

Targets are `active: true` reps whose presence is `available` and not stale
(`reachable`, shared with the inbound router), sorted own-agency first then
longest-idle, plus `FIELDQUO_SALES_TRANSFER_TO`. The browser's pick is
re-validated against a fresh list on the POST. The whole transfer is logged
on `SalesCallTransfer` (kind, states, `failureReason`, `answeredAt`,
`endedAt`, all three CallSids) and, since 2026-09-17, the conference is
recorded as one mixed track.

### Verdict — ours is further, with three concrete gaps

| Capability | OMniLeads | FieldQuo | |
|---|---|---|---|
| Blind to agent | yes (DTMF) | yes (`cold`, target rung in conference) | equivalent |
| Consultative to agent, return on no-answer | yes (Asterisk atxfer) | yes (`warm`, `returned`) | **ours is further** — explicit state row, rep-gone rescue, no silent room |
| Transfer to a **queue / campaign** | yes (`9999`/`8888`) | **no** | gap |
| Transfer to an **arbitrary external number** | yes (typed or quick-list) | **no** — only `FIELDQUO_SALES_TRANSFER_TO` | gap, deliberately: nothing in a request may choose a destination (toll-fraud) |
| **Three-way conference** (`*3`) | yes | **no** — warm has rep+target talking, then rep is dropped | gap |
| Hold on a plain two-party call | yes (`hold` button, HOLD/UNHOLD logged) | **no** — hold exists only inside a transfer conference; the panel has mute only | gap |
| Whisper to the target | no (a modal with the sender's name) | yes (spoken) | ours |
| Transfer logged with far-side ids | yes (`agente_extra_id` etc.) | yes (`SalesCallTransfer`) | equivalent |
| Cancel after digits are out | no | yes, at any open state | ours |

Twilio mechanisms for the gaps: a queue transfer is `callerToQueue` pointed at
the hold queue with an explicit target set (the queue module already accepts a
`ringPlan`); an external-number transfer is `dialTransferTarget` with a
`kind: "number"` target drawn from a **superadmin-maintained allow-list**, never
a typed number; three-way is `onComplete` minus the `hangup rep` action
(`unhold caller` with the rep still in the room — one new action type `join`);
plain hold is a participant `hold` in a per-call conference, which means the
ordinary bridge would have to become a conference — or, cheaper, a
`<Dial>`-side `calls(sid).update({ twiml })` to `<Play loop=0>` and back, which
is a redirect and loses the bridge. The per-call conference is the honest
version; it is also what makes three-way and hold the same change.

---

## 2. Scheduled callbacks (agenda)

### OMniLeads

Files read: `ominicontacto_app/models.py` (`AgendaContactoManager.proximas`,
`eventos_filtro_fecha`, `AgendaContacto.save`, `Grupo`,
`AgenteProfile.permite_agenda_personal`, `tiempo_maximo_para_agendar`,
`CalificacionCliente.save`), `views_agenda_contacto.py` (all views),
`static/.../agente/agendas_notifications.js`, `agenda_agente.js`,
`make_click2call.js`, `click2Call.js`, `templates/agenda_contacto/agenda_agente.html`,
`views/base.py` (lines 274–296, the console context), `services/dialer/omnidialer.py`
(`agendar_llamada`), `services/click2call.py`.

`AgendaContacto` = agent, contact, campaign, `fecha` + `hora` (separate
columns), `tipo_agenda` PERSONAL | GLOBAL, `observaciones`, `telefono`. It
is created from the disposition form when the chosen `OpcionCalificacion` is
of type AGENDA (`get_success_url_agenda`), and only then; `CalificacionCliente.save`
deletes the personal agenda when the contact is later dispositioned as
anything else.

**Limits** are on `Grupo` and enforced in `AgendaContacto.save` and again in
`CalificacionCliente.save`: `limitar_agendas_personales` +
`cantidad_agendas_personales` (max open personal agendas per agent, excluding
this contact) and `limitar_agendas_personales_en_dias` +
`tiempo_maximo_para_agendar` (max days ahead). Both raise `ValidationError`
and the view re-renders with the message.

**Personal vs global.**

- *Personal:* stays in the database. It re-enters dialling only through the
  agent: the console loads `fechas_agendas_json` (the agent's personal agendas
  in the next 8 hours, `proximas()`), `AgendasNotifier` sets a single
  `setTimeout` for the soonest one, and at that instant shows a growl
  "Tiene una agenda programada para este momento", flashes the Agendas button
  and increments a counter. The agenda list (`agenda_agente.html`) is a table
  with the phone number as a click-to-call button (`makeClick2Call(...,
  'agendas')`), which originates through `Click2CallOriginator.call_originate`
  with `origin='agendas'`. Nothing dials by itself; a missed personal agenda
  simply ages in the list (`eventos_filtro_fecha` shows `fecha >= today`).
- *Global (dialer campaigns only):* `AgendaContactoCreateView.form_valid`
  posts to the dialer (`get_dialer_service().agendar_llamada`, OMniDialer or
  Wombat) with `campaign_name`, `phone_number`, `id_contact`, `datetime`, and
  the dialer redials the contact at that time to whichever agent is free.
  Preview / manual campaigns have no global re-entry.

Supervisors have a per-campaign agenda list (`AgendaContactosPorCampanaView`)
and a global one with CSV export and bulk delete (`AgendaContactosView`).

### FieldQuo

Files read: `lib/sales/calls/dispositions.js` (`callback`, `MAX_CALLBACK_DAYS`,
`planDisposition`), `lib/sales/calls/outcomeChoices.js` (`CHOICE_CALL_BACK`,
`WHEN_*`), `lib/sales/retryRules.js` (`nextAttempt`, `RETRY_KIND_CALLBACK`),
`lib/sales/retryPool.js` (`retryWriteFor`), `lib/sales/queueBatch.js`
(selection order, `releaseClosedUntouched` callback guard), `lib/sales/autodial.js`
(header, `nextDial`), `lib/sales/calls/reporting.js` (`callbackState`),
`app/sales/queue/page.js` (`TasksTab`), `lib/sales/nextSteps.js`,
`app/components/sales/NextSteps.js`.

A callback is a disposition (`callback`, `requiresCallback: true`) with a
`callbackAt` on the `SalesCallAttempt`, bounded to `MAX_CALLBACK_DAYS = 60`.
It does three things at once, in one transaction:

1. Holds the claim and extends the lease to cover the date (the lease
   measures inactivity, not age).
2. Writes `Prospect.nextAttemptAt = callbackAt` through the retry rule
   (`RETRY_KIND_CALLBACK`), so the row becomes a **due retry** at that instant.
3. Sets `SalesLead.status = "contacted"`.

Re-entry is structural rather than notified: `queueBatch.selectBatch` orders
due retries before fresh rows inside every window group, the queue screen
regroups by the clock, and the progressive autodialler (`autodial.js`) walks
that order — so a due callback is the next thing the dialler offers, without
a timer in the browser. The day-end sweep will not release a row with a
future `callbackAt` (`releaseClosedUntouched`). The Tasks tab lists this
prospect's callbacks with an "overdue" tone; `callbackState()` counts booked /
upcoming / overdue on the floor board. There is no per-agent cap and no
"days ahead" limit beyond the 60.

Beyond a callback, `nextSteps.js` books a 30-minute demo (a `SalesEvent`
span on the rep's calendar) or a 60-minute walkthrough on the platform's demo
calendar, gated on the linked company's onboarding being complete — nothing
OMniLeads has.

### Verdict — ours is further on re-entry; one real gap, one arguable

- **Re-entry into dialling:** ours. OMniLeads' personal agenda is a list and a
  growl; FieldQuo's callback moves the row to the front of the dialler's order
  at the agreed time. OMniLeads' global agenda is only for dialer campaigns.
- **A reminder at the moment** — gap, small. OMniLeads fires a growl and
  flashes the button at `fecha+hora`; FieldQuo shows "overdue" only when the
  rep is looking at that prospect's Tasks tab or the floor board. A rep
  working a hundred-row batch will be past the callback before the row
  reaches the cursor. Twilio has nothing to do with this: it is a Web Push
  (`lib/notify/push.js` `pushToReps` already exists) from a cron over
  `SalesCallAttempt.callbackAt` in the next N minutes, tag `sales-callback:<attemptId>`.
- **Per-rep callback caps** (`cantidad_agendas_personales`,
  `tiempo_maximo_para_agendar`) — arguable. The 60-day bound already stops the
  worst abuse (a rep parking prospects for months). A count cap is a
  supervisor's lever over a rep hoarding claims; FieldQuo's lease-on-inactivity
  makes hoarding visible on the board instead. Not a gap worth a column
  without an owner asking for it.
- **Supervisor bulk view/export/delete of callbacks** — FieldQuo has the floor
  board figure and nothing per rep. Low priority; a platform page over
  `callbackState` per rep is a read-only screen.

---

## 3. Preview-campaign contact reservation and release

### OMniLeads

Files read: `models.py` (`AgenteEnContactoManager`, `AgenteEnContacto` —
`asignar_contacto`, `entregar_contacto`, `liberar_contacto`,
`liberar_contactos_por_tiempo`; `Campana.gestionar_finalizacion_relacion_agente_contacto`,
`gestionar_finalizacion_por_contactos_calificados`; `CalificacionCliente.save`),
`views_campana_preview.py` (`ObtenerContactoView`, `LiberarReservarContactoAsignado`,
`campana_validar_contacto_asignado_view`), `views_agente.py`
(`LlamarContactoView` preview branch, `LiberarContactoAsignado`),
`static/.../campanasPreviewAgente.js`, `management/commands/actualizar_campanas_preview.py`,
`management/commands/cron_tick_5.py`, `settings/oml_settings_local.py`
(`DURACION_ASIGNACION_CONTACTO_PREVIEW = 30`).

One row per contact per campaign, `estado ∈ {INICIAL 0, ENTREGADO 1, ASIGNADO 3,
FINALIZADO 2}`, `agente_id` (`-1` = free), `modificado` (auto_now), `orden`.

- **Deliver** (`entregar_contacto`): if the agent already holds an ASIGNADO
  row, return it ("contacto-asignado" — you must disposition or release it).
  Otherwise release whatever they held ENTREGADO, then pick the next INICIAL
  row (agent-specific pre-assignment `agente_id = agent.pk` or free `-1`),
  round-robin from the last `orden`, with `select_for_update(skip_locked=True)`
  — which only works because `ATOMIC_REQUESTS` wraps the view; there is no
  `transaction.atomic` at the call site. Mark ENTREGADO.
- **Call** (`LlamarContactoView` with `click2call_type == 'preview'`):
  `asignar_contacto` flips ENTREGADO → ASIGNADO. The browser first hits
  `validar_contacto_asignado` and, if the reservation has lapsed, prints
  "OPS, se venció el tiempo de asignación de este contacto. Por favor intente
  solicitar uno nuevo" — that is the entire "taken away" UI, and it is shown
  only when the agent presses call.
- **Release**: agent button (`LiberarContactoAsignado` → `liberar_contacto`),
  supervisor bulk release/reserve to a named agent
  (`LiberarReservarContactoAsignado`, with a `TODO: Validar que el supervisor
  tiene permisos sobre la campaña` — unenforced), and the sweep.
- **Sweep** (`liberar_contactos_por_tiempo`, run by `cron_tick_5` every 5
  minutes): ENTREGADO older than the campaign's `tiempo_desconexion` minutes,
  or ASIGNADO older than `DURACION_ASIGNACION_CONTACTO_PREVIEW` (30) minutes
  → back to INICIAL / `-1`. Rows for non-active campaigns are deleted.
- **Finalise**: `CalificacionCliente.save` on a preview campaign marks the
  row FINALIZADO; when every row is FINALIZADO the campaign's rows are
  deleted and the campaign finalised.

### FieldQuo

Files read: `lib/sales/queueBatch.js` (header, `selectBatch`, `selectClaimBatch`,
`writeClaimBatch`, `claimBatch`, `untouchedSinceClaim`, `autoReleaseProtected`,
`releaseUntouched`, `releaseClosedUntouched`, `closeClaim`), the claim
table in `lib/sales/calls/dispositions.js`, `store.js` `saveDisposition`,
`app/api/cron/sales-queue-release/route.js`.

The reservation is `Prospect.assignedRepId` + `claimExpiresAt` (48 h,
restarted by any holding disposition, cleared to null by a worked one), with
a `SalesQueueClaim` row per hand-out recording `position`, `repTimeZone`,
`releasedAt`, `releaseReason ∈ {rep, rest, day_end, lapsed, admin, reassigned, closed}`.
Batches of up to 25 (`QUEUE_BATCH_MAX`) are selected server-side by calling
window, due-retry-first, best-window score; the write is a compare-and-set
`updateMany` and only rows the write won are returned. Lapse is lazy (the
pool excludes expired claims on read) and an hourly cron gives back untouched
rows at the rep's local day end. Nothing is deleted.

### Verdict — equivalent mechanism, ours is further on the two things that matter, one gap

- Lease + sweep vs lease + lazy lapse: **ours** (no cron on the critical path,
  no ambient-transaction dependency; CALL-HANDLING §3 already argued this).
- Batch of 25 vs one at a time: ours, by the owner's instruction.
- Release audit (`SalesQueueClaim.releaseReason`): ours; OMniLeads keeps no
  history of a release.
- **What the agent sees when a contact is taken away** — OMniLeads: a
  sentence at press time. FieldQuo: a lapsed row silently drops off the held
  list on the next regroup, and if the rep dials it after the lapse the server
  refuses because the claim `WHERE` no longer matches. **Small gap, same
  shape as OMniLeads' weakness:** neither tells the rep *before* they press.
  Fix is a client-side "claim expires in 12m" on the held row from
  `claimExpiresAt`, which the queue payload already carries; no Twilio involved.
- Supervisor "reserve to a named agent": OMniLeads has it (unguarded);
  FieldQuo has `assignLeads.js` (claim mode `admin`, audited). Equivalent, ours
  is safer.

---

## 4. Inbound: queues, ring strategy, hold, last-agent affinity, voicemail, missed calls

### OMniLeads

Files read: `asterisk_config_generador_de_partes.py` (`GeneradorParaQueueEntrante`,
`GeneradorParaQueueGrabacion`), `asterisk_config.py` (`QueuesCreator._generar_dialplan_entrantes`),
`models.py` `Queue` (strategy, `timeout`, `wrapuptime`, `ringinuse`, `wait`,
`maxlen`, announcements, `destino_failover`, `ivr_breakdown`, `musiconhold`),
`services/asterisk/redis_database.py` (`CampanaFamily`, `RutaEntranteFamily`,
`IVRFamily`, `ValidacionFechaHoraFamily`, `DestinoPersonalizadoFamily`),
`configuracion_telefonia_app/models.py` (`DestinoEntrante`, `OpcionDestino`,
`RutaEntrante`, `IdentificadorCliente`), `reportes_app/models.py`
(`LlamadaLog` events, `entrantes_abandono`, `cantidad_llamadas_no_atendidas_fecha`,
`cantidad_llamadas_rechazadas_fecha`, `obtener_historico_llamadas_del_dia`),
`reportes_app/views_reportes_agentes.py` (`HistoricoDeLlamadasView`),
`templates/agente/historico_llamadas_del_dia.html`, `api_app/views/agente.py`
(`AgentRejectCallAsterisk`, `AgentRingingAsterisk`), `notification_app/notification.py`,
`notification_app/consumers.py`.

**Routing** is a graph of `DestinoEntrante` nodes reached from a `RutaEntrante`
(DID): inbound campaign, time-condition, IVR, hangup, customer-identifier
(DTMF-entered id checked against a DB or an external URL), custom
destination, survey, closing message, **agent** (a DID straight to one agent's
SIP endpoint), plus the WhatsApp/Messenger menus. `VOICEMAIL = 8` is declared
and **is not in `TIPOS_DESTINOS`** — there is no voicemail node, no voicemail
model and no voicemail view anywhere in the Python. OMniLeads has no voicemail.

**The queue** is a real Asterisk `app_queue` per campaign, generated into
`oml_queues.conf`: `strategy` ∈ rrordered | leastrecent | fewestcalls | random
| rrmemory | ringall, `timeout` (ring per member), `retry`, `wrapuptime`
(seconds a member is not rung after completing a call), `ringinuse=no`,
`maxlen`, `servicelevel`, `weight`, `autofill=yes`, `joinempty=yes`,
`leavewhenempty=no`. Members are added/removed/paused by AMI `QueueAdd` /
`QueueRemove` / `QueuePause` (`AgentActivityAmiManager`), each mirrored as a
`QueueLog` ADDMEMBER / REMOVEMEMBER / PAUSEALL / UNPAUSEALL row.

**Hold and announcements** (inbound queues only): `announce`
(`audio_previo_conexion_llamada`, played to the *agent* before bridging),
`periodic-announce` + frequency, `announce-holdtime` yes/no/once,
`announce-position` + frequency, `queue-callswaiting` / `queue-thereare` /
`queue-youarenext` prompts, a per-campaign `MOH` playlist, and
`context=sub-oml-module-ivrbreakout` when `ivr_breakdown` is set (the caller
presses a key to leave the queue for an IVR). `WELCOMEPLAY` (`audio_de_ingreso`)
plays before `Queue()`. When `wait` (`QUEUETIME`) expires the call goes to
`destino_failover` (`FAILOVERDST`) — any node — else hangs up. Maximum time in
queue is therefore a configured number; abandons are `ABANDON` / `ABANDONWEL`
(abandoned during the welcome) / `EXITWITHTIMEOUT` rows.

**"Last agent who talked to the caller".** OMniLeads has **no affinity of any
kind.** The strategy alone picks the member. `shared_lastcall=yes` is set on
every queue, but that is Asterisk's cross-queue wrap-up sharing, not
stickiness. The only "route to a person" is a DID whose destination is an
agent node, and the only identification is the `IdentificadorCliente` node
(caller types an id). When the intended agent is busy the caller waits in the
queue like anyone else.

**Missed call, and how the agent hears about it.** Asterisk writes
`RINGNOANSWER` with the `agente_id` that was rung. If the agent pressed the
red button in the modal, `AgentRejectCallAsterisk` sets `agente_extra_id =
agente_id` on that row, so reports split "no atendidas" (`agente_extra_id = -1`)
from "rechazadas". **The agent is told nothing.** The console's call-history
widget (`historico_llamadas_del_dia.html`) shows `RINGNOANSWER` rows with a
"lost call" icon and a click-to-call button, and it refreshes 2 s after the
agent's *next* completed call (`updateCallHistory` is called only from
`onCallEnded`). The websocket layer (`AgentNotifier`) has no missed-call
message type; its vocabulary is pause/unpause, dispositioned, contact saved,
supervisor message, CRM error, end-of-transferred-call, multinum attended,
and the WhatsApp/Facebook events.

Agents cannot decline a queue call and stay READY: `manageCallReceipt` calls
`refuseCall` automatically when `pause_enabled` (a race with a pause), and a
manual reject sends `RINGNOANSWER`; the queue then rings the next member.

### FieldQuo

Files read in full: `lib/sales/calls/inboundDistribution.js` (`reachable`,
`presenceOf`, `ringPlan`, `noAnswerSay`), `lib/sales/calls/inboundRouting.js`
(`inboundPlan`, `repIsLive`, `anyRepLive`, `fallbackSayFor`, `afterTransfer`,
`salesVoiceInboundState`), `lib/sales/calls/queue.js` (`queueStep`,
`maxHoldSeconds`, `requeueSay`, `MAX_QUEUE_ROUNDS = 4`, `QUIET_PAUSE_SECONDS = 10`),
`app/api/rep-dial/inbound/route.js` (main POST, `afterDial`, `queueStage`,
`afterVoicemail`, `offerMessage`, `pushRing`), `lib/sales/calls/voicemail.js`,
`app/components/sales/IncomingCallDock.js` (register, `incoming`, `cancel`,
`disconnect`, `decline`, `answer`), `app/api/sales/calls/answered/route.js`
(scoping), `lib/sales/calls/store.js` (`presenceFor`, `recordInbound`,
`lastOutboundBetween`, `recordVoicemail`, `salesVoiceNumber`).

A contractor rings a `sales_voice` / `sales` number back. The route verifies
the Twilio signature, resolves the number, matches the caller
(`inboundMatch.js`), writes the `SalesCallAttempt` (`direction: "in"`) **before
answering**, and builds a `ringPlan`:

1. the number's assigned rep — rung whatever their presence says;
2. `lastOutboundBetween(caller, ourNumber)` — the rep who last rang this
   contractor *from this number*, if `reachable`;
3. every other `available`, non-stale rep, longest-idle first, up to
   `MAX_RING_TARGETS = 3` in total;
4. `FIELDQUO_SALES_TRANSFER_TO` last.

A Quebec caller is filtered to French-selling reps and an Ontario caller to
English-selling ones (`leadLanguage.js`). Every target goes inside **one
`<Dial>`** for `RING_SECONDS = 20`, dual-channel recorded, with a Web Push
"Incoming call — <business>" to each browser target. Nobody free → the
**hold queue**: a `<Redirect>` loop, `round` in the URL, that speaks a true
line ("Everyone here is on another call… I will keep trying"), plays
`FIELDQUO_SALES_HOLD_MUSIC_URL` or pauses 10 s, re-reads presence, rings
whoever has come free, and after `MAX_QUEUE_ROUNDS = 4` (worst case
`4 × (5 + 10 + 20)` = 140 s, computed by `maxHoldSeconds`) offers a
`<Record maxLength=120>` voicemail written to `SalesCallAttempt.voicemailUrl` /
`voicemailSeconds` and played back through `/api/sales/voicemail/<id>/audio`
to the rep it is for (`voicemailWhere`: the attributed rep, or the number's
owner). A ring that goes unanswered re-enters the queue with `after=ring`,
which forces a hold round rather than ringing the same desk again. The queue
deliberately never claims a position ("you are third") because there is no
queue object to count.

The dock (`IncomingCallDock`) is mounted in the portal shell, registers a
Twilio Device with `incomingAllow`, slides a drawer down with the matched
business name, and posts `/api/sales/calls/answered` on pick-up so
`answeredByRepId` is written by the one component that knows. `decline()`
calls `call.reject()`.

### Verdict — mixed: ours is further on identification and rescue; four gaps, one of them a wrong comment

- **Last-agent affinity:** **ours, decisively.** OMniLeads has none; FieldQuo
  rings the number's owner and then the last caller before anyone else.
- **Voicemail:** ours. OMniLeads has none. FieldQuo's is filed, proxied,
  scoped, and shows a zero-length message as "heard the beep and hung up".
- **Never-silent, never-forever hold:** ours in discipline, theirs in
  vocabulary — see next.
- **Ring strategy — GAP, and the code's own comment is wrong.**
  `app/api/rep-dial/inbound/route.js` says of the multi-noun `<Dial>`:
  *"Twilio rings them in sequence and the first to answer wins."* Twilio's
  documented behaviour for several nouns in one `<Dial>` is **simultaneous**
  ringing — the first to answer is connected and the others are cancelled.
  So the "longest-idle first" sort in `ringPlan` has no effect on who is
  rung; it only decides which three are in the set. The effective strategy
  is Asterisk's `ringall` over ≤3 members. That is also why `decline()`'s
  comment ("the ring plan's NEXT target gets it") is not what happens: the
  others were already ringing. OMniLeads offers six strategies and defaults
  its inbound queues to whatever the campaign form chose. Twilio equivalents:
  sequential per-target `<Dial>` with `action` chaining (one target per
  document, the action URL carrying `targetIndex` — slower, `timeout` × n),
  or **TaskRouter** (a Workflow with a Worker per rep, `reservation` events
  driving the rep's client — real `leastrecent`/`fewestcalls`, real
  wrap-up), or keep simultaneous and say so. *At minimum the comment should be
  corrected so the next reader does not build on it.*
- **Wrap-up (`wrapuptime`) — gap, small.** Asterisk will not ring a member
  for N seconds after a completed call. FieldQuo's sweep excludes `after_call`
  (only `available` is `reachable`), but step 1 rings the number's owner
  whatever their state — including mid-write-up and mid-call. That is by
  design ("the person you were speaking to is ringing you") and probably
  right; it is named here because it is the one place a rep in ACW is rung.
- **Hold-time / position announcements, periodic announce, IVR breakout —
  gap, deliberate.** FieldQuo cannot honestly announce a position; a periodic
  announce is one `<Say>` per round already; an IVR breakout ("press 1 to
  leave a message now") is a `<Gather>` around the hold `<Play>` — a cheap
  courtesy worth adding, because a caller who knows they want voicemail is
  held for up to 140 s to reach it.
- **Failover destination after the wait** (`destino_failover`, any node):
  FieldQuo's is fixed at voicemail. Equivalent for a sales floor.
- **Missed-call notification** — equivalent, both weak. OMniLeads shows a
  lost-call icon in a list that refreshes after the next call; FieldQuo writes
  the inbound attempt and pushes "Incoming call" at ring time, but a call
  that rang out and went to voicemail produces no "you missed X" to the reps
  it rang — the voicemail tab and the floor board are where it surfaces. The
  cheap fix is a second Web Push on the voicemail/after-dial stage with the
  same tag, "Missed: <business> — left a message (0:42)".
- **Inbound routing graph** (IVR, time conditions, customer identifier, DID →
  agent): not a gap for a sales floor with one purpose per number; FieldQuo's
  language rule is the one branch it needs, and it has it.

---

## 5. Agent presence and pause states; is an agent in ACW rung?

### OMniLeads

Files read: `api_app/views/agente.py` (`AgentLoginAsterisk`, `AgentLogoutAsterisk`,
`AgentPauseAsterisk`, `AgentUnpauseAsterisk`, `AgentRingingAsterisk`,
`AgentDisabledAsterisk`, `AgentLogoutView`), `services/asterisk/agent_activity.py`
(`AgentActivityAmiManager` — `login_agent`, `pause_agent`, `unpause_agent`,
`set_agent_ringing`, `_set_agent_redis_status`, `_queue_pause_unpause`,
`_close_open_session`), `services/agent/presence.py` (`AgentPresenceManager`),
`reportes_app/actividad_agente_log.py` (`AgenteTiemposReporte` — a DTO of
session/pause/call/hold times and their percentages, nothing else),
`reportes_app/models.py` (`ActividadAgenteLog`, `ActividadAgenteLogManager`),
`api_app/views/logging.py` (only `TransferenciaAEncuestaLogCreateView` — the
survey-transfer log; no agent-state logging lives there), `models.py` (`Pausa`,
`ConjuntoDePausa`, `ConfiguracionDePausa`, `Grupo`, `ConfiguracionDeAgentesDeCampana`),
`phoneJsController.js` (`callEndTransition`, `setPause`, `leavePause`,
`doLeavePause`, `PauseManager`, `AgentConfig`, `subscribeToAgentNotificationEvents`),
`phoneJsFSM.js`, `management/commands/logout_unavailable_agents.py`.

**Two stores, three writers.** "Now" is a Redis hash `OML:AGENT:<id>` with
`STATUS ∈ READY | PAUSE-<name> | RINGING | ONCALL | OFFLINE | UNAVAILABLE |
DISABLED`, `TIMESTAMP`, `PAUSE_ID`, `CAMPAIGN`, `CONTACT_NUMBER`. "Then" is
`ActividadAgenteLog` (ADDMEMBER / REMOVEMEMBER / PAUSEALL / UNPAUSEALL with
`pausa_id`), written by `AgentPresenceManager` from the Django views. The
Asterisk queue membership is a third truth, kept in step by AMI `QueueAdd` /
`QueueRemove` / `QueuePause` in the same views. `AgenteProfile.estado` is a
fourth column with a `TODO: Revisar si esta variable se esta usando` — nothing
writes it. ONCALL/RINGING in Redis are written by the dialplan and by
`AgentRingingAsterisk` (the browser posts `ringing=true` when the modal opens
and `false` on `onRingingEnd`).

**Pauses** are `Pausa` rows (productive / recreational), grouped into
`ConjuntoDePausa` per `Grupo` with `ConfiguracionDePausa.time_to_end_pause`
(0–28800 s; the browser counts down and auto-unpauses). Three reserved ids:
`'0'` = ACW, `'00'` = Supervision, `'OW'` = On WhatsApp. A supervisor can force
pause/unpause (`notify_pause` / `notify_unpause` over the websocket, the
browser obeys), force logout, and `logout_unavailable_agents` (cron, 5 min)
logs out agents whose Django session expired. The browser also lets an agent
*programme* a pause while on a call (`setNextPause`) that is applied at
`callEndTransition`.

**How a call changes state.** The FSM (`Ready → ReceivingCall → OnCall →
Ready`) is browser-side. On every `onCallEnded` the browser calls
`setPause(ACW_PAUSE_ID, 'ACW')` — a real AMI `QueuePause` — then, unless
`obligar_calificacion` is on and the call is not yet dispositioned, arms a
timer for `auto_unpause` seconds (campaign `ConfiguracionDeAgentesDeCampana`
overrides group `Grupo.auto_unpause`; `0` means stay in ACW until the agent
presses Resume). If the agent was in a named pause before the call, ACW
returns them to *that* pause (`return_to_pause`).

**Is an agent in ACW rung?** **No, and it is enforced at the queue.** ACW is
`QueuePause` with `Paused: true` on the member interface, so `app_queue` skips
them; `ringinuse=no` skips a member already on a call; `wrapuptime` adds a
configured cool-down on top. Click-to-call and transfers still reach a paused
agent (the FSM allows `receiveCall` from `Paused`), and `manageCallReceipt`
refuses any dialer/inbound call that arrives during the pause race.

### FieldQuo

Files read: `lib/sales/calls/agentState.js` in full (`REP_STATES`, `PAUSE_REASONS`,
`STATUS_CHOICES`, `TRANSITIONS`, `canTransition`, `livePresence`,
`activityTotals`, `pauseBreakdown`, `PRESENCE_STALE_MINUTES = 15`,
`HEARTBEAT_SECONDS = 60`), `store.js` (`currentActivity`, `setRepState`,
`heartbeat`, `presenceFor`), `app/api/sales/calls/state/route.js`,
`inboundDistribution.js` (`reachable`), the `postState` calls in `CallPanel.js`
and `IncomingCallDock.js`, `lib/sales/autodial.js` (header).

Five states — `offline`, `available`, `on_call`, `after_call`, `paused` (with a
closed reason list carrying a `paid` flag) — in **one table**,
`SalesRepActivity`, whose newest open row *is* the current state; `livePresence`
adds `stale` (no heartbeat for 15 min) and `everSeen` / `everSignedIn` as
separate facts. Every state is declared by the rep or posted by the call
lifecycle (`on_call` at press/answer, `after_call` at Twilio `disconnect`);
a heartbeat can age a row and never open one. `on_call → paused` is absent by
design; `offline → on_call` is present ("a dial is work"). Time-to-end-pause,
supervisor force-pause/force-logout, and a session-expiry logout do not exist.

**Is a rep in ACW rung?** By the availability sweep, no — `reachable` requires
`state === "available"`. By the number-owner step (and by a transfer target
list — no, `transferTargets` uses `reachable`), yes. So: *sweep no, owner yes,
transfer no.* The progressive autodialler will not place the next call until
the rep is `available` again with the switch on.

### Verdict — equivalent, ours is cleaner; two small gaps

- One table vs Redis + Postgres + queue membership: ours (CALL-HANDLING §2
  said so and the code bears it out — OMniLeads' own `presence.py` has a
  five-line TODO about consolidating it).
- ACW-not-rung: equivalent in effect; OMniLeads enforces it at the carrier,
  FieldQuo at the router (and, in Twilio terms, there is no carrier-side
  member state to enforce it at — unless TaskRouter is adopted, where a
  Worker `Activity` of "wrap-up" is exactly `QueuePause`).
- **Timed pause** (`time_to_end_pause`) — gap, small. A break that ends itself
  after 15 minutes is a supervisor's lever and a rep's convenience. Pure
  client countdown + a `postState({ state: "available" })`; no carrier.
- **Supervisor force-pause / force-logout / message-to-agent** — gap,
  deliberate (CALL-HANDLING §2 "every one is a separate product decision").
  Web Push already exists as the transport; the *authority* is the question.
- **`auto_unpause` after ACW** — FieldQuo's rep stays `after_call` until they
  log the outcome, and the auto-log (§7) ends most short calls for them; an
  answered conversation stays in `after_call` until the outcome is typed or
  deferred. Equivalent to `obligar_calificacion` + `auto_unpause=0`.

---

## 6. Recording

### OMniLeads

Files read: `asterisk_config_generador_de_partes.py` (`GeneradorParaQueueGrabacion`
— the only `MixMonitor` in the repo), `services/asterisk/redis_database.py`
(`CampanaFamily` `REC`, `EsquemaGrabacionesFamily`, `TRANSCRIPTION_PER`,
`RESUME_PER`), `models.py` `Queue.auto_grabacion`, `GrabacionMarca`,
`phoneJsController.js` (`recordCall` = DTMF `*4`, `stopRecordCall` = `*5`,
`toogleVisibilityRecordButtons`), `reportes_app/models.py`
(`LlamadaLogManager.obtener_grabaciones_by_filtro`, `url_archivo_grabacion`,
`obtener_grabaciones_marcadas`), `views_grabacion.py`
(`BusquedaGrabacionAgenteFormViewEx`, `BusquedaGrabacionSupervisorFormViewEx`,
`MarcarGrabacionView`), `forms/base.py` `GrabacionBusquedaFormEx`,
`api_app/views/grabaciones.py`, `build/docker/ci-images/converter.sh`,
`configuracion_telefonia_app/models.py` `EsquemaGrabaciones`.

- **How.** `MixMonitor(${MONITOR_FILENAME}.wav,b,/usr/local/parselog/update_mix_mixmonitor.pl
  ${UNIQUEID} ${MONITOR_FILENAME}.wav)` in the generated inbound-queue
  context when `auto_grabacion` is on; the `b` flag records only while
  bridged; the post-process script (not in the archive) writes the filename
  onto the `LlamadaLog` row (`archivo_grabacion`). Outbound campaigns get
  `REC` in the Redis family and the dialplan (not here) does the same. On
  demand: the agent's Record button sends `*4` / `*5`.
- **Where.** A single mixed `.wav` (later `.mp3` via the nightly `lame`
  job, `MONITORFORMAT`), under a date directory, optionally synced to S3 /
  MinIO. The filename pattern is configurable (`EsquemaGrabaciones`: contact
  id, date, phone, campaign id, external ids, agent id).
- **Search.** `obtener_grabaciones_by_filtro`: date range, call type, client
  phone, callid, external contact id, agent, campaign (incl. active/deleted),
  minimum duration, "marked" (`GrabacionMarca` — a free-text tag an agent
  adds during the call via `marcarLlamada`), "qualified as management",
  disposition option, page size; supervisors see their campaigns, agents
  their own when `acceso_grabaciones_agente`. Zip download of a result set.
  Transcription / summary are percentage-sampled per campaign
  (`transcription_percentage`, `summarize_percentage`) and the sentiment
  table exists (`AnalisisSentimiento`) — the workers are elsewhere.
- **Disclosure: none. Confirmed.** A repository-wide search for
  grabada / being recorded / disclosure / recording notice / consent across
  `.py`, `.html`, `.js`, `.vue` (excluding vendored `ext/`) finds nothing. The
  only pre-connect audio hooks are `audio_de_ingreso` (`WELCOMEPLAY`, played to
  the caller before `Queue()`) and `audio_previo_conexion_llamada`
  (`announce=`, played to the *agent*). A contractor could upload a
  disclosure as the welcome audio on an inbound campaign; nothing plays one
  on outbound or manual calls, and nothing in the product knows the concept.

### FieldQuo

Files read: `lib/sales/calls/recording.js` in full, `lib/sales/calls/recordingsList.js`,
`app/api/rep-dial/recording/route.js` (header), `lib/sales/playbook/defaults.js`
(`OPENER`, the `RECORDING_DISCLOSURE_EN` line), `lib/sales/calls/transcribe.js`
(header), the `dialRecordingAttrs` / `conferenceRecordingAttrs` spreads in
`bridge`, `inbound` and `transferRest`.

Since 2026-09-17 every sales call is recorded, `record-from-answer-dual`
(rep on one channel, contractor on the other; `channelSpeakers` maps by
direction), conferences `record-from-start` mixed. The webhook writes
`recordingUrl` / `recordingSid` / `recordingSeconds` / `recordingChannels` on
the attempt and transcription runs per channel. Media is proxied, never the
provider URL. **The disclosure is spoken by the rep**: `OPENER` in every
default playbook carries "this call may be recorded" in EN/FR/ES
(`recordingDisclosure.js`). Recordings are superadmin-only
(`recordingsList.js`: "a rep does not hear their own recordings by decision"),
filtered by date, rep and transcription state.

### Verdict — equivalent where it counts; two gaps, one of them ours to lose

- Dual-channel with speaker attribution: **ours** (OMniLeads is a single
  mixed track; its transcription cannot tell agent from customer).
- Disclosure: **ours** — theirs has none; ours is in the script, which is a
  human promise rather than a machine one. Worth naming: a rep who skips the
  opener has recorded without disclosing, and nothing measures that.
  `transcribe.js` + the script comparison the owner asked for is the check.
- **Recording search** — gap. OMniLeads filters on phone, callid, campaign,
  disposition, minimum duration, "marked", and agents can search their own.
  FieldQuo filters on date / rep / transcribed. Adding `toE164`,
  `disposition`, `recordingSeconds >= n` and `prospectId` to
  `recordedCalls()` is a `where` change; no carrier involved.
- **On-demand pause/resume of recording** (`*4` / `*5`) — gap, small but
  compliance-relevant (a contractor reads out a card number). Twilio:
  `recordings(sid).update({ status: "paused" | "in-progress" })` on the
  active recording, or `<Dial record>` off and `calls(sid).recordings.create()`
  on demand. Needs the recording SID mid-call, which the `completed`-only
  callback does not give; `recordingStatusCallbackEvent: "in-progress"`
  would.
- **Marking a recording with a note during the call** (`GrabacionMarca`) —
  FieldQuo's outcome note covers it after the call. Not a gap.

---

## 7. Disposition ("calificación") after the call

### OMniLeads

Files read: `views_calificacion_cliente.py` (`get`, `form_valid`,
`_calificar_form`, lines 330–700), `api_app/services/calificacion_llamada.py`
(`CalificacionLLamada` — Redis `OML:CALIFICACION:LLAMADA:<agent>` with
`CALIFICADA`, `GESTION`, `CALLDATA`, 4-day TTL), `api_app/views/agente.py`
(`ApiStatusCalificacionLlamada`), `click2Call.js` (`Click2CallDispatcher`,
`disposition_forced`, `make_disposition`, `make_sales_form`),
`phoneJsController.js` (`callEndTransition`, `leavePause`, `onNotificationForzarDespausa`,
`manageContact` → `getQualificationForm`), `models.py` (`CalificacionCliente`,
`OpcionCalificacion` types GESTION / AGENDA / no-action, `Grupo.obligar_calificacion`,
`obligar_despausa`, `ConfiguracionDeAgentesDeCampana.obligar_calificacion`),
`notification_app/notification.py` (`notify_dispositioned`).

- **When the form appears.** On `answer` (or auto-attend) the console's
  iframe is pointed at `calificar_llamada/<call_data_json>` — the
  disposition form is *the* screen during the call, with the contact's data
  and the campaign's options. For a multi-number dial it appears when the
  number that answered is known.
- **Is it mandatory?** Only when `obligar_calificacion` is on (campaign
  override, else group). Then: the GET of the form writes the Redis hash with
  `CALIFICADA=FALSE`; a successful save rewrites it `TRUE` (or `GESTION=TRUE`
  with the calification id when a management form is still owed). Every
  subsequent *dial* — click-to-call, agent-to-agent, external, preview call —
  first calls `ApiStatusCalificacionLlamada` and, if the last call is not
  qualified, opens the "you must qualify" modal and points the iframe back at
  the form. `leavePause` does the same when `obligar_despausa` is on, so the
  agent cannot leave ACW either. `notify_dispositioned` over the websocket
  auto-unpauses the agent the moment the form saves.
- **Can it be deferred?** With the flag off, entirely — nothing chases it;
  the Redis hash is not written and the call simply has no `CalificacionCliente`
  (which the recycling module later reports as "connected, not dispositioned").
  With the flag on, no — the next dial and the next unpause are blocked.
  There is no "later" button and no sweep that logs a default.
- **A call the agent did not answer.** No form, ever: the form is opened from
  the answer handler. The call exists only as `RINGNOANSWER` / the queue's
  `ABANDON` rows. A dialer call that reached nobody is dispositioned by the
  dialer's own result codes (`ReglasIncidencia`), not by an agent.
- **One disposition per contact per campaign** (`_validar_unicidad_calificacion`):
  a second call re-qualifies (edits) the same row, with `HistoricalRecords`
  keeping the history and `update_change_reason` recording the source.
  Inbound calls with no contact get a "create contact" form first.

### FieldQuo

Files read: `lib/sales/calls/dispositions.js` in full (`DISPOSITIONS`,
`planDisposition`, `autoLogOutcome`, `AUTO_LOGGED_CODES`,
`AUTO_LOG_MAX_TALK_SECONDS = 10`, `AUTO_LOG_GRACE_SECONDS = 5`,
`AUTO_LOG_UNDO_SECONDS = 15`, `endOfCall`), `lib/sales/calls/outcomeChoices.js`
(the six buttons and `foldChoice`), `store.js` (`saveDisposition`,
`recordCallEnd`, `autoLogAttempt`, `deferDisposition`, `unloggedWhere`,
`unloggedAttempts`, `autoLogStale`, `staleAtDayEnd`), `app/api/sales/calls/route.js`
(the outcome branch), `app/api/sales/calls/unlogged/route.js`,
`app/api/sales/badges/route.js` (the unlogged count), `app/components/sales/CallPanel.js`
(header, the auto-log and OutcomeSheet wiring), `app/components/sales/OutcomeForm.js`,
`app/components/sales/UnloggedCalls.js`, `app/api/cron/sales-queue-release/route.js`.

- **The row exists at the dial**, `disposition: null`, and "pending" is a
  first-class report bucket.
- **Mandatory, in the one place it matters.** An unlogged call is drawn in
  place of the Call button; the autodialler will not place the next call; the
  badge counts them; the day-end cron (`autoLogStale`) logs whatever is still
  open with the line's own verdict, else `no_answer`, marked
  `dispositionAutoLogged` so a report can tell it from a rep's. A rep may
  overwrite an auto-logged outcome once; the line never overwrites anything.
- **The line answers what it can** (`autoLogOutcome`): never-connected →
  `no_answer` / `busy`; prospect dropped inside 10 s → `hung_up`; rep pressed
  Hang up or talked ≥10 s → the rep is asked (an `OutcomeSheet` pops only
  after the carrier says the call ended and was answered). Handset dials are
  never auto-logged.
- **Deferral exists** (`deferDisposition`): "write it up later" frees the
  dialler, writes a provisional retry schedule so the row is not offered
  again, and deliberately does not write `lastOutcome`.
- **A call the rep did not answer:** an inbound attempt that rang out or was
  declined has `direction: "in"` and no outcome; it never appears as unlogged.

### Verdict — ours is further, with one real gap

- Forced disposition, deferral, auto-log, undo strip, day-end sweep: **ours**.
  OMniLeads has force-or-nothing and no deferral.
- Six buttons vs a campaign-configurable option list with sub-options and a
  management form: theirs is more configurable, ours is by the owner's
  decision (§4 of CALL-HANDLING: an outcome carries code behaviour).
- **Inbound calls a rep answered are never dispositioned — GAP.**
  `unloggedWhere` is `{ direction: "out", disposition: null }`; `saveDisposition`
  scopes on `salesRepId`, which on an inbound row is the *last caller*, not
  `answeredByRepId`; `IncomingCallDock` imports no `OutcomeForm`; `autoLogStale`
  filters `direction: "out"`. A contractor who rings back, is answered, and
  says "yes, send me the link" leaves no outcome, no callback, no
  `leadStatus` change, and no retry schedule. OMniLeads qualifies inbound
  calls exactly like outbound ones (the form opens on `answer` regardless of
  `origin`). No carrier work: widen `unloggedWhere` to
  `OR: [{ salesRepId }, { answeredByRepId }]` with `direction` in both,
  render `OutcomeForm` in the dock's live-call card after `disconnect`, and
  let `saveDisposition` accept `answeredByRepId` as ownership — the same
  widening `attemptFor` in the transfer route already did.
- **One disposition per contact, editable with history** vs one per
  attempt, append-only: different models, both defensible. FieldQuo's "log a
  new call rather than rewriting this one" is the audit-friendlier of the two.

---

## The gaps, prioritised

Ordered by how often a rep hits it on a normal day × how bad the miss is.
Each line names the Twilio mechanism. OMniLeads' version is Asterisk and is
not reusable as code for any of them.

1. **Disposition inbound calls a rep answered** (§7). Today they vanish.
   Design: `unloggedWhere` and `saveDisposition` accept `answeredByRepId`;
   `IncomingCallDock` renders `OutcomeForm` after `disconnect`; `autoLogStale`
   covers `direction: "in"` rows with an `answeredByRepId`. Pure schema-less
   change; no Twilio.
2. **Fix the ring-strategy claim, then choose one** (§4). Correct the
   "in sequence" comment in `app/api/rep-dial/inbound/route.js` and the
   "NEXT target" comment in `IncomingCallDock.decline()`; then either keep
   simultaneous ringing and drop the no-op idle sort, or ring one target per
   `<Dial>` with the `action` URL carrying `targetIndex` (true
   longest-idle; costs up to 3 × 20 s), or adopt **TaskRouter** (Workflow +
   Workers, `reservation.created` → the rep's client, Activities for
   available / wrap-up) for real strategies and carrier-side ACW.
3. **Callback reminder at the agreed time** (§2). A cron (the existing
   `sales-queue-release` runs hourly; this wants every minute or a 5-minute
   window) over `SalesCallAttempt.callbackAt` in the next window, Web Push via
   `pushToReps` with tag `sales-callback:<attemptId>` and `url` to the
   prospect. No Twilio.
4. **Transfer to the hold queue and to an allow-listed external number**
   (§1). Queue: a `kind: "queue"` target whose start action is
   `callerToQueue` (already an action type) with `round=0` — the transferring
   rep is released and the caller is held and re-rung. External: `kind: "number"`
   targets from a superadmin table (`PlatformSmsNumber`-adjacent, or a new
   `SalesTransferDestination`), placed by `dialTransferTarget` unchanged.
   Never a typed number.
5. **Three-way / conference and hold on a plain call** (§1). One change:
   place every bridged call in a per-attempt `<Conference>` instead of a
   `<Dial>` (the transfer already knows how). Then hold is a participant
   `hold: true`, three-way is `onComplete` without `hangup rep` (new action
   `join`), and a supervisor listen/whisper/barge is `participants.create` with
   `coaching` — which is also the OMniLeads Enterprise feature the open code
   stubs. Dual-channel recording is lost in a conference (one mixed track);
   that trade must be named to the owner before it is made.
6. **Missed-call push after a ring-out or voicemail** (§4). In `afterDial`
   (nobody answered) and `afterVoicemail`, `pushToReps` to the rung targets:
   "Missed: <business> — left a message (0:42)". Same tag as the ring push so
   it replaces it. No Twilio beyond what is there.
7. **Recording search filters and on-demand pause** (§6). `recordedCalls()`
   gains `toE164`, `prospectId`, `disposition`, `minSeconds`. Pause/resume:
   subscribe to `recordingStatusCallbackEvent: "in-progress"` to learn the
   RecordingSid, then `recordings(sid).update({ status })` from a panel
   button; log the pause window on the attempt so the transcript can say
   "[recording paused 1:12–1:40]".
8. **IVR breakout from the hold queue** (§4). Wrap the hold round's `<Play>`
   / `<Pause>` in a `<Gather numDigits=1 action=…?stage=queue&leave=1>`,
   speak "press 1 to leave a message now", and route `leave=1` to
   `offerMessage`. Cheap, and it shortens the worst case from 140 s to
   whenever the caller decides.
9. **Timed pauses** (§5). `ConfiguracionDePausa.time_to_end_pause` → an
   optional `endsAt` on the pause `postState`, a countdown in `RepStatus`,
   and an automatic `available` when it elapses. No carrier.
10. **Claim-expiry warning on the held row** (§3). The queue payload already
    carries `claimExpiresAt`; print "claim ends in 12 m" in the held list
    when under an hour, so a rep is told before the press rather than at it.

Not recommended, and why: per-rep callback count caps (§2 — the lease
already surfaces hoarding); hold-position announcements (§4 — cannot be
honest without a queue object); supervisor force-pause/force-logout (§5 — a
product decision the owner has not taken, and CALL-HANDLING §2 records
that); configurable disposition options (§7 — outcomes carry code
behaviour); adopting Asterisk semantics wholesale (every one of them costs a
second phone system).
