// scripts/check-plan-fit.mjs
//
// BBB's employee band → the plan it most likely fits (lib/sales/intel/planFit.js).
//
// Every band BBB uses is executed, the split is the ladder's own (one seat in
// three, rounded down, never below one), the plan is chosen by tierFor() —
// the function that prices a real roster — and the sentence names the
// source and that the count is self-reported. Unknown says nothing: no
// band, a word, a zero or a backwards band produces null, never a plan.
//
// Then the surfaces: the "Likely plan" fact row on the card, the brief's
// known line (which is what the script prompt's WHAT WE KNOW reads), the
// prompt's talking points, and the queue page's pitch layer.
//
// Run: npm run check:plan-fit

import { readFileSync } from "node:fs";
import { planFitForRange, parseEmployeeRange, splitPeople, PEOPLE_PER_SEAT } from "@/lib/sales/intel/planFit";
import { tierFor, CUSTOM_MAX_SEATS, MAX_COMPANY_PEOPLE } from "@/lib/pricing/ladder";
import { planFitRow, prospectFacts } from "@/lib/sales/prospectView";
import { composeBrief } from "@/lib/sales/intel/brief";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

console.log("\nThe bands BBB uses, every one mapped");
const BBB_BANDS = ["1", "2-5", "6-10", "11-50", "51-200", "201+"];
const want = {
  "1": { kind: "ladder", tierKey: "solo" },
  "2-5": { kind: "ladder", tierKey: "solo" },
  "6-10": { kind: "ladder", tierKey: "crew" },
  "11-50": { kind: "custom", tierKey: "custom-23" },
  "51-200": { kind: "straddles", tierKey: "custom-23" },
  "201+": { kind: "beyond", tierKey: null },
};
for (const band of BBB_BANDS) {
  const fit = planFitForRange(band);
  ok(`${band}: ${want[band].kind}${want[band].tierKey ? ` → ${want[band].tierKey}` : ""}`,
    fit && fit.kind === want[band].kind && (fit.tier?.tierKey || null) === want[band].tierKey, fit && { kind: fit.kind, tier: fit.tier?.tierKey });
  ok(`  ...says "per BBB" and that it is self-reported`, /per BBB/.test(fit.sentence) && /Self-reported to BBB/.test(fit.sentence));
}
ok("the owner's example: 6–10 → Crew ($169: 3 seats, 8 crew)",
  planFitForRange("6-10").sentence === "About 6–10 employees per BBB → likely fits the Crew plan ($169: 3 seats, 8 crew). (Self-reported to BBB.)", planFitForRange("6-10").sentence);
ok("above Scale the sentence says Custom, about N seats", /a custom plan, about 23 seats/.test(planFitForRange("11-50").sentence));
ok("a band that straddles the hundred-person cap says both halves",
  /at the low end/.test(planFitForRange("51-200").sentence) && /past a hundred people it is a conversation/.test(planFitForRange("51-200").sentence));
ok("past the cap it names the cap and refuses to name a plan",
  /hundred people/.test(planFitForRange("201+").sentence) && planFitForRange("201+").tier === null && !/likely fits/.test(planFitForRange("201+").sentence));
ok("BBB's spaced and dashed spellings parse the same",
  planFitForRange("6 - 10").sentence === planFitForRange("6–10").sentence && planFitForRange(" 2-5 ").kind === "ladder");
ok("a single employee is singular", /About 1 employee per BBB/.test(planFitForRange("1").sentence));

console.log("\nThe split is the ladder's own, and the plan is tierFor's");
ok(`one seat in ${PEOPLE_PER_SEAT}, rounded down, never below one`,
  JSON.stringify(splitPeople(1)) === '{"seats":1,"crew":0}' && JSON.stringify(splitPeople(5)) === '{"seats":1,"crew":4}' && JSON.stringify(splitPeople(10)) === '{"seats":3,"crew":7}' && JSON.stringify(splitPeople(50)) === '{"seats":16,"crew":34}');
ok("the plan named is exactly tierFor() of that split, for every band that fits",
  BBB_BANDS.every((b) => { const f = planFitForRange(b); if (!f.tier) return true; return tierFor({ seats: f.seats, crew: f.crew })?.tierKey === f.tier.tierKey; }));
ok("the cap the sentence quotes is the ladder's", MAX_COMPANY_PEOPLE === 100 && CUSTOM_MAX_SEATS === 47);

console.log("\nUnknown says nothing");
for (const bad of [null, undefined, "", "   ", "lots", "0", "5-2", "-3", "ten", "2-5-8"]) {
  ok(`${JSON.stringify(bad)} → null`, planFitForRange(bad) === null && (bad === "5-2" || bad === "0" ? parseEmployeeRange(bad) === null : true));
}

console.log("\nThe surfaces");
const prospect = { businessName: "AMS Electric", city: "Fresno", province: "CA", employeeRange: "6-10", bbbCheckedAt: new Date("2026-09-18"), people: [] };
const row = planFitRow(prospect);
ok("the card gets a 'Likely plan' fact row with the sentence, keyed for its label",
  row?.key === "planFit" && row.known === true && row.labelKey === "app.salesIntel.fact.planFit.label" && /Crew plan/.test(row.text) && row.planFit?.tierKey === "crew", row);
ok("...and no row at all without a band — not an 'unknown' line", planFitRow({ ...prospect, employeeRange: null }) === null && !prospectFacts({ ...prospect, employeeRange: null }).some((f) => f.key === "planFit"));
ok("...after the BBB row in prospectFacts", (() => { const keys = prospectFacts(prospect).map((f) => f.key); return keys.indexOf("planFit") === keys.indexOf("bbb") + 1; })());
ok("prospectFacts never carries a null row", prospectFacts({ ...prospect, employeeRange: null }).every(Boolean));
const brief = composeBrief({ prospect });
const known = brief.known.find((k) => k.id === "plan_fit");
ok("the brief carries it as a FACT sourced to BBB (this is what WHAT WE KNOW reads)",
  known && known.layer === "fact" && known.source === "bbb" && known.label === "Likely plan" && /Crew plan/.test(known.detail), known);
ok("...and as brief.planFit for the pitch", brief.planFit?.kind === "ladder" && brief.planFit.tier?.tierKey === "crew");
ok("...and neither when BBB gave no band",
  (() => { const b = composeBrief({ prospect: { ...prospect, employeeRange: null } }); return !b.known.some((k) => k.id === "plan_fit") && b.planFit === null; })());
const script = readFileSync("lib/sales/intel/callScript.js", "utf8");
ok("the script prompt's talking points append the plan fit, cited to BBB and marked self-reported",
  /Likely plan \(per BBB, self-reported\): \$\{clip\(brief\.planFit\.sentence\)\}/.test(script));
const view = readFileSync("lib/sales/prospectView.js", "utf8");
ok("the queue's view carries planFit", /planFit: planFitForRange\(prospect\.employeeRange\)/.test(view));
const page = readFileSync("app/sales/queue/page.js", "utf8");
ok("the queue page prints it in the pitch layer, above the recommendations",
  /current\.planFit\?\.sentence/.test(page) && page.indexOf("current.planFit?.sentence") < page.indexOf("current.opportunities.length === 0"));
for (const lang of ["en", "fr", "es"]) {
  ok(`${lang}: the label keys exist`, ["app.salesIntel.fact.planFit.label", "app.salesQueue.likelyPlan"].every((k) => typeof APP_MESSAGES[lang]?.[k] === "string" && APP_MESSAGES[lang][k]));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
