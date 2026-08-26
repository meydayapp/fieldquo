// scripts/check-address-fields.mjs
//
//   npm run check:address-fields
//
// Every consumer of the address autocomplete must keep the province and the
// country, or say in the file why it doesn't.
//
// ══ Why this check exists ══════════════════════════════════════════════════
//
// app/components/AddressAutocomplete.js has always done the hard part
// correctly: it asks Google for `address_components`, walks them for locality,
// administrative_area_level_1, postal_code and country, and hands all of it to
// `onPlaceSelected` with lat/lng. Nothing was ever missing at the source.
//
// The CONSUMERS threw it away. Six of the eight, on the day this was written:
//
//   ClientPicker (the quote builder's quick-add)   dropped country
//   SelfQuoteFlow                                  kept only place.address
//   InstantQuoteFlow                               kept only place.address
//   BookingFlow                                    kept only the address
//   signup                                         dropped country
//
// The result in production: 55 client rows, ZERO with a country, three with a
// province and no country. And a province with no country is inert —
// resolveTaxRate refuses to guess a country from a region code, deliberately,
// because "ON" alone could be Ontario or a foreign region or a typo. So every
// quote for every one of those clients resolved to "unknown", fell back to a
// company default of 0%, and charged no tax while saying tax applied.
// Q-2026-0011 was $5,250 of Ontario work with $682.50 of HST left off it.
//
// One dropped identifier in a destructure, and a homeowner reads a wrong
// total. That is worth a check.
//
// ══ Why the consumer list is derived ═══════════════════════════════════════
//
// A hand-written list is the one that rots: it passes forever while the form
// added next month quietly drops the same field. So the set comes off the
// filesystem — anything rendering <AddressAutocomplete> or <AddressField> — and
// a new form is covered the day it is written, without anyone remembering.
//
// ══ How a consumer opts out ════════════════════════════════════════════════
//
// By saying so, in the file, next to the handler:
//
//   // address-jurisdiction: none — <why>
//
// The marketing route planner declares it: a MarketingStop is a pin on a
// door-knocking route, not a person. It has no province column, creates no
// Client, and there is no tax jurisdiction for the components to inform. That
// is a real answer, and it reads differently from an oversight — which is the
// entire point of making it explicit rather than keeping a list here.

import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `\n        ${got}` : ""}`);
  }
};

/* ── The consumer set, off the filesystem ──────────────────────────────── */

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = [
  ...(await walk(join(ROOT, "app"))),
  ...(await walk(join(ROOT, "lib"))),
];

// The two components that surface a Places result. AddressField wraps
// AddressAutocomplete and forwards the whole object under `onResolved`, so its
// callers face exactly the same choice.
const HANDLER_PROPS = ["onPlaceSelected", "onResolved"];

/**
 * The source of the handler passed to one of those props.
 *
 * Inline arrows are read where they sit. A bare identifier — the settings
 * screens both use `handlePlaceSelected` — is followed to its declaration,
 * because a check that only understood inline arrows would pass those two
 * files without ever looking at what they do.
 */
function handlerSource(src, prop) {
  const at = src.indexOf(`${prop}={`);
  if (at === -1) return null;

  // The comment block immediately above the prop. Declarations live there —
  // `onPlaceSelected={onResolved}` has nowhere inside it to put a sentence.
  const context = src.slice(Math.max(0, at - 600), at);

  let i = at + prop.length + 1; // the '{'
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const expr = src.slice(at + prop.length + 2, i).trim();

  // A bare identifier: follow it to the function it names.
  if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
    const decl = src.indexOf(`function ${expr}(`);
    // A prop handed straight through — this file does not define it, so
    // there is no body to inspect and the pass-through case applies.
    if (decl === -1) return { expr, body: expr, context };
    let j = src.indexOf("{", decl);
    let d = 0;
    for (; j < src.length; j++) {
      if (src[j] === "{") d++;
      else if (src[j] === "}") {
        d--;
        if (d === 0) break;
      }
    }
    return { expr, body: src.slice(decl, j + 1), context };
  }
  return { expr, body: expr, context };
}

const consumers = [];
for (const full of files) {
  const src = readFileSync(full, "utf8");
  // Renders one of them — not merely imports it, and not the component's own
  // definition.
  if (!/<AddressAutocomplete[\s>]|<AddressField[\s>]/.test(src)) continue;
  for (const prop of HANDLER_PROPS) {
    const found = handlerSource(src, prop);
    if (found === null) continue;
    consumers.push({
      file: relative(ROOT, full),
      prop,
      // What the handler DOES — the arrow, or the named function's body.
      handler: found.body,
      // The bare expression, for the pass-through test.
      expr: found.expr,
      // Where a declaration comment can live.
      declaration: found.context,
      src,
    });
  }
}

console.log(
  `\n${consumers.length} address-autocomplete consumers, derived from the filesystem`,
);
ok(
  "the consumer set is derived, not hand-kept",
  consumers.length >= 7,
  `found ${consumers.length}`,
);
// The forms that produce a taxable client must be among them, whatever they
// get renamed to — a rename that silently emptied this set would make the
// whole check pass by finding nothing.
for (const must of [
  "app/components/quotes/builder/ClientPicker.js",
  "app/quote/[companySlug]/SelfQuoteFlow.js",
  "app/signup/page.js",
])
  ok(
    `${must} is in the consumer set`,
    consumers.some((c) => c.file === must),
    consumers.map((c) => c.file).join(", "),
  );

/* ── The assertion ─────────────────────────────────────────────────────── */

console.log("\nEvery consumer keeps the jurisdiction, or declares why not");

const OPT_OUT = /address-jurisdiction:\s*none/;
// A wrapper that hands the whole place object on without touching it. Its
// CALLER is the consumer that has to choose, and is checked as one in its own
// right — AddressField forwards to BookingFlow's `onResolved`, which appears
// separately in the set above.
const FORWARDS = /address-jurisdiction:\s*forwarded/;

for (const c of consumers) {
  if (OPT_OUT.test(c.handler) || OPT_OUT.test(c.declaration)) {
    ok(`${c.file} — declares coordinates/address only, by name`, true);
    continue;
  }
  if (FORWARDS.test(c.handler) || FORWARDS.test(c.declaration)) {
    // Only believable when it really is a pass-through: a bare identifier the
    // file does not itself define, i.e. a prop handed straight through. An
    // arrow could quietly drop a field behind the claim.
    ok(
      `${c.file} — forwards the whole place object, and actually does`,
      /^[A-Za-z_$][\w$]*$/.test(c.expr) && c.handler === c.expr,
      `handler is ${c.handler.slice(0, 120)}`,
    );
    continue;
  }

  const keepsProvince = /\bprovince\b/.test(c.handler);
  const keepsCountry = /\bcountry\b/.test(c.handler);

  ok(
    `${c.file} (${c.prop}) keeps province and country`,
    keepsProvince && keepsCountry,
    `province:${keepsProvince} country:${keepsCountry} — a province with no ` +
      `country resolves to no tax rate at all (lib/tax/documentTax.js). ` +
      `Keep both, or add "// address-jurisdiction: none — <why>".`,
  );
}

/* ── And the source they all read from ─────────────────────────────────── */
//
// If AddressAutocomplete ever stops extracting the components, every consumer
// above keeps its correct-looking destructure and every one of them starts
// receiving undefined. The check would go on passing.

console.log("\nThe component still produces what the consumers destructure");

const component = readFileSync(
  join(ROOT, "app/components/AddressAutocomplete.js"),
  "utf8",
);
ok(
  "asks Google for address_components",
  /fields:\s*\[[^\]]*address_components/.test(component),
);
for (const [type, field] of [
  ["locality", "city"],
  ["administrative_area_level_1", "province"],
  ["country", "country"],
])
  ok(
    `maps ${type} -> ${field}`,
    new RegExp(`${type}[\\s\\S]{0,120}${field}\\s*=`).test(component),
  );
ok(
  "hands the country out as ISO alpha-2 (short_name)",
  /types\.includes\("country"\)[\s\S]{0,80}short_name/.test(component),
);

console.log(
  `\n${fail ? "FAILED" : "PASSED"} — ${pass}/${pass + fail} assertions`,
);
process.exit(fail ? 1 : 0);
