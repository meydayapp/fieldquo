# Plumbing material costs — retail reference for default cost seeding

**Purpose.** Give FieldQuo real default *material costs* for residential
plumbing, so a plumber signing up has a working internal cost side and the
margin calculation is real rather than invented. These are **cost inputs, never
client-facing prices** — same rule as the electrical material list and
`app/data/materialRecipes.js`. A company adjusts them for their own supplier.

**Read date: 2026-08-10.** Every figure below is retail as of that date.

**Currency is marked on every number.** `USD` and `CAD` are never mixed in a
row. §9 explains why you must not convert one into the other with a single FX
multiplier.

**Marking convention**
- Unmarked = **read directly** off a live retailer page or a search snippet
  quoting that retailer.
- `[INF]` = **inferred** — interpolated, extrapolated from an adjacent size, or
  a market-guide band rather than a shelf price. Treat as a placeholder.
- `[LIST]` = manufacturer **list** price. Distribution sells far below list.
  Never seed a cost book from a list price.
- Items I could not verify at all are in §11, named plainly, not padded with a
  guess. (AGENTS.md failure class 5: absence of a statement is not a statement.)

---

## 0. Sourcing — what worked and what didn't

The obstacle in the brief held, and got worse:

| Source | Result |
|---|---|
| `homedepot.com` | **HTTP 403** to fetch and to curl. Snippets only. |
| `lowes.com`, `supplyhouse.com` | 403, as warned. |
| `homedepot.ca` | **Times out** on direct fetch (60 s), **403** to curl. Not simply blocked — the pages are client-rendered. |
| `rona.ca`, `canadiantire.ca`, `homehardware.ca`, `pexuniverse.com` | 403 / timeout. |
| **`kelloggsupplyco.com`** | **Fully fetchable, server-rendered, full price lists.** This is the backbone of the USD column. |
| **`homedepot.ca` via `r.jina.ai` text proxy** | **Works on *some* category pages** (water heaters, copper, ABS, PEX fittings), returns 404/empty on others (toilets, PVC). This is the CAD column. |

**Bias warning on the USD column.** Kellogg Supply is an independent
North Carolina retailer (Do It Best co-op), not a big box. Where I have a
matching Home Depot US number, Kellogg runs **0–25 % higher**:

| Item | Kellogg USD | Home Depot US USD | Gap |
|---|---|---|---|
| PEX-B ½" × 100 ft coil | $34.99 | $27.97 (Apollo) | +25 % |
| Copper Type L ½" × 10 ft | $39.99 | ≈$38.81 (Mueller; snippet showed $13.81 *after a $25 card promo*) | +3 % |
| 40 gal NG water heater | $579.99 (Reliance) | $599.00 (Rheem 40 short) | −3 % |

So: **commodity plastics skew high in the USD column (up to +25 %); metal pipe
and appliances are near parity.** Apply that haircut when seeding.

The methodology traps from `trade-pricing-research.md` §2C.1 still apply —
Angi / HomeGuide / HomeAdvisor are one owner, and Homewyse is a systematic
high outlier. Aggregator bands below are used only to corroborate, never as the
primary number.

---

## 1. Pipe & fittings

### 1.1 PEX-B tubing — per foot (USD)

| Size | LOW | TYPICAL | HIGH | Unit | Basis |
|---|---|---|---|---|---|
| ½" | $0.28 | $0.35 | $0.50 | per ft | 300 ft coil → 100 ft coil → 10 ft stick |
| ¾" | $0.50 | $0.55 | $1.08 | per ft | same progression |
| 1" | $0.70 `[INF]` | $0.75 | $0.90 `[INF]` | per ft | only the 100 ft coil was readable |

**The stick premium is real and worth encoding:** a 10 ft cut length of ½" runs
**$0.50/ft against $0.32/ft** on a 300 ft coil — a **56 % penalty** for buying
short. A repipe priced off stick pricing is priced wrong.

### 1.2 PEX tubing — per roll (as purchased)

| Item | LOW | TYPICAL | HIGH | Unit | Cur |
|---|---|---|---|---|---|
| PEX-B ½" × 100 ft coil | $27.97 | $32.00 | $34.99 | roll | USD |
| PEX-B ¾" × 100 ft coil | $50.00 `[INF]` | $54.99 | $58.00 `[INF]` | roll | USD |
| PEX-B 1" × 100 ft coil | — | $74.99 | — | roll | USD |
| PEX-B ½" × 300 ft coil | — | $94.99 | — | roll | USD |
| PEX-B ¾" × 300 ft coil | — | $149.99 | — | roll | USD |
| PEX-B ½" × 25 ft coil | — | $11.99 | — | roll | USD |
| PEX-B ¾" × 25 ft coil | — | $26.99 | — | roll | USD |
| **PEX-A (expansion) ½" × 100 ft** | — | **$56.93** | — | roll | **CAD** |
| PEX-B ½"/¾" × 10 ft stick | $4.99 | $6.75 | $8.49 | stick | USD |
| PEX-B ½"/¾" × 20 ft stick | $8.99 | $12.75 | $16.49 | stick | USD |

**PEX-A vs PEX-B.** The only PEX-A price I could read is the CAD one above.
Converted at ≈1.40 that is ≈USD $40 per 100 ft against USD $28–35 for PEX-B, so
**PEX-A carries roughly a 15–45 % tubing premium** `[INF]`. The bigger cost
difference is the tool and fitting system, not the tube.

### 1.3 PEX fittings

| Item | LOW | TYPICAL | HIGH | Unit | Cur |
|---|---|---|---|---|---|
| Crimp/insert elbow ½", brass | $1.03 | $1.40 | $2.60 | each | USD |
| Crimp/insert elbow ½" (50-pk, $52.00) | — | $1.04 | — | each | CAD |
| Crimp/insert elbow ¾" (25-pk, $40.00) | — | $1.60 | — | each | CAD |
| Crimp/insert tee ½", brass | $2.50 `[INF]` | $3.50 | $4.99 | each | USD |
| Crimp/insert coupling ⅜"–1", brass | $2.49 | $3.00 | $4.49 | each | USD |
| Crimp/insert adapter (CF × MPT) | $4.29 | $5.50 | $6.99 | each | USD |
| Copper crimp ring ½" (25-pk $9.49) | — | $0.38 | — | each | USD |
| Copper crimp ring ¾" / 1" | $0.48 | $0.50 | $0.52 | each | USD |
| Copper crimp ring ½" (200-pk $45 / 1000-pk $198) | $0.20 | $0.22 | — | each | CAD |
| SS cinch clamp ½" (10–100 pk) | $0.53 | $0.60 | $0.65 | each | USD |

### 1.4 Push-fit (SharkBite) — the premium, quantified

| Item | LOW | TYPICAL | HIGH | Unit | Cur |
|---|---|---|---|---|---|
| Push-fit coupling ½" | — | $9.36 | — | each | USD |
| Push-fit 90° elbow ½" | — | $12.93 | — | each | USD |
| Push-fit 90° elbow ½" (SharkBite Max) | — | $11.78 | — | each | CAD |
| Push-fit tee ½" (SharkBite Max) | — | $14.98 | — | each | CAD |
| Push-fit × FIP elbow ½", PRV-grade brass | — | $89.99 | — | each | USD (as a PRV, §3) |
| Anderson push-in coupling ¼"–⅜" | $6.29 | $6.79 | $7.29 | each | USD |

**A push-fit fitting costs 8–13× the equivalent crimp fitting** (elbow: $12.93
vs ~$1.04–1.40). On a 120-fitting repipe that is a **~$1,400 USD swing on
fittings alone**. This must be a *separate catalogue item*, never a default
substitution — it is the single largest silent cost error available in a
plumbing price book.

### 1.5 Copper pipe

Per length (as purchased):

| Item | 10 ft USD | 20 ft USD | 12 ft CAD |
|---|---|---|---|
| Type L ½" | $39.99 | $77.99 | $51.98 |
| Type L ¾" | $64.99 | $134.99 | $67.20 |
| Type L 1" | $84.99 | $169.99 | — |
| Type L 1¼" | $159.99 | — | — |
| Type L 1½" | $199.99 | — | — |
| Type L 2" | $309.99 | — | — |
| Type M ½" | $32.99 | $54.99 | $35.74 |
| Type M ¾" | $52.99 | $94.99 | — |
| Type M 1" | $67.99 | — | $75.38 |
| Type M 1¼" | $154.99 | — | — |
| Type M 1½" | $289.99 | — | — |

Per foot:

| Size | Type M USD | Type L USD | Type M CAD | Type L CAD |
|---|---|---|---|---|
| ½" | $2.75–3.30 | $3.90–4.00 | $2.98 | $4.33 |
| ¾" | $4.75–5.30 | $6.50–6.75 | — | $5.60 |
| 1" | $6.80 | $8.50 | $6.28 | — |

**Type L is 21–25 % more than Type M** at ½"–1" in 10 ft lengths. The gap
*widens to 42 %* at 20 ft (½": L $3.90/ft vs M $2.75/ft) because Type M
discounts harder on volume — so the L-vs-M premium is not a constant and cannot
be encoded as one percentage. Buying 20 ft lengths saves **up to 17 %** per foot
over 10 ft (Type M ½": $2.75 vs $3.30).

### 1.6 Copper fittings (sweat), USD

| Item | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| 90° street elbow ½" | — | $2.09 | — | each |
| 90° street elbow ¾" | — | $4.59 | — | each |
| 90° street elbow 1" | — | $16.49 | — | each |
| 45° elbow ½" / ¾" / 1" | $2.79 | $3.29 | $12.99 | each |
| 45° elbow 1½" | — | $17.49 | — | each |
| Reducing 90° (½×⅜, ¾×½, 1×¾) | $7.99 | $9.29 | $13.99 | each |
| Solder-joint union ½" / ¾" / 1" | $13.99 | $16.99 | $22.99 | each |
| FTG × M adapter ½" / ¾" | $13.99 | $15.00 | $15.99 | each |
| Press coupling ½" / ¾" (Mueller, Walmart) | $11.49 | $12.50 | $13.49 | each |

Note the **cliff at 1"** — a 1" street 90 is $16.49 against $4.59 at ¾". Any
"copper fitting" default that ignores size will be wrong by **3.6×** on larger
runs.

### 1.7 PVC DWV

| Size | 10 ft USD | 20 ft USD | USD/ft | 12 ft CAD |
|---|---|---|---|---|
| 1½" | $9.29 | $19.99 | $0.93–1.00 | — |
| 2" | $14.99 | $24.99 | $1.25–1.50 | — |
| 3" | $21.99–39.99 | $59.99 | $2.20–4.00 | — |
| 4" | $33.99 | $59.99 | $3.00–3.40 | — |

The 3" spread is Schedule 40 cellular core ($21.99) vs Schedule 30 ($39.99) —
**a real spec difference, not noise.** Carry the schedule on the line.

### 1.8 ABS DWV

| Size | 10 ft USD | 20 ft USD | USD/ft | 12 ft CAD | CAD/ft |
|---|---|---|---|---|---|
| 1½" | $15.99 | $22.99 | $1.15–1.60 | $18.48 | $1.54 |
| 2" | $19.99 | $41.99 | $2.00–2.10 | $27.98 | $2.33 |
| 3" | $41.99 | $77.99 | $3.90–4.20 | $42.98 | $3.58 |
| 4" | $54.99 | $114.99 | $5.50–5.75 | $77.98 | $6.50 |

**ABS costs 1.6–1.9× PVC at the same size** (4": $5.50/ft vs $3.40/ft USD on
10 ft lengths; $5.75 vs $3.00 on 20 ft).
Which one a plumber uses is set by local code, not preference — western Canada
and parts of the US west are ABS country, most of the US east is PVC. **The
default must be region-aware or the DWV cost is wrong by ~70 % for half the
user base.**

### 1.9 DWV fittings

| Item | LOW | TYPICAL | HIGH | Unit | Cur |
|---|---|---|---|---|---|
| PVC coupling 3" | — | $3.29 | — | each | USD |
| PVC cleanout with plug 3" | — | $6.99 | — | each | USD |
| PVC sanitary tee 3" | — | $10.99 | — | each | USD |
| PVC reducing bushing / adapter bushing 3" | $5.79 | $6.29 | $6.79 | each | USD |
| PVC Sch 40 tee 3"–4" | $18.99 | $20.99 | $22.99 | each | USD |
| PVC flexible repair tee 1½"–4" | $12.99 | $17.99 | $24.99 | each | USD |
| ABS waste & vent tee 1½" / 2" | $8.29 | $8.40 | $8.49 | each | USD |
| ABS waste & vent tee 3" | — | $19.99 | — | each | USD |
| ABS reducing sanitary tee 2×1½ … 4×3 | $5.29 | $15.49 | $33.99 | each | USD |
| Drain / trap connector 1½"–2" | $6.79 | $7.29 | $7.29 | each | USD |
| Dishwasher drain connector | — | $4.49 | — | each | USD |

### 1.10 Cast iron

| Item | Value | Note |
|---|---|---|
| No-hub coupling 4" | **$52.43 `[LIST]`** | ANACO list, effective 2026-07-01. Street price is far below — plan on **$12–18 standard / $25–40 heavy-duty** `[INF]`. |
| Cast-iron no-hub soil pipe 4" × 10 ft | **not verified** | Carried by Lowe's / Ferguson / Charlotte but no price readable. See §11. |

### 1.11 Manifolds

| Item | TYPICAL USD | Unit |
|---|---|---|
| 4-port PEX barb manifold | $28.99 | each |
| 6-port PEX barb manifold | $29.99 | each |
| 3-port push-to-connect manifold (open / closed) | $34.99 / $39.99 | each |
| 12-port barb manifold with brass ball shutoffs | $204.99 | each |
| 24-port barb manifold with brass ball shutoffs | $319.99 | each |
| Multi-port tee, 3 / 4 branch | $10.49 / $10.99 | each |

Note the **7× jump** from a bare 6-port ($29.99) to a 12-port with integral
shutoffs ($204.99). The shutoffs, not the ports, are the cost.

### 1.12 Pipe insulation

| Item | LOW | TYPICAL | HIGH | Unit | Cur |
|---|---|---|---|---|---|
| ½" copper, 6 ft length | $2.79 | $4.00 | $11.49 | length | USD |
| ¾" copper, 6 ft length | $4.99 | $6.50 | $8.49 | length | USD |
| 1" copper | — | $11.49 | — | length | USD |
| 3" copper | — | $23.99 | — | length | USD |
| 25 ft roll | $6.79 | $8.50 | $10.49 | roll | USD |
| 50 ft roll | — | $12.49 | — | roll | USD |
| **per foot, ½"–¾"** | **$0.25** | **$0.47** | **$0.80** | per ft | USD |

---

## 2. Water heaters

### 2.1 Equipment — tank

| Item | LOW | TYPICAL | HIGH | Unit | Cur |
|---|---|---|---|---|---|
| 30 gal gas (NG) | $559.99 | $590 | $614.99 | each | USD |
| **40 gal gas (NG)** | **$579.99** | **$600** | **$1,349.99** | each | USD |
| 40 gal gas (NG) | — | **$885** | $1,498 (power vent) | each | **CAD** |
| **50 gal gas (NG)** | **$799.99** | **$850** | **$1,399.99** | each | USD |
| 50 gal gas (NG) | $1,199 | $1,345 | $1,548 (power vent) | each | **CAD** |
| 40 gal gas (LP) | $829.99 | $880 | $1,469.99 | each | USD |
| 50 gal gas (LP) | $999.99 | — | $1,849 (CAD, power vent) | each | mixed |
| 60 gal gas (NG) | — | $1,799 | $2,481 (power vent) | each | **CAD** |
| 75 gal gas (NG) | $1,429.99 (USD) | — | $2,979 (CAD, commercial) | each | mixed |
| 39–40 gal electric | $595 | $695 | $789 | each | **CAD** |
| **50 gal electric** | **$669** `[INF]` | **$700** `[INF]` | **$1,200** | each | USD |
| 63 gal electric | $749 | $875 | $975 | each | **CAD** |
| 50 gal heat-pump / hybrid | $1,414 (USD) | — | $2,999 (CAD) | each | mixed |
| Lifetime-warranty 40 gal electric (Marathon) | — | $1,648 | — | each | **CAD** |

`[INF]` on 50 gal electric USD: read as "$619–$629 after $50 off" at Home Depot
US, so list ≈ $669–679; market guides put the band at $500–1,200.

### 2.2 Equipment — tankless

| Item | LOW | TYPICAL | HIGH | Unit | Cur |
|---|---|---|---|---|---|
| Electric tankless 8 kW | — | $234.99 | — | each | USD |
| Electric tankless 13.6 kW | — | $249.99 | — | each | USD |
| Electric tankless 18 kW | — | $489.99 | — | each | USD |
| Electric tankless 27 kW | — | $609.99 | — | each | USD |
| Electric tankless 24 kW (Stiebel Tempra 24 Plus) | — | $1,198 | — | each | **CAD** |
| **Gas condensing tankless** | **$1,988** | **$2,100** | **$2,160** | each | **CAD** |
| Gas condensing tankless | — | $2,099.99 | — | each | USD |

The gas tankless band is **unusually tight** — USD $2,100 and CAD $1,988–2,160
across Reliance, Rheem and Rinnai. This is one of the few big-ticket items where
a single shipped default is safe.

*Anomaly, flagged not smoothed:* Home Depot Canada listed the Stiebel **Tempra
36 Plus at $995 and the smaller Tempra 24 Plus at $1,198**. Larger unit,
lower price. Almost certainly a clearance on the 36. Do not seed from it.

### 2.3 Water-heater ancillaries (USD)

| Item | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| Thermal expansion tank, 2 gal | $34.42 | $45 | $60 | each |
| Drain pan, plastic 20"/24"/28" | $9.69 | $12.79 | $15.99 | each |
| Drain pan, aluminum 20"/25"/28" | $29.99 | $34.99 | $39.99 | each |
| Pan adapter fitting | — | $4.39 | — | each |
| Water-heater stand, 18" | $59.99 | $61.00 | $62.99 | each |
| Seismic / earthquake strap kit | $24.99 | $28.00 | $32.99 | kit |
| T&P / pressure relief valve ¾" | — | $24.99 | — | each |
| Heat-trap nipples (pair) | — | $17.99 | — | pair |
| Vent cap kit | — | $54.99 | — | kit |
| Insulation jacket R5 / R6.7 / R10 | $20.49 | $42.99 | $69.99 | each |
| Gas flex connector | $15 `[INF]` | $20 `[INF]` | $35 `[INF]` | each |
| Dielectric union ¾" | $12 `[INF]` | $15 `[INF]` | $22 `[INF]` | each |

**Full ancillary bundle for a standard tank swap: ≈ $200–260 USD**
(expansion tank + plastic pan + stand + T&P + strap + connectors).

---

## 3. Valves & controls (USD unless marked)

| Item | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| **PRV (pressure reducing valve) ¾"** | **$67.99** | **$70** | **$229.99** | each |
| PRV ¾", push-to-connect version | — | $89.99 | — | each |
| PRV ½", iron body | — | $67.99 | — | each |
| Pressure relief valve ¾" | — | $24.99 | — | each |
| Hose-connection vacuum breaker ¾" | — | $77.99 | — | each |
| Ball valve, PVC ½" / 1" / 1¼" / 2" | $5.99 | $9.99 | $29.99 | each |
| Ball valve, brass ½"–1" | **not verified** — see §11 | | | each |
| Gate valve, forged brass 2" | — | $154.99 | — | each |
| Angle stop, quarter-turn | $12.99 | $16.49 | $19.99 | each |
| Straight stop / push stop | $16.99 | $17.25 | $17.49 | each |
| Stop-and-waste ½" / ¾" FPT | $7.99 | $8.25 | $8.49 | each |
| Hose bibb ½" / ¾" MIP | $9.99 | $14.99 | $28.99 | each |
| **Frost-free sillcock, 8"** | — | **$36.22** | — | each |
| Frost-free sillcock, 12" | $38 `[INF]` | $42 `[INF]` | $55 `[INF]` | each |
| Thermostatic mixing valve | **not verified** — see §11 | | | each |
| Backflow preventer (RPZ) | **not verified** — see §11 | | | each |

**The PRV is the sleeper.** A "commodity" valve with a **3.4× retail spread**
($67.99 Cash Acme → $229.99 Watts), and §2B.4 of the electrical research shows
a real estimate billing a heavy-duty ¾" PRV at **$784**. That is 3.4× the most
expensive retail part and 11.5× the cheapest. A single default here is
misleading in both directions.

---

## 4. Fixtures (USD unless marked)

### 4.1 Toilets

| Tier | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| Builder-grade, round, standard height | $72.99 | $99 | $154.99 | each |
| Mid, elongated, standard height | $169.99 | $189.99 | $264.99 | each |
| Comfort / chair / ADA height | $169.99 | $209.99 | $279.99 | each |
| Designer / specialty | $300 `[INF]` | $600 `[INF]` | $1,549.99 | each |

Verified points: Mansfield round std **$87.99**; Briggs round std $154.99;
American Standard chair height $189.99; American Standard Right Height
$249.99–279.99; Mansfield elongated SmartHeight $209.99–229.99; top of one
catalogue **$1,549.99**.

**Comfort height costs $20–40 more than standard, not $150.** Any price book
treating "comfort height" as a premium tier is wrong on the material side; the
premium, if any, is a sales decision.

### 4.2 Faucets

| Item | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| Bathroom sink faucet, centerset | $25.99 | $69.99 | $99.99 | each |
| Bathroom sink faucet, widespread | $99.99 | $119.99 | $139.99 | each |
| Kitchen faucet, 2-handle w/ side spray | $62.99 | $82.99 | $114.99 | each |
| Kitchen faucet, 1-handle pull-out/down | $129.99 | $159.99 | $209.99 | each |
| Laundry / utility faucet | $30 `[INF]` | $50 `[INF]` | $90 `[INF]` | each |
| Designer/high-end either type | $250 `[INF]` | $500 `[INF]` | $1,500 `[INF]` | each |

The $25.99–$209.99 band is one builder-focused catalogue. The real market runs
far past it — see §10.

### 4.3 Sinks

| Item | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| Kitchen SS, 20 ga, single/double | $149.99 | $159.99 | $189.99 | each |
| Kitchen SS, 18 ga, double 33×22 | $189.99 | $224.99 | $289.99 | each |
| Kitchen SS, 18 ga, premium (Crosstown) | $499.99 | $549.99 | $599.99 | each |
| Kitchen composite / quartz 33×22 | — | $379.99 | — | each |
| Kitchen fireclay / farmhouse | $444.99 | $564.99 | $799.99 | each |
| Bathroom lavatory sink | **not verified** — see §11 | | | each |

**Gauge is the price driver in stainless: 20 ga → 18 ga is +40 %** at the same
size ($159.99 → $224.99 on a 33×22 double). Encode gauge, not just "SS sink".

### 4.4 Tubs, surrounds, showers

| Item | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| Tub, porcelain-enamel steel 60×30 | — | $259.99 | $434.99 | each |
| Tub, fiberglass 60×30/32 | $344.99 | $360 | $374.99 | each |
| Tub, acrylic alcove 60×30/32 | $304.99 | $369.99 | $479.99 | each |
| Tub, acrylic soaker / freestanding | $1,494.99 | $1,550 | $1,599.99 | each |
| Tub surround, 5-piece budget | $109.00 | $199.99 | $269.00 | set |
| Tub surround, 3–4 piece premium | $339.99 | $564.99 | $879.99 | set |
| Shower valve rough-in, pressure balance | $50 | $95 | $150 | each |
| Shower trim kit | $80 | $180 | $350 | each |
| **Complete tub/shower faucet (valve + trim)** | **$49.99** | **$139.99** | **$279.99** | set |
| Thermostatic shower valve body | $200 | $380 | $600 | each |
| Volume control valve (per outlet) | $80 | $150 | $250 | each |
| Full thermostatic multi-outlet system | $600 | $900 | $1,500 | set |

**Pressure-balance vs thermostatic is a 4–6× material decision**
($130–500 complete vs $600–1,500 complete). It belongs on the quote as a named
option with both numbers, not as an upgrade with a single adder.

### 4.5 Appliances & pumps

| Item | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| Garbage disposal ⅓ hp | $79.99 | $119.99 | $144.99 | each |
| Garbage disposal ½ hp | $94.99 | $134.99 | $149.99 | each |
| Garbage disposal ¾ hp | $169.99 | $204.99 | $299.99 | each |
| Garbage disposal 1 hp | $219.99 | $300 | $399.99 | each |
| Sump pump ⅓ hp submersible | $109.99 | $144.99 | $189.99 | each |
| Sump pump ½ hp submersible | $169.99 | $194.99 | $344.99 | each |
| Sump pump ¾ hp submersible | — | $219.99 | — | each |
| Sump pump, pedestal ⅓–½ hp | $124.99 | $174.99 | $184.99 | each |
| Sewage ejector ⅓ hp | $269.99 | $277 | $284.99 | each |
| Sewage ejector 4/10 hp | — | $459.99 | — | each |
| Sewage ejector ½ hp | $214.99 | $309.99 | $499.99 | each |
| Water softener 32k grain | $400 | $500 | $600 | each |
| Water softener 40k grain (box store) | $400 | $600 | $800 | each |
| Water softener 64k grain | $900 | $1,200 | $1,500 | each |
| Washer outlet box | **not verified** — see §11 | | | each |
| Laundry tub / utility sink | **not verified** — see §11 | | | each |

**⅓ hp → ½ hp disposal is only +$5–20** (Waste King $79.99→$94.99; InSinkErator
$144.99→$149.99). A price book that charges a meaningful upgrade fee between
those two is charging for nothing. **¾ hp is the first real step** ($170–300).

---

## 5. Drainage (USD)

| Item | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| P-trap, PVC 1½" | — | $6.29 | — | each |
| P-trap, PVC 1½" with union | $8.99 | $12.99 | $16.99 | each |
| P-trap, PVC 1½" with cleanout | — | $11.49 | — | each |
| P-trap, PVC 2" | $10.99 | $14.99 | $16.99 | each |
| P-trap, ABS 1½" / 2" / 3" | $7.29 | $14.99 | $31.99 | each |
| P-trap, brass 1¼"–1½" chrome | $32.99 | $34.99 | $36.99 | each |
| Escutcheon, chrome ⅜"/½" IPS | $1.19 | $1.25 | $1.29 | each |
| Split plate / floor flange ⅜"–1½" | $3.19 | $3.99 | $4.49 | each |
| Bell / bell-type flange | $4.49 | $5.99 | $8.79 | each |
| Cleanout with plug, PVC 3" | — | $6.99 | — | each |
| Closet flange | **not verified** — see §11 | | | each |
| Wax ring / wax-free seal | **not verified** — see §11 | | | each |
| Floor drain | **not verified** — see §11 | | | each |

**Brass P-traps cost 5× plastic** ($34.99 vs $6.29). Exposed-trap work under a
pedestal lav is a different line item from a vanity trap.

---

## 6. Consumables (USD)

| Item | LOW | TYPICAL | HIGH | Unit |
|---|---|---|---|---|
| PVC / ABS / CPVC cement, 4 oz | $6.29 | $7.50 | $8.29 | can |
| PVC / ABS / CPVC cement, 32 oz | $22.49 | $23.00 | $23.99 | can |
| Cement + primer kit | $11.49 | $18.00 | $23.99 | kit |
| Lead-free solder, 1 lb | $29.99 | $35.00 | $44.99 | lb |
| Soldering flux, 1 lb | $8 `[INF]` | $12 `[INF]` | $18 `[INF]` | tub |
| PTFE / thread tape | $1 `[INF]` | $2 `[INF]` | $4 `[INF]` | roll |
| 2-hole galv strap ½" (10-pk $4.99) | — | $0.50 | — | each |
| 2-hole galv strap ¾" (10-pk $6.49) | — | $0.65 | — | each |
| 2-hole galv strap 1"–2" (4-pk) | $1.00 | $1.20 | $1.70 | each |
| Nail-on pipe hanger ¾" (100-pk $22.99) | — | $0.23 | — | each |
| Copper tube strap ½"/¾"/1" (5-pk) | $0.88 | $1.08 | $1.48 | each |
| Plastic hanger strap, ¾" × 25 ft | — | $4.99 | — | roll |
| Galv hanger strap, ¾" × 10 / 50 ft | $4.99 | $5.49 | $10.49 | roll |
| Insulator nail-on clamp ½"/¾" (6-pk) | $9.49 | $9.75 | $9.99 | pack |
| Insulator half/full clamp (12-pk) | $4.99 | $5.50 | $6.49 | pack |

---

## 7. Where the equipment-vs-install split matters most

Rank by **how easily a homeowner can independently price-check the equipment**,
which is the same as how exposed the contractor's markup is.

| Rank | Item | Retail equipment | Why it's exposed |
|---|---|---|---|
| **1** | **Tank water heater** | **USD $580–850 / CAD $885–1,345** | Model number is on a sticker, the sticker is in a photo, and the exact SKU is on homedepot.com. Nothing else in plumbing is this checkable. |
| 2 | Tankless gas | USD ~$2,100 / CAD $1,988–2,160 | Same, but the number is high enough that markup is a smaller *fraction* of the total. |
| 3 | Toilet | $73–280 | Brand + model visible on the china. A $900 "toilet install" against a $150 toilet reads badly if unexplained. |
| 4 | Kitchen/bath faucet | $26–210 builder | Client often supplies their own — then the line is pure labour and must be structured that way. |
| 5 | Water softener | $400–800 | Sold heavily online; homeowners shop it before calling. |
| 6 | Garbage disposal / sump pump | $80–400 / $110–345 | Commodity, Amazon-checkable. |

### 7.1 The $2,664 water-heater line, decomposed

The owner's real estimate shows **50 gal natural gas water heater, equipment
$2,664**, plus a separate **$667.77 gas water heater economy install package**.

Against verified retail on 2026-08-10:

| Reading | Retail equipment | $2,664 as a multiple |
|---|---|---|
| Standard atmospheric 50 gal NG, USD | $799.99 | **3.3×** |
| Standard atmospheric 50 gal NG, CAD | $1,199 | **2.2×** |
| Premium 50 gal NG (12-yr / power vent), CAD | $1,548 | **1.7×** |
| Premium 50 gal NG, USD | $1,399.99 | **1.9×** |
| Standard heater **+ full ancillary bundle** (§2.3, ≈$230) | ≈$1,030 USD | **2.6×** |
| Contractor wholesale, standard 50 gal NG `[INF]` | ≈$450–650 USD | **4.1–5.9×** |

**Even on the most generous reading — a premium power-vent unit with every
ancillary bundled in — the line carries roughly 70–90 % markup, and the
install labour is billed separately on top.** On the most likely reading
(standard atmospheric unit, wholesale acquisition) it is **4–6×**.

I cannot tell from the estimate what the $2,664 actually includes; it may bundle
venting, permit, haul-away and the ancillaries. **That is exactly the product
finding:** an opaque four-figure equipment line invites the homeowner to look up
the SKU and conclude they are being gouged, whether or not they are.

**Product requirement.** When a quote line's material cost exceeds a threshold
(≈$500), FieldQuo should push the contractor to either (a) itemise what the
equipment line contains, or (b) present it as a supply-and-install package with
the components listed. Not to reduce the price — to make the price defensible.
This is the same principle as `trade-pricing-research.md` §1.4.4
("assumptions print on the line").

---

## 8. PEX vs copper — whole-house repipe material differential

**Modelled**, from the verified per-unit costs above. Assumptions stated because
they drive the answer:

- 2,000 sq ft single-family, 12 fixtures
- 400 ft of ½" + 150 ft of ¾" `[INF]` on the run lengths
- ~120 fittings `[INF]`
- Manifold/home-run for PEX; trunk-and-branch for copper

| Line | PEX-B (crimp) USD | Copper Type L USD |
|---|---|---|
| ½" tube/pipe, 400 ft | $128 (@ $0.32) | $1,600 (@ $4.00) |
| ¾" tube/pipe, 150 ft | $78 (@ $0.52) | $975 (@ $6.50) |
| Fittings, ~120 | $240 (@ ~$2.00) | $420 (@ ~$3.50) |
| Crimp rings / solder + flux | $30 | $60 |
| 12-port manifold w/ shutoffs | $205 | — |
| Stub-outs, valves, hangers | $150 | $250 |
| **Material total** | **≈ $830** | **≈ $3,305** |

**Copper is ≈4× PEX on materials — a ≈$2,475 USD delta.**

Market guides put the **installed** delta at PEX $4,000–8,500 vs copper
$9,000–12,000 — a **$4,500–5,000** gap. So:

> **Roughly half the copper premium is material; the other half is labour.**
> Copper takes about twice as long to install.

If FieldQuo quotes a repipe as "PEX or copper", it needs **two cost lines and
two labour-hour lines**, not one line with a material swap. Swapping only the
material understates the copper option by ~$2,000–2,500.

Same-basis sanity check: the market's per-sq-ft bands (PEX $3.50–7.00,
copper $8.00–14.00 installed) put a 2,000 sq ft job at $7,000–14,000 PEX and
$16,000–28,000 copper — higher than the whole-house bands above, because the
per-sq-ft figures come from repipe specialists in high-cost metros. **Both are
"correct"; they are different markets.** Do not average them.

---

## 9. CAD vs USD — do NOT use a single multiplier

Paired items, same date, nominal prices as shelved:

| Item | USD | CAD | CAD ÷ USD |
|---|---|---|---|
| Copper Type M ½", per ft | $3.30 | $2.98 | **0.90** |
| Copper Type L ½", per ft | $4.00 | $4.33 | **1.08** |
| ABS 1½", per ft | $1.60 | $1.54 | **0.96** |
| ABS 3", per ft | $4.20 | $3.58 | **0.85** |
| ABS 4", per ft | $5.50 | $6.50 | **1.18** |
| SharkBite ½" push elbow | $12.93 | $11.78 | **0.91** |
| PEX crimp elbow ½" | $1.03–1.84 | $1.04 | **0.6–1.0** |
| 40 gal NG water heater | $579.99–599.00 | $885 | **1.48–1.53** |
| 50 gal NG water heater | $799.99 | $1,199 | **1.50** |
| Gas condensing tankless | $2,099.99 | $1,988–2,160 | **0.95–1.03** |

**The ratio ranges from 0.85 to 1.53 across categories.** There is no single
number. Two distinct regimes:

- **Commodity pipe, fittings and consumables: CAD ≈ USD × 0.85–1.2 nominal.**
  At a ~1.40 CAD/USD rate that means Canadian material is *cheaper in real
  terms* — though part of that is my USD source being a small independent
  retailer, so treat it as "near parity" rather than a Canadian discount.
- **Tank water heaters: CAD ≈ USD × 1.50 nominal**, i.e. roughly parity after
  currency conversion, sometimes a few points above.
- **Tankless: near parity nominally**, i.e. genuinely cheaper in Canada in real
  terms.

**Schema requirement:** store material cost **per region as its own value**.
Do not store one USD cost plus an FX rate — it will be wrong by up to 60 % on
water heaters and up to 40 % the other way on plastics. This mirrors the
existing rule that tax is per-jurisdiction, not global.

Background: Canada's Building Construction Price Index shows **plumbing up
4.2 % year-over-year through Q4 2025**, and CAD is projected to weaken to
C$1.45–1.50/USD through 2026. Both push the appliance ratio further up. Escalate
Canadian material defaults on their own curve, not the US one — same separation
principle as `trade-pricing-research.md` §2.6.

---

## 10. Widest brand/quality spread — where a single default misleads most

Ratio of highest to lowest **within a single builder-oriented catalogue** (so
this understates the real market spread):

| Rank | Item | Spread | Range | Verdict |
|---|---|---|---|---|
| **1** | **Toilet** | **21×** | $72.99 → $1,549.99 | **Never ship one default.** Ship three tiers. |
| **2** | **Shower valve + trim** | **12×** | $130 → $1,500 | Pressure-balance vs thermostatic is a different product, not a grade. |
| 3 | Tub surround | 8× | $109 → $879.99 | Piece count and material both move it. |
| 4 | Tub | 6.2× | $259.99 → $1,599.99 | Steel vs fibreglass vs acrylic vs soaker. |
| 5 | Bathroom faucet | 5.4× | $25.99 → $139.99 | Real market goes to $1,500+ → **50×+**. |
| 6 | Kitchen sink | 5.3× | $149.99 → $799.99 | Gauge and material. |
| 7 | Garbage disposal | 5× | $79.99 → $399.99 | hp is the axis, and hp is cheap at the bottom. |
| 8 | Kitchen faucet | 4.2× | $49.99 → $209.99 | Real market to $1,200+ → **24×**. |
| 9 | **PRV** | **3.4×** | $67.99 → $229.99 | **The surprise.** A "commodity" valve. |
| 10 | Sump / sewage pump | 2–3× | $109.99 → $499.99 | Cast iron vs thermoplastic. |

**Safe to ship a single default** (spread under ~2×, genuinely commodity):
pipe per foot, crimp/sweat fittings, crimp rings, straps and hangers, cement and
primer, P-traps, pipe insulation, drain pans, water-heater stands, T&P valves,
escutcheons, closet bolts. **Gas tankless** also qualifies — the band is tight.

**Design rule.** Items in the top half of that table should follow the
`defaultLineItems.js` pattern already agreed for electrical services: ship the
**item and its tiering axis** with `cost: null` and a visible benchmark range,
and make the contractor pick. The list is the hard part; the number is theirs.
The correct axis differs per item and must be stored, not guessed:
toilet → height + bowl shape; sink → gauge/material; disposal → hp;
shower valve → valve technology; tub → material.

---

## 11. What I could NOT verify — stated plainly

Not estimated, not padded. These have **no shippable default** until someone
reads a real price.

**Blocked at the source**
- **Everything on `homedepot.com`, `lowes.com`, `supplyhouse.com`** — 403 to
  both WebFetch and curl. Every US big-box number here came from a search
  snippet, not a page read.
- **`homedepot.ca` direct** — 60 s timeouts, 403 to curl. CAD numbers came
  through a text-extraction proxy that worked on only about half the category
  pages I tried (water heaters, copper, ABS, PEX fittings **yes**; toilets,
  PVC pipe, PEX tubing **no**).

**Items with no verified price**
| Item | Why |
|---|---|
| **CPVC pipe** — any size, either currency | Category exists at every source I could read; no price page rendered. **A whole material system is missing.** |
| Cast-iron soil pipe (4" × 10 ft etc.) | Carried by Ferguson/Lowe's/Charlotte; no readable price. Only the no-hub coupling **list** price ($52.43, ANACO, 2026-07-01) — and list ≠ street. |
| Closet flanges | The "floor & wall flanges" category turned out to be escutcheons and split plates. Never found closet flanges. |
| Wax rings / wax-free seals | Toilet-parts leaf pages returned 404 or category-only. |
| Floor drains | Category exists; leaf page not read. |
| Vent components (roof flashing, AAVs) | Not reached. |
| Brass ball valves by size | Only **PVC** ball valves priced. Brass not read at any size. |
| Thermostatic mixing valve (point-of-use / whole-house) | Only *shower* thermostatic bodies ($200–600). The tempering valve is a different part. |
| Backflow preventer (RPZ / DCVA) | Only a hose-connection vacuum breaker ($77.99). Not the same device. |
| Washer outlet box | Category exists; no price read. §2B.4 has a $560 *installed* figure only. |
| Laundry tub / utility sink | Category exists; no price read. |
| Bathroom lavatory sinks | Category exists; only kitchen sinks rendered. |
| Soldering flux, PTFE tape | Marked `[INF]` in §6 from general knowledge, not read. |
| Gas flex connectors, dielectric unions | Marked `[INF]` in §2.3. Both are in every water-heater swap; both are guesses right now. |
| PEX-A tubing in USD | Only the CAD price. The PEX-A/PEX-B premium in §1.2 is inference from one converted pair. |
| Contractor **wholesale** pricing, any item | Every number in this document is **retail**. Wholesale is typically 25–45 % below `[INF]`, which means every markup multiple in §7.1 is a *lower bound*. Verifying real wholesale needs a trade account — that is the highest-value thing a human could add. |

**Single-source risk.** Roughly 70 % of the USD column is one retailer
(Kellogg Supply, NC). It is internally consistent and server-rendered, which is
why it is here, but it is one region and one co-op's pricing. The Home Depot
cross-checks in §0 are the only independent confirmation, and there are three of
them.

---

## 12. What this changes in the build

1. **Material costs ship as real defaults** — internal, factual, adjustable per
   supplier. That holds for everything in §10's "safe to ship" list.
2. **Region is a first-class dimension on material cost**, not a derived FX
   conversion (§9). And **DWV material is region-determined** (ABS vs PVC, §1.8)
   — a ~70 % cost difference decided by code, not preference.
3. **Fitting *system* is a catalogue axis, not a substitution** (§1.4). Crimp,
   expansion and push-fit are 1× / ~1.2× / ~10× on the same fitting.
4. **Big equipment lines carry an itemisation prompt** above ~$500 (§7.1).
5. **High-spread fixtures ship with a tiering axis and `cost: null`** (§10) —
   the electrical `defaultLineItems.js` rule, applied to materials.
6. **Repipe options carry independent material *and* labour lines** (§8).
7. **Length/pack pricing must be encoded**, not averaged — 20 ft vs 10 ft copper
   is **−17 %/ft**, 300 ft vs 10 ft PEX is **−36 %/ft**, and crimp rings fall
   from **USD $0.38 each** in a 25-pack to **CAD $0.20 each** in a 1000-pack
   (different currencies, so treat that as directional, not a measured ratio).

---

*Sources: kelloggsupplyco.com (read 2026-08-10, USD); homedepot.ca via text
proxy (read 2026-08-10, CAD); homedepot.com and lowes.com via search snippets
only (403 to direct fetch); anaco-husky.com no-hub list price effective
2026-07-01; ipexna.com PVC DWV fittings list effective 2026-01-02; aggregator
bands (Fixr, HomeGuide, Angi) used for corroboration only, per the
single-owner caveat in `trade-pricing-research.md` §2C.1.*
