# KPI empty states say what would fill them

The owner's ask, verbatim: *"in the kpi maybe we should state how many we
need to get a result."* Looking at `/app/analytics/kpis` on a new-ish
account, four cards said "no data" without saying what would change that.

The fix touches two files: `lib/analytics/kpis.js` (the sentences and the
numbers that feed them) and `app/app/analytics/kpis/page.js` (how a card
renders a sentence, and — new — how it's translated). Nothing in
`lib/analytics/minimumPrice.js`'s removed jobs/week floor was touched; this
is copy, not policy.

## Before / after

Every `reason` code any KPI on this page can return, and what changed. Codes
not listed here are unchanged — see "What I left alone" below for why.

| Code | Before | After |
|---|---|---|
| `no_quotes_sent` | "No quotes were sent in this period." | "Send quotes and get {floor} of them decided — won or lost — and your win rate shows here." |
| `none_decided_yet` | "Nothing has been decided yet this period." | "Nothing's been decided yet this period. Once {floor} quotes are marked won or lost, your win rate shows here." |
| `no_won_quotes` | "No quotes were won in this period." | "Win {floor} quotes and your average job value shows here." |
| `no_leads_in_period` | "No leads came in during this period." | "No leads yet this period. Once {floor} leads have come in, this shows what share turn into quotes." |
| `below_floor` | "Too few decisions in this period to draw a rate from." | "{sampleSize} of {floor} so far — {remaining} more and this becomes reliable." |
| `no_throughput_reference` | "There is a backlog, but nothing finished this period to measure a weekly pace against." | "There's a backlog, but no job with a priced quote was completed this period to measure a weekly pace against. Complete one and this fills in." |

`{floor}`, `{sampleSize}` and `{remaining}` are never literals — they're the
`kpi()` envelope's own extra fields, set from `RATE_FLOOR` (10) or
`COUNT_FLOOR` (5) at every call site (`rateKpi()`, `buildSalesFromWinLoss`,
`buildMarginRollup`, `buildLabourCostPct`). If either constant changes, every
sentence that names it changes with it — nothing to hunt down by hand.

One behavioural change rides along, and it's a correctness fix, not
cosmetic: **`avgJobValue`'s "nothing to show" case is now always
`no_won_quotes`**, whether zero quotes exist or quotes exist but none are
won yet. Previously it split on `report.hasData` and reused `no_quotes_sent`
(shared with `winRate`) for the zero-quotes case. That was wrong for this
rewrite: `winRate` needs `RATE_FLOOR` (10) **decided** quotes; `avgJobValue`
needs `COUNT_FLOOR` (5) **won** quotes. A shared code with one number would
have been honest for one card and wrong for the other. Since "zero quotes
exist" and "quotes exist, zero won" both need the exact same next step — win
`COUNT_FLOOR` of them — collapsing them into one code with one accurate
number was the correct fix, not a shortcut.

## Which floor governs which KPI

| KPI | Floor | Constant | Reason codes affected |
|---|---|---|---|
| Win rate | 10 decided quotes | `RATE_FLOOR` | `no_quotes_sent`, `none_decided_yet`, `below_floor` |
| Average job value | 5 won quotes | `COUNT_FLOOR` | `no_won_quotes`, `below_floor` |
| Lead → quote conversion | 10 leads (total, not converted) | `RATE_FLOOR` | `no_leads_in_period`, `below_floor` |
| On-time completion | 10 scheduled+completed jobs | `RATE_FLOOR` | `below_floor` (shares the code; text unchanged in scope but now correctly numbered — see below) |
| Gross/net margin, labour cost % | 5 completed, priced jobs | `COUNT_FLOOR` | `below_floor` (same) |
| Backlog | none — needs one completed, priced job this period | — | `no_throughput_reference` |

`below_floor` is reused by six different KPIs (win rate, average job value,
lead conversion, on-time completion, gross margin, net margin, labour cost
%), at two different floor values (10 for rate-based KPIs, 5 for
count-based ones). The rewritten sentence is deliberately generic — no
domain noun ("quotes"/"jobs"/"leads") — because a shared code can't safely
claim a specific noun without being wrong for at least one of its six
callers. `{sampleSize}`/`{floor}`/`{remaining}` are correct at every one of
those six call sites (all six were given the matching extra fields so the
placeholders never render as literal `{floor}` text on screen) — this was a
necessary side effect of rewriting a shared string, not scope creep: leaving
three of the six call sites without `floor`/`remaining` would have shipped a
broken sentence on the margin and on-time cards.

## Boundary outputs, executed

From `node --import ./scripts/alias-loader.mjs scripts/check-kpis.mjs
--no-mutate`, calling the real functions with fixtures at 0, 1, floor-1,
floor, floor+1 rows:

```
winRate — 0, 1, floor-1, floor, floor+1 decided (all lost, so decided count = n exactly)
  0 decided  → null (no_quotes_sent): "Send quotes and get {floor} of them decided — won or lost — and your win rate shows here."
  1 decided  → null (below_floor):    "{sampleSize} of {floor} so far — {remaining} more and this becomes reliable."
  9 decided  → null (below_floor):    same template, sampleSize=9, remaining=1
  10 decided → 0%   (a real rate — all 10 lost, so 0% is a real number, not an absence)
  11 decided → 0%

avgJobValue — 0, 1, floor-1, floor, floor+1 WON
  0 won → null (no_won_quotes): "Win {floor} quotes and your average job value shows here."
  1 won → null (below_floor):   sampleSize=1, floor=5, remaining=4
  4 won → null (below_floor):   sampleSize=4, floor=5, remaining=1
  5 won → $1000
  6 won → $1000

leadToQuoteConversion — 0, 1, floor-1, floor, floor+1 leads
  0 leads  → null (no_leads_in_period): "No leads yet this period. Once {floor} leads have come in, this shows what share turn into quotes."
  1 lead   → null (below_floor): sampleSize=1, floor=10, remaining=9
  9 leads  → null (below_floor): sampleSize=9, floor=10, remaining=1
  10 leads → 50%
  11 leads → 45.5%

backlog — 0 vs. 1 completed, priced job this period
  0 completed → null (no_throughput_reference): "There's a backlog, but no job with a priced quote was completed this period to measure a weekly pace against. Complete one and this fills in."
  1 completed → 4 weeks (a real pace)
```

These are asserted permanently in `scripts/check-kpis.mjs` Section 4
(sampleSize/floor/remaining checked at every boundary point, not just
value-vs-null) and printed to the console on every run, not just this one.

I also ran the translated pipeline end to end (real `buildKpis()`-shaped
envelopes → `REASON_I18N_KEYS` → the actual `MESSAGES` catalogue →
substituted sentence, mimicking `useTranslation.js`'s `t()` exactly) for all
six languages, at `n = 0, 1, floor-1, floor`, and asserted no `{token}` ever
survives unsubstituted:

```
leadToQuoteConversion, n=9 (below_floor, sampleSize=9, floor=10, remaining=1)
  en: 9 of 10 so far — 1 more and this becomes reliable.
  fr: 9 sur 10 pour l'instant — 1 de plus et ce chiffre devient fiable.
  es/uk/pa/tl: 9 of 10 so far — 1 more and this becomes reliable.  (falls back to English — see below)

backlog, no_throughput_reference
  en: There's a backlog, but no job with a priced quote was completed this
      period to measure a weekly pace against. Complete one and this fills in.
  fr: Il y a des chantiers en réserve, mais aucun chantier avec un devis
      chiffré n'a été terminé cette période pour mesurer un rythme
      hebdomadaire. Terminez-en un et le chiffre apparaîtra.
  es/uk/pa/tl: falls back to English.

Sanity: no literal {token} ever leaks through unsubstituted (en/fr) — none leaked.
```

(This verification script was a throwaway per AGENTS.md convention — written,
run, and deleted; not checked in.)

## Mutations run (13, all caught)

`node --import ./scripts/alias-loader.mjs scripts/check-kpis.mjs` runs the
full mutation pass. Two are new, targeting this change specifically:

1. **"drops the floor off a below-the-floor rate"** — deletes
   `floor: RATE_FLOOR, remaining: RATE_FLOOR - denominator` from `rateKpi()`.
   Caught by the new boundary assertions (`winRate.floor === RATE_FLOOR` etc.)
   — without them this mutation would have escaped, since nothing previously
   checked those fields existed.
2. **"hardcodes the win-rate floor into the sentence instead of naming it as
   data"** — replaces `REASONS.no_quotes_sent`'s `{floor}` placeholder with
   a literal `"10"`, simulating exactly the regression this whole exercise
   is meant to prevent (a future edit that "simplifies" a sentence back to a
   JS template literal with the number baked in). Caught by the new Section
   10 assertion (`!/\d/.test(text)` over every `REASONS` value) — the
   assertion with the longest life, per the task: it doesn't hardcode
   `RATE_FLOOR`'s current value either, so it keeps working if the floor
   changes.

The other 11 are the pre-existing mutations, re-verified against the
rewritten file (one target string — `rateKpi`'s below-floor return
statement — had to be updated to match the new source; verified byte-for-byte
against the actual file before relying on it).

All 13 caught. 172/172 assertions pass (`--no-mutate`: 158; the mutation
pass itself adds 14 more, 13 "caught" + 1 rollup).

## What I left alone, and why

- **`lib/analytics/minimumPrice.js`'s removed 3-jobs/week floor** — not
  touched. This exercise changed copy, never a threshold.
- **Every other `REASONS` entry** (`materials_tracked_outside_job_costing`,
  `no_completed_jobs`, `no_priced_jobs`, `overhead_unknown`,
  `no_revenue_in_period`, `no_active_workers`, `no_scheduled_jobs`,
  `no_scheduled_hours`, `no_invoices`) — none of these name a count in the
  first place (they're all "this data doesn't exist yet" or "do this one
  thing", not "you're partway there"), so the owner's ask doesn't apply to
  them. Left as plain, untranslated English, matching how they already
  worked.
- **On-time completion, gross/net margin, labour cost %'s own labels and
  hints** — not rewritten. They share the `below_floor` code (see the table
  above) and now correctly show their own sample size and floor as a side
  effect of the shared-code fix, but I didn't touch their `no_scheduled_jobs`
  / `no_completed_jobs` / `overhead_unknown` copy, which the owner never
  raised.
- **es/uk/pa/tl translations for the six new keys — deliberately not
  added**, and this is a real deviation from the task brief's "all six
  shipped languages," so it's called out explicitly rather than silently
  skipped. Verified via `node scripts/check-translations.mjs`: the App
  interface catalogue (`app/i18n/appMessages.js`) is gated on English and
  French only — Spanish, Ukrainian, Punjabi and Tagalog sit at 82% coverage
  and are *reported, not gated* (`check:translations` exits 0 at 82%; it
  only fails on a missing English or French key). More to the point: **the
  entire `app.kpis.*` namespace — every string on this page, not just the
  ones I touched — has zero Spanish/Ukrainian/Punjabi/Tagalog entries today**
  (confirmed by grep before writing anything). Those four languages already
  render this whole dashboard in English; adding machine translations for
  six new strings would have made exactly those six lines switch language
  while every surrounding label ("Win rate", "Average job value", the period
  presets, the hints) stayed English on the same card — a more confusing,
  more inconsistent result than the uniform-English fallback that ships
  today, and unreviewed copy on money-adjacent screens is exactly what
  `appMessages.js`'s own header warns against shipping. English and French
  are added; the other four inherit the page's existing English fallback,
  which I verified end-to-end (see the boundary output above) rather than
  assuming.
- **The `"No data yet."` fallback string** (`page.js`, shown when a KPI has
  neither a value nor a `reasonText`) — pre-existing, untranslated, unrelated
  to the codes this change touches. Left alone to keep the diff scoped to
  what the owner asked for.

## The duplication finding

The owner's brief asked me to check whether the page duplicates any of
these strings. It didn't duplicate them — it did something arguably worse:
`reasonText` was rendered raw (`{data?.reasonText || "No data yet."}`),
completely bypassing `t()`, for every reason code on this page, including
the arAging card's own reason. Every other string on this same page —
labels, hints, section titles — goes through `t()`. `reasonText` was the one
kind of text on this screen that could never be translated no matter how
much translation work went into the catalogue, which directly contradicts
`lib/analytics/kpis.js`'s own header comment: *"reason … Never English
here — the page translates a code."* The page never did.

The fix: `REASON_I18N_KEYS` (in `page.js`) plus one `reasonMessage()`
helper, used by both `KpiTile` and the arAging block (previously two
separate inline reads of `.reasonText`, now one call site). English text
still lives in exactly one place — `lib/analytics/kpis.js`'s `REASONS` — and
`t()`'s fallback argument is `data.reasonText` itself, not a second typed
copy of the sentence. Reason codes with no catalogue entry (the majority)
render exactly as they did before: `reasonMessage()` returns `reasonText`
unchanged, no lookup performed.

## What I could not verify

- **No browser.** I did not load `/app/analytics/kpis` and look at it. All
  verification is `node`-level: real `kpis.js` functions called with
  fixtures, and a hand-written `t()`-equivalent run against the real
  `MESSAGES` catalogue (see "Boundary outputs" above) — not the actual React
  render, actual CSS, or actual `useTranslation()` hook wiring through
  `LanguageProvider`. `KpiTile` now calls `useTranslation()` directly rather
  than receiving `t` as a prop (matching how `MoneyTile` on the same page
  already takes `t`, but as an internal hook call instead of a prop, since
  `KpiTile` has ~10 call sites and threading a new prop through all of them
  would have been a larger, noisier diff for the same result) — this is a
  standard pattern (`useTranslation` is itself just a `useCallback` over
  context) but I did not click through the page to confirm no rendering
  regression.
- **French wording** — written by me, not reviewed by a native speaker.
  `appMessages.js`'s own convention is that French is a *fully supported*
  language (unlike the four "review pending" ones), so shipping unreviewed
  French here is a real gap, consistent with the existing risk every other
  French string in this codebase carries, but worth naming rather than
  implying it's been checked.
- **`npm run build`, `npm run check:translations`, `npm run check:all`** —
  all run for real in this environment (no sandbox) and all exit 0; see the
  commit for exact output. `node scripts/check-ai-model.mjs` was not run —
  it needs a live `OPENAI_API_KEY`, which is Sensitive in Vercel and not
  available here, and is unrelated to this change regardless.
