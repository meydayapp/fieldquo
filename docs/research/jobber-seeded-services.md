# Jobber — seeded services and sample line names (reference capture)

Relayed by the coordinator on 2026-09-24 from a Jobber signup walk-through, as
evidence for what a competitor hands a new company on day one. Names and
descriptions below are quoted as captured; FieldQuo's seeds describe the same
work in our own words (the seed check hashes competitor sentences and fails on a
match), and where a name was missing from the matching trade seed it was added
with an estimate template — see `app/data/serviceSeeds/<trade>.js`.

## What Jobber seeds for a company that signs up as Painting

Twelve rows, all type "Service", no price on any of them — the company is
expected to type its own rates. Jobber ships names and one-sentence
descriptions only.

| Jobber name | Jobber description (as captured) | FieldQuo seed row (with template) |
|---|---|---|
| Baseboard Painting | "Application of semi-gloss paint to baseboards, includes caulking and filling holes." | `fq.interior_painting.core.baseboards` |
| Cabinet Painting | "Prep, prime, and paint kitchen and bathroom cabinets. Includes removal and reinstallation of hardware. Doors and drawers sprayed off-site for a smooth finish." | `fq.interior_painting.cabinets.*` (existing) |
| Ceiling Repair and Painting | "Repairing any cracks or damage in ceilings, priming repaired areas, and application of 2 coats of paint." | `fq.interior_painting.core.ceiling_repair_paint` |
| Deck Staining | "Application of 2 coats of high-quality stain after pressure washing deck and repairing any damaged wood." | `fq.exterior_painting.exterior.deck_fence` (existing) |
| Drywall Repair | "Patch and mud drywall for repairs. Sand and prime repaired areas before painting." | `fq.interior_painting.prep.*` (existing drywall row) |
| Exterior Painting | "Application of 2 coats of high-quality exterior paint after washing exterior, scraping loose paint, caulking cracks, and priming raw areas." | `fq.exterior_painting.exterior.surfaces_and_trim` (existing) |
| Free Assessment | "Our experts will come to assess your needs and discuss solutions" | `fq.interior_painting.visits.*` estimate visit (existing) |
| Interior Door Painting | "Prep and application of 2 coats of semi-gloss paint to interior doors, including both sides." | `fq.interior_painting.core.doors` |
| Interior Trim and Window Painting | "Prepping and painting interior trim and window frames with a semi-gloss finish. Includes caulking and repairing any imperfections." | `fq.interior_painting.core.trim_windows` |
| Popcorn Ceiling Removal | "Removal of popcorn texture from ceilings and repairing any imperfections." | `fq.interior_painting.prep.popcorn_removal` |
| Wall Painting | "Application of 2 coats of high-quality paint to walls, including patching, sanding, priming, and protection of floors and furniture during work." | `fq.interior_painting.core.*` walls (existing) |
| Wallpaper Removal | "Removal of wallpaper, scraping off glue, repairing any wall damage, and priming walls for painting." | `fq.interior_painting.prep.wallpaper_removal` |

The right-hand column is filled in as the painting seeds are worked; a row that
says "existing" matched a row the seed already had, the others were added on
2026-09-24 (the exact keys are in the seed file and the source map).

## Jobber's painting quote template

"Interior Painting Services": two options — "Paint Option #1 - Full Interior"
at $4,500 and "Paint Option #2 - Main Living Areas" at $2,400, the second
marked optional and recommended — an intro section with a hero photo, a client
message, and terms carrying a 50% deposit clause. The two-option shape (a full
scope and a smaller recommended one) is what our template gallery should let a
painter reproduce; the prices are Jobber's sample figures, not a benchmark, and
were not used for any seed range.

## Sample line names Jobber shows at signup, per industry

Two per industry. These are the names a new company sees in the signup flow as
examples of what a price book holds.

| Jobber industry | Sample line 1 | Sample line 2 | FieldQuo trade seed |
|---|---|---|---|
| Air Duct Cleaning | Basic Air Duct Cleaning | Dryer Vent Cleaning | `hvac_repair` (air_quality) — no air-duct seed file exists yet |
| Appliances | Refrigerator Repair | Dryer Ventilation System Cleaning | `appliance_repair` |
| Automotive | Brake Service | Engine Tune-Up | none — no automotive seed; not a home-service trade in the catalogue's seeded set |
| Carpet Cleaning | Deep Carpet Shampooing | Pet Odor Elimination and Carpet Sanitization | `carpet_cleaning` |
| Construction & Remodeling | Kitchen remodel – demo and prep | Bathroom remodel – tile installation | `general_contracting` |
| Electrical | Replace 15A 120V 2-wire receptacle with GFCI receptacle indoor | Install dryer cord, 4 wire up to 6 ft | `electrical` — `receptacles.two_wire_to_gfci_indoor`, `appliances.dryer_cord` (both existed) |
| Garage | Garage Door Panel Replacement | Garage Door Spring Repair | `garage_door` — `repair.panel_replacement`, `repair.torsion_spring` (both existed) |
| General Contractor | Kitchen Remodeling and Cabinet Installation | Bathroom Renovation and Tile Grouting | `general_contracting` |
| Handyman | TV Mounting and Home Theater Setup | Light Fixture Replacement | `handyman` |

Every name with a FieldQuo trade in the last column carries an estimate
template in that trade's seed after this pass; the two industries without a
seed file (Automotive, Air Duct Cleaning as its own trade) are listed in
docs/SERVICE-SEEDS.md under "still to seed".
