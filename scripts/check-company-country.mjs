// scripts/check-company-country.mjs
//
// The billing page asked a company where it was, while Company Settings
// displayed the answer.
//
// Three of twenty-nine companies had a null `country` and a complete,
// Google-formatted address — "1039 Bank St, Ottawa, ON K1X 1H4, Canada" — plus
// a city and a province. They signed up before AddressAutocomplete's country
// component reached the server, which is the same defect that left 55 client
// rows unable to resolve a tax rate.
//
// Because currencyForCountry reads the COLUMN, those companies were shown "we
// need to know where your business is before we can show plans": the product
// unable to read its own record, asking for something already on screen.
//
// ══ What these assert ══════════════════════════════════════════════════════
//
// That every branch READS a stated fact rather than guessing one. A country
// picks somebody's price, so the difference between reading and inferring is
// the difference between a discount and a support ticket. Nothing here derives
// a country from a phone number, a language or a currency — those correlate
// with a country and do not state one.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-company-country.mjs

import { resolveCountry } from "@/lib/company/resolveCountry";
import { currencyForCountry } from "@/lib/pricing/ladder";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
const is = (label, got, want) => ok(label, got === want, JSON.stringify(got));

console.log("\nWhat somebody typed always wins");
is("a stated CA is used", resolveCountry({ country: "CA" }).country, "CA");
is("...and reported as the column", resolveCountry({ country: "CA" }).source, "column");
// If the column disagrees with the address, the column is the human's answer.
is(
  "a stated country beats a contradicting address",
  resolveCountry({ country: "US", address: "1 Bank St, Ottawa, ON, Canada" }).country,
  "US",
);
// A `country` holding "Canada" means something upstream is writing the wrong
// shape. Falling through to the address still answers correctly, but the source
// says "address", which is the honest report.
is(
  "a country column holding a NAME is not treated as a code",
  resolveCountry({ country: "Canada", address: "" }).country,
  null,
);

console.log("\nThe address, when the column is empty");
// The three real rows, verbatim from the database.
for (const [name, address] of [
  ["testy testy inc", "1039 Bank St, Ottawa, ON K1X 1H4, Canada"],
  ["josef test", "8293 Old Waneta Rd, Trail, BC V1R 4W9, Canada"],
  ["pow pow inc", "9177 154 St, Surrey, BC V3R 9G8, Canada"],
]) {
  const r = resolveCountry({ country: null, address });
  ok(`${name} resolves to CA from its address`, r.country === "CA" && r.source === "address", JSON.stringify(r));
}
is("USA resolves", resolveCountry({ address: "12 Main St, Buffalo, NY 14201, USA" }).country, "US");
is("United States spelled out resolves",
  resolveCountry({ address: "12 Main St, Buffalo, NY, United States" }).country, "US");

// The trap. A substring match anywhere in the string gets this wrong, and gets
// it wrong confidently, which is how a Buffalo company gets priced in Canada.
is(
  "a street called Canada, in the USA, is the USA",
  resolveCountry({ address: "9 Canada Street, Buffalo, NY, USA" }).country,
  "US",
);
is(
  "...and a city called Canada likewise",
  resolveCountry({ address: "1 Main St, New Canada, ME, USA" }).country,
  "US",
);

console.log("\nThe province, when there is no address either");
is("QC is Canada", resolveCountry({ province: "QC" }).country, "CA");
is("...reported as the province", resolveCountry({ province: "QC" }).source, "province");
is("a spelled-out province works", resolveCountry({ province: "Ontario" }).country, "CA");

console.log("\nAnd when NOTHING states one, it says so");
// Absence of a statement is not a statement. Every one of these must return
// null so the caller ASKS, rather than defaulting somebody into a price.
for (const [label, rec] of [
  ["an empty record", {}],
  ["null", null],
  ["a string instead of a record", "CA"],
  ["blank strings", { country: "", address: "", province: "" }],
  ["a country we do not price", { address: "10 Downing St, London, UK" }],
  ["a US state, which is deliberately not inferred", { province: "TX" }],
]) {
  is(`${label} -> null`, resolveCountry(rec).country, null);
}

console.log("\nAnd the currency that follows from it");
is("CA bills in CAD", currencyForCountry(resolveCountry({ country: "CA" }).country), "CAD");
is("US bills in USD", currencyForCountry(resolveCountry({ country: "US" }).country), "USD");
// The whole point: this row used to be told to go and enter an address.
is(
  "a company with only an address still gets a currency",
  currencyForCountry(resolveCountry({ address: "1039 Bank St, Ottawa, ON K1X 1H4, Canada" }).country),
  "CAD",
);
is("an unknown company gets no currency, not a default",
  currencyForCountry(resolveCountry({}).country), null);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
