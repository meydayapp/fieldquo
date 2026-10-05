// lib/aiEmployee/knowledge/firstSteps.js
//
// The safe first steps the assistant MAY give a homeowner while something
// is going wrong (owner, 2026-10-04): "shut the main water valve", "turn the
// breaker for that circuit off once — never repeatedly", "turn the
// thermostat to off". Vetted text, in FieldQuo's own words, from public
// sources — never the model's general knowledge.
//
// ══ The rule, and what it replaces ═════════════════════════════════════════
//
// The troubleshooter's old SAFETY line was "anything involving gas, water
// damage in progress, live electricity or a risk of injury: do not talk them
// through it". That blocked the single most useful sentence during a leak.
// The owner's rule now: ONLY vetted steps — the ones below, or a step the
// company's own manual or a look_up_error_code result gives as a homeowner
// step — and NEVER anything that needs a panel or cover opened, gas valve or
// pilot work, a ladder or the roof, or anything live electrical. The company
// can switch steps off altogether (AiEmployeeCompanySettings.safeStepsEnabled);
// then the assistant gives none and fetches the team.
//
// ══ Two layers, both deterministic ═════════════════════════════════════════
//
//   1. The prompt names these steps, by category, worded as given.
//   2. screenStep() refuses a logged step that matches a FORBIDDEN pattern
//      (log_troubleshooting will not record it), and unsafeInstruction()
//      reads the finished reply: an instruction to open a panel, work a gas
//      valve or climb a ladder does not go out — the reply is held for a
//      person, the same way a claimed photograph is (lib/aiEmployee/
//      evidence.js). Negated mentions ("don't go up on the roof") are what a
//      safe step SAYS, so a negation just before the verb lets it through.
//
// Sources (paraphrased): USDA Farmers' Bulletin 2202, "Simple Plumbing
// Repairs for the Home and Farmstead" (shut-off valves first); FEMA P-234 /
// American Red Cross, "Repairing Your Flooded Home" pp.9–11 (never stand in
// water to reach the panel); US CPSC Pub. 513, "Home Electrical Safety
// Checklist" (stop using a warm outlet; turn the breaker off; an electrician
// for the rest); US DOE Energy Saver and EPA ENERGY STAR "A Guide to
// Energy-Efficient Heating and Cooling" (thermostat, filters, ice on the
// lines → system off); Town of Dudley MA, "How to Protect from Frozen Pipes"
// and Ready.gov "Winter Weather" (drip the taps, open the cabinet doors,
// never a flame); Univ. of Minnesota Extension, "Preventing Ice Dams" and
// NDSU Extension (never climb or chop ice).

/** Every vetted step. `category` matches lib/aiEmployee/triage.js. */
export const VETTED_FIRST_STEPS = Object.freeze([
  {
    id: "water.main_shutoff",
    category: "water",
    text:
      "Shut off the main water valve — usually where the water pipe comes into the house (basement, crawl space, utility room or near the water heater). Turn a round handle clockwise until it stops, or turn a lever a quarter turn so it sits across the pipe.",
    source: "USDA Farmers' Bulletin 2202; FEMA P-234",
  },
  {
    id: "water.fixture_shutoff",
    category: "water",
    text: "If it's one sink or toilet, the small valve under that sink or behind that toilet stops just that one — turn it clockwise.",
    source: "USDA Farmers' Bulletin 2202",
  },
  {
    id: "water.protect",
    category: "water",
    text: "Put a bucket or towels under the water and move valuables and anything electrical out of the way.",
    source: "FEMA P-234",
  },
  {
    id: "water.keep_clear_electrics",
    category: "water",
    text: "If water is near outlets, lights or the electrical panel, keep away from it and don't touch anything electrical. Don't stand in water to reach the panel.",
    source: "FEMA P-234 p.10",
  },
  {
    id: "electrical.breaker_once",
    category: "electrical",
    text:
      "If it's safe and dry to get to the breaker box, switch the breaker for that circuit to OFF — once. If it trips again, leave it off. Never reset it over and over, and never take the cover off the panel.",
    source: "US CPSC Pub. 513",
  },
  {
    id: "electrical.stop_using",
    category: "electrical",
    text: "Stop using that outlet, switch or appliance, and unplug it only if you can do so with dry hands while not standing in water.",
    source: "US CPSC Pub. 513",
  },
  {
    id: "heat.thermostat_check",
    category: "heat",
    text: "Check the thermostat is set to HEAT and to a temperature above the room's, and put new batteries in it if it takes them.",
    source: "US DOE Energy Saver",
  },
  {
    id: "heat.thermostat_off",
    category: "heat",
    text: "Turn the thermostat to OFF.",
    source: "EPA ENERGY STAR heating and cooling guide",
  },
  {
    id: "heat.protect_pipes",
    category: "heat",
    text: "Open the cabinet doors under sinks on outside walls and let a tap drip slowly so the water keeps moving. Never use a flame or a torch on a pipe.",
    source: "Town of Dudley MA, frozen pipes; Ready.gov Winter Weather",
  },
  {
    id: "roof.protect",
    category: "roof",
    text: "Put a bucket or towels under the drip and move things out of the way. Stay out from under a sagging ceiling, and don't go up a ladder or onto the roof.",
    source: "Univ. of Minnesota Extension, ice dams; NDSU Extension",
  },
  {
    id: "sewage.stop_water",
    category: "sewage",
    text: "Stop using water in the house — no flushing, showers, laundry or dishwasher — until it's been looked at, and keep children and pets away from it.",
    source: "USDA Farmers' Bulletin 2202",
  },
]);

/** The steps for some categories, in the order above. */
export function stepsFor(categories = []) {
  const want = new Set(Array.isArray(categories) ? categories : []);
  return VETTED_FIRST_STEPS.filter((s) => want.has(s.category));
}

/**
 * The prompt block: the steps this role may give, or the reason it gives
 * none. Static per company, so it rides in the cached prefix.
 *
 * @param enabled     AiEmployeeCompanySettings.safeStepsEnabled
 * @param canStep     the troubleshooter and the receptionist give steps;
 *                    the closer and a custom employee pass the problem on
 */
export function firstStepsBlock({ enabled = true, canStep = false, categories = ["water", "heat", "roof", "sewage", "electrical"] } = {}) {
  if (!canStep) {
    return [
      "SAFE FIRST STEPS",
      "Do not walk anyone through a repair or a safety step yourself. For a problem with something already installed, pass the conversation on (hand_off_to_employee, troubleshooter) or to a person.",
    ].join("\n");
  }
  if (enabled === false) {
    return [
      "SAFE FIRST STEPS",
      "This business has asked you not to give any steps yourself — not even shutting a valve. Say the team will help, and fetch them (hand_off_to_human, or book_callback). The leave-the-house and 911 lines in the emergency rule still apply.",
    ].join("\n");
  }
  const steps = stepsFor(categories);
  return [
    "SAFE FIRST STEPS",
    "You may give at most two of these, worded as given, when they fit — or a step that the company's own material or a look_up_error_code result gives as a homeowner step. Nothing else. Never anything that needs a panel or cover opened, a gas valve or pilot light touched, a ladder or the roof, or anything electrical that is live; if the only fix is one of those, the team does it.",
    ...steps.map((s) => `- [${s.category}] ${s.text}`),
  ].join("\n");
}

// ── What a step may never ask for ────────────────────────────────────────────
//
// English, French and Spanish — matched on folded text (no accents, no
// apostrophes). Each pattern is an INSTRUCTION shape (a verb and its
// object), not a topic word: "the panel" alone is in a safe step ("never
// take the cover off the panel"), "remove the panel cover" is the thing
// forbidden.
const FORBIDDEN = [
  { key: "open_panel", re: /\b(remove|take off|unscrew|open|pull off|lift off|take out)( the| your| its| that)? (front |access |electrical |breaker |service |burner |furnace |dead ?front )?(panel|cover|cover plate|door panel|faceplate|access door|burner door|blower door|furnace door)\b/ },
  { key: "open_appliance", re: /\b(open|remove|unscrew|take apart|disassemble)( the| your)? (furnace|boiler|water heater|heater|dryer|dishwasher|washer|unit|appliance|thermostat)( cabinet| casing| housing)?\b/ },
  { key: "gas_valve", re: /\b(turn|shut|close|open|adjust|light|relight|reset|twist)( off| on)?( the| your)? (gas (valve|cock|supply|line|knob|control)|pilot( light)?|burners?)\b/ },
  { key: "gas_valve", re: /\b(relight|light) (it|the pilot)\b/ },
  { key: "ladder_roof", re: /\b(climb|get|go|step|walk)( up)?( on| onto| up)( to)?( the| a| your)? (ladder|roof|rooftop)\b/ },
  { key: "ladder_roof", re: /\b(use|grab|set up|put up)( a| the| your)? ladder\b/ },
  { key: "ladder_roof", re: /\b(chip|chop|break|hack)( off| up| away)?( the)? ice\b/ },
  { key: "live_electrical", re: /\b(touch|disconnect|reconnect|strip|cap|twist|test|tighten|join|splice)( the| any| those| these| your)?( two| both| bare| loose| exposed| live| black| white| red| hot)? (wire|wires|wiring|live wire|terminals?)\b/ },
  { key: "live_electrical", re: /\b(multimeter|voltmeter|voltage tester|test (the )?voltage)\b/ },
  { key: "live_electrical", re: /\b(reset|flip)( it| the breaker)? (again and again|several times|repeatedly|a few times|until it (holds|stays))\b/ },
  { key: "flame", re: /\b(torch|blowtorch|open flame|lighter|propane heater|kerosene heater)\b/ },
  // French
  { key: "open_panel", re: /\b(enlever|enlevez|enleve|retirer|retirez|retire|devisser|devissez|ouvrir|ouvrez|ouvre) (le |la |les )?(couvercle|panneau|plaque|facade)\b/ },
  { key: "gas_valve", re: /\b(fermer|fermez|ferme|ouvrir|ouvrez|tourner|tournez|rallumer|rallumez|allumer|allumez) (la |le )?(valve|vanne|robinet) (de |du )?gaz\b/ },
  { key: "gas_valve", re: /\b(rallumer|rallumez|allumer|allumez) (la )?veilleuse\b/ },
  { key: "ladder_roof", re: /\b(monter|montez|monte|grimper|grimpez) (sur|a) (le |l |une )?(toit|echelle)\b/ },
  { key: "live_electrical", re: /\b(toucher|touchez|touche) (aux|les) fils\b/ },
  // Spanish
  { key: "open_panel", re: /\b(quitar|quite|quita|retirar|retire|abrir|abra|abre|desatornillar|desatornille) (la |el )?(tapa|panel|cubierta)\b/ },
  { key: "gas_valve", re: /\b(cerrar|cierre|cierra|abrir|abra|abre|girar|gire|encender|encienda|prender|prenda) (la )?(valvula|llave) (de|del) gas\b/ },
  { key: "gas_valve", re: /\b(encender|encienda|prender|prenda) (el )?piloto\b/ },
  { key: "ladder_roof", re: /\b(subir|subirse|suba|sube|subase|subete) (al|a la|a una|por la) (techo|escalera)\b/ },
  { key: "live_electrical", re: /\b(tocar|toque|toca) (los )?cables\b/ },
];

// "Never take the cover off the panel", "don't go up a ladder or onto the
// roof" — what a safe step says. A negation anywhere earlier in the SAME
// clause lets a match pass; clauses split on punctuation and "but", so
// "Don't worry, just climb onto the roof" is still caught.
const NEGATION = /\b(never|dont|do not|not|no|avoid|without|stay off|keep off|ne|pas|jamais|nunca|sin)\b/;

const fold = (text) =>
  String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const clauses = (text) =>
  String(text ?? "")
    .split(/[.,;:!?\n—–()]+|\bbut\b|\bmais\b|\bpero\b/i)
    .map(fold)
    .filter(Boolean);

/**
 * The first forbidden INSTRUCTION in some text, or null. Negated mentions
 * pass. Pure.
 *
 * @returns {{ key: string, match: string } | null}
 */
export function forbiddenInstruction(text) {
  for (const s of clauses(text)) {
    for (const { key, re } of FORBIDDEN) {
      const m = re.exec(s);
      if (m && !NEGATION.test(s.slice(0, m.index))) return { key, match: m[0] };
    }
  }
  return null;
}

/** May this one step be recorded as given? */
export function screenStep(step) {
  const hit = forbiddenInstruction(step);
  return hit ? { ok: false, reason: `not_vetted:${hit.key}` } : { ok: true };
}

/** The stop reason a held reply carries (AiEmployeeReply.suppressedReason),
 *  translated on the screen as app.aiEmployee.skip.unsafe_step. */
export const UNSAFE_STEP_REASON = "unsafe_step";

/**
 * The reply guard: the stop reason when a finished reply tells someone to do
 * a forbidden thing, else null. Held for a person, never sent.
 */
export function unsafeInstructionRefusal(text) {
  return forbiddenInstruction(text) ? UNSAFE_STEP_REASON : null;
}
