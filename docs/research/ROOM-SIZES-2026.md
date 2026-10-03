# Room sizes and ceiling heights by region (2026 desk research)

## Purpose

The painting instant estimate lets a homeowner pick rooms by type and size
(small / medium / large). The server turns each pick into wall area from a
typical floor footprint and a ceiling height for the contractor's region. This
file is the evidence behind those defaults: one table per region, every number
tied to a source we actually read on 2026-10-03, and every guess marked as a
guess. Nothing here is a price. These are geometry defaults only: every
room the picker sizes reaches the draft quote marked "typical size, confirm
on site", in the builder's own Length × Width × Height boxes, where the
estimator types the real figure. There is no per-company preset override
(the stairs rule this follows has none either).

The table lives in code at `lib/estimate/roomPresetData.js` and is held to
this file by `npm run check:room-presets`. Which table a company gets is
read off the country its own record states: US/CA → North America; GB and
IE → UK (no Irish source read; nearest comparable stock); AU and NZ →
Australia; DE, FR, ES, IT → their own; NL, CH → the EU median; no stated
country → North America, said so on the draft.

Scope: 12 room keys (`living`, `kitchen`, `dining`, `primary_bedroom`,
`bedroom`, `bathroom`, `ensuite`, `hallway`, `stairwell`, `office`,
`laundry`, `basement`) across 8 regions (`north_america`, `uk`, `australia`,
`germany`, `france`, `spain`, `italy`, `eu`). New Zealand uses the Australia
table, because we read no New Zealand source.

## How to read this

Each cell is **length x width** of the floor, in the region's own unit: feet
for North America and metres everywhere else. Length is always at least the
width. The area in brackets is there only so you can check the figure against
the sources, which mostly give areas. Most sources give an area and no shape,
so we chose the length/width split for a normal room shape. The area is the
sourced part. The proportions are ours.

The **Kind** column gives the kind of figure for Small / Medium / Large, in
that order:

| Kind | Meaning |
|---|---|
| **measured** | An average measured from real homes: a survey with tape measures (Qualitel, France) or an analysis of floor plans (LABC Warranty, UK). This is the strongest kind. |
| **minimum** | A legal or adopted standard: a building code, decree or national space standard. A floor, not a typical room. We mostly use these for **Small**. |
| **recommended** | A minimum or target that a guide or official body recommends. It is not law and was not measured. |
| **guide** | A typical size from an architecture, builder or retailer guide. It is reasonable, but nobody measured a population of homes. |
| **INFERRED** | Our estimate, worked out from the neighbouring cells or from another region's geometry. Each one is explained in its row and listed under "Gaps and guesses". |

For stair spaces the cell is the **footprint of the stair space** (the
horizontal run including landings, by the flight width). The wall height of a
stairwell is usually two storeys, and the caller handles it separately.

Basements are offered only in North America. The basement row there carries
its own lower ceiling height, which replaces the regional ceiling.

## Ceiling heights

`standard` is the default. `high` is the "high ceilings" choice for period
stock, vaulted rooms or upgraded new builds. `minimum` is shown for context
only. Don't use it as a default.

| Region | Standard | High | Minimum (legal/standard) | Kind | Sources | Notes |
|---|---|---|---|---|---|---|
| north_america | 8 ft (new builds 9 ft) | 10 ft | 7 ft | typical (guide); minimum = code | S3, S6, S22, S7, S17 | 8 ft is the bulk of existing stock; 9 ft is now common in new builds (S6, S22); 10 ft as high (S3, S6). IRC minimum 7 ft (S7); Canada 2.1 m minimum (S17). |
| uk | 2.4 m | 3.0 m | 2.3 m | typical (forum/guide); minimum = NDSS | S21, S18, S22 | Building Regs set no room height (S21). NDSS: 2.3 m over 75% of GIA (S18). 2.4 m typical (S21). Victorian/Edwardian 3.0-3.7 m (S22). |
| australia | 2.4 m | 2.7 m | 2.4 m | minimum = NCC and builder standard; high = common upgrade | S31, S33, S34, S35, S32 | NCC 2.4 m habitable, 2.1 m kitchens/wet areas/corridors (S31). 2.55-2.7 m are common upgrades (S34, S35); NSW apartments need 2.7 m (S32). No source read for Federation/Queenslander heights. |
| germany | 2.5 m | 3.3 m | 2.4 m | typical (guide); minimum = Landesbauordnung | S43, S40, S42 | Land minimums 2.30-2.50 m, mostly 2.40 m (S43; Berlin text S42 says 2.40). New builds 2.30-2.50 m (S40, S43). Pre-1918 Altbau 3.30-4.50 m (S43). |
| france | 2.5 m | 3.0 m | 2.2 m | typical (guide + measured); minimum = decree | S48, S46, S45 | New builds ~2.50 m (S48). Qualitel measured apartments at 2.67 m pre-1945 vs 2.40 m post-2009 (S46). Haussmann-era often above 3 m (S48). Decency minimum 2.20 m (S45). |
| spain | 2.5 m | 3.5 m | 2.5 m | minimum = regional decrees (new builds sit at it); high = guide | S53, S54, S55 | 2.50 m minimum in rooms, 2.20 m in bathrooms/kitchens/corridors (S53, S54); new builds typically finish at ~2.5 m (S55). Historic city flats ~3.5 m or more (S55). |
| italy | 2.7 m | 3.3 m | 2.7 m | minimum = D.M. 1975 (also typical new build); high = INFERRED | S57, S59, S58 | 2.70 m legal minimum in habitable rooms, 2.40 m in corridors/bathrooms (S57); new builds average 2.70-3.00 m (S59). Pre-1970s stock 'notably higher' (S59) but no figure found: 3.3 m is INFERRED from DE/FR/ES period stock. Salva Casa 2024 allows 2.40 m in some cases (S58). |
| eu | 2.5 m | 3.3 m | 2.4 m | INFERRED composite (median of DE/FR/ES/IT) | S43, S48, S53, S57, S59 | Median of standard 2.5/2.5/2.5/2.7 and high 3.3/3.0/3.5/3.3. |

Notes on the ceiling figures:

- North America's `standard` is 8 ft, not 9 ft, on purpose. Most repaint work is on existing homes, and 9 ft became normal only in newer builds (S6, S22). Bob Vila (S6) gives an 8 ft code minimum, which conflicts with the IRC's 7 ft (S7), so we don't use that claim.
- In Germany, Mietpreise.info (S43) gives Berlin's minimum as 2.50 m. The Berlin text we read (S42) says 2.40 m, so we use 2.40.
- France's `standard` of 2.5 m sits between Qualitel's measured apartment averages of 2.67 m (pre-1945) and 2.40 m (post-2009) (S46). It also matches SeLoger's figure for new builds (S48).
- Italy's `high` of 3.3 m is INFERRED. The Italian source (S59) says older stock is notably higher but gives no number.

## Room tables

### North America (US and Canada), feet

| Room | Small | Medium (typical) | Large | Kind (S / M / L) | Sources | Notes |
|---|---|---|---|---|---|---|
| living | 13 x 10 (130 sq ft) | 18 x 13 (234 sq ft) | 20 x 15 (300 sq ft) | guide / INFERRED / guide | S4, S3 | Small = Punch small 10x13. Medium sits between Punch medium 12x18 and DesignFiles average 15x20 (INFERRED). Large = Punch large 15x20+ (DesignFiles calls 15x20 average for detached homes). |
| kitchen | 10 x 8 (80 sq ft) | 14 x 12 (168 sq ft) | 20 x 15 (300 sq ft) | guide / guide / guide | S3 | Areas from DesignFiles (small 70-100, average 150-200, large 250-350 sq ft); length x width split is ours. |
| dining | 11 x 11 (121 sq ft) | 14 x 12 (168 sq ft) | 16 x 12 (192 sq ft) | guide / guide / guide | S4, S3 | Punch small 11x11, medium 11x14, large 12x16; DesignFiles average 12x15 supports the medium. |
| primary_bedroom | 12 x 12 (144 sq ft) | 16 x 14 (224 sq ft) | 20 x 16 (320 sq ft) | INFERRED / guide / guide | S3, S4 | Medium = DesignFiles typical 14x16. Large = 320 sq ft inside DesignFiles 200-300 (up to 400 luxury). Small INFERRED: above the average secondary bedroom (132 sq ft) and Punch's king-bed minimum. |
| bedroom | 10 x 10 (100 sq ft) | 12 x 11 (132 sq ft) | 12 x 12 (144 sq ft) | guide / guide / guide | S3, S11 | DesignFiles small 100-120 and average 11x12; spare bedrooms 10x10 to 12x12 (S11). |
| bathroom | 7 x 5 (35 sq ft) | 8 x 6 (48 sq ft) | 12 x 10 (120 sq ft) | INFERRED / guide / guide | S3 | Medium 48 sq ft within DesignFiles full bath 40-50; large 120 sq ft within primary bath 100-200; small INFERRED just below the full-bath range. |
| ensuite | 5 x 4 (20 sq ft) | 6 x 5 (30 sq ft) | 8 x 5 (40 sq ft) | guide / guide / INFERRED | S3 | Powder room / half bath: DesignFiles 18-32 sq ft (small 20, medium 30). Large = a 3/4 bath at the low end of a full bath (INFERRED). |
| hallway | 10 x 3 (30 sq ft) | 15 x 4 (60 sq ft) | 20 x 4 (80 sq ft) | INFERRED / INFERRED / INFERRED | S12, S7 | Widths are sourced (36 in code minimum; 42-48 in comfortable, S12). Lengths are our assumption: no source gives hallway lengths. |
| stairwell | 11 x 3 (33 sq ft) | 14 x 3 (42 sq ft) | 16 x 4 (64 sq ft) | guide / guide / INFERRED | S8, S16 | Footprint of the stair space. Small = run only at 8 ft walls (10'10"); medium = 14 ft incl. 3 ft landing (S8); large = 15'6" at 9 ft walls (S8) with a 4 ft width (INFERRED). 3 ft = IRC minimum clear width (S16). Wall height is handled separately (usually two storeys). |
| office | 10 x 8 (80 sq ft) | 12 x 10 (120 sq ft) | 15 x 10 (150 sq ft) | guide / guide / guide | S10, S11, S15 | Compact 70-100 sq ft, typical 10x12, larger 10x15 (S10); 10x10-12x12 spare rooms (S11); 97-194 sq ft (S15). |
| laundry | 6 x 6 (36 sq ft) | 9 x 6 (54 sq ft) | 11 x 9 (99 sq ft) | guide / guide / guide | S9 | Block Renovation small 6x6, average 6x9, large 9x11. |
| basement | 16 x 12 (192 sq ft) | 20 x 15 (300 sq ft) | 30 x 20 (600 sq ft) | INFERRED / INFERRED / INFERRED | S14, S13 | Basement rec/family room. INFERRED: medium extends ArchitectureLab's 15x15 typical family room; large bounded by a typical ~1,000 sq ft full basement (S13). Basement ceiling: standard 7.5 ft, high 8 ft (S13, S7; guide; standard INFERRED (midpoint)). |

### United Kingdom, metres

| Room | Small | Medium (typical) | Large | Kind (S / M / L) | Sources | Notes |
|---|---|---|---|---|---|---|
| living | 3.8 x 3.2 (12.2 m²) | 4.8 x 3.6 (17.3 m²) | 6.0 x 4.2 (25.2 m²) | INFERRED / measured / measured | S19, S20 | Medium 17.3 m2 ~ 17.1 m2 average for 2010s homes; large 25.2 m2 ~ 1970s average 24.9 m2 (LABC Warranty listing analysis). Small INFERRED (~12 m2, smaller terrace front rooms). |
| kitchen | 3.0 x 2.4 (7.2 m²) | 4.0 x 3.4 (13.6 m²) | 4.8 x 4.2 (20.2 m²) | INFERRED / measured / recommended | S19, S26 | Medium 13.6 m2 ~ 13.44 m2 measured average; large = Homebuilding's island kitchen 4.8x4.2; small galley INFERRED. |
| dining | 3.0 x 3.0 (9.0 m²) | 3.6 x 3.2 (11.5 m²) | 4.5 x 4.0 (18.0 m²) | recommended / INFERRED / recommended | S26 | Homebuilding: six-seat table needs at least 3x3 m, recommended 4.5x4 m. Medium INFERRED between. |
| primary_bedroom | 4.2 x 2.8 (11.8 m²) | 4.0 x 3.4 (13.6 m²) | 4.5 x 4.5 (20.2 m²) | minimum / measured / recommended | S18, S19, S26 | Small = NDSS main double 11.5 m2 at 2.75 m wide. Medium 13.6 m2 ~ 13.4 m2 measured average. Large = Homebuilding 4.5x4.5 m. |
| bedroom | 3.5 x 2.2 (7.7 m²) | 3.4 x 3.0 (10.2 m²) | 4.0 x 3.0 (12.0 m²) | minimum / guide / recommended | S18, S26 | Small = NDSS single 7.5 m2, 2.15 m wide. Medium = Homebuilding guest bedroom 3.4x3. Large = Homebuilding child's room upper 4x3 (~ NDSS double 11.5 m2). |
| bathroom | 2.1 x 1.7 (3.6 m²) | 2.4 x 1.8 (4.3 m²) | 3.0 x 2.5 (7.5 m²) | guide / guide / guide | S23, S24, S26 | Medium = standard 2.4x1.8 (S23); Victorian Plumbing's own survey suggests a bit larger (2.7x2.4). Small ~3.5 m2 suggested minimum full bathroom (S23). Large = 2.5x3.0 (S23), family bath 2.4x3-3x3 (S26). |
| ensuite | 1.4 x 0.8 (1.1 m²) | 2.0 x 1.5 (3.0 m²) | 2.2 x 2.0 (4.4 m²) | guide / guide / recommended | S25, S23, S24, S26 | Small = comfortable minimum downstairs WC 800x1400 (S25). Medium = typical en-suite 1.5x2.0 (S23; S24 says ~1.7x1.7). Large = Homebuilding ideal en-suite 2x2.2. |
| hallway | 3.0 x 0.9 (2.7 m²) | 4.0 x 1.0 (4.0 m²) | 5.0 x 1.8 (9.0 m²) | INFERRED / INFERRED / INFERRED | S29, S2 | Width anchored to Lifetime Homes 900 mm minimum (S29); large width from Plan7's comfortable foyer (S2). Lengths INFERRED. |
| stairwell | 2.7 x 0.9 (2.4 m²) | 3.6 x 0.9 (3.2 m²) | 4.5 x 1.0 (4.5 m²) | guide / INFERRED / INFERRED | S27 | Small derived from Part K geometry in S27: 13 risers, 12 goings x 220 mm min = 2.64 m, 860 mm standard width. Medium/large add comfortable goings and landings (INFERRED). |
| office | 3.5 x 2.2 (7.7 m²) | 3.6 x 2.6 (9.4 m²) | 4.0 x 3.0 (12.0 m²) | minimum / recommended / recommended | S18, S26 | UK home offices are usually the box room/single bedroom: small = NDSS single minimum; medium/large = Homebuilding child's-bedroom range 3.6x2.6 to 4x3. |
| laundry | 1.9 x 1.5 (2.8 m²) | 2.4 x 1.8 (4.3 m²) | 3.0 x 2.4 (7.2 m²) | guide / recommended / recommended | S28, S26 | Small ~2.8 m2 compact utility (S28, our dimensions). Medium = Homebuilding minimum utility room 1.8x2.4 (~ Which? optimal 4.6 m2). Large = Homebuilding recommended 2.4x3. |
| basement | not offered | not offered | not offered | n/a | S30 | Basements are not a normal feature of British homes (standard in the US, not here); a cellar can be quoted as a custom room. |

### Australia (New Zealand uses this table), metres

| Room | Small | Medium (typical) | Large | Kind (S / M / L) | Sources | Notes |
|---|---|---|---|---|---|---|
| living | 4.0 x 3.6 (14.4 m²) | 5.5 x 4.5 (24.8 m²) | 7.0 x 5.0 (35.0 m²) | minimum / INFERRED / guide | S32, S1 | Small uses NSW ADG minimum living widths (3.6/4.0 m) with an INFERRED length. Medium INFERRED (~25 m2). Large = Plan7 30-40 m2 living. |
| kitchen | 3.0 x 2.4 (7.2 m²) | 4.0 x 3.0 (12.0 m²) | 5.0 x 4.0 (20.0 m²) | INFERRED / guide / INFERRED | S1, S26 | Medium 12 m2 inside Plan7 10-15 m2. Small galley and large island kitchen INFERRED (large cf. S26 island kitchen). |
| dining | 3.0 x 2.8 (8.4 m²) | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.0 (20.0 m²) | guide / guide / guide | S1 | Plan7: table for 4 needs 8-10 m2, for 6-8 needs 12-16 m2; dining rooms 20-30 m2. |
| primary_bedroom | 3.4 x 3.0 (10.2 m²) | 4.0 x 3.5 (14.0 m²) | 4.5 x 4.0 (18.0 m²) | minimum / guide / guide | S32, S36 | Small = ADG master 10 m2 with 3 m minimum dimension. Medium = 3.5x4 m typical of the last 30 years (S36). Large = king-bed room 4x4.5 (S36). |
| bedroom | 3.0 x 3.0 (9.0 m²) | 3.3 x 3.0 (9.9 m²) | 4.0 x 3.0 (12.0 m²) | minimum / INFERRED / guide | S32, S1 | Small = ADG other bedrooms 9 m2, 3 m min. Medium INFERRED. Large = 12 m2, Plan7 children's room lower bound. |
| bathroom | 2.0 x 2.0 (4.0 m²) | 3.0 x 2.0 (6.0 m²) | 3.5 x 2.7 (9.5 m²) | guide / guide / INFERRED | S38, S37 | Small ~ compliant three-piece from ~3.96 m2 (S38). Medium = average 3x2 (S37; S38 gives 2.4x2.4). Large INFERRED between S38's 2.7x2.7+ and S37's 4x5. |
| ensuite | 1.5 x 1.2 (1.8 m²) | 2.0 x 1.8 (3.6 m²) | 2.7 x 2.0 (5.4 m²) | guide / guide / INFERRED | S38, S37 | Small = powder room 1.2x1.5 (S38). Medium = ensuite 1.8x2.0 (S38; S37 ~1.2x2.1). Large INFERRED. |
| hallway | 3.0 x 0.9 (2.7 m²) | 5.0 x 1.0 (5.0 m²) | 7.0 x 1.2 (8.4 m²) | INFERRED / INFERRED / INFERRED | S12, S2 | No Australian source read. Widths borrowed from US/foyer guides; lengths INFERRED (single-storey AU plans tend to have long halls). |
| stairwell | 3.0 x 0.9 (2.7 m²) | 3.6 x 1.0 (3.6 m²) | 4.5 x 1.2 (5.4 m²) | INFERRED / INFERRED / INFERRED | S27, S44, S31 | No AU stair geometry source read. INFERRED from UK/DE stair geometry (S27, S44) for a ~2.7 m floor-to-floor; NCC stair headroom 2.0 m (S31). |
| office | 3.0 x 3.0 (9.0 m²) | 3.6 x 3.0 (10.8 m²) | 4.5 x 4.0 (18.0 m²) | guide / INFERRED / guide | S15, S32 | ArchitectureLab 9-18 m2 (small/large ends); 9 m2 also equals the ADG secondary-bedroom minimum. Medium INFERRED. |
| laundry | 1.8 x 1.2 (2.2 m²) | 2.7 x 1.8 (4.9 m²) | 3.0 x 2.4 (7.2 m²) | INFERRED / INFERRED / INFERRED | S9, S26 | No AU laundry dimensions found. INFERRED: medium = US average 6x9 ft converted (S9); large = UK recommended utility (S26). |
| basement | not offered | not offered | not offered | n/a | S39 | Australian houses are overwhelmingly slab-on-ground without basements; a basement can be quoted as a custom room. |

### Germany, metres

| Room | Small | Medium (typical) | Large | Kind (S / M / L) | Sources | Notes |
|---|---|---|---|---|---|---|
| living | 4.5 x 3.6 (16.2 m²) | 5.5 x 4.5 (24.8 m²) | 7.0 x 5.0 (35.0 m²) | INFERRED / guide / guide | S41, S40 | Medium ~25 m2 mid-range of 20-30 (S41). Large 35 m2 in S40's 30-40 m2 living+dining. Small INFERRED (~16 m2, flats). |
| kitchen | 3.4 x 3.0 (10.2 m²) | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.0 (20.0 m²) | recommended / guide / guide | S40, S41 | Small = S40 minimum ~10 m2; medium 14 m2 mid of S41 10-20; large 20 m2 (S41 upper; S40 +5-10 with island). |
| dining | 3.0 x 2.8 (8.4 m²) | 3.6 x 3.0 (10.8 m²) | 4.5 x 3.5 (15.8 m²) | guide / guide / guide | S1, S40 | Small = Plan7 table for 4 (8-10 m2); medium ~11 m2 within S40's 7-12; large ~16 m2 Plan7 table for 6-8. |
| primary_bedroom | 4.0 x 3.0 (12.0 m²) | 4.5 x 3.5 (15.8 m²) | 5.0 x 4.0 (20.0 m²) | guide / guide / guide | S40, S41 | 12 m2 (S40 without dressing area, S41 lower); ~16 m2 (S41 upper); 20 m2 (S40 with dressing area). |
| bedroom | 3.4 x 3.0 (10.2 m²) | 4.0 x 3.2 (12.8 m²) | 4.5 x 3.5 (15.8 m²) | guide / guide / recommended | S40, S41 | Small ~10 m2 (S40 calls it tight but it is common); medium ~13 m2 (S41 12-15); large ~16 m2 (S40 15-20 recommended). |
| bathroom | 2.5 x 2.0 (5.0 m²) | 3.2 x 2.5 (8.0 m²) | 4.0 x 3.0 (12.0 m²) | INFERRED / guide / guide | S40, S41 | Medium 8 m2 (S40 ~8, S41 lower); large 12 m2 (S41 upper). Small INFERRED (older flats). |
| ensuite | 1.5 x 1.0 (1.5 m²) | 2.0 x 1.5 (3.0 m²) | 2.5 x 2.0 (5.0 m²) | INFERRED / guide / INFERRED | S40 | Gaeste-WC ~3 m2 (S40). Smaller WC and a shower-room ensuite INFERRED. |
| hallway | 3.0 x 1.2 (3.6 m²) | 4.0 x 1.3 (5.2 m²) | 4.0 x 2.0 (8.0 m²) | INFERRED / guide / guide | S40 | Medium ~5 m2 = S40 minimum entrance hall; large 8 m2 = 5 + 3 for wardrobe (S40). Small INFERRED (flat corridor). |
| stairwell | 3.2 x 0.9 (2.9 m²) | 4.0 x 1.0 (4.0 m²) | 5.0 x 1.2 (6.0 m²) | INFERRED / guide / INFERRED | S44 | Medium derived from S44 (DIN 18065): 14-16 steps for 2.60-2.90 m, ~27 cm treads -> ~3.8-4.0 m run, 1 m comfortable width. Small (steeper, 0.8 m min width) and large INFERRED. |
| office | 3.0 x 2.6 (7.8 m²) | 3.4 x 3.0 (10.2 m²) | 4.0 x 3.0 (12.0 m²) | guide / guide / guide | S40, S41 | 8 m2 (S40 lower), ~10 m2 (S40 upper), 12 m2 (S41 upper). |
| laundry | 2.0 x 1.5 (3.0 m²) | 2.5 x 2.0 (5.0 m²) | 4.0 x 2.5 (10.0 m²) | guide / guide / guide | S40 | Hauswirtschaftsraum 3-5 m2, up to 10 m2 with heating/plant (S40). |
| basement | not offered | not offered | not offered | n/a | S40 | Keller are common but are storage/plant space, not counted as living area; quote a finished Hobbyraum as a custom room. |

### France, metres

| Room | Small | Medium (typical) | Large | Kind (S / M / L) | Sources | Notes |
|---|---|---|---|---|---|---|
| living | 4.0 x 3.6 (14.4 m²) | 5.0 x 4.2 (21.0 m²) | 6.5 x 5.0 (32.5 m²) | INFERRED / measured / guide | S47, S49, S1 | Medium 21 m2 = Qualitel measured apartment average (S47), ~ the 20 m2 recommendation (S49). Large ~32 m2 Plan7 30-40. Small INFERRED. |
| kitchen | 3.0 x 2.3 (6.9 m²) | 3.5 x 3.0 (10.5 m²) | 4.5 x 3.5 (15.8 m²) | recommended / INFERRED / guide | S49, S50, S1 | Small ~7 m2 recommended minimum (S49, S50). Medium INFERRED (~10.5 m2, Plan7 10-15 lower half). Large ~16 m2 Plan7 upper. |
| dining | 3.0 x 2.8 (8.4 m²) | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.0 (20.0 m²) | guide / guide / guide | S1 | Plan7 table-for-4, table-for-6-8 and dining-room figures. |
| primary_bedroom | 4.0 x 3.0 (12.0 m²) | 4.2 x 3.4 (14.3 m²) | 5.0 x 4.0 (20.0 m²) | recommended / measured / guide | S49, S50, S46, S1 | Small 12 m2 recommended for two (S50; S49 12-14). Medium ~14.3 m2 ~ Qualitel pre-1945 house bedrooms 14.5 m2 (S46). Large 20 m2 Plan7 upper. |
| bedroom | 3.0 x 3.0 (9.0 m²) | 3.5 x 3.2 (11.2 m²) | 4.0 x 3.5 (14.0 m²) | minimum / measured / measured | S45, S49, S46, S47 | Small 9 m2 (decency main-room minimum S45; 9 m2 for one S49). Medium ~11.2 m2 = Qualitel post-2009 houses / apartments (S46); stock-wide average 12.3 m2 (S47). Large ~14 m2 = pre-1945 houses 14.5 (S46). |
| bathroom | 2.0 x 1.7 (3.4 m²) | 2.2 x 1.8 (4.0 m²) | 3.0 x 2.5 (7.5 m²) | INFERRED / recommended / INFERRED | S49, S50 | Medium ~4 m2 = recommended complete bathroom (S49, S50). Small and large INFERRED. |
| ensuite | 1.6 x 1.2 (1.9 m²) | 2.0 x 1.5 (3.0 m²) | 2.0 x 2.0 (4.0 m²) | guide / guide / guide | S1 | WC / salle d'eau: Plan7 guest WC 2-4 m2. |
| hallway | 2.0 x 1.2 (2.4 m²) | 3.0 x 1.8 (5.4 m²) | 4.0 x 2.5 (10.0 m²) | guide / guide / guide | S2 | Plan7 entrance/hallway: minimum functional, comfortable, spacious (lower ends). |
| stairwell | 3.2 x 0.9 (2.9 m²) | 4.0 x 1.0 (4.0 m²) | 5.0 x 1.2 (6.0 m²) | INFERRED / INFERRED / INFERRED | S44 | No French source read; geometry copied from the German DIN-based figures (S44). Many French homes are flats with no internal stair. |
| office | 3.0 x 3.0 (9.0 m²) | 3.4 x 3.0 (10.2 m²) | 4.0 x 3.0 (12.0 m²) | minimum / INFERRED / INFERRED | S45, S49, S40 | Small = 9 m2 single-room minimum (S45/S49) used as proxy. Medium/large INFERRED from the German study-room guide (S40). |
| laundry | 2.0 x 1.5 (3.0 m²) | 2.5 x 2.0 (5.0 m²) | 3.0 x 2.5 (7.5 m²) | INFERRED / INFERRED / INFERRED | S40 | No French source read; INFERRED from the German utility-room guide (S40). |
| basement | not offered | not offered | not offered | n/a | S51 | Caves and sous-sols are storage, excluded from habitable surface; quote a converted basement as a custom room. |

### Spain, metres

| Room | Small | Medium (typical) | Large | Kind (S / M / L) | Sources | Notes |
|---|---|---|---|---|---|---|
| living | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.0 (20.0 m²) | 6.5 x 5.0 (32.5 m²) | INFERRED / INFERRED / guide | S52, S1 | No Spanish living-room average found. Small/medium INFERRED (14 and 20 m2; above Zaragoza's combined-room minimums in S52). Large Plan7. |
| kitchen | 2.5 x 2.0 (5.0 m²) | 3.5 x 2.8 (9.8 m²) | 4.5 x 3.5 (15.8 m²) | minimum / INFERRED / guide | S52, S1 | Small 5 m2 = Madrid/Valencia minimum (S52). Medium INFERRED ~10 m2. Large Plan7 upper. |
| dining | 3.0 x 2.7 (8.1 m²) | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.0 (20.0 m²) | minimum / minimum / minimum | S52 | Small ~8 m2 = Valencia comedor minimum. Medium/large = Zaragoza 14-20 m2 range (S52). |
| primary_bedroom | 3.4 x 3.0 (10.2 m²) | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.0 (20.0 m²) | minimum / guide / guide | S52, S56 | Small ~10 m2 = Madrid/Zaragoza double minimum (Valencia: 8). Medium 14 m2 and large 20 m2 from Planner 5D (S56). |
| bedroom | 3.0 x 2.0 (6.0 m²) | 3.5 x 3.0 (10.5 m²) | 4.0 x 3.0 (12.0 m²) | minimum / guide / guide | S52, S56 | Small 6 m2 = single-bedroom minimum (S52). Medium 10.5 m2 and large 12 m2 (S56). |
| bathroom | 2.0 x 1.5 (3.0 m²) | 2.5 x 1.8 (4.5 m²) | 3.0 x 2.5 (7.5 m²) | minimum / INFERRED / INFERRED | S52 | Small 3 m2 = Valencia minimum. Medium/large INFERRED. |
| ensuite | 1.5 x 1.0 (1.5 m²) | 2.0 x 1.5 (3.0 m²) | 2.5 x 1.8 (4.5 m²) | minimum / guide / INFERRED | S52, S1 | Small 1.5 m2 = aseo minimum (S52). Medium = Plan7 guest WC 3 m2. Large INFERRED. |
| hallway | 2.0 x 1.2 (2.4 m²) | 3.0 x 1.8 (5.4 m²) | 4.0 x 2.5 (10.0 m²) | guide / guide / guide | S2, S52, S54 | Plan7 figures (S2). Corridor minimum width 0.85 m (Zaragoza, S52) / 1.00 m (Catalonia, S54). |
| stairwell | 3.2 x 0.9 (2.9 m²) | 4.0 x 1.0 (4.0 m²) | 5.0 x 1.2 (6.0 m²) | minimum / INFERRED / INFERRED | S53, S44 | Width 0.9 m = stair minimum (S53). Lengths INFERRED from DIN geometry (S44). Most Spanish homes are flats with no internal stair. |
| office | 3.0 x 2.0 (6.0 m²) | 3.5 x 3.0 (10.5 m²) | 4.0 x 3.0 (12.0 m²) | minimum / guide / guide | S52, S56 | Proxy: a despacho is usually a single bedroom (S52 minimum, S56 medium sizes). |
| laundry | 1.5 x 1.2 (1.8 m²) | 2.0 x 1.5 (3.0 m²) | 2.5 x 2.0 (5.0 m²) | INFERRED / INFERRED / INFERRED | S40 | Lavadero/galeria: no Spanish source read; INFERRED, scaled down from S40. |
| basement | not offered | not offered | not offered | n/a | S53, S52 | Most homes are flats; sotanos are garages/storerooms rather than living rooms. Weakly sourced: the habitability rules read cover habitable rooms only. |

### Italy, metres

| Room | Small | Medium (typical) | Large | Kind (S / M / L) | Sources | Notes |
|---|---|---|---|---|---|---|
| living | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.0 (20.0 m²) | 6.5 x 5.0 (32.5 m²) | minimum / INFERRED / guide | S57, S1 | Small 14 m2 = soggiorno minimum (S57). Medium INFERRED (20 m2). Large Plan7. |
| kitchen | 2.5 x 2.0 (5.0 m²) | 3.4 x 2.7 (9.2 m²) | 4.5 x 3.5 (15.8 m²) | minimum / minimum / guide | S58, S1 | Small 5 m2 = cooking-corner range 4-9 (S58). Medium ~9.2 m2 = habitable-kitchen minimum 9 (S58). Large Plan7 upper. |
| dining | 3.0 x 2.8 (8.4 m²) | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.0 (20.0 m²) | guide / guide / guide | S1 | Plan7 figures. |
| primary_bedroom | 4.0 x 3.5 (14.0 m²) | 4.5 x 3.6 (16.2 m²) | 5.0 x 4.0 (20.0 m²) | minimum / INFERRED / guide | S57, S1 | Small 14 m2 = double-bedroom legal minimum (S57). Medium INFERRED (~16 m2). Large Plan7 20 m2. |
| bedroom | 3.0 x 3.0 (9.0 m²) | 3.6 x 3.0 (10.8 m²) | 4.0 x 3.5 (14.0 m²) | minimum / INFERRED / minimum | S57 | Small 9 m2 single minimum; large 14 m2 double minimum (second bedrooms are often doubles). Medium INFERRED. |
| bathroom | 2.0 x 1.5 (3.0 m²) | 2.5 x 2.0 (5.0 m²) | 3.5 x 2.5 (8.8 m²) | INFERRED / INFERRED / guide | S58, S1 | National law leaves bathroom size to municipal rules (S58). Small/medium INFERRED; large ~8.75 m2 Plan7 full bathroom 8-10. |
| ensuite | 1.6 x 1.2 (1.9 m²) | 2.0 x 1.5 (3.0 m²) | 2.0 x 2.0 (4.0 m²) | guide / guide / guide | S1 | Plan7 guest WC 2-4 m2. |
| hallway | 2.0 x 1.2 (2.4 m²) | 3.0 x 1.8 (5.4 m²) | 4.0 x 2.5 (10.0 m²) | guide / guide / guide | S2 | Plan7 entrance/hallway figures. |
| stairwell | 3.5 x 0.9 (3.1 m²) | 4.3 x 1.0 (4.3 m²) | 5.3 x 1.2 (6.4 m²) | INFERRED / INFERRED / INFERRED | S44, S57 | INFERRED: DIN geometry (S44) stretched for Italy's taller storey (2.70 m clear minimum, S57 -> ~3.0 m floor-to-floor). |
| office | 3.0 x 3.0 (9.0 m²) | 3.6 x 3.0 (10.8 m²) | 4.0 x 3.5 (14.0 m²) | minimum / INFERRED / minimum | S57 | Proxy: single-room 9 m2 and double-room 14 m2 minimums (S57). Medium INFERRED. |
| laundry | 2.0 x 1.5 (3.0 m²) | 2.5 x 2.0 (5.0 m²) | 3.0 x 2.5 (7.5 m²) | INFERRED / INFERRED / INFERRED | S40 | Lavanderia: no Italian source read; INFERRED from S40. |
| basement | not offered | not offered | not offered | n/a | S57 | Cantine are storage, outside the habitable-room rules; quote a converted taverna as a custom room. Weakly sourced: S57 only defines habitable rooms. |

### EU fallback (continental Europe), metres

| Room | Small | Medium (typical) | Large | Kind (S / M / L) | Sources | Notes |
|---|---|---|---|---|---|---|
| living | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.1 (20.5 m²) | 6.5 x 5.0 (32.5 m²) | INFERRED / INFERRED / INFERRED | S41, S40, S47, S49, S1, S52, S57 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| kitchen | 2.8 x 2.1 (5.9 m²) | 3.5 x 2.9 (10.2 m²) | 4.5 x 3.5 (15.8 m²) | INFERRED / INFERRED / INFERRED | S40, S41, S49, S50, S1, S52, S58 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| dining | 3.0 x 2.8 (8.4 m²) | 4.0 x 3.5 (14.0 m²) | 5.0 x 4.0 (20.0 m²) | INFERRED / INFERRED / INFERRED | S1, S40, S52 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| primary_bedroom | 4.0 x 3.0 (12.0 m²) | 4.3 x 3.5 (15.0 m²) | 5.0 x 4.0 (20.0 m²) | INFERRED / INFERRED / INFERRED | S40, S41, S49, S50, S46, S1, S52, S56, S57 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| bedroom | 3.0 x 3.0 (9.0 m²) | 3.5 x 3.1 (10.8 m²) | 4.0 x 3.5 (14.0 m²) | INFERRED / INFERRED / INFERRED | S40, S41, S45, S49, S46, S47, S52, S56, S57 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| bathroom | 2.0 x 1.6 (3.2 m²) | 2.5 x 1.9 (4.8 m²) | 3.2 x 2.5 (8.0 m²) | INFERRED / INFERRED / INFERRED | S40, S41, S49, S50, S52, S58, S1 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| ensuite | 1.6 x 1.1 (1.8 m²) | 2.0 x 1.5 (3.0 m²) | 2.2 x 2.0 (4.4 m²) | INFERRED / INFERRED / INFERRED | S40, S1, S52 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| hallway | 2.0 x 1.2 (2.4 m²) | 3.0 x 1.8 (5.4 m²) | 4.0 x 2.5 (10.0 m²) | INFERRED / INFERRED / INFERRED | S40, S2, S52, S54 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| stairwell | 3.2 x 0.9 (2.9 m²) | 4.0 x 1.0 (4.0 m²) | 5.0 x 1.2 (6.0 m²) | INFERRED / INFERRED / INFERRED | S44, S53, S57 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| office | 3.0 x 2.8 (8.4 m²) | 3.5 x 3.0 (10.5 m²) | 4.0 x 3.0 (12.0 m²) | INFERRED / INFERRED / INFERRED | S40, S41, S45, S49, S52, S56, S57 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| laundry | 2.0 x 1.5 (3.0 m²) | 2.5 x 2.0 (5.0 m²) | 3.0 x 2.5 (7.5 m²) | INFERRED / INFERRED / INFERRED | S40 | INFERRED composite: per-dimension median of the Germany, France, Spain and Italy cells. |
| basement | not offered | not offered | not offered | n/a | S40, S51 | No continental country in this set treats basements as living rooms; cellars are storage (DE, FR). |

## Sources

All accessed 2026-10-03. "Supports" says which figures each source backs and what kind they are.

- **S1** — Room size guide: how big should rooms be?. Plan7Architect (no author named). <https://plan7architect.com/room-size-guide-how-big-should-rooms-be-ai2/?v=5435c69ed3bc>. Published: not stated. Accessed: 2026-10-03. Supports: guide/recommended: living 30-40 m2, dining 20-30 m2, dining table for 4 needs 8-10 m2 and for 6-8 needs 12-16 m2, kitchen 10-15 m2, main bedroom 12-20 m2, children's room 12-20 m2, full bathroom 8-10 m2, guest WC 2-4 m2, entrance/hall 5-10 m2. International (not country-specific); no ceiling heights.
- **S2** — How big should a hallway/foyer be? Size guide. Plan7Architect (no author named). <https://plan7architect.com/?p=74547>. Published: not stated. Accessed: 2026-10-03. Supports: guide: hallway/foyer minimum functional 1.2-1.5 m x 1.5-2 m; comfortable 1.8-2.2 m x 2.5-3 m; spacious 2.5-3.5 m x 3.5-5 m.
- **S3** — Average Room Sizes: Guide for Interior Designers & DIYers. DesignFiles blog, Kamala Nair. <https://blog.designfiles.co/average-room-size/>. Published: 2025-09-15. Accessed: 2026-10-03. Supports: guide (US): bedroom small 100-120 sq ft, average 11x12 ft; primary bedroom 14x16 ft (200-300 sq ft); living small 12x18, average 15x20, large 500+ sq ft; kitchen small 70-100, average 150-200, large 250-350 sq ft; dining small 10x12, average 12x15, large 300+ sq ft; half bath 18-32, full bath 40-50, primary bath 100-200 sq ft; ceilings 8 ft standard, 9 ft modern common, 10 ft enhanced.
- **S4** — Design Walkthroughs - Common Room Sizes and Square Footage. Punch! Software blog. <https://www.punchsoftware.com/blog/post/common-room-sizes>. Published: 2019-03-05. Accessed: 2026-10-03. Supports: guide (US): living small 10x13, medium 12x18, large 15x20+ ft; dining small 11x11, medium 11x14, large 12x16 ft; minimum bedroom footprints by bed size (king 9'6" x 11'6").
- **S5** — Bedrooms, Kitchens Consume Copious Space in New Homes. NAHB Eye on Housing, Paul Emrath. <https://eyeonhousing.org/2019/04/bedrooms-kitchens-consume-copious-space-in-new-homes/>. Published: 2019-04-11. Accessed: 2026-10-03. Supports: survey of builders (shares of floor area only, no per-room sizes): bedrooms 28% and kitchen 11.2% of finished area in new US homes. Context only; not used for a cell.
- **S6** — Standard ceiling height. Bob Vila, Andreana Lefton and Bob Vila. <https://www.bobvila.com/articles/standard-ceiling-height/>. Published: 2019-12-19 (updated). Accessed: 2026-10-03. Supports: guide (US): 8 ft in older homes, 9 ft as today's new-build standard, 10-12 ft for high ceilings. (Its claim of an 8 ft code minimum conflicts with the IRC 7 ft in S7; we do not use it.)
- **S7** — Hey, that's not a bedroom. EVstudio, Jeff Scott. <https://evstudio.com/hey-thats-not-a-bedroom/>. Published: 2022-05-20. Accessed: 2026-10-03. Supports: legal minimum (IRC R304/R305 as summarised): habitable room at least 70 sq ft and 7 ft in any horizontal direction; 7 ft ceiling.
- **S8** — Wood Straight Staircase Length. Ask the Builder, Tim Carter. <https://www.askthebuilder.com/wood-straight-staircase-length/>. Published: not stated. Accessed: 2026-10-03. Supports: guide/worked example (US): straight stair footprint about 14 ft long including a 3 ft landing for 8 ft walls (run alone 10'10"), and 15'6" for 9 ft walls (run 12'6"); assumes 7.5 in risers and 10 in treads.
- **S9** — Laundry room sizing guide: minimums, averages & more. Block Renovation, Cheyenne Howard. <https://www.blockrenovation.com/guides/laundry-room-sizing-guide-minimums-averages-more>. Published: 2026-04-23. Accessed: 2026-10-03. Supports: guide (US): small laundry 6x6 ft, average 6x9 ft (~54 sq ft), medium 9x9, large 9x11 ft.
- **S10** — What Is the Average Size of a Home Office?. Engineer Fix, Liam Cope. <https://engineerfix.com/what-is-the-average-size-of-a-home-office/>. Published: 2026-01-08. Accessed: 2026-10-03. Supports: guide (US): compact office 70-100 sq ft; typical dedicated office 120-150 sq ft, commonly 10x12 or 10x15 ft rooms.
- **S11** — How to Set Up a Home Office in a Spare Bedroom. FindOfficeFurniture.com. <https://www.findofficefurniture.com/plan/home-office-spare-bedroom.html>. Published: 2026-03-27. Accessed: 2026-10-03. Supports: guide (US): most spare bedrooms used as offices are 10x10 to 12x12 ft.
- **S12** — How Wide is a Hallway? Standard Width Requirements & Building Codes. Planner 5D blog, Kasia Chojecki. <https://planner5d.com/blog/how-wide-is-a-hallway/>. Published: 2025-10-22. Accessed: 2026-10-03. Supports: minimum + guide (US): code minimum hallway width 36 in; comfortable 42-48 in; spacious 48-60 in. No lengths.
- **S13** — Basement: Size, Functionality, Uses, Furniture and Renovation. ArchitectureLab, Anton Giuroiu. <https://dev.architecturelab.net/house/room/basement/>. Published: 2024-04-30 (updated 2024-05-15). Accessed: 2026-10-03. Supports: guide (US): typical basement about 1,001 sq ft (range ~495 to ~1,991); typical basement ceiling 7-8 ft. Read via the dev. mirror because the main domain returned 403.
- **S14** — Family Room: Size, Functionality, Uses, Furniture and Renovation. ArchitectureLab, Anton Giuroiu. <https://dev.architecturelab.net/house/room/family-room/>. Published: 2024-05-02 (updated 2024-05-15). Accessed: 2026-10-03. Supports: guide (US): typical family room about 215 sq ft, e.g. 15x15 ft.
- **S15** — Home Office: Size, Functionality, Uses, Furniture and Renovation. ArchitectureLab, Anton Giuroiu. <https://dev.architecturelab.net/house/room/home-office/>. Published: 2024-04-30 (updated 2024-05-15). Accessed: 2026-10-03. Supports: guide: typical home office 97-194 sq ft (9-18 m2).
- **S16** — Residential Stairs (IRC/CRC R311.7 handout). Placer County, California, Building Services. <https://www.placer.ca.gov/DocumentCenter/View/3303/Residential-Stairs-PDF>. Published: not stated. Accessed: 2026-10-03. Supports: legal minimum (code text reproduced): stairway clear width at least 36 in (R311.7.1); landing at top and bottom at least as wide as the flight (R311.7.6); headroom 6'8".
- **S17** — Vancouver Building By-law 2019, Division B, Part 9, Section 9.5 Design of Areas and Spaces. City of Vancouver / BC Publications (consolidated to 2021-01-01). <https://free.bcpublications.ca/civix/document/id/public/vbbl2019/1102895854>. Published: 2019 (consolidated 2021-01-01). Accessed: 2026-10-03. Supports: legal minimum (Canada, NBC-based): minimum ceiling height 2.1 m for living, dining, kitchen, bedrooms, bathrooms, halls; 2.0 m clear in basements; hallway width at least 860 mm. No minimum room areas in this edition.
- **S18** — Technical housing standards - nationally described space standard. UK Government (MHCLG/DCLG). <https://www.gov.uk/government/publications/technical-housing-standards-nationally-described-space-standard/technical-housing-standards-nationally-described-space-standard>. Published: 2015-03-27. Accessed: 2026-10-03. Supports: standard/minimum (England, where adopted locally): double bedroom at least 11.5 m2, main double at least 2.75 m wide, others 2.55 m; single bedroom at least 7.5 m2 and 2.15 m wide; floor-to-ceiling at least 2.3 m over 75% of GIA.
- **S19** — Shrinking homes: the average British house is 20% smaller than in the 1970s. Which?, Stefanie Garber (reporting LABC Warranty analysis of 10,000 Zoopla/Rightmove listings). <https://www.which.co.uk/news/article/shrinking-homes-the-average-british-house-20-smaller-than-in-1970s-ac9jJ2N0HtVF>. Published: 2018-04-14. Accessed: 2026-10-03. Supports: measured average (listing floor plans): living room 17.09 m2 in 2010s homes (24.89 in 1970s, 16.01 in 1930s); kitchen 13.44 m2 (peak 15.37 in 1960s); bedroom 13.4 m2 (2018).
- **S20** — UK Homes Are Getting Smaller. Hunters estate agents (reporting LABC Warranty study). <https://www.hunters.com/guides/forest-hill/uk-homes-are-getting-smaller/>. Published: 2019-12-12. Accessed: 2026-10-03. Supports: measured average: living room 17.09 m2 in the 2010s. Corroborates S19.
- **S21** — Is there a minimal ceiling height?. BuildHub forum (UK self-builders). <https://forum.buildhub.org.uk/topic/10710-is-there-a-minimal-ceiling-height>. Published: 2019-07. Accessed: 2026-10-03. Supports: practitioner forum: Building Regs set no room-height minimum (only stair headroom); NDSS 2.3 m; typical 2.4 m ground floor and 2.3 m upstairs.
- **S22** — Standard ceiling height. learnarchitecture.net (no author or date shown). <https://learnarchitecture.net/interior-design/35630-standard-ceiling-height.html>. Published: not stated. Accessed: 2026-10-03. Supports: guide: Victorian/early-1900s ceilings commonly 3.0-3.7 m (10-12 ft); US new-build ground floors 9 ft; IRC habitable minimum 7 ft; UK NDSS 2.3 m.
- **S23** — Bathroom Size Guide: Exact Dimensions, Layout Tips & Common Mistakes. Bathroom Mountain (UK retailer). <https://www.bathroommountain.co.uk/inspiration-and-advice/bathroom-size/>. Published: not stated. Accessed: 2026-10-03. Supports: guide (UK): standard bathroom 2.4 x 1.8 m (4.32 m2), national average ~4.4 m2; small 2-4 m2, large 7.5 m2+ (2.5 x 3.0 m+); en-suite 3-4 m2 (often 1.5 x 2.0 m); cloakroom 1.6-2.0 m2; no legal minimum, ~3.5 m2 suggested for a full bathroom.
- **S24** — Bathroom layouts: getting the most out of your bathroom size. Victorian Plumbing, Megan. <https://victorianplumbing.co.uk/bathroom-ideas-and-inspiration/bathroom-layouts-getting-the-most-out-of-your-bathroom-size>. Published: 2021-06-15. Accessed: 2026-10-03. Supports: retailer research (UK): average bathroom around 2.7 x 2.4 m; ensuite ~1.7 x 1.7 m; cloakroom ~1.2 x 1.2 m.
- **S25** — Toilet dimensions: do you have space for an extra bathroom?. Homebuilding & Renovating, Natasha Brinsmead. <https://www.homebuilding.co.uk/advice/toilet-dimensions>. Published: 2024-12-23 (updated). Accessed: 2026-10-03. Supports: guide (UK): cloakroom WC minimum 700 x 1,300 mm, more comfortable 800 x 1,400 mm, average 1,200 x 1,200 mm; toilet + basin ideally 900 x 1,800 mm.
- **S26** — Room sizes: how to get them right. Homebuilding & Renovating, Pete Tonks. <https://www.homebuilding.co.uk/advice/room-sizes-how-to-get-them-right>. Published: 2022-11-28 (updated). Accessed: 2026-10-03. Supports: recommended (UK, designer guide): kitchen with island 4.8 x 4.2 m; breakfast/dining for six min 3 x 3 m, recommended 4.5 x 4 m; master bedroom 4 x 4 to 4.5 x 4.5 m; guest bedroom 3.4 x 3 m; children's bedroom min 3 x 2, recommended 3.6 x 2.6 to 4 x 3 m; utility min 1.8 x 2.4, recommended 2.4 x 3 m; family bathroom 2.4 x 3 to 3 x 3 m; en suite min 1.8 x 1.6, ideal 2 x 2.2 m.
- **S27** — Staircase design: size, materials, regulations and more. Homebuilding & Renovating, Natasha Brinsmead. <https://www.homebuilding.co.uk/ideas/staircase-design-guide>. Published: 2022-09-08 (updated). Accessed: 2026-10-03. Supports: guide + Approved Document K (UK): typical floor-to-floor rise 2,600 mm = 13 risers of 200 mm; going at least 220 mm; max pitch 42 deg; standard flight width 860 mm (800-900 mm).
- **S28** — How to design a utility room. Which?. <https://www.which.co.uk/reviews/washing-machines/article/how-to-design-a-utility-room-aW4qJ5G4Upvw>. Published: 2025-09-19. Accessed: 2026-10-03. Supports: guide (UK): utility minimum ~1.4 m2 (cupboard), ~2.8 m2 compact room, ~4.6 m2+ optimal.
- **S29** — Lifetime Homes criterion 6: internal doorways and hallways. Centre for Accessible Environments (CAE). <https://cae.org.uk/our-services/housing-services/lifetime-homes/6-internal-doorways-and-hallways/>. Published: not stated. Accessed: 2026-10-03. Supports: standard/minimum (UK): hallway within a dwelling at least 900 mm wide, 750 mm at pinch points.
- **S30** — Can I add a basement to my home?. Build It (self-build.co.uk), Julian Owen. <https://www.self-build.co.uk/can-i-add-basement-my-home/>. Published: not stated. Accessed: 2026-10-03. Supports: guide: basements are a standard feature of new homes in countries such as the USA but not in Britain.
- **S31** — NCC 2022 Housing Provisions, Part 10.3 Room heights. Australian Building Codes Board. <https://abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-103-room-heights>. Published: 2022. Accessed: 2026-10-03. Supports: legal minimum (Australia): habitable rooms excluding kitchen 2.4 m; kitchen, corridor, bathroom, laundry 2.1 m; stairway 2.0 m above nosings.
- **S32** — Apartment Design Guide, Part 4: Designing the building. NSW Department of Planning (2015; file dated 2023-03). <https://www.planning.nsw.gov.au/sites/default/files/2023-03/apartment-design-guide-part-4-designing-the-building.pdf>. Published: 2015 (re-published 2023-03). Accessed: 2026-10-03. Supports: design criteria/minimum (NSW apartments): habitable ceiling 2.7 m, non-habitable 2.4 m; master bedroom at least 10 m2, other bedrooms 9 m2, minimum dimension 3 m (excl. wardrobe); living or living/dining width at least 3.6 m (studio/1-bed) and 4 m (2-3 bed). Read from the PDF text.
- **S33** — Guide to standard ceiling heights in Australia. Brighton Homes (builder). <https://www.brightonhomes.net.au/blogs/guide-standard-ceiling-heights-australia>. Published: not stated. Accessed: 2026-10-03. Supports: guide (AU): 2.4 m national baseline for habitable rooms; builder's own ranges at ~2.59 m.
- **S34** — Standard ceiling height Australia. G.J. Gardner Homes (builder). <https://www.gjgardner.com.au/learn/building-with-gj/standard-ceiling-height-australia/>. Published: not stated. Accessed: 2026-10-03. Supports: guide (AU): 2.4 m minimum habitable; 2.55 m low-cost upgrade; says the average has grown to 2.7 m.
- **S35** — A guide to standard ceiling heights in Australia. HouseSpec Builders. <https://housespec.com.au/a-guide-to-standard-ceiling-heights-in-australia>. Published: 2024-04-20. Accessed: 2026-10-03. Supports: guide (AU): 2.4 m minimum habitable; 2.55 or 2.7 m as upgrades.
- **S36** — How to choose the right mattress size for your bedroom. X-Press Magazine (Perth; no author). <https://xpressmag.com.au/how-to-choose-the-right-mattress-size-for-your-bedroom/>. Published: 2026-03-16. Accessed: 2026-10-03. Supports: guide (AU): master bedroom around 3.5 x 4 m is typical of homes built in the last 30 years; king bed wants at least 4 x 4.5 m.
- **S37** — Standard bathroom dimensions - what is the average bathroom size in Australia?. Habitus Living, Juliet Taylor. <https://www.habitusliving.com/series/standard-bathroom-size-dimensions-australia>. Published: not stated. Accessed: 2026-10-03. Supports: guide (AU): average bathroom 3 x 2 m; large 4 x 5 m+; minimum half-bath 1.4 x 0.95 m; regular ensuite ~1.2 x 2.1 m. Its stated areas do not match its dimensions; we use the dimensions only.
- **S38** — Standard bathroom sizes & dimensions. Blue Leaf Bathware & Tiles. <https://blueleafbath.com.au/blogs/blog-posts/standard-bathroom-sizes-dimensions>. Published: 2026-07-08. Accessed: 2026-10-03. Supports: guide (AU): powder room ~1.2 x 1.5 m; ensuite ~1.8 x 2.0 m; main bathroom ~2.4 x 2.4 m (5-6 m2); large 2.7 x 2.7 m+; compliant three-piece layouts from ~3.96 m2.
- **S39** — Basements in Australia, what to consider. OzBargain forum thread. <https://ozbargain.com.au/node/755439>. Published: not stated. Accessed: 2026-10-03. Supports: forum (weak): participants describe basements as uncommon in Australian houses (cost, no frost line, slab construction), somewhat more common in SA.
- **S40** — Grundriss planen: Richtwerte fuer Raumgroessen. fertighaus.de, Dr. Aviva Koeberlein. <https://www.fertighaus.de/ratgeber/hausbau/grundriss-planen-richtwerte-fuer-raumgroessen/>. Published: 2026-08-19 (updated). Accessed: 2026-10-03. Supports: guide (DE): living incl. dining 30-40 m2; kitchen at least 10 m2 (+5-10 with island); dining/cooking zone 7-12 m2; bedroom 12 m2, 16-20 with dressing area; children's room 15-20 m2 (10 too small); bathroom ~8 m2; guest WC ~3 m2; entrance hall at least 5 m2 (+3 for wardrobe); study 8-10 m2; utility 3-5 m2, up to 10 with plant; cellar not counted as living area; ceiling 2.30-2.50 m.
- **S41** — Wie gross sollte ein Einfamilienhaus sein? Die ideale Groesse. Bausparkasse Schwaebisch Hall, Christiane Ziemen. <https://www.schwaebisch-hall.de/ratgeber/immobilie-bauen/das-ideale-familienhaus.html>. Published: 2026-04-16 (updated). Accessed: 2026-10-03. Supports: guide (DE, 'Orientierungswerte'): living 20-30 m2; kitchen 10-20; bedroom 12-16; children's room 12-15; bathroom 8-12; study 8-12 m2.
- **S42** — Bauordnung fuer Berlin, s. 47 Aufenthaltsraeume. gesetze.co (law text). <https://gesetze.co/BE/BauO_Bln/47>. Published: current text as served. Accessed: 2026-10-03. Supports: legal minimum (DE, Berlin): habitable rooms clear height at least 2.40 m; attic rooms 2.30 m over half the floor area.
- **S43** — Die Deckenhoehe: gesetzliche Vorgaben und Mindesthoehen bei Alt- und Neubau. Mietpreise.info. <https://www.mietpreise.info/site/deckenhoehe>. Published: 2023-12-22 (updated). Accessed: 2026-10-03. Supports: guide (DE): Land minimums 2.30-2.50 m (2.40 in most); new builds 2.30-2.50 m; pre-1918 Altbau 3.30-4.50 m. (It lists Berlin at 2.50 m, which conflicts with S42's 2.40 m.)
- **S44** — Treppenplanung im Eigenheim. Baulinks.de (editorial). <https://www.baulinks.de/webplugin/2003/1044.php4>. Published: 2003-09-23. Accessed: 2026-10-03. Supports: guide (DE, DIN 18065): usable stair width at least 80 cm; 14-16 steps for 2.60-2.90 m floor heights; comfortable ~18 cm rise / 27 cm tread; floor area for a 1 m wide comfortable stair: half-turn 6.3 m2, straight 12 m2 (incl. landings).
- **S45** — Decret n. 2002-120 du 30 janvier 2002 relatif aux caracteristiques du logement decent. Legifrance (French Government). <https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000217471>. Published: 2002-01-30. Accessed: 2026-10-03. Supports: legal minimum (FR, art. 4): at least one main room of 9 m2 with 2.20 m ceiling, or 20 m3 habitable volume.
- **S46** — Qualitel passe au crible le logement des Francais et son evolution. Banque des Territoires (reporting the Qualitel survey of 1,000 homes measured by 75 surveyors). <https://www.banquedesterritoires.fr/qualitel-passe-au-crible-le-logement-des-francais-et-son-evolution>. Published: 2021-09-27. Accessed: 2026-10-03. Supports: measured average (FR): bedrooms in houses 14.5 m2 pre-1945 vs 11.2 m2 post-2009; apartment bedrooms 11.3 m2; ceiling height in apartments 2.67 m pre-1945 vs 2.40 m post-2009.
- **S47** — Logement : quelles sont les grandes evolutions en France. MonImmeuble, Isabelle Dahan (reporting Qualitel 'Etat des lieux du logement'). <https://monimmeuble.com/actualite/logement-quelles-sont-les-grandes-evolutions-en-france>. Published: 2021-06-02 (updated 2022-12-25). Accessed: 2026-10-03. Supports: measured average (FR): living room ~21 m2 in apartments; average bedroom 12.3 m2.
- **S48** — Hauteur sous plafond minimum : quelles sont les regles ?. SeLoger, Quentin Gres. <https://edito.seloger.com/node/15253>. Published: 2026-06-08 (updated). Accessed: 2026-10-03. Supports: guide (FR): decent-housing minimum 2.20 m; new builds around 2.50 m; Haussmann/older buildings often above 3 m.
- **S49** — Metre carre et confort : connaissez-vous la moyenne francaise ?. La Maison Saint-Gobain, Damien Varys. <https://www.lamaisonsaintgobain.fr/blog/insolites/metre-carre-et-confort-connaissez-vous-la-moyenne-francaise>. Published: 2023-04-18. Accessed: 2026-10-03. Supports: recommended minimums (FR): bedroom 9 m2 for one, 12-14 m2 for two; kitchen 7 m2; living 20 m2; bathroom 4 m2.
- **S50** — La surface moyenne d'une maison en France. Credit Agricole e-immobilier, Lorene Bourgain. <https://e-immobilier.credit-agricole.fr/conseils/marche/la-surface-moyenne-des-logements-en-france-est-de-90-9-m2>. Published: 2026-04-07 (updated). Accessed: 2026-10-03. Supports: recommended (FR): bedroom 9 m2 (12 m2 for two); living 20 m2; kitchen 7 m2; bathroom 4 m2.
- **S51** — Surface habitable : definition et calcul. Journal du Net, Ambre Deharo. <https://www.journaldunet.com/patrimoine/guide-de-l-immobilier/1209549-surface-habitable/>. Published: 2021-04-19. Accessed: 2026-10-03. Supports: rule summary (FR): caves, sous-sols, garages etc. excluded from habitable surface; parts under 1.80 m excluded.
- **S52** — Infraviviendas legales: cuales son las condiciones minimas de un piso. La Marea, Oscar F. Civieta. <https://www.lamarea.com/2023/05/26/infraviviendas-legales-cuales-son-las-condiciones-minimas-de-un-piso>. Published: 2023-05-26. Accessed: 2026-10-03. Supports: legal minimums (ES) by city/region: Madrid (1944 order) double bedroom 10 m2, single 6, kitchen 5, WC 1.5; Valencia (2009 order) double 8, single 6, kitchen 5, dining 8, bathroom 3, WC 1.5; Zaragoza (2001 PGOU) double 10, single 6, dining 14-20 m2, corridor at least 0.85 m; Barcelona (Decree 141/2012) bedroom 5 m2 with 1.8 x 1.8 m inscribed square.
- **S53** — Cedulas de habitabilidad. Habitissimo, Alberto Leonardo Zorrilla (LBS Abogados). <https://www.habitissimo.es/presupuestos/cedulas-de-habitabilidad>. Published: 2026-09-16 (updated). Accessed: 2026-10-03. Supports: legal minimum (ES, general summary): 2.5 m floor-to-ceiling, 2.2 m in bathrooms/kitchens; double bedroom 8 m2; stairs at least 0.9 m wide.
- **S54** — Habitabilidad Cataluna (Decreto 141/2012). Normatia. <https://normatia.com/es/normativa/habitabilidad-cataluna>. Published: 2020-12-12. Accessed: 2026-10-03. Supports: legal minimum (Catalonia, new dwellings): clear height 2.50 m; corridors 1.00 m; bedrooms 6 m2; dwelling 36 m2.
- **S55** — Lo que nunca te han contado de bajar el techo. Campus Training (editorial). <https://www.campustraining.es/noticias/lo-nunca-contado-bajar-techo/>. Published: 2025-01-08. Accessed: 2026-10-03. Supports: guide (ES): legal minimum clear height 2.50 m (reducible in bathrooms/corridors); historic city flats around 3.5 m or more.
- **S56** — Medidas para un dormitorio estandar. Planner 5D blog (ES), Kasia Chojecki. <https://planner5d.com/blog/es/medidas-para-un-dormitorio-estandar/>. Published: 2025-06-23. Accessed: 2026-10-03. Supports: guide (ES): small bedroom 7-9 m2 (2.5x3 to 3x3 m); medium 10-15 m2 (3x3.5, 3x4, 3.5x4 m); master 15-25+ m2 (4x4, 4x5 m).
- **S57** — Decreto ministeriale Sanita 5 luglio 1975 (text). Bosetti e Gatti (law text). <https://www.bosettiegatti.eu/info/norme/statali/1975_dm_05_07.htm>. Published: 1975-07-05 (text with later amendments). Accessed: 2026-10-03. Supports: legal minimum (IT): habitable rooms 2.70 m clear height, 2.40 m for corridors, bathrooms, WCs, storerooms; bedroom 9 m2 for one person, 14 m2 for two; living room at least 14 m2.
- **S58** — Superfici e altezze minime: bagno, cucina, soggiorno, camera. Studio Madera, Vincenzo Madera. <https://studiomadera.it/news/350-dimensioni-minime>. Published: 2026-09-11. Accessed: 2026-10-03. Supports: legal minimum (IT): habitable kitchen at least 9 m2, cooking corner 4-9 m2; bathroom size set by municipal rules; Salva Casa DL 69/2024 allows 2.40 m in some recovery cases.
- **S59** — Sfruttare l'altezza dei soffitti per recuperare spazio. Cose di Casa. <https://www.cosedicasa.com/ristrutturare/progetti-ristrutturazione/sfruttare-laltezza-dei-soffitti-per-recuperare-spazio-54922>. Published: 2020-03-16 (updated 2025-01-10). Accessed: 2026-10-03. Supports: guide (IT): new builds average 2.70-3.00 m internal height; most pre-1970s, historic and single houses notably higher (no figure given).

## Gaps and guesses

Below is every INFERRED cell and why we had to guess. The EU fallback is
INFERRED as a whole: each dimension is the median of the Germany, France,
Spain and Italy cells, so it is only as good as those four tables.

**North America**
- `living` medium (18 x 13): Punch calls 12x18 "medium" and DesignFiles calls 15x20 "average", so we split the difference.
- `primary_bedroom` small (12 x 12): no source gives a small primary bedroom. We put it just above the average secondary bedroom.
- `bathroom` small (7 x 5): just below DesignFiles' 40-50 sq ft full-bath range.
- `ensuite` large (8 x 5): a three-quarter bath at the bottom of the full-bath range.
- `hallway` all lengths: the widths are sourced (36 in minimum, 42-48 in comfortable), but no source gives hallway lengths.
- `stairwell` large width (4 ft): the length (15'6" at 9 ft walls) is sourced. The width is ours.
- `basement` all three: the only anchors are a 15x15 ft typical family room and a ~1,000 sq ft typical basement. The basement `standard` ceiling of 7.5 ft is the midpoint of a 7-8 ft range.

**United Kingdom**
- `living` small, `kitchen` small: below the measured averages, with nothing to anchor them.
- `dining` medium: between Homebuilding's 3x3 minimum and its 4.5x4 recommendation.
- `hallway` all: the width is anchored to the 900 mm Lifetime Homes minimum. The lengths are ours.
- `stairwell` medium and large: Part K geometry fixes the small flight. Landings and wider flights are ours.

**Australia** (we found the fewest room-level sources here)
- `living` medium; `kitchen` small and large; `bedroom` medium; `bathroom` large; `ensuite` large; `office` medium: these fill gaps between NSW ADG minimums and guide figures.
- `hallway` and `stairwell` (all six cells): no Australian source read. We borrowed US/UK/German geometry.
- `laundry` (all three): no Australian dimensions found. These are converted from US and UK guides.
- NZ: no source read. It uses this table.

**Germany**
- `living` small, `bathroom` small, `ensuite` small and large, `hallway` small: sizes for older flats and ensuite shower rooms. The German guides (S40, S41) describe new houses only.
- `stairwell` small and large: DIN-based geometry fixes only the medium.

**France**
- `living` small; `kitchen` medium; `bathroom` small and large: we found only recommended minimums and one measured living-room average.
- `stairwell` (all), `office` medium and large, `laundry` (all): no French source read. We copied German geometry or the German study and utility guides.

**Spain**
- `living` small and medium: no Spanish living-room average found. This is a weak row.
- `kitchen` medium; `bathroom` medium and large; `ensuite` large: only legal minimums were found.
- `stairwell` medium and large: the 0.9 m minimum width is sourced. The lengths are ours.
- `laundry` (all): no source.

**Italy**
- `living` medium, `primary_bedroom` medium, `bedroom` medium, `office` medium: between the legal minimums (D.M. 5 July 1975) and Plan7 guide figures.
- `bathroom` small and medium: national law leaves bathroom size to each municipality.
- `stairwell` (all): German geometry stretched for Italy's taller storeys.
- `laundry` (all): no source.

**Sources that are weaker than they look**
- S1 and S2 (Plan7Architect, the owner's link) are international guides with no date or author. They fill several continental cells (dining, ensuite, hallway, large living).
- S37 (Habitus Living) gives areas that don't match its own dimensions, so we use the dimensions only.
- S39 (OzBargain) is a forum thread. It is the only source for "no basements in Australia".
- The basement "not offered" reasons for Spain (S52, S53) and Italy (S57) are weakly sourced. Those sources define habitable rooms. They say nothing direct about basements.
- S13, S14 and S15 were read on ArchitectureLab's `dev.` mirror, because the main domain blocked us (HTTP 403).

**Sites that would not load or could not be read** (so we did not cite them):
- The NAHB "Where Builders Place Their Space" article returned 404.
- Angi pages returned 403.
- The main domain of ArchitectureLab returned 403.
- The LABC Warranty report PDF, the Qualitel full-report PDF and the Catalan Decree 141/2012 PDF had text we could not extract.
- The gov.uk NDSS PDF returned 404. We used the gov.uk HTML version instead (S18).
- The Victorian (AU) BADS documents returned 403/404.
- The NSW ADG compliance checklists returned 410.

We saw the commonly quoted "average Australian master bedroom 4.2 x 3.9 m"
only in search snippets and never read it at a source, so it is not used. The
Australian primary bedroom uses S36 (3.5 x 4 m) instead.
