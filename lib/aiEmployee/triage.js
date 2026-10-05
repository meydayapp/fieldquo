// lib/aiEmployee/triage.js
//
// How urgent is what the customer just said — and what does THIS company
// want done about it? (owner, 2026-10-04)
//
// ══ Three tiers, and the shared rule owns the top one ══════════════════════
//
//   emergency  gas or a CO alarm (leave first), fire or smoke, someone hurt
//              or shocked, water on the electrics. lib/ai/crisisRule.js —
//              the ONE rule every product that talks to the public carries —
//              says what the assistant tells them. No company switch here
//              reaches it.
//   urgent     property damage in progress, nobody in danger: water actively
//              leaking or a burst pipe, no heat in freezing weather, a roof
//              leaking in a storm, sewage backing up, a hot or buzzing
//              outlet. NOT 911. The company's on-call person is texted
//              (lib/aiEmployee/urgentAlerts.js) and the customer is given the
//              company's own number.
//   routine    everything else — a drip, a slow drain, a noise, a stain.
//
// Sources for where each situation sits (paraphrased, never quoted): Public
// Service Commission of Wisconsin, "Natural Gas Consumer Safety"; US CPSC,
// "Carbon Monoxide Questions and Answers"; US CPSC Pub. 513, "Home Electrical
// Safety Checklist" (warm outlets, shocks, sparks); FEMA P-234 / American Red
// Cross, "Repairing Your Flooded Home" p.10 (water and the panel); USDA
// Farmers' Bulletin 2202, "Simple Plumbing Repairs" (burst pipes: shut off
// first, then repair); Ready.gov, "Winter Weather" (no heat, frozen pipes,
// hypothermia); Univ. of Minnesota Extension, "Preventing Ice Dams" (winter
// roof water). The full reading list is in docs/ROADMAP.md under the AI
// knowledge entry.
//
// ══ Two independent signals, and the higher one wins ═══════════════════════
//
//   (a) classifyMessage() below — a deterministic pattern match over the
//       customer's OWN words, free, before any model is involved. Biased the
//       way lib/ai/crisisRule.js's mentionsCrisis is: towards firing on the
//       few phrases that are unambiguous ("I smell gas", "a pipe burst",
//       "water pouring through the ceiling").
//   (b) the model's `urgency` on hand_off_to_human / book_callback /
//       log_troubleshooting — which is how an answer to a probing question
//       ("yes, it's coming in fast") becomes urgent.
//
// A model that under-calls cannot downgrade (a); a pattern that misses a
// language cannot stop (b). higherTier() is the whole merge.
//
// ══ Not over-sensitive: ask first ══════════════════════════════════════════
//
// The owner: "a dripping faucet isn't treated as an emergency". So the
// matcher only fires urgent on STRONG phrases; "leak" on its own is
// `unclear`, and the prompt (with the company's triageProbeFirst on, the
// default) has the assistant ask one or two short questions — is water
// actively coming in, how much, can you see the shut-off, is anyone hurt, is
// there a gas smell or just a noise — before anything is classed urgent.
// "Dripping", "slow drain", "noise", "stain" pull a message DOWN to routine
// unless a strong phrase is also present. A plain gas smell is never probed.
//
// ══ What a company can switch ══════════════════════════════════════════════
//
// Which urgent situations are urgent FOR THEM (urgentCategories — a painter
// may not want a 2 a.m. text about a roof), and whether to probe first. A
// category they left out is an ordinary callback, never 911. The emergency
// tier is not on the list and cannot be.
//
// Pure: no database, no model. scripts/check-ai-employee.mjs and
// scripts/check-crisis-handling.mjs execute it against dripping vs gushing,
// gas smell vs a noise, past-tense fires, French and Spanish.

/** The situations a company may count as urgent — and switch off. */
export const URGENT_CATEGORIES = Object.freeze(["water", "heat", "roof", "sewage", "electrical"]);

/** The emergency situations. Never switchable. */
export const EMERGENCY_CATEGORIES = Object.freeze(["gas_co", "fire", "injury", "water_electrics"]);

/** Ranked, strongest first. `unclear` sits above routine: it is a reason to ask, not to relax. */
export const TIERS = Object.freeze(["emergency", "urgent", "unclear", "routine", "none"]);

/** The probing questions, by key — the prompt and the check share them. */
export const PROBES = Object.freeze({
  water_active: "Is water actively coming in right now, or is it a drip?",
  water_amount: "How much — a few drops, or a steady flow?",
  shutoff_visible: "Can you see the shut-off valve?",
  anyone_hurt: "Is anyone hurt?",
  gas_or_noise: "Is there a gas smell, or is it just a noise?",
  how_cold: "How cold is it inside, and is it below freezing outside?",
  roof_now: "Is water coming in right now?",
});

const rankOf = (t) => {
  const i = TIERS.indexOf(t);
  return i === -1 ? TIERS.length : i;
};

/** The stronger of two tiers. */
export function higherTier(a, b) {
  return rankOf(a) <= rankOf(b) ? a || "none" : b || "none";
}

// ── The patterns ────────────────────────────────────────────────────────────
//
// Matched against folded text: lowercase, accents stripped, apostrophes
// dropped ("can't" → "cant"), everything else that isn't a letter or digit a
// single space. English, French and Spanish — the three languages FieldQuo's
// own help is written in; the model's urgency argument covers the rest.

const fold = (text) =>
  ` ${String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

const any = (s, list) => list.some((re) => re.test(s));

const GAS_CO = [
  /\bsmell(s|ing|ed)? (of |like )?(natural )?gas\b/,
  /\bgas smell\b/,
  /\bsmells? like (rotten eggs?|sulph?ur)\b/,
  /\brotten egg (smell|odou?r)\b/,
  /\bgas (is )?leak(ing)?\b/,
  /\bleak(ing)? gas\b/,
  /\bhiss(ing)? (sound )?(from|at|near|by) (the )?gas\b/,
  /\bgas (line|pipe|meter) (is )?hissing\b/,
  /\b(co|carbon monoxide) (alarm|detector)( is| keeps| just| has)? (going off|sounding|beeping|went off|gone off|alarming|ringing)\b/,
  /\b(co|carbon monoxide) alarm\b/,
  // French
  /\bodeur de gaz\b/,
  /\bsent (le|du) gaz\b/,
  /\bfuite de gaz\b/,
  /\b(alarme|detecteur) (de |du )?(co|monoxyde)\b/,
  // Spanish
  /\bolor a gas\b/,
  /\bhuele a gas\b/,
  /\bfuga de gas\b/,
  /\b(alarma|detector) de (co|monoxido)\b/,
];

// Present tense only: "we had a small fire in the garage last week" is a
// drywall job, not a 911 call (scripts/check-crisis-handling.mjs keeps it so).
const FIRE = [
  /\b(is|its|house is|kitchen is|garage is|attic is) on fire\b/,
  /\bon fire (right )?now\b/,
  /\bcaught fire\b/,
  /\bcatching fire\b/,
  /\btheres (a )?fire\b/,
  /\bflames? (are |is )?(coming|shooting|everywhere)\b/,
  /\bsmoke (is )?(coming|pouring|filling|everywhere)\b/,
  /\b(outlet|panel|plug|switch|wall|furnace|heater|breaker box) (is )?(smoking|on fire)\b/,
  /\bsparks? and smoke\b/,
  /\bsparking and smoking\b/,
  // French
  /\b(est |sont )?en feu\b/,
  /\bpris feu\b/,
  /\bil y a (de la )?fumee\b/,
  /\bdes flammes\b/,
  // Spanish
  /\ben llamas\b/,
  /\bse (esta )?(quemando|incendiando)\b/,
  /\bsale humo\b/,
  /\bhay (fuego|humo)\b/,
];

const INJURY = [
  /\bgot (a )?(bad )?shock(ed)?\b/,
  /\b(was|been|got|getting) shocked\b/,
  /\belectrocut/,
  /\b(someone|somebody|he|she|my (son|daughter|husband|wife|kid|child|dad|mom|father|mother)) (is |got |has been )?(badly )?(hurt|injured|bleeding)\b/,
  /\bfell (off|from) (the |a )?(ladder|roof)\b/,
  /\b(unconscious|not breathing|passed out)\b/,
  // French
  /\belectrocute\b/,
  /\b(est |s est )?blesse(e)?\b/,
  /\binconscient/,
  // Spanish
  /\b(herido|herida|se lastimo|se electrocuto|inconsciente)\b/,
];

const WATER_ELECTRICS = [
  /\bwater (is )?(on|in|near|touching|around|getting (in|into)|dripping (on|onto|into)|coming (out of|through)) (the |my |an |a )?(electrical )?(panel|breaker box|breaker panel|outlets?|plugs?|sockets?|light fixtures?|light)\b/,
  /\b(panel|breaker box|outlet|outlets|socket|light fixture) (is |are )?(wet|under water|flooded|full of water)\b/,
  // French
  /\beau (sur|dans|pres du|pres de la) (le |la |les )?(panneau|prise|prises|luminaire)\b/,
  // Spanish
  /\bagua (en|sobre|cerca del?|cerca de la) (el |la |los )?(panel|tablero|enchufe|enchufes|lampara)\b/,
];

const WATER_STRONG = [
  /\bburst (water )?(pipe|pipes|line|hose)\b/,
  /\b(pipe|pipes|line|hose) (has |have )?(burst|broke|broken|split|blew)\b/,
  /\b(gushing|spraying)\b/,
  // "Pouring" and "flooding" only with water as the subject — "it's pouring
  // outside, can you quote my gutters?" is a sales enquiry on a wet day.
  /\bwater (is |keeps )?(pouring|flooding|rushing|gushing|spraying)\b/,
  /\bpouring (in|out|through|from|everywhere)\b/,
  /\b(is|are|its|keeps|keep) flooding\b/,
  /\bflooding (the|my|our)\b/,
  /\b(basement|kitchen|bathroom|house|floor|garage|laundry room) is (flooded|flooding|under water)\b/,
  /\bwater everywhere\b/,
  /\bwater (is )?(coming|pouring|leaking|running) (in )?(through|from|out of) (the )?(ceiling|wall|light)\b/,
  /\bceiling is (leaking|sagging|bulging|caving)\b/,
  /\bcant (shut|turn) (it|the water) off\b/,
  /\bwont stop (leaking|running|spraying)\b/,
  /\bactive(ly)? leak(ing)?\b/,
  /\bleaking (fast|badly|a lot|everywhere)\b/,
  // French
  /\b(inondation|inonde|inondee)\b/,
  /\btuyau (a )?(eclate|creve|casse)\b/,
  /\b(l )?eau (coule|tombe|sort) (du|par le|de partout|partout)\b/,
  /\bjailli/,
  /\bdegat d eau\b/,
  // Spanish
  /\b(inundacion|inundado|inundada)\b/,
  /\b(tubo|tuberia|cano) (roto|rota|reventad[oa])\b/,
  /\bse (rompio|reviento) (el |la )?(tubo|tuberia|cano)\b/,
  /\bsale (mucha )?agua (a chorros|por todos lados)\b/,
  /\bagua (cae|sale|entra) (del|por el) techo\b/,
];

const ROOF_LEAK = [
  /\broof (is )?(leaking|leak|leaks)\b/,
  /\bleak(ing|s)? (from|through|in) (the )?roof\b/,
  /\bwater coming (in )?(through|from) the roof\b/,
  /\bice dam\b/,
  // French
  /\b(toit|toiture) (qui )?(coule|fuit)\b/,
  /\bfuite (au|du|dans le) (toit|plafond)\b/,
  // Spanish
  /\b(gotera|goteras)\b/,
  /\bel techo (gotea|se filtra)\b/,
  /\bfiltracion (en|del) techo\b/,
];

const STORM = [
  /\b(storm|raining|rain|downpour|wind|windstorm|hurricane|snow melting|thunder)\b/,
  /\b(orage|pluie|il pleut|tempete)\b/,
  /\b(tormenta|lluvia|lloviendo|huracan)\b/,
];

const NO_HEAT = [
  /\bno heat\b/,
  /\bnot (getting|producing|giving) (any )?heat\b/,
  /\b(furnace|boiler|heat pump|heater|heating) (is |has )?(out|dead|died|stopped|not working|broken|wont (turn on|start|come on|light))\b/,
  /\bheat (is |has )?(out|off|not working|stopped)\b/,
  /\bno (hot air|heating)\b/,
  // French
  /\bpas de chauffage\b/,
  /\b(chauffage|fournaise|chaudiere|thermopompe) (est )?(en panne|ne (marche|fonctionne|demarre) (plus|pas))\b/,
  // Spanish
  /\b(no hay|sin) calefaccion\b/,
  /\b(calefaccion|caldera|calentador) (no (funciona|prende|enciende)|apagad[oa]|descompuest[oa])\b/,
];

const FREEZING = [
  /\b(freez\w*|frozen|below zero|subzero|sub zero|minus \d+|ice cold|bitter cold|polar)\b/,
  /\bpipes? (might|will|could|are going to|gonna) freeze\b/,
  /\b(baby|newborn|infant|elderly|grandm\w+|grandp\w+|oxygen)\b/,
  /\b(gel|gele|geler|sous zero|moins \d+)\b/,
  /\b(helad[oa]|bajo cero|congel\w+)\b/,
];

const SEWAGE = [
  /\b(sewage|sewer) (is )?(backing up|backed up|backup|coming up|overflowing)\b/,
  /\bsewage (back ?up|in the basement|everywhere)\b/,
  /\braw sewage\b/,
  /\b(refoulement|egout (qui )?refoule)\b/,
  /\b(aguas negras|drenaje (se )?(regresa|desborda))\b/,
];

const ELECTRICAL_URGENT = [
  /\b(outlet|switch|plug|panel|breaker|socket|breaker box) (is |feels |are )?(hot|warm|buzzing|crackling|melting|melted|scorched)\b/,
  /\bburning smell (from|near|at|by) (the )?(outlet|panel|switch|plug|breaker)\b/,
  /\b(sparks?|sparking) (from|at|in|out of) (the |an |a )?(outlet|plug|switch|panel|socket)\b/,
  /\b(prise|interrupteur|panneau) (est )?(chaude|chaud|grésille|gresille)\b/,
  /\betincelles?\b/,
  /\b(enchufe|tomacorriente|interruptor) (esta )?(caliente|echa chispas|chispea)\b/,
  /\bchispas\b/,
];

// Words that make an otherwise-ambiguous message ROUTINE.
const ROUTINE = [
  /\bdrip(s|ping|py)?\b/,
  /\bslow (drain|leak)\b/,
  /\brunning toilet\b/,
  /\btoilet (keeps )?running\b/,
  /\b(small|tiny|little|minor) leak\b/,
  /\ba few drops\b/,
  /\b(squeak\w*|stain|stains|stained)\b/,
  /\b(gotea un poco|goteo|goutte|gouttes|fuite lente)\b/,
];

// Words that make a message worth ASKING about.
const UNCLEAR_WATER = [/\bleak\w*\b/, /\bwater\b/, /\bfuite\b/, /\beau\b/, /\bfuga\b/, /\bagua\b/];
const ODD_SMELL = [/\b(smell|smells|odor|odour|odeur|olor)\b/];
const APPLIANCE_NOISE = [
  /\b(furnace|boiler|water heater|heater|stove|range|dryer|chaudiere|fournaise|chauffe eau|calentador|caldera|estufa)\b/,
];
const NOISE = [/\b(noise|noisy|banging|rumbling|clicking|whistling|bruit|ruido)\b/];

/**
 * Classify ONE message from the customer. Pure, free, deterministic.
 *
 * @returns {{ tier: "emergency"|"urgent"|"unclear"|"routine"|"none",
 *             category: string|null, leaveFirst: boolean, probes: string[] }}
 */
export function classifyMessage(text) {
  const s = fold(text);
  const out = (tier, category = null, extra = {}) => ({ tier, category, leaveFirst: false, probes: [], ...extra });
  if (s.trim() === "") return out("none");

  // ── Emergency: the shared rule's top tier ─────────────────────────────
  if (any(s, GAS_CO)) return out("emergency", "gas_co", { leaveFirst: true });
  if (any(s, FIRE)) return out("emergency", "fire");
  if (any(s, INJURY)) return out("emergency", "injury");
  if (any(s, WATER_ELECTRICS)) return out("emergency", "water_electrics");

  // ── Urgent: property damage in progress ───────────────────────────────
  const roof = any(s, ROOF_LEAK);
  const storm = any(s, STORM);
  if (roof && (storm || any(s, WATER_STRONG))) return out("urgent", "roof");
  if (any(s, WATER_STRONG)) return out("urgent", storm && /\b(ceiling|plafond|techo)\b/.test(s) ? "roof" : "water");
  if (any(s, SEWAGE)) return out("urgent", "sewage");
  if (any(s, ELECTRICAL_URGENT)) return out("urgent", "electrical");
  if (any(s, NO_HEAT)) {
    return any(s, FREEZING) ? out("urgent", "heat") : out("unclear", "heat", { probes: ["how_cold", "anyone_hurt"] });
  }

  // ── Below urgent: routine, or worth a question ────────────────────────
  if (roof) return out("unclear", "roof", { probes: ["roof_now", "water_amount"] });
  // A smell near a gas appliance, or a noise from one: ask whether it is a
  // gas SMELL — the one question that turns it into "leave now".
  if (any(s, APPLIANCE_NOISE) && (any(s, ODD_SMELL) || any(s, NOISE))) {
    return out(any(s, ODD_SMELL) ? "unclear" : "routine", null, { probes: ["gas_or_noise"] });
  }
  // Water from a ceiling with no strong word ("a few drips from the
  // ceiling") is worth a question, not a shrug and not an alarm.
  if (/\b(ceiling|plafond|techo)\b/.test(s) && (any(s, UNCLEAR_WATER) || any(s, ROUTINE))) {
    return out("unclear", "water", { probes: ["water_active", "water_amount"] });
  }
  if (any(s, ROUTINE)) return out("routine", any(s, UNCLEAR_WATER) ? "water" : null);
  if (any(s, UNCLEAR_WATER) && /\bleak\w*|\bfuite\b|\bfuga\b|\bflood/.test(s)) {
    return out("unclear", "water", { probes: ["water_active", "water_amount", "shutoff_visible"] });
  }
  return out("none");
}

/** A model-supplied urgency word, cleaned. Unknown → null (no signal). */
export function modelTier(value) {
  return value === "emergency" || value === "urgent" || value === "routine" ? value : null;
}

/** A model-supplied category, cleaned to the closed list. */
export function cleanCategory(value) {
  const v = String(value || "").toLowerCase().trim();
  if (URGENT_CATEGORIES.includes(v) || EMERGENCY_CATEGORIES.includes(v)) return v;
  if (v === "gas" || v === "co" || v === "carbon_monoxide") return "gas_co";
  if (v === "cooling" || v === "ac") return "other";
  return v ? "other" : null;
}

/**
 * The tier this COMPANY acts on. An urgent situation in a category the
 * company left out of its list is handled as routine (an ordinary callback —
 * never 911). Emergency is untouched by any setting.
 */
export function effectiveTier({ tier, category }, settings = {}) {
  if (tier !== "urgent") return tier;
  const enabled = Array.isArray(settings.urgentCategories) ? settings.urgentCategories : URGENT_CATEGORIES;
  // "other" (a model's urgent call on something off the list — no cooling in
  // a heatwave with a vulnerable occupant) stays urgent: the list switches
  // OFF categories the company named, it does not demote the unforeseen.
  if (!category || category === "other") return "urgent";
  return enabled.includes(category) ? "urgent" : "routine";
}

/**
 * The turn's final triage: the matcher over the customer's words, and every
 * urgency the model put on a tool this turn — the higher wins, then the
 * company's list applies.
 *
 * @param tools  the reply's tool log: [{ name, ok, urgency?, category? }]
 */
export function turnTriage({ text = "", tools = [], settings = {} } = {}) {
  const matched = classifyMessage(text);
  let tier = matched.tier === "unclear" ? "none" : matched.tier;
  let category = matched.tier === "unclear" ? null : matched.category;
  let source = tier === "none" ? null : "matcher";
  for (const t of Array.isArray(tools) ? tools : []) {
    if (!t || t.ok === false) continue;
    const m = modelTier(t.urgency);
    if (!m || m === "routine") continue;
    if (higherTier(m, tier) === m && m !== tier) {
      tier = m;
      category = cleanCategory(t.category) || category || "other";
      source = "model";
    } else if (m === tier && !category) {
      category = cleanCategory(t.category);
    }
  }
  const acted = effectiveTier({ tier, category }, settings);
  return {
    tier: acted,
    rawTier: tier,
    category: acted === "none" || acted === "routine" ? category : category || "other",
    leaveFirst: matched.leaveFirst === true,
    source,
    matched,
  };
}

// ── The prompt block ─────────────────────────────────────────────────────────

const CATEGORY_LINE = Object.freeze({
  water: "water actively leaking, or a burst pipe",
  heat: "no heat in freezing weather (or with a baby, an elderly or unwell person at home)",
  roof: "a roof leaking during a storm or heavy rain",
  sewage: "sewage backing up",
  electrical: "an outlet, switch or panel that is hot, buzzing or sparking (no smoke)",
});

/**
 * What THIS company counts as urgent and what the assistant does about it.
 * Same words for every reply of a company (it rides in the cached prefix),
 * placed after CRISIS_RULE so it can only narrow what that rule leaves open.
 *
 * @param settings   companySettings.js's merged settings
 * @param canStep    may this role give safe first steps at all (the
 *                   troubleshooter and the receptionist)
 */
export function triageBlock(settings = {}, { canStep = false } = {}) {
  const enabled = (Array.isArray(settings.urgentCategories) ? settings.urgentCategories : URGENT_CATEGORIES).filter((c) => CATEGORY_LINE[c]);
  const off = URGENT_CATEGORIES.filter((c) => !enabled.includes(c));
  const steps = canStep && settings.safeStepsEnabled !== false;
  return [
    "URGENT PROBLEMS — HOW THIS BUSINESS HANDLES THEM",
    enabled.length
      ? `Urgent for this business: ${enabled.map((c) => CATEGORY_LINE[c]).join("; ")}.`
      : "This business has switched every urgent situation off: treat them as ordinary callbacks.",
    off.length
      ? `Not urgent for this business (book an ordinary callback, urgency "routine" — never 911 for these): ${off.map((c) => CATEGORY_LINE[c]).join("; ")}.`
      : null,
    settings.triageProbeFirst === false
      ? "Decide from what they have said; do not hold the answer back to ask more."
      : "Before you treat something as urgent, make sure: ask one or two of the short questions in the emergency rule above first. A drip, a slow drain or a noise with no smell is not urgent.",
    `When it IS urgent: ${steps ? "give at most one or two of the SAFE FIRST STEPS below that fit, worded as given, then " : ""}call hand_off_to_human with urgency "urgent" and the category (water, heat, roof, sewage or electrical). The team is alerted for you, and a line with the company's own phone number is added to your reply for you — never write a phone number yourself, and never promise when someone will call.`,
    'For an emergency in the rule above (gas or CO, fire, someone hurt, water on the electrics): after the leave-first or 911 line, call hand_off_to_human with urgency "emergency" and the category (gas_co, fire, injury or water_electrics) so the company knows.',
  ]
    .filter(Boolean)
    .join("\n");
}

// ── What the responder adds to a reply ───────────────────────────────────────
//
// Fixed, translated lines — never left to the model, for the reason
// roles.js gives about the disclosure line: a rule the model applies is a
// rule it applies most of the time. Nine languages, the same nine the
// disclosure and the close-the-loop line carry.

const LEAVE_FIRST = Object.freeze({
  en: "If you smell gas or a CO alarm is going off: get everyone out of the house now, don't touch light switches, appliances or the phone inside, and call your gas company's emergency line or 911 once you're outside.",
  fr: "Si ça sent le gaz ou qu'une alarme de monoxyde de carbone sonne : faites sortir tout le monde de la maison maintenant, ne touchez ni aux interrupteurs, ni aux appareils, ni au téléphone à l'intérieur, et appelez la ligne d'urgence de votre fournisseur de gaz ou le 911 une fois dehors.",
  es: "Si huele a gas o suena una alarma de monóxido de carbono: saque a todos de la casa ahora, no toque interruptores, aparatos ni el teléfono adentro, y llame a la línea de emergencias de su compañía de gas o al 911 una vez afuera.",
  uk: "Якщо пахне газом або спрацювала сигналізація чадного газу: негайно виведіть усіх із дому, не торкайтеся вимикачів, приладів і телефону всередині, а вже надворі зателефонуйте на аварійну лінію газової компанії або 911.",
  pa: "ਜੇ ਗੈਸ ਦੀ ਬੂ ਆ ਰਹੀ ਹੈ ਜਾਂ CO ਅਲਾਰਮ ਵੱਜ ਰਿਹਾ ਹੈ: ਹੁਣੇ ਸਾਰਿਆਂ ਨੂੰ ਘਰੋਂ ਬਾਹਰ ਕੱਢੋ, ਅੰਦਰ ਲਾਈਟ ਸਵਿੱਚ, ਉਪਕਰਣ ਜਾਂ ਫ਼ੋਨ ਨੂੰ ਹੱਥ ਨਾ ਲਾਓ, ਅਤੇ ਬਾਹਰ ਪਹੁੰਚ ਕੇ ਆਪਣੀ ਗੈਸ ਕੰਪਨੀ ਦੀ ਐਮਰਜੈਂਸੀ ਲਾਈਨ ਜਾਂ 911 ਨੂੰ ਕਾਲ ਕਰੋ।",
  tl: "Kung may amoy ng gas o tumutunog ang CO alarm: ilabas agad ang lahat sa bahay, huwag galawin ang mga switch ng ilaw, appliance o telepono sa loob, at tawagan ang emergency line ng inyong gas company o 911 kapag nasa labas na kayo.",
  de: "Wenn es nach Gas riecht oder ein CO-Melder Alarm gibt: Bringen Sie sofort alle aus dem Haus, berühren Sie drinnen keine Lichtschalter, Geräte oder das Telefon, und rufen Sie draußen den Notdienst Ihres Gasversorgers oder 911 an.",
  zh: "如果闻到煤气味或一氧化碳报警器在响：请立即让所有人离开房屋，不要在室内触碰电灯开关、电器或电话，到室外后再拨打燃气公司的紧急热线或 911。",
  it: "Se sentite odore di gas o suona un allarme di monossido di carbonio: fate uscire subito tutti di casa, non toccate interruttori, elettrodomestici o il telefono all'interno, e una volta fuori chiamate il numero di emergenza della vostra compagnia del gas o il 911.",
});

const ALERTED_SMS = Object.freeze({
  en: "I've alerted {company}'s on-call team.",
  fr: "J'ai alerté l'équipe de garde de {company}.",
  es: "Avisé al equipo de guardia de {company}.",
  uk: "Я повідомив чергову команду {company}.",
  pa: "ਮੈਂ {company} ਦੀ ਆਨ-ਕਾਲ ਟੀਮ ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਹੈ।",
  tl: "Naabisuhan ko na ang on-call team ng {company}.",
  de: "Ich habe das Bereitschaftsteam von {company} benachrichtigt.",
  zh: "我已通知 {company} 的值班团队。",
  it: "Ho avvisato il team di reperibilità di {company}.",
});

const ALERTED_BELL = Object.freeze({
  en: "I've flagged this as urgent for the {company} team.",
  fr: "J'ai signalé ceci comme urgent à l'équipe de {company}.",
  es: "Marqué esto como urgente para el equipo de {company}.",
  uk: "Я позначив це як термінове для команди {company}.",
  pa: "ਮੈਂ ਇਸਨੂੰ {company} ਟੀਮ ਲਈ ਜ਼ਰੂਰੀ ਵਜੋਂ ਚਿੰਨ੍ਹਿਤ ਕਰ ਦਿੱਤਾ ਹੈ।",
  tl: "Minarkahan ko ito bilang urgent para sa team ng {company}.",
  de: "Ich habe das für das Team von {company} als dringend markiert.",
  zh: "我已将此事标记为紧急并通知 {company} 团队。",
  it: "Ho segnalato la cosa come urgente al team di {company}.",
});

const CALL_NOW = Object.freeze({
  en: "If you need someone right now, call {company} at {phone}.",
  fr: "Si vous avez besoin de quelqu'un tout de suite, appelez {company} au {phone}.",
  es: "Si necesita a alguien ahora mismo, llame a {company} al {phone}.",
  uk: "Якщо вам потрібна допомога просто зараз, зателефонуйте {company}: {phone}.",
  pa: "ਜੇ ਤੁਹਾਨੂੰ ਹੁਣੇ ਕਿਸੇ ਦੀ ਲੋੜ ਹੈ, ਤਾਂ {company} ਨੂੰ {phone} 'ਤੇ ਕਾਲ ਕਰੋ।",
  tl: "Kung kailangan ninyo ng tao ngayon din, tawagan ang {company} sa {phone}.",
  de: "Wenn Sie sofort jemanden brauchen, rufen Sie {company} unter {phone} an.",
  zh: "如果您现在就需要有人帮忙，请拨打 {company} 的电话 {phone}。",
  it: "Se avete bisogno di qualcuno subito, chiamate {company} al {phone}.",
});

export const TRIAGE_LINE_LANGUAGES = Object.freeze(Object.keys(LEAVE_FIRST));

const fill = (line, vars) => Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), line);

/** The leave-the-house line, in the client's language. */
export function leaveFirstLine(language = "en") {
  return LEAVE_FIRST[language] || LEAVE_FIRST.en;
}

/**
 * The line an urgent reply ends with — built from what ACTUALLY happened,
 * never from what the model said happened.
 *
 * @param alerted  "sms" when a person was texted, "bell" when the team was
 *                 only flagged in the app, null when nothing was raised
 * @param phone    the company's own number, or null — omitted, never invented
 */
export function urgentLine({ alerted = null, phone = null, company = "", language = "en" } = {}) {
  const name = String(company || "").trim() || "the team";
  const parts = [];
  if (alerted === "sms") parts.push(fill(ALERTED_SMS[language] || ALERTED_SMS.en, { company: name }));
  else if (alerted === "bell") parts.push(fill(ALERTED_BELL[language] || ALERTED_BELL.en, { company: name }));
  const tel = String(phone || "").trim();
  if (tel) parts.push(fill(CALL_NOW[language] || CALL_NOW.en, { company: name, phone: tel }));
  return parts.join(" ");
}

/** Add the urgent line to a reply, once. */
export function withUrgentLine(text, line) {
  const body = String(text || "").trim();
  const add = String(line || "").trim();
  if (!add || body.includes(add)) return body;
  return body ? `${body}\n\n${add}` : add;
}

/** Put the leave-first line in front of a reply, once. */
export function withLeaveFirst(text, language = "en") {
  const body = String(text || "").trim();
  const line = leaveFirstLine(language);
  if (body.includes(line)) return body;
  return body ? `${line}\n\n${body}` : line;
}
