// scripts/check-number-country.mjs
//
//   npm run check:number-country
//
// Every US number search returned nothing, and said so convincingly.
//
// ══ The bug ═══════════════════════════════════════════════════════════════
//
// `searchLocalNumbers` took `country = "CA"` as a parameter default, and the
// panel that calls it has no country selector. So every search this product
// has ever made was Canadian. The owner searched 716 for a list of 1,683
// Buffalo contractors and read back "No numbers free in 716 right now. Try
// another area code." — while 819 and 343 worked, because those are Canadian.
//
// Twilio had five numbers in 716 the whole time. The same query under CA
// returns zero, and zero is indistinguishable from an exhausted area code.
// That is the worst shape a bug can take: a true-sounding sentence about the
// wrong question.
//
// ══ Why a selector was the wrong fix ══════════════════════════════════════
//
// It would have left the trap set one layer up: somebody picks Canada, types a
// US area code, and gets the same confident nothing. A NANP area code belongs
// to exactly one country and is derivable, so it is derived — and the check
// below is mostly about making sure nothing quietly puts a default back in
// front of the derivation, which is exactly how this survived its first fix.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// Every assertion runs the shipped functions. No network: the country decision
// is arithmetic on three digits, and a check that needed Twilio would not run
// in CI.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The parameter default was put back, the derivation was removed, and 911 was
// re-admitted as an area code. All three fail. Restored from a `cp` backup.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  countryForAreaCode,
  countryForRegion,
  isUsableAreaCode,
  CANADIAN_AREA_CODES,
} from "@/lib/voice/numberSearch";

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

// ═══════════════════════════════════════════════════════════════════════════
section("1. The area code decides the country");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The one from the bug report, and its neighbours.
  ok("716 (Buffalo) is US", countryForAreaCode("716") === "US");
  ok("585 (Rochester) is US", countryForAreaCode("585") === "US");
  ok("212 (Manhattan) is US", countryForAreaCode("212") === "US");
  ok("415 (San Francisco) is US", countryForAreaCode("415") === "US");

  // The two that worked for him, which is what made the bug visible.
  ok("819 (Gatineau) is CA", countryForAreaCode("819") === "CA");
  ok("343 (Ottawa) is CA", countryForAreaCode("343") === "CA");
  ok("613 (Ottawa) is CA", countryForAreaCode("613") === "CA");
  ok("604 (Vancouver) is CA", countryForAreaCode("604") === "CA");
  ok("902 (Halifax) is CA", countryForAreaCode("902") === "CA");

  // Every listed Canadian code resolves to CA, so a typo in the list is caught
  // rather than silently sending one province's search to the United States.
  const wrong = CANADIAN_AREA_CODES.filter((c) => countryForAreaCode(c) !== "CA");
  ok("every listed Canadian code resolves to CA", wrong.length === 0, wrong);
  ok("the list has no duplicates", new Set(CANADIAN_AREA_CODES).size === CANADIAN_AREA_CODES.length);
  ok(
    "every entry is three digits",
    CANADIAN_AREA_CODES.every((c) => /^[2-9]\d\d$/.test(c)),
    CANADIAN_AREA_CODES.filter((c) => !/^[2-9]\d\d$/.test(c)),
  );

  // Not an area code at all. Null, never a country: a three-digit string that
  // is not an area code must not silently become a US search.
  ok("911 is not an area code", countryForAreaCode("911") === null);
  ok("411 is not an area code", countryForAreaCode("411") === null);
  ok("611 is not an area code", countryForAreaCode("611") === null);
  ok("a leading 1 is not an area code", countryForAreaCode("187") === null);
  ok("a leading 0 is not an area code", countryForAreaCode("012") === null);
  ok("two digits is not an area code", countryForAreaCode("71") === null);
  ok("four digits is not an area code", countryForAreaCode("7166") === null);
  ok("letters are not an area code", countryForAreaCode("abc") === null);
  ok("null is not an area code", countryForAreaCode(null) === null);

  // It must agree with the validator that was already right about N11.
  const disagreements = [];
  for (let n = 200; n <= 999; n++) {
    const code = String(n);
    const usable = isUsableAreaCode(code);
    const country = countryForAreaCode(code);
    if (usable !== (country !== null)) disagreements.push(code);
  }
  ok(
    "it agrees with isUsableAreaCode on all 800 candidates",
    disagreements.length === 0,
    disagreements.slice(0, 8),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. A region decides it too, for the search that has no area code");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("ON is CA", countryForRegion("ON") === "CA");
  ok("QC is CA", countryForRegion("QC") === "CA");
  ok("BC is CA", countryForRegion("BC") === "CA");
  ok("…and it is case-insensitive", countryForRegion("qc") === "CA");
  ok("NY is US", countryForRegion("NY") === "US");
  ok("TX is US", countryForRegion("TX") === "US");
  ok("one letter is not a region", countryForRegion("N") === null);
  ok("three letters is not a region", countryForRegion("ONT") === null);
  ok("digits are not a region", countryForRegion("12") === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Nothing puts a default back in front of the derivation");
// ═══════════════════════════════════════════════════════════════════════════
//
// This is the section that matters. The bug survived its first fix because the
// route's "CA" default was removed while the FUNCTION still had one, and a
// parameter default beats `country || countryForAreaCode(code)` every time —
// the second half is never reached.

{
  // The signature lives in numberSearch; the derivation lives in nanp, which
  // is dependency-free so a client component can import it without dragging
  // the Twilio SDK into the browser bundle.
  const src = read("lib/voice/numberSearch.js");
  const pure = read("lib/voice/nanp.js");
  ok("the country rules are in a module with no imports", !/^import /m.test(pure));
  const sig = src.slice(
    src.indexOf("export async function searchLocalNumbers({"),
    src.indexOf("} = {}) {", src.indexOf("export async function searchLocalNumbers({")),
  );
  ok("the signature was found", sig.length > 40, sig.length);
  ok(
    "country is NOT defaulted in the signature",
    !/country\s*=\s*["']/.test(sig),
    sig,
  );
  ok("the derivation is used", /countryForAreaCode\(code\)/.test(src));
  ok("…and numberSearch re-exports it, so no caller had to move", /export \{[^}]*countryForAreaCode/.test(src));

  const route = read("app/api/platform/crew-lines/route.js");
  ok(
    "the route does not default it either",
    !/country:\s*\(body\?\.country \|\| ["']CA["']\)/.test(route),
  );
  ok(
    "…and passes null rather than a guess when none was stated",
    /country: body\?\.country \? String\(body\.country\)\.toUpperCase\(\) : null/.test(route),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The panel can search more than one area code at a time");
// ═══════════════════════════════════════════════════════════════════════════

{
  const page = read("app/platform/crew-lines/page.js");
  ok("there is a region box", /…or a whole region/.test(page));
  ok("…and it is sent", /region: region\.trim\(\) \|\| null/.test(page));
  ok(
    "…with its country stated, since there is no area code to derive from",
    /countryForRegion\(region\.trim\(\)\)/.test(page),
  );
  ok(
    "an area-code search still sends no country, so the server derives it",
    /!areaCode\.trim\(\) && region\.trim\(\)/.test(page),
  );
  // The empty answer has to stop reading like a broken connection.
  ok(
    "an empty area code says it is inventory rather than an error",
    /that is Twilio's inventory, not an error/.test(page),
  );
  ok("…and points at the region search", /region box/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:number-country is a script", typeof pkg.scripts?.["check:number-country"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:number-country"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
