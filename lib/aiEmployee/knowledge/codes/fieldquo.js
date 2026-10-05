// lib/aiEmployee/knowledge/codes/fieldquo.js
//
// FieldQuo's own error-code table — the third tier of what an AI employee
// may say about a code on a display, after the company's own manuals
// (lib/aiEmployee/errorCodes.js puts a company's extracted rows first).
//
// ══ Where every row comes from ═════════════════════════════════════════════
//
// Seeded 2026-10-04 from the research sample (scratchpad error-codes-sample
// .json, plan Part B.2b): 34 of its 35 entries, 11 brands. Codes and their
// meanings are FACTS taken from the cited manufacturer document; every
// sentence is FieldQuo's own paraphrase, never the manufacturer's wording.
// `source.page` is the printed page of the PDF, or "web" for an official
// support page read on that date. A row without a source fails
// scripts/check-error-codes.mjs.
//
// Left out on purpose:
//   - the InSinkErator "won't run / hums" entry: it is a SYMPTOM with no code,
//     and this table is looked up by code. Its jam-clearing step was also
//     flagged unverified against the maker's own manual.
//   - every manufacturer technician procedure in the same documents (meter
//     readings, board switches, gas-pressure tests, opening sealed panels).
//     A homeowner step never goes behind a panel.
//
// Wording that touches gas or a smell of fuel defers to the emergency rule
// already in every prompt (lib/ai/crisisRule.js) rather than restating a
// different one: changing what that rule says is an owner decision that has
// not been made (plan §A5), and a second emergency script here would be a
// copy that disagrees with it.
//
// Not yet reviewed by a trade technician and English only — the plan's
// review and 8-language translation pass is still owed. The tool says
// "FieldQuo reference" beside every answer from here, so a homeowner is never
// told it is the company's own manual.
//
// `codes` are the spellings a homeowner may type; errorCodes.js codeKey()
// normalises both sides (case, spaces, dashes, "error"/"code"/"flashes").

export const FIELDQUO_CODES_VERSION = "2026-10-04";

const SAMSUNG_WASHER = Object.freeze({
  title: "Samsung US — Washing machine information and error codes (TSG10000997)",
  url: "https://www.samsung.com/us/support/troubleshoot/TSG10000997/",
  page: "web",
});
const LG_WASHER = Object.freeze({
  title: "LG US — Front Load Washer Error Code List",
  url: "https://www.lg.com/us/support/help-library/lg-front-load-washer-error-code-list--20155069413456",
  page: "web",
});
const BOSCH_DW = Object.freeze({
  title: "Bosch Home US — Dishwasher error codes",
  url: "https://www.bosch-home.com/us/owner-support/error-codes/dishwashers",
  page: "web",
});
const CARRIER_TG = "Carrier — Troubleshooting Guide, mid-efficiency variable-speed two-stage furnace (TG-GFC80-02, 2018)";
const CARRIER_URL = "https://www.shareddocs.com/hvac/docs/1009/Public/04/TG-GFC80-02.pdf";
const GOODMAN = "Goodman/Daikin — Service and Troubleshooting, GM9S92/GM9S96 single-stage gas furnaces (RS6612022r1, 2023)";
const GOODMAN_URL = "https://mobile.goodmanmfg.com/mobileapp/stellent/pdf/infoPdf/Lit/RS6612022R1.pdf";
const RHEEM = "Rheem — Power vent gas water heater Use & Care / Installation manual (AP16882-2, 03/17)";
const RHEEM_URL = "https://images.homedepot-static.com/catalog/pdfImages/88/88348968-f7f8-4d4a-ba03-5b7caad24d01.pdf";
const BW = "Bradford White — Powered Direct Vent Gas Water Heater Installation & Operating Instructions (238-51370-00G, rev 2/21)";
const BW_URL = "https://webassets.hajoca.com/ownerguides/671632/67163280938.pdf";
const RINNAI = "Rinnai — Troubleshooting Tankless Water Heater Diagnostic Codes (100000652, 4/2019)";
const RINNAI_URL = "https://media.rinnai.us/salsify_asset/s-3e3cd69f-0edc-4b85-8d6d-93b39057fab5/100000652-Troubleshooting%20TWH%20Diagnostic%20Codes.pdf";

const GAS_SMELL = "Any smell of gas — that is an emergency: follow the emergency rule";

const row = (r) => Object.freeze({ ...r, codes: Object.freeze(r.codes), brands: Object.freeze(r.brands), safeSteps: Object.freeze(r.safeSteps), stopSigns: Object.freeze(r.stopSigns), source: Object.freeze(r.source) });

export const FIELDQUO_CODES = Object.freeze([
  // ── Samsung washers ──────────────────────────────────────────────────────
  row({
    id: "samsung.washer.unbalanced", trade: "appliances", category: "washer", brands: ["Samsung"],
    modelFamily: "Samsung washers (front and top load, digital display)",
    code: "UE / Ub / U6 / Ur / dc", codes: ["UE", "Ub", "U6", "Ur", "dc", "dC"],
    meaning: "The load is off-balance in the drum, so the washer can't spin properly.",
    safeSteps: [
      "Once the drum has stopped, open the door and spread the laundry out evenly — untangle sheets and heavy items.",
      "For a single bulky item like a comforter or bath mat, add a couple of similar items or use the bedding/bulky cycle.",
      "Close the door and start the cycle again.",
    ],
    stopSigns: ["The code comes back with a normal, evenly spread load", "The washer walks, bangs or shakes hard even when empty"],
    urgency: "routine", source: SAMSUNG_WASHER,
  }),
  row({
    id: "samsung.washer.fill", trade: "appliances", category: "washer", brands: ["Samsung"], modelFamily: "Samsung washers",
    code: "4C / 4E / nF (4C2 / 4E2: hot and cold swapped)", codes: ["4C", "4E", "nF", "4C2", "4E2"],
    meaning: "Water isn't coming in properly — the supply is off, a hose is kinked or an inlet is clogged. 4C2 or 4E2 means the hot and cold hoses are on the wrong inlets.",
    safeSteps: [
      "Check that both water taps behind the washer are fully open.",
      "Make sure the fill hoses aren't kinked or squashed.",
      "For 4C2 or 4E2, check the hot hose goes to the hot inlet and the cold hose to the cold one.",
      "Turn the washer off and on again and restart the cycle.",
    ],
    stopSigns: ["The taps are open and the hoses are fine but the code keeps coming back", "A hose is leaking or bulging"],
    urgency: "routine", source: SAMSUNG_WASHER,
  }),
  row({
    id: "samsung.washer.drain", trade: "appliances", category: "washer", brands: ["Samsung"], modelFamily: "Samsung washers",
    code: "5C / 5E / nd / SE / SC", codes: ["5C", "5E", "nd", "SE", "SC"],
    meaning: "The washer can't drain, or drains too slowly.",
    safeSteps: [
      "Check the drain hose isn't kinked and isn't pushed too far down into the standpipe.",
      "If the model has a drain-pump filter at the front, it can be cleaned as the owner's manual shows — have towels and a shallow tray ready, because water will come out.",
    ],
    stopSigns: ["Water is leaking onto the floor", "The filter is clean and the code still shows"],
    urgency: "routine", source: SAMSUNG_WASHER,
  }),
  row({
    id: "samsung.washer.leak", trade: "appliances", category: "washer", brands: ["Samsung"], modelFamily: "Samsung washers",
    code: "LE / 1E / LC / 1C", codes: ["LE", "1E", "LC", "1C"],
    meaning: "A water-level or leak problem: moisture where it shouldn't be, or a sensor fault.",
    safeSteps: [
      "Look under and around the washer for water.",
      "Check the fill and drain hoses for leaks or kinks.",
      "If there's a lot of foam, run an empty rinse — too much detergent can cause this.",
    ],
    stopSigns: [
      "Water is on the floor — close the two water taps behind the washer and don't run it again",
      "Water is near an outlet or the power cord — don't touch it; only switch that circuit off at the panel if you can reach it standing somewhere dry",
    ],
    urgency: "urgent", source: SAMSUNG_WASHER,
  }),
  row({
    id: "samsung.washer.overflow", trade: "appliances", category: "washer", brands: ["Samsung"], modelFamily: "Samsung washers",
    code: "OE / OC / 0E / 0C", codes: ["OE", "OC", "0E", "0C"],
    meaning: "Overflow — there is too much water in the washer.",
    safeSteps: ["Turn the washer off.", "If water is still coming in, close the water taps behind the washer."],
    stopSigns: ["Any overflow code — this needs the team or Samsung service", "Water on the floor near anything electrical"],
    urgency: "urgent", source: SAMSUNG_WASHER,
  }),
  row({
    id: "samsung.washer.door_suds", trade: "appliances", category: "washer", brands: ["Samsung"], modelFamily: "Samsung washers",
    code: "dE / dC / dS / FL / LO (door); Sd / SUd (suds)", codes: ["dE", "dC", "dS", "FL", "LO", "Sd", "SUd"],
    meaning: "The door isn't detected as closed and locked; or there are too many suds from too much, or the wrong, detergent.",
    safeSteps: [
      "Door: check nothing is caught in the door, close it firmly and restart.",
      "Suds: use HE detergent in the right amount, and run empty rinse cycles until the suds clear.",
    ],
    stopSigns: ["The door latch looks broken", "The door code comes back with the door clearly shut"],
    urgency: "routine", source: SAMSUNG_WASHER,
  }),
  row({
    id: "samsung.washer.voltage", trade: "appliances", category: "washer", brands: ["Samsung"], modelFamily: "Samsung washers",
    code: "9C1 / 9C2 / PF / 9E1 / 9E2 / UC", codes: ["9C1", "9C2", "PF", "9E1", "9E2", "UC"],
    meaning: "The washer is seeing an irregular electrical supply.",
    safeSteps: ["Make sure the washer is plugged straight into the wall, not into an extension cord or power bar."],
    stopSigns: ["It's already plugged straight in and the code repeats", "Lights flicker or the outlet feels warm — treat it as an electrical problem"],
    urgency: "routine", source: SAMSUNG_WASHER,
  }),

  // ── LG front-load washers ────────────────────────────────────────────────
  row({
    id: "lg.washer.unbalanced", trade: "appliances", category: "washer", brands: ["LG"], modelFamily: "LG front-load washers",
    code: "UE", codes: ["UE"],
    meaning: "The load is off-balance and the washer couldn't even it out to spin.",
    safeSteps: ["Spread the laundry evenly; for a very small load, add one or two similar items.", "Check the washer sits level and doesn't rock.", "Start it again."],
    stopSigns: ["It keeps happening with a normal, balanced load"],
    urgency: "routine", source: LG_WASHER,
  }),
  row({
    id: "lg.washer.fill", trade: "appliances", category: "washer", brands: ["LG"], modelFamily: "LG front-load washers",
    code: "IE (E02 / E10)", codes: ["IE", "E02", "E10"],
    meaning: "Water isn't coming in.",
    safeSteps: ["Open both water taps fully and straighten any kinked hose.", "In winter a frozen hose or tap can cause this — let the area warm up."],
    stopSigns: ["It still shows with the water on and the hoses clear", "A hose is leaking"],
    urgency: "routine", source: LG_WASHER,
  }),
  row({
    id: "lg.washer.drain", trade: "appliances", category: "washer", brands: ["LG"], modelFamily: "LG front-load washers",
    code: "OE (E03 / E21)", codes: ["OE", "E03", "E21"],
    meaning: "The washer can't drain.",
    safeSteps: ["Check the drain hose for kinks.", "Clean the drain-pump filter as the manual shows — expect water, so have towels and a shallow tray ready."],
    stopSigns: ["Water is leaking onto the floor", "The filter is clean and OE still shows"],
    urgency: "routine", source: LG_WASHER,
  }),
  row({
    id: "lg.washer.leak_overfill", trade: "appliances", category: "washer", brands: ["LG"], modelFamily: "LG front-load washers",
    code: "AE / FE (E04 / E12)", codes: ["AE", "FE", "E04", "E12"],
    meaning: "AE: a water leak has been detected. FE: the washer is overfilling.",
    safeSteps: ["Turn the washer off and close the water taps behind it.", "Check the inlet hoses for leaks."],
    stopSigns: ["Any water on the floor", "The code comes back after a restart"],
    urgency: "urgent", source: LG_WASHER,
  }),
  row({
    id: "lg.washer.door_heat_sensor_frozen", trade: "appliances", category: "washer", brands: ["LG"], modelFamily: "LG front-load washers",
    code: "dE / dE1 / dE2 / tE / HE / PE / FF", codes: ["dE", "dE1", "dE2", "tE", "HE", "PE", "FF"],
    meaning: "dE: the door won't lock; dE2: it's closed but not locked. tE or HE: a heating problem. PE: a water-level sensor problem. FF: the tub or drain hose has frozen.",
    safeSteps: [
      "Door codes: open and close the door firmly, then start again.",
      "tE, HE or PE: unplug the washer for about 10 seconds and start it again, once.",
      "FF: warm the room up; LG's own fix is warm water to thaw the tub and drain hose.",
    ],
    stopSigns: ["Any of these comes back after one restart", "The door latch is visibly damaged"],
    urgency: "routine", source: LG_WASHER,
  }),

  // ── Whirlpool top-load washers ───────────────────────────────────────────
  row({
    id: "whirlpool.washer.f5e2", trade: "appliances", category: "washer", brands: ["Whirlpool"], modelFamily: "Whirlpool top-load washers",
    code: "F5E2", codes: ["F5E2", "F5 E2"],
    meaning: "The lid lock can't engage — usually something is in the way.",
    safeSteps: ["Check around the lid lock and take out any clothing or objects.", "Unplug the washer for 5 minutes, plug it back in and start again."],
    stopSigns: ["The code comes back with the lid area clear"],
    urgency: "routine",
    source: { title: "Whirlpool Product Help — F5E2 Error Code (Top Load Washer)", url: "https://producthelp.whirlpool.com/Laundry/Washers/Top_Load_Washer/Error_Codes_or_Flashing_Lights/%22F%22_Codes/F5E2_-_Error_Code", page: "web" },
  }),
  row({
    id: "whirlpool.washer.f8e1", trade: "appliances", category: "washer", brands: ["Whirlpool"], modelFamily: "Whirlpool top-load washers",
    code: "F8E1", codes: ["F8E1", "F8 E1"],
    meaning: "The washer isn't sensing enough water coming in.",
    safeSteps: [
      "Open both the hot and cold taps fully — both hoses need to be connected.",
      "Check the hoses aren't kinked and are on the right inlets (hot to hot, cold to cold).",
      "Make sure the drain hose isn't pushed more than about 4.5 inches into the standpipe, and isn't taped in.",
    ],
    stopSigns: ["The inlet screens need cleaning — that means the water off and the hoses removed, so offer a visit from the team", "Still F8E1 after these checks"],
    urgency: "routine",
    source: { title: "Whirlpool Product Help — F8E1 Error Code (Top Load Washer)", url: "https://producthelp.whirlpool.com/Laundry/Washers/Top_Load_Washer/Error_Codes_or_Flashing_Lights/%22F%22_Codes/F8E1_-_Error_Code", page: "web" },
  }),
  row({
    id: "whirlpool.washer.f9e1", trade: "appliances", category: "washer", brands: ["Whirlpool"], modelFamily: "Whirlpool top-load washers",
    code: "F9E1", codes: ["F9E1", "F9 E1"],
    meaning: "Long drain — draining took too long.",
    safeSteps: [
      "Make sure the drain hose isn't too far into the standpipe (that can siphon) and isn't taped.",
      "Straighten any kink, and check the standpipe or laundry sink isn't blocked.",
    ],
    stopSigns: ["The standpipe or sink is backing up — that's a plumbing drain problem", "Still F9E1 after these checks"],
    urgency: "routine",
    source: { title: "Whirlpool Product Help — F9E1 Error Code (Top Load Washer)", url: "https://producthelp.whirlpool.com/Laundry/Washers/Top_Load_Washer/Error_Codes_or_Flashing_Lights/%22F%22_Codes/F9E1_-_Error_Code", page: "web" },
  }),

  // ── Bosch dishwashers ────────────────────────────────────────────────────
  row({
    id: "bosch.dishwasher.e15", trade: "appliances", category: "dishwasher", brands: ["Bosch"], modelFamily: "Bosch dishwashers (100/300/500/800 series, US)",
    code: "E15 (or every active light flashing)", codes: ["E15", "E:15"],
    meaning: "The leak protection has tripped: water has been detected in the base of the dishwasher.",
    safeSteps: ["Turn off the water to the dishwasher (the valve under the kitchen sink).", "Don't run the dishwasher again."],
    stopSigns: ["Always — Bosch's own instruction is to turn the water off and get it looked at, so book the team"],
    urgency: "urgent", source: BOSCH_DW,
  }),
  row({
    id: "bosch.dishwasher.drain", trade: "appliances", category: "dishwasher", brands: ["Bosch"], modelFamily: "Bosch dishwashers (US)",
    code: "E24 / E25 (also E22, E6102 / E6103)", codes: ["E24", "E25", "E22", "E6102", "E6103"],
    meaning: "A drain problem: a blocked filter or drain pump, a kinked drain hose or a clogged air gap.",
    safeSteps: ["Clean the filter in the bottom of the tub.", "Check the drain hose under the sink isn't kinked.", "If there's an air gap on the sink, clear any debris from it."],
    stopSigns: ["The drain-pump cover would have to come off and they aren't comfortable doing it", "The code stays after cleaning"],
    urgency: "routine", source: BOSCH_DW,
  }),
  row({
    id: "bosch.dishwasher.heat_voltage", trade: "appliances", category: "dishwasher", brands: ["Bosch"], modelFamily: "Bosch dishwashers (US)",
    code: "E01 / E09 / E20 (heating); E27 (low supply voltage)", codes: ["E01", "E09", "E20", "E27"],
    meaning: "A heating fault; E27 means the house power reaching the dishwasher is low.",
    safeSteps: ["Switch the dishwasher's breaker off for about 30 seconds, back on, and try once more."],
    stopSigns: ["The code stays after one reset", "E27 that doesn't clear — an electrician needs to check the supply"],
    urgency: "routine", source: BOSCH_DW,
  }),

  // ── Google Nest thermostats ──────────────────────────────────────────────
  row({
    id: "nest.thermostat.no_power", trade: "hvac", category: "thermostat", brands: ["Google Nest", "Nest"], modelFamily: "Nest Learning / Nest Thermostat",
    code: "E73 / E3 / E23 (no power to Rc); E74 / E4 / E24 (no power to Rh)", codes: ["E73", "E3", "E23", "E74", "E4", "E24"],
    meaning: "The thermostat isn't getting 24V power from the heating or cooling equipment.",
    safeSteps: [
      "Check the breaker for the furnace or air handler, and the light-switch-style service switch near the furnace, are both on.",
      "Make sure the furnace door or panel is fully closed — a door switch cuts the power.",
      "In cooling season, look at the drain pan under the indoor unit — a full pan can trip a float switch that cuts the power.",
    ],
    stopSigns: ["The power and the door are fine and the code stays", "The drain pan is full of water", "Anything about checking or replacing the HVAC fuse — that's for a technician"],
    urgency: "routine", urgencyNote: "Urgent when it means no heat in freezing weather, or no cooling with a vulnerable person at home in extreme heat.",
    source: { title: "Google Nest Help — No power to Rh/Rc (E73/E74 etc.)", url: "https://support.google.com/googlenest/answer/9240096", page: "web" },
  }),

  // ── Carrier / ICP gas furnaces ───────────────────────────────────────────
  row({
    id: "carrier.furnace.limit", trade: "hvac", category: "furnace", brands: ["Carrier"], modelFamily: "Carrier/ICP mid-efficiency variable-speed two-stage gas furnace (TG-GFC80-02)",
    code: "13 (limit circuit lockout) / 33 (limit circuit fault)", codes: ["13", "33"],
    meaning: "A safety limit opened — the furnace overheated, or a draft, rollout or blocked-vent switch tripped. 13 is the lockout once it stayed open; the control tries again after 3 hours. A rollout switch has to be reset by a technician.",
    safeSteps: ["Check the air filter and replace it if it's dirty.", "Make sure the supply and return vents around the house are open and not covered by furniture or rugs."],
    stopSigns: ["The filter and vents are fine", "Any mention of a rollout switch or scorch marks — don't reset anything, hand off", "It keeps locking out"],
    urgency: "routine", urgencyNote: "Urgent when the house has no heat and it's freezing outside.",
    source: { title: CARRIER_TG, url: CARRIER_URL, page: "6–7, 14, 24" },
  }),
  row({
    id: "carrier.furnace.ignition", trade: "hvac", category: "furnace", brands: ["Carrier"], modelFamily: "Carrier/ICP gas furnace (TG-GFC80-02)",
    code: "34 (ignition-proving fault) / 14 (ignition lockout)", codes: ["34", "14"],
    meaning: "The furnace didn't sense a flame when it lit (34); after four failed tries it locks out (14) and tries again after 3 hours.",
    safeSteps: ["Check the thermostat is on Heat and set above the room temperature.", "Check whether other gas appliances work (is the gas on?)."],
    stopSigns: [GAS_SMELL, "The furnace still won't light — that's a technician (flame sensor, gas, ignition)"],
    urgency: "routine", urgencyNote: "Urgent in freezing weather.",
    source: { title: CARRIER_TG, url: CARRIER_URL, page: "6, 15, 27" },
  }),
  row({
    id: "carrier.furnace.flame_signal", trade: "hvac", category: "furnace", brands: ["Carrier"], modelFamily: "Carrier/ICP gas furnace (TG-GFC80-02)",
    code: "22 (abnormal flame-proving signal)", codes: ["22"],
    meaning: "A flame is being sensed while the gas valve should be closed — a leaking or stuck-open gas valve.",
    safeSteps: [],
    stopSigns: ["Always — a gas valve fault is technician-only", GAS_SMELL],
    urgency: "urgent", source: { title: CARRIER_TG, url: CARRIER_URL, page: "7, 16" },
  }),

  // ── Goodman / Amana / Daikin 90%+ furnaces ───────────────────────────────
  row({
    id: "goodman.furnace.e0", trade: "hvac", category: "furnace", brands: ["Goodman", "Amana", "Daikin"], modelFamily: "GM9S92/96, AM9S92/96, GC9S96 single-stage 90%+ gas furnaces (RS6612022r1)",
    code: "E0", codes: ["E0"],
    meaning: "Locked out after three failed ignition attempts (no gas or low gas pressure, an igniter that isn't glowing, or a dirty flame sensor).",
    safeSteps: ["Check the thermostat is on Heat and calling for heat.", "Check whether other gas appliances work."],
    stopSigns: [GAS_SMELL, "Still locked out — a technician (igniter, flame sensor, gas pressure)"],
    urgency: "routine", urgencyNote: "Urgent in freezing weather.",
    source: { title: GOODMAN, url: GOODMAN_URL, page: "51" },
  }),
  row({
    id: "goodman.furnace.pressure_switch", trade: "hvac", category: "furnace", brands: ["Goodman", "Amana", "Daikin"], modelFamily: "GM9S / AM9S single-stage 90%+ furnaces (RS6612022r1)",
    code: "E1 / E2", codes: ["E1", "E2"],
    meaning: "A pressure-switch fault: E1 means it's closed when it should be open; E2 means it isn't closing. On a 90% furnace this is often a blocked vent or intake pipe, or a blocked condensate drain.",
    safeSteps: ["Outside, check the furnace's two plastic vent pipes are clear of snow, ice, leaves or nests — look only, don't take any pipe off."],
    stopSigns: ["The pipes are clear and the code stays", "Water is leaking from the furnace (the condensate trap or drain)"],
    urgency: "routine", urgencyNote: "Urgent in freezing weather.",
    source: { title: GOODMAN, url: GOODMAN_URL, page: "52" },
  }),

  // ── Rheem power-vent gas water heaters ───────────────────────────────────
  row({
    id: "rheem.wh.tco", trade: "plumbing", category: "water_heater", brands: ["Rheem"], modelFamily: "Rheem 40/50-gal power-vent gas water heater (AP16882-2)",
    code: "Gas valve light: 4 flashes (LCD 31) — high-limit lockout", codes: ["4", "4 flashes", "31", "LCD 31"],
    meaning: "The tank's over-temperature safety has tripped (a thermal well or gas control fault, or the tank isn't full of water).",
    safeSteps: ["Don't use very hot water at the taps until it has been checked — there's a scald risk."],
    stopSigns: ["Always — the reset and the diagnosis are for a technician"],
    urgency: "urgent", source: { title: RHEEM, url: RHEEM_URL, page: "41" },
  }),
  row({
    id: "rheem.wh.vapor", trade: "plumbing", category: "water_heater", brands: ["Rheem"], modelFamily: "Rheem power-vent gas water heater (AP16882-2)",
    code: "Gas valve light: 7 flashes (LCD 47) — flammable vapour sensor lockout", codes: ["7", "7 flashes", "47", "LCD 47"],
    meaning: "Gasoline or another flammable vapour was detected near the heater, or the sensor has failed.",
    safeSteps: ["Don't try to reset it."],
    stopSigns: ["Always", "Any smell of gas, gasoline or solvent near the heater — that is an emergency: follow the emergency rule"],
    urgency: "urgent", urgencyNote: "An emergency if they can smell gas, gasoline or solvent near the heater.",
    source: { title: RHEEM, url: RHEEM_URL, page: "40–41" },
  }),
  row({
    id: "rheem.wh.venting", trade: "plumbing", category: "water_heater", brands: ["Rheem"], modelFamily: "Rheem power-vent gas water heater (AP16882-2)",
    code: "Gas valve light: 3 flashes (LCD 46) pressure switch open; 6-2 flashes (LCD 45) recycle limit", codes: ["3", "3 flashes", "46", "LCD 46", "6-2", "45", "LCD 45"],
    meaning: "A venting problem: a blocked vent or intake, the pressure-switch tube, the blower, or strong wind at the vent outlet.",
    safeSteps: ["Outside, check the vent outlet isn't blocked by snow, ice, leaves or a nest — look only.", "Check the blower is plugged in."],
    stopSigns: ["The vent is clear and the code stays", "Any burnt smell or soot"],
    urgency: "routine", source: { title: RHEEM, url: RHEEM_URL, page: "40–41" },
  }),
  row({
    id: "rheem.wh.ignition_and_noises", trade: "plumbing", category: "water_heater", brands: ["Rheem"], modelFamily: "Rheem power-vent gas water heater (AP16882-2)",
    code: "6-1 flashes (LCD 11) failed ignition — and rumbling or a dripping relief valve", codes: ["6-1", "11", "LCD 11"],
    meaning: "6-1 flashes: the burner didn't light (gas supply, pilot or electrode). The same manual explains two common noises: rumbling is scale and sediment in the tank; a relief valve that pops or drips is pressure building up from thermal expansion.",
    safeSteps: [
      "Failed ignition: check whether other gas appliances work and that the heater's on/off switch is on.",
      "Rumbling: not dangerous on its own — a flush can be booked.",
      "Relief valve: never cap or plug it; put a bucket under the discharge pipe if it's dripping.",
    ],
    stopSigns: ["The relief valve keeps letting out hot water or steam", "Hot water is backing into the cold line, or the tank is too hot to touch", GAS_SMELL],
    urgency: "routine", urgencyNote: "Urgent when the relief valve is discharging steam, or there are signs of overheating.",
    source: { title: `${RHEEM} — Before You Call For Service, and the light table`, url: RHEEM_URL, page: "40–41" },
  }),

  // ── Bradford White powered direct-vent gas water heaters ─────────────────
  row({
    id: "bradfordwhite.wh.overtemp", trade: "plumbing", category: "water_heater", brands: ["Bradford White"], modelFamily: "Bradford White powered direct-vent gas water heater (238-51370-00G)",
    code: "Light: 4 flashes, 3-second pause", codes: ["4", "4 flashes"],
    meaning: "The tank temperature went too high and the system has to be reset (sediment, hot water coming in from another source, or a faulty gas valve).",
    safeSteps: ["Avoid using very hot water until it has been checked — there's a scald risk."],
    stopSigns: ["Always — the reset is for a technician"],
    urgency: "urgent", source: { title: BW, url: BW_URL, page: "36" },
  }),
  row({
    id: "bradfordwhite.wh.vapor_pilot_venting", trade: "plumbing", category: "water_heater", brands: ["Bradford White"], modelFamily: "Bradford White powered direct-vent gas water heater (238-51370-00G)",
    code: "Light: 7 flashes (flammable vapour sensor) / 6-1 (pilot didn't light) / 6-2 (pressure or blower temperature switch opened)", codes: ["7", "7 flashes", "6-1", "6-2"],
    meaning: "7 flashes: flammable vapour was detected, or the sensor got wet or too hot or cold. 6-1: the pilot didn't light; it tries again by itself after 5 minutes. 6-2: a venting problem (a blocked vent, wind at the outlet, or the blower).",
    safeSteps: [
      "7 flashes: don't reset it — hand it to the team.",
      "6-1: wait 5 minutes for it to try again on its own, and check other gas appliances work.",
      "6-2: look at the outside vent for snow, ice or a nest; strong wind can also cause it.",
    ],
    stopSigns: ["7 flashes in any case", "6-1 or 6-2 keeps coming back", "Any smell of gas, gasoline or solvent — that is an emergency: follow the emergency rule"],
    urgency: "routine", urgencyNote: "7 flashes is urgent; an emergency if there's any vapour smell.",
    source: { title: BW, url: BW_URL, page: "36–37" },
  }),

  // ── Rinnai tankless ──────────────────────────────────────────────────────
  row({
    id: "rinnai.tankless.10", trade: "plumbing", category: "tankless_water_heater", brands: ["Rinnai"], modelFamily: "Rinnai tankless (SENSEI RU/RUR, V-series, RL, RUC/RUCS, KB)",
    code: "10", codes: ["10"],
    meaning: "An air supply or exhaust problem. Rinnai's checks start with the condensate drain (clogged or frozen), the intake air filter and the vent piping.",
    safeSteps: ["Outside, check the vent and intake openings aren't blocked by snow, ice, leaves or a nest — look only.", "In freezing weather, check whether the condensate drain line has frozen."],
    stopSigns: ["Anything beyond looking — opening the cover, the filter or the vent piping is technician work", "The code keeps coming back"],
    urgency: "routine", urgencyNote: "Urgent in freezing weather if the home has no hot water and this unit is also the heating.",
    source: { title: RINNAI, url: RINNAI_URL, page: "10" },
  }),
  row({
    id: "rinnai.tankless.ignition", trade: "plumbing", category: "tankless_water_heater", brands: ["Rinnai"], modelFamily: "Rinnai tankless",
    code: "11 / 12", codes: ["11", "12"],
    meaning: "11: no ignition. 12: the flame went out. The first check for both is whether gas is reaching the heater (valves open, propane tank not empty).",
    safeSteps: ["Check whether other gas appliances work.", "On propane, check the tank isn't empty."],
    stopSigns: [GAS_SMELL, "The gas is on and the code keeps coming back (igniter, gas pressure — a technician)"],
    urgency: "routine", source: { title: RINNAI, url: RINNAI_URL, page: "14, 18" },
  }),
  row({
    id: "rinnai.tankless.leak", trade: "plumbing", category: "tankless_water_heater", brands: ["Rinnai"], modelFamily: "Rinnai tankless (non-SENSEI)",
    code: "79", codes: ["79"],
    meaning: "A water leak has been detected inside the cabinet (the leak sensor).",
    safeSteps: ["Turn the heater off at its controller.", "If water is dripping from the unit, close the cold-water shut-off valve on the pipe feeding it."],
    stopSigns: ["Always — checking an internal leak is technician work"],
    urgency: "urgent", source: { title: RINNAI, url: RINNAI_URL, page: "54" },
  }),
  row({
    id: "rinnai.tankless.scale", trade: "plumbing", category: "tankless_water_heater", brands: ["Rinnai"], modelFamily: "Rinnai tankless",
    code: "LC / LC0–LC9 / 00", codes: ["LC", "LC0", "LC1", "LC2", "LC3", "LC4", "LC5", "LC6", "LC7", "LC8", "LC9", "00"],
    meaning: "Scale has built up in the heat exchanger and it needs flushing. Newer units lock out; the number counts the temporary restarts used without a flush.",
    safeSteps: [
      "Rinnai allows a temporary restart: press the controller's on/off button five times, and the heater runs for about 70 more hours before it locks out again.",
      "Book a flush (and ask about water treatment in a hard-water area).",
    ],
    stopSigns: ["LC comes back — they need the flush appointment, not more restarts"],
    urgency: "routine", source: { title: RINNAI, url: RINNAI_URL, page: "59" },
  }),
]);
