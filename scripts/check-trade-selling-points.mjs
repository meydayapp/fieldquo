// scripts/check-trade-selling-points.mjs
//
//   npm run check:trade-selling-points
//
// The one list of what FieldQuo sells to each trade, and the five surfaces
// that read it (lib/sales/tradeSellingPoints.js).
//
// ══ What is EXECUTED ═════════════════════════════════════════════════════
//
// The list is executed against the feature matrix: every key is a row, and
// every row is `shipped` — a `partial` row (financing, the three-price
// options) is refused, because a selling point naming a half-built feature
// is AGENTS.md's dead control in words. Every trade in DISCOVERY_TRADES has
// a list of at least three; every sentence exists in EN, FR and ES; nothing
// carries a digit, a weekday, a banned move from the playbook's table, or a
// promise to build something for them.
//
// Then the surfaces, with real functions: the call script prompt is
// assembled for a roofer and asserted to carry the roofer's first point; the
// intro email is built for an electrician in three languages and asserted
// to carry theirs; the rules playbook is rendered for an electrician and its
// fit stage asserted to name the three. The demo presets and the marketing
// industry list are checked to point at trades that have a list.
//
// ══ What is pinned by hand ═══════════════════════════════════════════════
//
// The owner's own words, 2026-09-19: electricians and plumbers lead with
// self-booking, the paid booking and scheduling; roofers with the satellite
// measure; painters with the room take-off and the add-ons the client ticks.
// Those four orderings are asserted as exact keys, so a re-ranking is a
// deliberate edit of this file and not a drift.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

delete process.env.OPENAI_API_KEY;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (h) => console.log(`\n${h}\n`);

const {
  POINTS,
  TRADE_PITCH_KEYS,
  TRADE_PITCH_LANGUAGES,
  TRADE_PITCH_TOP,
  TRADE_SELLING_POINTS,
  normalizeTradePitchLanguage,
  tradePitchClause,
  tradePitchLabel,
  tradeSellingPoints,
} = await import("@/lib/sales/tradeSellingPoints");
const { FEATURE_MATRIX, matrixEntry } = await import("@/lib/marketing/featureMatrix");
const { DISCOVERY_TRADES } = await import("@/lib/sales/discovery/trades");
const { BANNED_MOVES } = await import("@/lib/sales/playbook/bannedMoves");
const { PLAYBOOK_VARS, TRADE_PITCH_LINE, seedPlaybooks } = await import("@/lib/sales/playbook/defaults");
const PLAYBOOKS = seedPlaybooks();
const { buildCallScript, playbookVars } = await import("@/lib/sales/playbook/script");
const { callScriptInputs, callScriptPrompt } = await import("@/lib/sales/intel/callScript");
const { buildIntroEmail, INTRO_COPY, INTRO_EMAIL_LANGUAGES } = await import("@/lib/sales/outreach/introEmail");
const { INDUSTRIES: DEMO_INDUSTRIES } = await import("@/lib/demo/industries");
const { INDUSTRIES: MARKETING_INDUSTRIES } = await import("@/app/data/industries");
const { INDUSTRY_MESSAGES } = await import("@/app/i18n/industries");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every trade has a list, every key is a shipped matrix row");
// ═══════════════════════════════════════════════════════════════════════════

const tradeKeys = Object.keys(DISCOVERY_TRADES);
ok(`there are trades to cover (${tradeKeys.length})`, tradeKeys.length >= 30);
ok("every discovery trade has a list", tradeKeys.every((k) => Object.hasOwn(TRADE_SELLING_POINTS, k)), tradeKeys.filter((k) => !TRADE_SELLING_POINTS[k]));
ok("no list names a trade that is not a discovery trade", TRADE_PITCH_KEYS.every((k) => Object.hasOwn(DISCOVERY_TRADES, k)), TRADE_PITCH_KEYS.filter((k) => !DISCOVERY_TRADES[k]));

const shipped = new Set(FEATURE_MATRIX.filter((e) => e.readiness === "shipped").map((e) => e.key));
const partial = FEATURE_MATRIX.filter((e) => e.readiness !== "shipped").map((e) => e.key);
ok(`the matrix has partial rows to refuse (${partial.length})`, partial.length > 0, partial);

const keyOf = (entry) => (typeof entry === "string" ? entry : entry.key);
for (const trade of tradeKeys) {
  const list = TRADE_SELLING_POINTS[trade] || [];
  const keys = list.map(keyOf);
  ok(`${trade}: at least ${TRADE_PITCH_TOP} points`, keys.length >= TRADE_PITCH_TOP, keys.length);
  ok(`${trade}: every key is a matrix row`, keys.every((k) => matrixEntry(k)), keys.filter((k) => !matrixEntry(k)));
  ok(`${trade}: every key is shipped, none partial`, keys.every((k) => shipped.has(k)), keys.filter((k) => !shipped.has(k)));
  ok(`${trade}: no key twice`, new Set(keys).size === keys.length, keys);
  ok(`${trade}: every key has words in the library`, keys.every((k) => POINTS[k]), keys.filter((k) => !POINTS[k]));
}
ok("every library entry is itself a shipped row", Object.keys(POINTS).every((k) => shipped.has(k)), Object.keys(POINTS).filter((k) => !shipped.has(k)));
ok("every library entry is used by at least one trade", Object.keys(POINTS).every((k) => tradeKeys.some((t) => TRADE_SELLING_POINTS[t].map(keyOf).includes(k))), Object.keys(POINTS).filter((k) => !tradeKeys.some((t) => TRADE_SELLING_POINTS[t].map(keyOf).includes(k))));
ok("financing is partial in the matrix and therefore on nobody's list", partial.includes("financing") && !tradeKeys.some((t) => TRADE_SELLING_POINTS[t].map(keyOf).includes("financing")));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Three languages, no digit, no banned move, no promise to build");
// ═══════════════════════════════════════════════════════════════════════════

ok("the languages are the three a rep sells in", JSON.stringify(TRADE_PITCH_LANGUAGES) === JSON.stringify(["en", "fr", "es"]));

const WEEKDAY = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i;
// The same shape scripts/check-playbook-voice.mjs holds every rule line to.
const TECH_SUPPORT = /\b(?:we(?:'ll| will) (?:put|build|install|set (?:it |that |one |them )?up)|i(?:'ll| will) (?:put|build|install|set (?:it |that |one |them )?up))\b/i;
const BUZZ = /\b(?:all-in-one|platform|solution|seamless|game-?changer|single source of truth|leverage)\b/i;

const sentences = []; // { where, lang, text }
for (const [key, words] of Object.entries(POINTS)) {
  for (const field of ["headline", "oneLiner", "proof"]) {
    for (const lang of TRADE_PITCH_LANGUAGES) sentences.push({ where: `${key}.${field}`, lang, text: words[field]?.[lang] });
  }
}
for (const trade of tradeKeys) {
  for (const entry of TRADE_SELLING_POINTS[trade]) {
    if (typeof entry === "string") continue;
    for (const lang of TRADE_PITCH_LANGUAGES) sentences.push({ where: `${trade}/${entry.key}.proof`, lang, text: entry.proof?.[lang] });
  }
}
ok(`the sweep read something (${sentences.length} sentences)`, sentences.length > 300, sentences.length);
ok("every sentence exists in every language", sentences.every((s) => typeof s.text === "string" && s.text.trim().length > 0), sentences.filter((s) => !s.text).map((s) => `${s.where}/${s.lang}`));
ok("no digit anywhere", sentences.every((s) => !/\d/.test(s.text || "")), sentences.filter((s) => /\d/.test(s.text || "")).map((s) => `${s.where}/${s.lang}`));
ok("no weekday name anywhere — the close may not carry one, and the model copies what it is fed", sentences.every((s) => !WEEKDAY.test(s.text || "")), sentences.filter((s) => WEEKDAY.test(s.text || "")).map((s) => `${s.where}/${s.lang}`));
ok("no promise to build, install or set anything up for them", sentences.every((s) => !TECH_SUPPORT.test(s.text || "")), sentences.filter((s) => TECH_SUPPORT.test(s.text || "")).map((s) => `${s.where}/${s.lang}: ${s.text}`));
ok("no buzzword", sentences.every((s) => !BUZZ.test(s.text || "")), sentences.filter((s) => BUZZ.test(s.text || "")).map((s) => `${s.where}/${s.lang}`));
for (const b of BANNED_MOVES) {
  const hits = sentences.filter((s) => s.lang === "en" && b.pattern.test(s.text || ""));
  ok(`no English sentence makes the "${b.move}" move`, hits.length === 0, hits.map((h) => `${h.where}: ${h.text}`));
}
ok("no headline longer than sixty characters", sentences.filter((s) => s.where.endsWith(".headline")).every((s) => s.text.length <= 60), sentences.filter((s) => s.where.endsWith(".headline") && s.text.length > 60).map((s) => `${s.where}/${s.lang}`));
ok("no proof longer than a rep says in one breath", sentences.filter((s) => s.where.endsWith(".proof")).every((s) => s.text.length <= 280), sentences.filter((s) => s.where.endsWith(".proof") && s.text.length > 280).map((s) => `${s.where}/${s.lang}`));
ok("French and Spanish are not the English", sentences.filter((s) => s.lang !== "en").every((s) => s.text !== POINTS[s.where.split(".")[0].split("/").pop()]?.[s.where.split(".")[1]]?.en), sentences.filter((s) => s.lang !== "en" && s.text === POINTS[s.where.split(".")[0].split("/").pop()]?.[s.where.split(".")[1]]?.en).map((s) => `${s.where}/${s.lang}`));
// A Unicode boundary, not \b: "êtes" is "ê" + the word "tes" to an ASCII \b.
const TU = /(?<![\p{L}'’])(tu|ton|ta|tes)(?![\p{L}])/iu;
ok("French says vous, never tu", sentences.filter((s) => s.lang === "fr").every((s) => !TU.test(s.text)), sentences.filter((s) => s.lang === "fr" && TU.test(s.text)).map((s) => s.where));
ok("French says soumission, not devis", sentences.filter((s) => s.lang === "fr").every((s) => !/\bdevis\b/i.test(s.text)));
ok("Spanish never says vosotros", sentences.filter((s) => s.lang === "es").every((s) => !/vosotros|vuestr/i.test(s.text)));

// ═══════════════════════════════════════════════════════════════════════════
section("3. The function: order kept, unknown trade empty, fallback named");
// ═══════════════════════════════════════════════════════════════════════════

{
  const en = tradeSellingPoints("roofing", "en");
  ok("a trade's list comes back in order, whole", en.points.map((p) => p.key).join() === TRADE_SELLING_POINTS.roofing.map(keyOf).join());
  ok("…with the four fields on every point", en.points.every((p) => p.key && p.headline && p.oneLiner && p.proof));
  ok("limit cuts it", tradeSellingPoints("roofing", "en", { limit: 2 }).points.length === 2);
  const fr = tradeSellingPoints("roofing", "fr", { limit: 1 });
  ok("French is French, and not a fallback", fr.language === "fr" && fr.fallback === false && /satellite/.test(fr.points[0].proof) && /échelle/.test(fr.points[0].proof), fr.points[0]);
  ok("the roofer's proof is the trade's own, not the library's", fr.points[0].proof !== POINTS.aerial_measure.proof.fr);
  const de = tradeSellingPoints("roofing", "de", { limit: 1 });
  ok("German falls back to English and says so", de.language === "en" && de.fallback === true && de.points[0].headline === POINTS.aerial_measure.headline.en);
  ok("es-MX normalises to es", normalizeTradePitchLanguage("es-MX") === "es" && normalizeTradePitchLanguage("EN") === "en" && normalizeTradePitchLanguage("uk") === null);
  ok("an unknown trade is an empty list, never a guess", tradeSellingPoints("locksmithing", "en").points.length === 0 && tradeSellingPoints(null, "en").points.length === 0 && tradeSellingPoints("__proto__", "en").points.length === 0 && tradeSellingPoints("constructor", "fr").points.length === 0);
  ok("the label comes from the discovery table", tradePitchLabel("roofing") === DISCOVERY_TRADES.roofing.label && tradePitchLabel("nope") === null);
  ok("the clause is the top three headlines, lower-cased, joined for speech", tradePitchClause("electrical") === "clients book you online, a paid visit at booking and dispatch from one calendar", tradePitchClause("electrical"));
  ok("…in French with et", /\bet\b/.test(tradePitchClause("electrical", "fr")) && !/\band\b/.test(tradePitchClause("electrical", "fr")));
  ok("…and null for no trade, so renderLine refuses the line", tradePitchClause(null) === null && tradePitchClause("nope") === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The owner's orderings, pinned");
// ═══════════════════════════════════════════════════════════════════════════

const top = (t) => tradeSellingPoints(t, "en", { limit: TRADE_PITCH_TOP }).points.map((p) => p.key);
ok("electricians: self-booking, the paid booking, scheduling", JSON.stringify(top("electrical")) === JSON.stringify(["booking_page", "booking_deposit", "scheduling"]), top("electrical"));
ok("plumbers: the same three", JSON.stringify(top("plumbing")) === JSON.stringify(["booking_page", "booking_deposit", "scheduling"]), top("plumbing"));
ok("roofers lead with the satellite measure, then the instant price", top("roofing")[0] === "aerial_measure" && top("roofing")[1] === "instant_quotes", top("roofing"));
ok("painters lead with the room take-off and the add-ons the client ticks", top("painting")[0] === "quotes" && top("painting").includes("add_on_upsell"), top("painting"));
ok("cabinet makers lead with the designer and the per-door price", top("cabinets")[0] === "kitchen_designer" && top("cabinets")[1] === "price_book", top("cabinets"));
ok("lawn and snow lead with repeat work and plans", top("landscaping").slice(0, 2).join() === "recurring_jobs,service_plans" && top("snow_removal").slice(0, 2).join() === "recurring_jobs,service_plans");
ok("HVAC leads with the maintenance plan", top("hvac")[0] === "service_plans");
ok("builders lead with job costing", top("remodeling")[0] === "job_costing" && top("general_contracting")[0] === "job_costing");
ok("the roofer's satellite proof says no ladder and under a minute, spelled", /no ladder/.test(tradeSellingPoints("roofing", "en").points[0].proof) && /under a minute/.test(tradeSellingPoints("roofing", "en").points[0].proof));

// ═══════════════════════════════════════════════════════════════════════════
section("5. The playbook: every fit stage names the trade's three, at render");
// ═══════════════════════════════════════════════════════════════════════════

ok("tradePitch is a playbook variable", PLAYBOOK_VARS.includes("tradePitch"));
ok("the fit line is one string, in all four playbooks", PLAYBOOKS.length === 4 && PLAYBOOKS.every((p) => p.stages.find((s) => s.stageKey === "fit").prompts.includes(TRADE_PITCH_LINE)));
ok("…and it names the variable", /\{tradePitch\}/.test(TRADE_PITCH_LINE));
ok("the seeds still validate with it", seedPlaybooks().length === 4);
{
  const vars = playbookVars({ prospect: { businessName: "Bright Line Electric", tradeKey: "electrical" }, index: {}, rep: { name: "Daniel" } });
  ok("playbookVars resolves it from the prospect's trade", vars.tradePitch === tradePitchClause("electrical"), vars.tradePitch);
  ok("…and to null with no trade", playbookVars({ prospect: { businessName: "X" } }).tradePitch === null);
  for (const p of PLAYBOOKS) {
    const script = buildCallScript({ playbook: p, prospect: { businessName: "Bright Line Electric", city: "Ottawa", tradeKey: "electrical" }, index: { competitors: [{ technologyCode: "jobber" }] }, rep: { name: "Daniel" }, points: [], objections: [] });
    const fit = script.stages.find((s) => s.stageKey === "fit");
    const line = fit?.prompts.find((q) => q.template === TRADE_PITCH_LINE);
    ok(`${p.key}: the rendered fit stage says the electrician's three`, Boolean(line?.text) && line.text.includes("clients book you online") && line.text.includes("dispatch from one calendar"), line?.text);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The call script prompt: the roofer's first point is in it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const withTrade = callScriptInputs({ prospect: { tradeKey: "roofing", city: "Ottawa" }, language: "en" });
  ok("the inputs carry the trade's three", Array.isArray(withTrade.tradePoints) && withTrade.tradePoints.length === TRADE_PITCH_TOP, withTrade.tradePoints);
  const prompt = callScriptPrompt(withTrade);
  const first = tradeSellingPoints("roofing", "en", { limit: 1 }).points[0];
  ok("the prompt has the section", /\nWHAT WE DO FOR THEIR TRADE \(/.test(prompt));
  ok("…with the roofer's first headline and its proof", prompt.includes(first.headline) && prompt.includes(first.proof));
  ok("…and tells the model to lead the pitch with it", /FIRST thing named is the first line under WHAT WE DO FOR THEIR TRADE/.test(prompt));
  ok("the prompt carries no digit from these lines", !/\d/.test(withTrade.tradePoints.join(" ")));
  const fr = callScriptInputs({ prospect: { tradeKey: "roofing" }, language: "fr" });
  ok("a French script gets the French three", fr.tradePoints[0].includes(tradeSellingPoints("roofing", "fr", { limit: 1 }).points[0].headline));
  const none = callScriptInputs({ prospect: { tradeKey: null }, language: "en" });
  ok("no trade → no section, not an empty one", none.tradePoints.length === 0 && !/\nWHAT WE DO FOR THEIR TRADE \(/.test(callScriptPrompt(none)));
  ok("the trade points are inside the hashed inputs", Object.keys(withTrade).includes("tradePoints"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The intro email: the electrician's first point, three languages");
// ═══════════════════════════════════════════════════════════════════════════

{
  const REP = { name: "Emilio Boves", email: "emilio@fieldquo.com", phone: "+1 613 555 0100" };
  const LINKS = {
    signupLink: "https://app.fieldquo.com/signup?sales=EB1&link=abc",
    callbackUrl: "https://app.fieldquo.com/i/CALLBACKTOKEN",
    demoUrl: "https://app.fieldquo.com/i/DEMOTOKEN",
    unsubscribeUrl: "https://app.fieldquo.com/i/UNSUBTOKEN",
    screenshotUrl: "https://app.fieldquo.com/product/email/quote-phone.en.png",
    mailingAddress: "100 Rue Principale, Gatineau QC J8X 1A1",
    replyToken: "fqs0123456789abcdef0123456789abcdef",
  };
  ok("the copy has the trade intro in every language", INTRO_EMAIL_LANGUAGES.every((l) => typeof INTRO_COPY[l].tradePointsIntro === "string" && INTRO_COPY[l].tradePointsIntro.includes("{trade}")));
  for (const language of INTRO_EMAIL_LANGUAGES) {
    const email = buildIntroEmail({ language, rep: REP, business: "Bright Line Electric", contactName: "Dave Martin", tradeKey: "electrical", ...LINKS });
    const first = tradeSellingPoints("electrical", language, { limit: 1 }).points[0];
    ok(`${language}: the text part carries the electrician's first point`, email.text.includes(`1. ${first.headline} — ${first.oneLiner}`), first.headline);
    ok(`${language}: the html carries it too`, email.html.includes(first.headline.replace(/&/g, "&amp;")));
    ok(`${language}: the trade intro is filled and sits between the gap and the eight`, !email.text.includes("{trade}") && email.text.indexOf(INTRO_COPY[language].gap) < email.text.indexOf(`1. ${first.headline}`) && email.text.indexOf(`1. ${first.headline}`) < email.text.indexOf(INTRO_COPY[language].pointsIntro));
    ok(`${language}: still exactly eight dashed points`, (email.text.match(/\n- /g) || []).length === 8);
  }
  const none = buildIntroEmail({ language: "en", rep: REP, business: "Acme", tradeKey: null, ...LINKS });
  ok("no trade → no trade paragraph, the eight stand alone", !none.text.includes("the three that matter most") && !/\n1\. /.test(none.text));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The demo presets and the marketing pages point at real lists");
// ═══════════════════════════════════════════════════════════════════════════

ok("every demo industry names a trade with a list", Object.entries(DEMO_INDUSTRIES).every(([, v]) => typeof v.pitchTrade === "string" && tradeSellingPoints(v.pitchTrade, "en").points.length >= TRADE_PITCH_TOP), Object.entries(DEMO_INDUSTRIES).filter(([, v]) => !v.pitchTrade || !TRADE_SELLING_POINTS[v.pitchTrade]).map(([k]) => k));
ok("every marketing industry names a trade with a list", MARKETING_INDUSTRIES.every((i) => typeof i.tradeKey === "string" && tradeSellingPoints(i.tradeKey, "en").points.length >= TRADE_PITCH_TOP), MARKETING_INDUSTRIES.filter((i) => !i.tradeKey || !TRADE_SELLING_POINTS[i.tradeKey]).map((i) => i.slug));
ok("the industry chrome has the built-for heading in every language", Object.entries(INDUSTRY_MESSAGES).every(([, d]) => ["builtFor", "builtForNote", "builtForFallback"].every((k) => typeof d.chrome?.[k] === "string" && d.chrome[k])), Object.entries(INDUSTRY_MESSAGES).filter(([, d]) => !d.chrome?.builtFor).map(([l]) => l));
ok("…and the heading names the trade", Object.values(INDUSTRY_MESSAGES).every((d) => d.chrome.builtFor.includes("{trade}")));
ok("the rep's screens have the heading and the note in every portal language", Object.entries(APP_MESSAGES).every(([, m]) => ["app.salesCall.tradePoints", "app.salesCall.tradePointsNote", "app.salesCall.tradePointsFallback", "app.salesCal.demoHighlights", "app.salesCal.demoHighlightsNote"].every((k) => typeof m[k] === "string" && m[k])), Object.entries(APP_MESSAGES).filter(([, m]) => !m["app.salesCall.tradePoints"]).map(([l]) => l));

// ═══════════════════════════════════════════════════════════════════════════
section("9. The surfaces actually read the list (source)");
// ═══════════════════════════════════════════════════════════════════════════

{
  const playbook = read("app/components/sales/CallPlaybook.js");
  ok("CallPlaybook draws TradePoints under the AI script, in the console layout, and with no script", (playbook.match(/<TradePoints /g) || []).length === 3 && /import TradePoints from "@\/app\/components\/sales\/TradePoints"/.test(playbook));
  ok("…in the SCRIPT's language, from the prospect's trade", /<TradePoints tradeKey=\{tradeKey\} language=\{script\.language \|\| "en"\}/.test(playbook) && /tradeKey=\{data\.prospect\?\.tradeKey \|\| null\}/.test(playbook));
  const comp = read("app/components/sales/TradePoints.js");
  ok("the component reads the one list and prints the proof", /tradeSellingPoints\(tradeKey, language, \{ limit: TRADE_PITCH_TOP \}\)/.test(comp) && /\{p\.proof\}/.test(comp));
  ok("…and says it is not evidence", /tradePointsNote/.test(comp));
  ok("…and draws nothing for no trade", /if \(points\.length === 0\) return null;/.test(comp));
  const queue = read("app/sales/queue/page.js");
  ok("the queue's pitch layer draws it under the evidence-cited recommendations", /<TradePoints tradeKey=\{current\.tradeKey \|\| null\} language=\{language\} \/>/.test(queue));
  const email = read("lib/sales/outreach/introEmail.js");
  // `partLang`, not `lang`: the intro email renders a French part and an
  // English part for Quebec, and each part reads the list in its own language.
  ok("the intro email reads the one list", /tradeSellingPoints\(tradeKey, partLang, \{ limit: TRADE_PITCH_TOP \}\)/.test(email));
  const script = read("lib/sales/intel/callScript.js");
  ok("the call-script inputs read the one list", /tradeSellingPoints\(prospect\?\.tradeKey \|\| null, scriptLang, \{ limit: TRADE_PITCH_TOP \}\)/.test(script));
  const demo = read("app/sales/demo/page.js");
  ok("the demo card reads the one list", /tradeSellingPoints\(pitchTrade, language, \{ limit: TRADE_PITCH_TOP \}\)/.test(demo) && /<DemoHighlights pitchTrade=\{company\.pitchTrade\}/.test(demo));
  const repDemo = read("lib/sales/repDemo.js");
  ok("…and the API hands it the trade", /pitchTrade: INDUSTRIES\[d\.demoIndustry\]\?\.pitchTrade \|\| null/.test(repDemo));
  const page = read("app/(marketing)/industries/[slug]/IndustryPageContent.js");
  ok("the marketing industry page reads the one list into its built-for section", /tradeSellingPoints\(tradeKey, language, \{ limit: TRADE_PITCH_TOP \}\)/.test(page) && /chrome\.builtFor/.test(page) && /data-built-for=\{tradeKey\}/.test(page));
  ok("…and names the fallback when the visitor's language has none", /pitch\.fallback && \(/.test(page) && /chrome\.builtForFallback/.test(page));
  const pkg = JSON.parse(read("package.json"));
  ok("check:all runs this file", /check:trade-selling-points/.test(pkg.scripts["check:all"]) && Boolean(pkg.scripts["check:trade-selling-points"]));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${failures.length ? `${failures.length} FAILED of ${pass + failures.length}` : `ALL PASS — ${pass} checks`}`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
