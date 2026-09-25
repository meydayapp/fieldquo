// scripts/check-stairs-from-steps.mjs
//
// A staircase from two answers: how many steps, and what shape.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-stairs-from-steps.mjs
//
// The owner's rule, verbatim: "Each step tends to have 2 balusters. And most
// stairs are either in L shape or U shape, with 4 to 5 posts." One pure
// function (lib/estimate/stairsFromSteps.js) turns that into treads, risers,
// balusters, posts and handrail feet, and three surfaces read it:
//
//   • the instant estimate, which used to price treads and a typed railing
//     and nothing else — a stair refinish quoted at two-thirds of itself;
//   • the instant-quote draft's takeoff, which the estimator opens with the
//     derived counts switched on and a note saying where they came from;
//   • the builder's staircase form, whose "Fill from step count" writes the
//     same counts into the same editable boxes.
//
// The rule is executed at 1, 14 and 30 steps in every shape, against garbage,
// and through the instant estimate and the costing; the builder half is JSX
// and is asserted as text.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  stairsFromSteps,
  stairShape,
  stairsDerivationNote,
  stairFillPatch,
  stairFillSnapshot,
  STAIR_SHAPES,
  DEFAULT_STAIR_SHAPE,
} from "@/lib/estimate/stairsFromSteps";
import { createHash } from "node:crypto";
import { newStairSection } from "@/lib/pricing/tradeScope";
import { computeInstantEstimate, INSTANT_ESTIMATE_DEFAULTS } from "@/lib/estimate/instantEstimate";
import { costingInputsForInstantTrade } from "@/lib/estimate/instantQuoteCosting";
import { buildTradeLineItems } from "@/lib/pricing/tradeScope";
import { measurementRows } from "@/lib/estimate/report/model";
import { choiceFieldsFor, bandIntake } from "@/app/data/funnelBlocks";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The rule at 1, 14 and 30 steps × three shapes");

const EXPECT_POSTS = { straight: 2, L: 4, U: 5 };
const EXPECT_TURNS = { straight: 0, L: 1, U: 2 };
// A flight has one more riser than tread — the top riser rises to the landing,
// which is not a tread — and a turn starts a new flight. So straight = +1,
// L = +2, U = +3. It was `risers === steps` until 2026-09-22; the owner caught
// it on a 25-step L quoted with 25 risers instead of 27.
const EXPECT_RISERS = (steps, shape) => steps + EXPECT_TURNS[shape] + 1;
for (const steps of [1, 14, 30]) {
  for (const shape of STAIR_SHAPES) {
    const d = stairsFromSteps({ steps, shape });
    const rail = Math.round((steps * 11) / 12 + EXPECT_TURNS[shape] * 3);
    ok(
      `${steps} steps, ${shape}: ${steps} treads, ${EXPECT_RISERS(steps, shape)} risers, ${2 * steps} balusters, ${EXPECT_POSTS[shape]} posts, ${rail} ft rail`,
      d &&
        d.treads === steps &&
        d.risers === EXPECT_RISERS(steps, shape) &&
        d.flights === EXPECT_TURNS[shape] + 1 &&
        d.balusters === 2 * steps &&
        d.posts === EXPECT_POSTS[shape] &&
        d.handrailFt === rail &&
        d.shape === shape &&
        d.railingGiven === false,
      d,
    );
  }
}
ok("the default shape is L", DEFAULT_STAIR_SHAPE === "L" && stairsFromSteps({ steps: 14 }).shape === "L");
// The owner's own stair, the one that showed the bug: an L with 25 steps was
// quoted with 25 risers. An L is two flights, so it carries two more risers
// than treads.
{
  const l25 = stairsFromSteps({ steps: 25, shape: "L" });
  ok("25-step L: 25 treads, 27 risers, 50 balusters, 4 newel posts", l25.treads === 25 && l25.risers === 27 && l25.balusters === 50 && l25.posts === 4, l25);
  ok("25-step straight: 26 risers (one flight)", stairsFromSteps({ steps: 25, shape: "straight" }).risers === 26);
  ok("25-step U: 28 risers (three flights)", stairsFromSteps({ steps: 25, shape: "U" }).risers === 28);
  ok("a U's newel posts stay inside the owner's 4-to-6 rule", stairsFromSteps({ steps: 25, shape: "U" }).posts >= 4 && stairsFromSteps({ steps: 25, shape: "U" }).posts <= 6, stairsFromSteps({ steps: 25, shape: "U" }).posts);
  ok("risers are never fewer than treads, at any step count or shape", [1, 2, 7, 25, 200].every((n) => STAIR_SHAPES.every((sh) => stairsFromSteps({ steps: n, shape: sh }).risers > n)));
}
ok("a typed railing wins over the estimate", stairsFromSteps({ steps: 14, railingFt: 22 }).handrailFt === 22 && stairsFromSteps({ steps: 14, railingFt: 22 }).railingGiven === true);
ok("a fractional step count floors", stairsFromSteps({ steps: 14.7 }).treads === 14);
ok("a string step count parses", stairsFromSteps({ steps: "14" }).treads === 14);
ok("the note names the steps and the shape", stairsDerivationNote(stairsFromSteps({ steps: 14 })) === "estimated from 14 steps, L-shape");
ok("...and says 'straight' for a straight run", stairsDerivationNote(stairsFromSteps({ steps: 14, shape: "straight" })) === "estimated from 14 steps, straight");

section("2. Garbage in → nothing");
for (const bad of [null, undefined, "14", 14, [], {}, { steps: 0 }, { steps: -3 }, { steps: "x" }, { steps: NaN }, { steps: Infinity }, { steps: 201 }, { steps: 1e400 }]) {
  ok(`${JSON.stringify(bad)} → null`, stairsFromSteps(bad) === null);
}
ok("an unknown shape falls to the default, not to a crash", stairsFromSteps({ steps: 5, shape: "spiral" }).shape === "L");
ok("shape spellings: 'l', 'u-shape', '─' and 'I' resolve", stairShape("l") === "L" && stairShape("u-shape") === "U" && stairShape("─") === "straight" && stairShape("I") === "straight");
ok("a non-string shape is the default", stairShape(7) === "L" && stairShape(null) === "L" && stairShape({}) === "L");
ok("a negative railing is ignored, not believed", stairsFromSteps({ steps: 14, railingFt: -5 }).railingGiven === false);
ok("a railing of '1e400' is ignored", stairsFromSteps({ steps: 14, railingFt: "1e400" }).railingGiven === false);
ok("the result is a fresh object each call", stairsFromSteps({ steps: 3 }) !== stairsFromSteps({ steps: 3 }));

// ═══════════════════════════════════════════════════════════════════════════
section("3. The instant estimate for a 14-step L stair carries the four derived lines");

const cfg = { ...INSTANT_ESTIMATE_DEFAULTS.stair, enabled: true };
const est = computeInstantEstimate({ trade: "stair", measurements: { treads: 14, shape: "L" }, materialKey: "standard", config: cfg });
ok("it prices", est.ok, est);
const labels = (est.breakdown || []).map((b) => b.label);
ok("treads line", labels.some((l) => /^14 treads/.test(l)), labels);
ok("risers line: 14 treads on an L is 16 risers", labels.includes("16 risers"), labels);
ok("balusters line: 28", labels.includes("28 balusters"), labels);
ok("posts line: 4", labels.includes("4 newel posts"), labels);
ok("handrail line: round(14 × 11 / 12 + 3) = 16 ft", labels.includes("Handrail (16 ft)"), labels);
ok("the range is still a range", est.low < est.high && est.low <= est.point && est.point <= est.high, est);
const lines = (est.breakdown || []).map((b) => b.amount);
ok("the lines add up to the point (before the $10 rounding)", Math.abs(lines.reduce((a, b) => a + b, 0) - est.point) <= 10, { lines, point: est.point });
ok("the assumption states the derivation", /28 balusters, 4 newel posts and ~16 ft of handrail — estimated from 14 steps, L-shape/.test(est.assumptions?.[0] || ""), est.assumptions);
ok("the derived counts ride along for the draft", est.derived?.balusters === 28 && est.derived?.posts === 4 && est.derived?.shape === "L");
const u = computeInstantEstimate({ trade: "stair", measurements: { treads: 14, shape: "U" }, materialKey: "standard", config: cfg });
ok("a U stair prices one more post and three more feet of rail", u.point > est.point && u.breakdown.some((b) => b.label === "5 newel posts"));
const typedRail = computeInstantEstimate({ trade: "stair", measurements: { treads: 14, shape: "L", railingFt: 30 }, materialKey: "standard", config: cfg });
ok("a typed railing replaces the estimated feet and is not called estimated", typedRail.breakdown.some((b) => b.label === "Handrail (30 ft)") && !/ft of handrail/.test(typedRail.assumptions[0]));
ok("a zeroed post rate drops the posts line rather than billing $0", !computeInstantEstimate({ trade: "stair", measurements: { treads: 14 }, materialKey: "standard", config: { ...cfg, postPrice: 0 } }).breakdown.some((b) => /posts/.test(b.label)));
ok("no shape at all is L", computeInstantEstimate({ trade: "stair", measurements: { treads: 14 }, materialKey: "standard", config: cfg }).point === est.point);

// ═══════════════════════════════════════════════════════════════════════════
section("4. The draft's takeoff carries the counts, switched on, with the note");

const costing = costingInputsForInstantTrade("stair", null, { treads: 14, shape: "L" }, { categoryKey: "stairs" });
const sec = costing.takeoff?.sections?.[0];
ok("one staircase section", Boolean(sec), costing);
ok("treads 14, risers 16, balusters 28, posts 4, handrail 16", sec?.treads === 14 && sec?.risers === 16 && sec?.balusters === 28 && sec?.posts === 4 && sec?.handrailFt === 16, sec);
ok("risers, balusters and posts are switched ON so they price", sec?.paintRisers === true && sec?.paintBalusters === true && sec?.paintPosts === true);
ok("the note says 'estimated from 14 steps, L-shape' and to adjust after the photos", /estimated from 14 steps, L-shape — adjust after the photos/.test(sec?.notes || ""), sec?.notes);
ok("the shape is kept on the intake values", costing.intakeValues?.shape === "L");
const built = buildTradeLineItems("stairs", costing.takeoff, null);
ok("the book builds five lines from it (treads, risers, balusters, posts, handrail)", built.length === 5, built.map((l) => l.description || l.label || l.name));
const typed = costingInputsForInstantTrade("stair", null, { treads: 14, shape: "L", railingFt: 20 }, { categoryKey: "stairs" });
ok("a typed railing is carried as typed and the note does not call it estimated", typed.takeoff.sections[0].handrailFt === 20 && !/and handrail/.test(typed.takeoff.sections[0].notes));

// ═══════════════════════════════════════════════════════════════════════════
section("5. The report shows the assumed counts");

const rows = measurementRows("stair", { treads: 14, shape: "L" }, "en");
const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
ok("treads", byLabel.Treads === "14", rows);
ok("shape", byLabel.Shape === "L-shape", rows);
ok("balusters, marked as assumed", byLabel.Balusters === "28 — assumed from 14 steps, L-shape", rows);
ok("posts, marked as assumed", byLabel["Newel posts"] === "4 — assumed from 14 steps, L-shape", rows);
ok("handrail, marked as assumed", byLabel.Handrail === "16 ft — assumed from 14 steps, L-shape", rows);
const rowsTyped = measurementRows("stair", { treads: 14, shape: "L", railingFt: 20 }, "en");
ok("a typed handrail is not marked as assumed", rowsTyped.find((r) => r.label === "Handrail")?.value === "20 ft");
ok("French and Spanish rows exist and are not English", measurementRows("stair", { treads: 14 }, "fr").some((r) => r.label === "Barreaux") && measurementRows("stair", { treads: 14 }, "es").some((r) => r.label === "Balaustres"));

// ═══════════════════════════════════════════════════════════════════════════
section("6. The intake: funnel step and public form");

const choice = choiceFieldsFor("stair").find((c) => c.key === "shape");
ok("the funnel step offers the shape as a choice", Boolean(choice) && choice.options.join(",") === "straight,L,U", choice);
ok("the band's intake carries the step's shape", bandIntake({ assumptions: { shape: "U" } }, { values: { treads: 14 } }).shape === "U");
const FLOW = read("app/instant-quote/[companySlug]/InstantQuoteFlow.js");
ok("the public form asks the shape, L preselected", /key: "shape",[\s\S]*?defaultValue: "L"/.test(FLOW));
ok("...as a select with the three shapes", /\[\["straight", "stairStraight"\], \["L", "stairL"\], \["U", "stairU"\]\]/.test(FLOW));
const COPY = read("lib/i18n/instantQuoteCopy.js");
ok("the shape words exist in en, fr and es", (COPY.match(/stairStraight:/g) || []).length === 3 && (COPY.match(/stairShape:/g) || []).length === 3);
const SERVER = read("lib/estimate/instantQuoteServer.js");
ok("the server reads the shape through stairShape()", /shape: stairShape\(input\?\.intake\?\.shape\)/.test(SERVER));

// ═══════════════════════════════════════════════════════════════════════════
section("7. The builder's staircase form fills from the step count and leaves every field editable");

const TAKEOFF = read("app/components/quotes/builder/TradeTakeoff.js");
ok("a FillFromSteps control exists", /function FillFromSteps\(/.test(TAKEOFF));
ok("...rendered inside the staircase section", /<FillFromSteps/.test(TAKEOFF));
ok("...that calls the one rule, not a copy of it", /stairsFromSteps\(\{ steps, shape \}\)/.test(TAKEOFF) && !/balusters: 2 \* /.test(TAKEOFF));
ok("...offers the three shapes as ─ / L / U", /STAIR_SHAPE_GLYPHS = \{ straight: "─", L: "L", U: "U" \}/.test(TAKEOFF));
ok("...defaults to L", /useState\(DEFAULT_STAIR_SHAPE\)/.test(TAKEOFF));
// No Fill button (owner, 2026-09-22): the step box and the shape fill at once.
ok("there is no Fill button any more", !/stairs-fill-apply/.test(TAKEOFF));
ok("typing the step count fills", /onChange=\{\(e\) => fill\(e\.target\.value, shape\)\}/.test(TAKEOFF));
ok("changing the shape fills", /onClick=\{\(\) => fill\(steps, key\)\}/.test(TAKEOFF));
ok("the fill goes through stairFillPatch, the one rule for what is the fill's to write", /stairFillPatch\(section, d, last\)/.test(TAKEOFF));
ok("it says it filled, and offers Undo", /app\.takeoff\.stairsFilledFrom/.test(TAKEOFF) && /data-testid="stairs-fill-undo"/.test(TAKEOFF));
// The fields stay the same editable boxes: the fill goes through set(), which
// merges into the section the STAIR_ELEMENTS inputs read and write.
ok("the fill goes through the same set() the inputs use", /onPatch=\{\(patch\) => set\(patch\)\}/.test(TAKEOFF));

// ── The rule, executed ────────────────────────────────────────────────────
{
  const fresh = newStairSection("Main Staircase");
  const d14 = stairsFromSteps({ steps: 14, shape: "L" });
  // What the Fill button wrote, verbatim, before it was removed.
  const buttonPatch = {
    treads: d14.treads, risers: d14.risers, balusters: d14.balusters, posts: d14.posts, handrailFt: d14.handrailFt,
    paintRisers: true, paintBalusters: true, paintPosts: true,
  };
  const first = stairFillPatch(fresh, d14, null);
  const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");
  ok("on a fresh section the automatic fill writes exactly what the Fill button did (md5)",
    md5({ ...fresh, ...first.patch }) === md5({ ...fresh, ...buttonPatch }), first.patch);
  const priced = (s) => buildTradeLineItems("stairs", { sections: [s] }, null);
  ok("...so the priced lines are byte-identical", md5(priced({ ...fresh, ...first.patch })) === md5(priced({ ...fresh, ...buttonPatch })));

  // 1 then 14: the second fill replaces the first's own numbers.
  const d1 = stairsFromSteps({ steps: 1, shape: "L" });
  const a = stairFillPatch(fresh, d1, null);
  const s1 = { ...fresh, ...a.patch };
  const b = stairFillPatch(s1, d14, a.filled);
  ok("typing 1 then 14 ends at 14's counts", b.patch.treads === 14 && b.patch.risers === d14.risers && b.patch.balusters === 28, b.patch);

  // A box typed over is left alone; the rest follow.
  const typed = { ...fresh, ...first.patch, treads: 13, paintBalusters: false };
  const d20 = stairsFromSteps({ steps: 20, shape: "L" });
  const c = stairFillPatch(typed, d20, first.filled);
  ok("a count typed over is not overwritten", !("treads" in c.patch), c.patch);
  ok("...the counts not typed over follow the new step count", c.patch.risers === d20.risers && c.patch.balusters === 40, c.patch);
  ok("a part switched off after a fill stays off", !("paintBalusters" in c.patch), c.patch);
  ok("...and one still on stays on", c.patch.paintRisers === true, c.patch);
  ok("a count typed before any fill is left alone too",
    !("posts" in stairFillPatch({ ...fresh, posts: 6 }, d14, null).patch));
  ok("a box cleared to 0 is the fill's again",
    stairFillPatch({ ...typed, treads: 0 }, d20, first.filled).patch.treads === 20);

  // Shape change: posts and handrail move, treads stay.
  const u = stairFillPatch({ ...fresh, ...first.patch }, stairsFromSteps({ steps: 14, shape: "U" }), first.filled);
  ok("changing L → U refills posts (4 → 5)", u.patch.posts === 5, u.patch);

  // Undo: the snapshot is the boxes as they were.
  ok("Undo's snapshot is the eight fillable boxes as they stood", JSON.stringify(
    stairFillSnapshot(fresh)) === JSON.stringify(
    { treads: 0, risers: 0, balusters: 0, posts: 0, handrailFt: 0, paintRisers: false, paintBalusters: false, paintPosts: false }));

  // Hostile.
  ok("no derived stair (bad step count) writes nothing", Object.keys(stairFillPatch(fresh, stairsFromSteps({ steps: "abc" }), null).patch).length === 0);
  ok("a junk section or junk `last` does not throw",
    (() => { try { stairFillPatch(null, d14, "junk"); stairFillPatch("x", d14, 7); stairFillSnapshot(undefined); return true; } catch { return false; } })());
}
ok("no field is disabled or read-only after a fill", !/readOnly|disabled=\{filled/.test(TAKEOFF.slice(TAKEOFF.indexOf("function StairSection"), TAKEOFF.indexOf("function StairsTakeoff"))));
const MSGS = readFileSync(join(ROOT, "app/i18n/appMessages.js"), "utf8");
// The preview sentence names the risers as their own figure. It read
// "{treads} treads and risers" — one number for two counts that are no longer
// equal — which is how the owner read 25 risers off a 27-riser stair.
ok("the fill preview names treads and risers separately, in every language", (MSGS.match(/"app\.takeoff\.stairsFillPreview": "[^"]*\{treads\}[^"]*\{risers\}/g) || []).length === 9);
ok("the form passes risers to the preview", /risers: derived\.risers/.test(TAKEOFF));
ok("the form prints the one-line reason under it", /app\.takeoff\.stairsRiserHint/.test(TAKEOFF));

for (const key of ["stairsFillTitle", "stairsSteps", "stairsShape", "stairsFilledFrom", "stairsFillUndo", "stairsFillPreview", "stairsRiserHint", "stairsShape_straight", "stairsShape_L", "stairsShape_U"]) {
  ok(`app.takeoff.${key} is in nine languages`, (MSGS.match(new RegExp(`"app\\.takeoff\\.${key}":`, "g")) || []).length === 9);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
