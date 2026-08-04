# Handyman Services — Pricing Methodology & Price Book (research)

Research basis for building FieldQuo's `handyman` service category into a real
quoting engine. Source list: the 37-service dropdown on **handypoints.ca** (an
Ottawa handyman company). Market focus: **Ontario / Ottawa / GTA, 2025–2026, CAD**.
US figures are flagged `[US]` and are directional only — validate locally before
they become a rate card. Every number below traces to a cited source; nothing is
invented. Where a reliable figure didn't exist (e.g. a flat half-day handyman
rate), it is deliberately left blank rather than guessed.

> **Non-negotiable reminder:** FieldQuo public endpoints never return prices.
> This price book is the *company's own* rate card, used server-side to build a
> quote — it is never exposed on a public self-quote endpoint.

---

## 1. The 37 services, grouped by pricing model

The single most important finding: **these services do not share one pricing
model.** A quoting engine must support five, and tag each service with the right
one.

| Pricing model | Services |
|---|---|
| **Flat per task / per unit** (price-book menu) | Appliance installs (dishwasher, OTR microwave, washer/dryer, range, fridge+water line), TV mount, light fixture / ceiling light, light switch, faucet/sink, bath fan, garage opener/spring, furniture assembly |
| **Per linear foot** | Baseboard, custom closet, cabinet install, fences & gates, framing (as partition) |
| **Per square foot** | Carpet, floor tile, decorative/accent panels, drop-ceiling tiles, framing (as wall), renovations, deck, siding/exterior |
| **Per window / per opening** | Blinds, windows & doors |
| **Hourly / min service call** | Handyman "Services" (general), drywall repair, floor repair, diagnostics, commercial handyman, anything open-ended |
| **Project bid (tiered)** | Bathroom / kitchen / basement / apartment / bedroom / office renovation, countertop, cabinet refacing |

**Two labour markets bleed together in this list.** True handyman tasks
(assembly, TV, baseboard, drywall, tile) *and* licensed-trade tasks (switches,
fixtures, fans, appliance hookups needing new wiring/plumbing, garage-door
springs). Several services legitimately price at the **trade rate**, not the
handyman rate — model a `tradeRate` flag per price-book item.

---

## 2. Pricing methodology (how to price, not just what)

### 2.1 The billable ("loaded") hourly rate — computed, not hard-coded
```
billable rate = base wage + labour burden + overhead + profit
             ≈ 1.5×–3× the tech's base wage
```
- **Ontario handyman bills ~$85–120/hr** to the customer (Ottawa ~$85–120; Toronto/GTA $80–95 common; self-employed pay ~$38/hr vs employee ~$21/hr — confirming the 2–3× rule).
- Store the loaded rate as a **company setting** derived from wage + burden +
  overhead + profit; warn when a quoted line implies **gross margin < ~40%**.
- **Price to a *margin*, not a *markup*.** margin = profit ÷ price; markup =
  profit ÷ cost. Using markup as if it were margin systematically underbills.
  Target labour **gross margin 40–60%**, handyman **net 10–20%**.

### 2.2 Minimum service call — a first-class line
- **$100–200 in Ontario** (usually covers the first hour + travel). Common shape:
  "**first hour $120, then $85/hr**." Some shops set a **$150–400 minimum job**.
- Add-ons that ride along: **travel surcharge $25–75** beyond 20–30 km,
  **helper +$35–50/hr**, **disposal $25–100**.

### 2.3 Material markup
- **Canada 15–30%** on materials the company supplies (US runs 20–50%). Covers
  sourcing time, pickup, and warranty responsibility.

### 2.4 Good / Better / Best tiers + add-ons
- Present tiers to lift average ticket; **default the middle ("Better") as the
  anchor**. Spacing ~**+20%** (Better over Good) and ~**+45%** (Best over Good) —
  *only where the value delta is real* (longer-life materials, warranty, priority
  scheduling).
- Add-ons (disposal, urgent scheduling, material sourcing) capture the work
  *around* the repair.

### 2.5 Renovation quote structure — Ontario norms (important for the reno path)
- **Written contract required** for any home-services contract **over $50**
  (Ontario Consumer Protection Act).
- **Itemize** by trade: labour, materials, permits, **allowances**,
  **contingency**, exclusions — not one lump sum. Show **13% HST** as its own line.
- **Allowances** = placeholder $ for undecided finishes ("$3,000 tile allowance").
  Overage → a **signed change order**. Allowances + verbal change orders are the
  #1 cause of "the quote crept up."
- **Contingency 10–15%** (bump to ~20% for pre-1950 homes).
- **Deposit — legal cap:** for contracts **under $50,000**, a contractor cannot
  demand more than **10% down or $1,000, whichever is less**. Larger renos ≈ 10%
  of contract value. **>15–20% upfront is a red flag.** ← *This is a real
  constraint for FieldQuo's deposit feature.*
- **Payment schedule:** 10–15% deposit at signing → progress draws tied to
  *inspected* milestones (rough-in, drywall, finishes) → ~**10% holdback** at
  completion/deficiency sign-off. Never front-load.
- **GC management fee / O&P:** 10–25% of budget (overhead 10–15% + profit 5–10%).

---

## 3. Price book — small jobs & installations (CAD, Ontario 2025–26)

| Service | Model | Range (CAD) | Key drivers |
|---|---|---|---|
| Dishwasher install | flat/unit | $110–270 | existing vs new lines, disposal of old |
| OTR microwave install | flat/unit | $120–250 | vent/outlet, 2-person lift, new circuit |
| Washer/dryer install | flat/pair | $100–300 | existing hookups, stacking, gas vs electric |
| Range/stove install | flat/unit | $100–300 | 240V outlet, gas line, anti-tip |
| Fridge install w/ water line | flat/unit | $150–200 | distance to water, proper tee vs saddle |
| TV mount | flat by size | $100–650 | size/weight, wall type, full-motion, **cord concealment** (raceway $30–85; in-wall +$50–175; recessed outlet $85–200 — in-wall power needs a code-legal kit) |
| Baseboard | per linear ft | $6–12 supply+install (~$1/lf install-only) | material, profile, removal, caulk/paint |
| Blinds | per window | $30–80 (motorized from ~$380) | inside/outside mount, count, weight |
| Light fixture / ceiling light | flat/unit | $100–250 (chandelier/fan $250–800) | existing box, weight, ceiling height (+$50–100 vaulted) |
| Light switch / dimmer | flat/unit | $50–250 | standard/dimmer/smart, 3-way, trade rate |
| Bathroom faucet/sink | flat labour | $250–350 (full sink+faucet $400–800) | valve condition, supply lines, access |
| Garage opener install | flat/unit | $350–500 | HP, belt vs chain, Wi-Fi/backup |
| Garage spring replace | flat/job | $120–450 | torsion vs extension, single vs pair |
| Garage tune-up | min service call | $120–250 | travel; lube, tension, balance |
| Furniture assembly | per item / hourly | $50–200 | complexity, pieces, wall-anchoring |
| Drywall patch | flat/hourly + min call | $75–800 by size | hole size, ceiling vs wall, paint match |
| Floor tile repair | per tile + min call | $70–180/tile ($100–300 min) | pattern, matching tile, subfloor |
| Carpet install | per sq ft | $1.50–4.60 labour ($3.30–7.30 w/ material) | removal, stairs, underpad |
| Custom closet | per linear ft | $150–1,200 by material (wire→solid wood) | material, drawers/accessories |
| Accent / panel wall | per sq ft | $3–15 labour (+$7–25 material) | complexity, ceiling height |
| Bath fan replace | flat/unit | $200–500 (new install $400–750) | rewire vs swap, CFM, duct/attic access |
| Drop-ceiling tile | per tile / per sq ft | $2–15/tile, $2–7/sq ft | tile material, grid, matching |

---

## 4. Price book — renovations & larger installs (CAD, Ontario 2025–26)

HST (13%) applies on top of nearly all of these — show it as a separate line.

| Service | Model | Budget | Mid | High-end | Notes |
|---|---|---|---|---|---|
| Bathroom reno | per sqft / project | $300/sqft · $7–14k | $450–650/sqft · $12–22k | $650–850+/sqft · $25–40k+ | moving plumbing +20–35%; per-sqft high because fixed cost over small footprint |
| Kitchen reno | project (tiered) | $10–15k cosmetic | $25–60k | $65–100k+ | cabinets 30–40% of budget; quoted lump-sum |
| Basement finish | per sqft (+bath) | $55–65/sqft | $65–80/sqft | $90–120+/sqft | bathroom rough-in $3–8k is biggest add; labour 40–60% |
| Apartment/condo reno | per sqft / unit | $80–100/sqft | $100–200/sqft ($70–120k) | $200–300+/sqft ($120–250k gut) | condo extras: board fees, elevator, work-hour limits |
| Bedroom / office reno | per sqft | $100/sqft | $150/sqft ($20–40k) | $200/sqft | lowest per-sqft (usually no plumbing) |
| Deck build/reno | per sqft (material) | $45–65/sqft PT wood | $55–85/sqft cedar | $65–95/sqft composite | composite +40–50% upfront, saves maintenance |
| Framing | per sqft / linear ft | $5/sqft; partition $18–28/lf | $7–10/sqft | $10+/sqft; load-bearing $35–55/lf | excludes drywall/finishing |
| Windows | per unit all-in | $400–600 | $600–1,200 | $1,200–3,000+ | material, glass package, new opening |
| Doors | per unit | interior ~$700 (labour $150–350) | patio ~$2,200 | exterior entry ~$3,900 | pre-hung vs slab |
| Countertop | per sqft by material | laminate $20–50 | quartz A/B $65–105 | quartz premium $110–180+ | + cutouts $75–150, seams $150–300 |
| Cabinet install | per linear ft | stock $110–250 | semi-custom $220–450 | custom $375–650+ | GTA at top of each band |
| Cabinet refacing | project | small $6–9k | mid $9–12.5k | $15k | keeps boxes; saves 30–50% vs replace |
| Fences & gates | per linear ft by material | chain link $8–25 | PT pine $45–60 | cedar $55–85 | 100 ft ≈ $4–9.5k; gates as add-ons; removal +$6–15/lf |
| Buildings exterior (siding) | per sqft by material | vinyl $6–14 | fibre cement $10–18 | wood $15+ | 2,000 sqft home $12–35k |

---

## 5. How to build this into FieldQuo (recommendation)

FieldQuo already has: a `handyman` system category (today only an "estimated
hours" intake field), a recipe engine with `production_rate` (per-sqft) and
`cabinet_unit` (per-unit) models, `QuickAddItem` (company-scoped price-book rows:
`description / unit / rate / section`), and Good/Better/Best tier support on
quotes. So most of the machinery exists; what's missing is the **handyman price
book + the models these services need.**

**Proposed build (phased):**

1. **Seed a handyman price book** as a template a company can adopt — a set of
   `QuickAddItem`s with the model + unit + a sensible default rate (from §3/§4),
   grouped into `section`s (Installs, Trim & Flooring, Electrical-lite, Plumbing-
   lite, Doors & Windows, Renovations). Rates are **editable defaults**, clearly
   labelled as starting points to localise — never presented as fixed truth.

2. **Add the missing pricing models** to the recipe/intake layer:
   - `flat_per_unit` (menu tasks), `per_linear_ft`, `per_window`, `min_service_call`.
   - A **`tradeRate` flag** per item (handyman vs licensed-trade rate), because
     switches/fixtures/fans/hookups price at the higher trade rate.

3. **Minimum service call as a first-class quote line** (with the first-hour
   shape), plus optional travel/helper/disposal add-ons.

4. **Company billable-rate setting** derived from wage + burden + overhead +
   profit, with the **margin-floor warning (<40%)**. (Overhead settings already
   exist — connect them.)

5. **Per-service intake fields** so a quote can be built from measurements:
   baseboard→linear ft; blinds/windows→count; carpet/tile/panel/reno→sq ft;
   appliance/TV/fixture→which unit + conditions. Replace the lone "estimated
   hours" field.

6. **Renovation path** (bathroom/kitchen/basement/etc.): per-sqft × tier as a
   starting estimate, **plus** structured **allowances, contingency %, deposit
   (capped per the Ontario 10%/$1,000 rule), milestone payment schedule, and
   signed change orders.** This ties directly into the deposit/payments work.

**Do NOT** ship these rates as gospel — they're a researched starting rate card
the contractor tunes to their market. And the two-labour-market reality means the
`tradeRate` flag isn't optional polish; it's needed to price ~8 of these services
honestly.

---

## 6. Caveats
- Bathroom/kitchen/basement/condo figures are strongest for Ottawa + GTA; a few
  room-level per-sqft figures (bedroom/office, framing) lean on Toronto or a
  flagged US source.
- 2026-dated guides show 8–15% material inflation vs 2024 on siding/decking/
  general labour — the high ends reflect current pricing.
- Toronto/GTA runs ~15–20% above the Ontario provincial average; Ottawa ≈
  provincial average.
- No reliable flat half-day/full-day handyman rate surfaced — priced as
  hourly + minimum instead. Not invented.

## 7. Sources (representative — full list per section in the research thread)
Methodology: ServiceTitan (flat-rate vs hourly; pricing for profit), Jobber
(price handyman jobs; good-better-best), Housecall Pro, Pricebookr, Handoff,
ShiftFlow, AIA (allowances/contingency), Ontario CPA deposit rules.
Small jobs: Absolute Home Services (Toronto), Fixrr, UrbanTasker, TaskRabbit CA,
HomeGuide/HomeAdvisor `[US]`, Alberta Appliance Installers, 6ix Assembly, HomeStars,
YVR Handyman, Gorilla Repairs, Priority Garage Doors, Assembly Experts.
Renovations: Ottawa General Contractors, Upland Builds, HomeStars (Ottawa/Toronto
guides), Markway Homes, Sensodesign, Clera Windows, Stone Valley, Josh Kitchen,
Premier Fence, Custom Contracting, Builders Ontario (deposit law), HMJ Contracting.
