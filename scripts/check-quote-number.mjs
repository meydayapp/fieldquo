// scripts/check-quote-number.mjs
//
//   npm run check:quote-number
//
// Executes lib/quotes/quoteNumber.js — the one place quote numbers are
// minted — against the numbers a company actually accumulates, including a
// Good/Better/Best trio's suffixed ones. The night the first trio was made,
// the allocator read "Q-2026-0014-G" as sequence none, handed out
// "Q-2026-0001" again, and every "New quote" and lead conversion for that
// company 500'd on the unique index. Critical, found live by the QA rerun.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getNextQuoteNumber, TIER_SUFFIXES } from "../lib/quotes/quoteNumber.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}
const Y = new Date().getFullYear();

ok("nothing yet → 0001", getNextQuoteNumber(null) === `Q-${Y}-0001` && getNextQuoteNumber(undefined) === `Q-${Y}-0001` && getNextQuoteNumber("") === `Q-${Y}-0001`);
ok("a plain number increments", getNextQuoteNumber("Q-2026-0014") === `Q-${Y}-0015`);
ok("a tier-suffixed number increments the SEQUENCE, not the suffix", getNextQuoteNumber("Q-2026-0014-G") === `Q-${Y}-0015`, getNextQuoteNumber("Q-2026-0014-G"));
ok("...for every suffix the trio uses", Object.values(TIER_SUFFIXES).every((s) => getNextQuoteNumber(`Q-2026-0014-${s}`) === `Q-${Y}-0015`));
ok("a longer suffix is tolerated", getNextQuoteNumber("Q-2026-0014-BEST") === `Q-${Y}-0015`);
ok("9999 rolls to 10000 rather than wrapping", getNextQuoteNumber("Q-2026-9999") === `Q-${Y}-10000`);
ok("a legacy free-form number still yields a sequence rather than a crash", getNextQuoteNumber("INV-7") === `Q-${Y}-0008` && getNextQuoteNumber("garbage") === `Q-${Y}-0001`);
ok("the three tier suffixes are distinct", new Set(Object.values(TIER_SUFFIXES)).size === 3 && TIER_SUFFIXES.better !== TIER_SUFFIXES.best);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Code lines only: the route's comment quotes the old expression to say why
// it is gone, and a pin that read prose would fail on its own explanation.
const route = fs
  .readFileSync(path.join(ROOT, "app/api/quotes/tier-group/route.js"), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");
ok("the tier route uses the shared suffix map, not the label's first letter", /TIER_SUFFIX\[tierLabel\]/.test(route) && !/tierLabel\.toUpperCase\(\)\[0\]/.test(route));
ok("...imports it from the allocator", /TIER_SUFFIXES/.test(route) && /from "@\/lib\/quotes\/quoteNumber"/.test(route));
ok("...and creates the three rows in ONE transaction", /db\.\$transaction\(async \(tx\) =>/.test(route) && /tx\.quote\.create\(/.test(route));

console.log(`\ncheck-quote-number: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
