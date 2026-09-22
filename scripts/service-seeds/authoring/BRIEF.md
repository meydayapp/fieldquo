# Authoring brief — FieldQuo service seed files

You are writing one or more files under
`/Users/emilioboves/StudioProjects/fq-wt-seedbooks/app/data/serviceSeeds/<trade>.js`
(that worktree, never the main checkout). Touch NOTHING else. No git commands. No commits.

## Read first
1. `/Users/emilioboves/StudioProjects/fq-wt-seedbooks/app/data/serviceSeeds/index.js` — the header documents every field.
2. `/Users/emilioboves/StudioProjects/fq-wt-seedbooks/app/data/serviceSeeds/snow_removal.js` — a finished exemplar. Copy its shape exactly (`export const SEED = {...}`, no imports, no other exports).
3. Your slice: `/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/seeds/slices/<AGENT>.json` — one object per source industry: `mapTo` (the FieldQuo trade key(s) and instructions), `medianOfMedians`, and `services[]` with `category` (source heading, ` > ` = nesting), `service` (source name), `unit` (`Sq. Ft.` / `Each` / null), `low`/`median`/`high` (USD national quartiles, may be null), `durationMinutes`, `bookable`, `sourceDescription` (READ FOR MEANING ONLY).

## What the data is
A competitor's seeded price book, captured as benchmark data. We take the service NAMES (cleaned), the MEANING of the descriptions, the UNITS, and the quartiles. We never store its text, its base prices, or its name. The word "Housecall" / "HCP" must not appear anywhere in your file, not even in a comment. Call it "the benchmark" if you must.

## Rules per service
- `seedKey`: `fq.<trade>.<categoryKey>.<slug>` — all lowercase, `[a-z0-9_]`, ours (never the source task code), unique. Slug = 2–5 words of the service name, e.g. `fq.hvac_repair.blower.replace_motor`.
- `category`: one of your file's `categories[].key`. Flatten the source headings sensibly: "Fencing > Installation > Pool Fencing" → key `pool_fencing_install` or keep `installation` + name-level detail — aim for 4–12 categories per file, no category with a single service unless unavoidable. The source's "Book Now" heading is not a category: file those services under the category they belong to and keep `bookable: true` + `durationMinutes`. "Core Services / Additional Services / Maintenance & Inspection" style headings may be kept as-is (`core`, `additional`, `maintenance`).
- `name.en`: sentence case, homeowner-facing, specific. Rewrite "Installation - Chain link fence" as "Chain-link fence installation"; "Repair - Cabinets" as "Cabinet repair"; keep amperages, materials and sizes. ≤ 90 chars. Not identical in all three languages (it's fine if EN == FR for a word like "Thermostat").
- `name.fr`: real Quebec French trade vocabulary (thermopompe, fournaise, chauffe-eau, gouttières, bardeaux, revêtement extérieur, entrée [driveway], sous-sol, disjoncteur, panneau électrique, calfeutrage, plafonnier, prise de courant, robinetterie, drain français, toiture, pelouse, déneigement, armoires, comptoir, plancher, carrelage, cloison sèche/gypse, isolation, ventilation, conduits). Capitalise like French (sentence case, accents kept).
- `name.es`: neutral Latin-American Spanish (calentador de agua, aire acondicionado, tablero eléctrico, interruptor, tomacorriente, techo, canaletas, cerca, entrada de vehículos, plomería, drenaje, gabinetes, piso, azulejos, panel de yeso, aislamiento).
- `description.{en,fr,es}`: ONE or TWO sentences, 25–320 chars, in FieldQuo's own words, saying concretely what is done and what it covers. Homeowner-facing, plain, no "our expert technicians", no exclamation marks, no prices. Where the source lists symptoms or items as bullets, fold them into one clause ("Covers no heat, uneven rooms, unusual noise and a bill that jumped."). Never reuse a source sentence — the check hashes every source sentence and fails on a match. Write the French and Spanish as real sentences (not word-for-word); the check rejects a fr/es description containing the English words the/and/with/your. The three descriptions must differ from each other.
- `unit`: `Sq. Ft.` → `"sqft"`, `Each` → `"each"`, null → `"flat"` — except a service whose name says hourly/per hour → `"hour"`, or per linear foot → `"linear_ft"`.
- `benchmark`: if `median` is null → `null`. Otherwise `{ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" }` with the slice's numbers exactly (low/high may be null; never invent them, never store a base price).
- `durationMinutes`: the slice's number or `null`. `bookable`: the slice's boolean.
- `pricedBy`: ONLY when the trade already prices this exact service structurally — the takeoff trades (interior_painting, exterior_painting, roofing_service, siding, gutter_services, insulation, garage_door, flooring [refinishing], snow_removal, paving, home_inspection) and their price-book block in `/Users/emilioboves/StudioProjects/fq-wt-seedbooks/app/data/tradePriceBooks.js`. Read that trade's block before deciding. Mark `pricedBy: "takeoff"` for e.g. whole-room/whole-house interior painting per sq ft, exterior house painting, a roof replacement per shingle type, siding installation, gutter installation per linear foot, attic insulation install, a garage door install; keep the benchmark as a reference and add `existing: "..."` saying where it is priced. Everything else (repairs, add-ons, small jobs) is a normal flat-priced service. Never mark pricedBy in a trade that has no takeoff/book.
- `existing`: a short note when FieldQuo already carries the equivalent — the electrical (`app/data/electricalCatalog.js`) and plumbing (`app/data/plumbingCatalog.js`) line-item catalogues (cite the `key`), the standard add-ons (`app/data/standardAddOns.js`), or a price-book field. Omit the property otherwise. Skim those files once if your trade is electrical/plumbing/cabinet/painting.
- KEEP EVERY ROW of your slice — the owner's word: "all of those should be saved in the services for our quotes and trades too." Nothing is dropped, not even the catch-alls. Render them honestly: "Something else / I don't know" → "Other <category> work — describe what you need" (see the exemplar's last service); "Custom Job" → "Custom job — priced on site"; "<Industry> - Book an appointment" → "Service visit — book an appointment" (unit flat, benchmark null unless the slice has a median). A row that is a pure duplicate of another (same name, same category) still gets its own seedKey (suffix `_2`) so the row-by-row join holds.

## The private join-back map (mandatory, one per file)
Also write `/Users/emilioboves/StudioProjects/fq-wt-seedbooks/scripts/service-seeds/source-map/<trade>.json`: a JSON array with ONE row per service in your file, in the same order:
`{ "seedKey", "industry", "sourceCategory", "sourceService", "taskCode" }` — the slice's `industry`, `category`, `service`, `taskCode` (null when the slice has none) verbatim. This is the only place the source's task code may appear; it lives under scripts/ so it is never shipped. See `scripts/service-seeds/source-map/snow_removal.json`.

## Categories
`categories: [{ key, name: { en, fr, es } }]` — keys `[a-z0-9_]`, names 2+ chars, not the same word in all three languages.

## Validate before you finish (mandatory)
```
cd /Users/emilioboves/StudioProjects/fq-wt-seedbooks && node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-service-seeds.mjs --file <trade> 2>&1 | grep -v "MODULE_TYPELESS\|Reparsing\|performance overhead\|type.: .module\|trace-warnings" | tail -30
```
It must end with `0 failed` for EVERY file you wrote. Fix every FAIL line — do not delete a service to make a failure go away unless it is a placeholder row.

## Report (final message, short)
Per file: trade, source industries, number of categories, services written, with a benchmark range, without, marked pricedBy, rows dropped and why, any `existing` merges, and the check's final line. Also list any source rows you were unsure how to map. If your `mapTo` says NEW trade, the trade is NOT yet in lib/trades/catalog.js — the check will FAIL on `trade is in the catalogue` for that one line only; that is expected, report it and treat everything else as must-pass. Do not edit the catalogue yourself.
