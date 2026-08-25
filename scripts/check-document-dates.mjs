// scripts/check-document-dates.mjs
//
// A date on a client-facing document must not depend on where the server is.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-document-dates.mjs
//
// `validUntil` and `dueDate` are CALENDAR DATES stored as UTC midnight. The
// formatter used to pass no timeZone, so it rendered in whatever zone the
// process was in — and any zone west of UTC turned "valid until the 30th" into
// "the 29th" on the one line of a quote whose job is to state a deadline.
//
// This runs the formatter under a spread of real timezones, including both
// extremes of the offset range, and fails if any two disagree.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

let pass = 0;
const fails = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (err) {
    fails.push(`${name}: ${err.message}`);
  }
}

// UTC-11 through UTC+14 — the whole span a deployment could land in.
const ZONES = [
  "Pacific/Midway",
  "America/Vancouver",
  "America/Toronto",
  "UTC",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Kiritimati",
];

const loader = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));

/** Format one value under one TZ, in a fresh process — the only honest way. */
function formatUnder(tz, iso, language = "en") {
  const out = execFileSync(
    process.execPath,
    [
      "--import",
      loader,
      "-e",
      `const { documentFormatters } = await import("@/lib/i18n/documentLabels");
       process.stdout.write(documentFormatters(${JSON.stringify(language)}, "CAD").date(${JSON.stringify(iso)}));`,
    ],
    { env: { ...process.env, TZ: tz }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return out.trim();
}

check("a calendar date reads the same in every timezone", () => {
  const iso = "2026-09-30T00:00:00.000Z";
  const seen = new Map();
  for (const tz of ZONES) seen.set(tz, formatUnder(tz, iso));
  const values = [...new Set(seen.values())];
  assert.equal(
    values.length,
    1,
    `disagreed: ${[...seen].map(([t, v]) => `${t}=${v}`).join(", ")}`,
  );
  // And it is the day that was STORED, not the one before it.
  assert.match(values[0], /September 30, 2026/);
});

check("the last day of a month does not slip into the previous one", () => {
  // Month ends are where an off-by-one is both most likely and most visible:
  // "valid until January 31" becoming "January 30" is a deadline moving.
  for (const iso of [
    "2026-01-31T00:00:00.000Z",
    "2026-02-28T00:00:00.000Z",
    "2028-02-29T00:00:00.000Z", // leap
    "2026-12-31T00:00:00.000Z", // and a year boundary
  ]) {
    const expected = iso.slice(8, 10);
    for (const tz of ["Pacific/Midway", "America/Vancouver", "Pacific/Kiritimati"]) {
      const got = formatUnder(tz, iso);
      assert.ok(
        got.includes(String(Number(expected))),
        `${iso} under ${tz} rendered "${got}"`,
      );
    }
  }
});

check("every sending language agrees on the day", () => {
  // A French client and an English client must not be told different dates.
  const iso = "2026-09-30T00:00:00.000Z";
  for (const lang of ["en", "fr", "es", "uk", "pa", "tl"]) {
    const west = formatUnder("America/Vancouver", iso, lang);
    const east = formatUnder("Australia/Sydney", iso, lang);
    assert.equal(west, east, `${lang}: "${west}" vs "${east}"`);
    assert.ok(/30/.test(west), `${lang} lost the day: "${west}"`);
  }
});

check("an absent or unusable date is empty, never 'Invalid Date'", () => {
  const out = formatUnder("UTC", "");
  assert.equal(out, "");
});

if (fails.length) {
  console.error(`✗ ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ document dates: ${pass} checks passed across ${ZONES.length} timezones`);
