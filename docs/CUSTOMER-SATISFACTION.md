# Customer satisfaction — the audit, and what got built

The owner's ask, verbatim: *"Customer satisfaction — nothing in the product
asks a client to rate the work. There is no survey to summarise. We have
Google reviews that we can import? Can you check that the functionality is
properly implemented?"*

**Short answer on the Google half: no, it isn't. There is no Google API
integration anywhere in this codebase.** What ships today under Settings →
Reviews is a contractor pasting or CSV-uploading their own reviews by hand.
The owner's belief that Google reviews import doesn't match what's built, and
this doc opens with the evidence rather than the design work, because the
owner is making a decision on the answer.

The second half — building the ask — is Part 3 below.

---

## Part 0 — The audit, verified

Verified by reading every file the brief named, plus a grep sweep, before
writing anything else:

**`app/api/settings/testimonials/import/route.js`** is a CSV/paste importer.
The browser sends raw text; Papa Parse runs server-side; every imported row
lands with `approved: false`. Its own header comment: *"A hundred rows land
from a file nobody has read line by line ... Approval is a separate, visible
act."* Nothing here talks to Google.

**`lib/reviews/testimonials.js`** (the parser behind that route) says it
plainly in its own comments: header spellings are matched against *"Google
Takeout, the reviews tab of every review-widget product, and a spreadsheet
someone typed by hand."* Google Takeout is a *manual export a contractor
downloads and pastes in* — not an API call FieldQuo makes.

**`lib/reviews/mergeReviews.js`** and **`lib/reviews/publicReviews.js`**
reconcile exactly two sources, and neither is Google: the `Testimonial` table
(written by the importer above, or typed in one at a time) and the website
builder's own block JSON (`app/data/siteBlocks.js`, a contractor typing a
quote under "What clients say"). The merge file's own header: *"The two
places a company's reviews can live."* Two, not three.

**`app/api/cron/review-requests/route.js`** doesn't touch Google either. It
emails a past customer a link to `Company.reviewUrl` — *"Deliberately
permissive about WHICH site — Google, Facebook, Yelp, HomeStars, a Trustpilot
page ... are all legitimate"* (`lib/reviews/request.js`). It asks a human to
go leave a review somewhere; it never reads one back.

**`lib/legal/processors.js`** is the strongest negative evidence. Every real
third-party integration in this product has an entry here — the file's own
header explains why: *"a processor can't be added to the product without the
same PR having to touch this file for the check to keep passing"*
(`scripts/check-legal-pages.mjs` enforces it). There are three *other* Google
products listed — `google-maps` (address autocomplete), `google-solar` (roof
measurement), `youtube` (marketing video embeds) — and grepping the whole
processor list for anything naming Business Profile, My Business, or Places
reviews turns up nothing. A real Google reviews integration would have to add
an entry here for the build to keep passing its own legal-pages check. None
exists.

**`grep -rn "PLACES\|place_id\|placeId\|mybusiness"`** across `app/` and
`lib/` returns zero hits in application code — the only hits are in
`docs/ROADMAP.md` (below) and translated UI copy telling a contractor how to
find *their own* Google review link by hand
(`app.setReviews.linkHelp`: *"Usually your Google review link. On your Google
Business Profile, choose 'Ask for reviews' and copy the short link."*).

**Conclusion: my preliminary finding was correct.** "Importing Google
reviews" is, today, a contractor pasting them in — a real, useful feature,
correctly built (unapproved-by-default, deduped, re-import-safe), but not an
API integration and not automatic.

### The research on a real integration already exists — and the owner may not have seen it

This is the part worth surfacing directly: `docs/ROADMAP.md` already carries
a full write-up, **"Google Business Profile review import (researched,
blocked, not started),"** dated from an earlier session. It is thorough and
still accurate; I am not redoing that research, I am confirming it and
pointing at it, because duplicating it here is exactly the "copy that rots"
AGENTS.md warns about (the two would drift the first time either one gets
updated). Its conclusions, compressed to what changes the decision:

1. **Reviews are served only by Google's legacy v4 My Business API** — the
   modern split-out APIs (Account Management, Business Information,
   Performance) don't carry reviews at all, and much of v4 is deprecated.
2. **Access isn't self-serve.** FieldQuo would have to submit a "Basic API
   Access" application from an email that owns/manages a Google Business
   Profile *verified and active for 60+ days*, quoting a Cloud project
   number. Quota starts at **zero** until Google approves it — *"If your
   quota limit for the Google Business Profile API is 0, you have not yet
   been granted access,"* per Google's own docs. Turnaround: days to weeks,
   with no sandbox and no partial capability beforehand.
3. **The constraint that actually decides it:** Google's Business Profile API
   Policies forbid storing fetched review content beyond a **30-day,
   performance-only cache** — no permanent copy, no editing, no reordering.
   A `Testimonial` row is permanent, editable, and reorderable by the
   contractor. **Google review content cannot legally become a `Testimonial`
   row.** The compliant shape is a different feature entirely — a
   `GoogleReview` model, refreshed inside the 30-day window, rendered with
   Google attribution, purged when a refresh stops returning it — and nothing
   in this codebase should ever write `Testimonial.source: "google"` until
   that shape is built and the access above is granted.
4. A second, independent review queue (sensitive OAuth scope verification)
   gates the consent screen even after API access is approved.

**My read on the owner's question, given that research stands unchanged:**
don't build a "Connect Google" button. It would either sit dead until an
access application clears (weeks, maybe longer, and not started), or —worse—
get built against the wrong shape and have to be torn out once someone reads
the storage policy. The honest, shippable half of "customer satisfaction"
that doesn't depend on Google clearing an application is the one-question
survey below, which is FieldQuo's own data, collected today, with no API
approval standing between the owner and a real number.

If the owner still wants the Google Business Profile application filed, that
is a real product decision with a real timeline (weeks, contingent on
FieldQuo's own Business Profile being 60+ days verified) — worth a
conversation, not a default I should make silently.

---

## Part 1 — Where `lib/analytics/kpis.js` stood

Its own header names the trap directly: *"Nothing in the product asks a
client to rate the work. There is no survey to summarise."* — one of six
entries in `NOT_TRACKED`, the file's list of metrics it deliberately refuses
to invent a number for rather than fake. That sentence is now false, and the
entry is gone — see Part 3.

---

## Part 2 — The survey: design decisions, in the order they were forced

**One question, optionally one comment.** A 1–5 scale, not a thumbs-up/down
(loses "satisfied but not delighted") and not a 0–10 NPS scale (asks someone
standing in their kitchen to hold an eleven-way distinction in their head).
Five taps, one glance. The comment is genuinely optional and never blocks the
score — a client who taps "2" and closes the tab has told the contractor
something real.

**It rides the existing review-request cron — no second mailing system.**
`app/api/cron/review-requests/route.js` already has the right shape for this
exact problem: hourly, a per-company configurable delay
(`Company.reviewDelayHours`), a once-only claim on `Job.reviewRequestedAt`
that survives overlapping runs. Building a second cron with its own timing
and its own dedup logic would be the same bug class twice — two systems that
can independently drift on "did we already ask this person." Instead, the
five rating links are embedded directly in the existing "how did we do?"
email (`lib/reviews/reviewEmail.js`), gated by the exact same eligibility
check (`shouldRequestReview`), claimed by the exact same
`reviewRequestedAt` write.

**The trade-off this decision costs, named rather than hidden:** because the
survey rides `shouldRequestReview`, and that function refuses to send when
`Company.reviewUrl` is unset (*"a review request with nowhere to go is worse
than none"*), **a company that hasn't configured a public review link also
collects no satisfaction data.** That's a real gap for a company just
starting out. I did not loosen `shouldRequestReview`'s reviewUrl requirement
to fix it — that function is small, already carries real production traffic,
and is exercised by `scripts/check-reviews.mjs`; changing its contract to
special-case "send for the survey half only" felt like exactly the kind of
scope change AGENTS.md says to ask about rather than pick unilaterally. If the
owner wants satisfaction collected independent of a review link, that's a
follow-up with its own review of `shouldRequestReview`'s callers.

**White-labelled, and measured, not assumed.** The survey page
(`app/survey/[token]/SurveyForm.js`) and the rating row in the email both
derive every colour from `lib/documents/theme.js`'s `documentTheme()` for the
company's own brand hex — no FieldQuo branding anywhere on either surface.
Two different pairings are in play and both are the ALREADY-CORRECTED ones,
not the naive raw accent:

- The five rating chips use `neutralPair()` — grey, brand-independent,
  5.08:1 on every brand colour tested (measured, not assumed: see
  Verification below). Chosen over the brand accent deliberately: five
  identically brand-coloured buttons next to the email's existing "Leave a
  review" button would read as five more CTAs on a page that already has one.
- The selected-score button on the survey page, and the review email's
  existing "Leave a review" button, both use `fillPair()` — the function that
  moves the FILL for a mid-tone brand colour (mid grey, olive, mid blue) that
  would otherwise land at ~4.3:1 against both black and white, which no
  choice of foreground fixes. I made the same mistake this file warns about
  on the first draft of the survey page — wired the selected button straight
  to `documentTheme().accentFill`/`.accentOn`, the raw uncorrected pair — and
  caught it before shipping by reading `fillPair`'s own comment about exactly
  that failure. Fixed by computing `fillPair()` server-side (in
  `app/api/survey/[token]/route.js`) and sending the ALREADY-SAFE pair to the
  client, the same way the review email does.

**It keeps the language it was sent in.** `SatisfactionResponse.language` is
stamped at creation from `resolveClientLanguage()` — the same precedence
`Quote.language` uses (document > client > company default > English) — and
never re-read from the client's current preference. A client who changes
their saved language between the email landing in their inbox and them
tapping it a week later still sees the survey in the language it was sent in,
matching AGENTS.md non-negotiable #6 exactly. All client-facing copy (the
email's rating row, the survey page, the not-found page) is translated in
every language the client-facing catalogue covers — en, fr, es, uk, pa, tl,
matching `lib/i18n/documentLabels.js` and `lib/i18n/emailCopy.js` — in
`lib/reviews/satisfaction.js`'s `surveyCopy()`. These are careful, plain
translations of short transactional copy, not reviewed by a native speaker —
the same honesty limit `documentLabels.js`'s own header states for itself.

**CASL classification: commercial, riding a commercial email's existing
consent machinery — no new decision needed.** The review-request email this
rides in is already classified COMMERCIAL in
`lib/marketing/unsubscribe.js`'s own header: *"asking a past customer to
promote the business publicly is outreach on the business's behalf, not a
message needed to complete something already in motion."* A satisfaction
question is the same category for the same reason — it's discretionary
post-service outreach, not delivery of something the client is owed, and it
sits in literally the same email as the already-classified ask. So it
inherits, rather than needs a second classification: the recipient is
resolved through `ensureSubscriber()` before either the review ask or the
survey link is built, the send is checked against a prior opt-out
(`subscribed !== false`), and the same visible unsubscribe footer plus
RFP 8058 `List-Unsubscribe`/`List-Unsubscribe-Post` headers cover both asks
in one email. No separate unsubscribe surface for "just the survey" — a
client who opts out of review requests correctly stops receiving the
satisfaction ask too, since they're the same send.

**A reused/guessed token cannot cast a second vote, and a link-scanner
cannot cast one at all.** Same GET-reads/POST-mutates split as
`app/api/unsubscribe/[token]/route.js`, for the identical reason stated
there: Outlook Safe Links and similar pre-fetch every href in a delivered
email with a plain GET. If the GET itself recorded a score, every scanned
inbox would silently vote before a human opened the message. So: the five
email links are plain GETs to `/survey/[token]?score=N` that write nothing —
they only pre-select which number is lit up on the page. The actual write is
a POST, gated by a conditional `updateMany({ where: { respondedAt: null } })`
— the same claim pattern `Job.reviewRequestedAt` already uses — so two
concurrent submits (a double-tap, a retried request) can't let the second
overwrite the first person's real answer, and a reused token after an answer
already exists is a no-op that returns "thanks, already recorded" rather than
silently overwriting.

**A survey for a deleted job disappears, not 404s ambiguously.**
`SatisfactionResponse.jobId` is `onDelete: Cascade`. `Job` rows CAN be
deleted (`app/api/jobs/[id]/route.js` DELETE — only when the job carries no
logged hours or tasks, which is exactly the shape a job with an already-sent
survey and no other activity could have). If that happens, the survey row
goes with it, the token resolves to nothing, and `app/survey/[token]/page.js`
renders a real 404 (`notFound()`) with a generic, company-agnostic message —
same reasoning `app/q/[token]/not-found.js` already states: *"no explanation
of WHY the link failed ... a stranger holding a bad URL has no claim to"*
which company it was.

**A low score is learned quickly — but I did not build an escalation.**
The KPI's envelope carries `raw.lowScoreCount` (scores of 1 or 2) and the
dashboard surfaces it as a plain sentence next to the distribution chart —
*"N of these rated 1 or 2 — worth a follow-up call."* That's it. No
automatic SMS to the contractor, no auto-created task, no alert cron. The
brief explicitly asked for this restraint (*"do not build an escalation
nobody asked for"*), and a real escalation is a product decision with real
edge cases attached — how urgent, who gets notified, does it interrupt a
crew mid-job, does a contractor with fifty jobs a week want fifty
notifications — none of which I should pick unilaterally. **What I would
build, if asked:** a `NotificationRule`-style entry (the schema already has
this pattern for other trigger events) firing a single internal notification
— not an SMS/email to the contractor, just a flagged row on the dashboard's
"needs you" surface — the moment a response lands with `score <= 2`, so a bad
week isn't discovered in a monthly roll-up. Deliberately not built this
session.

---

## Part 3 — The KPI, wired honestly

`lib/analytics/kpis.js` gained `buildCsat()`, following the file's own
envelope exactly: `{ value, sampleSize, incomplete, reason, reasonText }`,
plus `raw: { counts, lowScoreCount }` for the dashboard's distribution chart.

**Floored at `COUNT_FLOOR` (5), not `RATE_FLOOR` (10).** The file's own
header draws the line: `RATE_FLOOR` is for a percentage over a large decided
population (win rate); `COUNT_FLOOR` is for a central figure drawn from a
handful of jobs (average job value, the margin figures) — an average IS the
claim here, the same shape as those, not a share of a binary outcome.

**Two reason codes, both closed-vocabulary, neither hardcoding a number:**
`no_survey_responses` (zero answers) and the shared `below_floor` (1–4
answers, same generic sentence six other KPIs on this page already reuse).
`REASONS.no_survey_responses` carries `{floor}` as a placeholder the same way
every other floor-bearing reason does — never a typed digit, so it tracks
`COUNT_FLOOR` automatically if that constant ever changes.

**Read side mirrors the write side's honesty.** The query
(`app/api/analytics/kpis/route.js`) only counts `respondedAt: { not: null }`
rows — a `SatisfactionResponse` is created the moment the email sends, before
anyone has answered, and counting unanswered rows would silently understate
the average toward whatever a blank score defaulted to. `buildCsat()` itself
re-validates every score (`Number.isInteger(n) && n >= 1 && n <= 5`) rather
than trusting the database shape, so a hostile or malformed row can't move
the average — same defence-in-depth `lib/reviews/satisfaction.js`'s
`parseScore()` already applies on the write side.

**No new permission gate.** It piggybacks on the KPI dashboard's existing
all-or-nothing gate (`jobs: view_only`, company-wide) — the same reasoning
the route's own header gives for every other figure on the page: a partial
render that silently drops one card for some roles is the "appears to work"
failure AGENTS.md forbids on this specific page.

---

## Verification — real inputs, real outputs

Two throwaway scripts (written, run, deleted per AGENTS.md convention) plus
permanent assertions added to the existing suite.

### `parseScore` against hostile input

```
parseScore(0)      -> null      parseScore(6)      -> null
parseScore(-1)     -> null      parseScore(null)   -> null
parseScore("")     -> null      parseScore(NaN)     -> null
parseScore(Infinity) -> null    parseScore("abc")  -> null
parseScore("3.5")  -> null      parseScore(3.5)     -> null
parseScore("0x3")  -> null      parseScore("1e1")   -> null
parseScore("1")    -> 1         parseScore("5")     -> 5
parseScore("  3  ")-> 3         parseScore("+3")    -> 3
```

`"0x3"` and `"1e1"` are the real find here, not a hypothetical: the first
draft handed strings straight to `Number()`, which happily parses `"0x3"` as
`3` (JS's hex-literal rule) and `"1e1"` as `10` — either would have let
`?score=0x3` in a survey URL slip a value past a check that only ran
`Number.isInteger()` *after* the conversion. Fixed by requiring a string to
match `/^[+-]?\d+$/` before it's ever handed to `Number()`.

### `buildCsat` at every boundary point, printed not just asserted

```
csat — 0, 1, floor-1, floor, floor+1 answered surveys
  0 answered → null (no_survey_responses): "No client has answered the
    satisfaction survey yet. Once {floor} have, this shows here."
  1 answered → null (below_floor): sampleSize=1, floor=5, remaining=4
  4 answered → null (below_floor): sampleSize=4, floor=5, remaining=1
  5 answered → 5 / 5   (a real average, no reason)
  6 answered → 5 / 5

mixed [1,2,3,4,5] at exactly the floor → 3.0
  raw.counts = {1:1,2:1,3:1,4:1,5:1}, raw.lowScoreCount = 2

hostile rows [0, 6, -1, null, NaN, 3.5, 5×5] → sampleSize=5, value=5
  (only the five real 5s counted; the same hostile set with only four real
  5s stays below_floor at sampleSize=4 — the junk rows never pad the count up)
```

### Contrast, measured across ten hostile brand colours (need ≥ 4.5:1)

```
Rating chips (neutralPair — brand-independent):
  every colour tested → #f3f4f6 on #626875 = 5.08:1  (constant, by design)

Selected-score button / "Leave a review" button (fillPair):
  school-bus yellow  #20242b/#ffffff = 15.57:1   mid grey  #8d8d8d/#0b1a2e = 5.27:1
  pure black         #000000/#ffffff = 21.00:1   safety orange #FF6600/#0b1a2e = 5.95:1
  navy               #001F3F/#ffffff = 16.56:1   default-ish blue #2563EB/#ffffff = 5.17:1
  hot pink           #FF1493/#0b1a2e = 4.81:1     (the tightest margin of the ten — still clears)
```

### `check:kpis` and `check:reviews` — permanent assertions added, mutation-tested

`scripts/check-kpis.mjs` gained the boundary tests above (as real
assertions, not just console output), an `EMPTY.customer.csat` check in the
existing "nothing at all" fixture, a fixed `NOT_TRACKED.length` assertion
(was hardcoded to 6, now 5 with an explicit check that `csat` is gone from
the list), and two new mutations:

```
✓ caught: drops the sample floor on customer satisfaction, printing an
  average from a single answer
✓ caught: lets an out-of-range score (0, 6, a negative number) into the
  csat average
✓ all 17 mutants caught (15 pre-existing + 2 new)

PASSED — 201/201 assertions
```

`scripts/check-review-email.mjs` gained assertions for the rating row: absent
by default, present and carrying exactly five links (1–5, never 0 or 6) once
a `surveyToken` is passed, chip contrast across the same ten hostile brand
colours as the existing button test, the prompt rendering in the survey's
own language, and escaping holding with an XSS attempt present alongside a
real rating row. One real bug found and fixed while writing this test: the
rating links used `safeUrl()` (protocol-prefix check only) but not
`escapeAttr()` before landing inside `href="..."` — `lib/email/emailTheme.js`'s
own header states the rule (*"escapeAttr for anything landing inside a
quoted attribute"*) and the survey links weren't following it. In practice
unreachable — `newSurveyToken()` only ever emits base64url characters, never
a quote — but fixed as defence-in-depth rather than left as a should-never-
happen gap.

```
ALL PASS — 46 passed, 0 failed
```

### `npm run check:all` and `npm run build`

Both run in the foreground, both exit 0. `check:all` chains ~200 scripts with
`&&`; a single non-zero exit anywhere would have stopped the chain short of
its last script, and it reached the end (`95 checks, 0 failure(s)` on the
final suite in the chain). `next build` compiled successfully, `prisma
generate` ran clean against the additive schema change, and both
`/survey/[token]` and `/api/survey/[token]` appear correctly in the route
manifest as dynamic routes. The only build warnings present (a Turbopack
workspace-root note and a pre-existing Tailwind `env(safe-area-inset-bottom)`
CSS warning) predate this change and are unrelated to it.

`npx prisma validate` passes against the new `SatisfactionResponse` model.
`npx prisma db push` was deliberately never run, per the task's constraint —
the schema change is additive and nullable throughout and has not touched
the real database.

---

## What did not get built, named rather than left implicit

- **No Google Business Profile API integration.** Blocked on Google's own
  approval process and, even if approved, on a 30-day non-permanent storage
  policy that rules out the shape "import into `Testimonial`." Fully
  researched already in `docs/ROADMAP.md`; not re-litigated here.
- **Satisfaction surveys are not sent to companies without a `reviewUrl`
  set**, because the feature rides `shouldRequestReview`'s existing gate
  rather than loosening it. Named as a real gap above, not silently
  accepted.
- **No escalation on a low score** beyond a dashboard sentence — no SMS,
  email, task, or notification fires automatically. Described above as what
  I'd build if asked; deliberately not built this session, per the brief.
- **No native-speaker review** of the six-language survey copy in
  `lib/reviews/satisfaction.js`, matching the same honesty limit
  `lib/i18n/documentLabels.js`'s own header already carries for the rest of
  the client-facing catalogue.
- **The KPI dashboard's own UI strings** (`app.kpis.customer.*`,
  `app.kpis.csat*`, the new reason key) are English and French only, matching
  the existing, deliberate precedent for that whole page and namespace
  (`app/i18n/appMessages.js`'s header: the app interface catalogue is
  English/French by design, reported-not-gated for the other four languages)
  — not a new gap, the existing one extended consistently.
