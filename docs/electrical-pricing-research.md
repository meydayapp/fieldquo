# Electrical pricing — research & default price-book design

**Purpose.** Give FieldQuo a defensible default price book for residential
electrical, so an electrician signing up isn't staring at an empty rate card —
while never putting a number the contractor didn't choose onto a document a
client signs.

**Status.** Part 1 (estimate teardown) is complete and is primary evidence: it
is a direct reading of 15 real contractor estimates supplied by the owner.
Parts 2–4 (market benchmarks, material costs, the shipped model) are being
assembled from market research and are marked where a figure is not yet
verified.

---

## Part 1 — Teardown of 15 real estimates

Every number below was read off a real estimate. Company names are omitted where
they were redacted; where a brand was visible on the document it's named because
the pricing model is the point, not the company.

### 1.1 The seven pricing models actually in use

Fifteen estimates, seven distinct structures. **This is the single most
important finding: there is no one "electrician quote format".** Software that
assumes one shape will be wrong for most of the trade.

| # | Model | Seen as | Why they use it |
|---|---|---|---|
| 1 | **Flat-rate, single line** | "Dedicated Circuit to Garage — $2,850" with a paragraph of scope | Fastest to produce; hides the rate; homeowner can't unbundle it |
| 2 | **Task-code pricebook** | `SF-101`, `BKR-102`, `DEV-109`, each with a 5-year warranty | Consistency across techs; every item defensible; supports volume bands |
| 3 | **Package / tier** | "1 STAR PACKAGE (D): Sub Panel with firewall — $8,675" | Bundles margin; sells outcomes not parts |
| 4 | **Per square foot** | "1,461 sq ft × $15/sq ft = $21,915" (whole-house rewire) | The only sane way to price a rewire before opening walls |
| 5 | **Per unit / linear** | Trenching `30 @ $500/ft`; data cable `6 @ $750` | Scales with a measurable quantity |
| 6 | **Good / better / best** | Tablet UI: Platinum ▸ Gold tabs, photo per line | Anchors high; lets the client choose down instead of walking |
| 7 | **Membership + dispatch** | `$29 Dispatch` (billed $19) + `$99 Power Club` → "Member savings $2,610" | Recurring revenue; the discount justifies the sticker |

Several estimates combine models — e.g. a package plus per-unit lines plus a
same-day discount. **A quoting tool has to support mixing them on one document.**

### 1.2 Observed price points

Direct readings. `~` marks a figure derived from the document (e.g. unit price
back-calculated from a line total).

**Service / diagnostic**
| Item | Observed |
|---|---|
| Dispatch fee (list → billed) | $29 → $19 |
| Residential standard service fee | $59 |
| Single-circuit diagnostic & repair | $359 |

**Panels, service & grounding**
| Item | Observed |
|---|---|
| Main breaker panel, 150/200A up to 42 ckt, surface mount | $3,888 |
| "Baseline panel upgrade" (Seattle) | $3,990 |
| 100→200A service upgrade (Seattle; incl. panel, meter base, grounding, riser, utility coordination) | $6,997 |
| 200A main panel, overhead service (Bay Area) | $10,000 |
| Replace/add 200A meter combo incl. riser | $3,740 |
| Subpanel 100–125A (incl. AFCI, labeling, surge, permit) | $4,000 |
| Subpanel package w/ firewall + fire guard, up to 20 breakers | $8,675 |
| Sub feed 50–75 ft | $4,375 |
| Complete grounding system | $1,361 |
| Cold-water-pipe grounding system | $425 |
| Firewall add-on for subpanel | $900 |

**Permits** — $300 · $950 · $1,500 (three different companies, same metro band).
One estimate withholds **$300 until the inspector signs the permit card**.

**Surge protection**
| Item | Observed |
|---|---|
| Panel surge protector, 5-yr mfr warranty | $477 |
| "Platinum" surge + lightning, lifetime $75k warranty | $879 |
| Deluxe surge bundle (whole home + secondary) | $1,462 |

**Circuits & EV**
| Item | Observed |
|---|---|
| Dedicated circuit to garage, 2 outlets, 20A breaker | $2,850 |
| 15–20A dedicated circuit up to 50 ft | $896 |
| EV circuit within 10 ft of panel (240V/50A, excl. charger) | $850 |
| 30/50A generator plug + interlock, >25 ft, incl. cord | $2,470 |

**Devices, breakers, fixtures** — note the **volume bands**
| Item | Observed |
|---|---|
| GFCI device (qty 5+) | $158 ea |
| Additional Decora GFCI outlet w/ plate | $118.36 ea |
| Home redevice, standard devices (qty 21–40) | $67 ea |
| Standard 2-pole 15–60A breaker | $249 |
| Standard tandem 15–20A breaker | $259 |
| 1-pole 15–20A AFCI/GFCI breaker | $289 (qty 1) · $269 (qty 3–5) |
| Interconnected 110V smoke alarm + box + wiring | $255 ea |
| Weatherproof in-use cover | $69.89 |
| Small j-box replace/install (up to 2) | $189.79 |
| Level 1 light fixture (customer-supplied) | $300 |
| Chandelier >30 lb, 8–14 ft — **2 men required** | $1,542.75 |
| Chandelier support brace w/ box | $248.47 |
| Level 1 data cable run | $750 |
| 12/2 Romex NM-B, 50 ft run | $903.25 |
| Wire fishing, level 1 | $144.68 |
| Cut-in single gang, new location | $55.82 |
| ½" EMT, first 10 ft (no wire) | $207.56 |
| Trenching, main utility | $500 / ft |

**Whole-house rewire** — the widest spread on the whole board
| Basis | Observed |
|---|---|
| Per sq ft (1,461 sq ft, 1958 single-storey, 3/2) | **$15/sq ft → $21,915** |
| "Deluxe / Level 3 difficulty" per sq ft, excl. sheetrock repair | **$39,752** |
| Full rewire package all-in (rewire + meter combo + grounding + surge) | **$46,433** |

That is a **2.1× spread** on nominally the same job. Difficulty tier, access,
and whether drywall repair is included explain most of it — which is exactly why
a rewire line must carry its assumptions on the document.

### 1.3 Structural patterns worth copying

**Volume bands.** Devices are cheaper per unit at higher counts ($158 at qty 5+,
$67 at qty 21–40; AFCI $289 at qty 1, $269 at qty 3–5). A price book needs
quantity-tiered rates, not one rate per SKU.

**Difficulty levels.** "Level 1 light fixture", "Level 1 data cable run",
"Level 10: generator plug", "Level 3 difficulty rewire", "wire fishing level 1".
Difficulty is a first-class pricing dimension, and it is what makes the same
nominal task cost 2× more in an old house.

**Warranty as a line attribute.** One pricebook carries "5 year warranty" on
*every* item; another sells a "3 year service warranty" as its own line. Warranty
term belongs on the line item, not buried in terms.

**Payment milestones.** One estimate: `$1,000 deposit at agreement` →
`$16,415 at end of project` → `$300 withheld until the permit card is signed by
the inspector`. Permit-holdback is a genuinely good practice.

**Financing shown as a monthly figure.** $130.07/mo · $594.41/mo · $696.60/mo,
each rendered next to the total. On a $46k job the monthly number is doing the
selling.

**Discounts as visible lines.** "5% Same Day Discount" appears **twice** on one
estimate (−$1,338.60 × 2) with "Manager approval needed if using multiple
discounts". "Member savings $2,610". "Free EV charger circuit −$850".
Discounts are shown as savings, not folded into the price.

**Tax handling is inconsistent.** Several estimates show `TAX $0.00` on
five-figure jobs (California — labour on real property is generally not taxed);
Seattle adds **10.55%** on the whole ticket. Tax must be per-jurisdiction and
per-line-type, never a single global rate.

**Diagnosis written in the client's language.** The best estimates open with
findings, not prices: *"Found aluminum wires for main feed in meter pan… no
antioxidant paste… obvious signs of rust and corrosion on main lugs… recommending
replacement rather than a repair."* That paragraph is what makes a $7,135 total
land as reasonable.

### 1.4 Weaknesses to design against

Observed on these documents, and each one is a place FieldQuo can be better:

1. **A `#Error` string printed on a live client-facing estimate.** (Image 5.) A
   template variable failed and shipped anyway.
2. **The same discount line duplicated** with no indication whether both applied.
3. **Line items repeated instead of quantity-grouped** — `BKR-102` appears three
   separate times at qty 1 rather than once at qty 3.
4. **A $39,752 rewire on one undifferentiated line** with no basis shown (no sq
   ft, no rate, no difficulty rationale) — the single most disputable line in the
   whole set.
5. **"Option #1" with no option #2 anywhere on the document** — the tier framing
   implies a choice that isn't presented.
6. **Financing monthly payment with no APR, term or total-cost-of-credit**
   printed next to it.
7. **Two "5% same day" pressure discounts** — a same-day-only discount is the
   classic high-pressure tactic homeowners complain about publicly.
8. **Descriptions written for the tech, not the client** — "Nolux panel lugs",
   "torch terminations to specs", "shock guard on those circuits".

---

## Part 2 — Market benchmarks (in progress)

Being assembled from published cost data, contractor forums and homeowner
threads, to place the Part 1 readings on a national range rather than treating
15 documents as the market. Will carry LOW / TYPICAL / HIGH per service with the
year and region of each data point, plus labour-rate and material-markup norms.

**Inflation normalisation.** Several of the source estimates are 1–4 years old.
Any figure carried into the shipped defaults is normalised to current dollars
using a published construction-cost index (BLS PPI for electrical contractors),
with the multiplier recorded beside it — never adjusted by feel.

---

## Part 3 — Material costs (in progress)

Retail material costs by category (breakers, panels, transfer switches, wire,
boxes/conduit, devices, lighting, safety), CAD and USD, to seed the **internal
cost** side so the margin calculation is real rather than a guess. These are
cost inputs, never client-facing prices.

---

## Part 4 — What FieldQuo will ship

Design rules, decided from the evidence above:

1. **Material costs ship as real defaults.** They're internal, factual, and
   verifiable; a company adjusts them for their supplier. Same pattern as
   `app/data/materialRecipes.js`.
2. **Service prices ship as a REVIEWABLE benchmark, never as a silent default.**
   An electrician sees "typical range $3,900–$7,000, median $4,500 — set your
   price", and nothing reaches a client document until they've set it. This is
   the existing `defaultLineItems.js` rule (`rate: null`) extended, not broken:
   the list is the hard part; the number is theirs.
3. **The catalogue carries the dimensions the trade actually prices on**:
   difficulty level, quantity band, warranty term, and whether permit/inspection
   is included.
4. **Every model in §1.1 must be expressible** on one document — flat line,
   task code, package, per-sq-ft, per-unit, tiered options, membership.
5. **Assumptions print on the line.** A rewire line shows its sq ft, its rate and
   its difficulty tier, because §1.4.4 is how disputes start.
6. **Financing shows APR, term and total cost of credit**, not just a monthly.
7. **Tax is per-jurisdiction and per-line-type**, defaulting to how the
   company's own province/state treats labour on real property.

*Sources: Part 1 is a direct reading of 15 estimates supplied by the owner
(Whittier CA, Seattle WA, Bay Area CA, Sacramento CA and unnamed markets, 2022–2025).
Parts 2–3 cite their sources inline once assembled.*
