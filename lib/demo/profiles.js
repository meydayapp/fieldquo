// lib/demo/profiles.js
//
// Where each demo trade lives, and what its world is made of.
//
// ══ Why a second pure file beside industries.js ═══════════════════════════
//
// industries.js says what a demo SELLS (categories, services, rates, job
// titles). This file says where it is and who it deals with: a real street in
// a real city, the province's tax, the area code its phones carry, the streets
// its clients live on, the materials it buys, the truck it drives. The owner's
// instruction on 2026-09-12 — "use fake real names and real addresses and
// random phone numbers in the parts and sections where it is warranted, same
// for payroll and calendar etc and booking" — is a statement about THIS data,
// and it reads better as one table per trade than as forty more lines inside
// each preset.
//
// Pure data, keyed by the same INDUSTRIES key. lib/demo/seedContent.js reads
// it; scripts/check-demo-content.mjs executes the seed against it and asserts
// every phone is in the fictional 555-01xx block and every email is on
// example.com — so nothing in here can reach a real person by construction.
//
// ══ Real streets, fictional people ═══════════════════════════════════════
//
// The streets are real (Bank Street exists; so does rue Sainte-Catherine).
// The house numbers are picked from a plausible range, the people are drawn
// from name pools, and the phones are 555-01xx — the block NANP reserves for
// fiction. A demo address that Google Maps can find sells the map features; a
// demo address that rings a real doorbell would be a different kind of demo.

/**
 * Per-trade profile. Every field is read by the seed; the check asserts the
 * set of keys is identical across trades so a new trade cannot come up half
 * dressed.
 *
 *   address / city / province / postalCode / country  the shop
 *   phoneArea            the area code every phone in this demo carries
 *   currency / taxRates  the province's or state's sales tax, as TaxRate rows
 *   taxIdName / taxIdNumber  what the invoice footer prints
 *   timezone / utcOffset the wall clock the seed writes visits in
 *   languages            the client language mix ("fr" first means mostly
 *                        francophone)
 *   streets              [{ name, fsa, min, max }] — real streets in that
 *                        city with the postal FSA they fall in and a plausible
 *                        house-number range
 *   materials            [{ name, unit, cost, category }] the price book /
 *                        purchasing side buys
 *   supplier             where those materials come from
 *   vehicle              the van on the fleet screen
 *   subcontractor        the trade this company subs out
 *   equipment            what a client OWNS that this trade services
 *                        (null for trades without a warranty story)
 *   checklist            the crew's on-site list
 *   qty                  a typical quantity per preset service, in service
 *                        order — so a painting quote says 640 sqft, not 3
 */
export const PROFILES = {
  painting: {
    address: "1145 Wellington St W",
    city: "Ottawa",
    province: "ON",
    postalCode: "K1Y 2Y6",
    country: "CA",
    phoneArea: "613",
    currency: "CAD",
    taxRates: [{ name: "HST", rate: 13, isDefault: true }],
    taxIdName: "HST",
    taxIdNumber: "812345678 RT0001",
    timezone: "America/Toronto",
    utcOffset: -4,
    languages: ["en", "en", "en", "fr"],
    streets: [
      { name: "Bank Street", fsa: "K1S", min: 400, max: 1900 },
      { name: "Elgin Street", fsa: "K2P", min: 150, max: 480 },
      { name: "Somerset Street W", fsa: "K1R", min: 300, max: 1100 },
      { name: "Preston Street", fsa: "K1R", min: 200, max: 500 },
      { name: "Richmond Road", fsa: "K2A", min: 1000, max: 2200 },
      { name: "Carling Avenue", fsa: "K1Z", min: 800, max: 2400 },
      { name: "Holland Avenue", fsa: "K1Y", min: 100, max: 500 },
      { name: "Glebe Avenue", fsa: "K1S", min: 20, max: 300 },
      { name: "Sunnyside Avenue", fsa: "K1S", min: 100, max: 1100 },
      { name: "Beechwood Avenue", fsa: "K1L", min: 30, max: 300 },
      { name: "Main Street", fsa: "K1S", min: 100, max: 400 },
      { name: "Island Park Drive", fsa: "K1Y", min: 100, max: 700 },
    ],
    materials: [
      { name: "Interior latex — eggshell, 18.9 L", unit: "pail", cost: 189, category: "paint" },
      { name: "Ceiling flat — 18.9 L", unit: "pail", cost: 142, category: "paint" },
      { name: "Trim enamel — 3.78 L", unit: "can", cost: 74, category: "paint" },
      { name: "Painter's tape 36 mm", unit: "roll", cost: 9.5, category: "sundries" },
      { name: "Drop sheets 12×15", unit: "each", cost: 28, category: "sundries" },
      { name: "Drywall compound 20 kg", unit: "pail", cost: 26, category: "drywall" },
    ],
    supplier: { name: "Dulux Paints — Carling", contactName: "Trade counter", accountRef: "NP-4471" },
    vehicle: { makeModel: "Ford Transit 250", year: 2022, plate: "CNBX 481", odometerKm: 61240 },
    subcontractor: { name: "Capital Drywall Ltd.", trade: "Drywall" },
    equipment: null,
    checklist: ["Furniture covered and floors masked", "Walls washed and sanded", "Two coats applied, cut lines checked", "Touch-ups walked with the client", "Site left clean, tape removed"],
    qty: [640, 120, 900, 3],
  },

  cabinets: {
    // The same shop, people and client the help-centre screenshots are
    // photographed around (docs/screens/app-guide/harness/fixtures/company.js),
    // so a guide and a live demo tell one story.
    address: "1420 boul. Curé-Labelle",
    city: "Laval",
    province: "QC",
    postalCode: "H7V 2W3",
    country: "CA",
    phoneArea: "450",
    currency: "CAD",
    taxRates: [
      { name: "GST", rate: 5, isDefault: false },
      { name: "QST", rate: 9.975, isDefault: false },
      { name: "GST + QST", rate: 14.975, isDefault: true },
    ],
    taxIdName: "GST/QST",
    taxIdNumber: "123456789 RT0001",
    timezone: "America/Toronto",
    utcOffset: -4,
    languages: ["fr", "fr", "en"],
    streets: [
      { name: "rue des Érables", fsa: "H7N", min: 20, max: 300 },
      { name: "boul. des Laurentides", fsa: "H7G", min: 1500, max: 4200 },
      { name: "rue Saint-Louis", fsa: "H7X", min: 100, max: 900 },
      { name: "boul. Cartier O", fsa: "H7N", min: 100, max: 1100 },
      { name: "rue Principale", fsa: "H7X", min: 200, max: 3400 },
      { name: "boul. Sainte-Rose", fsa: "H7L", min: 100, max: 800 },
      { name: "rue de Chambéry", fsa: "H7L", min: 20, max: 400 },
      { name: "boul. Lévesque E", fsa: "H7E", min: 2000, max: 5900 },
      { name: "avenue du Parc", fsa: "H7V", min: 10, max: 300 },
      { name: "rue Bourbonnière", fsa: "H7M", min: 30, max: 500 },
      { name: "boul. Samson", fsa: "H7W", min: 500, max: 2900 },
      { name: "rue de Genève", fsa: "H7K", min: 20, max: 400 },
    ],
    materials: [
      { name: "Shaker door — maple, painted", unit: "door", cost: 68, category: "doors" },
      { name: "Drawer front — maple", unit: "each", cost: 38, category: "doors" },
      { name: "Soft-close hinge", unit: "pair", cost: 6.4, category: "hardware" },
      { name: "Conversion varnish — 3.78 L", unit: "can", cost: 96, category: "finish" },
      { name: "White oak — rift sawn, 4/4", unit: "bd ft", cost: 14.5, category: "lumber" },
      { name: "Quartz slab — 3 cm", unit: "sqft", cost: 42, category: "countertop" },
    ],
    supplier: { name: "Richelieu Hardware — Laval", contactName: "Comptoir pro", accountRef: "ER-2210" },
    vehicle: { makeModel: "RAM ProMaster 2500", year: 2021, plate: "F72 KLD", odometerKm: 88410 },
    subcontractor: { name: "Plomberie Bélanger inc.", trade: "Plumbing" },
    equipment: null,
    checklist: ["Doors labelled and removed", "Kitchen masked, dust barrier up", "Boxes set level and plumb", "Doors hung, hinges adjusted", "Hardware installed, drawers aligned", "Client walkthrough signed"],
    qty: [24, 9, 12, 38],
  },

  flooring: {
    address: "740 rue Saint-Jean",
    city: "Québec",
    province: "QC",
    postalCode: "G1R 1P8",
    country: "CA",
    phoneArea: "418",
    currency: "CAD",
    taxRates: [
      { name: "GST", rate: 5, isDefault: false },
      { name: "QST", rate: 9.975, isDefault: false },
      { name: "GST + QST", rate: 14.975, isDefault: true },
    ],
    taxIdName: "GST/QST",
    taxIdNumber: "134567890 RT0001",
    timezone: "America/Toronto",
    utcOffset: -4,
    languages: ["fr", "fr", "fr", "en"],
    streets: [
      { name: "Grande Allée E", fsa: "G1R", min: 100, max: 1200 },
      { name: "rue Cartier", fsa: "G1R", min: 900, max: 1300 },
      { name: "chemin Sainte-Foy", fsa: "G1S", min: 800, max: 2900 },
      { name: "boul. René-Lévesque O", fsa: "G1S", min: 500, max: 2200 },
      { name: "rue Maguire", fsa: "G1T", min: 1200, max: 1500 },
      { name: "avenue Myrand", fsa: "G1V", min: 700, max: 1200 },
      { name: "rue Saint-Vallier O", fsa: "G1N", min: 200, max: 1400 },
      { name: "3e Avenue", fsa: "G1L", min: 400, max: 1300 },
      { name: "boul. Charest E", fsa: "G1K", min: 200, max: 900 },
      { name: "avenue Holland", fsa: "G1S", min: 900, max: 1500 },
      { name: "rue de Bernières", fsa: "G1R", min: 20, max: 300 },
      { name: "boul. Wilfrid-Hamel", fsa: "G1M", min: 900, max: 3600 },
    ],
    materials: [
      { name: "Engineered white oak 7½\" — 4 mm wear", unit: "sqft", cost: 6.85, category: "hardwood" },
      { name: "Luxury vinyl plank — 5 mm SPC", unit: "sqft", cost: 2.95, category: "vinyl" },
      { name: "Porcelain tile 12×24", unit: "sqft", cost: 4.2, category: "tile" },
      { name: "Underlayment — cork 6 mm", unit: "sqft", cost: 1.15, category: "sundries" },
      { name: "Thin-set mortar 22.7 kg", unit: "bag", cost: 24, category: "tile" },
      { name: "Stair tread — oak 42\"", unit: "each", cost: 58, category: "hardwood" },
    ],
    supplier: { name: "Planchers Lauzon — Québec", contactName: "Service aux entrepreneurs", accountRef: "CF-0932" },
    vehicle: { makeModel: "Mercedes Sprinter 2500", year: 2020, plate: "L44 XPT", odometerKm: 104300 },
    subcontractor: { name: "Menuiserie Lachance", trade: "Finish carpentry" },
    equipment: null,
    checklist: ["Subfloor moisture read and logged", "Old flooring removed and disposed", "Underlayment laid, seams taped", "Boards racked, expansion gap kept", "Transitions and baseboards set", "Floor cleaned, client walked through"],
    qty: [480, 620, 90, 14],
  },

  landscaping: {
    address: "355 Wharncliffe Rd S",
    city: "London",
    province: "ON",
    postalCode: "N6J 2L3",
    country: "CA",
    phoneArea: "519",
    currency: "CAD",
    taxRates: [{ name: "HST", rate: 13, isDefault: true }],
    taxIdName: "HST",
    taxIdNumber: "823456789 RT0001",
    timezone: "America/Toronto",
    utcOffset: -4,
    languages: ["en"],
    streets: [
      { name: "Richmond Street", fsa: "N6A", min: 300, max: 1400 },
      { name: "Dundas Street", fsa: "N6B", min: 200, max: 1200 },
      { name: "Oxford Street W", fsa: "N6H", min: 100, max: 1600 },
      { name: "Wortley Road", fsa: "N6C", min: 50, max: 400 },
      { name: "Adelaide Street N", fsa: "N5Y", min: 200, max: 1400 },
      { name: "Wonderland Road N", fsa: "N6H", min: 300, max: 1600 },
      { name: "Colborne Street", fsa: "N6B", min: 200, max: 800 },
      { name: "Baseline Road W", fsa: "N6J", min: 100, max: 800 },
      { name: "Hyde Park Road", fsa: "N6H", min: 500, max: 1500 },
      { name: "Waterloo Street", fsa: "N6B", min: 300, max: 1100 },
      { name: "Riverside Drive", fsa: "N6H", min: 20, max: 1000 },
      { name: "Wellington Road", fsa: "N6C", min: 300, max: 1100 },
    ],
    materials: [
      { name: "Triple-mix soil", unit: "yd³", cost: 48, category: "soil" },
      { name: "Cedar mulch", unit: "yd³", cost: 52, category: "mulch" },
      { name: "Interlock paver — 60 mm", unit: "sqft", cost: 4.6, category: "hardscape" },
      { name: "Boxwood 2 gal", unit: "each", cost: 22, category: "plants" },
      { name: "Sod — Kentucky bluegrass", unit: "roll", cost: 3.4, category: "turf" },
      { name: "Limestone screening", unit: "yd³", cost: 42, category: "hardscape" },
    ],
    supplier: { name: "TLC Landscape Supply", contactName: "Yard desk", accountRef: "ML-118" },
    vehicle: { makeModel: "Ford F-250 + 14' trailer", year: 2019, plate: "BRWT 220", odometerKm: 132800 },
    subcontractor: { name: "Forest City Tree Care", trade: "Arborist" },
    equipment: null,
    checklist: ["Locates confirmed before digging", "Beds edged and weeded", "Plants set per plan, watered in", "Mulch 3\" deep, kept off trunks", "Debris hauled, driveway blown off"],
    qty: [1, 220, 5, 1],
  },

  cleaning: {
    address: "4020 rue Sainte-Catherine O",
    city: "Montréal",
    province: "QC",
    postalCode: "H3Z 1P2",
    country: "CA",
    phoneArea: "514",
    currency: "CAD",
    taxRates: [
      { name: "GST", rate: 5, isDefault: false },
      { name: "QST", rate: 9.975, isDefault: false },
      { name: "GST + QST", rate: 14.975, isDefault: true },
    ],
    taxIdName: "GST/QST",
    taxIdNumber: "145678901 RT0001",
    timezone: "America/Toronto",
    utcOffset: -4,
    languages: ["fr", "en", "fr", "en"],
    streets: [
      { name: "rue Sainte-Catherine E", fsa: "H2L", min: 800, max: 2200 },
      { name: "rue Saint-Denis", fsa: "H2J", min: 3500, max: 4800 },
      { name: "boul. Saint-Laurent", fsa: "H2W", min: 3400, max: 5200 },
      { name: "avenue du Mont-Royal E", fsa: "H2J", min: 100, max: 1900 },
      { name: "rue Sherbrooke O", fsa: "H3H", min: 1400, max: 2300 },
      { name: "rue Rachel E", fsa: "H2J", min: 200, max: 1900 },
      { name: "avenue Laurier O", fsa: "H2T", min: 100, max: 1300 },
      { name: "rue Wellington", fsa: "H4G", min: 3800, max: 5200 },
      { name: "avenue Monkland", fsa: "H4A", min: 5400, max: 6300 },
      { name: "rue Ontario E", fsa: "H2L", min: 1400, max: 2200 },
      { name: "boul. Décarie", fsa: "H4A", min: 5000, max: 6600 },
      { name: "rue Masson", fsa: "H1X", min: 2500, max: 3400 },
    ],
    materials: [
      { name: "Neutral floor cleaner 4 L", unit: "jug", cost: 21, category: "chemicals" },
      { name: "Glass cleaner 4 L", unit: "jug", cost: 17, category: "chemicals" },
      { name: "Microfibre cloths (pack of 24)", unit: "pack", cost: 29, category: "supplies" },
      { name: "Vacuum bags — backpack", unit: "box", cost: 34, category: "supplies" },
      { name: "Nitrile gloves (100)", unit: "box", cost: 14, category: "supplies" },
      { name: "Disinfectant concentrate 4 L", unit: "jug", cost: 38, category: "chemicals" },
    ],
    supplier: { name: "Produits Sany", contactName: "Comptoir", accountRef: "BW-0771" },
    vehicle: { makeModel: "Toyota Sienna", year: 2021, plate: "K91 MZR", odometerKm: 47200 },
    subcontractor: { name: "Vitres Plus Montréal", trade: "High-rise window cleaning" },
    equipment: null,
    checklist: ["Entry code used, alarm set on exit", "Kitchen: counters, sink, appliance fronts", "Bathrooms: fixtures, mirrors, floor", "Floors vacuumed then mopped", "Bins emptied, liners replaced", "Lights off, doors locked"],
    qty: [3, 5, 14, 1],
  },

  plumbing: {
    address: "2150 Dundas St W",
    city: "Mississauga",
    province: "ON",
    postalCode: "L5K 1R6",
    country: "CA",
    phoneArea: "905",
    currency: "CAD",
    taxRates: [{ name: "HST", rate: 13, isDefault: true }],
    taxIdName: "HST",
    taxIdNumber: "834567890 RT0001",
    timezone: "America/Toronto",
    utcOffset: -4,
    languages: ["en"],
    streets: [
      { name: "Hurontario Street", fsa: "L5B", min: 100, max: 4000 },
      { name: "Lakeshore Road E", fsa: "L5G", min: 100, max: 1400 },
      { name: "Burnhamthorpe Road W", fsa: "L5B", min: 100, max: 3600 },
      { name: "Cawthra Road", fsa: "L5A", min: 900, max: 3400 },
      { name: "Mississauga Road", fsa: "L5H", min: 1000, max: 2900 },
      { name: "Erin Mills Parkway", fsa: "L5L", min: 2200, max: 5100 },
      { name: "Queen Street S", fsa: "L5M", min: 100, max: 400 },
      { name: "Truscott Drive", fsa: "L5J", min: 800, max: 1400 },
      { name: "Bloor Street", fsa: "L4Y", min: 1000, max: 3500 },
      { name: "Glen Erin Drive", fsa: "L5L", min: 2400, max: 4200 },
      { name: "Winston Churchill Blvd", fsa: "L5J", min: 1400, max: 4400 },
      { name: "Britannia Road W", fsa: "L5V", min: 100, max: 3900 },
    ],
    materials: [
      { name: "Water heater — 50 gal gas, power vent", unit: "each", cost: 1420, category: "equipment" },
      { name: "PEX-A ½\" (100 ft)", unit: "coil", cost: 68, category: "pipe" },
      { name: "Copper ¾\" type L (12 ft)", unit: "length", cost: 54, category: "pipe" },
      { name: "Ball valve ¾\"", unit: "each", cost: 18.5, category: "fittings" },
      { name: "P-trap 1½\" ABS", unit: "each", cost: 6.2, category: "fittings" },
      { name: "Sump pump ½ HP", unit: "each", cost: 265, category: "equipment" },
    ],
    supplier: { name: "Wolseley Plumbing — Mississauga", contactName: "Counter", accountRef: "RP-3301" },
    vehicle: { makeModel: "Ford Transit 350 high roof", year: 2023, plate: "CRPK 907", odometerKm: 38650 },
    subcontractor: { name: "Peel Excavation Ltd.", trade: "Excavation" },
    equipment: [
      { name: "Water heater", manufacturer: "Bradford White", modelNumber: "RG250T6N", warrantyYears: 6 },
      { name: "Sump pump", manufacturer: "Zoeller", modelNumber: "M53", warrantyYears: 3 },
    ],
    checklist: ["Water shut off, pressure released", "Old unit drained and removed", "New unit set, connections tested", "No leaks after 15 min under pressure", "Client shown shut-off valve"],
    qty: [1, 3, 1, 1],
  },

  hvac: {
    address: "2200 S Congress Ave",
    city: "Austin",
    province: "TX",
    postalCode: "78704",
    country: "US",
    phoneArea: "512",
    currency: "USD",
    taxRates: [{ name: "Texas sales tax", rate: 8.25, isDefault: true }],
    taxIdName: "Texas taxpayer no.",
    taxIdNumber: "3-20412-3456-7",
    timezone: "America/Chicago",
    utcOffset: -5,
    languages: ["en", "en", "es"],
    streets: [
      { name: "S Congress Ave", fsa: "78704", min: 1000, max: 4400 },
      { name: "Burnet Rd", fsa: "78756", min: 4000, max: 7200 },
      { name: "N Lamar Blvd", fsa: "78751", min: 3000, max: 6900 },
      { name: "Guadalupe St", fsa: "78705", min: 2400, max: 4300 },
      { name: "Manor Rd", fsa: "78722", min: 1800, max: 3200 },
      { name: "E Cesar Chavez St", fsa: "78702", min: 1200, max: 2600 },
      { name: "Duval St", fsa: "78751", min: 3000, max: 4500 },
      { name: "Barton Springs Rd", fsa: "78704", min: 1000, max: 2400 },
      { name: "S 1st St", fsa: "78704", min: 1500, max: 4200 },
      { name: "Anderson Ln", fsa: "78757", min: 2200, max: 2800 },
      { name: "W 6th St", fsa: "78703", min: 1000, max: 2200 },
      { name: "Airport Blvd", fsa: "78722", min: 2400, max: 5800 },
    ],
    materials: [
      { name: "Furnace — 80k BTU, 96% AFUE", unit: "each", cost: 2650, category: "equipment" },
      { name: "Condenser — 3 ton, 16 SEER2", unit: "each", cost: 2380, category: "equipment" },
      { name: "Line set ¾\"×⅜\" (50 ft)", unit: "each", cost: 168, category: "refrigeration" },
      { name: "R-410A (25 lb)", unit: "cylinder", cost: 245, category: "refrigeration" },
      { name: "Flex duct R8 — 10\" (25 ft)", unit: "box", cost: 92, category: "duct" },
      { name: "Filter 20×25×4 MERV 11", unit: "each", cost: 31, category: "sundries" },
    ],
    supplier: { name: "Johnstone Supply — Austin", contactName: "Counter", accountRef: "CA-5520" },
    vehicle: { makeModel: "Chevrolet Express 2500", year: 2022, plate: "PKR 4471", odometerKm: 52300 },
    subcontractor: { name: "Lone Star Electric Co.", trade: "Electrical" },
    equipment: [
      { name: "Furnace", manufacturer: "Carrier", modelNumber: "59TP6A080", warrantyYears: 10 },
      { name: "AC condenser", manufacturer: "Trane", modelNumber: "XR16", warrantyYears: 10 },
      { name: "Thermostat", manufacturer: "Ecobee", modelNumber: "Smart Premium", warrantyYears: 3 },
    ],
    checklist: ["Power off at disconnect, lockout on", "Refrigerant recovered and logged", "New unit set, level, drain tested", "Charge verified by subcooling", "Thermostat programmed, client shown filter"],
    qty: [1, 4, 1, 1],
  },

  roofing: {
    address: "3800 Tennyson St",
    city: "Denver",
    province: "CO",
    postalCode: "80212",
    country: "US",
    phoneArea: "303",
    currency: "USD",
    taxRates: [{ name: "Denver sales tax", rate: 8.81, isDefault: true }],
    taxIdName: "Colorado account no.",
    taxIdNumber: "12345678-0001",
    timezone: "America/Denver",
    utcOffset: -6,
    languages: ["en", "en", "es"],
    streets: [
      { name: "Tennyson St", fsa: "80212", min: 3800, max: 4700 },
      { name: "E Colfax Ave", fsa: "80206", min: 2200, max: 6400 },
      { name: "S Broadway", fsa: "80210", min: 1200, max: 2800 },
      { name: "Federal Blvd", fsa: "80204", min: 200, max: 4400 },
      { name: "Speer Blvd", fsa: "80204", min: 600, max: 1900 },
      { name: "S Pearl St", fsa: "80210", min: 1200, max: 2100 },
      { name: "W 32nd Ave", fsa: "80211", min: 2200, max: 5200 },
      { name: "E 17th Ave", fsa: "80218", min: 1000, max: 2600 },
      { name: "S Gaylord St", fsa: "80210", min: 1000, max: 1400 },
      { name: "W 38th Ave", fsa: "80211", min: 2400, max: 5200 },
      { name: "Monaco Pkwy", fsa: "80220", min: 100, max: 3000 },
      { name: "S University Blvd", fsa: "80210", min: 1500, max: 2800 },
    ],
    materials: [
      { name: "Architectural shingle — 30 yr", unit: "bundle", cost: 42, category: "shingles" },
      { name: "Synthetic underlayment (10 sq)", unit: "roll", cost: 118, category: "underlayment" },
      { name: "Ice & water shield (2 sq)", unit: "roll", cost: 96, category: "underlayment" },
      { name: "Ridge vent 4 ft", unit: "each", cost: 14, category: "ventilation" },
      { name: "Drip edge 10 ft", unit: "each", cost: 9.8, category: "flashing" },
      { name: "Roofing nails 1¼\" (50 lb)", unit: "box", cost: 68, category: "fasteners" },
    ],
    supplier: { name: "ABC Supply — Denver", contactName: "Branch counter", accountRef: "SR-8812" },
    vehicle: { makeModel: "RAM 3500 flatbed", year: 2020, plate: "AXP-D42", odometerKm: 121900 },
    subcontractor: { name: "Mile High Gutters LLC", trade: "Gutters" },
    equipment: null,
    checklist: ["Tarps and plywood protecting landscaping", "Tear-off complete, deck inspected", "Underlayment and ice shield lapped correctly", "Flashing and vents sealed", "Magnet sweep for nails, gutters cleared"],
    qty: [28, 600, 400, 6],
  },

  electrical: {
    address: "180 boul. Maloney E",
    city: "Gatineau",
    province: "QC",
    postalCode: "J8P 1J7",
    country: "CA",
    phoneArea: "819",
    currency: "CAD",
    taxRates: [
      { name: "GST", rate: 5, isDefault: false },
      { name: "QST", rate: 9.975, isDefault: false },
      { name: "GST + QST", rate: 14.975, isDefault: true },
    ],
    taxIdName: "GST/QST",
    taxIdNumber: "156789012 RT0001",
    timezone: "America/Toronto",
    utcOffset: -4,
    languages: ["fr", "fr", "fr", "en"],
    streets: [
      { name: "boul. Maloney O", fsa: "J8T", min: 100, max: 1200 },
      { name: "rue Principale", fsa: "J9H", min: 100, max: 800 },
      { name: "boul. Saint-Joseph", fsa: "J8Y", min: 100, max: 900 },
      { name: "rue Laurier", fsa: "J8X", min: 30, max: 400 },
      { name: "boul. Gréber", fsa: "J8T", min: 100, max: 1100 },
      { name: "rue Notre-Dame", fsa: "J8P", min: 100, max: 1200 },
      { name: "boul. de la Cité-des-Jeunes", fsa: "J8Y", min: 100, max: 900 },
      { name: "chemin d'Aylmer", fsa: "J9H", min: 100, max: 1500 },
      { name: "rue Jacques-Cartier", fsa: "J8T", min: 100, max: 900 },
      { name: "boul. Saint-René O", fsa: "J8T", min: 100, max: 800 },
      { name: "rue Eddy", fsa: "J8X", min: 20, max: 200 },
      { name: "boul. Lorrain", fsa: "J8R", min: 200, max: 1400 },
    ],
    materials: [
      { name: "Panel — 200 A, 40 circuits", unit: "each", cost: 385, category: "panel" },
      { name: "NMD90 14/2 (75 m)", unit: "roll", cost: 112, category: "wire" },
      { name: "EV charger — 48 A, Wi-Fi", unit: "each", cost: 690, category: "equipment" },
      { name: "Breaker — 20 A AFCI", unit: "each", cost: 46, category: "panel" },
      { name: "Pot light — 4\" LED, slim", unit: "each", cost: 19, category: "fixtures" },
      { name: "Device box — 2-gang", unit: "each", cost: 3.1, category: "sundries" },
    ],
    supplier: { name: "Guillevin — Gatineau", contactName: "Comptoir", accountRef: "BL-4402" },
    vehicle: { makeModel: "Ford Transit Connect", year: 2022, plate: "M18 QRV", odometerKm: 43900 },
    subcontractor: { name: "Excavation Lafleur", trade: "Trenching" },
    equipment: [
      { name: "Electrical panel", manufacturer: "Schneider", modelNumber: "Homeline 200A", warrantyYears: 10 },
      { name: "EV charger", manufacturer: "Grizzl-E", modelNumber: "Smart 48A", warrantyYears: 3 },
    ],
    checklist: ["Permit posted, Hydro notified", "Main disconnected and tagged", "Circuits labelled at the panel", "Torque values checked", "Inspection booked, client shown breakers"],
    qty: [1, 6, 1, 1],
  },

  handyman: {
    address: "245 James St N",
    city: "Hamilton",
    province: "ON",
    postalCode: "L8R 2L3",
    country: "CA",
    phoneArea: "905",
    currency: "CAD",
    taxRates: [{ name: "HST", rate: 13, isDefault: true }],
    taxIdName: "HST",
    taxIdNumber: "845678901 RT0001",
    timezone: "America/Toronto",
    utcOffset: -4,
    languages: ["en"],
    streets: [
      { name: "King Street E", fsa: "L8N", min: 100, max: 1400 },
      { name: "Main Street W", fsa: "L8S", min: 100, max: 1500 },
      { name: "Barton Street E", fsa: "L8L", min: 200, max: 1800 },
      { name: "Locke Street S", fsa: "L8P", min: 20, max: 300 },
      { name: "Upper James Street", fsa: "L9C", min: 300, max: 1500 },
      { name: "Ottawa Street N", fsa: "L8H", min: 100, max: 500 },
      { name: "Concession Street", fsa: "L9A", min: 300, max: 900 },
      { name: "Aberdeen Avenue", fsa: "L8P", min: 20, max: 400 },
      { name: "Sherman Avenue N", fsa: "L8L", min: 20, max: 400 },
      { name: "Dundurn Street S", fsa: "L8P", min: 20, max: 400 },
      { name: "Wentworth Street N", fsa: "L8L", min: 20, max: 500 },
      { name: "Queenston Road", fsa: "L8K", min: 100, max: 900 },
    ],
    materials: [
      { name: "Pressure-treated 2×6×12", unit: "each", cost: 16.5, category: "lumber" },
      { name: "Deck screws 3\" (5 lb)", unit: "box", cost: 34, category: "fasteners" },
      { name: "Interior door — 30\" prehung", unit: "each", cost: 142, category: "doors" },
      { name: "Silicone caulk — kitchen & bath", unit: "tube", cost: 9.2, category: "sundries" },
      { name: "Drywall ½\" 4×8", unit: "sheet", cost: 18, category: "drywall" },
      { name: "Bathroom faucet — single lever", unit: "each", cost: 118, category: "fixtures" },
    ],
    supplier: { name: "Home Hardware — Ottawa Street", contactName: "Contractor desk", accountRef: "MS-2031" },
    vehicle: { makeModel: "Nissan NV200", year: 2019, plate: "CKLM 335", odometerKm: 97400 },
    subcontractor: { name: "Steel City Electric", trade: "Electrical" },
    equipment: null,
    checklist: ["Punch list reviewed with client on arrival", "Work area protected", "Each item photographed when done", "Debris removed", "Client signed off the list"],
    qty: [6, 1, 8, 1],
  },
};

export const PROFILE_KEYS = Object.keys(PROFILES);

export function profile(key) {
  return PROFILES[key] || null;
}
