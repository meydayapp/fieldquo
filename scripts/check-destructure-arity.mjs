// scripts/check-destructure-arity.mjs
//
//   npm run check:destructure-arity
//
// An array destructuring binds by POSITION. This sweeps the positional
// `const [a, b, c] = await Promise.all([...])` pattern — and its
// `cond ? await Promise.all([...]) : [...]` variant — and checks two things:
//
//   1. every array feeding it has as many slots as it has names;
//   2. a name that clearly refers to a Prisma model sits at the slot that
//      actually queries that model.
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// The KPI dashboard returned 500 for every company, on every date range, empty
// or not. app/api/analytics/kpis/route.js loads ten things in one Promise.all
// and destructures them positionally. A commit adding the customer-satisfaction
// survey put its query SIXTH in the array and appended `satisfactionResponses`
// LAST in the destructuring. Nothing was missing and nothing was undefined —
// every name from the sixth onward simply pointed at its neighbour's value.
//
// `periodRevenueAgg` was handed the array of satisfaction rows, so
// `periodRevenueAgg._sum.total` read `._sum` off an Array. TypeError, thrown
// before the response was built, with an empty body. The ternary's other branch
// had the same shift, which is why a date range containing no data at all still
// failed — and why "it must be the data" was the wrong first guess.
//
// ══ Rule 1 alone would NOT have caught it ══════════════════════════════════
//
// Both branches had exactly ten slots and the destructuring had exactly ten
// names. Counting was never going to find this, and the first version of this
// file counted and passed. Order is the thing that was wrong, so order is what
// rule 2 checks: `satisfactionResponses` names a model, and it sat at the slot
// holding `db.changeOrder.findMany`, while `db.satisfactionResponse.findMany`
// sat four slots earlier.
//
// ══ Why rule 2 is conservative ═════════════════════════════════════════════
//
// Plenty of good names say nothing about a model (`forecastResult`,
// `jobHoursGrouped`), and a route may query one model twice (`revenueInvoices`
// and `periodRevenueAgg` are both db.invoice). So a slot is only ever reported
// when its name matches some OTHER slot's model, that model appears exactly
// once in the array, and the name does not match its own slot. A lone
// mismatch is still not reported: a genuine shift moves a RUN of slots, and
// requiring two keeps a single unusual name from failing the build.
//
// ══ Why a checker and not a code review ════════════════════════════════════
//
// This is invisible at the diff. The added query and the added name are in the
// same commit, both look right in isolation, and they are 60 lines apart. The
// reviewer sees "+1 query, +1 binding" and agrees. It is silent at every other
// layer too: no TypeScript here, no lint rule, and the arrays are built from
// live database calls, so the failure needs a request against real data to
// appear at all.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, undefined) : failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);

// ── Strip what would confuse bracket counting ──────────────────────────────
//
// Comments and string bodies become spaces of the same length, so every offset
// still lines up with the original file and a reported line number is the real
// one. A `[` inside a comment is how a checker like this starts lying.
function blank(src) {
  const out = src.split("");
  let i = 0;
  const wipe = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      const end = src.indexOf("\n", i);
      wipe(i, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
    } else if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      wipe(i, end === -1 ? src.length : end + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      let k = i + 1;
      while (k < src.length) {
        if (src[k] === "\\") { k += 2; continue; }
        if (src[k] === c) break;
        k++;
      }
      wipe(i + 1, k);
      i = k + 1;
    } else {
      i++;
    }
  }
  return out.join("");
}

// Index of the bracket matching the one at `open`, or -1.
function matchBracket(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if ("[({".includes(src[i])) depth++;
    else if ("])}".includes(src[i])) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Top-level elements of the array literal opening at `open`, as substrings.
// Returns null when it does not close, so a parse slip is reported rather than
// silently counted as zero.
function elementsOf(src, open) {
  const close = matchBracket(src, open);
  if (close === -1) return null;
  const interior = src.slice(open + 1, close);
  if (!/[^\s,]/.test(interior)) return [];
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < interior.length; i++) {
    const c = interior[i];
    if ("[({".includes(c)) depth++;
    else if ("])}".includes(c)) depth--;
    else if (c === "," && depth === 0) {
      parts.push(interior.slice(start, i));
      start = i + 1;
    }
  }
  const tail = interior.slice(start);
  if (/[^\s]/.test(tail)) parts.push(tail);
  return parts;
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

// `db.satisfactionResponse.findMany(...)` → "satisfactionResponse".
const modelIn = (text) => {
  const m = text.match(/\bdb\.([a-zA-Z]+)\s*\./);
  return m ? m[1] : null;
};

// camelCase → lowercase tokens: "satisfactionResponse" → ["satisfaction","response"].
const tokens = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const singular = (t) =>
  t.endsWith("ies") ? `${t.slice(0, -3)}y` : t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;

// Does a binding name refer to this model? True when the name's trailing tokens
// ARE the model's tokens — `callbackJobs` → [callback, job] ends with [job];
// `changeOrders` → [change, order] is [change, order].
//
// Deliberately not a substring test. "jobHoursGrouped" contains "job" and is
// not a Job query, and matching it that way made this checker report a shift in
// correct code — which is how a rule like this stops being believed.
const refersTo = (name, model) => {
  if (!model) return false;
  const n = tokens(name).map(singular);
  const m = tokens(model).map(singular);
  if (m.length === 0 || n.length < m.length) return false;
  return m.every((tok, i) => n[n.length - m.length + i] === tok);
};

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (entry.endsWith(".js") || entry.endsWith(".mjs")) acc.push(p);
  }
  return acc;
}

const FILES = [...walk(join(ROOT, "app", "api")), ...walk(join(ROOT, "lib"))];
ok("there are files to sweep", FILES.length > 50, `only ${FILES.length}`);

let sites = 0;
const arityProblems = [];
const orderProblems = [];

for (const file of FILES) {
  const raw = readFileSync(file, "utf8");
  const src = blank(raw);
  const rel = relative(ROOT, file);

  const re = /\bconst\s*\[/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    const nameParts = elementsOf(src, open);
    if (!nameParts || nameParts.length === 0) continue;
    const names = nameParts.map((s) => s.trim());
    // Rest and default patterns carry no simple positional identity.
    if (names.some((n) => !/^[A-Za-z_$][\w$]*$/.test(n))) continue;

    const close = matchBracket(src, open);
    if (close === -1) continue;
    if (!/^\s*=/.test(src.slice(close + 1, close + 200))) continue;

    const after = src.slice(close + 1, close + 400);
    if (!/Promise\.all\s*\(\s*\[/.test(after)) continue;
    sites++;

    // The initialiser's extent: to the statement's semicolon at depth 0.
    let end = src.length;
    let d = 0;
    for (let i = close + 1; i < src.length; i++) {
      if ("[({".includes(src[i])) d++;
      else if ("])}".includes(src[i])) d--;
      else if (d === 0 && src[i] === ";") { end = i; break; }
    }
    const region = src.slice(close + 1, end);

    // Every array literal that feeds the destructuring: the Promise.all
    // argument, plus the other arm when it is a ternary.
    //
    // The Promise.all one has to be found by name, not by depth: it sits
    // inside `Promise.all(`, so a depth-0 scan walks straight past the very
    // array this file exists to check — which is exactly what the first
    // version did, reporting a clean sweep while only ever reading the
    // ternary's other arm.
    const starts = new Set();
    for (const pm of region.matchAll(/Promise\.all\s*\(\s*\[/g)) {
      starts.add(pm.index + pm[0].length - 1);
    }
    let dd = 0;
    for (let i = 0; i < region.length; i++) {
      const c = region[i];
      if (c === "[") {
        if (dd === 0) starts.add(i);
        dd++;
      } else if (c === "]") dd--;
      else if ("({".includes(c)) dd++;
      else if (")}".includes(c)) dd--;
    }
    const arrays = [];
    for (const i of [...starts].sort((a, b) => a - b)) {
      const els = elementsOf(region, i);
      if (els) arrays.push({ els, at: lineOf(src, close + 1 + i) });
    }

    for (const { els, at } of arrays) {
      // ── Rule 1: same number of slots as names ──────────────────────────
      if (els.length !== names.length) {
        arityProblems.push(
          `${rel}:${at} — destructuring binds ${names.length} name(s) ` +
            `(line ${lineOf(src, m.index)}) but this array has ${els.length} slot(s)`,
        );
        continue;
      }

      // ── Rule 2: a model-shaped name sits at that model's slot ──────────
      const models = els.map(modelIn);
      const seen = new Map();
      for (const mo of models) if (mo) seen.set(mo, (seen.get(mo) || 0) + 1);
      const unique = new Set([...seen].filter(([, n]) => n === 1).map(([k]) => k));

      const shifted = [];
      for (let i = 0; i < names.length; i++) {
        if (refersTo(names[i], models[i])) continue;
        const elsewhere = models.findIndex((mo, j) => j !== i && mo && unique.has(mo) && refersTo(names[i], mo));
        if (elsewhere !== -1) {
          shifted.push(`${names[i]} is at slot ${i + 1} but db.${models[elsewhere]} is at slot ${elsewhere + 1}`);
        }
      }
      // One odd name is a naming choice; a run of them is a shift.
      if (shifted.length >= 2) {
        orderProblems.push(`${rel}:${at} — ${shifted.slice(0, 4).join("; ")}`);
      }
    }
  }
}

ok(
  "the sweep found positional Promise.all destructurings to check",
  sites >= 5,
  `only ${sites} site(s) matched — the pattern may have changed shape`,
);

// ── The parser has to be right, or a clean result means nothing ────────────
{
  const probe = "const [a, b, c] = x ? await Promise.all([q(1), q(2), q(3)]) : [[], [], []];";
  const b = blank(probe);
  ok("counts a 3-slot array as 3", elementsOf(b, b.indexOf("[")).length === 3);
  ok("counts an empty array as 0", elementsOf("[]", 0).length === 0);
  ok("is not fooled by nested arrays or objects", elementsOf("[ [1,2,3], {a:[4,5]}, 6 ]", 0).length === 3);
  ok("a bracket inside a comment or string does not count", elementsOf(blank('[ "a,b", /* , */ c ]'), 0).length === 2);
  // The shape that made the first version of this file report a false finding:
  // every element is itself a bracket.
  ok("counts [[], []] as 2", elementsOf("[[], []]", 0).length === 2);
  ok("a trailing comma adds no element", elementsOf("[a, b,]", 0).length === 2);
  ok("reads the model out of a query", modelIn(" db.satisfactionResponse.findMany({...})") === "satisfactionResponse");
  ok("plural binding matches singular model", refersTo("satisfactionResponses", "satisfactionResponse"));
  ok("changeOrders matches changeOrder", refersTo("changeOrders", "changeOrder"));
  ok("a qualified name still matches its model", refersTo("callbackJobs", "job"));
  ok("timeEntries matches timeEntry", refersTo("timeEntries", "timeEntry"));
  ok("an unrelated name does not match", !refersTo("forecastResult", "changeOrder"));
  // The substring trap: "jobHoursGrouped" contains "job" and is a groupBy on
  // TimeEntry, not a Job query.
  ok("a leading token is not a reference", !refersTo("jobHoursGrouped", "job"));
  ok("periodRevenueAgg is not an invoice reference", !refersTo("periodRevenueAgg", "invoice"));
  // The regression this file was written for, as a unit.
  {
    const names = ["expenses", "timeEntries", "jobMaterials", "revenueInvoices", "jobHoursGrouped",
      "periodRevenueAgg", "forecastResult", "callbackJobs", "changeOrders", "satisfactionResponses"];
    const shiftedModels = ["expense", "timeEntry", "jobMaterial", "invoice", "timeEntry",
      "satisfactionResponse", "invoice", null, "job", "changeOrder"];
    const alignedModels = ["expense", "timeEntry", "jobMaterial", "invoice", "timeEntry",
      "invoice", null, "job", "changeOrder", "satisfactionResponse"];
    const countShift = (models) => {
      const seen = new Map();
      for (const mo of models) if (mo) seen.set(mo, (seen.get(mo) || 0) + 1);
      const uniq = new Set([...seen].filter(([, n]) => n === 1).map(([k]) => k));
      let n = 0;
      for (let i = 0; i < names.length; i++) {
        if (refersTo(names[i], models[i])) continue;
        if (models.some((mo, j) => j !== i && mo && uniq.has(mo) && refersTo(names[i], mo))) n++;
      }
      return n;
    };
    ok("the KPI shift is detected", countShift(shiftedModels) >= 2, `saw ${countShift(shiftedModels)}`);
    ok("the corrected order is clean", countShift(alignedModels) === 0, `saw ${countShift(alignedModels)}`);
  }
}

ok(
  "every positional Promise.all destructuring matches its array's length",
  arityProblems.length === 0,
  arityProblems.slice(0, 8).join("\n      "),
);
ok(
  "…and each model-shaped name sits at that model's slot",
  orderProblems.length === 0,
  orderProblems.slice(0, 6).join("\n      "),
);

if (failures.length) {
  console.error(`check:destructure-arity FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check:destructure-arity passed — ${FILES.length} files, ${sites} positional ` +
    `Promise.all destructuring(s), ${pass} assertions.`,
);
