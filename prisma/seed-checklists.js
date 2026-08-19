// prisma/seed-checklists.js
//
//   npm run seed:checklists
//
// The per-trade starter checklists — the SYSTEM library (companyId null), so
// every company sees the same rows and nobody has to type "mask the counters"
// on their first kitchen.
//
// ── Offered, never applied ─────────────────────────────────────────────────
//
// Nothing in here gets stamped onto a real visit on its own. A seeded list is
// a suggestion in a picker; a crew's checklist only ever contains what
// somebody ticked. This is the same rule as opening hours: absence of a
// statement is not a statement, and a company that hasn't chosen a checklist
// has not told us their process. Inventing one and putting it on a work order
// under their name would be worse than showing nothing.
//
// ── Why these are rows and not a constant file ─────────────────────────────
//
// They're editable-by-copy: "Use this" writes the items into the company's own
// template so they can change the wording, and the copy has to point at a
// ServiceCategory the same way a hand-written one does. A JS constant would
// need a parallel path through every route that reads templates.
//
// ── Writing items ──────────────────────────────────────────────────────────
//
// Trade-specific and in a contractor's voice. "Test dead with a meter you've
// just proved on a live circuit" earns its place on a list; "ensure safety
// protocols are observed" does not — a step nobody can act on trains people to
// tick the whole list without reading it, which is worse than no list at all.
import "dotenv/config";
import { db } from "../lib/db.js";

// Kept in step with lib/jobs/checklistItems.js. Duplicated as literals rather
// than imported because this file runs under plain node, where the "@/" alias
// the rest of the codebase uses doesn't resolve.
const PHASES = ["pre", "during", "post"];
const PHASE_NAMES = {
  pre: "before the work",
  during: "on the job",
  post: "before you leave",
};

// Each entry seeds one template per phase for EVERY key it lists. Keys are
// grouped only where the work is genuinely the same job under two names —
// "Flooring" and "Flooring Installation" are one trade with two catalogue
// entries, so they share a list rather than getting a thinner one each.
const CHECKLISTS = [
  // ── Painting & finishing ────────────────────────────────────────────────
  {
    keys: ["interior_painting"],
    pre: [
      "Confirm the colour, sheen and which rooms are in scope — in writing",
      "Walk the rooms and photograph existing damage before you touch anything",
      "Move furniture to the centre and sheet it",
      "Mask floors, trim, outlets and switch plates",
      "Check you have enough paint for two coats — a mid-job colour run never matches",
      "Fill, sand and spot-prime nail holes and cracks",
      "Ask where to park and which door to use",
    ],
    during: [
      "Cut in ceilings and edges before rolling",
      "Two coats unless the client agreed otherwise in the quote",
      "Keep a wet edge — stopping mid-wall shows",
      "Ventilate, and keep pets and kids out of the room",
      "Check coverage under a work light, not daylight",
      "Wipe drips off trim and glass before they set",
    ],
    post: [
      "Pull the tape while the last coat is still soft",
      "Second-coat any holidays you find on the final walk",
      "Put furniture and switch plates back",
      "Vacuum, and take every sheet, tin and roller with you",
      "Walk the job with the client, room by room",
      "Photograph the finished rooms for the gallery",
      "Leave touch-up paint labelled with the room and the colour",
    ],
  },
  {
    keys: ["exterior_painting"],
    pre: [
      "Check the forecast — no rain or dew inside the dry time",
      "Pressure wash, then let the surface dry properly",
      "Scrape, sand and spot-prime bare wood",
      "Caulk gaps around trim, windows and doors",
      "Cover plants, walkways, the driveway and the AC unit",
      "Mask windows, lights and house numbers",
      "Set ladders and staging on solid ground and check the footings",
    ],
    during: [
      "Work in shade — paint on a hot sunlit wall flashes",
      "Two coats anywhere bare or previously failed",
      "Move the ladder rather than over-reaching",
      "Keep off aluminium and gutters unless they're in scope",
      "Stop early enough that the last coat dries before dew",
    ],
    post: [
      "Pull the masking off windows and light fittings",
      "Uncover the plants and rinse overspray off the walkway",
      "Walk the perimeter with the client — look up, not just at eye level",
      "Photograph each elevation",
      "Clear every ladder, tin and drop cloth off the property",
    ],
  },
  // Cabinet refinishing carries more items than anything else here, and that's
  // deliberate: it's the job where a skipped step doesn't show on handover day,
  // it shows six months later as a door peeling at the handle. Trimming this to
  // a tidy six would drop the steps that are actually load-bearing.
  //
  // ── Split from cabinet_refacing ────────────────────────────────────────────
  //
  // These two used to share one list, which broke this file's own grouping rule
  // — keys share a list only when it's the same job under two names. Refacing
  // veneers the boxes and hangs new doors; nobody grain-fills an oak front they
  // are about to throw away. Refacing keeps the list below, unchanged, because
  // it's the one it already had.
  //
  // ── Where the numbers come from ────────────────────────────────────────────
  //
  // Grits, coat counts and the two cure windows are from the cabinet painting
  // guide the owner supplied, and nowhere else. Where the guide gives a figure
  // this list gives that figure; where it says "per the tin", so does this
  // list. A checklist that states a recoat window nobody verified reads exactly
  // as authoritative as one that's right, and a crew that trusts it has a
  // failed finish and no way to know why.
  {
    keys: ["cabinet_refinishing"],
    pre: [
      "Confirm the colour, the sheen, and whether the box interiors are in scope",
      "Protect the floor, the countertops, the backsplash and the walls",
      "Cover the appliances, and hang a dust barrier — overspray travels further than you'd think",
      "Photograph every door and drawer in place, and how each one hangs — hinge side, which edge is up",
      "Number every door and drawer front and log the opening it came out of",
      "Tape over each number so it survives the degreaser and the spray",
      "Take the doors and drawer fronts off and lay them out clean — sawhorses or a covered table, not the bare floor",
      "Bag the hinges, knobs and pulls per door and label the bag",
      "Fill the old screw holes and drill any new hardware holes now, before a drop of primer goes on",
      "If you're hanging them to spray, drill the hanging holes in the top or bottom edge where nobody will see them",
    ],
    during: [
      "Degrease every piece — faces, edges, backs, and hardest around the handles — then rinse and let it dry",
      "Degrease the boxes and face frames too; kitchen grease is why cabinet finishes peel",
      "Scuff sand at 120–150 grit until the shine is dull — you're keying the old finish, not stripping it",
      "Grain-fill oak and open-grain fronts and sand them back, or the grain telegraphs through the topcoat",
      "Vacuum, then wipe every piece with a tack cloth or pre-paint cleaner — a settled speck is a re-sand",
      "Hang them, or lay them flat on pyramids; anything resting on its face picks up a mark",
      "Prime the backs first, two thin coats, each one dry before you flip it",
      "Prime the fronts the same way — laminate and thermofoil need a bonding primer made for slick surfaces",
      "Denib the primer at 320 grit or finer and tack it off before the topcoat",
      "Two light topcoats of a cabinet-grade enamel — one heavy coat runs and you'll sand it back",
      "Let each coat dry to the tin, not to the clock",
      "Same order on the boxes and face frames: clean, scuff, prime twice, topcoat twice",
    ],
    post: [
      "Give the final coat 48–72 hours before anything gets rehung — it's dry long before it's hard",
      "Rehang doors and drawers to their numbers and photos, then adjust the hinges until the gaps are even",
      "Check every door swings freely and closes flush, and that the drawers run",
      "Clean the countertops and floor and pull all masking and the dust barrier",
      "Tell the client: no heavy use and nothing gets cleaned for 7 days while the finish hardens",
      "Photograph the finished kitchen",
      "Leave the touch-up kit and the care instructions",
    ],
  },
  {
    keys: ["cabinet_refacing"],
    pre: [
      "Number every door and drawer front and log where it came from",
      "Photograph the existing hinges and hardware before removal",
      "Confirm the finish, the sheen, and whether the interiors are in scope",
      "Degrease every surface — grease is why cabinet finishes peel",
      "Mask the countertops, appliances, floor and backsplash",
      "Set up the spray area with proper extraction",
    ],
    during: [
      "Sand, clean and tack every face before coating",
      "Prime, then check for grain telegraphing before the topcoat",
      "Thin coats — one heavy coat runs and you'll sand it back",
      "Keep the dust down; a settled speck is a re-sand",
      "Let each coat cure to the tin, not to the clock",
    ],
    post: [
      "Rehang doors and drawers to their numbers and adjust the hinges",
      "Check every door swings freely and closes flush",
      "Clean the countertops and floor and pull all masking",
      "Tell the client not to load the cabinets until the full cure time is up",
      "Photograph the finished kitchen",
      "Leave the touch-up kit and the care instructions",
    ],
  },
  {
    keys: ["epoxy"],
    pre: [
      "Moisture-test the slab — a wet slab delaminates whatever you put on it",
      "Grind or shot-blast to the profile the product data sheet asks for",
      "Fill the cracks and spalls and let them cure",
      "Vacuum until the slab is genuinely dust free",
      "Check the temperature and dew point against the data sheet",
      "Confirm the colour, the flake and the topcoat with the client",
    ],
    during: [
      "Mix full kits for the stated time — a part-mixed kit doesn't cure",
      "Watch the pot life; on a hot day it's half what the tin says",
      "Keep a wet edge and work to a break line",
      "Broadcast flake to refusal if it's in scope",
    ],
    post: [
      "Tape the area off and tell the client how long before foot and vehicle traffic",
      "Scrape and clear the loose flake once it's cured",
      "Clear the grinder, the vacuum and every tin off site",
      "Photograph the finished floor",
    ],
  },
  {
    keys: ["parging"],
    pre: [
      "Sound the wall and knock off anything hollow or loose",
      "Clean the surface and dampen it — dry block sucks the mix dry",
      "Check the weather: no frost tonight, no baking sun today",
      "Protect the walkway, the beds and the windows",
    ],
    during: [
      "Mix consistently — a colour change between batches shows forever",
      "Even coats to the agreed thickness, not thicker in one spot",
      "Finish the texture while it's still workable",
      "Keep the bottom edge clean off the ground",
    ],
    post: [
      "Cover or mist the work if it's drying too fast",
      "Clean splatter off the walkway and the beds",
      "Tell the client not to touch it until it's cured",
      "Photograph the finished wall",
    ],
  },

  // ── Interiors & carpentry ───────────────────────────────────────────────
  {
    keys: ["countertop"],
    pre: [
      "Check the cabinets are level and shimmed before you template",
      "Confirm the seam positions and the overhangs with the client on site",
      "Confirm sink, tap and cooktop cutouts against the actual fixtures",
      "Measure the doorways and stairs the slab has to come through",
      "Arrange enough hands for the lift",
    ],
    during: [
      "Dry-fit before you commit to any adhesive",
      "Support the overhangs to spec",
      "Cut with water or dust extraction",
      "Level and shim, then check with a straightedge across the seams",
      "Seal the seams and colour-match the fill",
    ],
    post: [
      "Reconnect the plumbing and run it for ten minutes",
      "Seal the stone if the material needs it",
      "Clean the tops and clear all off-cuts and slurry",
      "Show the client where the seams are and hand over the care instructions",
      "Photograph the finished tops",
    ],
  },
  {
    keys: ["flooring", "flooring_install"],
    pre: [
      "Check the subfloor is flat, dry and sound — take a moisture reading",
      "Let the flooring acclimatise in the room for the stated time",
      "Confirm the layout direction and the starting wall with the client",
      "Check every box is the same batch and lot number",
      "Clear and protect the room, and plan where the offcuts go",
    ],
    during: [
      "Pull from three or four boxes at once so the pattern doesn't repeat",
      "Keep the expansion gap at every wall and fixed object",
      "Stagger the end joints — no ladder patterns",
      "Undercut the door casings rather than scribing around them",
      "Check for hollow spots and lippage as you go",
    ],
    post: [
      "Fit the trim, thresholds and transition strips",
      "Clean with the manufacturer's product only — the wrong cleaner voids the warranty",
      "Walk the floor with the client under a raking light",
      "Say how long before furniture and rugs go back",
      "Photograph the finished floor",
      "Leave the spare boxes and the warranty paperwork",
    ],
  },
  {
    keys: ["stairs"],
    pre: [
      "Measure every rise and run — no two treads match in an old house",
      "Confirm the tread, riser and nosing profile with the client",
      "Check the stringers for rot or movement",
      "Agree how the household gets upstairs while you work",
    ],
    during: [
      "Dry-fit each tread before glue",
      "Glue and mechanically fix — squeaks come back otherwise",
      "Keep the rise consistent within code tolerance",
      "Check handrail height and baluster spacing against code",
    ],
    post: [
      "Test every tread for movement and squeak",
      "Fill, sand and finish the nosings",
      "Vacuum the whole flight and the landing",
      "Walk the stairs with the client, up and down",
      "Photograph the finished flight",
    ],
  },
  {
    keys: ["drywall", "drywall_install"],
    pre: [
      "Confirm the finish level the client is actually paying for",
      "Check the framing is straight and the blocking is in",
      "Confirm electrical, plumbing and insulation are signed off before you close it up",
      "Sheet the floor and seal off the rest of the house",
      "Set up dust extraction — drywall dust travels",
    ],
    during: [
      "Screw to the pattern; dimple without breaking the paper",
      "Stagger the butt joints away from openings",
      "Tape, coat, and let each coat dry properly",
      "Sand between coats and light-check with the lamp held flat to the wall",
    ],
    post: [
      "Final sand and light-check every wall and ceiling",
      "Vacuum the dust off every surface, including the tops of doors",
      "Prime before you call it done — bare mud and paper take paint differently",
      "Clear all offcuts and buckets off site",
      "Walk it with the client under the work light",
    ],
  },
  {
    keys: ["tiling"],
    pre: [
      "Check the substrate is flat, sound, and waterproofed where it needs to be",
      "Dry-lay the layout and agree the starting point and the cuts with the client",
      "Blend the boxes — same batch, mixed as you lay",
      "Confirm the grout colour against a dried sample, not a wet one",
      "Protect the tub, the tray and the floor",
    ],
    during: [
      "Back-butter large format and check coverage on a lifted tile",
      "Keep the joints consistent with spacers or a levelling system",
      "Check for lippage as you go, not at the end",
      "Cut wet and keep the dust down",
    ],
    post: [
      "Grout, then wipe the haze before it sets",
      "Silicone the internal corners and changes of plane — not grout",
      "Clean the tile and clear the offcuts and slurry",
      "Tell the client how long before it gets wet or walked on",
      "Photograph the finished work",
    ],
  },
  {
    keys: ["carpentry"],
    pre: [
      "Confirm the material, grade and finish with the client",
      "Measure the actual opening — never build to the drawing alone",
      "Check the wall or floor is square before you cut to it",
      "Set the cut station up outside, or with extraction",
    ],
    during: [
      "Mark from one end so your errors don't stack",
      "Dry-fit before glue or nails",
      "Scribe to the wall rather than filling the gap",
      "Keep the reveals and joints consistent",
    ],
    post: [
      "Fill, sand and check every joint under a light",
      "Vacuum the shavings and dust off every surface",
      "Walk the work with the client",
      "Photograph the finished carpentry",
      "Take the offcuts and packaging with you",
    ],
  },
  {
    keys: ["handyman"],
    pre: [
      "Walk every item on the list with the client before starting anything",
      "Agree what's in scope today and what needs a second visit",
      "Check you have the parts and fixings for each item",
      "Photograph anything already damaged",
    ],
    during: [
      "Finish one item before starting the next",
      "Tell the client straight away if something opens up bigger than quoted",
      "Clean up each item's mess before moving rooms",
    ],
    post: [
      "Test every fix with the client watching",
      "Go through the list and mark what's done and what's outstanding",
      "Take the old parts and packaging away",
      "Photograph the completed work",
    ],
  },
  {
    keys: ["demolition", "demolition_contractor"],
    pre: [
      "Confirm what stays — photograph it and mark it",
      "Test for asbestos and lead before anything gets broken",
      "Have the utilities capped, isolated, and confirmed dead",
      "Confirm the permits are on site",
      "Check what's load-bearing before you touch it",
      "Protect the floors, stairs and doorways on the route out",
      "Confirm the bin is booked and where it drops",
    ],
    during: [
      "Respirator and eye protection all day, not just at the start",
      "Keep the water and the dust down as you go",
      "Sort the material as you pull it — sorting a mixed pile costs more than the bin",
      "Keep the exit route clear",
      "Stop and reassess anything you didn't expect to find",
    ],
    post: [
      "Sweep, then magnet-sweep for screws and nails",
      "Check for exposed wiring, open pipe and open floor before you leave",
      "Confirm the bin is collected",
      "Photograph the cleared space from every corner",
      "Walk it with the client and confirm nothing that should have stayed went",
    ],
  },
  {
    keys: [
      "general_contracting",
      "general_contracting_reno",
      "remodeling",
      "construction",
    ],
    pre: [
      "Confirm the permits are issued and posted on site",
      "Walk the scope with the client and the crew on the same day",
      "Confirm the material deliveries and where they'll be stored",
      "Agree working hours, parking and bathroom with the client",
      "Protect the floors and seal off the live parts of the house",
      "Confirm the subs are booked in the right order",
    ],
    during: [
      "Hold the inspections before you cover anything up",
      "Photograph inside every wall before it closes",
      "Get change orders signed before the work happens, not after",
      "Walk the site at the end of each day and leave it safe",
      "Update the client weekly, even when nothing changed",
    ],
    post: [
      "Build the deficiency list with the client — don't wait for theirs",
      "Close out every permit and inspection",
      "Final clean, including the windows and the insides of the cabinets",
      "Hand over the manuals, warranties and paint colours",
      "Photograph every finished space",
    ],
  },

  // ── Mechanical trades ───────────────────────────────────────────────────
  {
    keys: ["plumbing"],
    pre: [
      "Find the main shutoff and test that it actually shuts off",
      "Confirm the symptom with whoever noticed it, not just the booking note",
      "Check you have the right fittings and the right size before cutting anything",
      "Towels and a drip tray down — you will find water",
      "Photograph the existing setup before you take it apart",
    ],
    during: [
      "Drain the line before you open it",
      "Support the pipe either side of any cut",
      "Watch for hidden wiring behind the wall",
      "Fit shutoffs where there weren't any — cheapest thing you'll ever do for the next call",
      "Dry-fit, then solder or glue",
    ],
    post: [
      "Pressure test and run every fixture on the line",
      "Check under the sink and the ceiling below after ten minutes",
      "Show the client the shutoff and how to use it",
      "Clean the work area and take the old parts away",
      "Photograph the finished work and the model numbers of anything installed",
    ],
  },
  {
    keys: ["electrical"],
    pre: [
      "Identify the circuit at the panel and lock it out",
      "Test dead with a meter you've just proved on a live circuit",
      "Check what needs a permit and an inspection before you start",
      "Photograph the existing wiring and the panel schedule",
      "Confirm outlet heights and switch positions with the client",
    ],
    during: [
      "Test dead again every time you come back to it",
      "Match the wire gauge to the breaker — no exceptions",
      "Keep grounds and neutrals correct, and separated where required",
      "Secure and staple the cable to code",
      "Label as you go — the next person is usually you",
    ],
    post: [
      "Test every device with a tester, not by eye",
      "Update the panel schedule",
      "Fit covers and plates on everything you opened",
      "Book the inspection if the work needs one",
      "Show the client what changed, and clean up",
    ],
  },
  {
    keys: ["hvac_install"],
    pre: [
      "Confirm the model, the capacity and the location with the client",
      "Check the electrical supply and the breaker size the unit needs",
      "Check the clearances around both the indoor and outdoor units",
      "Confirm the condensate route and where it drains to",
      "Protect the floor along the route in",
    ],
    during: [
      "Set the outdoor pad level",
      "Pressure test and vacuum the lines before charging",
      "Insulate the line set fully — bare line sweats and drips",
      "Fall the condensate line the whole way, no sags",
      "Torque the electrical connections",
    ],
    post: [
      "Run it in heating and cooling and check the temperature split",
      "Check the condensate actually drains",
      "Register the warranty in the client's name",
      "Set the thermostat up and show the client how it works",
      "Clear the packaging and the old equipment off site",
      "Photograph the data plate and the serial numbers",
    ],
  },
  {
    keys: ["hvac_repair"],
    pre: [
      "Ask what it's doing and when it started",
      "Check the thermostat and the filter before anything else",
      "Kill the power at the disconnect and confirm it's dead",
      "Photograph the model and serial plate",
    ],
    during: [
      "Read the pressures and temperatures before changing any parts",
      "Check the capacitor and contactor — most no-cools stop here",
      "Look for the cause, not just the failed part",
      "Clean the coil and the condensate trap while you're in there",
    ],
    post: [
      "Run a full cycle and confirm the fault is actually gone",
      "Show the client the reading before and after",
      "Tell them what caused it and what to watch for",
      "Note the filter size for next time",
      "Clear the old parts and the packaging",
    ],
  },
  {
    keys: ["appliance_repair"],
    pre: [
      "Get the model and serial number before you go — half these calls need a part",
      "Ask what it's doing and when it started",
      "Unplug it or kill the breaker, and confirm it's dead",
      "Protect the floor before you pull it out",
    ],
    during: [
      "Check the simple things first: power, door switch, filter, drain",
      "Read the error code against the service manual, not from memory",
      "Photograph the wiring before you disconnect anything",
      "Look for a second failure — parts rarely fail alone",
    ],
    post: [
      "Run a full cycle before you pack up",
      "Push it back, level it, and check the door seals",
      "Show the client what failed and what to watch for",
      "Take the old part and the packaging away",
    ],
  },
  {
    keys: ["locksmith"],
    pre: [
      "Confirm the person has the right to be let in — ID and proof of address",
      "Photograph the existing hardware and the condition of the door",
      "Check the door and frame for damage before you touch the lock",
      "Confirm how many keys they need",
    ],
    during: [
      "Try the non-destructive method first, always",
      "Check the strike and the alignment, not just the cylinder",
      "Key alike where the client asked for it",
    ],
    post: [
      "Test every key in every lock, from both sides",
      "Check the door latches without lifting it",
      "Hand over every key and account for the old ones",
      "Explain the warranty and sweep up the filings",
    ],
  },
  {
    keys: ["garage_door"],
    pre: [
      "Never touch a torsion spring without the winding bars and the training",
      "Disconnect the opener and the power before working on the door",
      "Check the tracks, rollers, cables and springs and photograph anything worn",
      "Clear the area under the door",
    ],
    during: [
      "Keep the tracks plumb and the door balanced",
      "Replace cables and springs in pairs",
      "Set the force and travel limits to spec",
      "Test the photo eyes",
    ],
    post: [
      "Run the door through five full cycles",
      "Test the auto-reverse with a 2x4 flat on the floor",
      "Lubricate the rollers, hinges and springs",
      "Show the client the manual release and how to use it",
      "Clear the old parts and the packaging",
    ],
  },

  // ── Exterior & site ─────────────────────────────────────────────────────
  {
    keys: ["roofing_service"],
    pre: [
      "Check the forecast for the whole install window, not just today",
      "Confirm the tie-off points and set the harness before anyone goes up",
      "Check the deck for soft spots from inside the attic",
      "Protect the landscaping, the driveway and the AC unit",
      "Confirm the bin, the material drop and where the truck parks",
      "Confirm the permit is on site",
    ],
    during: [
      "Only tear off what you can dry in the same day",
      "Replace rotten decking rather than covering it",
      "Ice and water shield at the eaves, valleys and penetrations",
      "Flash every penetration properly — nearly every leak is flashing",
      "Nail to the manufacturer's pattern, or the warranty is void",
    ],
    post: [
      "Magnet-sweep the whole perimeter twice, lawn included",
      "Clear the gutters of nails and granules",
      "Check the attic for daylight",
      "Photograph the finished roof and every penetration",
      "Walk the property with the client and hand over the warranty",
    ],
  },
  {
    keys: ["siding"],
    pre: [
      "Confirm the profile, the colour and the trim details with the client",
      "Check the sheathing and house wrap where you'll be opening up",
      "Protect the plants and set the ladders on solid footing",
      "Agree what happens at the windows, the doors and the electrical meter",
    ],
    during: [
      "Keep the courses level and check every few rows",
      "Leave the expansion gaps the manufacturer specifies",
      "Flash and tape every opening",
      "Don't nail tight — vinyl and fibre cement both need to move",
    ],
    post: [
      "Fit the trim, the corners and the J-channel",
      "Caulk where the spec calls for it, and only there",
      "Clear the offcuts and magnet-sweep for nails",
      "Walk each elevation with the client",
      "Photograph the finished elevations",
    ],
  },
  {
    keys: ["concrete"],
    pre: [
      "Confirm the pour time, the mix and the truck access",
      "Check the base is compacted and to depth",
      "Check the forms are square, braced and to grade",
      "Confirm the rebar or mesh placement and the chairs",
      "Check the weather — heat, cold and rain each change the plan",
      "Have enough hands on site before the truck arrives",
    ],
    during: [
      "Check the slump before you take the load",
      "Place, screed and bull float without over-working the surface",
      "Wait for the bleed water to leave before you finish",
      "Cut or tool the joints before it cracks where it wants to",
      "Broom the finish in one direction",
    ],
    post: [
      "Cure it — cover or spray — and tell the client not to drive on it",
      "Strip the forms when it's ready, not when you're leaving",
      "Clear the forms, stakes and washout off site",
      "Photograph the finished slab",
      "Say when they can use it and when to seal it",
    ],
  },
  {
    keys: ["masonry"],
    pre: [
      "Confirm the brick or stone, the bond and the joint profile with the client",
      "Check the footing and the base are sound and to depth",
      "Mix a sample and let it dry — wet mortar is not mortar colour",
      "Protect the finished surfaces below the work",
    ],
    during: [
      "Keep the courses level and the joints consistent",
      "Strike the joints at the right stiffness",
      "Keep the weep holes clear",
      "Brush and clean as you go — set mortar doesn't come off",
    ],
    post: [
      "Wash the face down with the right cleaner for the material",
      "Cover the work if rain or frost is coming",
      "Clear the offcuts, the sand and the mixer off site",
      "Walk it with the client and photograph the finished work",
    ],
  },
  {
    keys: ["excavation"],
    pre: [
      "Call for utility locates and wait for the marks — every time, no exceptions",
      "Confirm the depth, the grade and where the spoil goes",
      "Check the ground conditions and the access for the machine",
      "Check for a permit and any shoring requirement",
      "Protect the driveway and the lawn on the route in",
    ],
    during: [
      "Nobody in a trench over four feet without shoring or a slope",
      "Spoil pile back from the edge",
      "Stop the moment you hit anything unmarked and confirm what it is",
      "Keep the machine's swing zone clear of people",
    ],
    post: [
      "Backfill in lifts and compact each one",
      "Restore the grade and the surface you disturbed",
      "Clean the mud off the road and the driveway",
      "Photograph the finished grade and anything you found buried",
    ],
  },
  {
    keys: ["paving"],
    pre: [
      "Confirm the layout, the edges and the drainage fall with the client",
      "Check the base depth and compaction",
      "Confirm the material delivery and where the truck can get in",
      "Check the weather — asphalt and sealer both want dry and warm",
      "Protect the garage apron, the walks and anything you'll edge to",
    ],
    during: [
      "Keep the fall away from the building, always",
      "Compact in lifts, not all at once",
      "Keep the joints tight and hot where it matters",
      "Edge-restrain pavers before you sand",
    ],
    post: [
      "Sweep the surface and the surrounding walks",
      "Tell the client how long before they drive or park on it",
      "Clear the offcuts, the base material and the equipment",
      "Photograph the finished surface",
    ],
  },
  {
    keys: ["fence_services"],
    pre: [
      "Call for utility locates and wait for the marks",
      "Confirm the property line with the client — in writing if it's near a neighbour",
      "Check for a permit and the height limit",
      "Confirm the gate positions and which way they swing",
      "Check the post depth against the frost line",
    ],
    during: [
      "String a line and keep the posts to it",
      "Set the posts plumb, and let the concrete set before hanging anything",
      "Level top rail or follow the grade — agree which before you start",
      "Check gate clearance and hardware before the final fixing",
    ],
    post: [
      "Open and close every gate and adjust the hardware",
      "Backfill and rake the post holes flat",
      "Clear the offcuts and the spoil off site",
      "Walk the line with the client",
      "Photograph the finished fence",
    ],
  },
  {
    keys: ["restoration"],
    pre: [
      "Document everything with photos and moisture readings before you touch it",
      "Confirm the claim number and who is authorising the work",
      "Test for asbestos, lead and mould before any demolition",
      "Contain the affected area, and set up negative air if it's needed",
      "Confirm what the client wants saved and what's going",
    ],
    during: [
      "Log moisture readings daily until they're dry",
      "Keep the containment intact every time you go in and out",
      "Photograph everything you remove and everything behind it",
      "Wear the right respirator for what you're actually working in",
    ],
    post: [
      "Confirm the dry standard with readings, not by feel",
      "Clear the equipment and the containment",
      "Hand the photo log and drying record to the client and the adjuster",
      "Walk the space with the client before the rebuild starts",
    ],
  },
  {
    keys: ["chimney_sweep"],
    pre: [
      "Confirm the fire has been out at least 24 hours",
      "Sheet the hearth and the room and set up the vacuum",
      "Check the roof access and tie off before going up",
      "Photograph the existing condition of the flue and the cap",
    ],
    during: [
      "Seal the opening before the brush goes in",
      "Sweep the full length, not just what you can reach",
      "Inspect the liner, the smoke chamber and the damper as you go",
      "Check the cap, the crown and the flashing",
    ],
    post: [
      "Vacuum the hearth and the room and check surfaces for soot",
      "Show the client the photos of anything needing attention",
      "Hand over the report and say which level of inspection you did",
      "Tell them what's safe to burn and when to book the next sweep",
    ],
  },

  // ── Cleaning ────────────────────────────────────────────────────────────
  {
    keys: ["residential_cleaning"],
    pre: [
      "Confirm the entry method and the alarm code",
      "Check for pets and where they should stay",
      "On a first visit, walk through with the client and note what's off-limits",
      "Check your supplies and that the vacuum isn't full",
    ],
    during: [
      "Top to bottom, dry before wet, in every room",
      "Change cloths between the bathroom and the kitchen",
      "Don't move anything valuable or fragile — clean around it",
      "Flag anything already broken in writing before you touch it",
    ],
    post: [
      "Empty the bins and replace the liners",
      "Check mirrors and glass under a light for streaks",
      "Take the rubbish and all your equipment out",
      "Lock up and reset the alarm",
    ],
  },
  {
    keys: ["deep_cleaning"],
    pre: [
      "Agree the scope room by room — deep clean means different things to different people",
      "Check the client is happy for you to move furniture and appliances",
      "Bring the extra kit: descaler, degreaser, steamer, extension pole",
      "Set aside enough time — a deep clean rushed is a regular clean charged twice",
    ],
    during: [
      "Inside and behind the appliances, not just the fronts",
      "Baseboards, door tops, light fittings and vents",
      "Descale the taps, shower heads and toilet bases",
      "Inside the cupboards, fridge and oven where they're in scope",
    ],
    post: [
      "Put everything you moved back where it was",
      "Check the glass and chrome under a raking light",
      "Walk it with the client if they're home",
      "Photograph the before and after if they agreed to it",
    ],
  },
  {
    keys: ["commercial_cleaning", "janitorial"],
    pre: [
      "Confirm site access, keys, codes and the after-hours contact",
      "Read the site log for anything left from the last shift",
      "Put the wet floor signs out before you start",
      "Check the supply cupboard and restock the cart",
    ],
    during: [
      "Bins, then surfaces, then floors — in that order, every area",
      "Restock every washroom: paper, soap, liners",
      "Never block a fire exit with the cart",
      "Report anything damaged or unsafe rather than working around it",
    ],
    post: [
      "Walk the site and check nothing was missed",
      "Sign the site log with time in and time out",
      "Secure the cupboard and set the alarm",
      "Confirm every door you unlocked is locked again",
    ],
  },
  {
    keys: ["carpet_cleaning"],
    pre: [
      "Walk the rooms with the client and note every stain and its cause",
      "Test the fibre and colourfastness in a hidden spot",
      "Move what you can and agree what stays",
      "Protect the doorway and the stairs on the hose route",
    ],
    during: [
      "Vacuum thoroughly before any water touches it",
      "Pre-treat the stains and give them dwell time",
      "Don't over-wet — a soaked carpet takes days and then smells",
      "Rinse until the recovery water runs clear",
    ],
    post: [
      "Groom the pile and set the air movers",
      "Foam blocks under any furniture going back",
      "Say how long before walking on it, and how long before shoes",
      "Coil the hoses and check the doorway for water",
      "Photograph the treated areas",
    ],
  },
  {
    keys: ["window_cleaning"],
    pre: [
      "Walk the property and count the windows against the quote",
      "Check for cracked panes or failed seals and tell the client before you start",
      "Check the ladder footings and look for overhead wires",
      "Move what's on the sills, with permission",
    ],
    during: [
      "Detail the frames and sills, not just the glass",
      "Change the water when it goes cloudy",
      "Dry the edges — a wet edge dries as a streak",
      "Screens out, washed, and back in the same opening",
    ],
    post: [
      "Check every pane from inside with the light behind you",
      "Wipe the sills and the floor under each window",
      "Put the screens and anything you moved back",
      "Walk the job with the client",
    ],
  },
  {
    keys: ["pressure_washing_house"],
    pre: [
      "Check for loose siding, failed caulk and open vents before you spray",
      "Close every window and door, and cover the outlets and the meter",
      "Wet down and cover the plants",
      "Test the pressure and the nozzle on a hidden section",
    ],
    during: [
      "Keep the wand moving, and spray down — never up under siding",
      "Stay off the windows and light fittings at pressure",
      "Let the detergent dwell — pressure is not what removes algae",
      "Work top to bottom and rinse before it dries",
    ],
    post: [
      "Rinse the plants, the walkway and the driveway",
      "Check inside for water at the windows and doors",
      "Walk each elevation with the client",
      "Photograph the before and after",
    ],
  },
  {
    keys: ["pressure_washing_driveway"],
    pre: [
      "Sweep the surface and note the existing cracks and oil stains",
      "Check where the runoff goes — not into a bed or a storm drain if it's chemical",
      "Cover the garage threshold and the nearby plants",
      "Pre-treat the oil spots and let them dwell",
    ],
    during: [
      "Surface cleaner for the field, wand for the edges",
      "Keep an even overlap so you don't leave stripes",
      "Check your standoff on a test patch — don't etch the concrete",
      "Work in one direction so the finish is consistent",
    ],
    post: [
      "Rinse the whole area and push the water off",
      "Clear the debris out of the gutter and the drain",
      "Let it dry fully before any sealer goes down",
      "Photograph the finished surface",
    ],
  },
  {
    keys: ["auto_detailing"],
    pre: [
      "Walk the vehicle with the client and photograph every chip, scratch and dent",
      "Check for wrap, PPF or a ceramic coating before choosing products",
      "Remove personal items and put them somewhere the client can see",
      "Check under the seats for anything wet, sharp or valuable",
    ],
    during: [
      "Wheels and tyres first, then the wash — dirtiest to cleanest",
      "Two buckets and a grit guard",
      "Keep polish and compound off the trim",
      "Don't dress the pedals or the steering wheel",
    ],
    post: [
      "Check the panels under a light at an angle for swirls and missed spots",
      "Clean the door jambs, the sills and the inside of the glass",
      "Return the client's belongings",
      "Photograph the finished vehicle",
    ],
  },

  // ── Grounds & recurring service ─────────────────────────────────────────
  {
    keys: ["landscaping_design"],
    pre: [
      "Call for utility locates and wait for the marks",
      "Confirm the plant list and the layout with the client, on site",
      "Check the drainage and where water goes in a heavy rain",
      "Confirm machine access and where material can be dumped",
      "Protect the lawn and the driveway on the route in",
    ],
    during: [
      "Set the grades before anything gets planted",
      "Dig the hole twice the width of the root ball, not deeper",
      "Amend the soil rather than planting into clay",
      "Keep the mulch off the trunks",
      "Water everything in as you go",
    ],
    post: [
      "Sweep or blow the walks, the driveway and the street",
      "Set the irrigation, or leave clear watering instructions",
      "Walk the design with the client and name each plant",
      "Photograph the finished beds",
      "Take every pot, tag and offcut with you",
    ],
  },
  {
    keys: ["lawn_care", "lawn_mowing"],
    pre: [
      "Check the gate is unlocked and the dog is in",
      "Walk the yard and pick up toys, hoses and dog mess",
      "Check the blade is sharp — a torn blade tip browns",
      "Note anything the client should know about before you start",
    ],
    during: [
      "Cut at the right height for the season — never more than a third off",
      "Alternate the direction from the last visit",
      "Trim and edge the beds, walks and fence line",
      "Keep the clippings off the beds and out of the street",
    ],
    post: [
      "Blow the walks, the driveway and the patio clean",
      "Close and latch every gate",
      "Note any disease, grubs or bare patches for the client",
      "Photograph the finished lawn on a first visit",
    ],
  },
  {
    keys: ["irrigation"],
    pre: [
      "Call for utility locates before any digging",
      "Confirm the water source, the pressure and the flow available",
      "Walk the zones with the client and agree the coverage",
      "Check the backflow device is present and tested",
    ],
    during: [
      "Keep the heads at grade and level",
      "Match precipitation rates within a zone",
      "Flush every line before fitting the heads",
      "Keep the spray off the house, the walks and the road",
    ],
    post: [
      "Run every zone and watch the whole cycle",
      "Adjust the arcs and radii for overspray",
      "Program the controller and write the schedule down for the client",
      "Backfill, tamp and rake the trenches flat",
      "Show the client the shutoff and the controller",
    ],
  },
  {
    keys: ["tree_care_service"],
    pre: [
      "Walk the drop zone for wires, structures and soft ground",
      "Check the permit — many towns protect trees over a certain size",
      "Set the exclusion zone and brief everyone on the escape routes",
      "Check the ropes, saddle, chains and PPE before anyone climbs",
      "Confirm what the client wants left: wood, chips, stump",
    ],
    during: [
      "Nobody stands under the climber, at any time",
      "Cut to the collar — flush cuts don't heal",
      "Rope down anything over a structure",
      "Keep the chipper feed clear and never reach in",
    ],
    post: [
      "Rake the drop zone and blow the lawn and the drive",
      "Fill and reseed any ruts you made",
      "Confirm the wood and chips went where the client wanted",
      "Photograph the finished tree and the cleared ground",
    ],
  },
  {
    keys: ["snow_removal"],
    pre: [
      "Check the route order and which properties are priority",
      "Check fluids, lights and the cutting edge before you roll",
      "Confirm where snow is allowed to be stacked at each property",
      "Photograph existing damage before the first push of the season",
    ],
    during: [
      "Don't stack snow over hydrants, meters or drains",
      "Keep the blade off the pavers and the garage apron",
      "Clear the walk to the door, not just the driveway",
      "Salt the steps and any slope",
    ],
    post: [
      "Photograph the cleared drive and walk, timestamped",
      "Note anything you hit, or found already damaged",
      "Log the salt used and the time on site",
    ],
  },
  {
    keys: ["pest_control"],
    pre: [
      "Ask what they've seen, where, and when",
      "Confirm children, pets, fish tanks, and anyone with allergies or breathing trouble",
      "Inspect for the entry points and the harbourage before you treat",
      "Check the label and the rate for the product you're about to use",
    ],
    during: [
      "Treat the harbourage and the entry points, not just where it was seen",
      "Keep product off food surfaces, toys and pet bowls",
      "Place monitors so you can measure whether it worked",
      "Record the product, the rate and the areas treated",
    ],
    post: [
      "Tell the client the re-entry time and what to expect over the next week",
      "Leave the label and the safety information",
      "Book the follow-up before you leave",
      "File the treatment record",
    ],
  },
  {
    keys: ["pool_spa"],
    pre: [
      "Test the water before you change anything",
      "Check the pump, the filter pressure and the skimmer baskets",
      "Confirm the gate and the safety cover are secure while you work",
      "Note anything cracked, leaking or worn",
    ],
    during: [
      "Brush the walls and the steps, not just the floor",
      "Empty the baskets, and backwash if the pressure calls for it",
      "Balance in order: alkalinity, then pH, then sanitiser",
      "Record every chemical and dose",
    ],
    post: [
      "Retest and record the final readings",
      "Leave the deck clear and the gate latched",
      "Tell the client the swim-safe time if you dosed",
      "Log the visit and flag anything needing a repair quote",
    ],
  },
  {
    keys: ["junk_removal"],
    pre: [
      "Walk the load with the client and agree the price before anything moves",
      "Confirm what stays — get it pointed at, not described",
      "Check for anything you can't legally take: paint, chemicals, batteries, tyres",
      "Protect the floors and doorways on the route out",
    ],
    during: [
      "Lift properly, and two people on anything awkward",
      "Sort donate, recycle and dump as you load",
      "Keep the exit route clear",
    ],
    post: [
      "Sweep the cleared space",
      "Walk it with the client and confirm nothing that should have stayed went",
      "Photograph the cleared space",
      "Keep the disposal and donation receipts",
    ],
  },
  {
    keys: ["property_maintenance"],
    pre: [
      "Read the work order and the site history for anything outstanding",
      "Confirm access, keys and the on-site contact",
      "Walk the property and note anything new since the last visit",
    ],
    during: [
      "Complete the scheduled items before taking on anything extra",
      "Photograph anything you find that needs a quote",
      "Don't work around a safety issue — report it and make it safe",
    ],
    post: [
      "Photograph each completed item",
      "Log the visit with time in and time out",
      "Report the extras that need approval before the next visit",
      "Secure the site and confirm every door and gate is locked",
    ],
  },
];

async function main() {
  // One lookup for every key we're about to seed. A key with no category is
  // reported rather than skipped silently — it means seed.js was renamed and
  // this file went stale, which is exactly the kind of drift that leaves a
  // trade quietly without a checklist.
  const wantedKeys = [...new Set(CHECKLISTS.flatMap((entry) => entry.keys))];
  const categories = await db.serviceCategory.findMany({
    where: { key: { in: wantedKeys } },
    select: { id: true, key: true, label: true },
  });
  const byKey = new Map(categories.map((c) => [c.key, c]));

  const missing = wantedKeys.filter((key) => !byKey.has(key));
  if (missing.length) {
    console.warn(
      `⚠️  No ServiceCategory for: ${missing.join(", ")} — run \`node prisma/seed.js\` first, or fix the key.`,
    );
  }

  let written = 0;
  let skipped = 0;

  for (const entry of CHECKLISTS) {
    for (const key of entry.keys) {
      const category = byKey.get(key);
      if (!category) {
        skipped += PHASES.length;
        continue;
      }

      for (const phase of PHASES) {
        const labels = entry[phase] || [];
        if (labels.length === 0) continue;

        // Same shape lib/jobs/checklistItems.js produces, so "Use this" is a
        // plain copy and a visit's array never needs a second normaliser.
        const items = labels.map((label) => ({ label, done: false, phase }));
        const systemKey = `${key}:${phase}`;
        const name = `${category.label} — ${PHASE_NAMES[phase]}`;

        await db.jobChecklistTemplate.upsert({
          where: { systemKey },
          // Rewritten on every run: this file is the source of truth for the
          // system library, so improving an item here fixes it everywhere.
          // Company copies are untouched — they're separate rows.
          update: { name, items, phase, categoryId: category.id },
          create: {
            systemKey,
            name,
            items,
            phase,
            categoryId: category.id,
            companyId: null,
          },
        });
        written += 1;
      }
    }
  }

  const trades = CHECKLISTS.flatMap((e) => e.keys).filter((k) => byKey.has(k));
  console.log(
    `Seeded ${written} system checklist templates across ${trades.length} trades.`,
  );
  if (skipped) console.log(`Skipped ${skipped} (category missing).`);
}

main()
  .catch((err) => {
    console.error("Checklist seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
