// scripts/check-tour-anchor.mjs
//
//   npm run check:tour-anchor
//
// There are two tours in this product and they looked nothing alike.
//
// The contractor's first-visit walkthrough (app/components/OnboardingTour.js)
// dimmed the page, drew a ring around one control and put a card beside it.
// The sales portal's eighteen-step induction drew a panel in the bottom-left
// corner of the screen. The owner opened the sales portal and said, correctly,
// that it "doesn't look like the fieldquo.com/app tours that we are offering to
// companies" — and separately could not find it at all, because a 288px pill in
// the corner of a 1349px screen is not a first-run tour, it is a button.
//
// The fix was not to restyle one to match the other by eye. lib/tours/anchor.js
// now owns the placement, the ring and the target lookup, and BOTH import it —
// AGENTS.md failure class #4, because the copy nobody looks at is the one that
// rots.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// cardPosition is pure — a rect and a viewport in, a style out — so every case
// below runs the shipped function. The one that matters is a target near the
// BOTTOM of a phone: the version this was lifted from always placed the card
// below and clamped to `innerHeight - 180`, which put the card on top of the
// thing it was describing.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Eight mutations, all caught, each restored from a `cp` backup named by the
// file's full path. One escaped on the first pass and is worth recording: the
// assertion that the sales tour opens itself searched the whole file for
// `setOpen(true)`, and the launcher button calls that too — so deleting the
// auto-open entirely still passed. It is matched inside the first-run branch
// now. A check that can be satisfied by a different line doing something else
// is not a check on the line you meant.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  cardPosition,
  spotlightStyle,
  CARD_WIDTH,
  CARD_HEIGHT_ESTIMATE,
  MARGIN,
} from "@/lib/tours/anchor";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
  return Boolean(cond);
}
const section = (t) => console.log(`\n${t}\n`);

function decomment(src) {
  let out = ""; let i = 0; let state = "code";
  while (i < src.length) {
    const c = src[i]; const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += "\n"; i++; continue; }
      out += " "; i++; continue;
    }
    if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
    out += c === "\n" ? "\n" : " "; i++;
  }
  return out;
}

const PHONE = { width: 375, height: 667 };
const DESKTOP = { width: 1349, height: 896 };
const rect = (top, left, h = 40, w = 200) => ({ top, left, bottom: top + h, width: w, height: h });

// ═══════════════════════════════════════════════════════════════════════════
section("1. The card never covers the thing it is describing");
// ═══════════════════════════════════════════════════════════════════════════

{
  // THE bug. A tab near the bottom of a phone.
  const low = cardPosition(rect(600, 20), PHONE);
  ok("a low target puts the card above it", low.placement === "above", low);
  ok("…and the card ends before the target starts", low.style.top + CARD_HEIGHT_ESTIMATE <= 600, low.style.top);

  const high = cardPosition(rect(80, 20), PHONE);
  ok("a high target puts the card below it", high.placement === "below", high);
  ok("…starting after the target ends", high.style.top >= 120, high.style.top);

  // Nothing to point at is a real state: the step's tab is not on this route.
  const none = cardPosition(null, PHONE);
  ok("no target centres the card", none.centred === true);
  ok("…horizontally", Math.abs(none.style.left + none.style.width / 2 - PHONE.width / 2) < 1, none.style);
  ok("a NaN rect is treated as no target", cardPosition({ top: NaN, left: 0, bottom: 0, width: 0, height: 0 }, PHONE).centred === true);
  ok("an undefined rect too", cardPosition(undefined, PHONE).centred === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. It always lands inside the viewport");
// ═══════════════════════════════════════════════════════════════════════════

{
  const cases = [
    ["a target off the right edge", rect(100, 9000), PHONE],
    ["a target off the left edge", rect(100, -500), PHONE],
    ["a target below the fold", rect(5000, 20), PHONE],
    ["a target above the fold", rect(-800, 20), PHONE],
    ["a zero-size viewport", rect(10, 10), { width: 0, height: 0 }],
    ["a viewport shorter than the card", rect(10, 10), { width: 375, height: 120 }],
    ["a desktop tab", rect(60, 300), DESKTOP],
  ];
  for (const [name, r, vp] of cases) {
    const { style } = cardPosition(r, vp);
    const finite = Number.isFinite(style.top) && Number.isFinite(style.left) && Number.isFinite(style.width);
    ok(`${name} → finite numbers`, finite, style);
    ok(`${name} → never negative`, style.top >= 0 && style.left >= 0 && style.width >= 0, style);
    // The right edge may only overflow when the viewport is narrower than the
    // card plus its margins, which is arithmetic, not a placement mistake.
    const fits = vp.width >= CARD_WIDTH + MARGIN * 2;
    if (fits) ok(`${name} → right edge inside the viewport`, style.left + style.width <= vp.width, [style, vp]);
  }
  ok("the width never exceeds the card width", cardPosition(rect(10, 10), DESKTOP).style.width === CARD_WIDTH);
  ok("…and shrinks on a narrow screen", cardPosition(rect(10, 10), { width: 200, height: 600 }).style.width < CARD_WIDTH);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. One element is the ring AND the dim");
// ═══════════════════════════════════════════════════════════════════════════

{
  const s = spotlightStyle(rect(100, 50));
  // Stacking a separate dimmer over this makes the page twice as dark on
  // exactly the steps that work.
  ok("the ring carries the dim", /9999px/.test(String(s.boxShadow)), s.boxShadow);
  ok("…which is a dim, not black", /rgba\(0,0,0,0\.\d+\)/.test(String(s.boxShadow)), s.boxShadow);
  ok("it is padded outside the target", s.top < 100 && s.left < 50);
  ok("…on all four sides", s.width > 200 && s.height > 40);
  ok("no target draws nothing", spotlightStyle(null) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Both tours use it, and neither kept its own copy");
// ═══════════════════════════════════════════════════════════════════════════

{
  for (const f of ["app/components/OnboardingTour.js", "app/components/sales/SalesTour.js"]) {
    const src = decomment(read(f));
    ok(`${f} imports the shared module`, /from "@\/lib\/tours\/anchor"/.test(src));
    ok(`  …and uses cardPosition`, /cardPosition\(/.test(src));
    ok(`  …and spotlightStyle`, /spotlightStyle\(rect\)/.test(src));
    // The whole point: no second implementation left behind to drift.
    ok(`  …and defines no visibleTarget of its own`, !/function visibleTarget\(/.test(src));
    ok(`  …nor its own placement maths`, !/9999px/.test(src), f);
    // A style object carrying `centred` makes React warn on every render.
    ok(`  …and takes only the style off it`, /\{ style: \w+ \} = cardPosition/.test(src));
  }

  const sales = decomment(read("app/components/sales/SalesTour.js"));
  // The discoverability fix. A first-run tour that waits to be found is not one.
  // Matched INSIDE the first-run branch, not anywhere in the file. The
  // launcher button also calls setOpen(true), so a bare search for it passed
  // happily with the auto-open deleted — which is the whole behaviour this
  // section exists to protect.
  const firstRun = sales.slice(
    sales.indexOf("const untouched ="),
    sales.indexOf("return () => {", sales.indexOf("const untouched =")),
  );
  ok("the first-run branch was found", firstRun.length > 80, firstRun.length);
  ok("…and it opens the tour", /setOpen\(true\)/.test(firstRun), firstRun.slice(-200));
  ok("…only when untouched", /!data\?\.dismissed && !data\?\.completed && !data\?\.step/.test(firstRun));
  ok("…once per browser session", /sessionStorage\.setItem\(FIRST_RUN_KEY/.test(firstRun));
  ok("…and survives storage being blocked", /catch \{/.test(sales));
  // It must NOT become a modal: it walks twelve routes and the rep has to be
  // able to click the tab it is describing.
  ok("the spotlight never intercepts a click", /pointer-events-none/.test(sales));
  ok("…and the tour is not a modal", !/aria-modal/.test(sales));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:tour-anchor is a script", typeof pkg.scripts?.["check:tour-anchor"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:tour-anchor"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
