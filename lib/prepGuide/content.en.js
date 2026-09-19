// lib/prepGuide/content.en.js
//
// What a client has to DO before the crew arrives, per trade — in English.
//
// The other half of lib/documents/serviceContent.js. That file says what the
// company will do (scope, inclusions, numbered steps) and is printed on the
// quote. This one says what the HOMEOWNER has to do — clear the counters,
// move the car, keep the dog in — and is sent a few days before the start
// date as the preparation guide. The process section of the guide is READ
// from serviceContent at render time (with the company's override), never
// restated here, so the steps on the guide are the steps on the quote.
//
// ── The bar ─────────────────────────────────────────────────────────────────
//
// TrueFinish Cabinets' own client preparation guide: six concrete items
// ("Clear all countertops completely — remove everything including small
// appliances…"), one warning that actually matters (interiors cannot be
// painted unless the cabinets are emptied), a note about meals, and what to
// expect after. Every guide here is written to that standard: things a person
// can tick off, in the order they would do them, with the reason stated where
// the reason is what makes them do it. A roofer's guide is about the driveway,
// the attic and the pets; a painter's is about furniture and wall art.
//
// ── The same rules as serviceContent ────────────────────────────────────────
//
// Nothing states a number of days, a cure time, a product brand or a price.
// "Keep off the driveway for 48 hours" is a commitment that varies by product
// and by weather, and a default that asserts it on a contractor's behalf is a
// promise they did not make. Where a duration matters the line says "for the
// time we tell you on the day", and the company can write its own figure into
// the company copy under Settings > Services.
//
// ── Families ────────────────────────────────────────────────────────────────
//
// Sixty-nine categories do not need sixty-nine guides: a lawn-mowing visit and
// a lawn-care visit ask the homeowner for the same four things. GUIDE_FAMILY in
// content.js maps every ServiceCategory.key onto one of the guides below, and
// scripts/check-prep-guide.mjs asserts that every key resolves to a guide with
// at least four checklist items in every language. A category whose
// preparation genuinely differs gets its own entry; a family is used only
// where the list would be word-for-word the same.
//
// Shape per guide:
//   checklist  what to do, each "Heading — detail", tickable
//   warning    the one thing that stops or delays the job if it is not done
//   dayOf      what happens on the day, and what the household should expect
//   afterCare  what to do (and not do) once the crew has left

export const GUIDES_EN = {
  cabinet_refinishing: {
    checklist: [
      "Clear all countertops completely — remove everything including small appliances, dish racks, decor and the microwave. Store items safely elsewhere.",
      "Move the dining table — relocate it out of the kitchen or to a protected area away from the work zone.",
      "Remove wall art and decorations near the cabinets — paintings, mirrors, shelves, or any items on adjacent walls.",
      "Stove and refrigerator — if we are finishing around or behind these appliances, please pull them out for full access. Moving them gives the cleanest result.",
      "Cabinet interiors — you do not need to empty the cabinets. Interiors are not refinished unless your quote lists them as an add-on.",
      "General kitchen readiness — make sure the floor is clear and vacuumed. We handle all floor, counter and appliance protection with professional barriers and drop cloths.",
      "Pets — keep them out of the kitchen and the rooms next to it while we are on site; the doors will be sealed and the sprayer is loud.",
    ],
    warning:
      "If you requested or expect interior cabinet painting, you must remove all contents from the cabinets before we start. Unemptied cabinets cannot be painted inside, and this may delay the project.",
    dayOf: [
      "We protect floors, counters and appliances with barriers and plastic sheeting before anything else happens, and set up a contained, ventilated spray station in the kitchen.",
      "The kitchen is out of use while we are working: no sink, no stove, and the doors sealed. We recommend planning meals out or using another room during the project.",
      "We keep disruption to a minimum and clean thoroughly at the end of each day.",
    ],
    afterCare:
      "Your cabinets are ready for light use as soon as we hand them back. Close the doors gently and avoid hanging anything heavy on them, or wiping them with cleaners, until the finish has fully hardened — we will tell you how long that takes for the product we used.",
  },

  cabinet_refacing: {
    checklist: [
      "Clear all countertops completely — the new doors and drawer fronts are fitted from the front, and we need every inch of the counter to work from.",
      "Empty the drawers and the cabinets whose fronts are being replaced — drawer boxes come out, and doors come off, and anything inside is in the way.",
      "Remove wall art and decorations near the cabinets — anything on the adjacent walls comes down while the boxes are being finished.",
      "Stove and refrigerator — if the panels beside them are being finished, please pull the appliances out so we can reach the sides.",
      "Confirm the handle placement — we drill the new fronts to the positions you chose on the quote; if you want to change that, tell us before we arrive.",
      "Keep the kitchen floor clear and pets out of the room while we are on site.",
    ],
    warning:
      "The new doors were made to the measurements taken on site. If any cabinet has been moved, replaced or altered since we measured, tell us before we arrive — a door made for an opening that has changed will not fit.",
    dayOf: [
      "The old doors and fronts come off first and leave with us. The boxes are then finished to match the new fronts, which takes the kitchen out of use for the day.",
      "The new doors go on, are adjusted so they sit level, and the handles are fitted. We walk the kitchen with you before we leave.",
    ],
    afterCare:
      "New hinges settle over the first weeks. If a door drifts out of line, tell us — it is a small adjustment, and it is part of the job.",
  },

  kitchen_design: {
    checklist: [
      "Empty the kitchen completely — every cabinet, every drawer, the pantry and the counters. Everything that is staying in the house needs a home in another room.",
      "Arrange for the appliances — tell us which ones are being reused and where they should be stored while the old kitchen is out; a refrigerator you are keeping needs a plug somewhere else.",
      "Clear a path from the door to the kitchen — cabinets and countertops are long and heavy, and they arrive through your front door.",
      "Set up a temporary kitchen — a kettle, a microwave and a fridge in another room make the next few weeks far easier.",
      "Take down anything on the walls adjacent to the kitchen — framing, plumbing and cabinet installation all send vibration through the wall.",
      "Pets and children — the kitchen is a building site while we are in it; keep it closed off outside working hours.",
    ],
    warning:
      "The plumbing and electrical in the new kitchen are done by licensed trades on the days we schedule them. The sink, the dishwasher and the stove are not usable until those days are complete — plan for the kitchen to be out of use for the whole project, not just the first day.",
    dayOf: [
      "The old kitchen comes out first. That is the loudest day, and the one that makes the most dust; we seal the doorways before we start.",
      "The cabinets go in room by room: bases, then walls, then the countertop is templated. The countertop is made to the installed cabinets, so there is a gap of days between the two.",
      "We walk the kitchen with you at the end of every stage and again at handover.",
    ],
    afterCare:
      "Doors and drawers are adjusted at handover and can drift as the house settles; tell us and we will realign them. Keep the countertop free of standing water at the seams until the sealant has cured — we will tell you how long.",
  },

  countertop: {
    checklist: [
      "Clear the countertops completely — everything on them, in the sink and on the windowsill above the sink comes off.",
      "Empty the cabinet under the sink and the drawers beside it — the plumbing is disconnected from below, and we need the space to work.",
      "Arrange for the plumbing and gas — disconnecting the sink, dishwasher and cooktop is separate work unless your quote lists it. Confirm who is doing it and on which day.",
      "Make sure the cabinets are secure and level — a countertop can only be as level as what it sits on. Tell us about any cabinet that wobbles.",
      "Clear a path from the door to the kitchen — a slab is long, heavy and carried by two people, and it does not turn corners well.",
      "Keep pets out of the kitchen on removal and installation days.",
    ],
    warning:
      "The sink and dishwasher are out of use from the moment the old top comes off until the plumbing is reconnected after the new one is sealed. That is not the same day unless your quote says so — plan for it.",
    dayOf: [
      "On template day we measure your cabinets exactly; nothing is removed. On installation day the old top comes off, leaves with us, and the new one is set, levelled, seamed and sealed.",
      "Cutting is done outside where possible. Where it has to be done in place, we contain the dust and clean up before we leave.",
    ],
    afterCare:
      "Keep the seams and the sink edge dry until the sealant has cured — we will tell you how long for the product used. Wipe the surface with a soft cloth and mild soap; avoid abrasive pads.",
  },

  interior_painting: {
    checklist: [
      "Move small furniture and everything on it out of the rooms being painted — lamps, plants, books, electronics. Large furniture can stay if it can be moved to the middle of the room and covered.",
      "Take down wall art, mirrors, clocks and curtains — and their hooks, unless you want us to paint around them. Keep the hardware together in a bag per room.",
      "Clear the tops of closets, shelves and window sills in every room on the list.",
      "Decide on colours and sheens before we arrive — a change on the day means a trip to the store and a day lost.",
      "Pets — keep them in a room we are not painting. Wet walls and a curious cat is a bad combination for both.",
      "Tell us about anything fragile or valuable you would rather move yourself.",
    ],
    warning:
      "Rooms we are painting are out of use while the paint is wet, including overnight between coats. Bedrooms are usually done first so they are back in service first — tell us if you need a different order.",
    dayOf: [
      "We cover floors and the furniture that stays, mask the trim and outlets, and fill and sand before any paint goes on. The first hour is preparation, not painting.",
      "Expect some paint smell for a day or two; we ventilate as we go. Doors and windows in the rooms being painted stay open where the weather allows.",
      "We clean up at the end of each day and leave a clear path through the house.",
    ],
    afterCare:
      "Fresh paint is dry to the touch long before it is hard. Avoid scrubbing, hanging pictures or pushing furniture against the walls until it has cured — we will tell you how long for the product used.",
  },

  exterior_painting: {
    checklist: [
      "Move cars away from the house — overspray and ladders both need the driveway. Park on the street or in the garage.",
      "Clear the perimeter — patio furniture, barbecues, planters, hoses, garden ornaments and anything else within a few feet of the walls.",
      "Close every window and turn off the sprinklers for the days we are on site — a wet wall cannot be painted.",
      "Trim back shrubs and branches touching the house, or tell us if you would like us to do it; we need to reach the wall behind them.",
      "Unlock side gates and tell us about any alarm sensors on the doors and windows we will be working around.",
      "Pets — keep them inside while ladders are up and paint is wet.",
    ],
    warning:
      "Exterior paint needs a dry surface and a dry forecast. If it rains, we stop, and the finish date moves — the work does not. Please keep sprinklers off for the whole project, including the days we are not there.",
    dayOf: [
      "We wash the surfaces first and let them dry, then scrape, sand, caulk and prime before the finish coats. On a larger house, the first day or two is entirely preparation.",
      "Windows we are painting around are masked and will not open while we are working on that wall.",
      "We take the masking down and clear our materials at the end of each day.",
    ],
    afterCare:
      "Leave the sprinklers off and the shrubs away from the walls until the paint has cured — we will tell you how long. Hose the walls gently, never pressure-wash them.",
  },

  flooring: {
    checklist: [
      "Empty the rooms completely — furniture, rugs, lamps, everything on the floor. We can move large pieces if your quote says so; otherwise they need to be out before we arrive.",
      "Take down or secure anything on the walls — sanding sends vibration through the house, and a picture on a nail can fall.",
      "Empty the bottom shelves of closets in the rooms being done, and clear the closet floors.",
      "Turn off the furnace or air conditioning fan for the days we are sanding, so the dust is not carried through the ducts.",
      "Plan to be out of those rooms — and, for a finish that is drying, out of the house — for the times we give you on the day.",
      "Pets and plants out of the rooms, and ideally out of the house, while the finish is going on.",
    ],
    warning:
      "Nobody can walk on the floor while the finish is wet, including to reach another room. If the rooms being done are the only way to a bathroom or a bedroom, tell us before we start so we can sequence the work around it.",
    dayOf: [
      "We seal the doorways and vents, then sand the floor through progressively finer grits. The sanders are loud, and there is some fine dust despite the vacuums.",
      "Stain, where you chose one, goes on next, then the protective coats with drying time between them. The house may smell of the finish for a day or two.",
    ],
    afterCare:
      "Wait for the time we give you before walking on it in socks, longer before furniture goes back, and longer again before rugs go down — the finish keeps hardening for weeks. Put felt pads under every leg.",
  },

  flooring_install: {
    checklist: [
      "Empty the rooms completely — furniture, rugs, lamps, and everything on the closet floors.",
      "Let the new flooring acclimatise — if it has been delivered, keep the boxes flat, inside, in the rooms where it will be laid, for the time the manufacturer requires.",
      "Clear a path from the door to the rooms — flooring arrives in long, heavy boxes.",
      "Tell us what is under the old floor if you know — a previous floor, a heated floor, a subfloor with a history.",
      "Doors — some may need trimming to clear the new floor. Tell us about any door you would rather we did not cut.",
      "Pets out of the rooms while the old floor comes up and the new one goes down.",
    ],
    warning:
      "The subfloor cannot be inspected until the old floor is off. If it is damaged, uneven or wet, that is extra work and we will show it to you and price it before we carry on.",
    dayOf: [
      "The old floor comes up first, and the subfloor is checked and prepared. Then the new floor goes down, and the trim goes back on.",
      "Cutting is done outside or in a contained area; expect some noise and a little dust.",
    ],
    afterCare:
      "Felt pads under every piece of furniture before it goes back. Use the cleaning method the manufacturer recommends for this floor — the wrong one can void the warranty.",
  },

  tiling: {
    checklist: [
      "Clear the area completely — for a floor, every piece of furniture; for a kitchen backsplash, everything on the counters; for a bathroom, everything on the vanity and in the shower.",
      "Confirm the tile, the layout and the grout colour before we arrive — a change on the day is a change to a job that has already started.",
      "The bathroom or kitchen being tiled is out of use while the tile and grout cure. Make sure another one is available.",
      "Tell us about anything behind the wall or under the floor you know of — heated floor cables, plumbing that has been moved.",
      "Keep pets out of the room from the day we start until the grout is sealed.",
    ],
    warning:
      "Tile and grout cannot be walked on or wetted until they have cured. A shower tiled today cannot be used tonight. We will tell you exactly when it can be — plan around it.",
    dayOf: [
      "We prepare the surface first: old tile off if there is any, the substrate levelled and waterproofed where the room needs it.",
      "Tile goes down, then a day or more later the grout, then the sealer. Cutting is done with a wet saw outside where possible.",
    ],
    afterCare:
      "Keep the area dry for the time we tell you, then clean it with a neutral cleaner — nothing acidic on the grout. Reseal the grout on the schedule we give you.",
  },

  stairs: {
    checklist: [
      "Clear the stairs, the landing and the hallway at the top and bottom — nothing on the treads, nothing leaning on the walls beside them.",
      "Take down pictures on the stairwell walls and anything hanging above the staircase.",
      "Plan to be on one floor for the times we give you — a staircase with wet finish cannot be crossed, even carefully.",
      "Move anything you will need from upstairs (or downstairs) before we start each coat: medication, chargers, the dog's food.",
      "Pets — keep them on the floor where their food and bed are, behind a closed door, while the finish is drying.",
    ],
    warning:
      "Once the finish goes on, the staircase is out of use for the time we tell you on the day, with no exceptions. If there is only one bathroom and it is on the other floor, tell us before we start and we will sequence the work — every second tread, or one side at a time — so you can still get past.",
    dayOf: [
      "We mask the walls, spindles and the floor at the bottom, sand the components on your quote back to bare wood, fill the dents, and then stain and finish with drying time between coats.",
      "Sanding is loud and dusty; we contain what we can and clean up each day.",
    ],
    afterCare:
      "Socks only for the first days after we leave, no runner or stair mat until the finish has hardened, and no dragging furniture up or down — we will tell you how long for the product used.",
  },

  drywall: {
    checklist: [
      "Empty the room, or move everything to the middle and cover it — drywall dust gets everywhere it can reach.",
      "Take down everything on the walls being worked on, and on the other side of those walls; screws and sanding travel through.",
      "Turn off the furnace or air conditioning fan while we are sanding, so the dust stays in the room.",
      "Tell us about anything in the wall — wiring you have added, plumbing, a speaker cable.",
      "Keep pets and children out of the room until the final sanding is done and we have cleaned up.",
    ],
    warning:
      "Drywall compound needs to dry between coats, and it dries at the speed the room allows. A cold or damp room adds days. Keep the heat on and the windows closed unless we ask otherwise.",
    dayOf: [
      "Repairs are cut back, patched and taped first; then two or three coats of compound with drying time between each, then sanding, then primer if your quote includes it.",
      "The days in between coats are short visits. The sanding day is the dusty one.",
    ],
    afterCare:
      "Primed drywall is ready to paint as soon as the primer has dried. Do not hang anything heavy on a fresh patch until it has been painted.",
  },

  plumbing: {
    checklist: [
      "Clear under the sink, around the toilet, or wherever the work is — everything out of the cabinet, and a clear metre around the fixture.",
      "Know where your main water shut-off is, and make sure we can reach it — it is often behind stored boxes in the basement.",
      "Tell us about any other fixture that has been acting up; while the water is off is the cheapest time to look.",
      "Have the new fixture on site if you are supplying it, still in the box, with all its parts.",
      "Keep pets away from the work area and from any open floor or ceiling.",
    ],
    warning:
      "The water will be off for part of the visit, sometimes for the whole house. Fill a jug and plan around it. A fixture you are supplying yourself must be complete and on site before we arrive, or the visit is wasted.",
    dayOf: [
      "We assess first, confirm the fix with you, then isolate the water and do the work. Everything is tested under pressure before the water goes back on for the house.",
      "Some work needs access through a wall or ceiling. We tell you before we open anything, and we leave the opening clean and ready to be made good.",
    ],
    afterCare:
      "Run the taps for a minute once we have left to clear air from the lines. If anything drips, weeps or sounds different, call us — a new joint should be silent.",
  },

  electrical: {
    checklist: [
      "Clear access to your electrical panel — a clear metre in front of it, nothing stacked against it.",
      "Clear the area where the work is being done — around outlets, switches, light fixtures or the appliance being wired.",
      "Save your work and shut down computers and other electronics before we arrive; the power will be off for part of the visit.",
      "Tell us about anything else that trips, flickers, buzzes or feels warm — while the panel is open is the time to look.",
      "Keep pets and children away from the work area and any open box or wall.",
    ],
    warning:
      "Power will be off — to the circuit, and sometimes to the whole house — for part of the visit. Medical equipment, aquariums, freezers and anything else that must not lose power: tell us before we start so we can plan around them.",
    dayOf: [
      "We confirm the scope with you, isolate the power, do the work, then test every circuit we touched before we leave.",
      "Where the work needs an inspection or a permit, we tell you what happens next and when.",
    ],
    afterCare:
      "Reset any clocks and timers that lost power. If a breaker trips again after we have left, do not keep resetting it — call us.",
  },

  hvac: {
    checklist: [
      "Clear the area around the furnace, air handler or outdoor unit — a clear metre on every side, and the path from the door to it.",
      "Make sure the attic hatch, crawlspace or utility closet is accessible if the ductwork runs through them.",
      "Note the thermostat settings you like — a replacement thermostat starts from nothing.",
      "Tell us which rooms are too hot or too cold; that is the best information we can have while the system is open.",
      "Keep pets away from the work area — refrigerant lines, open ducts and a running blower are all hazards.",
    ],
    warning:
      "The heating or cooling will be off for the whole visit, and on an installation day sometimes overnight. In deep winter or a heatwave, plan for it — a second space heater or a fan in the room you use most.",
    dayOf: [
      "On a repair, we diagnose first, confirm the fix and the cost with you, then do the work and run the system through a full cycle before we leave.",
      "On an installation, the old equipment comes out first and leaves with us; the new unit goes in, is connected, commissioned and tested, and we show you how the controls work.",
    ],
    afterCare:
      "Change or clean the filter on the schedule we give you — it is the one thing that most affects how long the equipment lasts. If the system short-cycles, makes a new noise or the thermostat and the room disagree, call us.",
  },

  appliance_repair: {
    checklist: [
      "Empty the appliance — a refrigerator being repaired needs its contents in a cooler; a dishwasher or washer should be empty; an oven should be cool and clean enough to work on.",
      "Clear the space around and in front of it — we usually have to pull it out.",
      "Find the model and serial number and have it ready; it is on a label inside the door or on the back. It tells us which parts to bring.",
      "Describe the fault as precisely as you can — the noise, the smell, when it started, what it does and does not do.",
      "Keep pets out of the kitchen or laundry while the appliance is open.",
    ],
    warning:
      "Some repairs need a part that has to be ordered. If so, the first visit is a diagnosis and the repair is a second visit; we will tell you before we leave, with the cost.",
    dayOf: [
      "We diagnose first, tell you what we found and what it costs to fix, and go ahead only with your say-so. The appliance is tested through a full cycle before we leave.",
    ],
    afterCare:
      "Wait for the time we tell you before loading a refrigerator or freezer back up. If the fault comes back, tell us — a repair is warranted, and the second look is on us where our work is the cause.",
  },

  locksmith: {
    checklist: [
      "Have proof that you are entitled to the property ready — ID with the address, a lease or a deed. We will ask for it; it is what stops us opening someone else's door.",
      "Clear the doorway and the area around each lock being worked on, inside and out.",
      "Collect every existing key for the locks being changed, so you know how many are being replaced.",
      "Decide how many new keys you need and who gets one.",
      "Tell us about any alarm or smart-lock wiring on the doors.",
    ],
    warning:
      "We do not open, rekey or replace a lock without proof that you are entitled to the property. Without it the visit ends at the door, and it is still charged.",
    dayOf: [
      "We confirm the doors and locks on the quote with you, do the work, and test every key in every lock before we leave. Old keys will not work afterwards — that is the point.",
    ],
    afterCare:
      "Test each key yourself before you leave the house. A lock should turn smoothly; if it catches, tell us the same day.",
  },

  garage_door: {
    checklist: [
      "Empty the garage bay under and beside the door — the car out, and a clear space the full width of the door and a couple of metres deep.",
      "Clear the ceiling area where the tracks and opener run — hanging bikes, storage racks, anything within reach of the track.",
      "Make sure there is a working outlet near the ceiling for the opener, and tell us if there is not.",
      "Move cars off the driveway in front of the door — the panels and the springs come in through it.",
      "Keep pets and children out of the garage while the springs are being worked on.",
    ],
    warning:
      "A garage door spring is under enormous tension. Do not try to loosen, adjust or 'help' with anything on the door before we arrive, and keep everyone out of the garage while it is being worked on.",
    dayOf: [
      "The old door comes off first and leaves with us. The new door, tracks, springs and opener go in, and the door is balanced and cycled under power before we leave.",
      "We show you the manual release and how to program the remotes and keypad.",
    ],
    afterCare:
      "Do not adjust the springs or the opener force yourself — call us. Once a year, have the door balanced and the rollers lubricated; it is what keeps it quiet.",
  },

  elevator_services: {
    checklist: [
      "Notify the building — tenants and staff need to know which car is out of service, and from when until when.",
      "Give us access to the machine room, the pit and every landing, with keys or a contact who can open them.",
      "Post the out-of-service signs at every landing, or tell us to bring them.",
      "Tell us about anything scheduled in the building that day — a move-in, a delivery — that depends on the car.",
      "Have the maintenance log and the last inspection certificate available.",
    ],
    warning:
      "The car is out of service for the whole visit. If the building has one elevator and residents who cannot use the stairs, plan for that before we arrive — the work cannot be paused halfway.",
    dayOf: [
      "We lock out the car, do the work in the quote, and test it through its full travel under load before it returns to service. The log is signed before we leave.",
    ],
    afterCare:
      "If the car behaves differently — a new noise, a rough stop, a door that hesitates — take it out of service and call us; do not wait for the next scheduled visit.",
  },

  well_water: {
    checklist: [
      "Clear access to the wellhead — cut back anything growing over it and move whatever is stored on or around it.",
      "Clear around the pressure tank, the pump controls and any filters or softener inside the house.",
      "Fill some containers with water before we arrive — the supply will be off for part of the visit.",
      "Tell us what you have noticed: pressure changes, air in the lines, taste, colour, or a pump that runs when nothing is open.",
      "Keep pets away from an open well casing.",
    ],
    warning:
      "The water will be off for the visit and, for some work, until a test result comes back. Do not drink from the taps until we tell you it is safe to.",
    dayOf: [
      "We inspect and test first, confirm the work with you, then do it. The system is pressurised and run before we leave, and we flush the lines with you watching.",
    ],
    afterCare:
      "Run the outside tap for the time we tell you to clear any disturbed sediment before using the inside taps. Keep the wellhead clear and above grade — it is the single most important thing for your water quality.",
  },

  mechanical_contracting: {
    checklist: [
      "Confirm the shutdown window with everyone who depends on the system — tenants, production, the building manager — and post it.",
      "Give us access to the mechanical room, the roof, the ceiling spaces and the electrical room, with keys or a contact.",
      "Clear the work areas and a path to them wide enough for equipment.",
      "Tell us about anything else on the system — a leak, a noise, a zone that never gets to temperature.",
      "Have the building drawings and the equipment manuals available if you have them.",
    ],
    warning:
      "The system is down for the window we agreed. A shutdown that cannot be extended has to be told to us before we start, not when the window closes — the work cannot be left half-connected.",
    dayOf: [
      "We isolate the system, do the work on the quote, and commission it before it goes back into service. Where a start-up needs the building occupied, we schedule it with you.",
    ],
    afterCare:
      "Report anything different in the first week — a zone slow to respond, a new noise, a pressure that drifts. The commissioning report we leave is the baseline to compare against.",
  },

  installation_services: {
    checklist: [
      "Have the product on site, unopened, with all its parts and the manufacturer's instructions — check the box for damage before we arrive.",
      "Clear the spot where it is going and a path from the door to it.",
      "If it needs power, water or a wall anchor, tell us what is there now — an outlet, a shut-off, a stud finder's worth of knowledge.",
      "Remove the old item, or tell us it is part of the job.",
      "Keep pets and children out of the area during the installation.",
    ],
    warning:
      "If the product is missing a part or arrives damaged, the installation cannot be completed and the visit is still charged. Please open the box and check it against the parts list the day before.",
    dayOf: [
      "We unpack, check, install to the manufacturer's instructions, test, and take the packaging away. We show you how it works before we leave.",
    ],
    afterCare:
      "Keep the manual and the receipt together — the manufacturer's warranty needs both. Tell us within the first days if anything is loose, out of level or not working as shown.",
  },

  roofing_service: {
    checklist: [
      "Move cars off the driveway and away from the house the evening before — the driveway is where the dumpster and the material delivery go, and shingles fall.",
      "Clear the perimeter of the house — patio furniture, barbecues, planters, hoses, toys and anything else within a few metres of the walls. Cover what cannot be moved.",
      "Take down or secure anything hanging on the walls and shelves inside — the hammering vibrates the whole house. Pictures fall; so do items on high shelves.",
      "Clear the attic of anything you would not want dust on, and cover the rest — debris comes through the deck boards during tear-off.",
      "Pets — a roof tear-off is loud for the whole day. Keep them in the quietest room, or arrange to have them elsewhere.",
      "Unlock side gates and turn off the sprinklers. Tell us about a satellite dish, solar panel or antenna you want to keep.",
    ],
    warning:
      "Nobody can be under the eaves while we are stripping — that includes the driveway, the patio and the path to the door. Please use the door we agree on and keep children away from the perimeter all day.",
    dayOf: [
      "We set up ground protection and a dumpster, strip the old roof to the deck, inspect the boards, and show you anything that needs replacing before it is roofed over.",
      "Underlayment, flashing, the new covering and ventilation go on the same day where the size of the roof allows. The roof is never left open overnight.",
      "We sweep the grounds with a magnet for nails before we leave, and again the next morning if we are back.",
    ],
    afterCare:
      "Walk the grounds yourself in the first days and tell us about any nail you find — we will come back with the magnet. Some granule loss in the first rains is normal on a new asphalt roof.",
  },

  gutter_services: {
    checklist: [
      "Move cars off the driveway and away from the walls — ladders go up all the way round the house.",
      "Clear the perimeter — patio furniture, planters and hoses away from the walls where the ladders will stand.",
      "Unlock side gates and tell us about any garden bed we should protect under the eaves.",
      "Tell us where the water should go — a downspout that lands on the neighbour's driveway is the commonest reason we come back.",
      "Pets inside while the ladders are up.",
    ],
    warning:
      "We work from ladders around every wall of the house. Anything below the eaves — a car, a hot tub cover, a glass table — is in the way of a falling scoop of wet leaves or a dropped tool. Please move it or cover it.",
    dayOf: [
      "For a cleaning we clear by hand, flush every downspout and inspect the runs while they are empty. For an installation, the old run comes down and the new one is formed on site and hung to fall towards the outlets.",
      "We run water through everything before we leave, so you can see it drain.",
    ],
    afterCare:
      "After the first heavy rain, look for water overshooting the gutter or pooling by the foundation and tell us — that is a pitch or an outlet, and it is a quick fix.",
  },

  siding: {
    checklist: [
      "Move cars away from the house and clear the perimeter — furniture, planters, hoses, anything within a few metres of the walls being re-clad.",
      "Take down pictures and shelf items on the inside of the walls being worked on — the nailing vibrates them.",
      "Turn off the sprinklers and unlock side gates.",
      "Tell us about anything mounted on the walls you want kept — lights, a hose reel, a satellite dish, house numbers — and whether it goes back in the same place.",
      "Trim back shrubs touching the walls, or ask us to.",
      "Pets inside during working hours.",
    ],
    warning:
      "The sheathing behind the old siding cannot be inspected until it is off. If it is rotten or wet, that is separate work, and we will show it to you with photographs and price it before we cover it.",
    dayOf: [
      "The old cladding comes off a wall at a time and leaves with us. The sheathing is checked, the weather barrier goes on, then the new siding and trim.",
      "Expect noise from cutting and nailing throughout the day, and a cleaner site than you expect at the end of it.",
    ],
    afterCare:
      "Wash new siding with a hose and a soft brush, never a pressure washer up close. Tell us if a panel rattles in the wind — that is a fastener, and it is a quick fix.",
  },

  insulation: {
    checklist: [
      "Clear the attic hatch and a metre around it — the machine hose comes up through it and stays there all day.",
      "Remove anything stored in the attic you want to keep clean, and tell us about anything that has to stay up there.",
      "Clear the hallway or closet under the hatch, and a path from the door to it.",
      "Tell us about pot lights, bathroom fans, a chimney or a whole-house fan in the attic — each one needs a clearance kept around it.",
      "Pets — the blower is loud. Keep them behind a closed door well away from the hatch.",
    ],
    warning:
      "Anything left in the attic will be buried. If you want it back, it has to come down before we arrive. We will not dig for a box of photographs after the fact — the insulation is the product, and disturbing it undoes the work.",
    dayOf: [
      "We seal the air leaks first — top plates, penetrations and the hatch — then blow the insulation to the depth the R-value on your quote needs, keeping the ventilation path open.",
      "We record the depth before and after, and leave markers so it can be checked.",
    ],
    afterCare:
      "Keep the attic as it is. If a contractor has to go up there later — an electrician, a roofer — ask them to walk on the joists and to rake the insulation back over where they knelt.",
  },

  masonry: {
    checklist: [
      "Move cars and clear the area around the wall, steps or chimney being worked on — a clear space a couple of metres out, and a path to it for wheelbarrows.",
      "Turn off the sprinklers and keep them off until we say — new mortar cannot be wetted for the time it needs to cure.",
      "Tell us about any planting bed, patio slab or downspout in the work area you want protected.",
      "Unlock gates and tell us where we may set up the mixer and where the material can be dropped.",
      "Pets away from the work area and away from fresh mortar until it has set.",
    ],
    warning:
      "Fresh mortar and parging must not freeze or get rained on for the time we tell you. If the forecast turns, we may have to move the date — the work does not change, but the day may.",
    dayOf: [
      "We protect what is around the work, remove what has failed, prepare the substrate, and lay or apply the new material. Curing starts the moment we finish, so keep water and traffic away from it.",
    ],
    afterCare:
      "Keep water, sprinklers and traffic off the new work for the time we tell you. A slight colour difference between new and old mortar fades over the first year.",
  },

  paving: {
    checklist: [
      "Move every car off the driveway the evening before, and arrange somewhere else to park for the whole project — the driveway is out of use from the first morning.",
      "Clear the edges — planters, basketball hoops, hoses, decorative rocks and anything else along the drive or walkway.",
      "Turn off the sprinklers and keep them off until we say. Tell us where the irrigation lines run near the work.",
      "Tell us where the utilities enter the house — gas, water, cable — so the excavation avoids them. We arrange the locates; you tell us what you know.",
      "Pets and children off the work area from the first excavation until we say the surface can be walked on.",
    ],
    warning:
      "Nothing drives on the new surface until we tell you — not a car, not a bin on wheels — and nothing sharp is placed on it. Driving on it early leaves marks that do not come out.",
    dayOf: [
      "We excavate, lay a compacted base in lifts, set the units to the agreed pattern, restrain the edges, fill the joints and compact the whole surface. The ground around it is graded and made good.",
      "There is noise from the plate compactor and the saw, and some dust; we keep the street clear of material.",
    ],
    afterCare:
      "Keep vehicles off for the time we tell you. Some joint sand settles in the first weeks and can be topped up. Sweep it; do not pressure-wash it in the first season.",
  },

  driveway_sealing: {
    checklist: [
      "Move every car off the driveway the evening before, and park elsewhere until the sealer has cured — we tell you how long on the day.",
      "Clear the surface — bins, planters, hoses, basketball hoops, anything standing on it.",
      "Turn off the sprinklers the day before and keep them off until we say; a wet driveway cannot be sealed and a wet sealer washes off.",
      "Tell us about oil spots, cracks and low areas you have noticed — treating them is separate work, and we can only price what we know about.",
      "Pets and children off the driveway from the moment we start until it has cured.",
    ],
    warning:
      "Nobody and nothing on the driveway until the sealer has cured. Footprints, tyre marks and paw prints set into a fresh sealer and stay there. If you must cross, use the lawn.",
    dayOf: [
      "We sweep and blow the surface clean, treat oil spots, mask the edges, and apply the sealer at the coat count on your quote. We block the driveway entrance when we leave.",
    ],
    afterCare:
      "Leave the barrier up for the time we tell you. Avoid turning the steering wheel while the car is stationary on it for the first weeks — it scuffs a fresh sealer.",
  },

  epoxy: {
    checklist: [
      "Empty the garage completely — cars, shelving, bikes, everything on the floor. The floor has to be bare wall to wall.",
      "Tell us about oil stains, cracks, previous coatings and any place water comes in; the prep depends on it.",
      "Check the weather and the temperature — the floor must be dry and above the temperature we tell you for the whole cure. Keep the garage closed and the heat on if it is cold.",
      "Arrange somewhere to park for the whole project, including the cure time we give you.",
      "Keep pets and children out of the garage from the first grinding until the floor is cured.",
    ],
    warning:
      "Nothing goes back on the floor until it has cured — not a foot, not a bike, and a car last of all. Walking on it early leaves prints; parking on it early lifts the coating under the tyres. We tell you the times on the day; please keep to them.",
    dayOf: [
      "We grind the concrete, repair the cracks and fill the spalls, then apply the coats on your quote with the cure time each one needs between them. The garage will smell of the coating; keep the house door closed.",
    ],
    afterCare:
      "Foot traffic first, then light items, then the car, each after the time we give you. Hot tyres can mark a floor that is not fully cured — wait the full time before parking.",
  },

  fence: {
    checklist: [
      "Confirm the fence line — walk it with us or mark it before we arrive. A fence on the wrong side of the property line is a very expensive mistake, and a survey is the only thing that settles it.",
      "Tell your neighbours — the crew, the noise and the posts are on both sides of the line for a day.",
      "Arrange for utility locates, or confirm we are doing it — no post hole is dug until the lines are marked.",
      "Clear the fence line — plants, stored items, compost, the shed roof that overhangs it.",
      "Turn off the sprinklers and tell us where the irrigation lines run near the fence.",
      "Pets — there is no fence while we are working. Keep dogs inside or on a lead until the gates are hung and latched.",
    ],
    warning:
      "Utility locates must be complete before we dig. If they are not marked when we arrive, we cannot start, and the visit is rescheduled. Nobody digs a post hole through a gas line to save a day.",
    dayOf: [
      "The old fence comes down first, if there is one. Post holes are dug, the posts set, and the panels or boards go up. Gates are hung and adjusted last.",
      "Concrete around the posts needs time before the fence takes any weight — we will tell you how long before leaning a ladder on it.",
    ],
    afterCare:
      "Keep dogs and children off the gates and panels until the posts have set. New wood greys as it weathers; stain or seal it on the schedule we recommend, not before it has dried out.",
  },

  chimney_sweep: {
    checklist: [
      "No fire for 24 hours before we arrive — the flue and the firebox have to be cold to be swept, and a warm chimney is a rescheduled visit.",
      "Clear the hearth and the area in front of it — furniture, rugs and ornaments a couple of metres out.",
      "Remove ash and leftover wood from the firebox.",
      "Tell us about anything you have noticed — smoke in the room, a smell, birds, a damper that sticks.",
      "Keep pets out of the room; the vacuum and the brushes are loud.",
    ],
    warning:
      "A chimney that has been used in the last 24 hours cannot be swept safely. If there was a fire last night, tell us before we set out and we will move the visit.",
    dayOf: [
      "We seal the fireplace opening, sweep the flue from the top or the bottom, vacuum the firebox, and inspect the liner, the cap and the damper. You get a written note of what we found.",
    ],
    afterCare:
      "If we found anything that needs attention before the next fire, do not light one until it is done. Otherwise, burn dry, seasoned wood — it is what keeps the chimney clean between visits.",
  },

  restoration: {
    checklist: [
      "Tell us what has happened and when — the timeline decides what can be saved. Water damage in particular gets worse by the hour.",
      "Move what you can save yourself out of the affected area — documents, photographs, electronics — and tell us what you would like us to try to recover.",
      "Clear a path from the door to the affected rooms for equipment: dehumidifiers, air movers, and the material that comes out.",
      "Tell us about anything sensitive in the house — a person with breathing difficulties, a pet, an alarm system.",
      "Know where your electrical panel and water shut-off are; we may need both.",
    ],
    warning:
      "Drying equipment has to run continuously, day and night, for as long as we leave it. Switching it off overnight to save power or noise undoes the day's drying and adds days to the job.",
    dayOf: [
      "We assess and document the damage first, contain the affected area, remove what cannot be saved, and set up drying or cleaning equipment. We check readings on every visit.",
      "Rebuilding — drywall, flooring, paint — starts only once the readings say the structure is dry.",
    ],
    afterCare:
      "Keep the equipment running until we remove it. Tell us immediately about any new smell, stain or dampness — it is far cheaper to catch early.",
  },

  earthworks: {
    checklist: [
      "Arrange for utility locates, or confirm we are doing it — nothing is dug until every line is marked.",
      "Tell your neighbours — heavy equipment, noise and trucks for the days we are on site.",
      "Move cars off the driveway and the street in front of the house — the machinery and the trucks need the space.",
      "Take down or secure fragile items inside — a demolition or an excavator next to the house shakes it.",
      "Tell us about the septic tank, the well, the irrigation lines, buried cables and anything else under the ground you know of.",
      "Pets and children well away from the work area at all times, including after hours.",
    ],
    warning:
      "Utility locates must be complete and visible when we arrive, and anything buried that the utilities do not mark — a private gas line to a pool heater, a septic field — is yours to tell us about. We cannot see through the ground.",
    dayOf: [
      "We protect what stays, fence off the work area, and work the site in the order on your quote. Debris leaves in bins or trucks as it is produced, not at the end.",
      "The site is left safe every evening: holes fenced, machinery locked, nothing loose.",
    ],
    afterCare:
      "Keep off the disturbed ground until it has been graded and settled. Tell us about any sinkage, standing water or crack that appears in the first weeks.",
  },

  home_inspection: {
    checklist: [
      "Make sure every utility is on — electricity, water, gas — and the pilot lights are lit. A system that is off cannot be inspected and will be reported as not inspected.",
      "Clear access to the electrical panel, the furnace, the water heater, the attic hatch and the crawlspace entrance — a clear metre in front of each.",
      "Move stored items away from the foundation walls in the basement and the garage, so the walls can be seen.",
      "Unlock every room, closet, outbuilding and gate, and turn off the alarm.",
      "Pets — crated or out of the house. We open every door and window, and go into the attic; a loose dog in the house is a delay and a risk.",
      "Plan to be there for the walk-through at the end; it is the most useful part.",
    ],
    warning:
      "The inspection is visual and non-invasive. Anything we cannot reach or see — a wall behind stored boxes, an attic hatch that is painted shut, a locked room — is reported as not inspected, not as fine. Please make everything reachable.",
    dayOf: [
      "We work through the property from the roof down — exterior, roof, attic, every room, the basement and the systems — operating everything under its normal controls and photographing what we find.",
      "At the end we walk you through the significant findings, and the written report follows.",
    ],
    afterCare:
      "Read the report in full, not only the summary — and ask us about anything you do not understand. Items marked for further evaluation are not a verdict; they are the thing to ask a specialist about before you decide.",
  },

  renovation: {
    checklist: [
      "Empty the rooms in the scope completely, including the closets. Anything that must stay in the house needs a home away from the work area for the whole project.",
      "Set up the room you will live in — a temporary kitchen if the kitchen is in scope, a bathroom that stays usable, somewhere quiet to work.",
      "Clear a path from the door to the work area, and decide which door the crew uses. Cover the flooring along it or ask us to.",
      "Take down anything on the walls on the other side of the rooms being worked on; framing and demolition vibrate through.",
      "Tell us about the alarm, the parking, the neighbours who need warning, and anything in the walls you know of.",
      "Pets and children — the work area is a building site outside working hours too. Keep it closed off.",
    ],
    warning:
      "Once demolition starts, what is behind the walls and under the floors becomes visible for the first time. Anything we find that changes the work — rot, old wiring, a moved drain — is shown to you and priced before we carry on. The schedule can move; the price does not without your say-so.",
    dayOf: [
      "Demolition first — the loudest, dustiest days. We seal the doorways and the ducts before we start. Then the rough work — framing, plumbing, electrical — then inspections, then the finishes.",
      "The crew is on site most days, but not every trade is every day; some days will be quiet while something cures or an inspector is awaited.",
      "We walk the work with you at the end of every stage.",
    ],
    afterCare:
      "New drywall, paint and caulking keep curing after we leave; small cracks at the joints in the first season are the house settling, and we come back to touch them up. Keep the warranty and the manuals we leave together.",
  },

  carpentry: {
    checklist: [
      "Clear the area where the work is going — furniture out or moved to the middle and covered, the wall bare.",
      "Have any material you are supplying on site and, for wood, inside the house for the time it needs to acclimatise.",
      "Tell us what is behind the wall if you know — wiring, plumbing, a stud that was cut.",
      "Decide on the finish — stained, painted, left bare — before we arrive.",
      "Keep pets out of the room while we are cutting.",
    ],
    warning:
      "Cutting happens on site, and sawdust travels. If there is a room that must stay clean — a nursery, a home office with equipment — tell us and we will seal it off before we start.",
    dayOf: [
      "We measure again, cut and fit, fix and finish. Cutting is done outside or in a contained area where the weather allows.",
      "Anything that has to be built off site is fitted on a second visit.",
    ],
    afterCare:
      "Wood moves with the seasons. A fine line opening at a joint over the first year is normal; a piece that pulls away from the wall is not — tell us.",
  },

  residential_cleaning: {
    checklist: [
      "Pick up — clothes, toys, papers and dishes put away, so the time is spent cleaning surfaces rather than moving what is on them.",
      "Put away valuables, cash and anything fragile you would rather we did not touch.",
      "Tell us about anything with special care — a marble counter, an antique, a product you are allergic to — and we will bring the right thing or use yours.",
      "Pets — tell us who is in the house, where they stay, and whether they are friendly. A cat that slips out an open door is our worst day.",
      "Arrange access: a key, a code, or somebody home. Tell us about the alarm.",
    ],
    warning:
      "A room that is cluttered gets tidied around, not cleaned. If you want the surfaces done, the surfaces need to be clear when we arrive — we cannot decide what is rubbish and what is not.",
    dayOf: [
      "We work top to bottom, room by room, with the products on your quote. Floors are done last, and we leave a note of anything we noticed — a leak under a sink, a window that does not close.",
    ],
    afterCare:
      "Floors may be damp for a short while after we leave. If anything was missed, tell us the same day and we come back for it — that is the standard.",
  },

  commercial_cleaning: {
    checklist: [
      "Arrange after-hours access — a key, a fob or a code — and tell us how the alarm is armed and disarmed.",
      "Ask staff to clear their desks of papers and personal items on cleaning days; we do not move documents.",
      "Tell us which areas are off limits, and which need extra attention — the kitchen, the washrooms, the reception.",
      "Show us where the supplies are stored, the water is drawn, and the rubbish goes out.",
      "Tell us about any product restriction in the building — scent-free, a surface that cannot take a disinfectant.",
    ],
    warning:
      "We follow the access and alarm instructions exactly as given. If a code changes or a door is added to the round, tell us before the visit — a false alarm at two in the morning is billed to you by the monitoring company, not by us.",
    dayOf: [
      "We clean on the schedule and to the checklist agreed, sign the log, and lock up. Anything we find — a leak, a broken fixture, a door that will not lock — is noted for you the same night.",
    ],
    afterCare:
      "Check the log and tell us within a day about anything missed. The checklist is adjusted, not argued.",
  },

  carpet_cleaning: {
    checklist: [
      "Vacuum the carpets before we arrive — it lets the cleaning go to the dirt that is bonded, not the dirt that is loose.",
      "Move small furniture, lamps, plants and everything on the floor out of the rooms. Large pieces can stay if your quote says so; we will work around them.",
      "Point out the stains and tell us what they are if you know — pet, wine, ink — because each one needs a different treatment.",
      "Pets — keep them off the carpet until it is fully dry, and out of the rooms while we work.",
      "Plan to keep the rooms unused until the carpet is dry. We will tell you how long on the day; ventilation and heat shorten it.",
    ],
    warning:
      "Some stains are permanent. We treat every one, but a stain that has set into the fibre, or one that was worked on with the wrong product, may lighten rather than lift. We will tell you honestly which is which before we start.",
    dayOf: [
      "We pre-treat, clean, rinse and extract, room by room, and put protective pads under any furniture leg that stays on damp carpet.",
    ],
    afterCare:
      "Keep off the carpet, or wear clean socks, until it is dry. Leave the pads under the furniture until then. Open the windows or run the fan to speed it up.",
  },

  window_cleaning: {
    checklist: [
      "Raise the blinds, open the curtains and clear the window sills inside — plants, ornaments and anything that would get wet.",
      "Move furniture a step back from the windows being done inside.",
      "Outside, move cars off the driveway and anything from under the windows where ladders will stand.",
      "Tell us about any window that does not open, a broken seal, or a screen that is fragile.",
      "Unlock side gates and keep pets inside while the ladders are up.",
    ],
    warning:
      "A window with a broken seal — fog between the panes — cannot be cleaned clear; the moisture is inside the unit. We will tell you which ones those are rather than charge you for cleaning what cannot be cleaned.",
    dayOf: [
      "We clean outside first, then inside, taking the screens out and washing them. Sills and frames are wiped. We leave the windows as we found them — open or closed.",
    ],
    afterCare:
      "Nothing to do. If a streak shows in tomorrow's sunlight, tell us and we come back for that window.",
  },

  pressure_washing: {
    checklist: [
      "Close every window and door, and tell us about any that do not seal — water at pressure finds the gap.",
      "Move cars off the driveway and away from the walls, and clear the outdoor furniture, planters, mats and toys from the area being washed.",
      "Cover or move plants close to the walls, and tell us about a garden bed you want protected — the runoff carries what comes off the wall.",
      "Turn off outdoor outlets and tell us about any light, camera or speaker mounted on the wall.",
      "Pets inside for the visit.",
    ],
    warning:
      "Pressure washing takes off what is loose. Paint that is already failing, a loose board, a crumbling mortar joint or an old sealer will come with the dirt. We look first and tell you what we see, but we cannot wash a wall that is not sound without revealing that it is not.",
    dayOf: [
      "We pre-treat, wash at the pressure the surface can take, rinse, and clear the runoff. The surface is wet when we leave and looks its true colour once it has dried.",
    ],
    afterCare:
      "Let the surface dry fully before sealing, staining or putting the furniture back. If a spot reappears within days, it is likely mould or algae and we can treat it.",
  },

  auto_detailing: {
    checklist: [
      "Remove your belongings from the car — glovebox, console, door pockets, boot and under the seats. We clean what is there; we cannot decide what is rubbish.",
      "Take out child seats, or tell us to; a seat that has been in place for a year has a car's worth of crumbs under it.",
      "Tell us about stains, smells and any area you want us to concentrate on.",
      "Leave the key, and tell us about anything that does not work — a window, a lock, a warning light.",
      "Do not wash the car the day before — we want to see what is really there.",
    ],
    warning:
      "Some marks are permanent: a burn in the upholstery, a scratch through the clear coat, dye transferred into light leather. We tell you which before we start rather than after.",
    dayOf: [
      "Interior first — vacuum, shampoo or steam, leather and trim — then the exterior: wash, decontaminate, polish where quoted, and protect. The car is dry and ready when you collect it.",
    ],
    afterCare:
      "Avoid an automatic wash for the first days after a polish and protection; wash by hand with two buckets. Keep a microfibre in the car for the marks that appear on day one.",
  },

  junk_removal: {
    checklist: [
      "Mark what goes — a piece of tape, a sticky note, or everything in one place. We take what you point at and nothing else.",
      "Separate anything you want to keep and put it somewhere we will not go.",
      "Tell us about hazardous items — paint, chemicals, batteries, propane, a fridge with refrigerant — some need a different disposal and some we cannot take.",
      "Clear a path from the items to the door, and from the door to where the truck can park.",
      "Pets shut in a room while doors are open and heavy things are moving.",
    ],
    warning:
      "We cannot take some things — chemicals, asbestos, certain appliances without a certificate — and we will tell you which when we see them. Please do not hide them in a box; it makes the whole load a problem at the disposal site.",
    dayOf: [
      "We confirm the load with you, carry it out, sweep the space, and take it to be sorted for donation, recycling and disposal. You get a receipt for what left.",
    ],
    afterCare:
      "Nothing to do. If something we took turns out to have been the wrong thing, call the same day — a load is sorted the next morning.",
  },

  landscaping_design: {
    checklist: [
      "Walk the plan with us before we start — confirm what stays, what goes, and where the lines are. It is much easier to move a bed on paper than in the ground.",
      "Arrange for utility locates, or confirm we are doing it; nothing is dug until the lines are marked.",
      "Tell us where the irrigation lines and heads are, and turn the system off for the project.",
      "Move cars off the driveway on delivery days — soil, stone and plants arrive on trucks.",
      "Tell your neighbours about the noise and the trucks, and about any plant near the line that is theirs.",
      "Pets — the yard is a building site while we are in it, and a freshly planted bed is irresistible to a dog. Keep them inside or on a lead.",
    ],
    warning:
      "New plants need watering on the schedule we give you, from the day they go in — including the weekends we are not there. A plant that dries out in its first fortnight does not come back, and it is the one thing we cannot warranty against.",
    dayOf: [
      "Removal and grading first, then hardscape, then irrigation, then beds and planting, then lawn. The site is untidy in the middle and not at the end.",
    ],
    afterCare:
      "Water on the schedule we leave with you. Keep off new sod and new beds for the time we tell you. Mulch settles; top it up in the second season.",
  },

  lawn_care: {
    checklist: [
      "Pick up the lawn — toys, hoses, dog bowls, furniture and anything else on the grass. What is in the way is mowed around, and what is hidden in long grass is mowed over.",
      "Pick up after the dog. We mow through what we find, and it ends up on the mower, on us and on your walls.",
      "Unlock the side gate, or tell us the code, and tell us if a gate must be kept closed for a pet.",
      "Mark anything low that is hard to see — a sprinkler head, a new plant, a stepping stone in the grass.",
      "Tell us about any area to leave — a wildflower patch, a bed you are seeding.",
    ],
    warning:
      "Anything left in the grass will be hit. A hose, a toy or a sprinkler head under a mower blade is a broken part and a stopped visit. Please walk the lawn before we arrive.",
    dayOf: [
      "We mow, trim the edges and blow the hard surfaces clean. A treatment, where your quote includes one, goes on after the cut; we leave a flag and a note about keeping off it.",
    ],
    afterCare:
      "Keep pets and children off a treated lawn until it has dried, or for the time on the flag. Water on the schedule we give you, not every day.",
  },

  irrigation: {
    checklist: [
      "Turn the water on to the outside taps and the irrigation supply, and tell us where the backflow preventer and the controller are.",
      "Arrange for utility locates for a new installation, or confirm we are doing it.",
      "Mark the beds and plants you want protected, and tell us about anything buried you know of.",
      "Tell us which zones are not working, and how — dry patch, flooding, a head that does not pop up.",
      "Pets inside while trenches are open.",
    ],
    warning:
      "On a new installation the lawn is trenched and the turf lifted along every line. It goes back and recovers within weeks with watering, but it will look like it was dug for a while. Keep off the trench lines until they have settled.",
    dayOf: [
      "For a repair we test each zone, find the fault, fix it and run the system. For an installation we trench, lay pipe, set the heads, wire the controller, and run every zone with you watching.",
    ],
    afterCare:
      "Run the schedule we programmed for a week before changing it, and tell us if a zone is dry or flooding. Have the system blown out before the first frost — it is the one thing that stops a pipe splitting.",
  },

  tree_care_service: {
    checklist: [
      "Move cars off the driveway and away from under the tree — branches come down where they must, not where they are convenient.",
      "Clear the ground under the tree — furniture, planters, toys, the trampoline — and cover anything that cannot be moved.",
      "Tell your neighbours if the tree is near the line, and tell us about any branch that is over their property.",
      "Unlock gates wide enough for the chipper, and tell us where the chips can be blown or whether they leave with us.",
      "Pets and children inside for the whole visit. Cutting overhead is the one job where nobody walks through the work area.",
    ],
    warning:
      "Nobody under the tree while we are in it — that includes walking to the car. We rope off the drop zone and ask you to stay outside it, from the first cut to the last.",
    dayOf: [
      "We rope off the drop zone, climb or lift, and take the tree down in sections or prune to the plan on your quote. Brush is chipped as we go and the wood is cut to the lengths you asked for or removed.",
      "The chipper is loud. A whole-tree removal is a full day of it.",
    ],
    afterCare:
      "Keep off a fresh stump grinding site until it has been backfilled. Watch a pruned tree through the next season; some dieback on a cut branch is normal, a whole limb dying is not — tell us.",
  },

  snow_removal: {
    checklist: [
      "Put markers along the driveway edges, the lawn and the beds before the first snow, or ask us to — once they are covered, nobody can see them.",
      "Move cars into the garage or to the street before a storm. A car on the driveway is a driveway we cannot clear.",
      "Tell us where the snow can be piled and where it cannot — not on the septic, not against the hydrant, not on the neighbour's side.",
      "Keep hoses, bins and toys off the driveway for the season; a bin under the snow is a bent bin.",
      "Tell us about anything on the driveway surface that cannot take a blade — pavers, a heated section, a new sealer.",
    ],
    warning:
      "We come when the snow reaches the depth on your plan, in the order of the route. A car on the driveway when we arrive means we clear around it, not under it, and we do not come back for the space until the next storm.",
    dayOf: [
      "We clear the areas on your plan, pile the snow where we agreed, and salt or sand the walks if your plan includes it. Steps and walkways are cleared by hand where your plan includes them.",
    ],
    afterCare:
      "Tell us about any mark on the lawn or a paver that moved when the snow melts; we make good in spring.",
  },

  pest_control: {
    checklist: [
      "Put away food, dishes, pet bowls and anything on the counters; cover or remove what is in an open pantry.",
      "Clear under the sinks and along the walls where the baseboards meet the floor — that is where we treat.",
      "Tell us about pets and where they will be — fish tanks in particular need to be covered and the pump switched off during a spray.",
      "Tell us about anyone in the house who is pregnant, asthmatic or sensitive to chemicals, so we can choose the product and the timing.",
      "Plan to be out of the treated rooms, or out of the house, for the time we tell you on the day.",
    ],
    warning:
      "The rooms treated are out of use for the time we give you, and pets and children stay out until the treatment has dried. A treatment that is walked through is a treatment that does not work and has to be repeated.",
    dayOf: [
      "We inspect first, tell you what we found and where, then treat to the plan on your quote. Bait stations and monitors are labelled and left in place; please do not move them.",
    ],
    afterCare:
      "Do not wash the treated areas for the time we tell you. Expect to see more activity for a day or two — that is the treatment working. Tell us if you are still seeing them after the period we gave you; the follow-up is part of the job.",
  },

  pool_spa: {
    checklist: [
      "Clear the pool deck of furniture and toys where we need to work, and unlock the gate to the pool area.",
      "Make sure the equipment pad — pump, filter, heater — is accessible, and tell us where the power shut-off is.",
      "Tell us what you have noticed — a leak, a cloudy pool, an error on the heater, a pump that is loud.",
      "Keep the water level where it should be, unless we have asked you to lower it for the work.",
      "Pets and children out of the pool area for the visit.",
    ],
    warning:
      "After a chemical treatment nobody swims until the levels we tell you have been reached. We test before we leave, and we tell you when it is safe — please wait for it.",
    dayOf: [
      "We test the water, inspect the equipment, do the work on your quote and run the system through a cycle before we leave. Anything we find beyond the quote is shown to you and priced before it is done.",
    ],
    afterCare:
      "Keep the pump running for the time we tell you after a treatment. Watch the levels for the first days and tell us if they drift.",
  },

  dog_walking: {
    checklist: [
      "Leave the lead, the harness, a towel and the treats where we agreed, and tell us if the dog wears anything else — a muzzle, a coat, a light.",
      "Give us access — a key, a code, a lockbox — and tell us how the alarm works and where the dog waits when you are out.",
      "Tell us about the dog: how they are with other dogs, with children, with strangers at the door, and anything that frightens them.",
      "Tell us about feeding and medication if either falls during the visit, and where they are kept.",
      "Leave your vet's number and an emergency contact.",
    ],
    warning:
      "A dog that is unwell, injured or in season stays home — tell us before the visit. If we arrive and the dog cannot safely walk, the visit becomes a check-in and is still charged.",
    dayOf: [
      "We arrive at the agreed time, walk the agreed route for the agreed time, wipe paws, refresh the water, and leave a note or a message about how it went.",
    ],
    afterCare:
      "Tell us about any change — a new medication, a new fear, a new dog next door — before the next walk, not after.",
  },

  pooper_scooper: {
    checklist: [
      "Unlock the gate or give us the code, and keep the dogs inside while we are in the yard.",
      "Pick up toys and hoses from the areas we service; it is much faster on a clear lawn.",
      "Tell us which areas to cover and which to skip — the vegetable bed, the neighbour's side.",
      "Tell us where to leave the bag, or whether it goes with us.",
    ],
    warning:
      "A dog loose in the yard when we arrive means we cannot enter, and the visit is charged. Please keep them in until we have gone.",
    dayOf: [
      "We walk the whole yard in a grid, bag what we find, treat the area if your plan includes it, and latch the gate behind us.",
    ],
    afterCare:
      "Nothing to do. Tell us if the dogs' health changes — what we find is often the first sign.",
  },
};
