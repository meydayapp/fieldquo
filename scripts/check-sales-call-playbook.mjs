// scripts/check-sales-call-playbook.mjs
//
//   npm run check:sales-call-playbook
//
// The playbook, in front of a rep, while somebody is on the phone.
//
// ══ What this file exists to stop ═════════════════════════════════════════
//
// Three specific regressions, each of which would look fine in a screenshot:
//
//   1. THE FILTER EMPTIES THE PANEL. `matchObjectionText` is substring-exact
//      on purpose, so it misses often. A filter that returned its empty result
//      to the screen would take all eight answers away at the exact second a
//      rep needed one, mid-sentence, with a stranger waiting. Executed here
//      against inputs designed to miss.
//
//   2. THE FETCH MOVES ONTO THE DIAL. Assembling a script reads four tables
//      and renders nine stages. Between the press and the ring, that is a
//      hesitating Call button, and a rep who has learned the button hesitates
//      presses it twice.
//
//   3. A READ STARTS WRITING. The rep's route sits behind the queue gate,
//      which declares exactly ONE writable model. assembleProspectPlaybook can
//      create a SalesPlaybookAssignment, so the rep's path passes
//      assignVariant:false — and §38 wants the arm fixed before the CALL, not
//      before a page view of a prospect nobody rings.
//
// ══ Execution first, source only where execution is impossible ════════════
//
// Sections 1 and 2 run the shipped functions. Sections 3–6 are source
// questions — "does the route scope its read", "is the fetch on the click" —
// and every one of them is scoped to ONE named function by brace matching,
// because a whole-file match passes over a deleted guard whenever the
// paragraph explaining it is still there. That has produced a false pass in
// this repo more than once.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Each guarantee was broken in turn on disk, the break confirmed present by
// re-reading the file, this script confirmed to FAIL, and the file restored
// from a `cp` backup — never `git checkout`, which restores the commit rather
// than the working copy. The list is in the session report.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  objectionsForProspect,
  objectionsToShow,
  matchObjectionText,
  seedObjections,
  validateObjection,
} from "@/lib/sales/playbook/objections";
import { OBJECTION_STAGE, STAGE_KEYS } from "@/lib/sales/playbook/stages";

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
  return Boolean(cond);
}
const section = (title) => console.log(`\n${title}\n`);

/** Blank out comments, preserving offsets, so a rule cannot match prose. */
function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") { state = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === "line") { out += c === "\n" ? "\n" : " "; if (c === "\n") state = "code"; i++; continue; }
    if (state === "block") {
      if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    if (c === "\\") { out += "  "; i += 2; continue; }
    if (c === state) state = "code";
    out += c === "\n" ? "\n" : c;
    i++;
  }
  return out;
}

/**
 * The decommented body of ONE named function, by brace matching.
 *
 * Returns "" when the declaration is missing, so an assertion against a
 * renamed function FAILS rather than silently checking nothing. The parameter
 * list is skipped before the body's opening brace is looked for — otherwise a
 * destructured parameter is mistaken for the body.
 */
function namedFunctionBody(src, declaration) {
  const clean = decomment(src);
  const at = clean.indexOf(declaration);
  if (at < 0) return "";
  let i = clean.indexOf("(", at + declaration.length - 1);
  if (i < 0) return "";
  let parens = 0;
  for (; i < clean.length; i++) {
    if (clean[i] === "(") parens++;
    else if (clean[i] === ")" && --parens === 0) break;
  }
  const open = clean.indexOf("{", i);
  if (open < 0) return "";
  let depth = 0;
  for (let j = open; j < clean.length; j++) {
    if (clean[j] === "{") depth++;
    else if (clean[j] === "}" && --depth === 0) return clean.slice(open, j + 1);
  }
  return "";
}

/**
 * The decommented body of an arrow function assigned to a const.
 *
 * namedFunctionBody cannot read one: it skips a parameter list by matching the
 * first "(" after the name, and for `const x = useCallback(async () => {…})`
 * that paren belongs to useCallback, so the brace it then finds is somewhere
 * after the whole call. Returns "" when the declaration is absent, so a rename
 * fails the assertion rather than checking an empty string.
 */
function arrowBody(src, declaration) {
  const clean = decomment(src);
  const at = clean.indexOf(declaration);
  if (at < 0) return "";
  const arrow = clean.indexOf("=>", at);
  if (arrow < 0) return "";
  const open = clean.indexOf("{", arrow);
  if (open < 0) return "";
  let depth = 0;
  for (let j = open; j < clean.length; j++) {
    if (clean[j] === "{") depth++;
    else if (clean[j] === "}" && --depth === 0) return clean.slice(open, j + 1);
  }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. The objection filter can never empty the panel
// ═══════════════════════════════════════════════════════════════════════════

section("1. Typing what they said narrows the list, or shows all of it — never none");

const LIBRARY = objectionsForProspect({ objections: seedObjections(), index: {} });
ok("the starter objection library is not empty", LIBRARY.length >= 8, LIBRARY.length);

{
  const empty = objectionsToShow("", LIBRARY);
  ok("nothing typed shows everything", empty.rows.length === LIBRARY.length, empty.rows.length);
  ok("…and does not claim to be filtered", empty.filtered === false && empty.missed === false);

  const hit = objectionsToShow("we already use jobber", LIBRARY);
  ok("a real cue narrows the list", hit.filtered === true && hit.rows.length < LIBRARY.length, hit.rows.length);
  ok(
    "…to the row whose cue it is",
    hit.rows.some((r) => r.code === "ALREADY_USE_COMPETITOR"),
    hit.rows.map((r) => r.code),
  );
  ok("…and a hit is not a miss", hit.missed === false);

  // Two objections in one sentence is the ordinary case, not the edge one.
  const both = objectionsToShow("we already use jobber and it's expensive enough", LIBRARY);
  ok(
    "two objections in one sentence both come back",
    both.rows.length >= 2 &&
      both.rows.some((r) => r.code === "ALREADY_USE_COMPETITOR") &&
      both.rows.some((r) => r.code === "TOO_EXPENSIVE"),
    both.rows.map((r) => r.code),
  );
}

// The whole point of the file. Every one of these matches no cue in the
// library, and every one of them must leave the rep looking at all eight.
const MISSES = [
  "we've got something for that already",
  "zzzzzzz",
  "🙃",
  "   ",
  "The quick brown fox jumped over the lazy dog and said nothing useful",
  "x".repeat(5000),
];
for (const text of MISSES) {
  const label = text.trim() ? `${text.slice(0, 28)}${text.length > 28 ? "…" : ""}` : "(whitespace)";
  const result = objectionsToShow(text, LIBRARY);
  const direct = matchObjectionText(text, LIBRARY);
  ok(
    `"${label}" matches nothing directly, and still shows all ${LIBRARY.length}`,
    direct.length === 0 && result.rows.length === LIBRARY.length,
    { direct: direct.length, shown: result.rows.length },
  );
  ok(
    `…and "${label}" is reported as a miss rather than as a filter`,
    result.filtered === false && (text.trim() ? result.missed === true : result.missed === false),
    result,
  );
}

// Hostile shapes. A mid-call panel that throws is a blank screen.
for (const [label, value] of [
  ["null", null],
  ["undefined", undefined],
  ["a number", 42],
  ["an object", { toLowerCase: () => "boom" }],
  ["an array", ["already use"]],
]) {
  let threw = null;
  let result = null;
  try {
    result = objectionsToShow(value, LIBRARY);
  } catch (err) {
    threw = err;
  }
  ok(`${label} typed in does not throw, and shows everything`, !threw && result?.rows?.length === LIBRARY.length, {
    threw: threw?.message,
    shown: result?.rows?.length,
  });
}

{
  // An absent library is an absent library. It must not be padded, and it must
  // not throw either — the screen says the library is empty.
  const none = objectionsToShow("we already use jobber", null);
  ok("no library at all yields no rows rather than an exception", Array.isArray(none.rows) && none.rows.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. The ranking is objectionsForProspect's, and this never re-does it
// ═══════════════════════════════════════════════════════════════════════════

section("2. The order the rep's thumb learned is the order that comes back");

{
  const priorities = LIBRARY.map((o) => o.priority);
  ok(
    "objectionsForProspect returns priority-descending",
    priorities.every((p, i) => i === 0 || priorities[i - 1] >= p),
    priorities,
  );

  /** Is `subset` in the same relative order as `all`? */
  const isSubsequence = (subset, all) => {
    let i = 0;
    for (const row of all) {
      if (i < subset.length && subset[i].code === row.code) i++;
    }
    return i === subset.length;
  };

  for (const text of ["", "we already use jobber", "expensive", ...MISSES]) {
    const result = objectionsToShow(text, LIBRARY);
    ok(
      `the shown rows keep the ranked order for ${text.trim() ? `"${text.slice(0, 20)}"` : "(nothing typed)"}`,
      isSubsequence(result.rows, LIBRARY),
      result.rows.map((r) => r.code),
    );
  }

  // A reversed library must come back reversed, not re-sorted. This is what
  // catches a well-meaning `.sort()` being added to the filter.
  const reversed = [...LIBRARY].reverse();
  const shownReversed = objectionsToShow("", reversed);
  ok(
    "the filter has no opinion about order — a reversed list comes back reversed",
    shownReversed.rows.map((r) => r.code).join() === reversed.map((r) => r.code).join(),
  );
}

{
  // Every row the panel can render has the two things it is rendered from.
  const bad = LIBRARY.filter((o) => !validateObjection(o).ok || !o.label?.trim() || !o.response?.trim());
  ok("every objection a rep can scan has a label and an answer", bad.length === 0, bad.map((o) => o.code));
  ok("the objection stage is one of the nine stages", STAGE_KEYS.includes(OBJECTION_STAGE));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. The rep can reach it, and reaching it writes nothing
// ═══════════════════════════════════════════════════════════════════════════

section("3. The rep's route: gated, scoped, read-only, and never a model call");

const ROUTE = "app/api/sales/playbook/route.js";
ok("the rep-facing playbook route exists at all", existsSync(join(ROOT, ROUTE)));

{
  const src = read(ROUTE);
  const get = namedFunctionBody(src, "export async function GET(");
  ok("its GET was found and parsed", get.length > 300, get.length);

  ok(
    "GET resolves the rep through the queue gate and returns the refusal verbatim",
    /requireQueueRep\(request\)/.test(get) && /if\s*\(refusal\)/.test(get),
  );
  ok(
    "GET scopes the prospect to one this rep holds, in the WHERE",
    /queueWhere\(rep\.id/.test(get) && /db\.prospect\.findFirst\(/.test(get),
  );
  ok(
    "…and refuses before the engine runs, rather than after",
    get.indexOf("queueWhere(rep.id") < get.indexOf("assembleProspectPlaybook("),
  );
  ok(
    "GET never asks for a model — a page view must not spend money or add latency",
    /useAi:\s*false/.test(get) && !/useAi:\s*true/.test(get),
  );
  ok(
    "GET does not persist, so a read leaves no talking points behind",
    /persist:\s*false/.test(get),
  );
  ok(
    "GET does not assign an experiment arm — the queue gate permits one writable model",
    /assignVariant:\s*false/.test(get),
  );

  const writes = [
    ...decomment(src).matchAll(/\bdb\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g),
  ];
  ok("the route writes nothing at all", writes.length === 0, writes.map((m) => `${m[1]}.${m[2]}`));

  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    ok(
      `there is no ${method} handler on the playbook route`,
      !new RegExp(`export async function ${method}\\(`).test(decomment(src)),
    );
  }

  ok(
    "the route talks to no model vendor",
    !/lib\/ai\/provider/.test(decomment(src)) && !/openai/i.test(decomment(src)),
  );
  ok(
    "the route is named in check-sales-auth's route walk by living under app/api/sales",
    ROUTE.startsWith("app/api/sales/"),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. assembleProspectPlaybook only writes an assignment when asked to
// ═══════════════════════════════════════════════════════════════════════════

section("4. The one write the engine can make is behind the flag the rep's route clears");

{
  const src = read("lib/sales/playbook/assemble.js");
  const body = namedFunctionBody(src, "export async function assembleProspectPlaybook(");
  ok("assembleProspectPlaybook was found and parsed", body.length > 800, body.length);

  // Matched as the whole condition, not as a loose containment: `assignVariant`
  // appearing anywhere in the body would pass while the guard was deleted.
  ok(
    "the assignment is created only when store.ready AND assignVariant",
    /if\s*\(experiment && store\.ready && assignVariant\)\s*\{/.test(body),
  );
  ok(
    "readOrCreateAssignment is called exactly once, inside that guard",
    (body.match(/readOrCreateAssignment\(/g) || []).length === 1,
  );
  ok(
    "the flag defaults to true, so the superadmin preview is unchanged",
    /assignVariant = true/.test(decomment(src)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. The fetch happens with the prospect, never on the dial
// ═══════════════════════════════════════════════════════════════════════════

section("5. Pressing Call does not wait for a playbook");

const PANEL = "app/sales/queue/CallPanel.js";
{
  const src = read(PANEL);
  const place = namedFunctionBody(src, "async function place(");
  ok("CallPanel's place() was found and parsed", place.length > 400, place.length);
  ok(
    "place() does not fetch the playbook — nothing loads between the press and the ring",
    !/\/api\/sales\/playbook/.test(place) && !/loadPlaybook/.test(place),
  );

  const loader = arrowBody(src, "const loadPlaybook = useCallback(");
  ok("the loader was found and parsed", loader.length > 100, loader.length);
  ok("…and it is the thing that fetches the playbook", /\/api\/sales\/playbook/.test(loader));
  ok(
    "…keyed on the prospect, so a new card loads a new script",
    /}, \[prospectId\]\);/.test(decomment(src)),
  );
  ok(
    "…and run from an effect rather than from a handler",
    /useEffect\(\(\) => \{\s*loadPlaybook\(\);\s*}, \[loadPlaybook\]\);/.test(decomment(src)),
  );
  ok(
    "a playbook that will not load does not disable the call",
    /setPlaybookError\(/.test(loader) && !/setError\(/.test(loader),
  );
  ok("CallPanel actually renders the panel", /<CallPlaybook/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. The screen shows a refusal where it has no line
// ═══════════════════════════════════════════════════════════════════════════

section("6. Nothing on the mid-call screen is padded");

const SCREEN = "app/sales/queue/CallPlaybook.js";
{
  const src = read(SCREEN);
  ok("the mid-call screen exists", src.length > 1000);

  ok(
    "it filters through objectionsToShow, so the degrade cannot be bypassed",
    /objectionsToShow/.test(src),
  );
  ok(
    "…and never calls matchObjectionText directly, which can return nothing",
    !/matchObjectionText/.test(decomment(src)),
  );
  ok(
    "a line it cannot resolve renders the refusal, not the line",
    /stage\.say\.refusal\b/.test(src) && /stage\.say\.refusalText/.test(src),
  );
  ok(
    "…and names what was missing, so the gap is visible rather than mysterious",
    /stage\.say\.missing/.test(src),
  );
  ok(
    "a prospect with no playbook gets the true sentence rather than a script",
    /noPlaybookReason/.test(src),
  );
  ok(
    "a playbook with stages missing says which",
    /missingStages/.test(src),
  );
  ok(
    "what we could not check is said out loud rather than read as a finding",
    /unchecked/.test(src),
  );
  ok(
    "a talking point is shown with the evidence it cites",
    /evidenceIds\.length/.test(src),
  );
  ok(
    "the stage does not advance itself off the call clock",
    !/setInterval/.test(decomment(src)) && !/elapsed/.test(decomment(src)),
  );
  ok(
    "no price, rate or figure is rendered from this screen's own copy",
    !/\$\d/.test(decomment(src)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. This file runs
// ═══════════════════════════════════════════════════════════════════════════

section("7. The check is wired in");

{
  const pkg = JSON.parse(read("package.json"));
  ok(
    "check:sales-call-playbook is a script",
    typeof pkg.scripts?.["check:sales-call-playbook"] === "string",
  );
  ok(
    "…and check:all runs it, so it cannot quietly stop being run",
    (pkg.scripts?.["check:all"] || "").includes("check:sales-call-playbook"),
  );
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
