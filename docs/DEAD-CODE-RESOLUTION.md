# Dead-code resolution — `docs/health/01-dead-code.md` items 1–4

Investigated per the owner's instruction: before deleting anything, find out
whether it was ever wired to a caller, and if not, whether it was *meant* to
be — a forgotten feature documented as a TODO, not silently erased. Method for
every item: `git log --follow -p -- prisma/schema.prisma` (or the file
itself) to find the introducing commit, `git blame` to date it, then a grep
sweep for the capability under other names.

## 1. `QuickAddItem` (`prisma/schema.prisma:2416`)

**git history.** Introduced in commit `9e120ac5` ("Add current FieldQuo
project", 2026-07-27) — the single bulk-import commit that laid down the
whole pre-existing codebase in one shot (`QuickAddItem`,
`CompanyServiceCategory.crewRate1Person/2Person`, and hundreds of other
files all land in this one commit). There is no individual rationale message
for this model; it is scaffolding-era, exactly as the health report guessed.

**Does the capability exist elsewhere?** Yes — fully, and better. The
`Product` model (`prisma/schema.prisma:14`) is a complete company price
book: `name`, `description`, per-language `translations`, `type`
(service/product), `unitPrice`, `costPrice`, `unit`, `active`, and a
`categories` relation to `ServiceCategory` restricting which quote types can
add it. It has full CRUD at `app/api/products/route.js` and
`app/api/products/[id]/route.js` (`db.product.findMany/create/update/delete`
— confirmed by grep, not assumed), a settings screen at
`app/app/settings/products/page.js`, CSV import/export routes, and —
critically — it is wired directly into the quote builder:
`app/components/quotes/builder/LineItemsTable.js` renders a dropdown of
`products` (fetched via `/api/products` in `QuoteBuilder.js`) scoped to the
line's category, letting a contractor pick a saved catalogue item while
building a quote. That dropdown *is* the "quick add from a saved-items
library" feature `QuickAddItem`'s shape (description/unit/rate/sku) suggests
was intended. The one field `Product` doesn't carry is `sku`, but nothing
in the app reads or displays a SKU anywhere else either.

**Verdict: redundant.** Not forgotten — a newer, more complete
implementation of the same idea (`Product`) fully superseded it. No `docs/TODO.md` entry: there is nothing left to build, the capability shipped under a different name.

**What I did:** left the schema untouched (see rules below). Nothing else
references `QuickAddItem` so there is no code to remove.

**Before the owner drops it:** run this against production first — the model
has zero known writers, but only a live row count proves nothing is silently
depending on it:

```sql
SELECT COUNT(*) FROM "QuickAddItem";
```

If it comes back 0, `model QuickAddItem { ... }` and its back-reference field
`quickAddItems QuickAddItem[]` on `ServiceCategory` can be deleted from
`prisma/schema.prisma` and pushed. If it's non-zero, someone/something wrote
rows outside the code paths I found (e.g. `prisma studio`, a one-off script,
or a since-deleted route) — worth a `SELECT * LIMIT 5` before deciding
anything.

## 2. `CompanyServiceCategory.crewRate1Person` / `crewRate2Person` (`schema.prisma:2456-2457`)

**git history.** Same commit, same bulk import (`9e120ac5`, 2026-07-27) — no
individual rationale. Sits three lines below `pricingModel`, which a later,
separate commit deliberately marked `// DEAD` with a full explanation; these
two never got that treatment, matching the report's framing exactly.

**Does the capability exist elsewhere?** Yes, in `lib/costing/crew.js`,
added in commit `993aed97` ("A crew, not a worker: hours are a pool, each at
their own rate", 2026-08-23) — three weeks *after* this repo's real
development restarted. Its own header comment states the problem directly:
a flat per-headcount rate is arithmetically wrong (`161 hours × $25` starves
a 3-person crew's true cost; `161 hours × 3 × $25` triples hours that were
already a team total). `crewLabourCost()` instead pools total hours across
an arbitrary-length crew, each member at their own rate, hours defaulting to
an even split but individually overridable. It is wired into
`app/components/quotes/builder/CostMarginPanel.js`,
`lib/costing/estimateJobCost.js`, and `lib/costing/actualJobCost.js` — live,
not a stray helper.

`crewRate1Person`/`crewRate2Person` were a fixed two-tier version of exactly
this idea (one rate for a solo job, a different rate for a two-person crew)
and cannot express what `crew.js` already does (three-plus people, mixed
rates, partial hours per person). They were superseded, not forgotten.

**Verdict: redundant** — superseded by a materially better implementation
that shipped under a different name (`lib/costing/crew.js`) and isn't a
schema field at all; crew composition is computed per-job in the cost panel,
not stored per service category. No `docs/TODO.md` entry.

**What I did:** left the schema untouched. No code referenced these two
fields, so nothing else to remove.

**Before the owner drops it:**

```sql
SELECT COUNT(*) FROM "CompanyServiceCategory"
WHERE "crewRate1Person" IS NOT NULL OR "crewRate2Person" IS NOT NULL;
```

If 0, both columns can come out of the `CompanyServiceCategory` model. If
non-zero, those are values a company typed into a UI that (per this
investigation) no longer reads or writes them — worth checking whether an
older build of a settings screen once exposed them before assuming the rows
are junk.

## 3. `app/components/platform/NotBuilt.js`

**git history.** Added in commit `8af1ed29` ("feat(platform): login,
layout, seed script and growth analytics", 2026-07-27) as an honest
placeholder — its own header comment explains it was rendered by every
`/platform/*` page when those pages were zero-byte stubs that failed the
production build. That was true in July; it is not true now.

**Verified before removing, not assumed:**
- `grep -rln "NotBuilt" app lib scripts` → only the component's own file.
- All 26 files under `app/platform/**/page.js` checked by line count and
  spot-read; the two shortest (12 and 18 lines) are a legitimate server
  shell (`companies/[id]/page.js`, resolves an async `params` and hands off
  to a client component) and a thin wrapper around the shared
  `HelpCenter` component — not disguised placeholders.
- `grep -rn "NotBuilt" app/platform` → no hits.

**Verdict: abandoned (stale, not forgotten).** The comment describes a state
the repo left months ago; AGENTS.md is explicit that a wrong comment is
worse than none.

**What I did:** deleted `app/components/platform/NotBuilt.js`. Confirmed via
`npm run build` (which runs `check-imports.mjs` and `check-exports.mjs`
first) that nothing broke.

## 4. `app.setMaterials.*` translation keys (`app/i18n/appMessages.js`)

**git history / context.** The schema itself documents the screen these
backed as gone: `prisma/schema.prisma:4499`, `// ⚠️ ORPHANED — the feature
these two backed was deleted, the TABLES were not`, naming
`/app/settings/materials`, `/api/materials`, and `getMaterialTrends`
explicitly as removed. `Material`/`MaterialPriceEntry` rows stay (real data,
per that comment) — only the screen, its API, and now these translation
keys are gone.

**Verified before removing:**
- Found exactly 7 keys × 6 languages = 42 lines via
  `grep -c '"app\.setMaterials\.'`, matching the health report's estimate.
- `grep -rn "setMaterials"` outside `appMessages.js` → only an unrelated
  `useState` setter (`setMaterials`) in
  `app/app/settings/cabinet-rates/page.js`, a different feature entirely
  (React state, not an i18n key — `app.setMaterials.` with the trailing dot
  doesn't match it).
- Checked for a sibling `app.setMaterialCosts.*` prefix sitting right next
  to it in the file — that one **is** live (drives the internal Cost &
  Margin estimate) and was left untouched; confirmed the two prefixes don't
  collide under the delete pattern (`setMaterials` vs `setMaterialCosts`
  diverge at the 12th character).

**Verdict: abandoned.** The screen is confirmed gone by the schema's own
comment; these are leftover strings with no reader.

**What I did:** removed all 42 keys (`"app.setMaterials.*"`) from all six
language blocks (`en`, `fr`, `es`, `uk`, `pa`, `tl`) in
`app/i18n/appMessages.js` with one pattern, verified with
`grep -c` → 0 remaining, then re-ran `npm run check:translations` — still
100% on the two gated catalogues (marketing: fr/es/uk/pa/tl all 100%;
onboarding tour strings: complete) and the same before/after ratio on the
non-gated "App interface" report, confirming no language lost keys the
others kept.

## Already tracked — confirmed still accurate, unchanged

- **`ForecastSettings`** — 12 of 13 columns unused. Still true; still fully
  explained in the schema and in `docs/ROADMAP.md` §5 (line 739). Not
  touched.
- **`MarketingSpend`** — read by `lib/analytics/marketingRollup.js`, written
  by nothing. Still true; still declared with its reason in
  `scripts/check-route-callers.mjs`'s `NO_FRONT_DOOR` map (line 144) and
  tracked as a "Planned, not started" item in `docs/TODO.md`. Not touched.
- **`CompanyServiceCategory.pricingModel`** — still marked `// DEAD` with
  its original explanation immediately above the two crew-rate fields
  handled in item 2. Not touched.
- **The three drifted pay-rate paths** (`Worker.hourlyRate` /
  `Member.laborCostPerHour` / `Salary` with `workerId: null`) — still
  documented with the exact call chain for each in `docs/ROADMAP.md` §5
  (line 751). Not touched.

## Rules followed

- No Prisma model or column was removed from `prisma/schema.prisma`. Items 1
  and 2 hold data whose production row count is unknown from this
  environment; dropping either is a `prisma db push` away from destroying
  rows with no migration to roll back. Both are left in place with an exact
  `SELECT COUNT(*)` query above for the owner to run first.
- Items 3 and 4 are code and strings, not schema — both removed, both
  verified against a build.
- No entry was added to the `check:all` chain in `package.json`.
- `prisma db push` was not run; only `npx prisma validate`, which passes.

## Verification

```
npm run check:all          # exit 0
npm run check:translations # 100% on both gated catalogues, six languages
npx prisma validate        # schema is valid — unchanged, as expected
npm run build              # exit 0 (compiles, all 401 pages generated)
```

One environment note unrelated to this change: the first `npm run build`
attempt in this worktree failed with `ENOSPC` (host disk was down to 337Mi
free) partway through static generation, after `check-imports`,
`check-exports`, and TypeScript had already passed and Next had reported
"Compiled successfully." Removing the stale `.next/` directory from a prior
build freed several GB and the rebuild completed cleanly with exit 0. Not
caused by anything in this change — flagging in case it recurs for another
agent sharing this disk.
