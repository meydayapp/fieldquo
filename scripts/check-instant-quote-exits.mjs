// scripts/check-instant-quote-exits.mjs
//
// Two guarantees for the public instant-estimate flow, both of which were
// broken in production at the same time:
//
//   1. NO DEAD ENDS. Every branch that tells a homeowner something went wrong
//      must also render a way forward. The map-failure branch said "Please
//      request a quote and we'll measure your lawn by hand" and rendered no
//      link — the link lived in a different branch — so a stranger in a
//      driveway was told to do something they had no means of doing.
//
//   2. NO LEAKS WHEN GATED. When the owner has chosen not to show a price, the
//      public response carries no figure and no scrap of their configuration:
//      not a rate, not a reason, not a flag naming which setting is off. A
//      homeowner is told the service isn't available; only the contractor, on
//      their own authenticated settings screen, is told why.
//
// Half of this executes real pure functions (readiness vs the pricer — the
// disagreement that made an enabled, fully-priced Cabinet Refacing answer "not
// taking instant quotes"). The other half reads the flow's SOURCE, because
// "does this branch render an exit?" is a question about the component tree and
// there is no way to ask it of a value.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  priceOptionsFor,
  instantQuoteReadiness,
  materialRateKey,
} from "@/lib/estimate/instantQuoteReadiness";
import {
  INSTANT_ESTIMATE_DEFAULTS,
  INSTANT_ESTIMATE_TRADES,
  computeInstantEstimate,
} from "@/lib/estimate/instantEstimate";
import { publicEstimate, gatedMessage, visibilityFor } from "@/lib/estimate/visibility";

const ROOT = join(import.meta.dirname, "..");
const FLOW = join(ROOT, "app/instant-quote/[companySlug]/InstantQuoteFlow.js");
const MEASURE_ROUTE = join(ROOT, "app/api/instant-quote/[companySlug]/measure/route.js");
const REQUEST_ROUTE = join(ROOT, "app/api/instant-quote/[companySlug]/request/route.js");
const QUOTE_PAGE = join(ROOT, "app/quote/[companySlug]/page.js");
const SETTINGS_ROUTE = join(ROOT, "app/api/settings/instant-quote/route.js");
const SETTINGS_PAGE = join(ROOT, "app/app/settings/instant-quotes/page.js");

let pass = 0, fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

const flowSrc = readFileSync(FLOW, "utf8");
const measureSrc = readFileSync(MEASURE_ROUTE, "utf8");
const requestSrc = readFileSync(REQUEST_ROUTE, "utf8");
const settingsSrc = readFileSync(SETTINGS_ROUTE, "utf8");
const settingsPageSrc = readFileSync(SETTINGS_PAGE, "utf8");

// ── Balanced-region reader ──────────────────────────────────────────────────
// Naive bracket counting, deliberately. It is checked with `found` below so a
// mis-parse is a loud failure rather than a branch that silently "passes".
function balancedAfter(src, fromIndex, open = "{", close = "}") {
  const start = src.indexOf(open, fromIndex);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe exit itself is real (an exit that 404s is still a dead end)");

ok("RequestQuoteLink component exists", /function RequestQuoteLink\(/.test(flowSrc));
// Skip the destructured parameter list; the body is the next balanced brace.
const exitAt = flowSrc.indexOf("function RequestQuoteLink(");
const exitComponent = balancedAfter(flowSrc, flowSrc.indexOf(") {", exitAt));
ok("...renders an anchor to /quote/<slug>", /<a\s[\s\S]*href=\{`\/quote\/\$\{companySlug\}`\}/.test(exitComponent || ""));
ok("...the route it points at exists on disk", existsSync(QUOTE_PAGE));
ok("...and the anchor carries visible text", /Request a quote/.test(exitComponent || ""));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nEvery failure branch in the flow renders a route out");

// Named branches, each identified by the guard that opens it.
const BRANCHES = [
  ["company data failed to load", "if (loadErr) {"],
  ["the map failed to load", "if (failed) {"],
  ["the company has no instant trades", "if (!data.trades.length) {"],
  // There used to be two of these, one per round trip: `measureErr` for the
  // separate "Get my estimate" measure step, and `submitErr` for the contact
  // step after it. The flow is one page with ONE submit now — /request
  // re-measures and re-prices itself — so a failed measurement and a failed
  // submit arrive on the same path and are reported by the same branch.
  // Merged here rather than dropped: the assertion below still walks the block
  // and still demands it renders a route out.
  ["the measure-or-submit call failed", "{submitErr && ("],
];

for (const [name, anchor] of BRANCHES) {
  const at = flowSrc.indexOf(anchor);
  ok(`branch present: ${name}`, at >= 0);
  if (at < 0) continue;
  const block = balancedAfter(flowSrc, at + anchor.length - 1, anchor.endsWith("(") ? "(" : "{", anchor.endsWith("(") ? ")" : "}");
  ok(`  ...block parsed`, !!block && block.length > 10 && block.length < 4000, block?.length);
  ok(`  ...renders an exit`, /<RequestQuoteLink/.test(block || ""));
}

// The completeness guard. Enumerating branches by hand only protects the
// branches someone remembered to list — which is the exact failure this file
// exists to prevent. So: every error-ish piece of state the component holds
// must be rendered inside a block that also renders the exit.
const errStates = [...flowSrc.matchAll(/const \[(\w*[Ee]rr\w*), set\w+\] = useState/g)].map((m) => m[1]);
ok("found the component's error state", errStates.length >= 3, errStates);
for (const s of errStates) {
  // A companion like loadErrStatus is metadata about another error, not a
  // renderable failure of its own.
  if (/Status$/.test(s)) continue;
  const guards = [`if (${s}) {`, `{${s} && (`];
  const at = guards.map((g) => flowSrc.indexOf(g)).find((i) => i >= 0);
  ok(`  ${s} is rendered through a known guard`, at !== undefined, s);
  if (at === undefined) continue;
  const isParen = flowSrc.startsWith(`{${s} && (`, at);
  const block = balancedAfter(flowSrc, at + s.length, isParen ? "(" : "{", isParen ? ")" : "}");
  ok(`  ${s}'s branch offers a way forward`, /<RequestQuoteLink/.test(block || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe gated response carries no price and no configuration");

// Anything that would tell a stranger what the company charges, or which of
// their settings is off. `gated` and `message` are presentation — they say a
// price is not being shown, which the homeowner can see for themselves.
const FORBIDDEN_KEYS = [
  "options", "estimate", "low", "high", "point", "price", "amount", "total",
  "rate", "ratePerSqft", "ratePerSquare", "ratePerTread", "materials",
  "materialKey", "rates", "tiers", "perDoor", "perDrawer", "perBoxLinearFt",
  "minCharge", "rangeBandPct", "loadCents", "config", "enabled", "visibility",
  "estimateVisibility", "reason", "readiness",
];

function keysDeep(v, acc = []) {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, acc));
  else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) { acc.push(k); keysDeep(val, acc); }
  }
  return acc;
}

// The measurement facts a homeowner is shown are legitimately numeric; the
// gated body is built from these plus the message, exactly as the route does.
const gatedBody = {
  measurement: { areaSqft: 480, squares: null, predominantPitch: null, footprintSqft: null, satelliteImageUrl: null, formattedAddress: null },
  gated: true,
  message: gatedMessage("en", "prompt"),
  financing: null,
};
const gatedKeys = keysDeep(gatedBody);
ok("gated body has no price/config key", !gatedKeys.some((k) => FORBIDDEN_KEYS.includes(k)), gatedKeys.filter((k) => FORBIDDEN_KEYS.includes(k)));
ok("gated message quotes no figure", !/\d/.test(gatedBody.message), gatedBody.message);
ok("gated prompt asks for details rather than thanking a stranger who hasn't given any", /leave your details|coordonn/i.test(gatedBody.message), gatedBody.message);
// The confirmed line sits exactly where the range would have been, so it has to
// explain the gap rather than repeat the "we'll be in touch" already on screen.
ok("...and the confirmed stage names the missing price", /no price is shown/i.test(gatedMessage("en", "confirmed")) && /aucun prix/i.test(gatedMessage("fr", "confirmed")));
ok("...the two stages say different things", gatedMessage("en", "prompt") !== gatedMessage("en", "confirmed"));
ok("...and so do their French counterparts", gatedMessage("fr", "prompt") !== gatedMessage("fr", "confirmed") && gatedMessage("fr", "confirmed") !== gatedMessage("en", "confirmed"));
ok("gated confirmed message quotes no figure", !/\d/.test(gatedMessage("en", "confirmed")));
ok("fr gated messages quote no figure", !/\d/.test(gatedMessage("fr", "prompt")) && !/\d/.test(gatedMessage("fr", "confirmed")));

// The route's own gated returns, read from source: whatever the object literal
// holds is what crosses to the browser.
// Anchored on each `gated: true` and walked BACK to the object literal that
// contains it — a forward regex from the first NextResponse.json in the file
// happily swallows three unrelated statements and then "finds" a leak in one
// of them.
const gatedReturns = [...measureSrc.matchAll(/gated: true/g)].map((m) => {
  const open = measureSrc.lastIndexOf("NextResponse.json(", m.index);
  return balancedAfter(measureSrc, open) || "";
});
ok("both gated returns found in the measure route", gatedReturns.length === 2, gatedReturns.length);
for (const [i, body] of gatedReturns.entries()) {
  const leaked = FORBIDDEN_KEYS.filter((k) => new RegExp(`(^|[\\s{,])${k}\\s*:`).test(body));
  ok(`  gated return #${i + 1} ships no price/config key`, leaked.length === 0, leaked);
}

// The unavailable (422) response: the visitor learns which SERVICE is off, and
// nothing about why. `priced.reason` belongs in the log, not the body.
const unavailable = measureSrc.slice(measureSrc.indexOf("if (!priced.ok)"), measureSrc.indexOf("// Only the measurement facts"));
ok("unavailable branch found", unavailable.length > 50);
ok("...names the service to the visitor", /tradeLabel\(trade\)/.test(unavailable));
ok("...never puts the reason in the response body", !/NextResponse\.json\([\s\S]*priced\.reason/.test(unavailable));
ok("...but does log the reason for the contractor's support", /console\.(warn|error)\([\s\S]*priced\.reason/.test(unavailable));
ok("...and points the contractor at the screen that fixes it", /settings\/instant-quotes/.test(unavailable));

// The submit response mirrors the same gate.
// Was: publicEstimate(priced.estimate, priced.visibility). The mode is now
// RESOLVED first, because "after_submit" means different things either side of
// the submit and publicEstimate must never be handed the raw setting — it
// treats an unresolved mode as gated, which would withhold a figure the owner
// chose to show. So this asserts the stronger pair: the figure still goes
// through the choke point, AND the mode reaching it was resolved with an
// explicit stage. `effectiveVisibility` has no default stage precisely so that
// a caller cannot forget one, and this keeps the confirmed side honest.
ok("request route gates its figure through publicEstimate", /publicEstimate\(priced\.estimate, visibility\)/.test(requestSrc));
ok("...and resolves the mode with an explicit stage first", /effectiveVisibility\(priced\.visibility, "confirmed"\)/.test(requestSrc));
ok("request route says WHY there's no figure instead of leaving a blank", /message: shown \? null : gatedMessage\(/.test(requestSrc));
ok("...and the flow renders that message", /result\.message/.test(flowSrc));

// publicEstimate is the choke point; prove the gated call yields nothing usable.
const gatedPub = publicEstimate({ low: 4200, high: 5500 }, visibilityFor({ estimateVisibility: "gated" }));
ok("publicEstimate under gating exposes no figure", gatedPub.show === false && gatedPub.low === undefined && gatedPub.high === undefined, gatedPub);
ok("an unsaved visibility resolves to gated, not to a leak", visibilityFor({}) === "gated");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nReadiness and the public pricer agree — trade by trade");

// The regression that started all of this: cabinet_refacing declares
// hasMaterials for its multiplier map but has no materials[] rows, so the
// pricer's loop never ran and an enabled, fully-priced trade told homeowners it
// wasn't taking instant quotes.
const PROBE = {
  roofing: { squares: 20, areaSqft: 2000, steepness: "standard" },
  epoxy: { areaSqft: 500 },
  parging: { areaSqft: 500 },
  flooring: { areaSqft: 500 },
  painting: { areaSqft: 500 },
  countertop: { areaSqft: 40 },
  cabinet_refacing: { doorCount: 12, drawerCount: 4 },
  stair: { treads: 13 },
  lawn_mowing: { areaSqft: 4000 },
  junk_removal: { items: [{ key: "couch", quantity: 2 }], jobType: "single_items" },
};

ok("every wired trade has a probe here", Object.keys(INSTANT_ESTIMATE_TRADES).every((t) => PROBE[t]), Object.keys(INSTANT_ESTIMATE_TRADES).filter((t) => !PROBE[t]));

for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
  const config = { ...(INSTANT_ESTIMATE_DEFAULTS[trade] || {}), enabled: true };
  const ready = instantQuoteReadiness(trade, config);
  const priced = priceOptionsFor({ trade, config, measurement: PROBE[trade] });
  ok(`${trade}: reference config is ready`, ready.ok === true, ready);
  ok(`${trade}: ...and actually prices a real job`, priced.ok === true, priced.reason);
  ok(`${trade}: readiness matches the pricer`, ready.ok === priced.ok, { ready: ready.ok, priced: priced.ok });
  if (priced.ok) {
    ok(`${trade}: every option has a usable range`, priced.options.every((o) => o.low > 0 && o.high >= o.low), priced.options);
  }
}

console.log("\n  — the specific bug —");
const cab = { ...INSTANT_ESTIMATE_DEFAULTS.cabinet_refacing, enabled: true };
ok("cabinet_refacing declares hasMaterials", INSTANT_ESTIMATE_TRADES.cabinet_refacing.hasMaterials === true);
ok("...and has no materials[] rows to iterate", !Array.isArray(cab.materials) || cab.materials.length === 0);
ok("...yet still prices, as a single option", priceOptionsFor({ trade: "cabinet_refacing", config: cab, measurement: { doorCount: 12, drawerCount: 4 } }).ok === true);
ok("...with materialKey null, since no picker exists for it", priceOptionsFor({ trade: "cabinet_refacing", config: cab, measurement: { doorCount: 12 } }).options?.[0]?.materialKey === null);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nAn unpriceable config is caught BEFORE it's offered to anyone");

const blank = (trade, over) => instantQuoteReadiness(trade, { ...(INSTANT_ESTIMATE_DEFAULTS[trade] || {}), ...over });

ok("no config at all -> not ready", instantQuoteReadiness("roofing", null).ok === false);
ok("...and says what to do", /material/i.test(instantQuoteReadiness("roofing", null).fix || ""));
ok("materials with no rates -> not ready", blank("roofing", { materials: [{ key: "a", label: "A", ratePerSquare: 0 }] }).ok === false);
ok("one priced material is enough", blank("roofing", { materials: [{ key: "a", label: "A", ratePerSquare: 500 }] }).ok === true);
ok("...but the unpriced ones are named as a warning, not silently dropped", (() => {
  const r = blank("roofing", { materials: [{ key: "a", label: "A", ratePerSquare: 500 }, { key: "b", label: "Metal", ratePerSquare: 0 }] });
  return r.ok === true && r.warnings.some((w) => /Metal/.test(w.message));
})());

// The gap the old hand-written validator allowed through: it required only that
// SOME lot-size band had a price, while the pricer needs the band the lawn
// actually falls in. A blank first band published a service that silently
// refused every small lawn.
const lawnGap = blank("lawn_mowing", {
  tiers: [
    { maxSqft: 5000, pricePerVisit: 0 },
    { maxSqft: 10000, pricePerVisit: 55 },
  ],
});
ok("a lawn band with no price -> not ready", lawnGap.ok === false, lawnGap);
ok("...and the message names the size that fails", /small lawn|5,000/.test(lawnGap.message || ""), lawnGap.message);
ok("...while all bands priced -> ready", blank("lawn_mowing", { tiers: [{ maxSqft: 5000, pricePerVisit: 40 }, { maxSqft: 10000, pricePerVisit: 55 }] }).ok === true);

// Two trades whose estimators pad an unstated price with something (cabinet
// floors at minCharge, junk refills from FieldQuo's reference rates). Probing
// alone would call both "ready" and publish numbers the company never chose.
ok("cabinet with no per-door price -> not ready (minCharge must not stand in)", blank("cabinet_refacing", { perDoor: 0 }).ok === false);
ok("junk with a blanked load card -> not ready (our defaults must not stand in)", instantQuoteReadiness("junk_removal", { rates: { loadCents: { full: 0 }, minimumCents: 0 }, rangeBandPct: 0.15 }).ok === false);
ok("junk with a real full-truck price -> ready", instantQuoteReadiness("junk_removal", { rates: { loadCents: { full: 77500 }, minimumCents: 9000 }, rangeBandPct: 0.15 }).ok === true);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe reason lives where the contractor can act on it, and nowhere else");

const enableGuard = balancedAfter(settingsSrc, settingsSrc.indexOf("if (enabled) {"), "{", "}") || "";
ok("the settings PUT still gates enabling on readiness", /instantQuoteReadiness\(trade, config\)/.test(enableGuard), enableGuard.slice(0, 120));
ok("...and refuses with a 400 rather than saving a dead trade", /status: 400/.test(enableGuard));
ok("...telling the owner what to fix", /readiness\.fix/.test(enableGuard));
ok("the settings GET carries readiness per trade", /readiness: instantQuoteReadiness\(/.test(settingsSrc));
ok("...and the settings screen actually renders it", /readiness\.message/.test(settingsPageSrc) && /readiness\.ok/.test(settingsPageSrc));
ok("...including the non-fatal warnings", /readiness\?\.warnings/.test(settingsPageSrc));
// Non-negotiable #4, mechanically: the contractor-facing diagnosis must never
// be importable by a route a stranger can call.
ok("readiness never reaches a public instant-quote route", !/instantQuoteReadiness/.test(measureSrc) && !/instantQuoteReadiness/.test(requestSrc));

console.log("\nHostile input never throws");

// Shapes no settings screen would produce, but nothing stops from being saved:
// `config` is free-form JSON on the model, and only its VALUES were ever
// validated on the way in — never the shape holding them.
const HOSTILE = [
  null, undefined, "", 0, [],
  { materials: "nope" },
  { tiers: {} },
  { materials: [null] },
  { rates: null },
  { materials: {}, tiers: "nope" },
  { materials: [{ key: "a" }, "string", 7, []] },
  { tiers: [null, { maxSqft: 5000, pricePerVisit: 40 }] },
  { tiers: [{ maxSqft: "x", pricePerVisit: "y" }] },
  // The dangerous one: junk beside a perfectly good rate, so the enable-time
  // "at least one material is priced" check passes and the row goes live.
  { materials: [null, { key: "a", label: "A", ratePerSqft: 5, ratePerSquare: 400, ratePerTread: 110 }] },
];

for (const bad of HOSTILE) {
  for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
    try {
      const r = instantQuoteReadiness(trade, bad);
      if (typeof r?.ok !== "boolean") throw new Error("no verdict");
      priceOptionsFor({ trade, config: bad, measurement: PROBE[trade] });
    } catch (err) {
      fail++;
      console.log(`  ✗ ${trade} threw on ${JSON.stringify(bad)}: ${err.message}`);
    }
  }
}
ok("...survived every hostile config, through the sanitised path", true);

// And again with the sanitiser out of the way. The shape assumption lived in
// the estimators — `(config.materials || []).find((m) => m.key === k)` is fine
// right up until `materials` is a string or has a hole in it — so sanitising at
// the boundary made the public routes safe while leaving the module itself
// sharp. That holds only for callers who know the boundary helper exists; the
// next one to import computeInstantEstimate directly reopens the 500. Same
// configs, straight in.
for (const bad of HOSTILE) {
  for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
    // Three ways a material key arrives: absent, unknown (the homeowner's pick
    // no longer matches a row), and matching.
    for (const materialKey of [undefined, "x", "a"]) {
      try {
        const r = computeInstantEstimate({ trade, measurements: PROBE[trade], materialKey, config: bad });
        if (typeof r?.ok !== "boolean") throw new Error("no verdict");
      } catch (err) {
        fail++;
        console.log(`  ✗ ${trade} threw unsanitised on ${JSON.stringify(bad)} / key=${materialKey}: ${err.message}`);
      }
    }
  }
}
ok("...and every one again straight into computeInstantEstimate, unsanitised", true);

console.log("\n  — the three saved shapes that used to 500 a public route —");
const direct = (trade, config, measurements, materialKey) =>
  computeInstantEstimate({ trade, measurements, materialKey, config });

ok("roofing, materials: [null] -> a verdict", direct("roofing", { materials: [null] }, { squares: 20 }, "x").ok === false);
ok('roofing, materials: "nope" -> a verdict', direct("roofing", { materials: "nope" }, { squares: 20 }, "x").ok === false);
ok("lawn_mowing, tiers: {} -> a verdict", direct("lawn_mowing", { tiers: {} }, { areaSqft: 500 }).ok === false);

// A malformed entry costs that entry, not the trade: the priced material next
// to it still sells, at exactly the price it did before.
const withHole = direct("flooring", { materials: [null, { key: "lam", label: "Laminate", ratePerSqft: 4.5 }] }, { areaSqft: 500 }, "lam");
ok("a null beside a priced material -> the good one still prices", withHole.ok === true && withHole.point === 2250, withHole);
ok("...and an unknown key still falls back past the hole to a real row", direct("flooring", { materials: [null, { key: "lam", label: "Laminate", ratePerSqft: 4.5 }] }, { areaSqft: 500 }, "gone").point === 2250);

// The lawn sort runs on a filtered copy. If that ever becomes the stored array
// itself, pricing a lawn silently reorders the company's saved bands.
const savedTiers = [{ maxSqft: 10000, pricePerVisit: 55 }, { maxSqft: 5000, pricePerVisit: 40 }];
direct("lawn_mowing", { tiers: savedTiers, rangeBandPct: 0.12 }, { areaSqft: 4000 });
ok("pricing a lawn doesn't reorder the company's saved bands", savedTiers[0].maxSqft === 10000, savedTiers);
ok("unknown trade -> a verdict, not a crash", instantQuoteReadiness("banana", {}).ok === false);
ok("materialRateKey is shared, not re-derived", materialRateKey("roofing") === "ratePerSquare" && materialRateKey("stair") === "ratePerTread" && materialRateKey("flooring") === "ratePerSqft");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
