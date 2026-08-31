## 1. Dead code and unreachable surfaces

**Snapshot caveat — read this first.** Several agents are actively editing
`app/globals.css`, `app/app/**`, `app/quote/**`, `app/portal/**`,
`app/platform/**`, `lib/ai/crisisRule.js` and the voice prompts right now for
a mobile pass. Anything below that touches those paths — the
`app/components/platform/NotBuilt.js` finding in particular, since it lives
one directory over from `app/platform/**` — may already have changed under
this report. Everything else (schema, `lib/**` outside the voice/crisis
files, `app/i18n/appMessages.js`) is outside the paths named as in flight.

**The worst thing found:** nothing new is customer-facing-broken. The
highest-value finding is an entire Prisma model, `QuickAddItem`, with zero
code path anywhere — not read, not written, no route, no screen — sitting
undocumented in the schema since the very first commit. It's inert, so it
can't hurt anyone today, but it's the same class of bug as the
already-known `ForecastSettings` (12 of 13 columns dead) and `Material`
(whole feature orphaned) findings, just never flagged. Everything else below
is smaller. This codebase has an unusually good habit of leaving a comment
at the crime scene when something dies (`// DEAD`, `// ⚠️ ORPHANED`, `//
Never read: ...`) — the four new findings here are exactly the cases that
habit missed.

Most of the launch-blocking classes this task asked about — unreachable
routes, broken nav links, exports that don't exist, feature flags that gate
nothing — already have dedicated build-time checks in this repo and all are
currently green (`check-route-callers.mjs`, `check-nav-audit.mjs`,
`check-exports.mjs`, `check-imports.mjs`, `check-feature-flags.mjs`; see §
"Already-guarded, verified green" below). This report does not re-derive
those; it reports what those checks don't cover — schema field usage across
all 120 models, and a handful of orphaned components/translations — plus a
short summary of the health-relevant items already tracked in
`docs/ROADMAP.md`/`docs/TODO.md` so this one file is a complete launch-day
picture.

| Severity | File:line | What | Why it matters |
|---|---|---|---|
| TIDY | [prisma/schema.prisma:2416](prisma/schema.prisma:2416) | `QuickAddItem` model — 8 fields, zero readers/writers anywhere in `app/`, `lib/`, `scripts/` | A whole scaffolded table (line-item catalog: description/unit/rate/sku) with no API route and no screen. Not customer-visible, costs nothing to leave, but it's undocumented — unlike its scaffolding-era siblings (`ForecastSettings`, `Material`), nobody left a comment saying it's dead on purpose. |
| TIDY | [prisma/schema.prisma:2456-2457](prisma/schema.prisma:2456) | `CompanyServiceCategory.crewRate1Person` / `crewRate2Person` — zero usage anywhere | Sits three lines below `pricingModel` on the same model, which IS marked `// DEAD` with a full explanation. These two have no such comment and no usage either — they were added and never wired to the service-categories settings screen or the pricing engine. |
| TIDY | [app/components/platform/NotBuilt.js:1](app/components/platform/NotBuilt.js:1) | Component + its own header comment are both stale | Comment says "every page under `app/platform/` was a zero-byte file... each now renders this." Every `app/platform/**/page.js` is now fully built (the only two under 20 lines are legitimate thin server shells, not placeholders) and none of them imports `NotBuilt` any more. The component is unreferenced anywhere. Not a live bug — but AGENTS.md is explicit that a wrong comment is worse than none, and this one actively describes a state the repo left months ago. |
| TIDY | [app/i18n/appMessages.js:1679](app/i18n/appMessages.js:1679) (+6 sibling keys × ~10 languages, ~70 lines total) | `app.setMaterials.*` translation keys — never referenced by any component | Leftover from the `/app/settings/materials` screen. The schema itself already documents that screen as deleted (`⚠️ ORPHANED`, [prisma/schema.prisma:4499](prisma/schema.prisma:4499)) — the API and page are gone — but the translated strings for its "Reorder threshold", "Add material" etc. controls, in every supported language, were never cleaned up alongside it. |
| SOON (already tracked) | [prisma/schema.prisma:4477](prisma/schema.prisma:4477) | `ForecastSettings` — 12 of 13 columns unused | Confirmed still accurate. Already has a full explanatory comment in the schema and its own line in `docs/ROADMAP.md` §5. Re-verified rather than re-discovered. |
| SOON (already tracked) | `lib/analytics/marketingRollup.js` reads `MarketingSpend`, nothing writes it | Monthly digest reports $0 spend forever | This is the example given to calibrate this report against. Confirmed still true — `/api/marketing-spend` has full CRUD, no screen calls it. Already declared (with reason) in `scripts/check-route-callers.mjs`'s `NO_FRONT_DOOR` list and in `docs/TODO.md`. |
| BLOCKER-shaped but already fixed | — | `JobVisit.status` route-caller gap | Included only to note it's closed, not open: `docs/TODO.md` records this was found and fixed 2026-08-31 (the visit-status "on my way" text, `ensureUpcomingVisit`, and the job page's completion counter were all stranded on a route nothing called). Verified the fix is in place — `scripts/check-visit-status.mjs` passes. |
| TIDY (already tracked) | [app/api/settings/service-categories:2438](prisma/schema.prisma:2438) | `CompanyServiceCategory.pricingModel` — dead, documented | Confirmed the comment is accurate: no longer written or returned by its own API route. Not re-reported as new; listed so the table isn't silent about the field sitting directly above the two new ones. |
| SOON (already tracked) | — | Three pay-rate paths disagree (`Worker.hourlyRate` vs `Member.laborCostPerHour` vs `Salary` with `workerId: null`) | AGENTS.md's own example of "duplicated logic that has drifted." Already documented in `docs/ROADMAP.md` §5 with the exact call chain for each path. Not re-derived here; flagged because it's the best real instance of failure class #4 in the repo and belongs in a launch-day list. |

### Already-guarded, verified green

Ran the build-time checks that cover the other things this task asked about,
rather than re-deriving them by hand:

- `node --import ./scripts/alias-loader.mjs scripts/check-route-callers.mjs` — **404 checks, 0 failures.** Every route is reached, scheduled as a cron, or declared with a named reason in `EXTERNAL_CALLERS`/`NO_FRONT_DOOR`. The `NO_FRONT_DOOR` list (`/api/marketing-spend`, `/api/analytics/burn-rate`, `/api/analytics/pricing-benchmark`, `/api/feedback`, `/api/leads/public`, `/api/ai/quote-suggestions`, `/api/templates`, `/api/quotes/versions`, `/api/quotes/tier-group`) is real dead-code-adjacent surface, but it's already tracked with reasons — not re-listed here as new.
- `node --import ./scripts/alias-loader.mjs scripts/check-nav-audit.mjs` — **20 checks, 0 failures.** Every `app/app` and `app/platform` page is reachable from a sidebar row or a named, reasoned exception; no empty nav group; permission maps name only rows that still exist.
- `node --import ./scripts/alias-loader.mjs scripts/check-exports.mjs` — **5,062 named imports checked, all resolve to a real export.**
- `node --import ./scripts/alias-loader.mjs scripts/check-imports.mjs` — **1,521 files, all imports resolve.**
- `node --import ./scripts/alias-loader.mjs scripts/check-feature-flags.mjs` — **404 checks, 0 failures.** Every `PlatformFeature` registry key gates something real; every page/route a flag claims to gate actually calls the guard.

None of these needed fixing; they're listed so the report doesn't imply gaps that don't exist.

### Not a finding — confirmed intentional

`app/components/mobile/{AppBar,BottomSheet,TouchFeedback}.js` — zero adoption
anywhere in `app/`, as expected. Added yesterday (git log: "Add mobile
app-feel primitives," "Sheets, an app bar, and a press state") for the
mobile pass that's in flight right now per the caveat above. Not dead code,
just not wired up yet.

### Method and its limits

Two automated sweeps, both hand-verified against false positives before
anything above was written down (an earlier heuristic pass flagged ~330
schema fields and ~257 exported functions as "unused" — the overwhelming
majority were false positives: fields read via Prisma `select`/dynamic
property access rather than a literal `.fieldName`, functions consumed only
by a sibling test script, or Better-Auth-internal columns like
`Session.ipAddress` that the auth library itself reads/writes, never our
code. Each finding above was individually confirmed with a targeted grep
before inclusion, per AGENTS.md's own warning that a source-path catalogue
or a file's own comment can look like a caller and isn't).

What this pass did **not** attempt, for lack of time: a systematic sweep for
dead branches (conditions that can't be true, an earlier `if` clause
subsuming a later one) or a full pass over the ~78 `if (res.ok)` sites for
silent-failure branches. A quick sample of the `if (res.ok)` sites found the
pattern well-guarded where checked — several files carry explicit
"never a bare `if (res.ok)` with no else" comments, suggesting this class
has already been swept more than once — but that sample isn't proof for all
78, and no dedicated build check exists for this specific pattern the way
one exists for route callers, nav reachability and feature flags.
