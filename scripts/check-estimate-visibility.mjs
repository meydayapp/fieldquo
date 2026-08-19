// Executes lib/estimate/visibility.js — the gate on what a homeowner sees.
import {
  ESTIMATE_VISIBILITY, DEFAULT_VISIBILITY, visibilityFor, publicEstimate, gatedMessage,
} from "@/lib/estimate/visibility";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

console.log("\nThe default is cautious");
ok("default is gated", DEFAULT_VISIBILITY === "gated");
ok("both modes exist", ESTIMATE_VISIBILITY.gated && ESTIMATE_VISIBILITY.range);

console.log("\nvisibilityFor — unrecognised resolves to gated, never leaks");
ok("no config -> gated", visibilityFor(null) === "gated");
ok("empty config -> gated", visibilityFor({}) === "gated");
ok("typo -> gated (not accidentally range)", visibilityFor({ estimateVisibility: "rnage" }) === "gated");
ok("explicit range -> range", visibilityFor({ estimateVisibility: "range" }) === "range");
ok("explicit gated -> gated", visibilityFor({ estimateVisibility: "gated" }) === "gated");
ok("non-object -> gated", visibilityFor("range") === "gated");

console.log("\npublicEstimate — gated NEVER returns a number");
const g = publicEstimate({ low: 4200, high: 5500 }, "gated");
ok("gated hides the estimate", g.show === false);
ok("...and carries no low/high at all", g.low === undefined && g.high === undefined, g);
ok("unknown mode is treated as gated", publicEstimate({ low: 100, high: 200 }, "banana").show === false);

console.log("\npublicEstimate — range shows real numbers, rounded");
const r = publicEstimate({ low: 4200.4, high: 5500.9 }, "range");
ok("range shows", r.show === true);
ok("...rounds low", r.low === 4200);
ok("...rounds high", r.high === 5501);

console.log("\nrange with nothing valid falls back to gated (no $0 / $NaN)");
ok("null estimate -> hidden", publicEstimate(null, "range").show === false);
ok("zero low -> hidden", publicEstimate({ low: 0, high: 100 }, "range").show === false);
ok("high < low -> hidden", publicEstimate({ low: 500, high: 200 }, "range").show === false);
ok("NaN -> hidden", publicEstimate({ low: NaN, high: 5 }, "range").show === false);
ok("undefined fields -> hidden", publicEstimate({}, "range").show === false);
ok("negative -> hidden", publicEstimate({ low: -100, high: 50 }, "range").show === false);
ok("...and the reason says why", publicEstimate({}, "range").reason === "no_estimate");

console.log("\nThe rate card is never in the payload, either mode");
// A homeowner should never receive a per-unit rate — only the finished range.
const payloadRange = JSON.stringify(publicEstimate({ low: 4200, high: 5500 }, "range"));
const payloadGated = JSON.stringify(publicEstimate({ low: 4200, high: 5500 }, "gated"));
// `minimumApplied` joined the payload so the screen can explain why a small job
// and a slightly larger one quote the same figure. It is a BOOLEAN — the floor
// that produced it is a rate and stays server-side.
ok("range payload is show/low/high/minimumApplied", Object.keys(publicEstimate({ low: 1, high: 2 }, "range")).sort().join() === "high,low,minimumApplied,show");
// The real invariant, asserted on values rather than key names: the only
// numbers that ever cross are the two ends of the range. A rate, a minimum, a
// multiplier or a unit price added to this object would fail here even if
// somebody gave it an innocent-looking name.
{
  const pay = publicEstimate({ low: 4200, high: 5500, minimumApplied: true, minCharge: 3000, perDoor: 95 }, "range");
  const numeric = Object.entries(pay).filter(([, v]) => typeof v === "number");
  ok("...and the only numbers in it are low and high", numeric.map(([k]) => k).sort().join() === "high,low", numeric);
  ok("...so a rate smuggled into the estimate object never reaches the browser", !/3000|95/.test(JSON.stringify(pay)));
}
ok("gated payload has no figures", !/4200|5500/.test(payloadGated));
ok("range payload has the figures but nothing else numeric", /4200/.test(payloadRange));

console.log("\ngatedMessage — never blank, language-aware");
ok("en message", /quote/i.test(gatedMessage("en")));
ok("fr message", /soumission/i.test(gatedMessage("fr")));
ok("unknown lang -> en", gatedMessage("de") === gatedMessage("en"));
ok("no arg -> en", typeof gatedMessage() === "string" && gatedMessage().length > 10);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
