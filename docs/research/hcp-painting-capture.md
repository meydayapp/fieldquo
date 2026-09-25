# Housecall Pro — Painting trial capture (2026-09-24)

Fresh trial signed up as **Painting** ("Your Local Painter LLC", CT, USD). Read from the app's own API in the logged-in session; nothing edited.

## Estimate templates — 2, both generic
Only the two generic ones every trial gets: **Diagnostic visit** ($100, cost $80, −$10 new-customer) and **Repair** ($200, cost $100, −3 % regular-customer). **No painting-specific estimate templates exist in HCP.**

## Pricing forms — none seeded
`price_forms` = 0. The industry flag `measurement_based_pricing_available: true` with description *"Includes measurement inputs for surface areas and fields to capture details like paint color, sheen, and number of coats"* — but nothing is preloaded; the **pricing-form builder** is generic: Details (name, description, image, auto-add to jobs, taxable) · Booking & scheduling (show in online booking, duration per field or fixed, employees) · **Fields**, each field × price, three field types: **Quantity select** (stepper, e.g. bedrooms/bathrooms), **Numerical range** (bands, e.g. size of home 1,000–2,000 sq ft), **Multi-select** (add-on upcharges). No room dimensions, no area maths — a band/quantity calculator. Ours (room L×W×H → wall/ceiling/trim quantities) is richer.

## Price book services — 41, all $0, no cost, no attached materials or labour rates
Every service: `price 0`, `cost 0`, `service_materials: []`, `service_labor_rates: []`, `track_material_usage: true`, `flat_rate_enabled: false`, unit null. Pricing-insights (`/recommendations`) returned null on this trial; the 09-21 capture holds P25/median/P75 for these same task codes (DEFAULT_PAINT_SERVICE_0…40). Book Now services carry duration 120 min + online booking.

| Category | Service (task code) | HCP description |
|---|---|---|
| Add-On Services | Touch-Up Painting (0) | Targeted painting to repair scuffs, chips, or small damaged areas, restoring a clean and uniform appearance. |
| Add-On Services | Trim & Baseboard Painting (1) | Painting of trim, baseboards, and molding to enhance detail and provide a polished final look. |
| Add-On Services | Door Painting (2) | Painting of interior or exterior doors to refresh appearance and protect surfaces from wear. |
| Add-On Services | Accent Wall Painting (3) | Painting of a single wall with a different color or finish to create a focal point within a room. |
| Add-On Services | Installation of Roller Shades and Painting Supplies (4) | Supply and install roller shades along with necessary painting materials and supplies. |
| Add-On Services | Interior Painting with Sherwin Williams Emerald Urethane Enamel (5) | Provide interior painting services using Sherwin Williams Emerald Urethane Trim Enamel for a smooth and durable finish. |
| Book Now | Interior Painting Service (6) · 120 min · online | Professional interior painting for a fresh new look. |
| Book Now | Exterior Painting Service (7) · 120 min · online | Enhance curb appeal with exterior painting. |
| Book Now | Room Repaint & Color Update (8) · 120 min · online | Update a room with a new color and finish. |
| Commercial Services | Commercial Painting (9) | Professional painting service for commercial spaces, focused on durability, efficiency, and minimal disruption to operations. |
| Core Painting | Interior Painting - Per Room (10) | Interior painting service for a single room, including walls and basic prep, delivering a clean, even finish that refreshes the space. |
| Core Painting | Interior Painting - Whole Home (11) | Full-home interior painting covering walls, ceilings, and trim as specified, providing a consistent, refreshed look throughout the home. |
| Core Painting | Exterior Painting - Full Home (12) | Complete exterior painting service including siding and major surfaces, with proper prep and coatings designed for durability and weather protection. |
| Core Painting | Cabinet Painting (13) | Cabinet refinishing service that cleans, sands, and applies durable coatings to update kitchen or bathroom cabinets with a smooth, long-lasting finish. |
| Core Painting | Labor and Material for Interior Staining Services (14) | Provide professional labor and materials for interior staining projects. |
| Core Painting | Interior Ceiling Painting for Residential Properties (15) | Provide professional painting services for interior ceilings using premium paint. |
| Core Painting | Interior and Exterior Painting Services for Residential Properties (16) | Professional painting services for both interior and exterior surfaces, including doors, trim, and cabinets. |
| Core Painting | Interior Painting of Residential Rooms and Ceilings (17) | Complete interior painting service including preparation, labor, and materials for residential rooms. |
| Core Painting | Interior Painting of Residential Rooms with Color Change (18) | Complete interior painting of residential rooms, including color and sheen changes as needed. |
| Core Painting | Interior Painting for Residential Rooms and Cabinetry (19) | Complete interior painting services for various residential rooms and cabinetry, including full service and no trim options. |
| Core Painting | Interior Painting for Residential Spaces (20) | Complete interior painting services including labor and materials for various rooms and areas. |
| Core Painting | Interior and Exterior Painting with Sherwin Williams Products (21) | Application of high-quality Sherwin Williams acrylic latex paint for both interior and exterior surfaces. |
| Core Painting | Interior and Exterior Painting for Residential Properties (22) | Professional painting services for walls, ceilings, trim, and exterior surfaces using high-quality paint. |
| Core Painting | Interior Wall Painting for Two Bedroom Units (23) | Provide professional painting services for the interior walls of two bedroom units. |
| Core Painting | Interior Painting for Residential Walls, Ceilings, and Trim (24) | Professional painting services for interior walls, ceilings, and trim in residential spaces. |
| Core Painting | Interior Wall and Ceiling Painting for Residential Spaces (25) | Provide professional painting services for interior walls and ceilings, ensuring a fresh and clean finish. |
| Core Painting | Cabinet Refinishing and Full Painting for Kitchen Cabinets (26) | Refinish and fully paint kitchen cabinets for a fresh, updated look. |
| Core Painting | Interior Ceiling Painting with Sherwin Williams ProMar Products (27) | Apply high-quality Sherwin Williams ProMar interior latex paint to ceilings for a fresh and clean finish. |
| Core Painting | Interior Wall Painting for One-Bedroom Apartments (28) | Provide interior painting services for one-bedroom apartments, including walls and ceilings. |
| Core Painting | Interior Apartment Painting for Various Room Sizes (29) | Provide professional painting services for apartments, including walls, ceilings, and touch-ups in various room sizes. |
| Core Painting | Cabinet Painting and Refinishing for Residential Kitchens (30) | Professional painting and refinishing services for kitchen cabinets to enhance appearance and durability. |
| Exterior Components | Deck & Fence Painting / Staining (31) | Painting or staining of decks and fences to improve appearance and protect against weather and wear. |
| Exterior Components | Fascia & Soffit Painting (32) | Painting of fascia and soffits to protect roofline components and improve exterior appearance. |
| Exterior Components | Garage Door Painting (33) | Painting of garage doors to match or refresh exterior finishes and improve curb appeal. |
| Exterior Components | Exterior Painting and Staining for Residential Properties (34) | Provide exterior painting and staining services for decks, fences, and masonry surfaces. |
| Exterior Components | Exterior Painting of Residential Surfaces and Trim (35) | Professional painting services for exterior surfaces including siding, trim, and fences. |
| Prep & Repair | Surface Preparation (36) | Surface prep including cleaning, sanding, patching, and priming to ensure proper paint adhesion and a high-quality finish. |
| Prep & Repair | Drywall Patch & Repair (37) | Repair of minor drywall damage such as holes and cracks, creating a smooth surface ready for painting. |
| Prep & Repair | Caulking & Sealing (38) | Application of caulking to gaps and seams to improve finish quality and protect against moisture and air gaps. |
| Prep & Repair | Interior Painting and Preparation for Residential Rooms (39) | Complete preparation and painting of various interior rooms including kitchen, bathroom, living room, dining room, bedroom, and hallway. |
| Prep & Repair | Removal and Painting of Popcorn Ceilings in Interior Spaces (40) | Remove existing popcorn texture from ceilings and apply fresh paint for a clean finish. |

## Job costing — no formulas or templates
`labor_rates` book is empty; services carry `cost` (blank) and `track_material_usage`. HCP job costing = employee pay rate (Team → Manage Pay) × hours tracked + material costs entered/attached + commissions; basis switch Revenue vs Gross Profit under Settings → Jobs → Costs & Materials. Nothing to import.

## Commissions (feature `jobs.commissions` enabled)
- Rates per team member: **Worked by %** and **Sold by %** (Team → Team Members → Manage Pay).
- Basis, account-wide: **Revenue** (amount billed) or **Gross Profit** (after unit + labour costs).
- Per line item: Worked By pre-populated from who did the work; Sold By added by hand; each member picks the line items they earn on; several members on one line each get the full line.
- Price Book override: a service/material/pricing form can carry its own Sold By / Worked By rate, marked commissionable; item rate beats member rate.
- Job Commissions card: manual split % or fixed dollar override; Job Splits link revenue split ↔ commission split with one toggle.
- Reporting: Commissions Report by employee over time. Formula: line amount (or gross profit) × rate.
Sources: help.housecallpro.com articles 6649542 (Tracking Commissions on Jobs), 15327130 (Price Book Commissions), 12657750 (Gross Profit vs Revenue), 15350882 (Job Splits), 6596775 (Commissions Report).

## Checklists — 3 HCP templates seeded for Painting (sections → items with value types boolean · text · stop_light)
**Painting** (34 items, 20 required): Preparation (scope reviewed ✓, colours/sheen/product confirmed [text], existing colour [text], surface type [text], area protected ✓, outlets/hardware masked ✓) · Inspection & Surface Verification (inspect nail pops/cracks/holes/peeling/water stains [text], substrate damage? [stop-light], pre-existing damage not in scope [text], moisture concerns? [stop-light]) · Safety (PPE ✓, ventilation ✓, ladders ✓, fall protection ✓, area safe for occupants ✓) · Execution (repairs ✓, sanding ✓, caulking ✓, primer ✓, application method [text], coats [text], coverage verified [stop-light], lines & edges clean [stop-light]) · Documentation (scope changes [text], paint batch/product [text]) · Cleanup & Completion (cleaned ✓, spills/overspray ✓, coverings removed ✓, leftover paint labelled ✓, final walkthrough ✓) · Customer Communication & Approval (explain work ✓, touch-up process ✓, drying/curing guidance ✓, **customer approval signature** [text]).
**Cabinet Painting** (14 items): Preparation (doors/drawers count [text], hardware removed & labelled ✓) · Inspection (surface damage [text], grease removed ✓) · Safety (ventilation ✓, PPE ✓) · Execution (sanding/deglossing ✓, primer ✓, application method [text], coats [text], finish quality — no drips/orange peel/brush marks [stop-light]) · Reinstallation & Completion (reinstalled & aligned ✓, final walkthrough ✓, customer signature [text]).
**Pressure Washing** (8 items): Preparation (water source ✓, surface type [text]) · Safety (PSI selected ✓, protective measures ✓) · Execution (detergent ✓, surface cleaned [stop-light], problem areas [text]) · Completion (customer satisfaction ✓).
Template flags: `required` (must complete before closing job), `auto_add_to_jobs`, automations (none seeded).
