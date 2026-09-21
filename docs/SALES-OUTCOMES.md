# Sales floor — call outcomes, second pass

Seven capabilities added to the sales floor on 2026-09-21: sub-reasons under an
outcome, a supervisor's audit of the outcome, bookmarks on the recording, a
callback agenda with personal/global delivery, the inbound service level,
sampled transcription and review, and answering-machine detection.

Everything here was studied from OMniLeads (LGPL-3.0, `/Volumes/1TB emilio
ssd/Downloads Archive/ominicontacto-master`, read in place for design only —
no code copied). Each section cites the file and line range the design came
from and says what was kept, what was changed and why.

Check: `node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-sales-outcomes.mjs`
(also `check:sales-call-handling`, `check:sales-call-panel`, `check:call-qa`,
which were extended).

## Settings, defaults, costs

All in one PlatformSetting row, `sales.outcomes`, edited on
`/platform/sales/outcomes` (superadmin; every save audit-logged with before
and after). Table and bounds: `lib/sales/calls/outcomeSettings.js`.

| Key | Default | Bounds | What it changes | Cost |
|---|---|---|---|---|
| `sales.callback.graceMinutes` | 15 | 0–1440 | How long a personal callback waits past its hour before it goes global | — |
| `sales.callback.maxOpenPerRep` | 25 | 1–500 | The sheet refuses a new callback past this many open | — |
| `sales.callback.maxDaysAhead` | 14 | 1–60 | The sheet refuses a later date (code ceiling stays 60) | — |
| `sales.inbound.serviceLevelSeconds` | 20 | 1–600 | "Answered within N s" on the performance page | — |
| `sales.transcription.percent` | 100 | 0–100 | Share of recorded calls transcribed (deterministic per call) | Whisper per audio minute, in proportion |
| `sales.aiReview.percent` | 100 | 0–100 | Share of transcribed calls the model scores | ~$0.001 a call, in proportion |
| `sales.amd.enabled` | **off** | bool | Twilio AMD on the prospect leg of every browser dial | **$0.0075 per call** (twilio.com/en-us/voice/pricing/us, read 2026-09-21) — the flip is the approval |
| `sales.amd.voicemailDropUrl` | empty | https URL or empty | With a URL, a `machine_end_*` verdict plays it to the machine and hangs up that leg | Legal: a pre-recorded drop is what WA RCW 80.36.400 fines at $1,000 a time (the voicemail outcome's own comment). Default empty on purpose. |

The sub-reason lists live in a second row, `sales.subDispositions`, with the
defaults in code (`lib/sales/calls/subDispositions.js`).

**Default-off and why:** AMD costs money per call and the owner has not said
yes; the drop URL carries legal exposure FieldQuo has refused until now. Both
print their cost beside the control. Everything else defaults to today's
behaviour (100 % transcription, 100 % review) or to a bound looser than any
real day.

## 1. Sub-dispositions

**Model:** `OpcionCalificacion.subcalificaciones` (ominicontacto_app/models.py
~1674–1732) is a JSON list per disposition option;
`CalificacionCliente.subcalificacion` (~2983–3110) stores the one picked;
reportes_app/views_reportes.py (~150–165) prints it beside the disposition.

**Built:** `lib/sales/calls/subDispositions.js` — a default list per outcome
(reached_not_interested, bad_number, not_a_fit, gatekeeper; do_not_call,
voicemail and text_instead take an empty list), each entry with en/fr/es
labels, one entry per list allowed to ask a detail (`using_competitor` →
the name). `planDisposition` refuses an outcome with a non-empty list and no
pick, a pick off the list, a pick on an outcome with no list, and a detail
missing where asked. Stored on `SalesCallAttempt.subDisposition` /
`subDispositionDetail`. The outcome sheet (`OutcomeForm.js`) asks the fold
which code the buttons mean and draws that code's list; the pick is validated
in the browser with the same pure rule and again on the server. Lists are
editable per outcome on `/platform/sales/outcomes`; line-written outcomes and
callback/agreed cannot be given one. The performance page breaks outcomes down
by sub-reason (`subDispositionCounts`, share computed in the module), and the
history row prints it. The objection library can read the counts through
`lib/sales/calls/outcomeReport.js`.

## 2. Disposition audit

**Model:** `AuditoriaCalificacion` (~3149–3197): OneToOne on the disposition,
`resultado` APROBADA/RECHAZADA/OBSERVADA, `observaciones`, `revisada`.
views_auditorias.py (~145–225) opens one disposition with its history and
recordings; reporte_estadisticas_agentes.py (~160–215) prints the verdict per
call and counts OBSERVADA per agent.

**Built:** `SalesDispositionAudit` (one per attempt, @unique; auditorId,
verdict approved/rejected/observed, notes, the outcome as audited). Re-audit
updates the row; the history is `PlatformAuditLog`
(`sales_disposition_audited`, before and after). Not SalesEvent — that table
is the rep's calendar. Panel on `/platform/sales/call-quality` beside the
recording, transcript and AI score (the page the brief called "Conversations"
is texts and email; the recording/transcript/AI score live on Call quality,
so the audit panel is there). Rep side: "Reviewed: rejected — note" on the
call's history row, a card on the dashboard with the 30-day count (drawn only
when > 0), `/api/sales/calls/reviews`. Performance page: audited vs unaudited
per rep and the rejection rate over audited rows.

## 3. Recording bookmarks

**Model:** `GrabacionMarca` (~2878–2890): callid + one descripcion;
views_grabacion.py MarcarGrabacionView (~85–100).

**Built:** `SalesRecordingMark` (attemptId, authorKind rep/platform, authorId,
atSeconds, note; many per call, capped at 40). Rep: a Mark button on the live
call card (`RecordingMark.js`); the server stamps `now − answeredAt`
(`/api/sales/calls/marks`), refusing with a sentence until the pickup has been
reported. Superadmin: ticks on a ruler under the player, a list that seeks,
"Mark here" at the player's second (`CallQualityReview.js`,
`/api/platform/sales/outcomes/marks/[id]`). Marks are read into the QA prompt
as "moments the rep flagged", fenced as context. Reps have no playback
surface of their own (the agency call-quality page carries no audio), so a
rep's marks show as a list on the call's history row.

## 4. Callback agenda

**Model:** `AgendaContacto` (~3252–3300): fecha/hora, TYPE_PERSONAL /
TYPE_GLOBAL, observaciones, telefono; limits on `Grupo` (~297–305) enforced
by `AgenteProfile.permite_agenda_personal` / `tiempo_maximo_para_agendar`
(~525–535) and at save (~3272–3285); views_agenda_contacto.py (~92–100) hands
a global agenda to the dialler; supervisor lists by campaign/agent/date
(~205–300).

**What existed:** the `callback` outcome wrote `callbackAt` and the retry
pool's `nextAttemptAt`; a due callback already sat at the front of "Callable
now" (`lib/sales/retryPool.js`); `spokenFor()` kept it from release;
`CallbacksStrip` listed the rep's own with Call now.

**Built:** `lib/sales/calls/callbackAgenda.js`. (a) `callbackScope`
personal/global and `callbackRepId` on the attempt; a personal callback past
`graceMinutes` whose rep is not reachable (inboundDistribution's `reachable`
over `presenceFor`, read-only) is handed to the next available rep who may
take it (same language rule as the inbound line, longest idle first), the
prospect's claim moves with it (scoped to the old holder), a claim log row is
written, once (guard on `callbackReassignedAt null`). (b) Delivery: the
per-minute cron (`sales-pipeline`) pushes "Callback due 2:00 pm — asked for
you" once (`callbackNotifiedAt null` guard); the queue row and current pane
carry the badge (`data-queue-callback`), amber once due, naming the promiser
on a hand-over; the retry pool's due-first ordering is the inclusion-at-the-top.
(c) Limits: `planDisposition` refuses beyond `maxDaysAhead` and at
`maxOpenPerRep` with a plain sentence; the store counts open callbacks only
when the outcome is a callback. (d) `/platform/sales/outcomes` lists open /
due today / overdue / per rep; the floor board flags callbacks overdue more
than 24 h. FieldQuo has no dialler to hand a global callback to, so the grace
and the hand-over are the addition.

## 5. Inbound service level

**Model:** `Queue.servicelevel` (~1786) handed to Asterisk
(asterisk_config_generador_de_partes.py ~303); reporte_llamadas_entrantes.py
(~46–103) counts CONNECT with bridge_wait_time, ABANDON/ABANDONWEL with their
own wait, EXITWITHTIMEOUT; reportes_app/models.py (~368–372) files ABANDON,
EXITWITHTIMEOUT and AMD together as EVENTOS_NO_DIALOGO apart from
EVENTOS_NO_CONTACTACION.

**Built:** `lib/sales/calls/serviceLevel.js`. Arrival is `dialledAt` on the
inbound row (written on arrival — no new column). The pickup stamp was wrong:
the inbound after-dial wrote `answeredAt = new Date()` at the END of the desk
leg; it now uses `answeredAtFrom` (end minus DialCallDuration), the fix the
outbound status route already had. Abandoned = missedAt, no answer, no
voicemail; expired = voicemail offered; open = neither yet. Performance page:
"Answered within 20 s: 71% (17 of 24)", abandoned, to voicemail, average and
longest wait, per day and per rep (the rep who picked up, else the rep the
call was filed to).

## 6. Sampled transcription and review

**Model:** `Queue.transcription_percentage` / `summarize_percentage`
(~1801–1808), 0–100 per campaign.

**Built:** `lib/sales/calls/sampling.js` — FNV-1a of the call sid (else the
attempt id) mod 100 against the share; the same call is in or out on every
run and lowering the share keeps what was in. `transcribeAttempt` and
`scoreAttempt` take `sample` (true from the webhook and the reconcile, false
for a named platform ask); a skipped call is marked `sampled_out: …` in
`transcriptError` / `skippedReason`, shown as "not in the sample" in the
review queue, and never retried by "retry the failed ones". Opening a
sampled-out call on `/platform/sales/call-quality` transcribes (then scores)
it in `after()`. The costs page prints both shares beside the spend.

## 7. Answering-machine detection

**Model:** `Queue.detectar_contestadores` (~1799),
`audio_para_contestadores` (~1817), `AmdConf` (configuracion_telefonia_app/
models.py ~607–627), the 'AMD' LlamadaLog event (reportes_app/models.py ~370).

**Twilio:** `<Dial><Number>` takes `machineDetection`, `amdStatusCallback`
and the four thresholds (docs/voice/twiml/number; twilio 6.0.2
`NumberAttributes`). On `<Number>` the verdict is only ever delivered to the
callback, so the bridge is never held; `AsyncAmd` is a REST `Calls.create`
parameter and does not exist on TwiML. Mode `DetectMessageEnd`: a human is
reported when identified, a machine at the beep / end of greeting. Verdicts:
human, machine_start, machine_end_beep, machine_end_silence,
machine_end_other, fax, unknown. Price: $0.0075 per call.

**Built:** `lib/sales/calls/amd.js`; the bridge spreads `amdNumberAttrs` when
`sales.amd.enabled` is on; `/api/rep-dial/amd` verifies the signature, writes
`amdResult` / `amdAt` / `amdMs` scoped to the stored leg, and — only on
`machine_end_*` with a drop URL — redirects the prospect leg to `<Play>` +
`<Hangup/>`. Never on a human: `shouldDropVoicemail` is the single gate. A
machine verdict (i) files the call as voicemail in the measured bucket even at
120 s with a wordy greeting (`measuredConversation`, basis `amd`); (ii)
auto-logs `voicemail` so the voicemail retry rule (two days, next block,
three messages — `lib/sales/retryRules.js`) fires rather than hung_up's; the
history row wears a "machine" chip; (iii) with no drop URL the live card says
"Machine detected — leave your message in your own voice, or hang up"
(`/api/sales/calls/live`, polled 3 s for the first minute, and not at all
when the first answer says the feature is off).

**AMD, measured:** not yet. The setting is off (it costs money per call and
the owner's flip is the approval), so no call carries a verdict.
`scripts/report-amd-accuracy.mjs` is ready: it prints the 2×2 of AMD verdict
vs transcript verdict for the first 50 calls with the ids of every
disagreement. Run it after fifty calls and write the figures here. A
disagreement where AMD says machine on a 20–60 s call with a wordy greeting
is more likely AMD being right — the transcript's word count is exactly what
a long greeting passes.

## Schema (additive only)

`SalesCallAttempt`: `subDisposition`, `subDispositionDetail`, `amdResult`,
`amdAt`, `amdMs`, `callbackScope`, `callbackRepId`, `callbackNotifiedAt`,
`callbackReassignedAt`. New: `SalesDispositionAudit`, `SalesRecordingMark`.
Applied with `prisma db execute` from the ADD/CREATE half of the migrate diff;
the diff's DROPs (SalesRep.sessionEndedBy/sessionIssuedAt,
SalesRepActivity.setByAdminId — other agents' live columns) were not applied.

## Rep-facing copy

Every new key is in all nine catalogue languages (EN/FR/ES written by hand;
uk/pa/tl/de/zh/it drafted and marked review-pending like the rest of the
portal). Custom sub-reason labels travel with the setting (en/fr/es fields on
the editor) because a superadmin's entry cannot be in the catalogue.
