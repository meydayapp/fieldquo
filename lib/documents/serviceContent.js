// lib/documents/serviceContent.js
//
// What a quote SAYS about each trade, beyond the price.
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// FieldQuo already supports multi-service quotes: a quote has scopeGroups,
// each pointing at a ServiceCategory, so "interior painting + flooring" or
// "cabinets + countertop" already works as data. What it didn't have was
// anything to SAY about each one. Every group rendered as a bare label over a
// list of amounts, so a $14,000 kitchen quote and a $200 tap repair looked
// like the same document at different scales.
//
// The gap between those two is not price, it's confidence. A client comparing
// three quotes picks the one that reads like the company has done this before:
// what's included, in what order, what happens on which day. That content is
// identical for every painter in the country, which is exactly why it should
// ship as a default rather than be homework for someone who signed up an hour
// ago.
//
// ── Defaults in code, overrides in the database ─────────────────────────────
//
// These live in a JS file, keyed on ServiceCategory.key, rather than being
// seeded into rows. Two reasons:
//
//   1. Improving the wording for every existing company is an edit here, not a
//      migration that has to avoid clobbering anyone who customised theirs.
//   2. A company that HAS customised theirs is stored in
//      CompanyServiceCategory, and overrides cleanly — see resolveServiceContent
//      below. Their edit survives every change made here.
//
// ── The claims are deliberately unverifiable-free ──────────────────────────
//
// Nothing here states a warranty term, a price, a cure time, a brand of
// material or a number of days. Those vary by company and by job, and a
// default that quietly asserts "5-year warranty" on behalf of a contractor who
// offers two is not a nice touch, it's a contract term they didn't agree to.
// Anything specific is left for the company to add.
//
// ── ...but the specifics are still OFFERED, as [placeholders] ───────────────
//
// "Leave it out" and "prompt for it" are different things. A cabinet shop's
// best line is "3 coats of shellac primer, 2 coats of catalysed 2K topcoat,
// 5-year anti-peel warranty" — the sentence that wins the kitchen — and a
// blank included list teaches nobody to write it. So the specific bullets ship
// as prompts in square brackets ("Primer: [how many coats, and which primer
// you use]"), reusing unfilledPlaceholders() from contractTerms.js rather than
// inventing a second placeholder syntax.
//
// The difference from contractTerms is what happens when nobody fills them in.
// Company.defaultProcessNotes is text a human deliberately pasted and can see
// on screen, so its placeholders print as written and the settings page warns
// about them. THESE defaults ship to every company automatically, on every
// quote, whether or not anyone has ever opened the settings screen — so an
// unfilled bracket here would reach a homeowner without a single person having
// read it. Unfinished lines are therefore WITHHELD from the document and
// reported to the company instead (`unfilled` below, rendered in
// Settings > Services). A withheld bullet costs nothing; "[warranty period]
// warranty" on a kitchen table costs the job.
//
// The placeholder bullets are additive on purpose: every generic bullet that
// printed before still prints. Filling one in adds a line, it never replaces
// one, so a company that ignores this screen forever is no worse off than it
// was.

import { unfilledPlaceholders } from "@/lib/documents/contractTerms";

// Per-trade accent. Used for the left border and badge on each scope card, so
// a three-trade quote reads as three sections rather than one long list.
//
// These are chosen to sit alongside ANY brand colour without clashing —
// desaturated, mid-lightness, and used only as a thin border plus a wash. The
// page's own accent (rules, totals, buttons) always stays the company's.
const PALETTE = {
  slate: "#5b6b7f",
  teal: "#3f7d78",
  moss: "#5c7a4a",
  clay: "#a86a48",
  plum: "#7a5a86",
  ochre: "#9a7b3c",
  denim: "#4a6795",
  rust: "#9c5a49",
};

// Shared step sets. Most trades genuinely follow one of these shapes, and
// pretending otherwise would mean sixty near-identical arrays that drift.
//
// ── `timeline` is optional, and absent means absent ─────────────────────────
//
// A step may carry a `timeline` ("1–2 days", "Same day"), and the document
// prints it beside the step. It is on the sets below that come from a real
// contractor's published process and NOT on the generic ones, because a
// duration is the single most quotable sentence on a quote and inventing one
// for sixty trades would be putting a commitment in a contractor's mouth. The
// renderer shows the step without it rather than showing a blank or a guess.
//
// Companies edit these in Settings > Services, which writes
// CompanyServiceCategory.processSteps and overrides the whole array.
const PREP_APPLY_FINISH = [
  {
    title: "Walkthrough and confirmation",
    body: "We confirm the scope on site, agree the finish and colours, and answer anything outstanding before work starts.",
  },
  {
    title: "Protection and preparation",
    body: "Furniture moved or covered, surrounding surfaces masked, and all surfaces cleaned and prepared for a lasting result.",
  },
  {
    title: "Repairs and priming",
    body: "Imperfections filled and sanded, and primer applied where it's needed for adhesion and coverage.",
  },
  {
    title: "Application",
    body: "The finish is applied in full coats, with the drying time between them that the product actually requires.",
  },
  {
    title: "Cleanup and final walkthrough",
    body: "Masking removed, the area left clean, and a walkthrough with you before we call it done.",
  },
];

// The cabinet sequences, ported from TrueFinish Cabinets' own published
// workflow (app/admin/lib/services.js in that repo): prep and containment →
// removal and labelling → clean and sand → primer and fine sand → topcoat,
// inspect, touch up → reinstall, clean, walk through.
//
// PREP_APPLY_FINISH said roughly the same thing in five generic steps, and the
// two that are missing from it are the two a cabinet client actually worries
// about: containment (is my whole house going to be covered in dust) and
// labelling (are my doors going back on the right openings).
//
// Their heading — "Typical 5-Day Workflow" — is deliberately NOT here. A
// duration is the most quotable sentence on a quote and five days is TrueFinish's
// number, not every shop's. It ships as a [placeholder] bullet instead.
const CABINET_REFINISH_WORKFLOW = [
  {
    title: "Kitchen prep and protection",
    body: "Masking and containment go up first — floors, counters, appliances and the openings into the rest of the house — so dust and overspray stay in the room being worked on.",
  },
  {
    title: "Removal and labelling",
    body: "Doors, drawer fronts and hardware come off, and every piece is labelled so it goes back on the opening it came from.",
  },
  {
    title: "Cleaning and sanding",
    body: "Every surface is degreased and then sanded. A finish sprayed over cooking grease or a glossy factory coat is a finish that peels, which is why this step is not the one to shorten.",
  },
  {
    title: "Primer and fine sanding",
    body: "Primer goes on to block staining and give the topcoat something to hold, with a fine sanding between coats to take back the grain the last one raised.",
  },
  {
    title: "Topcoat, inspection and touch-ups",
    body: "The topcoat is sprayed in full coats, then inspected in good light and touched up before anything goes back on.",
  },
  {
    title: "Reinstall, clean and walkthrough",
    body: "Doors and fronts are rehung on their own openings, hardware refitted and the doors realigned, the room cleaned, and we walk it with you.",
  },
];

// Refacing is NOT the same sequence with different words.
//
// Steps 3 to 5 above — degrease, sand, prime, spray — happen to a door that is
// already in the kitchen. A refacing door is manufactured to a measurement and
// arrives finished, so printing the refinishing process on a refacing quote
// describes work that will not happen. MEASURE_SUPPLY_INSTALL (the previous
// default here) is closer but generic; it never mentions the two things this
// job lives or dies on: the measurement, and the hinge adjustment at the end.
const CABINET_REFACE_WORKFLOW = [
  {
    title: "Measure and specify",
    body: "Every opening is measured on site and the door style, colour and finish are confirmed with you before anything is ordered. The doors are made to those measurements and cannot be resized afterwards.",
  },
  {
    title: "Ordering and fabrication",
    body: "Doors, drawer fronts and the matching material for the box faces are made to the confirmed measurements and finish.",
  },
  {
    title: "Removal",
    body: "The existing doors, drawer fronts and hardware come off and are taken away.",
  },
  {
    title: "Box faces prepared and finished",
    body: "The visible outside faces of the cabinet boxes are cleaned, prepared and finished to match the new fronts, so the parts you keep and the parts you replace read as one kitchen.",
  },
  {
    title: "Hanging and adjustment",
    body: "Hinges fitted, handle positions drilled to the placement you chose, and every door and drawer aligned so the gaps are even.",
  },
  {
    title: "Clean and walkthrough",
    body: "The room is cleaned and we walk it with you before it is signed off.",
  },
];

// The shell sequence a framing, drywall or general contracting job actually
// runs, with a real contractor's published durations. Kept as one shared set
// because these three trades sell different slices of the SAME sequence, and a
// client comparing a framer's quote to a GC's should see the same shape.
//
// The durations are Konstruction Group's (Toronto) own published figures for a
// laneway/garden suite scale of work. They are a starting point a company edits
// in Settings > Services, not a commitment this file makes on anyone's behalf —
// which is exactly why they are editable rather than hard-coded into the PDF.
const SHELL_SEQUENCE = [
  {
    title: "Drawing review",
    body: "You provide the architectural and structural drawings. We review the framing requirements, identify any steel beam or column needs, and flag site access problems before they become site delays.",
    timeline: "1–2 days",
  },
  {
    title: "Site visit",
    body: "We walk the property to assess access routes, staging areas and anything specific to the site — including how material gets delivered on a tight lot.",
    timeline: "1–2 hours",
  },
  {
    title: "Detailed quote",
    body: "Itemised pricing with the scope and the timeline written down. Nothing arrives later as a surprise.",
    timeline: "3–5 business days",
  },
  {
    title: "Framing",
    body: "Once the foundation is ready and has passed inspection, floors, walls and roof are framed and blocking is installed for electrical, plumbing and fixtures. The structure is left ready for mechanical rough-in.",
    timeline: "2–4 weeks",
  },
  {
    title: "Insulation",
    body: "After the mechanical and electrical rough-in has been inspected, the specified insulation goes in — spray foam, batt or a combination, to the drawings and the energy requirements.",
    timeline: "3–7 days",
  },
  {
    title: "Drywall",
    body: "Board hung, taped and finished to Level 4, or Level 5 where specified. Walls left ready for primer and paint, and our work areas cleaned.",
    timeline: "1–2 weeks",
  },
];

const MEASURE_SUPPLY_INSTALL = [
  {
    title: "Consultation and selection",
    body: "We confirm the scope, materials and finishes with you, and answer anything outstanding before ordering.",
  },
  {
    title: "Measurement",
    body: "Exact measurements taken on site so the material is cut to your space rather than to an estimate.",
  },
  {
    title: "Ordering and fabrication",
    body: "Materials ordered and prepared to the confirmed measurements.",
  },
  {
    title: "Removal and preparation",
    body: "Existing material removed and disposed of where that's part of the scope, and the area prepared for installation.",
  },
  {
    title: "Installation and walkthrough",
    body: "Installed, levelled, sealed and cleaned, followed by a walkthrough with you.",
  },
];

const ASSESS_REPAIR_TEST = [
  {
    title: "Assessment",
    body: "We diagnose the problem on site and confirm what's needed before any work or parts are committed to.",
  },
  {
    title: "Confirmation",
    body: "If the job turns out to differ from what was quoted, you hear about it before we proceed — not afterwards on the invoice.",
  },
  {
    title: "The work",
    body: "Carried out to code, using the parts and methods set out in this quote.",
  },
  {
    title: "Testing",
    body: "Everything is tested under normal operating conditions before we pack up.",
  },
  {
    title: "Cleanup and handover",
    body: "The area is left as we found it, and we walk you through what was done and anything to watch for.",
  },
];

const VISIT_SERVICE_VERIFY = [
  {
    title: "Confirmation",
    body: "We confirm access, timing and anything specific you'd like attention paid to.",
  },
  {
    title: "Preparation",
    body: "The area is prepared and anything that needs protecting is covered before we begin.",
  },
  {
    title: "The work",
    body: "Carried out to the scope set out in this quote, with our own equipment and materials unless stated otherwise.",
  },
  {
    title: "Inspection",
    body: "We check the work over before leaving and put right anything that isn't up to standard.",
  },
];

// Inspection is the one trade here that deliberately changes nothing about the
// property, so none of the four sets above is honest for it: PREP_APPLY_FINISH
// masks and coats, ASSESS_REPAIR_TEST repairs, and VISIT_SERVICE_VERIFY talks
// about protecting surfaces before "the work". The deliverable is a report, and
// the limits of the inspection are part of what the client is buying — a client
// who thinks walls were opened will be angry at the first hidden defect.
const INSPECT_REPORT_REVIEW = [
  {
    title: "Booking and access",
    body: "We confirm the property, the time, and how access is arranged. You're welcome to be there — most clients get more out of the inspection when they are.",
  },
  {
    title: "On-site inspection",
    body: "A visual inspection of the readily accessible areas and systems set out above. It is non-invasive: nothing is dismantled, no finished surface is opened, and stored belongings are not moved.",
  },
  {
    title: "Findings on site",
    body: "We go through what we found with you before leaving, so you hear the significant items in person and can ask about them on the spot.",
  },
  {
    title: "Written report",
    body: "A written report with photographs of every significant finding, what it means, and what we'd suggest doing about it.",
  },
  {
    title: "Questions afterwards",
    body: "The report raises questions once you sit down with it. We stay available to talk it through.",
  },
];

const PLAN_BUILD_HANDOVER = [
  {
    title: "Scope and schedule",
    body: "We confirm the full scope, sequence the trades, and agree a start date and expected duration with you.",
  },
  {
    title: "Permits and preparation",
    body: "Any permits and inspections required are arranged, and the site is prepared and protected.",
  },
  {
    title: "Demolition and rough-in",
    body: "Existing material removed and structural, electrical and plumbing work brought to inspection-ready.",
  },
  {
    title: "Finishes",
    body: "Surfaces, fixtures and finishes installed to the specification agreed above.",
  },
  {
    title: "Inspection and handover",
    body: "Final inspection, deficiency list cleared, site cleaned, and a walkthrough with you.",
  },
];

// ── `description`: the sentence that makes the label mean something ────────
//
// A scope group prints its label — "Cabinet Refinishing" — over a column of
// amounts. The AI reviewer flags exactly that as a line the client won't
// understand, and it is right: a homeowner reading three quotes does not know
// whether refinishing replaces the doors, whether the insides get painted, or
// what "refacing" leaves behind.
//
// `included` does NOT already answer this. It is a list of deliverables
// ("Sprayed topcoat on both faces of every door and drawer front"), it prints
// BELOW the prices, and every trade has one because GENERIC supplies a
// fallback — so it can never say "this trade has nothing distinctive to
// state". The description is one paragraph, above the prices, naming the
// object of the work and its BOUNDARY: what is not touched, and what is a
// separate line. It defaults to absent, like mayChange and glossary, so a
// trade with no book renders nothing rather than a heading over a blank.
//
// These carry no placeholders. Unlike an included bullet, a paragraph cannot
// have one line withheld — dropping the whole description to hide a bracket
// would lose the scope statement, which is the thing worth having. So every
// specific a company has to own lives in `included`, and the description is
// written to be true of any company in the trade.
//
// ── `variantOn` / `variants`: the same trade, a different job ──────────────
//
// A static paragraph per trade is wrong where the takeoff already records a
// choice that changes the work. Refacing is the case that forced this: the
// price book offers thermofoil, painted MDF, red oak and white oak, and a
// thermofoil door is a heat-formed vinyl skin over MDF that arrives finished
// from the factory. Printing "cleaned, sanded, primed and sprayed" on a
// thermofoil quote describes work that will not happen, on a document the
// client can hold the contractor to.
//
// `variantOn` names ONE field of QuoteScopeGroup.takeoff and `variants` maps
// its value to the paragraph for that choice. An unset or unrecognised value
// falls back to the trade-level description — absence of a choice is not a
// choice, and a guess here is a scope-of-work error rather than a typo.

const REFACE_DESCRIPTION =
  "We replace the doors and drawer fronts and finish the visible outside faces of the cabinet boxes to match, so your kitchen keeps its existing layout and its existing carcasses. The door style priced above is what is being made; hinges are supplied, fitted and adjusted, handle positions are drilled to the placement you choose, and the old doors and fronts are taken away. The insides of the cabinets are not refinished unless a line above says so.";

// Each of these replaces the paragraph above rather than adding to it, because
// the process differs, not just the material. The closing sentence is repeated
// deliberately: a client reading only their own variant still has to be told
// what happens to the boxes and the old doors.
const REFACE_DOOR_VARIANTS = {
  thermofoil:
    "The doors and drawer fronts on this quote are thermofoil: an MDF core wrapped in a heat-formed vinyl skin and finished at the factory in the colour you chose. They arrive complete — nothing is sanded, primed or sprayed on site, and the colour cannot be changed later without replacing the door. The visible outside faces of the cabinet boxes are finished to match, hinges are supplied, fitted and adjusted, handle positions are drilled to the placement you choose, and the old doors and fronts are taken away.",
  painted_mdf:
    "The doors and drawer fronts on this quote are painted MDF: a machined MDF door sprayed in the colour you chose. MDF has no grain to telegraph through the paint, which is what makes an even, joint-free painted finish possible, and it can be repainted later. The visible outside faces of the cabinet boxes are finished to match, hinges are supplied, fitted and adjusted, handle positions are drilled to the placement you choose, and the old doors and fronts are taken away.",
  red_oak:
    "The doors and drawer fronts on this quote are solid red oak: a natural wood door with an open, pronounced grain that shows through the finish, so no two doors look identical. Wood moves with the seasons, and fine lines opening and closing at the joints between rails and stiles are normal rather than a defect. The visible outside faces of the cabinet boxes are finished to match, hinges are supplied, fitted and adjusted, handle positions are drilled to the placement you choose, and the old doors and fronts are taken away.",
  white_oak:
    "The doors and drawer fronts on this quote are solid white oak: a natural wood door with a tighter, straighter grain than red oak, which shows through the finish, so no two doors look identical. Wood moves with the seasons, and fine lines opening and closing at the joints between rails and stiles are normal rather than a defect. The visible outside faces of the cabinet boxes are finished to match, hinges are supplied, fitted and adjusted, handle positions are drilled to the placement you choose, and the old doors and fronts are taken away.",
};

// Generic — used for any category not listed below, and for custom categories
// a company creates. Vague enough to be true of any trade, specific enough to
// beat a blank space.
//
// No `description`: a sentence true of every trade from roofing to dog walking
// would say nothing, and a heading over nothing is worse than neither.
const GENERIC = {
  accent: PALETTE.slate,
  included: [
    "All labour and equipment needed to complete the work described above",
    "Protection of surrounding surfaces and finishes while we're on site",
    "Cleanup and removal of our own debris on completion",
    "A walkthrough with you before the job is signed off",
  ],
  steps: VISIT_SERVICE_VERIFY,
};

// Only the trades where the wording genuinely differs get their own entry.
// Everything else inherits GENERIC, which is honest rather than padded.
const CONTENT = {
  // ── Coatings and finishes ────────────────────────────────────────────────
  interior_painting: {
    accent: PALETTE.denim,
    description:
      "We paint the rooms and surfaces priced above. Furniture is moved or covered and the floors protected, nail holes and cracks are filled, gaps caulked, and the surfaces sanded and primed where they need it before the finish coats go on. Only the surfaces listed above are painted — ceilings, trim, doors and closet interiors are separate lines and are included only where you see them priced.",
    included: [
      "Furniture moved or covered and floors protected throughout",
      "Nail holes and cracks filled, rough areas sanded, gaps caulked",
      "Primer applied where needed for colour change, repairs or bare surfaces",
      "Full coats of premium paint on every surface listed above",
      "Cut-in brushwork on trim, edges and detail rather than taped lines",
      "Outlet covers and hardware removed and refitted",
    ],
    steps: PREP_APPLY_FINISH,
  },
  exterior_painting: {
    accent: PALETTE.teal,
    description:
      "We wash the exterior surfaces priced above and let them dry, scrape back loose and peeling material, sand the rough areas, caulk the open joints and seams, prime the bare and repaired spots, and then apply the finish coats. Only the surfaces listed above are coated — trim, soffit, fascia, doors and shutters are separate lines and are included only where you see them priced.",
    included: [
      "Surfaces washed and left to dry properly before any coating goes on",
      "Loose and peeling material scraped back, rough areas sanded",
      "Joints, seams and gaps caulked; minor surface repairs made good",
      "Exterior-grade primer on bare and repaired areas",
      "Full coats of exterior paint on every surface listed above",
      "Site left clear of masking, drop sheets and debris",
    ],
    steps: PREP_APPLY_FINISH,
  },
  cabinet_refinishing: {
    accent: PALETTE.ochre,
    description:
      "We refinish the cabinets you already have. The doors, drawer fronts and the visible outside faces of the boxes are degreased, sanded, primed and sprayed with a new finish in the colour and sheen you choose. Nothing is replaced: the boxes, the layout and the door style stay exactly as they are, and the insides of the cabinets are not refinished unless a line above says so.",
    included: [
      "Colour and sheen agreed with you before anything is ordered",
      "Kitchen masked and contained so dust and overspray stay in the room",
      "Doors, drawer fronts and hardware removed, labelled and refitted",
      "All surfaces degreased, sanded and prepared for adhesion",
      "Primer applied to block staining and give the topcoat something to hold",
      "Sprayed topcoat on both faces of every door and drawer front",
      "Cabinet box exteriors finished to match",
      "Hardware refitted, doors realigned, and a walkthrough with you",
      // Additive prompts, withheld from the document until a company fills
      // them in. Each is a real TrueFinish line — "3-Coat BIN Shellac Primer",
      // "2-Coat Renner 2K Top Coat", "5-year anti-peeling warranty" — with the
      // brand, the count and the term left to the company that has to stand
      // behind them. The generic bullets above still print regardless.
      "Primer: [how many coats, and which primer you use]",
      "Topcoat: [how many coats, which product, and the catalyst ratio if you use one]",
      "Anti-peel warranty: [your term, and what it covers]",
      "Typical time on site: [how many days, start to walkthrough]",
    ],
    steps: CABINET_REFINISH_WORKFLOW,
  },
  cabinet_refacing: {
    accent: PALETTE.ochre,
    description: REFACE_DESCRIPTION,
    // QuoteScopeGroup.takeoff carries `doorMaterial` for this trade — see
    // createTradeConfig in lib/pricing/tradeScope.js — so the quote already
    // knows which door was sold and the scope text has no excuse to be vague.
    variantOn: "doorMaterial",
    // Plain words for the settings screen, which has to warn a company that
    // writing one paragraph of their own collapses all four of these.
    variantLabel: "the door material",
    variants: REFACE_DOOR_VARIANTS,
    included: [
      "Door style, colour and finish confirmed with you before ordering",
      "Every opening measured on site, so the doors are made to your kitchen",
      "New doors and drawer fronts made to those measurements",
      "Cabinet box exteriors finished to match the new fronts",
      "Hinges supplied, fitted and adjusted so the doors sit level",
      "Handle positions drilled to your chosen placement",
      "Existing doors, fronts and hardware removed and taken away",
      "Doors and drawers adjusted at handover, with a walkthrough",
      "Door construction and finish: [your supplier, and the finish you specify]",
      "Warranty on the doors and the finish: [your term, and what it covers]",
      "Typical time from order to installation: [your lead time]",
    ],
    steps: CABINET_REFACE_WORKFLOW,
  },
  stairs: {
    accent: PALETTE.clay,
    description:
      "We refinish the staircase as it stands. The walls, spindles and surrounding floor are masked, the components priced above are sanded back to bare wood, dents and gaps are filled, stain goes on where a colour has been chosen, and protective coats follow with a light sanding between them. Only the components listed above are refinished — treads, risers, balusters, newel posts, handrail and landing are separate lines. Replacing a component, rather than refinishing it, is separate work.",
    included: [
      "Surrounding walls, spindles and flooring masked and protected",
      "Treads and components sanded back ready for finish",
      "Gaps, dents and imperfections filled",
      "Stain applied evenly across all prepared surfaces",
      "Protective finish coats with light sanding between them",
      "Care and drying guidance at handover",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring: {
    accent: PALETTE.moss,
    description:
      "We refinish the wood floors you already have in the areas priced above. Loose boards are secured, then the floor is sanded through progressively finer grits to take the old finish off and level the surface, holes and gaps are filled, stain goes on where a colour has been chosen, and protective coats follow with screening between them. Boards damaged beyond what sanding can fix are replacement work and are priced separately.",
    included: [
      "Furniture moved as required and surrounding areas protected",
      "Loose boards secured and the floor checked before sanding",
      "Progressive sanding to remove the old finish and level the surface",
      "Nail holes and gaps filled before the final pass",
      "Stain applied uniformly where a colour has been selected",
      "Protective finish coats with screening between them",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring_install: { accent: PALETTE.moss, steps: MEASURE_SUPPLY_INSTALL },
  countertop: {
    accent: PALETTE.plum,
    description:
      "We template your cabinets on site, fabricate the countertop from the material priced above to those measurements, remove and dispose of the existing top, and install, level and seam the new one. The cutouts and the edge profile listed above are what is being made — anything not listed is not being cut. Disconnecting and reconnecting plumbing, electrical and gas is separate work and appears above only if you asked for it.",
    included: [
      "Material supplied to the specification set out above",
      "Templating on site so the fit is to your actual cabinets",
      "Existing countertop removed and disposed of",
      "Fabrication including edge profile and any cutouts listed",
      "Installation, levelling and seaming",
      "Joints, seams and the perimeter sealed",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
  },
  tiling: { accent: PALETTE.plum, steps: MEASURE_SUPPLY_INSTALL },
  drywall: { accent: PALETTE.slate, steps: SHELL_SEQUENCE },
  drywall_install: { accent: PALETTE.slate, steps: SHELL_SEQUENCE },

  // ── Mechanical and electrical ────────────────────────────────────────────
  plumbing: { accent: PALETTE.denim, steps: ASSESS_REPAIR_TEST },
  electrical: { accent: PALETTE.ochre, steps: ASSESS_REPAIR_TEST },
  hvac_install: { accent: PALETTE.teal, steps: MEASURE_SUPPLY_INSTALL },
  hvac_repair: { accent: PALETTE.teal, steps: ASSESS_REPAIR_TEST },
  appliance_repair: { accent: PALETTE.slate, steps: ASSESS_REPAIR_TEST },
  garage_door: {
    accent: PALETTE.slate,
    description:
      "We supply and install the door or doors priced above, with the tracks, springs, cables and hardware they run on, and the door is balanced and cycled under power before we leave. Capping and trim are separate lines and are included only where you see them priced. Electrical work, a new opener, and any change to the size or framing of the opening are separate work and are not included unless a line above says so.",
    steps: ASSESS_REPAIR_TEST,
  },
  locksmith: { accent: PALETTE.slate, steps: ASSESS_REPAIR_TEST },
  well_water: { accent: PALETTE.denim, steps: ASSESS_REPAIR_TEST },
  elevator_services: { accent: PALETTE.slate, steps: ASSESS_REPAIR_TEST },
  mechanical_contracting: { accent: PALETTE.denim, steps: ASSESS_REPAIR_TEST },
  installation_services: {
    accent: PALETTE.slate,
    steps: MEASURE_SUPPLY_INSTALL,
  },

  // ── Structure and envelope ───────────────────────────────────────────────
  roofing_service: {
    accent: PALETTE.rust,
    description:
      "We strip the existing roof covering off down to the deck, inspect the boards underneath, and build a new roof over them: underlayment, flashing at every wall, chimney, valley and vent, the covering priced above, and the ridge and intake ventilation the roof needs in order to dry. The stripped material is taken off site and the grounds are swept for nails before we leave. What is priced here is the roof surface listed above — soffit, fascia, eavestroughs, insulation and structural repair are separate work and appear only where you see them priced.",
    included: [
      "Existing material stripped and removed from site",
      "Decking inspected and any damaged sections reported before replacement",
      "Underlayment, flashing and ventilation as required",
      "New roofing installed to manufacturer specification",
      "Grounds cleared and swept for nails and debris",
    ],
    steps: MEASURE_SUPPLY_INSTALL,

    // The two things a roofer gets called about after the quote is signed.
    //
    // Saying them up front is not a hedge, it is the difference between a
    // change order the homeowner expected and an argument on day three. Every
    // one of these is a genuine unknown at quoting time — nobody can see the
    // deck through the shingles — and none of them is a price.
    mayChange: [
      {
        title: "More layers than expected",
        body: "This quote is priced on the layers we could see or probe. A second or third layer underneath is more removal time and more disposal, and we will tell you before we carry on.",
      },
      {
        title: "The condition of the decking",
        body: "The boards under the old roof cannot be inspected until it is off. Sound decking is roofed over as quoted; rotten sections are replaced at the sheet rate on this quote, counted and shown to you.",
      },
      {
        title: "Weather",
        body: "An open roof does not stay open overnight. A wet week moves the finish date and nothing else — the price does not change because it rained.",
      },
    ],

    // Plain-language definitions for the words this quote is written in.
    //
    // A roofing quote is priced in squares, by pitch, over decking, after a
    // tear-off, and a homeowner comparing three of them is being asked to
    // choose between documents in a vocabulary nobody taught them. Explaining
    // it costs a quarter of a page and is the cheapest trust in the product.
    glossary: [
      {
        term: "Square",
        body: "100 square feet of roof surface. The unit the whole trade orders and prices in — a 2,400 sq ft roof is 24 squares.",
      },
      {
        term: "Pitch",
        body: 'The slope, written as rise over a 12-inch run. A roof climbing 6 inches for every 12 across is "6/12". A pitched roof has more surface than the ground it covers, and a steeper one is slower to work on.',
      },
      {
        term: "Decking (sheathing)",
        body: "The structural panels over the rafters that everything else fastens to. Its condition is not knowable until the old covering is off.",
      },
      {
        term: "Tear-off",
        body: "Removing the existing covering. The layers priced here are stated on the quote; anything further is extra labour and extra disposal.",
      },
      {
        term: "Underlayment",
        body: "The membrane laid over the decking before the covering goes on. It is the layer that keeps water out when wind drives it under a shingle.",
      },
    ],
  },
  siding: {
    accent: PALETTE.rust,
    description:
      "We strip the existing cladding off the walls priced above, check the sheathing behind it and make good the sections this quote allows for, then install a weather barrier and the new cladding listed above, with trim at the corners, windows and doors. Only the walls priced above are re-clad. Soffit, fascia, eavestroughs, windows and insulation are separate lines and are included only where you see them priced.",
    steps: MEASURE_SUPPLY_INSTALL,
  },

  insulation: {
    accent: PALETTE.ochre,
    description:
      "We insulate the areas priced above to the R-value this quote states. The air leaks go first — top plates, penetrations and the hatch — because insulation slows heat but does not stop a draught, then the material is installed to the depth that R-value needs, with the ventilation path kept open where the assembly has one. Existing material stays in place unless a line above says it is being removed, and the depth actually installed is recorded and marked so it can be checked later.",
    included: [
      "Existing conditions and depth recorded before anything is covered up",
      "Air leaks sealed at top plates, penetrations and the hatch",
      "Ventilation path kept open where the assembly needs one",
      "Material installed to the depth the stated R-value requires",
      "Depth markers left in place and the work area cleared",
    ],
    // Konstruction Group's (Toronto) published spray-foam sequence, with their
    // own stated timelines. Kept because the ORDER is the useful part: the
    // scheduling step exists because foam goes in after mechanical rough-in and
    // after that inspection, and a homeowner who does not know that reads a
    // three-week gap as the contractor disappearing.
    steps: [
      {
        title: "Project review",
        body: "We go through the drawings or walk the space and agree exactly which areas are being insulated — basement, rim joists, garage ceiling, attic.",
        timeline: "1–2 days",
      },
      {
        title: "Quote",
        body: "Priced on the areas to be covered, the material, and the thickness each assembly needs to reach its R-value.",
        timeline: "2–4 days",
      },
      {
        title: "Scheduling",
        body: "Timed to start after framing and the mechanical and electrical rough-in are complete and inspected. Insulating before that inspection means opening it up again.",
        timeline: "As needed",
      },
      {
        title: "Site preparation",
        body: "Areas cleared, and windows, fixtures and finished surfaces masked and protected.",
        timeline: "1–2 hours",
      },
      {
        title: "Application",
        body: "Material installed to the specified depth, in multiple passes where the thickness calls for it.",
        timeline: "1–3 days",
      },
      {
        title: "Trimming and cleanup",
        body: "Excess trimmed flush with the framing, overspray cleaned, depth recorded, and the area handed over ready for the next trade.",
        timeline: "Same day",
      },
    ],
    mayChange: [
      {
        title: "What is found once the space is opened",
        body: "Wet, compacted or contaminated material has to come out before anything goes in, and knob-and-tube wiring or a bathroom fan venting into the attic has to be dealt with first. None of it is visible from the hatch.",
      },
      {
        title: "The depth the cavity can actually hold",
        body: "A closed cavity holds what it holds. Where the space cannot reach the target R-value in the material quoted, we will say so and give you the options rather than quietly install less.",
      },
    ],
    glossary: [
      {
        term: "R-value",
        body: "How well the assembly resists heat flow — higher is better. It is what a rebate programme and a building inspector both ask for, and it is why the depth on this quote is what it is.",
      },
      {
        term: "R per inch",
        body: "How much R each inch of a material delivers. It is why two materials reaching the same R-value are different depths, and why one of them may not fit.",
      },
      {
        term: "Air sealing",
        body: "Closing the gaps air actually moves through before covering them. Insulation slows heat; it does not stop a draught, and blowing over an unsealed attic is the most common reason a job underperforms.",
      },
      {
        term: "Baffle",
        body: "A channel that keeps the path from the soffit vent to the attic open once insulation is in. Without them the vents block and the roof deck stops drying.",
      },
    ],
  },
  masonry: { accent: PALETTE.rust, steps: MEASURE_SUPPLY_INSTALL },
  concrete: { accent: PALETTE.slate, steps: MEASURE_SUPPLY_INSTALL },
  paving: {
    accent: PALETTE.slate,
    description:
      "We excavate the area priced above, lay separation fabric, and build a granular base compacted in lifts, then lay the units listed above to the pattern agreed, squared to the house and finished with a border course. Edges are restrained, the joints are filled and compacted, and the surface is set to fall away from the building. The ground disturbed around the work is graded and made good. Utility relocation, drainage beyond the work area and permits are separate.",
    steps: MEASURE_SUPPLY_INSTALL,
  },
  driveway_sealing: {
    accent: PALETTE.slate,
    description:
      "We sweep and blow the surface clean, treat the oil and grease spots so the sealer will bond, mask the edges, and apply sealer across the driveway area priced above at the coat count this quote states. Sealing is maintenance on a sound surface: it slows water and sun damage. It does not repair asphalt that has already broken up, and it does not hide existing cracks or patches — crack filling is a separate line and is included only where you see it priced.",
    steps: PREP_APPLY_FINISH,
  },
  fence_services: { accent: PALETTE.moss, steps: MEASURE_SUPPLY_INSTALL },
  chimney_sweep: { accent: PALETTE.rust, steps: VISIT_SERVICE_VERIFY },
  restoration: { accent: PALETTE.rust, steps: ASSESS_REPAIR_TEST },
  excavation: { accent: PALETTE.clay, steps: PLAN_BUILD_HANDOVER },
  demolition: { accent: PALETTE.clay, steps: PLAN_BUILD_HANDOVER },
  demolition_contractor: { accent: PALETTE.clay, steps: PLAN_BUILD_HANDOVER },

  // The included list stops at what a standard inspection covers. Radon,
  // WETT, well and septic and air sampling are separate services with their
  // own price lines, and listing them here would promise them on a quote that
  // didn't sell them.
  home_inspection: {
    accent: PALETTE.denim,
    description:
      "We inspect the readily accessible areas and systems of the property and give you a written report, with photographs, of what we found and what it means. The inspection is visual and non-invasive: nothing is dismantled, no finished surface is opened, and stored belongings are not moved — so a defect hidden behind them is a defect we cannot report. Radon, air quality, wood-burning appliance, well and septic testing are separate services and are carried out only where you see them priced above.",
    included: [
      "A visual inspection of the readily accessible areas of the property",
      "Roof, exterior cladding, grading and drainage as far as they can be safely reached",
      "Structure, foundation, and the basement or crawlspace where it can be entered",
      "Heating, cooling, plumbing and electrical systems operated under their normal controls",
      "Interior finishes, windows, doors, attic insulation and ventilation",
      "A written report with photographs of the significant findings",
      "Time on site at the end to walk you through what was found",
    ],
    steps: INSPECT_REPORT_REVIEW,
  },

  // ── Whole-project ────────────────────────────────────────────────────────
  general_contracting: { accent: PALETTE.slate, steps: SHELL_SEQUENCE },
  general_contracting_reno: {
    accent: PALETTE.slate,
    steps: PLAN_BUILD_HANDOVER,
  },
  construction: { accent: PALETTE.slate, steps: SHELL_SEQUENCE },
  remodeling: { accent: PALETTE.clay, steps: PLAN_BUILD_HANDOVER },
  carpentry: { accent: PALETTE.ochre, steps: MEASURE_SUPPLY_INSTALL },
  handyman: { accent: PALETTE.slate, steps: VISIT_SERVICE_VERIFY },
  property_maintenance: { accent: PALETTE.slate, steps: VISIT_SERVICE_VERIFY },

  // ── Cleaning ─────────────────────────────────────────────────────────────
  residential_cleaning: {
    accent: PALETTE.teal,
    included: [
      "All cleaning products and equipment supplied by us",
      "Every room and surface listed above",
      "Fixtures, fittings and touchpoints wiped down",
      "Rubbish removed and bins relined",
    ],
    steps: VISIT_SERVICE_VERIFY,
  },
  deep_cleaning: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  commercial_cleaning: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  janitorial: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  carpet_cleaning: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  window_cleaning: { accent: PALETTE.denim, steps: VISIT_SERVICE_VERIFY },
  pressure_washing_house: {
    accent: PALETTE.denim,
    steps: VISIT_SERVICE_VERIFY,
  },
  pressure_washing_driveway: {
    accent: PALETTE.denim,
    steps: VISIT_SERVICE_VERIFY,
  },
  auto_detailing: { accent: PALETTE.denim, steps: VISIT_SERVICE_VERIFY },
  junk_removal: { accent: PALETTE.clay, steps: VISIT_SERVICE_VERIFY },

  // ── Grounds ──────────────────────────────────────────────────────────────
  landscaping_design: { accent: PALETTE.moss, steps: PLAN_BUILD_HANDOVER },
  lawn_care: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
  lawn_mowing: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
  irrigation: { accent: PALETTE.moss, steps: MEASURE_SUPPLY_INSTALL },
  tree_care_service: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
  snow_removal: {
    accent: PALETTE.denim,
    description:
      "We clear the areas priced above on the plan this quote states, for the season it covers. Markers go in before the snow so lawn edges and beds can be seen and kept out of the way. Walkways, steps and salting are separate lines and are cleared or treated only where you see them priced. Roofs, balconies and anything left in the clearing area and buried out of sight are not included.",
    steps: VISIT_SERVICE_VERIFY,
  },
  pest_control: { accent: PALETTE.ochre, steps: VISIT_SERVICE_VERIFY },
  pool_spa: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  dog_walking: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
  pooper_scooper: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
};

/**
 * Resolve the content for one scope group.
 *
 * Precedence, most specific first:
 *   1. What the company wrote for this category (CompanyServiceCategory)
 *   2. The default for that category key, here
 *   3. GENERIC
 *
 * Everything at the top level of the result is PRINTABLE: lines still carrying
 * an unfilled [placeholder] have already been removed. `draft` holds the same
 * content unfiltered, for the settings editor — which has to show a company
 * the brackets in order for them to fill any in — and `unfilled` lists what is
 * being withheld, so that screen can say so out loud.
 *
 * @param categoryKey  ServiceCategory.key; null for a group with no category
 * @param override     the CompanyServiceCategory row, when one was loaded
 * @param takeoff      QuoteScopeGroup.takeoff, when the group has one. Read
 *                     ONLY to pick a description variant — never returned, and
 *                     never sent to a client: a countertop takeoff carries
 *                     supplier cost and markup.
 */

export function resolveServiceContent(categoryKey, override, takeoff) {
  const base = ownProp(CONTENT, categoryKey) || {};

  const included =
    firstArray(override?.includedItems) || base.included || GENERIC.included;

  const steps =
    firstArray(override?.processSteps) || base.steps || GENERIC.steps;

  // A company override is one paragraph for the whole trade, so it wins over
  // the variant as well as over the default. That is a real loss of nuance for
  // a shop selling four door materials, and it is still their call — the same
  // trade-off includedItems has made since it shipped.
  const description =
    cleanString(override?.scopeDescription) || variantDescription(base, takeoff);

  const draft = {
    description,
    included,
    steps: steps.map((s, i) => ({ ...s, num: i + 1 })),
  };

  return {
    accent: override?.accentColor || base.accent || GENERIC.accent,
    // "" rather than a generic sentence. A trade with nothing specific to say
    // renders no paragraph at all, not a heading over filler.
    description: finished(description) ? description : "",
    included: included.filter(finished),
    // Numbered here rather than in the data, so reordering or removing a step
    // can't leave a document numbered 1, 2, 4. Numbered AFTER the filter for
    // the same reason.
    steps: steps.filter(finishedEntry).map((s, i) => ({ ...s, num: i + 1 })),
    // Both default to EMPTY, not to generic filler.
    //
    // "What could change this price" and a glossary are only worth printing
    // when the trade has real unknowns and real jargon. Padding every quote
    // with a plausible-sounding version would train clients to skip the part
    // that matters on the quotes where it does — and inventing "your price may
    // change if..." on behalf of a contractor who did not say it is a contract
    // term they never agreed to, which is the rule the rest of this file is
    // written to.
    mayChange: (Array.isArray(base.mayChange) ? base.mayChange : []).filter(
      finishedEntry,
    ),
    glossary: (Array.isArray(base.glossary) ? base.glossary : []).filter(
      finishedEntry,
    ),
    draft,
    unfilled: collectPlaceholders(draft),
    // Null for every trade with one paragraph. Read by Settings > Services so
    // a company overwriting the default is told what it is giving up.
    variesWith: cleanString(base.variantLabel) || null,
  };
}

/**
 * The paragraph for what was actually chosen on this takeoff.
 *
 * Falls back to the trade-level text whenever the field is missing, blank or
 * unrecognised. That fallback is the whole safety property: describing a
 * painted, sanded, sprayed process on a thermofoil door is not a wording
 * mistake, it is a scope of work the contractor would be held to.
 */
function variantDescription(base, takeoff) {
  const trade = cleanString(base.description);
  const field = base.variantOn;
  if (!field || !takeoff || typeof takeoff !== "object") return trade;

  const chosen = takeoff[field];
  if (typeof chosen !== "string" || !chosen) return trade;

  // Own-property lookup: `doorMaterial` arrives from stored JSON, and
  // variants["__proto__"] is truthy on any plain object.
  return cleanString(ownProp(base.variants, chosen)) || trade;
}

const cleanString = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function ownProp(map, key) {
  return map &&
    typeof map === "object" &&
    typeof key === "string" &&
    Object.prototype.hasOwnProperty.call(map, key)
    ? map[key]
    : undefined;
}

/** A line is printable when it is real text with no bracket left in it. */
function finished(line) {
  return (
    typeof line === "string" &&
    line.trim().length > 0 &&
    unfilledPlaceholders(line).length === 0
  );
}

/** The same test for the { title, body } and { term, body } shapes. */
function finishedEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  const parts = [entry.title, entry.term, entry.body, entry.timeline]
    .filter((p) => typeof p === "string" && p.length)
    .join("\n");
  return Boolean(entry.title || entry.term) && !unfilledPlaceholders(parts).length;
}

/**
 * Every bracket still open across a trade's wording, deduplicated.
 *
 * Settings > Services prints this so a company can see what it is not sending.
 * Without it the withholding above is invisible, which is its own version of a
 * control that appears to work — a bullet a company wrote and never saw print.
 */
function collectPlaceholders(draft) {
  const parts = [
    draft.description,
    ...draft.included.filter((i) => typeof i === "string"),
    ...draft.steps.flatMap((s) => [s?.title, s?.body, s?.timeline]),
  ].filter((p) => typeof p === "string" && p.length);
  return [...new Set(parts.flatMap((p) => unfilledPlaceholders(p)))];
}

function firstArray(v) {
  return Array.isArray(v) && v.length ? v : null;
}

/**
 * Process steps for a whole quote.
 *
 * A multi-service quote would otherwise repeat five near-identical steps per
 * trade — fifteen numbered bubbles saying much the same thing, which reads as
 * padding rather than as thoroughness. So the steps shown once at the bottom
 * are those of the LARGEST scope group by value, which is the work the client
 * is really deciding about. Each group still carries its own "what's included"
 * inline, because that part genuinely differs.
 */
export function dominantProcessSteps(groups = []) {
  if (!groups.length)
    return GENERIC.steps.map((s, i) => ({ ...s, num: i + 1 }));

  const biggest = [...groups].sort(
    (a, b) => Number(b.subtotal || 0) - Number(a.subtotal || 0),
  )[0];

  return resolveServiceContent(biggest?.categoryKey, biggest?.override).steps;
}

/**
 * The glossary for a whole quote, from the largest scope group by value.
 *
 * Same reasoning as dominantProcessSteps: repeating a definitions panel per
 * trade on a three-trade quote reads as padding. The client is deciding about
 * the biggest piece of work, so that trade's vocabulary is the one worth
 * explaining. Returns [] when that trade has no glossary, and the renderer
 * shows nothing rather than a heading over an empty box.
 */
export function dominantGlossary(groups = []) {
  if (!groups.length) return [];
  const biggest = [...groups].sort(
    (a, b) => Number(b.subtotal || 0) - Number(a.subtotal || 0),
  )[0];
  return resolveServiceContent(biggest?.categoryKey, biggest?.override)
    .glossary;
}

export { PALETTE as SERVICE_PALETTE };
