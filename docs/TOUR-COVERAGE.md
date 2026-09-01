# Onboarding tour coverage

This session's job: `docs/health/10-tour.md` translated the 24 existing tours
into six languages but could add none of the missing ones — every candidate
page had no `data-tour` anchor, and touching those pages was out of scope
while other agents were mid-edit on them. That constraint is lifted here.
This file records what was added, to what element, what was deliberately
left alone, and — because this session has no browser — what was never
actually seen render.

**Read this alongside `app/components/tours.js`'s own header**, which
documents the `key`/`match`/`steps`/`openWith`/`closeWith` contract. Nothing
here deviates from it.

---

## Every tour, after this session

33 tours, 70 steps. 24 pre-existing (23 unchanged, 1 changed), 9 new.

| Key | Page | Steps | Status |
|---|---|---|---|
| `welcome-v1` | `/app` | 5 | existing, unchanged |
| `leads-v1` | `/app/leads` | 3 | existing, unchanged |
| `funnels-v1` | `/app/funnels` | 1 | existing, unchanged |
| `funnel-builder-v1` | `/app/funnels/[id]` | 2 | existing, unchanged |
| `booking-fee-v1` | `/app/settings/booking-page` | 1 | existing, unchanged |
| `quotes-v1` | `/app/quotes` | 3 | existing, unchanged |
| `quote-new-v1` | `/app/quotes/new` | 3 | existing, unchanged |
| `estimate-reviews-v1` | `/app/estimate-reviews` | 1 | existing, unchanged |
| `jobs-v1` | `/app/jobs` | 3 | existing, unchanged |
| **`job-builder-v2`** | `/app/jobs/[id]` | **4** (was 3) | **changed** — one step added, key bumped so everyone sees it again |
| `invoices-v1` | `/app/invoices` | 3 | existing, unchanged |
| `invoice-new-v1` | `/app/invoices/new` | 3 | existing, unchanged |
| `appointments-v1` | `/app/appointments` | 2 | existing, unchanged |
| `tasks-v1` | `/app/tasks` | 2 | existing, unchanged |
| `marketing-v1` | `/app/marketing` | 2 | existing, unchanged |
| `availability-v1` | `/app/settings/availability` | 2 | existing, unchanged |
| `scheduler-v1` | `/app/scheduler` | 2 | existing, unchanged |
| `schedule-v1` | `/app/schedule` | 1 | existing, unchanged |
| `expense-tracking-v1` | `/app/settings/expense-tracking` | 3 | existing, unchanged |
| `payroll-v1` | `/app/payroll` | 2 | existing, unchanged |
| `time-off-v1` | `/app/time-off` | 1 | existing, unchanged |
| `timesheets-v1` | `/app/settings/team/timesheets` | 3 | existing, unchanged |
| `voice-v1` | `/app/settings/voice` | 3 | existing, unchanged |
| `payments-v1` | `/app/settings/payments` | 2 | existing, unchanged |
| **`receptionist-v1`** | `/app/receptionist` | 2 | **new** |
| **`ai-credit-v1`** | `/app/settings/ai-credit` | 2 | **new** |
| **`marketing-designer-v1`** | `/app/marketing/designer` | 1 | **new** |
| **`marketing-designer-editor-v1`** | `/app/marketing/designer/[id]` | 2 | **new** |
| **`kpis-v1`** | `/app/analytics/kpis` | 2 | **new** |
| **`website-v1`** | `/app/settings/website` | 1 | **new** |
| **`crew-inbox-v1`** | `/app/crew-inbox` | 1 | **new** |
| **`plans-v1`** | `/app/plans` | 1 | **new** |
| **`refer-v1`** | `/app/settings/refer` | 1 | **new** |

New-tour average: 13 steps / 9 tours ≈ 1.4 — leaner than the existing
average (just over 2), on purpose. See "What I deliberately kept short"
below for why each one stops where it stops.

---

## Anchors added

Every `data-tour` value below did not exist before this session. Each is
placed on an element that renders unconditionally once its page has loaded
— not on a row, card or panel that depends on the account already having
data, per the brief's warning about a spotlight landing in the corner on an
empty account.

| Anchor | File | Element | Always renders because |
|---|---|---|---|
| `receptionist-header` | `app/app/receptionist/page.js` | the `<div>` wrapping the page's `<h1>`/subtitle | page chrome, not data |
| `receptionist-settings` | same file | the "Settings" / "Set it up" `<Link>` | always present regardless of setup state (only its label text changes) |
| `ai-credit-voice` | `app/app/settings/ai-credit/page.js` | the "Phone credit" `<Card>` (via a new `tour` prop on the shared local `Card`) | balance shows `$0.00`, never disappears |
| `ai-credit-ai` | same file | the "AI image credit" `<Card>` | same — a zero balance still renders the card |
| `job-photos` | `app/components/jobs/JobPhotoTimeline.js` | the `<section>` wrapping "Photo record (n)" | this component was already rebuilt (see its own header comment) to render with zero photos — "Nothing filed yet" — instead of returning `null`, specifically so an empty job isn't invisible |
| `designer-new-campaign` | `app/app/marketing/designer/page.js` | the new-campaign `<form>` | above the campaign list, not inside it |
| `designer-ratios` | `app/components/designer/CampaignEditor.js` | the ratio-tab `<div>` in the top bar | fixed chrome, not canvas content |
| `designer-download` | same file | the "Download all formats" `<button>` | same top bar; disabled (not hidden) before the editor is ready |
| `kpis-period` | `app/app/analytics/kpis/page.js` | the period-preset `<div>` | rendered before the data fetch even resolves |
| `kpis-not-tracked` | same file | the "Not tracked" `<section>` | unconditional once `data` loads — this section is a static list, not a data-dependent card |
| `website-publish` | `app/app/settings/website/Builder.js` | the Publish/Update `<button>` in the top bar | only in the "site already exists" render branch — see the caveat below |
| `crew-inbox-header` | `app/app/crew-inbox/page.js` | the `<div>` wrapping the page's `<h1>`/subtitle | page chrome; the setup panel below it can return `null` for some access levels, so the header was chosen over it |
| `plans-new` | `app/app/plans/page.js` | the "New plan" `<Link>` | above the list, not inside it |
| `refer-link` | `app/app/settings/refer/page.js` | the "Your link" card | renders as soon as the referral data loads, before any invite has been sent |

`app/components/jobs/JobCosting.js`, `JobMaterials.js` and `JobTasks.js` —
all three sit directly above `job-visits` on the same page and were the
obvious first place to look for a "job costing" anchor — **got no anchor**.
Each `return`s `null` on a job with nothing recorded yet (see their own
comments), and a brand-new job is exactly that state. Wrapping them in a
container wouldn't fix it: an empty wrapper still measures `{0,0,0,0}` and
`OnboardingTour.js` correctly treats that as "not there" and skips the step
— which is honest, but means the step would silently never show for the one
audience (a first job) it would matter most for. `job-photos` was chosen
instead because `JobPhotoTimeline` was already rebuilt to never collapse to
nothing.

---

## What I deliberately kept short, and why

- **`receptionist-v1` (2 steps).** The setup/cost-model deep-dive already
  lives in `voice-v1`. This tour only orients: what the log shows (with a
  reminder that cost is printed per call, not just as a running total — the
  "make the cost model obvious" instruction) and where to go to change
  anything.
- **`ai-credit-v1` (2 steps).** One step per wallet. No dollar figures are
  hardcoded in the tour text — the balances and per-item prices already show
  on the cards themselves, live from `lib/ai/imageEconomics.js` /
  `lib/voice/credits.js` via the API, and the brief specifically warned
  against quoting a price the code doesn't hold.
- **`job-builder-v2` (+1 step, 4 total).** Only the photo record got a new
  step — see the JobCosting/Materials/Tasks exclusion above.
- **`marketing-designer-v1` / `-editor-v1` (1 + 2 steps).** Split the same
  way `funnels-v1`/`funnel-builder-v1` already are: the index (start a
  campaign) and the canvas editor (switch sizes, download) are different
  jobs on different routes. Nothing about the fabric-based tool internals
  (layers, filters, the AI sidebar) is toured — that's a deep, desktop-first
  editor and a coach-mark on a canvas tool teaches least where precision
  matters most.
- **`kpis-v1` (2 steps).** Deliberately does not walk any of the fifteen
  charts individually — that's the "tour on every screen is nagging"
  failure by another name. One step is the control that governs the whole
  page (the period picker); the other is the one section that's a
  philosophy rather than a figure ("Not tracked" — FieldQuo refuses to
  invent numbers). `/app/analytics/benchmark` got no tour of its own: it's
  a single-purpose page ("your pricing vs. the anonymized average"),
  already linked from `kpis-v1`'s own page, and self-explanatory once you
  land on it.
- **`website-v1` (1 step).** See the caveat below — only half the page has
  a stable anchor, so this is one step, not the two or three the feature's
  importance might otherwise earn.
- **`crew-inbox-v1` / `plans-v1` / `refer-v1` (1 step each).** All three are
  "real feature, no introduction" rather than "complex feature, needs
  walking through" — a single orienting sentence on the one thing that
  always renders was enough, matching `estimate-reviews-v1` / `schedule-v1`
  / `time-off-v1`'s existing precedent for a single-purpose page.

## What I deliberately left uncovered

- **The website builder's first-run screen.** `Builder.js` renders one of
  two completely different trees: `!hasSite` (a single prompt box, "What
  should your website say?") or the full editor (conversation + live
  preview + the `website-publish` button this tour points at). They share
  no DOM. `website-v1`'s one step only fires for a company that has already
  generated a site at least once; a company mid-first-run sees no tour on
  this visit. The first-run screen already states "Nothing is public until
  you publish it" as plain text, which is the one fact most worth saying —
  so this isn't a silent gap, just a narrower one than ideal. A future
  session could add a second tour keyed to a `data-tour` on the first-run
  prompt box, matched by the same pathname; I didn't, because two tours
  racing to be "the" tour for one route needs `tourForPath`'s single-match
  contract reconsidered, which is a bigger change than this session's scope.
- **Checklists (template library), CSV import, Jennifer, the mobile tab
  bar.** Unchanged from `docs/health/10-tour.md`'s own reasoning — still
  true after this session, see that file.

---

## The `check:translations` anchor-existence gate

Per the brief: an assertion was added to an **existing** check script
(`scripts/check-translations.mjs`, already in the `check:all` chain — no new
entry was added there) rather than a new one. It scans `app/` for every way
this codebase actually attaches a `data-tour` value to an element —

1. a literal `data-tour="x"` / `data-tour='x'` attribute,
2. `tour: "x"` as an object-literal property feeding `data-tour={item.tour}`
   (how `AdminSidebar.js`'s nav rows carry their anchor as data), and
3. a `dataTour="x"` / `tour="x"` JSX prop at a call site (how
   `app/app/settings/voice/page.js`'s and `app/app/settings/ai-credit/page.js`'s
   own local `Card` components pass an anchor through) —

and fails if any tour step's `target` names a `[data-tour='x']` that isn't
among them. `openWith`/`closeWith` (`data-tour-open`/`data-tour-close`) are
reported, not gated — see the script's own comment for why: a first attempt
at gating those too passed its own mutation test by matching
`OnboardingTour.js`'s header comment and `MobileTabBar.js`'s
`document.querySelector('[data-tour-open="nav"]')`, neither of which is the
element that actually renders the attribute. Rather than ship a check that
can pass on a genuinely broken drawer control, that half stays a report.

**Mutation tested twice:**

1. Renamed `JobPhotoTimeline.js`'s `data-tour="job-photos"` to
   `data-tour="job-photos-renamed-for-mutation-test"`. First run of the new
   check **passed anyway** (`every tour target resolves to a real anchor`,
   exit 0) — it turned out to be scanning `app/components/tours.js` itself,
   and the selector string `"[data-tour='job-photos']"` inside `tours.js`'s
   own `target:` field matched the same regex a real attribute would, so
   every tour was "verifying" against its own selector text. Fixed by
   excluding `tours.js` from the scan; re-ran, and it correctly printed
   `job-builder-v2 step 4: target points at data-tour="job-photos", which
   nothing in app/ renders` and `process.exitCode = 1`.
2. That fix also broke real, correctly-existing anchors: `nav-estimate-reviews`,
   `nav-ai`, `nav-settings` (all `tour: "x"` data properties in
   `AdminSidebar.js`) and `voice-number`/`voice-credit`/`voice-answer` (all
   `dataTour="x"` props in `app/app/settings/voice/page.js`) started
   reporting as missing, because the ONLY place those exact strings had
   been "found" before was — again — their own selector text in `tours.js`.
   Added the `tour:`/`dataTour=`/`tour=` patterns above to actually detect
   them at their real call sites; re-ran, all three false positives
   cleared.
3. Restored `JobPhotoTimeline.js` from a `cp`-made backup (not
   `git checkout`, per this repo's own standing rule against it) and
   diffed it byte-for-byte against the backup to confirm the restore was
   exact.
4. Ran once more clean: `node scripts/check-translations.mjs` exits 0,
   "every tour target resolves to a real anchor (71 data-tour values found
   in app/)."

---

## Verified

- `node scripts/check-translations.mjs` — exits 0. Marketing (fr/es/uk/pa/tl)
  and app-interface (en/fr) coverage both 100%; the tour-string-shape and new
  tour-anchor-existence assertions both pass.
- `npm run check:nav-audit` — 20 checks, 0 failures.
- `npm run build` — exits 0 (`check-imports` → `check-exports` → eslint →
  `check-env-docs` → `prisma generate` → `next build`; full route manifest
  produced). This worktree had no `DATABASE_URL` at all (not the
  documented "Neon scales to zero" case — there was no `.env` here to scale
  from), which fails `prisma generate` before it ever touches a database; a
  local-only placeholder `.env` (gitignored, not committed, doesn't affect
  any deployment) unblocked it. `prisma generate` reads `schema.prisma` and
  never actually connects.
- `npm run check:all` — run in full; see the session's final report for
  the outcome across its ~250-script chain.

## What I could not verify

No browser in this session — the same honest limitation `docs/health/10-tour.md`
already named for the six-language work. I have not watched a single one of
these 9 new tours open, seen a spotlight land on `[data-tour='ai-credit-voice']`
or any other new anchor, watched the card position itself below vs. above the
target, or confirmed the mobile layout for any of these pages actually keeps
the anchor's rect non-zero on a real phone. Everything above is verified by
static checks (the translation/anchor scripts, the real Next.js build) and by
reading the render path for each anchor (confirming it isn't behind a
conditional that a fresh account would hit) — not by watching any of it work.
