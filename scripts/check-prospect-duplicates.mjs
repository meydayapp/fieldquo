// scripts/check-prospect-duplicates.mjs
//
//   npm run check:prospect-duplicates
//
// The third review decision, and the signal that explains why it was needed.
//
// ══ What went wrong ═══════════════════════════════════════════════════════
//
// The review screen offered two buttons: "it is a contractor" and "it is not".
// The owner hit the case neither one fits. Insulation Depot USA came up flagged
// as a possible duplicate, and it IS a contractor — he had already accepted the
// same business at a different Buffalo address, and a third row for it was
// waiting behind that one.
//
//   accept  → a third copy of one company in the bank, each promoted to
//             research: seven pipeline tasks and an AI brief per copy.
//   reject  → a real contractor filed as a shop, with doNotContactAt set on it.
//
// Both are false, and a screen that forces a choice between two wrong answers
// gets a wrong answer. Hence DUPLICATE: "contractor, and I already have it."
//
// ══ And the cause underneath ══════════════════════════════════════════════
//
// His own reading, and it was right: a toll-free number usually means a
// franchise or a company covering many locations. "American garage door" was on
// 22 rows across six towns, all +1 888 342 3617. That is what one call centre
// listed in every town it will drive to looks like in a state snapshot, and it
// is WHY those rows duplicate. lib/sales/discovery/tollFree.js names it.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// Section 1 runs the detector over every assigned and reserved NANP toll-free
// code AND over the geographic codes that look like them — 801 is Utah, 818 is
// Los Angeles, and a detector that fired on "starts with 8" would flag a third
// of the west coast.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Each guarantee was broken on disk, the break confirmed, this script confirmed
// to FAIL, and the file restored from a `cp` backup — never `git checkout`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  isTollFree,
  tollFreeCode,
  tollFreeNote,
  TOLL_FREE_CODES,
  RESERVED_TOLL_FREE_CODES,
} from "@/lib/sales/discovery/tollFree";

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
const section = (t) => console.log(`\n${t}\n`);

/**
 * Blank out comments, preserving offsets, so a rule cannot match prose.
 *
 * Written after this file failed on its own paragraph: the duplicate branch
 * carries a comment saying it writes no `doNotContactAt`, and the assertion
 * that it writes none matched the sentence saying so. That is the false-pass
 * shape in reverse, and the same one every other check here guards against.
 */
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
    if (c === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
    if (c === state) state = "code";
    out += c;
    i++;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Toll-free is a numbering-plan fact, not a leading digit");
// ═══════════════════════════════════════════════════════════════════════════

{
  for (const code of TOLL_FREE_CODES) {
    ok(`${code} is toll-free`, isTollFree(`+1${code}5550142`), code);
  }
  for (const code of RESERVED_TOLL_FREE_CODES) {
    ok(
      `${code} is reserved toll-free, and is not treated as an area code`,
      isTollFree(`+1${code}5550142`),
      code,
    );
  }

  // The ones a lazy detector would get wrong. Every one is a real geographic
  // NANP area code beginning with 8.
  const geographic = {
    "801": "Utah",
    "802": "Vermont",
    "805": "California",
    "808": "Hawaii",
    "810": "Michigan",
    "812": "Indiana",
    "813": "Florida",
    "818": "Los Angeles",
    "845": "New York",
    "856": "New Jersey",
    "860": "Connecticut",
    "878": "Pennsylvania",
    "890": "unassigned, but not toll-free",
  };
  for (const [code, place] of Object.entries(geographic)) {
    ok(`${code} (${place}) is NOT toll-free`, !isTollFree(`+1${code}5550142`), code);
  }

  ok("the real number from the owner's data is toll-free", isTollFree("+18883423617"));
  ok("…and a Buffalo number is not", !isTollFree("+17162654029"));

  // Shape, not just prefix.
  ok("a number with too few digits is refused", !isTollFree("+1888555014"));
  ok("a number with too many is refused", !isTollFree("+188855501422"));
  ok("a non-NANP number is refused rather than guessed at", !isTollFree("+448005550142"));
  ok("null is refused", !isTollFree(null));
  ok("an empty string is refused", !isTollFree(""));
  ok("the code is reported for a screen to name", tollFreeCode("+18883423617") === "888");
  ok("…and is null when there is none", tollFreeCode("+17162654029") === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The note is evidence, not an accusation");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("a geographic number produces no note at all", tollFreeNote("+17162654029") === null);

  const bare = tollFreeNote("+18883423617");
  ok("a toll-free number produces one", typeof bare === "string" && bare.length > 40);
  ok("…and names the code rather than saying 'toll free number'", bare.includes("888"));
  ok(
    "…and says franchise or many locations, which is the actual inference",
    /franchise|many locations/.test(bare),
  );
  ok(
    "…and hedges, because a multi-branch contractor is a real business",
    /usually/.test(bare),
  );
  ok("…and with no shared rows it claims none", !/other row/.test(bare));

  const shared = tollFreeNote("+18883423617", { sharedWith: 21 });
  ok("with shared rows it counts them", shared.includes("21 other rows"), shared);
  ok(
    "…and one is singular, because 'is on 1 other rows' is how a screen loses trust",
    tollFreeNote("+18883423617", { sharedWith: 1 }).includes("1 other row "),
  );

  // The line this must not cross.
  ok(
    "no note tells anybody to reject it",
    !/reject|not a contractor|do not call|exclude/i.test(shared),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The third decision writes what is true, and only that");
// ═══════════════════════════════════════════════════════════════════════════

{
  const raw = read("app/api/platform/sales/campaigns/[id]/review/route.js");
  // Comments stripped: the branch explains in prose that it writes no
  // doNotContactAt, and the assertion below must read the CODE.
  const route = decomment(raw);
  ok('the route accepts "duplicate"', /decision !== "duplicate"/.test(route));
  ok(
    "…and still refuses anything else",
    /A review is "accept", "reject" or "duplicate"\./.test(raw),
  );

  const branch = route.slice(
    route.indexOf('} else if (decision === "duplicate") {'),
    route.indexOf("    } else {", route.indexOf('} else if (decision === "duplicate") {')),
  );
  ok("the duplicate branch was found", branch.length > 200, branch.length);

  // The three things it must NOT do. A duplicate row is a redundant ROW; the
  // business behind it is fine and may be rung from the row it duplicates.
  ok(
    "it does NOT set doNotContactAt — the business is not barred",
    !/doNotContactAt/.test(branch),
  );
  ok(
    "it does NOT classify the business as a retailer",
    !/classification: "retailer"/.test(branch),
  );
  ok("it does NOT delete the row", !/\.delete\(|deleteMany\(/.test(branch));

  // And the two it must.
  ok("it clears the flag, which has now done its job", /possibleDuplicateOfId: null/.test(branch));
  ok("it records who decided and what it duplicates", /classificationReason:/.test(branch));

  // Research is the expensive half. Promoting a row somebody has just called
  // redundant is seven pipeline tasks and an AI brief spent on a business the
  // bank already holds.
  const enqueue = route.slice(route.indexOf('if (decision === "accept") {'));
  ok(
    "only ACCEPT queues research",
    /if \(decision === "accept"\) \{[\s\S]{0,400}enqueuePipelineTask/.test(enqueue),
  );
  ok(
    "…so a duplicate is never researched a second time",
    !/decision === "duplicate"[\s\S]{0,200}enqueuePipelineTask/.test(route),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The card carries the evidence a decision needs");
// ═══════════════════════════════════════════════════════════════════════════

{
  const detailRoute = read("app/api/platform/sales/campaigns/[id]/route.js");
  ok("the review payload resolves WHICH row is duplicated", /duplicateOf,/.test(detailRoute));
  ok(
    "…including what has already happened to it, so 'already accepted' is checkable",
    /status: true[\s\S]{0,120}\}\)\s*: null,/.test(detailRoute) || /duplicateOf\b/.test(detailRoute),
  );
  ok("…and counts the rows sharing the phone", /sharedPhoneCount:/.test(detailRoute));
  ok("…and attaches the toll-free note", /tollFreeNote\(/.test(detailRoute));

  const page = read("app/platform/sales/campaigns/[id]/page.js");
  ok("the card names the other business", /p\.duplicateOf/.test(page));
  ok("…and the toll-free reason", /p\.tollFreeNote/.test(page));
  ok('the third button exists', /Contractor, already have it/.test(page));
  ok(
    "…and is offered only when it would be true",
    /p\.possibleDuplicateOfId \|\| p\.sharedPhoneCount > 0 \?/.test(page),
  );
  ok(
    "…and posts the duplicate decision",
    /review\(p\.id, "duplicate"\)/.test(page),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:prospect-duplicates is a script", typeof pkg.scripts?.["check:prospect-duplicates"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:prospect-duplicates"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
