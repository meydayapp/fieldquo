## 10. The onboarding tour

### The language bug, and what changed

`app/components/tours.js` defines 24 first-run walkthroughs (56 steps total),
run by `app/components/OnboardingTour.js` and mounted once by
`app/components/AppTours.js` in `app/app/layout.js`. Every step's `title` and
`body` was a hardcoded English string literal — the only `t()` call in the
whole file was in a code comment, not in the array. A contractor who signed up
in French, Spanish, Ukrainian, Punjabi or Tagalog got their entire first-run
walkthrough in English, in a product whose non-negotiable #6 is explicitly
about respecting the language a document — and by extension, the interface
around it — was created in.

The tour chrome around the steps (the "Skip" / "Next" / "Done" buttons, the
`{n} of {total}` counter, and the close button's `aria-label`) was equally
hardcoded, in `OnboardingTour.js` rather than `tours.js`.

**Why the language provider was not the bug.** `AppTours` is mounted inside
`<LanguageProvider>` in `app/app/layout.js` (confirmed by reading the file),
which itself is fed the signed-in user's `User.language` (falling back to
`Company.defaultLanguage`) by `getAppLanguage()` in that same layout. The
provider and the language resolution were both already correct — `useTranslation()`
was simply never called from the tour's own code path. This is a pure "we built
the string catalogue and the provider, and one component never looked at
either" bug, not a plumbing problem.

**The shape.** `tours.js` is a plain data module — no `"use client"`, no React
tree, imported directly by `scripts/check-translations.mjs` under bare `node`.
It cannot call `t()`. So each step's `title`/`body` were replaced with
`titleKey`/`bodyKey` — string keys into a new `app.tour.*` namespace in
`app/i18n/appMessages.js` — and `OnboardingTour.js` now calls `useTranslation()`
and resolves `t(step.titleKey)` / `t(step.bodyKey)` at render time, the one
place in the render path where the language is actually known. The chrome
strings were switched too: `Skip` is a new `app.tour.skip` key, `{n} of {total}`
is `app.tour.stepCount`, and Next/Done/Close now reuse the pre-existing,
already-six-language `app.action.next` / `app.action.done` / `app.action.close`
keys rather than adding duplicates (AGENTS.md's recurring-failure-class #4).

**Key naming.** Followed the existing convention exactly — flat, dot-namespaced,
`app.<namespace>.<sub>.<field>` (e.g. `app.auth.forgot.sentBody`). Tour keys are
`app.tour.<tourSlug>.<stepSlug>Title` / `...Body`, grouped in the catalogue in
the same order the steps run in `tours.js`, so the two files read side by side.

**Translation quality, not machine paraphrase.** Every one of the 56 strings
was translated with the actual on-screen label it references checked against
`app.nav.*` / `app.settings.*` / `app.leads.*` in `appMessages.js` for that
specific language, not translated word-for-word from the English key names —
this is exactly the trap the file's own comment already documents ("the tour
once said 'Requests' while the menu said 'Leads'"). Concretely: the French
tour calls the Quotes page "Soumissions" and the leads-board convert button
"Convertir en devis" because that is what those elements say on screen in
French (even though the two use different French words for "quote" — an
existing inconsistency in the app catalogue, matched rather than silently
fixed); Spanish uses "Prospectos"/"Cotizaciones"; Ukrainian "Ліди"/"Кошториси";
Punjabi ਲੀਡਸ/ਕੋਟੇਸ਼ਨ; Tagalog "Mga Lead"/"Mga Kotasyon" — each pulled from that
language's real `app.nav.requests` / `app.nav.quotes` string, not invented.

**A content fix landed alongside the translation, using an existing anchor.**
`leads-v1`'s third step (`data-tour="leads-sort"`) now also mentions
drag-to-move — the Leads board has supported dragging a card between columns
(`@dnd-kit/core`, landed per `docs/TODO.md`'s "Landed overnight, 2026-08-31")
since before this session, and the tour never mentioned it. No new anchor was
needed: the step already sits on the toolbar next to the board it describes.
This is the only step whose English wording changed, not just its language.

**Honesty about the four non-French languages.** `app/i18n/appMessages.js`'s
own header documents that the wider `/app` interface (not the tour) is
deliberately English+French complete, with Spanish/Ukrainian/Punjabi/Tagalog
held in `APP_REVIEW_PENDING` — present, machine-drafted, and shown as "needs
review" on the language settings page rather than claimed as finished, because
nobody fluent has cleared them yet. The 56 tour strings in those four
languages were translated carefully in this session (register-matched, terms
checked against the real screen, not run through a generic pass), but they are
still new entries in catalogues this codebase already flags as unreviewed —
they inherit that flag along with everything else in `es`/`uk`/`pa`/`tl`, and
whether to lift the tour namespace out of `APP_REVIEW_PENDING` early is a
product call, not one made here. **`check:translations` gates English and
French only** (same bar as the rest of the app catalogue); the other four are
reported, not gated — this was not changed, and changing it is a product
decision, not a bug fix.

---

### Tours — all 24

| Key | Page | Steps | Status |
|---|---|---|---|
| `welcome-v1` | `/app` | 5 | existed — translated |
| `leads-v1` | `/app/leads` | 3 | existed — translated, one step's body extended to cover drag-to-move |
| `funnels-v1` | `/app/funnels` | 1 | existed — translated |
| `funnel-builder-v1` | `/app/funnels/[id]` | 2 | existed — translated |
| `booking-fee-v1` | `/app/settings/booking-page` | 1 | existed — translated |
| `quotes-v1` | `/app/quotes` | 3 | existed — translated |
| `quote-new-v1` | `/app/quotes/new` | 3 | existed — translated |
| `estimate-reviews-v1` | `/app/estimate-reviews` | 1 | existed — translated |
| `jobs-v1` | `/app/jobs` | 3 | existed — translated |
| `job-builder-v1` | `/app/jobs/[id]` | 3 | existed — translated |
| `invoices-v1` | `/app/invoices` | 3 | existed — translated |
| `invoice-new-v1` | `/app/invoices/new` | 3 | existed — translated |
| `appointments-v1` | `/app/appointments` | 2 | existed — translated |
| `tasks-v1` | `/app/tasks` | 2 | existed — translated |
| `marketing-v1` | `/app/marketing` | 2 | existed — translated |
| `availability-v1` | `/app/settings/availability` | 2 | existed — translated |
| `scheduler-v1` | `/app/scheduler` | 2 | existed — translated |
| `schedule-v1` | `/app/schedule` | 1 | existed — translated |
| `expense-tracking-v1` | `/app/settings/expense-tracking` | 3 | existed — translated |
| `payroll-v1` | `/app/payroll` | 2 | existed — translated |
| `time-off-v1` | `/app/time-off` | 1 | existed — translated |
| `timesheets-v1` | `/app/settings/team/timesheets` | 3 | existed — translated |
| `voice-v1` | `/app/settings/voice` | 3 | existed — translated |
| `payments-v1` | `/app/settings/payments` | 2 | existed — translated |

**No tour was added.** See the next section for why — every candidate page
that would need one has no `data-tour` anchor, and the brief for this session
is explicit that adding anchors to other pages is out of scope (those files
belong to other agents running in parallel). I confirmed this is not an
oversight: every `data-tour` attribute that exists anywhere in the codebase
(grepped across `app/`) is already consumed by one of the 24 tours above —
there is no unused anchor sitting idle that a new tour could point at.

---

### Features and pages with NO tour, ranked

This is the part the owner explicitly asked for. Ranked by how badly a new
contractor needs it in week one.

| Priority | Feature / page | Why it matters | Anchor status |
|---|---|---|---|
| **High** | AI receptionist call log — `/app/receptionist` | Where a contractor actually reviews what the AI answered and who called. `voice-v1` covers *setting up* the receptionist (`/app/settings/voice`); nothing covers this page, which is where the payoff is checked. | **Needs an anchor** — none present. |
| **High** | Job costing, materials, checklists and the photo record — inside `/app/jobs/[id]` (`JobCosting`, `JobMaterials`, `VisitChecklist`, `JobPhotoTimeline`, `JobPhotoCurator` components) | Recently-landed, money-relevant features (job costing and the photo record both shipped per `docs/TODO.md`'s "Landed" log) that render on the *exact same page* `job-builder-v1` already tours — but that tour stops at status/client/visits and never reaches them. The natural, lowest-friction fix. | **Needs an anchor** — these components render with no `data-tour` of their own; `JobDetail.js` is one of the files other agents are currently working in, so none was added here. |
| **Medium-High** | AI credit & top-ups — `/app/settings/ai-credit` | New metered spend a contractor can run out of mid-month; the counterpart voice-credit step already exists for phone minutes, this is the same idea for AI usage and has nothing. | **Needs an anchor**. |
| **Medium** | Marketing Designer — `/app/marketing/designer` | The multi-ratio ad-creative canvas editor, its own nav row per `AdminSidebar.js` — a real tool, not a stub, with no walkthrough. | **Needs an anchor**. |
| **Medium** | Insights / KPI dashboard — `/app/analytics/kpis`, `/app/analytics/benchmark` | `AdminSidebar.js`'s own comment notes KPIs was "built and then unreachable" once already (nav-wise) — the same page has never had a tour either. | **Needs an anchor**. |
| **Medium** | Website builder — `/app/settings/website` | Free-tier contractors' public site; AGENTS.md flags this file's own history of shipped-but-broken controls (Regenerate destroying photos), which makes a walkthrough more valuable here than most settings screens, not less. | **Needs an anchor**. |
| **Medium** | Crew inbox — `/app/crew-inbox` | Its own nav row under Grow; texting-based crew coordination is a distinct workflow from anything toured today. | **Needs an anchor**. |
| **Low-Medium** | Service plans — `/app/plans` | Recurring-revenue feature (maintenance plans); real but not week-one-critical for a brand new account with no clients yet. | **Needs an anchor**. |
| **Low-Medium** | Checklists (template library) — `/app/settings/checklists` | Feeds `VisitChecklist` on the job page above; the template screen itself is a straightforward CRUD list. | **Needs an anchor**. |
| **Low** | Referrals — `/app/settings/refer` | Self-explanatory single-purpose page ("send an invite, you both get a month free"); low onboarding risk. | **Needs an anchor**. |
| **Low** | Jennifer, the support assistant | A floating panel (`JenniferPanel`, mounted app-wide), not a page — discoverable by its own visible trigger, and a coach-mark pointing at floating chrome is a weaker pattern than the spotlight tours use elsewhere. | No page to anchor to; would need its own trigger-button treatment, different in kind from the rest of `tours.js`. |
| **Low** | CSV import — `/app/leads/import`, `/app/clients/import` | One-off actions reached from an in-page "Import" button on pages that already have tours; the import screens themselves are single-purpose forms. | **Needs an anchor**, but low value even if it existed. |
| **Low** | Mobile bottom tab bar (`MobileTabBar.js`) | Reuses the *same* nav labels (`app.nav.requests/quotes/jobs/invoices`) the welcome tour already spotlights via the drawer — it is a second presentation of destinations already toured, not an untoured feature. | Chrome, not a page; not a meaningful gap. |

### What I deliberately left alone, and why

Roughly 20 more `/app/settings/*` pages (company, branding, custom fields,
work areas, notifications, email domain, follow-ups, lead form, bio link,
quote email, PDF templates, translations, products, services, overhead,
cabinet rates, material costs) have no tour either. All are single-purpose
settings forms already gestured at by `welcome-v1`'s last step ("Branding,
services, pricing, payments... all live in Settings — worth 10 minutes up
front"). AGENTS.md's own instruction for this task — "a tour on every screen
is nagging, not onboarding" — is why these are not in the table above: adding
24 more one-step tours would teach contractors to click through coach-marks
without reading them, which is the exact failure `schedule-v1`'s own code
comment already warns about elsewhere in this file.

### Anchors I could not add

Every "Needs an anchor" row above. Per this session's scope, only
`app/components/tours.js`, `app/components/OnboardingTour.js`,
`app/i18n/appMessages.js`, `scripts/check-translations.mjs`, and this report
were touched — no `data-tour` attribute was added to any page component,
because those files belong to other agents working in parallel right now.

### The regression guard

`scripts/check-translations.mjs` reported tour-string coverage but asserted
nothing about it before this change — a hardcoded English sentence typed back
into `titleKey`/`bodyKey` would have passed silently, because the existing
"every `app.*` literal the code asks for must exist" scan only catches
strings that already start with `app.` — a bare English sentence never enters
that scan.

Added a dedicated block (search the script for "Onboarding tour strings") that
imports `TOURS` directly and asserts every `titleKey`/`bodyKey` matches
`/^app\.tour\.[A-Za-z0-9]+\.[A-Za-z0-9]+$/` and resolves in the English
catalogue. **Mutation-tested**: temporarily changed
`welcome-v1`'s first step from `titleKey: "app.tour.welcome.leadsTitle"` to
`titleKey: "Leads land here"`, confirmed `node scripts/check-translations.mjs`
printed `welcome-v1 step 1: titleKey is not an "app.tour.*" key (got "Leads
land here") — looks like a hardcoded string crept back in` and exited `1`,
then restored the file with a direct edit (not `git checkout`) and diffed it
byte-for-byte against a pre-mutation backup to confirm the restore was exact.
No entry was added to `check:all`'s chain in `package.json` — the assertion
lives inside `check:translations`, which is already in that chain.

### Verified

- `node scripts/check-translations.mjs` — exits 0. All six languages report
  100% coverage of the new `app.tour.*` keys; English and French are gated and
  complete; the new tour-string-shape assertion passes.
- `npm run build` — exits 0 (`check-imports` → `check-exports` → eslint →
  `check-env-docs` → `prisma generate` → `next build`, full route manifest
  produced, no errors).
- `npm run check:nav-audit` — 20 checks, 0 failures (untouched by this work,
  re-run to confirm nothing here broke it).
- `npm run check:all` — run in full; see the session's final status.

### What I could not verify

I have no browser in this session. I have not seen a tour actually render, a
spotlight land on a real element, or the drawer-open/close choreography run on
a phone-sized viewport in any of the six languages. Everything above is
verified by static checks (translation coverage, key resolution, the real
Next.js build) and by reading the render path (`AppTours` → `OnboardingTour` →
`useTranslation`) — not by watching it work. The mechanics `OnboardingTour.js`
already handles (measuring, drawer-opening, scroll-settling) were not touched
by this change beyond adding the two `t()` calls that resolve `title`/`body`,
so I have reasonable confidence they still work, but "reasonable confidence
from reading the diff" is not the same claim as "I watched it."
