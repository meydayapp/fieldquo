# Trade pricing — research & default price-book design
### (electrical + plumbing)

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

## Part 2B — Teardown of 8 real PLUMBING estimates

A second document set (plumbing, plus one combined plumbing+electrical job),
covering the US Midwest/South, California and Australia. **These contain five
structures the electrical set did not**, and they are the most useful ideas in
the whole research.

### 2B.1 The five new structures

**1. `$0.00` line items used as CONTRACT CLAUSES.** The strongest idea found
anywhere in either set. On an $18,164 repipe:

| Line | Qty | Price |
|---|---|---|
| Excavation Clause — *"cannot be held liable for landscaping/vegetation, or hitting unforeseen underground utilities… if rock or other obstructions are encountered the cost may increase…"* | 1.00 | **$0.00** |
| General Damage Clause — *"cannot be held liable for damage during plumbing repairs, including cutting open walls, damaging floors, cutting concrete, or moving appliances…"* | 1.00 | **$0.00** |

The exclusions sit **as visible line items in the price table**, not buried in a
terms paragraph. The client reads them while reading the price, and accepts them
by accepting the quote. §2.5 says buried exclusions are a top dispute cause —
this is the fix, and it costs nothing to implement.

**2. Equipment separated from a MANDATORY install package.**
- `P-WH-238202002` — 50 Gallon Natural Gas Water Heater — **$2,664.00**
  — *"[Price for Swap Out Only, **Must be Combined with Install Package**]"*
- `P-WH-PGWI-9-0.75` — Economy Install Package for Gas Water Heaters — **$667.77**
  (new hard lines, shut-off valve, gas flex line, gas valve, drain pan, upgraded
  drain valve, T&P connection) — *Warranty: 2 Years Labor*

The equipment price is honest and comparable ("is $2,664 a fair price for a
Bradford White 50-gal?"), while the labour is separately priced and separately
warranted. **The line carries a dependency rule** — a price book needs
"requires" relationships between items, or a tech quotes a heater with no
install.

**3. Difficulty levels with PUBLISHED CRITERIA.** The electrical set had "Level
1 / Level 3" as bare labels. Plumbing spells out what qualifies:

> **Level 3 Water Repipe Fixture — $976 each × 12 fixtures = $11,712**
> *Crawlspace under 24" high · Level 2 room with nasty environment · Sheetrock
> access like slab home or finished basement (remember to add an additional half
> or full day of demo for all sheetrock re-pipes) · Extremely tough drop ceiling
> · All attic re-pipe fixtures are also level 3.*

The criteria are on the document, so the level isn't a judgement call the client
has to trust. **This is how a difficulty multiplier stops being a dispute.**

**4. Fixture count as the unit of measure.** The repipe is priced `12 fixtures
× $976`, with the count itemised on the document (master bath 3, hallway bath 3,
kitchen/laundry 3, water heater + two hose spigots 3). Far more defensible than
a lump sum, and it survives scope change — adding a bathroom has an obvious price.

**5. Warranty matrix that varies by SERVICE TYPE.** From a Roto-Rooter work
order (Indianapolis, Feb 2026):

| Service | Residential | Commercial |
|---|---|---|
| Main / branch lines | 6 months | 30 days |
| Toilet auger | **7 days** | 24 hours |
| Plumbing repair | 6 months | 90 days |
| Plumbing replacement | 1 year | 90 days |

Plus an "Extended Guarantee — 1 year" checkbox. Warranty is not one company-wide
term; it's **per service type and per customer class**. Elsewhere in the same set:
10-year materials+labour on a repipe and a directional bore, 2-year on a PRV,
1-year on a minor gas repair, 6-year parts / 2-year labour on a water heater.

### 2B.2 Discounts done honestly (contrast with §1.4.7)

The electrical set's "5% Same Day Discount ×2" is a pressure tactic. The plumbing
set shows two discounts with a *real* economic basis:

- **Combined Labor Discount −$956.00** — *"A discount due to increased efficiency
  on a large job."* True: mobilisation is amortised.
- **Addon Fixture Discount −$336.00** — *"25% off … fixtures when added to a
  [larger job]."* True: the truck roll and access work are already paid for.

**Design rule: a discount should name its economic reason, not a deadline.**

### 2B.3 Other observed structures

**Roto-Rooter work order (Indianapolis, 2026-02-20)** — labour-only pricing:
Labour **$568.00**, Parts blank, Discount **−$85.20** (exactly 15%), **Total
$482.80**. Work described in the tech's own words: *"Ran K/S from trap ~50 ft
several times. Grease residue out. Tested O.K."* Terms NET 10 days, 1.5%/month
late charge. Also carries a printed **upsell table** — Water Heater / Disposer /
Sink / Toilet / Bathtub / Shower / Faucet / Drain, with columns *Estimated Cost*
and **"You Save Today"**. The invoice is a sales surface.

**Australian invoice (GST market)** — the anti-pattern, and instructive:
| Line | Amount |
|---|---|
| Service Call | $130.00 |
| Labour 1M (1 man-hour) | $130.00 |
| Materials | $100.00 |
| Pressure Test | $95.00 |
| **Credit card surcharge** | **$12.50** |
| Subtotal / GST 10% / **Total** | $467.50 / $46.75 / **$514.25** |

Three things: the callout is billed **separately from and equal to** the first
labour hour; a **credit-card surcharge is a line item** (normal and legal in AU,
not in much of the US); and the work is described as **"As per verbal quote"** —
the exact §2.5 dispute trigger, on a real document. It also embeds an upsell in
the narrative (*"Pressure limiting valve needs to be installed, cost will be
$700 + GST"*).

**Combined-trade job** — "Washer Relocation, $4,600" as one flat line with a
9-point bulleted scope spanning **plumbing AND electrical** (2" line, PEX, new
120V line from breaker, remove heater, move the heat, box the pipe). Terms:
*Deposit $1,600, balance due when complete.* A quoting tool must let one line
item span trades — the client is buying an outcome, not two trades.

**Tier names by philosophy, not metal.** "Bandaid solution" and "Middle of the
Road" instead of Bronze/Silver/Gold. It frames the *trade-off* rather than
implying the cheap option is inferior — and "Bandaid" is admirably honest about
what a patch repair is.

### 2B.4 Observed plumbing price points

| Item | Observed |
|---|---|
| Service call / callout (AU) | $130 |
| Labour, per man-hour (AU) | $130 |
| Pressure test (AU) | $95 |
| Drain clearing, labour only (Roto-Rooter, Indianapolis) | $568 before 15% discount → $482.80 |
| Water re-pipe base fee | $1,000 |
| Level 3 water repipe, **per fixture** | $976 (×12 = $11,712) |
| Pressure regulator (PRV), heavy duty ¾" | $784 |
| Washer box install | $560 |
| Directional bore base fee (incl. up to 50 ft) | $4,468 |
| Obstruction (waterline/sewer/gas in path) | $621 |
| Minor gas repair | $311 |
| 50-gal natural gas water heater (equipment only) | $2,664 |
| Gas water heater economy install package | $667.77 |
| "Brief assistance needed" (extra labour, difficult install) | $703.66 |
| Municipal plumbing permit, residential | $238.50 |
| Washer relocation (plumbing + electrical, flat) | $4,600 |

### 2B.5 What this adds to the build

On top of §1.1's seven models, plumbing adds five requirements:

8. **Zero-priced clause lines** — exclusions and liability as visible line items.
9. **Item dependencies** — "requires install package", enforced at quote time.
10. **Difficulty levels with printed criteria**, not bare labels.
11. **Per-service-type warranty matrix**, and per-customer-class where it differs.
12. **Discounts that carry an economic reason** (combined labour, add-on
    fixture), with same-day-only pressure discounts explicitly discouraged.

Plus: credit-card surcharge as an optional line, GST/VAT by country, and a line
item that can span trades.

---

## Part 2C — Deep benchmark pass: methodology traps and pricing STRUCTURE

A second, much deeper research pass (~180 fetches). Its per-item ranges refine
§2.1; what follows is only the material that **changes the build**.

### 2C.1 Three methodology traps — read before trusting any cost guide

**1. The aggregators are one source wearing three hats.** Angi, HomeGuide and
HomeAdvisor are all IAC/Angi-owned, and the identical "$50–$130/hr" band appears
verbatim on all three. HouseCall Pro's 2026 task table is **identical to Angi's**.
Treating those as four confirmations is how a wrong number becomes "consensus".
Genuinely independent reads: **Fixr, Thumbtack, Build-folio**, and individual
contractor blogs.

**2. Homewyse is a systematic high outlier** — ~1.6–2× consensus on every device
task, with material/labour/supplies listed as three identical line items (a
formula artefact). **Exclude from baselines.**

**3. Practitioner forums are now paywalled.** ElectricianTalk and ContractorTalk
307-redirect to Tollbit returning **HTTP 402**; Mike Holt's returns **403**. Every
practitioner figure below is a search-engine snippet with **unverified date and
region** — and they are simultaneously the *most useful* and *least verified*
numbers in the research. Highest-value thing to re-verify with a human browser.

### 2C.2 The structural findings — these are schema requirements

**① First-unit vs each-additional is the real shape of device pricing.** Not a
discount — a different price for the first one, because the first unit carries
the truck roll:

| Position | Device price |
|---|---|
| **1st device (sole reason for the trip)** | **$125–$200** |
| Devices 2–10 | $55–$90 |
| Devices 11–40 | $45–$70 |
| 40–75 (whole house) | $40–$60, **or switch to a day rate** |
| Filthy / crawl access | **+$20/device** |

Corroborated three independent ways (practitioner "$55/device whole house, $75 if
real dirty"; "$25 standard / $50 GFCI when already on site, but $100 / $125 for
showing up to do one"; and published "bundling 3–6 outlets cuts per-outlet labour
30–50%"). Same shape appears in data drops (**$85 first, $55 each additional**),
fixtures (**$150–250 first, $50–125 each additional**), recessed cans, and
circuits (**2 circuits −15–20% each, 3+ −25–40%**).

⚠️ HomeAdvisor shows *no* volume discount (1 outlet $130–300 vs 10 outlets
$135–300 each). That contradicts every other source and every practitioner —
it reads as linear extrapolation, not observed quotes. **Judged wrong.**

**② The same item is TWO different SKUs.** An AFCI breaker fitted while the panel
is already open during other work is **$50–$75**. The same breaker as a standalone
truck roll is **$180–$400**. Both figures are correct. A price book with one
"AFCI breaker" line will badly under-price the one-off call. The catalogue needs
an **add-on price** and a **standalone price** per item.

**③ On small jobs the minimum charge IS the price.** A fixture swap is ~30
minutes of work, but every billing-aware source lands at the same place: service
call **$100–$200 including the first hour**, or a 1–2 hour minimum. **Price a
single fixture swap at $150–$250 (the minimum), not at ~$60 of labour.**

**④ Adders are first-class, not notes.** The single biggest driver on many jobs:

| Adder | Effect |
|---|---|
| Smart switch, **no neutral in box** | **+$100–$300**, or +$200–$500/location |
| Smart switch on a 3-way | +$150–$250/location, **plus companion devices** |
| Chandelier 50–75 lb / 75–150 / 150–300 / 300+ | +$50–150 / +$150–400 / +$300–700 / +$700–1,500 |
| Ceiling 16–20 ft | can **double or triple** the standard install |
| Recessed light hitting a joist/duct | **+$200 per light** |
| Aluminium wiring (special connectors) | +$50–$100 |
| Rewire: opening finished walls | **+25–30%** total project |
| Rewire: open-wall renovation instead | **−30–40%** |

**⑤ Permit fees use three structurally incompatible MODELS.** Verified against
real schedules:
- **Per unit of work** — Washington State L&I (effective 1 Jul 2026): first
  1,300 sq ft **$119.90**, each additional 500 sq ft $38.20; circuits per panel
  (up to 4) $78.80, each additional $8.20; new service 0–200A $129.40 … 801+A
  $405.00.
- **Percentage of job valuation** — Philadelphia **$25 per $1,000** of electrical
  cost incl. labour/overhead/profit, min $50 max $15,000. Rock Island IL: $30
  application + **1% of valuation**.
- **Flat by job type** — Jersey City: min $80, panel upgrade $175–275, EV charger
  $90–130, **full rewire $350–700**.

**Do not ship a national permit number.** Make it a per-company configurable line
supporting all three models, defaulting to ~$150 small work / ~$350 rewire.

**⑥ The floor-rate arithmetic** (worth printing in the product): solo electrician
wanting $70,000 take-home → $81,400 taxable after SE tax + $11,000 overhead =
**$115,500 revenue at 20% margin ÷ 1,200 billable hours = $96.25/hr minimum**,
which sets a **$95–$120 floor for a one-hour service call**. Related: *"a
diagnostic fee under about $75 rarely covers the loaded cost of putting a skilled
tech on site."* Electrical diagnostic is the **highest of the three trades**
($125–175 vs HVAC ~$89, plumbing $75–100) because of liability and code
complexity — and the common practice is to **credit it against approved work**.

**⑦ Source bias runs in a predictable direction on excavation.** Trenching:
lead-gen sites cluster **$5–12/LF**, contractor-oriented and itemised sources
cluster **$11–27/LF**. The gap is systematic — the low band is excavation labour
only, shallow, easy soil. **Use $10–18/LF for residential electrical.** Boring is
the reverse and even sharper: **the actual boring contractor quotes the lowest
number ($6–15/ft)** while the furthest-removed blog quotes $30–70+. And **short
trenches are minimum-charge jobs, not per-foot jobs** — a $1,200 crew minimum on
35 ft computes to $34/ft, which is an artefact, not a rate.

**⑧ Two code-driven cost levers a good quote should surface.** One GFCI at the
first outlet protects everything downstream on that circuit — one $150 device
instead of six. And a **GFCI breaker protecting the whole circuit is cheaper than
individual GFCI receptacles at each location.** Software that knows this can show
the client a cheaper compliant option, which is the opposite of what the
high-pressure estimates in Part 1 do.

### 2C.3 Refined ranges worth carrying into the catalogue

Rewire **$5–17/sq ft** finished walls (the $2–4 camp describes partial/accessible
work — *do not seed from it*); **1,500 sq ft → $6,000 low / $10,000–15,000
typical / $25,000 high**, with three independent 2026 sources converging on
$8,000–15,000. Regional per sq ft: Northeast $7–14 · West Coast $8–15 · Midwest
$5.50–11 · South $5–10. Drywall repair **almost never included** — $300–1,500 per
patch, or $2,000–5,000 with painting.

Knob & tube **$12,000–36,000** ($10–20/sq ft). Aluminium: AlumiConn whole-house
**$1,500–5,000**, COPALUM **$3,500–8,000**, full copper rewire **$12,000–20,000+**
— and the COPALUM premium is **technician scarcity, not materials** (4–8 week
lead times). A typical home has **25–50 aluminium connection points**.

Recessed **$150–250 new / $200–330 retrofit** (retrofit ≈ **1.33×**). Ceiling fan
**$175–300 existing box / $275–400 needing a fan-rated box / $400–550 no existing
fixture**. Fixture swap **$150–300**. Outlet replace **$150–220**. New outlet
**$200–300**, but **$700–900 fished through a finished wall** and **$900–2,000 on
a new circuit from the panel**. GFCI **$190–215**. Standard breaker **$120–220**
installed on a $5–20 part. Smoke/CO **$100–200 each**, whole house **$500–1,200**.
Diagnostic **$125–175**. Cat6 **$150–250/drop** (price by drop, never by foot).

⚠️ **Still unverified after this pass:** opening count for a 1,500 sq ft house
(so the per-opening model can't be totalled), breaker pricing by brand, retrofit
smoke-interconnect wiring, PVC conduit by trade size, and NEC 300.5 burial depths
(the one source found contradicts standard practice — **confirm before
encoding**). Also: **"per circuit" troubleshooting appears not to exist** in the
market; everyone prices per visit or per hour.

---

## Part 2D — Plumbing market benchmarks

Same treatment as §2/§2C, for plumbing. Same aggregator trap applies and is
**worse here**: Homewyse dominated every fixture-install search at roughly **2×**
the independent reads, so the fixture section below is thin by necessity — better
thin and honest than padded with a contaminated source.

### 2D.1 Benchmarks (USD)

**Service & emergency.** Service call / diagnostic **$89–175** (range $50–275).
Emergency hourly **$150–300**. Minimum charge **$150–200**. The reliable form is
the **multiplier**, not the absolute: after-hours weeknight **1.5×**, weekend
**2×**, holiday **2–3×**. Callout-credited-or-not is a live fork in both markets,
exactly as in electrical — the trade's own best practice is a diagnostic fee
that is **waived on approval**, stated up front.

**Drain clearing.** Fixture/branch snake **$175–350** · main line **$250–500** ·
hydro-jet branch **$450–950** · hydro-jet main **$600–1,300** · camera with
service **$150–300** (standalone up to $900). A published regional grid (Denver
$175–340 → San Jose $220–420 for the identical snake) gives a **~25% metro spread
on task price** — the best regionalisation evidence found for any plumbing task.
*Your Roto-Rooter Indianapolis invoice ($568 labour before the 15% discount) sits
at the top of the main-line band — a national-brand premium, not an outlier.*

**Water heaters.** Tank installed: 40 gal electric **$900–1,400** · 40 gal gas
**$1,100–1,800** · 50 gal **$1,200–2,000** (to $3,100). **Install labour alone
$200–600** (2–4 hrs). Adders: expansion tank $150–400 · venting $500–1,500 ·
disposal $50–150. Tankless installed **$3,000–5,500**, labour **$1,200–1,800**,
scaling to $2,500–4,000 for a full retrofit with new gas from the meter.

**Repipe.** Per fixture **$550 – $976 – $1,200** (*your Level-3 estimate is the
midpoint*). 2-bath/1,500 sq ft: PEX **$4,500–7,000**, copper **$7,000–10,000**.
3-bath/2,500 sq ft: PEX **$7,000–10,000**, copper **$10,000–16,000**. **Copper
adds 40–60%** — and note the raw material delta is trivial against the total, so
**the copper premium is labour and fittings, not pipe.** Galvanised removal +10–20%.
The published fixture-count convention (bathroom sinks, toilets, showers/tubs,
kitchen sinks, water heater, washer connection, hose bibs) **matches your
estimate's count exactly**.

**Water main.** Open trench **$55–185/ft** · pipe bursting $95–245 · **directional
bore $125–325/ft**, i.e. HDD carries a **50–80% premium**. ⚠️ One source claims
the reverse; leaning dearer. *Your $4,468 bore base fee including 50 ft works out
to ~$89/ft — below both bands, because it amortises mobilisation into a base fee
and charges obstruction separately at $621. That structure is the honest one.*
The dispute-causing adders: driveway saw-cut/patch **$1,200–3,800**, landscape
restoration **$450–2,400** — neither is plumbing work, both land on a plumbing
invoice.

**Sewer.** Excavation **$50–250/ft** (avg $150) · CIPP lining $90–250 · pipe
bursting $60–200. Spot repair $150–3,800 · full replacement **$3,000–7,000**.

**Fixtures** *(thin — Homewyse contamination)*: toilet **$350–700** · faucet
**$250–500** · disposal **$250–450** · dishwasher hookup **$150–250** · washer box
**$650–1,500** (*your $560 is below the band because that band includes running
new supply and drain — different scope*). ⚠️ **Shower valve: no independent read
exists. Ship no default.**

**Valves/gas/slab/cast iron.** PRV **$400–650** · angle stop $200–300 · hose bib
$150–250 · gas line new run **$15–25/ft** simple, $35–50 complex · slab leak
detection **$150–400**, repair **$1,000–4,000** (reroute up to $15,000) · cast
iron **$150–250/ft** traditional, $125–175 lined. ⚠️ Angi's "$12.50–30/ft with
labor" for cast iron is a material figure mislabelled as installed — **the same
failure mode as their $1,567 whole-house rewire. Excluded.**

**Permits: $7–$400, a 57× spread** (Chesapeake VA $7 per heater; NYC $130; SF
$300–400; *your estimate $238.50*). **No national default is possible** — same
conclusion as electrical.

### 2D.2 Labour

Billed **$80–130/hr** standard residential; loaded rate used in flat-rate builds
**$90–160/hr**; emergency $150–300. ⚠️ **No source publishes a metro/suburban/
rural cut for plumbing** — tiers can only be derived from a "30–60% metro
premium" claim, and the one regional task grid suggests a smaller ~25% spread.

**Wages (BLS OEWS May 2025, SOC 47-2152):** median **$30.67/hr** ($63,800),
mean $34.70 ($72,170), n=465,840. ⚠️ **bls.gov returned 403** — these come from a
secondary restatement, arithmetically self-consistent but not primary-verified,
and its claimed +$9,200 YoY jump is implausible. **Re-check with a human browser.**

**The wage-to-bill gap explained properly.** Plumbers earn essentially the same
as electricians ($30.67 vs $30.38) yet bill higher at journeyman/master level.
The reason isn't burden alone — it's **utilisation**: a service plumber is
billable **~30% of paid hours** ("50% is extremely efficient"). ServiceTitan's
worked build: $28/hr wage → 2,916 billable hrs → +$34.29/hr allocated overhead →
**$62.29 break-even** → **$88.99 billable at a 30% net target**. Corroborated
independently: journeyman pay $28–45 → loaded rate $90–160, a **2.5–4×
wage-to-bill ratio**.

### 2D.3 ⚠️ Markup: plumbing and electrical differ in OPPOSITE directions

The single most important cross-trade finding.

Sources split on whether markup should vary by item cost. ServiceTitan argues for
one uniform **3×–6×** on everything, purely for bookkeeping consistency.
Everyone else — and the field — uses a **tiered, inverse** table:

| Part cost | Multiplier |
|---|---|
| Under $25 | **4–5×** |
| $25–100 | 3–4× |
| $100–500 | 2.5–3× |
| **Over $500** | **1.8–2.5×** |

**The decisive evidence is your own estimate.** A ~$1,000 water heater selling at
**$2,664 is 2.66×** — right at the top of the ">$500 → 1.8–2.5×" tier. That
**flatly contradicts the electrical research's "high-value equipment 10–15%"**,
which came from switchgear and generators.

**Both are correct, and the trades genuinely differ.** An electrical panel is a
commodity the homeowner cannot meaningfully shop. A *Bradford White 50-gal* is a
model number they can Google in ten seconds — and contractors still take 2–3× on
it. **Do not carry the electrical equipment-markup band into plumbing.** A single
global multiplier fails on both trades, in opposite directions.

Gross margin target **60–62%** on plumbing service/repair — *higher* than
electrical's 45–65% and stated more confidently. ⚠️ No verified plumbing net-margin
benchmark exists; electrical's 10–20% is the fallback. Same margin formula trap:
**price = cost ÷ (1 − margin)**.

**T&M survives where it should** — leak detection, complex troubleshooting, major
repipes — *"often with a not-to-exceed cap."* **That NTE cap is a schema
requirement the electrical research never surfaced.**

### 2D.4 Verification of the four structures from §2B

| Structure | Verdict |
|---|---|
| **Equipment + mandatory install package** | **Decomposition CONFIRMED standard** (price the removal, the install, the test/inspect and the code-required parts as separate tasks combined on one quote). The explicit *"Must be Combined with Install Package"* dependency flag is this contractor's implementation, not a published convention. Four defensible reasons it exists: the equipment price stays shoppable while margin lives in the non-comparable install; the install tiers good/better/best independently of the tank; **the warranty splits cleanly and must** (6-yr manufacturer on the tank vs 1–2 yr contractor on labour — one line cannot carry two terms); and the package absorbs jurisdiction-specific code parts without re-pricing the equipment SKU. |
| **Per-fixture repipe** | **CONFIRMED standard.** Used by the aggregators ($1,200/fixture) and by specialist repipe contractors who publish what counts as a fixture. |
| **Difficulty levels** | **Mechanism CONFIRMED** and quantified — slab homes **+20–40%** over crawlspace, multi-storey **+10–20%**. But **no source recommends printing the criteria on the customer's document.** That is a genuine differentiator, and the most copyable idea in the whole estimate set: it converts a judgement call the client must trust into a fact they can check. |
| **Philosophy-named tiers** | Literature is uniformly good/better/best — **but the canonical plumbing triad is "repair / replace / replace with upgrade"**, which is already philosophy-naming. "Bandaid solution" is the same idea in blunter words. Precedent exists; the framing argument holds (metal tiers imply the cheap option is inferior; philosophy tiers name the trade-off). |

### 2D.5 Warranty — the matrix is real and publicly published

**Roto-Rooter's own national guarantees page publishes different terms per
service line**, confirming your invoice's structure is company policy:
drain cleaning **6 months** *conditional* ("clear the blockage, or no labor
charge") · general plumbing 1 yr parts+labour · water heaters 1 yr + 6-yr
manufacturer tank · **excavation & relining 5 years**. The page also says
*"guarantees may vary by location"*, which is why your branch invoice carries a
7-day toilet-auger term the national page doesn't. ⚠️ The residential/commercial
split and the 7-day term are **not independently confirmed** beyond your document.

Industry norms: basic repair 30 days–1 yr · **drain cleaning 30 days–6 months
(shortest in the trade)** · major install 1–2 yr · repipe 2–5 yr (to 10) ·
excavation/relining 5 yr.

**Parts and labour terms differ — and not always in the direction you'd guess.**
One documented case runs *90 days parts / 30 days labour* (parts longer); the
water-heater pattern is the reverse (6-yr part, 1–2 yr labour). Your own set has
both.

> **Why drain cleaning is the anomaly:** it isn't a workmanship warranty at all —
> it's a **performance guarantee on a pipe the contractor didn't build and the
> customer keeps using.** A 7-day toilet-auger term is honest for the same
> reason: nothing about the auger fixes what gets flushed.

**Requirement: a price-book item storing ONE warranty string is wrong.** It needs
at minimum `(partsTerm, labourTerm)`, plus residential/commercial variants where
they differ. Roto-Rooter publishing exactly that shape makes this a documented
requirement, not over-engineering.

### 2D.6 Plumbing-specific disputes

Verbal quotes dominate, with real documented amounts: **$695 overcharge** on
three faucets with no written estimate; **verbal $2,000 → billed $3,351**. The
named scam sequence is *low verbal estimate → push to start immediately → never
send the written estimate → bill several times the verbal figure.*

**"As per verbal quote" — the exact line on your AU invoice — is the worst
possible wording.** It documents the *absence* of a quote while pretending to
cite one, and hands the customer the argument.

Also distinct to plumbing: undisclosed callout/travel lines added at invoice
time; **emergency premiums compounding three ways at once** (trip fee + hourly
multiplier + holiday tier, almost never all disclosed); and **excavation scope
creep** — the driveway patch and landscape restoration that aren't plumbing work
but arrive on a plumbing invoice. *That is precisely what your Excavation Clause
exists to pre-empt.*

### 2D.7 ⚠️ AU/NZ — one finding is TIME-CRITICAL

**GST: AU 10%. NZ is 15%, not 10%.** Consumer-facing quotes in AU must present a
single GST-inclusive headline total; line-items-ex-GST → subtotal → GST → total
(your invoice's form) is fine for the body.

**Callout + hourly is near-universal** — billed separately from, and often exactly
equal to, the first labour hour. *Your $130 callout + $130 for one man-hour is the
textbook form.* Callout $80–250; standard hourly $80–200. ⚠️ One published city
table contradicts its own stated national average and sits well below every other
source — **do not ship it**.

> ### 🚨 The AU credit-card surcharge is legal today and BANNED from 1 October 2026
>
> The RBA has banned surcharging on **Visa, Mastercard and eftpos** from that
> date, enforced through the card schemes' merchant rules. **Amex and PayPal are
> unaffected** (subject to not exceeding actual cost). **Renaming it an "admin
> fee" or "service fee" does not avoid the ban** and may itself be misleading
> conduct under the ACL.
>
> **Product consequence:** the surcharge line must be **date-aware and switchable
> per payment method**, not a permanent field. A quote that emits a Visa surcharge
> line on 2 October 2026 puts the contractor in breach of their merchant
> agreement. This needs to ship before then.

**Written-contract thresholds** (general residential building work, which
plumbing falls under — no plumbing-specific rule found below these): QLD
**$3,300** incl GST · NSW **$5,000** incl GST · NZ **$30,000** incl GST (Building
Act Part 4A, plus a mandatory disclosure statement and prescribed checklist —
and it explicitly covers subcontracted plumbing and electrical work).
⚠️ **VIC: do not ship.** One unverified source says $5,000; the Domestic Building
Contracts Act likely uses a different structure. Needs checking.

### 2D.8 What could not be verified — do not fill these in

BLS primary source (403); contractor wholesale cost of a 50-gal heater (so the
markup inference rests on a secondary claim); **shower valve install — no
independent band exists**; minor gas repair (only your $311); plumbing-specific
burden multiplier; plumbing net-margin benchmark; region tiers for billed hourly;
apprentice/journeyman/master billed rates (single source family); all flat-rate
adoption percentages (marketing content); the Roto-Rooter residential/commercial
split; Victoria's threshold; **trenchless-vs-open-trench direction** (sources
directly contradict; leaning trenchless-dearer); draw-schedule disputes as a
plumbing-specific pattern (no evidence found).

---

## Part 2E — The rewire takeoff model (automating $/sq ft properly)

The owner asked whether a rewire can be estimated from square footage — "a 2,000
sq ft home might be less than a 3,000 sq ft one". It can, but **not the way the
cost guides do it**, and the difference matters.

### 2E.1 Every published source assumes linearity, and none measured it

konnworld, engineerfix and electricalestimating.us all give **1.5–2.0 ft of cable
per sq ft** and then multiply. Check the arithmetic: 1,000→1,500–2,000 is 1.5–2×;
1,200→1,800–2,400 is 1.5–2×; 2,000→3,000–4,000 is 1.5–2×. **These are not three
observations of a trend — they are one assumption applied three times.** They
cannot be evidence either way.

**The mechanism says sub-linear.** Cable is driven by device count; device count
is driven by **wall perimeter**, not floor area (NEC 210.52(A) is a spacing rule
along walls). Perimeter scales as √area, and room count grows more slowly than
floor area. Modelled: **wire_ft ∝ sqft^0.74**, **openings ∝ sqft^0.76**.

| sq ft | ft/sq ft |
|---|---|
| 1,000 | **1.90** |
| 1,500 | 1.78 |
| 2,000 | 1.70 |
| 2,500 | 1.63 |
| 3,000 | **1.43** |

The model tracks the published band up to ~2,500 sq ft and falls below it at
3,000 — exactly where sub-linearity should bite. So yes: a 3,000 sq ft home
costs less *per square foot* than a 1,000 sq ft one, and the guides get that
wrong.

> **Superseded by the implementation.** The figures above are the first-pass
> derivation. `lib/estimate/rewireTakeoff.js` builds a real room schedule and
> measures **wire ∝ sqft^0.59** and **openings ∝ sqft^0.71** — *more*
> sub-linear, not less, because home runs grow as √area (exponent 0.5) and drag
> the blend below the device-count exponent. Implemented ft/sq ft runs 1.97 at
> 1,000 → 1.74 at 1,500 → 1.30 at 3,000 → 1.11 at 4,000, so **a flat 1.75
> multiplier over-buys ~35% of the cable on a 3,000 sq ft job**, not ~25%.
> Direction and conclusion unchanged; magnitude larger. Trust the module.
>
> Mutation-testing also corrected a claim made here in draft: capping room areas
> is *not* what makes the model sub-linear. Removing every cap still leaves it
> sub-linear (0.78 vs 0.71 on device count) — perimeter ∝ √area does the work,
> and the caps only deepen it by ~0.07 of exponent.

### 2E.2 The opening count — the gap in §2C is now closed

§2C flagged that no source gives an opening count for a 1,500 sq ft house, which
made the per-opening model (the one electricians actually quote) impossible to
total. Derived from NEC geometry:

| sq ft | bd/ba | Openings (code) | **Openings (practical)** | op/100 sq ft | Circuits | Panel |
|---|---|---|---|---|---|---|
| 1,000 | 2/1 | 67 | **75** | 7.5 | 17 | 100 A / 24 |
| 1,500 | 3/2 | 103 | **117** | 7.8 | 19 | 150 A / 30 |
| 2,000 | 3/2 | 114 | **130** | 6.5 | 20 | 200 A / 32 |
| 2,500 | 4/3 | 142 | **163** | 6.5 | 22 | 200 A / 40 |
| 3,000 | 4/3 | 150 | **172** | 5.7 | 22 | 200 A / 40 |

**Validated three independent ways:**
1. **Receptacle density** — model gives 2.9–3.0 per 100 sq ft; a real reported
   house (100 receptacles in 4,300 sq ft) gives ~3.0. Match.
2. **The two pricing models reconcile.** 117 openings × the published
   $100–300/opening = **$11,700–35,100**, and the owner's real 1,461 sq ft quote
   ($21,915) lands dead centre at **$194/opening**. At 50 openings the
   per-opening method could not reproduce any real quote. *The opening count is
   what makes the sq-ft model and the per-opening model agree* — that agreement
   is the evidence.
3. **NEC 220.82 load calc** for 1,461 sq ft → 96 A, so 100 A is code-adequate and
   150–200 A is practice. Consistent with the panel column.

⚠️ A search snippet (paywalled forum, unverified) claims "a 2,000 sq ft home
probably has 30–60 openings". **Discarded** — a 2,000 sq ft house needs **46
receptacles at bare code minimum** from 210.52(A) geometry alone, before a single
switch, fixture or appliance.

### 2E.3 Labour — published units over-predict residential by 2.2×

Summing NECA-style labour units straight gives 240 crew-hours and $33,782 for the
owner's 1,461 sq ft job, against an actual **$21,915**. NECA units are benchmarked
to commercial work. **Residential productivity factor ≈ 0.456.**

Hours per opening, by access: **0.56 open walls · 0.63 light reno · 0.92 fished
drywall · 1.21 plaster & lath · 1.48 knob-and-tube/historic.** Rough-in is 71% of
hours, trim-out 29%.

**Independent corroboration** (not calibrated — a genuine check): a published
crew-day table (2–3 crew) converts to 48–120 / 100–160 / 140–200 crew-hours for
1,000 / 2,000 / 3,000 sq ft. The model's fished-drywall figures — 79, 117, 146 —
sit inside all three. Two unrelated methods agreeing is the strongest validation
in this research.

### 2E.4 ⚠️ The published $/sq ft benchmark contradicts the published $/opening band

Model output for 1,500 sq ft spans **$12.19/sq ft (open walls) → $19.06 (K&T)**,
i.e. the upper half of the $5–17 band, and it **cannot reach the bottom**.

That is correct behaviour, and **the benchmark is what's wrong**: $10,000 for
1,500 sq ft is **$85/opening — below the floor of the $100–300/opening band the
same sources publish.** The two benchmarks are mutually inconsistent;
$10,000–15,000 only reconciles at its very top.

> **Product rule: never surface $5–9/sq ft to a homeowner.** It describes new
> construction or open-wall work — one source says so explicitly (new
> construction $3–5, existing $5–9) while its own regional table says Northeast
> $7–14 and West Coast $8–15. It will be read as a whole-house rewire price.

### 2E.5 What the model cannot know — and why it must return a RANGE

Four variables swing the price by **2.9×** between best and worst case:

| Variable | Multiplier |
|---|---|
| Wall access (open → finished) | 1.00 → 1.75 |
| Wall construction (drywall → plaster & lath) | → 2.35 |
| Existing wiring (→ knob & tube / historic) | → 2.90 |
| Storeys | +15–20% each |

Plus hard stops and adders the model can't infer: **asbestos/lead** (pre-1980 —
separate trade, often paired with K&T), attic/crawl access, **slab-on-grade**
(removes the easiest cable path, +20%), historic designation, occupancy during
work (+10–15%), and a **15–25% unknown-conditions buffer**.

**Also a real omission found by the model's own failure**: it under-predicted the
"Level 3" quote by 30% largely because it carries a *panel* line ($1,500–3,000)
but **no service-entrance line** — mast, meter base, service conductors,
grounding electrode, utility coordination. A full service upgrade is
**$3,000–6,000**, with meter relocation $4,000–8,500. That must be its own
optional line, never folded into $/sq ft.

> **Until wall access, wall construction, wiring type and storeys are answered,
> the honest output is a range, not a number.** A rewire estimator that emits a
> single figure from square footage alone is exactly the "control that appears to
> work and doesn't" that AGENTS.md forbids — so the model is being built to
> return `{ low, typical, high, assumptions[], needsIntake[] }` and to refuse to
> produce a single price until those four are known.

---

## Part 3 — Material costs

Retail material costs by category, to seed the **internal cost** side so the
margin calculation is real rather than a guess. These are cost inputs, never
client-facing prices (non-negotiable #4).

### 3.0 Provenance and how to refresh

**Currency CAD, read 2026-08-10, homedepot.ca store #7140/7274 (Gatineau QC),
pre-tax, non-promotional retail shelf price.**

Every figure below traces to **one retailer in one region**. lowes.com,
supplyhouse.com, rona.ca, canadiantire.ca, amazon.ca and homedepot.com all
blocked automated access (403/503/bot-detection), so there is **no
cross-retailer validation**. Treat the numbers as a defensible starting point
a contractor adjusts to their own supplier — which is what the design already
assumes — not as a market survey.

**How to refresh** (this matters; copper moves within a quarter): scraping
product tiles fails. Home Depot Canada's own product API, called from inside a
real browser session, returns structured JSON with `pricing.displayPrice.value`
and `currencyIso`:

```
GET /api/search/v1/search?q=<term>&pageSize=<n>&lang=en
```

One call returns 40 priced products; ~15 calls covered every category below.

### 3.1 The three fields a naive schema would omit

The data argues that a material default cannot be a single number keyed on a
name. Three dimensions each swing price more than brand choice normally does:

| Dimension | Why | Worst observed |
|---|---|---|
| **Brand / line** | Legacy panels are a routine service call, not an edge case | Stab-Lok breakers run **2–3×** every modern equivalent |
| **Pack or roll size** | Wire is priced per unit of quantity purchased | 12/2 NMD90 is **$2.46/m** on a 150 m roll and **$11.99/m** on a 5 m coil — **4.9×**, same cable |
| **Scope** | Similar names, different products | 200 A 20-space panel: **$259** bare vs **$1,563** as an AFCI plug-on-neutral package — **6×** |

Scope is the dangerous one, because the item names look alike and nothing on
the shelf flags the difference.

### 3.2 Breakers (each)

| Item | Low | Typical | High |
|---|---|---|---|
| 1-pole 15 A | $12.98 | **$14.97** | $29.71 |
| 1-pole 20 A | $12.98 | **$14.75** | $29.71 |
| 1-pole 30 A | — | $22.85 | — |
| 2-pole 15 A | $29.85 | $32.94 | $57.97 |
| 2-pole 20 A | $27.97 | $35.95 | $57.97 |
| 2-pole 30 A | $32.95 | $36.97 | $64.95 |
| 2-pole 40 A | $36.85 | $40.75 | $64.95 |
| 2-pole 50 A | $44.98 | $84.45 | $133.00 |
| 2-pole 60 A | $44.98 | $57.75 | $148.00 |
| Tandem | $28.97 | $40.97 | $61.75 |
| Quad | $39.47 | $59.97 | $65.51 |
| **AFCI 1-pole** | $89.97 | **$94.37** | $194.00 |
| AFCI 2-pole 15 A | — | $195.00 | — |
| GFCI breaker 1-pole | $152.00 | $164.00 | $177.00 |
| GFCI breaker 2-pole | $202.78 | $249.00 | $287.00 |
| Dual-function AFCI/GFCI 1-pole | $114.00 | $147.00 | $197.00 |
| Main 2-pole 100 A | $83.97 | $108.98 | $119.00 |
| Main 2-pole 125 A | $103.29 | $157.48 | **$526.59** |
| Main 2-pole 200 A | — | $119.98 | — |
| Main 2-pole 225 A | — | $178.00 | — |

Brand facts that change defaults:

- **GE is not carried in Canada at all.** Offering it as a brand gives Canadian
  users a option with no retail reference behind it.
- **Federal Pioneer / Stab-Lok** is 2–3× the modern equivalent across the board,
  and is exactly what a 1970s–80s service call is standing in front of.
- **Schneider sells two lines** at materially different prices (QO premium,
  Homeline mid). Treating "Square D" as one brand is wrong.
- Eaton BR is the cheap end on nearly every rating; QO the premium mainstream.
- Schneider's AFCI splits **plug-on ($90.57) vs pigtail ($135–137)** — a
  within-brand, within-rating split that has nothing to do with brand tier.

Standard 1-pole 15/20 A is the one item that can safely carry a single default:
three of five brands cluster at $12.98–14.97, so **~$14** is honest.

### 3.3 Panels and service equipment (each)

| Item | Low | Typical | High |
|---|---|---|---|
| Main-lug subpanel, small (4/8–8/16 ckt) | $57.98 | $88.75 | $119.00 |
| Main-lug 125 A 20-space indoor | $174.00 | $188.50 | $232.00 |
| Main-breaker 100 A 20 ckt | $168.00 | $168.00 | $203.00 |
| Main-breaker 150 A 30–42 ckt | $239.25 | $279.00 | $319.00 |
| Main-breaker 200 A 30 ckt | — | $259.00 | — |
| Main-breaker 225 A 42 ckt | $288.00 | $321.90 | $350.00 |
| Outdoor / rainproof 100 A | — | $217.00 | — |
| Outdoor / rainproof 125 A | — | $227.85 | — |
| Panel **package** 100 A 16sp | — | $339.00 | — |
| Panel **package** 200 A 20sp | — | $429.00 | — |
| Panel **package** 200 A 30sp AFCI plug-on-neutral | — | **$1,563.41** | — |
| Service-entrance loadcentre 200 A 40–60 ckt | $943.00 | $953.00 | $963.00 |
| Meter socket 100 A OH/UG | — | $197.00 | — |
| Whole-home surge protector (Type 1/2) | $206.00 | $217.50 | $229.00 |

Split into **three** catalogue items — bare panel, panel+breakers, code-compliant
AFCI package — or the 200 A default is wrong by 6× at the extremes.

### 3.4 Transfer switches and generator connection (each)

| Item | Low | Typical | High |
|---|---|---|---|
| Manual transfer switch, single-circuit 15 A | — | $198.00 | — |
| Manual transfer switch, single-load 60 A | $238.00 | $268.50 | $299.00 |
| Manual, 6-circuit + inlet | — | $519.00 | — |
| Manual, 8–10 circuit kit | $679.00 | $698.00 | $798.00 |
| Manual, 10-circuit + inlet | — | $749.00 | — |
| Automatic 100 A | — | $799.00 | — |
| Automatic 200 A | — | $1,139.00 | — |
| Automatic 200 A service-entrance rated (CSA) | — | $1,409.00 | — |
| Generator inlet box 30 A (L14-30) | $74.28 | $105.00 | $129.00 |
| Generator inlet box 50 A | — | $129.00 | — |
| Generator cord 50 A, 20 ft | — | $394.00 | — |

**Interlock kits are not sold by Home Depot Canada** — search returns nothing.
That is the cheapest and very common alternative to a transfer switch, so the
catalogue needs a supply-house figure here. Not priced.

### 3.5 Wire and cable — ⚠️ copper is volatile, re-read before shipping

Southwire throughout. Per-metre figures from rolls are computed (roll ÷ length).
75 m ≈ 246 ft, 150 m ≈ 492 ft.

**NMD90 (indoor branch circuit):**

| Gauge | 75 m roll | 150 m roll | $/m bulk | $/ft bulk |
|---|---|---|---|---|
| 14/2 | $138–149 | $228 | $1.52–1.99 | $0.46–0.61 |
| 14/3 | — | $329 | $2.19 | $0.67 |
| 12/2 | $242–267 | $369 | $2.46–3.56 | $0.75–1.08 |
| 12/3 | $325 | — | $4.33 | $1.32 |
| 10/2 | $435 | — | $5.80 | $1.77 |
| 10/3 | $575 | — | $7.67 | $2.34 |
| 8/3 | (40 m $588) | — | $14.70 | $4.48 |
| 6/3 | cut to length | — | $11.32 | $3.45 |

**AC90 (BX) ≈ 1.6–1.9× NMD90** at bulk. **NMWU (direct burial) ≈ 1.9–2.4×
NMD90.** Both are usable multipliers rather than separate tables.

**RW90 single conductor** (services/feeders, sold cut by the metre): #14 $1.11 ·
#12 $1.47 · #10 $2.45 · #8 $4.45 · #6 $5.97 · #2 $12.37 · 3/0 $26.75 per metre.

**Two traps to encode:** short coils cost 2–3× bulk per metre, so *any* wire
default must state the roll size it assumes; and 6/3 NMD90 is $11.32/m cut but
$19.80/m as a 10 m coil — a 75% premium for packaging the same cable.

**Not stocked: bare copper #6 and #4** — the two sizes actually used for
residential grounding electrode conductors. Only #3 stranded ($8.23/m) exists.
Genuine gap; needs a supply-house figure.

### 3.6 Conduit, fittings and boxes

**PVC Sch 40 grey, 10 ft stick:** ½" $8.35 · ¾" $10.88 · 1" $14.87 · 1¼" $21.45
· 1½" $26.95 · 2" $35.55.

**EMT steel, 10 ft:** ½" $17.45 · ¾" $26.94 · 1" $37.48 · 1¼" $49.95 · 1½"
$59.95 · 2" $78.88. **EMT ≈ 2.1–2.2× PVC** at the same trade size —
consistent enough to be a multiplier rather than a second table.

**PVC fittings (each):** 90° elbow ½" $2.63 / ¾" $3.27 / 1" $4.42 / 2" $15.97 ·
LB body ½" $8.66 / ¾" $9.88 / 1" $13.42 / 2" $35.53. Bulk boxes run 20–30% under
the each price.

**Boxes:** plastic 1-gang 18 in³ $2.87 · steel 1-gang 12.5 in³ $2.22 ($1.67 in a
30-pack) · old-work/cut-in steel $10.53–14.48 · octagon ceiling 4" $13.67 ·
weatherproof PVC 1-gang $12.67. **Fan-rated box + bar hanger: $21.97 new work,
$31.95 rework** — a 45% rework premium worth carrying as two items.

### 3.7 Devices (each)

| Item | Low | Typical | High |
|---|---|---|---|
| Receptacle 15 A duplex standard | $2.60 (10-pk) | $3.28 | $5.97 |
| Receptacle 15 A weather-resistant | $5.38 | $5.68 | $5.97 |
| Receptacle 15 A commercial grade | $21.58 | $26.52 | $31.45 |
| **GFCI receptacle 15 A** | $23.87 | $29.98 | $98.48 |
| **GFCI receptacle 20 A** | $24.98 (3-pk) | $36.98 | $37.97 |
| AFCI receptacle | $46.57 | $46.57 | $51.93 |
| Dual-function AFCI/GFCI receptacle | — | $41.98 | — |
| USB receptacle | $30.95 | $41.97 | $91.97 |
| Weatherproof in-use cover 1-gang | $24.50 (2-pk) | $49.00 | — |
| Switch single-pole 15 A | $1.58 | $2.57 | $3.38 |
| **3-way switch** | $3.38 | $4.48 | $28.22 |
| Dimmer, LED-compatible | $18.97 | $33.95 | $46.98 |
| Smart switch (Wi-Fi) | $21.95 | $55.98 | $115.00 |
| Wall plate 1-gang standard | $0.68 | $1.91 | $2.34 |
| Wall plate screwless/designer | $3.37 | $6.28 | $11.98 |

### 3.8 Lighting, fans and safety (each)

Recessed LED 4"/6" retrofit $16.47–44.98 · premium/tunable $44.98–134 · housing
(new construction IC/airtight) $19.98–83.72 · bath fan basic $39.99–94.98 ·
bath fan w/ light or humidity sensor $138–309.

**Smoke alarm hardwired + battery backup $52.00–66.97 · smoke/CO combo hardwired
$99.97–109 · wireless-interconnect smoke/CO $269–289.** That last one is a 2.6×
jump for the same functional description — separate line item, not a variant.

### 3.9 Where a single default is most misleading

Ranked by observed spread on functionally interchangeable items:

| Rank | Item | Spread | Cause |
|---|---|---|---|
| 1 | Exterior wall lanterns | **13.3×** | homeowner choice |
| 2 | Ceiling fans | **10.7×** | homeowner choice |
| 3 | Panel bare vs. AFCI package | **6.0×** | **scope** |
| 4 | Smart switches | 5.2× | feature tier |
| 5 | Main breaker 2-pole 125 A | 5.1× | brand |
| 6 | Wire, coil vs. bulk roll | 4.9× | **quantity** |
| 7 | GFCI receptacles | 4.1× | aesthetics only |
| 8 | Breaker 2-pole 60 A | 3.3× | brand |
| 9 | Legacy Stab-Lok, all ratings | 2–3× | **legacy panel** |
| 10 | AFCI breakers | 2.2× | brand + plug-on/pigtail |

Ranks 1–2 should not be material defaults at all — they are **customer-selected
allowances**, the same treatment the plumbing set gives fixtures (§2B).

### 3.10 CAD vs USD

Only **two matched SKUs** could be compared, because homedepot.com blocks both
fetching and browser sessions:

| Item | CAD | USD | Ratio |
|---|---|---|---|
| Square D QO 20 A 1-pole (QO120CP) | $20.97 | $16.98 | 1.235 |
| Southwire 14/2 ~250 ft / 75 m | $149.00 | $114.00 | 1.307 |

Nominal **CAD ≈ 1.24–1.31 × USD list**. Two points, one device and one wire —
enough to sanity-check a conversion, not enough to trust to the percent.

**Do not derive CAD defaults by converting USD ones.** If the live rate is in the
1.35–1.40 range then Canadian shelf prices are at or *below* US prices after
conversion, and a naive `USD × FX` default overprices Canadian materials by
roughly 5–10%. The price ratio above is measured; that FX conclusion is not —
the rate on 2026-08-10 could not be verified from any accessible source.

### 3.11 Not verified — stated plainly

- **Interlock kits** — not sold by the retailer; no price from any source.
- **Bare copper #6 and #4** — not stocked; the sizes actually used for grounding.
- **Meter-main combination units** — zero results; one meter socket SKU exists.
- **200 A outdoor/rainproof panels** — not found; outdoor stock tops out at 125 A.
- **RW90 2/0** — the listing shows "$4,799 each" against a cut-by-the-metre
  description. Either a reel price or a data error. The $21–23/m in circulation
  is interpolated between #2 and 3/0, **not read**.
- **12/3 NMWU 30 m** ($13.30/m vs $5.92/m on the 75 m roll) and **14/3 NMD90
  75 m** ($399 vs $329 for 150 m) are internally inconsistent listings, excluded
  from the typical columns.
- **Wholesale/contractor pricing** (Nedco, Gescan, Westburne, Ideal Supply) —
  entirely inaccessible. Everything here is **retail**. Contractors on account
  pay meaningfully less on commodities (wire, breakers, boxes) and close to
  retail on homeowner-choice items. **Label the defaults "retail"** so users
  know which direction to adjust.
- **Regional variation within Canada** — one store, one region.

### 3.12 Plumbing materials

**Done — see `docs/plumbing-material-costs.md`** (read 2026-08-10). Same rule:
retail, cost inputs only, never client-facing. Four findings there change this
part too:

1. **It corroborates §3.10 from the other side.** Plumbing CAD/USD ratios run
   **0.85–1.53 by category** — commodity pipe near or below parity, tank water
   heaters at ~1.50. Two independent trades now say the same thing: **store
   material cost per region, never `USD × FX`.**
2. **A second working access path.** The homedepot.ca product API in §3.0 needs
   a real browser session and is unreachable otherwise. Where it isn't
   available, `r.jina.ai` as a text proxy renders *some* homedepot.ca category
   pages with prices intact (water heaters, copper, ABS, PEX fittings — but not
   toilets or PVC), and `kelloggsupplyco.com` serves full USD price lists
   server-side. That is the only cross-retailer validation available to this
   repo, and §3.0 currently has none.
3. **Fitting *system* is a cost axis worth ~10×** (crimp vs push-fit). The
   electrical analogue to check before shipping is wiring method — NM vs MC vs
   EMT-and-wire on the same circuit.
4. **The $2,664 water-heater equipment line from §2B.4 is decomposed** against
   verified retail: **2.2–3.3× retail**, 4–6× likely wholesale, with install
   billed separately. It is the strongest evidence in the repo for §2.5's
   itemisation requirement.

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
8. **A material default is not a number keyed on a name.** It carries
   **brand/line**, **pack or roll size**, and **scope** (§3.1) — without those, a
   contractor adjusting "breaker — $14" has no way to say their panel jobs are on
   1970s Federal Pioneer gear at 3× the price.
9. **Homeowner-choice items are allowances, not material defaults.** Fans (10.7×),
   lanterns (13.3×) and plumbing fixtures vary by taste, not by trade. A default
   there is a fiction; an allowance line is honest.
10. **Material defaults are labelled "retail, <date>, <region>"** and say what
    they assume, because that is the only way a user knows which direction to
    adjust — and because copper moves within a quarter (§3.0).

*Sources: Part 1 is a direct reading of 15 estimates supplied by the owner
(Whittier CA, Seattle WA, Bay Area CA, Sacramento CA and unnamed markets, 2022–2025).
Parts 2–3 cite their sources inline once assembled.*
