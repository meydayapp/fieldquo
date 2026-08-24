// The instant-estimate funnel step, from hostile input to a total.
//
// The step is the one funnel kind that touches money, so the two things worth
// proving are that nothing untrusted survives sanitiseFunnelSteps (no posted
// price, no prototype key, no 1e400 reaching a multiplication) and that no rate
// or measurement crosses to a browser. Both are asserted against the SHIPPED
// code — the sanitiser, the real pricer, and the real serve/submit helpers with
// only the company's saved rows stubbed in.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-funnel-estimate.mjs
import {
  sanitiseFunnelSteps,
  estimateStepIssues,
  resolveEstimateBand,
  bandIntake,
  bandFieldsFor,
  choiceFieldsFor,
  FUNNEL_ESTIMATE_TRADES,
} from "@/app/data/funnelBlocks";
import { publicFunnelEstimate } from "@/app/api/funnels/public/funnelEstimate";
import { measureForTrade } from "@/lib/estimate/instantQuoteServer";
import { priceOptionsFor } from "@/lib/estimate/instantQuoteReadiness";
import { INSTANT_ESTIMATE_DEFAULTS } from "@/lib/estimate/instantEstimate";

let pass = 0, fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

const deep = (o) => JSON.stringify(o);

console.log("\n── the kind survives the boundary ──");
{
  const [s] = sanitiseFunnelSteps([
    { id: "e1", kind: "instant_estimate", trade: "painting", order: "details_first",
      headline: "Your price", sizeQuestion: "How big?",
      bands: [{ id: "b1", label: "One room", values: { squareFootage: 400 } }] },
  ]);
  ok("kind kept", s.kind === "instant_estimate", s.kind);
  ok("trade kept", s.trade === "painting", s.trade);
  ok("order kept", s.order === "details_first", s.order);
  ok("band value kept", s.bands[0].values.squareFootage === 400, s.bands[0]);
}

console.log("\n── ordering defaults to price-first ──");
for (const bad of [undefined, "", "PRICE_FIRST", "whatever", 7, { }, ["details_first"]]) {
  const [s] = sanitiseFunnelSteps([{ kind: "instant_estimate", trade: "painting", order: bad }]);
  ok(`order ${deep(bad)} → price_first`, s.order === "price_first", s.order);
}
{
  const [s] = sanitiseFunnelSteps([{ kind: "instant_estimate", trade: "painting", order: "details_first" }]);
  ok("an explicit details_first is honoured", s.order === "details_first", s.order);
}

console.log("\n── a posted price never survives ──");
{
  const [s] = sanitiseFunnelSteps([
    { id: "e", kind: "instant_estimate", trade: "painting",
      low: 1, high: 2, point: 3, price: 99, total: 12345, currency: "USD",
      ratePerSqft: 0.01, minCharge: 0, estimateVisibility: "range",
      bands: [{ id: "b", label: "x", values: { squareFootage: 100 }, low: 5, high: 6, price: 7, ratePerSqft: 0.5 }] },
  ]);
  const keys = Object.keys(s);
  const banned = ["low", "high", "point", "price", "total", "currency", "ratePerSqft", "minCharge", "estimateVisibility"];
  ok("no money key on the step", banned.every((k) => !keys.includes(k)), keys);
  ok("no money key on the band", Object.keys(s.bands[0]).join() === "id,label,values", Object.keys(s.bands[0]));
  ok("no money key inside values", deep(s.bands[0].values) === deep({ squareFootage: 100 }), s.bands[0].values);
}

console.log("\n── prototype pollution ──");
{
  const hostile = JSON.parse(`{
    "id": "e", "kind": "instant_estimate", "trade": "painting",
    "__proto__": { "polluted": true },
    "assumptions": { "__proto__": { "polluted": true }, "scope": "exterior" },
    "bands": [{ "id": "b", "label": "x", "values": { "__proto__": { "polluted": true }, "squareFootage": 100 } }]
  }`);
  const [s] = sanitiseFunnelSteps([hostile]);
  ok("Object.prototype clean", ({}).polluted === undefined, ({}).polluted);
  ok("no __proto__ own key on step", !Object.keys(s).includes("__proto__"), Object.keys(s));
  ok("no __proto__ own key in values", !Object.keys(s.bands[0].values).includes("__proto__"), Object.keys(s.bands[0].values));
  ok("no __proto__ own key in assumptions", !Object.keys(s.assumptions || {}).includes("__proto__"), s.assumptions);
  ok("the real assumption survived", s.assumptions?.scope === "exterior", s.assumptions);
}

console.log("\n── numbers that aren't numbers ──");
{
  const nasty = [
    ["1e400", 0], [1e400, 0], [-1e400, 0], [NaN, 0], [Infinity, 0], [-Infinity, 0],
    ["abc", 0], [null, 0], [undefined, 0], [{}, 0], [[], 0], [[5], 5],
    [-50, 0], ["500", 500], [1e12, 1_000_000], [0.005, 0.01], [true, 1],
  ];
  for (const [input, expected] of nasty) {
    const [s] = sanitiseFunnelSteps([
      { kind: "instant_estimate", trade: "painting",
        bands: [{ id: "b", label: "x", values: { squareFootage: input } }] },
    ]);
    const got = s.bands[0].values.squareFootage;
    ok(`squareFootage ${deep(input)} → ${expected}`, got === expected && Number.isFinite(got), got);
  }
}

console.log("\n── unknown trades and unknown fields ──");
{
  for (const t of ["roofing", "lawn_mowing", "junk_removal", "not_a_trade", "", null, 42, "__proto__"]) {
    const [s] = sanitiseFunnelSteps([{ kind: "instant_estimate", trade: t }]);
    ok(`trade ${deep(t)} rejected`, s.trade === "", s.trade);
  }
  ok("painting is offerable", FUNNEL_ESTIMATE_TRADES.includes("painting"));
  ok("roofing is not offerable", !FUNNEL_ESTIMATE_TRADES.includes("roofing"));
  const [s] = sanitiseFunnelSteps([
    { kind: "instant_estimate", trade: "stair",
      bands: [{ id: "b", label: "x", values: { treads: 13, squareFootage: 9999, evil: 1 } }] },
  ]);
  ok("stair keeps treads", s.bands[0].values.treads === 13, s.bands[0].values);
  ok("stair drops another trade's field", !("squareFootage" in s.bands[0].values), s.bands[0].values);
  ok("stair drops an unknown field", !("evil" in s.bands[0].values), s.bands[0].values);
}

console.log("\n── assumptions are checked against the trade's own vocabulary ──");
{
  const mk = (trade, assumptions) => sanitiseFunnelSteps([{ kind: "instant_estimate", trade, assumptions }])[0];
  ok("painting scope=exterior kept", mk("painting", { scope: "exterior" }).assumptions?.scope === "exterior");
  ok("painting scope=nonsense dropped", mk("painting", { scope: "sideways" }).assumptions === undefined);
  ok("painting has no access field", mk("painting", { access: "scaffold" }).assumptions === undefined);
  ok("parging access=scaffold kept", mk("parging", { access: "scaffold" }).assumptions?.access === "scaffold");
  ok("countertop takes no assumptions", choiceFieldsFor("countertop").length === 0);
  ok("scope options come from the defaults",
    deep(choiceFieldsFor("painting").find((c) => c.key === "scope").options) ===
      deep(Object.keys(INSTANT_ESTIMATE_DEFAULTS.painting.scopeSurcharge)));
}

console.log("\n── issues are reported, not silently deleted ──");
{
  const [s] = sanitiseFunnelSteps([
    { kind: "instant_estimate", trade: "",
      bands: [{ id: "a", label: "empty", values: {} }, { id: "b", label: "", values: { squareFootage: 100 } }] },
  ]);
  ok("half-typed bands are kept for editing", s.bands.length === 2, s.bands);
  const codes = estimateStepIssues(s).map((i) => i.code);
  ok("no_trade reported", codes.includes("no_trade"), codes);
  ok("empty_band reported", codes.includes("empty_band"), codes);
  ok("unlabelled_band reported", codes.includes("unlabelled_band"), codes);
  ok("an empty band can't be resolved", resolveEstimateBand(s, "a") === null);
  ok("a real band can", resolveEstimateBand(s, "b")?.id === "b");
  ok("an invented band id can't", resolveEstimateBand(s, "nope") === null);
  ok("a non-estimate step resolves nothing",
    resolveEstimateBand({ kind: "form", bands: [{ id: "b", values: { squareFootage: 1 } }] }, "b") === null);

  const good = sanitiseFunnelSteps([
    { kind: "instant_estimate", trade: "painting",
      bands: [{ id: "b", label: "One room", values: { squareFootage: 400 } }] },
  ])[0];
  ok("a complete step has no issues", estimateStepIssues(good).length === 0, estimateStepIssues(good));
  ok("non-estimate kinds are ignored", estimateStepIssues({ kind: "form" }).length === 0);
}

console.log("\n── the other kinds still behave ──");
{
  const steps = sanitiseFunnelSteps([
    { id: "i", kind: "intro", headline: "Hi", image: "javascript:alert(1)" },
    { id: "q", kind: "question_single", question: "?", maps: "budget",
      answers: [{ id: "a", label: "L", value: "v", next: "f" }] },
    { id: "f", kind: "form", fields: ["phone"] },
    { kind: "nonsense" },
  ]);
  ok("unknown kind still dropped", steps.length === 3, steps.map((s) => s.kind));
  ok("javascript: image still blocked", steps[0].image === undefined, steps[0]);
  ok("form still forces a name field", steps[2].fields.includes("name"), steps[2].fields);
  ok("empty funnel still falls back", sanitiseFunnelSteps(null)[0].kind === "thankyou");
}

console.log("\n── end to end: a band reaches a real total, never a NaN ──");
{
  const config = { ...INSTANT_ESTIMATE_DEFAULTS.painting, enabled: true };
  const [step] = sanitiseFunnelSteps([
    { id: "e", kind: "instant_estimate", trade: "painting", assumptions: { scope: "exterior" },
      bands: [
        { id: "small", label: "One room", values: { squareFootage: 400 } },
        { id: "zero", label: "Broken", values: { squareFootage: "1e400" } },
      ] },
  ]);

  const price = async (bandId) => {
    const band = resolveEstimateBand(step, bandId);
    if (!band) return { ok: false, reason: "no_band" };
    const m = await measureForTrade(step.trade, { intake: bandIntake(step, band) });
    if (!m.ok) return { ok: false, reason: m.reason };
    return priceOptionsFor({ trade: step.trade, config, measurement: m.measurement });
  };

  const small = await price("small");
  ok("a real band prices", small.ok, small);
  const finite = small.ok && small.options.every(
    (o) => Number.isFinite(o.low) && Number.isFinite(o.high) && o.low > 0 && o.high >= o.low);
  ok("every option is a finite, positive, ordered range", finite, small.options);
  ok("one option per configured paint grade",
    small.options.length === INSTANT_ESTIMATE_DEFAULTS.painting.materials.length, small.options.length);

  // The assumption has to actually bite, or it is a control that does nothing.
  const interiorStep = { ...step, assumptions: {} };
  const bandS = resolveEstimateBand(step, "small");
  const mExt = await measureForTrade("painting", { intake: bandIntake(step, bandS) });
  const mInt = await measureForTrade("painting", { intake: bandIntake(interiorStep, bandS) });
  const ext = priceOptionsFor({ trade: "painting", config, measurement: mExt.measurement });
  const int = priceOptionsFor({ trade: "painting", config, measurement: mInt.measurement });
  ok("scope=exterior prices above the default interior",
    ext.options[0].point > int.options[0].point, [ext.options[0].point, int.options[0].point]);

  const broken = await price("zero");
  ok("a band whose measurement overflowed to 0 is refused, not priced",
    broken.ok === false, broken);

  // What a forged body can reach: nothing. The measurement is read from the
  // stored step, so an invented band id is the whole attack surface.
  const forged = await price("../../etc/passwd");
  ok("a forged band id prices nothing", forged.ok === false, forged);
}

console.log("\n── the gate: what may cross to a browser ──");
{
  const priced = {
    ok: true, visibility: "range",
    options: [{ materialKey: "std", label: "Standard", low: 1200, high: 1600, point: 1400, minimumApplied: false, unit: null }],
  };
  const shown = publicFunnelEstimate({ priced, stage: "prompt", language: "en", tradeKey: "painting" });
  ok("range mode shows the range", shown.gated === false && shown.options[0].low === 1200, shown);
  ok("the material KEY is not echoed", !("materialKey" in shown.options[0]), shown.options[0]);
  ok("no point estimate is echoed", !("point" in shown.options[0]), shown.options[0]);

  const locked = publicFunnelEstimate({ priced: { ...priced, visibility: "after_submit" }, stage: "prompt", language: "en", tradeKey: "painting" });
  ok("after_submit sends NO figure before the form", locked.gated === true && !("options" in locked), locked);
  ok("...and says what unlocks it, not 'we don't show prices'",
    /form/i.test(locked.message) && !/don't show prices/i.test(locked.message), locked.message);

  const unlocked = publicFunnelEstimate({ priced: { ...priced, visibility: "after_submit" }, stage: "confirmed", language: "en", tradeKey: "painting" });
  ok("after_submit reveals once a lead exists", unlocked.gated === false, unlocked);

  for (const stage of ["prompt", "confirmed"]) {
    const g = publicFunnelEstimate({ priced: { ...priced, visibility: "gated" }, stage, language: "en", tradeKey: "painting" });
    ok(`gated stays gated at ${stage}`, g.gated === true && !("options" in g), g);
  }
  const unknown = publicFunnelEstimate({ priced: { ...priced, visibility: "nonsense" }, stage: "confirmed", language: "en", tradeKey: "painting" });
  ok("an unrecognised visibility falls back to gated", unknown.gated === true, unknown);

  const broke = publicFunnelEstimate({ priced: { ok: false, reason: "not_configured" }, stage: "prompt", language: "en", tradeKey: "painting" });
  ok("an unpriceable trade shows a sentence, never a blank", broke.gated === true && !!broke.message, broke);

  const nan = publicFunnelEstimate({
    priced: { ok: true, visibility: "range", options: [{ label: "x", low: NaN, high: 5 }, { label: "y", low: 9, high: 1 }] },
    stage: "prompt", language: "en", tradeKey: "painting",
  });
  ok("a NaN or inverted range never reaches the screen", nan.gated === true, nan);
}

console.log("\n── the builder and the sanitiser agree on the fields ──");
{
  for (const trade of FUNNEL_ESTIMATE_TRADES) {
    const fields = bandFieldsFor(trade);
    ok(`${trade} has band fields`, fields.length > 0, fields);
    const values = Object.fromEntries(fields.map((f) => [f.key, 3]));
    const [s] = sanitiseFunnelSteps([{ kind: "instant_estimate", trade, bands: [{ id: "b", label: "l", values }] }]);
    ok(`${trade}: every editable field survives`,
      deep(Object.keys(s.bands[0].values).sort()) === deep(fields.map((f) => f.key).sort()),
      Object.keys(s.bands[0].values));
  }
  ok("roofing offers no band fields", bandFieldsFor("roofing").length === 0);
  ok("an unknown trade offers no band fields", bandFieldsFor("nope").length === 0);
}

console.log("\n── the shipped server helpers, with the rate card stubbed in ──");
{
  const { db } = await import("@/lib/db");
  const {
    priceFunnelBand, serveFunnelSteps, confirmedFunnelEstimates,
  } = await import("@/app/api/funnels/public/funnelEstimate");

  // The company's saved rows, standing in for the database. Only findMany is
  // reached, and only with the trades a funnel names.
  let seen = null;
  const rows = (trades, visibility) =>
    trades.map((t) => ({ trade: t, config: { ...INSTANT_ESTIMATE_DEFAULTS[t], estimateVisibility: visibility } }));
  const stub = (trades, visibility = "range") => {
    Object.defineProperty(db, "instantQuoteConfig", {
      configurable: true,
      value: { findMany: async (args) => { seen = args; return rows(trades, visibility); } },
    });
  };

  stub(["painting"]);
  const steps = sanitiseFunnelSteps([
    { id: "intro", kind: "intro", headline: "Hi", buttonText: "Go" },
    { id: "q", kind: "question_single", question: "Which?",
      answers: [{ id: "a1", label: "Estimate me", value: "v1", next: "est" },
                { id: "a2", label: "Skip", value: "v2", next: "gone" }] },
    { id: "est", kind: "instant_estimate", trade: "painting", order: "price_first",
      headline: "Your price", sizeQuestion: "How big?",
      bands: [{ id: "small", label: "One room", values: { squareFootage: 400 } },
              { id: "dud", label: "Nothing", values: { squareFootage: 0 } }] },
    { id: "gone", kind: "instant_estimate", trade: "flooring",
      headline: "Floors", bands: [{ id: "f", label: "Big", values: { squareFootage: 900 } }] },
    { id: "contact", kind: "form", headline: "You", fields: ["name", "email"] },
    { id: "ty", kind: "thankyou", headline: "Thanks" },
  ]);

  const served = await serveFunnelSteps({ companyId: "c1", steps, language: "en" });
  ok("only the funnel's trades are queried",
    deep([...(seen?.where?.trade?.in || [])].sort()) === deep(["flooring", "painting"]), seen?.where);
  ok("the query is scoped to the company and to enabled rows",
    seen?.where?.companyId === "c1" && seen?.where?.enabled === true, seen?.where);

  const ids = served.steps.map((s) => s.id);
  ok("a step whose trade isn't switched on is removed", !ids.includes("gone"), ids);
  ok("it is reported as dropped, with a reason",
    served.dropped.length === 1 && served.dropped[0].reason === "trade_not_enabled", served.dropped);
  ok("the priceable step survives", ids.includes("est"), ids);
  const q = served.steps.find((s) => s.id === "q");
  ok("a branch into the removed step is rewired to 'next'",
    q.answers.find((a) => a.value === "v2").next === null, q.answers);
  ok("a branch into a surviving step is untouched",
    q.answers.find((a) => a.value === "v1").next === "est", q.answers);

  const est = served.steps.find((s) => s.id === "est");
  ok("bands ship as id + label only",
    est.bands.every((b) => deep(Object.keys(b).sort()) === deep(["id", "label"])), est.bands);
  ok("the unpriceable band is not offered",
    est.bands.length === 1 && est.bands[0].id === "small", est.bands);
  ok("no measurement crosses", !JSON.stringify(est).includes("400"), est);
  ok("no rate crosses", !/ratePerSqft|minCharge|Surcharge/.test(JSON.stringify(est)), est);
  ok("the visibility mode travels", est.estimateDisplay === "range", est.estimateDisplay);
  ok("the trade gets a homeowner-facing name", est.tradeLabel === "Painting", est.tradeLabel);

  // priceFunnelBand: the real function, on the real step.
  const stored = steps.find((s) => s.id === "est");
  const cfg = { ...INSTANT_ESTIMATE_DEFAULTS.painting, enabled: true };
  const p1 = await priceFunnelBand({ step: stored, band: resolveEstimateBand(stored, "small"), config: cfg });
  ok("priceFunnelBand prices a real band", p1.ok && p1.options.length > 0, p1.reason);
  const p2 = await priceFunnelBand({ step: stored, band: resolveEstimateBand(stored, "small"), config: null });
  ok("priceFunnelBand refuses without a config", p2.ok === false && p2.reason === "not_configured", p2);

  // Gated company: the step is still served (it has something honest to say)
  // but no figure ever crosses.
  stub(["painting"], "gated");
  const gatedServed = await serveFunnelSteps({ companyId: "c1", steps: [stored], language: "en" });
  ok("a gated trade still renders a step", gatedServed.steps.length === 1, gatedServed.dropped);
  ok("...with the company's own sentence", !!gatedServed.steps[0].gatedMessage, gatedServed.steps[0]);
  ok("...and still no figure", !/\d{3,}/.test(JSON.stringify(gatedServed.steps[0])), gatedServed.steps[0]);

  // Submit-time: the contractor is told what was promised, in their currency.
  stub(["painting"], "range");
  const conf = await confirmedFunnelEstimates({
    companyId: "c1", steps, answers: { est: "small", q: "v1" }, language: "en", currency: "USD",
  });
  ok("the visitor's step gets a revealed estimate", conf.byStep.est?.gated === false, conf.byStep);
  ok("the lead note names the size they picked", /One room/.test(conf.notes[0]), conf.notes);
  ok("the lead note carries the figure", /\$[\d,]+/.test(conf.notes[0]), conf.notes);
  ok("the lead note says it was on screen", /shown on screen/.test(conf.notes[0]), conf.notes);
  ok("the note is in the company's currency", !/CA\$/.test(conf.notes[0]), conf.notes);
  ok("intake gets a keyed entry", Object.keys(conf.intake).length === 1, conf.intake);

  stub(["painting"], "gated");
  const confGated = await confirmedFunnelEstimates({
    companyId: "c1", steps, answers: { est: "small" }, language: "en", currency: "USD",
  });
  ok("a gated trade shows the visitor nothing", confGated.byStep.est.gated === true, confGated.byStep);
  ok("...but the contractor still sees the figure on their own lead",
    /\$[\d,]+/.test(confGated.notes[0]) && /not shown to them/.test(confGated.notes[0]), confGated.notes);

  const none = await confirmedFunnelEstimates({
    companyId: "c1", steps, answers: {}, language: "en", currency: "USD",
  });
  ok("an unanswered estimate step adds nothing to the lead",
    none.notes.length === 0 && deep(none.byStep) === "{}", none);
}

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
