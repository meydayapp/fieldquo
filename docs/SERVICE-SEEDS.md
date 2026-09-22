# Service seeds — the services a company starts with, and the typical price beside each

**Owner's ask (2026-09-21):** "Make sure we improve some of the services that may be
missing, and use the median for the preset pricing." Then: "Keep the low and max and
median as guidelines for them to set their own custom rates … now we do have pricing
from other CRMs that helps support a default preset." Then: "All of those should be
saved in the services for our quotes and trades too — except for the task code, we can
have our own."

## What ships

- `app/data/serviceSeeds/<trade>.js` — one file per trade, keyed by `ServiceCategory.key`:
  categories, and services with a stable `seedKey` (`fq.<trade>.<category>.<slug>`),
  name + description in **EN / FR / ES**, unit, a `benchmark` range or `null`,
  `durationMinutes`, `bookable`, and `pricedBy` / `existing` notes where the product
  already prices the thing structurally. `index.js` documents every field.
- `lib/services/seeds.js` — the read side: `serviceSeedsFor(trade)` (what the New-quote
  template gallery and the instant-quote setup read), `planServiceSeeds` (idempotent by
  seed key), `tradeBenchmarkSummary` (median of medians), `benchmarkForSeedKey`.
- `lib/products/seedServices.js` — writes `Product` rows linked to the trade's category,
  **once**. The benchmark median, converted to the company's currency, is the starting
  `unitPrice`; a service with no benchmark is created with no price. Runs at signup
  (`app/api/companies/route.js`), when a trade is switched on (service-categories PATCH)
  and from **"Add missing services for my trade"** on Settings › Services
  (`POST /api/settings/products/seed-services`). Re-running adds only keys the company
  does not hold; a row the company renamed or repriced is never touched.
- `Product.seedKey` (new column, indexed with `companyId`) — the pointer from a row back
  to its seed, so the range can be shown beside the company's own price and a re-seed
  can tell "already have it" from "new".
- `app/components/pricing/BenchmarkRange.js` — the guideline: "Typical: $250 · $325 ·
  $450 (low · typical · high)", the company's price marked on the bar, **Use typical**,
  and the sentence *"Typical range from industry benchmarks — set your own rate."* Shown
  on Settings › Services (`ServiceSeedsCard`) and in the Products price editor.
- `lib/pricing/benchmarkFx.js` — the currency rule (below).
- `scripts/check-service-seeds.mjs` (`npm run check:service-seeds`, in `check:all`).

## Where the numbers come from, and what they are not

The names, units, durations, online-booking flags and quartiles were read from a
competitor's seeded price books (research capture, branch `agent/hcp-study`,
`docs/research/hcp-price-books-by-trade.md`). What crossed over:

| Taken | Not taken |
|---|---|
| Service names (rewritten in FieldQuo's words) | Their description sentences — the check holds a hash of every one and fails on a match |
| The meaning of each description, rewritten in EN/FR/ES | Their base / placeholder prices (739 rows at $0, 927 at a round placeholder) |
| Units, durations, online-booking flag | Their task codes — ours are `fq.…`; the join lives only in `scripts/service-seeds/source-map/` |
| P25 / median / P75 → `low` / `median` / `high` | Their name, anywhere in the product |

The range is a **guideline**, never a fact about the company: it is USD national
quartiles, it is labelled as a benchmark, and the wording on every card tells the
contractor to set their own rate. Nothing in this folder reaches a client-facing route
(the check greps `/quote`, `/book`, `/q`, `/portal`, `/site`, `/embed`, the self-quote
and booking APIs).

**The seam:** `benchmark.source` is `"benchmark"` today. The plan is `"fieldquo_median"`
— the median across FieldQuo companies' own prices, aggregate only, `MIN_COHORT`
k-anonymity from `lib/pricing/benchmark.js`. `benchmarkIn` already passes a
non-benchmark source through unconverted, so the UI does not change on that day.

## The currency rule

Quartiles are USD. A USD company sees them as they are. A CAD company sees them
converted at **one dated constant**, `USD_TO_CAD_SUGGESTED = 1.37` (2026-09-21), and
rounded so the number cannot read as exact: nearest **$5** from $20 up, nearest **$1**
from $5, nearest **$0.25** below (a $1.25/sq ft rate must not round to zero). Any other
billing currency gets no range at all. This converts a *suggested sell price* only —
`electricalBenchmarks.js` and `priceBooks/systems.js` still refuse to convert costs, and
nothing here contradicts them.

## Mapping — benchmark industry → FieldQuo trade

Shipped in this pass (830 services, 327 with a range; the owner asked for the trades
companies actually use first):

| Industry (source) | Trade key | Services | Seedable | Reference-only (`pricedBy`) | With range | Without | Median of medians (USD) |
|---|---|---|---|---|---|---|---|
| Heating & Air Conditioning — "System Installation" | hvac_install | 16 | 16 | 0 | 16 | 0 | $3,062.50 |
| Heating & Air Conditioning — every other heading | hvac_repair | 87 | 87 | 0 | 87 | 0 | $300 |
| Plumbing + Water Heater | plumbing | 100 | 100 | 0 | 90 | 10 | $325 |
| Electrical | electrical | 73 | 73 | 0 | 62 | 11 | $390 |
| General Contractor | general_contracting | 108 | 108 | 0 | 7 | 101 | $700 |
| Handyman | handyman | 81 | 81 | 0 | 12 | 69 | $177 |
| Garage | garage_door | 18 | 17 | 1 | 6 | 12 | $127 |
| Appliances | appliance_repair | 21 | 21 | 0 | 0 | 21 | — |
| Painting — all but "Exterior Components" | interior_painting | 36 | 27 | 9 | 21 | 15 | $1,472 |
| Painting — "Exterior Components" | exterior_painting | 5 | 2 | 3 | 2 | 3 | $3,020.50 |
| Cabinetry | carpentry | 7 | 7 | 0 | 4 | 3 | $202.50 |
| Home Cleaning | residential_cleaning | 39 | 39 | 0 | 7 | 32 | $150 |
| Carpet Cleaning + Carpet Repair + Rug Cleaning | carpet_cleaning | 53 | 53 | 0 | 6 | 47 | $98 |
| Window & Exterior Cleaning | window_cleaning | 17 | 17 | 0 | 7 | 10 | $189 |
| Landscaping & Lawn | lawn_care | 20 | 20 | 0 | 0 | 20 | — |
| Tree Services | tree_care_service | 14 | 14 | 0 | 0 | 14 | — |
| Snow Removal | snow_removal | 6 | 6 | 0 | 0 | 6 | — |
| Roof & Attic | roofing_service | 59 | 38 | 21 | 0 | 59 | — |
| Flooring | flooring_install | 70 | 70 | 0 | 0 | 70 | — |

"Reference-only" rows are services the takeoff or a price book already prices
(a whole roof per square, whole rooms per sq ft of wall, a garage door per size, cabinet
refinishing per door). They stay in the seed for the template gallery and are never
written as a flat-priced Product — `scripts/check-service-seeds.mjs` asserts it.

### Still to seed (the long tail — files follow the same format, the rig is committed)

Janitorial (24), Air Duct Cleaning (19 → `air_duct_cleaning`), Lighting (36 →
`lighting`), Drywall (8), Doors (15) + Windows (8 → `doors_windows`), Demolition (7),
Deck & Patio (25 → `deck_patio`), Tile & Grout (2 → `tiling`), Fencing (62 →
`fence_services`), Concrete & Asphalt (51 → `concrete`), Fireplace & Chimney (80 →
`chimney_sweep`), Gutters (33), Siding (18), Insulation (20), Pest Control (22), Pool &
Spa (35), Junk Removal (18), Automotive (19 → `auto_detailing`), Security (58 →
`security_systems`), Smart Home (34) + Audio & TV (22 → `smart_home`), Solar & Energy
(10 → `solar_energy`), Locksmith (20), Restoration (52), Sewer & Septic (24 →
`sewer_septic`), Water Treatment (29) + Well Pumps (1 → `well_water`), Home Inspection
(16), Moving (22 → `moving`), and the one-row books: Wildlife Control, Caulking &
Sealants, Interior & Surface Cleaning (→ `deep_cleaning`), Install & Assemble (→
`installation_services`), Furniture & Upholstery, Glass, Marine Services, Organization &
Interior Design (→ `home_organization`), Neighborhood Chores (→ `property_maintenance`),
Baby Proof. Authoring instructions: `scripts/service-seeds/authoring/README.md`.

### Trades added to the catalogue (2026-09-21)

Sixteen, each a field-service trade a homeowner books a visit for, with icon and names
in the nine app languages (`labelTranslations`, written on create only):
`air_duct_cleaning`, `deck_patio`, `doors_windows`, `lighting`, `security_systems`,
`sewer_septic`, `smart_home`, `solar_energy`, `moving`, `wildlife_control`,
`caulking_sealants`, `furniture_upholstery`, `glass`, `marine_services`,
`home_organization`, `baby_proofing`. Run `npm run seed:categories` against production
to create the rows (additive upsert; nothing deleted).

### Skipped industries, and why

Not field-service work — nobody drives to a house to do them, and FieldQuo's pipeline
(lead → quote → job → invoice) does not describe them: Accountant, Alternative Therapy,
Appraisal, Barber, Business Services, Cooking, Credit Counselor, Document Storage &
Destruction, Financial Planner, Fitness, Fleets & Trucks, Graphics & Printing, Health &
Beauty, Insurance, Laundry, Lawyer, Lender, Massage, Medical, Mortgage Broker, Music &
Singing, Notary, Parties, Pets, Photography, Property Manager, Real Estate, Regulatory &
Environmental, Tax Planner, Tech Help, Transportation, Device Repair, Tutoring, Water
Transfer Printing, Wine. Every one of them is a single "$100 Book an appointment"
placeholder in the source anyway. Three industries seed nothing at all in the source
(Detailing, Generator, Construction & Remodeling); Natural Stone is a single placeholder
and `masonry` already exists.

## Validating against the owner's spreadsheet

`/Users/emilioboves/Downloads/HCP-services-by-trade-2026-09-21.xlsx` has the same rows
with "Validated? (Y/N)" and "Your note" columns. `scripts/service-seeds/source-map/
<trade>.json` maps every `seedKey` to the source's industry, category, service name and
task code, so his marks join back by task code without redoing any of this. That map is
under `scripts/` on purpose: never bundled, never shipped.
