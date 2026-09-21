# Sales-floor supervision, hold, and calls outside the queue

Landed 2026-09-21. Everything here is behind one platform setting that is
**off by default**, because it costs money; the owner's flip is the approval.

## What it is

On `/platform/sales/floor`, a superadmin can act on a rep's live call:

| Button   | OMniLeads name   | What happens                                                        | Who hears the supervisor |
|----------|------------------|---------------------------------------------------------------------|--------------------------|
| Listen   | CHANSPY          | joins the call muted, coaching the rep's leg                        | nobody                   |
| Whisper  | CHANSPYWISHPER   | joins unmuted, coaching the rep's leg                               | the rep only             |
| Barge    | CHANCONFER       | joins as a third party                                              | rep and prospect         |
| Take call| CHANTAKECALL     | joins as a third party, then the rep's leg is hung up               | the prospect             |

A live bar at the top of the board — "Listening to Umar · 0:42 · Whisper ·
Barge · Take the call · Leave" — switches modes without leaving. One
supervisor per call at a time.

A rep on a supervised-mode call gets a **Hold** button on the call card: the
prospect hears music (Twilio's own, or an https URL the owner sets), the
rep's microphone is off the call, a timer shows the hold length, Resume
returns. The floor board row says "On hold 0:42" while held.

Two dials that are not prospect reach, on the rep's Team page
(`app/components/sales/PeopleCard.js`):

- **Call a colleague** — browser to browser (`<Dial><Client>`), no PSTN leg,
  no carrier cost beyond two client legs. Kind `internal`. Per-rep
  privilege `canCallColleagues`, default ON.
- **Call a number outside the queue** — a typed number with no record,
  plus the state/province it rings in. Kind `off_campaign`. Per-rep
  privilege `canCallOffCampaign`, default OFF. Suppression list, our own
  numbers, the calling window for the named jurisdiction and the 24-hour
  cap all still bind. Recorded, written up, never counted as reach.

Both privileges are set per rep on `/platform/sales/reps` and audited.

## The model

OMniLeads (LGPL; read for design only, no code copied):

- `ominicontacto_app/services/asterisk/supervisor_activity.py` 34–35: the
  extension list; 78–100: `ejecutar_accion_sobre_agente` originates a call
  from the supervisor's own SIP phone into `oml-sup-actions` with the
  agent's id as a channel variable. The supervisor is a participant on
  their own device; the action is server-side.
- `api_app/views/supervisor.py` 275–305: one POST with an action word,
  refused 403 without a supervisor profile.
- `supervision_app/static/supervision_app/JS/supervision.js` 210–235: the
  shipped board wires CHANSPY and CHANSPYWISHPER buttons per agent
  (CHANCONFER / CHANTAKECALL exist in the extension list and dialplan but
  have no button there). FieldQuo ships all four.
- `phoneJsController.js` 200–218 (hold button, timer, `eventHold` on both
  edges), 1368–1379 (`disableOnHold`: no button without the privilege),
  `models.py` Grupo `on_hold` / `call_off_camp` / `call_another_agent`
  (~291–297), `api_app/views/agente.py` ApiEventoHold 610–640 (HOLD/UNHOLD
  rows with a time), `reportes_app/models.py` 408 EVENTOS_HOLD.

## The Twilio mechanism, and why (a)

Twilio coaches only a conference participant: `Coaching=true` +
`CallSidToCoach=<rep leg>`. Outbound sales calls were `<Dial><Number>`
bridges. Two options:

- **(a) every outbound prospect call runs in a per-attempt conference from
  the first ring** — chosen.
- (b) redirect both legs into a conference when a supervisor presses.

(b) was rejected because redirecting the prospect's leg ends the `<Dial>`
and with it the dual-channel recording; the conference then starts a
second file which `recordCallRecording` lets replace the first — the first
half of the transcript is lost. It is also audible (a 1–2 s gap), and hold
needs the conference anyway. Full argument: header of
`lib/sales/calls/supervision.js`.

In (a):

- The bridge (`app/api/rep-dial/bridge`) reads the setting in the request.
  On: the prospect is dialled INTO room `fq_call_<attemptId>` by REST as a
  participant (`earlyMedia`, `endConferenceOnExit: true`, `record: true`,
  `recordingChannels: dual`, status callback = the same `/api/rep-dial/status`,
  recording callback = the same `/api/rep-dial/recording`), then the rep's
  TwiML is `<Dial><Conference>` with `endConferenceOnExit: false` (take
  needs the room to outlive the rep) and a status callback to
  `/api/rep-dial/conference`.
- A supervisor's browser holds a Twilio Device minted by
  `/api/platform/sales/supervision/token` (identity `supervisor:<adminId>`,
  dial-out only). `POST /api/platform/sales/supervision {start}` writes
  `supervisedBy`/`supervisionKind` on the row under a conditional update
  (the one-supervisor lock), THEN the browser connects with only the
  attempt id; the bridge reads the mode off the row and renders
  `<Conference coach=<repCallSid> muted=…>`. Mode changes are REST
  participant updates; take = mark the row, unmute, unhold if held, hang
  the rep up.
- `/api/rep-dial/conference` closes an open hold and supervision on
  `conference-end`, ends the room when the rep leaves an untaken call, and
  closes the supervisor's stint when they leave. `/api/rep-dial/status`
  ends the room on a terminal prospect status (a no-answer never joined,
  so nothing else would).
- Transfers keep working: redirecting the prospect out of the attempt room
  ends it (endConferenceOnExit), the rep's `<Dial>` action is the same
  `?stage=rep-leg`, and they follow into the transfer's room as before.

### Recording

The prospect's **participant** is recorded dual from answer. Twilio's rule
for a conference participant's dual file: channel 1 = that participant,
channel 2 = everything else mixed. So channel 1 is the contractor and
channel 2 is what they heard — the rep, a barging supervisor, and hold
music. `channelSpeakers({ conference: true })` reads it that way; the
transcriber blanks the hold seconds on the rep track from the
HOLD/UNHOLD rows (`silenceRanges`, `holdRangesFor`) before the model
hears them. A whisper is never in the file (the rep's leg is not the one
recorded). Recording price is unchanged ($0.0025/min, one file per call).

### Cost delta (US Voice pricing page, read 2026-09-21)

| Leg                          | per minute |
|------------------------------|-----------:|
| browser (client) leg         | $0.0040    |
| outbound US PSTN leg         | $0.0140    |
| conference, per participant  | $0.0018    |
| recording                    | $0.0025    |

A two-party call: **$0.018/min as a bridge → $0.0216/min in a conference
(+$0.0036/min, +20%)**. A supervisor on the line: **+$0.0058/min** (their
client leg + their participant). Off: byte-for-byte the old bridge, no
delta. That is why `sales.supervision.enabled` defaults to false.

## Settings (`/platform/sales/windows`, PlatformSetting `sales.supervision`)

| key               | default | meaning                                                            |
|-------------------|---------|--------------------------------------------------------------------|
| `enabled`         | false   | conference mode: supervision + hold on every new outbound call     |
| `tellRepOnListen` | true    | the rep's card says when somebody is listening or whispering       |
| `holdMusicUrl`    | null    | https URL for hold; null = Twilio's own music                      |

Barge and take are always shown to the rep. The prospect is never told
anything by this code.

## Data

Additive columns on `SalesCallAttempt`: `kind`, `internalToRepId`,
`conferenceName`, `conferenceSid`, `heldAt`, `supervisedBy`,
`supervisionKind`, `supervisionSeconds`, `supervisorCallSid`,
`supervisedAt` (`holdSeconds` already existed and is now written). On
`SalesRep`: `canCallColleagues`, `canCallOffCampaign`. New table
`SalesCallEvent` (HOLD / UNHOLD / LISTEN / WHISPER / BARGE / TAKE /
SUPERVISION_END, with who, when and seconds on the closing edge). Every
supervisor action is also a `PlatformAuditLog` row.

Reporting: `prospectDialsOnly()` / `onlyProspectDials()` keep internal and
off-campaign rows out of every count that already kept test dials out;
the 24-hour cap keeps counting an off-campaign dial to a real number. The
floor board shows hold time and supervised calls per rep; the performance
tables (platform and agency) gain a "Minutes on hold" column with held /
supervised counts.

## What is not covered

- **Inbound calls** are not in a conference and cannot be supervised or
  held; the board says so on the row.
- Calls already in progress when the setting flips keep the mode they
  started in.
- The Twilio verification on 2026-09-21 proved: a conference is created by
  friendly name from `participants.create`; a coaching participant is
  refused ("Conference is not bridged") until a participant is in; hold /
  participant lookups by name 404 once the room is over (hence
  `conferenceSid` on the row). It could NOT exercise a live coached call:
  the only FieldQuo number without a rep-ringing webhook fails outright
  when called, every other FieldQuo number rings live reps, and a second
  attempt with two Voice SDK clients in the agent's browser pane
  (`client:fq_test_prospect` / `client:fq_test_coach`, both registered)
  answered `busy` / `no-answer` because that pane denies the microphone
  and reloads on the prompt. Owner's one-minute test: switch the setting
  on, dial your own mobile from a test account, press Listen on the floor
  row, then Whisper, Barge, Hold from the rep card, Leave; check
  `SalesCallEvent` and the recording's `channels = 2`.

Checks: `npm run check:sales-supervision` (139 assertions, mutation-tested
on the take ordering), plus the updated `check:sales-recording` and
`check:sales-test-line`.
