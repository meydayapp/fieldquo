// scripts/check-sales-tour.mjs
//
//   npm run check:sales-tour
//
// The guided tour of the sales portal, asserted against the portal.
//
// ══ Why this check is the whole point of the feature ══════════════════════
//
// A tour is teaching. Every other screen in this product is read by somebody
// who can tell when it is wrong — a rep who opens Voicemail and finds no
// messages knows there are no messages. A tour step that names a tab which is
// not there is read by somebody on their FIRST MORNING, who has no way to tell
// "the product is broken" from "I am not finding it", and who will go looking
// for a screen that does not exist while being told this is how the job works.
// That is AGENTS.md's leading rule — never ship a control that appears to work
// and doesn't — in its most expensive form.
//
// It is not hypothetical. The portal's nav gained Demo, Support, Voicemail and
// Pay inside a fortnight, and app/components/tours.js carries a comment about
// the same trap in the contractor app: its welcome tour pointed at the Leads
// item and CALLED IT "Requests", because somebody read the message key instead
// of the rendered string. A tour written from memory is a tour that has already
// started rotting.
//
// So section 2 below reads app/sales/SalesShell.js's own tab array and refuses
// any step whose route is not in it, or whose label is not the label that tab
// actually draws. Everything else here is supporting work.
//
// ══ Judged by exit code ═══════════════════════════════════════════════════
//
// Every assertion goes through ok(); the process exits 1 if any failed. Do not
// read a run by grepping for FAIL — several checks in this repo were fooled
// today by matching their own header prose, and one mutation crashed a runner
// before it printed anything, which reads exactly like a pass.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SALES_TOUR_STEPS, SALES_TOUR_LENGTH, clampTourStep, tourStepAt } from "@/app/sales/tourSteps";
import { tourView } from "@/lib/sales/tourProgress";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * The file with its comments stripped.
 *
 * Same helper, and the same reason, as scripts/check-inbound-answer.mjs: the
 * prose in this repository explains at length what each file must not do, so a
 * regex over a raw read can be satisfied by a comment ABOUT the rule instead of
 * by the rule. That is especially true here — the hardcoded-English scan in
 * section 4 would otherwise fail on this very file's own header.
 */
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

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
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. There is a tour, and it covers the portal");
// ═══════════════════════════════════════════════════════════════════════════

ok("the step list is not empty", SALES_TOUR_LENGTH > 0, SALES_TOUR_LENGTH);
ok("SALES_TOUR_LENGTH agrees with the array", SALES_TOUR_LENGTH === SALES_TOUR_STEPS.length);

{
  const keys = SALES_TOUR_STEPS.map((s) => s.key);
  ok("every step has a unique key", new Set(keys).size === keys.length, keys);
  ok(
    "every step declares a route, a title key and a body key",
    SALES_TOUR_STEPS.every(
      (s) =>
        typeof s.href === "string" &&
        s.href.startsWith("/sales") &&
        typeof s.titleKey === "string" &&
        typeof s.bodyKey === "string",
    ),
  );
  // Exactly one label source. Both would let the two drift and the component
  // pick a winner; neither leaves the "Open …" button with nothing to say.
  ok(
    "each step names its tab EITHER by key OR by literal, never both and never neither",
    SALES_TOUR_STEPS.every((s) => Boolean(s.tabLabel) !== Boolean(s.tabLabelKey)),
    SALES_TOUR_STEPS.filter((s) => Boolean(s.tabLabel) === Boolean(s.tabLabelKey)).map((s) => s.key),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. EVERY step points at a control that is actually there");
// ═══════════════════════════════════════════════════════════════════════════
//
// The assertion this file exists for. The shell's tab array is the single
// source of what the portal HAS; anything the tour names that is not in it is
// a step teaching a screen that does not exist.

const shell = read("app/sales/SalesShell.js");
const shellCode = decomment(shell);

/**
 * The tabs SalesShell renders: `{ href, label }` where label is either a t()
 * key or an English literal, matching how the shell draws it.
 *
 * Parsed out of the source rather than imported, because SalesShell is a client
 * component that calls React hooks at module scope of its render — importing it
 * under bare node is not possible, and hand-copying the list here would create
 * exactly the second copy that rots.
 */
const shellTabs = [
  ...shellCode.matchAll(
    /\{\s*href:\s*"([^"]+)"\s*,\s*label:\s*(?:t\("([^"]+)"\)|"([^"]+)")\s*\}/g,
  ),
].map((m) => ({ href: m[1], labelKey: m[2] || null, labelLiteral: m[3] || null }));

ok("the shell's tab list was parsed", shellTabs.length >= 10, shellTabs.length);
// A guard on the parse itself. If the shell's formatting changes so that this
// regex matches nothing, every assertion below would pass vacuously against an
// empty list — which is the shape of failure that makes a check reassuring and
// useless. The tabs the brief calls new are named explicitly for the same
// reason: they are the ones a tour written from memory would have missed.
for (const href of ["/sales", "/sales/queue", "/sales/voicemail", "/sales/support", "/sales/pay"]) {
  ok(`…and it contains ${href}`, shellTabs.some((tb) => tb.href === href), shellTabs.map((tb) => tb.href));
}

for (const step of SALES_TOUR_STEPS) {
  const tab = shellTabs.find((tb) => tb.href === step.href);
  ok(`step "${step.key}" targets a route the shell has (${step.href})`, Boolean(tab), {
    href: step.href,
    shell: shellTabs.map((tb) => tb.href),
  });
  if (!tab) continue;
  // And it must call that tab what the tab calls itself. A step that names the
  // Queue tab "Prospects" sends a rep hunting for a word that is not on screen,
  // in whatever language they read — this is the exact failure the contractor
  // app's welcome tour shipped with.
  ok(
    `…and step "${step.key}" names it the way the shell draws it`,
    step.tabLabelKey ? step.tabLabelKey === tab.labelKey : step.tabLabel === tab.labelLiteral,
    { step: step.tabLabelKey || step.tabLabel, shell: tab.labelKey || tab.labelLiteral },
  );
}

// The ring the panel draws needs an anchor on those links, and the anchor is
// the href itself so there is no third vocabulary to keep in step.
ok(
  "the shell tags its tabs for the tour to point at",
  /data-sales-tour=\{tab\.href\}/.test(shellCode),
);
ok("…and the shell mounts the tour", /<SalesTour\s*\/>/.test(shellCode));
ok(
  "…and the tour looks the anchor up by the step's href",
  /\[data-sales-tour="\$\{current[^}]*\.href\}"\]/.test(decomment(read("app/components/sales/SalesTour.js"))),
);

// Every tab is taught. The owner asked for a tour "going over each piece", and
// a tab nothing explains is a piece a new rep is left to work out alone.
for (const tab of shellTabs) {
  ok(
    `the tour explains ${tab.href}`,
    SALES_TOUR_STEPS.some((s) => s.href === tab.href),
    SALES_TOUR_STEPS.map((s) => s.href),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every string is a translation key that resolves");
// ═══════════════════════════════════════════════════════════════════════════

{
  const KEY_RE = /^app\.salesTour\.[A-Za-z0-9]+$/;
  for (const step of SALES_TOUR_STEPS) {
    for (const field of ["titleKey", "bodyKey"]) {
      const value = step[field];
      ok(`step "${step.key}" ${field} is an app.salesTour.* key`, KEY_RE.test(String(value)), value);
      ok(`…and "${value}" has an English string`, value in APP_MESSAGES.en);
      // French is GATED in check:translations — a missing French app key puts an
      // English sentence in the middle of an otherwise French screen. Asserted
      // here too so a tour string added without one fails at the tour's own
      // check rather than at a catalogue-wide one nobody connects to this file.
      ok(`…and a French one`, value in APP_MESSAGES.fr);
    }
  }
  // The chrome, which no step names and which a key-by-key scan of the steps
  // would therefore miss entirely.
  for (const k of ["title", "launch", "resume", "goTo", "dismiss", "saveFailed"]) {
    ok(`the panel's "${k}" string exists in English`, `app.salesTour.${k}` in APP_MESSAGES.en);
    ok(`…and in French`, `app.salesTour.${k}` in APP_MESSAGES.fr);
  }
  // The placeholders the component interpolates. A key whose translation lost
  // its {tab} renders "Open " with nothing after it.
  ok("the goTo string carries a {tab} placeholder in every language it has",
    ["en", "fr", "es", "de", "it"].every((l) => String(APP_MESSAGES[l]["app.salesTour.goTo"]).includes("{tab}")),
  );
  ok("the resume string carries {n} and {total}",
    ["en", "fr", "es", "de", "it"].every((l) => {
      const v = String(APP_MESSAGES[l]["app.salesTour.resume"]);
      return v.includes("{n}") && v.includes("{total}");
    }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. No hardcoded English reaches the screen");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner's ask was a tour "in the language they select when they create the
// account". That promise does not break by being abandoned; it breaks by one
// hurried string. app/components/tours.js records the same regression in the
// contractor app — English sentences sat in `title`/`body` for months and every
// account read the tour in English regardless of the language it had picked.

{
  const tour = decomment(read("app/components/sales/SalesTour.js"));

  // Text nodes: anything between > and < that contains letters and is not a
  // JSX expression. `{t("…")}` and `{variable}` are expressions and do not
  // match; a bare sentence does.
  const textNodes = [...tour.matchAll(/>\s*([A-Za-z][A-Za-z ,.'’!?-]{2,})\s*</g)].map((m) =>
    m[1].trim(),
  );
  ok("no bare English text node in the panel", textNodes.length === 0, textNodes);

  // User-facing string ATTRIBUTES. aria-label and title are read aloud and
  // shown on hover, so an English literal there is just as visible as one in
  // the body — and it is the shape that slips past a text-node scan.
  const attrs = [...tour.matchAll(/\b(aria-label|title|placeholder|alt)=("([^"]*)")/g)]
    .map((m) => ({ attr: m[1], value: m[3] }))
    .filter((a) => /[A-Za-z]{2}/.test(a.value));
  ok("no English literal in an aria-label, title, placeholder or alt", attrs.length === 0, attrs);

  // The steps array itself: the field that used to hold a sentence in the
  // contractor app was named `title`, and nothing stops somebody typing one
  // back into `titleKey`. Section 3 catches an unresolvable key; this catches
  // the file shape that produces one.
  const steps = decomment(read("app/sales/tourSteps.js"));
  ok(
    "the step data holds no title/body field that isn't a Key",
    !/\b(title|body):\s*"/.test(steps),
  );

  // The panel resolves at render, which is the only place the rep's language
  // is known.
  ok("the panel resolves its strings with t()", /const \{ t \} = useTranslation\(\)/.test(tour));
  ok("…and resolves each step's own keys", /t\(current\.titleKey\)/.test(tour) && /t\(current\.bodyKey\)/.test(tour));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Resumable, and dismissible, and those are different");
// ═══════════════════════════════════════════════════════════════════════════

{
  // ── The clamp, executed against hostile input ─────────────────────────
  //
  // AGENTS.md's "execute pure functions against hostile input", applied to the
  // one value that comes back out of the database and straight into an array
  // index. `steps[undefined]` is a blank panel with working buttons.
  const last = SALES_TOUR_LENGTH - 1;
  for (const [input, expected] of [
    [0, 0],
    [3, 3],
    [-1, 0],
    [-999, 0],
    [last, last],
    [last + 1, last],
    [9999, last],
    [2.7, 2],
    ["4", 4],
    ["banana", 0],
    [null, 0],
    [undefined, 0],
    [NaN, 0],
    // Infinity is NOT "the last step". Number.isFinite rejects it, so it reads
    // as a broken payload and lands at the beginning — the same answer as
    // "banana". A tour that jumped to the end on a garbage value would tell a
    // new rep they had finished something they had not started.
    [Infinity, 0],
    [-Infinity, 0],
  ]) {
    // String(), not JSON.stringify: JSON.stringify turns Infinity, -Infinity
    // and NaN all into "null" and drops undefined entirely, so three separate
    // failures printed as the same sentence and a fourth printed as nothing.
    // This check's first red was unreadable for exactly that reason.
    ok(`clampTourStep(${String(input)}) === ${expected}`, clampTourStep(input) === expected, clampTourStep(input));
  }
  ok(
    "tourStepAt never hands back a hole",
    [-5, 0, 3, 9999, "x", null, undefined].every((v) => Boolean(tourStepAt(v)?.href)),
  );

  // ── The view, and the three-way dismissed flag ────────────────────────
  ok("no row reads as step 0, not dismissed", (() => {
    const v = tourView(null);
    return v.step === 0 && v.dismissed === false && v.completed === false && v.total === SALES_TOUR_LENGTH;
  })());
  ok("a dismissed row reads as dismissed", tourView({ step: 2, dismissedAt: new Date() }).dismissed === true);
  ok(
    "a stored step past the end is clamped on the way OUT",
    tourView({ step: 9999 }).step === SALES_TOUR_LENGTH - 1,
  );

  const progress = decomment(read("lib/sales/tourProgress.js"));
  // The distinction the panel depends on: pressing Next must not silently
  // un-dismiss a tour the rep told to go away.
  ok(
    "an absent `dismissed` leaves the column alone",
    /dismissed === undefined \? undefined :/.test(progress),
  );
  ok(
    "…and the update omits it entirely in that case",
    /dismissedAt === undefined \? \{\} : \{ dismissedAt \}/.test(progress),
  );
  ok("completion is stamped first-time-only", /completedAt: null/.test(progress) && /updateMany/.test(progress));
  ok("nothing in the writer deletes", !/\.delete\(|\.deleteMany\(/.test(progress));
  // The rep id is the session's, never the body's — the rule
  // lib/sales/preferenceWrite.js states for the same shape of write.
  const route = decomment(read("app/api/sales/tour/route.js"));
  ok("the route takes the rep id from the gate", /salesRepId: rep\.id/.test(route));
  ok("…and never from the body", !/salesRepId: body/.test(route));
  ok("…through requireOutreachRep, the named write exception", /requireOutreachRep/.test(route));

  // ── The panel actually resumes ────────────────────────────────────────
  const tour = decomment(read("app/components/sales/SalesTour.js"));
  ok("the panel reads its position from the server", /fetchJson\("\/api\/sales\/tour"\)/.test(tour));
  ok("…and opens at the stored step", /setStep\(clampTourStep\(data\?\.step\)\)/.test(tour));
  ok("…and writes the step back on every move", /const next = clampTourStep\(to\);[\s\S]{0,80}save\(next\)/.test(tour));
  ok("…and on close, so closing keeps the place", /setOpen\(false\);\s*save\(step\);/.test(tour));
  ok("…and the launcher offers to RESUME once they have started", /app\.salesTour\.resume/.test(tour));
  ok("…and shows nothing at all once dismissed", /if \(progress\.dismissed\) return null;/.test(tour));
  // A save that failed is said out loud rather than swallowed — AGENTS.md
  // failure class #2, whose consequence here is a tour that forgets.
  ok("a failed save is reported, not swallowed", /setSaveFailed\(true\)/.test(tour) && /app\.salesTour\.saveFailed/.test(tour));

  // Storage lives against the rep, server-side, not in the browser. The portal
  // shares an origin with the marketing site, which is how it once came up in
  // German for a rep whose browser had visited fieldquo.com in German.
  ok("the tour keeps no progress in localStorage", !/localStorage/.test(tour));

  const schema = read("prisma/schema.prisma");
  ok("there is a table to store it in", /model SalesRepTourProgress \{/.test(schema));
  ok("…keyed one row per rep", /salesRepId String @unique/.test(schema));
  ok("…with a step, a dismissal and a completion", /step\s+Int @default\(0\)/.test(schema) && /dismissedAt DateTime\?/.test(schema) && /completedAt DateTime\?/.test(schema));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. It stays out of the commission-and-attribution boundary");
// ═══════════════════════════════════════════════════════════════════════════
//
// A tour position could have been two columns on SalesRep. That row is on
// REP_FORBIDDEN_WRITES, so each such column costs a named exemption in
// check:sales-auth plus a fence asserting its key set — and widens "a rep can
// write their own row" by one more entry. Asserted rather than merely decided,
// because the cheap thing to do six months from now is add the column.

{
  const progress = decomment(read("lib/sales/tourProgress.js"));
  ok(
    "the tour writer never touches the salesRep row",
    !/\b(?:db|client|tx|prisma)\.salesRep\.(?:create|update|updateMany|upsert|delete|deleteMany)/.test(progress),
  );
  const route = decomment(read("app/api/sales/tour/route.js"));
  ok("…and neither does its route", !/db\.salesRep\./.test(route));
  // And the gate's list is unchanged by this feature: salesRep stays forbidden.
  const gate = decomment(read("lib/sales/gate.js"));
  ok("salesRep is still on REP_FORBIDDEN_WRITES", /"salesRep",/.test(gate));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Reachable, and wired into the checks");
// ═══════════════════════════════════════════════════════════════════════════

{
  const tour = decomment(read("app/components/sales/SalesTour.js"));
  // Keyboard and focus. A walkthrough somebody cannot drive from the keyboard
  // is a walkthrough for some people.
  ok("the panel handles keys", /onKeyDown=\{onPanelKeyDown\}/.test(tour));
  ok("…Escape closes it", /e\.key === "Escape"/.test(tour));
  ok("…arrows move between steps", /e\.key === "ArrowRight"/.test(tour) && /e\.key === "ArrowLeft"/.test(tour));
  // Bound to the panel and not the window, so it does not steal the arrow keys
  // from a note the rep is typing on the screen underneath.
  ok("…and the listener is not global", !/window\.addEventListener\("keydown"/.test(tour));
  ok("…and typing in a field is left alone", /tag === "INPUT"/.test(tour));
  ok("every control shows focus", (tour.match(/focus-visible:ring/g) || []).length >= 6);
  // Movement is asked about rather than assumed, in the scroll AND in the CSS.
  ok("reduced motion is honoured", /prefers-reduced-motion: reduce/.test(tour) && /motion-reduce:transition-none/.test(tour));
  // It is a helper beside the page, not a wall in front of it.
  ok("it does not trap the rep in a modal", !/aria-modal/.test(tour));
  ok("…and announces the step politely", /aria-live="polite"/.test(tour));

  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-tour is a script", typeof pkg.scripts?.["check:sales-tour"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:sales-tour"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
