# Estimating standards, codes and licensing

What can we legally ship as an estimating engine, and where does reliable
quantity and labour data actually come from?

Researched August 2026. Companion to `docs/trade-pricing-research.md`, which
covers prices; this covers **quantities and hours**, which is the harder half.

---

## 0. The one-sentence answer

**Quantity data is free, authoritative and legally clean. Labour-hour data is
proprietary in every jurisdiction, without exception.** So build the quantity
engine ourselves, seed labour thinly and mark the seeds honestly, and let each
contractor's own completed jobs replace them.

---

## 1. Three corrections to assumptions we were working from

Recorded because two of them changed product decisions.

### 1.1 Canada's AFCI scope is NOT bedrooms-only, and hasn't been since 2015

We assumed Canada required AFCI on bedroom circuits only (CEC 26-724), and that
the US requirement was far broader — which would have meant a US rewire buying
many more ~$90 AFCI breakers than a Canadian one.

**Both halves were wrong:**

- The rule is no longer 26-724. In the **2024 CEC (26th edition) AFCI is Rule
  26-658**. It moved 26-722(f) → 26-724(f) → 26-658. Anything keyed to "26-724"
  in the current code cites outdoor/garage receptacle rules instead.
- **Bedrooms-only ended with the 2015 edition.** Canada has since required AFCI
  on *every* branch circuit supplying 125 V receptacles rated ≤20 A in a
  dwelling unit, with exceptions (fridge receptacle, sump pump, circuits already
  GFCI-protected).

The real axis is different, and it is a *shape* difference rather than a size
one:

| | Broader by | Narrower by |
|---|---|---|
| **NEC 210.12** | circuit type — *all outlets*, including lighting and smoke alarms | room list (2023); **2026 adds bathrooms and garages**, closing most of the gap |
| **CEC 26-658** | location — whole dwelling unit, no room list | circuit type — receptacle circuits only, so a lighting-only circuit needs no AFCI in Canada |

### 1.2 The real Canadian divergence is the kitchen, and it is expensive

This is the highest-value quantity rule to encode for our primary market.

**CEC 26-712 / 26-722** requires for dwelling kitchen counters: **at least two
branch circuits**, **no more than two split receptacles per multi-wire branch
circuit**, **no other outlets on those circuits**, and ≤900 mm from any point
along the counter work surface.

**NEC 210.11(C)(1)** requires **two 20 A small-appliance circuits**, which may
serve the entire kitchen, pantry, dining and breakfast areas, with **no cap on
receptacle count**.

Worked, for a kitchen with 8 counter receptacle positions:

| | US | Canada |
|---|---|---|
| Circuits | 2 | **4** |
| Breakers | 2 × single-pole | **4 × two-pole** (split receptacles need a 2-pole or handle-tie) |
| Cable runs | 2 | 4 × 14/3 |
| AFCI | per 210.12 | required — so **two-pole AFCI or dual-function**, the expensive ones |

Against Part 3's price table, two-pole AFCI is $195 and dual-function $114–197,
against $12.98–14.97 for a plain single-pole. **That is the multiplier — and it
comes from circuit count driven by the split-receptacle rule, not from AFCI
scope.**

### 1.3 Craftsman DOES licence its data — and nobody seems to have asked

We assumed every labour-unit publisher would refuse. Craftsman Book Company runs
a **formal data-licensing programme for software developers**: two subscription
APIs plus 10+ downloadable databases (Excel, Bacpac/SQL Server, Access, PDF),
electrical and plumbing/HVAC among them, ~30,000 cost estimates, most updated
quarterly, self-described as "affordable".

**Action: contact ben@costbook.com** (or 1-800-829-8123 x122). Confirm in
writing: SaaS embedding, per-tenant display, derivative-works rights, and
whether Canadian area factors exist for the electrical and plumbing books — the
2026 preview PDF contains **zero** occurrences of "Canada", "Canadian" or any
province name, so treat Craftsman as US-calibrated until told otherwise.

This is the cheapest possible resolution of the biggest unknown, and it gates
the labour layer.

---

## 2. Codes — the quantity layer

### 2.1 What's in force, and the trap in each

| Code | Edition | Price | Free read? |
|---|---|---|---|
| **NEC / NFPA 70** (US) | **2026**, 3-yr cycle | ~US$133–202 | Yes, NFPA LiNK, read-only |
| **CEC / CSA C22.1** (Canada) | **C22.1:24, 26th ed.**, Mar 2024 | from CAD $190 | Yes, CSA view-access, read-only |
| **Ontario OESC** | **2024**, in force 1 May 2025 | CAD $243 print / $217 PDF | No |
| **BC Electrical Code** | 2024, in force 4 Mar 2025 | — | — |
| **Alberta** | CEC 2024 + STANDATA, 1 Apr 2025 | — | — |
| **Quebec — CSA C22.10** | **C22.10-19 ≈ 2015 CEC** | — | — |
| **NPC** (Canada plumbing) | **2025**, pub. 22 Dec 2025 | **Free PDF** (NRC), $60 print | **Yes, free** |
| **BC Plumbing / Building Code** | 2024 | **Free online** | **Yes, free** |
| **UPC** (IAPMO) | 2024 | — | IAPMO ePubs reader |
| **IPC** (ICC) | 2024 | — | ICC Digital Codes |
| **BS 7671** (UK) | **2018+A4:2026**, 15 Apr 2026 | ~£125 | No |
| **AS/NZS 3000** (AU/NZ) | 2018 + Amd 1–3 (2025); next mid-2027 | — | No |
| **AS/NZS 3500** (AU/NZ plumbing) | 2025 | ~AUD $160–170/part | No |

**Three traps:**

1. **Three NEC editions are live in the US simultaneously** — roughly 7 states on
   2026, ~35 on 2023, ~6 on 2020, plus stragglers. "The NEC says" is not a
   sentence a quantity engine can execute.
2. **Quebec is a different document at a different vintage.** It uses **CSA
   C22.10**, not C22.1 with a provincial rider, and it tracks roughly the
   **2015 CEC — about nine years behind**. A `country: "CA"` flag silently
   produces wrong quantities in Montreal. This is a top-3 Canadian market.
3. **Ontario's own edition numbering is inconsistent** — ESA's pages variously
   call the 2024 OESC the 28th and 29th edition. Don't key the data model to
   OESC edition numbers; key to the CEC edition it's based on.

### 2.2 The ~15 rules that produce 80% of residential quantity

**Electrical — Canada (CEC 2024):** 26-712(a) wall receptacle spacing (≤1.8 m
from any point, max 3.6 m apart, usable wall ≥900 mm) · 26-712(b) hallways
(≤4.5 m by cord path) · 26-712(d) / 26-722 kitchen counters (≤900 mm, ≥2
circuits, ≤2 split receptacles per multi-wire circuit, no other outlets;
peninsulas ≥600 × 300 mm get their own) · split vs 20 A T-slot — a real either/or
with different material bills · **26-658 AFCI** · 26-704 / 26-700 GFCI · 26-706
tamper-resistant · 26-724 outdoor and garage · 8-200 / 8-106 load calc and EVSE.

**Electrical — US (NEC 2023/2026):** 210.52(A) 6 ft rule → outlet every ~12 ft ·
210.52(C) counters · 210.11(C)(1) two 20 A small-appliance · (C)(2) laundry ·
(C)(3) bathroom · **210.12 AFCI** · 210.8 GFCI (2026 expands to within 6 ft of
*all* indoor sinks) · 314.16 box fill · 310.16 / 310.15 ampacity and derating.

**Plumbing:** fixture units → drain sizing, WSFU → supply sizing, vent sizing.
Canada NPC 2025 Division B Part 2 (Table 2.4.10.6.A stacks, 2.5.7.1 individual
vents, 2.5.8.1 wet vents, 2.5.8.3 branch vents, 2.5.8.4 stack vents). US forks:
IPC Table 709.1 / 710.1 / E103.3 vs UPC Table 702.1 / 610.3.

**US plumbing needs a UPC branch and an IPC branch** — different fixture-unit
values, different sizing tables. More forked than electrical, where NEC is
universal and only the edition varies.

### 2.3 Can we compute from codes? Yes. Can we reproduce them? No.

The legal ground shifted in our favour, and we don't need to stand on it anyway.

- **Georgia v. Public.Resource.Org** (SCOTUS 2020) — government edicts are
  uncopyrightable. Applies to the law, not to privately-authored standards.
- **ASTM v. Public.Resource.Org** (D.C. Cir., 12 Sep 2023) — posting full text of
  standards incorporated into law is **fair use**; standards "fall at the factual
  end of the fact-fiction spectrum". But the court leaned on PRO's **nonprofit**
  character and declined to say incorporated standards lose copyright.
- **ASTM v. UpCodes** (3d Cir., 7 Apr 2026) — the one that matters, because
  UpCodes is **for-profit**. Denial of preliminary injunction affirmed, fair use
  likely, transformative because it publishes "what the law actually is".
  Caveats: preliminary posture, incomplete record, equivocal market-harm factor,
  and an explicit warning about unfettered copying.

**Our posture, which is safe in all five markets and costs nothing:**

- **Compute quantities. Cite rule numbers. Reproduce no text and no tables.** A
  requirement like "≤900 mm from any point along the counter" is an operative
  fact; the count our engine outputs is our own computation.
- **Rule numbers are facts. Rule text is someone's copyright.**
- **Never bulk-copy tables** — DFU, ampacity, box fill, WSFU are the most
  expression-like artefacts in these documents and exactly what SDOs sue over.
- **Assume no fair-dealing safe harbour in Canada.** There is no Canadian ASTM v.
  PRO. NRC explicitly prohibits commercial reproduction of the NPC; the OESC is
  CSA-copyrighted and sold by ESA.

---

## 3. Labour-unit sources, and what each licence actually permits

| Source | Ship as in-product defaults? | Evidence |
|---|---|---|
| **NECA Manual of Labor Units** — US$516.95, 2023–24 ed., Normal/Difficult/Very-Difficult columns | **No** | "The purchase of the MLU conveys a single license to the individual that purchased it." An OEM path exists (NECA → Trade Service → estimating systems) but is negotiated |
| **RSMeans / Gordian** — US$392.70 book, $396–5,973/yr online, 92,000+ items, 970+ location factors incl. Canadian cities | **No** | Licence is "solely for internal business purposes"; customer "will not use any Deliverables to create products or services that compete with the products or services offered by Gordian." Gordian sells estimating software |
| **Hanscomb *Yardsticks for Costing*** — US$402.90, metric+imperial, 8 Canadian city indexes | **No** | Distributed by Gordian; same terms |
| **Craftsman Book Company** — $58.88 eBook / $167.88 yr Cloud | **Probably YES, negotiated** | Formal developer-licensing programme; APIs + SQL/Excel/Access; quarterly updates. **Terms unpublished — §1.3** |
| **MCAA WebLEM** — members free, **non-members US$5,500 + $750/yr** | Yes in principle, but **wrong segment** | Brochure confirms vendor licence agreements. It is commercial/industrial mechanical piping; our users are residential service plumbers |
| **PHCC labour units** | **Unknown** | Bundled into FastPIPE/QuoteSoft under licence; no standalone terms found |
| **Trade Service / TRA-SER** (Trimble) — ~$1,200–1,800/yr | **No** — subscription price file | Also the channel NECA chose for MLU |
| **Flat-rate books** — Profit Rhino $39–59/tech/mo, New Flat Rate $99+, Coolfront $129 | **No** — they are competitors in this exact slot | Per-tech subscription products; their business *is* the number |

### 3.1 What a labour unit contains — worth copying as *methodology*

The structure is industry-standard and is not anyone's IP; the numbers are.

- **NECA decomposition:** a labour unit is roughly **65% installation, 35%
  overhead activity** (layout ~10%, material handling ~20%, supervision ~5%).
  Excludes non-productive supervision. Assumes a trained journeyman with ~5
  years' experience.
- **Craftsman's stated baseline:** normal hours, clean surroundings, work ≤12 ft
  above finished floor, 50–85 °F, ≤8 hr days, materials on site, adequate
  supervision. Documented multipliers ~**1.10** for minor departures, **1.50+**
  for very poor conditions. Craftsman also **publishes its wage build-up**
  ($36.52 base + 6.73% taxable fringe + 19.14% taxes/insurance + 5.63%
  non-taxable = $48.35/hr), which means hours can be re-derived from costs and
  re-rated to any market.
- **MCAA's two methods:** *Component* (unit includes receiving, unloading,
  distributing, handling, erecting, joining, pressure testing) vs *Work Activity*
  (split per activity, which separates shop hours from field hours).

**Stating what an hour includes is the difference between a usable number and a
rumour.** When a contractor's actuals come in 30% high, this is the sentence
that explains why.

### 3.2 The existence proof that matters: SPARX

Simpro ships the *mechanism* (pre-builds = parts + labour fit times) and lets a
third party supply the content. **SPARX** does exactly that for Australian
electrical: **15,766 pre-builds, 38,336 parts with fit times**, sold as one-off
packs at **AUD $995–2,995**, with fit times "developed over decades in the field"
and placeholder parts auto-substituted for the contractor's own supplier SKUs.

An independently-derived labour library is a shipping, priced product that never
touches NECA or RSMeans. That is the fallback if Craftsman says no.

---

## 4. Free and redistributable

| Source | Licence | Gives us |
|---|---|---|
| **US BLS OEWS** | **Public domain**, cite BLS | Wages by occupation, state and metro. May 2025: electricians **$34.37/hr** median (757,220 employed), plumbers/pipefitters **$34.70/hr** |
| **Job Bank Canada / ESDC** | **Open Government Licence – Canada** — copy, modify, publish, distribute "for any lawful purpose", **including commercial**, with attribution | Low/median/high hourly wage by occupation, province and economic region. Electricians ~$20–48/hr, updated 19 Nov 2025 |
| **Statistics Canada** | Mostly OGL-Canada | Wages by occupation; construction price indices for inflation adjustment |
| **NRC Codes Canada (NPC/NBC 2025)** | Free to read; **no commercial reproduction** | Authoritative Canadian plumbing quantity rules to compute from |
| **BC Codes** | Free online | Provincially-amended BC Plumbing/Building Code text |
| **NAHB Cost of Construction Survey** | NAHB copyright — cite, don't ship | Construction = 64.4% of home price; **major system rough-ins = 17.9%** of construction cost |

**Attribution string required for the Canadian wage data:** "Contains
information licensed under the Open Government Licence – Canada."

### 4.1 The one open estimating dataset, and why it can't be used

**DDC CWICR / OpenConstructionEstimate** — 55,719 work items, 27,672 resources,
30 regions, 85-field schema including `labor_hours_construction_workers`.
Nominally includes Toronto (CAD), USA, UK, Sydney, Auckland.

**Two disqualifiers.** The data is **CC BY-NC 4.0 — non-commercial only** (the
code is Apache-2.0; the data is not). And the labour norms derive from **Russian
GESN/FER/TER, Chinese, Indonesian, Vietnamese, Greek, Italian, Spanish, Turkish
and Brazilian** standards — the "Toronto (CAD)" collection is a currency and
region tag over Eurasian productivity norms, not Canadian field data. It would
produce numbers we could not defend to a contractor.

**Searched for and not found:** any government, utility or association
publication of *redistributable labour hours* for electrical or plumbing work in
any of our five markets. Assume it doesn't exist.

---

## 5. The three-layer engine we should build

Each layer has different confidence and different legal footing. **Conflating
them is how we ship a control that appears to work and doesn't.**

### Layer 1 — Quantity engine. Free, clean, and unbuilt by competitors

Encode code rules as a jurisdiction-keyed engine; compute quantities from
building inputs (room list, wall perimeters, counter run lengths, fixtures).

- **Key on `{country, jurisdiction, code, edition, effective_date}` — not
  country.** Non-negotiable: three NEC editions are live at once, and Quebec runs
  a different document at a 2015 vintage.
- **Store the citation, never the text:** `{rule: "CEC 26-712(d)", edition:
  "C22.1:24", requirement_id: "kitchen_counter_spacing_900mm"}`.
- **Version rules; don't mutate them.** A quote issued under the 2024 OESC must
  still explain itself in 2027 — the same principle as `Quote.language`.
- **Encode from the free official sources** (NPC 2025, BC Codes) and *verify*
  against the read-only paid ones rather than transcribing.
- **Quebec gets its own ruleset or an explicit unsupported state.** A `Coming
  soon` panel is honest; a Quebec quote computed against the 2024 CEC is a dead
  button that costs a contractor a failed inspection.

This is a few hundred rules, not 14,000 line items — and **nothing in the
competitive set does it**. Flat-rate books tell a contractor what to charge to
"install a receptacle"; none tells him he needs *nineteen* of them and *four*
kitchen circuits because the counter runs 5.4 m.

### Layer 2 — Labour hours, seeded thinly and marked honestly

```
hours = base_hours(task)
      × condition_factor(access, height, occupied, retrofit_vs_new)
      × contractor_factor(task_family, contractor)
```

`base_hours` in order of preference: **licence Craftsman** (§1.3) → **derive our
own** via structured time-study with 10–20 design partners (the SPARX model; data
we collect is ours outright and calibrated to *residential*, which is exactly
where NECA and RSMeans are weakest) → **ship no seed at all** and require the
contractor to enter their own hour before the task is usable. All three are
honest; the third is also a Layer-3 bootstrap.

`condition_factor` copies the published *methodology*, not the numbers, with our
own baseline in our own words and multipliers for what actually varies in
residential: **occupied home, finished walls, crawlspace/attic access,
knob-and-tube or aluminium present, second storey**. No commercial labour manual
models those well.

### Layer 3 — The contractor's own actuals. This is the moat

FieldQuo already records job costing, timesheets and visits — a per-tenant,
per-task labour-hour observation stream that NECA, Gordian, Craftsman and
ServiceTitan cannot assemble for a one-van Ontario contractor.

- **Hierarchical shrinkage.** `contractor_factor` starts at 1.0 and moves toward
  the tenant's observed ratio as *n* grows; mostly-own-data by n ≈ 15–20 per task
  family. Degrades gracefully, never swings on one bad Tuesday.
- **Pool at task *family* level.** Someone 20% slow on "install duplex
  receptacle" is slow on "install switch" too. This is what makes it useful after
  20 jobs instead of 2,000.
- **Show provenance in the UI:** *Seeded — industry default* / *Your average over
  14 jobs* / *Your average, 3 jobs — low confidence*. Absence of the contractor's
  data is not a statement about their speed, and the estimate must say which it
  is.
- **Never cross tenants** (non-negotiable #8). Any benchmark must be aggregated,
  non-attributed, opt-in, and never used to price a specific quote.

### What not to do

- **Don't scrape, OCR or transcribe** NECA, RSMeans, Hanscomb, Trade Service or
  any flat-rate book. Gordian's terms name the competing-product case explicitly.
- **Don't let a model launder it.** If an LLM emits NECA labour units from
  training data, we are distributing them. Constrain AI to reasoning *over our
  own tables* — the discipline `lib/site/generateSite.js` already applies, where
  the model writes sentences and the database supplies facts.
- **Don't reproduce code tables**, even though the fair-use trend favours
  publishing the law. We don't need to.
- **Don't expose seeded rates on any public surface** — non-negotiables #4 and #5
  apply unchanged.

---

## 6. Sequencing

1. **Contact Craftsman** (§1.3). Cheapest resolution of the biggest unknown, and
   it gates Layer 2.
2. **Build Layer 1 for CEC 2024 + OESC 2024 + BC 2024 + NPC 2025.** Free sources,
   primary market, ~15 rules, no licensing risk.
3. **Instrument Layer 3 before Layer 2 needs it.** Make sure timesheet and visit
   data is written against a *task taxonomy*, not free text. Longest lead time,
   lowest visibility — **do it first**. If the taxonomy is wrong now, the actuals
   are worthless in a year.
4. **Seed Layer 2** from whichever option survives step 1.
5. **Alberta, Saskatchewan, Manitoba** next (CEC 2024 + interpretation bulletins,
   low marginal cost). **Quebec last and separately** — C22.10 is a different
   document at a different vintage.
6. **US after Canada**, edition-keyed from the start, plus the UPC/IPC fork.

---

## 7. Known gap in what we already shipped

`lib/estimate/rewireTakeoff.js` is **NEC-only**. It tags every coefficient
`[NEC …]` honestly, but it has **no jurisdiction key**, and its mandatory-circuit
count uses NEC 210.11(C) — two small-appliance circuits. Under CEC 26-712 a
Canadian kitchen of any size needs **≥2 circuits with ≤2 split receptacles
each**, so a normal kitchen lands at **4 two-pole circuits**, and those breakers
are the expensive ones (§1.2).

Receptacle *spacing* happens to be near-identical (NEC 12 ft vs CEC 3.6 m ≈
11.8 ft), so the device count and cable model carry over. **The circuit and
breaker count do not.** Canada is our primary market, so this must be fixed
before the module reaches a Canadian quote.

---

## 8. Could not be read

Stated as unverified rather than assumed: **necanet.org** (403 — all MLU detail
is secondary), **mcaa.org** (403 — WebLEM prices are from a 2018 brochure and may
be stale), **ecmag.com** (403 — 2026 NEC changes unverified against the trade
source), **codes.iccsafe.org/pricing** (403), **rsmeans.com/terms-of-use** (404 —
used Gordian's corporate terms), **nfpa.org** product page (body empty — NEC
pricing is from resellers), **electricaltoolbox.com** NEC adoption tracker (403 —
state counts are secondary, the NFPA enforcement map 404'd), **open.alberta.ca**
STANDATA PDFs (520). US NEC edition-adoption counts are therefore approximate.
