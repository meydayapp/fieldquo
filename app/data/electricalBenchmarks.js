// app/data/electricalBenchmarks.js
//
// ── Nothing here is client-facing ───────────────────────────────────────────
//
// These are national market ranges shown to the CONTRACTOR while they set their
// own price: "typical range $2,000–$3,500 — set your price". Not one number
// here may land on a quote, an invoice, a PDF, an email or any /quote, /book,
// /q, /portal, /site or /embed route. Two reasons, and the second is the one
// that bites: a national band is wrong in any specific market (Part 1's Bay
// Area panel is $10,000 against a $1,400–2,500 national typical), and
// non-negotiable #4 says public endpoints never return prices — publishing a
// rate card openly hands it to every competitor in the city.
// scripts/check-electrical-catalog.mjs enforces the boundary.
//
// The catalogue itself (app/data/electricalCatalog.js) ships `rate` absent, and
// that stays true. This file is the guidance layer beside it, Part 4 rule #2.
//
// ── Currency: USD. The materials file is CAD. Do not subtract them. ─────────
//
// Part 2's market research is US (BLS, US municipal permit schedules, US cost
// aggregators). Part 3's material costs were read off homedepot.ca in CAD.
// §3.10 measured CAD ≈ 1.24–1.31 × USD list on two matched SKUs and then said
// plainly: do not derive one from the other, because if the live FX rate is
// 1.35–1.40 a naive `USD × FX` overprices Canadian materials by 5–10%. So a
// margin computed as (benchmark here − material cost there) is arithmetic
// across two currencies and is wrong. Convert deliberately or not at all.
//
// ── Confidence register ─────────────────────────────────────────────────────
//
// Same discipline as lib/estimate/rewireTakeoff.js, one tag per entry:
//
//   read     Taken from a published source or read off a real estimate,
//            cited in `basis`. The strongest tag available here.
//   derived  Computed from `read` inputs — a back-calculation, a cross-trade
//            transfer, or a reconciliation between two sources. Reproducible,
//            and `basis` says from what.
//   guess    No source. Not used in this file: an entry with no evidence gets
//            a null range and a `noRange` reason instead, because a guessed
//            "typical range" is exactly the control that appears to work and
//            doesn't. The tag exists so the schema can say so.
//
// ── A range of `null` is a statement, and it is the honest one ──────────────
//
// Five entries have no band. Part 2 refuses to publish a default for 400 A
// service upgrades ($2,000–15,000 with no convergence) and heavy chandeliers
// (one data point); no source publishes an installed transfer-switch price;
// re-inspection fees appear nowhere in this research at all; and after-hours
// work has no dollar band because §2D.1 found the reliable form is a
// MULTIPLIER, not an amount. Each carries `noRange` saying which. Absence of a
// statement is not a statement — the UI must show "no benchmark, set your own",
// never a padded default.
//
// Where an item was observed exactly once, low === typical === high. That is a
// point, not a range, and `basis` says so.
//
// ── Fields ──────────────────────────────────────────────────────────────────
//
//   low/typical/high  USD installed. All three null together, never partly.
//   currency          "USD" throughout. Read the currency warning above.
//   basis             Where the numbers came from, cited to a research section.
//   confidence        read | derived | guess (see register).
//   noRange           Required iff typical === null. Why no band exists.
//   multiplier        {low,typical,high} on the standard rate, for the one item
//                     whose market form is a multiplier (§2.2, §2D.1).
//   difficultyTiers   [{ level, criteria, low, typical, high }] — §2B.1③ and
//                     §2D.4: the mechanism is confirmed standard, but no source
//                     recommends PRINTING the criteria on the customer's
//                     document, and that is the most copyable idea in the whole
//                     estimate set. `criteria` is mandatory on every tier: it
//                     converts a judgement call the client has to trust into a
//                     fact they can check, which is what stops a difficulty
//                     multiplier being a dispute.
//   quantityBands     [{ label, from, to, low, typical, high }] — §1.3 (devices
//                     $158 at qty 5+, $67 at qty 21–40) and §2C.2①, where the
//                     real shape turns out not to be a discount at all: the
//                     first unit carries the truck roll and costs 2–3× the
//                     second. §2C.2② is the same field doing a second job — an
//                     AFCI breaker fitted while the panel is already open is
//                     $50–75 and the identical breaker as its own call-out is
//                     $180–400. One rate per SKU cannot express either.
//   adders            [{ label, effect }] — §2C.2④: adders are first-class, not
//                     notes. On many jobs they are the single biggest driver.
//   warranty          { partsTerm, labourTerm } — §2D.5: a price-book item
//                     storing ONE warranty string is wrong. Manufacturer parts
//                     cover and contractor labour cover are different lengths
//                     and routinely run in opposite directions (6-year part /
//                     1-year labour on a water heater; 90-day part / 30-day
//                     labour elsewhere). Either may be null where unobserved —
//                     never both.
//   includesPermit    Whether the band covers the permit fee. It exists because
//                     Part 1's $4,000 subpanel line explicitly bundles permit,
//                     AFCI, labelling and surge while §2.1's $900–1,800 band
//                     does not — comparing them without this field is how a
//                     benchmark looks like an outlier when it is a different
//                     scope. §2.5 wants permits on their own labelled line
//                     naming who pulls, pays and schedules, so every band here
//                     that says `false` means "bill `permit` separately".

/** Part 1's task-code pricebooks are the only electrical warranty evidence in
 *  this research: one prints "5 year warranty" on every line, another sells a
 *  "3 year service warranty" as its own item. Neither is a national norm, so it
 *  is quoted once here rather than copy-pasted onto eight entries where the
 *  copies would rot. §2D.5's industry norms are plumbing and are not imported. */
const P1_PRICEBOOK_LABOUR_WARRANTY =
  "3–5 years workmanship. Part 1: one pricebook prints 5 years on every line, another sells a 3-year service warranty as its own item. Not a national norm — two companies.";

const MANUFACTURER_PASS_THROUGH =
  "Manufacturer's warranty passes through to the client; term is the equipment's, not the contractor's.";

export const ELECTRICAL_BENCHMARKS = {
  // ── Attending the call ────────────────────────────────────────────────────

  service_call: {
    low: 75,
    typical: 125,
    high: 200,
    currency: "USD",
    basis:
      "§2.1 service call $75 / $100–150 / $200. Part 1 shows $29 dispatch billed at $19 and a $59 residential service fee — both below this band, both attached to companies selling a membership or a same-day close. §2C.2⑥ computes the floor arithmetically: a solo electrician wanting $70k take-home needs $96.25/hr across 1,200 billable hours, which puts a one-hour call at $95–120.",
    confidence: "read",
    adders: [
      {
        label: "Credited against approved work",
        effect:
          "Common practice is to waive or credit the fee when the work is approved (§2C.2⑥). Both crediting and not crediting are live practice — a product fork, not a default.",
      },
    ],
  },

  diagnostic: {
    low: 100,
    typical: 150,
    high: 200,
    currency: "USD",
    basis:
      "§2.1 diagnostic $75 / $100–150 / $200+, refined by §2C.3 to $125–175. Electrical is the highest of the three trades (vs HVAC ~$89, plumbing $75–100) on liability and code complexity. §2C.2⑥: a diagnostic fee under ~$75 does not cover the loaded cost of putting a skilled tech on site. Part 1's $359 single-circuit diagnose-and-repair includes the repair.",
    confidence: "read",
  },

  labour_hourly: {
    low: 85,
    typical: 125,
    high: 180,
    currency: "USD",
    basis:
      "§2.2 billed rates: journeyman $50–100, master $90–130+; by region major metro $110–180, suburban $85–130, rural $50–95. The low end of this band is deliberately the suburban floor, not the rural one: §2.2 puts fully burdened break-even at $85–150/hr, so a metro shop billing $75 is losing money. §2C.3: 'per circuit' troubleshooting does not exist in the market — everyone prices per visit or per hour.",
    confidence: "read",
    adders: [
      {
        label: "Minimum charge",
        effect:
          "1–2 hours standard, or a $100–200 call fee including the first hour (§2.2). §2C.2③: on small jobs the minimum IS the price — a 30-minute fixture swap prices at $150–250, not at $60 of labour.",
      },
    ],
  },

  second_electrician: {
    low: 85,
    typical: 125,
    high: 180,
    currency: "USD",
    basis:
      "Same band as `labour_hourly` — a second body is billed at the same hourly rate, not a discounted one. It is a separate line because it is separately forgotten: Part 1's chandelier line is priced at $1,542.75 with '2 men required' printed on it, and Part 2B.3's plumbing set bills 'brief assistance needed' at $703.66 as its own item.",
    confidence: "derived",
  },

  after_hours: {
    low: null,
    typical: null,
    high: null,
    currency: "USD",
    basis:
      "§2.2 emergency 1.5–3×. §2D.1 resolves the shape across both trades: after-hours weeknight 1.5×, weekend 2×, holiday 2–3× — and states that the reliable form is the multiplier, not the absolute.",
    confidence: "read",
    noRange:
      "No dollar band exists, and inventing one would be worse than useless: the premium is a multiplier on the company's own rate, so it is only correct relative to a rate this file does not know. See `multiplier`.",
    multiplier: { low: 1.5, typical: 2, high: 3 },
    adders: [
      {
        label: "Compounding",
        effect:
          "§2D.6: emergency premiums routinely compound three ways at once — trip fee plus hourly multiplier plus holiday tier — and almost never all disclosed. Show the components.",
      },
    ],
  },

  travel_fee: {
    low: 125,
    typical: 150,
    high: 175,
    currency: "USD",
    basis:
      "§2.2 trip fee $125–175 typical. Distinct from `service_call`: Part 1's estimates bill a dispatch fee AND a service fee, and §2.2 treats the trip charge as a third thing again. §2.2 also notes some shops deliberately waive it on approval as a closing mechanism.",
    confidence: "read",
  },

  // ── Service, panel and grounding ──────────────────────────────────────────

  panel_replacement: {
    low: 800,
    typical: 1950,
    high: 4000,
    currency: "USD",
    basis:
      "§2.1 panel replacement at the same amperage $800 / $1,400–2,500 / $4,000; typical is the midpoint of that band. Part 1's $3,888 (150/200 A up to 42 circuits, surface mount) and $3,990 'baseline panel upgrade' (Seattle) both sit near the top — consistent with West Coast metros, not errors.",
    confidence: "read",
    includesPermit: false,
    warranty: { partsTerm: MANUFACTURER_PASS_THROUGH, labourTerm: P1_PRICEBOOK_LABOUR_WARRANTY },
  },

  service_upgrade_200a: {
    low: 1300,
    typical: 2750,
    high: 5500,
    currency: "USD",
    basis:
      "§2.1 100→200 A $1,300 / $2,000–3,500 / $5,500+. Regional: Northeast $3,000–5,500 · West Coast $2,800–5,000 · Mountain $2,200–4,500 · Midwest $2,000–4,000 · South $1,800–3,800. Part 1's $6,997 (Seattle, including panel, meter base, grounding, riser and utility coordination) and $10,000 (Bay Area, overhead service) are above the national high — which is what a national band is for: it tells a contractor whether they are an outlier, not what to charge.",
    confidence: "read",
    includesPermit: false,
    difficultyTiers: [
      {
        level: "Panel only",
        criteria:
          "Existing meter base, mast and service conductors all stay. Panel swaps in the same location, circuits re-land as-is.",
        low: 1800,
        typical: 2400,
        high: 3000,
      },
      {
        level: "Panel + meter base",
        criteria: "Meter base replaced with the panel. Overhead drop and mast reused.",
        low: 2500,
        typical: 3200,
        high: 4000,
      },
      {
        level: "Full service upgrade",
        criteria:
          "New mast, meter base, service-entrance conductors, grounding electrode system, and utility coordination for the disconnect and reconnect.",
        low: 3000,
        typical: 4000,
        high: 5000,
      },
      {
        level: "Overhead converted to underground",
        criteria:
          "Service comes off the pole and goes in the ground: trench, conduit, and utility scheduling on their timetable, not ours.",
        low: 4000,
        typical: 6000,
        high: 8000,
      },
    ],
    adders: [
      {
        label: "Meter relocation",
        effect: "+$4,000–8,500 (§2E.5). The utility, not the electrician, decides where the meter may go.",
      },
    ],
    warranty: { partsTerm: MANUFACTURER_PASS_THROUGH, labourTerm: P1_PRICEBOOK_LABOUR_WARRANTY },
  },

  service_upgrade_400a: {
    low: null,
    typical: null,
    high: null,
    currency: "USD",
    basis:
      "§2.1 surveyed sources spanning $2,000–$15,000 with no convergence, and identified why: the driver is whether the utility pulls new service conductors, which is their decision and their schedule.",
    confidence: "read",
    noRange:
      "§2.1 says in terms: 200→400 A must not ship a default. A 7.5× spread is not a range, and the variable that explains it is not knowable from the intake.",
    includesPermit: false,
  },

  meter_base: {
    low: 250,
    typical: 800,
    high: 2100,
    currency: "USD",
    basis:
      "§2.1 meter base / meter-main combo $250 / $500–1,100 / $2,100. Part 1 bills $3,740 to replace/add a 200 A meter combo including the riser — above the band because it is a combo unit plus mast, not a meter base alone. §3.11 could not price meter-main combination units at retail at all (zero search results), so the equipment half of this is unverified.",
    confidence: "read",
    includesPermit: false,
  },

  subpanel: {
    low: 400,
    typical: 1350,
    high: 2800,
    currency: "USD",
    basis:
      "§2.1 subpanel 60–100 A $400 / $900–1,800 / $2,800. Part 1's two subpanel lines are both packages and both far above it — $4,000 including AFCI breakers, labelling, surge and the permit, and $8,675 including a firewall and fire guard for up to 20 breakers. That gap is scope, not market: see `includesPermit`.",
    confidence: "read",
    includesPermit: false,
    warranty: { partsTerm: MANUFACTURER_PASS_THROUGH, labourTerm: P1_PRICEBOOK_LABOUR_WARRANTY },
  },

  subpanel_feeder: {
    low: 58,
    typical: 70,
    high: 88,
    currency: "USD",
    basis:
      "Back-calculated from ONE Part 1 line: 'Sub feed 50–75 ft — $4,375', which is $58/ft at 75 ft and $88/ft at 50 ft. A single estimate from a single market, arithmetic ours. Treat as a sanity check, not a market rate — and note that copper is the most volatile input in the price book (§2.6: wire needs a 1.92× escalation from 2019 against labour's 1.40×).",
    confidence: "derived",
  },

  firewall_enclosure: {
    low: 900,
    typical: 900,
    high: 900,
    currency: "USD",
    basis:
      "One observation: Part 1 bills a firewall add-on for a subpanel at $900. A point, not a range — no second source exists in this research.",
    confidence: "read",
  },

  grounding_system: {
    low: 150,
    typical: 300,
    high: 700,
    currency: "USD",
    basis:
      "§2.1 grounding system $150 / $200–400 / $700. Part 1 bills a complete grounding system at $1,361 and a cold-water-pipe grounding system at $425 — the first is a full electrode system on a service upgrade, well above the national band. §3.11: bare copper #6 and #4, the two sizes actually used for residential grounding electrode conductors, are not stocked by the retailer the material costs came from.",
    confidence: "read",
  },

  surge_protector: {
    low: 200,
    typical: 375,
    high: 800,
    currency: "USD",
    basis:
      "§2.1 whole-home Type 2 surge $200 / $300–450 / $800. Part 1 bills $477 (5-year manufacturer warranty), $879 ('Platinum' surge + lightning, lifetime/$75k warranty) and $1,462 (whole home + secondary bundle) — the spread is warranty tier and device count, which is why warranty belongs on the line.",
    confidence: "read",
    warranty: {
      partsTerm:
        "5 years manufacturer on the mainstream device; one Part 1 estimate sells a lifetime / $75,000 connected-equipment tier as a premium option.",
      labourTerm: P1_PRICEBOOK_LABOUR_WARRANTY,
    },
  },

  // ── Breakers and circuits ─────────────────────────────────────────────────

  breaker_standard: {
    low: 100,
    typical: 185,
    high: 300,
    currency: "USD",
    basis:
      "§2.1 standard breaker installed $100 / $150–250 / $300; §2C.3 refines to $120–220 installed on a $5–20 part. Part 1's pricebook bills $249 for a 2-pole 15–60 A and $259 for a tandem — the top of the band, from a flat-rate shop. §3.2 puts the Canadian retail part at ~$14 for a 1-pole 15/20 A.",
    confidence: "read",
    quantityBands: [
      {
        label: "Fitted while the panel is already open for other work",
        from: 1,
        to: null,
        low: 50,
        typical: 60,
        high: 75,
        note: "§2C.2② — the same physical item is two different SKUs. The truck roll is already paid for.",
      },
      {
        label: "Standalone call-out for one breaker",
        from: 1,
        to: 1,
        low: 180,
        typical: 250,
        high: 400,
        note: "§2C.2② — a price book with one 'breaker' line badly under-prices the one-off call.",
      },
    ],
  },

  breaker_afci_gfci: {
    low: 150,
    typical: 250,
    high: 385,
    currency: "USD",
    basis:
      "§2.1 AFCI/GFCI breaker installed $150 / $200–300 / $385. Part 1 bills a 1-pole AFCI/GFCI at $289 for qty 1 and $269 at qty 3–5 — a real, printed volume band. §3.2: the Canadian retail part is $94.37 typical for a 1-pole AFCI and $147 for a dual-function, so the part is a much larger share of this line than of a standard breaker.",
    confidence: "read",
    quantityBands: [
      {
        label: "Fitted while the panel is already open for other work",
        from: 1,
        to: null,
        low: 50,
        typical: 62,
        high: 75,
        note: "§2C.2② states this case explicitly for AFCI breakers. Both figures are correct; they are different jobs.",
      },
      {
        label: "Standalone call-out",
        from: 1,
        to: 1,
        low: 180,
        typical: 280,
        high: 400,
        note: "§2C.2②.",
      },
      { label: "Quantity 3–5", from: 3, to: 5, low: 150, typical: 269, high: 385, note: "Part 1, observed." },
    ],
    adders: [
      {
        label: "Legacy panel",
        effect:
          "§3.2: Federal Pioneer / Stab-Lok breakers run 2–3× every modern equivalent across the board, and a 1970s–80s panel is exactly what the service call is standing in front of.",
      },
    ],
  },

  dedicated_circuit: {
    low: 250,
    typical: 725,
    high: 1500,
    currency: "USD",
    basis:
      "§2.1 dedicated 15/20 A circuit $250 / $550–900 / $1,500. Part 1: $896 for a 15–20 A dedicated circuit up to 50 ft, and $2,850 for a dedicated circuit to a garage with two outlets and a 20 A breaker — the second is above the national high and is a flat-rate, single-line quote with a paragraph of scope.",
    confidence: "read",
    quantityBands: [
      { label: "Two circuits on one visit", from: 2, to: 2, low: 210, typical: 600, high: 1275, note: "§2C.2①: −15–20% each." },
      { label: "Three or more circuits", from: 3, to: null, low: 165, typical: 500, high: 1125, note: "§2C.2①: −25–40% each." },
    ],
  },

  circuit_240v: {
    low: 300,
    typical: 550,
    high: 1200,
    currency: "USD",
    basis:
      "§2.1 240 V / 50 A EV circuit $300 / $400–700 / $1,200+. The same circuit serves a range, dryer or condenser. Part 1 bills $850 for an EV circuit within 10 ft of the panel excluding the charger — above the typical, and it is the shortest possible run, which is the clue that this line is priced on access rather than length.",
    confidence: "read",
  },

  ev_charger_install: {
    low: 749,
    typical: 1600,
    high: 2800,
    currency: "USD",
    basis:
      "§2.1 EV charger install excluding the charger $749 / $1,500–1,700 / $2,800+. Part 1's $850 covers only the circuit when the panel is within 10 ft — not a comparable scope.",
    confidence: "read",
    includesPermit: false,
    adders: [
      {
        label: "Panel upgrade required",
        effect:
          "+$1,500–3,000. §2.1 names this the most common reason an EV quote doubles and the most common change-order cause in the trade. Ask before quoting, not after.",
      },
    ],
    warranty: { partsTerm: MANUFACTURER_PASS_THROUGH, labourTerm: P1_PRICEBOOK_LABOUR_WARRANTY },
  },

  // ── Rewiring and remediation ──────────────────────────────────────────────

  whole_house_rewire: {
    low: 8,
    typical: 12,
    high: 17,
    currency: "USD",
    basis:
      "§2C.3 rewire $5–17/sq ft through finished walls, with the $2–4 camp excluded because it describes partial or accessible work. The low end here is 8, not 5, because §2E.4 found the two published benchmarks contradict each other: $10,000 for 1,500 sq ft is $85/opening, below the floor of the $100–300/opening band the same sources publish. lib/estimate/rewireTakeoff.js models 1,500 sq ft at $12.19/sq ft open-wall to $19.06 knob-and-tube and cannot reach the bottom of the published band — the model is right and the benchmark is wrong. Part 1's real quote is $15/sq ft (1,461 sq ft, 1958 single storey, $21,915 = $194/opening).",
    confidence: "derived",
    includesPermit: false,
    difficultyTiers: [
      {
        level: "Open walls",
        criteria:
          "Studs exposed for other work already — gut renovation or new construction. No fishing, no patching, cable pulled straight through bored plates.",
        low: 8,
        typical: 9,
        high: 12,
      },
      {
        level: "Light renovation",
        criteria:
          "Some walls open, accessible attic or basement above and below, drywall cut only where a device lands.",
        low: 9,
        typical: 11,
        high: 14,
      },
      {
        level: "Fished through finished drywall",
        criteria:
          "House stays finished and lived in. Every run fished, every device a cut-in, drywall opened and closed at each obstruction. This is the default case.",
        low: 11,
        typical: 14,
        high: 17,
      },
      {
        level: "Plaster and lath",
        criteria:
          "Pre-1950 plaster over wood or metal lath. Lath resists a fish tape, plaster cracks well beyond the cut, and the repair is a plasterer's job, not a drywall patch.",
        low: 14,
        typical: 18,
        high: 22,
      },
      {
        level: "Knob & tube or historic",
        criteria:
          "Original knob-and-tube still live, or a designated historic property with restrictions on what may be opened. Pre-1980 also means asbestos and lead are a separate trade's problem before ours starts.",
        low: 17,
        typical: 20,
        high: 26,
      },
    ],
    adders: [
      { label: "Second and subsequent storeys", effect: "+15–20% each (§2E.5) — top plates to drill and a longer home run." },
      { label: "Slab on grade", effect: "+20% (§2E.5) — removes the easiest cable path under the floor." },
      { label: "Occupied during work", effect: "+10–15% (§2E.5)." },
      { label: "Unknown conditions", effect: "15–25% buffer (§2E.5). Not padding — it is what the four intake facts cannot tell you." },
      {
        label: "Service entrance",
        effect:
          "$3,000–6,000 as its own line, never folded into $/sq ft (§2E.5). Mast, meter base, service conductors, grounding electrode and utility coordination. Omitting it is why the takeoff model under-predicted a real 'Level 3' quote by 30%.",
      },
      {
        label: "Drywall repair",
        effect:
          "$2,000–5,000 with painting (§2.1), or $300–1,500 per patch (§2C.3), and almost never included. Use the `drywall_exclusion` clause line or the `drywall_patch` line — state which.",
      },
    ],
    warranty: { partsTerm: MANUFACTURER_PASS_THROUGH, labourTerm: P1_PRICEBOOK_LABOUR_WARRANTY },
  },

  rewire_per_opening: {
    low: 100,
    typical: 200,
    high: 350,
    currency: "USD",
    basis:
      "§2.1 rewire per opening $100 / $150–250 / $350+. §2E.2 is the reconciliation that makes this usable: a 1,500 sq ft house works out at ~117 openings, so 117 × $100–300 is $11,700–35,100 and Part 1's real $21,915 quote lands mid-band at $194/opening. §2.4 and §2B.4 both note the per-unit form is the one that survives scope change — adding three outlets has an obvious price.",
    confidence: "read",
  },

  knob_tube_replacement: {
    low: 10,
    typical: 15,
    high: 20,
    currency: "USD",
    basis:
      "§2C.3 knob & tube $10–20/sq ft, $12,000–36,000 whole-house (§2.1). Priced per square foot rather than per opening because the driver is the removal, not the new device count.",
    confidence: "read",
    adders: [
      {
        label: "Asbestos or lead",
        effect:
          "Pre-1980 and frequently paired with knob & tube (§2E.5). A separate trade, a separate permit, and a hard stop on our schedule — not an electrical adder to absorb.",
      },
    ],
  },

  aluminium_pigtail: {
    low: 1500,
    typical: 3250,
    high: 5000,
    currency: "USD",
    basis:
      "§2.1 AlumiConn pigtail $1,500 / $2,500–4,000 / $5,000; §2C.3 whole-house $1,500–5,000. A typical home has 25–50 aluminium connection points (§2C.3), which is what makes the whole-home figure vary 3×.",
    confidence: "read",
  },

  aluminium_copalum: {
    low: 3500,
    typical: 5750,
    high: 8000,
    currency: "USD",
    basis:
      "§2.1 COPALUM $3,500 / $5,000–6,500 / $8,000. §2C.3: the premium over pigtailing is technician scarcity, not materials — 4–8 week lead times for a certified installer. Full copper rewire instead is $12,000–20,000+.",
    confidence: "read",
  },

  wire_fishing: {
    low: 144.68,
    typical: 144.68,
    high: 144.68,
    currency: "USD",
    basis:
      "One observation: Part 1's task-code pricebook bills 'wire fishing, level 1' at $144.68. A point, not a range. 'Level 1' is a bare label on that document — Part 2B.1③ is the fix, and `difficultyTiers` on the rewire lines is what it looks like.",
    confidence: "read",
  },

  cut_in_box: {
    low: 55.82,
    typical: 55.82,
    high: 55.82,
    currency: "USD",
    basis: "One observation: Part 1 bills 'cut-in single gang, new location' at $55.82. A point, not a range.",
    confidence: "read",
  },

  junction_box: {
    low: 189.79,
    typical: 189.79,
    high: 189.79,
    currency: "USD",
    basis:
      "One observation: Part 1 bills 'small j-box replace/install (up to 2)' at $189.79 — note the quantity ceiling is part of the line, which is why `quantityBands` exists elsewhere in this file.",
    confidence: "read",
  },

  emt_first_10ft: {
    low: 207.56,
    typical: 207.56,
    high: 207.56,
    currency: "USD",
    basis:
      "One observation: Part 1 bills '½\" EMT, first 10 ft (no wire)' at $207.56. Kept as a flat first-10-ft price rather than converted to $20.76/ft on purpose — §2C.2⑦ shows exactly that conversion producing an artefact ('a $1,200 crew minimum on 35 ft computes to $34/ft, which is not a rate'). §3.6: EMT is 2.1–2.2× PVC at the same trade size.",
    confidence: "read",
  },

  cable_run_50ft: {
    low: 903.25,
    typical: 903.25,
    high: 903.25,
    currency: "USD",
    basis:
      "One observation: Part 1 bills '12/2 Romex NM-B, 50 ft run' at $903.25. A point. Overlaps `dedicated_circuit` in scope on many jobs — Part 1's pricebook carries both, so both ship, but quoting both on one circuit is double-billing.",
    confidence: "read",
  },

  // ── Receptacles and switches ──────────────────────────────────────────────

  receptacle_replace: {
    low: 75,
    typical: 185,
    high: 360,
    currency: "USD",
    basis:
      "§2.1 outlet/switch replacement $75 / $150–250 / $360; §2C.3 refines to $150–220. Part 1's 'home redevice, standard devices, qty 21–40' at $67 each is the volume case, not this one.",
    confidence: "read",
    quantityBands: [
      {
        label: "First device — the sole reason for the trip",
        from: 1,
        to: 1,
        low: 125,
        typical: 160,
        high: 200,
        note: "§2C.2① — not a discount structure. The first unit carries the truck roll.",
      },
      { label: "Devices 2–10", from: 2, to: 10, low: 55, typical: 70, high: 90 },
      { label: "Devices 11–40", from: 11, to: 40, low: 45, typical: 58, high: 70, note: "Part 1 observed $67 each at qty 21–40." },
      {
        label: "Whole house, 40–75",
        from: 40,
        to: 75,
        low: 40,
        typical: 50,
        high: 60,
        note: "§2C.2①: at this count, switch to a day rate.",
      },
    ],
    adders: [
      { label: "Filthy or crawl-space access", effect: "+$20 per device (§2C.2①)." },
      { label: "Aluminium branch wiring", effect: "+$50–100 for special connectors (§2C.2④)." },
    ],
  },

  receptacle_new: {
    low: 200,
    typical: 300,
    high: 2000,
    currency: "USD",
    basis:
      "§2C.3 splits this three ways and the spread is 10×, which is why the tiers below carry the number and this top-level band is only a container: $200–300 accessible, $700–900 fished through a finished wall, $900–2,000 on a new circuit from the panel.",
    confidence: "read",
    difficultyTiers: [
      {
        level: "Accessible",
        criteria:
          "Open stud bay, unfinished basement or garage, or an accessible attic directly above. Existing circuit has capacity and a nearby box to extend from.",
        low: 200,
        typical: 250,
        high: 300,
      },
      {
        level: "Fished through a finished wall",
        criteria:
          "Finished wall both sides, no accessible cavity above or below. Cable fished, cut-in box, drywall opened at each obstruction and left for patching.",
        low: 700,
        typical: 800,
        high: 900,
      },
      {
        level: "New circuit from the panel",
        criteria:
          "No existing circuit with capacity — a home run back to the panel, a breaker, and panel space that has to exist. If it does not, this becomes a subpanel or a service upgrade.",
        low: 900,
        typical: 1400,
        high: 2000,
      },
    ],
  },

  gfci_receptacle: {
    low: 125,
    typical: 200,
    high: 385,
    currency: "USD",
    basis:
      "§2.1 GFCI receptacle $125 / $150–250 / $385; §2C.3 narrows to $190–215. Part 1 bills $158 each at qty 5+ and $118.36 for an additional Decora GFCI with plate. §3.7: the Canadian retail device is $23.87–$98.48 (a 4.1× spread that §3.9 attributes to aesthetics only).",
    confidence: "read",
    adders: [
      {
        label: "Downstream protection instead of a device at each location",
        effect:
          "§2C.2⑧: one GFCI at the FIRST outlet protects everything downstream on that circuit — one device instead of six. A GFCI breaker protecting the whole circuit is cheaper again. Software that knows this can show the client a cheaper compliant option, which is the opposite of what Part 1's high-pressure estimates do.",
      },
    ],
  },

  weatherproof_cover: {
    low: 69.89,
    typical: 69.89,
    high: 69.89,
    currency: "USD",
    basis:
      "One observation: Part 1 bills a weatherproof in-use cover at $69.89. A point. §3.7 puts the Canadian retail part at $24.50–$49.00.",
    confidence: "read",
  },

  switch_replace: {
    low: 75,
    typical: 185,
    high: 360,
    currency: "USD",
    basis:
      "§2.1 prices outlet and switch replacement as one band — $75 / $150–250 / $360 — and no source in this research separates them. Same band as `receptacle_replace` by evidence, not by assumption; the quantity bands there apply here too.",
    confidence: "read",
  },

  dimmer_smart_switch: {
    low: 150,
    typical: 250,
    high: 450,
    currency: "USD",
    basis:
      "Derived: §2.1's switch band ($150–250 typical) plus the device cost delta from §3.7 — a plain switch is $2.57 retail against $33.95 for a dimmer and $55.98 for a Wi-Fi switch, and §3.9 ranks smart switches a 5.2× spread on feature tier. No source in this research prices a smart-switch install directly.",
    confidence: "derived",
    adders: [
      {
        label: "No neutral in the box",
        effect:
          "+$100–300, or +$200–500 per location (§2C.2④). Pre-1985 switch loops usually have no neutral, and this is the single most common smart-switch surprise.",
      },
      { label: "Three-way circuit", effect: "+$150–250 per location, plus companion devices (§2C.2④)." },
    ],
  },

  // ── Lighting and fans ─────────────────────────────────────────────────────

  fixture_swap: {
    low: 133,
    typical: 225,
    high: 414,
    currency: "USD",
    basis:
      "§2.1 light fixture swap $133 / $150–300 / $414; §2C.3 $150–300. Part 1 bills a 'Level 1 light fixture (customer-supplied)' at $300. §2C.2③ is the point that matters here: the job is ~30 minutes but the minimum charge IS the price — price it at $150–250, not at $60 of labour.",
    confidence: "read",
    quantityBands: [
      { label: "First fixture", from: 1, to: 1, low: 150, typical: 200, high: 250, note: "§2C.2①." },
      { label: "Each additional on the same visit", from: 2, to: null, low: 50, typical: 85, high: 125, note: "§2C.2①." },
    ],
  },

  recessed_new: {
    low: 100,
    typical: 200,
    high: 350,
    currency: "USD",
    basis:
      "§2.1 recessed light $100 / $175–300 / $350; §2C.3 $150–250 for new. §3.8: the Canadian retail housing is $19.98–83.72 and the trim $16.47–134, so on this line the labour dominates and the fixture choice barely moves it.",
    confidence: "read",
    adders: [
      {
        label: "Light lands on a joist or a duct",
        effect: "+$200 per light (§2C.2④). Found after the hole is cut, which is why it belongs on the quote as a stated possibility.",
      },
    ],
  },

  recessed_retrofit: {
    low: 200,
    typical: 265,
    high: 330,
    currency: "USD",
    basis:
      "§2C.3 recessed retrofit $200–330 against $150–250 new, i.e. ≈1.33×. Retrofit means cutting into a finished ceiling and working through the hole; new construction means fixing a housing to a joist with the ceiling open.",
    confidence: "read",
  },

  ceiling_fan_existing_box: {
    low: 100,
    typical: 235,
    high: 450,
    currency: "USD",
    basis:
      "§2.1 ceiling fan on an existing box $100 / $150–250 / $450; §2C.3 narrows to $175–300. Requires a box already rated for a fan's weight and vibration — a standard fixture box is not, and swapping a light for a fan on one is the failure this line exists to price honestly.",
    confidence: "read",
  },

  ceiling_fan_new_box: {
    low: 275,
    typical: 400,
    high: 550,
    currency: "USD",
    basis: "§2C.3: $275–400 where a fan-rated box has to replace an existing fixture box, $400–550 where there is no existing fixture at all.",
    confidence: "read",
    difficultyTiers: [
      {
        level: "Fan-rated box replaces an existing fixture box",
        criteria:
          "A fixture is already there and switched. The existing box is not fan-rated, so it comes out and a braced box goes in through the same hole.",
        low: 275,
        typical: 340,
        high: 400,
      },
      {
        level: "No existing fixture",
        criteria:
          "No box and no switch leg at the location. New cable fished from the nearest circuit or from the panel, a switch cut in, and a braced box installed.",
        low: 400,
        typical: 475,
        high: 550,
      },
    ],
    adders: [{ label: "Ceiling 16–20 ft", effect: "Can double or triple the standard install (§2C.2④)." }],
  },

  fixture_support_brace: {
    low: 248.47,
    typical: 248.47,
    high: 248.47,
    currency: "USD",
    basis:
      "One observation: Part 1 bills a 'chandelier support brace w/ box' at $248.47. A point. §3.6 puts the Canadian retail part at $21.97 new-work and $31.95 rework — a 45% rework premium on the part, against a labour-dominated line.",
    confidence: "read",
  },

  heavy_fixture: {
    low: null,
    typical: null,
    high: null,
    currency: "USD",
    basis:
      "§2.1 lists heavy/high chandeliers under 'not verified — ship no default'. The only data point in this research is Part 1's $1,542.75 for a chandelier over 30 lb at 8–14 ft with '2 men required' printed on the line, plus $248.47 for the brace.",
    confidence: "read",
    noRange:
      "One estimate, one market, one fixture. §2.1 says ship no default, and the adders below say why a single band could not be right: weight alone moves this by 10× and ceiling height moves it again.",
    adders: [
      { label: "Fixture 50–75 lb", effect: "+$50–150 (§2C.2④)." },
      { label: "Fixture 75–150 lb", effect: "+$150–400 (§2C.2④)." },
      { label: "Fixture 150–300 lb", effect: "+$300–700 (§2C.2④)." },
      { label: "Fixture over 300 lb", effect: "+$700–1,500 (§2C.2④)." },
      { label: "Ceiling 16–20 ft", effect: "Can double or triple the standard install (§2C.2④)." },
      { label: "Second electrician", effect: "Part 1 prints '2 men required' on this line. Bill `second_electrician` — it is the same job, not a premium." },
    ],
  },

  // ── Safety and low voltage ────────────────────────────────────────────────

  smoke_co_alarm: {
    low: 90,
    typical: 175,
    high: 255,
    currency: "USD",
    basis:
      "§2.1 smoke/CO interconnected $90 / $150–250 / $250; §2C.3 $100–200 each and $500–1,200 whole house. Part 1 bills $255 each for an interconnected 110 V smoke alarm including box and wiring — the top of the band, and it includes the rough-in. §3.8: wireless-interconnect devices are $269–289 retail against $99.97–109 for a hardwired combo, a 2.6× jump for the same functional description, and §2C.3 lists retrofit smoke-interconnect wiring as still unverified.",
    confidence: "read",
    quantityBands: [
      { label: "Whole house", from: 4, to: null, low: 500, typical: 850, high: 1200, note: "§2C.3 — a job total, not a per-unit rate." },
    ],
  },

  data_drop: {
    low: 150,
    typical: 200,
    high: 250,
    currency: "USD",
    basis:
      "§2C.3 Cat6 $150–250 per drop, and it says explicitly: price by drop, never by foot. ⚠️ Part 1 bills a 'Level 1 data cable run' at $750, 3–5× this band, and §2.1 lists data/coax per drop under 'not verified — ship no default'. The two sources are not reconciled anywhere in the research; §2C.3 is the later and more independent read, so it is what ships, but a contractor whose drops look like Part 1's should trust their own number. §2C.2① adds a labour-position shape for drops ($85 first, $55 each additional) that is well below this installed band and is not the same measurement — it is not carried as a quantity band for that reason.",
    confidence: "read",
  },

  // ── Generator ─────────────────────────────────────────────────────────────

  generator_inlet_interlock: {
    low: 400,
    typical: 1000,
    high: 1500,
    currency: "USD",
    basis:
      "§2.1 generator interlock + inlet $400 / $800–1,200 / $1,500. Part 1 bills $2,470 for a 30/50 A generator plug and interlock over 25 ft including the cord — above the band because of the run and because the cord is in it (§3.4 prices a 50 A 20 ft cord at $394 CAD retail on its own). §3.4: interlock kits are not sold by the retailer the material costs came from, so the cheapest and most common alternative to a transfer switch has no material figure in this repo at all.",
    confidence: "read",
    includesPermit: false,
    warranty: { partsTerm: MANUFACTURER_PASS_THROUGH, labourTerm: P1_PRICEBOOK_LABOUR_WARRANTY },
  },

  transfer_switch: {
    low: null,
    typical: null,
    high: null,
    currency: "USD",
    basis:
      "§2.1's only generator entry is 'interlock + inlet'. No source in Part 1, 2, 2C or 2E prices a transfer-switch installation. §3.4 has the equipment: manual single-circuit $198, manual 6-circuit with inlet $519, 8–10 circuit kit $679–798, automatic 100 A $799, automatic 200 A $1,139, automatic 200 A service-entrance rated $1,409 — all CAD retail.",
    confidence: "read",
    noRange:
      "Equipment cost is known and installed price is not, and the gap between them is the entire question. Adding a markup to the equipment to manufacture a band would be a guess wearing a derivation's clothes.",
    includesPermit: false,
    warranty: { partsTerm: MANUFACTURER_PASS_THROUGH, labourTerm: P1_PRICEBOOK_LABOUR_WARRANTY },
  },

  // ── Site work ─────────────────────────────────────────────────────────────

  trenching: {
    low: 10,
    typical: 14,
    high: 18,
    currency: "USD",
    basis:
      "§2C.2⑦ $10–18/LF for residential electrical, chosen over the $5–12 lead-gen cluster deliberately: the gap between lead-gen sites ($5–12) and contractor-oriented itemised sources ($11–27) is systematic, and the low band is excavation labour only, shallow, in easy soil. Part 1's $500/ft is main-utility service trenching — a different scope by an order of magnitude, not an outlier of this line.",
    confidence: "read",
    adders: [
      {
        label: "Short runs are minimum-charge jobs",
        effect:
          "§2C.2⑦: a $1,200 crew minimum on 35 ft computes to $34/ft, which is an artefact, not a rate. Below roughly 50 ft, quote the minimum and show the footage as scope.",
      },
      {
        label: "Burial depth",
        effect:
          "§2C.3 lists NEC 300.5 burial depths as still unverified — the one source found contradicts standard practice. Confirm against the AHJ before pricing depth-driven work.",
      },
    ],
  },

  // ── Permits, inspection and the extras that get forgotten ─────────────────

  permit: {
    low: 50,
    typical: 250,
    high: 900,
    currency: "USD",
    basis:
      "§2.1 electrical permit $50 / $150–350 / $900. §2C.2⑤ verified three structurally incompatible models against real schedules and says DO NOT ship a national permit number: per unit of work (Washington L&I, first 1,300 sq ft $119.90 then $38.20 per 500), percentage of valuation (Philadelphia $25 per $1,000 including labour, overhead and profit, min $50 max $15,000), or flat by job type (Jersey City: min $80, panel upgrade $175–275, EV charger $90–130, full rewire $350–700). Its own recommendation is ~$150 small work and ~$350 rewire as a per-company configurable, which is where the typical here comes from. Part 1 shows $300, $950 and $1,500 from three companies in one metro band.",
    confidence: "read",
    adders: [
      {
        label: "Permit holdback",
        effect:
          "Part 1: one estimate withholds $300 of its own price until the inspector signs the permit card. §1.3 calls it a genuinely good practice — it puts the contractor's money on the inspection passing.",
      },
      {
        label: "Say who pulls it",
        effect: "§2.5: permits get their own labelled line naming who pulls, who pays and who schedules the inspection.",
      },
    ],
  },

  reinspection: {
    low: null,
    typical: null,
    high: null,
    currency: "USD",
    basis:
      "Nothing. No estimate in Part 1, no benchmark in Part 2, 2C or 2E, and no municipal schedule in §2C.2⑤ mentions a re-inspection fee. The line ships because a failed or rescheduled inspection is a real cost that lands on a real job and gets absorbed silently; the price does not ship because this research has no figure for it.",
    confidence: "read",
    noRange:
      "Not researched. Municipal re-inspection fees exist and are typically a flat municipal charge, but no figure in this repo supports a band and none was invented. Set from the local schedule.",
  },

  drywall_patch: {
    low: 300,
    typical: 700,
    high: 1500,
    currency: "USD",
    basis:
      "§2C.3 $300–1,500 per patch, or $2,000–5,000 with painting across a whole rewire (§2.1). Not electrical work, and §2.1 says it is usually excluded — this line exists for the shops that do include it, and `drywall_exclusion` exists for the ones that do not. One of the two belongs on any job that opens a wall; neither belongs on both.",
    confidence: "read",
  },

  disposal: {
    low: 50,
    typical: 100,
    high: 150,
    currency: "USD",
    basis:
      "⚠️ Cross-trade. No electrical estimate in Part 1 and no electrical benchmark in Part 2 prices disposal; this band is §2D.1's plumbing water-heater disposal ($50–150), transferred because an old panel and a dead water heater are the same problem — one bulky item, one trip, one tipping fee. Directionally sound for a panel or a few fixtures; a rewire's cable and drywall spoil is a skip, not a disposal fee, and is not covered by this band.",
    confidence: "derived",
  },

  drywall_exclusion: {
    low: 0,
    typical: 0,
    high: 0,
    currency: "USD",
    basis:
      "Part 2B.1: an $18,164 repipe carried its exclusions as $0.00 rows inside the price table rather than in a terms paragraph — the strongest structural idea in either estimate set, and it costs nothing to implement. §2.5 names scope gaps surfacing as extras (drywall, painting, permits) as a top dispute trigger, and says anything not included should be expressly excluded. §2.1: drywall repair is $2,000–5,000 and usually excluded.",
    confidence: "read",
  },

  concealed_conditions_clause: {
    low: 0,
    typical: 0,
    high: 0,
    currency: "USD",
    basis:
      "Part 2B.1's General Damage Clause, at $0.00 on a real estimate, adapted to what is actually concealed in electrical work: knob & tube spliced into modern cable, aluminium branch circuits, buried junction boxes, no accessible path. §2E.5 puts the unknown-conditions buffer at 15–25% and lists what the takeoff model cannot know. §2.5: change orders need a published process — description, price, schedule impact, signature BEFORE work.",
    confidence: "read",
  },
};
