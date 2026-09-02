# Research: sales demo accounts — what exists, what a reset takes, what the AI mock needs

Research only. No product code touched. Written against the owner's two asks:

1. Each salesperson gets one demo account they can reset between prospects.
2. Voice and "text crew" stop using the real AI agents in a demo — a mockup
   plus a button that plays one of ~3 canned recordings, instead.

Plus the standing requirement that demo tenants stay isolated from
production: no real charges, no real communications, no pollution of sales
metrics, and resettable.

**Bottom line up front:** far more of this already exists than the brief
assumes. There is a working, superadmin-gated reset/re-dress system for ten
demo companies (`lib/demo/seedDemo.js`), a real precedent for the AI mock
(`lib/social/mockMetaGraphClient.js`, built this session for Meta), and the
voice channel already has a dedicated demo-safe substitute
(`lib/voice/demoLine.js`). What's missing is narrower than "build a demo
system" — it's: (a) real canned transcripts/recordings for the voice+SMS
mock the owner is now asking for, and (b) closing one live, unguarded gap on
the crew-texting number, which currently has **none** of the protection the
voice number has and can buy a real, billable Twilio number for a demo
company today.

---

## 1. What is a demo company today

A demo company is a real `Company` row with `isDemo: true`
(`prisma/schema.prisma:1323`) — not a separate table, not a feature-flagged
view of a real tenant. Ten of them exist, created by
`scripts/seed-demos.mjs`, one per slug `demo1`…`demo10`
(`lib/demo/industries.js:180-196`, `DEMO_COUNT = 10`). Each is seeded onto an
industry preset (painting, cabinets, flooring, landscaping, cleaning,
plumbing, HVAC, roofing, electrical, handyman —
`lib/demo/industries.js:26-178`) that supplies a company name, brand colour,
service categories/rates and sample job titles.

**Contents of a freshly seeded/reset demo**
(`lib/demo/seedDemoContent`, `lib/demo/seedDemo.js:139-311`):
- Business hours, Mon–Fri 8–5 + Sat 9–1 (`seedDemo.js:150-163`)
- 4 fixed sample clients — real-looking names, `@example.com` addresses (an
  IANA-reserved, non-routable domain per RFC 2606), phone numbers in NANP's
  reserved fictional block `555-01XX` (`seedDemo.js:117-122`)
- 4 quotes across the pipeline (draft/sent/accepted×2), 1–2 jobs, 2 invoices
  (`seedDemo.js:174-252`)
- 4 `VoiceCall` rows dressed as a receptionist's call list — summaries only,
  **no `transcript`, no `recordingUrl`** (`seedDemo.js:254-311`; see §6)
- A one-time, capped AI credit grant, $5 worth, exactly once per company
  (`grantDemoAiCredit`, `lib/voice/credits.js:864-874`, called on every
  reset/re-dress — `seedDemo.js:325`)
- `reviewRequestsEnabled: false` forced on every reset
  (`seedDemo.js:359`) — the one communications toggle the seeder actively
  turns off, because it is the one most likely to fire at a seeded address
  on a schedule nobody is watching.

**Who can reach it.** There is no login by default — this codebase has no
server-side sign-up path other than invite (non-negotiable #1), and
`scripts/seed-demos.mjs:9-14` deliberately creates companies, never users. A
platform admin opens one of two ways:
- **"Run the demo"** (`app/platform/demo/page.js:88-113`): mints a
  time-boxed `demo_sandbox` impersonation token from `Company.isDemo` read
  fresh from the DB, and opens `/app` in a new tab. `lib/currentMember.js:74`
  resolves that token to **real owner rights** on the demo company — it has
  to, because building a quote live needs a `createdById` and a role that
  may write (`currentMember.js:104-124`).
- **A real login** (`app/api/platform/demo/login/route.js:44-52`,
  superadmin-only): creates an actual Better Auth user at
  `<slug>@fieldquo.com` and an `owner` membership, for handing a prospect the
  keys for a few days. Email is derived from the slug, never accepted from
  the caller (`login/route.js:88`).

Every write path re-reads `isDemo` from the database rather than trusting an
id from the request — `assertDemo()` in `seedDemo.js:34-51`, re-verified
again in the number-purchase route (`app/api/settings/voice/number/route.js:211-215`)
and the login route (`login/route.js:69-79`). That "re-read, never trust the
caller" pattern is consistent everywhere I looked at write paths — it is the
one discipline this codebase's demo tooling gets right without exception.

---

## 2. How strong is the `isDemo` boundary

Strong on the two channels someone already built a bespoke path for (voice,
Meta/social). **Absent** on two channels a demo can reach through completely
ordinary product usage: crew texting, and any outbound email/SMS triggered
from real data a demo agent types in live.

| Channel | Guarded? | Where |
|---|---|---|
| Retell voice (buy a number) | **Yes** — real purchase refused, replaced with a simulated one | `app/api/settings/voice/number/route.js:215-226`, `lib/voice/demoLine.js` |
| Retell voice (porting) | **Yes** — refused outright, 403 | `number/route.js:216-224` |
| Meta/Instagram publish | **Yes** — real client swapped for a mock, by design | `lib/social/metaConnection.js:88-105`, `lib/social/mockMetaGraphClient.js` |
| AI (OpenAI) spend | **Bounded, not gated** — real calls, real quota, capped by a one-time $5 grant, not by an `isDemo` branch in the spend gate (deliberately — see §5) | `lib/voice/credits.js:825-861` |
| **Crew texting (Twilio number)** | **No guard at all** | `app/api/crew/line/route.js`, `lib/crew/line.js` — grep for `isDemo` returns nothing in either file |
| **Quote/invoice "Send" (Resend email)** | **No guard** — `sendEmail` fires unconditionally | `app/api/quotes/[id]/send/route.js:296` |
| **Appointment-reminder SMS cron** | **No guard** — no `isDemo` filter in the query | `app/api/cron/appointment-reminders/route.js` (grep for `isDemo`/`NOT_DEMO`: zero hits) |
| Booking-page confirmation | Not investigated to a conclusion — no `isDemo`/`sendEmail`/`sendSms` hits in `app/api/booking/[companySlug]/confirm/route.js` itself; likely delegates to a shared sender I did not trace to ground |

**Why the email/SMS paths haven't caused an incident yet — and why that's
luck, not a guard.** The seeded clients use `@example.com` and `555-01XX`
numbers, which are structurally non-deliverable (reserved by RFC 2606 and by
NANP respectively). So today, sending the seeded demo quote by email quietly
fails or bounces, and texting the seeded demo client fails or goes nowhere.
**That is data hygiene, not a code-level gate.** A sales rep demoing "watch
this quote land in your inbox" by typing a prospect's *real* email into the
client record — an entirely normal, expected thing to do live on a call —
and pressing Send hits `app/api/quotes/[id]/send/route.js:296`
(`sendEmail`) with no `isDemo` check anywhere in that route. The email goes
out for real, from the company's own discovered sender
(`lib/email/companySender.js`), carrying the demo's current trade dressing.
Same shape for a real appointment booked live with a real phone number and
the appointment-reminder cron, or a review-request cron if a rep forgets to
re-enable `reviewRequestsEnabled` is even relevant (it's forced off on
reset, but nothing stops a rep flipping it back on mid-demo since the
Settings toggle itself isn't `isDemo`-aware).

**The crew-texting gap is the sharpest one.** `app/api/crew/line/route.js`
lends/buys a **real, billable Twilio number** from FieldQuo's own account
(header comment, `crew/line.js:16-19`: "FieldQuo holds the Twilio account,
buys the numbers and lends one to a company"), the exact same shape as the
voice-number purchase — except the voice path got a dedicated demo
substitute (`lib/voice/demoLine.js`) and this one got nothing. Nothing in
`purchaseCrewLine` (`lib/crew/line.js:305`) or `claimCrewLine`
(`lib/crew/line.js:153`) or the route that calls them
(`app/api/crew/line/route.js:244-421`) mentions `isDemo`. A demo company's
owner, in Settings → crew texting, can claim the shared test line or
purchase a dedicated number exactly like a real company; the route's own
"test" action then calls `sendSms` for real
(`app/api/crew/line/route.js:462-467`) to whatever phone number is on the
member's own `Worker` record. `scripts/check-crew-inbox.mjs` — the build-time
check for this feature — has no `isDemo` assertion in it either (grep: one
incidental match on the unrelated word "demoted").
`lib/demo/seedDemo.js`'s `wipeContent` (§3) does not touch `CrewInboxNumber`,
so — mirroring exactly the problem `demoLine.js`'s own header describes for
the voice number before it was fixed — a crew line claimed during a demo
would survive every reset and keep costing FieldQuo money, attached to a
company that gets re-dressed as a different trade next week.

**Analytics isolation is good but not complete** — see §7, the pricing
benchmark leak.

---

## 3. Can a demo be reset today

Yes, and it's a real, code-verified reset, not a stub. `resetDemo()`
(`lib/demo/seedDemo.js:402-406`) re-verifies `isDemo` via `assertDemo`
(line 403) then calls `applyIndustry()` on the company's current trade.
`applyIndustry` (`seedDemo.js:313-400`) always calls `wipeContent()`
(`seedDemo.js:335`) before writing anything new. `wipeContent`
(`seedDemo.js:58-81`) deletes, in one `$transaction`, in FK-safe
children-first order:

```
Invoice → Job → Quote → Appointment → LeadRequest → Client
→ CompanyServiceCategory → Product → VoiceCall
```
all scoped by `where: { companyId }` (`seedDemo.js:60-77`).

**What guarantees this can't touch a real company:** every entry point —
the reset route (`POST /api/platform/demo` →
`app/api/platform/demo/route.js:62-70`), the re-dress route (`PATCH`, same
file, lines 51-61) — calls straight into `applyIndustry`/`resetDemo`, and
those functions' *first* action is `assertDemo(companyId)`
(`seedDemo.js:314`, `403`), which does a fresh `db.company.findUnique` and
throws a 403 the instant `isDemo` is not `true`
(`seedDemo.js:44-51`). The route itself does zero of its own safety checking
by design ("one guard, in one place, that everything must pass" —
`app/api/platform/demo/route.js:7-10`). The id in the request is just an id;
only the row's own `isDemo` column decides whether it's wipeable. I found no
path that skips this re-read — `resetDemo`, `applyIndustry` and the
login-creation route (`login/route.js:69-79`) each do their own fresh
`findUnique`, independently, rather than sharing a cached result across a
request.

**What survives a reset, deliberately:** `VoicePhoneNumber` and `VoiceAgent`
(the simulated voice line — a routine reseed must never perform an
irreversible release, per the extensive comment at
`app/api/settings/voice/number/route.js:180-196`), and the login/slug/
subdomain (the whole point — a bookmarked `demo3.fieldquo.com` must not
404 after a reset, `seedDemo.js:14-22`).

**What this is not:** a snapshot/restore. It's delete-and-reseed from static
preset data (`lib/demo/industries.js`), which is the right shape for this
use case — there's no "prior state" worth restoring, the presets *are* the
canonical clean state for each trade.

**The one hole in "reset stays confined to a demo tenant":** it's not the
reset logic itself (that's solid) — it's that `wipeContent` has no knowledge
of `CrewInboxNumber` (§2). A demo that claimed a crew-texting number keeps
it forever across resets, exactly the "irreversible release" problem the
voice side already solved and documented.

---

## 4. One demo per rep — does the seeder support that

**No — it supports one shared pool of ten, not per-rep ownership.**
`demoAccounts(count = DEMO_COUNT)` (`lib/demo/industries.js:184-196`) just
generates `demo1`…`demo10` round-robined across industries; there is no
field anywhere — not on `Company`, not on `PlatformAdmin` — that assigns a
demo to a specific salesperson. `listDemos()`
(`seedDemo.js:409-427`) returns every `isDemo: true` company with no owner
filter, and both write routes
(`app/api/platform/demo/route.js:GET/PATCH/POST`) only require
`getCurrentPlatformAdmin` (`route.js:14-18`) — **any** platform admin, not
just a superadmin, and not scoped to "your" demo. `app/platform/demo/page.js`
labels this "One per sales agent" in its copy (page.js:175) but that's a
social convention enforced by nobody clicking the wrong card — nothing stops
two reps opening `demo3` at the same time, one resetting mid-call while the
other is using it live. That's a real collision risk once there are more
reps than demos, or even with exactly ten reps and no assignment step.

**What breaks scaling past ten, concretely:**
- **Nothing structural blocks more than ten.** `demoAccounts(count)` takes a
  count; raising `DEMO_COUNT` and re-running `scripts/seed-demos.mjs`
  (`seed-demos.mjs:23-56`) creates more, and the script is idempotent
  (matched on `slug`, `seed-demos.mjs:29`). So "fifty" is mechanically fine
  for company creation.
- **Reserved-subdomain check is separate and untested here.** I confirmed
  `lib/site/subdomain.js:17` holds `RESERVED_SUBDOMAINS`, but did not check
  whether `demo11`…`demo50` collide with anything already reserved there —
  worth a one-line grep before minting fifty slugs, not investigated further
  per scope.
- **Simulated voice numbers have a real, bounded collision risk.**
  `lib/voice/demoLine.js:44-49`: the fictional block rotates five numbers per
  area code, so simultaneous setup across many demos has "roughly a
  1-in-250 chance" of collision per pair — retried up to `MAX_ATTEMPTS = 5`
  (`demoLine.js:49`). Fine at ten concurrent purchases, fine at fifty
  *sequential* ones; would need attention only if many demos provisioned
  their line in the same instant.
- **No per-rep assignment means no natural sharding of the ten either.**
  With fifty reps and ten demos, "reset to start fresh with the next person"
  degrades to whoever gets there first — there's no queue, no lock, no
  "this demo is in use" indicator anywhere in `app/platform/demo/page.js`.

None of this is a hard blocker to more demo companies existing. It **is** a
blocker to the owner's literal ask ("each salesperson will have one demo
account") — that's an ownership/assignment feature that does not exist yet,
on top of infrastructure that otherwise scales fine.

---

## 5. The AI mock — what a mock has to stand in for, and the cleanest seam

**What the real voice path does today, for a demo, right now:** it is
**not mocked at all** — it's real. `lib/voice/demoLine.js` explicitly keeps
the real Retell agent (`provisionAgent`, same function a paying company's
purchase calls — `demoLine.js:29-32`), a real prompt, real greeting, real
tuning. Only the *phone number* is fictional
(`retell.js:242`, `isSimulatedNumber`), so nobody outside FieldQuo can dial
it. During a live sales call, the current playbook
(`docs/DEMO-VOICE.md:270-291`) routes around that by having the rep dial
**FieldQuo's own real sales line** instead (`lib/platform/salesCall.js`,
`demoInviteNumber()` at line 86) — a genuinely different, generic FieldQuo
Retell agent, not the demo's own dressed persona — and if that isn't set up,
the playbook's fallback is explicit: *"I'm not going to fake a phone call
for you... these particular calls are sample data, so there's no audio to
actually play back"* (`DEMO-VOICE.md:293-329`). That confession is the exact
gap the owner's ask closes: today there is genuinely nothing to press play
on.

**The Meta mock's shape, and whether it transfers.** `mockMetaGraphClient.js`
is selected by exactly one signal, re-derived at call time from the
database, never cached or passed by the caller:
`getMetaConnection(companyId)` reads `Company.isDemo` fresh
(`metaConnection.js:88-95`) and every caller — the publish route, the
scheduling cron — branches on the `mock` boolean it returns, never on
anything the client sent (`mockMetaGraphClient.js:6-11`). That is the right
shape for voice and crew SMS too, **and it's already half-built**: the
webhook/booking side already resolves the *tenant* purely from
`VoicePhoneNumber.e164`
(`lib/platform/salesCall.js:8-14` describes the pattern precisely), so a
mock selector for voice would be: at the one or two places that decide
"real Retell client vs. mock," read `Company.isDemo` fresh from the DB, the
same as `metaConnection.js` does, never trust a flag the caller passed.

**Where it would go wrong if a demo ever reached the real Retell client.**
This is the one place the Meta precedent's warning is sharpest: a live
Retell call is a **real phone conversation with a real human on the other
end** — unlike a Meta post, which fails safely into "nothing published."
A demo company reaching a real Retell agent attached to a real, dialable
number would mean a stranger — anyone who redials a number a prospect
scribbled down after the sales call — reaches an AI receptionist speaking
as a business that may not exist anymore (re-dressed to a different trade
next week), quoting rates the demo preset made up. `demoLine.js`'s entire
design is built around *never letting that number exist* — it's why the
fictional NANP block is the mechanism, not a flag Retell might ignore. Any
mock for the "listen to a recording" feature must not introduce a second,
independent way to reach a live Retell call; it should sit entirely on top
of the existing simulated-number/no-real-number invariant, not next to it.

**Crew SMS ("text crew") is a different feature than it may sound like** —
worth flagging because the brief's phrasing ("phone call and text crew")
could be read either way. What exists under that name is the **crew inbox**
(`lib/crew/inbox.js`): a dedicated Twilio number crew members text photos
to, with AI-assisted job attribution (`lib/crew/attribution.js`,
`lib/crew/inboxLogic.js`) and auto-reply. It is not an AI that *initiates*
texts to crew. §2 already covers why this is the more urgent of the two
gaps: unlike voice, it has **zero** `isDemo` awareness anywhere in its
stack today, real or mocked.

---

## 6. Recorded simulations — what exists to build on

`VoiceCall` already has exactly the fields a canned recording needs:
`transcript Json?`, `summary String?`, `recordingUrl String?`
(`prisma/schema.prisma`, `VoiceCall` model, `6594-6674`, fields at
`6615-6617`). The demo seeder currently populates `summary` only
(`seedDemo.js:254-311`) — `transcript` and `recordingUrl` are left null on
every seeded call, which is exactly what `DEMO-VOICE.md:293-303` tells reps
to be honest about ("no audio to actually play back on these specific
ones").

**How playback works today, for a real call**, and it transfers to a mock
with no code changes:
- The UI never links `recordingUrl` directly — it links
  `callRecordingHref(id)` (`lib/voice/recording.js:33-38`), a same-origin
  path like `/api/voice/calls/{id}/recording`.
- That route (`app/api/voice/calls/[id]/recording/route.js:29-93`) looks up
  the call scoped to the caller's own `companyId` (line 51), checks
  `isFetchableRecording()` (line 60), then **fetches and streams** the
  upstream audio itself rather than redirecting to it (lines 68-93) — so
  the real URL never reaches the browser, and range requests are forwarded
  so the `<audio>` element can seek (line 68 comment, 76).
- `isFetchableRecording()` (`lib/voice/recording.js:78-85`) only checks
  `protocol === "https:"` — **it is not scoped to Retell's domain.** A
  Cloudinary-hosted `https://res.cloudinary.com/.../call.mp3` URL written
  into `VoiceCall.recordingUrl` would play through this exact same route,
  with zero code changes.
- The consuming UI (`app/app/receptionist/page.js:653-655`,
  `app/platform/sales-agent/page.js:344-346`) already renders the Listen
  link/button conditionally on `recordingHref` being present — so seeding
  three calls with real `recordingUrl` + `transcript` values makes the
  existing Listen button work honestly, on the existing screen, with no
  frontend work.

**Where canned audio should live:** Cloudinary, per the stack table in
AGENTS.md (already the product's answer for hosted media, and
`lib/cloudinary.js` — referenced from `lib/crew/inbox.js:16` — is already
in use elsewhere for uploaded content). Three short MP3/WAV files, uploaded
once, referenced by static URL from the seeder.

**What must be true so a demo recording can never be mistaken for a real
customer call** — this is the part that needs a decision, not just
plumbing:
- The `providerCallId` the seeder already writes is prefixed
  `demo-seed-{companyId}-{n}` (`seedDemo.js:296`) — that convention should
  extend to the recording/transcript content itself: a transcript that
  reads as a stock scenario, not a specific address or name that could be
  mistaken for a real lead, mirroring how `metaConnection.js`'s demo ids are
  deliberately shaped to be recognisable at a glance
  (`metaConnection.js:99-101`, "the fixed 'demo_' prefix... is not
  decorative").
- Nothing in the current `VoiceCall` schema marks a row as fabricated the
  way `SocialPost.isMock` does for the Meta mock
  (`prisma/schema.prisma:4030-4036`, "Set once, from Company.isDemo... kept
  even after the row is real again... so an audit trail never has to
  guess"). `VoiceCall` has no equivalent flag. Since every demo-seeded
  `VoiceCall` already lives only on a company with `isDemo: true`, and gets
  wiped every reset, the existing `isDemo` join is arguably sufficient — but
  that's a design call for whoever builds this, not something I should
  decide here.

---

## 7. Metrics isolation — which analytics filter `isDemo`, which don't

**Filter it, and correctly:**
- `lib/analytics/tenantData.js:22` (`NOT_DEMO = { isDemo: false }`) — applied
  to every query feeding the tenant health board: quotes (line 30), jobs
  (line 38), invoices (line 42), companies (line 46), and the trade
  breakdown via `quote.company` (line 59). The file's own header states the
  reason plainly: *"Demo companies are excluded everywhere. They are sales
  fixtures with invented invoices to 'Sarah Mitchell', and they were
  contributing 99% of the old dashboard's money."* (lines 12-14) — this was
  a real, previously-fixed bug, not a hypothetical.
- `app/api/platform/analytics/overview/route.js:44` — same `NOT_DEMO`
  pattern, applied to company counts (144-145, 147, 152), subscriptions
  (159), quotes (177), jobs (191), and payments (`invoice.company`, 221,
  226, 231).
- `app/api/platform/analytics/tenants/[companyId]/route.js:24` — same
  pattern for the single-tenant drill-down (lines 56, 63, 67), and it
  surfaces `isDemo` explicitly in the response (line 110) so the UI itself
  can label a demo row rather than let it pass as a customer.

**Does not filter it — and this is the one that would silently corrupt
something a real customer sees, not just an internal dashboard:**
`lib/analytics/pricingBenchmark.js:26-33`. This is the "what similar
contractors charge" comparison shown to a **real, paying company** in
Settings. `yourGroups` is correctly scoped to the caller's own company
(line 21), but `platformGroups` — the pool the caller's price is compared
against — is `db.quoteScopeGroup.aggregate({ where: { categoryId,
quote: { company: { shareAnonymizedPricing: true } } } })` (lines 26-33),
with **no `isDemo` exclusion at all**. `shareAnonymizedPricing` defaults to
`false` (`prisma/schema.prisma:931`) and `seedDemo.js` never sets it, so
this is silent *today* only because nobody has toggled it on for a demo
company. But nothing stops a rep doing exactly that live, to show off the
feature — plausible, since it's a real Settings toggle a rep would
naturally click through during a walkthrough — and if they do, the demo's
fabricated $95/door cabinet-refinishing rate (`industries.js:47`) or
$525/square roofing rate (`industries.js:141`) permanently joins the
average a **real roofer or cabinet refinisher** sees compared against their
own pricing, until someone notices and flips it back off. This is worse in
kind than a corrupted leaderboard: it's fabricated data leaking into a
paying customer's own decision-making screen, and I found no other filter
anywhere in the call chain that would catch it. Not investigated: whether
`quoteScopeGroup` rows the demo seeder writes even carry a `categoryId` a
real preset's category would match (`seedDemo.js` writes `Product`, not
`QuoteScopeGroup`, directly — so this may depend on whether a live demo
walkthrough that builds a quote through the normal UI generates
`QuoteScopeGroup` rows the way a real company's quotes do; I did not trace
that far).

**No per-rep sales leaderboard or commission tracking exists to check.**
The only rep-facing sales artifact I found is `app/api/platform/reports`
(not investigated in depth — out of scope per the brief, which explicitly
defers RBAC/commissions to other agents) and the `DemoBooking` /
`DemoHostAvailability` system (§ below), which is unrelated. So "must not
count toward sales metrics" currently has nothing built yet that a demo
*could* corrupt on the commission side — the exposure today is entirely on
the platform-wide analytics and the pricing benchmark above.

---

## The other "demo" system — confirmed unrelated

`app/platform/demos/page.js`, `DemoBooking`/`DemoHostAvailability`
(`prisma/schema.prisma:3026-3066`, `77-95`), `lib/demo/slots.js`,
`lib/demo/hosts.js` are **FieldQuo's own inbound sales-call scheduler** —
the "book a call with us" flow a prospect uses from the marketing site to
grab 30 minutes with a `PlatformAdmin` (`DemoBooking.hostAdminId`,
schema line 3051). It shares nothing with the per-rep demo-*company* system
beyond the word "demo" and a coincidental reuse of the same slot-math
library (`lib/demo/slots.js` — its own header confirms this dual use at
lines 27-30). No overlap, no shared state, no risk of confusion in the code
itself — worth naming only because the file paths (`app/platform/demo/` vs.
`app/platform/demos/`) are one character apart and genuinely easy to
conflate when navigating the codebase.

---

## What I could not determine

- Whether `app/api/booking/[companySlug]/confirm/route.js` (or whatever it
  delegates to) sends a real confirmation email/SMS for a demo company on a
  live-booked appointment — I found no `isDemo`/`sendEmail`/`sendSms` inside
  that file itself but did not trace its full call graph to ground.
- Whether `demo11`+ slugs would collide with `lib/site/subdomain.js`'s
  `RESERVED_SUBDOMAINS` set — not checked past confirming the set exists.
- Whether a live demo walkthrough (building a quote through the normal UI,
  not the seeder) produces `QuoteScopeGroup` rows with the same
  `categoryId`s the pricing-benchmark query matches on — relevant to how
  bad §7's benchmark leak could get in practice, not traced to ground.
- The full call graph under `app/api/crew/line/route.js`'s Twilio purchase
  path (whether "purchase" always means a real Twilio buy, or whether the
  default `sharedTestLineE164()` fallback — free, shared — is what a demo
  would hit in practice absent a rep explicitly searching for a dedicated
  number). The header comments describe both a free shared line and a paid
  dedicated one as reachable from the same route; I did not determine which
  a demo owner would default into without deliberately clicking further.
- Any RBAC/commission-tracking scaffolding that might exist elsewhere for
  "which rep owns which demo" — out of scope per the brief, not searched
  exhaustively.
