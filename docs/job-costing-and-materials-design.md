# Job Costing, Materials & Profitability — Design

The goal: separate what a company **collects to build a quote** from what it **sells as add-ons** from what it **spends to do the work**, then use the first to estimate the third automatically, and warn when a quote is priced below target margin.

---

## 1. The three layers

Today these are blurred. They should be distinct, because each behaves differently and lives in a different place.

### Layer 1 — Basic intake (information, not a product)

What the company must know to price the job. Already modeled: `quoteIntakeFields.js` → stored per quote in `Quote.scopeDetails`.

Examples for **cabinet refinishing**: door count, drawer count, wood species, sheen, finish type, number of coats. These are **inputs**. They drive the base price *and* the material estimate. They are never line items a client "buys."

This layer already exists and works. Nothing here is a "product."

### Layer 2 — Add-on products & services (client-facing, sellable)

Discrete things a client can be charged for, on top of the base scope: New Handles, Soft-Close Hinges, Soft-Close Drawer Slides, Two-Tone, Glass Inserts, pull-outs, crown moulding, lighting.

Already modeled: `Product` linked to a `ServiceCategory`, surfaced in the quote builder's "Add from Products & Services" picker, seeded with standards. **Done.**

### Layer 3 — Materials, consumables & labour (internal cost, NOT client-facing)

What the job actually *consumes*: gallons of primer/paint, rolls of tape, rolls of masking film, plus labour hours. The client never sees these as lines — they see one price. Internally, the sum of Layer 3 is the **job cost**, and quote price − job cost = profit.

This is the new work. And your instinct is right: it belongs on the **cost/expenses side**, not in Products. Products is Layer 2 (what you sell); this is what you spend.

---

## 2. What each layer answers

| Question | Layer | Where it lives |
|---|---|---|
| "How many doors, what wood, what sheen?" | 1 – intake | `Quote.scopeDetails` (exists) |
| "Do they also want soft-close hinges?" | 2 – add-on | `Product` ↔ category (exists) |
| "How much primer/paint/tape/labour does this consume?" | 3 – cost | new **material recipe** + `Material`/`Expense` (build) |
| "Are we making money on this?" | 3 – signal | new **profitability badge** in quote builder (build) |

---

## 3. Auto-material calculation — the model

The core idea: each category has a **recipe** — a small set of coverage rates, per-unit consumption, and labour rates — that turns Layer-1 intake into estimated quantities. Recipes ship with sensible industry defaults (seeded from your TrueFinish numbers) and every company can override them.

### Worked example: cabinet refinishing

**Intake (Layer 1):** `doorCount`, `drawerCount`, `woodSpecies`, `sheen`, `coatsOverride?`

**Rule — primer coats by wood (your ask):**
- Porous / never-painted species (oak, ash, hickory, pine) → **default 3 coats** shellac primer (BIN), because tannin/grain bleed-through.
- Previously painted / non-porous (maple, MDF already finished) → default 1–2 coats.
- Always **overridable** per quote (`coatsOverride`).

**Surface area:**
- Assume an average finished area per door and per drawer front (both sides + edges). E.g. door ≈ 12 sqft, drawer front ≈ 3 sqft (company-editable).
- `totalSqft = doorCount*doorSqft + drawerCount*drawerSqft + boxFaceSqft`

**Paint & primer volume:**
- `primerGallons = ceil(totalSqft * primerCoats / coverageRate)` — coverage ≈ 300–350 sqft/gal (BIN is lower, ~300).
- `topCoatGallons = ceil(totalSqft * topCoats / coverageRate)` — Renner 2K ≈ 350 sqft/gal.
- `hardener = topCoatGallons * 0.05` (your 5% catalyst).

**Consumables (tape, masking film):**
- Ratio-based: e.g. 1 roll painter's tape per ~8 doors, 1 roll masking film per job + per ~15 units, sandpaper per ~20 units. All editable ratios.

**Labour:**
- Per-unit minutes (prep + spray + reinstall) × units + fixed setup/teardown hours → total hours.
- × **burdened hourly rate** (from Overhead salaries, or a flat rate the company sets).

**Estimated job cost** = Σ(material qty × unit cost) + labour hours × rate + allocated overhead %.

Material unit costs come from the existing `Material` / `MaterialPriceEntry` catalog (real purchase prices with supplier history) — so as their supplier prices change, estimates track reality.

---

## 4. Where it lives (recommendation)

**A per-category "Material Recipe" + an internal cost-estimate panel on the quote — not Products, not a client line item.**

Concretely:
- New model **`MaterialRecipe`** (per company + category): coverage rates, per-unit sqft, consumable ratios, per-unit labour minutes, default coats-by-wood rules. Seeded from industry defaults (TrueFinish numbers for cabinets), fully editable in a new **Settings → Materials & Costing** area (extends the existing Materials page).
- The quote builder computes an estimate from `scopeDetails` × recipe × `Material` unit costs × labour rate. Shown in an **internal "Cost & Margin" panel** (the empty `MaterialCard.js` is the natural home).
- Optionally, on job creation, write the estimate to `Expense` rows tagged with `projectId` (job costing already supported) so estimated-vs-actual can be compared later.

This reuses `Material`, `MaterialPriceEntry`, `Expense.projectId`, `isOverhead`, and Overhead salaries — all of which already exist.

---

## 5. Profitability signal

On the quote builder, once there's a price and an estimate:

```
estimatedCost = materials + labour + (overhead % × price)
margin        = (price − estimatedCost) / price
```

Badge, using company-set thresholds (defaults e.g. red < 15%, amber 15–30%, green > 30%):

> **Est. cost $2,140 · Margin 22% · ⚠ Below your 30% target**

This is the "quick signal if the job is being underpriced" you asked for — visible while quoting, before it's sent, not after.

---

## 6. Phased build

**Phase 1 — Cabinet refinishing, end to end (proof):**
`MaterialRecipe` model + cabinet default recipe (from TrueFinish) → cost-estimate computation from intake → Cost & Margin panel in the quote builder → profitability badge with company thresholds. Material costs from a simple company material table; labour from a single burdened rate.

**Phase 2 — Real costs & job costing:**
Pull material unit costs from `Material`/`MaterialPriceEntry`; derive burdened labour rate from Overhead salaries; write the estimate to `Expense` (projectId) on job creation for estimated-vs-actual.

**Phase 3 — Breadth:**
Recipes for interior/exterior painting, flooring, stairs, countertop (you already have the TrueFinish math for all of these in `new-services.js` — it ports directly). Reorder alerts via `Material.reorderThreshold`.

---

## 7. Decisions (locked)

1. **Labour rate source:** per-worker. Each `Worker` already has `hourlyRate`. The recipe estimates **labour hours per job** from the intake; that × the assigned worker's rate = labour cost. `TimeEntry` (worker→job, hours, pending/approved) is the "pending approval" path for actuals later. Falls back to a company default rate when no worker is assigned yet.
2. **Overhead allocation:** start as a flat % of price (tunable); can later derive from monthly overhead ÷ job capacity.
3. **Margin target:** **30%** default (green ≥ 30%, amber 15–30%, red < 15%). Editable.
4. **Client visibility:** materials/labour stay 100% internal — client sees only the price. Matches how TrueFinish works.

## 8. Phase 1 scope (building now — no schema change)

To avoid another migration, Phase 1 computes everything from existing data:
- Default cabinet-refinishing **recipe as a data file** (`app/data/materialRecipes.js`), seeded from TrueFinish (sqft/door, coverage rates, primer-coats-by-wood, consumable ratios, per-unit labour minutes).
- A pure **estimate function** (`lib/costing/estimateJobCost.js`): intake → material quantities & cost, labour hours & cost, total, margin.
- An internal **Cost & Margin panel** in the quote builder: picks the assigned worker (uses `hourlyRate`), shows the material/labour breakdown and a **margin badge** vs the quote price at the 30% target.

Persistence + company-editable recipes + writing estimates to `Expense` (job costing) follow in Phase 2 once the numbers are validated.
