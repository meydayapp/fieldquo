# Sales Intelligence — what already exists

Read-only audit. Nothing was changed. Every claim below carries a `file:line`
and was read, not inferred. Where a thing could not be established from the
repo it is in **What I could not determine** at the end rather than guessed at.

The question this answers: before specifying a background job queue, structured
AI output, per-operation cost tracking and a nine-model data layer for
FieldQuo's OWN sales team, what is already here and what is genuinely absent.

Short version:

| Spec asks for | Exists today? |
|---|---|
| Background job queue | **No general queue.** 19 Vercel crons + one purpose-built queue table (`VoiceCallTask`) that is 80% of the pattern |
| Claim / lease with stale timeout | **Yes**, twice, in two different shapes — `lib/voice/autoTopup.js` and `app/api/cron/social-scheduled-publish/route.js` |
| Structured AI output with validation | **Partly.** Six callers ask for JSON in a prompt and hand-validate the parse. No schema library, no `response_format` |
| Per-operation cost tracking | **Yes for tenants** (`AiUsage`, micros). **Nothing at all** for FieldQuo's own spend |
| Prospect / lead entity | **`SalesLead` already exists** and is a rep's pipeline row. See §3 — this is the biggest design risk in the spec |
| Territory / geography | **No territory model of any kind.** Coordinates exist per-tenant |
| Sales-rep analytics | **Reusable**: `periodPresets`, `trend`. **Not reusable**: everything else |
| Evidence / provenance | **No first-class model**, but three near-misses worth copying |
| Web crawling | **None.** No arbitrary-URL fetch, no robots.txt, no outbound rate limiting |

---

## 1. Background jobs

### There is no general queue. Confirmed.

`vercel.json` has exactly 19 cron entries (`grep -c '"path"' vercel.json` → 19),
scheduled from `*/5 * * * *` (`social-scheduled-publish`) to `0 8 1 * *`
(`monthly-digest`). Each maps to a `GET` handler under `app/api/cron/`. There is
no worker process, no queue library, no Redis, and no dependency in
`package.json` that could be one — the dependency list is Next, Prisma, pg,
Stripe, Resend, Twilio, OpenAI, Cloudinary, Better Auth and UI packages
(`package.json` dependencies block). Nothing else.

### The established cron pattern

Every cron route is written the same way, and the shape is deliberate.

**1. `requireCronSecret` first, always.**
`lib/security/cronAuth.js:49`. Its header (`lib/security/cronAuth.js:1-21`)
records why it exists: the previous sixteen-times-copied inline check built
`` `Bearer ${process.env.CRON_SECRET}` ``, which with the var unset is the
literal, publicly-guessable string `"Bearer undefined"`. It now fails closed on
a missing secret (`:50-56`) and compares with `timingSafeEqual` (`:25-32`).
Usage is two lines at the top of every handler:

```js
const denied = requireCronSecret(request);
if (denied) return denied;
```

`app/api/cron/grace-warning/route.js:57-58`,
`app/api/cron/voice-auto-topup/route.js:44-45`,
`app/api/cron/voice-outbound/route.js:43-44`.

**2. Claim before acting.**
The reference implementation is `grace-warning`. It picks the column the send
will claim (`app/api/cron/grace-warning/route.js:101`), writes it with an
`updateMany` guarded on the column still being null
(`:110-113`), and skips the row if the claim matched nothing (`:114`). The
comment at `:103-109` is explicit that the guard is what stops a *concurrent
invocation of the same cron* colliding — not a logical impossibility, a race.

`social-scheduled-publish` does the same thing with a status transition:
`db.socialPublish.updateMany({ where: { id, status: "scheduled" } ...})`,
`claim.count === 0 → "claim_lost"`
(`app/api/cron/social-scheduled-publish/route.js:103-107`).

**3. Batch, not cursor.**
`const BATCH = 500` with `take: BATCH`
(`app/api/cron/grace-warning/route.js:54, :77`;
`app/api/cron/voice-auto-topup/route.js:41, :65`), `BATCH_LIMIT = 25`
(`social-scheduled-publish:58`), `BATCH = 25` (`voice-outbound:31`),
`BATCH = 200` (`sales-retention:38`).

The reasoning is written down at `grace-warning:50-53`: the query is driven by
**state** (`where: { status: "past_due" }`), not by a cursor, so leftovers are
picked up by the next tick and nothing is dropped. `voice-auto-topup:38-40`
says the same in the other direction — the cap exists so *one pathological
account cannot make the invocation time out and take the rest of the sweep
with it*. That sentence is the load-bearing one for the spec.

**4. Revert on failure.**
`grace-warning`'s claim is explicitly *provisional*. On no recipient
(`:118`), on a Resend rejection, and on a skipped send (`:152-159`) the claim
column is written back to `null` so the next run tries again. The file header
(`:26-35`) argues the case: a time-limited notice that gets permanently marked
sent by a transient failure is worse than never claiming at all.

Note the third outcome. `sendEmail` never throws — it returns `{id}` |
`{error}` | `{skipped}` — so the route checks all three
(`:143-145`, `:152`). This is AGENTS.md failure class #2 handled deliberately.

**5. One bad row must not stop the sweep.**
`voice-auto-topup:74-81` wraps each row in try/catch even though
`runAutoTopup` catches its own errors, and says so in a comment.

**6. Every route returns a tally, not a boolean.**
`{ success, considered, sent, ...skipped }` where `skipped` is a counter object
keyed by refusal reason (`grace-warning:80-82, :165`). `voice-outbound` returns
`placed/held/skipped/failed`. This is what makes a silent cron debuggable and
is worth keeping for a pipeline.

### The closest thing to a queue that already exists

**`VoiceCallTask`** (`prisma/schema.prisma:7178`) plus its drainer
(`app/api/cron/voice-outbound/route.js`). This is a real work queue and the
spec should start from it rather than from nothing:

- status machine `queued → calling → done | failed | skipped | cancelled`
  (`schema:7186-7187`)
- `notBefore DateTime @default(now())` — the delay/backoff column
  (`schema:7202`)
- `attempts Int @default(0)`, `lastError`, `lastTriedAt` (`schema:7205-7208`)
- `context Json?` for the payload (`schema:7196-7199`)
- indexed `@@index([status, notBefore])` (`schema:7219`) — exactly the index a
  due-work query needs
- the drainer distinguishes **terminal** refusal (→ `skipped`, not retried,
  reason recorded) from **retryLater** (→ push `notBefore` forward, *don't*
  burn an attempt) from **transient failure** (→ increment attempts, 6-hour
  backoff, give up at `MAX_ATTEMPTS = 3`)
  — `voice-outbound:30, :67-118`

The schema header (`schema:7166-7177`) also states a rule the sales pipeline
needs verbatim: *everything the task is about is a foreign key, never a copied
value*, re-resolved at execution time, because the world changes between
enqueue and run.

**The one thing it is missing: `VoiceCallTask` has no claim.** `voice-outbound`
selects `status: "queued"` and calls `placeQueuedCall` without transitioning
the row to `calling` first (`voice-outbound:48-59`); grepping
`lib/voice/outboundCall.js` for `updateMany` / `status: "calling"` / `claim`
returns nothing. Two overlapping invocations would both place the same call.
Today that is bounded by a 15-minute schedule and a 25-row batch. A prospect
pipeline with fan-out would not be so lucky. The claim to copy is
`grace-warning:110-114`, not this.

### Claim/lease with a stale timeout — yes, one exists

`lib/voice/credits.js:354`:

```js
export const AUTO_TOPUP_STALE_CLAIM_MINUTES = 10;
```

Its docblock (`:344-353`) is the exact argument a job queue needs:

> A serverless invocation that dies between claiming and clearing would
> otherwise wedge the feature off for ever.

The mechanics:

- the pure decision function treats a claim younger than 10 minutes as
  `in_flight` and one older as reclaimable (`lib/voice/credits.js:408-415`)
- the claim itself is a **compare-and-set**, not a read-then-write:
  `updateMany({ where: { companyId, chargeInFlightAt: config.chargeInFlightAt ?? null } })`
  and `if (claim.count !== 1) return { charged: false, reason: "in_flight" }`
  (`lib/voice/autoTopup.js:444-448`). The comment at `:430-442` spells out that
  a read-then-write would let both invocations through
- the reclaim **reuses the same token** so the downstream idempotency key is
  unchanged (`autoTopup.js:443`, `:576-578`) — a retry is the same operation,
  not a second one
- the cron exists *specifically* to sweep abandoned claims
  (`app/api/cron/voice-auto-topup/route.js:18-22`)

For a job queue: `chargeInFlightAt` → `claimedAt`, `chargeAttemptToken` →
`claimToken`, plus `VoiceCallTask`'s `attempts` / `notBefore` / `lastError`.
Both halves already exist in this repo; nobody has yet put them in one table.

### Can a multi-stage pipeline over 1,000 prospects run on Vercel crons?

**Yes, but only if it is built as a state machine drained in small batches —
never as "a cron that runs the pipeline".**

The honest arithmetic. Seven stages over 1,000 prospects is ~7,000 stage
executions. Stages that call a model or fetch a page take seconds each. At
even 2s per unit that is ~4 hours of compute for one full sweep. **No single
Vercel invocation can do that**, on any plan.

What makes it work anyway is the pattern already in this repo:

- one row per prospect per stage, with a status
- a `*/5` or `*/15` cron that takes `BATCH` due rows, claims each, does one
  unit of work, writes the result, and returns a tally
- leftovers are picked up next tick because the query is driven by **state**,
  not a cursor (`grace-warning:50-53`)
- the batch size is chosen so worst-case `BATCH × per-row-time` is comfortably
  inside the function limit — this is the exact reasoning at
  `voice-auto-topup:38-40`

Throughput is then `BATCH × (60 / interval_minutes)` per hour. At `BATCH=25`
every 5 minutes that is 300 units/hour → 7,000 units in about a day.
`*/5` is already in use (`vercel.json`, `social-scheduled-publish`), so this
needs no new capability. **If a full 1,000-prospect run must complete in under
an hour, crons are the wrong substrate and the spec should say so up front.**

Two constraints the spec must respect either way:

- **A cron may be invoked concurrently with itself.** `grace-warning:106-109`
  says so explicitly. Every stage needs a claim; "the schedule prevents
  overlap" is not true.
- **Nothing in this repo sets `maxDuration`.** Grepping `app/`, `lib/`,
  `next.config.*` and `vercel.json` for `maxDuration` returns zero hits. Every
  cron runs on whatever the account default is, and every one is written to be
  safe regardless — bounded batch, leftovers next tick. A new pipeline should
  inherit that discipline rather than raise the ceiling.

On the actual numeric limits for this Pro account, see **What I could not
determine** — I will not state a figure I could not verify.

---

## 2. AI

### `lib/ai/provider.js` is the only vendor seam. Confirmed.

`grep -rn "new OpenAI" lib app` finds one construction, at
`lib/ai/provider.js:28-30`, wrapped in `lazyClient` because a module-scope
client breaks `next build` when the key is absent. The file header (`:1-22`)
records why: five files used to each build their own client and hardcode a
model name.

Two entry points, exactly as documented:

**`complete({ system, prompt, maxTokens, onUsage, quality, reasoningEffort, images, maxImages, imageDetail })`**
— `lib/ai/provider.js:157`. Text in, text out. Returns `""` rather than
throwing when unconfigured (`:181`) and swallows vendor errors into `""`
(`:232-235`). Callers must treat empty string as "no answer".

**`runToolLoop({ system, messages, tools, execute, maxRounds = 5, ... })`**
— `lib/ai/provider.js:357`. The caller supplies `execute`, so the provider
never touches the database and `companyId` is injected outside the model's
reach (`:345-347`).

Two extras worth knowing: `generateImage()` (`:280`) is a third entry point for
`gpt-image-1`, and `AI_MODEL` / `AI_WRITING_MODEL` (`:57-58`) are env-overridable
(`:38`, `:54`). `quality: "writing"` opts a call into the better model
(`:189-194`) — callers name the *job*, never a vendor model ID.

### Structured output: prompted JSON, hand-validated. No schema layer.

**There is no schema validation library in this codebase.** No `zod`, no `ajv`,
nothing equivalent in `package.json`. And no call uses OpenAI's own structured
output: `grep -rn "response_format\|json_schema\|strict: true" lib app` returns
**zero hits**.

What exists instead: the prompt says "strict JSON, no fence", the response goes
through `stripJsonFence()` (`lib/ai/provider.js:102`), and each caller
hand-coerces every field. Six callers:
`lib/ai/quoteReview.js:440`, `lib/ai/visionPass.js:120`,
`lib/ai/callTranscriptDigest.js:323`, `lib/ai/marketingCopy.js:93`,
`lib/ai/callQuoteDraft.js:399`, `lib/site/generateSite.js:521`.

**The best existing example is `lib/ai/callTranscriptDigest.js:317`,
`parseModelOutput(raw, candidates)`.** It is the one to model a validator on,
because it validates against *facts the caller already holds*, not against a
shape:

- unparseable JSON returns the empty result, identical to "the model had
  nothing to say" (`:321-326`)
- a `callIndex` outside the range actually sent is dropped — the docblock
  (`:302-304`) says why: *a model that miscounts must not have its note
  attached to the wrong homeowner's quote*
- each note must be a non-empty string under `MAX_NOTE_CHARS`
- each note passes `looksLikeInstruction()`, reused from
  `lib/ai/callLeadRecovery.js` rather than re-written, so a prompt line the
  model echoed back cannot ride into a document a human reads as fact
- and the rule that matters most, at `:353-361`: **`assembleInsights` reads no
  count, percentage or conclusion out of the model's JSON, because no such
  field exists for it to have written one into.** Every number is `.length` of
  something.

Three more worth borrowing:

- `lib/ai/callQuoteDraft.js:393` `parseDraftJson` — fence strip, then a
  first-`{`/last-`}` slice as a second attempt, then `null`. Never throws
- `lib/ai/callQuoteDraft.js:424` `coerceIntakeValue` — returns `{ ok: false }`
  rather than a default, because *"there is no sensible default for how many
  doors; the whole point is that not knowing survives as not knowing"*
- `lib/site/generateSite.js:537` `validateComposition` — clamps the model's
  chosen page shape to a closed set, drops invented section names, and refuses
  a section the company has no data for even though the prompt forbade it
  (`:529-535`). Model-chosen enums are validated against a closed list before
  they can become anything (`:555-559`)

For a scoring/fingerprinting pipeline the rule to carry over is
`callTranscriptDigest`'s: **the model may produce sentences and select from
closed sets; every number is computed in code.**

### Metering: `checkAiQuota` before, `recordAiUsage` after

`lib/ai/usage.js`. Header (`:1-17`): *checking before matters more than it
looks — recording after only tells you what you already spent.*

- `checkAiQuota(companyId)` → `{ allowed, reason, usage, cap, remaining, nearLimit }`
  (`:155`). Cap resolution is company override → plan → `DEFAULT_TRIAL_CAP`
  750,000 tokens (`:118-144`). Explicit `null` = unlimited (`:163`); `0` =
  feature off (`:170`). Warns at 80% (`:148`)
- `recordAiUsage({ companyId, feature, model, promptTokens, completionTokens, userId, imageCount })`
  (`:206`) writes one `AiUsage` row. Never throws (`:229-236`) — a metering
  failure must not turn a working answer into an error
- cost is `estimateCostMicros` (`:55`) against a hardcoded `PRICING` table
  (`:29-42`) in **integer micros**, with a deliberately pessimistic
  `FALLBACK_PRICING` for unknown model IDs (`:44-47`) *because a cost estimate
  that reads high gets investigated while one that reads low gets believed*
- superseded models stay in the table so historical rows keep costing what they
  cost (`:34-37`)

The wiring is consistent — ~15 routes import both and call them either side of
the model call (e.g. `app/api/ai/copilot/route.js:41, :83`;
`app/api/quotes/[id]/review/route.js:78, :91`). `onUsage` is passed into
`complete`/`runToolLoop` and the *route* decides whether to record
(`provider.js:210-227`), which is why the provider never touches the database.

### The quota is per-COMPANY, and FieldQuo's sales team is not a company

This is a hard blocker, not a detail:

- **`AiUsage.companyId` is non-null** with an FK to `Company` and
  `onDelete: Cascade` (`prisma/schema.prisma:6216-6218`). There is no row shape
  for FieldQuo's own spend
- **`recordAiUsage` returns `null` immediately without a `companyId`**
  (`lib/ai/usage.js:227`: `if (!companyId) return null;`). It fails silently
- **`checkAiQuota` reads `db.company.findUnique`** (`:119`). No company row,
  no cap; the `getAiCap` fallback would hand a non-existent tenant the trial
  cap
- the monthly rollup is `startOfMonth` scoped to one `companyId`
  (`:69-117`)

**There is already precedent for this gap, and it is a live one.** Jennifer's
anonymous mode calls the model with **no metering at all**:
`app/api/jennifer/route.js:219` calls `askJennifer({ mode: "anonymous", messages })`
with no `onUsage` and writes no `AiUsage` row — only a rate limit
(`:212-223`). `lib/ai/jennifer/client.js:70-73` states the design outright:
*"company mode meters through lib/ai/usage.js; anonymous mode does not."*
`app/api/platform/ai-health/route.js:29` says the same about the platform side:
*"that table attributes spend to a company, and this belongs to no company."*

So FieldQuo's own AI spend is invisible today. A prospecting pipeline running
seven model-touching stages over 1,000 prospects would be, by a wide margin,
the largest untracked AI cost in the product.

**What would have to change.** Options, in the order I would argue them:

1. **Make `AiUsage.companyId` nullable and add a discriminator**
   (`scope: "company" | "platform"`, plus `salesRepId String?`). Smallest
   change; keeps one cost table so "what does AI cost us in total" stays one
   query. Cost: every existing `AiUsage` read assumes a company and would need
   auditing — `app/api/platform/ai-usage/route.js` and `getMonthlyUsage`
   (`lib/ai/usage.js:74`) at minimum
2. **A separate `SalesIntelUsage` / `ProspectingCost` table**, keyed to the
   pipeline run and the prospect rather than to a tenant. Better fit for
   *per-operation* cost tracking, which is what the spec asks for and what
   `AiUsage` does not do: `AiUsage` is per-*call*, with no notion of a run, a
   stage, or a unit of work. Cost: two cost tables, and the risk that one
   drifts (AGENTS.md failure class #4)

Either way, three things must be settled explicitly:

- **`checkAiQuota` has no untenanted equivalent.** A pipeline needs its own
  ceiling — a per-run budget in micros, refused before the call, in the same
  before/after shape. `runAutoTopup`'s cap stack
  (`lib/voice/credits.js:342-370`: one in flight, minimum gap, daily count cap,
  daily amount cap, hard stop on decline) is the closest existing model of
  "a cost ceiling on an unattended loop", and its header states the property
  worth having: *a cron that ran every minute, or twice at once, would change
  none of that*
- **`PRICING` (`lib/ai/usage.js:29-42`) drifts.** Its own comment says so and
  warns it was overstating gpt-5 by ~2× until July 2026. Sales-intel costs read
  off it are estimates
- **`estimateCostMicros` covers tokens only.** Crawling, enrichment APIs and
  any paid data source have no home in this table at all

---

## 3. Existing lead / CRM concepts — and the Prospect question

### What exists

**`LeadRequest`** (`prisma/schema.prisma:4286`) — a homeowner's inbound
enquiry, `companyId`-scoped, cascade-deleted with the company. This is a
*contractor's* lead about a job. Not related to selling FieldQuo.

Worth reading anyway for two reasons. Its triage columns
(`schema:4368-4371`) are:

```
score         Int?      // 0–100
temperature   String?   // hot / warm / cold
scoreReasons  Json?     // [{ label, weight }] — "so the number is never a
                        //  black box a rep has to trust blind"
```

That is a working, shipped answer to the spec's `Score` entity, and the
`scoreReasons` shape is the honest part. And `lib/analytics/leadScoring.js:1-28`
is the accompanying scepticism: the weights in `lib/leads/score.js` are
*"somebody's judgement about what predicts a sale. None of them has ever been
checked against whether the sale happened."* A sales-intel score arrives with
the same problem and should ship with the same measurement.

`lostReason` (`schema:4308-4314`) is a closed vocabulary, and the comment
records that a heuristic-filtering design was *considered and rejected* — a
lead is "not real" only because a human said so.

**`Client`** (`prisma/schema.prisma:1795`) — a contractor's customer,
`companyId`-scoped. Irrelevant to prospecting except as the eventual shape a
signed prospect does *not* become (a FieldQuo customer becomes a `Company`).

**The sales models, added recently** (`prisma/schema.prisma:7861-8165`):

- `SalesRep:7861` — FieldQuo's own salespeople. **Not `Member`, not `User`.**
  `docs/sales/PLAN.md:66-70` explains: the whole stack resolves one session to
  one company via `session.activeOrganizationId`; a rep is one identity across
  many companies, and making a rep a `Member` would consume the customer's
  licensed seats and put FieldQuo staff inside a tenant
- `SalesCommissionPlan:7909`, `SalesAttribution:7930` (one row per company,
  ever, `lockedAt` at capture), `SalesAttributionTouch:7958` (second-rep
  touches recorded rather than refused), `SalesAttributionAudit:7978`
  (corrections supersede, never overwrite), `SalesCommissionEntry:7999`
  (append-only ledger, modelled on `VoiceCreditEntry`),
  `SalesPayoutBatch:8042`
- **`SalesLead:8086`** — `businessName`, `contactName`, `email`, `phone`,
  `status` (`"new" | "contacted" | "demoed" | "signed" | "lost"`), `notes`,
  `convertedCompanyId String? @unique`, `convertedAt`
- `SalesThread:8114` / `SalesMessage:8140` — email threads against a
  `SalesLead`, keyed by a `replyToken` carried in Reply-To and References
  (`:8126-8131`) because matching on sender address breaks the moment someone
  replies from their phone

Supporting code: `lib/sales/outreachPipeline.js:24` holds the five statuses
in a dependency-free module so client components and the server read the same
list; `statusAfterSend` (`:46`) moves only `new → contacted`, never backwards.
`lib/sales/outreachGate.js` is a named, closed allowlist of the three tables a
rep may write (`SalesLead`, `SalesThread`, `SalesMessage`) with
`scripts/check-sales-outreach.mjs` asserting no route writes outside it.
`lib/sales/scope.js` is the rep's tenant boundary — its header (`:16-23`) notes
it has no outer `companyId` to sit behind, so *"getting this wrong does not
leak a row; it leaks an entire customer's business."*

### Should Prospect and SalesLead be one thing or two?

**Two entities, one of which owns the other. Specifically: keep `SalesLead` as
the rep-owned pipeline row, add `Prospect` as the org-wide discovered company,
and give `SalesLead` a nullable `prospectId`.** Do not merge them, and do not
create a second independent lead table.

The evidence for two:

1. **`SalesLead.salesRepId` is required, with `onDelete: Cascade`**
   (`schema:8089-8090`). A `SalesLead` cannot exist without a rep, and deleting
   a rep deletes their leads. A discovered prospect must exist before anyone is
   assigned to it and must survive a rep leaving — the same argument
   `SalesRep.endedAt` makes for attributions (`schema:7880-7881`:
   *"deliberately not a delete: their attributions and their ledger are
   history, and history does not stop being true."*)
2. **`@@index([salesRepId, status])`** (`schema:8112`) — every read of this
   table is "my pipeline". A discovery corpus is read by territory, by score,
   by last-crawled, by dedupe key. Different table, different access pattern
3. **Cardinality.** `SalesLead` is tens of rows per rep, typed by a human.
   `Prospect` is thousands, machine-created, most never worked. Putting
   unworked machine output in a rep's pipeline table means the pipeline board
   is 99% noise on day one
4. **Provenance.** A `SalesLead` field is what a rep typed. A `Prospect` field
   needs a source, a fetch date and a confidence (§6). Merging them means every
   column answers "who claimed this?" differently depending on the row, which
   is precisely the "two questions answered by one predicate" mistake
   `lib/sales/scope.js:29-35` records paying for
5. **`convertedCompanyId String? @unique`** (`schema:8103`) already makes
   `SalesLead` the join between pipeline and attribution. Adding a second,
   parallel path from `Prospect` to `Company` would give the commission ledger
   two disagreeing answers to "who brought this company in" — and commission is
   money

The evidence against a third independent table is the spec's own risk: two
overlapping lead tables with no FK between them means a rep works a prospect,
the pipeline row and the prospect row drift, and nobody can say which is
current. The `prospectId` FK is what prevents that.

Concretely, what I would put in the spec:

- `Prospect` — discovered, org-wide, no required rep. Carries dedupe key,
  domain, geography, crawl/fingerprint state, evidence, score.
  `assignedRepId String?` is fine; `salesRepId String` is not
- `SalesLead.prospectId String? @unique` — nullable because a rep must still be
  able to type in a lead they met at a trade show, which is the
  feature that shipped. `@unique` because one prospect becomes at most one
  pipeline row, mirroring `LeadRequest.quoteId @unique`
  (`schema:4375-4377`) and `SalesLead.convertedCompanyId @unique`
- "Work this prospect" creates the `SalesLead` and sets the FK. The existing
  five statuses, `outreachGate`, `SalesThread` and the whole outreach path then
  work unchanged
- Denormalise **nothing** from `Prospect` onto `SalesLead`.
  `VoiceCallTask`'s rule (`schema:7174-7177`) applies: the dialled number is
  read from the linked record at send time, never copied at enqueue

---

## 4. Territory / geography

### There is no territory model. None.

`grep -rn "territory\|Territory\|serviceArea\|ServiceArea\|serviceRadius"`
across `lib`, `app` and `prisma` returns seven hits, all unrelated:
`lib/tax/jurisdictions.js:853` (a `region` parameter meaning
province/territory code), `lib/site/generateSite.js:78, :309` (a
`serviceArea` free-text string in the website interview), and three
metaphorical uses of the word "territory" in comments
(`lib/analytics/moneyFlow.js:52, :65, :319`).

No region model, no assignment model, no polygon, no postcode-set.

### How geography is actually handled

**Coordinates live on the entity, as nullable decimals**, in five places:

| Model | Line |
|---|---|
| `Company` (`postalCode`, `latitude`, `longitude`) | `schema:1079-1082` |
| `Appointment` | `schema:3066-3067` |
| `PamphletStop` | `schema:4227-4228` |
| `Booking` | `schema:4699-4708` |
| `CrewInboundMessage` | `schema:7336-7337` |

All `Decimal? @db.Decimal(9, 6)`. The `Booking` comment (`schema:4701-4703`) is
the convention to copy: *"a geocode that fails leaves the coordinates null
rather than zeroed."*

`Client` (`schema:1795`) has `address / city / province / country` but **no
coordinates**. `Client.country` (`schema:1826`) carries a comment worth reading
before designing any geography field: it is ISO-3166 alpha-2, deliberately
**not backfilled**, because *"stamping 'CA' across the existing table would turn
a guess into stored data and make it un-auditable a week later."*

**Google Maps** is used server-side through `GOOGLE_MAPS_SERVER_KEY`
(`docs/VERCEL.md:21` — Geocoding, Distance Matrix, Solar, Static Maps). The
touch points: `lib/booking/travel.js` (also exports `haversineKm` and
`hasPoint`), `lib/booking/computeAvailability.js`,
`lib/measure/roofMeasurement.js:66, :98`, `lib/measure/satellite.js:377`,
`lib/measure/lotArea.js`, `lib/voice/availability.js`,
`app/api/settings/business-info/route.js` (address autocomplete).
`docs/VERCEL.md:21` also notes that without the key, travel-time booking falls
back to straight-line estimates *and still says "about"* — an honest degrade
worth copying.

### What a sales `Territory` could reuse

Honestly, not much, and that is the finding:

- **`haversineKm` / `hasPoint`** (`lib/booking/travel.js`, imported by
  `lib/crew/attribution.js:33`) — pure distance maths, no key needed. A
  radius-based territory needs nothing else
- **The `Decimal(9,6)` nullable-coordinate convention** and the "null, never
  zeroed" rule
- **`lib/tax/jurisdictions.js`** — has normalised province/state handling and
  the `region` two-letter vocabulary
- **`lib/measure/` is the wrong shape entirely** — roof and lot measurement for
  one address, via Google Solar. Nothing there generalises to a region

A radius-plus-coordinates territory would work today with pure code. A
postcode-set or polygon territory needs something that does not exist. If
`Territory` is going to assign prospects to reps, note that `SalesAttribution`
already locks at capture (`schema:7943-7944`) — territory must not become a
second, disagreeing answer to "whose company is this".

---

## 5. Analytics

`lib/analytics/` has 20 modules. Split by whether they would transfer:

### Transfers cleanly — pure, tenant-agnostic

- **`periodPresets.js`** (56 lines). `presetRange(key, now)` → `{from, to}`
  inclusive `YYYY-MM-DD` (`:28`), plus `PERIOD_PRESETS` (`:50`). Six presets.
  Header (`:5-11`) explains the UTC-day discipline: building "this month" from
  the browser clock puts a document on the wrong side of a boundary for anyone
  west of Greenwich. **Nothing in it knows what a company is.** Use as-is
- **`trend.js`** (67 lines). `compare(current, prior, {flatBand = 0.02})`
  (`:30`) returns `null` when there is no honest comparison — `prior == null`
  yields no trend, not a fabricated baseline (`:33`), and `deltaPct` is `null`
  when prior is 0 (`:35`) because *"'∞%' or a divide-by-zero is worse than an
  honest absence"*. `describeRateTrend` (`:60`). Also tenant-agnostic.
  `docs/sales/PLAN.md:60` already lists both of these as reusable

### Transfers as a *discipline*, not as code

- **`kpis.js`** (1190 lines). Every KPI returns
  `{ value, sampleSize, incomplete, reason, reasonText }` (`:29-45`, built by
  `kpi()` at `:201`). The rules are the transferable part:
  - `value: null` never collapses to `0` — *"a company with a real zero gets a
    real 0, and a company with no evidence gets null. Those are different
    sentences"* (`:31-35`)
  - `sampleSize` is printed even when `value` is null — *"'3 of 3 ran over' is
    honest at any n; a rate is not"* (`:36-38`)
  - `reason` is a **closed vocabulary code**, never English; `REASONS`
    (`:164`) maps codes to sentences at the edge
  - two floors, deliberately different: `RATE_FLOOR = 10` (`:88`) for shares,
    `COUNT_FLOOR` (`:96`) for central figures
  - `incomplete` for a number that is real but knowably short (`:39-42`)
  - **`NOT_TRACKED`** (`:939`) — an explicit list of metrics a dashboard is
    normally expected to carry, each with a written reason it is a panel
    instead of a number. The header (`:930-937`) notes the list *keeps
    shrinking*, which is the point of it. `costPerLead` is refused because
    *"MarketingSpend.leads is typed in by hand, and no lead carries a
    campaignId or a UTM value"* (`:941-946`)

  A sales-intel dashboard should carry its own `NOT_TRACKED`. Candidates on
  day one: anything derived from a crawl that did not run, and any conversion
  rate on a cohort below floor.

  The **code** does not transfer: `buildWinLoss`, `buildReceivables`,
  `buildEstimateAccuracy`, `actualJobCost`, `labourUtilisation` all take
  contractor rows (quotes, jobs, invoices, expenses). Note also that `kpis.js`
  imports no `@/lib/db` (`:19-25`) — every row arrives as an argument, which is
  what lets `scripts/check-kpis.mjs` execute every branch without a database.
  **Copy that structure; it is why the honesty rules are checkable.**

- **`winLoss.js`** (462 lines). Five rules in the header worth transcribing
  into the sales spec: null is not a category (`:19-24`); a small sample is not
  a pattern, `SAMPLE_FLOOR = 10` at `:68` (`:25-31`); **free text is not clustered** —
  no taxonomy, no keyword buckets, no model-invented labels, because *"grouping
  three sentences into categories is how a report starts making claims the
  client never made"* (`:32-38`); absence is stated, not padded (`:39-44`);
  outstanding is neither won nor lost (`:45-50`). And `:51-55`: **deliberately
  no AI**, because every sentence it can honestly produce is a function of six
  integers and *"a model paraphrasing six integers adds a way to be wrong and
  nothing else."*

  Directly applicable to a rep's win/loss. Tenant-scoped in its queries
  (`Quote.status`, `declineReason`), so rewrite against `SalesLead.status`
  rather than reuse.

- **`companyComparison.js`** (251 lines). Three guards against a confident
  wrong answer (`:17-30`): their sample is thin; the **cohort** is thin
  (`MIN_COHORT_COMPANIES = 4`, `:41`); and the subject is excluded from its own
  benchmark, because with four companies each is 25% of the thing it is
  measured against. `IN_LINE_BAND = 0.15` (`:44`) — inside that band of the
  median, no advice is offered, because *"noise is how advice stops being
  read."*

  The rep-leaderboard version of this is exact: comparing a rep to a median
  they helped compute, with six reps, is the same error. **The cohort-exclusion
  rule is the single most reusable idea in `lib/analytics/` for this spec.**
  The code is company-shaped and would be rewritten.

- **`leadScoring.js`** — the template for validating a prospect score against
  outcomes. `MIN_SAMPLE = 5` from `tenantHealth.js:38`; below it, report a
  fraction, never a percentage, never a blank (`leadScoring.js:24-28`).
  Measures against **decided** leads only (`:53-57`)

### Does not transfer

`tenantData.js` (queries every tenant's quotes/jobs/invoices for the platform
board), `tenantHealth.js` (except `MIN_SAMPLE` / `formatRate`), `moneyFlow.js`,
`receivables.js`, `burnRate.js`, `payrollCost.js`, `overhead`-related,
`estimateAccuracy.js`, `minimumPrice.js`, `pricingBenchmark.js`,
`marketingRollup.js`, `expenseSummaryData.js`, `safety.js`, `goal.js`,
`composeTimer.js` — all are about a contractor's own business.

---

## 6. Evidence / provenance prior art

**Nothing in this codebase models "a fact, its source, and how confident we
are" as a first-class entity.** Four partial patterns exist; the spec should
name which one it is extending.

**1. `MigrationWrite` (`schema:3283`) — the closest structural match, and the
best one.**

```
migrationRequestId  // which operation produced this
platformAdminId     // who
entityType/entityId // what it refers to
snapshot Json?      // a FROZEN COPY of what was written
createdAt           // when
```

Two properties are exactly what an `Evidence` entity needs:

- **`snapshot` is frozen on purpose.** `schema:3294-3298`: read *"WITHOUT
  joining back to a row the company may have since edited themselves — a
  migrated Client the owner corrects afterwards must not rewrite this log's
  account of what FieldQuo actually wrote."* An `Evidence` row asserting "this
  page said X on this date" needs precisely that immutability
- **It is written in the SAME transaction as the thing it describes**
  (`lib/migrations/writes.js:15-21`), so *"the write happened" and "the write is
  logged" can never come apart*
- and `lib/migrations/writes.js:39-50` `loadWritableMigration` re-reads the
  gating state **fresh inside the transaction**, never trusting a status read
  earlier in the request

**2. The KPI envelope `{value, sampleSize, incomplete, reason}`
(`lib/analytics/kpis.js:29-45`, `:201`) — the closest *semantic* match.**

It is a confidence envelope without a source. `reason` is a closed vocabulary
explaining an absence; `sampleSize` is the strength of the claim; `incomplete`
flags a real-but-short number. What it lacks is *where the value came from*.
An `Evidence` shape is roughly this envelope plus `MigrationWrite`'s
provenance columns:

```
{ value, source, fetchedAt, snapshot, confidence, reason }
```

**3. Confidence tiers that refuse to guess — `lib/crew/attribution.js`.**

The best-argued example in the repo. `:14-19`: *"a low-confidence attribution
ASKS, it does not pick. The cost of asking is a five-second reply; the cost of
a silent wrong guess is the relationship."* Tiers are named and closed:
`explicit`, `gps`, `only-one`, `ask` (`:21-25`), returned as
`{ confidence: "high" | "none", ... }` with candidates attached
(`:125-201`). The GPS tier requires both on-site (`GPS_ONSITE_KM = 0.25`) and
clear separation (`GPS_SEPARATION = 2`) — two independent conditions, not one
threshold (`:36-37`). Also **pure**: the caller fetches candidates, the
function decides (`:27-32`).

`lib/pricing/benchmarkGuidance.js:73-95` is a second, weaker instance —
`{kind, label, detail, confidence, currency}` where `kind` includes an explicit
`none` whose `detail` says *why* there is no number, and `confidence` defaults
to `"guess"` when a table row omits it (`:95`). The `Object.hasOwn` guard at
`:83-88` is a nice detail: a plain lookup would resolve `constructor` truthily
and turn a non-existent line into *"a fabricated statement about a line nobody
wrote."*

**4. Explainable scores — `LeadRequest.scoreReasons Json`
(`schema:4368-4371`), `[{label, weight}]`, "so the number is never a black box
a rep has to trust blind."**

The `Score` entity in the spec should carry the same, and — per
`lib/analytics/leadScoring.js` — should be measured against whether the deal
actually closed.

**Audit logs, for completeness.** `PlatformAuditLog` (`schema:293`) —
admin/action/target/details, FieldQuo-side. `ActivityLog` (`schema:6406`) —
tenant-side, dotted verbs (`quote.sent`), with `viaImpersonation Boolean` whose
comment (`:6414-6416`) notes support is read-only so a write under
impersonation should be impossible — *"if one ever shows up here, that's
precisely what an audit trail is for."* `SalesAttributionAudit` (`schema:7978`)
— corrections supersede rather than overwrite. All are *event* logs
(what happened), not *claim* logs (what is true and why we believe it). An
`Evidence` entity is the latter and is genuinely new.

---

## 7. Web crawling

### None exists. This is entirely new capability.

Fifteen files in `lib/` call `fetch()`. Every one targets a **named, known
vendor**:

| File | Target |
|---|---|
| `lib/designer/unsplash.js:38` | `api.unsplash.com` |
| `lib/meta/client.js:162, :196` | `graph.facebook.com` |
| `lib/social/metaGraphClient.js`, `publishDesign.js`, `metaSpecs.js` | Meta |
| `lib/voice/retell.js:76` | Retell |
| `lib/measure/roofMeasurement.js:66, :98`, `satellite.js:377` | Google Maps/Solar |
| `lib/email/resendDomains.js:33` | Resend |
| `lib/ai/images.js` | OpenAI |
| `lib/payroll/embeddedPayrollClient.js` | payroll vendor |
| `lib/crew/inbox.js`, `lib/followUps/flow.js`, `lib/loadState.js`, `lib/fetchJson.js` | own API / Twilio media |

**No file fetches a URL supplied by data.** No HTML parser is in
`package.json`. No OG-tag scraper — `lib/marketing/ogCard.js:3` *generates*
FieldQuo's own social card; `robots: {index: false, follow: false}` appears
across `app/` as page metadata on tokenised pages, which is emitting a
directive, not reading one. There is no `app/robots.js`. Unsplash images are
**hotlinked, not copied** (AGENTS.md stack table) — a visitor hits Unsplash's
CDN directly, so even that is not a fetch FieldQuo makes.

**There is no robots.txt parser, no crawl-delay handling, and no outbound rate
limiter anywhere in this codebase.**

### HTTP client conventions that do exist, and are worth following

**`lib/meta/client.js` is the best-shaped external client here.** Its rules:

- one file owns the base URL and version constant (`:30-31`), *"so a version
  bump is a one-line change and a single re-test, not a hunt through scattered
  fetch() calls"* (`:5-8`) — the same discipline `lib/ai/provider.js` and
  `lib/voice/retell.js` keep
- `graphFetch` returns `{ok: true, data}` or `{ok: false, ...classifyMetaError()}`
  and **never throws for a vendor-side error** (`:147-150`), *"so a sync job can
  always inspect `.kind` rather than wrapping every call in try/catch"*
- error kinds are a closed set including `{kind: "rate_limited", message,
  retryAfterSeconds}` read off the `retry-after` header (`:98`, `:126-130`)
- a genuine network failure (DNS, timeout) **does** throw, deliberately, because
  that is FieldQuo's connectivity and not a response to classify (`:150-153`)
- a non-JSON body is classified, not thrown on (`:171-175`)

**Timeouts.** Only `lib/voice/retell.js:60-77` sets one: `timeoutMs = 15000`
via `AbortController`, with the comment *"15s is well past a healthy call and
well short of a Vercel timeout"* (`:70`), and `30000` for one slower call
(`:781`). **No other external call in this repo has a timeout.** A crawler
must, and Retell's is the pattern.

**Caching.** `lib/designer/unsplash.js:44` uses `next: { revalidate: 60 }` with
the reasoning at `:40-43` — cache briefly rather than not at all, so a repeated
action does not spend two calls against a low free-tier rate limit.

**Retry.** `lib/voice/retell.js:621-623` — *only a rejection of the shape earns
a retry; a 500, a timeout or an auth failure does not*, because retrying a
different body would be a second identical outage. Same terminal/transient
split `voice-outbound` uses.

**Error shape.** `lib/fetchJson.js:26` reads the body as **text first**, then
parses, so an HTML error page yields the API's own message or the HTTP status —
never the browser JSON parser's complaint (`:1-17`). That is for internal
calls; the lesson applies to a crawler hitting a WAF page.

**Rate limiting is inbound-only.** `lib/rateLimit.js` throttles public
unauthenticated POSTs. Its header (`:10-17`) is refreshingly honest: the window
lives in **process memory**, so on Vercel that is **per lambda instance** —
*"a flood spread across a scaled-out deployment gets a fresh allowance on each
one, and a cold start forgets everything."* Sliding window, not fixed
(`:19-21`). It notes a durable counter (Redis/Postgres/KV) is the next step and
that the module's shape should survive so only storage swaps.

**That last point matters for the spec.** Per-host politeness for a crawler is
exactly the case in-memory rate limiting cannot serve: crawl work spread across
cron invocations shares no memory. A crawler's rate limit must be a database
column (last-fetched-at per host) or it is decorative. `VoiceCallTask.notBefore`
(`schema:7202`) is the right primitive — the queue itself carries the "not yet".

Also relevant: nothing in `lib/sales/outreachSender.js` or
`lib/sales/outreach.js` caps sends per day (grep for `DAILY|perDay|cap|limit|
throttle|MAX_|LIMIT|CAP` finds nothing). If `Campaign` is going to send at
volume, that ceiling does not exist yet either.

---

## What I could not determine

- **The exact Vercel function-duration limit on this Pro account.** No
  `maxDuration` is set anywhere in the repo (verified: zero hits across `app/`,
  `lib/`, `next.config.*`, `vercel.json`), so every route runs at the account
  default — and that default depends on whether Fluid Compute is enabled on the
  project, which is a dashboard setting this repo cannot read. `docs/VERCEL.md`
  documents environment variables and dashboard settings but says nothing about
  function duration. The published ceilings have also changed more than once
  recently, so I am not going to quote a number from memory as fact. **Check
  Project → Settings → Functions before sizing any batch.** What is safe to
  rely on regardless: the existing crons are written to survive whatever the
  limit is — bounded batch, state-driven query, leftovers next tick — and a new
  pipeline should be too.
- **The Vercel Pro cron-count ceiling.** 19 are in use. Whether the plan allows
  40, or something else, needs the dashboard. If the pipeline adds one cron per
  stage (seven), the total would be 26 — close enough to a plausible limit that
  it should be checked, and a good argument for **one** cron that drains a
  single `stage`-discriminated table rather than seven.
- **Whether `OPENAI_API_KEY` and `CRON_SECRET` are actually set in production.**
  `docs/VERCEL.md:13-30` lists `CRON_SECRET` under "Outstanding — set these",
  which would mean every cron currently 401s. That list may be stale; I could
  not read Vercel's environment. If it is accurate, no cron in this product is
  running at all today, and that is a prerequisite for everything above.
- **Whether the spec's `Campaign` means outbound email at volume.** If so, the
  CASL constraints in `docs/SALES-OUTREACH.md` and the `SALES_MAILING_ADDRESS` /
  `SALES_REPLY_ADDRESSING` / `SALES_INBOUND_SECRET` requirements
  (`docs/VERCEL.md:28-30`) apply, and none of those three is set. I did not
  audit the outreach send path in depth — it was out of scope for this pass.
- **Actual per-prospect stage timings.** Batch sizing in §1 uses an assumed 2s
  per unit. Nothing in the repo measures a comparable workload.
