// scripts/check-drill-down.mjs
//
// Every way a user can arrive at /app/settings/services, and whether the
// "Back to Company Settings" bar is entitled to appear. The bar exists to be
// absent most of the time, so the interesting cases are the ones that must
// return null.
//
//   node scripts/check-drill-down.mjs

import { pathnameOf, resolveArrival } from "../lib/settings/drillDown.js";

const COMPANY = "/app/settings/company";
const SERVICES = "/app/settings/services";
const BRANDING = "/app/settings/branding";
const CLAIM = { from: COMPANY, to: SERVICES, label: "Company Settings" };

let failures = 0;
function expect(name, got, wantShown) {
  const shown = got !== null;
  const ok = shown === wantShown && (!wantShown || got.from === COMPANY);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name} → ${shown ? `back to ${got.from}` : "no bar"}`);
}

// The case the whole thing exists for.
expect(
  "clicked Manage on Company Settings",
  resolveArrival({ claim: CLAIM, previous: COMPANY, current: SERVICES }),
  true,
);

// Landing organically. No click of ours ran, so there is no claim.
expect(
  "cold load / pasted URL / bookmark",
  resolveArrival({ claim: null, previous: null, current: SERVICES }),
  false,
);
expect(
  "sidebar click from Company Settings",
  resolveArrival({ claim: null, previous: COMPANY, current: SERVICES }),
  false,
);
expect(
  "sidebar click from somewhere else",
  resolveArrival({ claim: null, previous: BRANDING, current: SERVICES }),
  false,
);
expect(
  "arrived from outside settings entirely",
  resolveArrival({ claim: null, previous: "/app/quotes", current: SERVICES }),
  false,
);

// A claim that the browser did not honour. Middle-click, a redirect, a link
// clicked and then abandoned — the record must not stick to the next page.
expect(
  "claim made, but the browser went elsewhere",
  resolveArrival({ claim: CLAIM, previous: COMPANY, current: BRANDING }),
  false,
);
expect(
  "claim made on one page, navigation happened from another",
  resolveArrival({ claim: CLAIM, previous: BRANDING, current: SERVICES }),
  false,
);
expect(
  "stale claim reused two navigations later",
  resolveArrival({ claim: CLAIM, previous: SERVICES, current: SERVICES }),
  false,
);

// Malformed claims: a caller that forgot the label would render "Back to
// undefined", which is worse than no bar.
expect("claim missing label", resolveArrival({ claim: { from: COMPANY, to: SERVICES }, previous: COMPANY, current: SERVICES }), false);
expect("claim missing to", resolveArrival({ claim: { from: COMPANY, label: "x" }, previous: COMPANY, current: SERVICES }), false);
expect("claim missing from", resolveArrival({ claim: { to: SERVICES, label: "x" }, previous: COMPANY, current: SERVICES }), false);
expect(
  "self-referential claim",
  resolveArrival({ claim: { from: SERVICES, to: SERVICES, label: "Services" }, previous: SERVICES, current: SERVICES }),
  false,
);
expect("no arguments at all", resolveArrival(), false);
expect("empty object", resolveArrival({}), false);

// A link written with a query string still resolves, because the claim is
// normalised to the pathname the router will report.
expect(
  "drill-down link carrying a query string",
  resolveArrival({
    claim: { from: COMPANY, to: pathnameOf(`${SERVICES}?tab=types`), label: "Company Settings" },
    previous: COMPANY,
    current: SERVICES,
  }),
  true,
);

let pathFailures = 0;
for (const [input, want] of [
  [`${SERVICES}?tab=types`, SERVICES],
  [`${SERVICES}#anchor`, SERVICES],
  [`${SERVICES}?a=1#b`, SERVICES],
  [SERVICES, SERVICES],
  [undefined, ""],
  [null, ""],
]) {
  const got = pathnameOf(input);
  const ok = got === want;
  if (!ok) pathFailures++;
  console.log(`${ok ? "ok  " : "FAIL"}  pathnameOf(${JSON.stringify(input)}) → ${JSON.stringify(got)}`);
}
failures += pathFailures;

console.log(failures === 0 ? "\nAll drill-down checks passed." : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
