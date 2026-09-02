# Audit — telephony that already exists

Read-only survey, 2026-09-01. Nothing was changed. The question is narrow:
**what does FieldQuo already have that the Sales Intelligence / AI Sales Copilot
telephony sections would otherwise rebuild, and what is genuinely missing?**

Scope note: FieldQuo's sales reps are **not tenants**. That single fact decides
most of the answers below, because almost every voice module in this repo is
keyed on `companyId`. Where a seam already exists for a non-tenant caller
(`PlatformVoiceCall`, `PlatformVoiceAgent`, `PlatformSmsNumber`) it is called out
by name; where none exists, that is stated rather than assumed away.

---

## Executive summary

| Capability the spec asks for | State today | Where |
|---|---|---|
| Buy a phone number by area code | **Exists, production** | `lib/voice/numberSearch.js`, `lib/voice/retell.js:356` |
| Search real, buyable local inventory by area code / city / region | **Exists** | `lib/voice/numberSearch.js:166` |
| Area-code parsing, N11 rejection, honest "we don't know" | **Exists, hardened** | `lib/voice/numberSearch.js:61-99` |
| Attach / detach a number to an agent at the provider | **Exists** | `lib/voice/retell.js:607` |
| Release a number | **Exists** | `lib/voice/retell.js:451`, `lib/voice/numberRelease.js` |
| Place an **outbound** call | **Exists — AI agent only** | `lib/voice/retell.js:862`, `lib/voice/outboundCall.js:264` |
| Call records, transcript, summary, recording | **Exists, two tables** | `VoiceCall`, `PlatformVoiceCall` |
| Recording disclosure in the agent script | **Exists, checked** | `scripts/check-recording-disclosure.mjs` |
| Contact-consent + opt-out ledger | **Exists** | `CallConsent`, `lib/voice/outbound.js` |
| Calling-hours window, re-checked at dial time | **Exists** | `lib/voice/outbound.js:51`, `lib/voice/outboundCall.js:137` |
| Per-call cost metering (revenue side) | **Exists, tenant-only** | `lib/voice/credits.js:743` |
| Per-call **provider cost** capture | **Exists, tenant-only** | `VoiceCall.providerCostCents`, `lib/voice/providerCost.js` |
| Non-tenant call records (FieldQuo's own line) | **Exists** | `PlatformVoiceCall`, `lib/platform/salesCall.js` |
| Cold transfer to a human | **Exists** | `lib/platform/salesAgent.js:105` |
| **Browser-based VoIP calling by a human rep** | **Absent** | — |
| **Caller-ID selection by prospect geography** | **Absent** | — |
| **A pool of numbers not owned by a tenant** | **Absent** | — |
| **Inbound callback routed to a specific rep** | **Absent** | — |
| **Live (streaming) speech-to-text** | **Absent** | — |
| **Cost metering for a non-tenant caller** | **Absent** | — |

Two vendors are already wired and paid for: **Retell** (voice, AI agents,
numbers) and **Twilio** (SMS, number inventory search, number purchase for
FieldQuo's own and crew lines). Neither is currently doing human-to-human
telephony of any kind.

---

## 1. Retell

### 1.1 The boundary

`lib/voice/retell.js` is the only file in the repo that talks to Retell, by the
same rule `lib/ai/provider.js` follows. Its header says the point is that
swapping to Vapi or raw Twilio later is one file (`lib/voice/retell.js:3-7`).

- Configured by `RETELL_API_KEY` alone; `voiceConfigured()` at
  `lib/voice/retell.js:21` is how every screen distinguishes "not set up" from
  "broken".
- One private `call()` helper, 15s abort, redaction of anything key-shaped
  before logging (`lib/voice/retell.js:43`, `:60`).
- Every error is a `RetellError` carrying `status` — callers branch on the
  status rather than inspecting a `Response` (`lib/voice/retell.js:25-33`).

### 1.2 What a "number" is

A Retell phone number, bought through `/create-phone-number`
(`lib/voice/retell.js:356`). Facts that matter for a sales pool:

- **`area_code` is a hint and is US-only.** Documented and quoted in
  `lib/voice/numberSearch.js:7-18`. That is exactly why the Twilio search path
  exists — see §3.
- A **named** `phone_number` supersedes the area-code hint, with
  `number_provider: "twilio"` sent explicitly (`lib/voice/retell.js:387-396`).
  So "pick this exact number in this exact area code" is already a solved
  problem.
- `country_code` is always sent (default `"CA"`), because an absent value
  defaults to US and silently invalidates a Quebec area code
  (`lib/voice/retell.js:327-334`).
- `allowed_outbound_country_list` is pinned to `["US", "CA"]`
  (`lib/voice/retell.js:354`). The comment is a cost story: an empty list means
  *all countries*, and Retell's international rates run to $0.80/min against the
  35¢/min this product charges. **Relevant to a Ukraine-based rep only if the
  rep's own leg were a dialed PSTN number** — a browser leg is not a dialed
  country and is not clamped by this. Dialing *into* US/CA is already allowed.
- Toll-free is a distinct product with its own rental and per-minute surcharge
  (`lib/voice/credits.js:142-176`); `toll_free` is always sent explicitly
  because leaving it implicit once caused customers to be billed toll-free
  rates for local numbers (`lib/voice/retell.js:315-322`).

Other number operations, all present: `importNumber` (SIP-attach a number the
company keeps at their own carrier — **works, wired to nothing**,
`lib/voice/retell.js:430`), `releaseNumber` (`:451`), `getNumber` (`:467`),
`listNumbers` / `listAllNumbers` with real pagination (`:481`, `:503`).

### 1.3 What an "agent" is

Two objects at the provider, one concept here:

- a **Retell LLM** owning `general_prompt`, `begin_message`, `general_tools`
  (`lib/voice/retell.js:648`, `:652`);
- an **agent** owning voice, language and webhook, pointing at the LLM by id
  (`lib/voice/retell.js:661`, `:694`).

Numbers route to agents through a **weighted list**, not the deprecated scalar
fields — `agentRouting()` at `lib/voice/retell.js:166`. Retell hard-400s the old
`inbound_agent_id` since 2026-03-31. `agentId: null` produces an empty list,
which is how the "Answer my calls" switch turns the phone off at the provider
(`lib/voice/retell.js:607`, with a two-shape `[]`-then-`null` fallback because
the detach shape is genuinely undocumented).

`agentTuning.js` deliberately sends **no `custom_stt_config`**
(`lib/voice/agentTuning.js:302-311`) — Retell picks the ASR vendor per language.
That is a decision, recorded, and it means there is no ASR vendor account, key or
integration in this codebase to reuse for a live-transcription feature.

### 1.4 The demo substitution seam

`lib/voice/demoLine.js` + the simulated branch inside `lib/voice/retell.js:229-300`.

The design is worth copying rather than re-inventing: **the seam is the E.164
itself.** NANP reserves `NPA-555-0100`–`0199` in every area code for fiction;
`SIMULATED_E164_RE` (`lib/voice/retell.js:240`) recognises that shape, and
`buyNumber`, `attachAgent`, `getNumber` and `releaseNumber` each short-circuit to
an in-process fake. No flag is threaded through `provision.js`,
`syncNumberAttachment`, `numberRelease.js`, `diagnose.js` or `readiness.js` — they
only ever see an E.164, so "runs exactly like a real number" holds *by
construction* (`lib/voice/retell.js:245-258`).

Deliberately **not** simulated: `createAgent` / `updateAgent` /
`createRetellLlm` / `updateRetellLlm`. A demo's agent is a real Retell agent,
because a bare agent that is never attached to a number costs nothing
(`lib/voice/retell.js:260-268`).

The row is written with `simulated: true, monthlyCents: 0`
(`lib/voice/demoLine.js:119-131`), which two things read by name: the rent cron
(`rentDecision`, `lib/voice/spendGate.js:702`) and `/platform/voice-numbers`,
which excludes them so they are not reported as a billing leak
(`app/api/platform/voice-numbers/route.js:67`).

**A sales-side dry-run mode should reuse this exact seam**, not a `demo: true`
boolean threaded through new code.

### 1.5 Could Retell serve outbound rep calling?

Partly, and not in the shape the spec describes.

- `createPhoneCall({ fromE164, toE164, agentId, dynamicVariables, metadata })`
  at `lib/voice/retell.js:862` places a real outbound PSTN call. `fromE164` is
  both the caller ID and the key the webhook resolves the tenant from
  (`app/api/voice/webhook/route.js:87-90`).
- But **both legs are the provider's**: Retell dials the customer and its own
  agent talks. There is no leg for a human. Nothing in this codebase creates a
  Retell **web call** or issues a browser access token — `create-web-call`,
  `web_call`, `access_token` (in a Retell sense) appear nowhere under `app/` or
  `lib/`.
- `transfer_call` is used, but only as an agent *tool* that cold-transfers a
  caller to a fixed `FIELDQUO_SALES_TRANSFER_TO` number
  (`lib/platform/salesAgent.js:105-120`). It is a Retell built-in, bridged by
  the provider, with no endpoint of ours in the path.

So: Retell today is an **inbound AI receptionist plus outbound AI agent**. It
carries no human audio. Whether Retell's web-call product could carry a rep's
browser leg is a vendor question this audit cannot settle from the codebase —
see "What I could not determine".

---

## 2. Twilio

### 2.1 What is wired

`lib/sms/twilioClient.js` is the single credential assembly point. Two supported
styles — API key (`TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` + an explicit
`accountSid`) or account SID + auth token (`lib/sms/twilioClient.js:21-30`). The
REST client itself is exported as `twilioRest` precisely so nobody constructs a
second one and loses that subtlety (`:37`).

`twilioConfigured()` (`:48`) deliberately does **not** cover webhook signature
verification, which needs the auth token specifically — a deployment can send SMS
and manage numbers while being unable to accept a single inbound one.

Capabilities in use today:

| Twilio API | Used for | Where |
|---|---|---|
| `messages.create` | outbound SMS | `lib/sms/twilioClient.js:95` |
| `availablePhoneNumbers(iso).local.list` | number inventory search | `lib/voice/numberSearch.js:204`, `:247` |
| `incomingPhoneNumbers.create` | buying FieldQuo's own and crew-line numbers | `lib/crew/platformNumber.js:75`, `lib/crew/line.js:492` |
| `incomingPhoneNumbers.list` / `.update` | reading and repointing `smsUrl` | `lib/crew/line.js:83`, `:137`, `:584` |
| `incomingPhoneNumbers(sid).remove()` | release | `lib/crew/platformNumber.js:125` |
| inbound webhooks (TwiML) | crew inbox, STOP/START keywords | `app/api/crew/inbound/route.js`, `app/api/sms/inbound/route.js` |

### 2.2 Is there any voice calling on Twilio today?

**No.** Evidence:

- `package.json` has `twilio ^6.0.2` and **no** `@twilio/voice-sdk`, no
  `retell-client-js-sdk`, no `retell-sdk`.
- The only TwiML in the repo is an **empty document** returned by the two SMS
  webhooks (`app/api/crew/inbound/route.js:47`, `app/api/sms/inbound/route.js:79`).
  There is no `VoiceResponse`, no `<Dial>`, no `calls.create`.
- No `jwt.AccessToken`, no `VoiceGrant`, no TwiML App.
- No `getUserMedia`, no `RTCPeerConnection`, no `MediaRecorder` anywhere under
  `app/` or `lib/`.

Twilio's role here is **SMS plus a number catalogue**. The `voiceEnabled: true`
filter in `searchLocalNumbers` (`lib/voice/numberSearch.js:185`) exists because
the number is then bought *by Retell*, not because FieldQuo dials on Twilio.

Note the cost comment at `lib/voice/credits.js:117-141`: buying on FieldQuo's own
Twilio account and SIP-trunking into Retell (`importNumber`) is ~$0.85/number/month
cheaper and is explicitly described as "a product decision, not a refactor,
and nobody has made it". A sales number **pool** is exactly the volume case that
comment anticipates.

---

## 3. Number inventory and area codes

### 3.1 The three tables

| Model | Owner | Provider | Purpose | Schema |
|---|---|---|---|---|
| `VoicePhoneNumber` | a **Company** (required FK, cascade) | Retell | the tenant's receptionist line | `prisma/schema.prisma:6446` |
| `CrewInboxNumber` | a **Company** (`@unique companyId`) | Twilio | the crew's texting line | `prisma/schema.prisma:7246` |
| `PlatformSmsNumber` | **FieldQuo itself** — no company | Twilio | `system` outbound-From, `shared_test` loaner | `prisma/schema.prisma:125` |

`PlatformSmsNumber` is the only existing model for "a number FieldQuo owns that
belongs to no tenant". It has `purpose`, `active`, `releasedAt`,
`monthlyCostCents` and a `providerId` — and its comments already anticipate
splitting purposes into separate rows rather than flags
(`prisma/schema.prisma:139-146`). It is **SMS-only in practice**: bought with
`smsUrl` set and nothing else (`lib/crew/platformNumber.js:75-80`).

`VoicePhoneNumber` carries the interesting operational columns a sales pool would
want — `numberType`, `monthlyCents`, `rentPaidThroughAt`, `rentGraceUntilAt`,
`rentWarnedAt`, `providerId`, `simulated` — but every one of them is in service of
*billing a tenant*, and `companyId` is required.

### 3.2 Area-code handling — genuinely good, genuinely reusable

`lib/voice/numberSearch.js` is pure except for two Twilio reads, and it is the
closest thing in the repo to what the spec's "pools of local numbers by area
code" needs.

- `areaCodeOf(phone)` (`:61`) — strict. `+1` + 10 digits only; a 7-digit local
  string returns `null` rather than a confident wrong answer. N11 service codes
  (211…911) are rejected as parse errors, not locations.
- `isUsableAreaCode(input)` (`:76`) — three digits, first digit 2–9, not N11.
- `defaultAreaCode(company)` (`:95`) — returns `{ areaCode, from }` and **only**
  ever answers from `company.phone`. The header spells out the refusal:
  "It will not invent an area code… Quebec alone runs
  418/438/450/514/579/581/819/873, a province cannot pick between them, and a
  wrong default here is not a cosmetic error — it is a number that gets BOUGHT
  and printed" (`:37-46`). There is **no city→area-code table** and the file
  argues there should not be one.
- `searchLocalNumbers({ country, areaCode, locality, region, limit })` (`:166`) —
  area code wins outright over city/province (an AND would hide 873 numbers in a
  dry 819 city). Filters `voiceEnabled`, `smsEnabled`,
  `excludeAllAddressRequired`, and drops beta numbers, each for a stated reason
  (`:135-154`). Returns `{ numbers, searched, configured }` — three distinguishable
  states, so "we looked and found nothing" (416 and 514 local inventory is
  routinely exhausted) never renders as an error.
- `isStillAvailable(e164)` (`:241`) — returns `true` / `false` / **`null`**, where
  `null` is "Twilio couldn't answer". Collapsing that into `false` would block
  every purchase during a blip; into `true` would sell a number already gone.

### 3.3 How close is this to "a pool by area code with assignment"?

**The discovery half is done. The ownership half does not exist.**

What is there: search by area code, exact-availability re-check, purchase by named
E.164, attach/detach, release, provider-vs-rows reconciliation
(`lib/voice/numberAudit.js`).

What is not:

- Every voice number row **must** belong to a `Company`
  (`prisma/schema.prisma:6448-6449`, required relation, `onDelete: Cascade`).
- A company may hold **exactly one** — `heldNumber()` (`lib/voice/numbers.js:217`)
  blocks a second purchase, and `/platform/voice-numbers` flags multi-holders as a
  defect (`app/api/platform/voice-numbers/route.js:74-96`). A *pool* is
  structurally the opposite of that invariant.
- `e164` is `@unique` globally, which is load-bearing for webhook resolution — one
  number resolves to exactly one holder. A pool with rotating assignment must keep
  that property, not relax it.
- There is no `assignedToRepId`, no `lastUsedAt`, no rotation, no per-rep
  reservation anywhere.

---

## 4. Call records, transcripts, disclosure

### 4.1 Two tables, deliberately

**`VoiceCall`** (`prisma/schema.prisma:6653`) — tenant calls. Required
`companyId`. Carries `providerCallId @unique`, `direction`, `fromE164`, `toE164`,
`startedAt` / `endedAt` / `durationSec`, `transcript Json`, `summary`,
`recordingUrl`, `providerCostCents Decimal(12,4)`, `disposition`, plus the
back-office workflow columns (`needsReview`, `archivedAt`, `recoveredAt`,
`leadRecoveredAt`, `quoteDraft`, `quoteDraftSkipped`).

**`PlatformVoiceCall`** (`prisma/schema.prisma:256`) — **FieldQuo's own sales
line**. This is the precedent that matters most for this project, and its schema
comment is the argument in full: putting these in `VoiceCall` would need a
`Company` row for FieldQuo, and "that row would then be a tenant everywhere a
tenant is counted: the company list, the platform dashboard's active-companies
figure, MRR, the feature-override picker, the voice credit ledger, the rent cron,
every `db.company.findMany` in the console. One table saved, a dozen numbers
quietly wrong" (`prisma/schema.prisma:227-236`).

`PlatformVoiceCall` has: `providerCallId @unique`, `providerAgentId` (a plain
string — there is no `VoiceAgent` row for FieldQuo's agent, that table is keyed by
`companyId`), `direction`, `fromE164`, `toE164`, timing, `transcript`, `summary`,
`recordingUrl`, `disposition`. It has **no** `providerCostCents` and **no** ledger
link — "Deliberately no credit ledger and no charge"
(`prisma/schema.prisma:243-249`).

### 4.2 Lifecycle

One public webhook, `app/api/voice/webhook/route.js`:

1. Signature verified **before** the body is parsed for anything, and rejected
   outright when no key is set (`:53-67`). A rejection is recorded, rate-limited,
   via `recordRejectedDelivery` — because a broken verifier once looked exactly
   like a phone nobody rang (`lib/voice/webhookSignature.js` has the autopsy).
2. "Ours" depends on direction: inbound → `to_number`, outbound → `from_number`
   (`:87-90`).
3. Tenant lookup by that E.164 (`:91-95`).
4. **If no tenant and `isSalesNumber(ourNumber)`** → `recordSalesCall`, writing
   `PlatformVoiceCall` (`:108-121`). Checked *after* the tenant lookup on purpose:
   a collision costs FieldQuo the call, never a contractor theirs.
5. Otherwise `recordError("Call to an unknown number")` and a 200 (`:124-136`).
6. `call_started` → upsert with `update: {}` so a retry cannot reset a row.
   `call_ended` / `call_analyzed` → upsert with duration, disposition, transcript,
   summary, recordingUrl, `providerCostPatch(call)`.

The webhook is **not** the only path. `lib/voice/reconcileCalls.js` pulls calls
back from `/v3/list-calls` (`lib/voice/retell.js:759`) on a cron, because "a
webhook is a fast path, never the only path" (`lib/voice/retell.js:712-720`).
`VoiceCall.recoveredAt` records which rows were rescued.

Transcript normalisation lives in `lib/voice/transcript.js`. `transcriptFrom()`
prefers `transcript_with_tool_calls` over `transcript_object` — storing the latter
discarded every tool call, which is how "a booking that never happened became
impossible to diagnose" (`lib/voice/transcript.js:32-47`). `fenceTranscript`
treats caller speech as **data, never instructions**.

> **Existing divergence, worth knowing before building on it:**
> `recordSalesCall` writes `call.transcript_object || call.transcript`
> (`lib/platform/salesCall.js:198`, `:209`) — it does **not** use `transcriptFrom()`. So
> FieldQuo's own sales calls lose tool-call weaving that tenant calls keep. And
> `reconcileCalls.js` builds its number map from `voicePhoneNumber` alone
> (`lib/voice/reconcileCalls.js:217`), so **a lost webhook for a sales-line call is
> never recovered.** Both are pre-existing, both are in the exact code a sales
> telephony build would extend.

### 4.3 Recording — access and disclosure

**Access.** `lib/voice/recording.js` opens with the important fact:
`VoiceCall.recordingUrl` is whatever Retell returned, and **nothing in this
codebase signs it, proxies it, scopes it or expires it** — anyone holding the
string can play a homeowner describing their kitchen and address, with no session
(`:5-16`). So:

- the URL is never rendered client-facing; everything links
  `callRecordingHref(id)` (`:37`), a FieldQuo path;
- `/api/voice/calls/[id]/recording` re-derives the company from the session and
  streams the audio server-side;
- the permission dial is `CALL_AUDIO_LEVEL = ["clientsProperties", "full_view"]`
  (`:68`) — deliberately *not* `user:manage`, because hearing a hundred callers is
  the client book arriving by another door;
- `isFetchableRecording` refuses anything not `https:` (`:79`).

**Disclosure — two different consents, kept apart on purpose.**

1. **Recording disclosure**, enforced by `npm run check:recording-disclosure`
   (`scripts/check-recording-disclosure.mjs`). It *builds* the real prompt via
   `buildAgentPrompt` and asserts the caller is told, as its own numbered rule
   `4b.`, in every shipped language, said "once, early", "never repeat it", "do
   not read a legal notice", with an objection path ("cannot turn it off", offer a
   person or a message). Its header records that FieldQuo's own sales line
   disclosed recording all along (`lib/platform/salesPrompt.js`) while the tenant
   receptionist did not — "the sentence had been written, and put on the wrong
   phone" (`:13-16`). It explicitly does **not** claim consent is settled: "Canadian
   requirements vary by province, and the contractor — not FieldQuo — is the party
   recording. This asserts the floor: the caller is told" (`:26-31`).
2. **Contact consent**, `CallConsent` (`prisma/schema.prisma:7126`) — permission to
   be *called*, for outbound. Sources are evidenced requests, never inferences:
   `self_quote`, `booking`, `quote_approved`, `job_completed`, `manual` (needs a
   note). `disclosure` stores **the exact wording shown**, not a reference, because
   the copy will change and the defence has to be what the person actually saw
   (`lib/voice/disclosure.js:14-21`). `optedOutAt` is checked **before** any consent
   row and is never deleted.

`lib/voice/outbound.js` holds `CALL_WINDOW = { startHour: 9, endHour: 20 }` (`:51`),
`withinCallingHours` (`:54`), `liveConsent` (`:133`), `consentVerdict` (`:158`) and
`mayCall` (`:206`). `lib/voice/outboundCall.js:137` re-checks **every** gate at dial
time rather than enqueue time, and distinguishes `retryLater` from `terminal` so an
out-of-hours call is requeued and an opt-out is not.

`check-recording-disclosure.mjs` also asserts the receptionist prompt does not
reach for the outbound-contact model to answer a recording question — conflating
the two is "how a product ends up believing it has permission it never asked
for" (`:29-31`). **A sales cold-calling build must not conflate them either.**

---

## 5. Cost metering

### 5.1 The ledger

`VoiceCreditEntry` (`prisma/schema.prisma:6784`) — one table for top-ups and
spend, so the balance is an auditable **sum**, not a drifting counter. Required
`companyId`.

- `pool` — `"voice"` or `"ai"`. Two wallets because Retell bills per minute with a
  monthly rental floor and OpenAI bills per token with nothing recurring; mixing
  them "puts a recurring floor underneath a usage-only product"
  (`prisma/schema.prisma:6801-6826`).
- **`pool` is never set by a caller.** `writeEntry()` derives it from `kind` via
  `poolForKind()` (`lib/voice/credits.js:720-742`, `:600`). "An argument can be
  forgotten, and a forgotten argument here means an image quietly billed to the
  phone balance."
- `ref` + `@@unique([companyId, ref])` is the idempotency key. `P2002` on write is
  treated as **success** and the winning row returned.

### 5.2 The arithmetic

- `CENTS_PER_MINUTE = rateFromEnv(process.env.VOICE_CENTS_PER_MINUTE, 35)`
  (`lib/voice/credits.js:79`). Read through a guard: a typo would make the rate
  `NaN`, which does not fail loudly — it bills **zero** while the screens keep
  saying 35¢.
- `NUMBER_TYPES` (`:142`) — `local` $4/mo + 0¢ surcharge; `toll_free` $9/mo + 5¢/min,
  because on toll-free the called party pays the carrier leg.
- `ratePerMinute(numberType)` (`:161`), `monthlyCentsFor()` (`:167`).
- `costForSeconds(seconds, numberType)` (`:525`) — ceil to the whole minute, floor
  of one minute, and **non-finite input is a refusal, not a big number**: `1e400`
  in a JSON body used to carry `Infinity` straight into an Int column.
- `chargeCall({ companyId, callId, seconds, numberType })` (`:743`) — idempotent on
  both `callId` (legacy rows) and `ref: call:<id>`. The **rate** is recorded in the
  note, not just the total, because "3 min" alone cannot be checked against a price
  that may have changed.
- `canTakeCall(companyId, numberType)` (`:636`) — the gate, called directly by
  `provision.js` and `outboundCall.js`.

### 5.3 The gate

`lib/voice/spendGate.js` is the single list of everything that spends money on a
tenant's behalf: `SPEND_KINDS` (`:101`) covers `number_setup`, `number_rent`,
`call`, `crew_text`, `crew_line_setup`, `crew_line_rent`, `image_generation`,
`image_vision`. `FEATURE_FOR_KIND` (`:181`) maps a kind to the platform feature
that must be enabled. `checkSpend` (`:278`) asks availability **before**
affordability — "telling someone to add money to solve a problem money can't solve
is the worst kind of dead control". `reserveSpend` (`:339`) takes the money inside
the caller's transaction so two overlapping purchases are a serialisation conflict
Postgres can see.

`billNumberRent` (`:869`) / `rentDecision` (`:702`) run the 30-day rental with a
7-day grace, warnings, and a release at the end.

### 5.4 The cost side

`VoiceCall.providerCostCents` stores Retell's own `call_cost.combined_cost` in
`Decimal(12,4)`, and is **left null when the provider didn't give one** — never
padded with the `RETELL_COST_CENTS_PER_MINUTE` estimate, because that would make a
guess indistinguishable from a reading (`prisma/schema.prisma:6680-6692`,
`lib/voice/providerCost.js`).

`lib/voice/pool.js` then separates two questions that must not be conflated
(`:88`, `:149`):

- `derivedSpend()` — minutes × a **typed constant**. "roughly how fast is the
  shared pool draining."
- `measuredMargin()` — billed (from the **ledger**, not recomputed) against what
  Retell actually charged. "are we actually making money."

`npm run check:voice-economics` executes real production figures: 17.4 billed
minutes across 8 calls, $7.70 charged against $3.107 billed by Retell — **≈60%
gross margin** (`scripts/check-voice-economics.mjs:29-39`). `npm run
check:voice-metering` executes the *real* ledger against an injected in-memory
Prisma, asserting: billed exactly once across webhook and reconciler in either
order; an unestablished duration is **unbilled and flagged**, never zero; hostile
input never yields a negative, an `Infinity` or a silent zero; an unreachable
provider charges nobody; a balance crossing zero **detaches at the provider**
(`scripts/check-voice-metering.mjs:17-31`).

### 5.5 Could this ledger carry sales-side telephony/AI cost?

**The pattern, yes. The table, no — not without a decision.**

Everything that makes it good is reusable: one append-only table, an idempotency
`ref`, pool derived from `kind` and never passed, absence recorded as unknown,
executed checks rather than asserted copies.

What blocks direct reuse:

- `VoiceCreditEntry.companyId` is a **required FK to `Company`**
  (`prisma/schema.prisma:6786-6787`). FieldQuo has no `Company` row and — per the
  `PlatformVoiceCall` argument — must not get one.
- The whole module is *prepaid contractor credit*. FieldQuo's own sales spend is
  not prepaid and is not credit; it is cost. Charging it against a balance would
  be modelling it as revenue.
- `@@unique([companyId, ref])` means the idempotency guarantee itself is
  company-scoped.
- AI metering has the same shape: `recordAiUsage` returns `null` when there is no
  `companyId` (`lib/ai/usage.js:220`), and `checkAiQuota(companyId)` /
  `getAiCap(companyId)` (`:155`, `:118`) read `Company`. **There is no metering path
  for an AI call made on behalf of a non-tenant today.**

The honest options are (a) a `SalesCallCost` / `PlatformVoiceCost` table mirroring
the ledger's discipline without the `Company` FK, or (b) making `companyId`
nullable — which is a change to the one table where a nullable tenant key could
let a cost land nowhere. This is a product/schema decision, not a refactor.

---

## 6. What is genuinely missing for outbound browser calling

| Gap | Is there a seam? | Notes |
|---|---|---|
| **WebRTC / browser SDK** | **No.** New. | No `@twilio/voice-sdk`, no Retell client SDK, no `getUserMedia`, no `RTCPeerConnection`, no TwiML App, no `AccessToken`/`VoiceGrant` minting route. This is a new dependency, a new token endpoint, a new client component, and a new browser-permissions surface. Nothing in `/app` currently asks for a microphone. |
| **Outbound call initiation by a human** | **Partial seam.** | `createPhoneCall` (`lib/voice/retell.js:862`) and `placeQueuedCall` (`lib/voice/outboundCall.js:137`) place *agent* calls. The gate ordering there — feature availability → contractor switch → consent + hours → caller resolution → credit, all re-checked at dial time — is the right skeleton and should be copied. But every gate reads `companyId`, and the second leg is an AI agent, not a person. |
| **Caller-ID selection by prospect geography** | **Half a seam.** | `areaCodeOf()` (`lib/voice/numberSearch.js:61`) already extracts an area code from a prospect's number with the right strictness, and `defaultAreaCode()` already refuses to invent one. What is missing is entirely the other half: a pool to select *from*, and a rule for what to do when the prospect's area code has no number in the pool. Note `defaultAreaCode`'s own warning — there is no city→area-code table and the file argues there should not be one. |
| **Number pool with assignment** | **No.** New model. | `VoicePhoneNumber.companyId` is required; `heldNumber()` enforces one per company; multi-holding is flagged as a defect. `PlatformSmsNumber` is the only tenant-free number model and is SMS-only. A `SalesPhoneNumber` (or an extended `PlatformSmsNumber` with a voice purpose) is new work. |
| **Inbound callback routed to a rep** | **Partial seam, wrong shape.** | The webhook already has a non-tenant branch (`app/api/voice/webhook/route.js:108`) keyed on `isSalesNumber()`, which reads a comma-separated env var (`lib/platform/salesCall.js:51`). That resolves *"this is FieldQuo's"*, not *"this is rep Dmytro's"*. Routing to a person needs a number→rep mapping in the database, and a way to reach that rep — which, for a browser-only rep, means an inbound WebRTC leg or a `transfer_call` to a PSTN number they hold. `salesToolDefinitions` (`lib/platform/salesAgent.js:105`) already does the latter to **one fixed number** from `FIELDQUO_SALES_TRANSFER_TO`. |
| **Live streaming STT** | **No.** New. | Everything today is post-call: the transcript arrives on `call_ended` / `call_analyzed` and is normalised by `transcriptFrom()`. `agentTuning.js:302` explicitly declines to pin an ASR vendor, so there is no Deepgram/AssemblyAI/Soniox account or key to reuse. A live copilot needs a streaming transport (websocket), a vendor, a new key, and a new cost line. |
| **Per-call cost for a non-tenant call** | **No.** New column, minimum. | `PlatformVoiceCall` has no `providerCostCents` (`prisma/schema.prisma:256-291`) and no ledger link. FieldQuo's own sales-line minutes are currently **not** priced anywhere — see §7. |

Things the spec asks for that are **already done** and should not be rebuilt:
number search by area code; exact-availability re-check; number purchase and
release; agent provisioning and prompt push; call records with transcript, summary
and recording; a recording-disclosure rule with an executed check; a contact-consent
and opt-out ledger; a calling-hours window; a cold-transfer tool; a non-tenant call
table; a provider-vs-rows reconciliation.

---

## 7. What would break

### 7.1 A `VoicePhoneNumber` belongs to a tenant. Structurally.

`companyId` is required with `onDelete: Cascade` (`prisma/schema.prisma:6448`).
Consequences if sales numbers were put in this table:

- **`heldNumber()` blocks the second purchase** (`lib/voice/numbers.js:217`) and
  `/platform/voice-numbers` reports multi-holders as a defect
  (`app/api/platform/voice-numbers/route.js:74-96`). A pool is many numbers, one
  holder — the exact shape currently flagged as a bug.
- **The rent cron would bill a company that isn't one.** `billNumberRent`
  (`lib/voice/spendGate.js:869`) walks `VoicePhoneNumber` and debits
  `VoiceCreditEntry` by `companyId`; at zero balance it releases the number. A
  sales pool would silently self-destruct after the grace window.
- **`syncNumberAttachment`** (`lib/voice/provision.js:582`) reads
  `voiceAgent.findUnique({ where: { companyId } })` and detaches when the balance
  is short. That is the mechanism that makes "balance crossing zero detaches at
  the provider" true (`scripts/check-voice-metering.mjs:26`).
- **`derivedSpend` and `measuredMargin` count every `VoiceCall` row with no tenant
  filter** (`lib/voice/pool.js:91`, `:152`). Sales calls landing in `VoiceCall`
  would be reported as tenant pool burn and would corrupt the measured margin —
  the number `check:voice-economics` exists to keep honest.

### 7.2 Spend gates are keyed on `companyId`, and fail closed

`checkSpend` returns `reason: "no_company"` with `allowed: false` for a falsy
`companyId` (`lib/voice/spendGate.js:279-281`). `spendAvailable()` resolves a
`PlatformFeature` for a company. `balanceFor(companyId, …)`. `canTakeCall(companyId, …)`.
`recordAiUsage` returns `null` without a `companyId` (`lib/ai/usage.js:220`).

So a sales-side caller does not *crash* — it is **silently refused, or silently
unmetered**. The second is worse and is the failure class AGENTS.md is written
against: a call that costs real money and records nothing.

### 7.3 `/platform/voice-numbers` will report a false billing leak per pool number

`auditVoiceNumbers` classifies any Retell number with no `VoicePhoneNumber` row as
**UNHELD** — "Retell has a number no company holds… FieldQuo pays the provider
anyway, every month, for ever" (`lib/voice/numberAudit.js:15-23`). The route
excludes only `simulated: true` rows (`app/api/platform/voice-numbers/route.js:67`)
and imports no sales-number filter.

**This is already true today for `FIELDQUO_SALES_NUMBER`** — FieldQuo's own sales
line has no `VoicePhoneNumber` row and therefore already reads as an unheld leak.
One number is noise a human absorbs. A pool of thirty turns the one screen that can
detect a real leak into a screen nobody reads. Any pool build must extend the audit
with a third category, not just add rows.

### 7.4 Shared Retell concurrency

FieldQuo holds **one** Retell account and every tenant draws on the same
concurrency pool; `get-concurrency` is the only thing Retell will tell us about it
(`lib/voice/retell.js:843`, and the comment block at `:800-830`). When the pool is
full an inbound call waits ~40s then falls back or fails — "which the caller
experiences as a business that does not answer its phone".

**Reps making sales calls would consume tenant concurrency.** Slots cost ~$8/month
against hundreds of dollars of billable minutes (`lib/voice/platformEconomics.js:42`,
`slotBreakEvenMinutes` at `:149`), so the fix is cheap — but it is a purchase
somebody has to make, and `CONCURRENCY_WARN_RATIO = 0.7` (`lib/voice/pool.js:71`)
would start firing before anyone connected it to sales.

### 7.5 The `/api/sales` write gate

`requireSalesRep()` refuses **every non-GET method** under `/api/sales`
(`lib/sales/gate.js:131`), and `REP_FORBIDDEN_WRITES` (`:47`) names the tables a
rep may never write. The one carve-out is `requireOutreachRep`
(`lib/sales/outreachGate.js:64`), whose `REP_OUTREACH_WRITES` is exactly
`["salesLead", "salesThread", "salesMessage"]` (`:51`), asserted by
`scripts/check-sales-outreach.mjs`.

A rep placing a call is a **write** (a call record, a cost row, possibly a number
assignment). It will 403 until a deliberate, named extension is made — and the
gate's own header argues against widening it with a mode parameter. Expect a third
narrow gate, plus new entries in the writable-tables list and its check.

Related: `middleware.js:217` puts `/sales` and `/api/sales` on the impersonation
gate's exclusion list, and `lib/sales/auth.js` uses a third identity with its own
cookie and a mandatory `scope: "sales"` claim, refused in both directions against
platform tokens. Reps are **not** Members and **not** PlatformAdmins.

### 7.6 Smaller, concrete

- **`OUTBOUND_COUNTRIES = ["US", "CA"]`** is set on every number at creation
  (`lib/voice/retell.js:354`, used at `:401` and `:444`). It clamps outbound *destinations*,
  not the rep's location, so a Ukraine-based rep dialing Canada is unaffected —
  *unless* the rep's own leg is implemented as a PSTN dial to Ukraine, which this
  list would refuse. Widening it is described as "a pricing decision, not a config
  tweak".
- **The sales-call reconciler gap** (§4.2): `reconcileCalls.js:217` builds from
  `voicePhoneNumber`, so a dropped webhook on a sales call is lost permanently.
- **Sales transcripts lose tool calls** (§4.2): `lib/platform/salesCall.js:198`
  bypasses `transcriptFrom()`.
- **SMS has no demo guard.** `lib/sms/twilioClient.js` has no `isDemo` check; a
  demo account can text a real person today. Already recorded in
  `docs/sales-intel/STATUS.md`. If sales telephony gains an SMS follow-up, it
  inherits this hole.
- **`RETELL_CREDIT_PURCHASED_CENTS` is typed in by hand** (`docs/VERCEL.md:169`) —
  Retell exposes no balance API. Sales-side burn drawing on the same account makes
  that manual figure less reliable, not more.

---

## What I could not determine

- **Whether Retell can carry a human rep's browser leg at all.** The repo shows no
  web-call usage and the audit is code-only. Whether Retell's web-call product
  supports a human-to-human bridge with our number as caller ID — and at what
  rate — is a vendor question, not answerable from here. Same for Twilio Voice
  SDK: the credentials exist, the SDK does not, and nothing in the repo indicates
  whether the account is enabled for programmable voice.
- **Twilio's or Retell's policy** on area-code-matched caller ID for outbound sales
  calls, or on a rep placing calls from outside North America. `STATUS.md` already
  lists this as blocker #3; nothing in the codebase speaks to it.
- **Whether `[]` or `null` is the correct detach shape** at Retell.
  `attachAgent` tries both and the comment says plainly it "cannot be settled
  without a key: there is no `RETELL_API_KEY` in local `.env` and this has never run
  against the real API" (`lib/voice/retell.js:592-606`).
- **What a caller hears on an unbound number** — ringing, busy, or a disconnect.
  Three files once asserted "rings out"; the comment at `lib/voice/retell.js:534-556`
  documents that this was never checked and needs one live call.
- **Live production state**: whether `FIELDQUO_SALES_NUMBER`,
  `FIELDQUO_SALES_TRANSFER_TO`, `TWILIO_*` or `RETELL_API_KEY` are actually set on
  the deployment, and whether `PlatformVoiceAgent.enabled` is true. All are
  environment/database facts. `/api/platform/voice-health` and
  `/api/platform/sales-agent` answer them at runtime.
- **Any per-number cost figure.** `lib/voice/credits.js:117-141` is explicit that
  the $1.15 / $2.00 figures are scraped marketing numbers, deliberately kept as a
  comment rather than a constant, and that there is no per-number cost endpoint. I
  have not speculated beyond what those comments record.
- **Whether the AI copilot's model spend can be metered at all** without either a
  nullable `companyId` on `AiUsage` or a parallel table. The code shows the
  constraint; the choice is a product decision.
