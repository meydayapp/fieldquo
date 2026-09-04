// lib/sales/discovery/usBoard/classes.js
//
// What a US state licence classification actually tells you about a trade, and
// the three ways reading one as a trade goes wrong.
//
// ══ The RBQ finding, re-tested against US boards ═══════════════════════════
//
// rbq/licence.js established that a Quebec licence class identifies nothing:
// the median licence carries sixteen to seventeen subcategories and 81.3% of
// all licence-holders are authorised for interior finishing. The brief asked
// whether US classes are narrower. **They are — but only some of them, and the
// difference is measurable rather than a matter of opinion.**
//
// Measured on the real files on 2026-09-03:
//
//   California CSLB  219,255 CLEAR licences, 81.3% holding exactly ONE
//                    classification. C-33 really is "Painting and Decorating
//                    Contractor" and nothing else.
//   Washington L&I   75,917 active licences, ONE specialty each (180 of them,
//                    0.24%, carry a second). The specialties are single trades:
//                    PAINTING/WALLCOVERING, ROOFING, DRY WALL, FENCING.
//   Oregon CCB       45,483 active licences from 56,156 rows, median ONE
//                    endorsement, maximum four.
//
// So a US class is not an authorisation SET the way an RBQ licence is. That is
// the good news, and it is why `categories.primary` is populated here where
// RBQ deliberately leaves it null.
//
// ══ Failure 1: the unrestricted class, which identifies nothing ════════════
//
// **68.2% of Washington's active licences — 51,755 of 75,917 — hold specialty
// `CC|01 GENERAL`.** Oregon's equivalent, `RGC Residential General Contractor`,
// is 30,421 of 45,483 (66.9%). California's is `B General Building`, 96,772 of
// 219,255 (44.1%).
//
// That is not "most Washington contractors are general contractors". A GENERAL
// registration in Washington permits every kind of construction work; a
// SPECIALTY registration permits one. A painter who also hangs drywall takes
// GENERAL, because it is the licence with no restriction on it — so GENERAL is
// where everyone who does not fit one box ends up. It is the residual, and
// reading it as the trade "general contracting" would file 51,755 businesses
// into FieldQuo's widest queue on the strength of a box that means
// "unrestricted".
//
// This is the RBQ finding in a different shape: the class held by most of the
// register identifies nothing, whether it is held ALONGSIDE sixteen others
// (Quebec) or INSTEAD of a narrower one (Washington). So the unrestricted
// classes are declared here, and scripts/check-us-boards.mjs asserts that none
// of them is ever mapped to a trade in trades.js. A future agent looking at
// 51,755 unqueued rows and reaching for the obvious fix trips the check.
//
// ══ Failure 2: the code that means two different things ════════════════════
//
// Washington's specialty codes are namespaced by LICENCE TYPE and the file
// gives no hint of it. Measured across the active file:
//
//   01  = GENERAL under CC (construction), JOURNEY LEVEL under PC (plumbing),
//         GENERAL under EC (electrical)
//   02  = RESIDENTIAL under both PC and EC
//   03  = PUMP & IRRIGATION under both, 04 = SIGN under EC and something else
//         under PC, 3A = Domestic Pump under both
//   SV  = Scaffolding and Safety Railings under CC, SERVICE OR MAINTENANCE
//         under LC (elevators)
//
// Six codes collide. A map keyed on the specialty code alone would file 3,381
// electrical contractors as "general" and 1,445 plumbers as whatever `01` was
// declared to mean. So the class token is `TYPE|CODE`, always, and
// `classToken` is the only thing that builds one.
//
// ══ Failure 3: the class that names two trades ═════════════════════════════
//
// Washington `CC|SK` is "Floor Covering and Counter Tops" — 1,891 licences —
// and `CC|SB` is "Cabinets, Millwork and Finish Carpentry" — 855. FieldQuo
// sells `flooring` and `countertops` as different trades, and `cabinets` and
// `carpentry` as different trades. A class naming two of them decides nothing.
//
// Neither is mapped, and the 2,746 licences behind them bank with no trade.
// That is the same rule `tradeForCategories` already applies to two alternates
// naming two trades, and it is the same reasoning: a prospect filed under the
// wrong trade is worse than one filed under none, because it reaches a queue
// whose whole promise is that every row in it takes the same script.
//
// ══ Why the vocabulary is shipped rather than inferred ═════════════════════
//
// trades.js's header records the failure this defends against: four hand-typed
// Overture category keys did not exist in the taxonomy, matched nothing, and
// looked exactly like categories with no businesses in them. A `us_wa_lni_cc_xb`
// that does not exist would do the same.
//
// So every class below was READ OUT OF THE REAL FILE, not typed from a board's
// documentation page, and scripts/check-us-boards.mjs asserts that every
// namespaced class named in trades.js appears here. The extractor closes the
// other half of the loop: `scripts/us-board-snapshot.mjs` counts class tokens
// in the file that are NOT in this vocabulary and prints them, so a board that
// adds a specialty shows up as a number rather than as silence.

/**
 * The namespace a board's classes carry into `categories`.
 *
 * The BOARD key, not the state: Texas licenses electricians through TDLR and
 * plumbers through a separate board, and two boards in one state sharing a
 * `us_tx_` namespace would collide the day their code vocabularies overlap.
 * rbq/licence.js namespaces for the same reason and its comment says why —
 * trades.js indexes source categories in one global map and asserts there are
 * no duplicates.
 */
export function classNamespace(boardKey) {
  return `${boardKey}_`;
}

/**
 * A board's own spelling of a class, folded into the shape a source category
 * has to have.
 *
 * ══ Why the board's spelling cannot travel verbatim ════════════════════════
 *
 * `scripts/check-sales-discovery.mjs` holds every source category to
 * `/^[a-z][a-z0-9_]{2,63}$/`, and its comment says why: capitalisation, spaces
 * and hyphens are the three ways one gets mistyped, and a mistyped category
 * matches zero rows and looks exactly like a category with no businesses in
 * it. Board codes break all three rules — `C-8`, `CC|01`, `EC|6A`.
 *
 * Loosening that rule to admit them would throw away what it catches for every
 * OTHER source. So the codes are folded instead, and the fold is proved to be
 * lossless in the only way that matters: `scripts/check-us-boards.mjs` asserts
 * it is INJECTIVE over each board's whole published vocabulary, so no two
 * classes can ever collapse into one category. Verified over all 206 classes
 * across the three boards — zero collisions.
 */
export function slugClass(token) {
  return String(token ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** A board class, namespaced, as it appears in `categories` and in trades.js. */
export function namespacedClass(boardKey, token) {
  return `${classNamespace(boardKey)}${slugClass(token)}`;
}

/**
 * The board's own class token behind a namespaced source category, or null.
 *
 * The reverse of `namespacedClass`, done by scanning the vocabulary rather
 * than by un-folding the slug — the fold drops information (`C-8` and `C10`
 * both lose their punctuation) and an inverse computed from the string alone
 * would be a guess. The scan is over at most 98 entries and runs in a check,
 * not in a request.
 */
export function classForNamespaced(boardKey, category) {
  const vocab = boardVocabulary(boardKey);
  if (!vocab) return null;
  for (const token of Object.keys(vocab)) {
    if (namespacedClass(boardKey, token) === category) return token;
  }
  return null;
}

/**
 * Washington L&I's specialty vocabulary, keyed `TYPE|CODE`.
 *
 * All 90 tokens present on an active licence, read out of the published file
 * on 2026-09-03 (160,923 rows, 75,917 of them ACTIVE) — 88 from
 * `SpecialtyCode1` and two more that appear only in `SpecialtyCode2`.
 * Labels are the board's own, verbatim — including the double space in
 * "Sanitation System  / Side sewers" and the three blank labels, `EC|09`,
 * `EC|90` and `EC|91`, which the board ships empty.
 */
export const WA_LNI_CLASSES = Object.freeze({
  "CC|01": "GENERAL",
  "CC|AB": "COMMERCIAL/INDUSTRIAL/REFRIG",
  "CC|AC": "BOILER/STEAM FIT/PROC PIPING",
  "CC|BG": "APPLIANCES/EQUIPMENT",
  "CC|BI": "CONCRETE",
  "CC|BK": "DRY WALL",
  "CC|BL": "ELEVATOR",
  "CC|BN": "FENCING",
  "CC|BO": "FIRE PROTECT SYSTEM",
  "CC|BP": "GLAZING/GLASS",
  "CC|BR": "HOUSE MOVING",
  "CC|BT": "INST EQUIP/STAT FURN/LAB T/LO",
  "CC|BV": "IRRIGATION/SPRINKLING SYSTEMS",
  "CC|BW": "LANDSCAPING",
  "CC|BZ": "MASONRY",
  "CC|CB": "PAINTING/WALLCOVERING",
  "CC|CD": "ROOFING",
  "CC|CF": "SERVICE STATION EQUIPMENT  AND MAINTENANCE",
  "CC|CG": "METAL FABRICATION",
  "CC|CP": "WATER CONDITIONING EQUIPMENT",
  "CC|CV": "GUTTERS/DOWNSPOUTS",
  "CC|HM": "HANDYMAN",
  "CC|OG": "OVERHEAD/GARAGE DOORS",
  "CC|PW": "PRESSURE WASHING",
  "CC|RA": "Suspended Ceiling  and Acoustical Tile",
  "CC|RB": "Swimming Pools, Spas and Hot Tubs",
  "CC|RC": "Tanks and Tank Removal",
  "CC|RE": "Tile, Ceramic, Mosaic, Natural and MFG Stone",
  "CC|RF": "Tree Removal Service",
  "CC|RG": "Utilities and Telecommunications",
  "CC|RH": "Window Coverings",
  "CC|RI": "Welding and Ornamental Metal",
  "CC|RJ": "Wood/Pellet and Gas Stoves",
  "CC|RK": "Drain Cleaning / Snaking",
  "CC|SA": "Awnings, Canopies, Patio Covers, Exterior Screens",
  "CC|SB": "Cabinets, Millwork and Finish Carpentry",
  "CC|SC": "Central Vacuum Systems",
  "CC|SD": "Closets",
  "CC|SE": "Construction Clean-up",
  "CC|SF": "Demolition and Salvage",
  "CC|SG": "Doors, Gates and Activating Devices",
  "CC|SH": "Drilling, Blasting and Soil Sampling",
  "CC|SI": "Excavation, Grading and Land Clearing",
  "CC|SJ": "Fireproofing and Coating",
  "CC|SK": "Floor Covering and Counter Tops",
  "CC|SL": "Framing and Rough Carpentry",
  "CC|SM": "Heating/Vent/Air-Conditioning and Refrig (HVAC/R)",
  "CC|SN": "Industrial Equipment/Machines",
  "CC|SO": "Insulation and Acoustical",
  "CC|SP": "Lathing and Plastering",
  "CC|SQ": "Locks, Security and Alarm Equipment",
  "CC|SR": "Manufactured/Mobile Home Set-up",
  "CC|SS": "Paving/ Striping/ Seal Coating",
  "CC|ST": "Sandblasting",
  "CC|SU": "Sanitation System  / Side sewers",
  "CC|SV": "Scaffolding and Safety Railings",
  "CC|SW": "Siding",
  "CC|SX": "Signs",
  "CC|SY": "Steel Erectors",
  "CC|SZ": "Structural Pest Control",
  "CC|WD": "WELL DRILLING",
  "CC|XX": "Asbestos and Lead",
  "EC|01": "GENERAL",
  "EC|02": "RESIDENTIAL",
  "EC|03": "PUMP & IRRIGATION",
  "EC|04": "SIGN",
  "EC|06": "LIMITED ENERGY",
  "EC|07": "MAINTENANCE",
  "EC|09": "",
  "EC|10": "DOORS & GATES SPECIALTY",
  "EC|3A": "Domestic Pump",
  "EC|6A": "HVAC/RFRG",
  "EC|6B": "HVAC/RFRG-RESTRICTED",
  "EC|7A": "LIGHTING MAINTENANCE",
  "EC|7B": "RESIDENTIAL MAINTENANCE",
  "EC|7C": "RTD NON-RES MAINTENANCE",
  "EC|7D": "APPLIANCE REPAIR",
  "EC|7E": "EQUIPMENT REPAIR",
  // ── Found by the extractor, not by the survey that built this list ──────
  //
  // 90 and 91 appear ONLY in `SpecialtyCode2` — 59 and 26 active licences —
  // and the first pass over this file read `SpecialtyCode1` alone, so both
  // were missing here and the snapshot script reported them as codes it had
  // never seen. That report is the reason they are in the list, and it is
  // worth recording: a vocabulary read from one column is a vocabulary with a
  // hole in it, and the hole was invisible until something counted.
  //
  // L&I publishes both with an EMPTY description, like EC|09. Left empty
  // rather than named from a guess.
  "EC|90": "",
  "EC|91": "",
  "LC|00": "UNUSED",
  "LC|AL": "ALL AREAS",
  "LC|IA": "INSTALLATION/ALTERATION",
  "LC|SV": "SERVICE OR MAINTENANCE",
  "PC|01": "JOURNEY LEVEL",
  "PC|02": "RESIDENTIAL",
  "PC|03": "PUMP & IRRIGATION",
  "PC|04": "Residential Service",
  "PC|30": "BACKFLOW SPECIALTY",
  "PC|3A": "Domestic Pump",
});

/**
 * California CSLB's classification vocabulary, keyed on the code AS THE FILE
 * SPELLS IT.
 *
 * All 98 codes present on a CLEAR licence in the published master file, read
 * out of it on 2026-09-03 (242,879 rows, 219,255 of them CLEAR). The labels
 * are CSLB's own, fetched from its two published codebooks on the same day:
 * the classification list at /About_Us/Library/Licensing_Classifications/ and
 * the C-61 Limited Specialty sub-list beneath it.
 *
 * ══ The spelling is inconsistent and it is the file's spelling that wins ════
 *
 * CSLB writes single-digit C classes hyphenated and two-digit ones not —
 * "C-8" but "C10" — and zero-pads the D sub-codes to two digits: the codebook
 * says "D-3 Awnings" and the file says "D03". Both spellings are correct in
 * their own document, and a map keyed on the codebook's would match nothing
 * for six classes. That is trades.js's documented failure — a category that
 * does not exist matches zero rows and looks exactly like a category with no
 * businesses in it — so the keys here were generated FROM the file and the
 * labels joined onto them, rather than typed from either page.
 */
export const CA_CSLB_CLASSES = Object.freeze({
  "A": "General Engineering Contractor",
  "ASB": "Asbestos Certification",
  "B": "General Building Contractor",
  "B-2": "Residential Remodeling Contractor",
  "C-2": "Insulation and Acoustical Contractor",
  "C-4": "Boiler, Hot Water Heating and Steam Fitting Contractor",
  "C-5": "Framing and Rough Carpentry Contractor",
  "C-6": "Cabinet, Millwork and Finish Carpentry Contractor",
  "C-7": "Low Voltage Systems Contractor",
  "C-8": "Concrete Contractor",
  "C-9": "Drywall Contractor",
  "C10": "Electrical Contractor",
  "C11": "Elevator Contractor",
  "C12": "Earthwork and Paving Contractors",
  "C13": "Fencing Contractor",
  "C15": "Flooring and Floor Covering Contractors",
  "C16": "Fire Protection Contractor",
  "C17": "Glazing Contractor",
  "C20": "Warm-Air Heating, Ventilating and Air-Conditioning Contractor",
  "C21": "Building Moving/Demolition Contractor",
  "C22": "Asbestos Abatement Contractor",
  "C23": "Ornamental Metal Contractor",
  "C27": "Landscaping Contractor",
  "C28": "Lock and Security Equipment Contractor",
  "C29": "Masonry Contractor",
  "C31": "Construction Zone Traffic Control Contractor",
  "C32": "Parking and Highway Improvement Contractor",
  "C33": "Painting and Decorating Contractor",
  "C34": "Pipeline Contractor",
  "C35": "Lathing and Plastering Contractor",
  "C36": "Plumbing Contractor",
  "C38": "Refrigeration Contractor",
  "C39": "Roofing Contractor",
  "C42": "Sanitation System Contractor",
  "C43": "Sheet Metal Contractor",
  "C45": "Sign Contractor",
  "C46": "Solar Contractor",
  "C47": "General Manufactured Housing Contractor",
  "C49": "Tree and Palm Contractor",
  "C50": "Reinforcing Steel Contractor",
  "C51": "Structural Steel Contractor",
  "C53": "Swimming Pool Contractor",
  "C54": "Ceramic and Mosaic Tile Contractor",
  "C55": "Water Conditioning Contractor",
  "C57": "Well Drilling Contractor",
  "C60": "Welding Contractor",
  "D03": "Awnings",
  "D04": "Central Vacuum Systems",
  "D06": "Concrete Related Services",
  "D07": "Conveyors-Cranes",
  "D08": "Doors and Door Services",
  "D09": "Drilling, Blasting and Oil Field Work",
  "D10": "Elevated Floors",
  "D12": "Synthetic Products",
  "D13": "Fire Extinguisher Systems",
  "D15": "Furnaces",
  "D16": "Hardware, Locks and Safes",
  "D17": "Industrial Insulation",
  "D19": "Land Clearing",
  "D20": "Lead Burning and Fabrication",
  "D21": "Machinery and Pumps",
  "D22": "Marble",
  "D23": "Medical Gas Systems",
  "D24": "Metal Products",
  "D25": "Mirrors and Fixed Glass",
  "D27": "Movable Partitions",
  "D28": "Doors, Gates and Activating Devices",
  "D29": "Paperhanging",
  "D30": "Pile Driving and Pressure Foundation Jacking",
  "D31": "Pole Installation and Maintenance",
  "D32": "Power Nailing and Fastening",
  "D34": "Prefabricated Equipment",
  "D35": "Pool and Spa Maintenance",
  "D36": "Rigging and Rig Building",
  "D37": "Safes and Vaults",
  "D38": "Sand and Water Blasting",
  "D39": "Scaffolding",
  "D40": "Service Station Equipment and Maintenance",
  "D41": "Siding and Decking",
  "D42": "Non-Electrical Sign Installation",
  "D43": "Soil Grouting",
  "D44": "Sprinklers",
  "D47": "Tennis Court Surfacing",
  "D48": "Theater and School Equipment",
  "D49": "Tree Service",
  "D50": "Suspended Ceilings",
  "D51": "Waterproofing and Weatherproofing (under relevant class)",
  "D52": "Window Coverings",
  "D53": "Wood Tanks",
  "D54": "Rockscaping",
  "D55": "Blasting",
  "D56": "Trenching Only",
  "D59": "Hydroseed Spraying",
  "D62": "Air and Water Balancing",
  "D63": "Construction Clean-up",
  "D64": "Non-specialized",
  "D65": "Weatherization and Energy Conservation",
  "HAZ": "Hazardous Substance Removal Certification",
});

/**
 * Oregon CCB's endorsement vocabulary, keyed on `license_type`.
 *
 * All 18 endorsements present in the published "CCB Active Licenses" dataset,
 * read out of the real file on 2026-09-03 (56,156 rows for 45,483 licences).
 * Labels are the board's own `endorsement_text`, verbatim.
 *
 * Note what Oregon does NOT publish: which specialty a Residential Specialty
 * Contractor practises. `RSC` is 7,501 licences and says only that the holder
 * is a specialist. That is a genuine hole in the source, not a gap in this map.
 */
export const OR_CCB_CLASSES = Object.freeze({
  RGC: "Residential General Contractor",
  RSC: "Residential Specialty Contractor",
  CGC2: "Commercial General Contractor Level 2",
  LBPR: "Lead Based Paint Renovation Contractor",
  CSC2: "Commercial Specialty Contractor Level 2",
  CGC1: "Commercial General Contractor Level 1",
  CSC1: "Commercial Specialty Contractor Level 1",
  RLC: "Residential Limited Contractor",
  OCHI: "Oregon Certified Home Inspector",
  OCLS: "Oregon Certified Locksmith",
  RHISC: "Home Inspector Services Contractor",
  RD: "Residential Developer",
  RLSC: "Residential Locksmith Services Contractor",
  CD: "Commercial Developer",
  RHSC: "Home Services Contractor",
  CF: "Construction Flagging Contractor",
  RHEPSC: "Home Energy Performance Score Contractor",
  RRC: "Residential Restoration Contractor",
});

/**
 * The classes that mean "no restriction", per board.
 *
 * Held by two thirds of each register — see this file's header. They are NOT
 * evidence of general contracting and must never be mapped to a trade;
 * scripts/check-us-boards.mjs asserts trades.js maps none of them.
 *
 * The commercial general and developer endorsements are here for a second
 * reason as well as the first: FieldQuo sells to residential field-service
 * businesses, and a commercial general contractor is the wrong company for
 * every script in the playbook.
 */
export const UNRESTRICTED_CLASSES = Object.freeze({
  // B is General Building — 96,772 of California's 219,255 CLEAR licences, the
  // same residual role Washington's CC|01 plays. A is General Engineering and
  // B-2 is Residential Remodeling: both permit a range of work rather than
  // naming one, and B-2 in particular reads like a trade and is not one.
  us_ca_cslb: Object.freeze(["A", "B", "B-2"]),
  us_wa_lni: Object.freeze(["CC|01"]),
  us_or_ccb: Object.freeze(["RGC", "RSC", "CGC1", "CGC2", "CSC1", "CSC2", "RLC", "RD", "CD"]),
});

/**
 * Classes that name more than one FieldQuo trade, with the reason.
 *
 * Declared rather than merely left out of trades.js, because "not mapped" and
 * "deliberately not mapped, here is why" are different statements and only the
 * second survives the next agent who notices 1,891 unqueued flooring-ish rows.
 * The check asserts none of these is mapped either.
 */
export const AMBIGUOUS_CLASSES = Object.freeze({
  us_ca_cslb: Object.freeze({
    "C-6": "Cabinet, Millwork and Finish Carpentry names cabinets AND carpentry, which FieldQuo sells separately.",
    C12: "Earthwork and Paving names excavation AND paving, which FieldQuo sells separately.",
    C21: "Building Moving/Demolition names demolition and house moving, and a demolition script is wrong for half of them.",
    C28: "Lock and Security Equipment names locksmithing and alarm installation, which are different sales conversations.",
    D41: "Siding and Decking names siding AND decking; FieldQuo sells siding and does not sell decking.",
    C38: "Refrigeration is commercial refrigeration, not the residential heating and cooling FieldQuo's HVAC trade means.",
  }),
  us_wa_lni: Object.freeze({
    "CC|SK": "Floor Covering and Counter Tops names flooring AND countertops, which FieldQuo sells separately.",
    "CC|SB": "Cabinets, Millwork and Finish Carpentry names cabinets AND carpentry, which FieldQuo sells separately.",
  }),
  us_or_ccb: Object.freeze({}),
});

/** Every class token a board publishes, for the extractor's unknown-code report. */
export function boardVocabulary(boardKey) {
  if (boardKey === "us_ca_cslb") return CA_CSLB_CLASSES;
  if (boardKey === "us_wa_lni") return WA_LNI_CLASSES;
  if (boardKey === "us_or_ccb") return OR_CCB_CLASSES;
  return null;
}

/** Is this token one the board is known to publish? */
export function isKnownClass(boardKey, token) {
  const vocab = boardVocabulary(boardKey);
  return Boolean(vocab && Object.prototype.hasOwnProperty.call(vocab, token));
}

/** The board's own words for a class, or null when this build has never seen it. */
export function classLabel(boardKey, token) {
  const vocab = boardVocabulary(boardKey);
  if (!vocab || !Object.prototype.hasOwnProperty.call(vocab, token)) return null;
  return vocab[token];
}

/**
 * Is this class one FieldQuo refuses to read as a trade, and why?
 *
 * Returns the reason, or null when the class carries no such refusal. Callers
 * do not need this to be CORRECT for safety — an unmapped class produces a
 * null trade either way — they need it to be SAYABLE, so the campaign screen
 * and the doc can explain 51,755 rows sitting in the bank.
 */
export function refusalReason(boardKey, token) {
  if ((UNRESTRICTED_CLASSES[boardKey] || []).includes(token)) {
    return "This is the board's unrestricted class, held by two thirds of the register. It says the holder may do any work, not what they do.";
  }
  const ambiguous = AMBIGUOUS_CLASSES[boardKey] || {};
  if (Object.prototype.hasOwnProperty.call(ambiguous, token)) return ambiguous[token];
  return null;
}
