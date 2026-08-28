// scripts/check-feature-matrix.mjs
//
//   npm run check:feature-matrix
//
// Every feature the pricing page NAMES has to be a feature the product HAS.
//
// ══ Why this is stricter than a dead button ════════════════════════════════
//
// AGENTS.md's rule is "never ship a control that appears to work and doesn't".
// A marketing page is that rule with the blast radius widened: a dead button
// wastes a click, but a row in a comparison table is a promise somebody buys
// on. "You said you had this" is a refund conversation, and by the time it
// happens the claim has been sitting on a public page for months.
//
// So lib/marketing/featureMatrix.js is not copy. It is a set of claims, each
// carrying the file that makes it true, and this script is what stops the two
// drifting apart. Delete the route, rename the library, and the sentence about
// it fails the build instead of quietly becoming a lie.
//
// It follows the precedent set by scripts/check-feature-flags.mjs, whose
// registry makes the same argument one layer down: a feature key with no
// consumer fails there, and a marketing claim with no implementation fails
// here. The two files agree on purpose — every withholdable feature in
// lib/features/registry.js has to be accounted for in the matrix, present or
// deliberately absent, so neither list can quietly grow past the other.
//
// ══ Executed where it can be, parsed where it can't ════════════════════════
//
// The registry's path matcher, the seat ladder and the matrix's own helpers are
// IMPORTED AND RUN, not read as text. That matters more than it sounds: an
// earlier attempt at a check like this matched source with a regex and passed
// happily against a guard that had been disabled with `false &&`, because a
// regex sees the characters and not the meaning.
//
// Where source has to be read — "does this route file define a POST handler",
// "does this layout mount the gate" — it is read with COMMENTS STRIPPED, by the
// same character scanner scripts/check-exports.mjs uses and for the same
// reason: a claim proved by a line that turns out to be inside a `/* ... */`
// is not proved at all, and a naive regex strip eats the translated sentences
// in appMessages.js that happen to contain comment characters.
//
// ══ The two words that may never appear ════════════════════════════════════
//
// The owner named a mobile app and a demo as things FieldQuo does not have.
// Those are the two claims a marketing page invents by itself, because every
// competitor's page has them and the shape of the table asks for them. They are
// banned here in the checker rather than in the data, deliberately: a ban that
// lives in the file it polices can be edited away in the same commit that
// breaks it.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-feature-matrix.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const abs = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(abs(p));
const read = (p) => fs.readFileSync(abs(p), "utf8");

let pass = 0;
const fails = [];
/** Records the assertion and RETURNS its verdict, so a failed precondition can
 *  skip the assertions that depend on it instead of cascading twenty
 *  meaningless failures out of one missing file. */
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${detail}` : ""}`);
  }
  return !!cond;
};

/**
 * Comments stripped; string, template and regex literals left intact.
 *
 * Lifted from scripts/check-exports.mjs, whose header records the two cheaper
 * versions that were both wrong: a regex strip ate 18,000 lines of
 * appMessages.js because a translated sentence contained the characters that
 * open a block comment. Copied rather than imported because that file exports
 * nothing — and a check script that cannot read its own dependencies is worth
 * thirty duplicated lines.
 */
function decomment(src) {
  let out = "";
  let i = 0;
  let prev = "";
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      out += " ";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] || ""); i += 2; continue; }
        out += src[i];
        if (src[i] === quote) { i++; break; }
        i++;
      }
      prev = quote;
      continue;
    }
    if (c === "/" && /[(,=:[!&|?{};+\-*%~^]/.test(prev)) {
      out += c;
      i++;
      let inClass = false;
      while (i < src.length) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] || ""); i += 2; continue; }
        if (src[i] === "[") inClass = true;
        else if (src[i] === "]") inClass = false;
        else if (src[i] === "/" && !inClass) { out += src[i]; i++; break; }
        else if (src[i] === "\n") break;
        out += src[i];
        i++;
      }
      prev = "/";
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

const CODE = new Map();
const code = (p) => {
  if (!CODE.has(p)) CODE.set(p, decomment(read(p)));
  return CODE.get(p);
};

/**
 * Does this file still hold the claimed marker?
 *
 * A plain `includes` was wrong, and mutation testing is how it was found:
 * renaming `checkUserLimit` to `checkUserLimitX` — which is exactly what a
 * refactor that breaks the claim looks like — left the substring intact and the
 * assertion passed. A marker that ends in an identifier character must
 * therefore END at a boundary, so `fillPair` does not match `fillPairX`.
 *
 * Still a literal, not a regex. Only the ONE character after the match is
 * examined, which is the smallest thing that fixes the class and the largest
 * thing that cannot be loosened into matching everything.
 */
const IDENT = /[A-Za-z0-9_$]/;
function holdsMarker(src, needle) {
  if (!needle) return true;
  const boundaryNeeded = IDENT.test(needle[needle.length - 1]);
  let from = 0;
  for (;;) {
    const at = src.indexOf(needle, from);
    if (at < 0) return false;
    if (!boundaryNeeded) return true;
    const after = src[at + needle.length];
    if (after === undefined || !IDENT.test(after)) return true;
    from = at + 1;
  }
}

// ── The modules under test, imported for real ──────────────────────────────

const matrix = await import("@/lib/marketing/featureMatrix");
const registry = await import("@/lib/features/registry");
const ladder = await import("@/lib/pricing/ladder");

const {
  MATRIX_GROUPS,
  GROUP_KEYS,
  AVAILABILITY,
  READINESS,
  FEATURE_MATRIX,
  MATRIX_KEYS,
  MATRIX_EXCLUSIONS,
  PLAN_DIFFERENCES,
  matrixEntry,
  entriesForGroup,
  includedInEveryPlan,
  partialFeatures,
} = matrix;

const { FEATURE_KEYS, featureForApiPath, featureForRoutePath, featureEntry, isKnownFeature } =
  registry;

const { SEAT_LADDER } = ladder;

/* ═══════════════════════════════════════════════════════════════════════════
   1. The matrix is a well-formed, closed list
   ═══════════════════════════════════════════════════════════════════════════

   Shape first, because every assertion after this one assumes it. A duplicate
   key would silently make one of two entries unreachable through matrixEntry(),
   and the renderer would drop a row nobody noticed was missing. */

console.log("\n── The matrix itself ───────────────────────────────────────────\n");

ok("the matrix is not empty", FEATURE_MATRIX.length > 0, `${FEATURE_MATRIX.length} entries`);
ok(
  "every key is unique",
  new Set(MATRIX_KEYS).size === MATRIX_KEYS.length,
  MATRIX_KEYS.filter((k, i) => MATRIX_KEYS.indexOf(k) !== i).join(" "),
);
ok(
  "every key is snake_case",
  MATRIX_KEYS.every((k) => /^[a-z][a-z0-9_]*$/.test(k)),
  MATRIX_KEYS.filter((k) => !/^[a-z][a-z0-9_]*$/.test(k)).join(" "),
);
ok(
  "it is frozen — nothing at runtime can add a claim",
  Object.isFrozen(FEATURE_MATRIX) && FEATURE_MATRIX.every((e) => Object.isFrozen(e)),
);
ok(
  "every group is a known group",
  FEATURE_MATRIX.every((e) => GROUP_KEYS.includes(e.group)),
  FEATURE_MATRIX.filter((e) => !GROUP_KEYS.includes(e.group)).map((e) => `${e.key}→${e.group}`).join(" "),
);
ok(
  "every group is actually used — no empty column in the table",
  GROUP_KEYS.every((g) => entriesForGroup(g).length > 0),
  GROUP_KEYS.filter((g) => entriesForGroup(g).length === 0).join(" "),
);
ok(
  "every availability is a known value",
  FEATURE_MATRIX.every((e) => AVAILABILITY.includes(e.availability)),
  FEATURE_MATRIX.filter((e) => !AVAILABILITY.includes(e.availability)).map((e) => e.key).join(" "),
);
ok(
  "every readiness is a known value",
  FEATURE_MATRIX.every((e) => READINESS.includes(e.readiness)),
  FEATURE_MATRIX.filter((e) => !READINESS.includes(e.readiness)).map((e) => e.key).join(" "),
);

// Required fields, checked one at a time so a failure names the field rather
// than saying "an entry is malformed" and leaving somebody to find out which.
for (const field of ["key", "name", "summary", "group", "availability", "readiness"]) {
  const bad = FEATURE_MATRIX.filter(
    (e) => typeof e[field] !== "string" || e[field].trim() === "",
  );
  ok(`every entry has a non-empty "${field}"`, bad.length === 0, bad.map((e) => e.key).join(" "));
}
ok(
  "every entry carries at least one proof path",
  FEATURE_MATRIX.every((e) => Array.isArray(e.proof) && e.proof.length > 0),
  FEATURE_MATRIX.filter((e) => !e.proof?.length).map((e) => e.key).join(" "),
);

// The whole point of the "partial" state: it exists so a half-built thing can
// be shown honestly instead of rounded to yes or no. An entry that claims it
// without saying what is missing has rounded it to yes with extra steps.
{
  const partials = partialFeatures();
  const silent = partials.filter((e) => typeof e.limits !== "string" || e.limits.trim().length < 20);
  ok(
    `every "partial" entry says what is missing (${partials.length} partial)`,
    silent.length === 0,
    silent.map((e) => e.key).join(" "),
  );
  const hedging = FEATURE_MATRIX.filter((e) => e.readiness === "shipped" && e.limits !== null);
  ok(
    "no \"shipped\" entry carries a limits note — shipped means shipped",
    hedging.length === 0,
    hedging.map((e) => e.key).join(" "),
  );
}

// The helpers the renderer will actually call. Executed, because a lookup that
// silently returns undefined produces a blank cell, not an error.
ok(
  "matrixEntry() finds every key",
  MATRIX_KEYS.every((k) => matrixEntry(k)?.key === k),
);
ok("matrixEntry() refuses an unknown key", matrixEntry("no_such_feature") === undefined);
ok(
  "entriesForGroup() partitions the matrix exactly once",
  GROUP_KEYS.reduce((n, g) => n + entriesForGroup(g).length, 0) === FEATURE_MATRIX.length,
);
ok(
  "includedInEveryPlan() returns only every_plan entries",
  includedInEveryPlan().every((e) => e.availability === "every_plan"),
);
ok(
  "partialFeatures() returns only partial entries",
  partialFeatures().every((e) => e.readiness === "partial"),
);
ok(
  "MATRIX_GROUPS and GROUP_KEYS agree",
  GROUP_KEYS.length === MATRIX_GROUPS.length &&
    MATRIX_GROUPS.every((g, i) => g.key === GROUP_KEYS[i]),
);
ok(
  "every group has a label a contractor would read",
  MATRIX_GROUPS.every((g) => typeof g.label === "string" && g.label.trim() !== ""),
);

/* ═══════════════════════════════════════════════════════════════════════════
   2. Nothing claims a mobile app, and nothing claims a demo
   ═══════════════════════════════════════════════════════════════════════════

   The owner said plainly that FieldQuo has neither. Both are things a feature
   table invents by itself: every competitor lists them, the grid has a row
   shaped like them, and "works on your phone" is one careless rewrite away from
   "mobile app". The /app pages are responsive — that is a true sentence and a
   different sentence.

   The patterns live HERE and not in the matrix. A ban that ships inside the
   file it polices gets edited away in the same commit that breaks it. */

console.log("\n── The two claims that may never appear ────────────────────────\n");

const FORBIDDEN = [
  [/mobile app/i, "a mobile app"],
  [/native app/i, "a native app"],
  [/\bapp store\b/i, "the App Store"],
  [/google play/i, "Google Play"],
  [/\b(ios|android)\b/i, "iOS or Android"],
  [/download (the|our) app/i, "downloading an app"],
  [/\bdemos?\b/i, "a demo"],
  [/see it in action/i, "a demo, by another name"],
  [/\bsandbox\b/i, "a sandbox"],
];

// Every human-readable string in the matrix, with the field it came from, so a
// failure says where to go. Proof PATHS are excluded — a path is a filename,
// and app/api/demo/book/route.js is a real route that this matrix must never
// claim but may legitimately be unable to avoid naming elsewhere.
const humanText = [];
for (const g of MATRIX_GROUPS) {
  humanText.push([`group ${g.key}.label`, g.label]);
  if (g.blurb) humanText.push([`group ${g.key}.blurb`, g.blurb]);
}
for (const e of FEATURE_MATRIX) {
  humanText.push([`${e.key}.name`, e.name]);
  humanText.push([`${e.key}.summary`, e.summary]);
  if (e.limits) humanText.push([`${e.key}.limits`, e.limits]);
}
for (const x of MATRIX_EXCLUSIONS) {
  // Subjects only, not reasons. An exclusion's reason is where "there is no
  // demo, and app/api/demo is our own sales calendar" gets written down —
  // banning the word there would ban the sentence that keeps the record.
  humanText.push([`exclusion ${x.subject}`, `${x.subject}`]);
}
for (const d of PLAN_DIFFERENCES.varies) {
  humanText.push([`plan difference ${d.key}`, d.label]);
}

ok(`there is text to scan (${humanText.length} strings)`, humanText.length >= FEATURE_MATRIX.length * 2);

for (const [pattern, what] of FORBIDDEN) {
  const hits = humanText.filter(([, s]) => pattern.test(s));
  ok(`nothing claims ${what}`, hits.length === 0, hits.map(([where, s]) => `${where}: "${s}"`).join(" | "));
}

// The same ban, one level deeper: no entry may be PROVED by the demo booking
// routes. /api/demo/book and /api/demo/slots exist — they are FieldQuo's own
// sales calendar, not something a contractor buys — and an entry that pointed
// at them would pass every path check while claiming exactly the thing the
// owner said we do not sell.
{
  const demoProof = FEATURE_MATRIX.flatMap((e) =>
    e.proof.filter((p) => /(^|\/)(demo|demos)(\/|$)/.test(p.path)).map((p) => `${e.key}→${p.path}`),
  );
  ok("no entry is proved by the demo-booking routes", demoProof.length === 0, demoProof.join(" "));
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Every proof path exists, and holds what the entry claims
   ═══════════════════════════════════════════════════════════════════════════

   This is the assertion the whole file exists for. A path that has been deleted
   or renamed must fail the build — otherwise the matrix decays into a list of
   sentences about a product that has moved on, which is worse than no list at
   all because it reads as verified.

   `holds` is a list of LITERAL substrings, matched against the file with
   comments stripped. Literals rather than regexes on purpose: a regex is where
   the last mistake of this kind lived, and a literal cannot be accidentally
   loosened into matching everything. */

console.log("\n── Every claim points at code that exists ──────────────────────\n");

const HTTP_VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/** The HTTP handlers a route file actually defines. Comments already stripped. */
function handlersIn(src) {
  const found = new Set();
  for (const verb of HTTP_VERBS) {
    if (
      new RegExp(`export\\s+(async\\s+)?function\\s+${verb}\\b`).test(src) ||
      new RegExp(`export\\s+(const|let|var)\\s+${verb}\\s*=`).test(src) ||
      new RegExp(`export\\s*\\{[^}]*\\b${verb}\\b[^}]*\\}`).test(src)
    ) {
      found.add(verb);
    }
  }
  return [...found];
}

let proofCount = 0;
for (const entry of FEATURE_MATRIX) {
  for (const p of entry.proof) {
    proofCount++;
    const here = `${entry.key} → ${p.path}`;

    if (!ok(`${here} exists`, exists(p.path))) continue;

    const src = code(p.path);

    // A route that defines no handler is a folder, not an endpoint. Next would
    // serve a 405 for every method, and the feature would be "implemented" by a
    // file that answers nothing.
    if (p.path.endsWith("/route.js")) {
      const verbs = handlersIn(src);
      ok(`${here} defines a real handler`, verbs.length > 0, "no exported HTTP method");
    }

    // A page with no default export does not render. Next fails the build on
    // it, but this file is also read by humans deciding whether a claim is
    // backed, and "the page exists" is a weaker statement than "the page
    // renders something".
    if (p.path.endsWith("/page.js")) {
      ok(`${here} default-exports a page`, /export\s+default\b/.test(src));
    }

    // The claim itself. Not "the file exists" but "the file contains the thing
    // the entry says makes this feature true" — the sender, the Stripe call,
    // the model call, the gate.
    for (const needle of p.holds || []) {
      ok(`${here} holds "${needle}"`, holdsMarker(src, needle));
    }
  }
}
ok(`every proof path was checked (${proofCount} paths)`, proofCount >= FEATURE_MATRIX.length);

// A proof that is only ever a page is a proof about a screen, not about a
// capability — screens are the easiest thing in this codebase to render without
// a working backend, which is the failure class AGENTS.md names first.
{
  const screenOnly = FEATURE_MATRIX.filter((e) =>
    e.proof.every((p) => p.path.startsWith("app/app/") && p.path.endsWith("page.js")),
  );
  ok(
    "no entry is proved by a screen alone",
    screenOnly.length === 0,
    screenOnly.map((e) => e.key).join(" "),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. The closed registry and the matrix agree
   ═══════════════════════════════════════════════════════════════════════════

   lib/features/registry.js is the list of things FieldQuo can WITHHOLD from a
   company. Every one of them is therefore something FieldQuo offers, so every
   one of them is either a row in this table or a deliberate omission with a
   reason. Silence is the failure: a feature that is neither claimed nor
   excluded is one nobody decided about. */

console.log("\n── The withholdable features are all accounted for ─────────────\n");

const claimedKeys = new Set(FEATURE_MATRIX.map((e) => e.featureKey).filter(Boolean));
const excludedKeys = new Map(
  MATRIX_EXCLUSIONS.filter((x) => x.registryKey).map((x) => [x.registryKey, x.reason]),
);

for (const key of FEATURE_KEYS) {
  const claimed = claimedKeys.has(key);
  const excluded = excludedKeys.has(key);
  ok(
    `${key} is either claimed or deliberately excluded`,
    claimed !== excluded,
    claimed && excluded ? "both — pick one" : "neither",
  );
  if (excluded) {
    ok(
      `...and its exclusion gives a reason`,
      typeof excludedKeys.get(key) === "string" && excludedKeys.get(key).trim().length >= 20,
    );
  }
}
ok(
  "no exclusion names a registry key that does not exist",
  [...excludedKeys.keys()].every((k) => isKnownFeature(k)),
  [...excludedKeys.keys()].filter((k) => !isKnownFeature(k)).join(" "),
);
ok(
  "every featureKey on an entry is a real registry key",
  [...claimedKeys].every((k) => isKnownFeature(k)),
  [...claimedKeys].filter((k) => !isKnownFeature(k)).join(" "),
);
ok(
  "every exclusion carries a reason",
  MATRIX_EXCLUSIONS.every((x) => typeof x.reason === "string" && x.reason.trim().length >= 20),
  MATRIX_EXCLUSIONS.filter((x) => !(x.reason?.trim().length >= 20)).map((x) => x.subject).join(" "),
);

/* A gate that is claimed has to be MOUNTED, and mounting is checked by running
   the registry's own matcher against the proof paths rather than by trusting
   the entry. `featureForRoutePath` and `featureForApiPath` are the same
   functions middleware and lib/currentMember.js use, so a prefix that stopped
   matching here stopped matching in production too.

   The reverse direction matters more: a proof path that FALLS UNDER a gate and
   whose entry does not say so would put a withholdable feature in the
   "included in every plan" list. */

console.log("\n── Gated code is labelled as gated ─────────────────────────────\n");

/** "app/api/settings/website/route.js" → "/api/settings/website" */
function urlFor(p) {
  if (p.startsWith("app/api/")) return "/" + p.slice("app/".length).replace(/\/route\.js$/, "");
  if (p.startsWith("app/app/")) {
    return "/" + p.slice("app/".length).replace(/\/(page|layout)\.js$/, "");
  }
  return null;
}

for (const entry of FEATURE_MATRIX) {
  for (const p of entry.proof) {
    const url = urlFor(p.path);
    if (!url) continue;
    const owner = url.startsWith("/api/") ? featureForApiPath(url) : featureForRoutePath(url);
    if (!owner) continue;
    ok(
      `${entry.key} names the gate its proof sits behind (${owner})`,
      entry.featureKey === owner,
      `${p.path} is gated by ${owner}, entry says ${entry.featureKey ?? "nothing"}`,
    );
  }
}

// And the gate is really mounted on the page layer. check-feature-flags.mjs
// asserts this too; it is repeated here because THIS file's claim is that a
// withheld feature disappears, and a claim is not allowed to rest on another
// script continuing to exist.
for (const key of claimedKeys) {
  const f = featureEntry(key);
  for (const prefix of f.routePrefixes) {
    const layout = `app${prefix}/layout.js`;
    if (!ok(`${prefix} has a layout to hang the gate on`, exists(layout))) continue;
    const src = code(layout);
    ok(
      `${prefix} mounts <FeatureGate feature="${key}">`,
      src.includes("<FeatureGate") && src.includes(`feature="${key}"`),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. "Included in every plan" is a fact about the ladder, not a decision
   ═══════════════════════════════════════════════════════════════════════════

   The tempting table has a tick in the right-hand column and a dash in the
   left, because that is what a tier table looks like. FieldQuo's ladder does
   not work that way: the four rungs differ in how many people they seat and
   what they cost, and in nothing else.

   Inventing differentiation to make the table look normal would be the exact
   failure this whole file is about, one column over. So the claim is asserted
   against the ladder itself — if a rung ever gains a feature field, this fails
   and somebody has to decide what the table now says. */

console.log("\n── Tier differentiation, as it actually is ─────────────────────\n");

const RUNG_SHAPE = ["tierKey", "label", "seats", "crewSeats", "price", "sortOrder"];
ok(`the ladder has rungs (${SEAT_LADDER.length})`, SEAT_LADDER.length > 1);
for (const tier of SEAT_LADDER) {
  const keys = Object.keys(tier).sort();
  ok(
    `${tier.tierKey} carries seats, crew and a price — and nothing else`,
    keys.length === RUNG_SHAPE.length && RUNG_SHAPE.every((k) => keys.includes(k)),
    keys.join(","),
  );
}
// Not vacuous: the three things that DO vary have to actually vary, or the
// matrix's "the tiers differ by size, not by features" sentence is only half
// true and the other half is "they don't differ at all".
for (const field of ["seats", "crewSeats", "price"]) {
  ok(
    `${field} genuinely differs between rungs`,
    new Set(SEAT_LADDER.map((t) => t[field])).size === SEAT_LADDER.length,
  );
}
ok(
  "so every matrix entry is available on every plan",
  FEATURE_MATRIX.every((e) => e.availability === "every_plan"),
  FEATURE_MATRIX.filter((e) => e.availability !== "every_plan").map((e) => e.key).join(" "),
);
ok(
  "...and the matrix says which fields the tiers differ by",
  PLAN_DIFFERENCES.varies.length > 0 &&
    PLAN_DIFFERENCES.varies.every((d) => typeof d.label === "string" && d.proof.length > 0),
);
for (const d of PLAN_DIFFERENCES.varies) {
  for (const p of d.proof) {
    if (!ok(`plan difference "${d.key}" → ${p.path} exists`, exists(p.path))) continue;
    for (const needle of p.holds || []) {
      ok(`plan difference "${d.key}" → ${p.path} holds "${needle}"`, holdsMarker(code(p.path), needle));
    }
  }
}

/* The Plan table carries three columns that LOOK like tier differentiation.
   Two are enforced and simply unused by the four shipped rungs; one is not
   enforced at all. The matrix records which is which, and this asserts the
   record is still true — because "the pricing page prints a feature line from a
   column nothing enforces" is precisely the shape of bug that gets shipped
   here, and a note about it is worthless if nobody notices it going stale. */

console.log("\n── Plan columns that look like gates ───────────────────────────\n");

for (const m of PLAN_DIFFERENCES.planColumns) {
  ok(
    `${m.column} — the note explains it`,
    typeof m.note === "string" && m.note.trim().length >= 20,
  );
  if (m.enforcedIn) {
    for (const p of m.enforcedIn) {
      if (!ok(`${m.column} is enforced in ${p.path}`, exists(p.path))) continue;
      for (const needle of p.holds || []) {
        ok(`${m.column} → ${p.path} holds "${needle}"`, holdsMarker(code(p.path), needle));
      }
    }
  }
  // The unenforced one. Its complete reader set under the two layers where
  // enforcement could live is declared; a NEW reader there means somebody wired
  // it up, and the matrix's note has become wrong.
  if (m.enforcedIn === null) {
    // The bare column name. `column` is written "Plan.aiCopilotEnabled" because
    // that is what it is called in the schema, but no source file spells the
    // model out — scanning for the qualified name finds nothing, and a scan
    // that finds nothing passes an emptiness check for the wrong reason.
    const field = m.column.split(".").pop();
    const found = scanFor(field, ["app/api", "lib"]).sort();
    const declared = [...m.mentionedIn].sort();
    ok(
      `${m.column} is still read by nobody who could enforce it`,
      found.length === declared.length && found.every((f, i) => f === declared[i]),
      `found ${found.join(" ")} / declared ${declared.join(" ")}`,
    );
  }
}

/**
 * Every .js file under `dirs` whose source mentions `needle`.
 *
 * The matrix itself is skipped. It names these columns in order to say that
 * nothing enforces them, and counting the record as a reader would make the
 * assertion self-refuting the moment it was written down.
 */
function scanFor(needle, dirs) {
  const SELF = "lib/marketing/featureMatrix.js";
  const hits = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(abs(dir))) {
      const rel = `${dir}/${name}`;
      const stat = fs.statSync(abs(rel));
      if (stat.isDirectory()) walk(rel);
      else if (name.endsWith(".js") && rel !== SELF && read(rel).includes(needle)) hits.push(rel);
    }
  };
  for (const d of dirs) walk(d);
  return hits;
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. The matrix is worth rendering
   ═══════════════════════════════════════════════════════════════════════════

   Two shape checks that are really editorial. The register the owner asked for
   is "AI quote review", "AI receptionist" — words a painter says. An entry
   named after a database table has failed at the only job a marketing page
   has. */

console.log("\n── It reads like a contractor wrote it ─────────────────────────\n");

const JARGON = [
  "webhook", "endpoint", "schema", "prisma", "cron", "middleware", "boolean",
  "json", "api route", "tenant", "multi-tenant", "crud",
];
{
  const jargonHits = [];
  for (const [where, s] of humanText) {
    for (const word of JARGON) {
      if (new RegExp(`\\b${word}\\b`, "i").test(s)) jargonHits.push(`${where}: ${word}`);
    }
  }
  ok("no internal vocabulary leaks into a customer-facing name", jargonHits.length === 0, jargonHits.join(" | "));
}
ok(
  "every name is short enough to be a table row",
  FEATURE_MATRIX.every((e) => e.name.length <= 42),
  FEATURE_MATRIX.filter((e) => e.name.length > 42).map((e) => e.key).join(" "),
);
ok(
  "every summary is a sentence, not a paragraph",
  FEATURE_MATRIX.every((e) => e.summary.length >= 20 && e.summary.length <= 220),
  FEATURE_MATRIX.filter((e) => e.summary.length < 20 || e.summary.length > 220).map((e) => e.key).join(" "),
);
ok(
  "no two entries share a name",
  new Set(FEATURE_MATRIX.map((e) => e.name.toLowerCase())).size === FEATURE_MATRIX.length,
);

// ── The claim that was false, kept false-proof ─────────────────────────────
//
// Twelve industry pages said "No credit card required." under the Start free
// trial button, in six languages. createTrialCheckoutSession runs
// mode: "subscription" with a trial and does NOT pass
// payment_method_collection: "if_required" — so Stripe's default, "always",
// applies and the card is taken before the free month begins.
//
// It is asserted from BOTH ends, because either end alone rots: the copy must
// not re-acquire the promise, and the Stripe call must not quietly start
// collecting a card again under corrected copy that says it doesn't.
//
// If the owner decides the promise should be TRUE, the fix is
// payment_method_collection: "if_required" on that session, and then this
// assertion is what has to change — deliberately, with the copy, in one commit.
{
  const { readdirSync, readFileSync: rf } = await import("node:fs");
  const billing = rf("lib/platform/stripeBilling.js", "utf8");
  const trial = billing.slice(billing.indexOf("export async function createTrialCheckoutSession"));
  const collectsCard = !/payment_method_collection:\s*"if_required"/.test(
    trial.slice(0, trial.indexOf("\n}\n")),
  );

  for (const file of readdirSync("app/i18n/industries").filter((f) => f !== "index.js")) {
    const src = rf(`app/i18n/industries/${file}`, "utf8");
    const promises = /no credit card|aucune carte|no se requiere tarjeta|картка не потрібна|ਕ੍ਰੈਡਿਟ ਕਾਰਡ ਦੀ ਲੋੜ ਨਹੀਂ|walang kailangang credit card/i.test(src);
    ok(
      `${file}: does not promise "no credit card" while checkout collects one`,
      !(promises && collectsCard),
    );
  }
  ok(
    "…and the trial checkout still is the thing being described",
    /mode: "subscription"/.test(trial.slice(0, 2000)),
  );
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions across ${FEATURE_MATRIX.length} features and ${proofCount} proof paths`,
);
process.exit(fails.length ? 1 : 0);

