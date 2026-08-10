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

## Part 2 — Market benchmarks

### 2.0 Sourcing failure, stated plainly

**The Reddit threads could not be read.** Reddit blocks automated fetching:
direct fetch 403s, the browser surface is policy-blocked, domain-scoped search
is refused, and every mirror (old.reddit, redlib, reveddit, r.jina.ai) is dead
or blocked. §2.4 (models) and §2.5 (disputes) were therefore rebuilt from
**working-electrician forums** (Mike Holt's Forum, ElectricianTalk) and
contractor-pricing literature. Where those sections say "electricians say", it
is a forum electrician, not a Reddit commenter. Directionally solid; **not** the
primary homeowner-sentiment research originally intended. Getting that needs a
human with a browser.

**Second warning: the cost aggregators are contaminated.** Angi/HomeAdvisor
publish "cost to rewire a house: average $1,567" — that is their small-wiring
bucket mislabelled, and the same page elsewhere says $5–$17/sq ft. **Never trust
a single aggregator average.**

### 2.1 Benchmarks (USD, installed)

Where these disagree with Part 1, Part 1 is a real quote from a specific market
and these are the national spread. Both matter: the spread tells a contractor
whether they're an outlier.

**Service & panel**
| Job | Low | Typical | High |
|---|---|---|---|
| Service call / dispatch | $75 | **$100–150** | $200 |
| 100→200A service upgrade | $1,300 | **$2,000–3,500** | $5,500+ |
| Panel replacement, same amperage | $800 | **$1,400–2,500** | $4,000 |
| Subpanel (60–100A) | $400 | **$900–1,800** | $2,800 |
| Meter base / meter-main combo | $250 | **$500–1,100** | $2,100 |
| Grounding system | $150 | **$200–400** | $700 |
| Whole-home surge (Type 2) | $200 | **$300–450** | $800 |

100→200A **by scope** is the useful cut, not one number: panel-only swap
$1,800–3,000 · panel + meter base $2,500–4,000 · full service upgrade
$3,000–5,000 · overhead→underground $4,000–8,000+. By region: Northeast
$3,000–5,500 · West Coast $2,800–5,000 · Mountain $2,200–4,500 · Midwest
$2,000–4,000 · South $1,800–3,800.

⚠️ **200→400A must not ship a default.** Sources span $2,000–$15,000 with no
convergence; the driver is whether the utility pulls new service conductors.

**Circuits, EV, generator**
| Job | Low | Typical | High |
|---|---|---|---|
| Dedicated 15/20A circuit | $250 | **$550–900** | $1,500 |
| 240V/50A EV circuit | $300 | **$400–700** | $1,200+ |
| EV charger install (total, excl. charger) | $749 | **$1,500–1,700** | $2,800+ |
| Generator interlock + inlet | $400 | **$800–1,200** | $1,500 |

**The EV trap:** if the panel needs upgrading, add **$1,500–3,000**. This is the
most common reason an EV quote doubles and the most common change-order cause.

**Rewire & remediation**
| Job | Low | Typical | High |
|---|---|---|---|
| Rewire, per sq ft | $2 | **$6–10** | $17 |
| Rewire, ~1,500 sq ft total | $4,500 | **$9,000–13,000** | $20,000+ |
| **Rewire, per opening** | $100 | **$150–250** | $350+ |
| Knob & tube replacement | $8,000 | **$12,000–18,000** | $36,000 |
| Aluminum — AlumiConn pigtail | $1,500 | **$2,500–4,000** | $5,000 |
| Aluminum — COPALUM | $3,500 | **$5,000–6,500** | $8,000 |

Open walls cut 30–40%; opening finished walls adds 25–30%; drywall repair
($2,000–5,000) is usually **excluded**; historic homes +20–40%. Part 1's
$15/sq ft sits above the $6–10 typical — consistent with a California market and
a "deluxe" inclusion list, not an error.

**Devices & small work**
| Job | Low | Typical | High |
|---|---|---|---|
| Recessed light, each | $100 | **$175–300** | $350 |
| Ceiling fan (existing box / new box) | $100 | **$150–250 / $300–400** | $450 |
| Light fixture swap | $133 | **$150–300** | $414 |
| Outlet/switch replacement, each | $75 | **$150–250** | $360 |
| Devices **in volume** (during rewire) | $100 | **$100–185** | $300 |
| GFCI receptacle | $125 | **$150–250** | $385 |
| AFCI/GFCI breaker installed | $150 | **$200–300** | $385 |
| Standard breaker installed | $100 | **$150–250** | $300 |
| Smoke/CO interconnected, each | $90 | **$150–250** | $250 |
| Diagnostic / troubleshooting | $75 | **$100–150** | $200+ |
| Trenching, per linear ft | $5 | **$10–18** | $40 |
| Electrical permit | $50 | **$150–350** | $900 |

Permits vary by **method**, not just amount: per-unit (base $30–50 + $0.50–8 per
device), percentage (Philadelphia: **$25 per $1,000** of electrical cost), or
flat/tiered. A permit field must support all three.

⚠️ **Not verified — ship no default:** heavy/high chandelier (Part 1 has one real
data point, $1,542.75 + $248.47 brace, "2 men required"), data/coax per drop
(Part 1: $750 "Level 1"), whole-house smoke/CO count pricing, 400A upgrades,
membership plan pricing.

### 2.2 Labour

Billed: apprentice $40–70 · journeyman $50–100 · master $90–130+. By region:
major metro **$110–180/hr**, suburban $85–130, rural $50–95. Emergency 1.5–3×.

**What the electrician is actually paid** (BLS OEWS May 2025, SOC 47-2111,
n=757,220): median **$30.38/hr** ($63,190/yr), mean $34.37. Within NAICS 238210
specifically: median $29.60/hr.

**Labour burden is 1.38–1.55×** base wage (workers' comp alone is 5–8% of payroll
for electrical classifications). A $45/hr wage costs **$65.25/hr** at 45% burden.
**Fully burdened break-even is $85–150/hr** — a metro shop billing $75/hr is
losing money. The gap between the $30/hr wage and the $75–150/hr bill rate is
burden + overhead + profit, *not* margin.

Minimum charge: 1–2 hours standard, or a $100–200 call fee including the first
hour. Trip fee **$125–175** typical; **both crediting and not crediting it are
live practice** — some shops deliberately waive it on approval as a closing
mechanism. That's a product fork, not a default.

### 2.3 Markup and margin

**Markup is inversely proportional to item cost** — the most important
structural fact for a price book:

| Material class | Markup |
|---|---|
| Small service parts ($1–49) | **2×–6× cost** (up to 300%) |
| Parts $50–100 | ~200% |
| Wire and conduit | 25–30% |
| Panels and breakers | 30–40% |
| Fixtures and devices | 35–50% |
| Blended residential service | **20–35%** |
| High-value equipment (switchgear, generators) | 10–15% |

Gross margin target 45–65% (top quartile 48–55%); overhead 13–20% of sales; net
profit 10–20%. Healthy job composition: materials 35–45% · direct labour 30–40% ·
burden 10–15% · overhead 10–15% · net 5–15%.

**⚠️ The margin formula trap.** "Applying a 50% markup yields a 33% margin, not
50%." To hit a target margin the formula is

> **price = cost ÷ (1 − margin)** — never `cost × (1 + margin)`.

*Checked: `lib/costing/estimateJobCost.js` reports margin as
`(price − cost) / price`, which is correct. The trap only bites when deriving a
price FROM a target margin — which we don't do yet, and must do this way when we
do.*

**Flat-rate build:** `(labour + material) × 2.0–2.5`, sized to land at 10–20%
net. The granular form is `(burdened rate × predetermined hours) + trip +
(material × markup) + permit/rental/ladder adders`. Most successful shops run
**70–80% flat-rate** on repeatable tasks and keep T&M for diagnosis and genuine
unknowns.

### 2.4 The seven models — tradeoffs

Part 1 §1.1 found these empirically; the literature explains the economics.

- **Flat-rate pricebook** — certainty for the client, efficiency becomes profit
  for the shop. Draws the sharpest negative reaction, specifically on *speed*:
  a $400 job that visibly takes 25 minutes. The trade is genuinely split — one
  contractor "dumped it in less than 6 months due to the drop in business",
  another "finally started making money".
- **T&M** — feels auditable, but **this is where quote-vs-bill disputes
  concentrate**.
- **Per sq ft** — easy to compare, but dangerously insensitive to wall access.
  Good for a ballpark, convert to per-opening before contracting.
- **Per unit / per opening** — scales visibly with scope; **best suited to change
  orders**, because adding three outlets has an obvious price.
- **Good/better/best** — raises ticket and close rate; clients "most often opt
  for the mid-priced option". Tiers must be genuinely different *scope* — the
  same job at three prices is detected instantly and reads as manipulation.
- **Package/bundle** — one truck roll amortised across tasks; highest-margin
  structure. Risk: bundling in what wasn't wanted reads as padding.
- **Membership** — the discipline is to make member price the **baseline** and
  charge non-members a premium; discounting 10–15% off standard destroys margin.

### 2.5 What causes disputes → product requirements

The most actionable section. Each trigger maps to something the document should
do.

| Dispute trigger | What a good quote does |
|---|---|
| Final bill exceeds estimate, no paper trail (documented: $375 → $1,647) | Several states cap written-estimate overage at **10–15%**; **Ontario's CPA fixes it at 10%** unless the consumer approved an amendment |
| "Estimate" vs "quote" confusion — *most disputes are this ambiguity, not dishonesty* | Say which it is and mean it; a quote binds only if it states costs are final, in writing, before work |
| "The job took less time than quoted" | The purest flat-rate grievance; some shops abandon flat rate to avoid the argument |
| Change orders done without sign-off | Publish the change-order process **on the quote**: description, price, schedule impact, signature *before* work |
| No itemisation | Itemise labour, materials and fees separately — *"eliminates suspicion and builds immediate trust"* |
| Scope gaps surfacing as extras (drywall, painting, permits) | State exclusions **explicitly**; *"anything not included should be expressly excluded"* |
| High-pressure closing, same-day-only discounts | **The single most reliable trust-destroying signal** in the homeowner-advice literature. Part 1 found it twice on one document |
| Verbal estimates | *"A verbal estimate is not an estimate — it is a conversation"* |
| Deposits | Reasonable is 10–25%; over 10% or $1,000 (whichever is less) is a red flag in some jurisdictions |

Also: permits get **their own labelled line** naming who pulls, pays and
schedules inspection; undecided items use **allowances** referencing a selection
list; payments tie to **milestones**, not time.

### 2.6 Inflation — escalate labour and materials SEPARATELY

Computed from BLS index values (annual averages via BLS API/FRED). 2026 is a
Jan–Jun average; 2025 CPI is 11 months (October missing, appropriations lapse);
recent PPI readings are preliminary and revise for up to four months.

**Multiplier to 2026 dollars:**

| From | Labour+overhead<br/>(PPI Electrical Contractors) | Wire/cable<br/>(PPI copper) | Panels/breakers/devices<br/>(PPI electrical equip.) | CPI-U<br/>(for reference) |
|---|---|---|---|---|
| 2019 | **1.399** | **1.917** | 1.462 | 1.294 |
| 2020 | 1.362 | 1.878 | 1.453 | 1.278 |
| 2021 | 1.303 | 1.388 | 1.341 | 1.221 |
| 2022 | 1.146 | 1.353 | 1.159 | 1.130 |
| 2023 | 1.050 | 1.384 | 1.098 | 1.085 |
| 2024 | **1.055** | 1.293 | 1.075 | 1.054 |
| 2025 | 1.034 | 1.182 | 1.032 | 1.027 |

**Three things to note.**

1. **Copper is the story.** Wire needs nearly **2×** from 2019 while labour needs
   1.40×. Copper rose **+35.4% in 2021** and **+18.2% in 2026 YTD**. A price book
   that escalates a whole job by one blended multiplier **systematically
   under-prices wire-heavy work** (rewires, long EV runs, service upgrades) and
   over-prices labour-heavy work (troubleshooting, device swaps).
2. **2024 fell 0.4%.** A 2023 and a 2024 price are effectively interchangeable —
   2023 needs a *larger* multiplier than 2024. Any naive "older = cheaper" ramp
   is wrong.
3. **Do not use CPI** for 2019–2022 electrical prices; it misses the 2022
   contractor spike (1.294 vs 1.399).

⚠️ **ENR CCI/BCI could not be verified** (paywalled from 1990 forward). It is in
any case the wrong instrument — it's weighted to common labour, structural steel,
cement and lumber, none of which drive residential electrical. The BLS PPI series
above are the correct tool and are fully verified.

*Sources: BLS OEWS; BLS PPI via FRED (PCU23821X23821X, PCU236400236400222,
PCU331420331420, PCU335335, CPIAUCNS); ServiceTitan; Housecall Pro; Jobber;
FieldPulse; JADE Learning; build-folio; HomeGuide; HomeAdvisor; Fixr; Qmerit;
Block Renovation; Mike Holt's Forum; SmartBarrel; municipal permit schedules
(Philadelphia, Hudson County NJ, Dublin CA).*

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
